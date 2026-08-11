const formatterCache = new Map<string, Intl.NumberFormat>()

function getFormatter(currency: string, locale: string): Intl.NumberFormat {
  const key = `${currency}:${locale}`
  if (formatterCache.has(key)) return formatterCache.get(key)!
  // Determine fraction digits per currency — most use 0 for day-to-day, JPY always 0
  const fractionDigits = currency === 'JPY' || currency === 'IDR' || currency === 'KRW' || currency === 'VND' ? 0 : 2
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

/**
 * Round a monetary value to 2 decimal places using an epsilon-corrected
 * round-half-up, avoiding classic binary-float artifacts (e.g. 1.005 → 1).
 * Apply this at every write/aggregation boundary for money fields so
 * repeated arithmetic (balance += delta, sums, conversions) never drifts.
 */
export function roundMoney(amount: number): number {
  if (!Number.isFinite(amount)) return 0
  return Math.round((amount + Number.EPSILON) * 100) / 100
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

// ── Multi-currency conversion ────────────────────────────

/** Supported currencies ordered by global adoption */
export const SUPPORTED_CURRENCIES = [
  'IDR', 'USD', 'EUR', 'JPY', 'GBP', 'SGD', 'MYR', 'AUD',
  'CNY', 'KRW', 'THB', 'PHP', 'VND', 'INR', 'SAR', 'CHF',
] as const

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]

export interface ExchangeRates {
  base: CurrencyCode
  date: string
  rates: Partial<Record<CurrencyCode, number>>
}

/** In-memory cache keyed by base + date. Invalidated every 24h. */
const rateCache = new Map<string, ExchangeRates>()

function rateCacheKey(base: CurrencyCode): string {
  const today = new Date().toISOString().slice(0, 10)
  return `${base}:${today}`
}

/**
 * Fetch live exchange rates from Frankfurter API (free, no auth).
 * Falls back to hardcoded approximate rates if the API is unreachable.
 *
 * @see https://api.frankfurter.app
 */
export async function fetchExchangeRates(base: CurrencyCode = 'IDR'): Promise<ExchangeRates> {
  const key = rateCacheKey(base)
  if (rateCache.has(key)) return rateCache.get(key)!

  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${base}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const rates: ExchangeRates = { base, date: data.date, rates: data.rates }
    rateCache.set(key, rates)
    return rates
  } catch {
    // Offline fallback — approximate rates relative to IDR (Aug 2026)
    const fallback: ExchangeRates = {
      base,
      date: new Date().toISOString().slice(0, 10),
      rates: FALLBACK_RATES[base] ?? {},
    }
    return fallback
  }
}

/** Approximate exchange rates → 1 unit = X IDR. Used as offline fallback. */
const FALLBACK_RATES: Record<string, Partial<Record<CurrencyCode, number>>> = {
  IDR: { IDR: 1, USD: 1 / 16000, EUR: 1 / 17500, JPY: 1 / 108, SGD: 1 / 12000, GBP: 1 / 20500, MYR: 1 / 3450, AUD: 1 / 10500, CNY: 1 / 2200, KRW: 1 / 12, THB: 1 / 450, PHP: 1 / 285, VND: 1 / 0.65, INR: 1 / 192, SAR: 1 / 4270, CHF: 1 / 18400 },
  USD: { USD: 1, IDR: 16000, EUR: 0.91, JPY: 148, SGD: 1.33, GBP: 0.78, MYR: 4.64, AUD: 1.52, CNY: 7.27, KRW: 1333, THB: 35.5, PHP: 56, VND: 24600, INR: 83.3, SAR: 3.75, CHF: 0.87 },
}

/**
 * Convert an amount from one currency to another.
 * Fetches live rates on first call, caches for 24h.
 */
export async function convertCurrency(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
): Promise<number> {
  if (from === to) return amount

  const rates = await fetchExchangeRates(from)
  const rate = rates.rates[to]
  if (rate === undefined) {
    // Try reverse: convert from → USD → to
    const usdRates = await fetchExchangeRates('USD' as CurrencyCode)
    const fromToUsd = usdRates.rates[from]
    const usdToTarget = usdRates.rates[to]
    if (fromToUsd !== undefined && usdToTarget !== undefined) {
      return roundMoney(amount * (1 / fromToUsd) * usdToTarget)
    }
    throw new Error(`No exchange rate available for ${from} → ${to}`)
  }
  return roundMoney(amount * rate)
}

/** Sync conversion using pre-fetched rates (avoids async in render paths) */
export function convertCurrencySync(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: ExchangeRates,
): number {
  if (from === to) return amount
  const rate = rates.rates[to]
  if (rate === undefined) throw new Error(`No rate for ${from} → ${to}`)
  return amount * rate
}

/** Currency metadata for UI display */
export const CURRENCY_META: Record<CurrencyCode, { symbol: string; name: string; flag: string }> = {
  IDR: { symbol: 'Rp', name: 'Rupiah', flag: '🇮🇩' },
  USD: { symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
  EUR: { symbol: '€', name: 'Euro', flag: '🇪🇺' },
  JPY: { symbol: '¥', name: 'Yen', flag: '🇯🇵' },
  GBP: { symbol: '£', name: 'Pound Sterling', flag: '🇬🇧' },
  SGD: { symbol: 'S$', name: 'Singapore Dollar', flag: '🇸🇬' },
  MYR: { symbol: 'RM', name: 'Ringgit', flag: '🇲🇾' },
  AUD: { symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺' },
  CNY: { symbol: '¥', name: 'Yuan', flag: '🇨🇳' },
  KRW: { symbol: '₩', name: 'Won', flag: '🇰🇷' },
  THB: { symbol: '฿', name: 'Baht', flag: '🇹🇭' },
  PHP: { symbol: '₱', name: 'Peso', flag: '🇵🇭' },
  VND: { symbol: '₫', name: 'Dong', flag: '🇻🇳' },
  INR: { symbol: '₹', name: 'Rupee', flag: '🇮🇳' },
  SAR: { symbol: '﷼', name: 'Riyal', flag: '🇸🇦' },
  CHF: { symbol: 'Fr', name: 'Swiss Franc', flag: '🇨🇭' },
}
