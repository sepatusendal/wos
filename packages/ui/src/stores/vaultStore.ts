import { create } from 'zustand'
import type { VaultEntry } from '@wos/shared'
import { generateId, isoNow, encrypt, decrypt, deriveKey, generateSalt, bytesToBase64, base64ToBytes } from '@wos/shared'
import type { DatabaseAdapter } from '@wos/db'
import { eq, desc } from '@wos/db'
import { useAuthStore } from './authStore'

// A known plaintext value encrypted and stored as a canary to verify the vault password.
const VAULT_CANARY = 'WOS_VAULT_OK'

interface VaultState {
  adapter: DatabaseAdapter | null
  entries: VaultEntry[]
  loading: boolean
  vaultKey: CryptoKey | null
  setAdapter: (adapter: DatabaseAdapter) => void
  fetchAll: (userId: string) => Promise<void>
  unlock: (userId: string, password: string) => Promise<{ ok: boolean; error?: string }>
  lock: () => void
  checkVaultSetup: (userId: string) => Promise<{ hasPassword: boolean }>
  changeVaultPassword: (userId: string, currentPassword: string | null, newPassword: string) => Promise<{ ok: boolean; error?: string }>
  addEntry: (userId: string, e: Omit<VaultEntry, 'id' | 'createdAt'>) => Promise<void>
  editEntry: (e: { id: string; service: string; username: string; password: string; url: string; notes: string; category: string }) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
}

export const useVaultStore = create<VaultState>((set, get) => ({
  adapter: null,
  entries: [],
  loading: false,
  vaultKey: null,

  setAdapter: (adapter) => set({ adapter }),

  fetchAll: async (userId) => {
    const { adapter, vaultKey } = get()
    if (!adapter || !vaultKey) return
    set({ loading: true })
    try {
      const data = await adapter.db.select().from('vault_entries').where(eq('user_id', userId)).orderBy(desc('created_at')).all()
      const decrypted = await Promise.all(data.map(async (v: any) => ({
        id: v.id, service: v.service, username: v.username,
        password: await decrypt(v.password_encrypted, vaultKey),
        url: v.url ?? '', notes: v.notes_encrypted ? await decrypt(v.notes_encrypted, vaultKey) : '',
        category: v.category as VaultEntry['category'], createdAt: v.created_at,
      } as VaultEntry)))
      set({ entries: decrypted, loading: false })
    } catch (err) {
      set({ loading: false, entries: [] })
      throw err
    }
  },

  unlock: async (userId, password) => {
    const { adapter } = get()
    if (!adapter) return { ok: false, error: 'DB tidak tersedia' }
    try {
      const found = await adapter.db.select().from('users').where(eq('id', userId)).limit(1)
      if (!found || found.length === 0) return { ok: false, error: 'User tidak ditemukan' }
      const user = found[0] as any

      let key: CryptoKey

      if (!user.vault_salt) {
        // First time: generate salt, derive key, encrypt canary, store both
        const salt = generateSalt()
        key = await deriveKey(password, salt)
        const saltB64 = bytesToBase64(salt)
        const { ciphertext: verifyToken } = await encrypt(VAULT_CANARY, key)
        await adapter.db.update('users').set({ vault_salt: saltB64, vault_verify: verifyToken }).where(eq('id', userId))
      } else {
        // Subsequent unlock: derive key and verify against stored canary
        const salt = base64ToBytes(user.vault_salt as string)
        key = await deriveKey(password, salt)

        if (user.vault_verify) {
          try {
            const decrypted = await decrypt(user.vault_verify as string, key)
            if (decrypted !== VAULT_CANARY) {
              return { ok: false, error: 'Password vault salah' }
            }
          } catch {
            return { ok: false, error: 'Password vault salah' }
          }
        } else {
          // Legacy: no canary yet — write one now
          const { ciphertext: verifyToken } = await encrypt(VAULT_CANARY, key)
          await adapter.db.update('users').set({ vault_verify: verifyToken }).where(eq('id', userId))
        }
      }

      set({ vaultKey: key })
      try {
        await get().fetchAll(userId)
      } catch {
        set({ vaultKey: null, entries: [] })
        return { ok: false, error: 'Gagal mendekripsi data vault' }
      }
      useAuthStore.setState({ isVaultLocked: false })
      return { ok: true }
    } catch {
      set({ vaultKey: null, entries: [] })
      return { ok: false, error: 'Password vault salah' }
    }
  },

  lock: () => {
    set({ vaultKey: null, entries: [] })
    useAuthStore.setState({ isVaultLocked: true })
  },

  checkVaultSetup: async (userId) => {
    const { adapter } = get()
    if (!adapter) return { hasPassword: false }
    try {
      const found = await adapter.db.select().from('users').where(eq('id', userId)).limit(1)
      if (!found || found.length === 0) return { hasPassword: false }
      const user = found[0] as any
      return { hasPassword: !!user.vault_salt }
    } catch {
      return { hasPassword: false }
    }
  },

  changeVaultPassword: async (userId, currentPassword, newPassword) => {
    const { adapter } = get()
    if (!adapter) return { ok: false, error: 'DB tidak tersedia' }
    try {
      const found = await adapter.db.select().from('users').where(eq('id', userId)).limit(1)
      if (!found || found.length === 0) return { ok: false, error: 'User tidak ditemukan' }
      const user = found[0] as any

      let oldKey: CryptoKey | null = null

      if (user.vault_salt) {
        // Vault already has a password — verify current password
        if (!currentPassword) return { ok: false, error: 'Password vault saat ini diperlukan' }
        const oldSalt = base64ToBytes(user.vault_salt as string)
        oldKey = await deriveKey(currentPassword, oldSalt)

        if (user.vault_verify) {
          try {
            const check = await decrypt(user.vault_verify as string, oldKey)
            if (check !== VAULT_CANARY) return { ok: false, error: 'Password vault saat ini salah' }
          } catch {
            return { ok: false, error: 'Password vault saat ini salah' }
          }
        }
      }

      // Generate new salt + key
      const newSalt = generateSalt()
      const newKey = await deriveKey(newPassword, newSalt)
      const newSaltB64 = bytesToBase64(newSalt)
      const { ciphertext: newVerifyToken } = await encrypt(VAULT_CANARY, newKey)

      // Re-encrypt all existing vault entries with new key
      if (oldKey) {
        const rawEntries = await adapter.db.select().from('vault_entries').where(eq('user_id', userId)).all()
        let skippedCount = 0
        for (const raw of rawEntries as any[]) {
          let decryptedPassword = ''
          let decryptedNotes = ''
          try { decryptedPassword = await decrypt(raw.password_encrypted, oldKey) } catch { skippedCount++; continue }
          if (raw.notes_encrypted) {
            try { decryptedNotes = await decrypt(raw.notes_encrypted, oldKey) } catch {}
          }
          const newPassEnc = await encrypt(decryptedPassword, newKey)
          const newNotesEnc = decryptedNotes ? await encrypt(decryptedNotes, newKey) : { ciphertext: '', iv: '' }
          await adapter.db.update('vault_entries').set({
            password_encrypted: newPassEnc.ciphertext,
            password_iv: newPassEnc.iv,
            notes_encrypted: newNotesEnc.ciphertext,
            notes_iv: newNotesEnc.iv,
          }).where(eq('id', raw.id))
        }
        if (skippedCount > 0) {
          console.error(`[vault] ${skippedCount} entries could not be re-encrypted and are now inaccessible`)
        }
      }

      // Update user with new salt + canary
      await adapter.db.update('users').set({ vault_salt: newSaltB64, vault_verify: newVerifyToken }).where(eq('id', userId))

      // Update in-memory key and re-fetch entries
      set({ vaultKey: newKey })
      try { await get().fetchAll(userId) } catch {}

      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Gagal mengubah password vault' }
    }
  },

  addEntry: async (userId, e) => {
    const { adapter, vaultKey } = get()
    if (!adapter || !vaultKey) return
    const id = generateId()
    const passEnc = await encrypt(e.password, vaultKey)
    let notesEnc = { ciphertext: '', iv: '' }
    if (e.notes) {
      notesEnc = await encrypt(e.notes, vaultKey)
    }
    await adapter.db.insert('vault_entries').values({
      id, user_id: userId, service: e.service, username: e.username,
      password_encrypted: passEnc.ciphertext, password_iv: passEnc.iv,
      url: e.url, notes_encrypted: notesEnc.ciphertext, notes_iv: notesEnc.iv,
      category: e.category, created_at: isoNow(),
    })
    await get().fetchAll(userId)
  },

  editEntry: async (e) => {
    const { adapter, vaultKey } = get()
    if (!adapter || !vaultKey) return
    const passEnc = await encrypt(e.password, vaultKey)
    let notesEnc = { ciphertext: '', iv: '' }
    if (e.notes) {
      notesEnc = await encrypt(e.notes, vaultKey)
    }
    await adapter.db.update('vault_entries').set({
      service: e.service, username: e.username,
      password_encrypted: passEnc.ciphertext, password_iv: passEnc.iv,
      url: e.url, notes_encrypted: notesEnc.ciphertext, notes_iv: notesEnc.iv,
      category: e.category,
    }).where(eq('id', e.id))
    set((s) => ({ entries: s.entries.map((x) => (x.id === e.id ? { ...x, password: e.password, notes: e.notes } as VaultEntry : x)) }))
  },

  deleteEntry: async (id) => {
    const { adapter } = get()
    if (!adapter) return
    await adapter.db.delete('vault_entries').where(eq('id', id))
    set((s) => ({ entries: s.entries.filter((x) => x.id !== id) }))
  },
}))
