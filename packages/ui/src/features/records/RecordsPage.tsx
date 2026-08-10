import { useEffect, useMemo } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { useFinanceStore } from '../../stores/financeStore'
import { useHabitStore } from '../../stores/habitStore'
import { useNetWorthStore } from '../../stores/netWorthStore'
import { NeubruCard } from '../../components'
import { useFormatCurrency } from '../../stores/useFormatCurrency'

interface RecordCard {
  icon: string
  label: string
  value: string
  date?: string
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
}

function formatMonthLabel(key: string): string {
  const [year, month] = key.split('-')
  return `${MONTH_LABELS[month!] || month} ${year}`
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function dateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function RecordsPage() {
  const userId = useAuthStore((s) => s.userId)
  const formatCurrency = useFormatCurrency()
  const { transactions, budgets, savingsGoals, fetchAll: fetchFinance } = useFinanceStore()
  const { habits, logs, fetchAll: fetchHabit } = useHabitStore()
  const { entries, fetchAll: fetchNetWorth } = useNetWorthStore()

  useEffect(() => {
    if (!userId) return
    fetchFinance(userId)
    fetchHabit(userId)
    fetchNetWorth(userId)
  }, [userId, fetchFinance, fetchHabit, fetchNetWorth])

  const records = useMemo((): RecordCard[] => {
    const results: RecordCard[] = []

    // ── 1. Pengeluaran Terendah (monthly) ──
    if (transactions.length > 0) {
      const monthlyExpenses: Record<string, number> = {}
      transactions
        .filter((t) => t.type === 'expense')
        .forEach((t) => {
          const key = t.date.slice(0, 7)
          monthlyExpenses[key] = (monthlyExpenses[key] || 0) + t.amount
        })

      const monthKeys = Object.keys(monthlyExpenses)
      if (monthKeys.length > 0) {
        let lowest = monthKeys[0]!
        for (const k of monthKeys) {
          if ((monthlyExpenses[k] || 0) < (monthlyExpenses[lowest] || 0)) lowest = k
        }
        results.push({
          icon: '📉',
          label: 'Pengeluaran Terendah',
          value: formatCurrency(monthlyExpenses[lowest] || 0),
          date: formatMonthLabel(lowest),
        })
      }
    }

    // ── 2. Income Tertinggi (monthly) ──
    if (transactions.length > 0) {
      const monthlyIncome: Record<string, number> = {}
      transactions
        .filter((t) => t.type === 'income')
        .forEach((t) => {
          const key = t.date.slice(0, 7)
          monthlyIncome[key] = (monthlyIncome[key] || 0) + t.amount
        })

      const monthKeys = Object.keys(monthlyIncome)
      if (monthKeys.length > 0) {
        let highest = monthKeys[0]!
        for (const k of monthKeys) {
          if ((monthlyIncome[k] || 0) > (monthlyIncome[highest] || 0)) highest = k
        }
        if ((monthlyIncome[highest] || 0) > 0) {
          results.push({
            icon: '💰',
            label: 'Income Tertinggi',
            value: formatCurrency(monthlyIncome[highest] || 0),
            date: formatMonthLabel(highest),
          })
        }
      }
    }

    // ── 3. Streak Tracking Harian Terpanjang ──
    if (transactions.length > 0) {
      const dates = new Set(transactions.map((t) => t.date))
      const sorted = [...dates].sort()
      let longestStreak = 0
      let currentStreak = 0
      let streakEnd = ''
      for (let i = 0; i < sorted.length; i++) {
        if (i === 0) {
          currentStreak = 1
        } else {
          const prev = new Date(sorted[i - 1]!)
          const curr = new Date(sorted[i]!)
          const diff = (curr.getTime() - prev.getTime()) / 86400000
          if (diff === 1) {
            currentStreak++
          } else {
            currentStreak = 1
          }
        }
        if (currentStreak > longestStreak) {
          longestStreak = currentStreak
          streakEnd = sorted[i]!
        }
      }
      if (longestStreak > 0) {
        results.push({
          icon: '🔥',
          label: 'Streak Tracking Harian Terpanjang',
          value: `${longestStreak} hari`,
          date: streakEnd ? `(akhir: ${streakEnd})` : undefined,
        })
      }
    }

    // ── 4. Net Worth Growth Tercepat (monthly) ──
    if (entries.length >= 2) {
      const sorted = [...entries].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
      let bestGrowth = -Infinity
      let bestGrowthDate = ''
      let bestGrowthPct = 0
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1]!
        const curr = sorted[i]!
        const prevNw = prev.netWorth
        const currNw = curr.netWorth
        if (prevNw !== 0) {
          const pct = ((currNw - prevNw) / Math.abs(prevNw)) * 100
          if (pct > bestGrowth) {
            bestGrowth = pct
            bestGrowthDate = curr.date ?? ''
            bestGrowthPct = Math.round(pct)
          }
        }
      }
      if (bestGrowth > -Infinity) {
        const prefix = bestGrowthPct >= 0 ? '+' : ''
        results.push({
          icon: '🚀',
          label: 'Net Worth Growth Tercepat',
          value: `${prefix}${bestGrowthPct}%`,
          date: formatMonthLabel(bestGrowthDate.slice(0, 7)),
        })
      }
    }

    // ── 5. Habit Paling Konsisten ──
    {
      let bestHabitName = ''
      let bestHabitStreak = 0
      let bestHabitEmoji = '✅'

      for (const habit of habits) {
        const hLogs = logs.filter((l) => l.habitId === habit.id && l.done)
        const hDates = new Set(hLogs.map((l) => l.date))
        let streak = 0
        const d = new Date()
        const today = dateStr(new Date())

        while (true) {
          const ds = dateStr(d)
          if (ds > today) {
            d.setDate(d.getDate() - 1)
            continue
          }

          if (habit.frequency === 'weekly') {
            const dayName = DAY_NAMES[d.getDay()]!
            const targetDays: string[] =
              typeof habit.targetDays === 'string'
                ? (JSON.parse(habit.targetDays as string) as string[])
                : (habit.targetDays ?? [])
            if (!targetDays.includes(dayName)) {
              d.setDate(d.getDate() - 1)
              const daysBack = Math.floor(
                (new Date().getTime() - d.getTime()) / 86400000,
              )
              if (daysBack > 400) break
              continue
            }
          }

          if (hDates.has(ds)) {
            streak++
            d.setDate(d.getDate() - 1)
          } else {
            break
          }
          const daysBack = Math.floor(
            (new Date().getTime() - d.getTime()) / 86400000,
          )
          if (daysBack > 400) break
        }

        // Also compute all-time best streak (not just current)
        const sortedLogDates = [...hDates].sort()
        let allTimeBest = 0
        let current = 0
        for (let i = 0; i < sortedLogDates.length; i++) {
          if (i === 0) {
            current = 1
          } else {
            const prev = new Date(sortedLogDates[i - 1]!)
            const curr = new Date(sortedLogDates[i]!)
            const diff = (curr.getTime() - prev.getTime()) / 86400000
            if (diff === 1) {
              current++
            } else {
              current = 1
            }
          }
          if (current > allTimeBest) allTimeBest = current
        }

        const best = Math.max(streak, allTimeBest)
        if (best > bestHabitStreak) {
          bestHabitStreak = best
          bestHabitName = habit.name
          bestHabitEmoji = habit.emoji
        }
      }

      if (bestHabitStreak > 0 && bestHabitName) {
        results.push({
          icon: bestHabitEmoji || '✅',
          label: 'Habit Paling Konsisten',
          value: `${bestHabitName} (${bestHabitStreak} hari)`,
        })
      }
    }

    // ── 6. Bulan Paling Hemat ──
    if (transactions.length > 0) {
      const monthlySavingsRate: Record<string, { income: number; expense: number }> = {}
      transactions.forEach((t) => {
        const key = t.date.slice(0, 7)
        if (!monthlySavingsRate[key]) monthlySavingsRate[key] = { income: 0, expense: 0 }
        if (t.type === 'income') monthlySavingsRate[key]!.income += t.amount
        else monthlySavingsRate[key]!.expense += t.amount
      })

      let bestMonth = ''
      let bestRate = -Infinity
      for (const [key, vals] of Object.entries(monthlySavingsRate)) {
        if (vals.income > 0) {
          const rate = Math.round(((vals.income - vals.expense) / vals.income) * 100)
          if (rate > bestRate) {
            bestRate = rate
            bestMonth = key
          }
        }
      }
      if (bestMonth) {
        const prefix = bestRate >= 0 ? '+' : ''
        results.push({
          icon: '🤑',
          label: 'Bulan Paling Hemat',
          value: `${prefix}${bestRate}% savings rate`,
          date: formatMonthLabel(bestMonth),
        })
      }
    }

    // ── 7. Kategori Spending Terbesar Sepanjang Masa ──
    if (transactions.length > 0) {
      const catSpend: Record<string, number> = {}
      transactions
        .filter((t) => t.type === 'expense')
        .forEach((t) => {
          catSpend[t.category] = (catSpend[t.category] || 0) + t.amount
        })

      let topCat = ''
      let topAmount = 0
      for (const [cat, amount] of Object.entries(catSpend)) {
        if (amount > topAmount) {
          topAmount = amount
          topCat = cat
        }
      }
      if (topCat) {
        results.push({
          icon: '📊',
          label: 'Kategori Spending Terbesar Sepanjang Masa',
          value: `${topCat}`,
          date: `Total: ${formatCurrency(topAmount)}`,
        })
      }
    }

    // ── 8. Transaksi Terbanyak Dalam Sehari ──
    if (transactions.length > 0) {
      const dailyCount: Record<string, number> = {}
      transactions.forEach((t) => {
        dailyCount[t.date] = (dailyCount[t.date] || 0) + 1
      })

      let maxDay = ''
      let maxCount = 0
      for (const [day, count] of Object.entries(dailyCount)) {
        if (count > maxCount) {
          maxCount = count
          maxDay = day
        }
      }
      if (maxDay && maxCount > 1) {
        results.push({
          icon: '📅',
          label: 'Transaksi Terbanyak Dalam Sehari',
          value: `${maxCount} transaksi`,
          date: maxDay,
        })
      }
    }

    // ── 9. Total Budget On Track ──
    if (budgets.length > 0 && transactions.length > 0) {
      const thisMonth = new Date().toISOString().slice(0, 7)
      const onTrack = budgets.filter((b) => {
        const spent = transactions
          .filter((t) => t.type === 'expense' && t.category === b.category && t.date.startsWith(thisMonth))
          .reduce((s, t) => s + t.amount, 0)
        return b.limit > 0 && (spent / b.limit) * 100 < 80
      })
      if (budgets.length > 0) {
        results.push({
          icon: '🎯',
          label: 'Budget On Track (Bulan Ini)',
          value: `${onTrack.length}/${budgets.length}`,
          date: `${Math.round((onTrack.length / budgets.length) * 100)}% on track`,
        })
      }
    }

    // ── 10. Savings Goal Progress ──
    if (savingsGoals.length > 0) {
      let bestGoalName = ''
      let bestGoalPct = 0
      for (const g of savingsGoals) {
        const pct = g.targetAmount > 0 ? Math.round((g.savedAmount / g.targetAmount) * 100) : 0
        if (pct > bestGoalPct) {
          bestGoalPct = pct
          bestGoalName = g.name
        }
      }
      if (bestGoalName) {
        results.push({
          icon: '🎉',
          label: 'Goal Tabungan Terbaik',
          value: `${bestGoalPct}% tercapai`,
          date: bestGoalName,
        })
      }
    }

    return results
  }, [transactions, budgets, savingsGoals, entries, habits, logs, formatCurrency])

  return (
    <div>
      <div className="flex items-start justify-between mb-7 gap-4 flex-wrap">
        <h2 className="text-[1.8rem]">🏅 Personal Records</h2>
      </div>

      {records.length === 0 ? (
        <div className="nb-panel text-center py-16">
          <div className="text-5xl mb-3">🏅</div>
          <div className="font-bold uppercase text-nb-fg-muted">
            Belum ada data untuk personal records
          </div>
          <div className="text-sm text-nb-fg-muted mt-2 font-medium">
            Mulai catat transaksi, habit, dan net worth untuk melihat records!
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {records.map((r, i) => (
            <NeubruCard key={i}>
              <div className="flex items-start gap-3">
                <span className="text-3xl shrink-0 leading-none">{r.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">
                    {r.label}
                  </div>
                  <div className="font-mono text-lg font-extrabold text-nb-fg break-words">
                    {r.value}
                  </div>
                  {r.date && (
                    <div className="text-xs font-bold text-nb-fg-muted mt-1.5">
                      {r.date}
                    </div>
                  )}
                </div>
              </div>
            </NeubruCard>
          ))}
        </div>
      )}
    </div>
  )
}
