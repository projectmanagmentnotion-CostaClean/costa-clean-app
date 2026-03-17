export const leadStatuses = [
  'new',
  'contacted',
  'quoted',
  'won',
  'lost',
] as const

export const clientStatuses = [
  'active',
  'inactive',
] as const

export const propertyTypes = [
  'apartment',
  'house',
  'office',
  'local',
  'tourist_apartment',
  'community',
  'construction_site',
] as const

export const quoteStatuses = [
  'draft',
  'sent',
  'accepted',
  'rejected',
  'expired',
] as const

export const jobStatuses = [
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
] as const

export const invoiceStatuses = [
  'draft',
  'issued',
  'sent',
  'paid',
  'overdue',
  'cancelled',
] as const

export const paymentMethods = [
  'bank_transfer',
  'cash',
  'bizum',
  'card',
] as const

export const serviceTypes = [
  'standard_cleaning',
  'deep_cleaning',
  'post_construction',
  'check_out_cleaning',
  'airbnb_turnover',
  'glass_cleaning',
] as const

export type LeadStatus = (typeof leadStatuses)[number]
export type ClientStatus = (typeof clientStatuses)[number]
export type PropertyType = (typeof propertyTypes)[number]
export type QuoteStatus = (typeof quoteStatuses)[number]
export type JobStatus = (typeof jobStatuses)[number]
export type InvoiceStatus = (typeof invoiceStatuses)[number]
export type PaymentMethod = (typeof paymentMethods)[number]
export type ServiceType = (typeof serviceTypes)[number]
