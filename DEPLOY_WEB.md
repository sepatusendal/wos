# 🌐 WOS Web — Panduan Deploy (Ringkas)

## Prasyarat

- Node.js ≥ 20 + npm
- Akun hosting: [Vercel](https://vercel.com) (gratis, recommended) atau [Netlify](https://netlify.com) / [Railway](https://railway.app)

---

## Deploy ke Vercel (Recommended)

### Setup Awal

```bash
cd ~/Documents/wos

# Install Vercel CLI
npm i -g vercel
```

### Deploy

```bash
cd apps/web
vercel --prod
```

Setting yang perlu dicek di Vercel Dashboard setelah deploy:

| Setting | Value |
|---|---|
| **Framework** | Next.js |
| **Build Command** | `cd ../.. && npm run build -w apps/web` |
| **Output Directory** | `apps/web/.next` |
| **Root Directory** | `apps/web` |
| **Node.js Version** | 22.x |

### Environment Variables

Tambahkan di Vercel Dashboard → Settings → Environment Variables:

```
TURSO_URL=file:./wos.db
```

> ⚠️ Untuk production pakai Turso remote DB, ganti `TURSO_URL` ke `libsql://...` + tambahin `TURSO_AUTH_TOKEN`.

---

## Alternatif: Deploy ke Netlify

```bash
cd apps/web
npm run build
# Deploy folder apps/web/.next sebagai static site
# via Netlify CLI atau drag-drop di dashboard
```

---

## Alternatif: Self-host (VPS / Dedicated Server)

```bash
cd ~/Documents/wos/apps/web
npm run build
npm run start   # Jalan di port 3000
# Pakai PM2 / systemd / Docker buat keep-alive
# Reverse proxy: nginx → localhost:3000
```

---

## Update Web App

```bash
cd ~/Documents/wos

# 1. Edit file di packages/ui/ atau apps/web/
# 2. Test lokal
npm run web     # → http://localhost:3000

# 3. Commit
git add -A && git commit -m "feat: deskripsi update"

# 4. Deploy
cd apps/web && vercel --prod
```

Atau kalau pake Vercel Git integration: push ke GitHub → auto-deploy.

---

## Konfigurasi next.config.ts

```ts
// apps/web/next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@wos/ui', '@wos/shared', '@wos/db'],
}

export default nextConfig
```

`transpilePackages` wajib — karena semua UI dan logic ada di packages monorepo.

---

## Catatan

- Web app cuma 1 halaman (`/`) — setelah login, semua "routing" internal lewat state React, bukan URL.
- Database pakai SQLite file (`wos.db`) via API route `/api/db` — jangan pakai di production tanpa migrasi ke Turso remote.
- Untuk production serius, ganti adapter dari `createHttpAdapter()` ke Turso remote client.
