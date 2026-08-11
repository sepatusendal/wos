import { useEffect, useMemo, useState } from 'react'
import { useNotesStore } from '../../stores/notesStore'
import { useFinanceStore } from '../../stores/financeStore'
import { useTodoStore } from '../../stores/todoStore'
import { useAuthStore } from '../../stores/authStore'
import { NeubruBtn, NeubruCard, NeubruInput, NeubruSelect, NeubruModal, NeubruTag } from '../../components'
import { formatDate, todayStr } from '@wos/shared'
import { toast } from 'sonner'
import { useLevelStore } from '../../stores/levelStore'

export default function NotesPage() {
  const { notes, addNote, editNote, deleteNote } = useNotesStore()
  const transactions = useFinanceStore((s) => s.transactions)
  const todos = useTodoStore((s) => s.todos)
  const fetchFinance = useFinanceStore((s) => s.fetchAll)
  const fetchTodo = useTodoStore((s) => s.fetchAll)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [linkedTxId, setLinkedTxId] = useState<string>('')
  const [linkedTodoId, setLinkedTodoId] = useState<string>('')

  // Ensure finance & todo data exists
  useEffect(() => {
    if (transactions.length === 0) {
      const userId = useAuthStore.getState().userId
      if (userId) {
        fetchFinance(userId).catch(() => {})
      }
    }
    if (todos.length === 0) {
      const userId = useAuthStore.getState().userId
      if (userId) {
        fetchTodo(userId).catch(() => {})
      }
    }
  }, []) // eslint-disable-line

  const filtered = useMemo(() => {
    if (!search.trim()) return notes
    const q = search.toLowerCase()
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
    )
  }, [notes, search])

  const recent10Tx = useMemo(() => {
    return [...transactions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10)
  }, [transactions])

  // Build lookup maps for linked items
  const txMap = useMemo(() => {
    const m = new Map<string, string>()
    transactions.forEach((t) => m.set(t.id, `${t.type === 'income' ? '💰' : '💳'} ${t.description || t.category}`))
    return m
  }, [transactions])

  const todoMap = useMemo(() => {
    const m = new Map<string, string>()
    todos.forEach((t) => m.set(t.id, `${t.completed ? '✅ ' : ''}${t.title}`))
    return m
  }, [todos])

  const openAdd = () => {
    setEditId(null); setTitle(''); setContent(''); setLinkedTxId(''); setLinkedTodoId(''); setShowModal(true)
  }

  const openEdit = (note: typeof notes[number]) => {
    setEditId(note.id)
    setTitle(note.title)
    setContent(note.content)
    setLinkedTxId(note.linkedTransactionId ?? '')
    setLinkedTodoId(note.linkedTodoId ?? '')
    setShowModal(true)
  }

  const save = () => {
    if (!title.trim()) {
      toast.error('Judul harus diisi')
      return
    }
    if (editId) {
      const uid = useAuthStore.getState().userId
      if (!uid) return
      const existing = useNotesStore.getState().notes.find((n) => n.id === editId)
      editNote({ id: editId, title: title.trim(), content, tags: existing?.tags ?? [], date: existing?.date ?? todayStr(), pinned: existing?.pinned ?? false })
    } else {
      const uid = useAuthStore.getState().userId
      if (!uid) return
      addNote(uid, {
        title: title.trim(), content, tags: [], date: todayStr(), pinned: false,
        linkedTransactionId: linkedTxId || null,
        linkedTodoId: linkedTodoId || null,
      })
      useLevelStore.getState().addXP(15)
      toast.success('⚡ +15 XP')
    }
    setShowModal(false)
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-7 gap-4 flex-wrap">
        <h2 className="text-[1.8rem]">📝 Notes</h2>
        <NeubruBtn color="green" onClick={openAdd}>+ Note</NeubruBtn>
      </div>

      <div className="mb-5">
        <NeubruInput
          value={search}
          onChange={setSearch}
          placeholder="🔍 Cari notes..."
        />
      </div>

      {filtered.length === 0 ? (
        <div className="nb-panel text-center py-16">
          <div className="text-5xl mb-3">📝</div>
          <div className="font-bold uppercase text-nb-fg-muted">
            {search ? 'Tidak ada hasil' : 'Belum ada notes'}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
          {filtered.map((note) => (
            <NeubruCard key={note.id}>
              <div className="flex items-start justify-between mb-2 gap-2">
                <div className="font-bold text-sm flex-1 min-w-0 break-words">{note.title}</div>
                <div className="flex gap-1 shrink-0">
                  <NeubruBtn size="sm" color="yellow" className="nb-btn-icon" onClick={() => openEdit(note)}>✎</NeubruBtn>
                  <NeubruBtn size="sm" color="red" className="nb-btn-icon" onClick={() => deleteNote(note.id)}>✕</NeubruBtn>
                </div>
              </div>
              {note.content && (
                <div className="text-sm text-nb-fg-muted mb-3 whitespace-pre-wrap break-words">
                  {note.content.length > 200 ? note.content.slice(0, 200) + '...' : note.content}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5 items-center text-xs">
                {note.linkedTransactionId && txMap.has(note.linkedTransactionId) && (
                  <NeubruTag label={`🔗 ${txMap.get(note.linkedTransactionId)!.slice(0, 30)}`} color="blue" />
                )}
                {note.linkedTodoId && todoMap.has(note.linkedTodoId) && (
                  <NeubruTag label={`🔗 ${todoMap.get(note.linkedTodoId)!.slice(0, 30)}`} color="purple" />
                )}
                <span className="text-nb-fg-muted font-medium">{formatDate((note.createdAt ?? "").slice(0, 10))}</span>
              </div>
            </NeubruCard>
          ))}
        </div>
      )}

      <NeubruModal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editId ? 'Edit Note' : 'Tambah Note'}
      >
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Judul</label>
          <NeubruInput value={title} onChange={setTitle} placeholder="Judul note..." />
        </div>
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Isi</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Tulis catatan di sini..."
            rows={4}
            className="border-2 border-nb-border bg-white px-3 py-2 text-sm font-medium outline-none resize-y w-full"
            style={{ fontFamily: 'inherit' }}
          />
        </div>
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">🔗 Link Transaksi</label>
          {recent10Tx.length === 0 ? (
            <span className="text-xs text-nb-fg-muted">Belum ada transaksi</span>
          ) : (
            <NeubruSelect
              value={linkedTxId}
              onChange={setLinkedTxId}
              options={[
                { value: '', label: '— Tidak terhubung —' },
                ...recent10Tx.map((t) => ({
                  value: t.id,
                  label: `${t.type === 'income' ? '💰' : '💳'} ${formatDate(t.date)} — ${t.description || t.category} (${t.type === 'income' ? '+' : '-'}${t.amount.toLocaleString()})`,
                })),
              ]}
            />
          )}
        </div>
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">🔗 Link Todo</label>
          {todos.length === 0 ? (
            <span className="text-xs text-nb-fg-muted">Belum ada todo</span>
          ) : (
            <NeubruSelect
              value={linkedTodoId}
              onChange={setLinkedTodoId}
              options={[
                { value: '', label: '— Tidak terhubung —' },
                ...todos.filter((t) => !t.completed || linkedTodoId === t.id).map((t) => ({
                  value: t.id,
                  label: `${t.completed ? '✅ ' : ''}${t.title.slice(0, 50)}${t.priority === 'high' ? ' 🔴' : t.priority === 'medium' ? ' 🟡' : ''}`,
                })),
              ]}
            />
          )}
        </div>
        <div className="flex gap-2.5">
          <NeubruBtn color="green" onClick={save}>💾 Simpan</NeubruBtn>
          <NeubruBtn color="red" onClick={() => setShowModal(false)}>Batal</NeubruBtn>
        </div>
      </NeubruModal>
    </div>
  )
}
