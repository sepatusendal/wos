import { create } from 'zustand'
import { todayStr } from '@wos/shared'

export interface TodayCheckin {
  mood: number       // 1-5
  energy: number     // 1-5
  highlight: string
  checkedAt: string  // ISO datetime
}

interface CheckinState {
  todayChecked: boolean
  todayMood: number
  todayEnergy: number
  todayHighlight: string

  checkIn: (mood: number, energy: number, highlight: string) => void
  getTodayCheckin: () => TodayCheckin | null
}

function storageKey(): string {
  return `checkin_${todayStr()}`
}

function loadToday(): { checked: boolean; mood: number; energy: number; highlight: string } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(storageKey())
    if (!raw) return null
    const data: TodayCheckin = JSON.parse(raw)
    return {
      checked: true,
      mood: data.mood,
      energy: data.energy,
      highlight: data.highlight,
    }
  } catch {
    return null
  }
}

const today = loadToday()

export const useCheckinStore = create<CheckinState>((set, get) => ({
  todayChecked: today?.checked ?? false,
  todayMood: today?.mood ?? 3,
  todayEnergy: today?.energy ?? 3,
  todayHighlight: today?.highlight ?? '',

  checkIn: (mood, energy, highlight) => {
    const data: TodayCheckin = {
      mood,
      energy,
      highlight,
      checkedAt: new Date().toISOString(),
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey(), JSON.stringify(data))
    }
    set({
      todayChecked: true,
      todayMood: mood,
      todayEnergy: energy,
      todayHighlight: highlight,
    })
  },

  getTodayCheckin: () => {
    const s = get()
    if (!s.todayChecked) return null
    return {
      mood: s.todayMood,
      energy: s.todayEnergy,
      highlight: s.todayHighlight,
      checkedAt: new Date().toISOString(),
    }
  },
}))
