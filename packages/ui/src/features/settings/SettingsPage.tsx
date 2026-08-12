import { useEffect, useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useFinanceStore } from '../../stores/financeStore'
import { useVaultStore } from '../../stores/vaultStore'
import { useTodoStore } from '../../stores/todoStore'
import { useNotesStore } from '../../stores/notesStore'
import { useHabitStore } from '../../stores/habitStore'
import { useWealthStore } from '../../stores/wealthStore'
import { useLiabilityStore } from '../../stores/liabilityStore'
import { useSubscriptionStore } from '../../stores/subscriptionStore'
import { NeubruBtn, NeubruCard, NeubruInput, NeubruSelect, NeubruCheckbox, NeubruModal } from '../../components'
import { useRoastStore } from '../../stores/roastStore'
import { useUpdaterStore } from '../../stores/updaterStore'
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
  { value: '5', label: '5 menit' },
  { value: '10', label: '10 menit' },
  { value: '15', label: '15 menit' },
  { value: '30', label: '30 menit' },
  { value: '60', label: '1 jam' },
  { value: '0', label: 'Tidak pernah' },
]

const THEMES: { value: 'light' | 'dark' | 'system'; label: string }[] = [
  { value: 'light', label: '☀️ Terang' },
  { value: 'dark', label: '🌙 Gelap' },
  { value: 'system', label: '💻 Sistem' },
]

export default function SettingsPage() {
  const userId = useAuthStore((s) => s.userId)
  const username = useAuthStore((s) => s.username)
  const { settings, loaded, fetchSettings, updateSettings, changePassword } = useSettingsStore()
  const resolvedTheme = useSettingsStore((s) => s.resolvedTheme)
  const { transactions, fetchAll: fetchFinance } = useFinanceStore()
  const { checkVaultSetup, changeVaultPassword } = useVaultStore()
  const { roastMode, toggleRoast } = useRoastStore()
  const updater = useUpdaterStore()

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
  const [exporting, setExporting] = useState(false)

  useEffect(() => { if (userId) fetchSettings(userId) }, [userId, fetchSettings])
  useEffect(() => { if (userId) fetchFinance(userId) }, [userId, fetchFinance])
  useEffect(() => {
    if (userId) checkVaultSetup(userId).then(({ hasPassword }) => setVaultHasPassword(hasPassword))
  }, [userId, checkVaultSetup])

  // Nothing else in the app applies the resolved theme to the DOM yet, so do it
  // here. Caveat: this only runs while the Settings page is mounted — a proper
  // fix belongs at the app root (AppLayout / providers).
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
  }, [resolvedTheme])

  const update = async (patch: Record<string, any>) => {
    if (!userId) return
    await updateSettings(userId, patch)
    toast.success('Pengaturan disimpan')
  }

  const handleExportAll = async () => {
    if (!userId) return
    setExporting(true)
    try {
      // Pull fresh data — the user may never have opened these pages this session
      await Promise.all([
        useFinanceStore.getState().fetchAll(userId),
        useTodoStore.getState().fetchAll(userId),
        useNotesStore.getState().fetchAll(userId),
        useHabitStore.getState().fetchAll(userId),
        useWealthStore.getState().fetchAll(userId),
        useLiabilityStore.getState().fetchAll(userId),
        useSubscriptionStore.getState().fetchAll(userId),
      ])

      const finance = useFinanceStore.getState()
      const habit = useHabitStore.getState()

      // NOTE: vault entries are deliberately excluded — decrypted passwords must
      // never end up in a plaintext backup file.
      const data = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        app: 'WOS',
        userId,
        settings,
        transactions: finance.transactions,
        budgets: finance.budgets,
        accounts: finance.accounts,
        recurring: finance.recurring,
        todos: useTodoStore.getState().todos,
        notes: useNotesStore.getState().notes,
        habits: habit.habits,
        habitLogs: habit.logs,
        assets: useWealthStore.getState().assets,
        liabilities: useLiabilityStore.getState().liabilities,
        subscriptions: useSubscriptionStore.getState().subscriptions,
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `wos-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Semua data berhasil diekspor')
    } catch {
      toast.error('Gagal mengekspor data')
    } finally {
      setExporting(false)
    }
  }

  const [pendingCurrency, setPendingCurrency] = useState<string | null>(null)
  const requestCurrencyChange = (v: string) => {
    if (v === (settings?.currency || 'IDR')) return
    setPendingCurrency(v)
  }
  const confirmCurrencyChange = () => {
    if (pendingCurrency) update({ currency: pendingCurrency })
    setPendingCurrency(null)
  }

  const handleChangePassword = async () => {
    if (!userId || !currentPw || !newPw) return
    if (newPw !== confirmPw) { toast.error('Password tidak cocok'); return }
    if (newPw.length < 6) { toast.error('Password minimal 6 karakter'); return }
    setSaving(true)
    const result = await changePassword(userId, currentPw, newPw)
    setSaving(false)
    if (result.ok) {
      toast.success('Password berhasil diubah')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } else {
      toast.error(result.error || 'Gagal mengubah password')
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
        <span className="text-lg font-bold uppercase text-nb-fg-muted animate-pulse">Memuat pengaturan...</span>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-[1.8rem] mb-7">⚙️ Pengaturan</h2>

      {/* Profile */}
      <div className="mb-7">
        <h3 className="mb-3">👤 Profil</h3>
        <NeubruCard>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 border-3 border-nb-border bg-nb-yellow flex items-center justify-center text-2xl font-extrabold">
              {username?.charAt(0).toUpperCase() || '?'}
            </div>
            <div>
              <div className="font-bold text-lg">{username}</div>
              <div className="text-sm text-nb-fg-muted">Akun</div>
            </div>
          </div>
        </NeubruCard>
      </div>

      {/* Change Password */}
      <div className="mb-7">
        <h3 className="mb-3">🔑 Ubah Password</h3>
        <NeubruCard>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Password Saat Ini</label>
              <NeubruInput value={currentPw} onChange={setCurrentPw} type="password" placeholder="Masukkan password saat ini" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Password Baru</label>
              <NeubruInput value={newPw} onChange={setNewPw} type="password" placeholder="Masukkan password baru" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Konfirmasi Password Baru</label>
              <NeubruInput value={confirmPw} onChange={setConfirmPw} type="password" placeholder="Ulangi password baru" />
            </div>
            <div>
              <NeubruBtn color="blue" onClick={handleChangePassword} disabled={saving}>
                {saving ? '⏳ Menyimpan...' : '🔑 Ubah Password'}
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

      {/* Appearance */}
      <div className="mb-7">
        <h3 className="mb-3">🎨 Tampilan</h3>
        <NeubruCard>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Tema</label>
            <div className="flex gap-2">
              {THEMES.map((t) => (
                <NeubruBtn
                  key={t.value}
                  size="sm"
                  color={(settings?.theme ?? 'system') === t.value ? 'green' : undefined}
                  onClick={() => update({ theme: t.value })}
                >
                  {t.label}
                </NeubruBtn>
              ))}
            </div>
            <div className="text-xs text-nb-fg-muted mt-1">
              Tema aktif sekarang: <b>{resolvedTheme === 'dark' ? 'Gelap' : 'Terang'}</b>
            </div>
          </div>
        </NeubruCard>
      </div>

      {/* Regional */}
      <div className="mb-7">
        <h3 className="mb-3">🌍 Regional</h3>
        <NeubruCard>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Mata Uang</label>
              <NeubruSelect
                value={settings?.currency || 'IDR'}
                onChange={requestCurrencyChange}
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
          <p className="text-xs text-nb-fg-muted mt-3">
            ⚠️ Mengganti currency hanya mengubah <b>tampilan</b> simbol/format angka — nominal transaksi yang sudah tercatat <b>tidak dikonversi</b>. Rp 50.000 akan tetap tersimpan sebagai angka 50.000, cuma simbolnya berubah jadi mata uang baru.
          </p>
        </NeubruCard>
      </div>

      {pendingCurrency && (
        <NeubruModal open={!!pendingCurrency} onClose={() => setPendingCurrency(null)} title="Ganti Currency?">
          <p className="text-sm mb-4">
            Semua nominal yang sudah tercatat (transaksi, budget, aset, dll) <b>tidak akan dikonversi</b>. Angkanya tetap sama persis, cuma simbol mata uangnya yang berubah.
            <br /><br />
            Contoh: transaksi yang sekarang tertulis <b>Rp 50.000</b> akan tampil sebagai <b>{pendingCurrency} 50.000</b> — bukan hasil konversi kurs, murni ganti label.
          </p>
          <div className="flex gap-2 justify-end">
            <NeubruBtn color="orange" onClick={() => setPendingCurrency(null)}>Batal</NeubruBtn>
            <NeubruBtn color="green" onClick={confirmCurrencyChange}>Lanjut Ganti</NeubruBtn>
          </div>
        </NeubruModal>
      )}

      {/* Security */}
      <div className="mb-7">
        <h3 className="mb-3">🔒 Keamanan</h3>
        <NeubruCard>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-nb-fg-muted">Waktu Auto-Lock</label>
            <NeubruSelect
              value={String(settings?.autoLockMinutes ?? 10)}
              onChange={(v) => update({ autoLockMinutes: Number(v) })}
              options={LOCK_OPTIONS}
            />
            <div className="text-xs text-nb-fg-muted mt-1">Kunci vault otomatis setelah tidak ada aktivitas</div>
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
                <div className="font-bold text-sm">Export Transaksi (CSV)</div>
                <div className="text-xs text-nb-fg-muted">{transactions.length} transaksi</div>
              </div>
              <NeubruBtn size="sm" color="green" onClick={() => exportCSV(transactions)}>📥 CSV</NeubruBtn>
            </div>
            <div className="h-px bg-nb-border" />
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-sm">Export Transaksi (PDF)</div>
                <div className="text-xs text-nb-fg-muted">Laporan lengkap dengan ringkasan</div>
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
            <div className="h-px bg-nb-border" />
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-sm">Export Semua Data (JSON)</div>
                <div className="text-xs text-nb-fg-muted">
                  Transaksi, budget, akun, todo, notes, habit, aset, utang, subscription.
                  Password vault <b>tidak</b> ikut diekspor.
                </div>
              </div>
              <NeubruBtn size="sm" color="purple" disabled={exporting} onClick={handleExportAll}>
                {exporting ? '⏳...' : '📦 JSON'}
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
        <h3 className="mb-3">ℹ️ Tentang</h3>
        <NeubruCard>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between"><span className="text-nb-fg-muted">Aplikasi</span><span className="font-bold">WOS Finance</span></div>
            <div className="flex justify-between"><span className="text-nb-fg-muted">Versi</span><span className="font-bold">{updater.currentVersion ?? '0.1.0'}</span></div>
            <div className="flex justify-between"><span className="text-nb-fg-muted">Transaksi</span><span className="font-bold">{transactions.length}</span></div>
          </div>

          {updater.supported && (
            <div className="mt-4 pt-4 border-t-2 border-nb-border">
              {updater.status === 'idle' || updater.status === 'error' ? (
                <div className="flex items-center justify-between gap-3">
                  {updater.status === 'error' && (
                    <span className="text-xs text-nb-red font-medium">{updater.error}</span>
                  )}
                  <NeubruBtn size="sm" onClick={() => updater.checkForUpdates()} className="ml-auto">
                    🔄 Cek Update
                  </NeubruBtn>
                </div>
              ) : updater.status === 'checking' ? (
                <div className="text-xs text-nb-fg-muted font-medium">Mengecek update...</div>
              ) : updater.status === 'up-to-date' ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-nb-green font-bold">✓ Sudah versi terbaru</span>
                  <NeubruBtn size="sm" onClick={() => updater.checkForUpdates()}>🔄 Cek Lagi</NeubruBtn>
                </div>
              ) : updater.status === 'available' ? (
                <div className="flex flex-col gap-2">
                  <div className="text-xs font-bold">
                    🎉 Update tersedia: v{updater.update?.version}
                  </div>
                  {updater.update?.notes && (
                    <p className="text-xs text-nb-fg-muted whitespace-pre-wrap">{updater.update.notes}</p>
                  )}
                  <NeubruBtn size="sm" onClick={() => updater.installUpdate()}>⬇️ Download & Install</NeubruBtn>
                </div>
              ) : updater.status === 'downloading' ? (
                <div className="flex flex-col gap-2">
                  <div className="text-xs font-bold">Mengunduh update... {updater.progress}%</div>
                  <div className="h-2 bg-nb-bg border-2 border-nb-border overflow-hidden">
                    <div className="h-full bg-nb-blue transition-all duration-300" style={{ width: `${updater.progress}%` }} />
                  </div>
                </div>
              ) : updater.status === 'ready' ? (
                <div className="text-xs text-nb-green font-bold">✓ Terinstall, restart aplikasi...</div>
              ) : null}
            </div>
          )}
        </NeubruCard>
      </div>
    </div>
  )
}
