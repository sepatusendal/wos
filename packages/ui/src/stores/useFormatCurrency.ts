import { useMemo } from 'react'
import { createCurrencyFormatter, formatCurrency } from '@wos/shared'
import { useSettingsStore } from './settingsStore'

/**
 * Returns a currency formatter pre-bound to the user's currency and locale settings.
 * Falls back to IDR/id-ID if settings haven't loaded yet.
 */
export function useFormatCurrency(): (amount: number) => string {
  const currency = useSettingsStore((s) => s.settings?.currency) ?? 'IDR'
  const locale = useSettingsStore((s) => s.settings?.locale) ?? 'id-ID'
  return useMemo(() => createCurrencyFormatter(currency, locale), [currency, locale])
}

/**
 * Returns the raw formatCurrency function bound to current user settings.
 */
export function useSettingsFormat() {
  const settings = useSettingsStore((s) => s.settings)
  return {
    currency: settings?.currency ?? 'IDR',
    locale: settings?.locale ?? 'id-ID',
    format: (amount: number) => formatCurrency(amount, settings?.currency ?? 'IDR', settings?.locale ?? 'id-ID'),
  }
}
