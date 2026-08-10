import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import Sidebar, { type PageId } from '../components/Sidebar'
import { Toaster } from 'sonner'
import LoadingSpinner from '../components/LoadingSpinner'
import PageTransition from '../components/PageTransition'
import ErrorBoundary from '../components/ErrorBoundary'
import { useVaultStore } from '../stores/vaultStore'
import { useSettingsStore } from '../stores/settingsStore'

interface Props {
  children?: ReactNode
}

const pageComponents: Record<PageId, () => Promise<{ default: () => React.JSX.Element }>> = {
  dashboard: () => import('../features/dashboard/DashboardPage'),
  finance: () => import('../features/finance/FinancePage'),
  calendar: () => import('../features/calendar/CalendarPage'),
  wealth: () => import('../features/wealth/WealthPage'),
  networth: () => import('../features/networth/NetWorthPage'),
  subscription: () => import('../features/subscription/SubscriptionPage'),
  habit: () => import('../features/habit/HabitPage'),
  vault: () => import('../features/vault/VaultPage'),
  notes: () => import('../features/notes/NotesPage'),
  todo: () => import('../features/todo/TodoPage'),
  settings: () => import('../features/settings/SettingsPage'),
}

export default function AppLayout({ children }: Props) {
  const [page, setPage] = useState<PageId>('dashboard')
  const [PageComp, setPageComp] = useState<{ default: () => React.JSX.Element } | null>(null)
  const [loading, setLoading] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const navigate = useCallback(async (p: PageId) => {
    setPage(p)
    setLoading(true)
    setPageError(null)
    try {
      const mod = await pageComponents[p]()
      setPageComp(mod)
    } catch (e: any) {
      console.error('Failed to load page:', e)
      setPageError(e?.message || 'Gagal memuat halaman')
    }
    setLoading(false)
  }, [])

  // Load dashboard by default
  useEffect(() => {
    if (!PageComp && !loading) {
      navigate('dashboard')
    }
  }, [PageComp, loading, navigate])

  // ── Auto-lock timer ──
  useEffect(() => {
    const resetIdle = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      const minutes = useSettingsStore.getState().settings?.autoLockMinutes ?? 10
      if (minutes <= 0) return // "Never" setting

      idleTimerRef.current = setTimeout(() => {
        const vaultKey = useVaultStore.getState().vaultKey
        if (vaultKey) {
          useVaultStore.getState().lock()
        }
      }, minutes * 60_000)
    }

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll']
    events.forEach((e) => window.addEventListener(e, resetIdle, { passive: true }))
    resetIdle() // start timer on mount

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      events.forEach((e) => window.removeEventListener(e, resetIdle))
    }
  }, [])

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar activePage={page} onNavigate={navigate}>
        {children}
      </Sidebar>
      <main className="flex-1 p-8 max-h-screen overflow-y-auto">
        <ErrorBoundary>
          <PageTransition pageKey={page}>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <LoadingSpinner />
              </div>
            ) : pageError ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="text-4xl">⚠️</div>
                <div className="font-bold text-nb-red text-sm uppercase tracking-wide">Gagal memuat halaman</div>
                <div className="text-xs text-nb-fg-muted font-mono max-w-md text-center">{pageError}</div>
              </div>
            ) : !PageComp ? (
              <div className="flex items-center justify-center h-64">
                <LoadingSpinner />
              </div>
            ) : (
              <PageComp.default />
            )}
          </PageTransition>
        </ErrorBoundary>
      </main>
      <Toaster position="top-right" richColors />
    </div>
  )
}
