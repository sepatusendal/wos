import { create } from 'zustand'
import type { Subscription } from '@wos/shared'
import { generateId, isoNow } from '@wos/shared'
import type { DatabaseAdapter } from '@wos/db'
import { eq, desc } from '@wos/db'
import { useFinanceStore } from './financeStore'

/**
 * Map a subscription category onto one of the app's expense categories
 * (see `EXPENSE_CATS` in FinancePage). Entertainment-ish subscriptions land in
 * "Hiburan", everything utility/tooling-ish in "Tagihan".
 */
const SUBSCRIPTION_EXPENSE_CATEGORY: Record<string, string> = {
  streaming: 'Hiburan',
  music: 'Hiburan',
  gaming: 'Hiburan',
  news: 'Hiburan',
  fitness: 'Kesehatan',
  cloud: 'Tagihan',
  hosting: 'Tagihan',
  software: 'Tagihan',
  other: 'Tagihan',
}

/** Preset icons for common subscription categories */
export const SUBSCRIPTION_ICONS: Record<string, string> = {
  streaming: '🎬',
  music: '🎵',
  cloud: '☁️',
  productivity: '💼',
  gaming: '🎮',
  fitness: '💪',
  food: '🍔',
  transport: '🚗',
  education: '📚',
  finance: '💳',
  hosting: '🖥️',
  vpn: '🔒',
  newsletter: '📧',
  shopping: '🛒',
  health: '🏥',
  other: '📦',
}

/** Suggest an icon based on subscription name and category */
export function suggestSubscriptionIcon(name: string, category: string): string {
  const lower = `${name} ${category}`.toLowerCase()
  const patterns: [RegExp, string][] = [
    [/spotify|apple music|tidal|deezer|yt music/i, '🎵'],
    [/netflix|disney|hbo|prime video|hulu|youtube/i, '🎬'],
    [/icloud|dropbox|google (one|drive)|onedrive/i, '☁️'],
    [/notion|linear|figma|slack|discord|zoom|teams/i, '💼'],
    [/steam|nintendo|playstation|xbox|epic/i, '🎮'],
    [/gym|strava|peloton|fitbit|whoop/i, '💪'],
    [/gojek|grab|uber|uber eat|foodpanda/i, '🚗'],
    [/vps|vpn|digitalocean|aws|vercel|netlify|heroku/i, '🖥️'],
    [/coursera|udemy|skillshare|duolingo|brilliant/i, '📚'],
    [/insurance|loan|credit/i, '💳'],
    [/nordvpn|expressvpn|surfshark|proton/i, '🔒'],
    [/substack|medium|bloomberg|wsj/i, '📧'],
    [/shopee|tokopedia|amazon prime|shopify/i, '🛒'],
  ]
  for (const [regex, icon] of patterns) {
    if (regex.test(lower)) return icon
  }
  return SUBSCRIPTION_ICONS[category.toLowerCase()] ?? '📦'
}

interface SubscriptionState {
  adapter: DatabaseAdapter | null
  subscriptions: Subscription[]
  loading: boolean
  processingSubscriptions: boolean
  setAdapter: (adapter: DatabaseAdapter) => void
  fetchAll: (userId: string) => Promise<void>
  addSubscription: (userId: string, s: Omit<Subscription, 'id' | 'createdAt'>) => Promise<void>
  editSubscription: (s: { id: string; name: string; category: string; amount: number; frequency: string; nextBilling: string; icon: string; active: boolean; notes: string }) => Promise<void>
  deleteSubscription: (id: string) => Promise<void>
  toggleActive: (id: string, active: boolean) => Promise<void>
  /** Turn every due billing of an active subscription into a real expense transaction, advancing `nextBilling`. Returns the names it processed. */
  processSubscriptions: (userId: string) => Promise<string[]>
  getMonthlyTotal: () => number
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  adapter: null,
  subscriptions: [],
  loading: false,
  processingSubscriptions: false,

  setAdapter: (adapter) => set({ adapter }),

  fetchAll: async (userId) => {
    const { adapter } = get()
    if (!adapter) return
    set({ loading: true })
    try {
      const data = await adapter.db
        .select()
        .from('subscriptions')
        .where(eq('user_id', userId))
        .orderBy(desc('created_at'))
        .all()
      set({ subscriptions: data.map(formatSubscription), loading: false })
    } catch (err) {
      console.error("[subscriptionStore] fetchAll failed:", err)
      set({ loading: false })
    }
  },

  addSubscription: async (userId, s) => {
    const { adapter } = get()
    if (!adapter) return
    const id = generateId()
    const now = isoNow()
    await adapter.db.insert('subscriptions').values({
      id,
      user_id: userId,
      name: s.name,
      category: s.category,
      amount: s.amount,
      frequency: s.frequency,
      next_billing: s.nextBilling,
      icon: s.icon,
      active: s.active ? 1 : 0,
      notes: s.notes,
      created_at: now,
    })
    await get().fetchAll(userId)
  },

  editSubscription: async (s) => {
    const { adapter } = get()
    if (!adapter) return
    await adapter.db
      .update('subscriptions')
      .set({
        name: s.name,
        category: s.category,
        amount: s.amount,
        frequency: s.frequency,
        next_billing: s.nextBilling,
        icon: s.icon,
        active: s.active ? 1 : 0,
        notes: s.notes,
      })
      .where(eq('id', s.id))
    set((st) => ({
      subscriptions: st.subscriptions.map((x) =>
        x.id === s.id ? ({ ...x, ...s, active: s.active } as Subscription) : x,
      ),
    }))
  },

  deleteSubscription: async (id) => {
    const { adapter } = get()
    if (!adapter) return
    await adapter.db.delete('subscriptions').where(eq('id', id))
    set((s) => ({ subscriptions: s.subscriptions.filter((x) => x.id !== id) }))
  },

  toggleActive: async (id, active) => {
    const { adapter } = get()
    if (!adapter) return
    await adapter.db.update('subscriptions').set({ active: active ? 1 : 0 }).where(eq('id', id))
    set((s) => ({
      subscriptions: s.subscriptions.map((x) =>
        x.id === id ? { ...x, active } as Subscription : x,
      ),
    }))
  },

  // Mirrors financeStore's `processRecurring`: same reentrancy guard, same
  // safety cap on how many billings a single item may catch up on, same
  // "advance the stored date, then refetch once at the end" shape.
  processSubscriptions: async (userId) => {
    const { adapter, subscriptions, processingSubscriptions } = get()
    if (!adapter || processingSubscriptions) return []
    set({ processingSubscriptions: true })
    try {
      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const processed: string[] = []
      const MAX_SUBSCRIPTION_INSERT = 60 // safety cap: at most ~1 year of weekly billings per subscription
      for (const s of subscriptions) {
        if (!s.active) continue
        const category = SUBSCRIPTION_EXPENSE_CATEGORY[s.category] ?? 'Tagihan'
        let currentNextBilling = s.nextBilling
        let insertedCount = 0
        while (currentNextBilling <= today && insertedCount < MAX_SUBSCRIPTION_INSERT) {
          const txId = generateId()
          await adapter.db.insert('transactions').values({
            id: txId, user_id: userId, type: 'expense', amount: s.amount, category,
            description: `[Subscription] ${s.name}`, date: currentNextBilling, account_id: null, flexibility: 'fixed', created_at: isoNow(),
          })
          currentNextBilling = advanceBillingDate(currentNextBilling, s.frequency)
          insertedCount++
        }
        if (insertedCount > 0) {
          await adapter.db.update('subscriptions').set({ next_billing: currentNextBilling }).where(eq('id', s.id))
          set((st) => ({ subscriptions: st.subscriptions.map((x) => (x.id === s.id ? { ...x, nextBilling: currentNextBilling } : x)) }))
          processed.push(s.name)
        }
      }
      if (processed.length > 0) {
        // Refetch both sides once, so Finance/Dashboard see the new
        // transactions and this store sees the advanced billing dates.
        await useFinanceStore.getState().fetchAll(userId)
        await get().fetchAll(userId)
      }
      return processed
    } catch (err) {
      console.error('[subscriptionStore] processSubscriptions failed:', err)
      return []
    } finally {
      set({ processingSubscriptions: false })
    }
  },

  getMonthlyTotal: () => {
    const { subscriptions } = get()
    return subscriptions
      .filter((s) => s.active)
      .reduce((total, s) => {
        switch (s.frequency) {
          case 'weekly':
            return total + s.amount * (52 / 12)
          case 'yearly':
            return total + s.amount / 12
          case 'monthly':
          default:
            return total + s.amount
        }
      }, 0)
  },
}))

/** Same day/week/month/year math as financeStore's `advanceDate`, minus `daily` (subscriptions only support weekly/monthly/yearly). */
function advanceBillingDate(dateStr: string, frequency: string): string {
  const p = dateStr.split('-')
  const y = Number(p[0])
  const m = Number(p[1])
  const d = Number(p[2])

  switch (frequency) {
    case 'weekly': {
      const date = new Date(y, m - 1, d + 7)
      return fmtDate(date)
    }
    case 'yearly': {
      const date = new Date(y + 1, m - 1, d)
      // Handle leap year: Feb 29 → Feb 28 in non-leap years
      if (m === 2 && d === 29 && date.getMonth() !== 1) {
        date.setDate(28)
      }
      return fmtDate(date)
    }
    case 'monthly':
    default: {
      const date = new Date(y, m - 1, d)
      date.setMonth(date.getMonth() + 1)
      if (date.getDate() !== d) date.setDate(0)
      return fmtDate(date)
    }
  }
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatSubscription(a: any): Subscription {
  return {
    id: a.id,
    name: a.name,
    category: a.category,
    amount: a.amount,
    frequency: a.frequency,
    nextBilling: a.next_billing,
    icon: a.icon,
    active: !!a.active,
    notes: a.notes ?? '',
    createdAt: a.created_at,
  }
}
