import crypto from 'node:crypto'

const RUN_ID_PATTERN = /^[0-9a-f]{32}$/u

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function businessProjection(request) {
  const copy = structuredClone(request)
  const invoice = copy?.p_request?.invoice
  if (invoice) {
    delete invoice.id
    delete invoice.notes
    delete invoice.internal_notes
    delete invoice.pricing_metadata
  }
  if (copy?.p_request) delete copy.p_request.operation_key
  return copy
}

function settlementBusinessProjection(request) {
  const copy = structuredClone(request)
  if (copy?.p_request) delete copy.p_request.operation_key
  return copy
}

function decodeBody(postData) {
  if (!postData) throw new Error('N21_UI_BRIDGE_MISSING_REQUEST_BODY')
  try { return JSON.parse(postData) } catch { throw new Error('N21_UI_BRIDGE_INVALID_JSON') }
}

export async function enableN21UiProvenanceBridge(connection, sessionId, { runId, qaHost }) {
  if (!RUN_ID_PATTERN.test(runId)) throw new Error('N21_UI_BRIDGE_INVALID_RUN_ID')
  if (!qaHost || !qaHost.endsWith('.supabase.co')) throw new Error('N21_UI_BRIDGE_INVALID_QA_HOST')

  const evidence = []
  let caseIndex = 0
  const listener = async (event, eventSessionId) => {
    if (eventSessionId !== sessionId) {
      if (eventSessionId) await connection.send('Fetch.continueRequest', { requestId: event.requestId }, eventSessionId)
      return
    }
    const request = event.request ?? {}
    const url = new URL(request.url)
    const isTarget = request.method === 'POST'
      && url.hostname === qaHost
      && ['/rest/v1/rpc/save_invoice_business_graph', '/rest/v1/rpc/settle_invoice_business'].includes(url.pathname)
    if (!isTarget) {
      await connection.send('Fetch.continueRequest', { requestId: event.requestId }, sessionId)
      return
    }

    const original = decodeBody(request.postData)
    if (url.pathname === '/rest/v1/rpc/settle_invoice_business') {
      const settlement = original?.p_request
      if (!settlement || typeof settlement !== 'object' || !settlement.invoice_id || !settlement.payment_method || !settlement.payment_date) {
        await connection.send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'BlockedByClient' }, sessionId)
        throw new Error('N21_UI_BRIDGE_UNKNOWN_SETTLEMENT_PAYLOAD_SHAPE')
      }
      caseIndex += 1
      const marker = `QA_N2_FUNC_${runId}`
      const caseLabel = `SETTLE${String(caseIndex).padStart(2, '0')}`
      const patched = structuredClone(original)
      patched.p_request.operation_key = `OP-${marker}-${caseLabel}`
      const originalHash = digest(settlementBusinessProjection(original))
      const patchedHash = digest(settlementBusinessProjection(patched))
      evidence.push({
        rpc: 'settle_invoice_business',
        case: caseLabel,
        original_business_payload_hash: originalHash,
        patched_business_payload_hash: patchedHash,
        business_payload_semantically_identical: originalHash === patchedHash,
        host: url.hostname,
        method: request.method,
      })
      await connection.send('Fetch.continueRequest', {
        requestId: event.requestId,
        postData: Buffer.from(JSON.stringify(patched), 'utf8').toString('base64'),
      }, sessionId)
      return
    }
    const graph = original?.p_request
    if (!graph || typeof graph !== 'object' || !graph.invoice || !Array.isArray(graph.lines)) {
      await connection.send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'BlockedByClient' }, sessionId)
      throw new Error('N21_UI_BRIDGE_UNKNOWN_PAYLOAD_SHAPE')
    }
    for (const key of ['client_id', 'property_id', 'issue_date', 'status', 'subtotal', 'tax_amount', 'total']) {
      if (graph.invoice[key] === undefined || graph.invoice[key] === null || graph.invoice[key] === '') {
        await connection.send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'BlockedByClient' }, sessionId)
        throw new Error(`N21_UI_BRIDGE_MISSING_BUSINESS_FIELD_${key}`)
      }
    }

    caseIndex += 1
    const marker = `QA_N2_FUNC_${runId}`
    const caseLabel = `UI${String(caseIndex).padStart(2, '0')}`
    const patched = structuredClone(original)
    patched.p_request.operation_key = `OP-${marker}-${caseLabel}`
    patched.p_request.invoice.id = `INVOICE-${marker}_${caseLabel}`
    patched.p_request.invoice.notes = `${patched.p_request.invoice.notes ?? ''} ${marker}_${caseLabel}`.trim()
    patched.p_request.invoice.pricing_metadata = {
      ...(patched.p_request.invoice.pricing_metadata ?? {}),
      qa_certification: { namespace: 'QA_N2_FUNC', run_id: runId, source: 'n21_authenticated_ui_certification', case: caseLabel },
    }

    evidence.push({
      rpc: 'save_invoice_business_graph',
      case: caseLabel,
      original_business_payload_hash: digest(businessProjection(original)),
      patched_business_payload_hash: digest(businessProjection(patched)),
      business_payload_semantically_identical: digest(businessProjection(original)) === digest(businessProjection(patched)),
      host: url.hostname,
      method: request.method,
    })

    await connection.send('Fetch.continueRequest', {
      requestId: event.requestId,
      postData: Buffer.from(JSON.stringify(patched), 'utf8').toString('base64'),
    }, sessionId)
  }

  connection.on('Fetch.requestPaused', listener)
  await connection.send('Fetch.enable', {
    patterns: [
      { urlPattern: `https://${qaHost}/rest/v1/rpc/save_invoice_business_graph`, requestStage: 'Request' },
      { urlPattern: `https://${qaHost}/rest/v1/rpc/settle_invoice_business`, requestStage: 'Request' },
    ],
  }, sessionId)

  return {
    evidence,
    async disable() {
      await connection.send('Fetch.disable', {}, sessionId)
    },
  }
}
