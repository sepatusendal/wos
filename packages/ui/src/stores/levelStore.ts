import { create } from 'zustand'
import { useFinanceStore } from './financeStore'
import { useHabitStore } from './habitStore'
import { useTodoStore } from './todoStore'
import { useNotesStore } from './notesStore'
import { useNetWorthStore } from './netWorthStore'
import { useWealthStore } from './wealthStore'
import { useLiabilityStore } from './liabilityStore'
import { useCheckinStore } from './checkinStore'

interface SkillLevels {
  wealth: number
  vitality: number
  wisdom: number
}

interface DailyQuest {
  id: string
  desc: string
  xp: number
  done: boolean
}

interface LevelState {
  currentUserId: string | null
  xp: number
  level: number
  skillPoints: number
  skills: SkillLevels
  dailyQuests: DailyQuest[]
  dailyQuestDate: string
  setUser: (userId: string | null) => void
  addXP: (amount: number) => void
  spendSkillPoint: (tree: 'wealth' | 'vitality' | 'wisdom') => void
  completeQuest: (id: string) => void
  /** Award a quest's XP because its real-data condition just became true. Returns true only on the transition (never re-awards). */
  autoCompleteQuest: (id: string) => boolean
  /** Re-derive every quest from real store data. Returns the ids that newly completed on this pass. */
  evaluateQuests: () => string[]
  generateDailyQuests: (userId: string) => void
}

// Namespaced per user — a single shared `wos_level` key meant two accounts
// on the same device/browser saw and could "complete" each other's level,
// XP, skills and daily quests.
const STORAGE_PREFIX = 'wos_level_'
// Pre-namespacing key. Kept only so existing progress can be migrated once.
const LEGACY_STORAGE_KEY = 'wos_level'
function storageKeyFor(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`
}

function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function computeLevel(xp: number): number {
  if (xp < 0) xp = 0
  return Math.floor(Math.sqrt(xp / 100)) + 1
}

function xpForLevel(level: number): number {
  // Total XP needed to reach this level (inclusive)
  return (level - 1) * (level - 1) * 100
}

function xpForNextLevel(level: number): number {
  // Total XP needed to reach the next level
  return level * level * 100
}

function xpInCurrentLevel(xp: number): number {
  const lvl = computeLevel(xp)
  const base = xpForLevel(lvl)
  return xp - base
}

function xpNeededForNextLevel(xp: number): number {
  const lvl = computeLevel(xp)
  return xpForNextLevel(lvl) - xpForLevel(lvl)
}

// Exported for the XP widget
export { computeLevel, xpForLevel, xpForNextLevel, xpInCurrentLevel, xpNeededForNextLevel }

interface PersistedState {
  xp: number
  skills: SkillLevels
  dailyQuests: DailyQuest[]
  dailyQuestDate: string
  totalSkillPointsEarned: number
}

function load(userId: string | null): PersistedState {
  try {
    const raw = userId ? localStorage.getItem(storageKeyFor(userId)) : null
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        xp: parsed.xp ?? 0,
        skills: {
          wealth: parsed.skills?.wealth ?? 0,
          vitality: parsed.skills?.vitality ?? 0,
          wisdom: parsed.skills?.wisdom ?? 0,
        },
        dailyQuests: parsed.dailyQuests ?? [],
        dailyQuestDate: parsed.dailyQuestDate ?? '',
        totalSkillPointsEarned: parsed.totalSkillPointsEarned ?? 0,
      }
    }
  } catch {
    // ignore
  }
  return {
    xp: 0,
    skills: { wealth: 0, vitality: 0, wisdom: 0 },
    dailyQuests: [],
    dailyQuestDate: '',
    totalSkillPointsEarned: 0,
  }
}

function save(userId: string | null, state: PersistedState) {
  if (!userId) return
  try {
    localStorage.setItem(storageKeyFor(userId), JSON.stringify(state))
  } catch {
    // localStorage may be unavailable
  }
}

// One-time migration: before the per-user namespacing, all progress lived under
// a single shared `wos_level` key. Hand it to the first user who logs in after
// the change (browser-local gamification data was indistinguishable per user
// anyway), then drop it so a second account can't inherit the same blob.
function migrateLegacyKey(userId: string) {
  try {
    if (localStorage.getItem(storageKeyFor(userId)) !== null) return
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!legacy) return
    localStorage.setItem(storageKeyFor(userId), legacy)
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    // localStorage may be unavailable
  }
}

// Every quest here MUST be verifiable against real stored data (see
// `evaluateQuestProgress`). Quests that could only ever be self-reported —
// "review catatan minggu ini", "kontribusi ke savings goal" (no contribution
// mechanism exists), "review subscription aktif", "pertahankan habit streak" —
// were removed rather than left as a button the user could press for free XP.
const QUEST_POOL: Omit<DailyQuest, 'done'>[] = [
  { id: 'q_log_tx', desc: 'Catat 1 transaksi hari ini', xp: 30 },
  { id: 'q_habit_3', desc: 'Selesaikan 3 habit hari ini', xp: 40 },
  { id: 'q_journal', desc: 'Tulis 1 note bertanggal hari ini', xp: 35 },
  { id: 'q_budget', desc: 'Buat 1 budget baru hari ini', xp: 40 },
  { id: 'q_checkin', desc: 'Daily check-in', xp: 25 },
  { id: 'q_networth', desc: 'Snapshot net worth hari ini', xp: 45 },
  { id: 'q_todo_5', desc: 'Selesaikan 5 todo hari ini', xp: 40 },
  { id: 'q_wealth_log', desc: 'Update asset / liability hari ini', xp: 45 },
]

const QUEST_IDS = new Set(QUEST_POOL.map((q) => q.id))

export interface QuestProgress {
  current: number
  target: number
  done: boolean
}

/** Day part of an ISO timestamp (`2026-08-11T09:12:00.000Z` → `2026-08-11`). */
function isoDay(iso: string | null | undefined): string {
  return typeof iso === 'string' ? iso.slice(0, 10) : ''
}

function progress(current: number, target: number): QuestProgress {
  return { current: Math.min(current, target), target, done: current >= target }
}

/**
 * Derive a quest's state from what the user actually recorded. Reads sibling
 * stores via `getState()` — never from a snapshot — so this is always
 * evaluated against live data. Returns null for an unknown id (e.g. a quest
 * removed from the pool that is still sitting in persisted state).
 */
export function evaluateQuestProgress(quest: Pick<DailyQuest, 'id'>): QuestProgress | null {
  const today = todayStr()

  switch (quest.id) {
    case 'q_log_tx': {
      const tx = useFinanceStore.getState().transactions ?? []
      return progress(tx.filter((t) => t.date === today).length, 1)
    }
    case 'q_habit_3': {
      const logs = useHabitStore.getState().logs ?? []
      return progress(logs.filter((l) => l.date === today && l.done).length, 3)
    }
    case 'q_journal': {
      const notes = useNotesStore.getState().notes ?? []
      return progress(notes.filter((n) => n.date === today).length, 1)
    }
    case 'q_budget': {
      // Budgets carry `created_at` only — an edit leaves no timestamp behind,
      // so this quest is scoped to newly created budgets.
      const budgets = useFinanceStore.getState().budgets ?? []
      return progress(budgets.filter((b) => isoDay(b.createdAt) === today).length, 1)
    }
    case 'q_checkin': {
      return progress(useCheckinStore.getState().todayChecked ? 1 : 0, 1)
    }
    case 'q_networth': {
      const entries = useNetWorthStore.getState().entries ?? []
      return progress(entries.filter((e) => e.date === today).length, 1)
    }
    case 'q_todo_5': {
      // Todos have no dedicated "completedAt" — `updatedAt` on a completed
      // todo is the closest honest proxy (toggleComplete/editTodo bump it).
      const todos = useTodoStore.getState().todos ?? []
      return progress(todos.filter((t) => t.completed && isoDay(t.updatedAt) === today).length, 5)
    }
    case 'q_wealth_log': {
      const assets = useWealthStore.getState().assets ?? []
      const liabilities = useLiabilityStore.getState().liabilities ?? []
      const touched =
        assets.filter((a) => isoDay(a.lastUpdated) === today || isoDay(a.createdAt) === today).length +
        liabilities.filter((l) => isoDay(l.createdAt) === today).length
      return progress(touched, 1)
    }
    default:
      return null
  }
}

/** Vitality's one real mechanical effect — see `habitStore.getStreak`. */
export function streakFreezeAllowance(vitalityLevel: number): number {
  return Math.floor(vitalityLevel / 3)
}


// Seeded shuffle based on userId + date for consistent daily quests
function seededShuffle(userId: string, date: string): number[] {
  const seed = hashStr(userId + date)
  const indices = Array.from({ length: QUEST_POOL.length }, (_, i) => i)
  // Deterministic shuffle using seed
  let s = seed
  for (let i = indices.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const j = s % (i + 1)
    ;[indices[i], indices[j]] = [indices[j]!, indices[i]!]
  }
  return indices.slice(0, 3)
}

function hashStr(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff
  }
  return hash >>> 0
}

function levelFromLoaded(initial: PersistedState) {
  const initialLevel = computeLevel(initial.xp)
  const totalSkillsSpent = initial.skills.wealth + initial.skills.vitality + initial.skills.wisdom
  const skillPoints = Math.max(0, initialLevel - 1 - totalSkillsSpent)
  return { initialLevel, skillPoints }
}

export const useLevelStore = create<LevelState>((set, get) => {
  return {
    currentUserId: null,
    xp: 0,
    level: 1,
    skillPoints: 0,
    skills: { wealth: 0, vitality: 0, wisdom: 0 },
    dailyQuests: [],
    dailyQuestDate: '',

    setUser: (userId: string | null) => {
      if (get().currentUserId === userId) return
      if (!userId) {
        set({ currentUserId: null, xp: 0, level: 1, skillPoints: 0, skills: { wealth: 0, vitality: 0, wisdom: 0 }, dailyQuests: [], dailyQuestDate: '' })
        return
      }
      migrateLegacyKey(userId)
      const initial = load(userId)
      const { initialLevel, skillPoints } = levelFromLoaded(initial)
      set({
        currentUserId: userId,
        xp: initial.xp,
        level: initialLevel,
        skillPoints: Math.max(0, skillPoints),
        skills: initial.skills,
        dailyQuests: initial.dailyQuests,
        dailyQuestDate: initial.dailyQuestDate,
      })
    },

    addXP: (amount: number) => {
      const state = get()
      const newXp = state.xp + amount
      const newLevel = computeLevel(newXp)
      const oldLevel = state.level
      const leveledUp = newLevel > oldLevel
      const pointsGained = leveledUp ? newLevel - oldLevel : 0

      const updated: PersistedState = {
        xp: newXp,
        skills: state.skills,
        dailyQuests: state.dailyQuests,
        dailyQuestDate: state.dailyQuestDate,
        totalSkillPointsEarned: state.skillPoints + state.skills.wealth + state.skills.vitality + state.skills.wisdom + pointsGained,
      }
      save(state.currentUserId, updated)

      set({
        xp: newXp,
        level: newLevel,
        skillPoints: state.skillPoints + pointsGained,
      })
    },

    spendSkillPoint: (tree: 'wealth' | 'vitality' | 'wisdom') => {
      const state = get()
      if (state.skillPoints <= 0) return
      if (state.skills[tree] >= 10) return

      const newSkills = { ...state.skills, [tree]: state.skills[tree] + 1 }
      const updated: PersistedState = {
        xp: state.xp,
        skills: newSkills,
        dailyQuests: state.dailyQuests,
        dailyQuestDate: state.dailyQuestDate,
        totalSkillPointsEarned: newSkills.wealth + newSkills.vitality + newSkills.wisdom + (state.skillPoints - 1),
      }
      save(state.currentUserId, updated)

      set({
        skills: newSkills,
        skillPoints: state.skillPoints - 1,
      })
    },

    // Kept for API compatibility. There is no "claim" path any more: a quest
    // only completes when its real-data condition holds, so this is just
    // `autoCompleteQuest` under the old name.
    completeQuest: (id: string) => {
      get().autoCompleteQuest(id)
    },

    autoCompleteQuest: (id: string) => {
      const state = get()
      const quest = state.dailyQuests.find((q) => q.id === id)
      // `done` is the re-award guard — XP is paid exactly once per quest/day.
      if (!quest || quest.done) return false

      const p = evaluateQuestProgress(quest)
      if (!p || !p.done) return false

      const newQuests = state.dailyQuests.map((q) =>
        q.id === id ? { ...q, done: true } : q,
      )

      const updated: PersistedState = {
        xp: state.xp,
        skills: state.skills,
        dailyQuests: newQuests,
        dailyQuestDate: state.dailyQuestDate,
        totalSkillPointsEarned: state.skillPoints + state.skills.wealth + state.skills.vitality + state.skills.wisdom,
      }
      save(state.currentUserId, updated)

      set({ dailyQuests: newQuests })

      // Award XP for completing quest
      get().addXP(quest.xp)
      return true
    },

    evaluateQuests: () => {
      const completed: string[] = []
      for (const quest of get().dailyQuests) {
        if (quest.done) continue
        if (get().autoCompleteQuest(quest.id)) completed.push(quest.id)
      }
      return completed
    },

    generateDailyQuests: (userId: string) => {
      const today = todayStr()
      const state = get()

      // Skip if already generated for today — unless today's set still holds
      // a quest id that has since been retired from the pool (those can never
      // be satisfied, so they'd sit unfinishable for the rest of the day).
      const allKnown = state.dailyQuests.every((q) => QUEST_IDS.has(q.id))
      if (state.dailyQuestDate === today && state.dailyQuests.length > 0 && allKnown) return

      // Carry `done` across a same-day regeneration so a quest already paid
      // out today can't be re-awarded.
      const alreadyDone = new Set(
        state.dailyQuestDate === today ? state.dailyQuests.filter((q) => q.done).map((q) => q.id) : [],
      )
      const indices = seededShuffle(userId, today)
      const quests: DailyQuest[] = indices.map((i) => ({
        ...QUEST_POOL[i]!,
        done: alreadyDone.has(QUEST_POOL[i]!.id),
      }))

      const updated: PersistedState = {
        xp: state.xp,
        skills: state.skills,
        dailyQuests: quests,
        dailyQuestDate: today,
        totalSkillPointsEarned: state.skillPoints + state.skills.wealth + state.skills.vitality + state.skills.wisdom,
      }
      save(state.currentUserId, updated)

      set({ dailyQuests: quests, dailyQuestDate: today })
    },
  }
})
