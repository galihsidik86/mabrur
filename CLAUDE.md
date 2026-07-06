# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mabrur** — sistem untuk membantu jamaah haji/umrah dan muthawwif. React Native (Expo) mobile app + Express/TypeScript backend + PostgreSQL. Bahasa: full Bahasa Indonesia.

## Design Reference

`project/Labbaik.dc.html` is the pixel-perfect design prototype from Claude Design. Read it in full before implementing UI. It uses dc-runtime (`project/support.js`) — not production code, just visual reference.

### App Screens (from prototype)

- **Beranda Jamaah**: Dashboard — ihram status, quick actions, agenda, group status
- **Beranda Muthawwif**: SOS alerts, jamaah stats, group member tracking
- **Peta Miqat**: Geofence map, distance indicator, ihram toggle
- **Tuntunan Ibadah**: Step-by-step guide, Umrah/Haji tabs, Arabic text + transliteration
- **Doa & Bacaan**: Prayer collection with Arabic, Latin, Indonesian translation
- **Jadwal**: Timeline schedule with status dots
- **SOS**: Emergency — category selection, location sharing, medical ID card

### Design Tokens

- **Primary (maroon)**: `#8B2E2E`, darker `#6E2424`, lighter `#F3D9CD`
- **Green**: `#4A7C3A`, badge `#DCEBD3` | **Gold**: `#D4A437`, badge `#FAEFC9` | **Danger**: `#C44536`
- **Background**: `#F5F1E8` (screen), `#E4DAC7` (outer) | **Text**: `#1F1B16` / `#5C3A1E` / `#8C6B4A`
- **Fonts**: Plus Jakarta Sans (UI), Fraunces (headings), JetBrains Mono (data), Amiri (Arabic)

## Development Commands

```bash
# Prerequisites: PostgreSQL running on localhost:5432, database "mabrur" exists

# Install dependencies (from project root)
npm install

# Database
npm run db:migrate        # Run migrations
npm run db:rollback       # Rollback last migration batch
npm run db:seed           # Seed admin user (08000000001 / admin123)

# Server
npm run server:dev        # Start dev server with hot reload (port 3000)
npm run server:build      # TypeScript compile to dist/

# Admin Panel (from apps/admin/)
cd apps/admin
npm install               # First time only
npm run dev               # Start Vite dev server (port 5173)
npm run build             # Production build to dist/

# Mobile (from apps/mobile/ — separate node_modules, not in workspace)
cd apps/mobile
npm install               # First time only
npx expo start            # Start Expo dev server
npx expo start --android  # Start on Android
npx expo start --ios      # Start on iOS
npx expo export --platform android  # Test build
```

## Architecture

```
mabrur/
├── project/             ← Design prototype (read-only reference)
├── server/              ← Express + TypeScript API (npm workspace)
│   └── src/
│       ├── index.ts          Entry point
│       ├── app.ts            Express app setup (middleware, routes)
│       ├── config.ts         Env validation via Zod (loads ../.env)
│       ├── db/               Knex instance, migrations, seeds
│       ├── middleware/        auth (JWT), rbac, validate (Zod), error-handler
│       ├── routes/            Express routers (auth, users, groups)
│       ├── services/          Business logic (auth, user, group, audit, crypto)
│       └── types/             TypeScript types + Express augmentation
├── apps/mobile/         ← React Native (Expo SDK 57) — standalone, NOT in workspace
│   ├── app/                  Expo Router file-based routing
│   │   ├── _layout.tsx       Root layout (auth guard, font loading)
│   │   ├── login.tsx         Login screen
│   │   └── (tabs)/           Tab navigation (5 tabs)
│   └── src/
│       ├── theme.ts          Design tokens from prototype
│       ├── stores/auth.ts    Zustand auth state + SecureStore
│       └── services/
│           ├── api.ts        API client with auto-refresh
│           └── db.ts         SQLite offline database
├── .env                  Environment variables (not committed)
└── docker-compose.yml    PostgreSQL container (alternative to local install)
```

### Key Patterns

- **Auth**: JWT access token (15min) + refresh token (30 days, rotated, stored hashed in DB). Login via phone + password.
- **RBAC**: Three roles — `admin`, `muthawwif`, `jamaah`. Checked server-side on every endpoint via `authorize()` middleware.
- **Validation**: Zod schemas in route files, applied via `validate()` middleware. Client + server validation.
- **Encryption**: Sensitive fields (passport_no, medical_notes) encrypted with AES-256-GCM at app layer. Key in `ENCRYPTION_KEY` env var.
- **Audit**: All mutations logged to `audit_logs` table via `audit()` service.
- **Error handling**: `AppError` class for expected errors (4xx). Global error handler catches unhandled errors and returns consistent JSON `{ error: { message, code } }`.
- **Soft delete**: Users are deactivated (`is_active = false`), not removed. Groups are hard-deleted (CASCADE to members).
- **Offline-first (mobile)**: Data loaded from SQLite first, then synced from API. Auth tokens in SecureStore, user profile + group data in SQLite.
- **API base URL (mobile)**: Auto-detects — `10.0.2.2:3000` for Android emulator, `localhost:3000` for iOS sim. Configurable via `app.json > extra.apiUrl`.

### Database Tables

Phase 1: `users`, `groups`, `group_members`, `refresh_tokens`, `audit_logs`
Phase 3: `ibadah_guides` (umrah 5 + haji 6 steps), `duas` (6 prayers)
Phase 4: `schedules` (per group, with status: upcoming/active/done)
Phase 5: `miqat_zones` (5 miqat + 1 haram), `ihram_status`, `user_locations`
Phase 7: `sos_alerts` (category: medis/tersesat/kehilangan, status: active/resolved/cancelled)

Migrations run programmatically via `tsx src/db/migrate.ts` (not knex CLI).

### Testing

```bash
npm run test -w server     # vitest — crypto + geofence unit tests (14 tests)
npm run db:cleanup -w server  # Clean expired tokens + old audit logs
```

### API Response Format

```
Success: { data: { ... } }
List:    { data: [...], meta: { total, page, limit } }
Error:   { error: { message, code, details? } }
```

## Implementation Phases

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Server + Auth + DB + User/Group CRUD | Done |
| 2 | Mobile app: Auth + Beranda + offline DB | Done |
| 3 | Doa + Tuntunan ibadah (CRUD + offline) | Done |
| 4 | Jadwal per rombongan | Done |
| 5 | Geofence + Peta miqat + Status ihram | Done |
| 6 | Lokasi real-time + Dashboard muthawwif | Done |
| 7 | SOS system | Done |
| 8 | Admin web panel | Done |
| 9 | Polish + Testing + Deployment | Done |
