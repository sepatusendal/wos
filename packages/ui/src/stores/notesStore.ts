import { create } from 'zustand'
import type { Note } from '@wos/shared'
import { generateId, isoNow } from '@wos/shared'
import type { DatabaseAdapter } from '@wos/db'
import { eq, desc } from '@wos/db'

interface NotesState {
  adapter: DatabaseAdapter | null
  notes: Note[]
  loading: boolean
  setAdapter: (adapter: DatabaseAdapter) => void
  fetchAll: (userId: string) => Promise<void>
  addNote: (userId: string, data: { title: string; content: string; tags: string[]; date: string; pinned?: boolean; linkedTodoId?: string | null; linkedTransactionId?: string | null }) => Promise<void>
  editNote: (data: { id: string; title: string; content: string; tags: string[]; date: string; pinned: boolean; linkedTodoId?: string | null; linkedTransactionId?: string | null }) => Promise<void>
  deleteNote: (id: string) => Promise<void>
  togglePin: (id: string, pinned: boolean) => Promise<void>
}

export const useNotesStore = create<NotesState>((set, get) => ({
  adapter: null,
  notes: [],
  loading: false,

  setAdapter: (adapter) => set({ adapter }),

  fetchAll: async (userId) => {
    const { adapter } = get()
    if (!adapter) return
    set({ loading: true })
    try {
      const data = await adapter.db.select().from('notes').where(eq('user_id', userId)).orderBy(desc('date')).all()
      set({ notes: data.map(formatNote), loading: false })
    } catch (err) {
      console.error('[notesStore] fetchAll failed:', err)
      set({ loading: false })
    }
  },

  addNote: async (userId, d) => {
    const { adapter } = get()
    if (!adapter) return
    const id = generateId()
    const now = isoNow()
    await adapter.db.insert('notes').values({
      id, user_id: userId, title: d.title, content: d.content,
      tags: JSON.stringify(d.tags), date: d.date, pinned: d.pinned ? 1 : 0,
      linked_todo_id: d.linkedTodoId ?? null,
      linked_transaction_id: d.linkedTransactionId ?? null,
      created_at: now, updated_at: now,
    })
    await get().fetchAll(userId)
  },

  editNote: async (d) => {
    const { adapter } = get()
    if (!adapter) return
    const now = isoNow()
    await adapter.db.update('notes').set({
      title: d.title, content: d.content, tags: JSON.stringify(d.tags),
      date: d.date, pinned: d.pinned ? 1 : 0,
      linked_todo_id: d.linkedTodoId ?? null,
      linked_transaction_id: d.linkedTransactionId ?? null,
      updated_at: now,
    }).where(eq('id', d.id))
    set((s) => ({
      notes: s.notes.map((n) => n.id === d.id ? { ...n, title: d.title, content: d.content, tags: d.tags, date: d.date, pinned: d.pinned, linkedTodoId: d.linkedTodoId ?? n.linkedTodoId, linkedTransactionId: d.linkedTransactionId ?? n.linkedTransactionId, updatedAt: now } : n),
    }))
  },

  deleteNote: async (id) => {
    const { adapter } = get()
    if (!adapter) return
    await adapter.db.delete('notes').where(eq('id', id))
    set((s) => ({ notes: s.notes.filter((x) => x.id !== id) }))
  },

  togglePin: async (id, pinned) => {
    const { adapter } = get()
    if (!adapter) return
    await adapter.db.update('notes').set({ pinned: pinned ? 1 : 0 }).where(eq('id', id))
    set((s) => ({ notes: s.notes.map((n) => n.id === id ? { ...n, pinned } : n) }))
  },
}))

function formatNote(row: any): Note {
  return {
    id: row.id, title: row.title, content: row.content ?? '',
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) as string[] : (row.tags ?? []),
    date: row.date, pinned: !!row.pinned,
    linkedTodoId: row.linked_todo_id ?? null,
    linkedTransactionId: row.linked_transaction_id ?? null,
    createdAt: row.created_at, updatedAt: row.updated_at,
  }
}
