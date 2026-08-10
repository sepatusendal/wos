import { useState, useMemo } from 'react'
import { NeubruBtn, NeubruCard } from '../../components'
import { LatteFactor } from './LatteFactor'
import { LoanCalculator } from './LoanCalculator'
import { useFinanceStore } from '../../stores/financeStore'
import { useNetWorthStore } from '../../stores/netWorthStore'
import { useFormatCurrency } from '../../stores/useFormatCurrency'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

type TabId = 'latte' | 'loan' | 'sankey' | 'simulator'

export default function ToolsPage() {
  const [tab, setTab] = useState<TabId>('sankey')

  const tabs: { id: TabId; label: string }[] = [
    { id: 'sankey', label: '🌊 Sankey' },
    { id: 'simulator', label: '📊 Simulator' },
    { id: 'latte', label: '☕ Latte Factor' },
    { id: 'loan', label: '🏦 Loan Calc' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-7 gap-4 flex-wrap">
        <h2 className="text-[1.8rem]">🧮 Tools</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {tabs.map((t) => (
            <NeubruBtn key={t.id} size="sm" color={tab === t.id ? 'yellow' : undefined} onClick={() => setTab(t.id)}>
              {t.label}
            </NeubruBtn>
          ))}
        </div>
      </div>

      {tab === 'sankey' && <SankeySection />}
      {tab === 'simulator' && <SimulatorSection />}
      {tab === 'latte' && <LatteFactor />}
      {tab === 'loan' && <LoanCalculator />}
    </div>
  )
}

// ── Sankey Constants ──

const INCOME_SOURCES = ['Gaji', 'Freelance', 'Investasi', 'Bisnis', 'Transfer']
const EXPENSE_CATS = ['Makan', 'Transport', 'Belanja', 'Hiburan', 'Tagihan', 'Kesehatan', 'Pendidikan', 'Transfer', 'Lainnya']

const SOURCE_COLORS: Record<string, string> = {
  Gaji: '#22c55e', Freelance: '#2f6bff', Investasi: '#8b5cf6', Bisnis: '#ff8a00', Transfer: '#22c55e',
}

const CAT_BG_COLORS: Record<string, string> = {
  Makan: '#ffd800', Transport: '#2f6bff', Belanja: '#ff5c8a', Hiburan: '#ff8a00',
  Tagihan: '#ff4b4b', Kesehatan: '#ff5c8a', Pendidikan: '#8b5cf6', Transfer: '#2f6bff', Lainnya: '#ffd800',
}

const CAT_FG_COLORS: Record<string, string> = {
  Makan: '#0b0b0b', Transport: '#ffffff', Belanja: '#ffffff', Hiburan: '#0b0b0b',
  Tagihan: '#ffffff', Kesehatan: '#ffffff', Pendidikan: '#ffffff', Transfer: '#ffffff', Lainnya: '#0b0b0b',
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ── 🌊 Sankey Section ──

function SankeySection() {
  const formatCurrency = useFormatCurrency()
  const transactions = useFinanceStore((s) => s.transactions)
  const [monthIdx, setMonthIdx] = useState(0)

  const { monthLabel, incomeBySource, categoryExpenses, totalIncome, totalExpense, savings, savingRate } = useMemo(() => {
    const now = new Date()
    now.setMonth(now.getMonth() - monthIdx)
    const key = monthKey(now)
    const label = `${now.toLocaleDateString('id-ID', { month: 'long' })} ${now.getFullYear()}`

    const monthTx = transactions.filter((t) => t.date.startsWith(key))

    const incomeBy: Record<string, number> = {}
    for (const src of INCOME_SOURCES) incomeBy[src] = 0
    for (const tx of monthTx) {
      if (tx.type === 'income') {
        const cat = tx.category
        if (INCOME_SOURCES.includes(cat)) {
          incomeBy[cat] = (incomeBy[cat] || 0) + tx.amount
        } else {
          incomeBy['Transfer'] = (incomeBy['Transfer'] || 0) + tx.amount
        }
      }
    }

    const catExp: Record<string, number> = {}
    for (const cat of EXPENSE_CATS) catExp[cat] = 0
    for (const tx of monthTx) {
      if (tx.type === 'expense') {
        if (catExp.hasOwnProperty(tx.category)) {
          catExp[tx.category] = (catExp[tx.category] || 0) + tx.amount
        } else {
          catExp['Lainnya'] = (catExp['Lainnya'] || 0) + tx.amount
        }
      }
    }

    const totalInc = Object.values(incomeBy).reduce((s, v) => s + v, 0)
    const totalExp = Object.values(catExp).reduce((s, v) => s + v, 0)
    const sav = totalInc - totalExp

    return { monthLabel: label, incomeBySource: incomeBy, categoryExpenses: catExp, totalIncome: totalInc, totalExpense: totalExp, savings: sav, savingRate: totalInc > 0 ? Math.round((sav / totalInc) * 100) : 0 }
  }, [transactions, monthIdx])

  const pctIncome = (v: number) => totalIncome > 0 ? (v / totalIncome) * 100 : 0
  const incomeEntries = Object.entries(incomeBySource).filter(([, v]) => v > 0)
  const expenseEntries = Object.entries(categoryExpenses).filter(([, v]) => v > 0)

  return (
    <div>
      {/* Month selector */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => setMonthIdx((i) => i + 1)}
          disabled={monthIdx >= 11}
          className="px-3 py-2 text-xs font-bold border-2 border-nb-border bg-white cursor-pointer hover:bg-nb-yellow/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ← Prev
        </button>
        <span className="font-black text-lg uppercase tracking-wide min-w-[220px] text-center">
          📅 {monthLabel}
        </span>
        <button
          onClick={() => setMonthIdx((i) => i - 1)}
          disabled={monthIdx <= 0}
          className="px-3 py-2 text-xs font-bold border-2 border-nb-border bg-white cursor-pointer hover:bg-nb-yellow/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Next →
        </button>
      </div>

      <div className="text-sm font-bold text-nb-fg-muted mb-5">
        🌊 Lihat kemana uang lo pergi — cash flow deskriptif (flow dari sumber ke kategori ke hasil akhir)
      </div>

      {totalIncome === 0 ? (
        <div className="nb-panel text-center py-16">
          <div className="text-5xl mb-3">📭</div>
          <div className="font-bold uppercase text-nb-fg-muted">Belum ada transaksi bulan ini</div>
          <div className="text-xs text-nb-fg-muted mt-1">Pilih bulan lain atau tambah transaksi di Finance</div>
        </div>
      ) : (
        <div className="flex gap-4">
          {/* Column 1: Income Sources */}
          <div className="flex-[1.2] flex flex-col gap-1.5 min-w-0">
            <div className="font-black text-[11px] uppercase tracking-[0.1em] text-nb-green bg-nb-green/10 border-2 border-nb-green px-3 py-2 mb-1">
              💰 Sumber Pemasukan
            </div>
            {incomeEntries.map(([source, amount]) => (
              <div key={source} className="flex items-center gap-2">
                <div className="w-[90px] flex-shrink-0 text-[10px] font-bold text-right uppercase tracking-wide leading-tight">
                  {source}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="h-[30px] border-3 border-nb-border flex items-center px-2 min-w-0"
                    style={{
                      width: `${Math.max(pctIncome(amount), 4)}%`,
                      background: SOURCE_COLORS[source] || '#22c55e',
                    }}
                  >
                    <span className="text-[10px] font-mono font-bold text-white drop-shadow-sm whitespace-nowrap">
                      {formatCurrency(amount)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2 mt-1 pt-1 border-t-3 border-nb-border">
              <div className="w-[90px] flex-shrink-0 text-[11px] font-black text-right uppercase tracking-wide text-nb-green">Total</div>
              <div className="flex-1 h-[32px] bg-nb-green border-3 border-nb-border flex items-center px-2">
                <span className="text-xs font-mono font-bold text-white">{formatCurrency(totalIncome)}</span>
              </div>
            </div>
          </div>

          {/* Column 2: Expense Categories */}
          <div className="flex-[1.2] flex flex-col gap-1.5 min-w-0">
            <div className="font-black text-[11px] uppercase tracking-[0.1em] text-nb-red bg-nb-red/10 border-2 border-nb-red px-3 py-2 mb-1">
              💳 Kemana Uang pergi
            </div>
            {expenseEntries.map(([cat, amount]) => {
              const bg = CAT_BG_COLORS[cat] || '#ffd800'
              const fg = CAT_FG_COLORS[cat] || '#0b0b0b'
              return (
                <div key={cat} className="flex items-center gap-2">
                  <div className="w-[90px] flex-shrink-0 text-[10px] font-bold text-right uppercase tracking-wide leading-tight">
                    {cat}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="h-[30px] border-3 border-nb-border flex items-center px-2 min-w-0"
                      style={{
                        width: `${Math.max(pctIncome(amount), 4)}%`,
                        background: bg,
                      }}
                    >
                      <span className="text-[10px] font-mono font-bold whitespace-nowrap" style={{ color: fg }}>
                        {formatCurrency(amount)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
            <div className="flex items-center gap-2 mt-1 pt-1 border-t-3 border-nb-border">
              <div className="w-[90px] flex-shrink-0 text-[11px] font-black text-right uppercase tracking-wide text-nb-red">Total</div>
              <div className="flex-1 h-[32px] bg-nb-red border-3 border-nb-border flex items-center px-2">
                <span className="text-xs font-mono font-bold text-white">{formatCurrency(totalExpense)}</span>
              </div>
            </div>
          </div>

          {/* Column 3: End Destinations */}
          <div className="flex-[1] flex flex-col gap-1.5 min-w-0">
            <div className="font-black text-[11px] uppercase tracking-[0.1em] text-nb-blue bg-nb-blue/10 border-2 border-nb-blue px-3 py-2 mb-1">
              🎯 Hasil Akhir
            </div>
            {expenseEntries.map(([cat, amount]) => {
              const bg = CAT_BG_COLORS[cat] || '#ffd800'
              const pct = pctIncome(amount)
              return (
                <div key={cat} className="flex items-center gap-2">
                  <div className="w-[80px] flex-shrink-0 text-[10px] font-bold text-right uppercase tracking-wide leading-tight">
                    {cat}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="h-[30px] border-3 border-nb-border flex items-center px-2 min-w-0"
                      style={{
                        width: `${Math.max(pct, 4)}%`,
                        background: bg,
                      }}
                    >
                      {pct >= 10 ? (
                        <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: CAT_FG_COLORS[cat] || '#0b0b0b' }}>
                          {Math.round(pct)}%
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
            {savings > 0 && (
              <div className="flex items-center gap-2 mt-1 pt-1 border-t-3 border-nb-border">
                <div className="w-[80px] flex-shrink-0 text-[11px] font-black text-right uppercase tracking-wide text-nb-green">💾 Sisa</div>
                <div className="flex-1 min-w-0">
                  <div
                    className="h-[32px] bg-nb-green border-3 border-nb-border flex items-center px-2"
                    style={{ width: `${Math.max(pctIncome(savings), 4)}%` }}
                  >
                    <span className="text-xs font-mono font-bold text-white">{formatCurrency(savings)}</span>
                  </div>
                </div>
              </div>
            )}
            {savings <= 0 && (
              <div className="flex items-center gap-2 mt-1 pt-1 border-t-3 border-nb-border">
                <div className="w-[80px] flex-shrink-0 text-[11px] font-black text-right uppercase tracking-wide text-nb-red">⚠️ Defisit</div>
                <div className="flex-1 min-w-0">
                  <div className="h-[32px] bg-nb-red border-3 border-nb-border flex items-center px-2">
                    <span className="text-xs font-mono font-bold text-white">{formatCurrency(Math.abs(savings))}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary cards */}
      {totalIncome > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4 mt-6">
          <NeubruCard>
            <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Total In</div>
            <div className="text-nb-green font-mono text-lg font-extrabold">{formatCurrency(totalIncome)}</div>
          </NeubruCard>
          <NeubruCard>
            <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Total Out</div>
            <div className="text-nb-red font-mono text-lg font-extrabold">{formatCurrency(totalExpense)}</div>
          </NeubruCard>
          <NeubruCard>
            <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Sisa</div>
            <div className={`font-mono text-lg font-extrabold ${savings >= 0 ? 'text-nb-green' : 'text-nb-red'}`}>
              {formatCurrency(savings)}
            </div>
          </NeubruCard>
          <NeubruCard>
            <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">Saving Rate</div>
            <div className={`font-mono text-lg font-extrabold ${savingRate >= 20 ? 'text-nb-green' : savingRate >= 0 ? 'text-nb-orange' : 'text-nb-red'}`}>
              {savingRate}%
            </div>
          </NeubruCard>
        </div>
      )}
    </div>
  )
}

// ── Net Worth Simulator ──

interface SimRow {
  year: number
  contribution: number
  interest: number
  total: number
}

function simulate(
  currentSavings: number,
  monthlySavings: number,
  annualReturn: number,
  years: number,
): SimRow[] {
  const rows: SimRow[] = []
  let balance = currentSavings
  for (let y = 1; y <= years; y++) {
    const contribution = monthlySavings * 12
    const interest = (balance + contribution * 0.5) * (annualReturn / 100)
    balance += contribution + interest
    rows.push({
      year: y,
      contribution,
      interest: Math.round(interest),
      total: Math.round(balance),
    })
  }
  return rows
}

function SimulatorSection() {
  const formatCurrency = useFormatCurrency()
  const transactions = useFinanceStore((s) => s.transactions)
  const netWorthEntries = useNetWorthStore((s) => s.entries)

  const { currentSavings, monthlySavings } = useMemo(() => {
    const now = new Date()
    const last6Months: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      last6Months.push(monthKey(d))
    }
    const totalNW = netWorthEntries[0]?.netWorth || 0
    const savingsByMonth: number[] = []
    for (const mk of last6Months) {
      const mTx = transactions.filter((t) => t.date.startsWith(mk))
      const inc = mTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const exp = mTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      savingsByMonth.push(inc - exp)
    }
    const pos = savingsByMonth.filter((v) => v > 0)
    const avg = pos.length > 0 ? Math.round(pos.reduce((s, v) => s + v, 0) / pos.length) : 0
    return { currentSavings: totalNW || avg * 6, monthlySavings: avg }
  }, [transactions, netWorthEntries])

  const [customSavings, setCustomSavings] = useState('')
  const [customMonthly, setCustomMonthly] = useState('')
  const [returnRate, setReturnRate] = useState(7)
  const [inflationRate, setInflationRate] = useState(3)
  const [years, setYears] = useState(20)

  const savings = customSavings ? Number(customSavings) : currentSavings
  const monthly = customMonthly ? Number(customMonthly) : monthlySavings

  const scenarios = useMemo(() => ({
    optimistic: simulate(savings, monthly, 10, years),
    realistic: simulate(savings, monthly, returnRate, years),
    pessimistic: simulate(savings, monthly, 4, years),
  }), [savings, monthly, returnRate, years])

  const chartData = useMemo(() => {
    const data: { year: number; Optimis: number; Realistis: number; Pesimis: number }[] = []
    for (let i = 0; i < years; i++) {
      data.push({
        year: i + 1,
        Optimis: scenarios.optimistic[i]!.total,
        Realistis: scenarios.realistic[i]!.total,
        Pesimis: scenarios.pessimistic[i]!.total,
      })
    }
    return data
  }, [scenarios, years])

  const finalRealistic = scenarios.realistic[years - 1]?.total || 0
  const inflatedValue = Math.round(finalRealistic / Math.pow(1 + inflationRate / 100, years))
  const targetYear = new Date().getFullYear() + years

  const SLIDER_STOPS = [5, 10, 15, 20, 25, 30]

  const inputRow = (label: string, value: string, setter: (v: string) => void, auto: number) => (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">{label}</label>
        {!value && (
          <span className="text-[10px] font-bold text-nb-fg-muted font-mono">
            Auto: {formatCurrency(auto)}
          </span>
        )}
      </div>
      <div className="flex gap-2 items-center">
        <input
          type="number"
          value={value}
          onChange={(e) => setter(e.target.value)}
          placeholder={String(auto)}
          className="nb-input nb-input-sm flex-1"
        />
        {value && (
          <button
            onClick={() => setter('')}
            className="text-[10px] font-bold text-nb-red border-2 border-nb-red px-2 py-1.5 cursor-pointer hover:bg-nb-red/10 transition-colors uppercase"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div>
      {/* Inputs */}
      <NeubruCard className="mb-6">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
          {inputRow('Tabungan Saat Ini', customSavings, setCustomSavings, currentSavings)}
          {inputRow('Tabungan Bulanan', customMonthly, setCustomMonthly, monthlySavings)}

          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Expected Return %</label>
            <input
              type="number"
              value={returnRate}
              onChange={(e) => setReturnRate(Math.max(1, Math.min(15, Number(e.target.value) || 1)))}
              className="nb-input nb-input-sm"
              min={1}
              max={15}
            />
            <input
              type="range"
              min={1}
              max={15}
              value={returnRate}
              onChange={(e) => setReturnRate(Number(e.target.value))}
              className="w-full accent-nb-blue mt-1"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Inflasi %</label>
            <input
              type="number"
              value={inflationRate}
              onChange={(e) => setInflationRate(Math.max(0, Math.min(10, Number(e.target.value) || 0)))}
              className="nb-input nb-input-sm"
              min={0}
              max={10}
            />
          </div>
        </div>
      </NeubruCard>

      {/* Years slider */}
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <span className="font-black text-xs uppercase tracking-wider text-nb-fg-muted">Proyeksi</span>
        <div className="flex gap-1">
          {SLIDER_STOPS.map((s) => (
            <button
              key={s}
              onClick={() => setYears(s)}
              className={`px-3 py-1.5 text-xs font-bold border-2 cursor-pointer transition-all ${
                years === s
                  ? 'bg-nb-yellow border-nb-border shadow-nb-sm'
                  : 'bg-white border-nb-border hover:bg-nb-yellow/20'
              }`}
            >
              {s}y
            </button>
          ))}
        </div>
      </div>

      {/* Summary statement */}
      <div className="mb-6 p-4 border-3 border-nb-border bg-nb-yellow/20">
        <div className="font-black text-sm uppercase tracking-wide text-center">
          Dengan saving rate sekarang
        </div>
        <div className="text-lg font-extrabold text-nb-green text-center mt-1 font-mono">
          {formatCurrency(inflatedValue)} di {targetYear}
        </div>
        <div className="text-xs text-nb-fg-muted text-center mt-1">
          (nominal Rp {formatCurrency(finalRealistic)} — adjusted for inflation {inflationRate}% per tahun)
        </div>
      </div>

      {/* Chart */}
      <NeubruCard className="mb-6">
        <div className="text-sm font-bold uppercase text-nb-fg-muted mb-3">📈 Proyeksi Net Worth</div>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1c" opacity={0.12} />
            <XAxis
              dataKey="year"
              stroke="#1a1a1c"
              tick={{ fontSize: 12, fontWeight: 700 }}
              label={{ value: 'Tahun', position: 'insideBottom', offset: -5, fontSize: 12, fontWeight: 700 }}
            />
            <YAxis
              stroke="#1a1a1c"
              tick={{ fontSize: 10, fontWeight: 700 }}
              tickFormatter={(v: number) => {
                if (v >= 1e9) return `${(v / 1e9).toFixed(1)}M`
                if (v >= 1e6) return `${(v / 1e6).toFixed(0)}Jt`
                if (v >= 1e3) return `${(v / 1e3).toFixed(0)}Rb`
                return String(v)
              }}
            />
            <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
            <Legend />
            <Line
              type="monotone"
              dataKey="Optimis"
              name="Optimis (10%)"
              stroke="#22c55e"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6, fill: '#22c55e' }}
            />
            <Line
              type="monotone"
              dataKey="Realistis"
              name={`Realistis (${returnRate}%)`}
              stroke="#2f6bff"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6, fill: '#2f6bff' }}
            />
            <Line
              type="monotone"
              dataKey="Pesimis"
              name="Pesimis (4%)"
              stroke="#ff8a00"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6, fill: '#ff8a00' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </NeubruCard>

      {/* Year-by-year table */}
      <NeubruCard>
        <div className="text-sm font-bold uppercase text-nb-fg-muted mb-4">
          Proyeksi Tahun ke Tahun ({returnRate}% return, {inflationRate}% inflasi)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-2 border-nb-border">
            <thead>
              <tr className="bg-nb-bg">
                <th className="p-3 text-left border-b-2 border-nb-border font-bold text-xs uppercase tracking-wider">Tahun</th>
                <th className="p-3 text-right border-b-2 border-nb-border font-bold text-xs uppercase tracking-wider">Tabungan</th>
                <th className="p-3 text-right border-b-2 border-nb-border font-bold text-xs uppercase tracking-wider">Bunga</th>
                <th className="p-3 text-right border-b-2 border-nb-border font-bold text-xs uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.realistic.map((row) => (
                <tr key={row.year} className="border-b border-nb-border/30 hover:bg-nb-yellow/10 transition-colors">
                  <td className="p-3 font-bold font-mono text-sm">{row.year}</td>
                  <td className="p-3 text-right font-mono font-bold text-sm">{formatCurrency(row.total - row.interest)}</td>
                  <td className="p-3 text-right font-mono text-sm text-nb-blue">{formatCurrency(row.interest)}</td>
                  <td className="p-3 text-right font-mono font-extrabold text-sm text-nb-green">{formatCurrency(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </NeubruCard>
    </div>
  )
}
