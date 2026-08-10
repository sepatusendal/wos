import type { Transaction } from '@wos/shared'

// ── Types ──────────────────────────────────────────────────

export interface NetWorthEntry {
  date: string
  netWorth: number
  assetsTotal: number
  liabilitiesTotal: number
}

export interface ExportOptions {
  dateRange?: { from: string; to: string }
  filename?: string
}

// ── Transaction CSV ────────────────────────────────────────

export function exportCSV(transactions: Transaction[], filename = 'transactions.csv') {
  const headers = ['Date', 'Type', 'Category', 'Description', 'Amount']
  const rows = transactions.map((t) => [
    t.date,
    t.type,
    t.category,
    `"${(t.description || '').replace(/"/g, '""')}"`,
    t.amount,
  ])
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, filename)
}

// ── Net Worth Export ───────────────────────────────────────

export function exportNetWorthCSV(entries: NetWorthEntry[], opts: ExportOptions = {}) {
  const { filename = 'net-worth-history.csv' } = opts
  const filtered = filterByDateRange(entries, opts.dateRange)

  const headers = ['Date', 'Net Worth', 'Assets Total', 'Liabilities Total']
  const rows = filtered.map((e) => [
    e.date,
    e.netWorth.toFixed(2),
    e.assetsTotal.toFixed(2),
    e.liabilitiesTotal.toFixed(2),
  ])
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename)
}

export function exportNetWorthJSON(entries: NetWorthEntry[], opts: ExportOptions = {}) {
  const { filename = 'net-worth-history.json' } = opts
  const filtered = filterByDateRange(entries, opts.dateRange)

  const data = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    count: filtered.length,
    entries: filtered,
  }
  const json = JSON.stringify(data, null, 2)
  downloadBlob(new Blob([json], { type: 'application/json;charset=utf-8;' }), filename)
}

// ── Helpers ────────────────────────────────────────────────

function filterByDateRange<T extends { date: string }>(items: T[], range?: { from: string; to: string }): T[] {
  if (!range) return items
  return items.filter((item) => {
    if (range.from && item.date < range.from) return false
    if (range.to && item.date > range.to) return false
    return true
  })
}

export function generatePDFProps(transactions: Transaction[], title = 'Transaction Report') {
  const totalIncome = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const balance = totalIncome - totalExpense

  const byCategory: Record<string, { income: number; expense: number }> = {}
  for (const t of transactions) {
    const entry = byCategory[t.category]
    if (entry) {
      if (t.type === 'income') entry.income += t.amount
      else entry.expense += t.amount
    } else {
      byCategory[t.category] = t.type === 'income' ? { income: t.amount, expense: 0 } : { income: 0, expense: t.amount }
    }
  }

  return { title, transactions, totalIncome, totalExpense, balance, byCategory }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
