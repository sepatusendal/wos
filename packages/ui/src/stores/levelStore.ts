import { create } from 'zustand'

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
  xp: number
  level: number
  skillPoints: number
  skills: SkillLevels
  dailyQuests: DailyQuest[]
  dailyQuestDate: string
  addXP: (amount: number) => void
  spendSkillPoint: (tree: 'wealth' | 'vitality' | 'wisdom') => void
  completeQuest: (id: string) => void
  generateDailyQuests: (userId: string) => void
}

const STORAGE_KEY = 'wos_level'

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

function load(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
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

function save(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage may be unavailable
  }
}

const QUEST_POOL: Omit<DailyQuest, 'done'>[] = [
  { id: 'q_log_tx', desc: 'Catat 1 transaksi hari ini', xp: 30 },
  { id: 'q_habit_3', desc: 'Selesaikan 3 habit hari ini', xp: 40 },
  { id: 'q_journal', desc: 'Tulis 1 journal entry', xp: 35 },
  { id: 'q_budget', desc: 'Buat atau update budget', xp: 40 },
  { id: 'q_checkin', desc: 'Daily check-in', xp: 25 },
  { id: 'q_networth', desc: 'Catat net worth hari ini', xp: 45 },
  { id: 'q_review_week', desc: 'Review catatan minggu ini', xp: 50 },
  { id: 'q_goal_contribute', desc: 'Kontribusi ke savings goal', xp: 35 },
  { id: 'q_todo_5', desc: 'Selesaikan 5 todo hari ini', xp: 40 },
  { id: 'q_sub_review', desc: 'Review subscription aktif', xp: 30 },
  { id: 'q_wealth_log', desc: 'Update asset portfolio', xp: 45 },
  { id: 'q_streak_check', desc: 'Pertahankan habit streak', xp: 35 },
]


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

export const useLevelStore = create<LevelState>((set, get) => {
  const initial = load()
  const initialLevel = computeLevel(initial.xp)
  const totalSkillsSpent = initial.skills.wealth + initial.skills.vitality + initial.skills.wisdom
  const skillPoints = Math.max(0, initialLevel - 1 - totalSkillsSpent)

  return {
    xp: initial.xp,
    level: initialLevel,
    skillPoints: Math.max(0, skillPoints),
    skills: initial.skills,
    dailyQuests: initial.dailyQuests,
    dailyQuestDate: initial.dailyQuestDate,

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
      save(updated)

      set({
        xp: newXp,
        level: newLevel,
        skillPoints: state.skillPoints + pointsGained,
      })

      if (typeof window !== 'undefined') {
        // Also check if this XP completes any daily quest
        // This is handled separately via completeQuest
      }
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
      save(updated)

      set({
        skills: newSkills,
        skillPoints: state.skillPoints - 1,
      })
    },

    completeQuest: (id: string) => {
      const state = get()
      const quest = state.dailyQuests.find((q) => q.id === id)
      if (!quest || quest.done) return

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
      save(updated)

      set({ dailyQuests: newQuests })

      // Award XP for completing quest
      get().addXP(quest.xp)
    },

    generateDailyQuests: (userId: string) => {
      const today = todayStr()
      const state = get()

      // Skip if already generated for today
      if (state.dailyQuestDate === today && state.dailyQuests.length > 0) return

      const indices = seededShuffle(userId, today)
      const quests: DailyQuest[] = indices.map((i) => ({
        ...QUEST_POOL[i]!,
        done: false,
      }))

      const updated: PersistedState = {
        xp: state.xp,
        skills: state.skills,
        dailyQuests: quests,
        dailyQuestDate: today,
        totalSkillPointsEarned: state.skillPoints + state.skills.wealth + state.skills.vitality + state.skills.wisdom,
      }
      save(updated)

      set({ dailyQuests: quests, dailyQuestDate: today })
    },
  }
})
