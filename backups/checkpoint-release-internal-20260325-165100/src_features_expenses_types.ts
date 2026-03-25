export const expenseCategories = [
  'materiales',
  'transporte',
  'combustible',
  'herramientas',
  'productos_limpieza',
  'lavanderia',
  'alquiler',
  'seguros',
  'software',
  'telefonia',
  'publicidad_marketing',
  'gestoria',
  'suministros',
  'mantenimiento',
  'dietas_viajes',
  'impuestos_tasas',
  'servicios_profesionales',
  'otros',
] as const

export type ExpenseCategory = (typeof expenseCategories)[number]

export const expenseDocumentTypes = [
  'ticket',
  'factura',
  'recibo',
  'otro',
] as const

export type ExpenseDocumentType = (typeof expenseDocumentTypes)[number]

export const expensePaymentMethods = [
  'cash',
  'card',
  'transfer',
  'bizum',
  'direct_debit',
  'other',
] as const

export type ExpensePaymentMethod = (typeof expensePaymentMethods)[number]

export const expensePaymentStatuses = [
  'paid',
  'pending',
  'partially_paid',
  'cancelled',
] as const

export type ExpensePaymentStatus = (typeof expensePaymentStatuses)[number]

export const expenseDocumentSupportStatuses = [
  'missing',
  'ticket',
  'invoice_valid',
  'pending_review',
] as const

export type ExpenseDocumentSupportStatus =
  (typeof expenseDocumentSupportStatuses)[number]

export const expenseFiscalReviewStatuses = [
  'pending',
  'reviewed',
  'observed',
] as const

export type ExpenseFiscalReviewStatus =
  (typeof expenseFiscalReviewStatuses)[number]

export const expenseFiscalRiskLevels = [
  'low',
  'medium',
  'high',
] as const

export type ExpenseFiscalRiskLevel =
  (typeof expenseFiscalRiskLevels)[number]

export interface ExpenseListItem {
  id: string
  display_code: string | null
  expense_number?: number | null

  expense_date: string
  accounting_date: string | null
  due_date: string | null

  supplier_name: string
  supplier_tax_id: string | null

  category: ExpenseCategory | string
  subcategory: string | null
  description: string

  document_type: ExpenseDocumentType | string
  reference_number: string | null

  payment_method: ExpensePaymentMethod | string | null
  payment_status: ExpensePaymentStatus | string

  currency: string

  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number

  is_deductible: boolean
  deductible_percentage: number

  affects_quarterly_closure: boolean
  affects_annual_closure: boolean

  receipt_file_url: string | null
  receipt_file_path: string | null
  attachment_count: number

  document_support_status: ExpenseDocumentSupportStatus | string
  fiscal_review_status: ExpenseFiscalReviewStatus | string
  fiscal_risk_level: ExpenseFiscalRiskLevel | string
  manager_note: string | null

  notes: string | null

  fiscal_year?: number | null
  fiscal_quarter?: number | null

  created_at?: string
  updated_at?: string
}

export interface ExpenseUpsertInput {
  expense_date: string
  accounting_date?: string | null
  due_date?: string | null

  supplier_name: string
  supplier_tax_id?: string | null

  category: ExpenseCategory | string
  subcategory?: string | null
  description: string

  document_type?: ExpenseDocumentType | string
  reference_number?: string | null

  payment_method?: ExpensePaymentMethod | string | null
  payment_status?: ExpensePaymentStatus | string

  currency?: string

  subtotal: number
  tax_rate?: number
  tax_amount?: number
  total?: number

  is_deductible?: boolean
  deductible_percentage?: number

  affects_quarterly_closure?: boolean
  affects_annual_closure?: boolean

  receipt_file_url?: string | null
  receipt_file_path?: string | null
  attachment_count?: number

  document_support_status?: ExpenseDocumentSupportStatus | string
  fiscal_review_status?: ExpenseFiscalReviewStatus | string
  fiscal_risk_level?: ExpenseFiscalRiskLevel | string
  manager_note?: string | null

  notes?: string | null
}

export function getExpenseCategoryLabel(value: string | null | undefined): string {
  switch (value) {
    case 'materiales': return 'Materiales'
    case 'transporte': return 'Transporte'
    case 'combustible': return 'Combustible'
    case 'herramientas': return 'Herramientas'
    case 'productos_limpieza': return 'Productos de limpieza'
    case 'lavanderia': return 'Lavandería'
    case 'alquiler': return 'Alquiler'
    case 'seguros': return 'Seguros'
    case 'software': return 'Software'
    case 'telefonia': return 'Telefonía'
    case 'publicidad_marketing': return 'Publicidad y marketing'
    case 'gestoria': return 'Gestoría'
    case 'suministros': return 'Suministros'
    case 'mantenimiento': return 'Mantenimiento'
    case 'dietas_viajes': return 'Dietas y viajes'
    case 'impuestos_tasas': return 'Impuestos y tasas'
    case 'servicios_profesionales': return 'Servicios profesionales'
    case 'otros': return 'Otros'
    default: return value ?? 'Sin categoría'
  }
}

export function getExpenseDocumentTypeLabel(value: string | null | undefined): string {
  switch (value) {
    case 'ticket': return 'Ticket'
    case 'factura': return 'Factura'
    case 'recibo': return 'Recibo'
    case 'otro': return 'Otro'
    default: return value ?? 'Sin documento'
  }
}

export function getExpensePaymentMethodLabel(value: string | null | undefined): string {
  switch (value) {
    case 'cash': return 'Efectivo'
    case 'card': return 'Tarjeta'
    case 'transfer': return 'Transferencia'
    case 'bizum': return 'Bizum'
    case 'direct_debit': return 'Domiciliación'
    case 'other': return 'Otro'
    default: return value ?? 'Sin método'
  }
}

export function getExpensePaymentStatusLabel(value: string | null | undefined): string {
  switch (value) {
    case 'paid': return 'Pagado'
    case 'pending': return 'Pendiente'
    case 'partially_paid': return 'Pago parcial'
    case 'cancelled': return 'Cancelado'
    default: return value ?? 'Sin estado'
  }
}

export function getExpenseDocumentSupportStatusLabel(value: string | null | undefined): string {
  switch (value) {
    case 'missing': return 'Sin documento'
    case 'ticket': return 'Ticket'
    case 'invoice_valid': return 'Factura válida'
    case 'pending_review': return 'Pendiente revisión'
    default: return value ?? 'Sin estado documental'
  }
}

export function getExpenseFiscalReviewStatusLabel(value: string | null | undefined): string {
  switch (value) {
    case 'pending': return 'Pendiente'
    case 'reviewed': return 'Revisado'
    case 'observed': return 'Observado'
    default: return value ?? 'Sin revisión'
  }
}

export function getExpenseFiscalRiskLevelLabel(value: string | null | undefined): string {
  switch (value) {
    case 'low': return 'Bajo'
    case 'medium': return 'Medio'
    case 'high': return 'Alto'
    default: return value ?? 'Sin riesgo'
  }
}
