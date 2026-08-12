import { useEffect, useMemo, useState } from 'react'
import { useTodoStore } from '../../stores/todoStore'
import { useNotesStore } from '../../stores/notesStore'
import { useAuthStore } from '../../stores/authStore'
import { NeubruBtn, NeubruCard, NeubruInput, NeubruSelect, NeubruModal, NeubruTag, NeubruCheckbox } from '../../components'
import { toast } from 'sonner'
import { formatDate, todayStr } from '@wos/shared'
import type { TodoItem, Priority } from '@wos/shared'

const PRESET_TAGS = ['kerja', 'pribadi', 'penting', 'ide', 'bug', 'fitur']
const PRIORITY: { value: Priority; label: string }[] = [
  { value: 'low', label: '🟢 Low' }, { value: 'medium', label: '🟡 Medium' }, { value: 'high', label: '🔴 High' },
]
const PRIO_COLORS: Record<Priority, 'red' | 'orange' | 'green'> = { high: 'red', medium: 'orange', low: 'green' }
const PRIO_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

// Dates are YYYY-MM-DD, so plain string comparison is enough.
const isOverdue = (t: TodoItem, today: string) => !!t.dueDate && !t.completed && t.dueDate < today
const isDueToday = (t: TodoItem, today: string) => !!t.dueDate && !t.completed && t.dueDate === today
const daysLate = (dueDate: string, today: string) =>
  Math.max(1, Math.round((new Date(today).getTime() - new Date(dueDate).getTime()) / 86400000))

// Overdue first → due today → priority (high→low) → existing manual order.
function sortTodos(a: TodoItem, b: TodoItem, today: string): number {
  const bucket = (t: TodoItem) => (isOverdue(t, today) ? 0 : isDueToday(t, today) ? 1 : 2)
  const d = bucket(a) - bucket(b)
  if (d !== 0) return d
  const p = PRIO_ORDER[a.priority] - PRIO_ORDER[b.priority]
  if (p !== 0) return p
  return (a.order ?? 0) - (b.order ?? 0)
}

export default function TodoPage() {
  const userId = useAuthStore((s) => s.userId)
  const { todos, fetchAll, addTodo, editTodo, deleteTodo, toggleComplete } = useTodoStore()
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [tagFilter, setTagFilter] = useState('')
  const [search, setSearch] = useState('')
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [note, setNote] = useState('')
  const [parentId, setParentId] = useState<string | null>(null)

  useEffect(() => { if (userId) fetchAll(userId) }, [userId, fetchAll])

  const allTags = useMemo(() => { const s = new Set<string>(); todos.forEach((t) => t.tags.forEach((tag) => s.add(tag))); return [...s] }, [todos])
  const completedCount = todos.filter((t) => t.completed).length

  // Linked notes per todo
  const allNotes = useNotesStore((s) => s.notes)
  const linkedNotesByTodo = useMemo(() => {
    const map = new Map<string, { id: string; title: string }[]>()
    allNotes.forEach((n) => {
      if (n.linkedTodoId) {
        if (!map.has(n.linkedTodoId)) map.set(n.linkedTodoId, [])
        map.get(n.linkedTodoId)!.push({ id: n.id, title: n.title })
      }
    })
    return map
  }, [allNotes])

  const today = todayStr()

  // Every active filter (status + tag + search) is ANDed together, then the
  // ancestor chain of each match is kept as a context-only container so a
  // matching subtask stays visible nested under its parent — even when the
  // parent itself doesn't match.
  const { filtered, matchedIds } = useMemo(() => {
    const q = search.toLowerCase()
    const matches = todos.filter((t) => {
      if (filter === 'active' && t.completed) return false
      if (filter === 'completed' && !t.completed) return false
      if (tagFilter && !t.tags.includes(tagFilter)) return false
      if (q && !t.title.toLowerCase().includes(q)) return false
      return true
    })
    const byId = new Map(todos.map((t) => [t.id, t]))
    const keep = new Set<string>()
    matches.forEach((t) => {
      keep.add(t.id)
      let p = t.parentId ?? null
      while (p && !keep.has(p)) {
        keep.add(p)
        p = byId.get(p)?.parentId ?? null
      }
    })
    return { filtered: todos.filter((t) => keep.has(t.id)), matchedIds: new Set(matches.map((t) => t.id)) }
  }, [todos, filter, tagFilter, search])

  // Build nested structure for display
  const nestedTodos = useMemo(() => {
    const children = new Map<string | null, TodoItem[]>()
    filtered.forEach((t) => {
      const key = t.parentId ?? null
      if (!children.has(key)) children.set(key, [])
      children.get(key)!.push(t)
    })
    children.forEach((list) => list.sort((a, b) => sortTodos(a, b, today)))
    return children.get(null) || []
  }, [filtered, today])

  const getSubtasks = (parentId: string): TodoItem[] => {
    return filtered.filter((t) => t.parentId === parentId).sort((a, b) => sortTodos(a, b, today))
  }

  const openAdd = (parent?: string | null) => { setEditId(null); setTitle(''); setPriority('medium'); setTags([]); setTagInput(''); setDueDate(''); setNote(''); setParentId(parent ?? null); setShowModal(true) }
  const openEdit = (t: TodoItem) => { setEditId(t.id); setTitle(t.title); setPriority(t.priority); setTags([...t.tags]); setTagInput(''); setDueDate(t.dueDate ?? ''); setNote(t.notes ?? ''); setParentId(t.parentId ?? null); setShowModal(true) }

  // Collect all descendant IDs to prevent circular parent references
  const getDescendantIds = (id: string): Set<string> => {
    const ids = new Set<string>()
    const stack = [id]
    while (stack.length > 0) {
      const current = stack.pop()!
      todos.filter((t) => t.parentId === current).forEach((t) => {
        ids.add(t.id)
        stack.push(t.id)
      })
    }
    return ids
  }

  const save = async () => {
    if (!userId || !title.trim()) return
    if (editId) {
      const existing = useTodoStore.getState().todos.find((x) => x.id === editId)
      if (!existing) { toast.error('Todo tidak ditemukan'); return }
      await editTodo({ id: editId, title: title.trim(), completed: existing.completed, priority, tags, dueDate: dueDate || null, notes: note, parentId })
    } else {
      await addTodo(userId, { title: title.trim(), completed: false, priority, tags, dueDate: dueDate || null, notes: note, parentId })
    }
    setShowModal(false)
  }

  const addTag = () => { const tag = tagInput.trim().toLowerCase(); if (tag && !tags.includes(tag)) setTags([...tags, tag]); setTagInput('') }

  return (
    <div>
      <div className="flex items-start justify-between mb-7 gap-4 flex-wrap">
        <h2 className="text-[1.8rem]">✅ Todo</h2>
        <NeubruBtn color="green" onClick={() => openAdd()}>+ Todo</NeubruBtn>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-5 mb-7">
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Total</div>
          <div className="font-mono text-xl font-extrabold">{todos.length}</div>
        </NeubruCard>
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Selesai</div>
          <div className="text-nb-green font-mono text-xl font-extrabold">{completedCount}</div>
          <div className="text-xs text-nb-fg-muted mt-1 font-medium">{todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0}%</div>
        </NeubruCard>
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Belum</div>
          <div className="text-nb-orange font-mono text-xl font-extrabold">{todos.length - completedCount}</div>
        </NeubruCard>
      </div>

      <NeubruCard className="mb-4 !p-4">
        <div className="mb-3"><NeubruInput value={search} onChange={setSearch} placeholder="🔍 Cari todo..." /></div>
        <div className="flex gap-2 flex-wrap items-center">
          {(['all', 'active', 'completed'] as const).map((f) => (
            <NeubruBtn key={f} size="sm" color={filter === f ? 'yellow' : undefined} onClick={() => setFilter(f)}>
              {f === 'all' ? 'Semua' : f === 'active' ? '⏳ Aktif' : '✅ Selesai'}
            </NeubruBtn>
          ))}
          <span className="font-bold text-xs text-nb-fg-muted">|</span>
          {[...PRESET_TAGS, ...allTags.filter((t) => !PRESET_TAGS.includes(t))].map((tag) => (
            <NeubruBtn key={tag} size="sm" color={tagFilter === tag ? 'blue' : undefined} onClick={() => setTagFilter(tagFilter === tag ? '' : tag)}>#{tag}</NeubruBtn>
          ))}
        </div>
      </NeubruCard>

      <div className="flex flex-col gap-2.5">
        {filtered.length === 0 ? (
          <div className="nb-panel text-center py-16"><div className="text-5xl mb-3">{filter === 'completed' ? '🎉' : '📝'}</div><div className="font-bold uppercase text-nb-fg-muted">{filter === 'completed' ? 'Semua selesai!' : 'Belum ada todo'}</div></div>
        ) : nestedTodos.map((t) => {
          const subs = getSubtasks(t.id)
          const subsDone = subs.filter((s) => s.completed).length
          const late = isOverdue(t, today)
          // Kept only as a container for a matching descendant — muted for context.
          const contextOnly = !matchedIds.has(t.id)
          return (
            <div key={t.id}>
              <div className="nb-list-item flex-wrap" style={{ opacity: t.completed ? 0.6 : contextOnly ? 0.5 : 1, ...(late ? { borderLeft: '6px solid var(--color-nb-red)' } : {}) }}>
                <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                  <NeubruCheckbox checked={t.completed} onChange={() => toggleComplete(t.id)} />
                  <div>
                    <div className="font-bold text-sm" style={{ textDecoration: t.completed ? 'line-through' : 'none' }}>{t.title}</div>
                    <div className="flex gap-1.5 items-center flex-wrap mt-1">
                      <NeubruTag label={PRIORITY.find((p) => p.value === t.priority)?.label || t.priority} color={PRIO_COLORS[t.priority]} />
                      {t.tags.map((tag) => <NeubruTag key={tag} label={`#${tag}`} />)}
                      {t.dueDate && <span className={`text-xs font-semibold ${late ? 'text-nb-red' : 'text-nb-fg-muted'}`}>📅 {formatDate(t.dueDate)}</span>}
                      {late && <span className="text-xs font-extrabold text-nb-red">⚠️ Telat {daysLate(t.dueDate!, today)} hari</span>}
                      {subs.length > 0 && (
                        <span className="text-xs font-bold text-nb-fg-muted">
                          📋 {subsDone}/{subs.length}
                        </span>
                      )}
                      {linkedNotesByTodo.has(t.id) && (() => {
                        const linkedNotes = linkedNotesByTodo.get(t.id)!
                        return (
                          <span className="relative group cursor-help" title={linkedNotes.map((n) => n.title).join('\n')}>
                            <span className="font-bold text-nb-purple">📝</span>
                            <span className="absolute bottom-full left-0 mb-1 hidden group-hover:block bg-nb-bg border-2 border-nb-border px-2 py-1 text-xs font-bold whitespace-nowrap shadow-nb-sm z-50 max-w-[250px] truncate">
                              {linkedNotes.map((n) => n.title).join(' | ')}
                            </span>
                          </span>
                        )
                      })()}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <NeubruBtn size="sm" color="purple" className="nb-btn-icon" onClick={() => openAdd(t.id)} title="Tambah subtask">+</NeubruBtn>
                  <NeubruBtn size="sm" color="yellow" className="nb-btn-icon" onClick={() => openEdit(t)}>✎</NeubruBtn>
                  <NeubruBtn size="sm" color="red" className="nb-btn-icon" onClick={() => deleteTodo(t.id)}>✕</NeubruBtn>
                </div>
              </div>
              {/* Subtasks */}
              {subs.length > 0 && (
                <div className="ml-8 mt-1 flex flex-col gap-1.5 border-l-3 border-nb-border pl-4">
                  {subs.map((sub) => {
                    const subLate = isOverdue(sub, today)
                    const subContextOnly = !matchedIds.has(sub.id)
                    return (
                    <div key={sub.id} className="nb-list-item flex-wrap" style={{ opacity: sub.completed ? 0.6 : subContextOnly ? 0.5 : 1, ...(subLate ? { borderLeft: '6px solid var(--color-nb-red)' } : {}) }}>
                      <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                        <NeubruCheckbox checked={sub.completed} onChange={() => toggleComplete(sub.id)} />
                        <div>
                          <div className="font-bold text-sm" style={{ textDecoration: sub.completed ? 'line-through' : 'none' }}>{sub.title}</div>
                          <div className="flex gap-1.5 items-center flex-wrap mt-1">
                            <NeubruTag label={PRIORITY.find((p) => p.value === sub.priority)?.label || sub.priority} color={PRIO_COLORS[sub.priority]} />
                            {sub.tags.map((tag) => <NeubruTag key={tag} label={`#${tag}`} />)}
                            {sub.dueDate && <span className={`text-xs font-semibold ${subLate ? 'text-nb-red' : 'text-nb-fg-muted'}`}>📅 {formatDate(sub.dueDate)}</span>}
                            {subLate && <span className="text-xs font-extrabold text-nb-red">⚠️ Telat {daysLate(sub.dueDate!, today)} hari</span>}
                            {linkedNotesByTodo.has(sub.id) && (
                              <span className="relative group cursor-help" title={linkedNotesByTodo.get(sub.id)!.map((n) => n.title).join('\n')}>
                                <span className="font-bold text-nb-purple">📝</span>
                                <span className="absolute bottom-full left-0 mb-1 hidden group-hover:block bg-nb-bg border-2 border-nb-border px-2 py-1 text-xs font-bold whitespace-nowrap shadow-nb-sm z-50 max-w-[250px] truncate">
                                  {linkedNotesByTodo.get(sub.id)!.map((n) => n.title).join(' | ')}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <NeubruBtn size="sm" color="yellow" className="nb-btn-icon" onClick={() => openEdit(sub)}>✎</NeubruBtn>
                        <NeubruBtn size="sm" color="red" className="nb-btn-icon" onClick={() => deleteTodo(sub.id)}>✕</NeubruBtn>
                      </div>
                    </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <NeubruModal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Todo' : parentId ? 'Tambah Subtask' : 'Tambah Todo'}>
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Judul</label>
          <NeubruInput value={title} onChange={setTitle} placeholder="Apa yang harus dikerjain?" />
        </div>
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Parent Task</label>
          <NeubruSelect
            value={parentId ?? ''}
            onChange={(v) => setParentId(v || null)}
            options={[
              { value: '', label: '— Tidak ada (top-level) —' },
              ...todos
                .filter((t) => {
                  if (t.parentId) return false // only top-level items can be parents
                  if (t.id === editId) return false // can't be own parent
                  if (editId && getDescendantIds(editId).has(t.id)) return false // prevent circular
                  return true
                })
                .map((t) => ({ value: t.id, label: `${t.completed ? '✅ ' : ''}${t.title.slice(0, 50)}` })),
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Prioritas</label>
            <NeubruSelect value={priority} onChange={(v) => setPriority(v as Priority)} options={PRIORITY} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Due Date</label>
            <NeubruInput value={dueDate} onChange={setDueDate} type="date" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Tags</label>
          <div className="flex gap-1.5 flex-wrap mb-2">
            {tags.map((tag) => (
              <span key={tag} className="flex items-center gap-1">
                <NeubruTag label={`#${tag}`} />
                <button onClick={() => setTags(tags.filter((x) => x !== tag))} className="font-bold text-xs cursor-pointer bg-none border-none">✕</button>
              </span>
            ))}
          </div>
          <div className="flex gap-1.5">
            <NeubruInput value={tagInput} onChange={setTagInput} placeholder="Tambah tag..." size="sm" />
            <NeubruBtn size="sm" onClick={addTag}>+</NeubruBtn>
          </div>
          <div className="flex gap-1 flex-wrap mt-2">
            {PRESET_TAGS.filter((pt) => !tags.includes(pt)).map((pt) => (
              <button key={pt} className="text-xs font-bold uppercase border-2 border-nb-border bg-white px-2 py-1 cursor-pointer hover:bg-nb-yellow" onClick={() => setTags([...tags, pt])}>#{pt}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Notes</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Detail tambahan..."
            rows={4}
            className="border-2 border-nb-border bg-white px-3 py-2 text-sm font-medium outline-none resize-y w-full"
            style={{ fontFamily: 'inherit' }}
          />
        </div>
        <NeubruBtn color="green" onClick={save}>💾 Simpan</NeubruBtn>
      </NeubruModal>
    </div>
  )
}
