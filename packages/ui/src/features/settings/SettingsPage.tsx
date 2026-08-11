import { useEffect, useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useFinanceStore } from '../../stores/financeStore'
import { useVaultStore } from '../../stores/vaultStore'
import { NeubruBtn, NeubruCard, NeubruInput, NeubruSelect, NeubruCheckbox } from '../../components'
import { useRoastStore } from '../../stores/roastStore'
import { toast } from 'sonner'
import { exportCSV } from '../../utils/export'

const CURRENCIES = [
  { value: 'IDR', label: '🇮🇩 IDR — Indonesian Rupiah' },
  { value: 'USD', label: '🇺🇸 USD — US Dollar' },
  { value: 'EUR', label: '🇪🇺 EUR — Euro' },
  { value: 'JPY', label: '🇯🇵 JPY — Japanese Yen' },
  { value: 'SGD', label: '🇸🇬 SGD — Singapore Dollar' },
  { value: 'MYR', label: '🇲🇾 MYR — Malaysian Ringgit' },
  { value: 'THB', label: '🇹🇭 THB — Thai Baht' },
  { value: 'PHP', label: '🇵🇭 PHP — Philippine Peso' },
]

const LOCALES = [
  { value: 'id-ID', label: '🇮🇩 Indonesia' },
  { value: 'en-US', label: '🇺🇸 English (US)' },
  { value: 'en-GB', label: '🇬🇧 English (UK)' },
  { value: 'ja-JP', label: '🇯🇵 Japanese' },
  { value: 'ms-MY', label: '🇲🇾 Malay' },
]

const LOCK_OPTIONS = [
  { value: '5', label: '5 minutes' },
  { value: '10', label: '10 minutes' },
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 hour' },
  { value: '0', label: 'Never' },
]

export default function SettingsPage() {
  const userId = useAuthStore((s) => s.userId)
  const username = useAuthStore((s) => s.username)
  const { settings, loaded, fetchSettings, updateSettings, changePassword } = useSettingsStore()
  const { transactions, fetchAll: fetchFinance } = useFinanceStore()
  const { checkVaultSetup, changeVaultPassword } = useVaultStore()
  const { roastMode, toggleRoast } = useRoastStore()

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [saving, setSaving] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

  // Vault password state
  const [vaultHasPassword, setVaultHasPassword] = useState<boolean | null>(null)
  const [vaultCurrentPw, setVaultCurrentPw] = useState('')
  const [vaultNewPw, setVaultNewPw] = useState('')
  const [vaultConfirmPw, setVaultConfirmPw] = useState('')
  const [vaultSaving, setVaultSaving] = useState(false)

  useEffect(() => { if (userId) fetchSettings(userId) }, [userId, fetchSettings])
  useEffect(() => { if (userId) fetchFinance(userId) }, [userId, fetchFinance])
  useEffect(() => {
    if (userId) checkVaultSetup(userId).then(({ hasPassword }) => setVaultHasPassword(hasPassword))
  }, [userId, checkVaultSetup])

  const update = async (patch: Record<string, any>) => {
    if (!userId) return
    await updateSettings(userId, patch)
    toast.success('Settings saved')
  }

  const handleChangePassword = async () => {
    if (!userId || !currentPw || !newPw) return
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return }
    if (newPw.length < 6) { toast.error('Password must be at least 6 characters'); return }
    setSaving(true)
    const result = await changePassword(userId, currentPw, newPw)
    setSaving(false)
    if (result.ok) {
      toast.success('Password changed successfully')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } else {
      toast.error(result.error || 'Failed to change password')
    }
  }

  const handleVaultPassword = async () => {
    if (!userId || !vaultNewPw) return
    if (vaultNewPw !== vaultConfirmPw) { toast.error('Konfirmasi password tidak cocok'); return }
    if (vaultNewPw.length < 6) { toast.error('Password vault minimal 6 karakter'); return }
    if (vaultHasPassword && !vaultCurrentPw) { toast.error('Masukkan password vault saat ini'); return }
    setVaultSaving(true)
    const result = await changeVaultPassword(userId, vaultHasPassword ? vaultCurrentPw : null, vaultNewPw)
    setVaultSaving(false)
    if (result.ok) {
      toast.success(vaultHasPassword ? 'Password vault berhasil diubah' : 'Password vault berhasil diset!')
      if (result.warning) toast.warning(result.warning)
      setVaultCurrentPw(''); setVaultNewPw(''); setVaultConfirmPw('')
      setVaultHasPassword(true)
    } else {
      toast.error(result.error || 'Gagal mengubah password vault')
    }
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-lg font-bold uppercase text-nb-fg-muted animate-pulse">Loading settings...</span>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-[1.8rem] mb-7">⚙️ Settings</h2>

      {/* Profile */}
      <div className="mb-7">
        <h3 className="mb-3">👤 Profile</h3>
        <NeubruCard>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 border-3 border-nb-border bg-nb-yellow flex items-center justify-center text-2xl font-extrabold">
              {username?.charAt(0).toUpperCase() || '?'}
            </div>
            <div>
              <div className="font-bold text-lg">{username}</div>
              <div className="text-sm text-nb-fg-muted">Account</div>
            </div>
          </div>
        </NeubruCard>
      </div>

      {/* Change Password */}
      <div className="mb-7">
        <h3 className="mb-3">🔑 Change Password</h3>
        <NeubruCard>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Current Password</label>
              <NeubruInput value={currentPw} onChange={setCurrentPw} type="password" placeholder="Enter current password" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">New Password</label>
              <NeubruInput value={newPw} onChange={setNewPw} type="password" placeholder="Enter new password" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Confirm New Password</label>
              <NeubruInput value={confirmPw} onChange={setConfirmPw} type="password" placeholder="Confirm new password" />
            </div>
            <div>
              <NeubruBtn color="blue" onClick={handleChangePassword} disabled={saving}>
                {saving ? '⏳ Changing...' : '🔑 Change Password'}
              </NeubruBtn>
            </div>
          </div>
        </NeubruCard>
      </div>

      {/* Vault Password */}
      <div className="mb-7">
        <h3 className="mb-3">🔐 Vault Password</h3>
        <NeubruCard>
          {vaultHasPassword === null ? (
            <div className="text-sm text-nb-fg-muted animate-pulse">Mengecek status vault...</div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-bold uppercase px-2 py-0.5 border-2 border-nb-border ${vaultHasPassword ? 'bg-nb-green' : 'bg-nb-orange'}`}>
                  {vaultHasPassword ? '✅ Password sudah diset' : '⚠️ Belum ada password'}
                </span>
              </div>
              {!vaultHasPassword && (
                <div className="text-xs text-nb-fg-muted">
                  Set password vault untuk mengenkripsi semua password tersimpan kamu.
                </div>
              )}
              {vaultHasPassword && (
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Password Vault Saat Ini</label>
                  <NeubruInput value={vaultCurrentPw} onChange={setVaultCurrentPw} type="password" placeholder="Masukkan password vault saat ini" />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">
                  {vaultHasPassword ? 'Password Vault Baru' : 'Password Vault'}
                </label>
                <NeubruInput value={vaultNewPw} onChange={setVaultNewPw} type="password" placeholder="Minimal 6 karakter" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Konfirmasi Password</label>
                <NeubruInput value={vaultConfirmPw} onChange={setVaultConfirmPw} type="password" placeholder="Ulangi password" />
              </div>
              {vaultHasPassword && (
                <div className="text-xs text-nb-fg-muted border-l-4 border-nb-orange pl-3">
                  ⚠️ Mengganti password vault akan <strong>re-encrypt</strong> semua entri yang tersimpan.
                  Pastikan kamu ingat password baru ini — tidak bisa di-recover jika lupa.
                </div>
              )}
              <div>
                <NeubruBtn color="purple" onClick={handleVaultPassword} disabled={vaultSaving}>
                  {vaultSaving ? '⏳ Menyimpan...' : vaultHasPassword ? '🔐 Ubah Password Vault' : '🔐 Set Password Vault'}
                </NeubruBtn>
              </div>
            </div>
          )}
        </NeubruCard>
      </div>

      {/* Regional */}
      <div className="mb-7">
        <h3 className="mb-3">🌍 Regional</h3>
        <NeubruCard>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Currency</label>
              <NeubruSelect
                value={settings?.currency || 'IDR'}
                onChange={(v) => update({ currency: v })}
                options={CURRENCIES}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Locale</label>
              <NeubruSelect
                value={settings?.locale || 'id-ID'}
                onChange={(v) => update({ locale: v })}
                options={LOCALES}
              />
            </div>
          </div>
        </NeubruCard>
      </div>

      {/* Security */}
      <div className="mb-7">
        <h3 className="mb-3">🔒 Security</h3>
        <NeubruCard>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Auto-Lock Timeout</label>
            <NeubruSelect
              value={String(settings?.autoLockMinutes ?? 10)}
              onChange={(v) => update({ autoLockMinutes: Number(v) })}
              options={LOCK_OPTIONS}
            />
            <div className="text-xs text-nb-fg-muted mt-1">Lock the vault automatically after inactivity</div>
          </div>
        </NeubruCard>
      </div>

      {/* Data */}
      <div className="mb-7">
        <h3 className="mb-3">📦 Data</h3>
        <NeubruCard>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-sm">Export Transactions (CSV)</div>
                <div className="text-xs text-nb-fg-muted">{transactions.length} transactions</div>
              </div>
              <NeubruBtn size="sm" color="green" onClick={() => exportCSV(transactions)}>📥 CSV</NeubruBtn>
            </div>
            <div className="h-px bg-nb-border" />
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-sm">Export Transactions (PDF)</div>
                <div className="text-xs text-nb-fg-muted">Full report with summary</div>
              </div>
              <NeubruBtn size="sm" color="blue" disabled={pdfLoading} onClick={async () => {
                setPdfLoading(true)
                try {
                  const [{ pdf }, { TransactionPDF: TPDF }, { generatePDFProps: genProps }] = await Promise.all([
                    import('@react-pdf/renderer'),
                    import('../../utils/TransactionPDF'),
                    import('../../utils/export'),
                  ])
                  const blob = await pdf(<TPDF {...genProps(transactions)} />).toBlob()
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a'); a.href = url; a.download = 'transactions.pdf'; a.click()
                  URL.revokeObjectURL(url)
                } catch (e) {
                  toast.error('Gagal membuat PDF')
                } finally {
                  setPdfLoading(false)
                }
              }}>
                {pdfLoading ? '⏳...' : '📥 PDF'}
              </NeubruBtn>
            </div>
          </div>
        </NeubruCard>
      </div>

      {/* Roast Mode */}
      <div className="mb-7">
        <h3 className="mb-3">👻 Roast Mode</h3>
        <NeubruCard>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-sm flex items-center gap-2">
                <span className="text-xl">👻</span> Roast Mode
              </div>
              <div className="text-xs text-nb-fg-muted mt-1">Biar app nge-roast spending lo</div>
            </div>
            <NeubruCheckbox checked={roastMode} onChange={toggleRoast} />
          </div>
        </NeubruCard>
      </div>

      {/* About */}
      <div className="mb-7">
        <h3 className="mb-3">ℹ️ About</h3>
        <NeubruCard>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between"><span className="text-nb-fg-muted">App</span><span className="font-bold">WOS Finance</span></div>
            <div className="flex justify-between"><span className="text-nb-fg-muted">Version</span><span className="font-bold">0.1.0</span></div>
            <div className="flex justify-between"><span className="text-nb-fg-muted">Transactions</span><span className="font-bold">{transactions.length}</span></div>
          </div>
        </NeubruCard>
      </div>
    </div>
  )
}
