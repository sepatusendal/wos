<p align="center">
  <img src="apps/desktop/src-tauri/icons/128x128@2x.png" width="128" alt="WOS Logo" />
</p>

<h1 align="center">WOS — Wira Operating System</h1>
<p align="center"><strong>Personal Finance & Life OS — macOS Desktop + Web</strong></p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.0.0-brightgreen" alt="Version" />
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Web-blue" alt="Platform" />
  <img src="https://img.shields.io/badge/design-Neubrutalism-ffd800" alt="Design" />
</p>

---

## ✨ What is WOS?

WOS is an **all-in-one personal operating system** — finance tracker, habit builder, password vault, notes, journal, and life dashboard. Built with a distinctive **neubrutalist design** (thick 3px borders, bold typography, hard shadows, off-white background).

### 🎯 Philosophy
- **Local-first** — all data stored on your device
- **No cloud accounts** — privacy by default  
- **Offline-first** — works without internet
- **One app** — finance, habits, notes, vault, life tracking

---

## 🏠 Features (18 Pages)

| Page | Description |
|------|------------|
| 🏠 **Dashboard** | KPI cards, cash flow chart, expense pie, budget bars, weather, quote, pet |
| 💸 **Finance** | Transactions, accounts, budgets, savings goals, recurring, CSV import |
| 📈 **Wealth** | Asset portfolio, P&L tracking, live stock/crypto prices, ticker auto-refresh |
| 🏦 **Net Worth** | Manual entry with asset/liability breakdown, history, trend |
| 📅 **Calendar** | Monthly grid, transaction & todo display, Indonesian holidays |
| 📋 **Subscriptions** | Recurring tracking, 9 categories, monthly total, smart icons |
| 🔥 **Habits** | Daily/weekly tracking, 7-day calendar, streak, XP rewards |
| 🔐 **Vault** | AES-256-GCM encrypted password manager, auto-lock |
| 📝 **Notes** | Markdown journal, tags, pin, smart links to transactions & todos |
| ✅ **Todo** | Priority, subtasks, tags, due dates, linked notes |
| 🚀 **FIRE** | Financial Independence calculator, health score, what-if simulator |
| 🧠 **Life Score** | 5-dimension radar chart, cross-domain insights |
| 🎉 **Year Review** | Spotify Wrapped-style annual report |
| 🧮 **Tools** | Sankey diagram, loan calculator, latte factor, net worth simulator |
| 🏅 **Records** | Personal bests (lowest expense, highest income, longest streak) |
| 🌟 **Skills** | RPG skill tree (Wealth/Vitality/Wisdom), daily quests |
| ⌨️ **Cmd+K** | Command palette — quick navigation, calculator, transaction entry |
| ⚙️ **Settings** | Currency, locale, auto-lock, vault password, theme |

### 🎮 Gamification
- **RPG Leveling (1-50)** — earn XP from all activities
- **Daily Quests** — 3 random challenges per day
- **Achievement Badges** — 12 badges to collect
- **🐱 Financial Pet (Biscuit)** — mood reflects your financial health
- **👻 Roast Mode** — humorous spending feedback

---

## 🚀 Quick Start

### Desktop (macOS)

1. Download `WOS_2.0.0_x64.dmg` from [Releases](https://github.com/sepatusendal/wos/releases)
2. Open DMG → drag **WOS.app** to Applications
3. Right-click → **Open** (first time for unsigned app)
4. Register any username + password
5. **Auto-update** — new versions auto-detect & install

### Web Dev

```bash
git clone https://github.com/sepatusendal/wos.git
cd wos
npm install
npm run web        # → http://localhost:3000
```

### Desktop Dev

```bash
npm run desktop    # → http://localhost:1420
# Tauri build: cd apps/desktop && npx tauri build
```

---

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, TypeScript 5.9, Tailwind CSS 4 |
| Desktop | Tauri 2 (Rust), SQLite |
| Web | Next.js 16, Turso/LibSQL |
| Charts | Recharts |
| State | Zustand 5 |
| Crypto | Web Crypto API (AES-256-GCM, PBKDF2 600K iters) |
| Fonts | Lexend + JetBrains Mono |
| Design | Neubrutalism — 3px borders, hard shadows, bold |

---

## 🗂️ Structure

```
wos/
├── apps/
│   ├── web/          # Next.js 16 (port 3000)
│   └── desktop/      # Tauri 2 (port 1420 dev, .app production)
├── packages/
│   ├── db/           # Drizzle ORM schema + 3 adapters (HTTP, Tauri SQL, Drizzle)
│   ├── shared/       # Zod validators, AES-GCM crypto, currency formatting, APIs
│   └── ui/           # Neubrutalist components, 18 pages, 14 Zustand stores, CSS
├── package.json      # Turborepo monorepo
└── turbo.json
```

---

## 🔒 Security

- **Local-first** — no cloud storage, no accounts
- **Vault** — AES-256-GCM, PBKDF2 600K iterations, canary verification
- **Session tokens** — UUID-based, sessionStorage scoped (web)
- **CSP** — Content Security Policy enabled (desktop)
- **No telemetry** — zero data collection

---

## 📝 License

MIT © 2026 [sepatusendal](https://github.com/sepatusendal)

<p align="center">Built with ❤️ using Neubrutalism</p>
