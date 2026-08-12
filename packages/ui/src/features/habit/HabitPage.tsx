import { useEffect, useMemo, useState } from 'react'
import { useHabitStore } from '../../stores/habitStore'
import { useAuthStore } from '../../stores/authStore'
import { NeubruBtn, NeubruCard, NeubruInput, NeubruSelect, NeubruModal, NeubruCheckbox } from '../../components'
import { toast } from 'sonner'
import { todayStr } from '@wos/shared'
import type { Habit, HabitColor, HabitFrequency } from '@wos/shared'
import { useLevelStore } from '../../stores/levelStore'

// ── Constants ────────────────────────────────────────────────

const EMOJIS = ['🏃', '💪', '🏋️', '📚', '✍️', '🧘', '🎯', '💤', '💧', '🥗', '🚭', '🎨', '🎸', '✈️']

const COLORS: Array<{ name: HabitColor; hex: string }> = [
  { name: 'yellow', hex: '#ffd800' },
  { name: 'blue', hex: '#2f6bff' },
  { name: 'green', hex: '#22c55e' },
  { name: 'pink', hex: '#ff5c8a' },
  { name: 'orange', hex: '#ff8a00' },
  { name: 'purple', hex: '#8b5cf6' },
  { name: 'red', hex: '#ff4b4b' },
]

const DAY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'monday', label: 'Senin' },
  { value: 'tuesday', label: 'Selasa' },
  { value: 'wednesday', label: 'Rabu' },
  { value: 'thursday', label: 'Kamis' },
  { value: 'friday', label: 'Jumat' },
  { value: 'saturday', label: 'Sabtu' },
  { value: 'sunday', label: 'Minggu' },
]

const DAY_LABELS: Record<string, string> = {
  monday: 'Sen', tuesday: 'Sel', wednesday: 'Rab', thursday: 'Kam',
  friday: 'Jum', saturday: 'Sab', sunday: 'Min',
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

// ── Helpers ──────────────────────────────────────────────────

function dateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ── Component ────────────────────────────────────────────────

export default function HabitPage() {
  const userId = useAuthStore((s) => s.userId)
  const {
    habits, logs, fetchAll, addHabit, editHabit, deleteHabit,
    toggleActive, toggleLog, getStreak, getCompletionRate, getFrozenDates, getFreezeUsage,
  } = useHabitStore()

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('✅')
  const [frequency, setFrequency] = useState<HabitFrequency>('daily')
  const [targetDays, setTargetDays] = useState<string[]>([])
  const [color, setColor] = useState<HabitColor>('yellow')

  // Filter state
  const [filter, setFilter] = useState<'all' | 'daily' | 'weekly'>('all')

  // ── Data fetching ──────────────────────────────────────

  useEffect(() => {
    if (userId) fetchAll(userId)
  }, [userId, fetchAll])

  // ── Computed values ─────────────────────────────────────

  const [today, setToday] = useState(() => todayStr())

  // Update `today` at midnight so last7Days stays current
  useEffect(() => {
    const now = new Date()
    const msUntilMidnight =
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime()
    const timer = setTimeout(() => {
      setToday(todayStr())
    }, msUntilMidnight + 1000)
    return () => clearTimeout(timer)
  }, [today])

  const last7Days = useMemo(() => {
    const days: { dateStr: string; label: string; dayName: string }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      days.push({
        dateStr: dateStr(d),
        label: DAY_LABELS[DAY_NAMES[d.getDay()]!]!,
        dayName: DAY_NAMES[d.getDay()]!,
      })
    }
    return days
  }, [today])

  const filteredHabits = useMemo(() => {
    if (filter === 'all') return habits
    return habits.filter((h) => h.frequency === filter)
  }, [habits, filter])

  const activeToday = useMemo(() => {
    const today = new Date()
    const todayDay = DAY_NAMES[today.getDay()]
    return habits.filter((h) => {
      if (!h.active) return false
      if (h.frequency === 'daily') return true
      return (h.targetDays ?? []).includes(todayDay!)
    }).length
  }, [habits])

  const bestStreak = useMemo(() => {
    if (habits.length === 0) return 0
    return Math.max(0, ...habits.map((h) => getStreak(h.id)))
  }, [habits, getStreak])

  const freezeUsage = useMemo(() => getFreezeUsage(), [habits, logs, getFreezeUsage])

  // ── Modal handlers ──────────────────────────────────────

  const openAdd = () => {
    setEditId(null)
    setName('')
    setEmoji('✅')
    setFrequency('daily')
    setTargetDays([])
    setColor('yellow')
    setShowModal(true)
  }

  const openEdit = (h: Habit) => {
    setEditId(h.id)
    setName(h.name)
    setEmoji(h.emoji)
    setFrequency(h.frequency)
    setTargetDays([...h.targetDays])
    setColor(h.color)
    setShowModal(true)
  }

  const save = async () => {
    if (!userId || !name.trim()) return

    if (editId) {
      const existing = useHabitStore.getState().habits.find((h) => h.id === editId)
      if (!existing) { toast.error('Habit tidak ditemukan'); return }
      await editHabit({
        id: editId,
        name: name.trim(),
        emoji,
        frequency,
        targetDays: frequency === 'weekly' ? targetDays : [],
        color,
        active: existing.active,
      })
      toast.success('Habit diperbarui')
    } else {
      await addHabit(userId, {
        name: name.trim(),
        emoji,
        frequency,
        targetDays: frequency === 'weekly' ? targetDays : [],
        color,
      })
      toast.success('Habit baru ditambahkan')
    }
    setShowModal(false)
  }

  const handleDelete = async (id: string) => {
    await deleteHabit(id)
    toast.success('Habit dihapus')
  }

  /**
   * XP is paid at most once per (habit, day), and only for *today*.
   *
   * The old version awarded 10 XP on every tick, so check/uncheck/check was
   * an unlimited XP tap. The guard is the existence of a log row for that
   * date: once a day has been logged at all, that day is settled and can
   * never pay out again. Backfilling a past day is deliberately worth 0 XP —
   * otherwise rapidly filling in a month of history would be the same farm.
   */
  const handleToggleDay = async (habitId: string, date: string) => {
    const existing = logs.find((l) => l.habitId === habitId && l.date === date)
    const newDone = !existing?.done
    const firstLogForDay = !existing
    await toggleLog(habitId, date, newDone)

    if (!newDone) return

    if (date !== todayStr()) {
      toast.success('✓ Backfill tercatat (tanpa XP)')
      return
    }
    if (!firstLogForDay) {
      toast.success('✓ Tercatat')
      return
    }

    useLevelStore.getState().addXP(10)
    toast.success('⚡ +10 XP')
    // Confetti for 30-day streak
    const streak = useHabitStore.getState().getStreak(habitId)
    if (streak >= 30) {
      ;(window as any).__wosConfetti?.()
    }
  }

  const handleToggleToday = (habitId: string) => handleToggleDay(habitId, todayStr())

  const toggleDay = (dayValue: string) => {
    setTargetDays((prev) =>
      prev.includes(dayValue) ? prev.filter((d) => d !== dayValue) : [...prev, dayValue]
    )
  }

  // ── Render helpers ──────────────────────────────────────

  const getColorHex = (c: string) => COLORS.find((x) => x.name === c)?.hex ?? '#ffd800'

  const isTodayDone = (habitId: string) => {
    const today = todayStr()
    return logs.some((l) => l.habitId === habitId && l.date === today && l.done)
  }

  // ── JSX ─────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-7 gap-4 flex-wrap">
        <h2 className="text-[1.8rem]">🔥 Habits</h2>
        <NeubruBtn color="green" onClick={openAdd}>+ Habit</NeubruBtn>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-5 mb-7">
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Total Habits</div>
          <div className="font-mono text-xl font-extrabold">{habits.length}</div>
        </NeubruCard>
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Aktif Hari Ini</div>
          <div className="text-nb-green font-mono text-xl font-extrabold">{activeToday}</div>
          <div className="text-xs text-nb-fg-muted mt-1 font-medium">
            {habits.filter((h) => h.active).length} habits aktif
          </div>
        </NeubruCard>
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Streak Terbaik</div>
          <div className="text-nb-orange font-mono text-xl font-extrabold">🔥 {bestStreak} hari</div>
        </NeubruCard>
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Streak Freeze</div>
          <div className="font-mono text-xl font-extrabold">
            🧊 {freezeUsage.available - freezeUsage.used}/{freezeUsage.available}
          </div>
          <div className="text-xs text-nb-fg-muted mt-1 font-medium">
            Dari skill Vitality · reset tiap bulan
          </div>
        </NeubruCard>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap mb-5">
        {(['all', 'daily', 'weekly'] as const).map((f) => (
          <NeubruBtn
            key={f}
            size="sm"
            color={filter === f ? 'yellow' : undefined}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Semua' : f === 'daily' ? '📅 Harian' : '📆 Mingguan'}
          </NeubruBtn>
        ))}
      </div>

      {/* Habits list */}
      <div className="flex flex-col gap-3">
        {filteredHabits.length === 0 ? (
          <div className="nb-panel text-center py-16">
            <div className="text-5xl mb-3">🔥</div>
            <div className="font-bold uppercase text-nb-fg-muted">
              {filter !== 'all' ? `Belum ada habit ${filter === 'daily' ? 'harian' : 'mingguan'}` : 'Belum ada habit'}
            </div>
            <div className="text-sm text-nb-fg-muted mt-2 font-medium">Klik "+ Habit" untuk mulai</div>
          </div>
        ) : (
          filteredHabits.map((habit) => {
            const todayDone = isTodayDone(habit.id)
            const streak = getStreak(habit.id)
            const rate = getCompletionRate(habit.id, 30)
            const frozenDates = new Set(getFrozenDates(habit.id))

            return (
              <div key={habit.id} className="nb-list-item flex-wrap" style={{ opacity: habit.active ? 1 : 0.45 }}>
                {/* Left: habit info */}
                <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                  {/* Checkbox for today's entry */}
                  <NeubruCheckbox
                    checked={todayDone}
                    onChange={() => handleToggleToday(habit.id)}
                  />

                  <div className="flex items-center gap-2">
                    <span className="text-xl">{habit.emoji}</span>
                    <div>
                      <div className="font-bold text-sm flex items-center gap-2">
                        {habit.name}
                        {/* Color dot */}
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full border-2 border-nb-border"
                          style={{ backgroundColor: getColorHex(habit.color) }}
                        />
                      </div>

                      {/* Weekly habit: show applicable days */}
                      {habit.frequency === 'weekly' && habit.targetDays.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {habit.targetDays.map((d) => (
                            <span
                              key={d}
                              className="text-[10px] font-bold uppercase px-1.5 py-0.5 border-2 border-nb-border bg-nb-bg-muted"
                            >
                              {DAY_LABELS[d]}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Middle: 7-day mini calendar — clickable for catch-up entries */}
                <div className="flex items-center gap-0.5 mx-2">
                  {last7Days.map((day) => {
                    const log = logs.find((l) => l.habitId === habit.id && l.date === day.dateStr)
                    const isApplicable = habit.frequency === 'daily' || habit.targetDays.includes(day.dayName)
                    const done = log?.done ?? false
                    const isToday = day.dateStr === today
                    const isFrozen = frozenDates.has(day.dateStr)

                    return (
                      <div key={day.dateStr} className="flex flex-col items-center gap-0.5">
                        <span className="text-[9px] font-bold text-nb-fg-muted leading-none">
                          {isToday ? '⚡' : day.label}
                        </span>
                        <button
                          type="button"
                          disabled={!isApplicable}
                          onClick={() => handleToggleDay(habit.id, day.dateStr)}
                          className={`w-4 h-4 border-2 border-nb-border p-0 leading-none text-[9px] flex items-center justify-center ${
                            !isApplicable
                              ? 'cursor-not-allowed'
                              : isToday
                                ? 'cursor-pointer hover:scale-125 transition-transform'
                                : 'cursor-cell hover:opacity-70 transition-opacity'
                          }`}
                          style={{
                            backgroundColor: !isApplicable
                              ? '#e0e0e0'
                              : done
                                ? getColorHex(habit.color)
                                : 'transparent',
                            outline: isToday ? '2px solid #0b0b0b' : undefined,
                            outlineOffset: isToday ? '1px' : undefined,
                          }}
                          title={
                            !isApplicable
                              ? `${day.label}: N/A`
                              : isFrozen
                                ? `${day.label}: terlewat, ditahan streak freeze 🧊`
                                : isToday
                                  ? `Hari ini — ${done ? 'sudah selesai' : 'klik untuk selesai (+10 XP sekali)'}`
                                  : `${day.label}: ${done ? 'Done' : 'Not done'} — klik untuk catch-up (tanpa XP)`
                          }
                        >
                          {isFrozen ? '🧊' : ''}
                        </button>
                      </div>
                    )
                  })}
                </div>

                {/* Right: stats + actions */}
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-xs font-bold whitespace-nowrap">
                      🔥 {streak} hari
                    </span>
                    <span className="text-[11px] font-semibold text-nb-fg-muted whitespace-nowrap">
                      {rate}% (30 hari)
                    </span>
                  </div>

                  <div className="flex gap-1.5">
                    <NeubruBtn
                      size="sm"
                      color={habit.active ? 'orange' : 'green'}
                      onClick={() => toggleActive(habit.id, !habit.active)}
                      title={habit.active ? 'Nonaktifkan' : 'Aktifkan'}
                    >
                      {habit.active ? '⏸' : '▶'}
                    </NeubruBtn>
                    <NeubruBtn size="sm" color="yellow" className="nb-btn-icon" onClick={() => openEdit(habit)}>
                      ✎
                    </NeubruBtn>
                    <NeubruBtn size="sm" color="red" className="nb-btn-icon" onClick={() => handleDelete(habit.id)}>
                      ✕
                    </NeubruBtn>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Add / Edit Modal */}
      <NeubruModal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editId ? 'Edit Habit' : 'Tambah Habit'}
      >
        {/* Name */}
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Nama</label>
          <NeubruInput value={name} onChange={setName} placeholder="Nama habit..." />
        </div>

        {/* Emoji picker */}
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Emoji</label>
          <div className="grid grid-cols-7 gap-1.5">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                className={`text-xl w-10 h-10 flex items-center justify-center rounded cursor-pointer border-2 transition-colors ${
                  emoji === e
                    ? 'border-black bg-nb-yellow'
                    : 'border-nb-border bg-white hover:bg-nb-yellow/30'
                }`}
                onClick={() => setEmoji(e)}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Frequency */}
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Frekuensi</label>
          <NeubruSelect
            value={frequency}
            onChange={(v) => setFrequency(v as HabitFrequency)}
            options={[
              { value: 'daily', label: '📅 Harian' },
              { value: 'weekly', label: '📆 Mingguan' },
            ]}
          />
        </div>

        {/* Weekly day picker */}
        {frequency === 'weekly' && (
          <div className="flex flex-col gap-1.5 mb-4">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Hari Berlaku</label>
            <div className="flex gap-1.5 flex-wrap">
              {DAY_OPTIONS.map((d) => {
                const selected = targetDays.includes(d.value)
                return (
                  <button
                    key={d.value}
                    type="button"
                    className={`text-xs font-bold uppercase px-3 py-1.5 border-2 cursor-pointer transition-colors ${
                      selected
                        ? 'border-black bg-nb-yellow'
                        : 'border-nb-border bg-white hover:bg-nb-yellow/30'
                    }`}
                    onClick={() => toggleDay(d.value)}
                  >
                    {d.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Color picker */}
        <div className="flex flex-col gap-1.5 mb-5">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Warna</label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c.name}
                type="button"
                className={`w-9 h-9 rounded-full border-2 cursor-pointer transition-transform ${
                  color === c.name ? 'border-black scale-110' : 'border-nb-border hover:scale-105'
                }`}
                style={{ backgroundColor: c.hex }}
                onClick={() => setColor(c.name)}
                title={c.name}
              />
            ))}
          </div>
        </div>

        <NeubruBtn color="green" onClick={save}>
          💾 {editId ? 'Update' : 'Simpan'}
        </NeubruBtn>
      </NeubruModal>
    </div>
  )
}
