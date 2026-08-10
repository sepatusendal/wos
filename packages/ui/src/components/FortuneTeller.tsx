import { useMemo, useState } from 'react'
import { useFinanceStore } from '../stores/financeStore'
import { useFormatCurrency } from '../stores/useFormatCurrency'
import { todayStr } from '@wos/shared'

interface Fortune {
  predictedExpense: number
  predictedCategory: string
  predictedSavingsRate: number
  accuracy: number | null
}

export default function FortuneTeller() {
  const { transactions } = useFinanceStore()
  const formatCurrency = useFormatCurrency()
  const [revealed, setRevealed] = useState(false)

  const fortune = useMemo((): Fortune | null => {
    const today = todayStr()
    const currentMonth = today.slice(0, 7)

    // Get last 3 complete months
    const now = new Date()
    const months: string[] = []
    for (let i = 3; i >= 1; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }

    const monthlyExpenses = months.map((m) =>
      transactions
        .filter((t) => t.type === 'expense' && t.date.startsWith(m))
        .reduce((s, t) => s + t.amount, 0)
    )
    const monthlyIncomes = months.map((m) =>
      transactions
        .filter((t) => t.type === 'income' && t.date.startsWith(m))
        .reduce((s, t) => s + t.amount, 0)
    )

    const validExpenses = monthlyExpenses.filter((e) => e > 0)
    const validIncomes = monthlyIncomes.filter((i) => i > 0)

    if (validExpenses.length === 0) return null

    const avgExpense = validExpenses.reduce((s, e) => s + e, 0) / validExpenses.length
    const avgIncome = validIncomes.reduce((s, i) => s + i, 0) / validIncomes.length
    const jitter = 0.95 + Math.random() * 0.1 // ±5%
    const predictedExpense = Math.round(avgExpense * jitter)
    const predictedSavingsRate = avgIncome > 0 ? Math.round(((avgIncome - predictedExpense) / avgIncome) * 100) : 0

    // Get top category from recent months
    const recentMonth = months[months.length - 1] ?? ''
    const catMap: Record<string, number> = {}
    transactions
      .filter((t) => t.type === 'expense' && t.date.startsWith(recentMonth))
      .forEach((t) => {
        catMap[t.category] = (catMap[t.category] || 0) + t.amount
      })
    const topCategory =
      Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Makan'

    // Check accuracy against actual current month
    let accuracy: number | null = null
    const currentExpense = transactions
      .filter((t) => t.type === 'expense' && t.date.startsWith(currentMonth))
      .reduce((s, t) => s + t.amount, 0)

    if (currentExpense > 0 && validExpenses.length >= 2) {
      const prevMonthActual = validExpenses[validExpenses.length - 2] ?? 0
      accuracy = prevMonthActual > 0 ? Math.max(0, Math.round((1 - Math.abs(currentExpense - prevMonthActual) / prevMonthActual) * 100)) : 0
    }

    return {
      predictedExpense,
      predictedCategory: topCategory,
      predictedSavingsRate: Math.max(0, Math.min(100, predictedSavingsRate)),
      accuracy,
    }
  }, [transactions])

  const fortunes = [
    'The crystal ball sees spending in your future...',
    'Beware the temptation of online shopping!',
    'Your wallet whispers secrets of restraint...',
    'The stars align for a month of mindful spending.',
    'A surprise expense lurks in the shadows...',
    'Prosperity flows toward those who budget wisely.',
    'The universe rewards disciplined savers.',
    'Your financial karma is... interesting.',
  ]

  const randomFortune = fortunes[Math.floor(Math.random() * fortunes.length)]

  if (!fortune) {
    return (
      <div className="nb-card">
        <div className="text-sm font-bold uppercase text-nb-fg-muted mb-3">🔮 Spending Fortune Teller</div>
        <p className="text-xs text-nb-fg-muted">Need at least 1 month of expense data to gaze into the crystal ball.</p>
      </div>
    )
  }

  const accuracyColor =
    fortune.accuracy === null
      ? 'text-nb-fg-muted'
      : fortune.accuracy >= 80
        ? 'text-nb-green'
        : fortune.accuracy >= 50
          ? 'text-nb-orange'
          : 'text-nb-red'

  return (
    <div className="nb-card" style={{ borderColor: '#8b5cf6', boxShadow: '5px 5px 0 #8b5cf6' }}>
      <div className="text-sm font-bold uppercase text-nb-purple mb-4 flex items-center gap-2">
        <span className="inline-block animate-[pulse_2s_ease-in-out_infinite]">🔮</span>
        The Crystal Ball Says...
      </div>

      {/* Crystal Ball Animation */}
      <div className="flex justify-center mb-5">
        <div
          className="w-20 h-20 rounded-full relative flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle at 35% 35%, rgba(139,92,246,0.3), rgba(139,92,246,0.6), rgba(88,28,135,0.9))',
            border: '3px solid #8b5cf6',
            boxShadow: '0 0 30px rgba(139,92,246,0.5), inset 0 0 20px rgba(255,255,255,0.15)',
          }}
        >
          <div
            className="w-12 h-12 rounded-full absolute"
            style={{
              background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent 70%)',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />
          <span className="text-2xl relative z-10">🔮</span>
        </div>
      </div>

      {!revealed ? (
        <div className="text-center">
          <p className="text-xs text-nb-fg-muted italic mb-3 font-medium">"{randomFortune}"</p>
          <button
            onClick={() => setRevealed(true)}
            className="nb-btn nb-btn-sm"
            style={{ borderColor: '#8b5cf6', boxShadow: '3px 3px 0 #8b5cf6', color: '#8b5cf6' }}
          >
            ✨ Reveal My Fortune
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Predicted Expense */}
          <div
            className="p-3 border-2 bg-white"
            style={{
              borderColor: '#8b5cf6',
              transform: 'rotate(-0.5deg)',
              boxShadow: '3px 3px 0 rgba(139,92,246,0.4)',
            }}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-nb-purple mb-0.5">Predicted Expense</div>
            <div className="font-mono text-lg font-extrabold text-nb-red">{formatCurrency(fortune.predictedExpense)}</div>
            <div className="text-[10px] text-nb-fg-muted mt-0.5">Next month forecast</div>
          </div>

          {/* Predicted Top Category */}
          <div
            className="p-3 border-2 bg-white"
            style={{
              borderColor: '#8b5cf6',
              transform: 'rotate(1deg)',
              boxShadow: '3px 3px 0 rgba(139,92,246,0.4)',
            }}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-nb-purple mb-0.5">Biggest Spending Category</div>
            <div className="font-mono text-lg font-extrabold text-nb-orange">#{fortune.predictedCategory}</div>
            <div className="text-[10px] text-nb-fg-muted mt-0.5">Watch your wallet here</div>
          </div>

          {/* Predicted Savings Rate */}
          <div
            className="p-3 border-2 bg-white"
            style={{
              borderColor: '#8b5cf6',
              transform: 'rotate(-0.3deg)',
              boxShadow: '3px 3px 0 rgba(139,92,246,0.4)',
            }}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-nb-purple mb-0.5">Predicted Savings Rate</div>
            <div
              className={`font-mono text-lg font-extrabold ${
                fortune.predictedSavingsRate >= 30
                  ? 'text-nb-green'
                  : fortune.predictedSavingsRate >= 10
                    ? 'text-nb-orange'
                    : 'text-nb-red'
              }`}
            >
              {fortune.predictedSavingsRate}%
            </div>
            <div className="text-[10px] text-nb-fg-muted mt-0.5">Aim for 30%+ ✨</div>
          </div>

          {/* Accuracy */}
          {fortune.accuracy !== null && (
            <div className="text-center mt-1">
              <span className={`text-xs font-bold ${accuracyColor}`}>
                Last prediction accuracy: {fortune.accuracy}%
              </span>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  )
}
