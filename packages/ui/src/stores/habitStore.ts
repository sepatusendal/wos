import { create } from 'zustand'
import type { Habit, HabitLog } from '@wos/shared'
import { generateId, isoNow } from '@wos/shared'
import type { DatabaseAdapter } from '@wos/db'
import { eq, desc } from '@wos/db'

interface HabitState {
  adapter: DatabaseAdapter | null
  habits: Habit[]
  logs: HabitLog[]
  loading: boolean
  _toggling: Set<string>
  setAdapter: (adapter: DatabaseAdapter) => void
  fetchAll: (userId: string) => Promise<void>
  addHabit: (userId: string, data: { name: string; emoji: string; frequency: string; targetDays: string[]; color: string }) => Promise<void>
  editHabit: (data: { id: string; name: string; emoji: string; frequency: string; targetDays: string[]; color: string; active: boolean }) => Promise<void>
  deleteHabit: (id: string) => Promise<void>
  toggleActive: (id: string, active: boolean) => Promise<void>
  toggleLog: (habitId: string, date: string, done: boolean) => Promise<void>
  getStreak: (habitId: string) => number
  getCompletionRate: (habitId: string, days?: number) => number
}

function dateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return dateStr(d)
}

function formatHabit(row: any): Habit {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    frequency: row.frequency,
    targetDays: typeof row.target_days === 'string' ? JSON.parse(row.target_days) as string[] : (row.target_days ?? []),
    color: row.color,
    active: Boolean(row.active),
    createdAt: row.created_at,
  }
}

function formatHabitLog(row: any): HabitLog {
  return {
    id: row.id,
    habitId: row.habit_id,
    date: row.date,
    done: Boolean(row.done),
    createdAt: row.created_at,
  }
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export const useHabitStore = create<HabitState>((set, get) => ({
  adapter: null,
  habits: [],
  logs: [],
  loading: false,
  _toggling: new Set<string>(),

  setAdapter: (adapter) => set({ adapter }),

  fetchAll: async (userId) => {
    const { adapter } = get()
    if (!adapter) return
    set({ loading: true })
    try {
      const habitsData = await adapter.db.select().from('habits').where(eq('user_id', userId)).orderBy(desc('created_at')).all()
      const habits = habitsData.map(formatHabit)

      // Fetch logs scoped to this user only
      const allLogs = await adapter.db.select().from('habit_logs').where(eq('user_id', userId)).all()
      const cutoff = daysAgo(90)
      const habitIds = new Set(habits.map((h: Habit) => h.id))
      const logs = allLogs
        .map(formatHabitLog)
        .filter((l: HabitLog) => habitIds.has(l.habitId) && l.date >= cutoff)

      set({ habits, logs, loading: false })
    } catch (err) {
      console.error("[habitStore] fetchAll failed:", err)
      set({ loading: false })
    }
  },

  addHabit: async (userId, data) => {
    const { adapter } = get()
    if (!adapter) return
    const id = generateId()
    const now = isoNow()
    await adapter.db.insert('habits').values({
      id,
      user_id: userId,
      name: data.name,
      emoji: data.emoji,
      frequency: data.frequency,
      target_days: JSON.stringify(data.targetDays),
      color: data.color,
      active: true,
      created_at: now,
    })
    const habit: Habit = {
      id,
      name: data.name,
      emoji: data.emoji,
      frequency: data.frequency as Habit['frequency'],
      targetDays: data.targetDays,
      color: data.color as Habit['color'],
      active: true,
      createdAt: now,
    }
    set((s) => ({ habits: [habit, ...s.habits] }))
  },

  editHabit: async (data) => {
    const { adapter } = get()
    if (!adapter) return
    await adapter.db.update('habits').set({
      name: data.name,
      emoji: data.emoji,
      frequency: data.frequency,
      target_days: JSON.stringify(data.targetDays),
      color: data.color,
      active: data.active,
    }).where(eq('id', data.id))
    set((s) => ({
      habits: s.habits.map((h) =>
        h.id === data.id
          ? {
              ...h,
              name: data.name,
              emoji: data.emoji,
              frequency: data.frequency as Habit['frequency'],
              targetDays: data.targetDays,
              color: data.color as Habit['color'],
              active: data.active,
            }
          : h
      ),
    }))
  },

  deleteHabit: async (id) => {
    const { adapter } = get()
    if (!adapter) return
    // Delete all related habit_logs first
    await adapter.db.delete('habit_logs').where(eq('habit_id', id))
    // Then delete the habit
    await adapter.db.delete('habits').where(eq('id', id))
    set((s) => ({
      habits: s.habits.filter((h) => h.id !== id),
      logs: s.logs.filter((l) => l.habitId !== id),
    }))
  },

  toggleActive: async (id, active) => {
    const { adapter } = get()
    if (!adapter) return
    await adapter.db.update('habits').set({ active: active ? 1 : 0 }).where(eq('id', id))
    set((s) => ({
      habits: s.habits.map((h) => (h.id === id ? { ...h, active } : h)),
    }))
  },

  toggleLog: async (habitId, date, done) => {
    const { adapter, logs, _toggling } = get()
    if (!adapter) return

    const key = `${habitId}:${date}`
    if (_toggling.has(key)) return // Prevent concurrent duplicate inserts
    _toggling.add(key)

    try {
      const existing = logs.find((l) => l.habitId === habitId && l.date === date)
      if (existing) {
        await adapter.db.update('habit_logs').set({ done: done ? 1 : 0 }).where(eq('id', existing.id))
        set((s) => ({
          logs: s.logs.map((l) => (l.id === existing.id ? { ...l, done } : l)),
        }))
      } else {
        const id = generateId()
        const now = isoNow()
        await adapter.db.insert('habit_logs').values({
          id, habit_id: habitId, date, done: done ? 1 : 0, created_at: now,
        })
        const newLog: HabitLog = { id, habitId, date, done, createdAt: now }
        set((s) => ({ logs: [...s.logs, newLog] }))
      }
    } finally {
      _toggling.delete(key)
    }
  },

  getStreak: (habitId) => {
    const { logs, habits } = get()
    const habit = habits.find((h) => h.id === habitId)
    if (!habit) return 0

    let streak = 0
    const today = dateStr(new Date())
    let current = new Date()

    while (true) {
      const ds = dateStr(current)
      // Don't count future days
      if (ds > today) {
        current.setDate(current.getDate() - 1)
        continue
      }

      const dayName = DAY_NAMES[current.getDay()]!

      // For weekly habits, skip non-target days
      if (habit.frequency === 'weekly' && !(habit.targetDays ?? []).includes(dayName)) {
        current.setDate(current.getDate() - 1)
        // Allow up to 7 skips to prevent infinite loop
        const daysBack = Math.floor((new Date().getTime() - current.getTime()) / 86400000)
        if (daysBack > 90) break
        continue
      }

      const log = logs.find((l) => l.habitId === habitId && l.date === ds)
      if (log?.done) {
        streak++
        current.setDate(current.getDate() - 1)
      } else {
        // Check if today is still pending (no log yet = not yet done/undone)
        // For today specifically, if there's no log it doesn't break streak
        if (ds === today && !log) {
          current.setDate(current.getDate() - 1)
          continue
        }
        break
      }
    }

    return streak
  },

  getCompletionRate: (habitId, days = 30) => {
    const { logs, habits } = get()
    const habit = habits.find((h) => h.id === habitId)
    if (!habit) return 0

    let applicableDays = 0
    let doneDays = 0
    const today = new Date()

    for (let i = 0; i < days; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const ds = dateStr(d)

      // For weekly habits, only count target days
      if (habit.frequency === 'weekly') {
        const dayName = DAY_NAMES[d.getDay()]!
        if (!(habit.targetDays ?? []).includes(dayName)) {
          continue
        }
      }

      applicableDays++
      const log = logs.find((l) => l.habitId === habitId && l.date === ds)
      if (log?.done) doneDays++
    }

    return applicableDays > 0 ? Math.round((doneDays / applicableDays) * 100) : 0
  },
}))
