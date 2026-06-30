import { normalizeClientFiscalData } from './clientFiscalData.ts'
import { applyClientFiscalBackfillRecord } from './clientWriteApi.ts'
import type { ClientListItem } from './types.ts'

export interface ManualClientFiscalEntry {
  referenceName: string
  tax_id: string
  billing_address: string
  status: 'active'
}

export interface ManualClientFiscalBackfillUpdate {
  clientId: string
  clientDisplayCode: string | null
  clientName: string
  referenceName: string
  appliedFields: Array<'tax_id' | 'billing_address' | 'status'>
  nextTaxId: string | null
  nextBillingAddress: string | null
  nextStatus: 'active'
}

export interface ManualClientFiscalBackfillNoChange {
  clientId: string
  clientDisplayCode: string | null
  clientName: string
  referenceName: string
}

export interface ManualClientFiscalBackfillNotFound {
  referenceName: string
  possibleClientNames: string[]
}

export interface ManualClientFiscalBackfillConflict {
  referenceName: string
  clientId: string
  clientDisplayCode: string | null
  clientName: string
  field: 'tax_id' | 'billing_address' | 'match'
  currentValue: string | null
  incomingValue: string | null
  possibleClientNames?: string[]
}

export interface ManualClientFiscalBackfillPlan {
  updates: ManualClientFiscalBackfillUpdate[]
  unchanged: ManualClientFiscalBackfillNoChange[]
  notFound: ManualClientFiscalBackfillNotFound[]
  conflicts: ManualClientFiscalBackfillConflict[]
}

export interface ManualClientFiscalBackfillApplyResult {
  updatedClients: Array<{
    clientId: string
    clientDisplayCode: string | null
    clientName: string
    referenceName: string
    appliedFields: Array<'tax_id' | 'billing_address' | 'status'>
  }>
  unchangedClients: ManualClientFiscalBackfillNoChange[]
  notFound: ManualClientFiscalBackfillNotFound[]
  conflicts: ManualClientFiscalBackfillConflict[]
}

export const manualClientFiscalEntries: ManualClientFiscalEntry[] = [
  { referenceName: 'ALCLAPA SPORT SL', tax_id: 'B55211379', billing_address: 'Avenida de la Estacion, 70, nave 10, 17300 Blanes', status: 'active' },
  { referenceName: 'Pink Elephant SL', tax_id: 'B44857639', billing_address: 'C/Passeig de Sant Pol, 97, 17220 Sant Feliu de Guixols', status: 'active' },
  { referenceName: 'D. DAVID MOLINA BOZA', tax_id: '46134579Y', billing_address: 'local Travessera de Dalt 34, entresol 2a, 08024 Barcelona', status: 'active' },
  { referenceName: 'CARLOS ENRIQUE MARQUEZ RIDAO', tax_id: 'Y7108903P', billing_address: 'Carrer Puigmal 2, 17300 Blanes - Gerona', status: 'active' },
  { referenceName: 'JOSEFA LLAS GRANOT', tax_id: '38696030W', billing_address: 'C/COLON, 12, 1-D, Playa Arinaga, 35118 Gran Canaria', status: 'active' },
  { referenceName: 'GILFIT SPORTS SLU', tax_id: 'B67102970', billing_address: 'C/ del Carme, 17, 08380 Malgrat de Mar', status: 'active' },
  { referenceName: 'GURI, TEIXIDO I ASSOCIATS SL', tax_id: 'B08966095', billing_address: 'Esglesia 73-77, 08397 Pineda de Mar', status: 'active' },
  { referenceName: 'FUSTERIA PINEDA MAR SL', tax_id: 'J63973721', billing_address: 'Carrer Jacinto Benavente, 41, 08397 Pineda de Mar', status: 'active' },
  { referenceName: 'FUNDACION PRIVADA GENTIS', tax_id: 'G17679267', billing_address: 'Carrer Concili de Trento, 42, local 1, 08018 Barcelona', status: 'active' },
  { referenceName: 'FLEXICAR INTERNACIONAL SL', tax_id: 'B09758327', billing_address: "Carretera d'Acces Costa Brava s/n, 08024 Blanes", status: 'active' },
]

function normalizeClientName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function normalizeLooseName(value: string): string {
  return normalizeClientName(value).replace(/[.,'’"()/-]/g, '').replace(/\s+/g, ' ').trim()
}

function findSafeClientMatches(clients: ClientListItem[], referenceName: string): ClientListItem[] {
  const normalizedReference = normalizeClientName(referenceName)
  const exactMatches = clients.filter((client) => normalizeClientName(client.full_name) === normalizedReference)
  if (exactMatches.length > 0) {
    return exactMatches
  }

  const looseReference = normalizeLooseName(referenceName)
  return clients.filter((client) => normalizeLooseName(client.full_name) === looseReference)
}

function findPossibleClientNames(clients: ClientListItem[], referenceName: string): string[] {
  const referenceTokens = normalizeLooseName(referenceName).split(' ').filter(Boolean)
  return clients
    .filter((client) => {
      const candidate = normalizeLooseName(client.full_name)
      return referenceTokens.length > 0 && referenceTokens.every((token) => candidate.includes(token))
    })
    .map((client) => client.full_name)
}

export function buildManualClientFiscalBackfillPlan(
  clients: ClientListItem[],
  manualEntries: ManualClientFiscalEntry[] = manualClientFiscalEntries,
): ManualClientFiscalBackfillPlan {
  const plan: ManualClientFiscalBackfillPlan = {
    updates: [],
    unchanged: [],
    notFound: [],
    conflicts: [],
  }

  for (const entry of manualEntries) {
    const normalizedEntry = normalizeClientFiscalData(entry)
    const matches = findSafeClientMatches(clients, entry.referenceName)

    if (matches.length === 0) {
      plan.notFound.push({
        referenceName: entry.referenceName,
        possibleClientNames: findPossibleClientNames(clients, entry.referenceName),
      })
      continue
    }

    if (matches.length > 1) {
      for (const client of matches) {
        plan.conflicts.push({
          referenceName: entry.referenceName,
          clientId: client.id,
          clientDisplayCode: client.display_code,
          clientName: client.full_name,
          field: 'match',
          currentValue: null,
          incomingValue: null,
          possibleClientNames: matches.map((match) => match.full_name),
        })
      }
      continue
    }

    const client = matches[0]
    const currentFiscal = normalizeClientFiscalData(client)
    const appliedFields: Array<'tax_id' | 'billing_address' | 'status'> = []

    if (currentFiscal.tax_id && currentFiscal.tax_id !== normalizedEntry.tax_id) {
      plan.conflicts.push({
        referenceName: entry.referenceName,
        clientId: client.id,
        clientDisplayCode: client.display_code,
        clientName: client.full_name,
        field: 'tax_id',
        currentValue: currentFiscal.tax_id,
        incomingValue: normalizedEntry.tax_id,
      })
      continue
    }

    if (currentFiscal.billing_address && currentFiscal.billing_address !== normalizedEntry.billing_address) {
      plan.conflicts.push({
        referenceName: entry.referenceName,
        clientId: client.id,
        clientDisplayCode: client.display_code,
        clientName: client.full_name,
        field: 'billing_address',
        currentValue: currentFiscal.billing_address,
        incomingValue: normalizedEntry.billing_address,
      })
      continue
    }

    if (!currentFiscal.tax_id) {
      appliedFields.push('tax_id')
    }
    if (!currentFiscal.billing_address) {
      appliedFields.push('billing_address')
    }
    if (client.status !== 'active') {
      appliedFields.push('status')
    }

    if (appliedFields.length === 0) {
      plan.unchanged.push({
        clientId: client.id,
        clientDisplayCode: client.display_code,
        clientName: client.full_name,
        referenceName: entry.referenceName,
      })
      continue
    }

    plan.updates.push({
      clientId: client.id,
      clientDisplayCode: client.display_code,
      clientName: client.full_name,
      referenceName: entry.referenceName,
      appliedFields,
      nextTaxId: currentFiscal.tax_id ?? normalizedEntry.tax_id,
      nextBillingAddress: currentFiscal.billing_address ?? normalizedEntry.billing_address,
      nextStatus: 'active',
    })
  }

  return plan
}

export async function applyManualClientFiscalBackfill(
  plan: ManualClientFiscalBackfillPlan,
): Promise<ManualClientFiscalBackfillApplyResult> {
  const updatedClients: ManualClientFiscalBackfillApplyResult['updatedClients'] = []

  for (const update of plan.updates) {
    const payload: {
      tax_id?: string | null
      billing_address?: string | null
      status?: 'active'
    } = {}

    if (update.appliedFields.includes('tax_id')) {
      payload.tax_id = update.nextTaxId
    }
    if (update.appliedFields.includes('billing_address')) {
      payload.billing_address = update.nextBillingAddress
    }
    if (update.appliedFields.includes('status')) {
      payload.status = update.nextStatus
    }

    await applyClientFiscalBackfillRecord(update.clientId, payload)
    updatedClients.push({
      clientId: update.clientId,
      clientDisplayCode: update.clientDisplayCode,
      clientName: update.clientName,
      referenceName: update.referenceName,
      appliedFields: update.appliedFields,
    })
  }

  return {
    updatedClients,
    unchangedClients: plan.unchanged,
    notFound: plan.notFound,
    conflicts: plan.conflicts,
  }
}
