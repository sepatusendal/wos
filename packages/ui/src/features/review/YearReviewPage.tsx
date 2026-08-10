import { useEffect, useMemo, useState } from 'react'
import { useFinanceStore } from '../../stores/financeStore'
import { useWealthStore } from '../../stores/wealthStore'
import { useNetWorthStore } from '../../stores/netWorthStore'
import { useHabitStore } from '../../stores/habitStore'
import { useTodoStore } from '../../stores/todoStore'
import { useAuthStore } from '../../stores/authStore'
import { useFormatCurrency } from '../../stores/useFormatCurrency'
import {
  BarChart, Bar, XAxis, YAxis, Cell,
  ResponsiveContainer, Tooltip, LineChart, Line,
} from 'recharts'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

const CAT_COLORS = ['#ffd800', '#2f6bff', '#22c55e', '#8b5cf6', '#ff8a00']

// ── Decorative shape data ──────────────────────────────────
const SHAPES = [
  { top: '5%', left: '5%', w: 80, h: 80, bg: 'bg-nb-yellow', rotate: 'rotate-12', rounded: '' },
  { top: '15%', right: '8%', w: 60, h: 60, bg: 'bg-nb-blue', rotate: '-rotate-6', rounded: 'rounded-full' },
  { bottom: '20%', left: '10%', w: 50, h: 50, bg: 'bg-nb-pink', rotate: 'rotate-45', rounded: '' },
  { bottom: '30%', right: '15%', w: 100, h: 40, bg: 'bg-nb-green', rotate: '-rotate-3', rounded: '' },
  { top: '40%', left: '80%', w: 40, h: 40, bg: 'bg-nb-purple', rotate: 'rotate-12', rounded: 'rounded-full' },
  { top: '70%', left: '3%', w: 70, h: 70, bg: 'bg-nb-orange', rotate: 'rotate-[-8deg]', rounded: '' },
]

export default function YearReviewPage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [loaded, setLoaded] = useState(false)

  const userId = useAuthStore((s) => s.userId)
  const formatCurrency = useFormatCurrency()
  const { transactions, savingsGoals, fetchAll: fetchFinance } = useFinanceStore()
  const { assets: _assets, fetchAll: fetchWealth } = useWealthStore()
  const { entries, fetchAll: fetchNetWorth } = useNetWorthStore()
  const { habits, logs, fetchAll: fetchHabits } = useHabitStore()
  const { todos: _todos, fetchAll: fetchTodos } = useTodoStore()

  useEffect(() => {
    if (!userId) return
    Promise.all([
      fetchFinance(userId),
      fetchWealth(userId),
      fetchNetWorth(userId),
      fetchHabits(userId),
      fetchTodos(userId),
    ])
      .then(() => setLoaded(true))
      .catch(() => setLoaded(true))
  }, [userId, fetchFinance, fetchWealth, fetchNetWorth, fetchHabits, fetchTodos])

  // ── Computed data ────────────────────────────────────────
  const yearTx = useMemo(
    () => transactions.filter((t) => t.date.startsWith(`${year}-`)),
    [transactions, year],
  )

  const totalIncome = useMemo(
    () => yearTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    [yearTx],
  )
  const totalExpenses = useMemo(
    () => yearTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    [yearTx],
  )
  const net = totalIncome - totalExpenses
  const txCount = yearTx.length

  const topMonth = useMemo(() => {
    const byMonth: Record<string, number> = {}
    yearTx
      .filter((t) => t.type === 'income')
      .forEach((t) => {
        const m = t.date.slice(5, 7)
        byMonth[m] = (byMonth[m] || 0) + t.amount
      })
    let best = ''
    let bestVal = 0
    Object.entries(byMonth).forEach(([m, v]) => {
      if (v > bestVal) {
        bestVal = v
        best = m
      }
    })
    return { month: best ? MONTHS[parseInt(best) - 1] : '—', total: bestVal, key: best }
  }, [yearTx])

  const avgDailySpend = useMemo(() => {
    const expenseDates = new Set(yearTx.filter((t) => t.type === 'expense').map((t) => t.date))
    const days = expenseDates.size || 1
    return Math.round(totalExpenses / days)
  }, [yearTx, totalExpenses])

  const topCategories = useMemo(() => {
    const byCat: Record<string, number> = {}
    yearTx
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        byCat[t.category] = (byCat[t.category] || 0) + t.amount
      })
    return Object.entries(byCat)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([cat, amt]) => ({
        category: cat,
        amount: amt,
        pct: totalExpenses > 0 ? Math.round((amt / totalExpenses) * 100) : 0,
      }))
  }, [yearTx, totalExpenses])

  const habitStats = useMemo(() => {
    const yearLogs = logs.filter((l) => l.date.startsWith(`${year}-`))
    const totalCheckins = yearLogs.filter((l) => l.done).length

    let bestHabitName = '—'
    let bestHabitEmoji = '✅'
    let bestCount = 0
    for (const h of habits) {
      const doneCount = yearLogs.filter((l) => l.habitId === h.id && l.done).length
      if (doneCount > bestCount) {
        bestCount = doneCount
        bestHabitName = h.name
        bestHabitEmoji = h.emoji
      }
    }

    const monthGrid = MONTHS.map((mLabel, i) => {
      const monthStr = `${year}-${String(i + 1).padStart(2, '0')}`
      const monthLogs = yearLogs.filter((l) => l.date.startsWith(monthStr) && l.done)
      const totalPossible = habits.length * new Date(year, i + 1, 0).getDate()
      const rate = totalPossible > 0 ? Math.round((monthLogs.length / totalPossible) * 100) : 0
      return { month: mLabel, rate, count: monthLogs.length }
    })

    return { totalCheckins, bestHabitName, bestHabitEmoji, bestCount, monthGrid }
  }, [habits, logs, year])

  const netWorthData = useMemo(() => {
    const yearEntries = entries
      .filter((e) => e.date && e.date.startsWith(`${year}-`))
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))

    const startNw = yearEntries.length > 0 ? (yearEntries[0]?.netWorth ?? 0) : 0
    const endNw = yearEntries.length > 0 ? (yearEntries[yearEntries.length - 1]?.netWorth ?? 0) : 0
    const changePct = startNw > 0 ? Math.round(((endNw - startNw) / startNw) * 100) : 0

    const chartData = yearEntries.map((e) => ({
      label: e.date ? `${MONTHS[parseInt(e.date.slice(5, 7)) - 1]}` : '',
      netWorth: e.netWorth,
    }))

    return { startNw, endNw, changePct, chartData }
  }, [entries, year])

  const goalsData = useMemo(() => {
    const achieved = savingsGoals.filter((g) => g.savedAmount >= g.targetAmount).length
    return { total: savingsGoals.length, achieved, list: savingsGoals }
  }, [savingsGoals])

  const daysTracked = useMemo(() => {
    const dates = new Set(yearTx.map((t) => t.date))
    return dates.size
  }, [yearTx])

  const bestMonthLabel = useMemo(() => {
    const byMonth: Record<string, { income: number; expense: number }> = {}
    yearTx.forEach((t) => {
      const m = t.date.slice(5, 7)
      if (!byMonth[m]) byMonth[m] = { income: 0, expense: 0 }
      if (t.type === 'income') byMonth[m].income += t.amount
      else byMonth[m].expense += t.amount
    })
    let best = ''
    let bestNet = -Infinity
    Object.entries(byMonth).forEach(([m, v]) => {
      const n = v.income - v.expense
      if (n > bestNet) {
        bestNet = n
        best = m
      }
    })
    return best ? MONTHS[parseInt(best) - 1] : '—'
  }, [yearTx])

  const topCatName = topCategories[0]?.category || 'Makan'
  const hasData = yearTx.length > 0

  return (
    <div className="relative max-w-4xl mx-auto pb-20">
      {/* ═══ Year navigation ═══ */}
      <div className="flex items-center justify-center gap-4 mb-10 sticky top-0 z-20 py-4 bg-nb-bg/90 backdrop-blur-sm">
        <button
          onClick={() => setYear((y) => y - 1)}
          className="nb-btn nb-btn-sm"
        >
          ← {year - 1}
        </button>
        <h2 className="text-[1.6rem] font-black px-4">{year}</h2>
        <button
          onClick={() => setYear((y) => y + 1)}
          disabled={year >= currentYear}
          className="nb-btn nb-btn-sm"
        >
          {year + 1} →
        </button>
      </div>

      {/* ═══ Section 1: Hero ═══ */}
      <section className="min-h-[85vh] flex items-center justify-center relative overflow-hidden mb-8">
        {/* Decorative shapes */}
        {SHAPES.map((s, i) => (
          <div
            key={i}
            className={`absolute ${s.bg} ${s.rotate} ${s.rounded} border-3 border-nb-border opacity-30`}
            style={{
              width: s.w,
              height: s.h,
              top: s.top,
              left: s.left,
              right: s.right,
              bottom: s.bottom,
            }}
          />
        ))}
        <div className="text-center relative z-10">
          <div className="text-[10rem] leading-none font-black tracking-tighter text-nb-border">
            {year}
          </div>
          <div className="text-2xl md:text-3xl font-extrabold uppercase tracking-tight mt-2 text-nb-fg-muted">
            Your Financial Year in Review
          </div>
          <div className="text-sm font-bold uppercase tracking-[0.2em] text-nb-fg-muted mt-4">
            powered by WOS
          </div>
          {/* Scroll arrow */}
          <div className="mt-16 animate-bounce">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="mx-auto text-nb-border"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>
      </section>

      {/* ═══ Section 2: The Numbers ═══ */}
      <section className="min-h-[80vh] flex flex-col justify-center mb-8">
        <h3 className="text-4xl font-black uppercase mb-8">The Numbers</h3>
        {!loaded ? (
          <div className="nb-panel text-center py-16">
            <div className="text-5xl mb-3">⏳</div>
            <div className="font-bold uppercase text-nb-fg-muted">Loading data...</div>
          </div>
        ) : !hasData ? (
          <div className="nb-panel text-center py-16">
            <div className="text-5xl mb-3">📭</div>
            <div className="font-bold uppercase text-nb-fg-muted">
              No transactions for {year} yet
            </div>
            <div className="text-xs text-nb-fg-muted mt-2">
              Add some transactions and come back!
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard
              label="Total Income"
              value={formatCurrency(totalIncome)}
              color="text-nb-green"
            />
            <StatCard
              label="Total Expenses"
              value={formatCurrency(totalExpenses)}
              color="text-nb-red"
            />
            <StatCard
              label="Net"
              value={`${net >= 0 ? '+' : ''}${formatCurrency(net)}`}
              color={net >= 0 ? 'text-nb-green' : 'text-nb-red'}
            />
            <StatCard
              label="Top Month"
              value={topMonth.month ?? ''}
              sub={topMonth.total > 0 ? formatCurrency(topMonth.total) : '—'}
              color="text-nb-blue"
            />
            <StatCard
              label="Avg Daily Spending"
              value={formatCurrency(avgDailySpend)}
              color="text-nb-orange"
            />
            <StatCard
              label="Transactions"
              value={`${txCount} total`}
              color="text-nb-purple"
            />
          </div>
        )}
      </section>

      {/* ═══ Section 3: Top Categories ═══ */}
      {hasData && topCategories.length > 0 && (
        <section className="min-h-[80vh] flex flex-col justify-center mb-8">
          <h3 className="text-4xl font-black uppercase mb-3">Top Categories</h3>
          <p className="text-lg font-bold text-nb-fg-muted mb-8">
            Ih, {topCatName} juaranya!
          </p>
          <div className="nb-card mb-6">
            <ResponsiveContainer width="100%" height={topCategories.length * 70 + 40}>
              <BarChart
                data={topCategories.map((c) => ({ name: c.category, amount: c.amount, pct: c.pct }))}
                layout="vertical"
                margin={{ top: 5, right: 40, left: 80, bottom: 5 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 14, fontWeight: 700, fill: '#0b0b0b' }}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                />
                <Tooltip
                  formatter={(v: any) => [formatCurrency(v), 'Amount']}
                  contentStyle={{
                    border: '3px solid #0b0b0b',
                    borderRadius: 0,
                    boxShadow: '5px 5px 0 #0b0b0b',
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 700,
                  }}
                />
                <Bar dataKey="amount" radius={[0, 0, 0, 0]} barSize={28}>
                  {topCategories.map((_, idx) => (
                    <Cell key={idx} fill={CAT_COLORS[idx % CAT_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3">
            {topCategories.map((c, i) => (
              <div
                key={c.category}
                className="nb-tag font-bold text-sm"
                style={{ borderColor: CAT_COLORS[i % CAT_COLORS.length] }}
              >
                <span
                  className="inline-block w-3 h-3 mr-2"
                  style={{ backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }}
                />
                {c.category}: {c.pct}%
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ Section 4: Habits ═══ */}
      <section className="min-h-[80vh] flex flex-col justify-center mb-8">
        <h3 className="text-4xl font-black uppercase mb-8">Habits</h3>
        {habits.length === 0 ? (
          <div className="nb-panel text-center py-12">
            <div className="text-5xl mb-3">🔥</div>
            <div className="font-bold uppercase text-nb-fg-muted">
              No habits tracked yet
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="nb-card">
                <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">
                  Most Consistent Habit
                </div>
                <div className="font-mono text-xl font-extrabold">
                  {habitStats.bestHabitEmoji} {habitStats.bestHabitName}
                </div>
                <div className="text-sm font-bold text-nb-fg-muted mt-1">
                  {habitStats.bestCount} check-ins 🔥
                </div>
              </div>
              <div className="nb-card">
                <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">
                  Total Habit Check-ins
                </div>
                <div className="font-mono text-4xl font-extrabold">
                  {habitStats.totalCheckins.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Monthly consistency grid */}
            <div className="nb-card">
              <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-4">
                Monthly Consistency
              </div>
              <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                {habitStats.monthGrid.map((m) => (
                  <div key={m.month} className="text-center">
                    <div className="text-xs font-bold text-nb-fg-muted mb-1.5">{m.month}</div>
                    <div className="flex justify-center gap-1">
                      {[0, 1, 2, 3, 4].map((dot) => (
                        <div
                          key={dot}
                          className={`w-2.5 h-2.5 rounded-full border-2 border-nb-border ${
                            m.rate > dot * 20 ? 'bg-nb-green' : 'bg-white'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="text-[0.6rem] font-bold text-nb-fg-muted mt-1">
                      {m.count} done
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ═══ Section 5: Net Worth Journey ═══ */}
      <section className="min-h-[80vh] flex flex-col justify-center mb-8">
        <h3 className="text-4xl font-black uppercase mb-8">Net Worth Journey</h3>
        {netWorthData.chartData.length === 0 ? (
          <div className="nb-panel text-center py-12">
            <div className="text-5xl mb-3">📈</div>
            <div className="font-bold uppercase text-nb-fg-muted">
              No net worth entries for {year}
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="nb-card text-center">
                <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">
                  Started At
                </div>
                <div className="font-mono text-lg font-extrabold">
                  {formatCurrency(netWorthData.startNw)}
                </div>
              </div>
              <div className="nb-card text-center">
                <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">
                  Ended At
                </div>
                <div className="font-mono text-lg font-extrabold">
                  {formatCurrency(netWorthData.endNw)}
                </div>
              </div>
              <div className="nb-card text-center">
                <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">
                  Change
                </div>
                <div
                  className={`font-mono text-lg font-extrabold ${
                    netWorthData.changePct >= 0 ? 'text-nb-green' : 'text-nb-red'
                  }`}
                >
                  {netWorthData.changePct >= 0 ? '+' : ''}
                  {netWorthData.changePct}%
                </div>
              </div>
            </div>
            <div className="nb-card">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={netWorthData.chartData}
                  margin={{ top: 10, right: 20, left: 20, bottom: 5 }}
                >
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fontWeight: 700, fill: '#0b0b0b' }}
                    axisLine={{ stroke: '#0b0b0b', strokeWidth: 2 }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v: number) => {
                      if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}jt`
                      if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}rb`
                      return String(v)
                    }}
                    tick={{ fontSize: 12, fontWeight: 700, fill: '#0b0b0b' }}
                    axisLine={{ stroke: '#0b0b0b', strokeWidth: 2 }}
                    tickLine={false}
                    width={60}
                  />
                  <Tooltip
                    formatter={(v: any) => [formatCurrency(v), 'Net Worth']}
                    contentStyle={{
                      border: '3px solid #0b0b0b',
                      borderRadius: 0,
                      boxShadow: '5px 5px 0 #0b0b0b',
                      fontFamily: 'var(--font-sans)',
                      fontWeight: 700,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="netWorth"
                    stroke="#2f6bff"
                    strokeWidth={4}
                    dot={{ fill: '#2f6bff', stroke: '#0b0b0b', strokeWidth: 2, r: 5 }}
                    activeDot={{ fill: '#2f6bff', stroke: '#0b0b0b', strokeWidth: 3, r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </section>

      {/* ═══ Section 6: Goals Recap ═══ */}
      <section className="min-h-[80vh] flex flex-col justify-center mb-8">
        <h3 className="text-4xl font-black uppercase mb-8">Goals Recap</h3>
        {savingsGoals.length === 0 ? (
          <div className="nb-panel text-center py-12">
            <div className="text-5xl mb-3">🎯</div>
            <div className="font-bold uppercase text-nb-fg-muted">
              No savings goals yet
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="nb-card text-center">
                <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">
                  Savings Goals
                </div>
                <div className="font-mono text-3xl font-extrabold">{goalsData.total}</div>
              </div>
              <div className="nb-card text-center">
                <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">
                  Achieved
                </div>
                <div className="font-mono text-3xl font-extrabold text-nb-green">
                  {goalsData.achieved}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              {goalsData.list.map((g) => {
                const pct = Math.min(
                  100,
                  Math.round((g.savedAmount / g.targetAmount) * 100),
                )
                const achieved = pct >= 100
                return (
                  <div key={g.id} className="nb-card">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm uppercase">
                        {achieved ? '✅ ' : ''}{g.name}
                      </span>
                      <span className="font-mono text-sm font-extrabold">
                        {formatCurrency(g.savedAmount)} / {formatCurrency(g.targetAmount)}
                      </span>
                    </div>
                    <div className="w-full h-4 border-3 border-nb-border bg-white">
                      <div
                        className={`h-full transition-all ${
                          achieved ? 'bg-nb-green' : 'bg-nb-yellow'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-right mt-1">
                      <span
                        className={`text-xs font-bold ${
                          achieved ? 'text-nb-green' : 'text-nb-fg-muted'
                        }`}
                      >
                        {pct}%
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>

      {/* ═══ Section 7: Closing ═══ */}
      <section className="min-h-[80vh] flex items-center justify-center relative overflow-hidden">
        {/* Decorative shapes */}
        <div className="absolute top-10 left-10 w-24 h-24 bg-nb-yellow border-3 border-nb-border rotate-12 opacity-30" />
        <div className="absolute bottom-20 right-10 w-20 h-20 bg-nb-pink rounded-full border-3 border-nb-border opacity-30" />
        <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-nb-blue border-3 border-nb-border -rotate-12 opacity-30" />

        <div className="text-center relative z-10">
          <div className="text-6xl md:text-8xl font-black leading-none mb-6">
            Here's to{' '}
            <span className="text-nb-yellow" style={{ WebkitTextStroke: '3px #0b0b0b' }}>
              {year + 1}
            </span>
          </div>
          <div className="text-4xl mb-8">🚀</div>

          {hasData && (
            <div className="space-y-4 max-w-md mx-auto">
              <div className="nb-card">
                <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1">
                  Your money went furthest in
                </div>
                <div className="font-mono text-xl font-extrabold text-nb-green">
                  {bestMonthLabel}
                </div>
              </div>
              <div className="nb-card">
                <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1">
                  You tracked your finances
                </div>
                <div className="font-mono text-xl font-extrabold">
                  {daysTracked} out of 365 days
                </div>
                <div className="w-full h-3 border-3 border-nb-border bg-white mt-2">
                  <div
                    className="h-full bg-nb-blue"
                    style={{ width: `${Math.min(100, Math.round((daysTracked / 365) * 100))}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="mt-10 text-sm font-bold uppercase tracking-[0.15em] text-nb-fg-muted">
            Thanks for using WOS &mdash; Wira OS
          </div>
        </div>
      </section>
    </div>
  )
}

// ── StatCard sub-component ──────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: string
  color: string
}) {
  return (
    <div className="nb-card">
      <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">
        {label}
      </div>
      <div className={`font-mono text-xl md:text-2xl font-extrabold ${color}`}>
        {value}
      </div>
      {sub && (
        <div className="text-xs font-bold text-nb-fg-muted mt-1">{sub}</div>
      )}
    </div>
  )
}
