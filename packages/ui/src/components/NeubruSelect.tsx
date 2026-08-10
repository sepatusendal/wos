interface Props {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  className?: string
}

export function NeubruSelect({ value, onChange, options, className = '' }: Props) {
  return (
    <select className={`nb-select ${className}`} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
