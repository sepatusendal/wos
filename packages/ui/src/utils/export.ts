import type { Transaction } from '@wos/shared'

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
