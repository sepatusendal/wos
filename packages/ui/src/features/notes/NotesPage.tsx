import { useEffect, useMemo, useState } from 'react'
import { useNotesStore } from '../../stores/notesStore'
import { useAuthStore } from '../../stores/authStore'
import { NeubruBtn, NeubruCard, NeubruInput, NeubruModal, NeubruTag } from '../../components'
import { toast } from 'sonner'
import { formatDate, formatShortDate, todayStr } from '@wos/shared'
import type { Note } from '@wos/shared'

const PRESET_TAGS = ['journal', 'ide', 'meeting', 'work', 'pribadi', 'keuangan', 'project']

export default function NotesPage() {
  const userId = useAuthStore((s) => s.userId)
  const { notes, fetchAll, addNote, editNote, deleteNote, togglePin } = useNotesStore()
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pinned' | 'journal'>('all')
  const [tagFilter, setTagFilter] = useState('')
  const [search, setSearch] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [noteDate, setNoteDate] = useState(todayStr())
  const [pinned, setPinned] = useState(false)

  useEffect(() => { if (userId) fetchAll(userId) }, [userId, fetchAll])

  const allTags = useMemo(() => { const s = new Set<string>(); notes.forEach((n) => n.tags.forEach((t) => s.add(t))); return [...s] }, [notes])

  const filtered = useMemo(() => {
    let r = notes
    if (filter === 'pinned') r = r.filter((n) => n.pinned)
    if (filter === 'journal') r = r.filter((n) => n.tags.includes('journal'))
    if (tagFilter) r = r.filter((n) => n.tags.includes(tagFilter))
    if (search) {
      const q = search.toLowerCase()
      r = r.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || n.tags.some((t) => t.includes(q)))
    }
    // Sort: pinned first, then by date desc
    return [...r].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.date.localeCompare(a.date))
  }, [notes, filter, tagFilter, search])

  const openAdd = () => { setEditId(null); setTitle(''); setContent(''); setTags([]); setTagInput(''); setNoteDate(todayStr()); setPinned(false); setShowModal(true) }
  const openEdit = (n: Note) => { setEditId(n.id); setTitle(n.title); setContent(n.content); setTags([...n.tags]); setTagInput(''); setNoteDate(n.date); setPinned(n.pinned); setShowModal(true) }

  const today = todayStr()
  const openJournal = () => {
    const existing = notes.find((n) => n.date === today && n.tags.includes('journal'))
    if (existing) { openEdit(existing); return }
    setEditId(null); setTitle(`${formatShortDate(today)} Journal`); setContent(''); setTags(['journal']); setTagInput(''); setNoteDate(today); setPinned(false); setShowModal(true)
  }

  const save = async () => {
    if (!userId || !title.trim()) { toast.error('Judul tidak boleh kosong'); return }
    if (editId) {
      await editNote({ id: editId, title: title.trim(), content, tags, date: noteDate, pinned })
    } else {
      await addNote(userId, { title: title.trim(), content, tags, date: noteDate, pinned })
    }
    setShowModal(false)
  }

  const addTag = () => { const t = tagInput.trim().toLowerCase(); if (t && !tags.includes(t)) setTags([...tags, t]); setTagInput('') }

  const previewContent = (c: string) => c.length > 120 ? c.slice(0, 120) + '...' : c

  return (
    <div>
      <div className="flex items-start justify-between mb-7 gap-4 flex-wrap">
        <h2 className="text-[1.8rem]">📝 Notes</h2>
        <div className="flex gap-2.5">
          <NeubruBtn color="orange" onClick={openJournal}>📓 Journal Hari Ini</NeubruBtn>
          <NeubruBtn color="blue" onClick={openAdd}>+ Note</NeubruBtn>
        </div>
      </div>

      <NeubruCard className="mb-4 !p-4">
        <div className="mb-3"><NeubruInput value={search} onChange={setSearch} placeholder="🔍 Cari notes..." /></div>
        <div className="flex gap-2 flex-wrap items-center">
          {(['all', 'pinned', 'journal'] as const).map((f) => (
            <NeubruBtn key={f} size="sm" color={filter === f ? 'yellow' : undefined} onClick={() => setFilter(f)}>
              {f === 'all' ? '📋 Semua' : f === 'pinned' ? '📌 Dipin' : '📓 Journal'}
            </NeubruBtn>
          ))}
          <span className="font-bold text-xs text-nb-fg-muted">|</span>
          {[...PRESET_TAGS, ...allTags.filter((t) => !PRESET_TAGS.includes(t))].slice(0, 8).map((tag) => (
            <NeubruBtn key={tag} size="sm" color={tagFilter === tag ? 'blue' : undefined} onClick={() => setTagFilter(tagFilter === tag ? '' : tag)}>#{tag}</NeubruBtn>
          ))}
        </div>
      </NeubruCard>

      {filtered.length === 0 ? (
        <div className="nb-panel text-center py-16"><div className="text-5xl mb-3">📝</div><div className="font-bold uppercase text-nb-fg-muted">{search || tagFilter ? 'Tidak ditemukan' : 'Belum ada notes'}</div></div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
          {filtered.map((n) => (
            <NeubruCard key={n.id} className="relative">
              {n.pinned && <div className="absolute top-2 right-2 text-lg">📌</div>}
              <div className="font-extrabold text-base mb-1 pr-6">{n.title}</div>
              <div className="text-xs text-nb-fg-muted mb-2 flex items-center gap-2">
                <span className="font-bold">{formatDate(n.date)}</span>
                {n.linkedTodoId && <NeubruTag label="🔗 Todo" color="green" />}
                {n.linkedTransactionId && <NeubruTag label="🔗 Transaksi" color="blue" />}
              </div>
              {n.content && (
                <div className="text-sm text-nb-fg-muted mb-3 leading-relaxed whitespace-pre-wrap break-words">
                  {previewContent(n.content)}
                </div>
              )}
              <div className="flex gap-1 flex-wrap mb-3">
                {n.tags.map((t) => <NeubruTag key={t} label={`#${t}`} />)}
              </div>
              <div className="flex gap-1.5">
                <NeubruBtn size="sm" color={n.pinned ? 'yellow' : 'blue'} onClick={() => togglePin(n.id, !n.pinned)}>{n.pinned ? '📌 Unpin' : '📌 Pin'}</NeubruBtn>
                <NeubruBtn size="sm" color="yellow" className="nb-btn-icon" onClick={() => openEdit(n)}>✎</NeubruBtn>
                <NeubruBtn size="sm" color="red" className="nb-btn-icon" onClick={() => deleteNote(n.id)}>✕</NeubruBtn>
              </div>
            </NeubruCard>
          ))}
        </div>
      )}

      <NeubruModal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Note' : 'Tambah Note'}>
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Judul</label>
          <NeubruInput value={title} onChange={setTitle} placeholder="Judul..." />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Tanggal</label>
            <NeubruInput value={noteDate} onChange={setNoteDate} type="date" />
          </div>
          <div className="flex items-center gap-2 mt-6">
            <input type="checkbox" id="notePinned" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="w-4 h-4 border-2 border-nb-border" />
            <label htmlFor="notePinned" className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted cursor-pointer">📌 Pin</label>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Konten</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Tulis isi catatan... (support basic markdown)"
            rows={8}
            className="nb-input resize-y min-h-[120px] font-mono text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Tags</label>
          <div className="flex gap-1.5 flex-wrap mb-2">
            {tags.map((tag) => (
              <span key={tag} className="flex items-center gap-1"><NeubruTag label={`#${tag}`} /><button onClick={() => setTags(tags.filter((x) => x !== tag))} className="font-bold text-xs cursor-pointer bg-none border-none">✕</button></span>
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
        <NeubruBtn color="blue" onClick={save}>💾 Simpan</NeubruBtn>
      </NeubruModal>
    </div>
  )
}
