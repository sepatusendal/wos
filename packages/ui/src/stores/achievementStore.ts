import { create } from 'zustand'
import { useFinanceStore } from './financeStore'
import { useHabitStore } from './habitStore'
import { useNetWorthStore } from './netWorthStore'
import { useSubscriptionStore } from './subscriptionStore'

export interface Achievement {
  id: string
  name: string
  desc: string
  icon: string
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_transaction', name: 'First Blood', desc: 'Catat transaksi pertama', icon: '💉' },
  { id: 'streak_7', name: 'Consistency', desc: '7 hari berturut-turut tracking', icon: '🔥' },
  { id: 'streak_30', name: 'On Fire', desc: '30 hari berturut-turut tracking', icon: '🚀' },
  { id: 'savings_25', name: 'Saver', desc: 'Capai 25% savings goal pertama', icon: '🎯' },
  { id: 'savings_50', name: 'Halfway There', desc: 'Capai 50% savings goal', icon: '🏔️' },
  { id: 'savings_100', name: 'Goal Crusher', desc: 'Capai 100% savings goal', icon: '🏆' },
  { id: 'networth_positive', name: 'In the Green', desc: 'Net worth positif', icon: '💚' },
  { id: 'budget_perfect', name: 'Budget Master', desc: 'Semua budget on track bulan ini', icon: '🎯' },
  { id: 'habit_7', name: 'Habit Starter', desc: '7 hari streak habit', icon: '🌱' },
  { id: 'habit_30', name: 'Habit Machine', desc: '30 hari streak habit', icon: '⚡' },
  { id: 'transactions_100', name: 'Century', desc: '100 transaksi tercatat', icon: '💯' },
  { id: 'sub_tracker', name: 'Subscription Aware', desc: 'Track subscription pertama', icon: '📋' },
]

const STORAGE_KEY = 'wos_achievements'

function loadUnlocked(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveUnlocked(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // localStorage may be unavailable
  }
}

function dateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Compute tracking streak — consecutive days with at least one transaction */
function computeTxStreak(transactions: { date: string }[]): number {
  if (transactions.length === 0) return 0
  const dates = new Set(transactions.map((t) => t.date))
  const today = dateStr(new Date())
  let streak = 0
  const d = new Date()

  while (true) {
    const ds = dateStr(d)
    if (ds > today) {
      d.setDate(d.getDate() - 1)
      continue
    }
    if (dates.has(ds)) {
      streak++
      d.setDate(d.getDate() - 1)
    } else {
      // Allow today to be pending (no tx yet today doesn't break streak)
      if (ds === today && streak === 0) {
        d.setDate(d.getDate() - 1)
        continue
      }
      break
    }
    const daysBack = Math.floor((new Date().getTime() - d.getTime()) / 86400000)
    if (daysBack > 400) break
  }
  return streak
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

interface AchievementState {
  unlocked: string[]
  /** no-op for API consistency with other stores */
  setAdapter: (_adapter: unknown) => void
  load: () => void
  checkAll: () => void
  isUnlocked: (id: string) => boolean
  getLastUnlocked: () => Achievement | null
  getAllUnlocked: () => Achievement[]
}

export const useAchievementStore = create<AchievementState>((set, get) => ({
  unlocked: loadUnlocked(),

  setAdapter: (_adapter) => {
    // no-op — achievements use localStorage only
  },

  load: () => {
    set({ unlocked: loadUnlocked() })
  },

  checkAll: () => {
    const { unlocked } = get()
    let changed = false
    const now = [...unlocked]

    // Read from sibling stores (getState() is always safe — zustand stores are singletons)
    const finance = useFinanceStore.getState()
    const habitSt = useHabitStore.getState()
    const nwSt = useNetWorthStore.getState()
    const subSt = useSubscriptionStore.getState()

    const tx = finance.transactions ?? []
    const savingsGoals = finance.savingsGoals ?? []
    const budgets = finance.budgets ?? []
    const habits = habitSt.habits ?? []
    const habitLogs = habitSt.logs ?? []
    const entries = nwSt.entries ?? []
    const subs = subSt.subscriptions ?? []

    // 1. first_transaction
    if (!now.includes('first_transaction') && tx.length >= 1) {
      now.push('first_transaction')
      changed = true
    }

    // 2. transactions_100
    if (!now.includes('transactions_100') && tx.length >= 100) {
      now.push('transactions_100')
      changed = true
    }

    // 3. streak_7 & streak_30 — tracking streak
    const txStreak = computeTxStreak(tx)
    if (!now.includes('streak_7') && txStreak >= 7) {
      now.push('streak_7')
      changed = true
    }
    if (!now.includes('streak_30') && txStreak >= 30) {
      now.push('streak_30')
      changed = true
    }

    // 4. savings_25, savings_50, savings_100
    for (const g of savingsGoals) {
      const pct = g.targetAmount > 0 ? (g.savedAmount / g.targetAmount) * 100 : 0
      if (!now.includes('savings_25') && pct >= 25) {
        now.push('savings_25')
        changed = true
      }
      if (!now.includes('savings_50') && pct >= 50) {
        now.push('savings_50')
        changed = true
      }
      if (!now.includes('savings_100') && pct >= 100) {
        now.push('savings_100')
        changed = true
      }
    }

    // 5. networth_positive
    if (!now.includes('networth_positive') && entries.length > 0) {
      const latest = entries.reduce((a, b) =>
        (a.date ?? '') > (b.date ?? '') ? a : b,
      )
      if (latest.netWorth > 0) {
        now.push('networth_positive')
        changed = true
      }
    }

    // 6. budget_perfect — all budgets on track (< 80% spent this month)
    if (!now.includes('budget_perfect') && budgets.length > 0) {
      const thisMonth = dateStr(new Date()).slice(0, 7)
      const allOnTrack = budgets.every((b) => {
        const spent = tx
          .filter(
            (t) =>
              t.type === 'expense' &&
              t.category === b.category &&
              t.date.startsWith(thisMonth),
          )
          .reduce((s, t) => s + t.amount, 0)
        return b.limit > 0 && (spent / b.limit) * 100 < 80
      })
      if (allOnTrack) {
        now.push('budget_perfect')
        changed = true
      }
    }

    // 7. habit_7 & habit_30
    for (const h of habits) {
      const hLogs = habitLogs.filter((l) => l.habitId === h.id && l.done)
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

        if (h.frequency === 'weekly') {
          const dayName = DAY_NAMES[d.getDay()]!
          const targetDays: string[] =
            typeof h.targetDays === 'string'
              ? (JSON.parse(h.targetDays as string) as string[])
              : (h.targetDays ?? [])
          if (!targetDays.includes(dayName)) {
            d.setDate(d.getDate() - 1)
            const daysBack = Math.floor(
              (new Date().getTime() - d.getTime()) / 86400000,
            )
            if (daysBack > 90) break
            continue
          }
        }

        if (hDates.has(ds)) {
          streak++
          d.setDate(d.getDate() - 1)
        } else {
          if (ds === today && streak === 0) {
            d.setDate(d.getDate() - 1)
            continue
          }
          break
        }
        const daysBack = Math.floor(
          (new Date().getTime() - d.getTime()) / 86400000,
        )
        if (daysBack > 400) break
      }
      if (!now.includes('habit_7') && streak >= 7) {
        now.push('habit_7')
        changed = true
      }
      if (!now.includes('habit_30') && streak >= 30) {
        now.push('habit_30')
        changed = true
      }
    }

    // 8. sub_tracker
    if (!now.includes('sub_tracker') && subs.length >= 1) {
      now.push('sub_tracker')
      changed = true
    }

    if (changed) {
      set({ unlocked: now })
      saveUnlocked(now)
    }
  },

  isUnlocked: (id) => get().unlocked.includes(id),

  getLastUnlocked: () => {
    const { unlocked } = get()
    if (unlocked.length === 0) return null
    const lastId = unlocked[unlocked.length - 1]
    return ACHIEVEMENTS.find((a) => a.id === lastId) || null
  },

  getAllUnlocked: () => {
    const { unlocked } = get()
    return ACHIEVEMENTS.filter((a) => unlocked.includes(a.id))
  },
}))
