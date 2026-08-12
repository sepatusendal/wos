'use client'

import { useEffect, useState } from 'react'
import {
  AppLayout, LoginPage, LoadingSpinner,
  useAuthStore, useFinanceStore, useWealthStore, useLiabilityStore, useNetWorthStore, useVaultStore, useTodoStore, useSettingsStore,
  useSubscriptionStore, useHabitStore, useAchievementStore, useNotesStore,
} from '@wos/ui'
import { Confetti } from '@wos/ui'
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
  // Only true once the session token is actually written to sessionStorage —
  // AppLayout (and every child fetchAll effect it triggers) is gated on
  // this, not just on isAuthenticated, so no request can go out with an
  // empty x-session-token header. Login/register now issue the token
  // atomically server-side (see authStore.ts), so this is a synchronous
  // persist of an already-valid token, not a separate DB round-trip.
  const [sessionPersisted, setSessionPersisted] = useState(false)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const userId = useAuthStore((s) => s.userId)
  const sessionToken = useAuthStore((s) => s.sessionToken)
  const setAdapter = useAuthStore((s) => s.setAdapter)
  const init = useAuthStore((s) => s.init)

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
    useLiabilityStore.getState().setAdapter(adapter)
    useNetWorthStore.getState().setAdapter(adapter)
    useVaultStore.getState().setAdapter(adapter)
    useTodoStore.getState().setAdapter(adapter)
    useSettingsStore.getState().setAdapter(adapter)
    useSubscriptionStore.getState().setAdapter(adapter)
    useHabitStore.getState().setAdapter(adapter)
    useAchievementStore.getState().setAdapter(adapter)
    useNotesStore.getState().setAdapter(adapter)
    setAdapterReady(true)
  }, [setAdapter])

  // Persist the session the moment both userId and sessionToken exist, and
  // only then flip sessionPersisted — AppLayout doesn't mount until this
  // has happened, so its children's first fetchAll always has a real
  // x-session-token to send.
  useEffect(() => {
    if (!isAuthenticated || !userId || !sessionToken) return
    setWebSession(userId, sessionToken)
    setSessionPersisted(true)
  }, [isAuthenticated, userId, sessionToken])

  useEffect(() => {
    if (!isAuthenticated) {
      setSessionPersisted(false)
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

  if (!sessionPersisted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-nb-bg">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <>
      <Confetti />
      <AppLayout />
    </>
  )
}
