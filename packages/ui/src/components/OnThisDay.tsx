import { useMemo } from 'react'
import { useFinanceStore } from '../stores/financeStore'
import { useNetWorthStore } from '../stores/netWorthStore'
import { useNotesStore } from '../stores/notesStore'
import { useFormatCurrency } from '../stores/useFormatCurrency'
import { formatShortDate, todayStr } from '@wos/shared'

export default function OnThisDay() {
  const { transactions } = useFinanceStore()
  const { entries } = useNetWorthStore()
  const { notes } = useNotesStore()
  const formatCurrency = useFormatCurrency()

  const oneYearAgo = useMemo(() => {
    const today = new Date()
    const d = new Date(today)
    d.setFullYear(d.getFullYear() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  const data = useMemo(() => {
    // Try exact date match first
    let targetDate = oneYearAgo
    let txOnDate = transactions.filter((t) => t.date === targetDate)
    let noteOnDate = notes.filter((n) => n.createdAt?.slice(0, 10) === targetDate)

    // If no data, search nearby dates (up to 7 days either side)
    if (txOnDate.length === 0 && noteOnDate.length === 0) {
      for (let offset = 1; offset <= 7; offset++) {
        const d = new Date(oneYearAgo)
        // Try forward
        d.setDate(d.getDate() + offset)
        const fwd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        txOnDate = transactions.filter((t) => t.date === fwd)
        noteOnDate = notes.filter((n) => n.createdAt?.slice(0, 10) === fwd)
        if (txOnDate.length > 0 || noteOnDate.length > 0) {
          targetDate = fwd
          break
        }
        // Try backward
        d.setDate(d.getDate() - offset * 2)
        const bwd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        txOnDate = transactions.filter((t) => t.date === bwd)
        noteOnDate = notes.filter((n) => n.createdAt?.slice(0, 10) === bwd)
        if (txOnDate.length > 0 || noteOnDate.length > 0) {
          targetDate = bwd
          break
        }
      }
    }

    // Net worth: get closest entry around that date
    const sorted = [...entries].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    const thenEntry = sorted
      .filter((e) => (e.date ?? '') <= targetDate)
      .pop()
    const nowEntry = sorted
      .filter((e) => (e.date ?? '') <= todayStr())
      .pop()
    const nwChange = thenEntry && nowEntry ? nowEntry.netWorth - thenEntry.netWorth : null

    return {
      targetDate,
      transactions: txOnDate,
      notes: noteOnDate,
      thenNW: thenEntry?.netWorth ?? null,
      nowNW: nowEntry?.netWorth ?? null,
      nwChange,
    }
  }, [oneYearAgo, transactions, entries, notes])

  const hasData = data.transactions.length > 0 || data.notes.length > 0 || data.nwChange !== null

  if (!hasData) {
    return (
      <div className="nb-card">
        <div className="text-sm font-bold uppercase text-nb-fg-muted mb-2">⏳ On This Day</div>
        <p className="text-xs text-nb-fg-muted">
          No data from around <span className="font-bold">{formatShortDate(oneYearAgo)}</span>. Start tracking to build memories!
        </p>
      </div>
    )
  }

  return (
    <div className="nb-card">
      <div className="text-sm font-bold uppercase text-nb-fg-muted mb-3">
        ⏳ On This Day · <span className="text-nb-blue">{formatShortDate(data.targetDate)}</span>
      </div>

      <div className="flex flex-col gap-2.5">
        {/* Transactions */}
        {data.transactions.slice(0, 3).map((t, i) => (
          <div
            key={t.id}
            className="flex items-center justify-between gap-2 px-3 py-2 bg-nb-bg border-2 border-nb-border"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm shrink-0">{t.type === 'income' ? '💰' : '💳'}</span>
              <div className="min-w-0">
                <div className="font-bold text-xs truncate">{t.description || t.category}</div>
                <div className="text-[10px] text-nb-fg-muted">
                  {t.category}
                  {i === 0 && data.transactions.length === 1 && (
                    <span className="text-nb-orange font-bold ml-1">— first transaction!</span>
                  )}
                </div>
              </div>
            </div>
            <span
              className={`font-mono font-bold text-xs shrink-0 ${
                t.type === 'income' ? 'text-nb-green' : 'text-nb-red'
              }`}
            >
              {t.type === 'income' ? '+' : '-'}
              {formatCurrency(t.amount)}
            </span>
          </div>
        ))}

        {data.transactions.length > 3 && (
          <div className="text-[10px] text-nb-fg-muted font-medium">
            +{data.transactions.length - 3} more transactions
          </div>
        )}

        {/* Notes */}
        {data.notes.slice(0, 2).map((n) => (
          <div
            key={n.id}
            className="flex items-center gap-2 px-3 py-2 bg-nb-yellow/20 border-2 border-nb-border"
          >
            <span className="text-sm shrink-0">📝</span>
            <div className="min-w-0">
              <div className="font-bold text-xs truncate">{n.title}</div>
              {n.content && (
                <div className="text-[10px] text-nb-fg-muted truncate italic">
                  "{n.content.slice(0, 60)}{n.content.length > 60 ? '...' : ''}"
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Net worth comparison */}
        {data.thenNW !== null && data.nowNW !== null && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-2 border-nb-border bg-white">
            <div>
              <div className="text-[10px] font-bold uppercase text-nb-fg-muted">Net Worth</div>
              <div className="text-xs text-nb-fg-muted">Then vs Now</div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs text-nb-fg-muted line-through">{formatCurrency(data.thenNW)}</span>
                <span className="text-[10px]">→</span>
                <span className={`font-mono font-bold text-xs ${data.nowNW >= data.thenNW ? 'text-nb-green' : 'text-nb-red'}`}>
                  {formatCurrency(data.nowNW)}
                </span>
              </div>
              {data.nwChange !== null && (
                <div className={`font-mono text-[10px] font-bold ${data.nwChange >= 0 ? 'text-nb-green' : 'text-nb-red'}`}>
                  {data.nwChange >= 0 ? '+' : ''}{formatCurrency(data.nwChange)} change
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
