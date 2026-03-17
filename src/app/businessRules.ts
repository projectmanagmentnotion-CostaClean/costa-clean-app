export interface BusinessRules {
  currency: 'EUR'
  timezone: string
  defaultHourlyRate: number
  defaultMinimumHours: number
  defaultTaxRate: number
  quotesIncludeTaxByDefault: boolean
  airbnbLinenSurchargePerRoom: number
  defaultQuoteValidityDays: number
  defaultLegalNote: string
}

export const businessRules: BusinessRules = {
  currency: 'EUR',
  timezone: 'Europe/Madrid',
  defaultHourlyRate: 20,
  defaultMinimumHours: 3,
  defaultTaxRate: 0.21,
  quotesIncludeTaxByDefault: false,
  airbnbLinenSurchargePerRoom: 15,
  defaultQuoteValidityDays: 15,
  defaultLegalNote: 'Los precios indicados no incluyen IVA.',
}
