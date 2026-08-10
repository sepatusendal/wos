import { useEffect, useMemo, useState, useRef } from 'react'
import { toast } from 'sonner'
import { useFinanceStore } from '../../stores/financeStore'
import { useNotesStore } from '../../stores/notesStore'
import { useAuthStore } from '../../stores/authStore'
import { NeubruBtn, NeubruCard, NeubruInput, NeubruSelect, NeubruModal, NeubruTag } from '../../components'
import { formatDate, todayStr, formatShortDate, formatMonthShort } from '@wos/shared'
import { useFormatCurrency } from '../../stores/useFormatCurrency'
import type { RecurringTransaction } from '@wos/shared'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { exportCSV, generatePDFProps } from '../../utils/export'
import { BlobProvider } from '@react-pdf/renderer'
import { TransactionPDF } from '../../utils/TransactionPDF'

const EXPENSE_CATS = ['Makan', 'Transport', 'Belanja', 'Hiburan', 'Tagihan', 'Kesehatan', 'Pendidikan', 'Transfer', 'Lainnya']
const INCOME_CATS = ['Gaji', 'Freelance', 'Investasi', 'Bisnis', 'Transfer', 'Lainnya']
const CAT_COLORS: Record<string, 'yellow' | 'blue' | 'green' | 'pink' | 'orange' | 'purple' | 'red'> = {
  Gaji: 'green', Freelance: 'blue', Investasi: 'purple', Bisnis: 'orange',
  Makan: 'yellow', Transport: 'blue', Belanja: 'pink', Hiburan: 'orange',
  Tagihan: 'red', Kesehatan: 'pink', Pendidikan: 'purple', Transfer: 'blue', Lainnya: 'yellow',
}
const ACCOUNT_ICONS: Record<string, string> = { cash: '💵', bank: '🏦', ewallet: '📱', credit: '💳' }
const FREQ_LABEL: Record<string, string> = { daily: 'Harian', weekly: 'Mingguan', monthly: 'Bulanan', yearly: 'Tahunan' }

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function FinancePage() {
  const userId = useAuthStore((s) => s.userId)
  const formatCurrency = useFormatCurrency()
  const {
    transactions, budgets, accounts, savingsGoals, recurring,
    budgetRollover,
    fetchAll, addTransaction, editTransaction, deleteTransaction,
    addBudget, deleteBudget,
    addAccount, editAccount, deleteAccount,
    addSavingsGoal, editSavingsGoal, deleteSavingsGoal,
    addRecurring, editRecurring, toggleRecurring, deleteRecurring,
    transferBetweenAccounts, processRecurring,
  } = useFinanceStore()

  const [showTxModal, setShowTxModal] = useState(false)
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [showRecurringModal, setShowRecurringModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [monthFilter, setMonthFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterAccount, setFilterAccount] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  // CSV Import states
  const [showImportModal, setShowImportModal] = useState(false)
  const [importPreview, setImportPreview] = useState<any[]>([])
  const [importFile, setImportFile] = useState<File | null>(null)
  const [, setImportColMap] = useState<{ date: string; desc: string; amount: string; type: string }>({ date: '', desc: '', amount: '', type: '' })
  const [importDuplicates, setImportDuplicates] = useState(0)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Makan')
  const [desc, setDesc] = useState('')
  const [date, setDate] = useState(todayStr())
  const [txAccountId, setTxAccountId] = useState<string>('')
  const [flexibility, setFlexibility] = useState<'fixed' | 'flexible' | 'discretionary'>('flexible')
  const [budgetCat, setBudgetCat] = useState('Makan')
  const [budgetLimit, setBudgetLimit] = useState('')

  const [transferFrom, setTransferFrom] = useState('')
  const [transferTo, setTransferTo] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferDesc, setTransferDesc] = useState('')

  const [acctName, setAcctName] = useState('')
  const [acctType, setAcctType] = useState('bank')
  const [acctBalance, setAcctBalance] = useState('')
  const [acctEditId, setAcctEditId] = useState<string | null>(null)

  const [goalName, setGoalName] = useState('')
  const [goalTarget, setGoalTarget] = useState('')
  const [goalSaved, setGoalSaved] = useState('')
  const [goalDeadline, setGoalDeadline] = useState('')
  const [goalEditId, setGoalEditId] = useState<string | null>(null)

  const [recName, setRecName] = useState('')
  const [recType, setRecType] = useState<'income' | 'expense'>('expense')
  const [recAmount, setRecAmount] = useState('')
  const [recCategory, setRecCategory] = useState('Makan')
  const [recFreq, setRecFreq] = useState('monthly')
  const [recNext, setRecNext] = useState(todayStr())
  const [recEditId, setRecEditId] = useState<string | null>(null)
  const [recActive, setRecActive] = useState(true)

  useEffect(() => {
    if (!userId) return
    fetchAll(userId).then(async () => {
      const processed = await processRecurring(userId)
      if (processed.length > 0) {
        toast.success(`Processed ${processed.length} recurring transaction${processed.length > 1 ? 's' : ''}`, {
          description: processed.join(', '),
        })
      }
    })
  }, [userId, fetchAll, processRecurring])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setShowExportMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const totalIncome = useMemo(() => transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0), [transactions])
  const totalExpense = useMemo(() => transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [transactions])
  const balance = totalIncome - totalExpense
  const accountTotal = useMemo(() => accounts.reduce((s, a) => s + a.balance, 0), [accounts])

  const monthlyCashFlow = useMemo(() => {
    const now = new Date()
    const months: { key: string; income: number; expense: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = monthKey(d)
      months.push({ key, income: 0, expense: 0 })
    }
    transactions.forEach((t) => {
      const key = t.date.slice(0, 7)
      const bucket = months.find((m) => m.key === key)
      if (!bucket) return
      if (t.type === 'income') bucket.income += t.amount
      else bucket.expense += t.amount
    })
    return months.map((m) => ({ ...m, label: formatMonthShort(m.key), net: m.income - m.expense }))
  }, [transactions])

  const filtered = useMemo(() => {
    let result = transactions
    if (filter !== 'all') result = result.filter((t) => t.type === filter)
    if (monthFilter) result = result.filter((t) => t.date.startsWith(monthFilter))
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter((t) => t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
    }
    if (filterAccount) result = result.filter((t) => t.accountId === filterAccount)
    if (filterCategory) result = result.filter((t) => t.category === filterCategory)
    return result
  }, [transactions, filter, monthFilter, searchQuery, filterAccount, filterCategory])

  const uniqueCategories = useMemo(() => [...new Set(transactions.map((t) => t.category))].sort(), [transactions])

  // Linked notes per transaction
  const allNotes = useNotesStore((s) => s.notes)
  const linkedNotesByTx = useMemo(() => {
    const map = new Map<string, { id: string; title: string }[]>()
    allNotes.forEach((n) => {
      if (n.linkedTransactionId) {
        if (!map.has(n.linkedTransactionId)) map.set(n.linkedTransactionId, [])
        map.get(n.linkedTransactionId)!.push({ id: n.id, title: n.title })
      }
    })
    return map
  }, [allNotes])

  const activeFilterCount = [searchQuery, filterAccount, filterCategory, monthFilter].filter(Boolean).length + (filter !== 'all' ? 1 : 0)

  const budgetSpending = useMemo(() => {
    return budgets.map((b) => {
      const spent = transactions.filter((t) => t.type === 'expense' && t.category === b.category).reduce((s, t) => s + t.amount, 0)
      return { ...b, spent, pct: Math.min(Math.round((spent / b.limit) * 100), 100) }
    })
  }, [budgets, transactions])

  // ── Budget vs Actual: monthly rollover + overspend suggestions ──
  const budgetVsActual = useMemo(() => {
    const now = new Date()
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    // Last 3 complete months
    const prevMonths = Array.from({ length: 3 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (i + 1), 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })

    return budgets.map((b) => {
      // This month's actual spending
      const spentThisMonth = transactions
        .filter((t) => t.type === 'expense' && t.category === b.category && t.date.startsWith(thisMonthKey))
        .reduce((s, t) => s + t.amount, 0)

      // Rollover from last month
      const lastMonthSpent = transactions
        .filter((t) => t.type === 'expense' && t.category === b.category && t.date.startsWith(prevMonths[0]!))
        .reduce((s, t) => s + t.amount, 0)
      const rollover = Math.max(0, (b.limit + (budgetRollover[b.category] || 0)) - lastMonthSpent)

      // Effective budget = base limit + rollover
      const effectiveLimit = b.limit + (budgetRollover[b.category] || 0)
      const pct = Math.min(Math.round((spentThisMonth / effectiveLimit) * 100), 100)
      const barPct = Math.min(pct, 100)

      // Overspend analysis: check last 3 months
      const historicalPcts = prevMonths.map((mk) => {
        const spent = transactions
          .filter((t) => t.type === 'expense' && t.category === b.category && t.date.startsWith(mk))
          .reduce((s, t) => s + t.amount, 0)
        return b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0
      })
      const overspentMonths = historicalPcts.filter((p) => p >= 100).length
      const avgOverspend = historicalPcts.filter((p) => p >= 100).length > 0
        ? Math.round(historicalPcts.filter((p) => p >= 100).reduce((s, p) => s + p, 0) / historicalPcts.filter((p) => p >= 100).length)
        : 0
      const needsIncrease = overspentMonths >= 2
      const suggestion = needsIncrease
        ? `Budget ${b.category} overspend ${avgOverspend}% ${overspentMonths} bulan terakhir → naikin budget?`
        : null

      return {
        ...b,
        spent: spentThisMonth,
        effectiveLimit,
        rollover,
        pct,
        barPct,
        suggestion,
      }
    })
  }, [budgets, transactions, budgetRollover])

  const openAdd = () => { setEditId(null); setType('expense'); setAmount(''); setCategory('Makan'); setDesc(''); setDate(todayStr()); setTxAccountId(''); setFlexibility('flexible'); setShowTxModal(true) }
  const openEdit = (t: any) => { setEditId(t.id); setType(t.type); setAmount(String(t.amount)); setCategory(t.category); setDesc(t.description); setDate(t.date); setTxAccountId(t.accountId ?? ''); setFlexibility((t.flexibility ?? 'flexible') as 'fixed' | 'flexible' | 'discretionary'); setShowTxModal(true) }

  const saveTx = async () => {
    if (!userId || !amount) return
    const numAmount = Number(amount)
    if (isNaN(numAmount) || numAmount <= 0) { toast.error('Jumlah harus lebih dari 0'); return }
    const oldAmount = editId ? useFinanceStore.getState().transactions.find((t) => t.id === editId)?.amount ?? 0 : 0
    if (editId) { await editTransaction({ id: editId, type, amount: numAmount, category, description: desc, date, accountId: txAccountId || null, flexibility }) }
    else { await addTransaction(userId, { type, amount: numAmount, category, description: desc, date, accountId: txAccountId || null, flexibility }) }
    if (type === 'expense') checkBudgetAlert(category, numAmount, oldAmount)
    setShowTxModal(false)
  }

  const checkBudgetAlert = (cat: string, newAmount: number, oldAmount = 0) => {
    const fresh = useFinanceStore.getState()
    const budget = fresh.budgets.find((b) => b.category === cat)
    if (!budget) return
    const currentSpent = fresh.transactions.filter((t) => t.type === 'expense' && t.category === cat).reduce((s, t) => s + t.amount, 0)
    const totalAfter = currentSpent - oldAmount + newAmount
    const pct = Math.round((totalAfter / budget.limit) * 100)
    if (pct >= 100) {
      toast.error(`Budget exceeded for "${cat}"!`, { description: `Spent ${formatCurrency(totalAfter)} / ${formatCurrency(budget.limit)} (${pct}%)` })
    } else if (pct >= 80) {
      toast.warning(`Budget warning for "${cat}"`, { description: `Spent ${formatCurrency(totalAfter)} / ${formatCurrency(budget.limit)} (${pct}%)` })
    }
  }

  const saveBudget = async () => {
    if (!userId || !budgetCat || !budgetLimit) return
    await addBudget(userId, { category: budgetCat, limit: Number(budgetLimit) })
    setBudgetLimit('')
    setShowBudgetModal(false)
  }

  const openAddAccount = () => { setAcctEditId(null); setAcctName(''); setAcctType('bank'); setAcctBalance(''); setShowAccountModal(true) }
  const openEditAccount = (a: any) => { setAcctEditId(a.id); setAcctName(a.name); setAcctType(a.type); setAcctBalance(String(a.balance)); setShowAccountModal(true) }
  const saveAccount = async () => {
    if (!userId || !acctName) return
    if (acctEditId) await editAccount({ id: acctEditId, name: acctName, type: acctType, balance: Number(acctBalance) || 0 })
    else await addAccount(userId, { name: acctName, type: acctType, balance: Number(acctBalance) || 0 })
    setShowAccountModal(false)
  }

  const openAddGoal = () => { setGoalEditId(null); setGoalName(''); setGoalTarget(''); setGoalSaved(''); setGoalDeadline(''); setShowGoalModal(true) }
  const openEditGoal = (g: any) => { setGoalEditId(g.id); setGoalName(g.name); setGoalTarget(String(g.targetAmount)); setGoalSaved(String(g.savedAmount)); setGoalDeadline(g.deadline ?? ''); setShowGoalModal(true) }
  const saveGoal = async () => {
    if (!userId || !goalName || !goalTarget) return
    if (goalEditId) await editSavingsGoal({ id: goalEditId, name: goalName, targetAmount: Number(goalTarget), savedAmount: Number(goalSaved) || 0, deadline: goalDeadline || null })
    else await addSavingsGoal(userId, { name: goalName, targetAmount: Number(goalTarget), savedAmount: Number(goalSaved) || 0, deadline: goalDeadline || null })
    setShowGoalModal(false)
  }

  const openAddRecurring = () => { setRecEditId(null); setRecName(''); setRecType('expense'); setRecAmount(''); setRecCategory('Makan'); setRecFreq('monthly'); setRecNext(todayStr()); setRecActive(true); setShowRecurringModal(true) }
  const openEditRecurring = (r: RecurringTransaction) => { setRecEditId(r.id); setRecName(r.name); setRecType(r.type); setRecAmount(String(r.amount)); setRecCategory(r.category); setRecFreq(r.frequency); setRecNext(r.nextDate); setRecActive(r.active); setShowRecurringModal(true) }
  const saveRecurring = async () => {
    if (!userId || !recName || !recAmount) return
    if (recEditId) {
      await editRecurring({ id: recEditId, name: recName, type: recType, amount: Number(recAmount), category: recCategory, frequency: recFreq, nextDate: recNext, active: recActive })
    } else {
      await addRecurring(userId, { name: recName, type: recType, amount: Number(recAmount), category: recCategory, frequency: recFreq as RecurringTransaction['frequency'], nextDate: recNext, active: true })
    }
    setShowRecurringModal(false)
  }

  const saveTransfer = async () => {
    if (!userId || !transferFrom || !transferTo || !transferAmount) return
    await transferBetweenAccounts(userId, transferFrom, transferTo, Number(transferAmount), transferDesc)
    setShowTransferModal(false)
    setTransferFrom('')
    setTransferTo('')
    setTransferAmount('')
    setTransferDesc('')
  }

  // ── CSV Import ──
  const autoDetectCategory = (desc: string): string => {
    const d = desc.toLowerCase()
    if (/gaji|salary|payroll|gajian/.test(d)) return 'Gaji'
    if (/makan|restoran|food|kfc|mcd|warung|nasi|mie|bakso|soto|kopi|cafe/.test(d)) return 'Makan'
    if (/transport|gojek|grab|tol|bbm|pertamina|spbu|bensin|parkir|ojek/.test(d)) return 'Transport'
    if (/belanja|shopee|tokopedia|lazada|mall|bukalapak|blibli/.test(d)) return 'Belanja'
    if (/tagihan|pln|pdam|listrik|air|internet|telkom|indihome|pulsa|paket/.test(d)) return 'Tagihan'
    if (/freelance|project|side/.test(d)) return 'Freelance'
    if (/investasi|saham|reksadana|dividen|kupon/.test(d)) return 'Investasi'
    if (/hiburan|bioskop|netflix|spotify|game|steam/.test(d)) return 'Hiburan'
    if (/kesehatan|dokter|obat|rumah sakit|apotek|bpjs/.test(d)) return 'Kesehatan'
    if (/transfer|tf|kirim/.test(d)) return 'Transfer'
    return 'Lainnya'
  }

  const parseDate = (raw: string): string => {
    const cleaned = raw.trim()
    // DD/MM/YYYY
    const m1 = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (m1) return `${m1[3]!}-${m1[2]!.padStart(2, '0')}-${m1[1]!.padStart(2, '0')}`
    // DD-MM-YYYY
    const m2 = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
    if (m2) return `${m2[3]!}-${m2[2]!.padStart(2, '0')}-${m2[1]!.padStart(2, '0')}`
    // YYYY-MM-DD (already good)
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned
    // YYYY/MM/DD
    const m3 = cleaned.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
    if (m3) return `${m3[1]!}-${m3[2]!.padStart(2, '0')}-${m3[3]!.padStart(2, '0')}`
    return ''
  }

  const parseAmount = (raw: string): number => {
    let cleaned = raw.trim().replace(/Rp\.?\s*/gi, '')
    // Check if negative: (1.234) or -1.234
    const isNeg = /^\(.+\)$/.test(cleaned) || cleaned.startsWith('-')
    cleaned = cleaned.replace(/[()\-]/g, '')
    // Indonesian format: 1.234,56 → remove dots, replace comma with dot
    if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(cleaned)) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      // Western format: 1,234.56 → remove commas
      cleaned = cleaned.replace(/,/g, '')
    }
    const num = parseFloat(cleaned)
    if (isNaN(num)) return 0
    return isNeg ? -Math.abs(num) : Math.abs(num)
  }

  const handleCsvFile = (file: File) => {
    setImportFile(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (!text) return
      const lines = text.split('\n').filter((l) => l.trim())
      if (lines.length < 2) { toast.error('CSV file too short'); return }

      const headers = lines[0]!.split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
      // Auto-detect columns
      const map = { date: '', desc: '', amount: '', type: '' }
      for (const h of headers) {
        const hl = h.toLowerCase()
        if (!map.date && /tanggal|date|tgl/.test(hl)) map.date = h
        if (!map.desc && /keterangan|description|deskripsi|uraian|narasi|ket/.test(hl)) map.desc = h
        if (!map.amount && /jumlah|amount|nilai|nominal|mutasi/.test(hl)) map.amount = h
        if (!map.type && /tipe|type|d\/k|c\/d|db\/cr|debit/.test(hl)) map.type = h
      }
      // Fallback: first column=date, second=desc, last numeric=amount
      if (!map.date && headers.length >= 1) map.date = headers[0]!
      if (!map.desc && headers.length >= 2) map.desc = headers[1]!
      if (!map.amount) {
        const numericCol = headers.find((h) => {
          const idx = headers.indexOf(h)
          const val = parseFloat(lines[1]!.split(',')[idx]?.trim() ?? '')
          return !isNaN(val) && val !== 0
        })
        if (numericCol) map.amount = numericCol
      }

      setImportColMap(map)

      // Parse preview rows
      const rows = lines.slice(1).map((line) => {
        const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
        const obj: Record<string, string> = {}
        headers.forEach((h, i) => { obj[h] = vals[i] || '' })
        return obj
      })

      const preview = rows.slice(0, 10).map((row) => {
        const dateStr = parseDate(row[map.date] || '')
        const amt = parseAmount(row[map.amount] || '')
        let type: 'income' | 'expense' = amt >= 0 ? 'income' : 'expense'
        if (map.type) {
          const tRaw = (row[map.type] || '').toUpperCase()
          if (/^(D|DB|DEBIT|KELUAR|PENGELUARAN|EXPENSE)$/.test(tRaw)) type = 'expense'
          if (/^(C|CR|CREDIT|MASUK|PEMASUKAN|INCOME)$/.test(tRaw)) type = 'income'
        }
        const desc = row[map.desc] || ''
        return { date: dateStr, amount: Math.abs(amt), type, description: desc, category: autoDetectCategory(desc) }
      }).filter((r) => r.date && r.amount > 0)

      setImportPreview(preview)
      setImportDuplicates(0)
      setShowImportModal(true)
    }
    reader.readAsText(file)
  }

  const executeImport = async () => {
    if (!userId || importPreview.length === 0) return
    setImporting(true)
    let imported = 0
    let skipped = 0
    let errors = 0
    const existingSet = new Set(
      useFinanceStore.getState().transactions.map((t) => `${t.date}|${t.amount}|${t.description}`)
    )
    for (const row of importPreview) {
      const key = `${row.date}|${row.amount}|${row.description}`
      if (existingSet.has(key)) { skipped++; continue }
      try {
        await addTransaction(userId, {
          type: row.type, amount: row.amount, category: row.category,
          description: row.description, date: row.date, accountId: null, flexibility: 'flexible',
        })
        existingSet.add(key) // Prevent internal CSV duplicates
        imported++
      } catch { errors++ }
    }
    setImportDuplicates(skipped)
    setImporting(false)
    if (imported > 0) {
      toast.success(`✅ Imported ${imported} transactions${skipped > 0 ? `, ${skipped} skipped` : ''}${errors > 0 ? `, ${errors} failed` : ''}`)
      setShowImportModal(false)
      setImportPreview([])
    } else if (errors > 0) {
      toast.error(`Failed to import ${errors} transactions`)
    } else {
      toast.error('No new transactions to import')
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-7 gap-4 flex-wrap">
        <h2 className="text-[1.8rem]">💸 Finance</h2>
        <div className="flex gap-2.5 flex-wrap">
          <NeubruBtn color="yellow" onClick={() => setShowBudgetModal(true)}>🎯 Budget</NeubruBtn>
          <NeubruBtn color="purple" onClick={openAddRecurring}>🔁 Recurring</NeubruBtn>
          <NeubruBtn color="pink" onClick={openAddGoal}>🎉 Tabungan</NeubruBtn>
          <NeubruBtn color="blue" onClick={openAddAccount}>🏦 Akun</NeubruBtn>
          <NeubruBtn color="orange" onClick={() => setShowTransferModal(true)}>🔄 Transfer</NeubruBtn>
          <NeubruBtn color="green" onClick={openAdd}>+ Transaksi</NeubruBtn>
          <NeubruBtn color="blue" onClick={() => fileInputRef.current?.click()}>📥 Import CSV</NeubruBtn>
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleCsvFile(f)
            e.target.value = '' // reset so same file can be re-selected
          }} />
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5 mb-7">
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Saldo</div>
          <div className={`font-mono text-xl font-extrabold ${balance >= 0 ? 'text-nb-green' : 'text-nb-red'}`}>{formatCurrency(balance)}</div>
        </NeubruCard>
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Pemasukan</div>
          <div className="text-nb-green font-mono text-xl font-extrabold">{formatCurrency(totalIncome)}</div>
        </NeubruCard>
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Pengeluaran</div>
          <div className="text-nb-red font-mono text-xl font-extrabold">{formatCurrency(totalExpense)}</div>
        </NeubruCard>
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Total Akun</div>
          <div className="text-nb-blue font-mono text-xl font-extrabold">{formatCurrency(accountTotal)}</div>
        </NeubruCard>
      </div>

      {budgetSpending.filter((b) => b.pct >= 80).length > 0 && (
        <div className="mb-5 border-2 border-nb-orange bg-nb-orange/10 p-4">
          <div className="font-bold text-sm mb-2">⚠️ Budget Warnings</div>
          <div className="flex flex-col gap-1.5">
            {budgetSpending.filter((b) => b.pct >= 80).map((b) => (
              <div key={b.id} className="flex items-center justify-between text-sm">
                <span className="font-bold">{b.category}</span>
                <span className={b.pct >= 100 ? 'text-nb-red font-bold' : 'text-nb-orange'}>
                  {formatCurrency(b.spent)} / {formatCurrency(b.limit)} ({b.pct}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <NeubruCard className="mb-7">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="text-sm font-bold uppercase text-nb-fg-muted">Arus Kas 6 Bulan</div>
          <div className="flex gap-3 text-xs font-bold">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-nb-green inline-block" /> Masuk</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-nb-red inline-block" /> Keluar</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={monthlyCashFlow}>
            <defs>
              <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff4b4b" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#ff4b4b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1c" opacity={0.12} />
            <XAxis dataKey="label" stroke="#1a1a1c" tick={{ fontSize: 12, fontWeight: 700 }} />
            <YAxis stroke="#1a1a1c" tick={{ fontSize: 10, fontWeight: 700 }} tickFormatter={(v) => `${Math.round(v / 1000000)}M`} />
            <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
            <Area type="monotone" dataKey="income" name="Masuk" stroke="#22c55e" strokeWidth={2.5} fill="url(#gIncome)" />
            <Area type="monotone" dataKey="expense" name="Keluar" stroke="#ff4b4b" strokeWidth={2.5} fill="url(#gExpense)" />
          </AreaChart>
        </ResponsiveContainer>
      </NeubruCard>

      {/* ── Budget vs Actual ── */}
      {budgetVsActual.length > 0 && (
        <div className="mb-7">
          <h3 className="mb-3">Budget vs Actual</h3>
          <NeubruCard>
            <div className="flex flex-col gap-4">
              {budgetVsActual.map((b) => {
                const barColor = b.pct <= 80 ? '#22c55e' : b.pct <= 99 ? '#ff8a00' : '#ff4b4b'
                return (
                  <div key={b.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{b.category}</span>
                        {b.rollover > 0 && (
                          <span className="text-[10px] font-bold bg-nb-yellow/20 px-1.5 py-0.5 border border-nb-yellow/60">
                            +{formatCurrency(b.rollover)} rollover
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono font-bold">
                        {formatCurrency(b.spent)} / {formatCurrency(b.effectiveLimit)}
                        <span className={`ml-1.5 ${b.pct >= 100 ? 'text-nb-red' : b.pct > 80 ? 'text-nb-orange' : 'text-nb-green'}`}>
                          ({b.pct}%)
                        </span>
                      </span>
                    </div>
                    <div className="relative h-7 bg-nb-bg border-2 border-nb-border overflow-hidden">
                      {/* Budget bar (gray outline — shows the limit) */}
                      <div
                        className="absolute inset-0 border-r-[3px] border-dashed border-nb-fg-muted/40"
                        style={{ width: `${Math.min(Math.round((b.effectiveLimit / b.effectiveLimit) * 100), 100)}%` }}
                      />
                      {/* Actual bar (colored, filled) */}
                      <div
                        className="h-full transition-all duration-500"
                        style={{
                          width: `${b.barPct}%`,
                          background: barColor,
                        }}
                      />
                    </div>
                    {b.suggestion && (
                      <div className="mt-1.5 text-[11px] font-bold text-nb-orange flex items-center gap-1">
                        <span>💡</span> {b.suggestion}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </NeubruCard>
        </div>
      )}

      {accounts.length > 0 && (
        <div className="mb-7">
          <h3 className="mb-3">🏦 Akun</h3>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
            {accounts.map((a) => (
              <NeubruCard key={a.id}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-2xl">{ACCOUNT_ICONS[a.type] || '💵'}</span>
                  <NeubruTag label={a.type} color={a.type === 'credit' ? 'red' : 'blue'} />
                </div>
                <div className="font-bold text-sm mb-1">{a.name}</div>
                <div className="font-mono font-extrabold text-nb-blue">{formatCurrency(a.balance)}</div>
                <div className="flex gap-2 mt-3">
                  <NeubruBtn size="sm" color="yellow" className="nb-btn-icon" onClick={() => openEditAccount(a)}>✎</NeubruBtn>
                  <NeubruBtn size="sm" color="red" className="nb-btn-icon" onClick={() => deleteAccount(a.id)}>✕</NeubruBtn>
                </div>
              </NeubruCard>
            ))}
          </div>
        </div>
      )}

      {savingsGoals.length > 0 && (
        <div className="mb-7">
          <h3 className="mb-3">🎉 Tabungan</h3>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {savingsGoals.map((g) => {
              const pct = Math.min(Math.round((g.savedAmount / g.targetAmount) * 100), 100)
              const done = g.savedAmount >= g.targetAmount
              return (
                <NeubruCard key={g.id}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-sm">{g.name}</span>
                    <NeubruTag label={`${pct}%`} color={done ? 'green' : pct > 80 ? 'orange' : 'blue'} />
                  </div>
                  <div className="font-mono font-extrabold text-sm">
                    {formatCurrency(g.savedAmount)} <span className="text-xs opacity-50">/ {formatCurrency(g.targetAmount)}</span>
                  </div>
                  {g.deadline && <div className="text-xs text-nb-fg-muted mt-0.5">Target: {formatDate(g.deadline)}</div>}
                  <div className="mt-2 h-3 bg-nb-bg border-2 border-nb-border overflow-hidden">
                    <div className="h-full transition-all" style={{ width: `${pct}%`, background: done ? '#22c55e' : pct > 80 ? '#ff8a00' : '#2f6bff' }} />
                  </div>
                  <div className="flex gap-2 mt-3">
                    <NeubruBtn size="sm" color="yellow" className="nb-btn-icon" onClick={() => openEditGoal(g)}>✎</NeubruBtn>
                    <NeubruBtn size="sm" color="red" className="nb-btn-icon" onClick={() => deleteSavingsGoal(g.id)}>✕</NeubruBtn>
                  </div>
                </NeubruCard>
              )
            })}
          </div>
        </div>
      )}

      {recurring.length > 0 && (
        <div className="mb-7">
          <h3 className="mb-3">🔁 Transaksi Berulang</h3>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {recurring.map((r) => (
              <NeubruCard key={r.id}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xl">{r.type === 'income' ? '💰' : '💳'}</span>
                  <NeubruTag label={FREQ_LABEL[r.frequency] || r.frequency} color="purple" />
                </div>
                <div className="font-bold text-sm">{r.name}</div>
                <div className={`font-mono font-extrabold ${r.type === 'income' ? 'text-nb-green' : 'text-nb-red'}`}>
                  {r.type === 'income' ? '+' : '-'}{formatCurrency(r.amount)}
                </div>
                <div className="text-xs text-nb-fg-muted mt-1 flex items-center justify-between">
                  <NeubruTag label={r.category} color={CAT_COLORS[r.category] || 'yellow'} />
                  <span>Berikutnya {formatShortDate(r.nextDate)}</span>
                </div>
                <div className="flex gap-2 mt-3 items-center flex-wrap">
                  <NeubruBtn size="sm" color={r.active ? 'green' : 'blue'} onClick={() => toggleRecurring(r.id, !r.active)}>
                    {r.active ? 'Aktif' : 'Nonaktif'}
                  </NeubruBtn>
                  <NeubruBtn size="sm" color="yellow" className="nb-btn-icon" onClick={() => openEditRecurring(r)}>✎</NeubruBtn>
                  <NeubruBtn size="sm" color="red" className="nb-btn-icon" onClick={() => deleteRecurring(r.id)}>✕</NeubruBtn>
                </div>
              </NeubruCard>
            ))}
          </div>
        </div>
      )}

      {budgetSpending.length > 0 && (
        <div className="mb-7">
          <h3 className="mb-3">🎯 Budget</h3>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {budgetSpending.map((b) => (
              <NeubruCard key={b.id}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold uppercase text-nb-fg-muted">{b.category}</span>
                  <NeubruTag label={`${b.pct}%`} color={b.pct > 80 ? 'red' : 'green'} />
                </div>
                <div className="font-mono font-extrabold text-sm">{formatCurrency(b.spent)} <span className="text-xs opacity-50">/ {formatCurrency(b.limit)}</span></div>
                <div className="mt-2 h-3 bg-nb-bg border-2 border-nb-border overflow-hidden">
                  <div className="h-full transition-all" style={{ width: `${b.pct}%`, background: b.pct > 80 ? '#ff4b4b' : '#22c55e' }} />
                </div>
                <NeubruBtn size="sm" color="red" className="mt-3" onClick={() => deleteBudget(b.id)}>Hapus Budget</NeubruBtn>
              </NeubruCard>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex gap-2 flex-wrap items-center">
          {(['all', 'income', 'expense'] as const).map((f) => (
            <NeubruBtn key={f} size="sm" color={filter === f ? 'yellow' : undefined} onClick={() => setFilter(f)}>
              {f === 'all' ? 'Semua' : f === 'income' ? '💰 Masuk' : '💳 Keluar'}
            </NeubruBtn>
          ))}
          <NeubruInput size="sm" value={monthFilter} onChange={setMonthFilter} placeholder="2026-08" className="!w-[130px]" />
          <div className="relative" ref={exportMenuRef}>
            <NeubruBtn size="sm" color="blue" onClick={() => setShowExportMenu(!showExportMenu)}>📥 Export</NeubruBtn>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 nb-panel bg-nb-bg border-2 border-nb-border shadow-[5px_5px_0_#0b0b0b] min-w-[140px]">
                <button className="block w-full text-left px-3 py-2 text-sm font-bold hover:bg-nb-yellow/20 cursor-pointer" onClick={() => { exportCSV(filtered); setShowExportMenu(false) }}>📄 Export CSV</button>
                <BlobProvider document={<TransactionPDF {...generatePDFProps(filtered)} />}>
                  {({ url, loading }) => (
                    <button className="block w-full text-left px-3 py-2 text-sm font-bold hover:bg-nb-yellow/20 cursor-pointer" disabled={loading} onClick={() => { if (url) { const a = document.createElement('a'); a.href = url; a.download = 'transactions.pdf'; a.click() } setShowExportMenu(false) }}>
                      {loading ? '⏳ Loading...' : '📑 Export PDF'}
                    </button>
                  )}
                </BlobProvider>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[180px]">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-nb-fg-muted text-sm">🔍</span>
            <NeubruInput value={searchQuery} onChange={setSearchQuery} placeholder="Search transactions..." className="!pl-8" />
          </div>
          <NeubruSelect value={filterAccount} onChange={setFilterAccount} options={[{ value: '', label: 'All Accounts' }, ...accounts.map((a) => ({ value: a.id, label: `${ACCOUNT_ICONS[a.type] || '💵'} ${a.name}` }))]} className="!w-[180px]" />
          <NeubruSelect value={filterCategory} onChange={setFilterCategory} options={[{ value: '', label: 'All Categories' }, ...uniqueCategories.map((c) => ({ value: c, label: c }))]} className="!w-[180px]" />
          {activeFilterCount > 0 && (
            <NeubruBtn size="sm" color="red" onClick={() => { setSearchQuery(''); setFilterAccount(''); setFilterCategory(''); setMonthFilter(''); setFilter('all') }}>
              ✕ Clear ({activeFilterCount})
            </NeubruBtn>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="nb-panel text-center py-16">
          <div className="text-5xl mb-3">{activeFilterCount > 0 ? '🔍' : '📭'}</div>
          <div className="font-bold uppercase text-nb-fg-muted">
            {activeFilterCount > 0 ? 'Tidak ada hasil dengan filter ini' : 'Belum ada transaksi'}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((t) => (
            <div key={t.id} className="nb-list-item">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{t.type === 'income' ? '💰' : '💳'}</span>
                <div>
                  <div className="font-bold">{t.description || t.category}</div>
                  <div className="text-xs text-nb-fg-muted flex gap-2 items-center mt-0.5 flex-wrap">
                    <NeubruTag label={t.category} color={CAT_COLORS[t.category] || 'yellow'} />
                    {t.accountId && (() => { const acct = accounts.find((a) => a.id === t.accountId); return acct ? <NeubruTag label={`${ACCOUNT_ICONS[acct.type] || '💵'} ${acct.name}`} color="blue" /> : null })()}
                    {formatDate(t.date)}
                    {(() => {
                      const f = (t as any).flexibility ?? 'flexible'
                      const colors: Record<string, string> = { fixed: '#22c55e', flexible: '#eab308', discretionary: '#ef4444' }
                      const labels: Record<string, string> = { fixed: 'Fixed', flexible: 'Flexible', discretionary: 'Discr.' }
                      return (
                        <span className="flex items-center gap-1 font-bold" style={{ color: colors[f] || '#eab308' }}>
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: colors[f] || '#eab308' }} />
                          {labels[f] || 'Flexible'}
                        </span>
                      )
                    })()}
                    {linkedNotesByTx.has(t.id) && (() => {
                      const linkedNotes = linkedNotesByTx.get(t.id)!
                      return (
                        <span className="relative group cursor-help" title={linkedNotes.map((n) => n.title).join('\n')}>
                          <span className="font-bold text-nb-purple">📝</span>
                          <span className="absolute bottom-full left-0 mb-1 hidden group-hover:block bg-nb-bg border-2 border-nb-border px-2 py-1 text-xs font-bold whitespace-nowrap shadow-nb-sm z-50 max-w-[250px] truncate">
                            {linkedNotes.map((n) => n.title).join(' | ')}
                          </span>
                        </span>
                      )
                    })()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-mono font-bold ${t.type === 'income' ? 'text-nb-green' : 'text-nb-red'}`}>
                  {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                </span>
                <NeubruBtn size="sm" color="yellow" className="nb-btn-icon" onClick={() => openEdit(t)}>✎</NeubruBtn>
                <NeubruBtn size="sm" color="red" className="nb-btn-icon" onClick={() => deleteTransaction(t.id)}>✕</NeubruBtn>
              </div>
            </div>
          ))}
        </div>
      )}

      <NeubruModal open={showTxModal} onClose={() => setShowTxModal(false)} title={editId ? 'Edit Transaksi' : 'Tambah Transaksi'}>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Tipe</label>
            <NeubruSelect value={type} onChange={(v) => { setType(v as 'income' | 'expense'); setCategory(v === 'income' ? 'Gaji' : 'Makan') }} options={[
              { value: 'expense', label: '💳 Pengeluaran' }, { value: 'income', label: '💰 Pemasukan' },
            ]} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Jumlah</label>
            <NeubruInput value={amount} onChange={setAmount} placeholder="50000" type="number" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Kategori</label>
            <NeubruSelect value={category} onChange={setCategory} options={(type === 'income' ? INCOME_CATS : EXPENSE_CATS).map((c) => ({ value: c, label: c }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Tanggal</label>
            <NeubruInput value={date} onChange={setDate} type="date" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Deskripsi</label>
          <NeubruInput value={desc} onChange={setDesc} placeholder="Nasi padang..." />
        </div>
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">🏦 Akun (opsional)</label>
          {accounts.length > 0 ? (
            <NeubruSelect value={txAccountId} onChange={setTxAccountId} options={[
              { value: '', label: '— Pilih Akun —' },
              ...accounts.map((a) => ({ value: a.id, label: `${ACCOUNT_ICONS[a.type] || '💵'} ${a.name} (${formatCurrency(a.balance)})` })),
            ]} />
          ) : (
            <div className="text-xs text-nb-fg-muted border-2 border-nb-border p-2 bg-nb-bg">
              Belum ada akun. <button type="button" className="underline font-bold cursor-pointer" onClick={() => { setShowTxModal(false); setShowAccountModal(true) }}>Buat akun dulu</button>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Fleksibilitas</label>
          <div className="flex gap-2">
            {([
              { key: 'fixed' as const, label: '🟢 Fixed', desc: 'Harus bayar' },
              { key: 'flexible' as const, label: '🟡 Flexible', desc: 'Bisa disesuaikan' },
              { key: 'discretionary' as const, label: '🔴 Discretionary', desc: 'Opsional/mewah' },
            ]).map((opt) => {
              const sel = flexibility === opt.key
              const bg = opt.key === 'fixed' ? '#dcfce7' : opt.key === 'flexible' ? '#fef9c3' : '#fee2e2'
              const borderColor = opt.key === 'fixed' ? '#22c55e' : opt.key === 'flexible' ? '#eab308' : '#ef4444'
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setFlexibility(opt.key)}
                  className="flex-1 px-3 py-2 text-center font-bold text-xs uppercase tracking-wider cursor-pointer transition-all nb-panel"
                  style={{
                    border: sel ? `3px solid ${borderColor}` : '2px solid var(--nb-border, #1a1a1c)',
                    background: sel ? bg : 'var(--nb-bg, #fff)',
                    boxShadow: sel ? `3px 3px 0 ${borderColor}` : undefined,
                  }}
                >
                  <div>{opt.label}</div>
                  <div className="text-[10px] text-nb-fg-muted mt-0.5 normal-case font-medium">{opt.desc}</div>
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex gap-2.5">
          <NeubruBtn color="green" onClick={saveTx}>💾 Simpan</NeubruBtn>
        </div>
      </NeubruModal>

      <NeubruModal open={showBudgetModal} onClose={() => setShowBudgetModal(false)} title="Atur Budget">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Kategori</label>
            <NeubruSelect value={budgetCat} onChange={setBudgetCat} options={EXPENSE_CATS.map((c) => ({ value: c, label: c }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Limit</label>
            <NeubruInput value={budgetLimit} onChange={setBudgetLimit} placeholder="1000000" type="number" />
          </div>
        </div>
        <NeubruBtn color="green" onClick={saveBudget}>💾 Simpan Budget</NeubruBtn>
      </NeubruModal>

      <NeubruModal open={showAccountModal} onClose={() => setShowAccountModal(false)} title={acctEditId ? 'Edit Akun' : 'Tambah Akun'}>
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Nama Akun</label>
          <NeubruInput value={acctName} onChange={setAcctName} placeholder="BCA, Gopay, Kas..." />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Tipe</label>
            <NeubruSelect value={acctType} onChange={setAcctType} options={[
              { value: 'cash', label: '💵 Tunai' }, { value: 'bank', label: '🏦 Bank' },
              { value: 'ewallet', label: '📱 E-Wallet' }, { value: 'credit', label: '💳 Kartu Kredit' },
            ]} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Saldo Awal</label>
            <NeubruInput value={acctBalance} onChange={setAcctBalance} type="number" placeholder="0" />
          </div>
        </div>
        <NeubruBtn color="green" onClick={saveAccount}>💾 Simpan Akun</NeubruBtn>
      </NeubruModal>

      <NeubruModal open={showGoalModal} onClose={() => setShowGoalModal(false)} title={goalEditId ? 'Edit Tabungan' : 'Tambah Tabungan'}>
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Nama Goal</label>
          <NeubruInput value={goalName} onChange={setGoalName} placeholder="Liburan Bali..." />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Target</label>
            <NeubruInput value={goalTarget} onChange={setGoalTarget} type="number" placeholder="5000000" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Terkumpul</label>
            <NeubruInput value={goalSaved} onChange={setGoalSaved} type="number" placeholder="0" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Deadline (opsional)</label>
          <NeubruInput value={goalDeadline} onChange={setGoalDeadline} type="date" />
        </div>
        <NeubruBtn color="green" onClick={saveGoal}>💾 Simpan Goal</NeubruBtn>
      </NeubruModal>

      <NeubruModal open={showRecurringModal} onClose={() => setShowRecurringModal(false)} title={recEditId ? 'Edit Transaksi Berulang' : 'Tambah Transaksi Berulang'}>
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Nama</label>
          <NeubruInput value={recName} onChange={setRecName} placeholder="Gaji, Cicilan motor, Sewa..." />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Tipe</label>
            <NeubruSelect value={recType} onChange={(v) => { setRecType(v as 'income' | 'expense'); setRecCategory(v === 'income' ? 'Gaji' : 'Makan') }} options={[
              { value: 'expense', label: '💳 Pengeluaran' }, { value: 'income', label: '💰 Pemasukan' },
            ]} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Jumlah</label>
            <NeubruInput value={recAmount} onChange={setRecAmount} type="number" placeholder="500000" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Kategori</label>
            <NeubruSelect value={recCategory} onChange={setRecCategory} options={(recType === 'income' ? INCOME_CATS : EXPENSE_CATS).map((c) => ({ value: c, label: c }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Frekuensi</label>
            <NeubruSelect value={recFreq} onChange={setRecFreq} options={[
              { value: 'daily', label: 'Harian' }, { value: 'weekly', label: 'Mingguan' },
              { value: 'monthly', label: 'Bulanan' }, { value: 'yearly', label: 'Tahunan' },
            ]} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Tanggal Berikutnya</label>
          <NeubruInput value={recNext} onChange={setRecNext} type="date" />
        </div>
        {recEditId && (
          <div className="flex items-center gap-2 mb-4">
            <input type="checkbox" id="recActive" checked={recActive} onChange={(e) => setRecActive(e.target.checked)} className="w-4 h-4 border-2 border-nb-border" />
            <label htmlFor="recActive" className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted cursor-pointer">Aktif</label>
          </div>
        )}
        <NeubruBtn color="green" onClick={saveRecurring}>💾 Simpan Recurring</NeubruBtn>
      </NeubruModal>

      <NeubruModal open={showTransferModal} onClose={() => setShowTransferModal(false)} title="🔄 Transfer Antar Akun">
        {accounts.length < 2 ? (
          <p className="text-sm text-nb-fg-muted">Minimal butuh 2 akun untuk transfer.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Dari Akun</label>
                <NeubruSelect value={transferFrom} onChange={setTransferFrom} options={[{ value: '', label: '— Pilih Akun —' }, ...accounts.map((a) => ({ value: a.id, label: `${ACCOUNT_ICONS[a.type] || '💵'} ${a.name} (${formatCurrency(a.balance)})` }))]} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Ke Akun</label>
                <NeubruSelect value={transferTo} onChange={setTransferTo} options={[{ value: '', label: '— Pilih Akun —' }, ...accounts.map((a) => ({ value: a.id, label: `${ACCOUNT_ICONS[a.type] || '💵'} ${a.name} (${formatCurrency(a.balance)})` }))]} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5 mb-4">
              <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Jumlah</label>
              <NeubruInput value={transferAmount} onChange={setTransferAmount} type="number" placeholder="100000" />
            </div>
            <div className="flex flex-col gap-1.5 mb-4">
              <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Catatan (opsional)</label>
              <NeubruInput value={transferDesc} onChange={setTransferDesc} placeholder="Dari BCA ke Gopay..." />
            </div>
            <NeubruBtn color="orange" onClick={saveTransfer}>🔄 Transfer</NeubruBtn>
          </>
        )}
      </NeubruModal>

      {/* ── CSV Import Modal ── */}
      <NeubruModal open={showImportModal} onClose={() => { setShowImportModal(false); setImportPreview([]) }} title="📥 Import CSV">
        {importPreview.length === 0 ? (
          <p className="text-sm text-nb-fg-muted">Parsing CSV...</p>
        ) : (
          <>
            <div className="flex gap-3 mb-4 text-sm flex-wrap">
              <span className="font-bold">📄 {importFile?.name}</span>
              <span className="text-nb-fg-muted">{importPreview.length} rows detected</span>
            </div>
            {/* Preview table */}
            <div className="border-2 border-nb-border mb-4 max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-nb-bg">
                    <th className="p-2 text-left border-b-2 border-nb-border font-bold uppercase">Date</th>
                    <th className="p-2 text-left border-b-2 border-nb-border font-bold uppercase">Description</th>
                    <th className="p-2 text-left border-b-2 border-nb-border font-bold uppercase">Category</th>
                    <th className="p-2 text-right border-b-2 border-nb-border font-bold uppercase">Amount</th>
                    <th className="p-2 text-center border-b-2 border-nb-border font-bold uppercase">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.slice(0, 6).map((row, i) => (
                    <tr key={i} className="border-b border-nb-border/30 hover:bg-nb-yellow/10">
                      <td className="p-2 font-mono">{row.date}</td>
                      <td className="p-2 max-w-[200px] truncate">{row.description}</td>
                      <td className="p-2"><NeubruTag label={row.category} color={CAT_COLORS[row.category] || 'yellow'} /></td>
                      <td className={`p-2 text-right font-mono font-bold ${row.type === 'income' ? 'text-nb-green' : 'text-nb-red'}`}>
                        {row.type === 'income' ? '+' : '-'}{formatCurrency(row.amount)}
                      </td>
                      <td className="p-2 text-center">{row.type === 'income' ? '💰' : '💳'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {importDuplicates > 0 && (
              <div className="text-xs text-nb-fg-muted mb-4">⚠️ {importDuplicates} duplicates skipped</div>
            )}
            <div className="flex gap-2.5">
              <NeubruBtn color="green" onClick={executeImport} disabled={importing}>
                {importing ? '⏳ Importing...' : `📥 Import ${importPreview.length} transactions`}
              </NeubruBtn>
              <NeubruBtn color="red" onClick={() => { setShowImportModal(false); setImportPreview([]) }}>Cancel</NeubruBtn>
            </div>
          </>
        )}
      </NeubruModal>
    </div>
  )
}
