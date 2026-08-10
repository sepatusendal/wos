import { useMemo, useRef, useState } from 'react'
import { useFinanceStore } from '../stores/financeStore'
import { useNetWorthStore } from '../stores/netWorthStore'
import { useFormatCurrency } from '../stores/useFormatCurrency'
import { todayStr, formatMonthShort } from '@wos/shared'

export default function MonthlyCard() {
  const { transactions } = useFinanceStore()
  const { entries } = useNetWorthStore()
  const formatCurrency = useFormatCurrency()
  const cardRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const today = todayStr()
  const thisMonthKey = today.slice(0, 7)
  const prevMonthKey = useMemo(() => {
    const parts = thisMonthKey.split('-')
    const y = Number(parts[0])
    const m = Number(parts[1])
    const d = new Date(y, m - 2, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [thisMonthKey])

  const data = useMemo(() => {
    const monthIncome = transactions
      .filter((t) => t.type === 'income' && t.date.startsWith(thisMonthKey))
      .reduce((s, t) => s + t.amount, 0)
    const monthExpense = transactions
      .filter((t) => t.type === 'expense' && t.date.startsWith(thisMonthKey))
      .reduce((s, t) => s + t.amount, 0)
    const net = monthIncome - monthExpense
    const savingsRate = monthIncome > 0 ? Math.round((net / monthIncome) * 100) : 0

    // Top category
    const catMap: Record<string, number> = {}
    transactions
      .filter((t) => t.type === 'expense' && t.date.startsWith(thisMonthKey))
      .forEach((t) => {
        catMap[t.category] = (catMap[t.category] || 0) + t.amount
      })
    const topCategory = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]

    // Net worth change
    const currentNW = entries
      .filter((e) => (e.date ?? '').startsWith(thisMonthKey))
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0]?.netWorth ?? 0
    const prevNW = entries
      .filter((e) => (e.date ?? '').startsWith(prevMonthKey))
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0]?.netWorth ?? 0
    const nwChange = prevNW > 0 ? currentNW - prevNW : null

    return {
      monthIncome,
      monthExpense,
      net,
      savingsRate,
      topCategory: topCategory ? { name: topCategory[0], amount: topCategory[1] } : null,
      nwChange,
      nwChangePct: prevNW > 0 ? Math.round(((currentNW - prevNW) / prevNW) * 100) : null,
    }
  }, [transactions, entries, thisMonthKey, prevMonthKey])

  const cardColors = [
    { bg: '#ffd800', accent: '#ff8a00' },
    { bg: '#2f6bff', accent: '#1e40af' },
    { bg: '#22c55e', accent: '#166534' },
    { bg: '#ff5c8a', accent: '#be123c' },
    { bg: '#8b5cf6', accent: '#5b21b6' },
  ]
  const randomColor = cardColors[new Date().getMonth() % cardColors.length]

  const handleDownload = async () => {
    if (!cardRef.current) return
    setDownloading(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      })
      const link = document.createElement('a')
      link.download = `wos-monthly-${thisMonthKey}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch {
      // Fallback: simple print
      window.print()
    }
    setDownloading(false)
  }

  const monthLabel = formatMonthShort(thisMonthKey)
  const year = thisMonthKey.split('-')[0]

  return (
    <>
      {/* Share button */}
      <button
        onClick={() => setShowModal(true)}
        className="nb-btn nb-btn-sm"
        title="Share monthly recap"
      >
        📸 Share Recap
      </button>

      {/* Modal overlay */}
      {showModal && (
        <div
          className="nb-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false)
          }}
        >
          <div className="nb-modal !max-w-[480px]">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-bold uppercase text-nb-fg-muted">📸 Monthly Recap</div>
              <button
                onClick={() => setShowModal(false)}
                className="text-lg font-bold text-nb-fg-muted hover:text-nb-fg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* The Card itself */}
            <div
              ref={cardRef}
              className="w-full aspect-square border-3 flex flex-col overflow-hidden"
              style={{
                borderColor: '#0b0b0b',
                boxShadow: '5px 5px 0 #0b0b0b',
                background: '#fff',
              }}
            >
              {/* Header */}
              <div
                className="p-5 text-white"
                style={{ background: randomColor?.bg ?? "#fffdf7", borderBottom: '3px solid #0b0b0b' }}
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-80">Monthly Recap</div>
                <div className="text-2xl font-black uppercase tracking-tight leading-none mt-0.5">{monthLabel}</div>
                <div className="text-4xl font-black leading-none">{year}</div>
              </div>

              {/* Stats grid */}
              <div className="flex-1 grid grid-cols-2 p-4 gap-2">
                <div
                  className="border-2 p-3 flex flex-col justify-center"
                  style={{ borderColor: '#0b0b0b', background: '#f7f2e7' }}
                >
                  <div className="text-[9px] font-bold uppercase tracking-wider text-nb-fg-muted mb-0.5">Income</div>
                  <div className="font-mono text-sm font-extrabold text-nb-green leading-tight">{formatCurrency(data.monthIncome)}</div>
                </div>
                <div
                  className="border-2 p-3 flex flex-col justify-center"
                  style={{ borderColor: '#0b0b0b', background: '#f7f2e7' }}
                >
                  <div className="text-[9px] font-bold uppercase tracking-wider text-nb-fg-muted mb-0.5">Expense</div>
                  <div className="font-mono text-sm font-extrabold text-nb-red leading-tight">{formatCurrency(data.monthExpense)}</div>
                </div>
                <div
                  className="border-2 p-3 flex flex-col justify-center"
                  style={{
                    borderColor: '#0b0b0b',
                    background: data.net >= 0 ? '#dcfce7' : '#fee2e2',
                  }}
                >
                  <div className="text-[9px] font-bold uppercase tracking-wider text-nb-fg-muted mb-0.5">Net</div>
                  <div className={`font-mono text-sm font-extrabold leading-tight ${data.net >= 0 ? 'text-nb-green' : 'text-nb-red'}`}>
                    {data.net >= 0 ? '+' : ''}{formatCurrency(data.net)}
                  </div>
                </div>
                <div
                  className="border-2 p-3 flex flex-col justify-center"
                  style={{ borderColor: '#0b0b0b', background: '#fff7ed' }}
                >
                  <div className="text-[9px] font-bold uppercase tracking-wider text-nb-fg-muted mb-0.5">Savings</div>
                  <div className={`font-mono text-sm font-extrabold leading-tight ${data.savingsRate >= 20 ? 'text-nb-green' : 'text-nb-orange'}`}>
                    {data.savingsRate}%
                  </div>
                </div>
                {data.topCategory && (
                  <div
                    className="border-2 p-3 flex flex-col justify-center"
                    style={{ borderColor: '#0b0b0b', background: '#ede9fe' }}
                  >
                    <div className="text-[9px] font-bold uppercase tracking-wider text-nb-fg-muted mb-0.5">Top Category</div>
                    <div className="font-bold text-sm leading-tight">{data.topCategory.name}</div>
                    <div className="font-mono text-[10px] text-nb-fg-muted">{formatCurrency(data.topCategory.amount)}</div>
                  </div>
                )}
                {data.nwChange !== null && (
                  <div
                    className="border-2 p-3 flex flex-col justify-center"
                    style={{ borderColor: '#0b0b0b', background: '#f0f9ff' }}
                  >
                    <div className="text-[9px] font-bold uppercase tracking-wider text-nb-fg-muted mb-0.5">NW Change</div>
                    <div className={`font-mono text-sm font-extrabold leading-tight ${data.nwChange >= 0 ? 'text-nb-green' : 'text-nb-red'}`}>
                      {data.nwChange >= 0 ? '+' : ''}{formatCurrency(data.nwChange)}
                    </div>
                    {data.nwChangePct !== null && (
                      <div className="font-mono text-[10px] text-nb-fg-muted">{data.nwChangePct >= 0 ? '+' : ''}{data.nwChangePct}%</div>
                    )}
                  </div>
                )}

                {/* If odd number of stat blocks, fill remaining */}
                {!data.topCategory && !data.nwChange && (
                  <div className="border-2 p-3 flex flex-col justify-center" style={{ borderColor: '#0b0b0b' }}>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-nb-fg-muted mb-0.5">WOS</div>
                    <div className="font-black text-sm">v2.0</div>
                    <div className="font-mono text-[10px] text-nb-fg-muted">wira.os</div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div
                className="px-5 py-2 flex items-center justify-between"
                style={{ borderTop: '3px solid #0b0b0b' }}
              >
                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-nb-fg-muted">Generated by WOS</span>
                <span className="font-mono text-[9px] font-bold text-nb-fg-muted">{today}</span>
              </div>
            </div>

            {/* Download button */}
            <div className="mt-4">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="nb-btn nb-btn-sm w-full"
                style={{ background: randomColor?.bg ?? "#fffdf7" }}
              >
                {downloading ? '⏳ Generating...' : '⬇️ Download as PNG'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
