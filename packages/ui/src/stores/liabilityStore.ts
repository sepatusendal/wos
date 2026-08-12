import { create } from 'zustand'
import type { Liability } from '@wos/shared'
import { generateId, isoNow, roundMoney } from '@wos/shared'
import type { DatabaseAdapter } from '@wos/db'
import { eq, desc } from '@wos/db'

interface LiabilityState {
  adapter: DatabaseAdapter | null
  liabilities: Liability[]
  loading: boolean
  setAdapter: (adapter: DatabaseAdapter) => void
  fetchAll: (userId: string) => Promise<void>
  addLiability: (userId: string, l: Omit<Liability, 'id' | 'createdAt'>) => Promise<void>
  editLiability: (l: { id: string; name: string; type: string; amount: number; notes: string }) => Promise<void>
  deleteLiability: (id: string) => Promise<void>
}

export const useLiabilityStore = create<LiabilityState>((set, get) => ({
  adapter: null,
  liabilities: [],
  loading: false,

  setAdapter: (adapter) => set({ adapter }),

  fetchAll: async (userId) => {
    const { adapter } = get()
    if (!adapter) return
    set({ loading: true })
    try {
      const data = await adapter.db.select().from('liabilities').where(eq('user_id', userId)).orderBy(desc('created_at')).all()
      set({ liabilities: data.map(formatLiability), loading: false })
    } catch (err) { console.error('[liabilityStore] fetchAll failed:', err); set({ loading: false }) }
  },

  addLiability: async (userId, l) => {
    const { adapter } = get()
    if (!adapter) return
    const id = generateId()
    await adapter.db.insert('liabilities').values({ id, user_id: userId, name: l.name, type: l.type, amount: roundMoney(l.amount), notes: l.notes, created_at: isoNow() })
    await get().fetchAll(userId)
  },

  editLiability: async (l) => {
    const { adapter } = get()
    if (!adapter) return
    const amount = roundMoney(l.amount)
    await adapter.db.update('liabilities').set({ name: l.name, type: l.type, amount, notes: l.notes }).where(eq('id', l.id))
    set((s) => ({ liabilities: s.liabilities.map((x) => (x.id === l.id ? { ...x, name: l.name, type: l.type as Liability['type'], amount, notes: l.notes } : x)) }))
  },

  deleteLiability: async (id) => {
    const { adapter } = get()
    if (!adapter) return
    await adapter.db.delete('liabilities').where(eq('id', id))
    set((s) => ({ liabilities: s.liabilities.filter((x) => x.id !== id) }))
  },
}))

function formatLiability(l: any): Liability {
  return { id: l.id, name: l.name, type: l.type, amount: l.amount ?? 0, notes: l.notes ?? '', createdAt: l.created_at }
}
