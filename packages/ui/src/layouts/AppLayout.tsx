import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import Sidebar, { type PageId } from '../components/Sidebar'
import { Toaster } from 'sonner'
import LoadingSpinner from '../components/LoadingSpinner'
import PageTransition from '../components/PageTransition'
import ErrorBoundary from '../components/ErrorBoundary'
import CommandPalette from '../components/CommandPalette'
import { useVaultStore } from '../stores/vaultStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useCheckinStore } from '../stores/checkinStore'
import { NeubruBtn, NeubruModal } from '../components'

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
  review: () => import('../features/review/YearReviewPage'),
  settings: () => import('../features/settings/SettingsPage'),
  fire: () => import('../features/fire/FirePage'),
}

export default function AppLayout({ children }: Props) {
  const [page, setPage] = useState<PageId>('dashboard')
  const [PageComp, setPageComp] = useState<{ default: () => React.JSX.Element } | null>(null)
  const [loading, setLoading] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Daily Check-in ──
  const todayChecked = useCheckinStore((s) => s.todayChecked)
  const checkIn = useCheckinStore((s) => s.checkIn)
  const [showCheckin, setShowCheckin] = useState(false)
  const [mood, setMood] = useState(3)
  const [energy, setEnergy] = useState(3)
  const [highlight, setHighlight] = useState('')

  useEffect(() => {
    if (!todayChecked) {
      const timer = setTimeout(() => setShowCheckin(true), 800)
      return () => clearTimeout(timer)
    }
  }, [todayChecked])

  const handleCheckinSave = () => {
    checkIn(mood, energy, highlight)
    setShowCheckin(false)
  }

  const handleCheckinSkip = () => {
    setShowCheckin(false)
  }

  const MOOD_EMOJIS = ['😫', '😐', '🙂', '😊', '🔥']

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

  // ── Command palette keyboard shortcut ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        ;(window as any).__wosCommandPalette?.toggle()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

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
      <CommandPalette onNavigate={navigate} />

      {/* ── Daily Check-in Modal ── */}
      <NeubruModal open={showCheckin} onClose={handleCheckinSkip} title="🧘 How are you today?">
        <div className="flex flex-col gap-5">
          {/* Mood */}
          <div>
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted block mb-2">Mood</label>
            <div className="flex gap-2">
              {MOOD_EMOJIS.map((emoji, i) => (
                <button
                  key={i}
                  onClick={() => setMood(i + 1)}
                  className={`text-2xl w-12 h-12 border-2 flex items-center justify-center cursor-pointer transition-all ${
                    mood === i + 1
                      ? 'bg-nb-yellow border-nb-border shadow-nb-sm scale-110'
                      : 'bg-white border-nb-border hover:bg-nb-yellow/30'
                  }`}
                  title={`Mood ${i + 1}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Energy */}
          <div>
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted block mb-2">Energy</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  onClick={() => setEnergy(level)}
                  className={`text-xl w-12 h-12 border-2 flex items-center justify-center cursor-pointer transition-all ${
                    energy >= level
                      ? 'bg-nb-yellow border-nb-border shadow-nb-sm'
                      : 'bg-white border-nb-border hover:bg-nb-yellow/30'
                  }`}
                  title={`Energy ${level}`}
                >
                  ⚡
                </button>
              ))}
            </div>
          </div>

          {/* Highlight */}
          <div>
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted block mb-2">Best thing today...</label>
            <textarea
              value={highlight}
              onChange={(e) => setHighlight(e.target.value)}
              placeholder="Apa hal terbaik yang terjadi hari ini?"
              rows={2}
              className="border-2 border-nb-border bg-white px-3 py-2 text-sm font-medium outline-none resize-y w-full"
              style={{ fontFamily: 'inherit' }}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2.5">
            <NeubruBtn color="green" onClick={handleCheckinSave}>💾 Save</NeubruBtn>
            <NeubruBtn color="red" onClick={handleCheckinSkip}>Lewati</NeubruBtn>
          </div>
        </div>
      </NeubruModal>

      <Toaster position="top-right" richColors />
    </div>
  )
}
