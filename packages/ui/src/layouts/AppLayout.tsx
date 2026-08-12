import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import Sidebar, { type PageId } from '../components/Sidebar'
import { Toaster, toast } from 'sonner'
import LoadingSpinner from '../components/LoadingSpinner'
import PageTransition from '../components/PageTransition'
import ErrorBoundary from '../components/ErrorBoundary'
import CommandPalette from '../components/CommandPalette'
import WeeklyReflection from '../components/WeeklyReflection'
import { useVaultStore } from '../stores/vaultStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useAchievementStore, ACHIEVEMENTS } from '../stores/achievementStore'
import { useLevelStore } from '../stores/levelStore'
import { useAuthStore } from '../stores/authStore'
import { useNotesStore } from '../stores/notesStore'
import { useSubscriptionStore } from '../stores/subscriptionStore'

interface Props {
  children?: ReactNode
}

const pageComponents: Record<PageId, () => Promise<{ default: () => React.JSX.Element }>> = {
  dashboard: () => import('../features/dashboard/DashboardPage'),
  finance: () => import('../features/finance/FinancePage'),
  calendar: () => import('../features/calendar/CalendarPage'),
  wealth: () => import('../features/wealth/WealthPage'),
  subscription: () => import('../features/subscription/SubscriptionPage'),
  habit: () => import('../features/habit/HabitPage'),
  fire: () => import('../features/fire/FirePage'),
  vault: () => import('../features/vault/VaultPage'),
  notes: () => import('../features/notes/NotesPage'),
  todo: () => import('../features/todo/TodoPage'),
  tools: () => import('../features/tools/ToolsPage'),
  review: () => import('../features/review/YearReviewPage'),
  records: () => import('../features/records/RecordsPage'),
  skills: () => import('../features/skills/SkillTreePage'),
  life: () => import('../features/life/LifeScorePage'),
  settings: () => import('../features/settings/SettingsPage'),
}

export default function AppLayout({ children }: Props) {
  const [page, setPage] = useState<PageId>('dashboard')
  const [PageComp, setPageComp] = useState<{ default: () => React.JSX.Element } | null>(null)
  const [loading, setLoading] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Weekly reflection prompt only on Sunday; the component itself skips weeks
  // that were already saved/skipped (localStorage `wos_weekly_reflection_*`).
  const [isSunday] = useState(() => new Date().getDay() === 0)

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
    // Cheap + synchronous — re-check unlock conditions against whatever
    // data every store currently holds each time the user changes page.
    try {
      for (const id of useAchievementStore.getState().checkAll()) {
        const a = ACHIEVEMENTS.find((x) => x.id === id)
        if (a) toast.success(`🏅 Achievement unlocked: ${a.name}`)
      }
    } catch {}
    // Daily quests are derived from real data rather than claimed, so they
    // need the same periodic re-evaluation — otherwise a quest condition met
    // on, say, the Finance page wouldn't register until Skill Tree is opened.
    try {
      const userId = useAuthStore.getState().userId
      if (userId) {
        const level = useLevelStore.getState()
        level.generateDailyQuests(userId)
        for (const id of level.evaluateQuests()) {
          const q = useLevelStore.getState().dailyQuests.find((x) => x.id === id)
          if (q) toast.success(`✅ Quest selesai: ${q.desc} · +${q.xp} XP`)
        }
      }
    } catch {}
  }, [])

  // Load dashboard by default
  useEffect(() => {
    if (!PageComp && !loading) {
      navigate('dashboard')
    }
  }, [PageComp, loading, navigate])

  // Notes are read by several places that never fetched them themselves
  // (Finance/Todo link indicators, Dashboard's Pet/OnThisDay) — fetch once
  // here instead of duplicating the fetch per-consumer.
  useEffect(() => {
    const userId = useAuthStore.getState().userId
    if (userId) useNotesStore.getState().fetchAll(userId)
  }, [])

  // Subscriptions whose billing date has passed become real expense
  // transactions here, once per app session — doing it at the layout level
  // (instead of on SubscriptionPage) means it runs no matter which page the
  // user opens first, same as recurring transactions should.
  useEffect(() => {
    const userId = useAuthStore.getState().userId
    if (!userId) return
    const subs = useSubscriptionStore.getState()
    subs.fetchAll(userId).then(() => subs.processSubscriptions(userId)).catch(() => {})
  }, [])

  // ── Cmd+K / Ctrl+K opens the command palette ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        ;(window as any).__wosCommandPalette?.toggle?.()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
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
      <Toaster position="top-right" richColors />
      <CommandPalette onNavigate={navigate} />
      {isSunday && <WeeklyReflection trigger />}
    </div>
  )
}
