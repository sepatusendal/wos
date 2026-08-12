import { create } from 'zustand'
import { todayStr } from '@wos/shared'

const STORAGE_KEY = 'wos_roast_mode'

interface RoastState {
  roastMode: boolean
  toggleRoast: () => void
  generateRoast: (transactions: any[], budgets: any[]) => string
}

function loadRoastMode(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

const ROAST_TEMPLATES = [
  // Food > 30% income
  (income: number, foodSpent: number) => {
    const pct = income > 0 ? Math.round((foodSpent / income) * 100) : 0
    if (pct > 30) return `Makan ${pct}% dari income? Lo manusia atau food blogger profesional? 🍔`
    return null
  },
  // Multiple streaming subs
  (_income: number, _foodSpent: number, tx: any[]) => {
    const descs = tx.map((t) => t.description?.toLowerCase() || '').join(' ')
    // Keywords must be lowercase — descs is already lowercased above.
    const streamingKeywords = ['netflix', 'disney', 'hbo', 'spotify', 'youtube', 'vidio', 'prime', 'apple tv', 'apple music', 'itunes']
    const found = streamingKeywords.filter((k) => descs.includes(k))
    if (found.length >= 3) return `Netflix + Disney+ + HBO... lo bikin multiplex sendiri di rumah? 🎬`
    if (found.length >= 2) return `Langganan ${found.length} streaming service? Prioritaskan hiburan daripada masa depan ya.. 📺`
    return null
  },
  // Shopping high
  (_income: number, _foodSpent: number, tx: any[]) => {
    const shoppingTx = tx.filter((t) => t.type === 'expense' && (t.category === 'Belanja' || t.category === 'Hiburan'))
    const total = shoppingTx.reduce((s: number, t: any) => s + t.amount, 0)
    if (total > 1000000) return `Belanja Rp${total.toLocaleString('id-ID')} bulan ini. Apa lo beli pulau pribadi? 🏝️`
    if (total > 500000) return `Belanja lumayan juga ya? Dompet lo pasti nangis. 🛍️`
    return null
  },
  // Savings low
  (income: number, _foodSpent: number, tx: any[]) => {
    const expenseTx = tx.filter((t) => t.type === 'expense')
    const totalExp = expenseTx.reduce((s: number, t: any) => s + t.amount, 0)
    const savingsPct = income > 0 ? Math.round(((income - totalExp) / income) * 100) : 0
    if (savingsPct < 5 && income > 0) return `Tabungan lo ${savingsPct}%. Bahkan celengan ayam lebih rajin dari lo. 🐔`
    if (savingsPct < 0) return `Lo lebih banyak ngeluarin duit daripada pemasukan. Financial suicide detected. ☠️`
    return null
  },
  // Great savings
  (income: number, _foodSpent: number, tx: any[]) => {
    const expenseTx = tx.filter((t) => t.type === 'expense')
    const totalExp = expenseTx.reduce((s: number, t: any) => s + t.amount, 0)
    const savingsPct = income > 0 ? Math.round(((income - totalExp) / income) * 100) : 0
    if (savingsPct >= 50 && income > 0) return `Saving rate ${savingsPct}%? Okay, Warren Buffet versi lokal. 📈`
    if (savingsPct >= 30 && income > 0) return `Saving ${savingsPct}% — mulai ketara nih jiwa pelitnya. Good job! 💰`
    return null
  },
  // No transactions today — only fires in the evening, so an 8am user isn't
  // scolded for not having spent money yet today.
  (_income: number, _foodSpent: number, tx: any[], _budgets: any[], todayCount: number) => {
    if (new Date().getHours() < 18) return null
    if (todayCount === 0 && tx.length > 0) return `Hari ini gak ada transaksi. Apa lo puasa? Atau... gak punya uang? 😱`
    return null
  },
  // Budget overspend — b.pct is the UNCLAMPED percentage from budgetVsActual
  // (barPct is the clamped one), so a 300% overspend actually says 300%.
  (_income: number, _foodSpent: number, _tx: any[], budgets: any[]) => {
    for (const b of budgets) {
      if (b.pct >= 100) {
        return `Budget ${b.category} overspend ${b.pct}%. Congratulations, you played yourself. 🎮`
      }
    }
    return null
  },
]

// Same hashing + LCG shuffle used by levelStore's daily quest pick, so "Roast
// of the Day" is stable for the whole day and only rolls over at midnight.
function hashStr(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff
  }
  return hash >>> 0
}

function seededOrder(seedStr: string, length: number): number[] {
  const indices = Array.from({ length }, (_, i) => i)
  let s = hashStr(seedStr)
  for (let i = indices.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const j = s % (i + 1)
    ;[indices[i], indices[j]] = [indices[j]!, indices[i]!]
  }
  return indices
}

export const useRoastStore = create<RoastState>((set, get) => ({
  roastMode: loadRoastMode(),

  toggleRoast: () => {
    const next = !get().roastMode
    try {
      localStorage.setItem(STORAGE_KEY, String(next))
    } catch {
      // localStorage unavailable
    }
    set({ roastMode: next })
  },

  generateRoast: (transactions, budgets) => {
    const today = todayStr()
    const thisMonthKey = today.slice(0, 7)

    // The caller passes all-time history, but the roast copy talks about
    // "bulan ini" — so scope it here. Transfers between your own accounts
    // aren't real spending either.
    const monthTx = transactions.filter(
      (t: any) => typeof t.date === 'string' && t.date.startsWith(thisMonthKey) && t.category !== 'Transfer',
    )

    const income = monthTx
      .filter((t: any) => t.type === 'income')
      .reduce((s: number, t: any) => s + t.amount, 0)

    const foodSpent = monthTx
      .filter((t: any) => t.type === 'expense' && t.category === 'Makan')
      .reduce((s: number, t: any) => s + t.amount, 0)

    const todayCount = monthTx.filter((t: any) => t.date === today).length

    // Deterministic "Roast of the Day": same order all day, new one at midnight.
    for (const i of seededOrder(today, ROAST_TEMPLATES.length)) {
      const result = ROAST_TEMPLATES[i]!(income, foodSpent, monthTx, budgets, todayCount)
      if (result) return result
    }

    // Fallback roasts
    const fallbacks = [
      'Lo pikir duit tumbuh di pohon? 🌳',
      'Financial literacy is not a suggestion, it is a survival skill. 📚',
      'Baca lagi catatan keuangan lo, terus nangis. 😭',
      'Spending habits lo... interesting. Very interesting. 🤔',
      'Jangan lupa nabung ya, besok udah tua. 👴',
    ]
    return fallbacks[hashStr(today) % fallbacks.length]!
  },
}))
