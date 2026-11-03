const MONEY_EPSILON = 0.009

export function getPaymentAmountError(amount: number, maximumAllowed: number): string | null {
  if (!Number.isFinite(amount)) return 'El importe del cobro debe ser un numero valido.'
  if (amount <= 0) return 'El importe del cobro debe ser mayor que cero.'
  if (!Number.isFinite(maximumAllowed) || maximumAllowed <= MONEY_EPSILON) {
    return 'La factura no tiene saldo pendiente para registrar este cobro.'
  }
  if (amount - maximumAllowed > MONEY_EPSILON) {
    return `El importe no puede superar el saldo pendiente de ${maximumAllowed.toFixed(2)}.`
  }
  return null
}
