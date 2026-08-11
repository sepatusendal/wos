'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  pageKey: string
  children: ReactNode
  className?: string
}

export default function PageTransition({ pageKey, children, className = '' }: Props) {
  const [displayedKey, setDisplayedKey] = useState(pageKey)
  const [exiting, setExiting] = useState(false)
  const [entering, setEntering] = useState(false)
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (pageKey === displayedKey) return

    // Start exit animation on old content
    setExiting(true)

    const swapTimer = setTimeout(() => {
      setDisplayedKey(pageKey)
      setExiting(false)
      setEntering(true)

      // Clear entering after animation completes
      enterTimerRef.current = setTimeout(() => {
        enterTimerRef.current = null
        setEntering(false)
      }, 350)
    }, 200)

    return () => {
      clearTimeout(swapTimer)
      if (enterTimerRef.current) {
        clearTimeout(enterTimerRef.current)
        enterTimerRef.current = null
      }
    }
  }, [pageKey, displayedKey])

  return (
    <div className={`relative ${className}`}>
      <div
        key={displayedKey}
        className={`transition-all duration-200 ${
          exiting
            ? 'opacity-0 translate-y-2 scale-[0.98]'
            : entering
              ? 'animate-page-enter'
              : 'opacity-100 translate-y-0 scale-100'
        }`}
      >
        {children}
      </div>
    </div>
  )
}
