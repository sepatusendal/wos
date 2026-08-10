'use client'

import { useEffect, useState, useRef } from 'react'
import {
  AppLayout, LoginPage, LoadingSpinner,
  useAuthStore, useFinanceStore, useWealthStore, useNetWorthStore, useVaultStore, useTodoStore, useSettingsStore,
  useSubscriptionStore, useHabitStore, useNotesStore,
} from '@wos/ui'
import { createHttpAdapter } from '@wos/db'

// Session store with sessionStorage persistence (survives page refresh)
const SESSION_KEY = 'wos_session'

function getStoredSession(): { userId: string; token: string } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

function setStoredSession(userId: string, token: string) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ userId, token })) } catch {}
}

function clearStoredSession() {
  try { sessionStorage.removeItem(SESSION_KEY) } catch {}
}

export function getWebSession(): { userId: string; token: string } | null {
  return getStoredSession()
}

export function setWebSession(userId: string, token: string) {
  setStoredSession(userId, token)
}

export function clearWebSession() {
  clearStoredSession()
}

export default function Home() {
  const [adapterReady, setAdapterReady] = useState(false)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const userId = useAuthStore((s) => s.userId)
  const setAdapter = useAuthStore((s) => s.setAdapter)
  const init = useAuthStore((s) => s.init)
  const sessionSetupRef = useRef(false)

  useEffect(() => {
    const adapter = createHttpAdapter({
      headers: () => {
        const h: Record<string, string> = {}
        const session = getStoredSession()
        if (session) {
          h['x-user-id'] = session.userId
          h['x-session-token'] = session.token
        }
        return h
      },
    })
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
  }, [setAdapter])

  // Set up or restore session token after successful login
  useEffect(() => {
    if (!adapterReady || !userId || sessionSetupRef.current) return

    // Check if we already have a persisted session
    const existing = getStoredSession()
    if (existing && existing.userId === userId) {
      sessionSetupRef.current = true
      return // Session is still valid
    }

    sessionSetupRef.current = true
    const token = crypto.randomUUID()
    useAuthStore.getState().adapter?.db
      .update('users')
      .set({ session_token: token })
      .where({ column: 'id', op: '=', value: userId })
      .then(() => {
        setWebSession(userId, token)
      })
      .catch(() => {
        sessionSetupRef.current = false
      })
  }, [adapterReady, userId])

  // Reset session setup flag on logout
  useEffect(() => {
    if (!isAuthenticated) {
      sessionSetupRef.current = false
      clearWebSession()
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (adapterReady) init()
  }, [adapterReady, init])

  if (!adapterReady) {
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
