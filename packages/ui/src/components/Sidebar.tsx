import type { ReactNode } from 'react'
import { useAuthStore } from '../stores/authStore'

const PAGES = [
  { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
  { id: 'finance', label: 'Finance', icon: '💸' },
  { id: 'calendar', label: 'Calendar', icon: '📅' },
  { id: 'wealth', label: 'Wealth', icon: '📈' },
  { id: 'networth', label: 'Net Worth', icon: '🏦' },
  { id: 'subscription', label: 'Subscriptions', icon: '📋' },
  { id: 'habit', label: 'Habits', icon: '🔥' },
  { id: 'vault', label: 'Vault', icon: '🔐' },
  { id: 'todo', label: 'Todo', icon: '✅' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
] as const

export type PageId = typeof PAGES[number]['id']

interface Props {
  activePage: PageId
  onNavigate: (page: PageId) => void
  children?: ReactNode
}

export default function Sidebar({ activePage, onNavigate, children }: Props) {
  const logout = useAuthStore((s) => s.logout)

  return (
    <aside className="w-[260px] min-w-[260px] bg-nb-yellow border-r-3 border-nb-border flex flex-col py-5 h-screen sticky top-0 overflow-y-auto z-10">
      <div className="px-5 pb-5 border-b-3 border-nb-border mb-3">
        <h1 className="text-[1.6rem] font-black tracking-tight leading-none">WOS</h1>
        <span className="inline-block mt-2 text-[0.65rem] font-bold uppercase tracking-[0.2em] opacity-70">v2.0 — Wira OS</span>
      </div>

      <nav className="flex flex-col gap-1 px-2.5 flex-1">
        {PAGES.map((p) => (
          <button
            key={p.id}
            onClick={() => onNavigate(p.id)}
            className={`flex items-center gap-3 px-3.5 py-3 font-bold text-sm uppercase tracking-wide border-2 transition-all cursor-pointer ${
              activePage === p.id
                ? 'bg-white border-nb-border shadow-nb-sm'
                : 'border-transparent hover:bg-black/10'
            }`}
          >
            <span className="text-lg w-6 text-center leading-none">{p.icon}</span>
            {p.label}
          </button>
        ))}
      </nav>

      {children}

      <div className="px-5 pt-3.5 mt-3 border-t-3 border-nb-border">
        <button
          onClick={logout}
          className="w-full text-left flex items-center gap-3 px-3.5 py-3 font-bold text-sm uppercase tracking-wide border-2 border-transparent hover:bg-black/10 transition-all cursor-pointer"
        >
          <span className="text-lg w-6 text-center leading-none">🚪</span>
          Logout
        </button>
        <div className="mt-3 text-[0.7rem] font-semibold uppercase tracking-[0.1em] opacity-50 flex items-center gap-1.5">
          Built with <span className="text-nb-red">❤️</span> by
          <a href="https://github.com/sepatusendal" target="_blank" rel="noopener noreferrer" className="inline-flex items-center hover:opacity-100 transition-opacity">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            <span className="ml-0.5">sepatusendal</span>
          </a>
        </div>
      </div>
    </aside>
  )
}
