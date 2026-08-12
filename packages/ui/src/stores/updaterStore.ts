import { create } from 'zustand'

// The web build has no concept of "app updates" — only the desktop (Tauri)
// shell does. To keep this package free of a hard @tauri-apps/plugin-updater
// dependency, desktop registers its real implementation at boot via
// registerImpl(), the same way stores receive their DB adapter. Until that
// happens `supported` stays false and the UI hides the update controls.
export interface UpdateInfo {
  version: string
  notes: string | null
}

export interface UpdaterImpl {
  getCurrentVersion: () => Promise<string>
  check: () => Promise<UpdateInfo | null>
  downloadAndInstall: (onProgress: (pct: number) => void) => Promise<void>
  relaunch: () => Promise<void>
}

type Status = 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'ready' | 'error'

interface UpdaterState {
  supported: boolean
  currentVersion: string | null
  status: Status
  update: UpdateInfo | null
  progress: number
  error: string | null
  impl: UpdaterImpl | null
  registerImpl: (impl: UpdaterImpl) => void
  checkForUpdates: () => Promise<void>
  installUpdate: () => Promise<void>
}

export const useUpdaterStore = create<UpdaterState>((set, get) => ({
  supported: false,
  currentVersion: null,
  status: 'idle',
  update: null,
  progress: 0,
  error: null,
  impl: null,

  registerImpl: (impl) => {
    set({ impl, supported: true })
    impl.getCurrentVersion().then((v) => set({ currentVersion: v })).catch(() => {})
  },

  checkForUpdates: async () => {
    const { impl } = get()
    if (!impl) return
    set({ status: 'checking', error: null })
    try {
      const update = await impl.check()
      set({ status: update ? 'available' : 'up-to-date', update })
    } catch (e: any) {
      set({ status: 'error', error: e?.message || 'Gagal cek update' })
    }
  },

  installUpdate: async () => {
    const { impl } = get()
    if (!impl) return
    set({ status: 'downloading', progress: 0, error: null })
    try {
      await impl.downloadAndInstall((pct) => set({ progress: pct }))
      set({ status: 'ready', progress: 100 })
      await impl.relaunch()
    } catch (e: any) {
      set({ status: 'error', error: e?.message || 'Gagal install update' })
    }
  },
}))
