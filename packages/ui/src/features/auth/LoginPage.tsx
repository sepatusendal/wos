import { useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { NeubruInput } from '../../components'

interface Props {
  onLoginSuccess: () => void
}

export default function LoginPage({ onLoginSuccess }: Props) {
  const { login, register } = useAuthStore()
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!username || !password) {
      setError('Username and password are required')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    const result = isRegister
      ? await register(username, password)
      : await login(username, password)
    setLoading(false)
    if (result.ok) {
      onLoginSuccess()
    } else {
      setError(result.error ?? 'Failed')
    }
  }

  const switchMode = () => { setIsRegister(!isRegister); setError('') }

  return (
    <div className="min-h-screen bg-nb-bg flex items-center justify-center p-6">
      <div className="w-full max-w-[440px]">
        <div className="bg-white border-4 border-nb-border shadow-nb-lg overflow-hidden">
          <div className="bg-nb-yellow border-b-4 border-nb-border px-8 pt-8 pb-6 flex flex-col items-center text-center">
            <div className="text-[3.4rem] leading-none mb-4">🖥️</div>
            <h1 className="text-5xl font-black leading-none tracking-tight">WOS</h1>
            <p className="mt-2.5 text-[0.68rem] font-bold uppercase tracking-[0.28em] text-nb-fg/70">
              Wira Operating System
            </p>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-2 gap-2 mb-7">
              <button
                type="button"
                onClick={switchMode}
                className={`py-3 font-extrabold text-sm uppercase tracking-wider border-2 border-nb-border transition-all cursor-pointer ${
                  !isRegister
                    ? 'bg-nb-blue text-white shadow-nb-sm'
                    : 'bg-white text-nb-fg hover:bg-nb-bg'
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={switchMode}
                className={`py-3 font-extrabold text-sm uppercase tracking-wider border-2 border-nb-border transition-all cursor-pointer ${
                  isRegister
                    ? 'bg-nb-green text-white shadow-nb-sm'
                    : 'bg-white text-nb-fg hover:bg-nb-bg'
                }`}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-5 mb-7">
                <label className="flex flex-col gap-1.5">
                  <span className="font-bold text-[0.7rem] uppercase tracking-[0.22em] text-nb-fg">Username</span>
                  <NeubruInput value={username} onChange={setUsername} placeholder="e.g. admin" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-bold text-[0.7rem] uppercase tracking-[0.22em] text-nb-fg">Password</span>
                  <NeubruInput value={password} onChange={setPassword} placeholder="••••••••" type="password" onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e as any)} />
                </label>
              </div>

              {error && (
                <div className="bg-nb-red text-white font-bold text-sm p-3.5 border-2 border-nb-border shadow-nb-sm mb-6">
                  ⚠️ {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-4 font-extrabold text-lg uppercase tracking-[0.15em] border-4 border-nb-border shadow-nb transition-all cursor-pointer ${
                  isRegister ? 'bg-nb-green text-white' : 'bg-nb-blue text-white'
                } hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-60 disabled:cursor-wait`}
              >
                {loading ? 'Submitting...' : isRegister ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 text-center text-xs font-bold uppercase tracking-wider text-nb-fg-muted">
              {isRegister ? (
                <button type="button" onClick={switchMode} className="underline underline-offset-4 hover:text-nb-fg cursor-pointer">
                  Already have an account? Login
                </button>
              ) : (
                <span>Data is stored locally on your device</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-between mt-5 px-1">
          <div className="w-5 h-5 bg-nb-pink border-2 border-nb-border" />
          <div className="w-5 h-5 bg-nb-green border-2 border-nb-border" />
          <div className="w-5 h-5 bg-nb-blue border-2 border-nb-border" />
          <div className="w-5 h-5 bg-nb-purple border-2 border-nb-border" />
          <div className="w-5 h-5 bg-nb-orange border-2 border-nb-border" />
        </div>
      </div>
    </div>
  )
}
