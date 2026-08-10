import { useEffect, useState, useMemo, useCallback } from 'react'
import { NeubruModal, NeubruBtn } from './index'
import { useFinanceStore } from '../stores/financeStore'
import { useHabitStore } from '../stores/habitStore'
import { useTodoStore } from '../stores/todoStore'
import { useNotesStore } from '../stores/notesStore'
import { useAuthStore } from '../stores/authStore'
import { todayStr } from '@wos/shared'
import { useFormatCurrency } from '../stores/useFormatCurrency'

// ── Helpers ──────────────────────────────────────────────────

function dateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getWeekNumber(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1)
  const diff = d.getTime() - start.getTime()
  return Math.ceil(((diff / 86400000) + start.getDay() + 1) / 7)
}

function getWeekKey(d: Date): string {
  const year = d.getFullYear()
  const week = getWeekNumber(d).toString().padStart(2, '0')
  return `${year}-${week}`
}

function getWeekDateRange(d: Date): { start: string; end: string } {
  const day = d.getDay()
  const start = new Date(d)
  start.setDate(d.getDate() - day) // Go to Sunday
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start: dateStr(start), end: dateStr(end) }
}

// ── Component ────────────────────────────────────────────────

interface WeeklyReflectionProps {
  /**
   * Force-open the modal (called from AppLayout on Sunday).
   * When false, the component is inert.
   */
  trigger?: boolean
}

export default function WeeklyReflection({ trigger }: WeeklyReflectionProps) {
  const formatCurrency = useFormatCurrency()

  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState('')
  const [improve, setImprove] = useState('')
  const [target, setTarget] = useState('')

  const transactions = useFinanceStore((s) => s.transactions)
  const habits = useHabitStore((s) => s.habits)
  const habitLogs = useHabitStore((s) => s.logs)
  const todos = useTodoStore((s) => s.todos)
  const addNote = useNotesStore((s) => s.addNote)

  // Wait for trigger signal
  useEffect(() => {
    if (trigger) {
      const weekKey = getWeekKey(new Date())
      const alreadyDone = localStorage.getItem(`wos_weekly_reflection_${weekKey}`)
      if (!alreadyDone) {
        // Small delay so the page transition finishes first
        const timer = setTimeout(() => setOpen(true), 600)
        return () => clearTimeout(timer)
      }
    }
  }, [trigger])

  // ── Auto-populated weekly summary ──────────────────────────
  const weekSummary = useMemo(() => {
    const now = new Date()
    const { start, end } = getWeekDateRange(now)

    // Spending this week
    const weekTx = transactions.filter((t) => t.date >= start && t.date <= end)
    const weekSpending = weekTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

    // Habits done this week
    const activeHabits = habits.filter((h) => h.active)
    let totalTargetDays = 0
    let doneDays = 0
    for (const h of activeHabits) {
      for (let d = new Date(now); d >= new Date(start); d.setDate(d.getDate() - 1)) {
        const ds = dateStr(d)
        // For weekly habits, only count target days
        if (h.frequency === 'weekly') {
          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
          const dayName = dayNames[d.getDay()]!
          if (!(h.targetDays ?? []).includes(dayName)) continue
        }
        totalTargetDays++
        const log = habitLogs.find((l) => l.habitId === h.id && l.date === ds)
        if (log?.done) doneDays++
      }
    }

    // Todos completed this week
    const completedThisWeek = todos.filter((t) => t.completed && t.updatedAt >= start).length

    return {
      spending: weekSpending,
      habitsDone: `${doneDays}/${totalTargetDays}`,
      notesWritten: '—',
      todosCompleted: completedThisWeek,
    }
  }, [transactions, habits, habitLogs, todos])

  // ── Save reflection ────────────────────────────────────────
  const handleSave = useCallback(() => {
    const weekKey = getWeekKey(new Date())
    const now = new Date()
    const { start, end } = getWeekDateRange(now)

    // Save to localStorage to avoid duplicate prompts
    try { localStorage.setItem(`wos_weekly_reflection_${weekKey}`, new Date().toISOString()) } catch { /* ignore */ }

    // Save to notes with tag reflection
    const userId = useAuthStore.getState().userId
    if (!userId) return
    addNote(userId, {
      title: `Weekly Reflection — Week ${weekKey}`,
      content: [
        `## Weekly Reflection — Week ${weekKey} (${start} to ${end})`,
        '',
        '### ✨ Highlight minggu ini',
        highlight || '(tidak diisi)',
        '',
        '### 🔄 Yang bisa diperbaiki',
        improve || '(tidak diisi)',
        '',
        '### 🎯 Target minggu depan',
        target || '(tidak diisi)',
        '',
        '---',
        '`reflection` `weekly`',
      ].join('\n'),
      tags: ['reflection', 'weekly'],
      date: todayStr(),
      linkedTransactionId: null,
      linkedTodoId: null,
    })

    setOpen(false)
  }, [highlight, improve, target, addNote])

  const handleSkip = useCallback(() => {
    const weekKey = getWeekNumber(new Date()).toString().padStart(2, '0')
    const year = new Date().getFullYear()
    try { localStorage.setItem(`wos_weekly_reflection_${year}-${weekKey}`, 'skipped') } catch { /* ignore */ }
    setOpen(false)
  }, [])

  return (
    <NeubruModal open={open} onClose={handleSkip} title="🧘 Weekly Reflection">
      <div className="flex flex-col gap-5">
        {/* Gentle intro */}
        <div className="nb-panel p-4 text-sm font-medium leading-relaxed">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🌱</span>
            <span className="font-bold uppercase text-xs tracking-wide text-nb-fg-muted">
              Gak harus sempurna, yang penting progress ✨
            </span>
          </div>
          <div className="text-xs text-nb-fg-muted">
            Minggu ini: spending {formatCurrency(weekSummary.spending)},{' '}
            habit {weekSummary.habitsDone},{' '}
            {weekSummary.todosCompleted} tasks selesai.
          </div>
        </div>

        {/* Question 1: Highlight */}
        <div>
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted block mb-2">
            ✨ Highlight minggu ini?
          </label>
          <textarea
            value={highlight}
            onChange={(e) => setHighlight(e.target.value)}
            placeholder="Apa hal paling berkesan minggu ini?"
            rows={2}
            className="border-2 border-nb-border bg-white px-3 py-2 text-sm font-medium outline-none resize-y w-full"
            style={{ fontFamily: 'inherit' }}
          />
        </div>

        {/* Question 2: Improvement */}
        <div>
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted block mb-2">
            🔄 Apa yang bisa diperbaiki?
          </label>
          <textarea
            value={improve}
            onChange={(e) => setImprove(e.target.value)}
            placeholder="Ada yang bisa lebih baik minggu depan?"
            rows={2}
            className="border-2 border-nb-border bg-white px-3 py-2 text-sm font-medium outline-none resize-y w-full"
            style={{ fontFamily: 'inherit' }}
          />
        </div>

        {/* Question 3: Target */}
        <div>
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted block mb-2">
            🎯 Target minggu depan?
          </label>
          <textarea
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Apa yang ingin kamu capai minggu depan?"
            rows={2}
            className="border-2 border-nb-border bg-white px-3 py-2 text-sm font-medium outline-none resize-y w-full"
            style={{ fontFamily: 'inherit' }}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2.5">
          <NeubruBtn color="green" onClick={handleSave}>
            💾 Simpan
          </NeubruBtn>
          <NeubruBtn color="red" onClick={handleSkip}>
            Skip
          </NeubruBtn>
        </div>
      </div>
    </NeubruModal>
  )
}
