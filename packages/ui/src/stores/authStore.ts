import { create } from 'zustand'
import type { DatabaseAdapter } from '@wos/db'
import { eq } from '@wos/db'
import { hashPassword, verifyPassword, generateId, isoNow } from '@wos/shared'

interface AuthState {
  adapter: DatabaseAdapter | null
  userId: string | null
  username: string | null
  isAuthenticated: boolean
  isVaultLocked: boolean
  setAdapter: (adapter: DatabaseAdapter) => void
  register: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
  lockVault: () => void
  unlockVault: (password: string) => Promise<{ ok: boolean; error?: string }>
  init: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  adapter: null,
  userId: null,
  username: null,
  isAuthenticated: false,
  isVaultLocked: true,

  setAdapter: (adapter) => set({ adapter }),

  register: async (username, password) => {
    const { adapter } = get()
    if (!adapter) return { ok: false, error: 'Database tidak tersedia' }
    try {
      const id = generateId()
      const passwordHash = await hashPassword(password)
      await adapter.db.insert('users').values({ id, username, password_hash: passwordHash, created_at: isoNow() })
      set({ userId: id, username, isAuthenticated: true, isVaultLocked: true })
      return { ok: true }
    } catch {
      return { ok: false, error: 'Username sudah dipakai' }
    }
  },

  login: async (username, password) => {
    const { adapter } = get()
    if (!adapter) return { ok: false, error: 'Database tidak tersedia' }
    try {
      const found = await adapter.db.select().from('users').where(eq('username', username)).limit(1)
      if (!found || found.length === 0) return { ok: false, error: 'Username tidak ditemukan' }
      const user = found[0]
      const valid = await verifyPassword(password, user.password_hash)
      if (!valid) return { ok: false, error: 'Password salah' }
      set({ userId: user.id, username: user.username, isAuthenticated: true, isVaultLocked: true })
      return { ok: true }
    } catch {
      return { ok: false, error: 'Login gagal' }
    }
  },

  logout: () => set({ userId: null, username: null, isAuthenticated: false, isVaultLocked: true }),

  lockVault: () => set({ isVaultLocked: true }),

  unlockVault: async (password) => {
    const { adapter, username } = get()
    if (!adapter || !username) return { ok: false, error: 'Tidak terautentikasi' }
    try {
      const found = await adapter.db.select().from('users').where(eq('username', username)).limit(1)
      if (!found || found.length === 0) return { ok: false, error: 'User tidak ditemukan' }
      const valid = await verifyPassword(password, found[0].password_hash)
      if (!valid) return { ok: false, error: 'Password vault salah' }
      set({ isVaultLocked: false })
      return { ok: true }
    } catch {
      return { ok: false, error: 'Gagal unlock vault' }
    }
  },

  init: async () => {
    const { adapter } = get()
    if (!adapter) return
    try { await adapter.init() } catch {}
  },
}))
