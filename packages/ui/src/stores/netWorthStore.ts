import { create } from 'zustand'
import type { NetWorthEntry } from '@wos/shared'
import { generateId, isoNow } from '@wos/shared'
import type { DatabaseAdapter } from '@wos/db'
import { eq, desc } from '@wos/db'

interface NetWorthState {
  adapter: DatabaseAdapter | null
  entries: NetWorthEntry[]
  loading: boolean
  setAdapter: (adapter: DatabaseAdapter) => void
  fetchAll: (userId: string) => Promise<void>
  addEntry: (userId: string, e: Omit<NetWorthEntry, 'id' | 'createdAt'>) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
}

export const useNetWorthStore = create<NetWorthState>((set, get) => ({
  adapter: null,
  entries: [],
  loading: false,

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
