interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  size?: 'sm' | 'md'
  className?: string
}

export function NeubruInput({ value, onChange, placeholder, type = 'text', size = 'md', className = '' }: Props) {
  return (
    <input
      type={type}
      className={`nb-input ${size === 'sm' ? 'nb-input-sm' : ''} ${className}`.trim()}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  )
}
