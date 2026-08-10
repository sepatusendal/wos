import { create } from 'zustand'
import type { Transaction, Budget, Account, SavingsGoal, RecurringTransaction } from '@wos/shared'
import { generateId, isoNow, todayStr } from '@wos/shared'
import type { DatabaseAdapter } from '@wos/db'
import { eq, desc } from '@wos/db'

interface FinanceState {
  adapter: DatabaseAdapter | null
  transactions: Transaction[]
  budgets: Budget[]
  accounts: Account[]
  savingsGoals: SavingsGoal[]
  recurring: RecurringTransaction[]
  loading: boolean
  budgetRollover: Record<string, number>
  setAdapter: (adapter: DatabaseAdapter) => void
  fetchAll: (userId: string) => Promise<void>
  addTransaction: (userId: string, t: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>
  editTransaction: (t: { id: string; type: string; amount: number; category: string; description: string; date: string; accountId: string | null; flexibility?: string }) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>
  addBudget: (userId: string, b: Omit<Budget, 'id'>) => Promise<void>
  deleteBudget: (id: string) => Promise<void>
  addAccount: (userId: string, a: { name: string; type: string; balance: number }) => Promise<void>
  editAccount: (a: { id: string; name: string; type: string; balance: number }) => Promise<void>
  deleteAccount: (id: string) => Promise<void>
  addSavingsGoal: (userId: string, g: { name: string; targetAmount: number; savedAmount: number; deadline: string | null }) => Promise<void>
  editSavingsGoal: (g: { id: string; name: string; targetAmount: number; savedAmount: number; deadline: string | null }) => Promise<void>
  deleteSavingsGoal: (id: string) => Promise<void>
  addRecurring: (userId: string, r: Omit<RecurringTransaction, 'id' | 'createdAt'>) => Promise<void>
  editRecurring: (r: { id: string; name: string; type: string; amount: number; category: string; frequency: string; nextDate: string; active: boolean }) => Promise<void>
  toggleRecurring: (id: string, active: boolean) => Promise<void>
  deleteRecurring: (id: string) => Promise<void>
  transferBetweenAccounts: (userId: string, fromAccountId: string, toAccountId: string, amount: number, description: string) => Promise<void>
  processRecurring: (userId: string) => Promise<string[]>
  computeBudgetRollover: () => void
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  adapter: null,
  transactions: [],
  budgets: [],
  accounts: [],
  savingsGoals: [],
  recurring: [],
  loading: false,
  budgetRollover: {},

  setAdapter: (adapter) => set({ adapter }),

  fetchAll: async (userId) => {
    const { adapter } = get()
    if (!adapter) return
    set({ loading: true })
    try {
      const [txData, bData, acctData, goalData, recData] = await Promise.all([
        adapter.db.select().from('transactions').where(eq('user_id', userId)).orderBy(desc('date')).all(),
        adapter.db.select().from('budgets').where(eq('user_id', userId)).all(),
        adapter.db.select().from('accounts').where(eq('user_id', userId)).orderBy(desc('created_at')).all(),
        adapter.db.select().from('savings_goals').where(eq('user_id', userId)).orderBy(desc('created_at')).all(),
        adapter.db.select().from('recurring_transactions').where(eq('user_id', userId)).orderBy(desc('created_at')).all(),
      ])
      set({
        transactions: txData.map(formatTx),
        budgets: bData.map(formatBudget),
        accounts: acctData.map(formatAccount),
        savingsGoals: goalData.map(formatGoal),
        recurring: recData.map(formatRecurring),
        loading: false,
      })
      // Compute rollover after data is loaded
      get().computeBudgetRollover()
    } catch (err) {
      console.error('[financeStore] fetchAll failed:', err)
      set({ loading: false })
    }
  },

  addTransaction: async (userId, t) => {
    const { adapter } = get()
    if (!adapter) return
    const id = generateId()
    await adapter.db.insert('transactions').values({ id, user_id: userId, type: t.type, amount: t.amount, category: t.category, description: t.description, date: t.date, account_id: t.accountId ?? null, flexibility: (t as any).flexibility ?? 'flexible', created_at: isoNow() })

    if (t.accountId) {
      const delta = t.type === 'income' ? t.amount : -t.amount
      const acct = get().accounts.find((a) => a.id === t.accountId)
      if (acct) {
        const newBal = acct.balance + delta
        await adapter.db.update('accounts').set({ balance: newBal }).where(eq('id', t.accountId))
        set((s) => ({ accounts: s.accounts.map((a) => a.id === t.accountId ? { ...a, balance: newBal } : a) }))
      }
    }

    await get().fetchAll(userId)
  },

  editTransaction: async (t) => {
    const { adapter, transactions, accounts } = get()
    if (!adapter) return

    const oldTx = transactions.find((x) => x.id === t.id)

    await adapter.db.update('transactions').set({ type: t.type, amount: t.amount, category: t.category, description: t.description, date: t.date, account_id: t.accountId, flexibility: t.flexibility ?? 'flexible' }).where(eq('id', t.id))

    if (oldTx) {
      const reverseOld = oldTx.accountId ? (oldTx.type === 'income' ? -oldTx.amount : oldTx.amount) : 0
      const applyNew = t.accountId ? (t.type === 'income' ? t.amount : -t.amount) : 0

      const affectedIds = new Set<string>()
      if (oldTx.accountId) affectedIds.add(oldTx.accountId)
      if (t.accountId) affectedIds.add(t.accountId)

      for (const acctId of affectedIds) {
        const acct = accounts.find((a) => a.id === acctId)
        if (!acct) continue
        let delta = 0
        if (acctId === oldTx.accountId) delta += reverseOld
        if (acctId === t.accountId) delta += applyNew
        if (delta !== 0) {
          const newBal = acct.balance + delta
          await adapter.db.update('accounts').set({ balance: newBal }).where(eq('id', acctId))
          set((s) => ({ accounts: s.accounts.map((a) => a.id === acctId ? { ...a, balance: newBal } : a) }))
        }
      }
    }

    set((s) => ({
      transactions: s.transactions.map((x) =>
        x.id === t.id ? { ...x, type: t.type as Transaction['type'], amount: t.amount, category: t.category, description: t.description, date: t.date, accountId: t.accountId, flexibility: (t.flexibility ?? x.flexibility ?? 'flexible') as Transaction['flexibility'] } : x
      ),
    }))
  },

  deleteTransaction: async (id) => {
    const { adapter, transactions } = get()
    if (!adapter) return

    const tx = transactions.find((x) => x.id === id)
    if (tx?.accountId) {
      const delta = tx.type === 'income' ? -tx.amount : tx.amount
      const acct = get().accounts.find((a) => a.id === tx.accountId)
      if (acct) {
        const newBal = acct.balance + delta
        await adapter.db.update('accounts').set({ balance: newBal }).where(eq('id', tx.accountId))
        set((s) => ({ accounts: s.accounts.map((a) => a.id === tx.accountId ? { ...a, balance: newBal } : a) }))
      }
    }

    await adapter.db.delete('transactions').where(eq('id', id))
    set((s) => ({ transactions: s.transactions.filter((x) => x.id !== id) }))
  },

  addBudget: async (userId, b) => {
    const { adapter } = get()
    if (!adapter) return
    const id = generateId()
    await adapter.db.insert('budgets').values({ id, user_id: userId, category: b.category, limit: b.limit })
    await get().fetchAll(userId)
  },

  deleteBudget: async (id) => {
    const { adapter } = get()
    if (!adapter) return
    await adapter.db.delete('budgets').where(eq('id', id))
    set((s) => ({ budgets: s.budgets.filter((x) => x.id !== id) }))
  },

  addAccount: async (userId, a) => {
    const { adapter } = get()
    if (!adapter) return
    const id = generateId()
    await adapter.db.insert('accounts').values({ id, user_id: userId, name: a.name, type: a.type, balance: a.balance, created_at: isoNow() })
    await get().fetchAll(userId)
  },

  editAccount: async (a) => {
    const { adapter } = get()
    if (!adapter) return
    await adapter.db.update('accounts').set({ name: a.name, type: a.type, balance: a.balance }).where(eq('id', a.id))
    set((s) => ({ accounts: s.accounts.map((x) => (x.id === a.id ? { ...x, name: a.name, type: a.type as Account['type'], balance: a.balance } : x)) }))
  },

  deleteAccount: async (id) => {
    const { adapter } = get()
    if (!adapter) return
    await adapter.db.delete('accounts').where(eq('id', id))
    set((s) => ({ accounts: s.accounts.filter((x) => x.id !== id) }))
  },

  addSavingsGoal: async (userId, g) => {
    const { adapter } = get()
    if (!adapter) return
    const id = generateId()
    await adapter.db.insert('savings_goals').values({ id, user_id: userId, name: g.name, target_amount: g.targetAmount, saved_amount: g.savedAmount, deadline: g.deadline ?? null, created_at: isoNow() })
    await get().fetchAll(userId)
  },

  editSavingsGoal: async (g) => {
    const { adapter } = get()
    if (!adapter) return
    await adapter.db.update('savings_goals').set({ name: g.name, target_amount: g.targetAmount, saved_amount: g.savedAmount, deadline: g.deadline ?? null }).where(eq('id', g.id))
    set((s) => ({
      savingsGoals: s.savingsGoals.map((x) => (x.id === g.id ? { ...x, name: g.name, targetAmount: g.targetAmount, savedAmount: g.savedAmount, deadline: g.deadline } : x)),
    }))
  },

  deleteSavingsGoal: async (id) => {
    const { adapter } = get()
    if (!adapter) return
    await adapter.db.delete('savings_goals').where(eq('id', id))
    set((s) => ({ savingsGoals: s.savingsGoals.filter((x) => x.id !== id) }))
  },

  addRecurring: async (userId, r) => {
    const { adapter } = get()
    if (!adapter) return
    const id = generateId()
    await adapter.db.insert('recurring_transactions').values({ id, user_id: userId, name: r.name, type: r.type, amount: r.amount, category: r.category, frequency: r.frequency, next_date: r.nextDate, active: r.active ? 1 : 0, created_at: isoNow() })
    await get().fetchAll(userId)
  },

  toggleRecurring: async (id, active) => {
    const { adapter } = get()
    if (!adapter) return
    await adapter.db.update('recurring_transactions').set({ active: active ? 1 : 0 }).where(eq('id', id))
    set((s) => ({ recurring: s.recurring.map((x) => (x.id === id ? { ...x, active } : x)) }))
  },

  editRecurring: async (r) => {
    const { adapter } = get()
    if (!adapter) return
    await adapter.db.update('recurring_transactions').set({
      name: r.name, type: r.type, amount: r.amount, category: r.category,
      frequency: r.frequency, next_date: r.nextDate, active: r.active ? 1 : 0,
    }).where(eq('id', r.id))
    set((s) => ({
      recurring: s.recurring.map((x) => (x.id === r.id ? { ...x, name: r.name, type: r.type as RecurringTransaction['type'], amount: r.amount, category: r.category, frequency: r.frequency as RecurringTransaction['frequency'], nextDate: r.nextDate, active: r.active } : x)),
    }))
  },

  deleteRecurring: async (id) => {
    const { adapter } = get()
    if (!adapter) return
    await adapter.db.delete('recurring_transactions').where(eq('id', id))
    set((s) => ({ recurring: s.recurring.filter((x) => x.id !== id) }))
  },

  transferBetweenAccounts: async (userId, fromAccountId, toAccountId, amount, description) => {
    const { adapter, accounts } = get()
    if (!adapter) return
    if (fromAccountId === toAccountId) return
    if (amount <= 0) return

    const fromAcct = accounts.find((a) => a.id === fromAccountId)
    const toAcct = accounts.find((a) => a.id === toAccountId)
    if (!fromAcct || !toAcct) return

    const fromNew = fromAcct.balance - amount
    const toNew = toAcct.balance + amount

    await adapter.db.update('accounts').set({ balance: fromNew }).where(eq('id', fromAccountId))
    await adapter.db.update('accounts').set({ balance: toNew }).where(eq('id', toAccountId))

    const today = todayStr()
    const txId1 = generateId()
    const txId2 = generateId()
    await adapter.db.insert('transactions').values({ id: txId1, user_id: userId, type: 'expense', amount, category: 'Transfer', description: `Transfer to ${toAcct.name}${description ? ': ' + description : ''}`, date: today, account_id: fromAccountId, flexibility: 'fixed', created_at: isoNow() })
    await adapter.db.insert('transactions').values({ id: txId2, user_id: userId, type: 'income', amount, category: 'Transfer', description: `Transfer from ${fromAcct.name}${description ? ': ' + description : ''}`, date: today, account_id: toAccountId, flexibility: 'fixed', created_at: isoNow() })

    set((s) => ({
      accounts: s.accounts.map((a) => {
        if (a.id === fromAccountId) return { ...a, balance: fromNew }
        if (a.id === toAccountId) return { ...a, balance: toNew }
        return a
      }),
    }))

    await get().fetchAll(userId)
  },

  processRecurring: async (userId) => {
    const { adapter, recurring } = get()
    if (!adapter) return []
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const processed: string[] = []
    const MAX_RECURRING_INSERT = 366 // safety cap: at most ~1 year of daily entries per recurring item
    for (const r of recurring) {
      if (!r.active) continue
      let currentNextDate = r.nextDate
      let insertedCount = 0
      while (currentNextDate <= today && insertedCount < MAX_RECURRING_INSERT) {
        const txId = generateId()
        await adapter.db.insert('transactions').values({
          id: txId, user_id: userId, type: r.type, amount: r.amount, category: r.category,
          description: `[Recurring] ${r.name}`, date: currentNextDate, account_id: null, flexibility: 'flexible', created_at: isoNow(),
        })
        currentNextDate = advanceDate(currentNextDate, r.frequency)
        insertedCount++
      }
      if (insertedCount > 0) {
        await adapter.db.update('recurring_transactions').set({ next_date: currentNextDate }).where(eq('id', r.id))
        set((s) => ({ recurring: s.recurring.map((x) => x.id === r.id ? { ...x, nextDate: currentNextDate } : x) }))
        processed.push(r.name)
      }
    }
    if (processed.length > 0) await get().fetchAll(userId)
    return processed
  },

  computeBudgetRollover: () => {
    const { budgets, transactions } = get()
    const now = new Date()
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`
    const rollover: Record<string, number> = {}
    budgets.forEach((b) => {
      const spent = transactions
        .filter((t) => t.type === 'expense' && t.category === b.category && t.date.startsWith(lastMonthKey))
        .reduce((s, t) => s + t.amount, 0)
      const unused = Math.max(0, b.limit - spent)
      if (unused > 0) rollover[b.category] = unused
    })
    set({ budgetRollover: rollover })
  },
}))

function formatTx(t: any): Transaction {
  return { id: t.id, type: t.type, amount: t.amount, category: t.category, description: t.description ?? '', date: t.date, accountId: t.account_id ?? null, flexibility: t.flexibility ?? 'flexible', createdAt: t.created_at }
}

function formatBudget(b: any): Budget {
  return { id: b.id, category: b.category, limit: b.limit }
}

function formatAccount(a: any): Account {
  return { id: a.id, name: a.name, type: a.type, balance: a.balance ?? 0, createdAt: a.created_at }
}

function formatGoal(g: any): SavingsGoal {
  return { id: g.id, name: g.name, targetAmount: g.target_amount, savedAmount: g.saved_amount ?? 0, deadline: g.deadline ?? null, createdAt: g.created_at }
}

function formatRecurring(r: any): RecurringTransaction {
  return { id: r.id, name: r.name, type: r.type, amount: r.amount, category: r.category, frequency: r.frequency, nextDate: r.next_date, active: !!r.active, createdAt: r.created_at }
}

function advanceDate(dateStr: string, frequency: string): string {
  const p = dateStr.split('-')
  const y = Number(p[0])
  const m = Number(p[1])
  const d = Number(p[2])

  switch (frequency) {
    case 'daily': {
      const date = new Date(y, m - 1, d + 1)
      return fmtDate(date)
    }
    case 'weekly': {
      const date = new Date(y, m - 1, d + 7)
      return fmtDate(date)
    }
    case 'monthly': {
      // Use setMonth + clamp to avoid month-end overflow (Jan 31 → Feb 28, not Mar 3)
      const targetMonth = m // 1-indexed target month after increment
      const date = new Date(y, targetMonth, 1) // first day of next month
      // Go back one day to get last day of current month, then add remaining days
      const lastDayOfTarget = new Date(date.getFullYear(), targetMonth, 0).getDate()
      const day = Math.min(d, lastDayOfTarget)
      return `${date.getFullYear()}-${String(targetMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
    case 'yearly': {
      const date = new Date(y + 1, m - 1, d)
      // Handle leap year: Feb 29 → Feb 28 in non-leap years
      if (m === 2 && d === 29 && date.getMonth() !== 1) {
        date.setDate(28)
      }
      return fmtDate(date)
    }
    default:
      return dateStr
  }
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
