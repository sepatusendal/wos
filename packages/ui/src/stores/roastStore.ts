import { create } from 'zustand'

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
    const streamingKeywords = ['netflix', 'disney', 'hbo', 'spotify', 'youtube', 'vidio', 'prime', 'apple tv', 'apple music', 'iTunes']
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
  // No transactions today
  (_income: number, _foodSpent: number, tx: any[], _budgets: any[], todayCount: number) => {
    if (todayCount === 0 && tx.length > 0) return `Hari ini gak ada transaksi. Apa lo puasa? Atau... gak punya uang? 😱`
    return null
  },
  // Budget overspend
  (_income: number, _foodSpent: number, _tx: any[], budgets: any[]) => {
    for (const b of budgets) {
      if (b.pct >= 100) {
        return `Budget ${b.category} overspend ${b.pct}%. Congratulations, you played yourself. 🎮`
      }
    }
    return null
  },
]

export const useRoastStore = create<RoastState>((_set, get) => ({
  roastMode: loadRoastMode(),

  toggleRoast: () => {
    const next = !get().roastMode
    try {
      localStorage.setItem(STORAGE_KEY, String(next))
    } catch {
      // localStorage unavailable
    }
    // Use setState directly on the store
    useRoastStore.setState({ roastMode: next })
  },

  generateRoast: (transactions, budgets) => {
    const income = transactions
      .filter((t: any) => t.type === 'income')
      .reduce((s: number, t: any) => s + t.amount, 0)

    const foodSpent = transactions
      .filter((t: any) => t.type === 'expense' && t.category === 'Makan')
      .reduce((s: number, t: any) => s + t.amount, 0)

    const today = new Date().toISOString().slice(0, 10)
    const todayCount = transactions.filter((t: any) => t.date === today).length

    // Shuffle templates and try each one
    const shuffled = [...ROAST_TEMPLATES].sort(() => Math.random() - 0.5)
    for (const template of shuffled) {
      const result = template(income, foodSpent, transactions, budgets, todayCount)
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
    return fallbacks[Math.floor(Math.random() * fallbacks.length)]!
  },
}))
