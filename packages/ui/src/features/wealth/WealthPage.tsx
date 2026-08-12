import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useWealthStore } from '../../stores/wealthStore'
import { useLiabilityStore } from '../../stores/liabilityStore'
import { useNetWorthStore } from '../../stores/netWorthStore'
import { useAuthStore } from '../../stores/authStore'
import { NeubruBtn, NeubruCard, NeubruInput, NeubruSelect, NeubruModal, NeubruTag } from '../../components'
import { formatDate } from '@wos/shared'
import { useFormatCurrency } from '../../stores/useFormatCurrency'
import type { Asset, AssetType, Liability, LiabilityType } from '@wos/shared'

const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: 'stock', label: '📊 Saham' }, { value: 'crypto', label: '🪙 Crypto' },
  { value: 'real-estate', label: '🏠 Properti' }, { value: 'cash', label: '💵 Cash' },
  { value: 'bonds', label: '📋 Obligasi' }, { value: 'other', label: '📦 Lainnya' },
]
const TYPE_COLORS: Record<string, 'yellow' | 'blue' | 'green' | 'pink' | 'orange' | 'purple'> = {
  stock: 'blue', crypto: 'orange', 'real-estate': 'green', cash: 'yellow', bonds: 'purple', other: 'yellow',
}
const LIABILITY_TYPES: { value: LiabilityType; label: string }[] = [
  { value: 'mortgage', label: '🏠 KPR' }, { value: 'loan', label: '💳 Pinjaman' },
  { value: 'credit_card', label: '💳 Kartu Kredit' }, { value: 'other', label: '📦 Lainnya' },
]

export default function WealthPage() {
  const userId = useAuthStore((s) => s.userId)
  const formatCurrency = useFormatCurrency()
  const { assets, fetchAll: fetchAssets, addAsset, editAsset, deleteAsset, getPortfolioStats, refreshPrices, refreshingPrices } = useWealthStore()
  const { liabilities, fetchAll: fetchLiabilities, addLiability, editLiability, deleteLiability } = useLiabilityStore()
  const { entries, fetchAll: fetchNetWorth, ensureTodaySnapshot } = useNetWorthStore()

  const [showAssetModal, setShowAssetModal] = useState(false)
  const [editAssetId, setEditAssetId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState<AssetType>('stock')
  const [ticker, setTicker] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [buyPrice, setBuyPrice] = useState('')
  const [buyDate, setBuyDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const [showLiabModal, setShowLiabModal] = useState(false)
  const [editLiabId, setEditLiabId] = useState<string | null>(null)
  const [liabName, setLiabName] = useState('')
  const [liabType, setLiabType] = useState<LiabilityType>('loan')
  const [liabAmount, setLiabAmount] = useState('')
  const [liabNotes, setLiabNotes] = useState('')
  const [liabSaving, setLiabSaving] = useState(false)

  useEffect(() => {
    if (!userId) return
    fetchAssets(userId)
    fetchLiabilities(userId)
    fetchNetWorth(userId)
  }, [userId, fetchAssets, fetchLiabilities, fetchNetWorth])

  const totalAssetValue = useMemo(() => assets.reduce((s, a) => s + a.quantity * a.unitPrice, 0), [assets])
  const totalLiabilityValue = useMemo(() => liabilities.reduce((s, l) => s + l.amount, 0), [liabilities])
  const netWorth = totalAssetValue - totalLiabilityValue

  const stats = useMemo(() => getPortfolioStats(), [assets, getPortfolioStats])

  const allocPercentages = useMemo(() => {
    const map: Record<string, number> = {}
    let total = 0
    assets.forEach((a) => { const v = a.quantity * a.unitPrice; map[a.type] = (map[a.type] || 0) + v; total += v })
    if (total === 0) return []
    return Object.entries(map).map(([t, v]) => ({ type: t, percent: (v / total) * 100, value: v })).sort((a, b) => b.percent - a.percent)
  }, [assets])

  // Auto-snapshot today's net worth (once) from live assets+liabilities —
  // replaces the old manual "type in your net worth" entry form entirely.
  useEffect(() => {
    if (!userId) return
    if (assets.length === 0 && liabilities.length === 0) return
    const cash = assets.filter((a) => a.type === 'cash').reduce((s, a) => s + a.quantity * a.unitPrice, 0)
    const investments = assets.filter((a) => a.type === 'stock' || a.type === 'crypto' || a.type === 'bonds').reduce((s, a) => s + a.quantity * a.unitPrice, 0)
    const property = assets.filter((a) => a.type === 'real-estate').reduce((s, a) => s + a.quantity * a.unitPrice, 0)
    const otherAssets = assets.filter((a) => a.type === 'other').reduce((s, a) => s + a.quantity * a.unitPrice, 0)
    const mortgage = liabilities.filter((l) => l.type === 'mortgage').reduce((s, l) => s + l.amount, 0)
    const loans = liabilities.filter((l) => l.type === 'loan').reduce((s, l) => s + l.amount, 0)
    const creditCards = liabilities.filter((l) => l.type === 'credit_card').reduce((s, l) => s + l.amount, 0)
    const otherLiabilities = liabilities.filter((l) => l.type === 'other').reduce((s, l) => s + l.amount, 0)
    ensureTodaySnapshot(userId, {
      totalAssets: totalAssetValue, totalLiabilities: totalLiabilityValue, netWorth,
      cash, investments, property, otherAssets, mortgage, loans, creditCards, otherLiabilities,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, assets, liabilities])

  const chartItems = useMemo(() => {
    const latest = entries[0]
    if (!latest) return []
    return [
      { label: 'Cash', value: latest.cash, color: '#ffd800' },
      { label: 'Investasi', value: latest.investments, color: '#2f6bff' },
      { label: 'Properti', value: latest.property, color: '#22c55e' },
      { label: 'Aset Lain', value: latest.otherAssets, color: '#8b5cf6' },
      { label: 'KPR', value: -latest.mortgage, color: '#ff4b4b' },
      { label: 'Pinjaman', value: -latest.loans, color: '#ff8a00' },
      { label: 'Kartu Kredit', value: -latest.creditCards, color: '#ff5c8a' },
      { label: 'Liab Lain', value: -latest.otherLiabilities, color: '#ff4b4b' },
    ].filter((i) => i.value !== 0)
  }, [entries])

  const openAddAsset = () => { setEditAssetId(null); setName(''); setType('stock'); setTicker(''); setQuantity(''); setUnitPrice(''); setBuyPrice(''); setBuyDate(''); setNotes(''); setShowAssetModal(true) }
  const openEditAsset = (a: Asset) => { setEditAssetId(a.id); setName(a.name); setType(a.type); setTicker(a.ticker ?? ''); setQuantity(String(a.quantity)); setUnitPrice(String(a.unitPrice)); setBuyPrice(a.buyPrice != null ? String(a.buyPrice) : ''); setBuyDate(a.buyDate ?? ''); setNotes(a.notes ?? ''); setShowAssetModal(true) }

  const saveAsset = async () => {
    if (!userId || !name || saving) return
    const numQuantity = Number(quantity)
    if (isNaN(numQuantity) || numQuantity <= 0) { toast.error('Jumlah harus lebih dari 0'); return }
    const numUnitPrice = Number(unitPrice)
    if (isNaN(numUnitPrice) || numUnitPrice <= 0) { toast.error('Harga satuan harus lebih dari 0'); return }
    setSaving(true)
    try {
      const bp = buyPrice ? Number(buyPrice) : null
      const bd = buyDate || null
      const tk = (type === 'stock' || type === 'crypto') && ticker.trim() ? ticker.trim().toUpperCase() : null
      if (editAssetId) {
        await editAsset({ id: editAssetId, name, type, quantity: numQuantity, unitPrice: numUnitPrice, notes, buyPrice: bp, buyDate: bd, ticker: tk })
      } else {
        await addAsset(userId, { name, type, quantity: numQuantity, unitPrice: numUnitPrice, buyPrice: bp, buyDate: bd, ticker: tk, notes } as any)
      }
      setShowAssetModal(false)
    } finally { setSaving(false) }
  }

  const openAddLiab = () => { setEditLiabId(null); setLiabName(''); setLiabType('loan'); setLiabAmount(''); setLiabNotes(''); setShowLiabModal(true) }
  const openEditLiab = (l: Liability) => { setEditLiabId(l.id); setLiabName(l.name); setLiabType(l.type); setLiabAmount(String(l.amount)); setLiabNotes(l.notes ?? ''); setShowLiabModal(true) }

  const saveLiability = async () => {
    if (!userId || !liabName || liabSaving) return
    const numAmount = Number(liabAmount)
    if (isNaN(numAmount) || numAmount <= 0) { toast.error('Jumlah harus lebih dari 0'); return }
    setLiabSaving(true)
    try {
      if (editLiabId) {
        await editLiability({ id: editLiabId, name: liabName, type: liabType, amount: numAmount, notes: liabNotes })
      } else {
        await addLiability(userId, { name: liabName, type: liabType, amount: numAmount, notes: liabNotes })
      }
      setShowLiabModal(false)
    } finally { setLiabSaving(false) }
  }

  const handleRefreshPrices = async () => {
    const hasTickers = assets.some((a) => a.ticker && (a.type === 'stock' || a.type === 'crypto'))
    if (!hasTickers) { toast.info('Tidak ada aset dengan ticker — isi field Ticker di aset saham/crypto untuk pakai harga live'); return }
    const { updated, failed } = await refreshPrices()
    if (updated > 0) toast.success(`${updated} harga aset diperbarui${failed > 0 ? `, ${failed} gagal` : ''}`)
    else toast.error('Gagal mengambil harga terbaru')
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-7 gap-4 flex-wrap">
        <h2 className="text-[1.8rem]">💰 Wealth</h2>
        <div className="flex gap-2 flex-wrap">
          <NeubruBtn color="yellow" onClick={handleRefreshPrices} disabled={refreshingPrices}>{refreshingPrices ? '⏳ Refreshing...' : '🔄 Refresh Harga'}</NeubruBtn>
          <NeubruBtn color="red" onClick={openAddLiab}>+ Liability</NeubruBtn>
          <NeubruBtn color="blue" onClick={openAddAsset}>+ Aset</NeubruBtn>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5 mb-7">
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Net Worth</div>
          <div className={`font-mono text-2xl font-extrabold ${netWorth >= 0 ? 'text-nb-green' : 'text-nb-red'}`}>{formatCurrency(netWorth)}</div>
          <div className="text-xs text-nb-fg-muted mt-1 font-medium">Aset − Liability, live</div>
        </NeubruCard>
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Total Aset</div>
          <div className="text-nb-green font-mono text-xl font-extrabold">{formatCurrency(totalAssetValue)}</div>
          <div className="text-xs text-nb-fg-muted mt-1 font-medium">{assets.length} aset</div>
        </NeubruCard>
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Total Liability</div>
          <div className="text-nb-red font-mono text-xl font-extrabold">{formatCurrency(totalLiabilityValue)}</div>
          <div className="text-xs text-nb-fg-muted mt-1 font-medium">{liabilities.length} liability</div>
        </NeubruCard>
        {stats.totalInvested > 0 && (
          <NeubruCard>
            <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">P&L</div>
            <div className={`font-mono text-xl font-extrabold ${stats.totalPnL >= 0 ? 'text-nb-green' : 'text-nb-red'}`}>
              {stats.totalPnL >= 0 ? '+' : ''}{formatCurrency(stats.totalPnL)}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`nb-tag text-[0.65rem] font-bold px-1.5 py-0.5 ${stats.pnlPercent >= 0 ? 'bg-nb-green' : 'bg-nb-red'}`}>
                {stats.pnlPercent >= 0 ? '+' : ''}{stats.pnlPercent.toFixed(1)}%
              </span>
              <span className="text-xs text-nb-fg-muted font-medium">dari invested</span>
            </div>
          </NeubruCard>
        )}
      </div>

      {allocPercentages.length > 0 && (
        <div className="mb-7">
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-3">Alokasi Aset</div>
          <div className="flex h-5 rounded-sm overflow-hidden border-nb bg-white">
            {allocPercentages.map((ap) => (
              <div
                key={ap.type}
                className="h-full transition-all duration-300"
                style={{ width: `${Math.max(ap.percent, 2)}%`, backgroundColor: `var(--color-nb-${TYPE_COLORS[ap.type] || 'yellow'})` }}
                title={`${ap.type}: ${ap.percent.toFixed(1)}%`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {allocPercentages.map((ap) => (
              <div key={ap.type} className="flex items-center gap-1.5 text-xs font-medium">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: `var(--color-nb-${TYPE_COLORS[ap.type] || 'yellow'})` }} />
                <span className="text-nb-fg-muted">{ASSET_TYPES.find((t) => t.value === ap.type)?.label || ap.type}</span>
                <span className="font-bold">{ap.percent.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <h3 className="mb-3">📊 Aset</h3>
      <div className="flex flex-col gap-2.5 mb-8">
        {assets.length === 0 ? (
          <div className="nb-panel text-center py-16"><div className="text-5xl mb-3">📊</div><div className="font-bold uppercase text-nb-fg-muted">Belum ada aset</div></div>
        ) : assets.map((a) => {
          const currentValue = a.quantity * a.unitPrice
          const hasPnL = a.buyPrice != null
          const pnlPerUnit = hasPnL ? a.unitPrice - a.buyPrice! : 0
          const pnlTotal = hasPnL ? (a.unitPrice - a.buyPrice!) * a.quantity : 0
          const pnlPct = hasPnL && (a.buyPrice != null && a.buyPrice > 0) ? ((a.unitPrice - a.buyPrice) / a.buyPrice) * 100 : 0
          const isProfit = pnlPerUnit >= 0
          return (
          <div key={a.id} className="nb-list-item">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{ASSET_TYPES.find((t) => t.value === a.type)?.label.split(' ')[0] || '📦'}</span>
              <div>
                <div className="font-bold">{a.name} {a.ticker && <span className="text-nb-fg-muted font-mono text-xs">({a.ticker})</span>}</div>
                <div className="text-xs text-nb-fg-muted flex gap-2 items-center mt-0.5 flex-wrap">
                  <NeubruTag label={a.type} color={TYPE_COLORS[a.type] || 'yellow'} />
                  {a.quantity} × {formatCurrency(a.unitPrice)}
                  {hasPnL && (
                    <span className={`font-bold ${isProfit ? 'text-nb-green' : 'text-nb-red'}`}>
                      {isProfit ? '+' : ''}{formatCurrency(pnlPerUnit)}
                      {' '}({isProfit ? '+' : ''}{pnlPct.toFixed(1)}%)
                    </span>
                  )}
                </div>
                {a.buyDate && (
                  <div className="text-[0.65rem] text-nb-fg-muted mt-0.5">📅 Beli: {formatDate(a.buyDate)}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <span className="font-mono font-extrabold">{formatCurrency(currentValue)}</span>
                {hasPnL && (
                  <div className={`text-xs font-bold ${isProfit ? 'text-nb-green' : 'text-nb-red'}`}>
                    {pnlTotal >= 0 ? '+' : ''}{formatCurrency(pnlTotal)}
                  </div>
                )}
              </div>
              <NeubruBtn size="sm" color="yellow" className="nb-btn-icon" onClick={() => openEditAsset(a)}>✎</NeubruBtn>
              <NeubruBtn size="sm" color="red" className="nb-btn-icon" onClick={() => deleteAsset(a.id)}>✕</NeubruBtn>
            </div>
          </div>
        )})}
      </div>

      <h3 className="mb-3">💳 Liability</h3>
      <div className="flex flex-col gap-2.5 mb-8">
        {liabilities.length === 0 ? (
          <div className="nb-panel text-center py-10"><div className="text-4xl mb-2">💳</div><div className="font-bold uppercase text-nb-fg-muted text-sm">Belum ada liability</div></div>
        ) : liabilities.map((l) => (
          <div key={l.id} className="nb-list-item">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{LIABILITY_TYPES.find((t) => t.value === l.type)?.label.split(' ')[0] || '📦'}</span>
              <div>
                <div className="font-bold">{l.name}</div>
                <div className="text-xs text-nb-fg-muted"><NeubruTag label={l.type.replace('_', ' ')} color="red" /></div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-extrabold text-nb-red">{formatCurrency(l.amount)}</span>
              <NeubruBtn size="sm" color="yellow" className="nb-btn-icon" onClick={() => openEditLiab(l)}>✎</NeubruBtn>
              <NeubruBtn size="sm" color="red" className="nb-btn-icon" onClick={() => deleteLiability(l.id)}>✕</NeubruBtn>
            </div>
          </div>
        ))}
      </div>

      {chartItems.length > 0 && (
        <div className="mb-7">
          <h3 className="mb-3">Breakdown</h3>
          <div className="flex flex-col gap-2">
            {chartItems.map((item) => {
              const max = Math.max(...chartItems.map((i) => Math.abs(i.value)), 1)
              return (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="w-[110px] font-bold text-sm text-right">{item.label}</span>
                  <div className="flex-1 h-6 bg-nb-bg border-2 border-nb-border overflow-hidden">
                    <div className="h-full min-w-1" style={{ width: `${(Math.abs(item.value) / max) * 100}%`, background: item.color }} />
                  </div>
                  <span className="font-mono font-bold text-sm w-[120px]">{formatCurrency(item.value)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {entries.length > 1 && (
        <div>
          <h3 className="mb-3">Riwayat Net Worth</h3>
          <p className="text-xs text-nb-fg-muted mb-3">Snapshot otomatis 1×/hari dari nilai aset &amp; liability live — bukan input manual.</p>
          <div className="flex flex-col gap-2.5">
            {entries.slice(1, 13).map((e, i) => {
              const prev = entries[i + 2]
              const change = prev ? e.netWorth - prev.netWorth : 0
              return (
                <div key={e.id} className="nb-list-item">
                  <div>
                    <div className="font-bold">{formatDate(e.date ?? '')}</div>
                    <div className="text-xs text-nb-fg-muted">Aset: {formatCurrency(e.totalAssets)} · Liab: {formatCurrency(e.totalLiabilities)}</div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div className="font-mono font-extrabold">{formatCurrency(e.netWorth)}</div>
                    {prev && <div className={`text-xs font-bold ${change >= 0 ? 'text-nb-green' : 'text-nb-red'}`}>{change >= 0 ? '↗' : '↘'} {formatCurrency(Math.abs(change))}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <NeubruModal open={showAssetModal} onClose={() => setShowAssetModal(false)} title={editAssetId ? 'Edit Aset' : 'Tambah Aset'}>
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Nama Aset</label>
          <NeubruInput value={name} onChange={setName} placeholder="Bitcoin, Apple Inc, Rumah..." onKeyDown={(e) => e.key === 'Enter' && saveAsset()} />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Tipe</label>
            <NeubruSelect value={type} onChange={(v) => setType(v as AssetType)} options={ASSET_TYPES} />
          </div>
          {(type === 'stock' || type === 'crypto') && (
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Ticker (opsional)</label>
              <NeubruInput value={ticker} onChange={setTicker} placeholder={type === 'crypto' ? 'BTC, ETH...' : 'BBCA, AAPL...'} onKeyDown={(e) => e.key === 'Enter' && saveAsset()} />
            </div>
          )}
        </div>
        {(type === 'stock' || type === 'crypto') && (
          <p className="text-xs text-nb-fg-muted mb-4 -mt-2">Isi ticker untuk bisa refresh harga otomatis lewat tombol "🔄 Refresh Harga" (Yahoo Finance / CoinPaprika).</p>
        )}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Jumlah</label>
            <NeubruInput value={quantity} onChange={setQuantity} placeholder="1" type="number" onKeyDown={(e) => e.key === 'Enter' && saveAsset()} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Harga Satuan</label>
            <NeubruInput value={unitPrice} onChange={setUnitPrice} placeholder="1000000" type="number" onKeyDown={(e) => e.key === 'Enter' && saveAsset()} />
          </div>
        </div>
        {(editAssetId || type === 'stock' || type === 'crypto') && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Harga Beli (opsional)</label>
              <NeubruInput value={buyPrice} onChange={setBuyPrice} placeholder="950000" type="number" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Tanggal Beli (opsional)</label>
              <NeubruInput value={buyDate} onChange={setBuyDate} placeholder="2025-01-15" type="date" />
            </div>
          </div>
        )}
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Catatan</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opsional..." rows={3} className="border-2 border-nb-border bg-white px-3 py-2 text-sm font-medium outline-none resize-y w-full" style={{ fontFamily: "inherit" }} />
        </div>
        <NeubruBtn color="blue" onClick={saveAsset} disabled={saving}>{saving ? '⏳ Menyimpan...' : '💾 Simpan'}</NeubruBtn>
      </NeubruModal>

      <NeubruModal open={showLiabModal} onClose={() => setShowLiabModal(false)} title={editLiabId ? 'Edit Liability' : 'Tambah Liability'}>
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Nama</label>
          <NeubruInput value={liabName} onChange={setLiabName} placeholder="KPR Rumah Jakarta, Cicilan Motor..." onKeyDown={(e) => e.key === 'Enter' && saveLiability()} />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Tipe</label>
            <NeubruSelect value={liabType} onChange={(v) => setLiabType(v as LiabilityType)} options={LIABILITY_TYPES} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Sisa Jumlah</label>
            <NeubruInput value={liabAmount} onChange={setLiabAmount} placeholder="50000000" type="number" onKeyDown={(e) => e.key === 'Enter' && saveLiability()} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Catatan</label>
          <textarea value={liabNotes} onChange={(e) => setLiabNotes(e.target.value)} placeholder="Opsional..." rows={2} className="border-2 border-nb-border bg-white px-3 py-2 text-sm font-medium outline-none resize-y w-full" style={{ fontFamily: "inherit" }} />
        </div>
        <NeubruBtn color="red" onClick={saveLiability} disabled={liabSaving}>{liabSaving ? '⏳ Menyimpan...' : '💾 Simpan'}</NeubruBtn>
      </NeubruModal>
    </div>
  )
}
