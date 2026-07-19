const DRY_RUN_MODE = 'dry-run'
const WRITE_AND_CLEAN_MODE = 'write-and-clean'

const DANGEROUS_FINAL_ACTION_PATTERNS = [
  'guardar',
  'guardar cambios',
  'crear',
  'crear cliente',
  'crear propiedad',
  'crear factura',
  'crear presupuesto',
  'emitir',
  'enviar',
  'confirmar',
  'aplicar cambios',
  'registrar pago final',
  'registrar cobro final',
  'marcar cobradas',
  'eliminar',
  'borrar',
  'anular',
  'cancelar factura',
  'duplicar final',
  'convertir a factura final',
]

const SAFE_OPENING_ACTIONS = [
  'nueva factura',
  'nuevo cliente',
  'nueva propiedad',
  'nuevo presupuesto',
  'nuevo gasto',
  'nuevo servicio',
  'registrar servicio',
  'registrar cobro',
  'editar',
  'mas',
  'más',
  'filtros',
  'orden',
  'cerrar',
  'cancelar',
  'volver',
  'siguiente',
  'atras',
  'atrás',
  'usar existente',
  'abrir',
  'confirmar origen',
  'revisar lineas',
  'ir a revision final',
  'ir a revision',
  'crear cliente',
  'crear propiedad',
]

function normalizeLabel(value) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function isDryRunMode(mode = process.env.QA_AGENT_MODE) {
  return normalizeLabel(mode || DRY_RUN_MODE) === DRY_RUN_MODE
}

export function isWriteAndCleanMode(mode = process.env.QA_AGENT_MODE) {
  return normalizeLabel(mode || DRY_RUN_MODE) === WRITE_AND_CLEAN_MODE
}

export function resolveQaAgentMode(mode = process.env.QA_AGENT_MODE) {
  const normalizedMode = normalizeLabel(mode || DRY_RUN_MODE)
  if (normalizedMode !== DRY_RUN_MODE && normalizedMode !== WRITE_AND_CLEAN_MODE) {
    throw new Error(`Unsupported QA_AGENT_MODE "${mode}". Allowed values: "${DRY_RUN_MODE}" or "${WRITE_AND_CLEAN_MODE}".`)
  }
  return normalizedMode
}

export function createQaRunId(date = new Date()) {
  const yyyy = String(date.getUTCFullYear())
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const hh = String(date.getUTCHours()).padStart(2, '0')
  const min = String(date.getUTCMinutes()).padStart(2, '0')
  const ss = String(date.getUTCSeconds()).padStart(2, '0')
  const randomSuffix = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `QA-AUTO-${yyyy}${mm}${dd}-${hh}${min}${ss}-${randomSuffix}`
}

export function isProductionLikeQaUrl(appUrl) {
  try {
    const url = new URL(appUrl)
    const host = normalizeLabel(url.hostname)
    return host !== '127.0.0.1' && host !== 'localhost'
  } catch {
    return false
  }
}

export function assertWriteAndCleanAllowed({
  mode,
  appUrl,
  allowWriteClean = process.env.QA_ALLOW_WRITE_CLEAN,
}) {
  if (!isWriteAndCleanMode(mode)) return
  if (!isProductionLikeQaUrl(appUrl)) return
  if (String(allowWriteClean || '') === '1') return
  throw new Error('write-and-clean against a production-like QA_APP_URL requires QA_ALLOW_WRITE_CLEAN=1.')
}

export function isDangerousFinalAction(label) {
  const normalizedLabel = normalizeLabel(label)
  if (!normalizedLabel) return false
  return DANGEROUS_FINAL_ACTION_PATTERNS.some((pattern) => normalizedLabel === pattern || normalizedLabel.includes(pattern))
}

export function isSafeOpeningAction(label) {
  const normalizedLabel = normalizeLabel(label)
  if (!normalizedLabel) return false
  return SAFE_OPENING_ACTIONS.some((pattern) => normalizedLabel === pattern || normalizedLabel.includes(pattern))
}

export function recordSkippedDangerousAction(result, label, reason = 'dangerous-final-action') {
  const skippedAction = {
    label,
    reason,
  }
  result.skippedActions.push(skippedAction)
  return skippedAction
}

export function getWriteAndCleanSkipReason(flowId, invoiceBuildStatus = process.env.QA_INVOICE_BUILD_STATUS) {
  if (flowId === 'invoice-create') {
    return normalizeLabel(invoiceBuildStatus) === 'outdated'
      ? 'production-build-outdated'
      : 'invoice-write-not-safe'
  }
  if (flowId === 'payment-create') return 'payment-write-not-safe'
  if (flowId === 'fiscal-closing') return 'fiscal-write-not-safe'
  return 'cleanup-not-available'
}

export function createFlowResult({ viewport, flowId, viewId, notes = [] }) {
  return {
    viewport,
    flowId,
    viewId,
    startedAt: new Date().toISOString(),
    durationMs: 0,
    checks: {},
    passedChecks: [],
    failedChecks: [],
    skippedActions: [],
    createdEntities: [],
    cleanup: null,
    notes: [...notes],
  }
}

export function finalizeFlowResult(result) {
  result.durationMs = Date.now() - Date.parse(result.startedAt)
  result.passedChecks = Object.entries(result.checks).filter(([, passed]) => passed).map(([name]) => name)
  result.failedChecks = Object.entries(result.checks).filter(([, passed]) => !passed).map(([name]) => name)
  return result
}

export function summarizeAgentResults(results) {
  let totalChecks = 0
  let passedChecks = 0
  let skippedActions = 0
  let createdEntities = 0
  let cleanupSucceeded = 0
  let cleanupSkipped = 0
  let cleanupFailed = 0

  for (const result of results) {
    totalChecks += Object.keys(result.checks).length
    passedChecks += result.passedChecks.length
    skippedActions += result.skippedActions.length
    createdEntities += result.createdEntities.length
    if (result.cleanup?.status === 'cleaned') cleanupSucceeded += 1
    if (result.cleanup?.status === 'cleanup-not-available' || result.cleanup?.status === 'not-requested') cleanupSkipped += 1
    if (result.cleanup?.status === 'cleanup-failed') cleanupFailed += 1
  }

  return {
    totalChecks,
    passedChecks,
    failedChecks: totalChecks - passedChecks,
    skippedActions,
    createdEntities,
    cleanupSucceeded,
    cleanupSkipped,
    cleanupFailed,
  }
}
