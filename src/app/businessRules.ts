import { costaCleanLeadQuoteMessagingEngine } from '../config/leadQuoteMessagingEngineAccess'

export interface BusinessRules {
  currency: 'EUR'
  timezone: string
  defaultHourlyRate: number
  defaultMinimumHours: number
  defaultTaxRate: number
  quotesIncludeTaxByDefault: boolean
  airbnbLinenSurchargePerRoom: number
  defaultQuoteValidityDays: number
  defaultQuoteLegalNote: string
  defaultInvoiceLegalNote: string
}

export const businessRules: BusinessRules = {
  currency: costaCleanLeadQuoteMessagingEngine.currency,
  timezone: 'Europe/Madrid',
  defaultHourlyRate: costaCleanLeadQuoteMessagingEngine.pricing.baseHourlyRateStandard,
  defaultMinimumHours: costaCleanLeadQuoteMessagingEngine.serviceMinimums.minimumHoursPerOperator,
  defaultTaxRate: costaCleanLeadQuoteMessagingEngine.taxRules.vatRate,
  quotesIncludeTaxByDefault: costaCleanLeadQuoteMessagingEngine.taxRules.customerView === 'show_price_with_vat',
  airbnbLinenSurchargePerRoom: 15,
  defaultQuoteValidityDays: 15,
  defaultQuoteLegalNote: 'Los precios indicados no incluyen IVA.',
  defaultInvoiceLegalNote: 'Factura emitida conforme a los datos fiscales y condiciones acordadas.',
}
