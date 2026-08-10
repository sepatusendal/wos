import { create } from 'zustand'
import type { DatabaseAdapter } from '@wos/db'
import { eq } from '@wos/db'

export interface UserSettings {
  userId: string
  theme: string
  currency: string
  locale: string
  autoLockMinutes: number
}

interface SettingsState {
  adapter: DatabaseAdapter | null
  settings: UserSettings | null
  loaded: boolean
  setAdapter: (adapter: DatabaseAdapter) => void
  fetchSettings: (userId: string) => Promise<void>
  updateSettings: (userId: string, patch: Partial<Omit<UserSettings, 'userId'>>) => Promise<void>
  changePassword: (userId: string, currentPassword: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  adapter: null,
  settings: null,
  loaded: false,

  setAdapter: (adapter) => set({ adapter }),

  fetchSettings: async (userId) => {
    const { adapter } = get()
    if (!adapter) return
    try {
      const result = await adapter.db.select().from('user_settings').where(eq('user_id', userId)).all()
      if (result.length > 0) {
        const r = result[0] as any
        set({ settings: { userId: r.user_id, theme: r.theme, currency: r.currency, locale: r.locale, autoLockMinutes: r.auto_lock_minutes }, loaded: true })
      } else {
        const defaults: UserSettings = { userId, theme: 'light', currency: 'IDR', locale: 'id-ID', autoLockMinutes: 10 }
        await adapter.db.insert('user_settings').values({ user_id: userId, theme: defaults.theme, currency: defaults.currency, locale: defaults.locale, auto_lock_minutes: defaults.autoLockMinutes })
        set({ settings: defaults, loaded: true })
      }
    } catch {
      set({ loaded: true })
    }
  },

  updateSettings: async (userId, patch) => {
    const { adapter, settings } = get()
    if (!adapter || !settings) return
    const dbPatch: Record<string, any> = {}
    if (patch.theme !== undefined) dbPatch.theme = patch.theme
    if (patch.currency !== undefined) dbPatch.currency = patch.currency
    if (patch.locale !== undefined) dbPatch.locale = patch.locale
    if (patch.autoLockMinutes !== undefined) dbPatch.auto_lock_minutes = patch.autoLockMinutes
    if (Object.keys(dbPatch).length === 0) return
    await adapter.db.update('user_settings').set(dbPatch).where(eq('user_id', userId))
    set({ settings: { ...settings, ...patch } })
  },

  changePassword: async (userId, currentPassword, newPassword) => {
    const { adapter } = get()
    if (!adapter) return { ok: false, error: 'Adapter not initialized' }
    try {
      const { verifyPassword, hashPassword } = await import('@wos/shared')
      const result = await adapter.db.select().from('users').where(eq('id', userId)).all()
      if (result.length === 0) return { ok: false, error: 'User not found' }
      const user = result[0] as any
      const valid = await verifyPassword(currentPassword, user.password_hash)
      if (!valid) return { ok: false, error: 'Current password is incorrect' }
      const newHash = await hashPassword(newPassword)
      await adapter.db.update('users').set({ password_hash: newHash }).where(eq('id', userId))
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Failed to change password' }
    }
  },
}))
