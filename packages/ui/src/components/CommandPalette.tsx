import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { useVaultStore } from '../stores/vaultStore'
import { useFinanceStore } from '../stores/financeStore'
import { useAuthStore } from '../stores/authStore'
import { todayStr } from '@wos/shared'
import type { PageId } from './Sidebar'

// ── Page definitions ────────────────────────────────────────

const PAGES: { id: PageId; label: string; icon: string }[] = [
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
]

// ── Types ───────────────────────────────────────────────────

interface CommandResult {
  id: string
  type: 'navigate' | 'action' | 'transaction' | 'calculator' | 'info'
  label: string
  subtitle?: string
  icon: string
  action: () => void
}

interface RecentCommand {
  query: string
  label: string
}

const RECENT_KEY = 'wos_cmd_recent'
const MAX_RECENT = 5

function loadRecent(): RecentCommand[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    return JSON.parse(raw) as RecentCommand[]
  } catch {
    return []
  }
}

function saveRecent(list: RecentCommand[]) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)))
}

// ── Currency parser ─────────────────────────────────────────

/**
 * Parse Indonesian shorthand amounts like:
 *   50rb  → 50000
 *   150k  → 150000
 *   1jt   → 1000000
 *   2.5jt → 2500000
 *   5m    → 5000000000
 */
function parseAmount(raw: string): number | null {
  // Preserve decimal dots (e.g. 2.5jt → 2.5), strip comma thousands
  const cleaned = raw.replace(/,/g, '.').trim().toLowerCase()
  if (!cleaned) return null

  const match = cleaned.match(/^([\d.]+)\s*(rb|ribu|k|jt|juta|m|milyar|miliar)?$/)
  if (!match) return null

  let num = parseFloat(match[1]!)
  if (isNaN(num)) return null

  const suffix = match[2]
  if (!suffix) return num

  switch (suffix) {
    case 'k':
    case 'rb':
    case 'ribu':
      return num * 1_000
    case 'jt':
    case 'juta':
      return num * 1_000_000
    case 'm':
    case 'milyar':
    case 'miliar':
      return num * 1_000_000_000
    default:
      return num
  }
}

// ── Calculator ──────────────────────────────────────────────

/**
 * Safely evaluate a calculator expression.
 * Supports: + - * / ( ) and number shorthand (k, rb, jt, m)
 */
function evalCalc(expr: string): { result: number } | { error: string } {
  // Replace shorthands
  let sanitized = expr
    .replace(/(\d+\.?\d*)\s*(milyar|miliar)/gi, (_, n) => `${parseFloat(n) * 1_000_000_000}`)
    .replace(/(\d+\.?\d*)\s*(jt|juta)/gi, (_, n) => `${parseFloat(n) * 1_000_000}`)
    .replace(/(\d+\.?\d*)\s*(rb|ribu)/gi, (_, n) => `${parseFloat(n) * 1_000}`)
    .replace(/(\d+\.?\d*)\s*k\b/gi, (_, n) => `${parseFloat(n) * 1_000}`)
    .replace(/(\d+\.?\d*)\s*m\b/gi, (_, n) => `${parseFloat(n) * 1_000_000}`)
    .replace(/[^0-9+\-*/().%\s]/g, '')
    .trim()

  if (!sanitized) return { error: 'Masukkan ekspresi' }

  try {
    // Use Function constructor for safe evaluation (no global access)
    const result = new Function(`return (${sanitized})`)()
    if (typeof result !== 'number' || !isFinite(result)) {
      return { error: 'Hasil tidak valid' }
    }
    return { result }
  } catch {
    return { error: 'Ekspresi tidak valid' }
  }
}

// ── IDR formatter ──────────────────────────────────────────

const idrFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function formatRupiah(n: number): string {
  return idrFormatter.format(n)
}

// ── Props ───────────────────────────────────────────────────

interface Props {
  onNavigate: (page: PageId) => void
}

// ── Component ───────────────────────────────────────────────

export default function CommandPalette({ onNavigate }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentCommands, setRecentCommands] = useState<RecentCommand[]>(loadRecent)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // ── Execute helpers (defined before useMemo that references them) ──

  const addToRecent = useCallback((cmdQuery: string, label: string) => {
    setRecentCommands((prev) => {
      const next = [{ query: cmdQuery, label }, ...prev.filter((r) => r.query !== cmdQuery)]
      const trimmed = next.slice(0, MAX_RECENT)
      saveRecent(trimmed)
      return trimmed
    })
  }, [])

  const closePalette = useCallback(() => {
    setOpen(false)
    setQuery('')
    setSelectedIndex(0)
  }, [])

  const executeGo = useCallback(
    (page: PageId) => {
      const pageInfo = PAGES.find((p) => p.id === page)
      addToRecent(`go ${page}`, `Go to ${pageInfo?.label ?? page}`)
      onNavigate(page)
      closePalette()
    },
    [onNavigate, addToRecent, closePalette],
  )

  const executeLock = useCallback(() => {
    const vaultKey = useVaultStore.getState().vaultKey
    if (!vaultKey) {
      toast.info('Vault sudah terkunci')
      closePalette()
      return
    }
    useVaultStore.getState().lock()
    addToRecent('lock', 'Kunci vault')
    toast.success('Vault terkunci')
    closePalette()
  }, [addToRecent, closePalette])

  const executeAdd = useCallback(
    (amount: number, category: string) => {
      const userId = useAuthStore.getState().userId
      if (!userId) {
        toast.error('Harus login terlebih dahulu')
        closePalette()
        return
      }
      const store = useFinanceStore.getState()
      store.addTransaction(userId, {
        type: 'expense',
        amount,
        category,
        description: '',
        date: todayStr(),
        accountId: null,
        flexibility: 'flexible',
      })
      const amountStr = formatRupiah(amount)
      addToRecent(`add ${amount} ${category}`, `Transaksi: ${amountStr} · ${category}`)
      toast.success(`Transaksi dibuat: ${amountStr} · ${category}`)
      closePalette()
    },
    [addToRecent, closePalette],
  )

  const executeJournal = useCallback(() => {
    addToRecent('journal', 'Buka journal')
    toast.info('Fitur journal akan segera hadir!')
    closePalette()
  }, [addToRecent, closePalette])

  const setQueryAndFocus = useCallback((val: string) => {
    setQuery(val)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  // ── Parse query ────────────────────────────────────────

  const parsed = useMemo(() => {
    const q = query.trim()
    if (!q) return { mode: 'all' as const }

    // Match "add <amount> <category>"
    const addMatch = q.match(/^add\s+(.+)/i)
    if (addMatch) {
      const rest = addMatch[1]!.trim()
      const parts = rest.split(/\s+/)
      if (parts.length >= 1) {
        const amountRaw = parts[0]!
        const amount = parseAmount(amountRaw)
        const category = parts.slice(1).join(' ') || null
        return { mode: 'add' as const, amountRaw, amount, category }
      }
      return { mode: 'add' as const, amountRaw: rest, amount: null, category: null }
    }

    // Match "go <page>"
    const goMatch = q.match(/^go\s*(.*)/i)
    if (goMatch) {
      const search = goMatch[1]!.trim().toLowerCase()
      return { mode: 'go' as const, search }
    }

    // Match "calc <expression>"
    const calcMatch = q.match(/^calc\s+(.+)/i)
    if (calcMatch) {
      const expr = calcMatch[1]!.trim()
      const calcResult = evalCalc(expr)
      return { mode: 'calc' as const, expr, calcResult }
    }

    // Match "lock"
    if (/^lock/i.test(q)) return { mode: 'lock' as const }

    // Match "journal"
    const journalMatch = q.match(/^journal\s*(.*)/i)
    if (journalMatch) {
      return { mode: 'journal' as const, sub: journalMatch[1]!.trim() || null }
    }

    // Fuzzy fallback
    return { mode: 'search' as const }
  }, [query])

  // ── Results ─────────────────────────────────────────────

  const results = useMemo((): CommandResult[] => {
    const q = query.trim().toLowerCase()

    switch (parsed.mode) {
      case 'all': {
        const cmds: CommandResult[] = []

        // Recent commands first
        for (const rc of recentCommands) {
          cmds.push({
            id: `recent-${rc.query}`,
            type: 'info',
            label: rc.label,
            subtitle: 'Baru saja',
            icon: '🕐',
            action: () => setQueryAndFocus(rc.query),
          })
        }

        // Default suggestions
        cmds.push(
          {
            id: 'cmd-add',
            type: 'info',
            label: 'Tambah transaksi cepat',
            subtitle: 'add 50rb makan',
            icon: '💰',
            action: () => setQueryAndFocus('add '),
          },
          {
            id: 'cmd-go',
            type: 'info',
            label: 'Navigasi halaman',
            subtitle: 'go dashboard',
            icon: '🧭',
            action: () => setQueryAndFocus('go '),
          },
          {
            id: 'cmd-calc',
            type: 'info',
            label: 'Kalkulator',
            subtitle: 'calc 150k * 12',
            icon: '🔢',
            action: () => setQueryAndFocus('calc '),
          },
          {
            id: 'cmd-lock',
            type: 'action',
            label: 'Kunci vault',
            icon: '🔒',
            action: () => executeLock(),
          },
          {
            id: 'cmd-journal',
            type: 'info',
            label: 'Buka journal',
            subtitle: 'journal today',
            icon: '📓',
            action: () => executeJournal(),
          },
        )

        return cmds
      }

      case 'add': {
        const results: CommandResult[] = []
        const { amount, category } = parsed

        if (amount !== null && category) {
          const amountStr = formatRupiah(amount)
          results.push({
            id: 'add-confirm',
            type: 'transaction',
            label: `Buat transaksi: ${amountStr}`,
            subtitle: `Kategori: ${category}`,
            icon: '💸',
            action: () => executeAdd(amount, category),
          })
        } else if (amount !== null) {
          const amountStr = formatRupiah(amount)
          results.push({
            id: 'add-amount',
            type: 'info',
            label: `Jumlah: ${amountStr}`,
            subtitle: 'Tambah kategori setelah jumlah, contoh: add 50rb makan',
            icon: '💰',
            action: () => {},
          })
        } else {
          results.push({
            id: 'add-hint',
            type: 'info',
            label: 'Format: add [jumlah] [kategori]',
            subtitle: 'Contoh: add 50rb Makan Siang',
            icon: '❓',
            action: () => {},
          })
        }

        return results
      }

      case 'go': {
        const search = parsed.search
        if (!search) {
          return PAGES.map((p) => ({
            id: `go-${p.id}`,
            type: 'navigate' as const,
            label: p.label,
            icon: p.icon,
            action: () => executeGo(p.id),
          }))
        }
        const filtered = PAGES.filter(
          (p) =>
            p.label.toLowerCase().includes(search) ||
            p.id.toLowerCase().includes(search),
        )
        if (filtered.length === 0) {
          return [
            {
              id: 'go-none',
              type: 'info',
              label: `Halaman "${search}" tidak ditemukan`,
              icon: '❓',
              action: () => {},
            },
          ]
        }
        return filtered.map((p) => ({
          id: `go-${p.id}`,
          type: 'navigate' as const,
          label: p.label,
          icon: p.icon,
          action: () => executeGo(p.id),
        }))
      }

      case 'calc': {
        const { expr, calcResult } = parsed
        if ('result' in calcResult) {
          const formatted = formatRupiah(calcResult.result)
          return [
            {
              id: 'calc-result',
              type: 'calculator',
              label: `${expr} = ${formatted}`,
              subtitle: `Hasil: ${calcResult.result.toLocaleString('id-ID')}`,
              icon: '🔢',
              action: () => {},
            },
          ]
        }
        return [
          {
            id: 'calc-error',
            type: 'info',
            label: calcResult.error,
            subtitle: 'Coba: calc 150k * 12',
            icon: '⚠️',
            action: () => {},
          },
        ]
      }

      case 'lock': {
        return [
          {
            id: 'lock-action',
            type: 'action',
            label: 'Kunci vault',
            subtitle: 'Semua data vault akan terkunci',
            icon: '🔒',
            action: () => executeLock(),
          },
        ]
      }

      case 'journal': {
        return [
          {
            id: 'journal-action',
            type: 'action',
            label: parsed.sub ? `Buka journal: ${parsed.sub}` : 'Buka journal',
            subtitle: 'Fitur journal akan segera hadir',
            icon: '📓',
            action: () => executeJournal(),
          },
        ]
      }

      case 'search': {
        const results: CommandResult[] = []

        for (const p of PAGES) {
          if (p.label.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)) {
            results.push({
              id: `go-${p.id}`,
              type: 'navigate',
              label: `Go to ${p.label}`,
              icon: p.icon,
              action: () => executeGo(p.id),
            })
          }
        }

        if ('lock'.includes(q) || 'kunci'.includes(q)) {
          results.push({
            id: 'lock-action',
            type: 'action',
            label: 'Kunci vault',
            icon: '🔒',
            action: () => executeLock(),
          })
        }

        if ('journal'.includes(q) || 'catatan'.includes(q)) {
          results.push({
            id: 'journal-action',
            type: 'action',
            label: 'Buka journal',
            icon: '📓',
            action: () => executeJournal(),
          })
        }

        if ('add'.includes(q) || 'tambah'.includes(q) || 'transaksi'.includes(q)) {
          results.push({
            id: 'add-hint',
            type: 'info',
            label: 'Tambah transaksi: add [jumlah] [kategori]',
            icon: '💰',
            action: () => setQueryAndFocus('add '),
          })
        }

        if ('calc'.includes(q) || 'kalkulator'.includes(q) || 'hitung'.includes(q)) {
          results.push({
            id: 'calc-hint',
            type: 'info',
            label: 'Kalkulator: calc [ekspresi]',
            icon: '🔢',
            action: () => setQueryAndFocus('calc '),
          })
        }

        if (results.length === 0) {
          return [
            {
              id: 'no-results',
              type: 'info',
              label: 'Tidak ada perintah yang cocok',
              icon: '🔍',
              action: () => {},
            },
          ]
        }

        return results
      }
    }
  }, [parsed, query, recentCommands, executeGo, executeLock, executeAdd, executeJournal, setQueryAndFocus])

  const executeSelected = useCallback(() => {
    if (results.length === 0) return
    const sel = results[Math.min(selectedIndex, results.length - 1)]
    if (!sel) return
    sel.action()
  }, [results, selectedIndex])

  // ── Keyboard ────────────────────────────────────────────

  useEffect(() => {
    if (!open) return

    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          closePalette()
          break
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => {
            const next = prev + 1
            return next >= results.length ? 0 : next
          })
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => {
            const next = prev - 1
            return next < 0 ? results.length - 1 : next
          })
          break
        case 'Enter':
          e.preventDefault()
          executeSelected()
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, results.length, executeSelected, closePalette])

  // Scroll selected into view
  useEffect(() => {
    if (!listRef.current) return
    const item = listRef.current.children[selectedIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  // Focus input on open
  useEffect(() => {
    if (open) {
      setSelectedIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Reset selected when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [results.length])

  // ── Expose open/close via global shortcut ───────────────

  const toggleOpen = useCallback(() => {
    setOpen((prev) => !prev)
  }, [])

  // Expose via window for AppLayout Cmd+K handler
  useEffect(() => {
    ;(window as any).__wosCommandPalette = { toggle: toggleOpen }
    return () => {
      delete (window as any).__wosCommandPalette
    }
  }, [toggleOpen])

  // ── Render ──────────────────────────────────────────────

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center"
      style={{ background: 'rgba(11, 11, 11, 0.6)' }}
      onClick={closePalette}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="mt-[15vh] w-full max-w-[550px] mx-4 h-fit"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panel */}
        <div className="bg-white border-4 border-nb-border shadow-nb-lg animate-slide-up">
          {/* Search input */}
          <div className="flex items-center border-b-3 border-nb-border">
            <span className="pl-4 text-lg text-nb-fg-muted select-none font-mono font-bold">
              ⌘
            </span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ketik perintah..."
              className="w-full p-4 text-lg font-mono font-bold bg-transparent text-nb-fg placeholder:text-nb-fg-muted/50 focus:outline-none"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {/* Calculator result (shown above list) */}
          {parsed.mode === 'calc' && 'result' in parsed.calcResult && (
            <div className="px-4 py-3 bg-nb-yellow/20 border-b-3 border-nb-border">
              <span className="text-xs font-bold uppercase tracking-wider text-nb-fg-muted">
                Hasil kalkulasi
              </span>
              <div className="font-mono font-bold text-lg text-nb-fg mt-0.5">
                {formatRupiah(parsed.calcResult.result)}
              </div>
            </div>
          )}

          {/* Results list */}
          <div
            ref={listRef}
            className="max-h-[300px] overflow-y-auto"
          >
            {results.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm font-bold uppercase tracking-wide text-nb-fg-muted">
                Tidak ada perintah yang cocok
              </div>
            ) : (
              results.map((item, i) => (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.type === 'calculator') return
                    item.action()
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 border-b-2 border-nb-border/20 text-left font-bold text-sm uppercase tracking-wide transition-colors cursor-pointer ${
                    i === selectedIndex
                      ? 'bg-nb-yellow/20'
                      : 'hover:bg-nb-yellow/10'
                  }`}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <span className="text-lg w-7 text-center leading-none flex-shrink-0">
                    {item.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{item.label}</div>
                    {item.subtitle && (
                      <div className="text-xs text-nb-fg-muted font-medium normal-case tracking-normal mt-0.5 truncate">
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                  {item.type === 'navigate' && (
                    <span className="text-nb-fg-muted text-xs font-mono">GO</span>
                  )}
                  {item.type === 'transaction' && (
                    <span className="text-nb-green text-xs font-mono font-bold">ADD</span>
                  )}
                  {item.type === 'action' && (
                    <span className="text-nb-blue text-xs font-mono font-bold">RUN</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between px-1 mt-2 text-[0.65rem] font-bold uppercase tracking-wider text-white/60">
          <div className="flex gap-4">
            <span>↑↓ Navigasi</span>
            <span>↵ Pilih</span>
            <span>Esc Tutup</span>
          </div>
          <span>⌘K</span>
        </div>
      </div>
    </div>
  )
}
