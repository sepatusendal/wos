import { useState, useMemo } from 'react'
import type { Transaction } from '@wos/shared'
import { todayStr, formatShortDate } from '@wos/shared'
import { useNotesStore } from '../stores/notesStore'
import { useTodoStore } from '../stores/todoStore'
import { useFormatCurrency } from '../stores/useFormatCurrency'
import { NeubruBtn, NeubruTag } from './index'

const CAT_COLORS: Record<string, 'yellow' | 'blue' | 'green' | 'pink' | 'orange' | 'purple' | 'red'> = {
  Gaji: 'green', Freelance: 'blue', Investasi: 'purple', Bisnis: 'orange',
  Makan: 'yellow', Transport: 'blue', Belanja: 'pink', Hiburan: 'orange',
  Tagihan: 'red', Kesehatan: 'pink', Pendidikan: 'purple', Transfer: 'blue', Lainnya: 'yellow',
}

const CAT_BG: Record<string, string> = {
  yellow: '#ffd800', blue: '#2f6bff', green: '#22c55e', pink: '#ff5c8a',
  orange: '#ff8a00', purple: '#8b5cf6', red: '#ff4b4b',
}

const TRANSACTION_EMOJIS: Record<string, string> = {
  Makan: '🍜', Transport: '🚗', Belanja: '🛍️', Hiburan: '🎮',
  Tagihan: '📄', Kesehatan: '🏥', Pendidikan: '📚', Transfer: '🔄',
  Gaji: '💰', Freelance: '💻', Investasi: '📈', Bisnis: '🏪', Lainnya: '📌',
}

interface Props {
  transactions: Transaction[]
  onEdit: (tx: any) => void
  onDelete: (id: string) => void
}

const PAGE_SIZE = 50

export default function MoneyTimeline({ transactions, onEdit, onDelete }: Props) {
  const formatCurrency = useFormatCurrency()
  const allNotes = useNotesStore((s) => s.notes)
  const allTodos = useTodoStore((s) => s.todos)
  const [showCount, setShowCount] = useState(PAGE_SIZE)

  const today = todayStr()

  // Group by date, sorted descending (most recent first)
  const timeline = useMemo(() => {
    const grouped = new Map<string, Transaction[]>()
    const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date))
    for (const tx of sorted) {
      const existing = grouped.get(tx.date) || []
      existing.push(tx)
      grouped.set(tx.date, existing)
    }
    return Array.from(grouped.entries())
  }, [transactions])

  // Map note/todo links per transaction
  const linkedNotesByTx = useMemo(() => {
    const map = new Map<string, { id: string; title: string }[]>()
    allNotes.forEach((n) => {
      if (n.linkedTransactionId) {
        if (!map.has(n.linkedTransactionId)) map.set(n.linkedTransactionId, [])
        map.get(n.linkedTransactionId)!.push({ id: n.id, title: n.title })
      }
    })
    return map
  }, [allNotes])

  const linkedTodosByTx = useMemo(() => {
    const map = new Map<string, { id: string; title: string }[]>()
    allNotes.forEach((n) => {
      if (n.linkedTodoId) {
        // Find todos connected via notes that link to both transaction and todo
        // For simplicity, check if a transaction-linked note also has a linkedTodoId
        const txId = n.linkedTransactionId
        if (txId && n.linkedTodoId) {
          if (!map.has(txId)) map.set(txId, [])
          const todo = allTodos.find((t) => t.id === n.linkedTodoId)
          if (todo && !map.get(txId)!.find((x) => x.id === todo.id)) {
            map.get(txId)!.push({ id: todo.id, title: todo.title })
          }
        }
      }
    })
    return map
  }, [allNotes, allTodos])

  const visibleEntries = timeline.slice(0, showCount)
  const hasMore = showCount < timeline.length

  return (
    <div className="flex flex-col gap-0">
      {/* Timeline vertical line container */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[19px] top-0 bottom-0 w-[3px] bg-nb-border z-0" />

        {visibleEntries.map(([date, txs]) => {
          const isToday = date === today
          const d = new Date(date + 'T00:00:00')
          const dayNum = d.getDate()
          const dayName = d.toLocaleDateString('id-ID', { weekday: 'short' })
          const monthName = d.toLocaleDateString('id-ID', { month: 'short' })
          const year = d.getFullYear()

          return (
            <div key={date} className="relative mb-6 last:mb-0">
              {/* Date pill */}
              <div className="flex items-center gap-3 mb-3 relative z-10">
                <div className={`w-[41px] h-[41px] rounded-full border-3 border-nb-border flex items-center justify-center font-black text-sm ${isToday ? 'bg-nb-yellow shadow-nb-sm' : 'bg-white'}`}>
                  {dayNum}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm uppercase tracking-wide">
                      📅 {dayName}, {dayNum} {monthName} {year}
                    </span>
                    {isToday && (
                      <span className="text-[10px] font-bold bg-nb-yellow border-2 border-nb-border px-2 py-0.5 uppercase">
                        Today
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Transaction cards */}
              <div className="ml-[56px] flex flex-col gap-2.5">
                {txs.map((tx) => {
                  const txNotes = linkedNotesByTx.get(tx.id) || []
                  const txTodos = linkedTodosByTx.get(tx.id) || []
                  const hasLinks = txNotes.length > 0 || txTodos.length > 0
                  const color = CAT_COLORS[tx.category] || 'yellow'
                  const borderColor = CAT_BG[color] || '#ffd800'
                  const emoji = TRANSACTION_EMOJIS[tx.category] || (tx.type === 'income' ? '💰' : '💳')

                  return (
                    <div
                      key={tx.id}
                      className={`nb-list-item items-start pr-2 relative ${isToday ? 'bg-nb-yellow/20' : ''}`}
                      style={{ borderLeft: `4px solid ${borderColor}` }}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="text-2xl pt-0.5 flex-shrink-0">{emoji}</span>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-sm leading-tight break-words">
                            {tx.description || tx.category}
                          </div>
                          <div className="flex gap-1.5 items-center mt-1 flex-wrap">
                            <NeubruTag label={tx.category} color={color} />
                            <span className="text-[11px] font-bold text-nb-fg-muted">
                              {formatShortDate(tx.date)}
                            </span>
                            {hasLinks && (
                              <span className="flex items-center gap-1">
                                {txNotes.length > 0 && (
                                  <span className="text-xs font-bold text-nb-purple" title={txNotes.map((n) => n.title).join('\n')}>
                                    📝
                                  </span>
                                )}
                                {txTodos.length > 0 && (
                                  <span className="text-xs font-bold text-nb-green" title={txTodos.map((t) => t.title).join('\n')}>
                                    ✅
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        <span className={`font-mono font-bold text-sm ${tx.type === 'income' ? 'text-nb-green' : 'text-nb-red'}`}>
                          {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </span>
                        <NeubruBtn size="sm" color="yellow" className="nb-btn-icon !p-[6px] !min-w-[30px] !min-h-[30px]" onClick={() => onEdit(tx)}>✎</NeubruBtn>
                        <NeubruBtn size="sm" color="red" className="nb-btn-icon !p-[6px] !min-w-[30px] !min-h-[30px]" onClick={() => onDelete(tx.id)}>✕</NeubruBtn>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-6 ml-[56px]">
          <NeubruBtn color="blue" onClick={() => setShowCount((c) => c + PAGE_SIZE)}>
            📥 Load More ({timeline.length - showCount} remaining)
          </NeubruBtn>
        </div>
      )}

      {timeline.length === 0 && (
        <div className="text-center py-16 nb-panel">
          <div className="text-5xl mb-3">📭</div>
          <div className="font-bold uppercase text-nb-fg-muted">Belum ada transaksi</div>
        </div>
      )}
    </div>
  )
}
