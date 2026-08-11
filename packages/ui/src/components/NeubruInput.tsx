interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  size?: 'sm' | 'md'
  className?: string
  onKeyDown?: (e: React.KeyboardEvent) => void
}

export function NeubruInput({ value, onChange, placeholder, type = 'text', size = 'md', className = '', onKeyDown }: Props) {
  return (
    <input
      type={type}
      className={`nb-input ${size === 'sm' ? 'nb-input-sm' : ''} ${className}`.trim()}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => { const v = (e.target as HTMLInputElement).value; if (type === 'date' && v !== value) onChange(v) }}
      placeholder={placeholder}
      onKeyDown={onKeyDown}
    />
  )
}
