import { useEffect, useMemo, useState } from 'react'
import { useWealthStore } from '../../stores/wealthStore'
import { useAuthStore } from '../../stores/authStore'
import { NeubruBtn, NeubruCard, NeubruInput, NeubruSelect, NeubruModal, NeubruTag } from '../../components'
import { formatDate } from '@wos/shared'
import { useFormatCurrency } from '../../stores/useFormatCurrency'
import type { Asset, AssetType } from '@wos/shared'

const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: 'stock', label: '📊 Saham' }, { value: 'crypto', label: '🪙 Crypto' },
  { value: 'real-estate', label: '🏠 Properti' }, { value: 'cash', label: '💵 Cash' },
  { value: 'bonds', label: '📋 Obligasi' }, { value: 'other', label: '📦 Lainnya' },
]
const TYPE_COLORS: Record<string, 'yellow' | 'blue' | 'green' | 'pink' | 'orange' | 'purple'> = {
  stock: 'blue', crypto: 'orange', 'real-estate': 'green', cash: 'yellow', bonds: 'purple', other: 'yellow',
}

export default function WealthPage() {
  const userId = useAuthStore((s) => s.userId)
  const formatCurrency = useFormatCurrency()
  const { assets, fetchAll, addAsset, editAsset, deleteAsset, getPortfolioStats } = useWealthStore()
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState<AssetType>('stock')
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [buyPrice, setBuyPrice] = useState('')
  const [buyDate, setBuyDate] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => { if (userId) fetchAll(userId) }, [userId, fetchAll])

  const totalValue = useMemo(() => assets.reduce((s, a) => s + a.quantity * a.unitPrice, 0), [assets])
  const byType = useMemo(() => {
    const map: Record<string, number> = {}
    assets.forEach((a) => { map[a.type] = (map[a.type] || 0) + a.quantity * a.unitPrice })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [assets])

  const stats = useMemo(() => getPortfolioStats(), [assets, getPortfolioStats])

  const allocPercentages = useMemo(() => {
    const map: Record<string, number> = {}
    let total = 0
    assets.forEach((a) => { const v = a.quantity * a.unitPrice; map[a.type] = (map[a.type] || 0) + v; total += v })
    if (total === 0) return []
    return Object.entries(map).map(([t, v]) => ({ type: t, percent: (v / total) * 100, value: v })).sort((a, b) => b.percent - a.percent)
  }, [assets])

  const openAdd = () => { setEditId(null); setName(''); setType('stock'); setQuantity(''); setUnitPrice(''); setBuyPrice(''); setBuyDate(''); setNotes(''); setShowModal(true) }
  const openEdit = (a: Asset) => { setEditId(a.id); setName(a.name); setType(a.type); setQuantity(String(a.quantity)); setUnitPrice(String(a.unitPrice)); setBuyPrice(a.buyPrice != null ? String(a.buyPrice) : ''); setBuyDate(a.buyDate ?? ''); setNotes(a.notes ?? ''); setShowModal(true) }

  const save = async () => {
    if (!userId || !name || !quantity || !unitPrice) return
    const bp = buyPrice ? Number(buyPrice) : null
    const bd = buyDate || null
    if (editId) {
      await editAsset({ id: editId, name, type, quantity: Number(quantity), unitPrice: Number(unitPrice), notes, buyPrice: bp, buyDate: bd })
    } else {
      await addAsset(userId, { name, type, quantity: Number(quantity), unitPrice: Number(unitPrice), buyPrice: bp, buyDate: bd, notes } as any)
    }
    setShowModal(false)
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-7 gap-4 flex-wrap">
        <h2 className="text-[1.8rem]">📈 Wealth</h2>
        <NeubruBtn color="blue" onClick={openAdd}>+ Aset</NeubruBtn>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5 mb-7">
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Total Portfolio</div>
          <div className="text-nb-green font-mono text-xl font-extrabold">{formatCurrency(totalValue)}</div>
          <div className="text-xs text-nb-fg-muted mt-1 font-medium">{assets.length} aset</div>
        </NeubruCard>
        {stats.totalInvested > 0 && (
          <NeubruCard>
            <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Total Invested</div>
            <div className="font-mono text-xl font-extrabold">{formatCurrency(stats.totalInvested)}</div>
            <div className="text-xs text-nb-fg-muted mt-1 font-medium">{stats.assetsWithPnL.length} aset dgn harga beli</div>
          </NeubruCard>
        )}
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
        {byType.slice(0, 3).map(([typeKey, val]) => (
          <NeubruCard key={typeKey}>
            <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5"><NeubruTag label={typeKey} color={TYPE_COLORS[typeKey] || 'yellow'} /></div>
            <div className="font-mono text-lg font-extrabold">{formatCurrency(val)}</div>
            <div className="text-xs text-nb-fg-muted mt-1 font-medium">{totalValue > 0 ? ((val / totalValue) * 100).toFixed(1) : "0.0"}%</div>
          </NeubruCard>
        ))}
      </div>

      {allocPercentages.length > 0 && (
        <div className="mb-7">
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-3">Alokasi Portofolio</div>
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

      <div className="flex flex-col gap-2.5">
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
                <div className="font-bold">{a.name}</div>
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
              <NeubruBtn size="sm" color="yellow" className="nb-btn-icon" onClick={() => openEdit(a)}>✎</NeubruBtn>
              <NeubruBtn size="sm" color="red" className="nb-btn-icon" onClick={() => deleteAsset(a.id)}>✕</NeubruBtn>
            </div>
          </div>
        )})}
      </div>

      <NeubruModal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Aset' : 'Tambah Aset'}>
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Nama Aset</label>
          <NeubruInput value={name} onChange={setName} placeholder="BTC, AAPL, Rumah..." />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Tipe</label>
            <NeubruSelect value={type} onChange={(v) => setType(v as AssetType)} options={ASSET_TYPES} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Jumlah</label>
            <NeubruInput value={quantity} onChange={setQuantity} placeholder="1" type="number" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Harga Satuan</label>
            <NeubruInput value={unitPrice} onChange={setUnitPrice} placeholder="1000000" type="number" />
          </div>
        </div>
        {(editId || type === 'stock' || type === 'crypto') && (
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
          <NeubruInput value={notes} onChange={setNotes} placeholder="Opsional..." />
        </div>
        <NeubruBtn color="blue" onClick={save}>💾 Simpan</NeubruBtn>
      </NeubruModal>
    </div>
  )
}
