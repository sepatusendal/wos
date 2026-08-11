import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useNetWorthStore } from '../../stores/netWorthStore'
import { useAuthStore } from '../../stores/authStore'
import { NeubruBtn, NeubruCard, NeubruInput, NeubruModal } from '../../components'
import { formatDate, todayStr } from '@wos/shared'
import { useFormatCurrency } from '../../stores/useFormatCurrency'

export default function NetWorthPage() {
  const userId = useAuthStore((s) => s.userId)
  const formatCurrency = useFormatCurrency()
  const { entries, fetchAll, addEntry, deleteEntry } = useNetWorthStore()
  const [showModal, setShowModal] = useState(false)
  const [cash, setCash] = useState('')
  const [investments, setInvestments] = useState('')
  const [property, setProperty] = useState('')
  const [otherAssets, setOtherAssets] = useState('')
  const [mortgage, setMortgage] = useState('')
  const [loans, setLoans] = useState('')
  const [creditCards, setCreditCards] = useState('')
  const [otherLiabilities, setOtherLiabilities] = useState('')
  const [entryDate, setEntryDate] = useState(todayStr())

  useEffect(() => { if (userId) fetchAll(userId) }, [userId, fetchAll])

  const latest = entries[0] || null

  const chartItems = useMemo(() => {
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
  }, [latest])

  const reset = () => {
    setCash(''); setInvestments(''); setProperty(''); setOtherAssets('')
    setMortgage(''); setLoans(''); setCreditCards(''); setOtherLiabilities('')
    setEntryDate(todayStr())
  }

  const save = async () => {
    if (!userId) return
    if (!entryDate) { toast.error('Tanggal wajib diisi'); return }
    if (entryDate > todayStr()) { toast.error('Tanggal tidak boleh di masa depan'); return }
    const b = { cash: Number(cash) || 0, investments: Number(investments) || 0, property: Number(property) || 0, otherAssets: Number(otherAssets) || 0, mortgage: Number(mortgage) || 0, loans: Number(loans) || 0, creditCards: Number(creditCards) || 0, otherLiabilities: Number(otherLiabilities) || 0 }
    const ta = b.cash + b.investments + b.property + b.otherAssets
    const tl = b.mortgage + b.loans + b.creditCards + b.otherLiabilities
    await addEntry(userId, { date: entryDate, totalAssets: ta, totalLiabilities: tl, netWorth: ta - tl, ...b })
    reset()
    setShowModal(false)
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-7 gap-4 flex-wrap">
        <h2 className="text-[1.8rem]">🏦 Net Worth</h2>
        <NeubruBtn color="purple" onClick={() => { reset(); setShowModal(true) }}>+ Catat</NeubruBtn>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5 mb-7">
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Net Worth</div>
          <div className={`font-mono text-2xl font-extrabold ${latest && latest.netWorth >= 0 ? 'text-nb-green' : 'text-nb-red'}`}>{latest ? formatCurrency(latest.netWorth) : '—'}</div>
          <div className="text-xs text-nb-fg-muted mt-1 font-medium">{latest ? formatDate(latest.date ?? '') : 'Belum ada'}</div>
        </NeubruCard>
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Total Aset</div>
          <div className="text-nb-green font-mono text-xl font-extrabold">{latest ? formatCurrency(latest.totalAssets) : '—'}</div>
        </NeubruCard>
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Total Liabilitas</div>
          <div className="text-nb-red font-mono text-xl font-extrabold">{latest ? formatCurrency(latest.totalLiabilities) : '—'}</div>
        </NeubruCard>
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
          <h3 className="mb-3">Riwayat</h3>
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
                    <NeubruBtn size="sm" color="red" className="nb-btn-icon" onClick={() => deleteEntry(e.id)}>✕</NeubruBtn>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {entries.length === 0 && (
        <div className="nb-panel text-center py-16"><div className="text-5xl mb-3">🏦</div><div className="font-bold uppercase text-nb-fg-muted">Catat net worth pertama!</div></div>
      )}

      <NeubruModal open={showModal} onClose={() => setShowModal(false)} title="Catat Net Worth">
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Tanggal</label>
          <input
            type="date"
            className="nb-input"
            value={entryDate}
            max={todayStr()}
            onChange={(e) => setEntryDate(e.target.value)}
            onBlur={(e) => { const v = e.target.value; if (v !== entryDate) setEntryDate(v) }}
            onKeyDown={(e) => { if (e.key === 'Enter') save() }}
          />
        </div>
        <h3 className="text-sm font-bold text-nb-green mb-3">ASET</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1.5"><label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Cash</label><NeubruInput value={cash} onChange={setCash} type="number" placeholder="0" onKeyDown={(e) => e.key === 'Enter' && save()} /></div>
          <div className="flex flex-col gap-1.5"><label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Investasi</label><NeubruInput value={investments} onChange={setInvestments} type="number" placeholder="0" onKeyDown={(e) => e.key === 'Enter' && save()} /></div>
          <div className="flex flex-col gap-1.5"><label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Properti</label><NeubruInput value={property} onChange={setProperty} type="number" placeholder="0" onKeyDown={(e) => e.key === 'Enter' && save()} /></div>
          <div className="flex flex-col gap-1.5"><label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Aset Lain</label><NeubruInput value={otherAssets} onChange={setOtherAssets} type="number" placeholder="0" onKeyDown={(e) => e.key === 'Enter' && save()} /></div>
        </div>
        <h3 className="text-sm font-bold text-nb-red mb-3">LIABILITAS</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1.5"><label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">KPR</label><NeubruInput value={mortgage} onChange={setMortgage} type="number" placeholder="0" onKeyDown={(e) => e.key === 'Enter' && save()} /></div>
          <div className="flex flex-col gap-1.5"><label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Pinjaman</label><NeubruInput value={loans} onChange={setLoans} type="number" placeholder="0" onKeyDown={(e) => e.key === 'Enter' && save()} /></div>
          <div className="flex flex-col gap-1.5"><label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Kartu Kredit</label><NeubruInput value={creditCards} onChange={setCreditCards} type="number" placeholder="0" onKeyDown={(e) => e.key === 'Enter' && save()} /></div>
          <div className="flex flex-col gap-1.5"><label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Liab Lain</label><NeubruInput value={otherLiabilities} onChange={setOtherLiabilities} type="number" placeholder="0" onKeyDown={(e) => e.key === 'Enter' && save()} /></div>
        </div>
        <NeubruBtn color="purple" onClick={save}>💾 Simpan</NeubruBtn>
      </NeubruModal>
    </div>
  )
}
