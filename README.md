# DPDC Balance — Raycast Extension

Check your DPDC prepaid electricity meter balance directly from Raycast.

<img width="1000" height="625" alt="dpdc-balance 2026-06-27 at 20 04 10" src="https://github.com/user-attachments/assets/d6564dd6-cafd-4fd6-a0d6-f67882646185" />


## Commands

| Command | Mode | Description |
|---------|------|-------------|
| **My Meters** | View | List saved meters with balances, detail panel, add/edit/remove |
| **Check Balance** | View | Ad-hoc lookup for any DPDC Customer ID |
| **Balance** | Menu Bar | Primary meter balance in your menu bar with low-balance alert |

## Features

- 🔐 Token caching — authenticates once, reuses until expiry
- 💾 Balance caching — 30-min TTL, views render instantly
- ⚠️ Low-balance alert — configurable threshold, red indicator when balance drops below
- ⭐ Primary meter — starred meter shown in menu bar title
- 📋 Copy actions — balance, Customer ID, or full details to clipboard
- 🔗 Quicklink — create Raycast quicklinks for fast access

## Setup

```bash
# Install dependencies
npm install

# Development mode (opens Raycast)
npm run dev

# Run tests
npm test

# Lint
npm run lint
```

## Preferences

| Preference | Default | Description |
|------------|---------|-------------|
| Alert Threshold (৳) | `50` | Balance at or below triggers red indicator |
| Refresh Interval | `30m` | How often cached balances refresh (15m / 30m / 1h) |

## Architecture

```
src/
├── lib/
│   ├── types.ts      # Shared interfaces
│   ├── format.ts     # Balance/time formatting
│   ├── storage.ts    # LocalStorage CRUD (meters, tokens, cache)
│   └── dpdc.ts       # DPDC API client (auth + GraphQL)
├── my-meters.tsx     # My Meters view command
├── check-balance.tsx # Check Balance view command
└── balance-menu-bar.tsx # Menu bar command
```

## API

Uses the same DPDC AMI API as the mobile app:

- **Auth:** `POST https://amiapp.dpdc.org.bd/auth/login/generate-bearer`
- **Balance:** `POST https://amiapp.dpdc.org.bd/usage/usage-service` (GraphQL)

## Requirements

- macOS with [Raycast](https://raycast.com) installed
- Node.js 18+
- Valid DPDC Customer ID (8-12 digits)

## License

MIT
