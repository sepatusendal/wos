import { useEffect, useRef, type ReactNode } from 'react'
import { NeubruBtn } from './NeubruBtn'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function NeubruModal({ open, onClose, title, children }: Props) {
  const modalRef = useRef<HTMLDivElement>(null)
  const prevFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Focus management: autofocus in, trap Tab inside, restore focus on close
  useEffect(() => {
    if (!open) return
    const node = modalRef.current
    if (!node) return

    prevFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const focusables = () => Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    const firstInside = focusables()[0]
    ;(firstInside ?? node).focus()

    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = focusables()
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) {
        e.preventDefault()
        node.focus()
        return
      }
      const active = document.activeElement
      if (e.shiftKey) {
        if (active === first || active === node) {
          e.preventDefault()
          last.focus()
        }
      } else if (active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    node.addEventListener('keydown', trap)
    return () => {
      node.removeEventListener('keydown', trap)
      prevFocusRef.current?.focus()
      prevFocusRef.current = null
    }
  }, [open])

  if (!open) return null
  return (
    <div className="nb-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="nb-modal" ref={modalRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl">{title}</h2>
          <NeubruBtn size="sm" onClick={onClose}>✕</NeubruBtn>
        </div>
        {children}
      </div>
    </div>
  )
}
