'use client'

import { useEffect, useRef, useState } from 'react'

const PHRASES = [
  'Nungguin mantan bales chat...',
  'Ngaduk kopi dulu, bentar...',
  'Lagi mikir keras, jangan ganggu...',
  'Nego harga dulu sama server...',
  'Nyusun kata-kata mutiara...',
  'Sabar ya, loading-nya lagi ngopi...',
  'Bentar, lagi ngitung receh...',
  'Jangan ditutup, nanti nyesel...',
  'Lagi tarik nafas dalem-dalem...',
  'Sedang memproses wangsit...',
  'Mikirin kenapa ayam nyebrang...',
  'Lagi loading, jangan baper...',
  'Nyalain dulu kompornya...',
  'Minta restu orang tua dulu...',
  'Bentar, lagi goreng kerupuk...',
  'Lagi ngecek saldo, kosong...',
  'Mikir keras kek ChatGPT gratisan...',
  'Tungguin hujan reda dulu...',
  'Lagi nyari sinyal di dalem goa...',
  'Bentar, lagi heating pad...',
  'Nungguin jodoh dateng...',
  'Mandi dulu bentar, gerah...',
  'Lagi baca mantra loading...',
  'Jangan lupa minum aer putih...',
  'Server-nya lagi mager bro...',
  'Lagi ngantri di belakang...',
  'Senyum dulu dong buat kamera...',
  'Lagi ngisi bensin dulu...',
  'Bentar ya, lagi stretching...',
  'Ngemil dulu, laper nih...',
  'Lagi nyari kunci motor...',
  'Jangan bosen, hampir jadi...',
  'Lagi meditasi biar tenang...',
  'Ketok-ketok dulu pintunya...',
  'Sedang berdoa biar cepet...',
]

interface Props {
  text?: string
  className?: string
}

export default function LoadingSpinner({ text, className = '' }: Props) {
  const [phrase, setPhrase] = useState('')
  const [exit, setExit] = useState(false)
  const swapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const pickRandom = () => {
      const pool = PHRASES.filter((p) => p !== phrase || PHRASES.length === 1)
      setPhrase(pool[Math.floor(Math.random() * pool.length)] ?? PHRASES[0] ?? 'Loading...')
    }
    pickRandom()
    const interval = setInterval(() => {
      setExit(true)
      swapTimerRef.current = setTimeout(() => {
        swapTimerRef.current = null
        setExit(false)
        const pool = PHRASES.filter((p) => p !== phrase || PHRASES.length === 1)
        setPhrase(pool[Math.floor(Math.random() * pool.length)] ?? PHRASES[0] ?? 'Loading...')
      }, 250)
    }, 2200)
    return () => {
      clearInterval(interval)
      if (swapTimerRef.current) {
        clearTimeout(swapTimerRef.current)
        swapTimerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const displayText = text || phrase

  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-3xl animate-bounce" style={{ animationDuration: '0.6s' }}>🖥️</span>
        <span className="text-3xl animate-bounce" style={{ animationDuration: '0.6s', animationDelay: '0.15s' }}>⌨️</span>
        <span className="text-3xl animate-bounce" style={{ animationDuration: '0.6s', animationDelay: '0.3s' }}>🖱️</span>
      </div>
      <div className="relative overflow-hidden">
        <span
          className={`inline-block text-base font-bold uppercase tracking-[0.06em] text-nb-fg-muted transition-all duration-200 ${
            exit ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
          }`}
        >
          {displayText}
        </span>
      </div>
      <div className="flex gap-1.5">
        <span className="w-2.5 h-2.5 border-2 border-nb-border bg-nb-yellow animate-pulse" />
        <span className="w-2.5 h-2.5 border-2 border-nb-border bg-nb-blue animate-pulse" style={{ animationDelay: '0.2s' }} />
        <span className="w-2.5 h-2.5 border-2 border-nb-border bg-nb-green animate-pulse" style={{ animationDelay: '0.4s' }} />
        <span className="w-2.5 h-2.5 border-2 border-nb-border bg-nb-pink animate-pulse" style={{ animationDelay: '0.6s' }} />
      </div>
    </div>
  )
}
