import { useEffect, useMemo, useState } from 'react'
import { useSubscriptionStore } from '../../stores/subscriptionStore'
import { useAuthStore } from '../../stores/authStore'
import { NeubruBtn, NeubruCard, NeubruInput, NeubruSelect, NeubruModal, NeubruTag } from '../../components'
import { formatShortDate } from '@wos/shared'
import { useFormatCurrency } from '../../stores/useFormatCurrency'
import type { Subscription, SubscriptionCategory, SubscriptionFrequency } from '@wos/shared'
import { toast } from 'sonner'

const CATEGORIES: { value: SubscriptionCategory; label: string }[] = [
  { value: 'streaming', label: '🎬 Streaming' },
  { value: 'music', label: '🎵 Music' },
  { value: 'cloud', label: '☁️ Cloud' },
  { value: 'hosting', label: '🖥️ Hosting' },
  { value: 'software', label: '💻 Software' },
  { value: 'gaming', label: '🎮 Gaming' },
  { value: 'fitness', label: '💪 Fitness' },
  { value: 'news', label: '📰 News' },
  { value: 'other', label: '📦 Other' },
]

const CATEGORY_COLORS: Record<string, 'yellow' | 'blue' | 'green' | 'pink' | 'orange' | 'purple' | 'red'> = {
  streaming: 'pink',
  music: 'purple',
  cloud: 'blue',
  hosting: 'orange',
  software: 'green',
  gaming: 'red',
  fitness: 'yellow',
  news: 'blue',
  other: 'yellow',
}

const FREQUENCIES: { value: SubscriptionFrequency; label: string }[] = [
  { value: 'weekly', label: 'Mingguan' },
  { value: 'monthly', label: 'Bulanan' },
  { value: 'yearly', label: 'Tahunan' },
]

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Mingguan',
  monthly: 'Bulanan',
  yearly: 'Tahunan',
}

const ICON_OPTIONS = ['📺', '🎬', '🎵', '🎧', '☁️', '🖥️', '🎮', '💪', '📰', '📦', '🎨', '📚', '🔒', '💬', '📱', '🛒']

/** Whole days a billing date is past due (0 if not overdue). Date-only math, no timezone drift. */
function daysOverdue(nextBilling: string, today: string): number {
  if (nextBilling >= today) return 0
  const n = nextBilling.split('-')
  const t = today.split('-')
  const diff =
    Date.UTC(Number(t[0]), Number(t[1]) - 1, Number(t[2])) -
    Date.UTC(Number(n[0]), Number(n[1]) - 1, Number(n[2]))
  return Math.max(0, Math.round(diff / 86_400_000))
}

export default function SubscriptionPage() {
  const userId = useAuthStore((s) => s.userId)
  const formatCurrency = useFormatCurrency()
  const { subscriptions, fetchAll, addSubscription, editSubscription, deleteSubscription, toggleActive, getMonthlyTotal } = useSubscriptionStore()
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<SubscriptionCategory>('streaming')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<SubscriptionFrequency>('monthly')
  const [nextBilling, setNextBilling] = useState('')
  const [icon, setIcon] = useState('📺')
  const [notes, setNotes] = useState('')
  const [activeFilter, setActiveFilter] = useState<SubscriptionCategory | 'all'>('all')

  useEffect(() => {
    if (userId) fetchAll(userId)
  }, [userId, fetchAll])

  const monthlyTotal = useMemo(() => getMonthlyTotal(), [subscriptions, getMonthlyTotal])
  const activeSubs = useMemo(() => subscriptions.filter((s) => s.active), [subscriptions])
  const activeCount = activeSubs.length

  const today = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }, [])

  // Overdue bills sort first — a past-due subscription must be surfaced, not
  // silently dropped from the "upcoming" view like it used to be.
  const soonestBilling = useMemo(() => {
    const sorted = [...activeSubs].sort((a, b) => a.nextBilling.localeCompare(b.nextBilling))
    return sorted.length > 0 ? sorted[0] : null
  }, [activeSubs])

  const soonestOverdueDays = soonestBilling ? daysOverdue(soonestBilling.nextBilling, today) : 0

  const filteredSubs = useMemo(() => {
    if (activeFilter === 'all') return subscriptions
    return subscriptions.filter((s) => s.category === activeFilter)
  }, [subscriptions, activeFilter])

  const openAdd = () => {
    setEditId(null)
    setName('')
    setCategory('streaming')
    setAmount('')
    setFrequency('monthly')
    setNextBilling('')
    setIcon('📺')
    setNotes('')
    setShowModal(true)
  }

  const openEdit = (s: Subscription) => {
    setEditId(s.id)
    setName(s.name)
    setCategory(s.category)
    setAmount(String(s.amount))
    setFrequency(s.frequency)
    setNextBilling(s.nextBilling)
    setIcon(s.icon)
    setNotes(s.notes)
    setShowModal(true)
  }

  const save = async () => {
    const numAmount = Number(amount)
    if (!userId || !name || !amount || !nextBilling) return
    if (isNaN(numAmount) || numAmount <= 0) { toast.error('Jumlah harus lebih dari 0'); return }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextBilling)) { toast.error('Format tanggal tidak valid'); return }
    const data = {
      name,
      category,
      amount: numAmount,
      frequency,
      nextBilling,
      icon,
      active: editId ? subscriptions.find((s) => s.id === editId)?.active ?? true : true,
      notes,
    }
    try {
      if (editId) {
        await editSubscription({ id: editId, ...data })
        toast.success('Subscription berhasil diupdate!')
      } else {
        await addSubscription(userId, data)
        toast.success('Subscription berhasil ditambahkan!')
      }
      setShowModal(false)
    } catch {
      toast.error('Gagal menyimpan subscription')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteSubscription(id)
      toast.success('Subscription berhasil dihapus!')
    } catch {
      toast.error('Gagal menghapus subscription')
    }
  }

  const handleToggle = async (id: string, active: boolean) => {
    try {
      await toggleActive(id, active)
      toast.success(active ? 'Subscription diaktifkan!' : 'Subscription dinonaktifkan!')
    } catch {
      toast.error('Gagal mengubah status subscription')
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-7 gap-4 flex-wrap">
        <h2 className="text-[1.8rem]">📋 Subscriptions</h2>
        <NeubruBtn color="blue" onClick={openAdd}>+ Subscription</NeubruBtn>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5 mb-7">
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Total Bulanan</div>
          <div className="text-nb-green font-mono text-xl font-extrabold">{formatCurrency(monthlyTotal)}</div>
          <div className="text-xs text-nb-fg-muted mt-1 font-medium">/ bulan</div>
          <div className="text-[0.65rem] text-nb-fg-muted mt-1.5 leading-snug">
            Estimasi dari data langganan — transaksi aktual mungkin berbeda kalau harga sudah berubah.
          </div>
        </NeubruCard>
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Subscription Aktif</div>
          <div className="font-mono text-xl font-extrabold">{activeCount}</div>
          <div className="text-xs text-nb-fg-muted mt-1 font-medium">dari {subscriptions.length} total</div>
        </NeubruCard>
        {soonestBilling && (
          <NeubruCard>
            <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">
              {soonestOverdueDays > 0 ? 'Tagihan Terlambat' : 'Tagihan Terdekat'}
            </div>
            <div className="font-mono text-lg font-extrabold">{soonestBilling.name}</div>
            {soonestOverdueDays > 0 ? (
              <div className="text-xs text-nb-red mt-1 font-bold">
                ⚠️ Terlambat {soonestOverdueDays} hari — {formatCurrency(soonestBilling.amount)}
              </div>
            ) : (
              <div className="text-xs text-nb-fg-muted mt-1 font-medium">{formatShortDate(soonestBilling.nextBilling)} — {formatCurrency(soonestBilling.amount)}</div>
            )}
          </NeubruCard>
        )}
      </div>

      {/* Category Filter Chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => setActiveFilter('all')}
          className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 border-2 border-nb-border transition-all cursor-pointer ${
            activeFilter === 'all' ? 'bg-nb-yellow shadow-nb-sm' : 'bg-white hover:bg-nb-yellow/30'
          }`}
        >
          Semua
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setActiveFilter(cat.value)}
            className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 border-2 border-nb-border transition-all cursor-pointer ${
              activeFilter === cat.value ? 'bg-nb-yellow shadow-nb-sm' : 'bg-white hover:bg-nb-yellow/30'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Subscription Cards Grid */}
      {filteredSubs.length === 0 ? (
        <div className="nb-panel text-center py-16">
          <div className="text-5xl mb-3">📋</div>
          <div className="font-bold uppercase text-nb-fg-muted">Belum ada subscription</div>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
          {filteredSubs.map((s) => (
            <div key={s.id} className={`nb-card ${!s.active ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{s.icon}</span>
                  <div>
                    <div className="font-bold text-base">{s.name}</div>
                    <div className="text-xs text-nb-fg-muted mt-0.5">
                      <NeubruTag label={s.category} color={CATEGORY_COLORS[s.category] || 'yellow'} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <NeubruBtn size="sm" color="yellow" className="nb-btn-icon" onClick={() => openEdit(s)}>✎</NeubruBtn>
                  <NeubruBtn size="sm" color="red" className="nb-btn-icon" onClick={() => handleDelete(s.id)}>✕</NeubruBtn>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="nb-tag bg-nb-blue">{FREQUENCY_LABELS[s.frequency] || s.frequency}</span>
                <span className="font-mono font-extrabold text-lg">{formatCurrency(s.amount)}</span>
              </div>

              {s.active && daysOverdue(s.nextBilling, today) > 0 ? (
                <div className="text-xs mb-3">
                  <span className="nb-tag bg-nb-red text-white">⚠️ Terlambat {daysOverdue(s.nextBilling, today)} hari</span>
                  <span className="text-nb-fg-muted ml-2">jatuh tempo {formatShortDate(s.nextBilling)}</span>
                </div>
              ) : (
                <div className="text-xs text-nb-fg-muted mb-3">
                  Tagihan berikutnya: <span className="font-bold">{formatShortDate(s.nextBilling)}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t-2 border-nb-border">
                <span className="text-xs font-bold uppercase tracking-wider text-nb-fg-muted">
                  {s.active ? '🟢 Aktif' : '⚫ Nonaktif'}
                </span>
                <NeubruBtn
                  size="sm"
                  color={s.active ? 'red' : 'green'}
                  onClick={() => handleToggle(s.id, !s.active)}
                >
                  {s.active ? 'Nonaktifkan' : 'Aktifkan'}
                </NeubruBtn>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <NeubruModal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editId ? 'Edit Subscription' : 'Tambah Subscription'}
      >
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Nama</label>
          <NeubruInput value={name} onChange={setName} placeholder="Netflix, Spotify, AWS..." />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Kategori</label>
            <NeubruSelect value={category} onChange={(v) => setCategory(v as SubscriptionCategory)} options={CATEGORIES} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Frekuensi</label>
            <NeubruSelect value={frequency} onChange={(v) => setFrequency(v as SubscriptionFrequency)} options={FREQUENCIES} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Jumlah (Rp)</label>
            <NeubruInput value={amount} onChange={setAmount} placeholder="100000" type="number" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Tagihan Berikutnya</label>
            <NeubruInput value={nextBilling} onChange={setNextBilling} placeholder="2026-08-15" type="date" />
          </div>
        </div>

        {/* Icon Emoji Picker */}
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Ikon</label>
          <div className="grid grid-cols-8 gap-2">
            {ICON_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setIcon(emoji)}
                className={`text-2xl p-2 border-2 transition-all cursor-pointer ${
                  icon === emoji
                    ? 'border-nb-border bg-nb-yellow shadow-nb-sm'
                    : 'border-transparent hover:bg-nb-yellow/30 hover:border-nb-border'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Catatan</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opsional..." rows={3} className="border-2 border-nb-border bg-white px-3 py-2 text-sm font-medium outline-none resize-y w-full" style={{ fontFamily: "inherit" }} />
        </div>

        <NeubruBtn color="blue" onClick={save}>💾 Simpan</NeubruBtn>
      </NeubruModal>
    </div>
  )
}
