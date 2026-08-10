import { create } from 'zustand'
import type { TodoItem } from '@wos/shared'
import { generateId, isoNow } from '@wos/shared'
import type { DatabaseAdapter } from '@wos/db'
import { eq, desc } from '@wos/db'

interface TodoState {
  adapter: DatabaseAdapter | null
  todos: TodoItem[]
  loading: boolean
  setAdapter: (adapter: DatabaseAdapter) => void
  fetchAll: (userId: string) => Promise<void>
  addTodo: (userId: string, t: Omit<TodoItem, 'id' | 'createdAt' | 'updatedAt' | 'order'>) => Promise<void>
  editTodo: (t: { id: string; title: string; completed: boolean; priority: string; tags: string[]; dueDate: string | null; notes: string; parentId?: string | null }) => Promise<void>
  deleteTodo: (id: string) => Promise<void>
  toggleComplete: (id: string) => Promise<void>
}

export const useTodoStore = create<TodoState>((set, get) => ({
  adapter: null,
  todos: [],
  loading: false,

  setAdapter: (adapter) => set({ adapter }),

  fetchAll: async (userId) => {
    const { adapter } = get()
    if (!adapter) return
    set({ loading: true })
    try {
      const data = await adapter.db.select().from('todos').where(eq('user_id', userId)).orderBy(desc('order')).all()
      set({ todos: data.map(formatTodo), loading: false })
    } catch { set({ loading: false }) }
  },

  addTodo: async (userId, t) => {
    const { adapter } = get()
    if (!adapter) return
    const id = generateId()
    const now = isoNow()
    const todos = get().todos
    const maxOrder = todos.length > 0 ? Math.max(...todos.map((x) => x.order)) + 1 : 0
    await adapter.db.insert('todos').values({
      id, user_id: userId, title: t.title, completed: false, priority: t.priority,
      tags: JSON.stringify(t.tags), due_date: t.dueDate, notes: t.notes ?? '',
      parent_id: t.parentId, order: maxOrder, created_at: now, updated_at: now,
    })
    await get().fetchAll(userId)
  },

  editTodo: async (t) => {
    const { adapter } = get()
    if (!adapter) return
    await adapter.db.update('todos').set({
      title: t.title, completed: t.completed, priority: t.priority,
      tags: JSON.stringify(t.tags), due_date: t.dueDate, notes: t.notes,
      parent_id: t.parentId ?? null,
      updated_at: isoNow(),
    }).where(eq('id', t.id))
    set((s) => ({
      todos: s.todos.map((x) => (x.id === t.id ? { ...x, ...t, parentId: t.parentId ?? null, order: x.order, createdAt: x.createdAt, updatedAt: isoNow(), priority: t.priority as TodoItem['priority'] } : x)),
    }))
  },

  deleteTodo: async (id) => {
    const { adapter } = get()
    if (!adapter) return
    const allIds = new Set<string>([id])
    const stack = [id]
    while (stack.length > 0) {
      const current = stack.pop()!
      get().todos.filter((t) => t.parentId === current).forEach((child) => {
        allIds.add(child.id)
        stack.push(child.id)
      })
    }
    for (const tid of [...allIds]) {
      await adapter.db.delete('todos').where(eq('id', tid))
    }
    set((s) => ({ todos: s.todos.filter((x) => !allIds.has(x.id)) }))
  },

  toggleComplete: async (id) => {
    const { adapter } = get()
    if (!adapter) return
    const todo = get().todos.find((x) => x.id === id)
    if (!todo) return
    await adapter.db.update('todos').set({ completed: !todo.completed, updated_at: isoNow() }).where(eq('id', id))
    set((s) => ({
      todos: s.todos.map((x) => (x.id === id ? { ...x, completed: !x.completed, updatedAt: isoNow() } : x)),
    }))
  },
}))

function formatTodo(t: any): TodoItem {
  return {
    id: t.id, title: t.title, completed: Boolean(t.completed), priority: t.priority,
    tags: typeof t.tags === 'string' ? JSON.parse(t.tags) as string[] : (t.tags ?? []),
    dueDate: t.due_date ?? null, notes: t.notes ?? '',
    parentId: t.parent_id ?? null, order: t.order ?? 0,
    createdAt: t.created_at, updatedAt: t.updated_at,
  }
}
