# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mabrur** — sistem panduan haji & umrah untuk jamaah dan muthawwif. React Native (Expo) mobile app + Express/TypeScript backend + PostgreSQL + React/Vite admin panel. All user-facing text is in Bahasa Indonesia.

## Design Reference

`project/Labbaik.dc.html` is the pixel-perfect design prototype. Read it before implementing UI. It uses dc-runtime (`project/support.js`) — visual reference only, not production code.

### Design Tokens

- **Primary (maroon)**: `#8B2E2E`, darker `#6E2424`, lighter `#F3D9CD`
- **Green**: `#4A7C3A`, badge `#DCEBD3` | **Gold**: `#D4A437`, badge `#FAEFC9` | **Danger**: `#C44536`
- **Background**: `#F5F1E8` (screen), `#E4DAC7` (outer) | **Text**: `#1F1B16` / `#5C3A1E` / `#8C6B4A`
- **Fonts**: Plus Jakarta Sans (UI), Amiri (Arabic)
- Mobile tokens defined in `apps/mobile/src/theme.ts` — always import `colors` and `radius` from there.

## Development Commands

```bash
# Prerequisites: PostgreSQL running on localhost:5432, database "mabrur" exists

# Server (from project root — npm workspace)
npm install               # Install server dependencies
npm run db:migrate        # Run migrations (programmatic via tsx, not knex CLI)
npm run db:rollback       # Rollback last migration batch
npm run db:seed           # Seed admin + content (08000000001 / admin123)
npm run server:dev        # Start dev server with hot reload (port 3000)
npm run server:build      # TypeScript compile to dist/

# Tests
npm run test              # vitest run — all tests once
npm run test:watch -w server  # vitest watch mode
# Run single test file:
npx vitest run tests/crypto.test.ts --config server/vitest.config.ts

# Admin Panel (from apps/admin/)
cd apps/admin && npm install  # First time only
npm run dev               # Vite dev server (port 5173)

# Mobile (from apps/mobile/ — NOT in npm workspace, separate node_modules)
cd apps/mobile && npm install  # First time only
npx expo start            # Expo dev server
npx expo start --android  # Android emulator

# Maintenance
npm run db:cleanup        # Delete expired tokens + audit logs > 90 days
```

## Architecture

```
mabrur/
├── server/              ← Express + TypeScript API (npm workspace member)
│   └── src/
│       ├── index.ts          Entry point (listen on PORT)
│       ├── app.ts            Express setup: helmet, cors, compression, routes, error handler
│       ├── config.ts         Env validation via Zod (loads ../../.env)
│       ├── logger.ts         Pino logger (pretty in dev, JSON in prod)
│       ├── db/               Knex instance, migrations (8 batches), seeds (6 batches)
│       ├── middleware/        auth, rbac, validate, error-handler, csrf, transaction
│       ├── routes/            Feature-based routers (auth, users, groups, content, etc.)
│       ├── services/          Business logic (auth, user, group, crypto, audit, sos, push, etc.)
│       └── types/             TypeScript types + Express.Request augmentation (req.auth)
├── apps/mobile/         ← React Native (Expo SDK 57) — standalone, NOT in workspace
│   ├── app/                  Expo Router file-based routing
│   │   ├── _layout.tsx       Root layout: fonts, DB init, session restore, auth guard
│   │   ├── login.tsx         Login screen
│   │   ├── sos.tsx           SOS modal (full-screen)
│   │   └── (tabs)/           5-tab navigation + SOS FAB
│   └── src/
│       ├── theme.ts          Design tokens (colors, radius)
│       ├── stores/auth.ts    Zustand auth state + SecureStore persistence
│       ├── services/api.ts   API client with auto token refresh
│       ├── services/db.ts    SQLite offline database (9 tables)
│       ├── services/location.ts      Haversine distance, geofence queries
│       ├── services/background.ts    Background location tracking task
│       ├── services/notification.ts  Push + local notifications
│       ├── services/sacred-zones.ts  Arafah/Jamarat coordinates + boundary checks
│       └── services/i18n.ts  Zustand i18n store (id/en/ar)
├── apps/admin/          ← React + Vite admin panel
│   └── src/
│       ├── App.tsx           Sidebar layout + React Router routes + RequireAuth guard
│       ├── api.ts            API client (localStorage tokens, auto-refresh on 401)
│       └── pages/            Login, Dashboard, Users, Groups, Content
├── .env                  Environment variables (not committed)
├── render.yaml           Render.com deployment config
└── docker-compose.yml    PostgreSQL + Server containers
```

## Key Patterns

### Server

- **Auth**: JWT access token (15min) + refresh token (30 days, rotated, stored SHA256-hashed in DB). Login via phone + password. Middleware sets `req.auth: { sub: userId, role: UserRole }`.
- **RBAC**: Three roles — `admin`, `muthawwif`, `jamaah`. Use `authorize('admin', 'muthawwif')` middleware. Non-admin access to groups requires `assertMember(groupId, userId)`.
- **Validation**: Zod schemas defined in route files, applied via `validate(schema)` (body), `validate(schema, 'query')`, or `validate(schema, 'params')`.
- **Errors**: `throw new AppError(statusCode, message, code)` for expected errors. Global error handler returns `{ error: { message, code } }`. Unhandled errors → 500.
- **Express 5 params**: `req.params` returns `string | string[]`. Use the `param(val)` helper to safely get a string value.
- **Encryption**: Sensitive fields (passport_no, medical_notes) encrypted with AES-256-GCM. Format: `iv:tag:ciphertext` (hex). Key from `ENCRYPTION_KEY` env var.
- **Audit**: All mutations logged to `audit_logs` via `audit(userId, action, entity?, entityId?, details?)`. Fails gracefully.
- **Soft delete**: Users deactivated (`is_active = false`), not removed. Groups are hard-deleted (CASCADE).
- **Pagination**: `page` (1-indexed) + `limit` (max 100). Response: `{ data: [...], meta: { total, page, limit } }`.
- **Migrations**: Programmatic via `tsx src/db/migrate.ts`, not knex CLI. Seeds are idempotent.

### Mobile

- **Offline-first**: Load from SQLite first, then sync from API. Auth tokens in SecureStore, everything else in SQLite.
- **API base URL**: Configured in `app.json > extra.apiUrl`. Fallback: `10.0.2.2:3000` (Android emulator), `localhost:3000` (iOS sim).
- **State**: Zustand for auth (`useAuthStore`) and i18n (`useI18n`). React hooks (useState/useEffect) for everything else.
- **Background services**: Started after login in `_layout.tsx` — location tracking (30s/100m interval), push token registration, schedule notifications.
- **Role-based UI**: Check `user.role` to show muthawwif dashboard, SOS resolution, member monitoring.

### Admin Panel

- **Auth**: localStorage for tokens + user object. `RequireAuth` component checks `role === 'admin'`.
- **Styling**: Inline `React.CSSProperties` objects using design tokens. No CSS framework.
- **API client**: Generic `api<T>()` wrapper with auto-refresh on 401 and redirect to `/login` on refresh failure.

## Database Tables

`users`, `groups`, `group_members`, `refresh_tokens`, `audit_logs`, `ibadah_guides`, `duas`, `schedules`, `miqat_zones`, `ihram_status`, `user_locations`, `sos_alerts`

All tables use UUID primary keys (`gen_random_uuid()`). Enum types: `user_role` (admin/muthawwif/jamaah), `group_role` (jamaah/muthawwif).

## API Response Format

```
Success: { data: { ... } }
List:    { data: [...], meta: { total, page, limit } }
Error:   { error: { message, code, details? } }
```

## Environment Variables

Required in `.env` (see `.env.example`):

| Variable | Notes |
|----------|-------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Min 32 chars |
| `JWT_REFRESH_SECRET` | Min 32 chars, different from JWT_SECRET |
| `ENCRYPTION_KEY` | Exactly 64 hex chars (32 bytes) |
| `PORT` | Default 3000 |
| `NODE_ENV` | development / production |
