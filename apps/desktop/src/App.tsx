import { useEffect, useState } from 'react'
import { AppLayout, LoginPage, LoadingSpinner, useAuthStore, useFinanceStore, useWealthStore, useNetWorthStore, useVaultStore, useTodoStore, useSettingsStore, useSubscriptionStore, useHabitStore, useNotesStore } from '@wos/ui'
import Database from '@tauri-apps/plugin-sql'
import { createTauriSqlAdapter } from '@wos/db'
import { getCurrentWindow } from '@tauri-apps/api/window'

// ── Window State Persistence ──────────────────────────────
// Fixes #4: macOS window doesn't remember position/size between sessions

const WINDOW_STATE_KEY = 'wos.desktop.windowState'

interface WindowState {
  x: number | null
  y: number | null
  width: number
  height: number
  maximized: boolean
}

function loadWindowState(): WindowState | null {
  try {
    const raw = localStorage.getItem(WINDOW_STATE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as WindowState
  } catch {
    return null
  }
}

function saveWindowState(state: WindowState) {
  try {
    localStorage.setItem(WINDOW_STATE_KEY, JSON.stringify(state))
  } catch {
    // localStorage may be unavailable in some Tauri contexts
  }
}

async function restoreWindowState() {
  const saved = loadWindowState()
  if (!saved) return

  try {
    const win = getCurrentWindow()
    if (saved.x !== null && saved.y !== null) {
      await win.setPosition({ x: saved.x, y: saved.y })
    }
    await win.setSize({ width: saved.width, height: saved.height })
    if (saved.maximized) {
      await win.maximize()
    }
  } catch {
    // Window API may fail — silently fall back to defaults
  }
}

function attachWindowStateListeners() {
  const win = getCurrentWindow()

  // Debounced save on resize/move to avoid excessive writes
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  const debouncedSave = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      try {
        const pos = await win.outerPosition()
        const size = await win.outerSize()
        const maximized = await win.isMaximized()
        saveWindowState({ x: pos.x, y: pos.y, width: size.width, height: size.height, maximized })
      } catch { /* ignore */ }
    }, 300)
  }

  win.onResized(debouncedSave)
  win.onMoved(debouncedSave)
}

export default function App() {
  const [adapterReady, setAdapterReady] = useState(false)
  const [windowReady, setWindowReady] = useState(false)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const setAdapter = useAuthStore((s) => s.setAdapter)
  const init = useAuthStore((s) => s.init)

  const [error, setError] = useState<string | null>(null)

  // Restore saved window position/size on mount
  useEffect(() => {
    restoreWindowState().then(() => {
      attachWindowStateListeners()
      setWindowReady(true)
    })
  }, [])

  useEffect(() => {
    Database.load('sqlite:wos.db').then(async (tauriDb) => {
      try {
        await tauriDb.execute(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
            vault_salt TEXT, vault_verify TEXT, session_token TEXT, created_at TEXT NOT NULL
          )
        `)
        // Migration: add vault_verify if upgrading from older schema
        try { await tauriDb.execute(`ALTER TABLE users ADD COLUMN vault_verify TEXT`) } catch {}
        try { await tauriDb.execute(`ALTER TABLE users ADD COLUMN session_token TEXT`) } catch {}
        await tauriDb.execute(`
          CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, type TEXT NOT NULL,
            amount REAL NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
            date TEXT NOT NULL, account_id TEXT, created_at TEXT NOT NULL
          )
        `)
        // Migration: add account_id if upgrading from older schema
        try { await tauriDb.execute(`ALTER TABLE transactions ADD COLUMN account_id TEXT`) } catch {}
        await tauriDb.execute(`
          CREATE TABLE IF NOT EXISTS budgets (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, category TEXT NOT NULL, "limit" REAL NOT NULL
          )
        `)
        await tauriDb.execute(`
          CREATE TABLE IF NOT EXISTS assets (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL,
            ticker TEXT, quantity REAL NOT NULL, unit_price REAL NOT NULL, buy_price REAL, buy_date TEXT,
            notes TEXT NOT NULL DEFAULT '', last_updated TEXT NOT NULL, created_at TEXT NOT NULL
          )
        `)
        try { await tauriDb.execute(`ALTER TABLE assets ADD COLUMN buy_price REAL`) } catch {}
        try { await tauriDb.execute(`ALTER TABLE assets ADD COLUMN buy_date TEXT`) } catch {}
        try { await tauriDb.execute(`ALTER TABLE assets ADD COLUMN ticker TEXT`) } catch {}
        await tauriDb.execute(`
          CREATE TABLE IF NOT EXISTS net_worth_entries (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, date TEXT NOT NULL,
            total_assets REAL NOT NULL, total_liabilities REAL NOT NULL, net_worth REAL NOT NULL,
            cash REAL NOT NULL DEFAULT 0, investments REAL NOT NULL DEFAULT 0, property REAL NOT NULL DEFAULT 0,
            other_assets REAL NOT NULL DEFAULT 0, mortgage REAL NOT NULL DEFAULT 0, loans REAL NOT NULL DEFAULT 0,
            credit_cards REAL NOT NULL DEFAULT 0, other_liabilities REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL
          )
        `)
        await tauriDb.execute(`
          CREATE TABLE IF NOT EXISTS vault_entries (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, service TEXT NOT NULL,
            username TEXT NOT NULL, password_encrypted TEXT NOT NULL, password_iv TEXT NOT NULL DEFAULT '',
            url TEXT NOT NULL DEFAULT '', notes_encrypted TEXT NOT NULL DEFAULT '', notes_iv TEXT NOT NULL DEFAULT '',
            category TEXT NOT NULL, created_at TEXT NOT NULL
          )
        `)
        await tauriDb.execute(`
          CREATE TABLE IF NOT EXISTS todos (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL,
            completed INTEGER NOT NULL DEFAULT 0, priority TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '[]',
            due_date TEXT, notes TEXT NOT NULL DEFAULT '', parent_id TEXT, "order" INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL
          )
        `)
        await tauriDb.execute(`
          CREATE TABLE IF NOT EXISTS accounts (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
            type TEXT NOT NULL, balance REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL
          )
        `)
        await tauriDb.execute(`
          CREATE TABLE IF NOT EXISTS savings_goals (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
            target_amount REAL NOT NULL, saved_amount REAL NOT NULL DEFAULT 0,
            deadline TEXT, created_at TEXT NOT NULL
          )
        `)
        await tauriDb.execute(`
          CREATE TABLE IF NOT EXISTS recurring_transactions (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
            type TEXT NOT NULL, amount REAL NOT NULL, category TEXT NOT NULL,
            frequency TEXT NOT NULL, next_date TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
          )
        `)
        await tauriDb.execute(`
          CREATE TABLE IF NOT EXISTS user_settings (
            user_id TEXT PRIMARY KEY, theme TEXT NOT NULL DEFAULT 'light',
            currency TEXT NOT NULL DEFAULT 'IDR', locale TEXT NOT NULL DEFAULT 'id-ID',
            auto_lock_minutes INTEGER NOT NULL DEFAULT 10
          )
        `)
        await tauriDb.execute(`
          CREATE TABLE IF NOT EXISTS subscriptions (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
            category TEXT NOT NULL, amount REAL NOT NULL, frequency TEXT NOT NULL,
            next_billing TEXT NOT NULL, icon TEXT NOT NULL DEFAULT '📦',
            active INTEGER NOT NULL DEFAULT 1, notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
          )
        `)
        await tauriDb.execute(`
          CREATE TABLE IF NOT EXISTS habits (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
            emoji TEXT NOT NULL DEFAULT '✅', frequency TEXT NOT NULL DEFAULT 'daily',
            target_days TEXT NOT NULL DEFAULT '[]', color TEXT NOT NULL DEFAULT 'yellow',
            active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
          )
        `)
        await tauriDb.execute(`
          CREATE TABLE IF NOT EXISTS habit_logs (
            id TEXT PRIMARY KEY, habit_id TEXT NOT NULL, user_id TEXT NOT NULL,
            date TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
          )
        `)
        try { await tauriDb.execute(`ALTER TABLE habit_logs ADD COLUMN user_id TEXT`) } catch {}
        await tauriDb.execute(`
          CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '', tags TEXT NOT NULL DEFAULT '[]',
            date TEXT NOT NULL, pinned INTEGER NOT NULL DEFAULT 0,
            linked_todo_id TEXT, linked_transaction_id TEXT,
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL
          )
        `)

        const adapter = createTauriSqlAdapter(tauriDb)
        setAdapter(adapter)
        useFinanceStore.getState().setAdapter(adapter)
        useWealthStore.getState().setAdapter(adapter)
        useNetWorthStore.getState().setAdapter(adapter)
        useVaultStore.getState().setAdapter(adapter)
        useTodoStore.getState().setAdapter(adapter)
        useSettingsStore.getState().setAdapter(adapter)
        useSubscriptionStore.getState().setAdapter(adapter)
        useHabitStore.getState().setAdapter(adapter)
        useNotesStore.getState().setAdapter(adapter)
        setAdapterReady(true)
      } catch (err: any) {
        console.error('Failed to initialize database:', err)
        setError(err?.message || 'Gagal membuat tabel database')
      }
    }).catch((err) => {
      console.error('Failed to load SQLite plugin:', err)
      setError(err?.message || 'Gagal memuat plugin SQLite')
    })
  }, [setAdapter])

  useEffect(() => {
    if (adapterReady) init()
  }, [adapterReady, init])

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-nb-bg p-6 text-center">
        <h2 className="text-xl font-extrabold text-nb-red mb-2">Error Database</h2>
        <p className="text-sm font-medium text-nb-fg-muted max-w-md">{error}</p>
      </div>
    )
  }

  if (!adapterReady || !windowReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-nb-bg">
        <LoadingSpinner />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => {}} />
  }

  return <AppLayout />
}
