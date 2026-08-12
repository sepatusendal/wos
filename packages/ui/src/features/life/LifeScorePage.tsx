import { useEffect, useMemo, useState, useCallback } from 'react'
import { useFinanceStore } from '../../stores/financeStore'
import { useNetWorthStore } from '../../stores/netWorthStore'
import { useHabitStore } from '../../stores/habitStore'
import { useTodoStore } from '../../stores/todoStore'
import { useNotesStore } from '../../stores/notesStore'
import { useAuthStore } from '../../stores/authStore'
import { NeubruCard } from '../../components'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts'

// ── Helpers ──────────────────────────────────────────────────

function dateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return dateStr(d)
}

// ── Life Score daily snapshots (localStorage, JSON-per-day like checkinStore) ──

type ScoreSnapshot = Record<string, number>

function snapshotKey(userId: string, date: string): string {
  return `wos_lifescore_${userId}_${date}`
}

function readSnapshot(userId: string, date: string): ScoreSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(snapshotKey(userId, date))
    if (!raw) return null
    return JSON.parse(raw) as ScoreSnapshot
  } catch {
    return null
  }
}

function writeSnapshot(userId: string, snap: ScoreSnapshot): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(snapshotKey(userId, dateStr(new Date())), JSON.stringify(snap))
    // Clean up snapshots older than 90 days
    const cutoff = daysAgo(90)
    const prefix = `wos_lifescore_${userId}_`
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix) && key.slice(prefix.length) < cutoff) {
        localStorage.removeItem(key)
      }
    }
  } catch { /* ignore */ }
}

/** Nearest existing snapshot roughly a week back (7–21 days ago), or null. */
function findBaselineSnapshot(userId: string): ScoreSnapshot | null {
  for (let i = 7; i <= 21; i++) {
    const snap = readSnapshot(userId, daysAgo(i))
    if (snap) return snap
  }
  return null
}

// Load all check-in data from localStorage for last 90 days
function loadCheckinHistory(): { checkedDates: Set<string>; moodSum: number; moodCount: number; energySum: number; energyCount: number } {
  const checkedDates = new Set<string>()
  let moodSum = 0
  let moodCount = 0
  let energySum = 0
  let energyCount = 0

  if (typeof window === 'undefined') return { checkedDates, moodSum, moodCount, energySum, energyCount }

  const today = new Date()
  for (let i = 0; i < 90; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = `checkin_${dateStr(d)}`
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const data = JSON.parse(raw)
        checkedDates.add(dateStr(d))
        if (data.mood) { moodSum += data.mood; moodCount++ }
        if (data.energy) { energySum += data.energy; energyCount++ }
      }
    } catch { /* skip */ }
  }

  return { checkedDates, moodSum, moodCount, energySum, energyCount }
}

// ── Component ────────────────────────────────────────────────

export default function LifeScorePage() {
  const userId = useAuthStore((s) => s.userId)

  // ── Data loading ───────────────────────────────────────────
  const transactions = useFinanceStore((s) => s.transactions)
  const accounts = useFinanceStore((s) => s.accounts)
  const entries = useNetWorthStore((s) => s.entries)
  const habits = useHabitStore((s) => s.habits)
  const habitLogs = useHabitStore((s) => s.logs)
  const todos = useTodoStore((s) => s.todos)
  const notes = useNotesStore((s) => s.notes)

  const [loaded, setLoaded] = useState(false)
  const [socialScore, setSocialScore] = useState(50)

  useEffect(() => {
    if (!userId) return
    const p: Promise<any>[] = []
    const finance = useFinanceStore.getState()
    const netWorth = useNetWorthStore.getState()
    const habit = useHabitStore.getState()
    const todo = useTodoStore.getState()
    if (finance.fetchAll) p.push(finance.fetchAll(userId))
    if (netWorth.fetchAll) p.push(netWorth.fetchAll(userId))
    if (habit.fetchAll) p.push(habit.fetchAll(userId))
    if (todo.fetchAll) p.push(todo.fetchAll(userId))
    Promise.all(p).then(() => setLoaded(true)).catch(() => setLoaded(true))
  }, [userId])

  // Load social from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('wos_life_social_score')
      if (saved) setSocialScore(Number(saved) || 50)
    } catch { /* ignore */ }
  }, [])

  // Track checkin writes so useMemos that call loadCheckinHistory() re-run
  const [checkinVersion, setCheckinVersion] = useState(0)
  useEffect(() => {
    const handler = () => setCheckinVersion((v) => v + 1)
    window.addEventListener('wos:checkin', handler)
    return () => window.removeEventListener('wos:checkin', handler)
  }, [])

  const saveSocial = useCallback((v: number) => {
    setSocialScore(v)
    try { localStorage.setItem('wos_life_social_score', String(v)) } catch { /* ignore */ }
  }, [])

  // ── 💰 Wealth Score (0-100) ────────────────────────────────
  const wealthScore = useMemo(() => {
    // Same formula as FIRE health score
    const now = new Date()
    const sixMoAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1)
    const cutoff = sixMoAgo.toISOString().slice(0, 7)

    const recentTx = transactions.filter((t) => t.date >= cutoff)
    const totalExpense = recentTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const totalIncome = recentTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const months = Math.max(1, (now.getFullYear() - sixMoAgo.getFullYear()) * 12 + (now.getMonth() - sixMoAgo.getMonth() + 1))
    const avgIncome = Math.round(totalIncome / months)
    const avgExpense = Math.round(totalExpense / months)

    const cashBank = accounts
      .filter((a) => a.type === 'cash' || a.type === 'bank')
      .reduce((s, a) => s + a.balance, 0)

    // Savings rate score (0-30)
    const rawSavingsRate = avgIncome > 0 ? ((avgIncome - avgExpense) / avgIncome) * 100 : 0
    const savingsScore = Math.min(30, Math.round((Math.max(0, rawSavingsRate) / 50) * 30))

    // Runway score (0-25)
    const runwayMonths = avgExpense > 0 ? cashBank / avgExpense : 0
    const runwayScore = Math.min(25, Math.round((Math.min(runwayMonths, 12) / 12) * 25))

    // Debt score (0-25)
    const sortedEntries = [...entries].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    const latestEntry = sortedEntries[0]
    const totalDebt = latestEntry?.totalLiabilities ?? 0
    const totalAssetNW = latestEntry?.totalAssets ?? 0
    const hasNetWorthData = totalAssetNW > 0 || totalDebt > 0
    const debtRatio = totalAssetNW > 0 ? totalDebt / totalAssetNW : 0
    // No net worth data at all = neutral (half marks), not a perfect debt ratio
    const debtScore = hasNetWorthData
      ? Math.min(25, Math.round(Math.max(0, 1 - debtRatio) * 25))
      : Math.round(25 * 0.5)

    // NW growth (0-20)
    let growthScore = 0
    if (sortedEntries.length >= 2) {
      const sixMoDate = sixMoAgo.toISOString().slice(0, 10)
      const latestNW = sortedEntries[0]?.netWorth ?? 0
      const oldEntry = sortedEntries.find((e) => (e.date ?? '') <= sixMoDate)
      const oldNW = oldEntry ? oldEntry.netWorth : (sortedEntries[sortedEntries.length - 1]?.netWorth ?? 0)
      if (oldNW > 0) {
        const growthPct = ((latestNW - oldNW) / oldNW) * 100
        growthScore = Math.min(20, Math.round(Math.max(0, growthPct) * 2))
      } else if (latestNW > 0) {
        growthScore = 20
      }
    }

    return Math.min(100, savingsScore + runwayScore + debtScore + growthScore)
  }, [transactions, accounts, entries])

  // ── 💪 Vitality Score (0-100) ──────────────────────────────
  const vitalityScore = useMemo(() => {
    const checkinData = loadCheckinHistory()
    const totalDays = 90

    // Habit completion rate across all habits (0-45)
    const activeHabits = habits.filter((h) => h.active)
    let completionSum = 0
    let habitCount = 0
    for (const h of activeHabits) {
      const rate = useHabitStore.getState().getCompletionRate(h.id, 30)
      if (rate > 0 || habitLogs.some((l) => l.habitId === h.id)) {
        completionSum += rate
        habitCount++
      }
    }
    const completionScore = habitCount > 0
      ? Math.min(45, Math.round((completionSum / habitCount) * 0.45))
      : 0

    // Habit streak (0-25) — average streak across habits
    let streakSum = 0
    let streakHabitCount = 0
    for (const h of activeHabits) {
      const s = useHabitStore.getState().getStreak(h.id)
      if (s > 0) {
        streakSum += s
        streakHabitCount++
      }
    }
    const streakScore = streakHabitCount > 0
      ? Math.min(25, Math.round((streakSum / streakHabitCount / 30) * 25))
      : 0

    // Check-in consistency (0-30)
    const consistencyRate = checkinData.moodCount / totalDays
    const consistencyScore = Math.min(30, Math.round(consistencyRate * 100 * 0.3))

    return Math.min(100, completionScore + streakScore + consistencyScore)
  }, [habits, habitLogs, checkinVersion])

  // ── 🧠 Mind Score (0-100) ──────────────────────────────────
  const mindScore = useMemo(() => {
    const thirtyDaysAgo = daysAgo(30)

    // Notes count (0-40) — recent 30 days
    const recentNotes = notes.filter((n) => n.createdAt >= thirtyDaysAgo)
    const notesScore = Math.min(40, recentNotes.length * 8) // 5 notes = 40

    // Journal consistency (0-35) — notes with "journal" in title/content (lowercase)
    const journalNotes = notes.filter((n) => {
      const t = (n.title + ' ' + n.content).toLowerCase()
      return t.includes('journal') || t.includes('diary') || t.includes('reflection')
    })
    const recentJournals = journalNotes.filter((n) => n.createdAt >= thirtyDaysAgo)
    // Count distinct days with journal entries
    const journalDays = new Set(recentJournals.map((n) => n.createdAt.slice(0, 10)))
    const journalScore = Math.min(35, journalDays.size * 7) // 5 distinct days = 35

    // Learning tracker (0-25) — notes with "learning" or "course" or "study"
    const learningNotes = notes.filter((n) => {
      const t = (n.title + ' ' + n.content).toLowerCase()
      return t.includes('learning') || t.includes('course') || t.includes('study') || t.includes('belajar')
    })
    const recentLearning = learningNotes.filter((n) => n.createdAt >= thirtyDaysAgo)
    const learningScore = Math.min(25, recentLearning.length * 5) // 5 learning notes = 25

    return Math.min(100, notesScore + journalScore + learningScore)
  }, [notes])

  // ── ⚡ Productivity Score (0-100) ──────────────────────────
  const productivityScore = useMemo(() => {
    const weekAgo = daysAgo(7)

    // Todo completion rate (0-60)
    const totalTodos = todos.length
    const completedTodos = todos.filter((t) => t.completed).length
    const completionRate = totalTodos > 0 ? completedTodos / totalTodos : 0
    const completionTodoScore = Math.min(60, Math.round(completionRate * 60))

    // Tasks done this week (0-40)
    const doneThisWeek = todos.filter((t) => t.completed && t.updatedAt >= weekAgo).length
    const weeklyTaskScore = Math.min(40, doneThisWeek * 10) // 4 tasks = 40

    return Math.min(100, completionTodoScore + weeklyTaskScore)
  }, [todos])

  // ── 🤝 Social Score (0-100) ────────────────────────────────
  // Manual input slider — stored in state

  // ── Dimensions ─────────────────────────────────────────────
  // `measured` = derived from real data. Social is a self-rating, so it's shown
  // but deliberately excluded from the overall score (otherwise the score is
  // gameable by just dragging a slider).
  const dimensions: { name: string; score: number; fullMark: number; icon: string; color: string; measured: boolean }[] = useMemo(() => [
    { name: 'Wealth', score: wealthScore, fullMark: 100, icon: '💰', color: 'var(--color-nb-blue)', measured: true },
    { name: 'Vitality', score: vitalityScore, fullMark: 100, icon: '💪', color: 'var(--color-nb-green)', measured: true },
    { name: 'Mind', score: mindScore, fullMark: 100, icon: '🧠', color: 'var(--color-nb-orange)', measured: true },
    { name: 'Productivity', score: productivityScore, fullMark: 100, icon: '⚡', color: 'var(--color-nb-pink)', measured: true },
    { name: 'Social', score: socialScore, fullMark: 100, icon: '🤝', color: 'var(--color-nb-purple)', measured: false },
  ], [wealthScore, vitalityScore, mindScore, productivityScore, socialScore])

  const measuredDimensions = useMemo(() => dimensions.filter((d) => d.measured), [dimensions])

  const lifeScore = useMemo(() => {
    return Math.round(measuredDimensions.reduce((s, d) => s + d.score, 0) / measuredDimensions.length)
  }, [measuredDimensions])

  const radarData = useMemo(() => {
    // Recharts RadarChart expects data in format: [{ subject, A, fullMark }, ...]
    // Only the 4 measured dimensions are plotted — Social is self-rated and is
    // shown separately (its own card + badge), never mixed into the shape.
    return measuredDimensions.map((d) => ({
      subject: d.name,
      score: d.score,
      fullMark: d.fullMark,
    }))
  }, [measuredDimensions])

  // ── Insights ───────────────────────────────────────────────
  const insights = useMemo(() => {
    const result: string[] = []
    const checkinData = loadCheckinHistory()

    // Mood vs habit streak correlation
    if (checkinData.moodCount >= 7 && habits.length > 0) {
      const avgMood = checkinData.moodSum / checkinData.moodCount
      const habitCompletionAvg = habits.filter((h) => h.active).reduce((s, h) => {
        return s + useHabitStore.getState().getCompletionRate(h.id, 30)
      }, 0) / Math.max(1, habits.filter((h) => h.active).length)

      if (avgMood >= 3.5 && habitCompletionAvg >= 60) {
        result.push('Mood kamu stabil di atas rata-rata saat habit konsisten. Keep it up! 🔥')
      } else if (avgMood < 3 && habitCompletionAvg < 40) {
        result.push('Mood cenderung rendah saat habit menurun. Coba mulai dari 1 habit kecil dulu ya.')
      }

      if (habitCompletionAvg >= 70) {
        result.push(`Habit completion rate ${habitCompletionAvg.toFixed(0)}% — kamu cukup konsisten dengan ${habits.filter((h) => h.active).length} habit aktif.`)
      }
    }

    // Spending vs mood (monthly correlation)
    const now = new Date()
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const monthTx = transactions.filter((t) => t.date.startsWith(thisMonthKey))
    const monthSpending = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    if (monthSpending > 0 && checkinData.moodCount >= 5) {
      if (monthSpending > 5000000 && checkinData.moodSum / checkinData.moodCount < 3) {
        result.push('Bulan dengan spending tinggi cenderung barengan sama mood rendah. Mungkin ada emotional spending?')
      }
    }

    // Productivity vs journaling
    const journalNotes = notes.filter((n) => {
      const t = (n.title + ' ' + n.content).toLowerCase()
      return t.includes('journal') || t.includes('diary') || t.includes('reflection') || t.includes('learning')
    })
    const recentJournals = journalNotes.filter((n) => n.createdAt >= daysAgo(30))
    const completedTodos = todos.filter((t) => t.completed).length
    if (recentJournals.length >= 5 && completedTodos >= 10) {
      result.push(`Kamu nulis ${recentJournals.length} journal notes bulan ini + ${completedTodos} task selesai. Journaling = produktivitas? 📈`)
    } else if (recentJournals.length <= 1 && todos.length > 5) {
      result.push('Coba mulai journaling rutin — biasanya berkorelasi sama produktivitas yang lebih tinggi.')
    }

    if (result.length === 0) {
      result.push('Lengkapi data kamu (habits, notes, check-in) untuk dapat insight yang lebih personal.')
    }

    return result
  }, [habits, transactions, notes, todos, checkinVersion])

  // ── Score label ────────────────────────────────────────────
  const scoreLabel = lifeScore >= 80 ? 'Excellent!' : lifeScore >= 65 ? 'Good' : lifeScore >= 45 ? 'Fair' : 'Needs Love'
  const scoreColor = lifeScore >= 65 ? 'var(--color-nb-green)' : lifeScore >= 45 ? 'var(--color-nb-orange)' : 'var(--color-nb-red)'

  // Trend arrows — 'none' means "no historical snapshot yet", never a guess
  const trendIcon = (trend: 'up' | 'down' | 'stable' | 'none') => {
    if (trend === 'up') return <span className="text-nb-green font-bold">▲</span>
    if (trend === 'down') return <span className="text-nb-red font-bold">▼</span>
    if (trend === 'stable') return <span className="text-nb-fg-muted font-bold">=</span>
    return <span className="text-nb-fg-muted font-bold" title="Belum ada data historis">—</span>
  }

  // ── Real trends: today's score vs the snapshot from ~a week ago ──
  const getTrend = (score: number, baseline: number | undefined): 'up' | 'down' | 'stable' | 'none' => {
    if (baseline === undefined) return 'none'
    if (score > baseline + 5) return 'up'
    if (score < baseline - 5) return 'down'
    return 'stable'
  }

  const [baseline, setBaseline] = useState<ScoreSnapshot | null>(null)

  // Read the ~7-day-old snapshot once (before today's write, which never
  // touches older keys anyway)
  useEffect(() => {
    if (!userId) return
    setBaseline(findBaselineSnapshot(userId))
  }, [userId])

  // Persist today's snapshot so future visits have something real to compare to
  useEffect(() => {
    if (!userId || !loaded) return
    writeSnapshot(userId, {
      total: lifeScore,
      Wealth: wealthScore,
      Vitality: vitalityScore,
      Mind: mindScore,
      Productivity: productivityScore,
      Social: socialScore,
    })
  }, [userId, loaded, lifeScore, wealthScore, vitalityScore, mindScore, productivityScore, socialScore])

  const dimensionsWithTrend = useMemo(() => {
    return dimensions.map((d) => ({
      ...d,
      trend: getTrend(d.score, baseline?.[d.name]),
      insight: getDimensionInsight(d.name, d.score),
    }))
  }, [dimensions, baseline])

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-lg font-bold uppercase text-nb-fg-muted animate-pulse">Loading Life Score...</span>
      </div>
    )
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-7 gap-4 flex-wrap">
        <h2 className="text-[1.8rem]">🧠 Life Score</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase text-nb-fg-muted">Your holistic life dashboard</span>
        </div>
      </div>

      {/* ── Overall Score Hero ── */}
      <div className="mb-7">
        <NeubruCard>
          <div className="flex items-center gap-8 flex-wrap">
            <div className="flex flex-col items-center min-w-[140px]">
              <div
                className="font-mono text-[5rem] font-extrabold leading-none"
                style={{ color: scoreColor }}
              >
                {lifeScore}
              </div>
              <div className="text-sm font-bold uppercase tracking-[0.08em] text-nb-fg-muted mt-1">
                / 100 · {scoreLabel}
              </div>
              <div className="text-[0.65rem] font-medium text-nb-fg-muted mt-1.5 text-center leading-relaxed">
                Rata-rata 4 dimensi terukur (Social tidak dihitung)
              </div>
            </div>
            <div className="flex-1 min-w-[300px]">
              <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-3">
                Radar Overview
              </div>
              {/* ── Radar Chart ── */}
              <div className="w-full" style={{ height: 360 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    data={radarData}
                    cx="50%"
                    cy="50%"
                    outerRadius="75%"
                  >
                    <PolarGrid
                      stroke="var(--color-nb-border)"
                      strokeWidth={2}
                      strokeDasharray="4 2"
                    />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={(props: any) => {
                        const { payload, x, y, cx, cy } = props
                        const dim = dimensions.find((d) => d.name === payload.value)
                        return (
                          <text
                            x={x}
                            y={y}
                            textAnchor={x > cx ? 'start' : x < cx ? 'end' : 'middle'}
                            dominantBaseline={y > cy ? 'hanging' : y < cy ? 'auto' : 'middle'}
                            fill="var(--color-nb-fg)"
                            fontSize={13}
                            fontWeight={800}
                            fontFamily="var(--font-sans)"
                            style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
                          >
                            {dim?.icon} {payload.value}
                          </text>
                        )
                      }}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--color-nb-fg-muted)' }}
                      axisLine={{ stroke: 'var(--color-nb-border)', strokeWidth: 2 }}
                      tickCount={5}
                    />
                    <Radar
                      name="Life Score"
                      dataKey="score"
                      stroke="var(--color-nb-purple)"
                      strokeWidth={3}
                      fill="var(--color-nb-purple)"
                      fillOpacity={0.18}
                      dot={{
                        r: 5,
                        fill: 'var(--color-nb-purple)',
                        stroke: 'var(--color-nb-border)',
                        strokeWidth: 2,
                      }}
                      activeDot={{
                        r: 7,
                        fill: 'var(--color-nb-purple)',
                        stroke: 'var(--color-nb-border)',
                        strokeWidth: 2.5,
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--color-nb-bg)',
                        border: '3px solid var(--color-nb-border)',
                        boxShadow: '5px 5px 0 var(--color-nb-border)',
                        borderRadius: 0,
                        padding: '8px 12px',
                        fontFamily: 'var(--font-sans)',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                      }}
                      formatter={(value: any) => [`${value}/100`, 'Score']}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </NeubruCard>
      </div>

      {/* ── 5 Dimension Cards ── */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5 mb-7">
        {dimensionsWithTrend.map((dim) => (
          <NeubruCard key={dim.name}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl">{dim.icon}</span>
              {trendIcon(dim.trend)}
            </div>
            <div className="font-mono text-3xl font-extrabold" style={{ color: dim.color }}>
              {dim.score}
            </div>
            <div className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-nb-fg-muted mt-0.5">
              {dim.name} / 100
            </div>
            {!dim.measured && (
              <div className="mt-1.5 inline-block text-[0.6rem] font-bold uppercase tracking-wide border-2 border-nb-border bg-nb-purple/20 px-1.5 py-0.5">
                Self-rated · tidak dihitung ke skor total
              </div>
            )}
            {/* Mini bar */}
            <div className="mt-3 w-full h-2 bg-nb-bg-alt border border-nb-border rounded-sm overflow-hidden">
              <div
                className="h-full transition-all duration-700"
                style={{ width: `${dim.score}%`, background: dim.color }}
              />
            </div>
            <div className="mt-2.5 text-[0.7rem] font-medium text-nb-fg-muted leading-relaxed">
              {dim.insight}
            </div>
          </NeubruCard>
        ))}
      </div>

      {/* ── Social Score Slider ── */}
      <div className="mb-7">
        <NeubruCard>
          <div className="text-sm font-bold uppercase text-nb-fg-muted mb-4">
            🤝 Social Score (Manual)
          </div>
          <div className="flex items-center gap-5 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <input
                type="range"
                min={0}
                max={100}
                value={socialScore}
                onChange={(e) => saveSocial(Number(e.target.value))}
                className="w-full h-3 appearance-none cursor-pointer rounded-sm border-2 border-nb-border bg-white
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6
                  [&::-webkit-slider-thumb]:bg-nb-purple [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-nb-border
                  [&::-webkit-slider-thumb]:shadow-nb-sm [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:bg-nb-purple
                  [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-nb-border [&::-moz-range-thumb]:cursor-pointer"
              />
              <div className="flex justify-between mt-1.5">
                <span className="text-xs font-bold text-nb-fg-muted">0 — Solo mode</span>
                <span className="text-xs font-bold text-nb-fg-muted">100 — Social butterfly</span>
              </div>
            </div>
            <div className="font-mono text-3xl font-extrabold text-nb-purple min-w-[60px] text-center">
              {socialScore}
            </div>
          </div>
          <div className="mt-3 text-xs text-nb-fg-muted font-medium">
            Self-rated, tidak dihitung ke skor total — biar Life Score tetap murni dari data. Ke depan: sync dengan shared goals, group challenges, dan social features WOS.
          </div>
        </NeubruCard>
      </div>

      {/* ── Insights ── */}
      <div className="mb-7">
        <NeubruCard>
          <div className="text-sm font-bold uppercase text-nb-fg-muted mb-4">
            💡 Insights (Auto-Generated)
          </div>
          <div className="flex flex-col gap-3">
            {insights.map((insight, i) => (
              <div key={i} className="nb-panel p-4 flex items-start gap-3">
                <span className="text-lg shrink-0 mt-0.5">{['💡', '🔍', '📊', '🎯'][i] || '✨'}</span>
                <span className="text-sm font-medium leading-relaxed">{insight}</span>
              </div>
            ))}
          </div>
        </NeubruCard>
      </div>

      {/* ── Methodology ── */}
      <div className="nb-panel text-xs text-nb-fg-muted leading-relaxed">
        <span className="font-bold uppercase tracking-wide text-nb-fg">How scores are calculated:</span>{' '}
        <strong>Wealth</strong> = savings rate + liquidity runway + debt ratio + NW growth (same as FIRE health score).{' '}
        <strong>Vitality</strong> = habit completion rate + streak + daily check-in consistency.{' '}
        <strong>Mind</strong> = notes written + journal consistency + learning tracker.{' '}
        <strong>Productivity</strong> = todo completion rate + tasks done per week.{' '}
        <strong>Social</strong> = self-rated slider, tidak dihitung ke skor total (future: shared goals, group features).{' '}
        Life Score is the average of the four measured dimensions only.{' '}
        Panah tren membandingkan skor hari ini dengan snapshot harian ~7 hari lalu — kalau belum ada
        riwayatnya, yang muncul "—", bukan tren palsu.
      </div>
    </div>
  )
}

function getDimensionInsight(name: string, score: number): string {
  switch (name) {
    case 'Wealth':
      if (score >= 70) return 'Keuangan kamu sehat! Savings rate & runway cukup.'
      if (score >= 40) return 'Masih ada ruang improvement di savings dan debt management.'
      return 'Yuk mulai track pengeluaran & bangun emergency fund.'
    case 'Vitality':
      if (score >= 70) return 'Habit & check-in kamu konsisten. Energi terjaga!'
      if (score >= 40) return 'Coba check-in lebih rutin untuk track energi harian.'
      return 'Mulai dengan 1-2 habit kecil untuk bangun momentum.'
    case 'Mind':
      if (score >= 70) return 'Kamu rajin mencatat & journaling. Pikiran tertata!'
      if (score >= 40) return 'Mulai tulis 1-2 notes per minggu untuk jernihkan pikiran.'
      return 'Journaling bisa bantu kamu lebih fokus & produktif.'
    case 'Productivity':
      if (score >= 70) return 'Task completion rate tinggi. Kamu produktif!'
      if (score >= 40) return 'Ada beberapa task pending. Review prioritas mingguan.'
      return 'Coba breakdown task besar jadi smaller chunks.'
    case 'Social':
      if (score >= 70) return 'Social life kamu aktif & connected.'
      if (score >= 40) return 'Cukup seimbang antara work & social.'
      return 'Sesuaikan sendiri — ini sepenuhnya subjektif.'
    default:
      return ''
  }
}
