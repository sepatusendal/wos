import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Note } from '@wos/shared'
import { generateId, isoNow } from '@wos/shared'

interface NotesState {
  notes: Note[]
  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => void
  editNote: (id: string, patch: Partial<Pick<Note, 'title' | 'content' | 'linkedTransactionId' | 'linkedTodoId'>>) => void
  deleteNote: (id: string) => void
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set, get) => ({
      notes: [],

      addNote: (note) => {
        const id = generateId()
        const now = isoNow()
        const newNote: Note = {
          ...note,
          id,
          createdAt: now,
          updatedAt: now,
        }
        set({ notes: [newNote, ...get().notes] })
      },

      editNote: (id, patch) => {
        set({
          notes: get().notes.map((n) =>
            n.id === id ? { ...n, ...patch, updatedAt: isoNow() } : n
          ),
        })
      },

      deleteNote: (id) => {
        set({ notes: get().notes.filter((n) => n.id !== id) })
      },
    }),
    {
      name: 'wos-notes',
    }
  )
)
