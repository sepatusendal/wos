import { create } from 'zustand'
import type { Asset } from '@wos/shared'
import { generateId, isoNow } from '@wos/shared'
import type { DatabaseAdapter } from '@wos/db'
import { eq, desc } from '@wos/db'

interface PortfolioStats {
  totalInvested: number
  totalCurrent: number
  totalPnL: number
  pnlPercent: number
  assetsWithPnL: Asset[]
}

interface WealthState {
  adapter: DatabaseAdapter | null
  assets: Asset[]
  loading: boolean
  setAdapter: (adapter: DatabaseAdapter) => void
  fetchAll: (userId: string) => Promise<void>
  addAsset: (userId: string, a: Omit<Asset, 'id' | 'lastUpdated' | 'createdAt'>) => Promise<void>
  editAsset: (a: { id: string; name: string; type: string; quantity: number; unitPrice: number; notes: string; buyPrice?: number | null; buyDate?: string | null }) => Promise<void>
  deleteAsset: (id: string) => Promise<void>
  getPortfolioStats: () => PortfolioStats
}

export const useWealthStore = create<WealthState>((set, get) => ({
  adapter: null,
  assets: [],
  loading: false,

  setAdapter: (adapter) => set({ adapter }),

  fetchAll: async (userId) => {
    const { adapter } = get()
    if (!adapter) return
    set({ loading: true })
    try {
      const data = await adapter.db.select().from('assets').where(eq('user_id', userId)).orderBy(desc('created_at')).all()
      set({ assets: data.map(formatAsset), loading: false })
    } catch { set({ loading: false }) }
  },

  addAsset: async (userId, a) => {
    const { adapter } = get()
    if (!adapter) return
    const id = generateId()
    const now = isoNow()
    await adapter.db.insert('assets').values({
      id, user_id: userId, name: a.name, type: a.type, quantity: a.quantity,
      unit_price: a.unitPrice, buy_price: a.buyPrice ?? null, buy_date: a.buyDate ?? null,
      notes: a.notes, last_updated: now, created_at: now,
    })
    await get().fetchAll(userId)
  },

  editAsset: async (a) => {
    const { adapter } = get()
    if (!adapter) return
    const setData: Record<string, unknown> = { name: a.name, type: a.type, quantity: a.quantity, unit_price: a.unitPrice, notes: a.notes, last_updated: isoNow() }
    if (a.buyPrice !== undefined) setData.buy_price = a.buyPrice
    if (a.buyDate !== undefined) setData.buy_date = a.buyDate
    await adapter.db.update('assets').set(setData).where(eq('id', a.id))
    set((s) => ({ assets: s.assets.map((x) => (x.id === a.id ? { ...x, ...a, lastUpdated: isoNow() } as Asset : x)) }))
  },

  deleteAsset: async (id) => {
    const { adapter } = get()
    if (!adapter) return
    await adapter.db.delete('assets').where(eq('id', id))
    set((s) => ({ assets: s.assets.filter((x) => x.id !== id) }))
  },

  getPortfolioStats: () => {
    const { assets } = get()
    const totalInvested = assets.reduce((s, a) => s + (a.buyPrice ?? 0) * a.quantity, 0)
    const totalCurrent = assets.reduce((s, a) => s + a.quantity * a.unitPrice, 0)
    const totalPnL = totalCurrent - totalInvested
    const pnlPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0
    const assetsWithPnL = assets.filter((a) => a.buyPrice != null)
    return { totalInvested, totalCurrent, totalPnL, pnlPercent, assetsWithPnL }
  },
}))

function formatAsset(a: any): Asset {
  return {
    id: a.id, name: a.name, type: a.type, quantity: a.quantity,
    unitPrice: a.unit_price ?? 0, buyPrice: a.buy_price ?? null, buyDate: a.buy_date ?? null,
    notes: a.notes ?? '', lastUpdated: a.last_updated, createdAt: a.created_at,
  }
}
