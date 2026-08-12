import { useState } from 'react'
import { toast } from 'sonner'
import { useAuthStore } from '../../stores/authStore'
import { useVaultStore } from '../../stores/vaultStore'
import { NeubruBtn, NeubruCard, NeubruInput, NeubruSelect, NeubruModal, NeubruTag } from '../../components'
import type { VaultEntry, VaultCategory } from '@wos/shared'

const CATEGORIES: { value: VaultCategory; label: string }[] = [
  { value: 'email', label: '📧 Email' }, { value: 'banking', label: '🏦 Banking' },
  { value: 'social', label: '💬 Social' }, { value: 'work', label: '💼 Work' },
  { value: 'entertainment', label: '🎮 Hiburan' }, { value: 'shopping', label: '🛒 Belanja' },
  { value: 'other', label: '📦 Lain' },
]
const CAT_COLORS: Record<string, 'blue' | 'green' | 'pink' | 'purple' | 'orange' | 'yellow'> = {
  email: 'blue', banking: 'green', social: 'pink', work: 'purple', entertainment: 'orange', shopping: 'yellow', other: 'yellow',
}

// Clipboard is wiped this long after a copy — standard password-manager behavior.
const CLIPBOARD_CLEAR_MS = 30000
const PW_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{}'

function generatePassword(): string {
  // crypto.getRandomValues, not Math.random — this is a password manager.
  const lengths = new Uint32Array(1)
  crypto.getRandomValues(lengths)
  const len = 16 + ((lengths[0] ?? 0) % 5) // 16–20
  const bytes = new Uint32Array(len)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < len; i++) out += PW_CHARS[(bytes[i] ?? 0) % PW_CHARS.length]
  // Guarantee at least one of each class (uppercase/lowercase/digit/symbol).
  if (!/[A-Z]/.test(out) || !/[a-z]/.test(out) || !/[0-9]/.test(out) || !/[^A-Za-z0-9]/.test(out)) return generatePassword()
  return out
}

export default function VaultPage() {
  const userId = useAuthStore((s) => s.userId)
  const { entries, vaultKey, decryptFailures, unlock, lock, addEntry, editEntry, deleteEntry } = useVaultStore()
  const [vaultPass, setVaultPass] = useState('')
  const [vaultError, setVaultError] = useState('')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [service, setService] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [url, setUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [category, setCategory] = useState<VaultCategory>('other')
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [categoryFilter, setCategoryFilter] = useState<VaultCategory | ''>('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())

  const handleUnlock = async () => {
    if (!userId || !vaultPass) return
    setVaultError('')
    const result = await unlock(userId, vaultPass)
    if (!result.ok) {
      setVaultError(result.error ?? 'Gagal unlock')
    }
  }

  const handleLock = () => {
    lock()
  }

  const openAdd = () => { setEditId(null); setService(''); setUsername(''); setPassword(''); setUrl(''); setNotes(''); setCategory('other'); setShowPassword(false); setShowModal(true) }
  const openEdit = (e: VaultEntry) => {
    setEditId(e.id); setService(e.service); setUsername(e.username); setShowPassword(false)
    setPassword(e.password); setUrl(e.url ?? ''); setNotes(e.notes ?? ''); setCategory(e.category); setShowModal(true)
  }

  const save = async () => {
    if (!userId || !service || !username || !password) return
    if (!useVaultStore.getState().vaultKey) {
      toast.error('Vault terkunci — buka kembali sebelum menyimpan')
      return
    }
    if (editId) { await editEntry({ id: editId, service, username, password, url, notes, category }) }
    else { await addEntry(userId, { service, username, password, url, notes, category }) }
    setShowModal(false)
  }

  const toggleReveal = (id: string) => {
    setRevealed((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  // key = `${entryId}:${field}` so the "✓ Tersalin" confirmation lands on the exact button clicked.
  const copy = async (text: string, key: string, label = 'Password') => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} disalin`)
      setCopiedKey(key)
      setTimeout(() => { setCopiedKey((k) => (k === key ? null : k)) }, 2000)
      setTimeout(() => {
        navigator.clipboard.writeText('').then(() => { toast.info('Clipboard dibersihkan') }).catch(() => {})
      }, CLIPBOARD_CLEAR_MS)
    } catch {
      toast.error('Gagal menyalin')
    }
  }

  const toggleNotes = (id: string) => {
    setExpandedNotes((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  const filtered = entries.filter((e) => {
    const q = search.toLowerCase()
    const matchesText = !q || e.service.toLowerCase().includes(q) || e.username.toLowerCase().includes(q)
    const matchesCategory = categoryFilter ? e.category === categoryFilter : true
    return matchesText && matchesCategory
  })

  if (!vaultKey) {
    return (
      <div>
        <div className="flex items-start justify-between mb-7 gap-4 flex-wrap">
          <h2 className="text-[1.8rem]">🔐 Vault</h2>
        </div>
        <div className="flex justify-center pt-20">
          <div className="nb-panel max-w-[420px] w-full text-center p-10">
            <div className="text-5xl mb-3">🔐</div>
            <h2 className="text-lg mb-2">Vault Terkunci</h2>
            <p className="text-nb-fg-muted mb-5 text-sm">Masukkan password vault</p>
            <NeubruInput value={vaultPass} onChange={setVaultPass} type="password" placeholder="Password vault..." onKeyDown={(e) => e.key === 'Enter' && handleUnlock()} />
            {vaultError && <div className="bg-nb-red text-white font-bold text-sm p-2.5 border-nb mt-3">{vaultError}</div>}
            <div className="mt-4"><NeubruBtn color="blue" onClick={handleUnlock}>🔓 Buka Vault</NeubruBtn></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-7 gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-[1.8rem]">🔐 Vault</h2>
          <NeubruTag label="🔓 Terbuka" color="green" />
        </div>
        <div className="flex gap-2.5">
          <NeubruBtn color="orange" onClick={handleLock}>🔒 Lock</NeubruBtn>
          <NeubruBtn color="green" onClick={openAdd}>+ Entry</NeubruBtn>
        </div>
      </div>

      {decryptFailures > 0 && (
        <NeubruCard className="mb-4 !p-4 !bg-nb-red/10 !border-nb-red">
          <div className="text-sm font-bold text-nb-red">
            ⚠️ {decryptFailures} entri gagal didekripsi dan disembunyikan dari daftar — kemungkinan sisa migrasi password vault yang tidak selesai. Data-nya masih ada di database, coba unlock ulang; kalau tetap gagal, hubungi dukungan sebelum entri lain diubah.
          </div>
        </NeubruCard>
      )}

      <NeubruCard className="mb-4 !p-4">
        <div className="mb-3"><NeubruInput value={search} onChange={setSearch} placeholder="🔍 Cari..." /></div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((c) => (
            <NeubruBtn key={c.value} size="sm" color={categoryFilter === c.value ? CAT_COLORS[c.value] : undefined} onClick={() => setCategoryFilter(categoryFilter === c.value ? '' : c.value)}>{c.label}</NeubruBtn>
          ))}
        </div>
      </NeubruCard>

      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="nb-panel text-center py-16"><div className="text-5xl mb-3">🔐</div><div className="font-bold uppercase text-nb-fg-muted">{entries.length === 0 ? 'Belum ada entry' : 'Tidak ditemukan'}</div></div>
        ) : filtered.map((e) => (
          <NeubruCard key={e.id}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-extrabold text-base">{e.service}</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-nb-fg-muted break-all">{e.username}</span>
                  <button className="text-xs font-bold uppercase border-2 border-nb-border bg-white px-2 py-0.5 shadow-nb-sm cursor-pointer hover:bg-nb-yellow active:translate-x-px active:translate-y-px active:shadow-none" onClick={() => copy(e.username, `${e.id}:username`, 'Username')}>{copiedKey === `${e.id}:username` ? '✓ Tersalin' : 'Copy'}</button>
                </div>
              </div>
              <NeubruTag label={CATEGORIES.find((c) => c.value === e.category)?.label || e.category} color={CAT_COLORS[e.category] || 'yellow'} />
            </div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono text-sm font-semibold flex-1 break-all">{revealed.has(e.id) ? e.password : '•'.repeat(Math.min(e.password.length, 16))}</span>
              <button className="text-xs font-bold uppercase border-2 border-nb-border bg-white px-2 py-1 shadow-nb-sm cursor-pointer hover:bg-nb-yellow active:translate-x-px active:translate-y-px active:shadow-none" onClick={() => toggleReveal(e.id)}>{revealed.has(e.id) ? 'Sembunyi' : 'Lihat'}</button>
              <button className="text-xs font-bold uppercase border-2 border-nb-border bg-white px-2 py-1 shadow-nb-sm cursor-pointer hover:bg-nb-yellow active:translate-x-px active:translate-y-px active:shadow-none" onClick={() => copy(e.password, `${e.id}:password`)}>{copiedKey === `${e.id}:password` ? '✓ Tersalin' : 'Copy'}</button>
            </div>
            {e.url && (
              <div className="mb-1.5">
                <a href={/^https?:\/\//i.test(e.url!) ? e.url : `https://${e.url}`} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-nb-blue underline break-all">🔗 Buka</a>
              </div>
            )}
            {e.notes && (
              <div className="text-xs text-nb-fg-muted font-medium mb-1.5">
                <span className={expandedNotes.has(e.id) ? 'whitespace-pre-wrap break-words' : 'inline-block max-w-[70%] truncate align-bottom'}>📝 {e.notes}</span>
                <button className="ml-2 font-bold uppercase underline cursor-pointer bg-none border-none" onClick={() => toggleNotes(e.id)}>{expandedNotes.has(e.id) ? 'Tutup' : 'Lihat'}</button>
              </div>
            )}
            <div className="flex gap-1.5 mt-2">
              <NeubruBtn size="sm" color="yellow" onClick={() => openEdit(e)}>✎ Edit</NeubruBtn>
              <NeubruBtn size="sm" color="red" onClick={() => deleteEntry(e.id)}>✕ Hapus</NeubruBtn>
            </div>
          </NeubruCard>
        ))}
      </div>

      <NeubruModal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Entry' : 'Tambah Entry'}>
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Service</label>
          <NeubruInput value={service} onChange={setService} placeholder="Google, BCA..." onKeyDown={(e) => e.key === 'Enter' && save()} />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Username</label>
            <NeubruInput value={username} onChange={setUsername} placeholder="johndoe" onKeyDown={(e) => e.key === 'Enter' && save()} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Password</label>
            <div className="flex gap-1.5 items-center">
              <div className="flex-1 min-w-0"><NeubruInput value={password} onChange={setPassword} type={showPassword ? 'text' : 'password'} placeholder="••••" onKeyDown={(e) => e.key === 'Enter' && save()} /></div>
              <button type="button" title={showPassword ? 'Sembunyikan' : 'Lihat'} className="text-xs font-bold uppercase border-2 border-nb-border bg-white px-2 py-1.5 shadow-nb-sm cursor-pointer hover:bg-nb-yellow active:translate-x-px active:translate-y-px active:shadow-none" onClick={() => setShowPassword(!showPassword)}>{showPassword ? '🙈' : '👁'}</button>
              <button type="button" title="Generate password" className="text-xs font-bold uppercase border-2 border-nb-border bg-white px-2 py-1.5 shadow-nb-sm cursor-pointer hover:bg-nb-yellow active:translate-x-px active:translate-y-px active:shadow-none" onClick={() => { setPassword(generatePassword()); setShowPassword(true) }}>🎲</button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">URL</label>
            <NeubruInput value={url} onChange={setUrl} placeholder="https://" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Kategori</label>
            <NeubruSelect value={category} onChange={(v) => setCategory(v as VaultCategory)} options={CATEGORIES} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opsional..." rows={3} className="border-2 border-nb-border bg-white px-3 py-2 text-sm font-medium outline-none resize-y w-full" style={{ fontFamily: "inherit" }} />
        </div>
        <NeubruBtn color="green" onClick={save}>💾 Simpan</NeubruBtn>
      </NeubruModal>
    </div>
  )
}
