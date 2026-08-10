import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export function NeubruCard({ children, className = '', onClick }: Props) {
  return (
    <div
      className={`nb-card ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
    >
      {children}
    </div>
  )
}
