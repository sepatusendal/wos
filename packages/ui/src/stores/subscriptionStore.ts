import { create } from 'zustand'
import type { Subscription } from '@wos/shared'
import { generateId, isoNow } from '@wos/shared'
import type { DatabaseAdapter } from '@wos/db'
import { eq, desc } from '@wos/db'

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
  setAdapter: (adapter: DatabaseAdapter) => void
  fetchAll: (userId: string) => Promise<void>
  addSubscription: (userId: string, s: Omit<Subscription, 'id' | 'createdAt'>) => Promise<void>
  editSubscription: (s: { id: string; name: string; category: string; amount: number; frequency: string; nextBilling: string; icon: string; active: boolean; notes: string }) => Promise<void>
  deleteSubscription: (id: string) => Promise<void>
  toggleActive: (id: string, active: boolean) => Promise<void>
  getMonthlyTotal: () => number
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  adapter: null,
  subscriptions: [],
  loading: false,

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
    } catch {
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
    await adapter.db.update('subscriptions').set({ active }).where(eq('id', id))
    set((s) => ({
      subscriptions: s.subscriptions.map((x) =>
        x.id === id ? { ...x, active } as Subscription : x,
      ),
    }))
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
