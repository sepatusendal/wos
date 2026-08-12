import { useEffect, useMemo } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { useFinanceStore } from '../../stores/financeStore'
import { useHabitStore } from '../../stores/habitStore'
import { useNetWorthStore } from '../../stores/netWorthStore'
import { NeubruCard } from '../../components'
import { useFormatCurrency } from '../../stores/useFormatCurrency'
import { todayStr } from '@wos/shared'

interface RecordCard {
  icon: string
  label: string
  value: string
  date?: string
  /** Not enough data yet — shown grayed out as progress, never hidden. */
  locked?: boolean
}

// Minimum data before a record is meaningful
const MIN_MONTHS = 2       // monthly records need 2 complete past months
const MIN_STREAK_DAYS = 3  // streak records need 3 days of data
const MIN_NW_FLOOR = 100_000 // growth from a near-zero base isn't a real record

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

    const lockedCard = (icon: string, label: string, need: string, have: number, total: number): RecordCard => ({
      icon: '🔒',
      label: `${icon} ${label}`,
      value: `Butuh ${need}`,
      date: `${have}/${total} terkumpul`,
      locked: true,
    })

    // ── Monthly aggregation — the current month is still in progress, so it
    // never competes (a 3-day-old month would trivially win "lowest expense").
    const currentMonth = todayStr().slice(0, 7)
    const monthly: Record<string, { income: number; expense: number }> = {}
    for (const t of transactions) {
      const key = t.date.slice(0, 7)
      if (key >= currentMonth) continue
      if (!monthly[key]) monthly[key] = { income: 0, expense: 0 }
      if (t.type === 'income') monthly[key]!.income += t.amount
      else monthly[key]!.expense += t.amount
    }
    const completeMonths = Object.keys(monthly)
    const hasEnoughMonths = completeMonths.length >= MIN_MONTHS

    // ── 1. Pengeluaran Terendah (monthly) ──
    if (!hasEnoughMonths) {
      results.push(lockedCard('📉', 'Pengeluaran Terendah', `${MIN_MONTHS} bulan data`, completeMonths.length, MIN_MONTHS))
    } else {
      const expenseMonths = completeMonths.filter((k) => (monthly[k]?.expense ?? 0) > 0)
      if (expenseMonths.length >= MIN_MONTHS) {
        let lowest = expenseMonths[0]!
        for (const k of expenseMonths) {
          if ((monthly[k]?.expense ?? 0) < (monthly[lowest]?.expense ?? 0)) lowest = k
        }
        results.push({
          icon: '📉',
          label: 'Pengeluaran Terendah',
          value: formatCurrency(monthly[lowest]?.expense ?? 0),
          date: formatMonthLabel(lowest),
        })
      } else {
        results.push(lockedCard('📉', 'Pengeluaran Terendah', `${MIN_MONTHS} bulan data pengeluaran`, expenseMonths.length, MIN_MONTHS))
      }
    }

    // ── 2. Income Tertinggi (monthly) ──
    if (!hasEnoughMonths) {
      results.push(lockedCard('💰', 'Income Tertinggi', `${MIN_MONTHS} bulan data`, completeMonths.length, MIN_MONTHS))
    } else {
      const incomeMonths = completeMonths.filter((k) => (monthly[k]?.income ?? 0) > 0)
      if (incomeMonths.length >= MIN_MONTHS) {
        let highest = incomeMonths[0]!
        for (const k of incomeMonths) {
          if ((monthly[k]?.income ?? 0) > (monthly[highest]?.income ?? 0)) highest = k
        }
        results.push({
          icon: '💰',
          label: 'Income Tertinggi',
          value: formatCurrency(monthly[highest]?.income ?? 0),
          date: formatMonthLabel(highest),
        })
      } else {
        results.push(lockedCard('💰', 'Income Tertinggi', `${MIN_MONTHS} bulan data income`, incomeMonths.length, MIN_MONTHS))
      }
    }

    // ── 3. Streak Tracking Harian Terpanjang ──
    {
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
      if (sorted.length < MIN_STREAK_DAYS) {
        results.push(lockedCard('🔥', 'Streak Tracking Harian Terpanjang', `${MIN_STREAK_DAYS} hari data`, sorted.length, MIN_STREAK_DAYS))
      } else if (longestStreak > 0) {
        results.push({
          icon: '🔥',
          label: 'Streak Tracking Harian Terpanjang',
          value: `${longestStreak} hari`,
          date: streakEnd ? `(akhir: ${streakEnd})` : undefined,
        })
      }
    }

    // ── 4. Net Worth Growth Tercepat (monthly) ──
    if (entries.length < 2) {
      results.push(lockedCard('🚀', 'Net Worth Growth Tercepat', '2 entry net worth', entries.length, 2))
    } else {
      const sorted = [...entries].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
      let bestGrowth = -Infinity
      let bestGrowthDate = ''
      let bestGrowthPct = 0
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1]!
        const curr = sorted[i]!
        const prevNw = prev.netWorth
        const currNw = curr.netWorth
        // Growth from a tiny/near-zero base produces meaningless "+900%" records
        if (Math.abs(prevNw) >= MIN_NW_FLOOR) {
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
      } else {
        results.push({
          icon: '🔒',
          label: '🚀 Net Worth Growth Tercepat',
          value: `Butuh net worth awal ≥ ${formatCurrency(MIN_NW_FLOOR)}`,
          date: 'growth dari nilai nyaris nol belum dihitung',
          locked: true,
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
                ? (((() => { try { return JSON.parse(habit.targetDays as string) as string[] } catch { return [] } })()))
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

      // Streak records need a few days of habit data before they mean anything
      const habitLogDays = new Set(logs.filter((l) => l.done).map((l) => l.date)).size
      if (habitLogDays < MIN_STREAK_DAYS) {
        results.push(lockedCard('✅', 'Habit Paling Konsisten', `${MIN_STREAK_DAYS} hari data habit`, habitLogDays, MIN_STREAK_DAYS))
      } else if (bestHabitStreak > 0 && bestHabitName) {
        results.push({
          icon: bestHabitEmoji || '✅',
          label: 'Habit Paling Konsisten',
          value: `${bestHabitName} (${bestHabitStreak} hari)`,
        })
      }
    }

    // ── 6. Bulan Paling Hemat (bulan berjalan tidak ikut) ──
    {
      const incomeMonths = completeMonths.filter((k) => (monthly[k]?.income ?? 0) > 0)
      if (incomeMonths.length < MIN_MONTHS) {
        results.push(lockedCard('🤑', 'Bulan Paling Hemat', `${MIN_MONTHS} bulan data income`, incomeMonths.length, MIN_MONTHS))
      } else {
        let bestMonth = ''
        let bestRate = -Infinity
        for (const key of incomeMonths) {
          const vals = monthly[key]!
          const rate = Math.round(((vals.income - vals.expense) / vals.income) * 100)
          if (rate > bestRate) {
            bestRate = rate
            bestMonth = key
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
      const thisMonth = todayStr().slice(0, 7)
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
            <NeubruCard key={i} className={r.locked ? 'opacity-60' : undefined}>
              <div className="flex items-start gap-3">
                <span className="text-3xl shrink-0 leading-none">{r.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">
                    {r.label}
                  </div>
                  <div className={`font-mono text-lg font-extrabold break-words ${r.locked ? 'text-nb-fg-muted' : 'text-nb-fg'}`}>
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
