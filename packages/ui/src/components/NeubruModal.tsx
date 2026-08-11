import { useEffect, type ReactNode } from 'react'
import { NeubruBtn } from './NeubruBtn'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function NeubruModal({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="nb-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="nb-modal" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl">{title}</h2>
          <NeubruBtn size="sm" onClick={onClose}>✕</NeubruBtn>
        </div>
        {children}
      </div>
    </div>
  )
}
