import { useMemo, useState, useCallback, useEffect } from 'react'
import { useFinanceStore } from '../stores/financeStore'
import { useAchievementStore } from '../stores/achievementStore'
import { useCheckinStore } from '../stores/checkinStore'
import { useNetWorthStore } from '../stores/netWorthStore'
import { todayStr } from '@wos/shared'

type PetMood =
  | 'happy'
  | 'content'
  | 'concerned'
  | 'shocked'
  | 'sleeping'
  | 'hero'
  | 'baby'
  | 'evolved'

interface PetState {
  emoji: string
  label: string
  mood: PetMood
  animation: string
  color: string
}

const PET_MOODS: Record<PetMood, Omit<PetState, 'mood'>> = {
  happy: {
    emoji: '😸',
    label: 'Happy',
    animation: 'animate-bounce-pet',
    color: 'text-nb-green',
  },
  content: {
    emoji: '🐱',
    label: 'Content',
    animation: 'animate-sway',
    color: 'text-nb-blue',
  },
  concerned: {
    emoji: '😿',
    label: 'Concerned',
    animation: 'animate-blink',
    color: 'text-nb-orange',
  },
  shocked: {
    emoji: '🙀',
    label: 'Shocked',
    animation: 'animate-shake',
    color: 'text-nb-red',
  },
  sleeping: {
    emoji: '😴',
    label: 'Sleeping',
    animation: 'animate-float',
    color: 'text-nb-fg-muted',
  },
  hero: {
    emoji: '🦸',
    label: 'Hero',
    animation: 'animate-sparkle',
    color: 'text-nb-yellow',
  },
  baby: {
    emoji: '👶',
    label: 'Baby',
    animation: 'animate-sway',
    color: 'text-nb-pink',
  },
  evolved: {
    emoji: '🐉',
    label: 'Evolved',
    animation: 'animate-bounce-pet',
    color: 'text-nb-purple',
  },
}

function getPetName(): string {
  try {
    return localStorage.getItem('wos_pet_name') || 'Biscuit'
  } catch {
    return 'Biscuit'
  }
}

function setPetName(name: string) {
  try {
    localStorage.setItem('wos_pet_name', name)
  } catch {
    // localStorage unavailable
  }
}

function getRegistrationDate(): string | null {
  try {
    return localStorage.getItem('wos_reg_date')
  } catch {
    return null
  }
}

function setRegistrationDate(date: string) {
  try {
    if (!localStorage.getItem('wos_reg_date')) {
      localStorage.setItem('wos_reg_date', date)
    }
  } catch {
    // localStorage unavailable
  }
}

function daysBetween(a: string, b: string): number {
  return Math.floor(
    (new Date(b).getTime() - new Date(a).getTime()) / 86400000
  )
}

/** ─── Weekly Report Templates ─── */
interface ReportLine {
  text: string
  mood: PetMood
}

function generateWeeklyReport(
  petName: string,
  budgets: { category: string; pct: number }[],
  savingsRate: number,
  netWorthTrend: 'up' | 'down' | 'flat',
  todayTxCount: number,
  hasNewAchievement: boolean,
): ReportLine[] {
  const lines: ReportLine[] = []

  // Budget analysis
  const overspent = budgets.filter((b) => b.pct > 100)
  const warning = budgets.filter((b) => b.pct > 80 && b.pct <= 100)
  const allGreen = budgets.length > 0 && budgets.every((b) => b.pct <= 80)

  if (overspent.length > 0) {
    const cats = overspent.map((b) => b.category).join(', ')
    lines.push({
      text: `Budget ${cats} overspend... hati-hati ya, ${petName} khawatir 😿`,
      mood: 'concerned',
    })
  }
  if (warning.length > 0) {
    const cats = warning.map((b) => b.category).join(', ')
    lines.push({
      text: `Budget ${cats} udah di atas 80%... sisa dikit aja lho! 🐱`,
      mood: 'concerned',
    })
  }
  if (allGreen && budgets.length > 0) {
    lines.push({
      text: `Minggu ini lo hemat banget! Semua budget aman terkendali. ${petName} seneng 😸`,
      mood: 'happy',
    })
  }

  // Savings rate
  if (savingsRate >= 30) {
    lines.push({
      text: `Savings rate ${savingsRate}% — gokil! Lo def profil investor sejati. ${petName} bangga 🦸`,
      mood: 'hero',
    })
  } else if (savingsRate >= 20) {
    lines.push({
      text: `Savings rate ${savingsRate}%, mantap! ${petName} happy 😸`,
      mood: 'happy',
    })
  } else if (savingsRate < 10 && savingsRate > 0) {
    lines.push({
      text: `Savings rate cuma ${savingsRate}%... ayo nabung lebih banyak ya. ${petName} sedikit sedih 😿`,
      mood: 'concerned',
    })
  } else if (savingsRate <= 0) {
    lines.push({
      text: `Belum ada pemasukan... yuk cari cuan! ${petName} nungguin 🙀`,
      mood: 'shocked',
    })
  }

  // Net worth trend
  if (netWorthTrend === 'up') {
    lines.push({
      text: `Net worth lo naik! Aset makin tebel, ${petName} ikut seneng 😸`,
      mood: 'happy',
    })
  } else if (netWorthTrend === 'down') {
    lines.push({
      text: `Net worth turun nih... waktunya evaluasi pengeluaran. ${petName} mikir keras 🐱`,
      mood: 'content',
    })
  }

  // Today activity
  if (todayTxCount === 0) {
    lines.push({
      text: `Hari ini belum ada transaksi. ${petName} ngantuk nih 😴`,
      mood: 'sleeping',
    })
  }

  // Achievement
  if (hasNewAchievement) {
    lines.push({
      text: `Woohoo! Lo baru aja unlock achievement! ${petName} kagum 🦸`,
      mood: 'hero',
    })
  }

  // Fallback
  if (lines.length === 0) {
    lines.push({
      text: `Semua normal aja nih. ${petName} santai dulu 🐱`,
      mood: 'content',
    })
  }

  return lines
}

/** ─── Mood computation ─── */
interface MoodComputeInput {
  budgets: { category: string; pct: number }[]
  savingsRate: number
  netWorthTrend: 'up' | 'down' | 'flat'
  todayTxCount: number
  hasNewAchievement: boolean
  isBaby: boolean
  isEvolved: boolean
}

function computeMood(input: MoodComputeInput): PetMood {
  // The pet is a financial-health indicator first and a collectible second,
  // so the money signals come before the cosmetic hero/evolved/baby states.
  // (Previously `hero` and `evolved` sat on top and, because
  // `hasNewAchievement` never expired, the pet was permanently a hero and
  // silently stopped reporting overspend.)
  const anyOver100 = input.budgets.some((b) => b.pct > 100)
  const anyOver80 = input.budgets.some((b) => b.pct > 80)

  if (anyOver100) return 'shocked'
  if (input.todayTxCount === 0) return 'sleeping'
  if (anyOver80) return 'concerned'

  // Nothing to warn about — cosmetic states may take over.
  if (input.isBaby) return 'baby'
  if (input.hasNewAchievement) return 'hero'
  if (input.isEvolved) return 'evolved'

  if (input.savingsRate > 20 && input.netWorthTrend === 'up') return 'happy'

  return 'content'
}

export default function FinancialPet() {
  const [petName, setPetNameState] = useState(getPetName)
  const [expanded, setExpanded] = useState(false)
  const [regDateSet, setRegDateSet] = useState(false)

  const { transactions, budgets } = useFinanceStore()
  const { unlocked, unlockedAt, getLastUnlockedAt } = useAchievementStore()
  const todayChecked = useCheckinStore((s) => s.todayChecked)
  const { entries } = useNetWorthStore()

  // Set registration date on first load
  useEffect(() => {
    if (!regDateSet) {
      const today = todayStr()
      setRegistrationDate(today)
      setRegDateSet(true)
    }
  }, [regDateSet])

  // Compute all the data
  const moodInput = useMemo((): MoodComputeInput => {
    const today = todayStr()
    const thisMonthKey = today.slice(0, 7)

    // Budget progress
    const budgetPcts = budgets.map((b) => {
      const spent = transactions
        .filter(
          (t) =>
            t.type === 'expense' &&
            t.category === b.category &&
            t.date.startsWith(thisMonthKey),
        )
        .reduce((s, t) => s + t.amount, 0)
      return { category: b.category, pct: b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0 }
    })

    // Savings rate
    const income = transactions
      .filter((t) => t.type === 'income' && t.date.startsWith(thisMonthKey))
      .reduce((s, t) => s + t.amount, 0)
    const expense = transactions
      .filter((t) => t.type === 'expense' && t.date.startsWith(thisMonthKey))
      .reduce((s, t) => s + t.amount, 0)
    const net = income - expense
    const savingsRate = income > 0 ? Math.round((net / income) * 100) : 0

    // Net worth trend (last 2 entries)
    const sorted = [...entries].sort(
      (a, b) => (a.date ?? '').localeCompare(b.date ?? ''),
    )
    const last = sorted[sorted.length - 1]
    const prev = sorted[sorted.length - 2]
    let netWorthTrend: 'up' | 'down' | 'flat' = 'flat'
    if (last && prev) {
      if (last.netWorth > prev.netWorth) netWorthTrend = 'up'
      else if (last.netWorth < prev.netWorth) netWorthTrend = 'down'
    }

    // Today transactions
    const todayTxCount = transactions.filter((t) => t.date === today).length

    // New achievement within the last 24h. This used to be
    // `lastUnlocked !== null && unlocked.length > 0` — true forever after the
    // very first unlock, which is what pinned the pet to "Hero". Unlock
    // timestamps now come from achievementStore's persisted `unlockedAt`.
    const lastAt = getLastUnlockedAt()
    const hasNewAchievement =
      lastAt !== null && Date.now() - new Date(lastAt).getTime() < 86400000

    // Baby: first week. Limitation: `wos_reg_date` is stamped the first time
    // this component mounts in this browser, not from the account's real
    // creation date — the user record's `created_at` isn't exposed through
    // useAuthStore, so an existing account on a new device reads as "baby".
    const regDate = getRegistrationDate()
    const isBaby = regDate ? daysBetween(regDate, today) <= 7 : false

    // Evolved: level 10+ (10+ achievements)
    const isEvolved = unlocked.length >= 10

    return {
      budgets: budgetPcts,
      savingsRate,
      netWorthTrend,
      todayTxCount,
      hasNewAchievement,
      isBaby,
      isEvolved,
    }
  }, [transactions, budgets, entries, unlocked, unlockedAt, getLastUnlockedAt])

  const mood = useMemo(() => computeMood(moodInput), [moodInput])
  const petState = PET_MOODS[mood]

  // Small stats for the card
  const statLine = useMemo(() => {
    const parts: string[] = []
    // Badge count, not a level — "Lv." here collided with the real XP level
    // shown by the skill tree / XP widget, which is a different number.
    if (unlocked.length > 0) parts.push(`${unlocked.length} 🏅`)
    if (moodInput.todayTxCount > 0)
      parts.push(`${moodInput.todayTxCount} tx today`)
    if (todayChecked) parts.push('Checked in')
    return parts.join(' · ')
  }, [unlocked.length, moodInput.todayTxCount, todayChecked])

  // Weekly report
  const weeklyReport = useMemo(
    () =>
      generateWeeklyReport(
        petName,
        moodInput.budgets,
        moodInput.savingsRate,
        moodInput.netWorthTrend,
        moodInput.todayTxCount,
        moodInput.hasNewAchievement,
      ),
    [petName, moodInput],
  )

  const handleNameClick = useCallback(() => {
    const newName = window.prompt('Kasih nama baru buat pet lo:', petName)
    if (newName && newName.trim()) {
      const trimmed = newName.trim()
      setPetNameState(trimmed)
      setPetName(trimmed)
    }
  }, [petName])

  return (
    <div className="overflow-visible">
      {/* ── Pet Header ── */}
      <div className="px-5 py-4 flex items-center gap-4">
        {/* Emoji with animation */}
        <div
          className={`text-5xl leading-none select-none ${petState.animation}`}
          title={petState.label}
        >
          {petState.emoji}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="font-extrabold text-lg uppercase cursor-pointer hover:text-nb-blue transition-colors"
              onClick={handleNameClick}
              title="Click to rename"
            >
              {petName}
            </span>
            <span className="text-[10px] text-nb-fg-muted">(click)</span>
          </div>
          <div className={`text-xs font-bold uppercase tracking-wider ${petState.color}`}>
            {petState.emoji} {petState.label}
          </div>
          {statLine && (
            <div className="text-[10px] text-nb-fg-muted mt-0.5 font-medium">
              {statLine}
            </div>
          )}
        </div>

        {/* Expand toggle */}
        <button
          className="nb-btn nb-btn-icon nb-btn-sm !p-1.5 !min-w-[28px] !min-h-[28px] text-lg leading-none"
          onClick={() => setExpanded((e) => !e)}
          title="Weekly report"
        >
          {expanded ? '✕' : '📝'}
        </button>
      </div>

      {/* ── Weekly Report (expandable) ── */}
      {expanded && (
        <div className="border-t-3 border-nb-border px-5 py-4 bg-nb-bg/50">
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-3">
            📝 {petName} says:
          </div>
          <div className="flex flex-col gap-2">
            {weeklyReport.map((line, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-sm font-medium leading-relaxed animate-slide-up"
                style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'backwards' }}
              >
                <span className="text-base shrink-0 mt-px">
                  {PET_MOODS[line.mood].emoji}
                </span>
                <span>{line.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
