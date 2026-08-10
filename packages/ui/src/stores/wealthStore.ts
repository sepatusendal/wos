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

export interface RefreshPricesResult {
  updated: number
  failed: number
}

interface WealthState {
  adapter: DatabaseAdapter | null
  assets: Asset[]
  loading: boolean
  refreshingPrices: boolean
  setAdapter: (adapter: DatabaseAdapter) => void
  fetchAll: (userId: string) => Promise<void>
  addAsset: (userId: string, a: Omit<Asset, 'id' | 'lastUpdated' | 'createdAt'>) => Promise<void>
  editAsset: (a: { id: string; name: string; type: string; ticker?: string | null; quantity: number; unitPrice: number; notes: string; buyPrice?: number | null; buyDate?: string | null }) => Promise<void>
  deleteAsset: (id: string) => Promise<void>
  refreshPrices: (userId: string) => Promise<RefreshPricesResult>
  getPortfolioStats: () => PortfolioStats
}

export const useWealthStore = create<WealthState>((set, get) => ({
  adapter: null,
  assets: [],
  loading: false,
  refreshingPrices: false,

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
      id, user_id: userId, name: a.name, type: a.type, ticker: (a as any).ticker ?? null,
      quantity: a.quantity, unit_price: a.unitPrice,
      buy_price: a.buyPrice ?? null, buy_date: a.buyDate ?? null,
      notes: a.notes, last_updated: now, created_at: now,
    })
    await get().fetchAll(userId)
  },

  editAsset: async (a) => {
    const { adapter } = get()
    if (!adapter) return
    const setData: Record<string, unknown> = { name: a.name, type: a.type, quantity: a.quantity, unit_price: a.unitPrice, notes: a.notes, last_updated: isoNow() }
    if (a.ticker !== undefined) setData.ticker = a.ticker
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

  refreshPrices: async (userId) => {
    const { adapter, assets } = get()
    let updated = 0
    let failed = 0

    const tickered = assets.filter((a) => a.ticker && (a.type === 'stock' || a.type === 'crypto'))
    if (tickered.length === 0) return { updated, failed }

    set({ refreshingPrices: true })

    try {
      const { refreshAssetPrices } = await import('@wos/shared')
      const prices = await refreshAssetPrices(
        tickered.map((a) => ({ id: a.id, ticker: a.ticker!, type: a.type }))
      )

      const now = isoNow()
      for (const a of tickered) {
        const price = prices.get(a.id)
        if (price != null) {
          try {
            await adapter!.db.update('assets').set({ unit_price: price, last_updated: now }).where(eq('id', a.id))
            updated++
          } catch {
            failed++
          }
        } else {
          failed++
        }
      }

      if (updated > 0) {
        await get().fetchAll(userId)
      }
    } catch {
      failed = tickered.length
    }

    set({ refreshingPrices: false })
    return { updated, failed }
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
    id: a.id, name: a.name, type: a.type, ticker: a.ticker ?? null,
    quantity: a.quantity, unitPrice: a.unit_price ?? 0,
    buyPrice: a.buy_price ?? null, buyDate: a.buy_date ?? null,
    notes: a.notes ?? '', lastUpdated: a.last_updated, createdAt: a.created_at,
  }
}
