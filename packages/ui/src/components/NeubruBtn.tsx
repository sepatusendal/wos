import { type ButtonHTMLAttributes, type ReactNode } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  color?: 'yellow' | 'blue' | 'green' | 'pink' | 'orange' | 'purple' | 'red'
  size?: 'sm' | 'md'
  children: ReactNode
}

const colorMap: Record<string, string> = {
  yellow: 'bg-nb-yellow hover:bg-nb-yellow',
  blue: 'bg-nb-blue hover:bg-nb-blue',
  green: 'bg-nb-green hover:bg-nb-green',
  pink: 'bg-nb-pink hover:bg-nb-pink',
  orange: 'bg-nb-orange hover:bg-nb-orange',
  purple: 'bg-nb-purple hover:bg-nb-purple',
  red: 'bg-nb-red hover:bg-nb-red text-white',
}

export function NeubruBtn({ color, size = 'md', children, className = '', ...props }: Props) {
  return (
    <button
      className={`nb-btn ${size === 'sm' ? 'nb-btn-sm' : ''} ${color ? colorMap[color] : ''} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  )
}
