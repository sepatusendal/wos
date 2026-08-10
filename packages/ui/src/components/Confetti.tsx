import { useEffect, useState, useCallback } from 'react'

const NB_COLORS = [
  '#ffd800', // yellow
  '#2f6bff', // blue
  '#22c55e', // green
  '#ff5c8a', // pink
  '#ff8a00', // orange
  '#8b5cf6', // purple
  '#ff4b4b', // red
]

interface Particle {
  id: number
  x: number
  y: number
  color: string
  rotation: number
  scale: number
  delay: number
}

export default function Confetti() {
  const [particles, setParticles] = useState<Particle[]>([])
  const [active, setActive] = useState(false)

  const fire = useCallback(() => {
    const newParticles: Particle[] = Array.from({ length: 30 }, (_, i) => ({
      id: Date.now() + i,
      x: Math.random() * 100,
      y: -10 - Math.random() * 20,
      color: NB_COLORS[Math.floor(Math.random() * NB_COLORS.length)]!,
      rotation: Math.random() * 360,
      scale: 0.6 + Math.random() * 1.2,
      delay: Math.random() * 0.3,
    }))
    setParticles(newParticles)
    setActive(true)

    // Auto-cleanup
    setTimeout(() => {
      setActive(false)
      setTimeout(() => setParticles([]), 2500)
    }, 2000)
  }, [])

  useEffect(() => {
    ;(window as any).__wosConfetti = fire
    return () => {
      delete (window as any).__wosConfetti
    }
  }, [fire])

  if (particles.length === 0) return null

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden"
      aria-hidden="true"
    >
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.x}%`,
            top: active ? '110%' : `${p.y}%`,
            width: `${10 * p.scale}px`,
            height: `${10 * p.scale}px`,
            backgroundColor: p.color,
            border: '2px solid #1a1a1c',
            transform: `rotate(${active ? p.rotation + 720 : p.rotation}deg)`,
            opacity: active ? 0 : 1,
            transition: active
              ? `top 2s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${p.delay}s, transform 2s ease-out ${p.delay}s, opacity 0.3s ease-in 1.7s`
              : 'none',
          }}
        />
      ))}
    </div>
  )
}
