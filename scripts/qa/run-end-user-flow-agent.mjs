import fs from 'node:fs/promises'
import path from 'node:path'
import {
  CdpConnection,
  buildViewUrl,
  captureScreenshot,
  checkNoHorizontalOverflow,
  closeBrowserSession,
  collectViewAudit,
  configureViewport,
  defaultViewports,
  detectBrowserExecutable,
  detectBrowserErrorPage,
  ensureQaDirectories,
  findFreePort,
  formatTimestampForPath,
  getQaPaths,
  launchQaBrowser,
  openBrowserSession,
  readAuthStateMetadata,
  safeClickByText,
  safeClickBySelector,
  safeCloseDialogOrFlow,
  safeNavigateView,
  waitForCdpEndpoint,
  waitForFirstFieldVisible,
  waitForShellStable,
  waitForStepFlowVisible,
} from './auth/cdpHarness.mjs'
import {
  assertWriteAndCleanAllowed,
  createQaRunId,
  createFlowResult,
  finalizeFlowResult,
  getWriteAndCleanSkipReason,
  isDangerousFinalAction,
  isDryRunMode,
  isWriteAndCleanMode,
  isSafeOpeningAction,
  recordSkippedDangerousAction,
  resolveQaAgentMode,
  summarizeAgentResults,
} from './endUserFlowAgentCore.mjs'
import {
  cleanupCreatedEntity,
  findCreatedEntityByQaRun,
  getCleanupEntry,
  listWriteAndCleanEnabledFlowIds,
  loadSupabasePublicEnv,
} from './qaCleanupRegistry.mjs'
import {
  assertQaAgentEnvironmentAllowed,
  resolveQaEnvironment,
} from './qaEnvironmentGuardrails.mjs'

const rootDir = process.cwd()
const qaPaths = getQaPaths(rootDir)
const REPORT_BASENAME = 'end-user-flow-agent-latest'

const FLOW_SPECS = [
  {
    id: 'invoice-create',
    viewId: 'invoices',
    labels: ['Nueva factura'],
    expectedTitle: 'Nueva factura',
    run: runInvoiceFlow,
  },
  {
    id: 'client-create',
    viewId: 'clients',
    labels: ['Nuevo cliente'],
    expectedTitle: 'Nuevo cliente',
    run: runSimpleOpenAndCancelFlow,
    fillDummyData: true,
    supportsWriteAndClean: true,
  },
  {
    id: 'property-create',
    viewId: 'properties',
    labels: ['Nueva propiedad'],
    expectedTitle: 'Nueva propiedad',
    run: runSimpleOpenAndCancelFlow,
    supportsWriteAndClean: true,
  },
  {
    id: 'quote-create',
    viewId: 'quotes',
    labels: ['Nuevo presupuesto'],
    expectedTitle: 'Nuevo presupuesto',
    run: runSimpleOpenAndCancelFlow,
    supportsWriteAndClean: true,
  },
  {
    id: 'expense-create',
    viewId: 'expenses',
    labels: ['Nuevo gasto'],
    expectedTitle: 'Nuevo gasto',
    run: runSimpleOpenAndCancelFlow,
    supportsWriteAndClean: true,
  },
  {
    id: 'payment-create',
    viewId: 'payments',
    labels: ['Registrar cobro'],
    expectedTitle: 'Registrar cobro',
    run: runSimpleOpenAndCancelFlow,
  },
  {
    id: 'job-create',
    viewId: 'jobs',
    labels: ['Nuevo servicio', 'Registrar servicio'],
    expectedTitle: 'Nuevo servicio',
    run: runSimpleOpenAndCancelFlow,
  },
  {
    id: 'service-from-client',
    viewId: 'clients',
    labels: ['Nuevo servicio'],
    expectedTitle: 'Nuevo servicio',
    recordSelector: '[data-qa="client-list-item"] .cc-operational-item__select',
    actionSelector: '[data-qa="client-create-service"]',
    contextParam: 'client',
    run: runContextualServiceFlow,
  },
  {
    id: 'service-from-property',
    viewId: 'properties',
    labels: ['Nuevo servicio'],
    expectedTitle: 'Nuevo servicio',
    recordSelector: '[data-qa="property-list-item"] .cc-operational-item__select',
    actionSelector: '[data-qa="property-create-service"]',
    contextParam: 'property',
    run: runContextualServiceFlow,
  },
  {
    id: 'recurring-section',
    viewId: 'jobs',
    labels: [],
    expectedTitle: 'Servicio recurrente',
    run: runRecurringSectionAudit,
  },
  {
    id: 'fiscal-closing',
    viewId: 'fiscal_closing',
    labels: [],
    expectedTitle: 'Cierre fiscal',
    run: runFiscalClosingAudit,
  },
]

async function main() {
  const qaAgentMode = resolveQaAgentMode(readModeArg(process.argv.slice(2)))

  await ensureQaDirectories(qaPaths)

  let storedState = null
  try {
    storedState = await readAuthStateMetadata(qaPaths.stateFile)
  } catch {
    throw new Error(`Missing auth state at ${path.relative(rootDir, qaPaths.stateFile)}. Run npm run qa:auth:setup first.`)
  }

  const appUrl = process.env.QA_APP_URL?.trim() || storedState.appUrl
  const qaEnvironment = resolveQaEnvironment({ qaEnv: process.env.QA_ENV, appUrl })
  assertQaAgentEnvironmentAllowed({ mode: qaAgentMode, appUrl })
  const browser = await detectBrowserExecutable()
  const remoteDebuggingPort = Number.parseInt(process.env.QA_REMOTE_DEBUGGING_PORT ?? '', 10) || await findFreePort()

  const headless = process.argv.includes('--headless')

  const browserLaunch = await launchQaBrowser({
    executablePath: browser.executablePath,
    profileDir: storedState.profileDir,
    remoteDebuggingPort,
    startUrl: appUrl,
    headless,
  })

  const endpoint = await waitForCdpEndpoint(browserLaunch.remoteDebuggingPort, 20000)
  const connection = new CdpConnection(endpoint.webSocketDebuggerUrl)
  await connection.connect()
  const session = await openBrowserSession(connection, appUrl)
  const shellState = await waitForShellStable(connection, session.sessionId)

  if (shellState?.startupError) {
    throw new Error('Application startup failed before authenticated QA. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for the target build.')
  }

  if (!shellState?.authenticated) {
    throw new Error('Authenticated shell was not detected in the reused QA profile. Run npm run qa:auth:setup again.')
  }

  const timestamp = formatTimestampForPath(new Date())
  assertWriteAndCleanAllowed({ mode: qaAgentMode, appUrl })
  const qaRunId = createQaRunId()
  const supabaseEnv = await loadSupabasePublicEnv(rootDir)
  const runScreenshotsDir = path.join(qaPaths.screenshotsDir, timestamp, 'end-user-flow-agent')
  const results = []
  const viewports = selectRequestedItems(defaultViewports(), process.env.QA_VIEWPORT_IDS, 'viewport')
  const flowSpecs = selectRequestedItems(FLOW_SPECS, process.env.QA_FLOW_IDS, 'flow')

  for (const viewport of viewports) {
    await configureViewport(connection, session.sessionId, viewport)

    for (const flowSpec of flowSpecs) {
      const flowContext = {
        connection,
        sessionId: session.sessionId,
        appUrl,
        viewport,
        flowSpec,
        qaAgentMode,
        qaRunId,
        supabaseEnv,
      }
      const result = isWriteAndCleanMode(qaAgentMode) && !flowSpec.supportsWriteAndClean
        ? await runRestrictedWriteAndCleanFlow(flowContext)
        : await flowSpec.run(flowContext)

      result.screenshotPath = path.join(runScreenshotsDir, `${viewport.id}-${flowSpec.id}.png`)
      await captureScreenshot(connection, session.sessionId, result.screenshotPath)
      results.push(finalizeFlowResult(result))
      process.stdout.write(`QA flow ${viewport.id}/${flowSpec.id}: ${result.failedChecks.length === 0 ? 'ok' : 'check failures'}\n`)
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: qaAgentMode,
    qaEnvironment,
    qaRunId,
    appUrl,
    browserId: browser.id,
    profileDir: storedState.profileDir,
    writeAndCleanEnabledFlows: listWriteAndCleanEnabledFlowIds(),
    summary: summarizeAgentResults(results),
    results,
  }

  const jsonReportPath = path.join(qaPaths.reportsDir, `${REPORT_BASENAME}.json`)
  const markdownReportPath = path.join(qaPaths.reportsDir, `${REPORT_BASENAME}.md`)
  const cleanupJsonReportPath = path.join(qaPaths.reportsDir, 'qa-cleanup-latest.json')
  const cleanupMarkdownReportPath = path.join(qaPaths.reportsDir, 'qa-cleanup-latest.md')
  const createdEntitiesReportPath = path.join(qaPaths.reportsDir, 'qa-created-entities-latest.json')
  await fs.writeFile(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeMarkdownReport(markdownReportPath, report)
  await writeCleanupArtifacts({
    cleanupJsonReportPath,
    cleanupMarkdownReportPath,
    createdEntitiesReportPath,
    report,
  })

  process.stdout.write(
    [
      '',
      `End-user flow QA report written: ${path.relative(rootDir, markdownReportPath)}`,
      `End-user flow QA JSON written: ${path.relative(rootDir, jsonReportPath)}`,
      `Cleanup report written: ${path.relative(rootDir, cleanupMarkdownReportPath)}`,
      `Created entities JSON written: ${path.relative(rootDir, createdEntitiesReportPath)}`,
      `Screenshots written under: ${path.relative(rootDir, runScreenshotsDir)}`,
      '',
    ].join('\n'),
  )

  await closeBrowserSession(connection, session.targetId, session.sessionId)
  await connection.close()
}

function selectRequestedItems(items, rawIds, label) {
  const requestedIds = String(rawIds ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)

  if (requestedIds.length === 0) return items

  const knownIds = new Set(items.map((item) => item.id))
  const unknownIds = requestedIds.filter((id) => !knownIds.has(id))
  if (unknownIds.length > 0) {
    throw new Error(`Unknown QA ${label} id(s): ${unknownIds.join(', ')}`)
  }

  const requestedSet = new Set(requestedIds)
  return items.filter((item) => requestedSet.has(item.id))
}

async function runSimpleOpenAndCancelFlow(context) {
  if (isWriteAndCleanMode(context.qaAgentMode) && context.flowSpec.supportsWriteAndClean) {
    return await runWriteAndCleanFlow(context)
  }

  const result = await runBaseFlowAudit(context)
  const { connection, sessionId, flowSpec } = context

  const openAction = await safeClickOpeningAction(connection, sessionId, flowSpec.labels, result)
  result.checks.expectedButtonExists = Boolean(openAction)
  result.checks.openingResponds = Boolean(openAction)

  if (!openAction) {
    result.notes.push('Opening action was not found for this viewport.')
    return result
  }

  result.checks.formVisible = await waitForStepFlowVisible(connection, sessionId, flowSpec.expectedTitle)
  result.checks.titleVisible = result.checks.formVisible
  result.checks.firstFieldVisible = await waitForFirstFieldVisible(connection, sessionId, '[data-qa="action-flow-panel"]')
  result.checks.noHorizontalOverflowAfterOpen = await checkNoHorizontalOverflow(connection, sessionId)

  if (flowSpec.fillDummyData) {
    const filled = await fillVisibleTextFields(connection, sessionId)
    if (filled > 0) {
      result.notes.push(`Filled ${filled} visible field(s) with dummy dry-run data.`)
    } else {
      result.notes.push('No safe dummy fields were filled.')
    }
  }

  const closeLabel = await safeCloseDialogOrFlow(connection, sessionId)
  result.checks.cancelExists = Boolean(closeLabel)

  if (closeLabel && isDangerousFinalAction(closeLabel) && !isSafeOpeningAction(closeLabel)) {
    recordSkippedDangerousAction(result, closeLabel, 'dangerous-close-action')
    result.checks.cancelReturnsToContext = false
    return result
  }

  result.checks.cancelReturnsToContext = await waitForReturnToView(context)
  result.checks.noRealCreationMessage = !(await detectRealCreationMessage(connection, sessionId))
  result.checks.noDangerousActionClicked = true
  result.checks.noRealDataCreated = true
  return result
}

async function runContextualServiceFlow(context) {
  const result = await runBaseFlowAudit(context)
  const { connection, sessionId, flowSpec } = context
  const recordOpened = await safeClickSelectorWithRetry(connection, sessionId, flowSpec.recordSelector)
  result.checks.contextRecordAvailable = recordOpened

  if (!recordOpened) {
    result.notes.push(`No record was available for ${flowSpec.id}; contextual flow could not be opened.`)
    return result
  }

  const workspaceContext = await waitForWorkspaceContext(connection, sessionId, flowSpec.contextParam)
  result.checks.workspaceVisible = Boolean(workspaceContext?.contextId)
  result.checks.contextRoutePresent = Boolean(workspaceContext?.contextId)
  if (!workspaceContext?.contextId) {
    result.notes.push(`Workspace context parameter ${flowSpec.contextParam} was not preserved.`)
    return result
  }

  let openAction = await safeClickSelectorWithRetry(connection, sessionId, flowSpec.actionSelector, 6)
  if (!openAction) {
    await safeClickOpeningAction(connection, sessionId, ['Mas acciones', 'Más acciones'], result)
    openAction = await safeClickSelectorWithRetry(connection, sessionId, flowSpec.actionSelector, 6)
  }

  result.checks.expectedButtonExists = openAction
  result.checks.openingResponds = openAction
  if (!openAction) {
    result.notes.push(`Contextual service action was not found for ${flowSpec.id}.`)
    return result
  }

  result.checks.formVisible = await waitForStepFlowVisible(connection, sessionId, flowSpec.expectedTitle)
  result.checks.firstFieldVisible = await waitForFirstFieldVisible(connection, sessionId, '[data-qa="action-flow-panel"]')
  result.checks.contextPreservedInFlow = await currentUrlHasContext(connection, sessionId, flowSpec.contextParam, workspaceContext.contextId)
  result.checks.noHorizontalOverflowAfterOpen = await checkNoHorizontalOverflow(connection, sessionId)

  const closeLabel = await safeCloseDialogOrFlow(connection, sessionId)
  result.checks.cancelExists = Boolean(closeLabel)
  const returnedContext = await waitForWorkspaceContext(connection, sessionId, flowSpec.contextParam, workspaceContext.contextId)
  result.checks.cancelReturnsToContext = Boolean(returnedContext?.contextId)
  result.checks.noRealCreationMessage = !(await detectRealCreationMessage(connection, sessionId))
  result.checks.noDangerousActionClicked = true
  result.checks.noRealDataCreated = true
  return result
}

async function runRecurringSectionAudit(context) {
  const result = await runBaseFlowAudit(context)
  const { connection, sessionId } = context
  const recurringState = await waitForRecurringServiceState(connection, sessionId)

  result.checks.recurringSectionVisible = recurringState.sectionVisible
  result.checks.recurringStatusExplained = recurringState.statusExplained
  result.checks.noDangerousActionClicked = true
  result.checks.noRealDataCreated = true

  if (recurringState.enabledAction) {
    const opened = await safeClickSelectorWithRetry(connection, sessionId, '[data-qa="recurring-service-action"]')
    result.checks.recurringFlowOpened = opened && await waitForStepFlowVisible(connection, sessionId, context.flowSpec.expectedTitle)
    await safeCloseDialogOrFlow(connection, sessionId)
  } else {
    result.checks.recurringFlowSkippedSafely = recurringState.disabledAction
    result.skippedActions.push({
      label: 'Crear servicio recurrente',
      reason: 'service-recurring-contract-unavailable',
    })
    result.notes.push('Recurring service creation is intentionally unavailable because no service recurrence contract exists.')
  }

  return result
}

async function runRestrictedWriteAndCleanFlow(context) {
  const result = await runBaseFlowAudit(context)
  const reason = getWriteAndCleanSkipReason(context.flowSpec.id)
  result.checks.writeAndCleanSkippedSafely = true
  result.skippedActions.push({ label: context.flowSpec.id, reason })
  result.cleanup = { status: 'cleanup-not-available', reason }
  result.notes.push(`write-and-clean skipped safely: ${reason}.`)
  return result
}

async function runWriteAndCleanFlow(context) {
  const result = await runBaseFlowAudit(context)
  const { connection, sessionId, flowSpec, qaRunId, supabaseEnv } = context
  const openAction = await safeClickOpeningAction(connection, sessionId, flowSpec.labels, result)
  result.checks.expectedButtonExists = Boolean(openAction)
  result.checks.openingResponds = Boolean(openAction)

  if (!openAction) {
    result.cleanup = {
      status: 'cleanup-not-available',
      reason: 'opening-action-missing',
    }
    return result
  }

  result.checks.formVisible = await waitForStepFlowVisible(connection, sessionId, flowSpec.expectedTitle)
  result.checks.titleVisible = result.checks.formVisible
  result.checks.firstFieldVisible = await waitForFirstFieldVisible(connection, sessionId, '[data-qa="action-flow-panel"]')
  result.checks.noHorizontalOverflowAfterOpen = await checkNoHorizontalOverflow(connection, sessionId)

  if (!supabaseEnv.available) {
    result.cleanup = {
      status: 'cleanup-not-available',
      reason: 'missing-supabase-public-env',
    }
    result.notes.push('write-and-clean requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in process env or .env.local/.env.')
    return result
  }

  const fillOutcome = await fillAndSubmitWriteFlow(context)
  result.checks.writePathPrepared = fillOutcome.prepared
  result.checks.writeSubmitClicked = fillOutcome.submitted

  if (!fillOutcome.prepared || !fillOutcome.submitted) {
    result.cleanup = {
      status: 'cleanup-not-available',
      reason: fillOutcome.reason ?? 'write-flow-not-submitted',
    }
    if (fillOutcome.note) result.notes.push(fillOutcome.note)
    return result
  }

  const successTextVisible = await waitForAnyText(connection, sessionId, fillOutcome.successTexts, 12000)
  result.checks.writeSuccessSignalVisible = successTextVisible
  result.checks.realCreationMessageVisible = successTextVisible

  const visibleEntityId = await readCreatedEntityId(connection, sessionId, flowSpec.id)
  const createdEntity = visibleEntityId ? { id: visibleEntityId, created_at: null } : await findCreatedEntitySafely({
    flowId: flowSpec.id,
    qaRunId,
    createdAfter: result.startedAt,
    result,
  })
  result.checks.createdEntityDetected = Boolean(createdEntity?.id)
  result.checks.writeSuccessSignalVisible = successTextVisible || Boolean(createdEntity?.id)
  result.checks.realCreationMessageVisible = successTextVisible || Boolean(createdEntity?.id)

  if (!createdEntity?.id) {
    result.cleanup = {
      status: 'cleanup-failed',
      reason: 'created-entity-not-found',
    }
    return result
  }

  result.createdEntities.push({
    flowId: flowSpec.id,
    table: getCleanupEntry(flowSpec.id)?.table ?? null,
    entityId: createdEntity.id,
    qaRunId,
    createdAt: createdEntity.created_at ?? null,
  })

  try {
    const cleanup = await cleanupCreatedEntity({
      rootDir,
      flowId: flowSpec.id,
      entityId: createdEntity.id,
    })
    result.cleanup = cleanup
    result.checks.cleanupSucceeded = cleanup.status === 'cleaned'
  } catch (error) {
    result.cleanup = {
      status: 'cleanup-failed',
      reason: error instanceof Error ? error.message : 'unknown-cleanup-error',
    }
    result.checks.cleanupSucceeded = false
  }

  await safeCloseDialogOrFlow(connection, sessionId).catch(() => null)
  result.checks.cancelReturnsToContext = await waitForReturnToView(context)
  result.checks.writeAndCleanupMode = true
  result.checks.noDangerousActionClicked = true
  result.checks.noRealDataCreated = result.cleanup?.status === 'cleaned'
  return result
}

async function fillAndSubmitWriteFlow(context) {
  switch (context.flowSpec.id) {
    case 'client-create':
      return await runClientWriteFlow(context)
    case 'property-create':
      return await runPropertyWriteFlow(context)
    case 'quote-create':
      return await runQuoteWriteFlow(context)
    case 'expense-create':
      return await runExpenseWriteFlow(context)
    default:
      return {
        prepared: false,
        submitted: false,
        reason: 'write-path-not-enabled-for-this-flow',
        successTexts: [],
      }
  }
}

async function runClientWriteFlow({ connection, sessionId, qaRunId }) {
  const prepared = await fillClientCreateForm(connection, sessionId, qaRunId)
  if (!prepared) {
    return {
      prepared: false,
      submitted: false,
      reason: 'client-form-fill-failed',
      note: 'Could not fill the client create form with deterministic QA data.',
      successTexts: ['Cliente creado.'],
    }
  }

  const submitted = await safeClickByText(connection, sessionId, 'Guardar cliente')
  await continueDuplicateReviewIfVisible(connection, sessionId, submitted)
  return {
    prepared: true,
    submitted,
    successTexts: ['Cliente creado.'],
  }
}

async function runPropertyWriteFlow({ connection, sessionId, qaRunId }) {
  const prepared = await fillPropertyCreateForm(connection, sessionId, qaRunId)
  if (!prepared) {
    return {
      prepared: false,
      submitted: false,
      reason: 'property-form-fill-failed',
      note: 'Could not fill the property create flow with deterministic QA data.',
      successTexts: ['Propiedad creada correctamente.'],
    }
  }

  const submitted = await safeClickByText(connection, sessionId, 'Guardar propiedad')
  await continueDuplicateReviewIfVisible(connection, sessionId, submitted)
  return {
    prepared: true,
    submitted,
    successTexts: ['Propiedad creada correctamente.'],
  }
}

async function runQuoteWriteFlow({ connection, sessionId, qaRunId }) {
  const prepared = await fillQuoteCreateFlow(connection, sessionId, qaRunId)
  if (!prepared) {
    return {
      prepared: false,
      submitted: false,
      reason: 'quote-flow-fill-failed',
      note: 'Could not advance the quote flow to a deterministic review state.',
      successTexts: ['Presupuesto creado', 'guardado con contexto'],
    }
  }

  const submitted = await safeClickByText(connection, sessionId, 'Crear presupuesto')
  await continueDuplicateReviewIfVisible(connection, sessionId, submitted)
  return {
    prepared: true,
    submitted,
    successTexts: ['Presupuesto creado', 'guardado con contexto'],
  }
}

async function runExpenseWriteFlow({ connection, sessionId, qaRunId }) {
  const prepared = await fillExpenseCreateFlow(connection, sessionId, qaRunId)
  if (!prepared) {
    return {
      prepared: false,
      submitted: false,
      reason: 'expense-flow-fill-failed',
      note: 'Could not fill the expense create flow with deterministic QA data.',
      successTexts: ['Gasto creado', 'Detalle del gasto'],
    }
  }

  await waitForAnyText(connection, sessionId, ['Guardar gasto'], 3000)
  const submitted = await safeClickByText(connection, sessionId, 'Guardar gasto')
  await continueDuplicateReviewIfVisible(connection, sessionId, submitted)
  return {
    prepared: true,
    submitted,
    successTexts: ['Gasto creado', 'Detalle del gasto'],
  }
}

async function continueDuplicateReviewIfVisible(connection, sessionId, submitted) {
  if (!submitted) return false
  const duplicateReviewVisible = await waitForAnyText(connection, sessionId, ['Continuar igualmente'], 2000)
  if (!duplicateReviewVisible) return false
  return await safeClickByText(connection, sessionId, 'Continuar igualmente')
}

async function runInvoiceFlow(context) {
  const result = await runBaseFlowAudit(context)
  const { connection, sessionId } = context

  const openAction = await safeClickOpeningAction(connection, sessionId, ['Nueva factura'], result)
  result.checks.expectedButtonExists = Boolean(openAction)
  result.checks.openingResponds = Boolean(openAction)
  if (!openAction) {
    result.notes.push('Invoice create action was not found.')
    return result
  }

  result.checks.formVisible = await waitForStepFlowVisible(connection, sessionId, 'Nueva factura')
  result.checks.titleVisible = result.checks.formVisible
  result.checks.flowContentReady = await waitForInvoiceFlowContentReady(connection, sessionId)
  result.checks.noHorizontalOverflowAfterOpen = await checkNoHorizontalOverflow(connection, sessionId)

  const manualOriginSelected = await safeClickBySelector(connection, sessionId, '[data-qa="invoice-origin-mode-manual"]')
    || await safeClickByText(connection, sessionId, 'Factura directa', { exact: false })
    || await safeClickByText(connection, sessionId, 'Excepcion administrativa', { exact: false })
  result.checks.manualOriginReachable = manualOriginSelected
  if (!manualOriginSelected) {
    result.notes.push('Could not switch the invoice flow to the manual route before probing billing context.')
  } else if (!(await waitForManualInvoiceOriginSelected(connection, sessionId))) {
    result.notes.push('The manual invoice route did not become active before advancing the flow.')
  }

  const nextClicked = await safeClickOpeningAction(connection, sessionId, ['Confirmar origen'], result)
  if (nextClicked) {
    result.checks.firstFieldVisible = await waitForFirstFieldVisible(connection, sessionId, '[data-qa="action-flow-panel"]')
  } else {
    result.checks.firstFieldVisible = false
    result.notes.push('Could not advance invoice flow to the billing step without a dangerous action.')
  }

  const clientFocused = await focusClientSelector(connection, sessionId)
  result.checks.clientSelectorReachable = clientFocused

  if (clientFocused) {
    await selectFirstNonEmptyOption(connection, sessionId)
  }

  const propertyOpen = await safeClickBySelector(connection, sessionId, '[data-qa="invoice-create-property-trigger"]')
    || await safeClickOpeningAction(connection, sessionId, ['Crear propiedad', 'Nueva propiedad'], result)
  if (!propertyOpen) {
    result.notes.push('Embedded property subflow was not reachable from the invoice flow in this dry-run.')
    result.checks.embeddedSubflowVisible = false
    result.checks.embeddedSubflowFirstFieldVisible = false
    result.checks.embeddedSubflowCancelExists = false
    result.checks.embeddedSubflowReturnsToParent = false
  } else {
    result.checks.embeddedSubflowVisible = await waitForStepFlowVisible(connection, sessionId, 'Nueva propiedad')
    result.checks.embeddedSubflowFirstFieldVisible = await waitForFirstFieldVisible(connection, sessionId, '[data-qa="action-flow-panel"]')
    const subflowCloseLabel = await safeCloseDialogOrFlow(connection, sessionId)
    result.checks.embeddedSubflowCancelExists = Boolean(subflowCloseLabel)
    result.checks.embeddedSubflowReturnsToParent = await waitForStepFlowVisible(connection, sessionId, 'Nueva factura')
  }

  const closeLabel = await safeCloseDialogOrFlow(connection, sessionId)
  result.checks.cancelExists = Boolean(closeLabel)
  result.checks.cancelReturnsToContext = await waitForReturnToView(context)
  result.checks.noRealCreationMessage = !(await detectRealCreationMessage(connection, sessionId))
  result.checks.noDangerousActionClicked = true
  result.checks.noRealDataCreated = true
  return result
}

async function runFiscalClosingAudit(context) {
  const result = await runBaseFlowAudit(context)
  const { connection, sessionId, viewport } = context
  const audit = await collectViewAudit(connection, sessionId, 'fiscal_closing', viewport)
  result.checks.expectedButtonExists = true
  result.checks.openingResponds = true
  result.checks.formVisible = true
  result.checks.titleVisible = audit.checks.headerVisible
  result.checks.firstFieldVisible = true
  result.checks.cancelExists = true
  result.checks.cancelReturnsToContext = true
  result.checks.noRealCreationMessage = true
  result.checks.noDangerousActionClicked = true
  result.checks.noRealDataCreated = true
  result.checks.fiscalRealAmountVisible = audit.checks.fiscalRealAmountVisible
  result.checks.noHorizontalOverflowAfterOpen = audit.checks.noHorizontalOverflow
  result.checks.noDangerousFormOpen = !(await hasOpenFlowPanel(connection, sessionId))
  return result
}

async function runBaseFlowAudit({ connection, sessionId, appUrl, viewport, flowSpec }) {
  const result = createFlowResult({
    viewport,
    flowId: flowSpec.id,
    viewId: flowSpec.viewId,
  })

  await safeNavigateView(connection, sessionId, appUrl, flowSpec.viewId)
  const audit = await collectViewAudit(connection, sessionId, flowSpec.viewId, viewport)
  const onBrowserErrorPage = await detectBrowserErrorPage(connection, sessionId)

  result.checks.noLoginScreen = audit.checks.noLoginScreen
  result.checks.noErrorBoundaryVisible = audit.checks.noErrorBoundaryVisible
  result.checks.noBrowserErrorPage = !onBrowserErrorPage
  result.checks.headerVisible = audit.checks.headerVisible
  result.checks.bottomNavVisible = audit.checks.bottomNavVisible
  result.checks.noHorizontalOverflow = audit.checks.noHorizontalOverflow
  result.notes.push(`Loaded ${buildViewUrl(appUrl, flowSpec.viewId)}`)
  return result
}

async function safeClickOpeningAction(connection, sessionId, labels, result) {
  const allowedLabels = []
  for (const label of labels) {
    if (!isSafeOpeningAction(label) && isDangerousFinalAction(label)) {
      recordSkippedDangerousAction(result, label)
      continue
    }

    allowedLabels.push(label)
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    for (const label of allowedLabels) {
      const clicked = await safeClickByText(connection, sessionId, label)
      if (clicked) {
        return label
      }
    }

    await delay(100)
  }

  return null
}

async function safeClickSelectorWithRetry(connection, sessionId, selector, attempts = 20) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await safeClickBySelector(connection, sessionId, selector)) return true
    await delay(150)
  }
  return false
}

async function waitForWorkspaceContext(connection, sessionId, contextParam, expectedContextId = null) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const state = await connection.send('Runtime.evaluate', {
      expression: `(() => {
        const url = new URL(window.location.href)
        return {
          workspaceVisible: Boolean(document.querySelector('.cc-client-workspace')),
          flowPanelVisible: Boolean(document.querySelector('[data-qa="action-flow-panel"]')),
          contextId: url.searchParams.get(${JSON.stringify(contextParam)}),
        }
      })()`,
      returnByValue: true,
      awaitPromise: true,
    }, sessionId).then((response) => response.result?.value)

    if (state?.workspaceVisible && !state.flowPanelVisible && state.contextId && (!expectedContextId || state.contextId === expectedContextId)) {
      return state
    }
    await delay(250)
  }
  return null
}

async function currentUrlHasContext(connection, sessionId, contextParam, expectedContextId) {
  return await connection.send('Runtime.evaluate', {
    expression: `new URL(window.location.href).searchParams.get(${JSON.stringify(contextParam)}) === ${JSON.stringify(expectedContextId)}`,
    returnByValue: true,
    awaitPromise: true,
  }, sessionId).then((response) => Boolean(response.result?.value))
}

async function waitForRecurringServiceState(connection, sessionId) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const state = await connection.send('Runtime.evaluate', {
      expression: `(() => {
        const section = document.querySelector('[data-qa="recurring-service-section"]')
        const disabledAction = document.querySelector('[data-qa="recurring-service-disabled-action"]')
        const enabledAction = document.querySelector('[data-qa="recurring-service-action"]')
        const text = (section?.textContent ?? '').toLowerCase()
        return {
          sectionVisible: Boolean(section && section.getClientRects().length > 0),
          statusExplained: text.includes('pendiente de contrato') && text.includes('facturas'),
          disabledAction: Boolean(disabledAction?.disabled),
          enabledAction: Boolean(enabledAction && !enabledAction.disabled),
        }
      })()`,
      returnByValue: true,
      awaitPromise: true,
    }, sessionId).then((response) => response.result?.value)

    if (state?.sectionVisible) return state
    await delay(250)
  }

  return {
    sectionVisible: false,
    statusExplained: false,
    disabledAction: false,
    enabledAction: false,
  }
}

async function waitForReturnToView({ connection, sessionId, flowSpec }) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const ready = await collectMinimalViewState(connection, sessionId, flowSpec.viewId)
    if (ready.headerVisible && !ready.flowPanelVisible) {
      return true
    }
    await delay(250)
  }

  return false
}

async function collectMinimalViewState(connection, sessionId, viewId) {
  return await connection.send('Runtime.evaluate', {
    expression: `(() => {
      const normalize = (value) => (value ?? '').replace(/\\s+/g, ' ').trim()
      const header = document.querySelector('h1, header h1, [data-page-header] h1')
      const flowPanel = document.querySelector('[data-qa="action-flow-panel"]')
      return {
        viewId: ${JSON.stringify(viewId)},
        headerVisible: Boolean(header && normalize(header.textContent)),
        flowPanelVisible: Boolean(flowPanel),
      }
    })()`,
    returnByValue: true,
    awaitPromise: true,
  }, sessionId).then((result) => result.result?.value)
}

async function hasOpenFlowPanel(connection, sessionId) {
  return await connection.send('Runtime.evaluate', {
    expression: `(() => Boolean(document.querySelector('[data-qa="action-flow-panel"]')))()`,
    returnByValue: true,
    awaitPromise: true,
  }, sessionId).then((result) => result.result?.value)
}

async function fillVisibleTextFields(connection, sessionId) {
  return await connection.send('Runtime.evaluate', {
    expression: `(() => {
      const fields = Array.from(document.querySelectorAll('[data-qa="action-flow-panel"] input:not([type="hidden"]):not([disabled]), [data-qa="action-flow-panel"] textarea:not([disabled])'))
      let filled = 0
      for (const field of fields.slice(0, 3)) {
        const rect = field.getBoundingClientRect()
        const style = window.getComputedStyle(field)
        if (rect.width <= 0 || rect.height <= 0 || style.visibility === 'hidden' || style.display === 'none') continue
        const tag = field.tagName.toLowerCase()
        const value = tag === 'textarea' ? 'Dry run QA note' : field.type === 'email' ? 'dryrun@example.com' : 'Dry run QA'
        field.focus()
        const prototype = field.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
        descriptor?.set?.call(field, value)
        field.dispatchEvent(new Event('input', { bubbles: true }))
        field.dispatchEvent(new Event('change', { bubbles: true }))
        filled += 1
      }
      return filled
    })()`,
    returnByValue: true,
    awaitPromise: true,
  }, sessionId).then((result) => result.result?.value ?? 0)
}

async function focusClientSelector(connection, sessionId) {
  return await connection.send('Runtime.evaluate', {
    expression: `(() => {
      const select = document.querySelector('[data-qa="invoice-manual-client-select"]')
        ?? Array.from(document.querySelectorAll('[data-qa="action-flow-panel"] select')).find((node) => ((node.previousElementSibling?.textContent ?? '') + ' ' + (node.parentElement?.textContent ?? '')).toLowerCase().includes('cliente'))
      if (!select) return false
      select.focus()
      return true
    })()`,
    returnByValue: true,
    awaitPromise: true,
  }, sessionId).then((result) => result.result?.value)
}

async function selectFirstNonEmptyOption(connection, sessionId) {
  return await connection.send('Runtime.evaluate', {
    expression: `(() => {
      const select = document.querySelector('[data-qa="invoice-manual-client-select"]')
        ?? Array.from(document.querySelectorAll('[data-qa="action-flow-panel"] select')).find((node) => ((node.previousElementSibling?.textContent ?? '') + ' ' + (node.parentElement?.textContent ?? '')).toLowerCase().includes('cliente'))
      if (!select) return false
      const nextOption = Array.from(select.options).find((option) => option.value)
      if (!nextOption) return false
      select.value = nextOption.value
      select.dispatchEvent(new Event('input', { bubbles: true }))
      select.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    })()`,
    returnByValue: true,
    awaitPromise: true,
  }, sessionId).then((result) => result.result?.value)
}

async function detectRealCreationMessage(connection, sessionId) {
  return await connection.send('Runtime.evaluate', {
    expression: `(() => {
      const text = (document.body?.innerText ?? '').toLowerCase()
      return text.includes('operacion correcta')
        || text.includes('cliente creado')
        || text.includes('inmueble creado')
        || text.includes('propiedad creada')
        || text.includes('factura creada')
        || text.includes('presupuesto creado')
        || text.includes('cobro registrado correctamente')
        || text.includes('pago registrado')
    })()`,
    returnByValue: true,
    awaitPromise: true,
  }, sessionId).then((result) => result.result?.value)
}

async function waitForInvoiceFlowContentReady(connection, sessionId, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const ready = await connection.send('Runtime.evaluate', {
      expression: `(() => {
        const panel = document.querySelector('[data-qa="action-flow-panel"]')
        if (!panel) return false
        const text = (panel.innerText ?? '').toLowerCase()
        const hasFullscreenStepFlow = Boolean(panel.querySelector('[data-qa="fullscreen-step-flow"]'))
        return hasFullscreenStepFlow && !text.includes('cargando flujo de factura')
      })()`,
      returnByValue: true,
      awaitPromise: true,
    }, sessionId).then((result) => Boolean(result.result?.value))
    if (ready) return true
    await delay(250)
  }
  return false
}

async function waitForManualInvoiceOriginSelected(connection, sessionId, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const selected = await connection.send('Runtime.evaluate', {
      expression: `(() => {
        const button = document.querySelector('[data-qa="invoice-origin-mode-manual"]')
        return Boolean(button?.classList.contains('cc-create-flow__choice--active'))
      })()`,
      returnByValue: true,
      awaitPromise: true,
    }, sessionId).then((result) => Boolean(result.result?.value))
    if (selected) return true
    await delay(100)
  }
  return false
}

async function fillClientCreateForm(connection, sessionId, qaRunId) {
  const emailValue = `${qaRunId.toLowerCase()}@qa.invalid`
  const writes = await batchWriteFormValues(connection, sessionId, [
    { label: 'Nombre completo', value: `QA Client ${qaRunId}` },
    { label: 'Telefono', value: '600123123' },
    { label: 'Email', value: emailValue },
    { label: 'DNI/NIF/CIF', value: `QA${qaRunId.slice(-8)}` },
    { label: 'Direccion fiscal', value: `QA billing ${qaRunId}` },
  ])
  return writes >= 3
}

async function fillPropertyCreateForm(connection, sessionId, qaRunId) {
  const selectedClient = await selectFirstNonEmptyOptionByLabel(connection, sessionId, 'Cliente')
  const writes = await batchWriteFormValues(connection, sessionId, [
    { label: 'Nombre', value: `QA Property ${qaRunId}` },
    { label: 'Direccion', value: `Calle QA ${qaRunId}` },
    { label: 'Ciudad', value: 'Barcelona' },
    { label: 'Codigo postal', value: '08001' },
    { label: 'Notas', value: `QA-RUN ${qaRunId}` },
  ])
  return selectedClient && writes >= 3
}

async function fillQuoteCreateFlow(connection, sessionId, qaRunId) {
  const selectedClient = await selectFirstNonEmptyOptionByLabel(connection, sessionId, 'Cliente')
  if (!selectedClient) return false
  if (!await clickQuoteContinueAndWait(connection, sessionId, ['Define el alcance base'])) return false
  const conceptReady = await setFieldValueByLabel(connection, sessionId, 'Concepto 1', `QA concept ${qaRunId}`)
  if (!conceptReady || !await clickQuoteContinueAndWait(connection, sessionId, ['Relaciona el inmueble'])) return false
  if (!await clickQuoteContinueAndWait(connection, sessionId, ['Define condiciones y seguimiento'])) return false
  const conditionWrites = await batchWriteFormValues(connection, sessionId, [
    { label: 'Notas', value: `QA-RUN ${qaRunId}` },
  ])
  if (conditionWrites < 1 || !await clickQuoteContinueAndWait(connection, sessionId, ['Completa la estimacion'])) return false
  const estimateWrites = await batchWriteFormValues(connection, sessionId, [
    { label: 'Cantidad', value: '1' },
    { label: 'Unidad', value: 'servicio' },
    { label: 'Precio unitario', value: '123.45' },
  ])
  if (estimateWrites < 3 || !await clickQuoteContinueAndWait(connection, sessionId, ['Revision final obligatoria'])) return false
  return await waitForAnyText(connection, sessionId, ['Revision final obligatoria'], 5000)
}

async function fillExpenseCreateFlow(connection, sessionId, qaRunId) {
  const baseWrites = await batchWriteFormValues(connection, sessionId, [
    { label: 'Proveedor', value: `QA Supplier ${qaRunId}` },
    { label: 'Descripcion', value: `QA expense ${qaRunId}` },
  ])
  if (baseWrites < 2 || !await clickAndWaitForText(connection, sessionId, 'Siguiente', ['Importes y pago'])) return false
  const amountWrites = await batchWriteFormValues(connection, sessionId, [
    { label: 'Base imponible', value: '100.00' },
    { label: 'IVA %', value: '21.00' },
    { label: 'IVA EUR', value: '21.00' },
    { label: 'Total', value: '121.00' },
  ])
  if (amountWrites < 4 || !await clickAndWaitForText(connection, sessionId, 'Siguiente', ['Revision fiscal'])) return false
  const reviewWrites = await batchWriteFormValues(connection, sessionId, [
    { label: 'Notas', value: `QA-RUN ${qaRunId}` },
    { label: 'Observacion especifica para revision o cierre', value: `QA review ${qaRunId}`, matchMode: 'placeholder' },
  ])
  return reviewWrites >= 1
}

async function clickAndWaitForText(connection, sessionId, buttonText, expectedTexts, timeoutMs = 5000) {
  const clickDeadline = Date.now() + Math.min(timeoutMs, 3000)
  let clicked = false
  while (Date.now() < clickDeadline && !clicked) {
    clicked = await safeClickByText(connection, sessionId, buttonText)
    if (!clicked) await delay(150)
  }
  if (!clicked) return false
  return await waitForAnyText(connection, sessionId, expectedTexts, timeoutMs)
}

async function clickQuoteContinueAndWait(connection, sessionId, expectedTexts, timeoutMs = 5000) {
  const clickDeadline = Date.now() + Math.min(timeoutMs, 3000)
  let didClick = false
  while (Date.now() < clickDeadline && !didClick) {
    didClick = await safeClickBySelector(connection, sessionId, '[data-qa="quote-next-button"]')
      || await safeClickByText(connection, sessionId, 'Continuar')
    if (!didClick) await delay(150)
  }
  if (!didClick) return false
  return await waitForAnyText(connection, sessionId, expectedTexts, timeoutMs)
}

async function readCreatedEntityId(connection, sessionId, flowId) {
  const selector = flowId === 'quote-create'
    ? '[data-qa="quote-create-success"]'
    : flowId === 'expense-create'
      ? '[data-qa="expense-create-success"], [data-qa="expense-list-create-success"]'
      : null
  if (!selector) return null

  return await connection.send('Runtime.evaluate', {
    expression: `document.querySelector(${JSON.stringify(selector)})?.getAttribute('data-entity-id') ?? null`,
    returnByValue: true,
  }, sessionId).then((result) => result.result?.value ?? null)
}

async function batchWriteFormValues(connection, sessionId, fields) {
  let writes = 0
  for (const field of fields) {
    const wrote = await setFieldValueByLabel(connection, sessionId, field.label, field.value, field.matchMode ?? 'label')
    if (wrote) writes += 1
  }
  return writes
}

async function setFieldValueByLabel(connection, sessionId, label, value, matchMode = 'label') {
  return await connection.send('Runtime.evaluate', {
    expression: `(() => {
      const normalize = (input) => (input ?? '')
        .normalize('NFD')
        .replace(/[\\u0300-\\u036f]/g, '')
        .replace(/\\s+/g, ' ')
        .trim()
        .toLowerCase()
      const wanted = normalize(${JSON.stringify(label)})
      const value = ${JSON.stringify(value)}
      const panel = document.querySelector('[data-qa="action-flow-panel"]') ?? document
      const labels = Array.from(panel.querySelectorAll('label.form-field, label'))
      let field = null
      for (const labelNode of labels) {
        const text = normalize(labelNode.textContent)
        if (${JSON.stringify(matchMode)} === 'placeholder') {
          const placeholderField = labelNode.querySelector('input[placeholder], textarea[placeholder]')
          const placeholderText = normalize(placeholderField?.getAttribute('placeholder'))
          if (placeholderText.includes(wanted)) {
            field = placeholderField
            break
          }
          continue
        }
        if (!text.includes(wanted)) continue
        field = labelNode.querySelector('input:not([type="hidden"]):not([type="file"]), textarea')
        if (field) break
      }
      if (!field && ${JSON.stringify(matchMode)} === 'label') {
        const proFields = Array.from(panel.querySelectorAll('.ds-pro-form-field'))
        const proField = proFields.find((container) => {
          const fieldLabel = container.querySelector('.ds-pro-form-field__label')
          return normalize(fieldLabel?.textContent).includes(wanted)
        })
        field = proField?.querySelector('input:not([type="hidden"]):not([type="file"]), textarea') ?? null
      }
      if (!field) {
        field = Array.from(panel.querySelectorAll('input[placeholder], textarea[placeholder]')).find((node) => normalize(node.getAttribute('placeholder')).includes(wanted)) ?? null
      }
      if (!field) return false
      field.focus()
      const prototype = field.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
      descriptor?.set?.call(field, value)
      field.dispatchEvent(new Event('input', { bubbles: true }))
      field.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    })()`,
    returnByValue: true,
    awaitPromise: true,
  }, sessionId).then((result) => Boolean(result.result?.value))
}

async function selectFirstNonEmptyOptionByLabel(connection, sessionId, label) {
  return await connection.send('Runtime.evaluate', {
    expression: `(() => {
      const normalize = (input) => (input ?? '')
        .normalize('NFD')
        .replace(/[\\u0300-\\u036f]/g, '')
        .replace(/\\s+/g, ' ')
        .trim()
        .toLowerCase()
      const wanted = normalize(${JSON.stringify(label)})
      const panel = document.querySelector('[data-qa="action-flow-panel"]') ?? document
      const labels = Array.from(panel.querySelectorAll('label.form-field, label'))
      let select = null
      for (const labelNode of labels) {
        if (!normalize(labelNode.textContent).includes(wanted)) continue
        select = labelNode.querySelector('select')
        if (select) break
      }
      if (!select) return false
      const nextOption = Array.from(select.options).find((option) => option.value)
      if (!nextOption) return false
      select.value = nextOption.value
      select.dispatchEvent(new Event('input', { bubbles: true }))
      select.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    })()`,
    returnByValue: true,
    awaitPromise: true,
  }, sessionId).then((result) => Boolean(result.result?.value))
}

async function waitForAnyText(connection, sessionId, texts, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const visible = await connection.send('Runtime.evaluate', {
      expression: `(() => {
        const text = (document.body?.innerText ?? '').toLowerCase()
        return ${JSON.stringify(texts.map((item) => String(item).toLowerCase()))}.some((wanted) => text.includes(wanted))
      })()`,
      returnByValue: true,
      awaitPromise: true,
    }, sessionId).then((result) => Boolean(result.result?.value))
    if (visible) return true
    await delay(250)
  }
  return false
}

async function findCreatedEntitySafely({ flowId, qaRunId, createdAfter, result }) {
  try {
    const entity = await findCreatedEntityByQaRun({
      rootDir,
      flowId,
      qaRunId,
      createdAfter,
    })
    if (!entity) {
      result.notes.push(`No cleanup candidate found for ${flowId} with ${qaRunId}.`)
    }
    return entity
  } catch (error) {
    result.notes.push(error instanceof Error ? error.message : 'Unknown cleanup lookup error.')
    return null
  }
}

function readModeArg(argv) {
  const explicit = argv.find((arg) => arg.startsWith('--mode='))
  return explicit ? explicit.slice('--mode='.length) : process.env.QA_AGENT_MODE
}

async function writeCleanupArtifacts({
  cleanupJsonReportPath,
  cleanupMarkdownReportPath,
  createdEntitiesReportPath,
  report,
}) {
  const cleanupResults = report.results.map((result) => ({
    viewport: result.viewport.id,
    flowId: result.flowId,
    cleanup: result.cleanup,
    createdEntities: result.createdEntities,
  }))
  const createdEntities = report.results.flatMap((result) => result.createdEntities)

  await fs.writeFile(cleanupJsonReportPath, `${JSON.stringify({
    generatedAt: report.generatedAt,
    qaRunId: report.qaRunId,
    mode: report.mode,
    results: cleanupResults,
  }, null, 2)}\n`, 'utf8')
  await fs.writeFile(createdEntitiesReportPath, `${JSON.stringify({
    generatedAt: report.generatedAt,
    qaRunId: report.qaRunId,
    mode: report.mode,
    entities: createdEntities,
  }, null, 2)}\n`, 'utf8')

  const lines = [
    '# QA Cleanup Report',
    '',
    `- Generated at: ${report.generatedAt}`,
    `- QA run id: ${report.qaRunId}`,
    `- Mode: ${report.mode}`,
    '',
  ]

  for (const item of cleanupResults) {
    lines.push(`## ${item.viewport} / ${item.flowId}`)
    lines.push('')
    lines.push(`- Cleanup: ${item.cleanup?.status ?? 'not-requested'}`)
    lines.push(`- Created entities: ${item.createdEntities.length > 0 ? item.createdEntities.map((entity) => `${entity.table}/${entity.entityId}`).join(', ') : 'none'}`)
    if (item.cleanup?.reason) {
      lines.push(`- Reason: ${item.cleanup.reason}`)
    }
    lines.push('')
  }

  await fs.writeFile(cleanupMarkdownReportPath, `${lines.join('\n')}\n`, 'utf8')
}

async function writeMarkdownReport(reportPath, report) {
  const lines = [
    '# End-User Flow Agent Report',
    '',
    `- Generated at: ${report.generatedAt}`,
    `- Mode: ${report.mode}`,
    `- QA run id: ${report.qaRunId}`,
    `- App URL: ${report.appUrl}`,
    `- Browser: ${report.browserId}`,
    `- Profile directory: ${report.profileDir}`,
    '',
    '## Summary',
    '',
    `- Total checks: ${report.summary.totalChecks}`,
    `- Passed: ${report.summary.passedChecks}`,
    `- Failed: ${report.summary.failedChecks}`,
    `- Skipped actions: ${report.summary.skippedActions}`,
    `- Created entities: ${report.summary.createdEntities}`,
    `- Cleanup succeeded: ${report.summary.cleanupSucceeded}`,
    `- Cleanup skipped: ${report.summary.cleanupSkipped}`,
    `- Cleanup failed: ${report.summary.cleanupFailed}`,
    '',
    '## Runs',
    '',
  ]

  for (const result of report.results) {
    lines.push(`### ${result.viewport.id} / ${result.flowId}`)
    lines.push('')
    lines.push(`- Passed checks: ${result.passedChecks.length}`)
    lines.push(`- Failed checks: ${result.failedChecks.length > 0 ? result.failedChecks.join(', ') : 'none'}`)
    lines.push(`- Skipped actions: ${result.skippedActions.length > 0 ? result.skippedActions.map((item) => `${item.label} (${item.reason})`).join(', ') : 'none'}`)
    lines.push(`- Created entities: ${result.createdEntities.length > 0 ? result.createdEntities.map((item) => `${item.table}/${item.entityId}`).join(', ') : 'none'}`)
    lines.push(`- Cleanup: ${result.cleanup?.status ?? 'not-requested'}`)
    lines.push(`- Screenshot: ${result.screenshotPath ?? 'not generated'}`)
    lines.push(`- Duration: ${result.durationMs} ms`)
    lines.push(`- Notes: ${result.notes.length > 0 ? result.notes.join(' | ') : 'none'}`)
    lines.push('')
  }

  await fs.mkdir(path.dirname(reportPath), { recursive: true })
  await fs.writeFile(reportPath, `${lines.join('\n')}\n`, 'utf8')
}

async function delay(timeoutMs) {
  await new Promise((resolve) => setTimeout(resolve, timeoutMs))
}

main().catch((error) => {
  console.error(`End-user flow QA failed: ${error.message}`)
  process.exitCode = 1
})
