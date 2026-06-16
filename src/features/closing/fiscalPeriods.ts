export type FiscalPeriodMode = 'month' | 'quarter' | 'year' | 'custom'

export interface FiscalPeriodSelection {
  mode: FiscalPeriodMode
  year: number
  month: number
  quarter: number
  startDate: string
  endDate: string
}

export interface ResolvedFiscalPeriod {
  mode: FiscalPeriodMode
  year: number
  startDate: string
  endDate: string
  label: string
  folderLabel: string
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function getQuarterBounds(year: number, quarter: number) {
  const startMonth = (quarter - 1) * 3
  const startDate = new Date(year, startMonth, 1)
  const endDate = new Date(year, startMonth + 3, 0)

  return {
    startDate: toDateKey(startDate),
    endDate: toDateKey(endDate),
  }
}

function getMonthBounds(year: number, month: number) {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0)

  return {
    startDate: toDateKey(startDate),
    endDate: toDateKey(endDate),
  }
}

function getYearBounds(year: number) {
  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  }
}

function formatMonthLabel(year: number, month: number): string {
  const date = new Date(year, month - 1, 1)
  const monthLabel = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(date)
  return `${monthLabel.charAt(0).toUpperCase()}${monthLabel.slice(1)} ${year}`
}

function formatDateLabel(dateValue: string): string {
  if (!dateValue) return 'Sin fecha'
  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateValue

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
  }).format(date)
}

export function resolveFiscalPeriod(selection: FiscalPeriodSelection): ResolvedFiscalPeriod {
  if (selection.mode === 'month') {
    const { startDate, endDate } = getMonthBounds(selection.year, selection.month)
    const label = formatMonthLabel(selection.year, selection.month)
    return {
      mode: selection.mode,
      year: selection.year,
      startDate,
      endDate,
      label,
      folderLabel: `${selection.year}_M${pad(selection.month)}`,
    }
  }

  if (selection.mode === 'quarter') {
    const { startDate, endDate } = getQuarterBounds(selection.year, selection.quarter)
    return {
      mode: selection.mode,
      year: selection.year,
      startDate,
      endDate,
      label: `T${selection.quarter} ${selection.year}`,
      folderLabel: `${selection.year}_T${selection.quarter}`,
    }
  }

  if (selection.mode === 'year') {
    const { startDate, endDate } = getYearBounds(selection.year)
    return {
      mode: selection.mode,
      year: selection.year,
      startDate,
      endDate,
      label: `Ejercicio ${selection.year}`,
      folderLabel: `${selection.year}`,
    }
  }

  const startDate = selection.startDate || getYearBounds(selection.year).startDate
  const endDate = selection.endDate || startDate

  return {
    mode: selection.mode,
    year: selection.year,
    startDate,
    endDate,
    label: `${formatDateLabel(startDate)} - ${formatDateLabel(endDate)}`,
    folderLabel: `${startDate}_a_${endDate}`,
  }
}

export function isDateWithinFiscalPeriod(dateValue: string | null | undefined, period: ResolvedFiscalPeriod): boolean {
  if (!dateValue) return false
  const normalizedDate = dateValue.length > 10 ? dateValue.slice(0, 10) : dateValue
  return normalizedDate >= period.startDate && normalizedDate <= period.endDate
}

export function getMonthOptions() {
  return Array.from({ length: 12 }, (_, index) => ({
    value: index + 1,
    label: new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date(2026, index, 1)),
  }))
}
