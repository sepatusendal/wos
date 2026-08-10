import { useState, useMemo } from 'react'
import { useFormatCurrency } from '../../stores/useFormatCurrency'

interface AmortRow {
  month: number
  payment: number
  interest: number
  principal: number
  balance: number
}

export function LoanCalculator() {
  const formatCurrency = useFormatCurrency()
  const [loanAmount, setLoanAmount] = useState(100000000)
  const [interestRate, setInterestRate] = useState(10)
  const [termYears, setTermYears] = useState(5)
  const [extraPayment, setExtraPayment] = useState(0)

  const result = useMemo(() => {
    const monthlyRate = interestRate / 100 / 12
    const totalMonths = termYears * 12
    const standardPayment =
      monthlyRate > 0
        ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
          (Math.pow(1 + monthlyRate, totalMonths) - 1)
        : loanAmount / totalMonths

    // Standard amortization schedule
    let balance = loanAmount
    const schedule: AmortRow[] = []
    let totalStandardInterest = 0
    for (let i = 1; i <= Math.min(totalMonths, 12); i++) {
      const interest = Math.round(balance * monthlyRate)
      const principal = Math.round(standardPayment - interest)
      totalStandardInterest += interest
      balance = Math.max(0, balance - principal)
      schedule.push({
        month: i,
        payment: Math.round(standardPayment),
        interest,
        principal,
        balance,
      })
    }

    // Calc standard total
    let stdBalance = loanAmount
    let stdTotalInterest = 0
    let stdMonths = totalMonths
    for (let i = 0; i < totalMonths; i++) {
      const interest = stdBalance * monthlyRate
      const principal = Math.min(standardPayment - interest, stdBalance)
      stdTotalInterest += interest
      stdBalance -= principal
      if (stdBalance <= 0) {
        stdMonths = i + 1
        break
      }
    }

    // Accelerated with extra payment
    const accPayment = standardPayment + extraPayment
    let accBalance = loanAmount
    let accTotalInterest = 0
    let accMonths = 0
    for (let i = 0; i < totalMonths * 2 && accBalance > 0; i++) {
      const interest = accBalance * monthlyRate
      const principal = Math.min(accPayment - interest, accBalance)
      accTotalInterest += interest
      accBalance -= principal
      accMonths = i + 1
    }

    const interestSaved = stdTotalInterest - accTotalInterest
    const monthsSaved = stdMonths - accMonths
    const yearsSaved = monthsSaved / 12

    return {
      standardPayment: Math.round(standardPayment),
      schedule,
      stdTotalInterest: Math.round(stdTotalInterest),
      stdMonths,
      accPayment: Math.round(accPayment),
      accTotalInterest: Math.round(accTotalInterest),
      accMonths,
      interestSaved: Math.round(Math.max(0, interestSaved)),
      monthsSaved: Math.max(0, monthsSaved),
      yearsSaved: Math.max(0, yearsSaved),
    }
  }, [loanAmount, interestRate, termYears, extraPayment])

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-black uppercase mb-2">🏦 Loan Payoff Simulator</h3>
        <p className="text-xs text-nb-fg-muted font-medium">
          See how extra payments accelerate your loan payoff and save you interest.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-nb-fg-muted block mb-1.5">Loan Amount</label>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-xs">Rp</span>
            <input
              type="number"
              value={loanAmount}
              onChange={(e) => setLoanAmount(Math.max(1000000, Number(e.target.value) || 0))}
              className="nb-input nb-input-sm flex-1"
              min={1000000}
              step={1000000}
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-nb-fg-muted block mb-1.5">Interest Rate (%/yr)</label>
          <input
            type="number"
            value={interestRate}
            onChange={(e) => setInterestRate(Math.max(0, Math.min(50, Number(e.target.value) || 0)))}
            className="nb-input nb-input-sm w-full"
            min={0}
            max={50}
            step={0.5}
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-nb-fg-muted block mb-1.5">Term (Years)</label>
          <input
            type="number"
            value={termYears}
            onChange={(e) => setTermYears(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
            className="nb-input nb-input-sm w-full"
            min={1}
            max={30}
          />
        </div>
      </div>

      {/* Extra Payment Slider */}
      <div className="nb-card mb-6 !bg-nb-bg">
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-bold uppercase tracking-wider text-nb-fg-muted">Extra Payment / Month</label>
          <span className="font-mono font-bold text-sm text-nb-green">
            +{formatCurrency(extraPayment)}
          </span>
        </div>
        <input
          type="range"
          value={extraPayment}
          onChange={(e) => setExtraPayment(Number(e.target.value))}
          min={0}
          max={Math.round(result.standardPayment * 2)}
          step={100000}
          className="w-full accent-nb-green mb-2"
          style={{ height: '24px' }}
        />
        <div className="flex justify-between text-[10px] text-nb-fg-muted font-mono">
          <span>{formatCurrency(0)}</span>
          <span>{formatCurrency(Math.round(result.standardPayment * 2))}</span>
        </div>

        {extraPayment > 0 && (
          <div className="mt-3 p-2 border-2 border-nb-green bg-nb-green/10">
            <span className="font-bold text-xs text-nb-green">
              +{formatCurrency(extraPayment)}/bulan → lunas {Math.round(result.yearsSaved * 10) / 10} tahun lebih cepat, hemat bunga {formatCurrency(result.interestSaved)}
            </span>
          </div>
        )}
      </div>

      {/* Comparison Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="nb-card">
          <div className="text-xs font-bold uppercase text-nb-fg-muted mb-2">Standard Plan</div>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-xs text-nb-fg-muted">Monthly Payment</span>
              <span className="font-mono font-bold text-xs">{formatCurrency(result.standardPayment)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-nb-fg-muted">Total Interest</span>
              <span className="font-mono font-bold text-xs text-nb-red">{formatCurrency(result.stdTotalInterest)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-nb-fg-muted">Payoff Time</span>
              <span className="font-mono font-bold text-xs">{result.stdMonths} months ({(result.stdMonths / 12).toFixed(1)}y)</span>
            </div>
          </div>
        </div>

        <div className="nb-card">
          <div className="text-xs font-bold uppercase text-nb-fg-muted mb-2">Accelerated Plan</div>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-xs text-nb-fg-muted">Monthly Payment</span>
              <span className="font-mono font-bold text-xs text-nb-green">{formatCurrency(result.accPayment)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-nb-fg-muted">Total Interest</span>
              <span className="font-mono font-bold text-xs text-nb-green">{formatCurrency(result.accTotalInterest)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-nb-fg-muted">Payoff Time</span>
              <span className="font-mono font-bold text-xs text-nb-green">{result.accMonths} months ({(result.accMonths / 12).toFixed(1)}y)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Timeline */}
      <div className="nb-card mb-6">
        <div className="text-xs font-bold uppercase text-nb-fg-muted mb-3">Payoff Timeline Comparison</div>
        <div className="flex flex-col gap-3">
          {/* Standard bar */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-nb-fg-muted w-16 shrink-0">Standard</span>
            <div className="flex-1 h-8 bg-nb-bg border-2 border-nb-border overflow-hidden relative">
              <div
                className="h-full bg-nb-red/30 absolute left-0 top-0 flex items-center justify-end px-2"
                style={{ width: `${Math.min(100, (result.stdMonths / (termYears * 12)) * 100)}%` }}
              >
                <span className="text-[9px] font-bold text-nb-red">{result.stdMonths}m</span>
              </div>
            </div>
          </div>
          {/* Accelerated bar */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-nb-green w-16 shrink-0">Accel.</span>
            <div className="flex-1 h-8 bg-nb-bg border-2 border-nb-border overflow-hidden relative">
              <div
                className="h-full bg-nb-green/30 absolute left-0 top-0 flex items-center justify-end px-2"
                style={{ width: `${Math.min(100, (result.accMonths / (termYears * 12)) * 100)}%` }}
              >
                <span className="text-[9px] font-bold text-nb-green">{result.accMonths}m</span>
              </div>
            </div>
          </div>
        </div>
        <div className="text-[10px] text-nb-fg-muted mt-2 font-medium">
          Total timeline: {termYears * 12} months | Max bar width = full term
        </div>
      </div>

      {/* Amortization Table (first 12 months) */}
      <div className="nb-card">
        <div className="text-xs font-bold uppercase text-nb-fg-muted mb-3">Amortization Schedule (First 12 Months)</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-2 border-nb-border">
            <thead>
              <tr className="bg-nb-bg border-b-2 border-nb-border">
                <th className="p-2 text-left font-bold uppercase text-[10px] tracking-wider">Month</th>
                <th className="p-2 text-right font-bold uppercase text-[10px] tracking-wider">Payment</th>
                <th className="p-2 text-right font-bold uppercase text-[10px] tracking-wider">Interest</th>
                <th className="p-2 text-right font-bold uppercase text-[10px] tracking-wider">Principal</th>
                <th className="p-2 text-right font-bold uppercase text-[10px] tracking-wider">Balance</th>
              </tr>
            </thead>
            <tbody>
              {result.schedule.map((row) => (
                <tr key={row.month} className="border-b border-nb-border/30 hover:bg-nb-yellow/10">
                  <td className="p-2 font-bold">{row.month}</td>
                  <td className="p-2 text-right font-mono">{formatCurrency(row.payment)}</td>
                  <td className="p-2 text-right font-mono text-nb-red">{formatCurrency(row.interest)}</td>
                  <td className="p-2 text-right font-mono text-nb-green">{formatCurrency(row.principal)}</td>
                  <td className="p-2 text-right font-mono text-nb-fg-muted">{formatCurrency(row.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {termYears * 12 > 12 && (
          <div className="text-[10px] text-nb-fg-muted mt-2 font-medium">
            Showing first 12 of {termYears * 12} months
          </div>
        )}
      </div>
    </div>
  )
}
