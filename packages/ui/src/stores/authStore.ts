import { create } from 'zustand'
import type { DatabaseAdapter } from '@wos/db'
import { eq } from '@wos/db'
import { hashPassword, verifyPassword, generateId, isoNow } from '@wos/shared'
import { useFinanceStore } from './financeStore'
import { useWealthStore } from './wealthStore'
import { useNetWorthStore } from './netWorthStore'
import { useTodoStore } from './todoStore'
import { useVaultStore } from './vaultStore'
import { useSubscriptionStore } from './subscriptionStore'
import { useHabitStore } from './habitStore'
import { useNotesStore } from './notesStore'
import { useSettingsStore } from './settingsStore'
import { useLevelStore } from './levelStore'

interface AuthState {
  adapter: DatabaseAdapter | null
  userId: string | null
  username: string | null
  /** Session token issued by the server on login/register (web only — desktop's local adapter has no `login`/`register` and this stays null). Consumed by page.tsx to persist the session immediately, synchronously with auth state, instead of a separate post-login effect that could race the first data fetch. */
  sessionToken: string | null
  isAuthenticated: boolean
  isVaultLocked: boolean
  setAdapter: (adapter: DatabaseAdapter) => void
  register: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
  lockVault: () => void
  init: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  adapter: null,
  userId: null,
  username: null,
  sessionToken: null,
  isAuthenticated: false,
  isVaultLocked: true,

  setAdapter: (adapter) => set({ adapter }),

  register: async (username, password) => {
    const { adapter } = get()
    if (!adapter) return { ok: false, error: 'Database tidak tersedia' }
    // Web: password hashing + session issuance happen atomically server-side
    // (adapter.register). Desktop's local SQLite adapter has no network
    // boundary to protect and doesn't implement it — fall back to the
    // direct local flow.
    if (adapter.register) {
      try {
        const res = await adapter.register(username, password)
        if (!res.ok || !res.userId) return { ok: false, error: res.error || 'Registrasi gagal' }
        set({ userId: res.userId, username: res.username ?? username, sessionToken: res.sessionToken ?? null, isAuthenticated: true, isVaultLocked: true })
        useLevelStore.getState().setUser(res.userId)
        return { ok: true }
      } catch (e) {
        console.error('[auth] register failed:', e)
        return { ok: false, error: 'Registrasi gagal' }
      }
    }
    try {
      const id = generateId()
      const passwordHash = await hashPassword(password)
      await adapter.db.insert('users').values({ id, username, password_hash: passwordHash, created_at: isoNow() })
      set({ userId: id, username, sessionToken: null, isAuthenticated: true, isVaultLocked: true })
      useLevelStore.getState().setUser(id)
      return { ok: true }
    } catch (e) {
      console.error('[auth] register failed:', e)
      return { ok: false, error: 'Username sudah dipakai' }
    }
  },

  login: async (username, password) => {
    const { adapter } = get()
    if (!adapter) return { ok: false, error: 'Database tidak tersedia' }
    if (adapter.login) {
      try {
        const res = await adapter.login(username, password)
        if (!res.ok || !res.userId) return { ok: false, error: res.error || 'Login gagal' }
        set({ userId: res.userId, username: res.username ?? username, sessionToken: res.sessionToken ?? null, isAuthenticated: true, isVaultLocked: true })
        useLevelStore.getState().setUser(res.userId)
        return { ok: true }
      } catch {
        return { ok: false, error: 'Login gagal' }
      }
    }
    try {
      const found = await adapter.db.select().from('users').where(eq('username', username)).limit(1)
      if (!found || found.length === 0) return { ok: false, error: 'Username tidak ditemukan' }
      const user = found[0]
      const valid = await verifyPassword(password, user.password_hash)
      if (!valid) return { ok: false, error: 'Password salah' }
      set({ userId: user.id, username: user.username, sessionToken: null, isAuthenticated: true, isVaultLocked: true })
      useLevelStore.getState().setUser(user.id)
      return { ok: true }
    } catch {
      return { ok: false, error: 'Login gagal' }
    }
  },

  logout: () => {
    set({ userId: null, username: null, sessionToken: null, isAuthenticated: false, isVaultLocked: true })
    // Clear every other store synchronously, in the same tick as the auth
    // state change — a dynamic import().then() here would leave a window
    // where a fast-following login() could race the cleanup (old user's
    // data still resolving to clear after the new user's fetchAll already
    // populated it, or vice versa).
    useFinanceStore.setState({ transactions: [], budgets: [], accounts: [], savingsGoals: [], recurring: [] })
    useWealthStore.setState({ assets: [] })
    useNetWorthStore.setState({ entries: [] })
    useTodoStore.setState({ todos: [] })
    useVaultStore.setState({ entries: [], vaultKey: null })
    useSubscriptionStore.setState({ subscriptions: [] })
    useHabitStore.setState({ habits: [], logs: [] })
    useNotesStore.setState({ notes: [] })
    useSettingsStore.setState({ settings: null, loaded: false })
    useLevelStore.getState().setUser(null)
  },

  lockVault: () => set({ isVaultLocked: true }),

  init: async () => {
    const { adapter } = get()
    if (!adapter) return
    try { await adapter.init() } catch {}
  },
}))
