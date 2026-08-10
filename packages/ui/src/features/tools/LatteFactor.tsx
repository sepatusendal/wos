import { useState, useMemo } from 'react'
import { useFormatCurrency } from '../../stores/useFormatCurrency'

export function LatteFactor() {
  const formatCurrency = useFormatCurrency()
  const [dailyAmount, setDailyAmount] = useState(35000)
  const [years, setYears] = useState(10)

  const result = useMemo(() => {
    const totalDays = years * 365
    const totalSpent = dailyAmount * totalDays
    // Compound interest: daily contribution, annual compounding at 7%
    const annualRate = 0.07
    const dailyContrib = dailyAmount * 365 // annual contribution
    let investedValue = 0
    for (let y = 0; y < years; y++) {
      investedValue = (investedValue + dailyContrib) * (1 + annualRate)
    }
    investedValue = Math.round(investedValue)
    return { totalSpent, investedValue, totalDays }
  }, [dailyAmount, years])

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-black uppercase mb-2">☕ Latte Factor Calculator</h3>
        <p className="text-xs text-nb-fg-muted font-medium">
          See how small daily expenses add up over time — and what they could be worth if invested.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-5 mb-6">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-nb-fg-muted block mb-1.5">Daily Expense</label>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">Rp</span>
            <input
              type="number"
              value={dailyAmount}
              onChange={(e) => setDailyAmount(Math.max(1000, Number(e.target.value) || 0))}
              className="nb-input nb-input-sm flex-1"
              min={1000}
              step={1000}
            />
          </div>
          <div className="flex gap-2 mt-2 flex-wrap">
            {[15000, 25000, 35000, 50000, 100000].map((preset) => (
              <button
                key={preset}
                onClick={() => setDailyAmount(preset)}
                className={`text-[10px] font-bold px-2 py-1 border-2 cursor-pointer transition-all ${
                  dailyAmount === preset
                    ? 'bg-nb-yellow border-nb-border'
                    : 'bg-white border-nb-border hover:bg-nb-yellow/30'
                }`}
              >
                {formatCurrency(preset)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-nb-fg-muted block mb-1.5">Time Period (Years)</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              min={1}
              max={30}
              className="flex-1 accent-nb-yellow"
              style={{ height: '24px' }}
            />
            <span className="font-mono font-bold text-sm w-10 text-right">{years}</span>
          </div>
          <div className="flex gap-2 mt-2 flex-wrap">
            {[1, 5, 10, 20, 30].map((preset) => (
              <button
                key={preset}
                onClick={() => setYears(preset)}
                className={`text-[10px] font-bold px-2 py-1 border-2 cursor-pointer transition-all ${
                  years === preset
                    ? 'bg-nb-yellow border-nb-border'
                    : 'bg-white border-nb-border hover:bg-nb-yellow/30'
                }`}
              >
                {preset}y
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="nb-card !bg-nb-bg">
          <div className="text-xs font-bold uppercase text-nb-fg-muted mb-2">
            💸 Total Spent on Latte
          </div>
          <div className="text-sm text-nb-fg-muted mb-1 font-medium">
            <span className="font-mono font-bold">{formatCurrency(dailyAmount)}</span>/day
            {' × '}365{' × '}{years} years
          </div>
          <div className="font-mono text-2xl font-extrabold text-nb-red">
            {formatCurrency(result.totalSpent)}
          </div>
        </div>

        <div className="nb-card !bg-nb-bg">
          <div className="text-xs font-bold uppercase text-nb-fg-muted mb-2">
            📈 If Invested @ 7%/year
          </div>
          <div className="text-sm text-nb-fg-muted mb-1 font-medium">
            Compound annual return
          </div>
          <div className="font-mono text-2xl font-extrabold text-nb-green">
            {formatCurrency(result.investedValue)}
          </div>
        </div>
      </div>

      {/* Visual: Progress bar comparing spent vs invested */}
      <div className="nb-card mb-6">
        <div className="text-xs font-bold uppercase text-nb-fg-muted mb-3">Opportunity Cost Visual</div>
        <div className="flex items-end gap-8 h-32 mb-2">
          <div className="flex flex-col items-center gap-1">
            <span className="font-mono text-xs font-bold text-nb-red">{formatCurrency(result.totalSpent)}</span>
            <div
              className="w-20 border-2 border-nb-border bg-nb-red/20"
              style={{ height: '100%' }}
            />
            <span className="text-[10px] font-bold text-nb-fg-muted">Spent</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="font-mono text-xs font-bold text-nb-green">{formatCurrency(result.investedValue)}</span>
            <div
              className="w-20 border-2 border-nb-border bg-nb-green/20"
              style={{
                height: `${Math.min(100, (result.investedValue / result.totalSpent) * 100)}%`,
              }}
            />
            <span className="text-[10px] font-bold text-nb-fg-muted">Invested</span>
          </div>
        </div>
        <div className="text-[10px] font-bold text-nb-purple mt-2">
          Difference: {formatCurrency(result.investedValue - result.totalSpent)} extra from investing!
        </div>
      </div>

      {/* Shareable stat */}
      <div className="p-4 border-2 border-nb-border bg-nb-yellow/20">
        <div className="text-xs font-bold uppercase tracking-wider text-nb-fg-muted mb-1">
          📊 Shareable Statistic
        </div>
        <div className="font-mono font-bold text-sm">
          "{formatCurrency(dailyAmount)}/hari selama {years} tahun ={' '}
          {formatCurrency(result.totalSpent)}. Kalau diinvestasikan jadi{' '}
          {formatCurrency(result.investedValue)}!"
        </div>
      </div>
    </div>
  )
}
