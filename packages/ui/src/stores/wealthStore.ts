import { create } from 'zustand'
import type { Asset } from '@wos/shared'
import { generateId, isoNow, fetchStockPrice, fetchCryptoPrice, roundMoney } from '@wos/shared'
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
  refreshingPrices: boolean
  setAdapter: (adapter: DatabaseAdapter) => void
  fetchAll: (userId: string) => Promise<void>
  addAsset: (userId: string, a: Omit<Asset, 'id' | 'lastUpdated' | 'createdAt'>) => Promise<void>
  editAsset: (a: { id: string; name: string; type: string; quantity: number; unitPrice: number; notes: string; buyPrice?: number | null; buyDate?: string | null; ticker?: string | null }) => Promise<void>
  deleteAsset: (id: string) => Promise<void>
  getPortfolioStats: () => PortfolioStats
  /** Refreshes unitPrice for every stock/crypto asset that has a ticker, via market.ts (Yahoo Finance / CoinPaprika, 24h cache). Manual holdings without a ticker are left untouched. */
  refreshPrices: () => Promise<{ updated: number; failed: number }>
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
    } catch (err) { console.error("[wealthStore] fetchAll failed:", err); set({ loading: false }) }
  },

  addAsset: async (userId, a) => {
    const { adapter } = get()
    if (!adapter) return
    const id = generateId()
    const now = isoNow()
    await adapter.db.insert('assets').values({
      id, user_id: userId, name: a.name, type: a.type, quantity: a.quantity,
      unit_price: a.unitPrice, buy_price: a.buyPrice ?? null, buy_date: a.buyDate ?? null,
      ticker: a.ticker ?? null, notes: a.notes, last_updated: now, created_at: now,
    })
    await get().fetchAll(userId)
  },

  editAsset: async (a) => {
    const { adapter } = get()
    if (!adapter) return
    const setData: Record<string, unknown> = { name: a.name, type: a.type, quantity: a.quantity, unit_price: a.unitPrice, notes: a.notes, last_updated: isoNow() }
    if (a.buyPrice !== undefined) setData.buy_price = a.buyPrice
    if (a.buyDate !== undefined) setData.buy_date = a.buyDate
    if (a.ticker !== undefined) setData.ticker = a.ticker
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

  refreshPrices: async () => {
    const { adapter, assets } = get()
    if (!adapter) return { updated: 0, failed: 0 }
    const withTicker = assets.filter((a) => a.ticker && (a.type === 'stock' || a.type === 'crypto'))
    if (withTicker.length === 0) return { updated: 0, failed: 0 }
    set({ refreshingPrices: true })
    let updated = 0
    let failed = 0
    try {
      for (let i = 0; i < withTicker.length; i++) {
        const asset = withTicker[i]!
        if (i > 0) await new Promise((r) => setTimeout(r, 200)) // rate limit, matches market.ts convention
        try {
          const quote = asset.type === 'crypto' ? await fetchCryptoPrice(asset.ticker!) : await fetchStockPrice(asset.ticker!)
          if (quote && Number.isFinite(quote.price) && quote.price > 0) {
            const newPrice = roundMoney(quote.price)
            await adapter.db.update('assets').set({ unit_price: newPrice, last_updated: isoNow() }).where(eq('id', asset.id))
            set((s) => ({ assets: s.assets.map((x) => (x.id === asset.id ? { ...x, unitPrice: newPrice, lastUpdated: isoNow() } : x)) }))
            updated++
          } else {
            failed++
          }
        } catch {
          failed++
        }
      }
    } finally {
      set({ refreshingPrices: false })
    }
    return { updated, failed }
  },
}))

function formatAsset(a: any): Asset {
  return {
    id: a.id, name: a.name, type: a.type, quantity: a.quantity,
    unitPrice: a.unit_price ?? 0, buyPrice: a.buy_price ?? null, buyDate: a.buy_date ?? null,
    ticker: a.ticker ?? null, notes: a.notes ?? '', lastUpdated: a.last_updated, createdAt: a.created_at,
  }
}
