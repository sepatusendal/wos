const formatterCache = new Map<string, Intl.NumberFormat>()

function getFormatter(currency: string, locale: string): Intl.NumberFormat {
  const key = `${currency}:${locale}`
  if (formatterCache.has(key)) return formatterCache.get(key)!
  // Determine fraction digits per currency — most use 0 for day-to-day, JPY always 0
  const fractionDigits = currency === 'JPY' ? 0 : 0
  try {
    const fmt = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
    formatterCache.set(key, fmt)
    return fmt
  } catch {
    // Fallback: use locale's number formatting with a manual currency prefix
    const fallback = new Intl.NumberFormat(locale, {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
    const orig = fallback.format
    ;(fallback as any).format = (n: number) => `${currency} ${orig.call(fallback, n)}`
    formatterCache.set(key, fallback)
    return fallback
  }
}

export function formatCurrency(amount: number, currency = 'IDR', locale = 'id-ID'): string {
  return getFormatter(currency, locale).format(amount)
}

export type CurrencyFormatter = (amount: number) => string

export function createCurrencyFormatter(currency: string, locale: string): CurrencyFormatter {
  const fmt = getFormatter(currency, locale)
  return (amount: number) => fmt.format(amount)
}

export function formatDate(dateStr: string): string {
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateInput(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayStr(): string {
  return formatDateInput(new Date())
}

export function isoNow(): string {
  return new Date().toISOString()
}

export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatMonthShort(monthStr: string): string {
  const d = new Date(`${monthStr}-01`)
  if (isNaN(d.getTime())) return monthStr
  return d.toLocaleDateString('id-ID', { month: 'short' })
}

export function formatShortDate(dateStr: string): string {
  const parts = dateStr.split('-')
  if (parts.length < 2) return dateStr
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, parts[2] ? Number(parts[2]) : 1)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}
