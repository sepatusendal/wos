# Panduan Rilis WOS Desktop (untuk pemula)

Dokumen ini menjelaskan **dari nol** bagaimana proses rilis aplikasi desktop WOS bekerja: apa itu signing key, kenapa perlu, apa itu GitHub Actions, dan langkah persis buat merilis versi baru. Ditulis seakan-akan kamu baru pertama kali pegang hal-hal ini.

---

## 1. Konsep dasar — kenapa semua ini ada

### 1.1 Apa itu "auto-update" dan kenapa butuh signing key?

WOS versi desktop (yang di-install lewat `.dmg`) punya fitur: setiap kali dibuka, dia cek ke GitHub apakah ada versi lebih baru. Kalau ada, dia download dan install otomatis.

Masalahnya: kalau sembarang orang bisa "menyamar" jadi update resmi WOS, itu bahaya besar — bisa saja itu bukan update asli, tapi program jahat yang menyamar. Makanya setiap update harus **ditandatangani secara digital** oleh pemilik aplikasi (kamu), dan aplikasi yang ter-install di komputer user hanya mau menerima update yang tanda tangannya cocok.

Ini persis seperti tanda tangan basah di dokumen penting — bedanya pakai kriptografi, jadi tidak bisa dipalsukan.

### 1.2 Private key vs Public key — apa bedanya?

Bayangkan seperti gembok dan kunci:

| | Private key | Public key |
|---|---|---|
| **Fungsi** | Untuk **menandatangani** (mengunci) | Untuk **memverifikasi** (memastikan tanda tangan asli) |
| **Siapa yang pegang** | Cuma kamu, rahasia | Ikut ter-bundle di aplikasi yang di-install semua user |
| **Kalau bocor** | Bahaya — orang lain bisa bikin "update palsu" yang dianggap asli | Tidak masalah — memang untuk publik |
| **Lokasi di project ini** | `.tauri-updater-key.private` (di root folder, **tidak** ikut ke Git) | Sudah tertanam di `apps/desktop/src-tauri/tauri.conf.json` field `pubkey` |

Private key kamu sudah dibuatkan dan disimpan di:
```
/Users/wiraraja/Documents/wos/.tauri-updater-key.private
```
Passwordnya (untuk membuka file ini): `LfSv1Wbb/Nlqc3OzVdxnVM1BWGR8Lr34`

> ⚠️ **Simpan file ini + password-nya di tempat aman** (password manager, atau backup terenkripsi). Kalau hilang, kamu harus generate keypair baru — dan semua user yang sudah install WOS versi lama **tidak akan bisa auto-update lagi** (harus install ulang manual dari awal).

### 1.3 Apa itu GitHub Actions?

GitHub Actions adalah "robot" yang bisa disuruh GitHub untuk otomatis menjalankan perintah — misalnya build aplikasi — setiap kali ada kejadian tertentu di repo (misalnya kamu push kode, atau bikin tag baru).

Instruksi untuk robot ini ditulis di file `.yml` di dalam folder `.github/workflows/`. Project ini punya dua:

- **`.github/workflows/ci.yml`** — jalan tiap kali ada push/PR ke `main`/`develop`. Tugasnya: cek apakah kode masih bisa di-build dan lolos lint (semacam "pemeriksaan kualitas" otomatis). Ini **tidak** menghasilkan rilis apa pun, cuma pengecekan.
- **`.github/workflows/release.yml`** — jalan cuma kalau kamu push **tag** berformat `v*` (misal `v2.0.1`), atau kamu trigger manual. Tugasnya: build aplikasi desktop untuk macOS, tandatangani pakai private key, lalu upload hasilnya ke halaman **Releases** GitHub sebagai draft.

### 1.4 Apa itu "tag" di Git?

Tag itu semacam "penanda permanen" pada satu commit tertentu, biasanya dipakai untuk menandai nomor versi resmi. Bedanya sama commit biasa: commit itu terus bertambah tiap kamu simpan perubahan, tapi tag itu label khusus yang bilang "commit ini adalah rilis v2.0.1".

```bash
git tag v2.0.1        # bikin tag bernama v2.0.1 di commit yang sedang aktif
git push origin v2.0.1  # kirim tag itu ke GitHub
```

Begitu tag `v2.0.1` sampai di GitHub, workflow `release.yml` otomatis jalan (karena aturan `on: push: tags: ['v*']` di file itu).

### 1.5 Apa itu GitHub Secrets?

Secrets adalah tempat aman di pengaturan repo GitHub untuk menyimpan data rahasia (password, private key, dsb) yang dibutuhkan robot GitHub Actions saat menjalankan tugas — tapi **tidak pernah terlihat** di kode atau log, bahkan oleh kamu sendiri setelah disimpan (cuma bisa di-overwrite, tidak bisa dibaca ulang).

Project ini sudah punya 2 secret yang terpasang di repo `sepatusendal/wos`:
- `TAURI_SIGNING_PRIVATE_KEY` — isi private key kamu
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — password untuk membuka private key itu

Robot GitHub Actions memakai keduanya untuk menandatangani build, tanpa siapa pun (termasuk kamu, lewat log) bisa melihat isinya.

---

## 2. Alur rilis versi baru — langkah demi langkah

Setiap kali kamu mau merilis versi baru WOS desktop (misal dari 2.0.1 ke 2.0.2), ikuti urutan ini:

### Langkah 1 — Update nomor versi

Nomor versi harus **sama persis** di 3 tempat ini (kalau beda, bakal membingungkan nanti pas debug/support user):

1. `apps/desktop/package.json` → field `"version"`
2. `apps/desktop/src-tauri/tauri.conf.json` → field `"version"`
3. `apps/desktop/src-tauri/Cargo.toml` → baris `version = "..."`

Setelah ubah `Cargo.toml`, jalankan ini supaya `Cargo.lock` ikut update (kalau tidak, build bisa gagal karena versi tidak sinkron):
```bash
cd apps/desktop/src-tauri
cargo check
```

### Langkah 2 — Commit perubahan versi

```bash
git add apps/desktop/package.json apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/Cargo.lock apps/desktop/src-tauri/tauri.conf.json
git commit -m "chore: bump desktop version to 2.0.2"
git push origin main
```

### Langkah 3 — Bikin tag & push

```bash
git tag v2.0.2
git push origin v2.0.2
```

Format tag **harus** diawali huruf `v` (contoh: `v2.0.2`), karena itu yang dicari oleh aturan `tags: ['v*']` di `release.yml`.

### Langkah 4 — Tunggu robot bekerja

Buka tab **Actions** di halaman GitHub repo (`https://github.com/sepatusendal/wos/actions`), akan muncul run baru bernama **"Release Desktop"**. Ini akan:
1. Build aplikasi untuk 2 jenis chip Mac: `aarch64` (Apple Silicon / M1-M4) dan `x86_64` (Intel).
2. Menandatangani hasil build pakai private key dari Secrets.
3. Membuat **draft release** baru di tab **Releases**, isinya file `.dmg` untuk kedua chip + file `latest.json` (dipakai fitur auto-update).

Proses ini biasanya makan waktu **5–15 menit** karena compile Rust cukup berat.

### Langkah 5 — Cek & publish

1. Buka tab **Releases** di GitHub.
2. Akan ada release baru berstatus **Draft** (sengaja draft dulu, biar kamu sempat cek sebelum orang lain lihat).
3. Cek file-file yang ter-upload (harus ada 2 `.dmg`, plus `latest.json` dan file `.sig`).
4. Kalau sudah oke, klik **"Publish release"**.
5. Setelah dipublish, semua user yang sudah install WOS versi lama akan otomatis dapat notifikasi update dalam beberapa saat (tergantung kapan mereka buka aplikasinya).

---

## 3. Cara trigger rilis tanpa bikin tag manual (opsional)

Kalau males ketik `git tag` dari terminal, bisa juga lewat GitHub langsung:

1. Buka tab **Actions** → pilih workflow **"Release Desktop"** di sidebar kiri.
2. Klik tombol **"Run workflow"** (ada dropdown branch, biarkan `main`).
3. Isi kolom **tag** dengan nama versi, misal `v2.0.2`.
4. Klik **"Run workflow"** hijau.

Ini akan menjalankan proses yang sama persis seperti push tag manual.

---

## 4. Troubleshooting — kalau ada yang gagal

### "npm error notsup ... Unsupported platform"
Ini pernah terjadi sekali: ada dependency yang di-pasang manual untuk platform tertentu (misal `@next/swc-darwin-x64`, khusus Mac Intel) padahal harusnya biar npm pilih otomatis sesuai platform yang lagi jalan. Kalau muncul error serupa untuk paket lain, biasanya solusinya: hapus baris itu dari `package.json` (bagian `dependencies`/`devDependencies`), lalu jalankan `npm install` ulang supaya `package-lock.json` ikut ter-update, baru commit.

### Build gagal di step "tauri-action" / signing
Cek dulu apakah kedua secret (`TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`) masih ada di **Settings → Secrets and variables → Actions** repo GitHub. Kalau ke-hapus atau salah, build akan gagal di tahap ini.

### Mau cek log lebih detail
Kalau punya GitHub CLI (`gh`) ter-install & login, dari terminal:
```bash
gh run list --repo sepatusendal/wos --limit 5      # lihat 5 run terakhir
gh run view <RUN_ID> --repo sepatusendal/wos --log-failed   # lihat log yang gagal
```
`RUN_ID` bisa dilihat dari kolom paling kanan hasil `gh run list`, atau dari URL run di tab Actions.

### Tag salah / mau diulang
Kalau tag sudah ke-push tapi ternyata ada bug dan mau diulang ke commit yang sudah diperbaiki (**hanya lakukan ini kalau release sebelumnya belum sempat di-publish**, karena tag yang sudah publish sebaiknya tidak diubah lagi):
```bash
git tag -f v2.0.2                 # pindahkan tag ke commit HEAD sekarang
git push origin v2.0.2 --force    # paksa update tag di GitHub
```

---

## 5. Ringkasan super singkat (contekan)

```bash
# 1. Ubah versi di 3 file (package.json, tauri.conf.json, Cargo.toml)
cd apps/desktop/src-tauri && cargo check && cd ../../..

# 2. Commit & push ke main
git add apps/desktop/package.json apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/Cargo.lock apps/desktop/src-tauri/tauri.conf.json
git commit -m "chore: bump desktop version to vX.Y.Z"
git push origin main

# 3. Tag & push — ini yang memicu build+release otomatis
git tag vX.Y.Z
git push origin vX.Y.Z

# 4. Tunggu ~5-15 menit, cek tab Actions di GitHub

# 5. Buka tab Releases, cek hasilnya, klik "Publish release"
```

---

## 6. Istilah-istilah penting (glosarium)

| Istilah | Artinya |
|---|---|
| **Tauri** | Framework yang dipakai buat bikin WOS desktop — bikin aplikasi native (macOS/Windows/Linux) pakai web tech (React) tapi jalan lebih ringan dari Electron. |
| **Signing / menandatangani** | Proses kriptografi untuk membuktikan sebuah file benar-benar dari pemiliknya dan tidak diubah orang lain di tengah jalan. |
| **CI (Continuous Integration)** | Robot yang otomatis mengecek kualitas kode tiap kali ada perubahan — di project ini itu `ci.yml`. |
| **CD (Continuous Deployment/Delivery)** | Robot yang otomatis mem-build & merilis aplikasi — di project ini itu `release.yml`. |
| **Draft release** | Rilis di GitHub yang sudah dibuat tapi belum "diumumkan" ke publik — masih bisa dicek/dihapus dulu sebelum di-publish. |
| **Runner** | Komputer virtual yang disediakan GitHub buat menjalankan robot Actions (misal `macos-latest` = Mac virtual). |
| **Workflow dispatch** | Cara menjalankan robot GitHub Actions secara manual lewat tombol di web, tanpa perlu push apa pun. |
