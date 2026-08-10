# 🖥️ WOS Desktop — Panduan Deploy ke DMG (macOS)

> Panduan lengkap dari nol sampai jadi file `.dmg` siap install di MacBook.

---

## Daftar Isi

1. [Prasyarat](#1-prasyarat)
2. [Sekilas Arsitektur](#2-sekilas-arsitektur)
3. [Step 1 — Generate Icon App](#3-step-1--generate-icon-app)
4. [Step 2 — Siapin Frontend Build](#4-step-2--siapin-frontend-build)
5. [Step 3 — Build DMG dengan Tauri](#5-step-3--build-dmg-dengan-tauri)
6. [Step 4 — Test DMG](#6-step-4--test-dmg)
7. [Step 5 — Code Signing & Notarization (Opsional)](#7-step-5--code-signing--notarization-opsional)
8. [Cara Update Fitur](#8-cara-update-fitur)
9. [Troubleshooting](#9-troubleshooting)
10. [File Konfigurasi Penting](#10-file-konfigurasi-penting)

---

## 1. Prasyarat

Pastikan semua ini udah keinstall di MacBook lu:

| Tools | Cek Versi | Cara Install |
|---|---|---|
| **Node.js** ≥ 20 | `node -v` | [nvm](https://github.com/nvm-sh/nvm) atau `brew install node` |
| **npm** ≥ 10 | `npm -v` | Bawaan Node.js |
| **Rust** (latest stable) | `rustc --version` | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| **Cargo** | `cargo --version` | Bawaan Rust |
| **Tauri CLI** | `npx tauri --version` | Auto-install via npm scripts |
| **Xcode** (macOS) | `xcodebuild -version` | App Store, atau `xcode-select --install` |

### Cek semua sekaligus:

```bash
node -v && npm -v && rustc --version && cargo --version && xcodebuild -version
```

### Kalau ada yang kurang:

```bash
# Install Rust (kalau belum)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# Restart terminal, lalu:
rustup update

# Install Xcode Command Line Tools (kalau belum)
xcode-select --install
```

---

## 2. Sekilas Arsitektur

```
wos/
├── apps/
│   ├── web/          ← Next.js web app (port 3000)
│   └── desktop/      ← Tauri 2 + React + Vite (port 1420)
│       ├── src/
│       │   ├── App.tsx        ← Entry point React
│       │   └── main.tsx       ← Mount React
│       ├── src-tauri/         ← Rust backend
│       │   ├── tauri.conf.json  ← Konfigurasi bundle (DMG, icon, window)
│       │   ├── Cargo.toml       ← Dependencies Rust
│       │   ├── src/lib.rs       ← Plugin & command Tauri
│       │   ├── src/main.rs      ← Entry point Rust
│       │   └── icons/           ← ⚠️ WAJIB diisi icon!
│       ├── vite.config.ts     ← Vite config + path alias
│       └── package.json       ← Scripts: dev, build, tauri
└── packages/
    ├── ui/      ← Semua UI: layout, sidebar, halaman, komponen, store
    ├── db/      ← Database adapter (Tauri SQL / HTTP / Drizzle)
    └── shared/  ← Type, crypto, format utility
```

**Cara kerja:** Frontend React di-build pakai Vite → hasil build ditaruh di `desktop/dist/` → Tauri baca `dist/` sebagai `frontendDist` → Rust binary + frontend dibundle jadi `.dmg`.

---

## 3. Step 1 — Generate Icon App

⚠️ **PENTING:** Folder `desktop/src-tauri/icons/` saat ini **KOSONG**. Kamu WAJIB generate icon dulu sebelum build DMG.

### Cara 1: Generate dari file PNG (rekomendasi)

Siapin 1 file PNG resolusi tinggi (minimal 1024×1024, background solid, tanpa transparansi di pinggir):

```bash
cd ~/Documents/wos/apps/desktop

# Install Tauri CLI global (sekali aja)
npm install -g @tauri-apps/cli

# Generate semua format icon dari 1 file PNG
# Ganti 'icon-1024.png' dengan path file PNG kamu
npx tauri icon ~/Desktop/icon-1024.png
```

Ini bakal generate otomatis:
```
src-tauri/icons/
├── 32x32.png
├── 128x128.png
├── 128x128@2x.png
├── icon.icns       ← Format macOS
├── icon.ico        ← Format Windows
└── Square{30,44,71,89,107,142,150,284,310}x{...}Logo.png
```

### Cara 2: Bikin icon manual

Kalau belum punya desain icon, bikin dulu pake Figma / Photoshop / [macOS Icon Generator](https://makeappicon.com):

- **1024×1024** PNG, background `#ffd800` (kuning WOS)
- Teks "WOS" warna `#0b0b0b` di tengah
- Simpan sebagai `icon.png` di Desktop, lalu jalankan `npx tauri icon ~/Desktop/icon.png`

### Verifikasi icon udah ke-generate:

```bash
ls -la src-tauri/icons/
# Harus ada: icon.icns, icon.ico, 32x32.png, 128x128.png, 128x128@2x.png
```

---

## 4. Step 2 — Siapin Frontend Build

Sebelum Tauri bisa bundle, frontend React harus di-build dulu. Tauri bakal otomatis ngejalanin `beforeBuildCommand` dari `tauri.conf.json`.

```bash
cd ~/Documents/wos/apps/desktop

# Install dependencies (sekali aja atau pas update)
npm install

# Build frontend aja (cek dulu ga error)
npm run build
# Output: dist/ (ini yg bakal dibundle Tauri)
```

Output yang diharapkan:
```
✓ built in X.Xs
```

> 💡 **Catatan:** kalau ada error type-check (`tsc -b`), pastiin dulu semua file TypeScript di `packages/ui`, `packages/db`, `packages/shared` ga ada error. Jalankan `npm run build -w apps/web` untuk verifikasi.

---

## 5. Step 3 — Build DMG dengan Tauri

```bash
cd ~/Documents/wos/apps/desktop

# Build Tauri bundle (debug mode — buat testing)
npx tauri build --debug

# ATAU release mode (optimized, lebih kecil — buat production)
npx tauri build
```

### Proses ini bakal:

1. ⚙️ Build frontend React pakai Vite (via `beforeBuildCommand`)
2. 🦀 Compile Rust binary `wos-desktop` (sekitar 3-8 menit pertama kali)
3. 📦 Bundle jadi `.dmg` di folder `src-tauri/target/release/bundle/dmg/`

### Output:

```
src-tauri/target/release/bundle/dmg/
└── WOS_0.1.0_x64.dmg       ← Ini app installer kamu! 🎉
```

### File size:

- Debug build: ~15-30 MB
- Release build: ~5-12 MB

---

## 6. Step 4 — Test DMG

```bash
# Buka folder hasil build
open ~/Documents/wos/apps/desktop/src-tauri/target/release/bundle/dmg/

# Double-click file .dmg
# Mount → drag WOS.app ke /Applications → buka aplikasinya
```

### Tes yang perlu dicek:

- [ ] App kebuka tanpa error
- [ ] Window size 1280×800
- [ ] Login / register jalan
- [ ] Semua halaman bisa dibuka (Dashboard, Finance, Wealth, Net Worth, Vault, Todo, Settings)
- [ ] Data tersimpan (close app, buka lagi, data masih ada)
- [ ] Icon app muncul di Dock ✅
- [ ] Nama app "WOS" muncul di menu bar

---

## 7. Step 5 — Code Signing & Notarization (Opsional)

Tanpa signing, user bakal dapet warning **"WOS can't be opened because it's from an unidentified developer"** pas pertama buka. Mereka harus ke **System Preferences → Security & Privacy → Open Anyway**.

### Untuk hilangkan warning, kamu perlu:

#### 7a. Apple Developer Account

Daftar di [developer.apple.com](https://developer.apple.com) — $99/tahun.

#### 7b. Buat Certificate di Keychain Access

1. Buka **Keychain Access** → **Certificate Assistant** → **Request a Certificate From a Certificate Authority**
2. Isi email Apple ID, pilih "Saved to disk"
3. Upload `.certSigningRequest` ke [developer.apple.com/account/resources/certificates](https://developer.apple.com/account/resources/certificates)
4. Pilih **Developer ID Application** → download `.cer`
5. Double-click file `.cer` yang didownload → masuk ke Keychain

#### 7c. Setup env vars untuk Tauri

Bikin file `.env` di `desktop/` (atau export langsung di terminal):

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Nama Kamu (XXXXXXXXXX)"
export APPLE_CERTIFICATE="XXXXXX"        # Dari Keychain
export APPLE_CERTIFICATE_PASSWORD="xxxx"  # Password certificate
export APPLE_ID="email@appleid.com"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # App-specific password
export APPLE_TEAM_ID="XXXXXXXXXX"          # Team ID dari developer.apple.com
```

#### 7d. Build signed + notarized

```bash
npx tauri build --bundles dmg
```

Tauri bakal otomatis sign dan notarize app-nya.

> 📖 Referensi lengkap: https://v2.tauri.app/distribute/sign/macos/

---

## 8. Cara Update Fitur

Ini workflow sehari-hari pas lu mau nambah fitur atau perbaiki bug:

### Flow Development Harian

```bash
cd ~/Documents/wos/apps/desktop

# 1. Jalanin dev server (hot reload)
npm run tauri dev
# → Buka window Tauri + Vite HMR
# → Edit file React di packages/ui/ atau desktop/src/ langsung ke-refresh
```

### Mau Update Fitur di Package UI (tempat semua halaman)

Semua halaman (Dashboard, Finance, Wealth, Net Worth, Vault, Todo, Settings) ada di:

```
packages/ui/src/features/<nama>/<Nama>Page.tsx
```

Flow update:

```bash
# 1. Edit file di packages/ui/src/features/...
# 2. Cek di browser (web)
cd ~/Documents/wos && npm run web
# → buka http://localhost:3000, cek fitur baru

# 3. Cek di desktop
cd apps/desktop && npm run tauri dev
# → window Tauri kebuka, cek fitur baru

# 4. Kalau udah OK, build DMG
cd apps/desktop && npx tauri build
```

### Mau Nambah Halaman Baru

**Step 1:** Bikin file halaman di `packages/ui/src/features/`

```tsx
// packages/ui/src/features/baru/BaruPage.tsx
export default function BaruPage() {
  return <div>Halaman Baru!</div>
}
```

**Step 2:** Daftarin di `Sidebar.tsx` (`packages/ui/src/components/Sidebar.tsx`)

```tsx
const PAGES = [
  // ... yang udah ada
  { id: 'baru', label: 'Baru', icon: '🆕' },  // ← tambahin
] as const
```

**Step 3:** Daftarin di `AppLayout.tsx` (`packages/ui/src/layouts/AppLayout.tsx`)

```tsx
const pageComponents: Record<PageId, () => Promise<{ default: () => React.JSX.Element }>> = {
  // ... yang udah ada
  baru: () => import('../features/baru/BaruPage'),  // ← tambahin
}
```

**Step 4:** Export dari barrel (kalau perlu)

```tsx
// packages/ui/src/index.ts — ga perlu, karena cuma di-load dinamis
```

**Step 5:** Test dan build ulang

```bash
npm run web          # test di browser
npm run tauri dev    # test di desktop
npx tauri build      # build DMG final
```

### Mau Update Loading Phrases

Edit file `packages/ui/src/components/LoadingSpinner.tsx` — tambahin/hapus array `PHRASES` di paling atas. Langsung live reload di dua-duanya.

### Mau Update CSS / Tampilan

Edit `packages/ui/src/styles/globals.css` — semua styling global + neubrutalist theme di sini.

### Version Bump

Sebelum release, update version:

1. `apps/desktop/src-tauri/tauri.conf.json` → `"version": "0.2.0"`
2. `apps/desktop/src-tauri/Cargo.toml` → `version = "0.2.0"`
3. `apps/desktop/package.json` → `"version": "0.2.0"`
4. Commit & tag: `git tag v0.2.0 && git push --tags`

---

## 9. Troubleshooting

### "icons/icon.icns tidak ditemukan"

```bash
# Generate icon dulu
npx tauri icon ~/Desktop/icon-kamu.png
```

### "Build error: rustc not found"

```bash
rustup update stable
```

### "error: linking with `cc` failed"

```bash
xcode-select --install
```

### "Vite build error: Could not load @wos/ui/styles"

Pastiin jalur alias di `vite.config.ts` bener dan file `packages/ui/src/styles/globals.css` ada. Kalau masih error:

```bash
# Clean install dari root
cd ~/Documents/wos
rm -rf node_modules apps/desktop/node_modules apps/web/node_modules packages/*/node_modules
npm install
```

### DMG kegedean (>50MB)

```bash
# Pakai release mode (optimized, strip debug symbols)
npx tauri build
# JANGAN pakai --debug
```

### SQLite error pas buka app

Pastiin `tauri-plugin-sql` ada di `Cargo.toml`:

```toml
[dependencies]
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
```

dan permissions di `capabilities/default.json`:

```json
"permissions": [
  "sql:default",
  "sql:allow-load",
  "sql:allow-execute",
  "sql:allow-select",
  "sql:allow-close"
]
```

---

## 10. File Konfigurasi Penting

| File | Fungsi |
|---|---|
| `desktop/src-tauri/tauri.conf.json` | Nama app, version, window size, bundle config, icon paths |
| `desktop/src-tauri/Cargo.toml` | Dependencies Rust + metadata crate |
| `desktop/src-tauri/src/lib.rs` | Plugin registration + custom command |
| `desktop/src-tauri/capabilities/default.json` | Permission untuk SQL, file system, dll |
| `desktop/package.json` | Script npm (`dev`, `build`, `tauri`) |
| `desktop/vite.config.ts` | Alias path ke packages/\* |
| `packages/ui/src/styles/globals.css` | Design system + Tailwind theme |
| `packages/ui/src/layouts/AppLayout.tsx` | Layout utama + navigasi + page loading |
| `packages/ui/src/components/Sidebar.tsx` | Sidebar navigasi + daftar halaman |

---

## Ringkasan Command

```bash
# === SETUP AWAL (sekali aja) ===
cd ~/Documents/wos
npm install                          # Install semua dependencies

# Generate icon (sekali aja, siapin PNG 1024x1024)
cd apps/desktop
npx tauri icon ~/Desktop/icon-kamu.png

# === DEVELOPMENT ===
npm run web                          # Jalanin web app (http://localhost:3000)
cd apps/desktop && npx tauri dev     # Jalanin desktop app (hot reload)

# === BUILD DMG ===
cd apps/desktop
npm run build                        # Cek frontend build OK
npx tauri build                      # Build .dmg production
# Hasil: src-tauri/target/release/bundle/dmg/WOS_0.1.0_x64.dmg

# === BUILD + SIGN + NOTARIZE ===
export APPLE_SIGNING_IDENTITY="..."
export APPLE_ID="..."
# (isi env vars lainnya)
cd apps/desktop && npx tauri build --bundles dmg
```

---

> 💬 Ada masalah? Cek dulu Troubleshooting section di atas. Masih gabisa? Buka issue di repo atau tanya langsung.
