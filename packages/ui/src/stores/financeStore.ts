import { create } from 'zustand'
import type { Transaction, Budget, Account, SavingsGoal, RecurringTransaction } from '@wos/shared'
import { generateId, isoNow, todayStr, roundMoney } from '@wos/shared'
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
  processingRecurring: boolean
  setAdapter: (adapter: DatabaseAdapter) => void
  fetchAll: (userId: string) => Promise<void>
  addTransaction: (userId: string, t: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>
  editTransaction: (t: { id: string; type: string; amount: number; category: string; description: string; date: string; accountId: string | null; flexibility?: string }) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>
  addBudget: (userId: string, b: Omit<Budget, 'id'>) => Promise<{ ok: boolean; error?: string }>
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
  transferBetweenAccounts: (userId: string, fromAccountId: string, toAccountId: string, amount: number, description: string) => Promise<{ ok: boolean; error?: string }>
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
  processingRecurring: false,

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
      const transactions = txData.map(formatTx)
      let accounts = acctData.map(formatAccount)

      // Lazily migrate accounts created before `opening_balance` existed:
      // derive it once from the current stored balance minus every
      // transaction already recorded against that account, so it becomes a
      // stable anchor going forward. Never blocks fetchAll on failure.
      const unmigrated = acctData.filter((raw: any) => raw.opening_balance === null || raw.opening_balance === undefined)
      if (unmigrated.length > 0) {
        for (const raw of unmigrated) {
          const spent = transactions
            .filter((t) => t.accountId === raw.id)
            .reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0)
          const opening = roundMoney((raw.balance ?? 0) - spent)
          try {
            await adapter.db.update('accounts').set({ opening_balance: opening }).where(eq('id', raw.id))
          } catch (err) {
            console.error('[financeStore] opening_balance migration failed for account', raw.id, err)
          }
          accounts = accounts.map((a) => (a.id === raw.id ? { ...a, openingBalance: opening } : a))
        }
      }

      set({
        transactions,
        budgets: bData.map(formatBudget),
        accounts,
        savingsGoals: goalData.map(formatGoal),
        recurring: recData.map(formatRecurring),
        loading: false,
      })
      // Compute rollover after data is loaded
      get().computeBudgetRollover()
    } catch (err) {
      console.error('[financeStore] fetchAll failed:', err)
      set({ loading: false })
      get().computeBudgetRollover()
    }
  },

  addTransaction: async (userId, t) => {
    const { adapter } = get()
    if (!adapter) return
    const id = generateId()
    await adapter.db.insert('transactions').values({ id, user_id: userId, type: t.type, amount: t.amount, category: t.category, description: t.description, date: t.date, account_id: t.accountId ?? null, flexibility: t.flexibility ?? 'flexible', created_at: isoNow() })

    if (t.accountId) {
      set((s) => ({ transactions: [{ id, type: t.type, amount: t.amount, category: t.category, description: t.description, date: t.date, accountId: t.accountId ?? null, flexibility: (t.flexibility ?? 'flexible') as Transaction['flexibility'], createdAt: isoNow() }, ...s.transactions] }))
      await recalcAccountBalance(get, set, t.accountId)
    }

    await get().fetchAll(userId)
  },

  editTransaction: async (t) => {
    const { adapter } = get()
    if (!adapter) return

    const oldTx = get().transactions.find((x) => x.id === t.id)

    await adapter.db.update('transactions').set({ type: t.type, amount: t.amount, category: t.category, description: t.description, date: t.date, account_id: t.accountId, flexibility: t.flexibility ?? 'flexible' }).where(eq('id', t.id))

    set((s) => ({
      transactions: s.transactions.map((x) =>
        x.id === t.id ? { ...x, type: t.type as Transaction['type'], amount: t.amount, category: t.category, description: t.description, date: t.date, accountId: t.accountId, flexibility: (t.flexibility ?? x.flexibility ?? 'flexible') as Transaction['flexibility'] } : x
      ),
    }))

    if (oldTx) {
      const affectedIds = new Set<string>()
      if (oldTx.accountId) affectedIds.add(oldTx.accountId)
      if (t.accountId) affectedIds.add(t.accountId)
      for (const acctId of affectedIds) {
        await recalcAccountBalance(get, set, acctId)
      }
    }

    get().computeBudgetRollover()
  },

  deleteTransaction: async (id) => {
    const { adapter } = get()
    if (!adapter) return

    const tx = get().transactions.find((x) => x.id === id)

    await adapter.db.delete('transactions').where(eq('id', id))
    set((s) => ({ transactions: s.transactions.filter((x) => x.id !== id) }))

    if (tx?.accountId) {
      await recalcAccountBalance(get, set, tx.accountId)
    }

    // Unlink any note pointing at this transaction, so it doesn't keep a
    // dangling linked_transaction_id forever.
    try {
      const nStore = (await import('./notesStore')).useNotesStore
      const linked = nStore.getState().notes.filter((n: any) => n.linkedTransactionId === id)
      for (const n of linked) {
        await adapter.db.update('notes').set({ linked_transaction_id: null }).where(eq('id', n.id))
        nStore.setState({ notes: nStore.getState().notes.map((x: any) => (x.id === n.id ? { ...x, linkedTransactionId: null } : x)) })
      }
    } catch {}

    get().computeBudgetRollover()
  },

  addBudget: async (userId, b) => {
    const { adapter, budgets } = get()
    if (!adapter) return { ok: false, error: 'Database tidak tersedia' }
    if (!Number.isFinite(b.limit) || b.limit <= 0) return { ok: false, error: 'Limit harus lebih dari 0' }
    if (budgets.some((x) => x.category.trim().toLowerCase() === b.category.trim().toLowerCase())) {
      return { ok: false, error: 'Budget untuk kategori ini sudah ada' }
    }
    const id = generateId()
    await adapter.db.insert('budgets').values({ id, user_id: userId, category: b.category, limit: roundMoney(b.limit) })
    await get().fetchAll(userId)
    return { ok: true }
  },

  deleteBudget: async (id) => {
    const { adapter } = get()
    if (!adapter) return
    await adapter.db.delete('budgets').where(eq('id', id))
    const deleted = get().budgets.find((x) => x.id === id)
    set((s) => ({ budgets: s.budgets.filter((x) => x.id !== id) }))
    if (deleted) {
      set((s) => {
        const rollover = { ...s.budgetRollover }
        delete rollover[deleted.category]
        return { budgetRollover: rollover }
      })
    }
  },

  addAccount: async (userId, a) => {
    const { adapter } = get()
    if (!adapter) return
    const id = generateId()
    const balance = roundMoney(a.balance)
    await adapter.db.insert('accounts').values({ id, user_id: userId, name: a.name, type: a.type, balance, opening_balance: balance, created_at: isoNow() })
    await get().fetchAll(userId)
  },

  editAccount: async (a) => {
    const { adapter, transactions, accounts } = get()
    if (!adapter) return
    const existing = accounts.find((x) => x.id === a.id)
    // The user is directly overriding the displayed balance — re-anchor
    // openingBalance so future recalculation still lands on this value.
    const spent = transactions
      .filter((t) => t.accountId === a.id)
      .reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0)
    const newBalance = roundMoney(a.balance)
    const newOpening = existing ? roundMoney(newBalance - spent) : newBalance
    await adapter.db.update('accounts').set({ name: a.name, type: a.type, balance: newBalance, opening_balance: newOpening }).where(eq('id', a.id))
    set((s) => ({ accounts: s.accounts.map((x) => (x.id === a.id ? { ...x, name: a.name, type: a.type as Account['type'], balance: newBalance, openingBalance: newOpening } : x)) }))
  },

  deleteAccount: async (id) => {
    const { adapter } = get()
    if (!adapter) return
    const linked = get().transactions.filter((t) => t.accountId === id)
    for (const tx of linked) {
      try {
        await adapter.db.update('transactions').set({ account_id: null }).where(eq('id', tx.id))
      } catch (err) {
        console.error('[financeStore] failed to unlink transaction from deleted account', tx.id, err)
      }
    }
    set((s) => ({ transactions: s.transactions.map((t) => (t.accountId === id ? { ...t, accountId: null } : t)) }))
    await adapter.db.delete('accounts').where(eq('id', id))
    set((s) => ({ accounts: s.accounts.filter((x) => x.id !== id) }))
  },

  addSavingsGoal: async (userId, g) => {
    const { adapter } = get()
    if (!adapter) return
    const id = generateId()
    await adapter.db.insert('savings_goals').values({ id, user_id: userId, name: g.name, target_amount: roundMoney(g.targetAmount), saved_amount: roundMoney(g.savedAmount), deadline: g.deadline ?? null, created_at: isoNow() })
    await get().fetchAll(userId)
  },

  editSavingsGoal: async (g) => {
    const { adapter } = get()
    if (!adapter) return
    const targetAmount = roundMoney(g.targetAmount)
    const savedAmount = roundMoney(g.savedAmount)
    await adapter.db.update('savings_goals').set({ name: g.name, target_amount: targetAmount, saved_amount: savedAmount, deadline: g.deadline ?? null }).where(eq('id', g.id))
    set((s) => ({
      savingsGoals: s.savingsGoals.map((x) => (x.id === g.id ? { ...x, name: g.name, targetAmount, savedAmount, deadline: g.deadline } : x)),
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
    await adapter.db.insert('recurring_transactions').values({ id, user_id: userId, name: r.name, type: r.type, amount: roundMoney(r.amount), category: r.category, frequency: r.frequency, next_date: r.nextDate, active: r.active ? 1 : 0, created_at: isoNow() })
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
    const amount = roundMoney(r.amount)
    await adapter.db.update('recurring_transactions').set({
      name: r.name, type: r.type, amount, category: r.category,
      frequency: r.frequency, next_date: r.nextDate, active: r.active ? 1 : 0,
    }).where(eq('id', r.id))
    set((s) => ({
      recurring: s.recurring.map((x) => (x.id === r.id ? { ...x, name: r.name, type: r.type as RecurringTransaction['type'], amount, category: r.category, frequency: r.frequency as RecurringTransaction['frequency'], nextDate: r.nextDate, active: r.active } : x)),
    }))
  },

  deleteRecurring: async (id) => {
    const { adapter } = get()
    if (!adapter) return
    await adapter.db.delete('recurring_transactions').where(eq('id', id))
    set((s) => ({ recurring: s.recurring.filter((x) => x.id !== id) }))
  },

  transferBetweenAccounts: async (userId, fromAccountId, toAccountId, amount, description) => {
    const { adapter } = get()
    if (!adapter) return { ok: false, error: 'Database tidak tersedia' }
    if (fromAccountId === toAccountId) return { ok: false, error: 'Akun asal dan tujuan tidak boleh sama' }
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Jumlah transfer tidak valid' }

    // Re-read fresh state right before the check (not a snapshot captured
    // earlier) so two rapid transfers can't both pass the overdraft check
    // against the same stale balance.
    const fromAcct = get().accounts.find((a) => a.id === fromAccountId)
    const toAcct = get().accounts.find((a) => a.id === toAccountId)
    if (!fromAcct || !toAcct) return { ok: false, error: 'Akun tidak ditemukan' }
    if (fromAcct.type !== 'credit' && fromAcct.balance < amount) return { ok: false, error: 'Saldo tidak mencukupi' }

    const today = todayStr()
    const txId1 = generateId()
    const txId2 = generateId()
    // Ledger rows are written first — if the process dies before the balance
    // recompute below runs, the transaction history (source of truth) is
    // still complete and correct; balance just needs a recalc on next load.
    await adapter.db.insert('transactions').values({ id: txId1, user_id: userId, type: 'expense', amount, category: 'Transfer', description: `Transfer to ${toAcct.name}${description ? ': ' + description : ''}`, date: today, account_id: fromAccountId, flexibility: 'fixed', created_at: isoNow() })
    await adapter.db.insert('transactions').values({ id: txId2, user_id: userId, type: 'income', amount, category: 'Transfer', description: `Transfer from ${fromAcct.name}${description ? ': ' + description : ''}`, date: today, account_id: toAccountId, flexibility: 'fixed', created_at: isoNow() })

    set((s) => ({
      transactions: [
        { id: txId2, type: 'income', amount, category: 'Transfer', description: `Transfer from ${fromAcct.name}${description ? ': ' + description : ''}`, date: today, accountId: toAccountId, flexibility: 'fixed', createdAt: isoNow() },
        { id: txId1, type: 'expense', amount, category: 'Transfer', description: `Transfer to ${toAcct.name}${description ? ': ' + description : ''}`, date: today, accountId: fromAccountId, flexibility: 'fixed', createdAt: isoNow() },
        ...s.transactions,
      ],
    }))

    try {
      await recalcAccountBalance(get, set, fromAccountId)
      await recalcAccountBalance(get, set, toAccountId)
    } catch (err) {
      console.error('[financeStore] balance recalc failed after transfer — ledger is correct, refresh to resync balances', err)
    }

    await get().fetchAll(userId)
    return { ok: true }
  },

  processRecurring: async (userId) => {
    const { adapter, recurring, processingRecurring } = get()
    if (!adapter || processingRecurring) return []
    set({ processingRecurring: true })
    try {
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
          set((s) => ({ recurring: s.recurring.map((x) => (x.id === r.id ? { ...x, nextDate: currentNextDate } : x)) }))
          processed.push(r.name)
        }
      }
      if (processed.length > 0) await get().fetchAll(userId)
      return processed
    } finally {
      set({ processingRecurring: false })
    }
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
      const unused = Math.max(0, roundMoney(b.limit - spent))
      if (unused > 0) rollover[b.category] = unused
    })
    set({ budgetRollover: rollover })
  },
}))

/** Recompute one account's balance from openingBalance + all its current transactions, and persist it. Structurally immune to drift/desync since it never accumulates a delta on top of a possibly-stale value. */
async function recalcAccountBalance(
  get: () => FinanceState,
  set: (partial: Partial<FinanceState> | ((s: FinanceState) => Partial<FinanceState>)) => void,
  accountId: string,
): Promise<void> {
  const { adapter, accounts, transactions } = get()
  if (!adapter) return
  const acct = accounts.find((a) => a.id === accountId)
  if (!acct) return
  const opening = acct.openingBalance ?? acct.balance
  const sum = transactions
    .filter((t) => t.accountId === accountId)
    .reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0)
  const newBalance = roundMoney(opening + sum)
  if (newBalance === acct.balance) return
  await adapter.db.update('accounts').set({ balance: newBalance }).where(eq('id', accountId))
  set((s) => ({ accounts: s.accounts.map((a) => (a.id === accountId ? { ...a, balance: newBalance } : a)) }))
}

function formatTx(t: any): Transaction {
  return { id: t.id, type: t.type, amount: t.amount, category: t.category, description: t.description ?? '', date: t.date, accountId: t.account_id ?? null, flexibility: t.flexibility ?? 'flexible', createdAt: t.created_at }
}

function formatBudget(b: any): Budget {
  return { id: b.id, category: b.category, limit: b.limit }
}

function formatAccount(a: any): Account {
  return { id: a.id, name: a.name, type: a.type, balance: a.balance ?? 0, openingBalance: a.opening_balance ?? a.balance ?? 0, createdAt: a.created_at }
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
      const date = new Date(y, m - 1, d)
      date.setMonth(date.getMonth() + 1)
      if (date.getDate() !== d) date.setDate(0)
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
    default:
      return dateStr
  }
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
