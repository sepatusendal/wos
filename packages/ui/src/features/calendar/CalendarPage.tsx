import { useEffect, useMemo, useState } from 'react'
import { useFinanceStore } from '../../stores/financeStore'
import { useTodoStore } from '../../stores/todoStore'
import { useAuthStore } from '../../stores/authStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { NeubruBtn, NeubruCard, NeubruTag, NeubruCheckbox } from '../../components'
import { createCurrencyFormatter } from '@wos/shared'
import { formatShortDate, todayStr, getMonthRange } from '@wos/shared'
import { toast } from 'sonner'

const DAY_NAMES = ['SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB', 'MIN']
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const CAT_COLORS: Record<string, 'yellow' | 'blue' | 'green' | 'pink' | 'orange' | 'purple' | 'red'> = {
  Gaji: 'green', Freelance: 'blue', Investasi: 'purple', Bisnis: 'orange',
  Makan: 'yellow', Transport: 'blue', Belanja: 'pink', Hiburan: 'orange',
  Tagihan: 'red', Kesehatan: 'pink', Pendidikan: 'purple', Lainnya: 'yellow',
  Transfer: 'blue',
}

function getMonthDays(year: number, month: number): Date[] {
  const daysInMonth = new Date(year, month, 0).getDate()
  return Array.from({ length: daysInMonth }, (_, i) => new Date(year, month - 1, i + 1))
}

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfMonthOffset(year: number, month: number): number {
  // getDay() returns 0=Sun, 1=Mon, ..., 6=Sat
  // We want 0=Mon (SEN), 6=Sun (MIN)
  const firstDay = new Date(year, month - 1, 1).getDay()
  return firstDay === 0 ? 6 : firstDay - 1
}

export default function CalendarPage() {
  const userId = useAuthStore((s) => s.userId)
  const currency = useSettingsStore((s) => s.settings?.currency) ?? 'IDR'
  const locale = useSettingsStore((s) => s.settings?.locale) ?? 'id-ID'
  const fmt = useMemo(() => createCurrencyFormatter(currency, locale), [currency, locale])

  const { transactions, recurring, fetchAll: fetchFinance } = useFinanceStore()
  const { todos, fetchAll: fetchTodo, toggleComplete } = useTodoStore()

  const today = todayStr()

  // Month navigation: start at current month
  const t = new Date()
  const [viewYear, setViewYear] = useState(t.getFullYear())
  const [viewMonth, setViewMonth] = useState(t.getMonth() + 1) // 1-indexed
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!userId) return
    Promise.all([fetchFinance(userId), fetchTodo(userId)])
      .then(() => setLoaded(true))
      .catch(() => {
        toast.error('Gagal memuat data kalender')
        setLoaded(true)
      })
  }, [userId, fetchFinance, fetchTodo])

  // Navigation handlers
  const goPrev = () => {
    if (viewMonth === 1) {
      setViewYear(viewYear - 1)
      setViewMonth(12)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  const goNext = () => {
    if (viewMonth === 12) {
      setViewYear(viewYear + 1)
      setViewMonth(1)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  const goToday = () => {
    const now = new Date()
    setViewYear(now.getFullYear())
    setViewMonth(now.getMonth() + 1)
    setSelectedDate(today)
  }

  // Build the month grid
  const monthDays = useMemo(() => getMonthDays(viewYear, viewMonth), [viewYear, viewMonth])
  const offset = useMemo(() => startOfMonthOffset(viewYear, viewMonth), [viewYear, viewMonth])
  const { start: monthStart, end: monthEnd } = useMemo(() => getMonthRange(viewYear, viewMonth), [viewYear, viewMonth])

  // Group transactions by date within the month
  const txByDate = useMemo(() => {
    const map: Record<string, { income: number; expense: number; txs: typeof transactions }> = {}
    transactions
      .filter((t) => t.date >= monthStart && t.date <= monthEnd)
      .forEach((t) => {
        const entry = map[t.date] = map[t.date] || { income: 0, expense: 0, txs: [] }
        if (t.type === 'income') entry.income += t.amount
        else entry.expense += t.amount
        entry.txs.push(t)
      })
    return map
  }, [transactions, monthStart, monthEnd])

  // Group todos by due date within the month
  const todosByDate = useMemo(() => {
    const map: Record<string, typeof todos> = {}
    todos
      .filter((t) => t.dueDate && t.dueDate >= monthStart && t.dueDate <= monthEnd)
      .forEach((t) => {
        const date = t.dueDate!
        const entry = map[date] = map[date] || []
        entry.push(t)
      })
    return map
  }, [todos, monthStart, monthEnd])

  // Recurring items with nextDate in this month
  const recurringByDate = useMemo(() => {
    const map: Record<string, typeof recurring> = {}
    recurring
      .filter((r) => r.active && r.nextDate >= monthStart && r.nextDate <= monthEnd)
      .forEach((r) => {
        const entry = map[r.nextDate] = map[r.nextDate] || []
        entry.push(r)
      })
    return map
  }, [recurring, monthStart, monthEnd])

  // Month stats
  const monthIncome = useMemo(
    () => Object.values(txByDate).reduce((s, d) => s + d.income, 0),
    [txByDate],
  )
  const monthExpense = useMemo(
    () => Object.values(txByDate).reduce((s, d) => s + d.expense, 0),
    [txByDate],
  )
  const monthTodoCount = useMemo(() => Object.values(todosByDate).reduce((s, d) => s + d.length, 0), [todosByDate])

  // Determine if a day string is a weekend (Sabtu=5, Minggu=6 in our offset)
  const isWeekend = (d: Date): boolean => {
    const dow = d.getDay() // 0=Sun, 6=Sat
    return dow === 0 || dow === 6
  }

  // Selected date detail
  const selectedTxs = selectedDate ? txByDate[selectedDate]?.txs ?? [] : []
  const selectedTodos = selectedDate ? todosByDate[selectedDate] ?? [] : []
  const selectedRecurring = selectedDate ? recurringByDate[selectedDate] ?? [] : []

  const handleToggleTodo = async (id: string) => {
    try {
      await toggleComplete(id)
    } catch {
      toast.error('Gagal mengubah status todo')
    }
  }

  const handleAddQuickTransaction = () => {
    if (!selectedDate) return
    // Navigate to finance page with date prefilled
    window.dispatchEvent(new CustomEvent('wos:navigate', { detail: { page: 'finance', prefillDate: selectedDate } }))
  }

  const cellClass = (dateStr: string, d: Date) => {
    const base = 'min-h-20 border-2 border-nb-border bg-white cursor-pointer hover:bg-nb-yellow/20 p-1.5 flex flex-col gap-0.5 transition-colors'
    if (dateStr === today) return `${base} !bg-nb-yellow`
    if (isWeekend(d)) return `${base} bg-nb-bg/60`
    return base
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-lg font-bold uppercase text-nb-fg-muted animate-pulse">Loading kalender...</span>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-7 gap-4 flex-wrap">
        <h2 className="text-[1.8rem]">📅 Kalender</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <NeubruBtn size="sm" onClick={goPrev}>
            &#8592; Prev
          </NeubruBtn>
          <span className="text-xl font-extrabold uppercase min-w-[180px] text-center">
            {MONTH_NAMES[viewMonth - 1]} {viewYear}
          </span>
          <NeubruBtn size="sm" onClick={goNext}>
            Next &#8594;
          </NeubruBtn>
          <NeubruBtn size="sm" color="yellow" onClick={goToday}>
            &#128197; Hari Ini
          </NeubruBtn>
        </div>
      </div>

      {/* Mini Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1">
            Pemasukan Bulan Ini
          </div>
          <div className="text-nb-green font-mono text-lg font-extrabold">+{fmt(monthIncome)}</div>
        </NeubruCard>
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1">
            Pengeluaran Bulan Ini
          </div>
          <div className="text-nb-red font-mono text-lg font-extrabold">-{fmt(monthExpense)}</div>
        </NeubruCard>
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1">
            Todo Bulan Ini
          </div>
          <div className="text-nb-orange font-mono text-lg font-extrabold">{monthTodoCount} tugas</div>
        </NeubruCard>
      </div>

      {/* Calendar Grid */}
      <div className="border-2 border-nb-border shadow-nb-sm mb-6">
        {/* Day name header row */}
        <div className="grid grid-cols-7">
          {DAY_NAMES.map((name, i) => {
            const isWeekendCol = i === 5 || i === 6
            return (
              <div
                key={name}
                className={`text-center py-2 font-extrabold text-xs uppercase tracking-[0.1em] border-b-2 border-nb-border ${
                  isWeekendCol ? 'bg-nb-bg/60 text-nb-fg-muted' : 'bg-nb-bg'
                } ${i < 6 ? 'border-r-2 border-nb-border' : ''}`}
              >
                {name}
              </div>
            )
          })}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {/* Empty cells before first day */}
          {Array.from({ length: offset }, (_, i) => (
            <div
              key={`empty-${i}`}
              className="min-h-20 border-r-2 border-b-2 border-nb-border bg-nb-bg opacity-30"
            />
          ))}

          {/* Actual day cells */}
          {monthDays.map((d) => {
            const dateStr = toDateStr(d)
            const info = txByDate[dateStr]
            const todoItems = todosByDate[dateStr] ?? []
            const recItems = recurringByDate[dateStr] ?? []
            const isToday = dateStr === today
            const isSelected = dateStr === selectedDate
            const hasContent = (info && (info.income > 0 || info.expense > 0)) || todoItems.length > 0 || recItems.length > 0

            return (
              <div
                key={dateStr}
                className={`${cellClass(dateStr, d)} border-r-2 border-b-2 ${
                  isSelected ? 'ring-2 ring-nb-blue ring-inset' : ''
                } ${!hasContent ? 'opacity-50' : ''}`}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
              >
                <span className={`text-sm font-extrabold leading-none ${isToday ? 'text-nb-red' : ''}`}>
                  {d.getDate()}
                </span>

                {info && info.income > 0 && (
                  <span className="text-[10px] font-extrabold text-nb-green leading-tight truncate">
                    +{fmt(info.income)}
                  </span>
                )}
                {info && info.expense > 0 && (
                  <span className="text-[10px] font-extrabold text-nb-red leading-tight truncate">
                    -{fmt(info.expense)}
                  </span>
                )}

                {/* Todo count badge */}
                {todoItems.length > 0 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 bg-nb-orange border-2 border-nb-border rounded-full text-[10px] font-extrabold text-white leading-none mt-auto">
                    {todoItems.length}
                  </span>
                )}

                {/* Recurring indicator */}
                {recItems.length > 0 && (
                  <span className="text-[10px] font-bold text-nb-purple leading-tight truncate">
                    &#8635; {recItems.length}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Day Detail Panel */}
      {selectedDate && (
        <div className="border-2 border-nb-border shadow-nb-sm p-5 bg-white mb-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-extrabold uppercase">
              &#128197; {formatShortDate(selectedDate)}
              {selectedDate === today && (
                <span className="ml-2 text-xs font-bold px-2 py-0.5 bg-nb-yellow border-2 border-nb-border">
                  HARI INI
                </span>
              )}
            </h3>
            <NeubruBtn size="sm" color="green" onClick={handleAddQuickTransaction}>
              + Transaksi
            </NeubruBtn>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Transactions for this day */}
            <div>
              <h4 className="text-sm font-bold uppercase text-nb-fg-muted mb-3">
                Transaksi ({selectedTxs.length})
              </h4>
              {selectedTxs.length === 0 ? (
                <p className="text-sm text-nb-fg-muted italic">Tidak ada transaksi</p>
              ) : (
                <div className="flex flex-col divide-y divide-nb-border/60 border-2 border-nb-border">
                  {[...selectedTxs]
                    .sort((a, b) => b.amount - a.amount)
                    .map((t) => (
                      <div key={t.id} className="flex items-center justify-between gap-2 px-3 py-2.5 bg-white">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-lg shrink-0">
                            {t.type === 'income' ? '💰' : '💳'}
                          </span>
                          <div className="min-w-0">
                            <div className="font-bold text-sm truncate">
                              {t.description || t.category}
                            </div>
                            <div className="text-[11px] text-nb-fg-muted mt-0.5">
                              <NeubruTag label={t.category} color={CAT_COLORS[t.category] || 'yellow'} />
                            </div>
                          </div>
                        </div>
                        <span
                          className={`font-mono font-bold text-sm shrink-0 ${
                            t.type === 'income' ? 'text-nb-green' : 'text-nb-red'
                          }`}
                        >
                          {t.type === 'income' ? '+' : '-'}
                          {fmt(t.amount)}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Todos & Recurring for this day */}
            <div className="flex flex-col gap-6">
              {/* Todos */}
              <div>
                <h4 className="text-sm font-bold uppercase text-nb-fg-muted mb-3">
                  Todo ({selectedTodos.length})
                </h4>
                {selectedTodos.length === 0 ? (
                  <p className="text-sm text-nb-fg-muted italic">Tidak ada todo</p>
                ) : (
                  <div className="flex flex-col divide-y divide-nb-border/60 border-2 border-nb-border">
                    {selectedTodos.map((t) => (
                      <div
                        key={t.id}
                        className={`flex items-center gap-3 px-3 py-2.5 bg-white ${t.completed ? 'opacity-50' : ''}`}
                      >
                        <NeubruCheckbox checked={t.completed} onChange={() => handleToggleTodo(t.id)} />
                        <div className="flex-1 min-w-0">
                          <span
                            className={`font-bold text-sm ${t.completed ? 'line-through text-nb-fg-muted' : ''}`}
                          >
                            {t.title}
                          </span>
                          {t.tags.length > 0 && (
                            <div className="text-[10px] text-nb-fg-muted mt-0.5">
                              {t.tags.map((tag) => (
                                <span key={tag} className="inline-block mr-1">#{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <NeubruTag
                          label={t.priority}
                          color={
                            t.priority === 'high'
                              ? 'red'
                              : t.priority === 'medium'
                              ? 'orange'
                              : 'green'
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recurring */}
              {selectedRecurring.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold uppercase text-nb-fg-muted mb-3">
                    Recurring ({selectedRecurring.length})
                  </h4>
                  <div className="flex flex-col divide-y divide-nb-border/60 border-2 border-nb-border">
                    {selectedRecurring.map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2.5 bg-white">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-lg shrink-0">
                            {r.type === 'income' ? '💰' : '💳'}
                          </span>
                          <div className="min-w-0">
                            <div className="font-bold text-sm truncate">{r.name}</div>
                            <div className="text-[11px] text-nb-fg-muted">
                              {r.frequency} &#183; {r.category}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`font-mono font-bold text-sm shrink-0 ${
                            r.type === 'income' ? 'text-nb-green' : 'text-nb-red'
                          }`}
                        >
                          {r.type === 'income' ? '+' : '-'}
                          {fmt(r.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
