import { create } from 'zustand'
import type { NetWorthEntry } from '@wos/shared'
import { generateId, isoNow, todayStr } from '@wos/shared'
import type { DatabaseAdapter } from '@wos/db'
import { eq, desc } from '@wos/db'

interface NetWorthState {
  adapter: DatabaseAdapter | null
  entries: NetWorthEntry[]
  loading: boolean
  snapshotting: boolean
  setAdapter: (adapter: DatabaseAdapter) => void
  fetchAll: (userId: string) => Promise<void>
  addEntry: (userId: string, e: Omit<NetWorthEntry, 'id' | 'createdAt'>) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  /**
   * Net worth history used to be a manually-typed snapshot — a plain number
   * disconnected from real holdings, the same class of bug as Savings
   * Goal's `savedAmount`. Now it's a once-a-day auto-snapshot of the live
   * computed value from Wealth (assets) + Liabilities; call this on
   * Wealth-page mount with the already-computed breakdown. No-ops if
   * today's snapshot already exists.
   */
  ensureTodaySnapshot: (userId: string, breakdown: Omit<NetWorthEntry, 'id' | 'createdAt' | 'date'>) => Promise<void>
}

export const useNetWorthStore = create<NetWorthState>((set, get) => ({
  adapter: null,
  entries: [],
  loading: false,
  snapshotting: false,

  setAdapter: (adapter) => set({ adapter }),

  fetchAll: async (userId) => {
    const { adapter } = get()
    if (!adapter) return
    set({ loading: true })
    try {
      const data = await adapter.db.select().from('net_worth_entries').where(eq('user_id', userId)).orderBy(desc('date')).all()
      set({ entries: data.map(formatEntry), loading: false })
    } catch (err) { console.error("[netWorthStore] fetchAll failed:", err); set({ loading: false }) }
  },

  addEntry: async (userId, e) => {
    const { adapter } = get()
    if (!adapter) return
    const id = generateId()
    await adapter.db.insert('net_worth_entries').values({
      id, user_id: userId, date: e.date,
      total_assets: e.totalAssets, total_liabilities: e.totalLiabilities, net_worth: e.netWorth,
      cash: e.cash, investments: e.investments, property: e.property, other_assets: e.otherAssets,
      mortgage: e.mortgage, loans: e.loans, credit_cards: e.creditCards, other_liabilities: e.otherLiabilities,
      created_at: isoNow(),
    })
    await get().fetchAll(userId)
  },

  deleteEntry: async (id) => {
    const { adapter } = get()
    if (!adapter) return
    await adapter.db.delete('net_worth_entries').where(eq('id', id))
    set((s) => ({ entries: s.entries.filter((x) => x.id !== id) }))
  },

  ensureTodaySnapshot: async (userId, breakdown) => {
    const { entries, snapshotting } = get()
    const today = todayStr()
    if (entries.some((e) => e.date === today)) return
    // Callers re-fire on every assets/liabilities change (e.g. each price
    // update during a multi-asset refresh) — without this guard, several
    // calls can all pass the check above before the first insert's
    // fetchAll() lands, writing duplicate rows for the same day.
    if (snapshotting) return
    set({ snapshotting: true })
    try {
      await get().addEntry(userId, { ...breakdown, date: today })
    } finally {
      set({ snapshotting: false })
    }
  },
}))

function formatEntry(e: any): NetWorthEntry {
  return {
    id: e.id, date: e.date,
    totalAssets: e.total_assets, totalLiabilities: e.total_liabilities, netWorth: e.net_worth,
    cash: e.cash ?? 0, investments: e.investments ?? 0, property: e.property ?? 0,
    otherAssets: e.other_assets ?? 0, mortgage: e.mortgage ?? 0, loans: e.loans ?? 0,
    creditCards: e.credit_cards ?? 0, otherLiabilities: e.other_liabilities ?? 0, createdAt: e.created_at,
  }
}
