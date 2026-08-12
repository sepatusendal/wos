import { useEffect, useMemo, useState, useCallback } from 'react'
import { useFinanceStore } from '../../stores/financeStore'
import { useWealthStore } from '../../stores/wealthStore'
import { useLiabilityStore } from '../../stores/liabilityStore'
import { useNetWorthStore } from '../../stores/netWorthStore'
import { useAuthStore } from '../../stores/authStore'
import { NeubruBtn, NeubruCard, NeubruInput } from '../../components'
import { useFormatCurrency } from '../../stores/useFormatCurrency'

// ── Helpers ──────────────────────────────────────────────────

/** Solve for years to reach a target with monthly compounding */
function yearsToTarget(
  currentSavings: number,
  monthlyContribution: number,
  annualReturnPct: number,
  target: number,
): number {
  if (target <= currentSavings) return 0
  const r = annualReturnPct / 100 / 12
  const pmt = monthlyContribution
  const pv = currentSavings
  const fv = target

  if (r === 0) {
    if (pmt <= 0) return Infinity
    return (fv - pv) / (pmt * 12)
  }

  const num = fv * r + pmt
  const den = pv * r + pmt
  if (num <= 0 || den <= 0) return Infinity
  return Math.log(num / den) / Math.log(1 + r) / 12
}

// ── Component ────────────────────────────────────────────────

export default function FirePage() {
  const userId = useAuthStore((s) => s.userId)
  const formatCurrency = useFormatCurrency()

  // Store data
  const transactions = useFinanceStore((s) => s.transactions)
  const accounts = useFinanceStore((s) => s.accounts)
  const assets = useWealthStore((s) => s.assets)
  const liabilities = useLiabilityStore((s) => s.liabilities)
  const entries = useNetWorthStore((s) => s.entries)

  // Fetch all data on mount
  useEffect(() => {
    if (!userId) return
    const finance = useFinanceStore.getState()
    const wealth = useWealthStore.getState()
    const liability = useLiabilityStore.getState()
    const netWorth = useNetWorthStore.getState()
    if (finance.fetchAll) finance.fetchAll(userId)
    if (wealth.fetchAll) wealth.fetchAll(userId)
    if (liability.fetchAll) liability.fetchAll(userId)
    if (netWorth.fetchAll) netWorth.fetchAll(userId)
  }, [userId])

  // ── Auto-computed defaults from real data ──────────────────

  const autoDefaults = useMemo(() => {
    const now = new Date()
    // Current month is still in progress — a half-finished month would drag
    // the average down, so it never counts as a data month.
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // Sum per completed calendar month, so the divisor is the number of months
    // that actually have data — not a hardcoded window.
    const expenseByMonth: Record<string, number> = {}
    const incomeByMonth: Record<string, number> = {}
    for (const t of transactions) {
      const key = t.date.slice(0, 7)
      if (key >= currentMonthKey) continue // skip in-progress month (and any future-dated tx)
      if (t.type === 'expense') expenseByMonth[key] = (expenseByMonth[key] || 0) + t.amount
      else if (t.type === 'income') incomeByMonth[key] = (incomeByMonth[key] || 0) + t.amount
    }

    const expenseMonths = Object.keys(expenseByMonth)
    const incomeMonths = Object.keys(incomeByMonth)
    const totalExpense = expenseMonths.reduce((s, k) => s + (expenseByMonth[k] || 0), 0)
    const totalIncome = incomeMonths.reduce((s, k) => s + (incomeByMonth[k] || 0), 0)

    const expenseMonthCount = expenseMonths.length
    const avgExpense = expenseMonthCount > 0 ? Math.round(totalExpense / expenseMonthCount) : 0
    const avgIncome = incomeMonths.length > 0 ? Math.round(totalIncome / incomeMonths.length) : 0
    const avgSavings = Math.max(0, avgIncome - avgExpense)

    // Live net worth — same definition as the Wealth page: assets − liabilities
    const assetTotal = assets.reduce((s, a) => s + a.quantity * a.unitPrice, 0)
    const liabilityTotal = liabilities.reduce((s, l) => s + l.amount, 0)
    const netWorth = Math.round(assetTotal - liabilityTotal)

    // Cash & bank accounts for liquidity
    const cashBank = accounts
      .filter((a) => a.type === 'cash' || a.type === 'bank')
      .reduce((s, a) => s + a.balance, 0)

    return { avgExpense, avgIncome, avgSavings, expenseMonthCount, assetTotal, liabilityTotal, netWorth, cashBank }
  }, [transactions, accounts, assets, liabilities])

  // ── Editable form state ────────────────────────────────────
  // User overrides live in their own state (empty string = "use auto").
  // Nothing but an explicit reset ever clears them, so an incidental
  // re-render (e.g. one new transaction added elsewhere) can't wipe them.

  const [savingsOverride, setSavingsOverride] = useState('')
  const [expensesOverride, setExpensesOverride] = useState('')
  const [monthlySavingsOverride, setMonthlySavingsOverride] = useState('')
  const [annualReturn, setAnnualReturn] = useState(7)
  const [withdrawalRate, setWithdrawalRate] = useState(4)
  const [extraMonthly, setExtraMonthly] = useState(0)

  const currentSavings = savingsOverride !== '' ? Number(savingsOverride) || 0 : autoDefaults.netWorth
  const monthlyExpenses = expensesOverride !== '' ? Number(expensesOverride) || 0 : autoDefaults.avgExpense
  const monthlySavings = monthlySavingsOverride !== '' ? Number(monthlySavingsOverride) || 0 : autoDefaults.avgSavings

  // Refresh only the genuinely data-derived fields. Assumptions the user set
  // (expected return, safe withdrawal rate, what-if slider) are left alone.
  const recalculate = useCallback(() => {
    setSavingsOverride('')
    setExpensesOverride('')
    setMonthlySavingsOverride('')
  }, [])

  const resetAssumptions = useCallback(() => {
    setAnnualReturn(7)
    setWithdrawalRate(4)
    setExtraMonthly(0)
  }, [])

  // ── FIRE Calculations ──────────────────────────────────────

  // Less than 2 complete months of expense data = the average (and therefore
  // the FIRE Number) is not meaningful yet. A manual override counts as data.
  const enoughExpenseData = expensesOverride !== '' || autoDefaults.expenseMonthCount >= 2

  const fireNumber = useMemo(() => {
    if (withdrawalRate <= 0) return 0
    return (monthlyExpenses * 12) / (withdrawalRate / 100)
  }, [monthlyExpenses, withdrawalRate])

  const baseYearsToFI = useMemo(() => {
    return yearsToTarget(currentSavings, monthlySavings, annualReturn, fireNumber)
  }, [currentSavings, monthlySavings, annualReturn, fireNumber])

  const whatIfYearsToFI = useMemo(() => {
    return yearsToTarget(currentSavings, monthlySavings + extraMonthly, annualReturn, fireNumber)
  }, [currentSavings, monthlySavings, extraMonthly, annualReturn, fireNumber])

  const yearsSaved = useMemo(() => {
    if (!isFinite(baseYearsToFI)) return 0
    return Math.max(0, baseYearsToFI - whatIfYearsToFI)
  }, [baseYearsToFI, whatIfYearsToFI])

  const fireYear = useMemo(() => {
    if (!isFinite(whatIfYearsToFI) || whatIfYearsToFI > 200) return null
    return new Date().getFullYear() + Math.ceil(whatIfYearsToFI)
  }, [whatIfYearsToFI])

  const progressPercent = useMemo(() => {
    if (fireNumber <= 0) return 0
    return Math.min(100, (currentSavings / fireNumber) * 100)
  }, [currentSavings, fireNumber])

  // ── Financial Health Score ─────────────────────────────────

  const healthScore = useMemo(() => {
    // 1. Savings Rate (0-30)
    const rawSavingsRate = autoDefaults.avgIncome > 0
      ? ((autoDefaults.avgIncome - autoDefaults.avgExpense) / autoDefaults.avgIncome) * 100
      : 0
    const savingsScore = Math.min(30, Math.round((Math.max(0, rawSavingsRate) / 50) * 30))

    // 2. Liquidity Runway (0-25)
    const runwayMonths = autoDefaults.avgExpense > 0
      ? autoDefaults.cashBank / autoDefaults.avgExpense
      : 0
    const runwayScore = Math.min(25, Math.round((Math.min(runwayMonths, 12) / 12) * 25))

    // 3. Debt Ratio (0-25) — inverse of debt/asset ratio.
    // Uses the same live assets/liabilities as Current Net Worth above, so the
    // page never shows two different definitions of wealth.
    const sortedEntries = [...entries].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    const totalDebt = autoDefaults.liabilityTotal
    const totalAssetNW = autoDefaults.assetTotal
    const hasNetWorthData = totalAssetNW > 0 || totalDebt > 0
    const debtRatio = totalAssetNW > 0 ? totalDebt / totalAssetNW : 0
    // No net worth data at all = neutral (half marks), not a perfect debt ratio
    const debtScore = hasNetWorthData
      ? Math.min(25, Math.round(Math.max(0, 1 - debtRatio) * 25))
      : Math.round(25 * 0.5)

    // 4. Net Worth Growth (0-20) — last 6 months trend
    let growthScore = 0
    if (sortedEntries.length >= 2) {
      const now = new Date()
      const sixMoAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().slice(0, 10)
      const latestNW = sortedEntries[0]?.netWorth ?? 0
      const oldEntry = sortedEntries.find((e) => (e.date ?? '') <= sixMoAgo)
      const oldNW = oldEntry ? oldEntry.netWorth : (sortedEntries[sortedEntries.length - 1]?.netWorth ?? 0)
      if (oldNW > 0) {
        const growthPct = ((latestNW - oldNW) / oldNW) * 100
        growthScore = Math.min(20, Math.round(Math.max(0, growthPct) * 2)) // 10% growth = 20
      } else if (latestNW > 0) {
        growthScore = 20 // went from 0 to positive
      }
    }

    const total = Math.min(100, savingsScore + runwayScore + debtScore + growthScore)
    return { total, savingsScore, runwayScore, debtScore, growthScore }
  }, [autoDefaults, entries])

  const hs = healthScore
  const scoreColor = hs.total >= 70 ? 'var(--color-nb-green)' : hs.total >= 40 ? 'var(--color-nb-orange)' : 'var(--color-nb-red)'
  const scoreLabel = hs.total >= 70 ? 'Good' : hs.total >= 40 ? 'Fair' : 'Poor'

  // ── Gauge SVG values ───────────────────────────────────────

  const gaugeRadius = 78
  const gaugeCircumference = 2 * Math.PI * gaugeRadius
  const gaugeOffset = gaugeCircumference - (hs.total / 100) * gaugeCircumference

  // ── Slider presets for what-if ─────────────────────────────

  const sliderPresets = [0, 500000, 1000000, 2000000, 5000000, 10000000]

  // ── Render ─────────────────────────────────────────────────

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-7 gap-4 flex-wrap">
        <h2 className="text-[1.8rem]">🚀 FIRE</h2>
        <NeubruBtn color="blue" onClick={recalculate}>
          🔄 Recalculate
        </NeubruBtn>
      </div>

      {/* ── Top Row: FIRE Cards ── */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5 mb-7">
        {/* FIRE Number */}
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">
            🎯 FIRE Number
          </div>
          {enoughExpenseData ? (
            <>
              <div className="font-mono text-xl font-extrabold text-nb-blue">
                {formatCurrency(fireNumber)}
              </div>
              <div className="text-xs text-nb-fg-muted mt-1 font-medium">
                {withdrawalRate}% safe withdrawal · avg {autoDefaults.expenseMonthCount} bulan penuh
              </div>
            </>
          ) : (
            <>
              <div className="font-mono text-xl font-extrabold text-nb-fg-muted">—</div>
              <div className="text-xs text-nb-fg-muted mt-1 font-medium leading-relaxed">
                Butuh minimal 2 bulan data pengeluaran penuh untuk menghitung FIRE Number secara akurat
                ({autoDefaults.expenseMonthCount}/2 terkumpul)
              </div>
            </>
          )}
        </NeubruCard>

        {/* Years to FI */}
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">
            ⏳ Years to FI
          </div>
          <div className="font-mono text-xl font-extrabold">
            {!enoughExpenseData
              ? '—'
              : !isFinite(whatIfYearsToFI) || whatIfYearsToFI > 200
                ? 'N/A'
                : whatIfYearsToFI < 0.5
                  ? 'Now! 🎉'
                  : `${whatIfYearsToFI.toFixed(1)} yrs`}
          </div>
          <div className="text-xs text-nb-fg-muted mt-1 font-medium">
            {!enoughExpenseData
              ? 'Menunggu 2 bulan data pengeluaran'
              : fireYear ? `Freedom by ${fireYear}` : 'Increase savings to reach FI'}
          </div>
        </NeubruCard>

        {/* Progress */}
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">
            📊 Progress
          </div>
          <div className="font-mono text-xl font-extrabold text-nb-green">
            {enoughExpenseData ? `${progressPercent.toFixed(1)}%` : '—'}
          </div>
          <div className="w-full h-3 bg-nb-bg-alt border-2 border-nb-border mt-2 rounded-sm overflow-hidden">
            <div
              className="h-full bg-nb-green transition-all duration-500"
              style={{ width: `${enoughExpenseData ? Math.min(100, progressPercent) : 0}%` }}
            />
          </div>
          <div className="text-xs text-nb-fg-muted mt-1 font-medium">
            {enoughExpenseData
              ? `${formatCurrency(currentSavings)} / ${formatCurrency(fireNumber)}`
              : `Net worth ${formatCurrency(currentSavings)} · target belum bisa dihitung`}
          </div>
        </NeubruCard>

        {/* Freedom year */}
        <NeubruCard>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-1.5">
            🚀 Freedom Year
          </div>
          <div className="font-mono text-xl font-extrabold text-nb-orange">
            {enoughExpenseData ? (fireYear ?? '—') : '—'}
          </div>
          <div className="text-xs text-nb-fg-muted mt-1 font-medium">
            {!enoughExpenseData
              ? 'Menunggu 2 bulan data pengeluaran'
              : !isFinite(whatIfYearsToFI) || whatIfYearsToFI > 200
                ? 'Save more to get there'
                : `${whatIfYearsToFI < 1 ? 'Less than a year!' : `In ~${Math.ceil(whatIfYearsToFI)} years`}`}
          </div>
        </NeubruCard>
      </div>

      {/* ── Mid Row: Health Score + What-If ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-7">
        {/* Health Score Gauge */}
        <NeubruCard>
          <div className="text-sm font-bold uppercase text-nb-fg-muted mb-4">
            💪 Financial Health Score
          </div>
          <div className="flex items-center gap-6">
            {/* SVG Gauge */}
            <svg width="180" height="180" viewBox="0 0 180 180" className="flex-shrink-0">
              {/* Background circle */}
              <circle
                cx="90" cy="90" r={gaugeRadius}
                fill="none"
                stroke="var(--color-nb-bg-alt)"
                strokeWidth="12"
              />
              {/* Score arc */}
              <circle
                cx="90" cy="90" r={gaugeRadius}
                fill="none"
                stroke={scoreColor}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={gaugeCircumference}
                strokeDashoffset={gaugeOffset}
                transform="rotate(-90 90 90)"
                style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}
              />
              {/* Center text */}
              <text
                x="90" y="82"
                textAnchor="middle"
                className="font-extrabold"
                style={{ fontSize: '2.2rem', fontFamily: 'var(--font-mono)', fill: scoreColor }}
              >
                {hs.total}
              </text>
              <text
                x="90" y="108"
                textAnchor="middle"
                className="font-bold uppercase"
                style={{ fontSize: '0.7rem', fill: 'var(--color-nb-fg-muted)', letterSpacing: '0.08em' }}
              >
                / 100 · {scoreLabel}
              </text>
            </svg>

            {/* Score breakdown */}
            <div className="flex flex-col gap-2.5 text-xs flex-1">
              <div>
                <div className="flex justify-between font-bold mb-0.5">
                  <span className="text-nb-fg-muted">Savings Rate</span>
                  <span>{hs.savingsScore}/30</span>
                </div>
                <div className="w-full h-1.5 bg-nb-bg-alt border border-nb-border rounded-sm overflow-hidden">
                  <div className="h-full bg-nb-blue transition-all" style={{ width: `${(hs.savingsScore / 30) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between font-bold mb-0.5">
                  <span className="text-nb-fg-muted">Liquidity</span>
                  <span>{hs.runwayScore}/25</span>
                </div>
                <div className="w-full h-1.5 bg-nb-bg-alt border border-nb-border rounded-sm overflow-hidden">
                  <div className="h-full bg-nb-orange transition-all" style={{ width: `${(hs.runwayScore / 25) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between font-bold mb-0.5">
                  <span className="text-nb-fg-muted">Debt Ratio</span>
                  <span>{hs.debtScore}/25</span>
                </div>
                <div className="w-full h-1.5 bg-nb-bg-alt border border-nb-border rounded-sm overflow-hidden">
                  <div className="h-full bg-nb-purple transition-all" style={{ width: `${(hs.debtScore / 25) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between font-bold mb-0.5">
                  <span className="text-nb-fg-muted">NW Growth</span>
                  <span>{hs.growthScore}/20</span>
                </div>
                <div className="w-full h-1.5 bg-nb-bg-alt border border-nb-border rounded-sm overflow-hidden">
                  <div className="h-full bg-nb-green transition-all" style={{ width: `${(hs.growthScore / 20) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>
        </NeubruCard>

        {/* What-If Slider */}
        <NeubruCard>
          <div className="text-sm font-bold uppercase text-nb-fg-muted mb-4">
            🔮 What-If: Extra Monthly Savings
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted">
                Tambahan per bulan
              </span>
              <span className="font-mono font-extrabold text-lg text-nb-blue">
                {formatCurrency(extraMonthly)}
              </span>
            </div>

            {/* Neubrutalist range slider */}
            <input
              type="range"
              min={0}
              max={10000000}
              step={100000}
              value={extraMonthly}
              onChange={(e) => setExtraMonthly(Number(e.target.value))}
              className="w-full h-3 appearance-none cursor-pointer rounded-sm border-2 border-nb-border bg-white
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6
                [&::-webkit-slider-thumb]:bg-nb-blue [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-nb-border
                [&::-webkit-slider-thumb]:shadow-nb-sm [&::-webkit-slider-thumb]:cursor-pointer
                [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:bg-nb-blue
                [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-nb-border [&::-moz-range-thumb]:cursor-pointer"
            />

            {/* Quick-select presets */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {sliderPresets.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setExtraMonthly(preset)}
                  className={`px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide border-2 transition-all cursor-pointer ${
                    extraMonthly === preset
                      ? 'bg-nb-blue text-white border-nb-border shadow-nb-sm'
                      : 'bg-white border-nb-border hover:bg-nb-bg-alt'
                  }`}
                >
                  {preset === 0 ? 'None' : formatCurrency(preset)}
                </button>
              ))}
            </div>
          </div>

          {/* What-if result */}
          <div className="nb-panel p-5">
            <div className="text-xs font-bold uppercase tracking-[0.08em] text-nb-fg-muted mb-2">
              Hasil Simulasi
            </div>

            {extraMonthly > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-nb-fg-muted">Years to FI</span>
                  <span className="font-mono font-extrabold">
                    {whatIfYearsToFI.toFixed(1)} yrs
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-nb-fg-muted">Years saved</span>
                  <span className="font-mono font-extrabold text-nb-green">
                    {yearsSaved >= 10
                      ? `${yearsSaved.toFixed(0)} tahun lebih cepat!`
                      : yearsSaved >= 1
                        ? `${yearsSaved.toFixed(1)} tahun lebih cepat`
                        : `${(yearsSaved * 12).toFixed(0)} bulan lebih cepat`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-nb-fg-muted">Freedom year</span>
                  <span className="font-mono font-extrabold text-nb-orange">
                    {fireYear ?? '—'}
                  </span>
                </div>
                {extraMonthly > 0 && (
                  <div className="mt-3 pt-3 border-t-2 border-nb-border text-xs text-nb-fg-muted">
                    Tambah{' '}
                    <span className="font-bold text-nb-blue">{formatCurrency(extraMonthly)}</span>
                    /bulan {'→'}{' '}
                    <span className="font-bold text-nb-green">
                      {yearsSaved >= 1
                        ? `${yearsSaved.toFixed(1)} tahun`
                        : `${(yearsSaved * 12).toFixed(0)} bulan`}{' '}
                      lebih cepat
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-nb-fg-muted font-medium">
                Geser slider di atas untuk lihat dampak tambahan tabungan bulanan terhadap waktu FIRE kamu.
              </div>
            )}
          </div>
        </NeubruCard>
      </div>

      {/* ── Bottom: Editable Inputs ── */}
      <NeubruCard>
        <div className="text-sm font-bold uppercase text-nb-fg-muted mb-5">
          ⚙️ FIRE Parameters
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Current Net Worth */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">
                💰 Net Worth (Aset − Liability)
              </label>
              {savingsOverride !== '' && (
                <button
                  onClick={() => setSavingsOverride('')}
                  className="text-[10px] font-bold text-nb-red border-2 border-nb-red px-2 py-0.5 cursor-pointer hover:bg-nb-red/10 transition-colors uppercase"
                >
                  Reset
                </button>
              )}
            </div>
            <NeubruInput
              value={savingsOverride}
              onChange={setSavingsOverride}
              placeholder={String(autoDefaults.netWorth)}
              type="number"
            />
            <span className="text-[0.65rem] text-nb-fg-muted font-medium">
              Auto: {formatCurrency(autoDefaults.netWorth)} — total aset dikurangi total liability
            </span>
          </div>

          {/* Monthly Expenses */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">
                🧾 Monthly Expenses
              </label>
              {expensesOverride !== '' && (
                <button
                  onClick={() => setExpensesOverride('')}
                  className="text-[10px] font-bold text-nb-red border-2 border-nb-red px-2 py-0.5 cursor-pointer hover:bg-nb-red/10 transition-colors uppercase"
                >
                  Reset
                </button>
              )}
            </div>
            <NeubruInput
              value={expensesOverride}
              onChange={setExpensesOverride}
              placeholder={String(autoDefaults.avgExpense)}
              type="number"
            />
            <span className="text-[0.65rem] text-nb-fg-muted font-medium">
              {autoDefaults.expenseMonthCount > 0
                ? `Auto: rata-rata ${autoDefaults.expenseMonthCount} bulan penuh (bulan berjalan tidak dihitung)`
                : 'Auto: belum ada bulan penuh dengan data pengeluaran'}
            </span>
          </div>

          {/* Annual Return */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">
              📈 Expected Return %
            </label>
            <NeubruInput
              value={String(annualReturn)}
              onChange={(v) => setAnnualReturn(Number(v) || 0)}
              placeholder="7"
              type="number"
            />
            <span className="text-[0.65rem] text-nb-fg-muted font-medium">
              Default: 7% (S&P 500 avg)
            </span>
          </div>

          {/* Withdrawal Rate */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">
              🏖️ Safe Withdrawal %
            </label>
            <NeubruInput
              value={String(withdrawalRate)}
              onChange={(v) => setWithdrawalRate(Number(v) || 0)}
              placeholder="4"
              type="number"
            />
            <span className="text-[0.65rem] text-nb-fg-muted font-medium">
              Default: 4% rule
            </span>
          </div>

          {/* Monthly Savings */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">
                💸 Monthly Savings
              </label>
              {monthlySavingsOverride !== '' && (
                <button
                  onClick={() => setMonthlySavingsOverride('')}
                  className="text-[10px] font-bold text-nb-red border-2 border-nb-red px-2 py-0.5 cursor-pointer hover:bg-nb-red/10 transition-colors uppercase"
                >
                  Reset
                </button>
              )}
            </div>
            <NeubruInput
              value={monthlySavingsOverride}
              onChange={setMonthlySavingsOverride}
              placeholder={String(autoDefaults.avgSavings)}
              type="number"
            />
            <span className="text-[0.65rem] text-nb-fg-muted font-medium">
              Auto: income - expense avg (bulan penuh)
            </span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <NeubruBtn color="blue" onClick={recalculate}>
            🔄 Recalculate from Data
          </NeubruBtn>
          <NeubruBtn onClick={resetAssumptions}>
            ↩️ Reset Asumsi (return / withdrawal)
          </NeubruBtn>
        </div>
        <div className="mt-2 text-[0.65rem] text-nb-fg-muted font-medium">
          "Recalculate from Data" cuma nyegerin angka yang memang berasal dari data (net worth, rata-rata pengeluaran &amp; tabungan). Asumsi yang kamu set sendiri tidak ikut di-reset.
        </div>
      </NeubruCard>

      {/* ── Legend / How it works ── */}
      <div className="mt-5 nb-panel text-xs text-nb-fg-muted leading-relaxed">
        <span className="font-bold uppercase tracking-wide text-nb-fg">FIRE Formula:</span>{' '}
        FIRE Number = (Monthly Expenses x 12) / Safe Withdrawal Rate, dengan Monthly Expenses =
        rata-rata bulan penuh yang benar-benar ada datanya (bulan berjalan tidak ikut).{' '}
        Years to FI calculated via compound interest with monthly contributions, mulai dari net worth
        live (aset − liability).{' '}
        <span className="font-bold uppercase tracking-wide text-nb-fg">Health Score</span> combines
        savings rate, liquidity runway, debt ratio (dari aset &amp; liability live yang sama), and
        6-month net worth trend.
      </div>
    </div>
  )
}
