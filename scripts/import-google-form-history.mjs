import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  buildCommunicationDraftPlaceholders,
  buildLeadPayload,
  buildQuoteDraftSeed,
  calculatePricing,
  googleFormLegacyAllowedMissingFields,
  googleFormsQuoteRequestFields,
  normalizeGoogleFormsQuoteRequestRow,
  prepareGoogleFormLegacyImportInput,
  validateGoogleFormLegacyImportInput,
} from '../src/features/publicIntake/intakePipeline.mjs'

const defaultFilePath = 'api/tools/imports/google-form-history.csv'
const importSource = 'google_form_import'

function parseArgs(argv) {
  const options = {
    file: defaultFilePath,
    dryRun: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--dry-run') {
      options.dryRun = true
    } else if (arg === '--file') {
      options.file = argv[index + 1]
      index += 1
    } else if (arg.startsWith('--file=')) {
      options.file = arg.slice('--file='.length)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return options
}

function parseCsv(content) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]
    const nextChar = content[index + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      row.push(field)
      field = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1
      }
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      continue
    }

    field += char
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter((parsedRow) => parsedRow.some((value) => value.trim()))
}

function rowsToObjects(parsedRows) {
  const [rawHeaders, ...dataRows] = parsedRows
  if (!rawHeaders || rawHeaders.length === 0) {
    throw new Error('CSV file has no header row.')
  }
  const headers = rawHeaders.map((header) => header.replace(/^\uFEFF/, '').trim())

  return dataRows.map((row, index) => ({
    rowNumber: index + 2,
    raw: Object.fromEntries(headers.map((header, headerIndex) => [header, row[headerIndex] ?? ''])),
  }))
}

function assertExpectedHeaders(headers) {
  const missing = Object.values(googleFormsQuoteRequestFields).filter((header) => !headers.includes(header))
  if (missing.length > 0) {
    throw new Error(`CSV is missing expected header(s): ${missing.join(', ')}`)
  }
}

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

function hashExternalSourceKey(rawRow) {
  const stableParts = [
    rawRow[googleFormsQuoteRequestFields.submittedAt],
    rawRow[googleFormsQuoteRequestFields.fullName],
    rawRow[googleFormsQuoteRequestFields.phone],
    rawRow[googleFormsQuoteRequestFields.email],
  ].map((value) => String(value ?? '').trim())

  return `google-form:${createHash('sha256').update(stableParts.join('|')).digest('hex').slice(0, 24)}`
}

function createSummary() {
  return {
    rowsRead: 0,
    rowsValid: 0,
    rowsSkipped: 0,
    leadsCreated: 0,
    matchedByPhone: 0,
    matchedByEmail: 0,
    probableDuplicates: 0,
    intakeSubmissionsCreated: 0,
    leadDraftsCreated: 0,
    errorsCount: 0,
  }
}

async function findExistingLead(supabase, input, normalizedPhone) {
  if (normalizedPhone) {
    const { data, error } = await supabase
      .from('leads')
      .select('id,full_name,phone,email,city,status,normalized_phone')
      .eq('normalized_phone', normalizedPhone)
      .limit(1)

    if (error) throw new Error(`lead phone lookup failed: ${error.message}`)
    if (data?.[0]) return { lead: data[0], category: 'matched_by_phone' }
  }

  if (input.email) {
    const { data, error } = await supabase
      .from('leads')
      .select('id,full_name,phone,email,city,status,normalized_phone')
      .eq('email', input.email)
      .limit(1)

    if (error) throw new Error(`lead email lookup failed: ${error.message}`)
    if (data?.[0]) return { lead: data[0], category: 'matched_by_email' }
  }

  return { lead: null, category: 'new_lead' }
}

async function existingIntakeByExternalKey(supabase, externalSourceKey) {
  const { data, error } = await supabase
    .from('intake_submissions')
    .select('id,lead_id,lead_draft_id,external_source_key')
    .eq('external_source_key', externalSourceKey)
    .limit(1)

  if (error) throw new Error(`intake duplicate lookup failed: ${error.message}`)
  return data?.[0] ?? null
}

async function insertRow(supabase, table, row) {
  const { data, error } = await supabase
    .from(table)
    .insert(row)
    .select('*')
    .single()

  if (error) throw new Error(`${table} insert failed: ${error.message}`)
  return data
}

async function updateLead(supabase, leadId, payload) {
  const { data, error } = await supabase
    .from('leads')
    .update(payload)
    .eq('id', leadId)
    .select('*')
    .single()

  if (error) throw new Error(`lead update failed: ${error.message}`)
  return data
}

async function patchIntake(supabase, intakeId, payload) {
  const { error } = await supabase
    .from('intake_submissions')
    .update(payload)
    .eq('id', intakeId)

  if (error) throw new Error(`intake update failed: ${error.message}`)
}

function addSeenKey(map, key, rowNumber) {
  if (!key) return null
  const previous = map.get(key)
  map.set(key, previous ? [...previous, rowNumber] : [rowNumber])
  return previous?.[0] ?? null
}

async function planRow({ supabase, rowNumber, raw, seenPhones, seenEmails }) {
  const normalized = normalizeGoogleFormsQuoteRequestRow(raw)
  const normalizedInput = prepareGoogleFormLegacyImportInput(normalized.normalizedInput, rowNumber)
  const normalizedPhone = normalized.normalizedPhone
  const validationErrors = validateGoogleFormLegacyImportInput(normalizedInput, normalizedPhone)
  const externalSourceKey = hashExternalSourceKey(raw)

  if (Object.keys(validationErrors).length > 0) {
    return {
      rowNumber,
      category: 'skipped_invalid',
      raw,
      normalizedInput,
      normalizedPhone,
      externalSourceKey,
      reason: JSON.stringify(validationErrors),
    }
  }

  const previousPhoneRow = addSeenKey(seenPhones, normalizedPhone, rowNumber)
  const previousEmailRow = addSeenKey(seenEmails, normalizedInput.email, rowNumber)
  if (previousPhoneRow || previousEmailRow) {
    return {
      rowNumber,
      category: 'probable_duplicate',
      raw,
      normalizedInput,
      normalizedPhone,
      externalSourceKey,
      reason: previousPhoneRow
        ? `same normalized phone as CSV row ${previousPhoneRow}`
        : `same email as CSV row ${previousEmailRow}`,
    }
  }

  const existingIntake = await existingIntakeByExternalKey(supabase, externalSourceKey)
  if (existingIntake) {
    return {
      rowNumber,
      category: 'probable_duplicate',
      raw,
      normalizedInput,
      normalizedPhone,
      externalSourceKey,
      reason: `existing intake submission ${existingIntake.id}`,
    }
  }

  const match = await findExistingLead(supabase, normalizedInput, normalizedPhone)
  return {
    rowNumber,
    category: match.category,
    raw,
    normalizedInput,
    normalizedPhone,
    externalSourceKey,
    existingLead: match.lead,
    pricing: calculatePricing(normalizedInput),
  }
}

async function applyPlan(supabase, plan) {
  const intake = await insertRow(supabase, 'intake_submissions', {
    source: importSource,
    status: 'reviewing',
    submitted_at: plan.normalizedInput.submittedAt,
    normalized_input: plan.normalizedInput,
    raw_payload: plan.raw,
    source_field_map: googleFormsQuoteRequestFields,
    pricing_breakdown: plan.pricing,
    external_source_key: plan.externalSourceKey,
    import_metadata: {
      importer: 'scripts/import-google-form-history.mjs',
      source: importSource,
      validation_mode: 'legacy_google_form_partial',
      allowed_missing_fields: googleFormLegacyAllowedMissingFields,
      row_number: plan.rowNumber,
      duplicate_category: plan.category,
    },
  })

  const leadPayload = buildLeadPayload(
    plan.normalizedInput,
    plan.normalizedPhone,
    intake.id,
    plan.pricing,
    plan.existingLead,
    importSource,
  )
  const lead = plan.existingLead
    ? await updateLead(supabase, plan.existingLead.id, leadPayload)
    : await insertRow(supabase, 'leads', leadPayload)
  const quoteDraftSeed = buildQuoteDraftSeed(plan.normalizedInput, plan.pricing)
  const communicationDrafts = buildCommunicationDraftPlaceholders(plan.normalizedInput, plan.pricing)
  const leadDraft = await insertRow(supabase, 'lead_drafts', {
    intake_submission_id: intake.id,
    suggested_full_name: plan.normalizedInput.fullName,
    phone: plan.normalizedInput.phone,
    email: plan.normalizedInput.email,
    city: plan.normalizedInput.city,
    postal_code: plan.normalizedInput.postalCode,
    status: plan.existingLead ? 'matched_existing_lead' : 'ready_for_review',
    matched_lead_id: lead.id,
    normalized_input: plan.normalizedInput,
    quote_draft_seed: quoteDraftSeed,
    pricing_breakdown: plan.pricing,
    ai_email_draft: communicationDrafts.ai_email_draft,
    ai_whatsapp_draft: communicationDrafts.ai_whatsapp_draft,
    ai_draft_status: communicationDrafts.ai_draft_status,
    ai_generation_metadata: communicationDrafts.ai_generation_metadata,
  })

  await patchIntake(supabase, intake.id, {
    status: 'converted',
    lead_draft_id: leadDraft.id,
    lead_id: lead.id,
    quote_id: null,
  })

  return { intake, lead, leadDraft }
}

function printSummary(summary) {
  console.log('')
  console.log('Google Form history import summary:')
  console.log(`- rows read: ${summary.rowsRead}`)
  console.log(`- rows valid: ${summary.rowsValid}`)
  console.log(`- rows skipped: ${summary.rowsSkipped}`)
  console.log(`- leads created: ${summary.leadsCreated}`)
  console.log(`- leads matched by phone: ${summary.matchedByPhone}`)
  console.log(`- leads matched by email: ${summary.matchedByEmail}`)
  console.log(`- probable duplicates: ${summary.probableDuplicates}`)
  console.log(`- intake submissions created: ${summary.intakeSubmissionsCreated}`)
  console.log(`- lead drafts created: ${summary.leadDraftsCreated}`)
  console.log(`- errors count: ${summary.errorsCount}`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const csvPath = resolve(process.cwd(), options.file)
  const parsedRows = parseCsv(await readFile(csvPath, 'utf8'))
  assertExpectedHeaders(parsedRows[0]?.map((header) => header.replace(/^\uFEFF/, '').trim()) ?? [])

  const rows = rowsToObjects(parsedRows)
  const summary = createSummary()
  summary.rowsRead = rows.length

  const supabase = getSupabaseClient()
  const seenPhones = new Map()
  const seenEmails = new Map()
  const plans = []

  for (const row of rows) {
    try {
      const plan = await planRow({ supabase, ...row, seenPhones, seenEmails })
      plans.push(plan)

      if (plan.category === 'skipped_invalid') {
        summary.rowsSkipped += 1
        console.log(`[row ${plan.rowNumber}] skipped_invalid: ${plan.reason}`)
      } else if (plan.category === 'probable_duplicate') {
        summary.rowsSkipped += 1
        summary.probableDuplicates += 1
        console.log(`[row ${plan.rowNumber}] probable_duplicate: ${plan.reason}`)
      } else {
        summary.rowsValid += 1
        if (plan.category === 'matched_by_phone') summary.matchedByPhone += 1
        if (plan.category === 'matched_by_email') summary.matchedByEmail += 1
        if (plan.category === 'new_lead') summary.leadsCreated += 1
        console.log(`[row ${plan.rowNumber}] ${plan.category}: ${plan.normalizedInput.fullName}`)
      }
    } catch (error) {
      summary.rowsSkipped += 1
      summary.errorsCount += 1
      console.log(`[row ${row.rowNumber}] error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (options.dryRun) {
    console.log('')
    console.log('Dry run complete. No rows were written.')
    printSummary(summary)
    return
  }

  for (const plan of plans.filter((item) => !['skipped_invalid', 'probable_duplicate'].includes(item.category))) {
    try {
      await applyPlan(supabase, plan)
      summary.intakeSubmissionsCreated += 1
      summary.leadDraftsCreated += 1
    } catch (error) {
      summary.errorsCount += 1
      console.log(`[row ${plan.rowNumber}] write error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  printSummary(summary)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
