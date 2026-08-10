import { useEffect, useMemo, useState } from 'react'
import { useFinanceStore } from '../../stores/financeStore'
import { useWealthStore } from '../../stores/wealthStore'
import { useNetWorthStore } from '../../stores/netWorthStore'
import { useTodoStore } from '../../stores/todoStore'
import { useAuthStore } from '../../stores/authStore'
import { useAchievementStore, ACHIEVEMENTS } from '../../stores/achievementStore'
import { useCheckinStore } from '../../stores/checkinStore'
import { useNotesStore } from '../../stores/notesStore'
import { useLevelStore, xpInCurrentLevel, xpNeededForNextLevel } from '../../stores/levelStore'
import { NeubruCard, NeubruTag, NeubruBtn, NeubruInput, FinancialPet } from '../../components'
import FortuneTeller from '../../components/FortuneTeller'
import OnThisDay from '../../components/OnThisDay'
import MonthlyCard from '../../components/MonthlyCard'
import { formatDate, formatShortDate, formatMonthShort, todayStr } from '@wos/shared'
import { useFormatCurrency } from '../../stores/useFormatCurrency'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts'

const COLORS = ['#ffd800', '#2f6bff', '#22c55e', '#8b5cf6', '#ff8a00', '#ff5c8a']
const CAT_COLORS: Record<string, 'yellow' | 'blue' | 'green' | 'pink' | 'orange' | 'purple' | 'red'> = {
  Gaji: 'green', Freelance: 'blue', Investasi: 'purple', Bisnis: 'orange',
  Makan: 'yellow', Transport: 'blue', Belanja: 'pink', Hiburan: 'orange',
  Tagihan: 'red', Kesehatan: 'pink', Pendidikan: 'purple', Lainnya: 'yellow',
  Transfer: 'blue',
}

function pctChange(cur: number, prev: number): { pct: number; dir: 1 | -1 | 0; isNew?: boolean } | null {
  if (prev === 0) return cur === 0 ? null : { pct: 0, dir: 1, isNew: true }
  const pct = Math.round(((cur - prev) / prev) * 100)
  return { pct, dir: pct > 0 ? 1 : pct < 0 ? -1 : 0 }
}

type DateFilter = 'today' | 'month' | 'year' | 'custom' | 'all'

function DailyCheckinWidget() {
  const todayChecked = useCheckinStore((s) => s.todayChecked)
  const todayMood = useCheckinStore((s) => s.todayMood)
  const todayEnergy = useCheckinStore((s) => s.todayEnergy)
  const MOOD_EMOJIS = ['😫', '😐', '🙂', '😊', '🔥']

  if (todayChecked) {
    return (
      <>
        <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">🧘 Daily Check-in</div>
        <div className="text-xl font-extrabold">
          {MOOD_EMOJIS[todayMood - 1] || '🙂'}
          {' · '}
          <span className="text-nb-yellow">{'⚡'.repeat(todayEnergy)}</span>
        </div>
        <div className="text-xs text-nb-green mt-1 font-medium">Checked in today!</div>
      </>
    )
  }

  return (
    <>
      <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">🧘 Daily Check-in</div>
      <div className="text-nb-orange font-mono text-lg font-extrabold">🧘 Check in</div>
      <div className="text-xs text-nb-fg-muted mt-1 font-medium">How are you today?</div>
    </>
  )
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function LifeScoreMini() {
  const transactions = useFinanceStore((s) => s.transactions)
  const accounts = useFinanceStore((s) => s.accounts)
  const entries = useNetWorthStore((s) => s.entries)
  const todos = useTodoStore((s) => s.todos)
  const notes = useNotesStore((s) => s.notes)

  const lifeScore = useMemo(() => {
    // Wealth score (simplified — same as FIRE health score)
    const now = new Date()
    const sixMoAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1)
    const cutoff = sixMoAgo.toISOString().slice(0, 7)

    const recentTx = transactions.filter((t) => t.date >= cutoff)
    const totalExpense = recentTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const totalIncome = recentTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const months = Math.max(1, (now.getFullYear() - sixMoAgo.getFullYear()) * 12 + (now.getMonth() - sixMoAgo.getMonth() + 1))
    const avgIncome = Math.round(totalIncome / months)
    const avgExpense = Math.round(totalExpense / months)

    const cashBank = accounts.filter((a) => a.type === 'cash' || a.type === 'bank').reduce((s, a) => s + a.balance, 0)

    const rawSavingsRate = avgIncome > 0 ? ((avgIncome - avgExpense) / avgIncome) * 100 : 0
    const savingsScore = Math.min(30, Math.round((Math.max(0, rawSavingsRate) / 50) * 30))

    const runwayMonths = avgExpense > 0 ? cashBank / avgExpense : 0
    const runwayScore = Math.min(25, Math.round((Math.min(runwayMonths, 12) / 12) * 25))

    const sortedEntries = [...entries].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    const latestEntry = sortedEntries[0]
    const totalDebt = latestEntry?.totalLiabilities ?? 0
    const totalAssetNW = latestEntry?.totalAssets ?? 0
    const debtRatio = totalAssetNW > 0 ? totalDebt / totalAssetNW : 0
    const debtScore = Math.min(25, Math.round(Math.max(0, 1 - debtRatio) * 25))

    let growthScore = 0
    if (sortedEntries.length >= 2) {
      const sixMoDate = sixMoAgo.toISOString().slice(0, 10)
      const latestNW = sortedEntries[0]?.netWorth ?? 0
      const oldEntry = sortedEntries.find((e) => (e.date ?? '') <= sixMoDate)
      const oldNW = oldEntry ? oldEntry.netWorth : (sortedEntries[sortedEntries.length - 1]?.netWorth ?? 0)
      if (oldNW > 0) {
        const growthPct = ((latestNW - oldNW) / oldNW) * 100
        growthScore = Math.min(20, Math.round(Math.max(0, growthPct) * 2))
      } else if (latestNW > 0) growthScore = 20
    }

    const wealthScore = Math.min(100, savingsScore + runwayScore + debtScore + growthScore)

    // Productivity score
    const totalTodos = todos.length
    const completedTodos = todos.filter((t) => t.completed).length
    const completionRate = totalTodos > 0 ? completedTodos / totalTodos : 0
    const completionTodoScore = Math.min(60, Math.round(completionRate * 60))
    const weekAgo = daysAgo(7)
    const doneThisWeek = todos.filter((t) => t.completed && t.updatedAt >= weekAgo).length
    const weeklyTaskScore = Math.min(40, doneThisWeek * 10)
    const productivityScore = Math.min(100, completionTodoScore + weeklyTaskScore)

    // Mind score
    const thirtyDaysAgo = daysAgo(30)
    const recentNotes = notes.filter((n) => n.createdAt >= thirtyDaysAgo)
    const notesScore = Math.min(40, recentNotes.length * 8)
    const journalNotes = notes.filter((n) => {
      const t = (n.title + ' ' + n.content).toLowerCase()
      return t.includes('journal') || t.includes('diary') || t.includes('reflection')
    })
    const recentJournals = journalNotes.filter((n) => n.createdAt >= thirtyDaysAgo)
    const journalDays = new Set(recentJournals.map((n) => n.createdAt.slice(0, 10)))
    const journalScore = Math.min(35, journalDays.size * 7)
    const learningNotes = notes.filter((n) => {
      const t = (n.title + ' ' + n.content).toLowerCase()
      return t.includes('learning') || t.includes('course') || t.includes('study') || t.includes('belajar')
    })
    const recentLearning = learningNotes.filter((n) => n.createdAt >= thirtyDaysAgo)
    const learningScore = Math.min(25, recentLearning.length * 5)
    const mindScore = Math.min(100, notesScore + journalScore + learningScore)

    // Average with estimated Vitality and Social at 50
    const estimatedVitality = 50
    const estimatedSocial = 50
    return Math.round((wealthScore + estimatedVitality + mindScore + productivityScore + estimatedSocial) / 5)
  }, [transactions, accounts, entries, todos, notes])

  const scoreColor = lifeScore >= 65 ? 'var(--color-nb-green)' : lifeScore >= 45 ? 'var(--color-nb-orange)' : 'var(--color-nb-red)'
  const label = lifeScore >= 65 ? 'Good' : lifeScore >= 45 ? 'Fair' : 'Needs Love'

  return (
    <div className="cursor-pointer" onClick={() => (window as any).__wosNavigate?.('life')} title="View full Life Score">
      <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">🧠 Life Score</div>
      <div className="font-mono text-xl font-extrabold" style={{ color: scoreColor }}>
        {lifeScore}/100
      </div>
      <div className="text-xs text-nb-fg-muted mt-1 font-medium">{label} · click for full</div>
      {/* Mini sparkline bar of 5 dimensions */}
      <div className="flex gap-0.5 mt-2">
        {[
          { label: 'W', score: (() => {
            const n = new Date()
            const sm = new Date(n.getFullYear(), n.getMonth() - 6, 1)
            const cut = sm.toISOString().slice(0, 7)
            const rTx = transactions.filter((t) => t.date >= cut)
            const tInc = rTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
            const tExp = rTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
            const ms = Math.max(1, (n.getFullYear() - sm.getFullYear()) * 12 + (n.getMonth() - sm.getMonth() + 1))
            const aInc = tInc / ms; const aExp = tExp / ms
            const c = accounts.filter((a) => a.type === 'cash' || a.type === 'bank').reduce((s, a) => s + a.balance, 0)
            const sR = aInc > 0 ? ((aInc - aExp) / aInc) * 100 : 0
            const ss = Math.min(30, Math.round((Math.max(0, sR) / 50) * 30))
            const rM = aExp > 0 ? c / aExp : 0
            const rs = Math.min(25, Math.round((Math.min(rM, 12) / 12) * 25))
            return Math.min(100, ss + rs + 25 + 20)
          })(), color: 'var(--color-nb-blue)' },
          { label: 'V', score: 50, color: 'var(--color-nb-green)' },
          { label: 'M', score: (() => {
            const tda = daysAgo(30)
            const rN = notes.filter((n) => n.createdAt >= tda)
            const ns = Math.min(40, rN.length * 8)
            const jN = notes.filter((n) => {
              const t = (n.title + ' ' + n.content).toLowerCase()
              return t.includes('journal') || t.includes('diary') || t.includes('reflection')
            }).filter((n) => n.createdAt >= tda)
            const jD = new Set(jN.map((n) => n.createdAt.slice(0, 10)))
            const js = Math.min(35, jD.size * 7)
            const lN = notes.filter((n) => {
              const t = (n.title + ' ' + n.content).toLowerCase()
              return t.includes('learning') || t.includes('course') || t.includes('study') || t.includes('belajar')
            }).filter((n) => n.createdAt >= tda)
            const ls = Math.min(25, lN.length * 5)
            return Math.min(100, ns + js + ls)
          })(), color: 'var(--color-nb-orange)' },
          { label: 'P', score: (() => {
            const tt = todos.length
            const ct = todos.filter((t) => t.completed).length
            const cr = tt > 0 ? ct / tt : 0
            const cts = Math.min(60, Math.round(cr * 60))
            const wa = daysAgo(7)
            const dtw = todos.filter((t) => t.completed && t.updatedAt >= wa).length
            const wts = Math.min(40, dtw * 10)
            return Math.min(100, cts + wts)
          })(), color: 'var(--color-nb-pink)' },
          { label: 'S', score: 50, color: 'var(--color-nb-purple)' },
        ].map((dim) => (
          <div
            key={dim.label}
            className="flex-1 flex flex-col items-center gap-0.5"
            title={`${dim.label}: ${dim.score}/100`}
          >
            <span className="text-[9px] font-bold text-nb-fg-muted">{dim.label}</span>
            <div className="w-full h-6 bg-nb-bg-alt border border-nb-border overflow-hidden">
              <div
                className="w-full transition-all duration-500"
                style={{ height: `${dim.score}%`, background: dim.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const userId = useAuthStore((s) => s.userId)
  const formatCurrency = useFormatCurrency()
  const { transactions, budgets, accounts, savingsGoals, recurring, fetchAll: fetchFinance } = useFinanceStore()
  const { assets, fetchAll: fetchWealth } = useWealthStore()
  const { entries, fetchAll: fetchNetWorth } = useNetWorthStore()
  const { todos, fetchAll: fetchTodo } = useTodoStore()
  const { unlocked, checkAll, getLastUnlocked } = useAchievementStore()
  const { xp, level, skillPoints } = useLevelStore()

  const [loaded, setLoaded] = useState(false)
  const [dateFilter, setDateFilter] = useState<DateFilter>('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  useEffect(() => {
    if (!userId) return
    Promise.all([fetchFinance(userId), fetchWealth(userId), fetchNetWorth(userId), fetchTodo(userId)])
      .then(() => setLoaded(true))
      .catch((err) => {
        console.error('[Dashboard] load failed:', err)
        setLoaded(true) // Still show dashboard; individual sections handle empty data
      })
  }, [userId, fetchFinance, fetchWealth, fetchNetWorth, fetchTodo])

  // Check achievements after data is loaded
  useEffect(() => {
    if (!loaded) return
    const prevUnlocked = [...unlocked]
    checkAll()
    // Check if new achievement was unlocked
    const currentUnlocked = useAchievementStore.getState().unlocked
    if (currentUnlocked.length > prevUnlocked.length) {
      ;(window as any).__wosConfetti?.()
    }
  }, [loaded, checkAll, unlocked])

  const today = todayStr()
  const thisMonthKey = today.slice(0, 7)
  const thisYear = today.slice(0, 4)

  const filteredTx = useMemo(() => {
    if (dateFilter === 'today') return transactions.filter((t) => t.date === today)
    if (dateFilter === 'month') return transactions.filter((t) => t.date.startsWith(thisMonthKey))
    if (dateFilter === 'year') return transactions.filter((t) => t.date.startsWith(thisYear))
    if (dateFilter === 'custom' && customStart && customEnd) {
      return transactions.filter((t) => t.date >= customStart && t.date <= customEnd)
    }
    return transactions
  }, [transactions, dateFilter, today, thisMonthKey, thisYear, customStart, customEnd])

  const prevMonthKey = useMemo(() => {
    const parts = thisMonthKey.split('-')
    const y = Number(parts[0])
    const m = Number(parts[1])
    const d = new Date(y, m - 2, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [thisMonthKey])

  const monthIncome = useMemo(() => filteredTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0), [filteredTx])
  const monthExpense = useMemo(() => filteredTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [filteredTx])
  const monthNet = monthIncome - monthExpense

  const prevIncome = useMemo(() => transactions.filter((t) => t.type === 'income' && t.date.startsWith(prevMonthKey)).reduce((s, t) => s + t.amount, 0), [transactions, prevMonthKey])
  const prevExpense = useMemo(() => transactions.filter((t) => t.type === 'expense' && t.date.startsWith(prevMonthKey)).reduce((s, t) => s + t.amount, 0), [transactions, prevMonthKey])

  const incomeChange = dateFilter === 'month' ? pctChange(monthIncome, prevIncome) : null
  const expenseChange = dateFilter === 'month' ? pctChange(monthExpense, prevExpense) : null
  const savingsRate = monthIncome > 0 ? Math.max(0, Math.round((monthNet / monthIncome) * 100)) : 0

  const assetTotal = useMemo(() => assets.reduce((s, a) => s + a.quantity * a.unitPrice, 0), [assets])
  const latestNW = useMemo(() => {
    if (entries.length === 0) return 0
    return entries.reduce((a, b) => (a.date ?? '') > (b.date ?? '') ? a : b).netWorth
  }, [entries])
  const activeTodos = useMemo(() => todos.filter((t) => !t.completed).slice(0, 5), [todos])

  const monthlyCashFlow = useMemo(() => {
    const now = new Date()
    const months: { key: string; income: number; expense: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, income: 0, expense: 0 })
    }
    transactions.forEach((t) => {
      const bucket = months.find((m) => m.key === t.date.slice(0, 7))
      if (!bucket) return
      if (t.type === 'income') bucket.income += t.amount
      else bucket.expense += t.amount
    })
    return months.map((m) => ({ ...m, label: formatMonthShort(m.key) }))
  }, [transactions])

  const categoryPie = useMemo(() => {
    const map: Record<string, number> = {}
    filteredTx.filter((t) => t.type === 'expense').forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount
    })
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }))
  }, [filteredTx])

  const budgetProgress = useMemo(() => {
    return budgets.map((b) => {
      const spent = filteredTx.filter((t) => t.type === 'expense' && t.category === b.category).reduce((s, t) => s + t.amount, 0)
      return { ...b, spent, pct: Math.min(Math.round((spent / b.limit) * 100), 100) }
    })
  }, [budgets, filteredTx])

  const recentTransactions = useMemo(() => [...filteredTx].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7), [filteredTx])

  const goalTotals = useMemo(() => {
    const total = savingsGoals.reduce((s, g) => s + g.targetAmount, 0)
    const saved = savingsGoals.reduce((s, g) => s + g.savedAmount, 0)
    return { total, saved, pct: total ? Math.min(Math.round((saved / total) * 100), 100) : 0 }
  }, [savingsGoals])

  const netWorthTrend = useMemo(() => {
    return [...entries]
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
      .map((e) => ({ label: formatShortDate(e.date ?? ''), net: e.netWorth }))
  }, [entries])

  const recurringUpcoming = useMemo(() => {
    return recurring.filter((r) => r.active).sort((a, b) => a.nextDate.localeCompare(b.nextDate)).slice(0, 5)
  }, [recurring])

  const budgetWarnings = budgetProgress.filter((b) => b.pct > 80).length

  const flexibilityBreakdown = useMemo(() => {
    const expenses = filteredTx.filter((t) => t.type === 'expense')
    const fixed = expenses.filter((t) => (t as any).flexibility === 'fixed').reduce((s, t) => s + t.amount, 0)
    const flexible = expenses.filter((t) => (t as any).flexibility === 'flexible' || !(t as any).flexibility).reduce((s, t) => s + t.amount, 0)
    const discretionary = expenses.filter((t) => (t as any).flexibility === 'discretionary').reduce((s, t) => s + t.amount, 0)
    const total = fixed + flexible + discretionary
    const fixedPct = total > 0 ? Math.round((fixed / total) * 100) : 0
    const flexPct = total > 0 ? Math.round((flexible / total) * 100) : 0
    const discPct = total > 0 ? Math.round((discretionary / total) * 100) : 0
    return { fixed, flexible, discretionary, total, fixedPct, flexPct, discPct }
  }, [filteredTx])

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-lg font-bold uppercase text-nb-fg-muted animate-pulse">Loading dashboard...</span>
      </div>
    )
  }

  const changeBadge = (c: { pct: number; dir: 1 | -1 | 0; isNew?: boolean } | null, invert = false) => {
    if (!c) return null
    if (c.isNew) return <span className="text-xs font-bold text-nb-blue">· New</span>
    const up = invert ? c.dir < 0 : c.dir > 0
    const color = c.dir === 0 ? 'text-nb-fg-muted' : up ? 'text-nb-green' : 'text-nb-red'
    const arrow = c.dir === 0 ? '=' : up ? '▲' : '▼'
    return <span className={`text-xs font-bold ${color}`}>· {arrow} {Math.abs(c.pct)}% vs last month</span>
  }

  const filterLabel = (() => {
    if (dateFilter === 'today') return `Today (${formatShortDate(today)})`
    if (dateFilter === 'month') return `This Month (${formatMonthShort(thisMonthKey)})`
    if (dateFilter === 'year') return `This Year (${thisYear})`
    if (dateFilter === 'custom' && customStart && customEnd) return `${formatShortDate(customStart)} – ${formatShortDate(customEnd)}`
    return 'All Time'
  })()

  return (
    <div>
      <div className="flex items-start justify-between mb-7 gap-4 flex-wrap">
        <h2 className="text-[1.8rem]">🏠 Dashboard</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {([
            { key: 'today' as DateFilter, label: '📅 Today' },
            { key: 'month' as DateFilter, label: '📆 This Month' },
            { key: 'year' as DateFilter, label: '🗓️ This Year' },
            { key: 'custom' as DateFilter, label: '📆 Custom' },
            { key: 'all' as DateFilter, label: '⏳ All Time' },
          ]).map((p) => (
            <NeubruBtn key={p.key} size="sm" color={dateFilter === p.key ? 'yellow' : undefined} onClick={() => setDateFilter(p.key)}>
              {p.label}
            </NeubruBtn>
          ))}
          <MonthlyCard />
        </div>
      </div>

      {/* ── Fortune Teller & On This Day ── */}
      <div className="grid grid-cols-2 gap-5 mb-7">
        <FortuneTeller />
        <OnThisDay />
      </div>

      {dateFilter === 'custom' && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <NeubruInput size="sm" type="date" value={customStart} onChange={setCustomStart} className="!w-[160px]" />
          <span className="text-xs font-bold text-nb-fg-muted">to</span>
          <NeubruInput size="sm" type="date" value={customEnd} onChange={setCustomEnd} className="!w-[160px]" />
          <span className="text-xs font-bold text-nb-fg-muted ml-2">{filterLabel}</span>
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-5 mb-7">
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">
            {dateFilter === 'all' ? 'Total Balance' : `Balance (${filterLabel})`}
          </div>
          <div className={`font-mono text-xl font-extrabold ${monthNet >= 0 ? 'text-nb-green' : 'text-nb-red'}`}>{formatCurrency(monthNet)}</div>
          <div className="text-xs text-nb-fg-muted mt-1 font-medium">
            +{formatCurrency(monthIncome)} · -{formatCurrency(monthExpense)}
            {changeBadge(pctChange(monthNet, prevIncome - prevExpense))}
          </div>
        </NeubruCard>
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">XP & Level</div>
          <div className="flex items-center gap-2 mb-1.5">
            <div
              className="w-10 h-10 border-2 border-nb-border bg-nb-yellow flex items-center justify-center font-black text-sm cursor-pointer"
              style={{ boxShadow: '2px 2px 0 #0b0b0b' }}
              title="Click to open Skill Tree"
              onClick={() => (window as any).__wosNavigate?.('skills')}
            >
              {level}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-black text-sm">Lv. {level}</div>
              <div className="text-[10px] text-nb-fg-muted font-bold">
                ✦ {skillPoints} point{skillPoints !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          <div className="h-3 bg-nb-bg border-2 border-nb-border overflow-hidden mb-1">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${(() => { const cur = xpInCurrentLevel(xp); const need = xpNeededForNextLevel(xp); return need > 0 ? Math.min(Math.round((cur / need) * 100), 100) : 100 })()}%`,
                background: 'linear-gradient(90deg, #ffd800, #ff8a00)',
              }}
            />
          </div>
          <div className="text-[10px] font-mono font-bold text-nb-fg-muted">
            ⚡ {xpInCurrentLevel(xp).toLocaleString()} / {xpNeededForNextLevel(xp).toLocaleString()} XP to Lv. {level + 1}
          </div>
        </NeubruCard>
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Income</div>
          <div className="text-nb-green font-mono text-xl font-extrabold">{formatCurrency(monthIncome)}</div>
          <div className="text-xs text-nb-fg-muted mt-1 font-medium">{changeBadge(incomeChange)}</div>
        </NeubruCard>
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Expenses</div>
          <div className="text-nb-red font-mono text-xl font-extrabold">{formatCurrency(monthExpense)}</div>
          <div className="text-xs text-nb-fg-muted mt-1 font-medium">{changeBadge(expenseChange, true)}</div>
        </NeubruCard>
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Savings Rate</div>
          <div className={`font-mono text-xl font-extrabold ${savingsRate >= 20 ? 'text-nb-green' : savingsRate > 0 ? 'text-nb-orange' : 'text-nb-red'}`}>{savingsRate}%</div>
          <div className="text-xs text-nb-fg-muted mt-1 font-medium">of income</div>
        </NeubruCard>
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Total Assets</div>
          <div className="text-nb-blue font-mono text-xl font-extrabold">{formatCurrency(assetTotal)}</div>
          <div className="text-xs text-nb-fg-muted mt-1 font-medium">{assets.length} assets · {accounts.length} accounts</div>
        </NeubruCard>
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Net Worth</div>
          <div className={`font-mono text-xl font-extrabold ${latestNW >= 0 ? 'text-nb-green' : 'text-nb-red'}`}>{formatCurrency(latestNW)}</div>
          <div className="text-xs text-nb-fg-muted mt-1 font-medium">{entries.length} records</div>
        </NeubruCard>
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Savings Goal</div>
          <div className="text-nb-purple font-mono text-xl font-extrabold">{goalTotals.pct}%</div>
          <div className="text-xs text-nb-fg-muted mt-1 font-medium">{formatCurrency(goalTotals.saved)} of {formatCurrency(goalTotals.total)}</div>
        </NeubruCard>
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Active Todos</div>
          <div className="text-nb-orange font-mono text-xl font-extrabold">{activeTodos.length}</div>
          <div className="text-xs text-nb-fg-muted mt-1 font-medium">
            {todos.filter((t) => t.completed).length} completed
            {budgetWarnings > 0 && (
              <span className="text-nb-red ml-2">· ⚠️ {budgetWarnings} budget almost full</span>
            )}
          </div>
        </NeubruCard>
        <NeubruCard>
          <DailyCheckinWidget />
        </NeubruCard>
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Flexible Spend</div>
          <div className="text-nb-orange font-mono text-xl font-extrabold">{formatCurrency(flexibilityBreakdown.flexible + flexibilityBreakdown.discretionary)}</div>
          <div className="text-xs text-nb-fg-muted mt-1 font-medium">
            {flexibilityBreakdown.discretionary > 0 && (
              <span className="text-nb-orange font-bold">Potentially save: {formatCurrency(flexibilityBreakdown.discretionary)}</span>
            )}
          </div>
          {flexibilityBreakdown.total > 0 && (
            <div className="mt-3">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="flex-1 h-3 bg-nb-bg border-2 border-nb-border overflow-hidden flex">
                  <div className="h-full transition-all" style={{ width: `${flexibilityBreakdown.fixedPct}%`, background: '#22c55e' }} title={`Fixed ${flexibilityBreakdown.fixedPct}%`} />
                  <div className="h-full transition-all" style={{ width: `${flexibilityBreakdown.flexPct}%`, background: '#eab308' }} title={`Flexible ${flexibilityBreakdown.flexPct}%`} />
                  <div className="h-full transition-all" style={{ width: `${flexibilityBreakdown.discPct}%`, background: '#ef4444' }} title={`Discr. ${flexibilityBreakdown.discPct}%`} />
                </div>
              </div>
              <div className="flex gap-3 text-[10px] font-bold text-nb-fg-muted">
                <span className="flex items-center gap-1"><span className="w-2 h-2 inline-block" style={{ background: '#22c55e' }} />Fixed {flexibilityBreakdown.fixedPct}%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 inline-block" style={{ background: '#eab308' }} />Flex {flexibilityBreakdown.flexPct}%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 inline-block" style={{ background: '#ef4444' }} />Disc {flexibilityBreakdown.discPct}%</span>
              </div>
            </div>
          )}
        </NeubruCard>
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Achievements</div>
          <div className="text-nb-yellow font-mono text-xl font-extrabold">
            {unlocked.length}/{ACHIEVEMENTS.length}
          </div>
          <div className="text-xs text-nb-fg-muted mt-1 font-medium">
            {(() => {
              const last = getLastUnlocked()
              return last ? <span title={last.desc}>{last.icon} {last.name}</span> : 'No badges yet'
            })()}
          </div>
        </NeubruCard>

        <NeubruCard>
          <LifeScoreMini />
        </NeubruCard>

        <NeubruCard className="!p-0 overflow-visible">
          <FinancialPet />
        </NeubruCard>
      </div>

      <div className="grid grid-cols-2 gap-5 mb-7">
        <NeubruCard>
          <div className="text-sm font-bold uppercase text-nb-fg-muted mb-4">Cash Flow (6 Months)</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyCashFlow}>
              <defs>
                <linearGradient id="dgIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="dgExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff4b4b" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#ff4b4b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1c" opacity={0.12} />
              <XAxis dataKey="label" stroke="#1a1a1c" tick={{ fontSize: 12, fontWeight: 700 }} />
              <YAxis stroke="#1a1a1c" tick={{ fontSize: 10, fontWeight: 700 }} tickFormatter={(v) => v >= 1000000 ? `${Math.round(v / 1000000)}M` : v >= 1000 ? `${Math.round(v / 1000)}K` : String(v)} />
              <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
              <Area type="monotone" dataKey="income" name="Income" stroke="#22c55e" strokeWidth={2.5} fill="url(#dgIncome)" />
              <Area type="monotone" dataKey="expense" name="Expense" stroke="#ff4b4b" strokeWidth={2.5} fill="url(#dgExpense)" />
            </AreaChart>
          </ResponsiveContainer>
        </NeubruCard>

        <NeubruCard>
          <div className="text-sm font-bold uppercase text-nb-fg-muted mb-4">
            Expenses by Category ({filterLabel})
          </div>
          {categoryPie.length === 0 ? (
            <p className="text-sm text-nb-fg-muted">No transactions yet</p>
          ) : (
            <div className="flex items-center gap-2">
              <ResponsiveContainer width="55%" height={220}>
                <PieChart>
                  <Pie data={categoryPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} stroke="#1a1a1c" strokeWidth={2}>
                    {categoryPie.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                {categoryPie.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 border-2 border-nb-border shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="font-bold truncate flex-1">{c.name}</span>
                    <span className="font-mono font-bold text-nb-fg-muted">{formatCurrency(c.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </NeubruCard>
      </div>

      <div className="grid grid-cols-2 gap-5 mb-7">
        <NeubruCard>
          <div className="text-sm font-bold uppercase text-nb-fg-muted mb-4">Net Worth Trend</div>
          {netWorthTrend.length === 0 ? (
            <p className="text-sm text-nb-fg-muted">No net worth records yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={netWorthTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1c" opacity={0.12} />
                <XAxis dataKey="label" stroke="#1a1a1c" tick={{ fontSize: 11, fontWeight: 700 }} />
                <YAxis stroke="#1a1a1c" tick={{ fontSize: 10, fontWeight: 700 }} tickFormatter={(v) => v >= 1000000 ? `${Math.round(v / 1000000)}M` : v >= 1000 ? `${Math.round(v / 1000)}K` : String(v)} />
                <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                <Line type="monotone" dataKey="net" name="Net Worth" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6', stroke: '#1a1a1c', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </NeubruCard>

        <NeubruCard>
          <div className="text-sm font-bold uppercase text-nb-fg-muted mb-4">Budget ({filterLabel})</div>
          {budgetProgress.length === 0 ? (
            <p className="text-sm text-nb-fg-muted">No budgets set. Add one in the Finance page.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={budgetProgress} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1c" opacity={0.12} />
                <XAxis type="number" stroke="#1a1a1c" tick={{ fontSize: 10, fontWeight: 700 }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                <YAxis type="category" dataKey="category" stroke="#1a1a1c" tick={{ fontSize: 11, fontWeight: 700 }} width={70} />
                <Tooltip formatter={(v: any) => `${v}%`} />
                <Bar dataKey="pct" name="Used" radius={0}>
                  {budgetProgress.map((b) => (
                    <Cell key={b.id} fill={b.pct > 80 ? '#ff4b4b' : '#ffd800'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </NeubruCard>
      </div>

      <div className="grid grid-cols-2 gap-5 mb-7">
        <NeubruCard>
          <div className="text-sm font-bold uppercase text-nb-fg-muted mb-4">Recent Transactions ({filterLabel})</div>
          {recentTransactions.length === 0 ? (
            <p className="text-sm text-nb-fg-muted">No transactions yet</p>
          ) : (
            <div className="flex flex-col divide-y divide-nb-border/60 border-2 border-nb-border">
              {recentTransactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-white">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg shrink-0">{t.type === 'income' ? '💰' : '💳'}</span>
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">{t.description || t.category}</div>
                      <div className="text-[11px] text-nb-fg-muted flex items-center gap-1.5">
                        <NeubruTag label={t.category} color={CAT_COLORS[t.category] || 'yellow'} />
                        <span>{formatShortDate(t.date)}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`font-mono font-bold text-sm shrink-0 ${t.type === 'income' ? 'text-nb-green' : 'text-nb-red'}`}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </NeubruCard>

        <div className="flex flex-col gap-5">
          <NeubruCard>
            <div className="text-sm font-bold uppercase text-nb-fg-muted mb-4">Upcoming Recurring</div>
            {recurringUpcoming.length === 0 ? (
              <p className="text-sm text-nb-fg-muted">No active recurring transactions</p>
            ) : (
              <div className="flex flex-col gap-2">
                {recurringUpcoming.map((r) => (
                  <div key={r.id} className="nb-list-item">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{r.type === 'income' ? '💰' : '💳'}</span>
                      <div>
                        <div className="font-bold text-sm">{r.name}</div>
                        <div className="text-[11px] text-nb-fg-muted">Next: {formatDate(r.nextDate)} · {r.frequency}</div>
                      </div>
                    </div>
                    <span className={`font-mono font-bold text-sm ${r.type === 'income' ? 'text-nb-green' : 'text-nb-red'}`}>
                      {r.type === 'income' ? '+' : '-'}{formatCurrency(r.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </NeubruCard>

          <NeubruCard>
            <div className="text-sm font-bold uppercase text-nb-fg-muted mb-4">Upcoming Todos</div>
            {activeTodos.length === 0 ? (
              <p className="text-sm text-nb-fg-muted">All done! 🎉</p>
            ) : (
              <div className="flex flex-col gap-2">
                {activeTodos.map((t) => (
                  <div key={t.id} className="nb-list-item">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 border-2 border-nb-border ${t.priority === 'high' ? 'bg-nb-red' : t.priority === 'medium' ? 'bg-nb-orange' : 'bg-nb-green'}`} />
                      <span className="font-bold text-sm">{t.title}</span>
                    </div>
                    {t.tags.length > 0 && <NeubruTag label={`#${t.tags[0]}`} />}
                  </div>
                ))}
              </div>
            )}
          </NeubruCard>
        </div>
      </div>

      {/* ── Monthly Summary Table ── */}
      <div className="mb-7">
        <NeubruCard>
          <div className="text-sm font-bold uppercase text-nb-fg-muted mb-4">📊 Monthly Breakdown ({filterLabel})</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-2 border-nb-border">
              <thead>
                <tr className="bg-nb-bg border-b-2 border-nb-border">
                  <th className="p-3 text-left font-bold uppercase text-xs tracking-wider">Category</th>
                  <th className="p-3 text-right font-bold uppercase text-xs tracking-wider">Income</th>
                  <th className="p-3 text-right font-bold uppercase text-xs tracking-wider">Expense</th>
                  <th className="p-3 text-right font-bold uppercase text-xs tracking-wider">Net</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const catMap: Record<string, { income: number; expense: number }> = {}
                  filteredTx.forEach((t) => {
                    const entry = catMap[t.category] = catMap[t.category] || { income: 0, expense: 0 }
                    if (t.type === 'income') entry.income += t.amount
                    else entry.expense += t.amount
                  })
                  return Object.entries(catMap)
                    .sort((a, b) => (b[1].income + b[1].expense) - (a[1].income + a[1].expense))
                    .slice(0, 8)
                    .map(([cat, vals]) => {
                      const income = vals?.income ?? 0
                      const expense = vals?.expense ?? 0
                      const net = income - expense
                      return (
                        <tr key={cat} className="border-b border-nb-border/30 hover:bg-nb-yellow/10 transition-colors">
                          <td className="p-3 font-bold"><NeubruTag label={cat} color={CAT_COLORS[cat] || 'yellow'} /></td>
                          <td className="p-3 text-right font-mono text-nb-green">{income > 0 ? formatCurrency(income) : '-'}</td>
                          <td className="p-3 text-right font-mono text-nb-red">{expense > 0 ? formatCurrency(expense) : '-'}</td>
                          <td className={`p-3 text-right font-mono font-bold ${net >= 0 ? 'text-nb-green' : 'text-nb-red'}`}>
                            {net >= 0 ? '+' : ''}{formatCurrency(net)}
                          </td>
                        </tr>
                      )
                    })
                })()}
              </tbody>
            </table>
          </div>
        </NeubruCard>
      </div>

      {/* ── Assets & Savings Side by Side ── */}
      <div className="grid grid-cols-2 gap-5 mb-7">
        <NeubruCard>
          <div className="text-sm font-bold uppercase text-nb-fg-muted mb-4">💎 Portfolio Allocation</div>
          {assets.length === 0 ? (
            <p className="text-sm text-nb-fg-muted">No assets yet. Add some in the Wealth page.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {(() => {
                const byType: Record<string, number> = {}
                assets.forEach((a) => { byType[a.type] = (byType[a.type] || 0) + a.quantity * a.unitPrice })
                const total = Object.values(byType).reduce((s, v) => s + v, 0)
                return Object.entries(byType)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, val]) => {
                    const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0'
                    const colors: Record<string, string> = { stock: '#2f6bff', crypto: '#ff8a00', 'real-estate': '#22c55e', cash: '#ffd800', bonds: '#8b5cf6', other: '#ff5c8a' }
                    return (
                      <div key={type} className="flex items-center gap-3">
                        <span className="w-[90px] font-bold text-xs text-right capitalize">{type}</span>
                        <div className="flex-1 h-5 bg-nb-bg border-2 border-nb-border overflow-hidden">
                          <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: colors[type] || '#ccc' }} />
                        </div>
                        <span className="font-mono text-xs font-bold w-[70px] text-right">{pct}%</span>
                        <span className="font-mono text-xs text-nb-fg-muted w-[100px] text-right">{formatCurrency(val)}</span>
                      </div>
                    )
                  })
              })()}
            </div>
          )}
        </NeubruCard>

        <NeubruCard>
          <div className="text-sm font-bold uppercase text-nb-fg-muted mb-4">🎯 Savings Goals</div>
          {savingsGoals.length === 0 ? (
            <p className="text-sm text-nb-fg-muted">No savings goals yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {savingsGoals.slice(0, 5).map((g) => {
                const pct = Math.min(Math.round((g.savedAmount / g.targetAmount) * 100), 100)
                return (
                  <div key={g.id}>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span>{g.name}</span>
                      <span className="font-mono">{pct}%</span>
                    </div>
                    <div className="h-4 bg-nb-bg border-2 border-nb-border overflow-hidden">
                      <div className="h-full transition-all duration-700" style={{ width: `${pct}%`, background: pct >= 100 ? '#22c55e' : pct > 50 ? '#2f6bff' : '#ffd800' }} />
                    </div>
                    <div className="text-[10px] text-nb-fg-muted mt-0.5 font-mono">
                      {formatCurrency(g.savedAmount)} / {formatCurrency(g.targetAmount)}
                      {g.deadline && <span> · Target: {formatShortDate(g.deadline)}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </NeubruCard>
      </div>
    </div>
  )
}
