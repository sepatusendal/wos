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

// Namespaced per user, mirroring levelStore — a single shared
// `wos_achievements` key meant two accounts on the same browser saw each
// other's badges.
const STORAGE_PREFIX = 'wos_achievements_'
// Pre-namespacing key. Kept only so existing progress can be migrated once.
const LEGACY_STORAGE_KEY = 'wos_achievements'
function storageKeyFor(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`
}

interface PersistedAchievements {
  unlocked: string[]
  /** achievementId → ISO timestamp of the unlock. Drives "new achievement" windows (e.g. the pet's hero mood). */
  unlockedAt: Record<string, string>
}

function parsePersisted(raw: string | null): PersistedAchievements {
  if (!raw) return { unlocked: [], unlockedAt: {} }
  try {
    const parsed = JSON.parse(raw)
    // Pre-timestamp format was a bare array of ids.
    if (Array.isArray(parsed)) return { unlocked: parsed, unlockedAt: {} }
    return {
      unlocked: Array.isArray(parsed.unlocked) ? parsed.unlocked : [],
      unlockedAt: parsed.unlockedAt ?? {},
    }
  } catch {
    return { unlocked: [], unlockedAt: {} }
  }
}

function loadUnlocked(userId: string | null): PersistedAchievements {
  if (!userId) return { unlocked: [], unlockedAt: {} }
  try {
    return parsePersisted(localStorage.getItem(storageKeyFor(userId)))
  } catch {
    return { unlocked: [], unlockedAt: {} }
  }
}

function saveUnlocked(userId: string | null, data: PersistedAchievements) {
  if (!userId) return
  try {
    localStorage.setItem(storageKeyFor(userId), JSON.stringify(data))
  } catch {
    // localStorage may be unavailable
  }
}

// One-time migration of the pre-namespacing shared key to the first user who
// logs in after the change, then drop it so a second account can't inherit
// the same blob. Same approach as levelStore.
function migrateLegacyKey(userId: string) {
  try {
    if (localStorage.getItem(storageKeyFor(userId)) !== null) return
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!legacy) return
    localStorage.setItem(storageKeyFor(userId), legacy)
    localStorage.removeItem(LEGACY_STORAGE_KEY)
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

interface AchievementState {
  currentUserId: string | null
  unlocked: string[]
  unlockedAt: Record<string, string>
  /** no-op for API consistency with other stores */
  setAdapter: (_adapter: unknown) => void
  setUser: (userId: string | null) => void
  load: () => void
  /** Re-check every unlock condition. Returns the ids that unlocked on this pass (empty when nothing is new). */
  checkAll: () => string[]
  isUnlocked: (id: string) => boolean
  getLastUnlocked: () => Achievement | null
  /** ISO timestamp of the most recent unlock, or null if none is recorded. */
  getLastUnlockedAt: () => string | null
  getAllUnlocked: () => Achievement[]
}

export const useAchievementStore = create<AchievementState>((set, get) => ({
  currentUserId: null,
  unlocked: [],
  unlockedAt: {},

  setAdapter: (_adapter) => {
    // no-op — achievements use localStorage only
  },

  setUser: (userId) => {
    if (get().currentUserId === userId) return
    if (!userId) {
      set({ currentUserId: null, unlocked: [], unlockedAt: {} })
      return
    }
    migrateLegacyKey(userId)
    const initial = loadUnlocked(userId)
    set({ currentUserId: userId, unlocked: initial.unlocked, unlockedAt: initial.unlockedAt })
  },

  load: () => {
    const initial = loadUnlocked(get().currentUserId)
    set({ unlocked: initial.unlocked, unlockedAt: initial.unlockedAt })
  },

  checkAll: () => {
    const { unlocked } = get()
    const before = new Set(unlocked)
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
    // Progress goes through getGoalProgress so a goal linked to an account
    // is measured against that account's live balance, not the stale
    // hand-typed `savedAmount` (which a linked goal never updates).
    for (const g of savingsGoals) {
      const saved = finance.getGoalProgress(g)
      const pct = g.targetAmount > 0 ? (saved / g.targetAmount) * 100 : 0
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

    // 6. budget_perfect — genuinely staying under budget, not "nothing spent
    // yet". The old check unlocked the moment a single budget was created
    // (0 spending trivially reads as 0% < 80%). Now it needs at least three
    // budgets, each with real spending logged against it this month, and all
    // of them still under 80%.
    if (!now.includes('budget_perfect') && budgets.length >= 3) {
      const thisMonth = dateStr(new Date()).slice(0, 7)
      const allOnTrack = budgets.every((b) => {
        const monthTx = tx.filter(
          (t) =>
            t.type === 'expense' &&
            t.category === b.category &&
            t.date.startsWith(thisMonth),
        )
        if (monthTx.length === 0) return false // untouched budget proves nothing
        const spent = monthTx.reduce((s, t) => s + t.amount, 0)
        return b.limit > 0 && (spent / b.limit) * 100 < 80
      })
      if (allOnTrack) {
        now.push('budget_perfect')
        changed = true
      }
    }

    // 7. habit_7 & habit_30
    for (const h of habits) {
      const streak = useHabitStore.getState().getStreak(h.id)
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

    if (!changed) return []

    const newlyUnlocked = now.filter((id) => !before.has(id))
    const stamp = new Date().toISOString()
    const unlockedAt = { ...get().unlockedAt }
    for (const id of newlyUnlocked) unlockedAt[id] = stamp

    set({ unlocked: now, unlockedAt })
    saveUnlocked(get().currentUserId, { unlocked: now, unlockedAt })
    return newlyUnlocked
  },

  isUnlocked: (id) => get().unlocked.includes(id),

  getLastUnlocked: () => {
    const { unlocked } = get()
    if (unlocked.length === 0) return null
    const lastId = unlocked[unlocked.length - 1]
    return ACHIEVEMENTS.find((a) => a.id === lastId) || null
  },

  getLastUnlockedAt: () => {
    const stamps = Object.values(get().unlockedAt)
    if (stamps.length === 0) return null
    return stamps.reduce((a, b) => (a > b ? a : b))
  },

  getAllUnlocked: () => {
    const { unlocked } = get()
    return ACHIEVEMENTS.filter((a) => unlocked.includes(a.id))
  },
}))
