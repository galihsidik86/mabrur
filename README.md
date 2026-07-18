# Mabrur

Sistem panduan haji & umrah untuk jamaah dan muthawwif. Satu aplikasi dengan dua mode — jamaah mendapat panduan ibadah, geofence miqat, dan SOS darurat; muthawwif memantau rombongan secara real-time.

## Stack

| Layer | Teknologi |
|-------|-----------|
| Mobile | React Native (Expo SDK 57) + Expo Router + SQLite (offline) |
| Admin Web | React + Vite |
| Server | Express + TypeScript |
| Database | PostgreSQL 16+ |

## Quick Start (Development)

### 1. PostgreSQL

Pastikan PostgreSQL berjalan di `localhost:5432`. Buat database:

```sql
CREATE USER mabrur WITH PASSWORD 'mabrur_secret' CREATEDB;
CREATE DATABASE mabrur OWNER mabrur;
```

Atau gunakan Docker:
```bash
docker compose up postgres -d
```

### 2. Environment

```bash
cp .env.example .env
# Edit .env — generate secrets:
# node -e "const c=require('crypto'); console.log(c.randomBytes(48).toString('hex'))"
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Server

```bash
npm install                 # Install server dependencies
npm run db:migrate          # Buat tabel database
npm run db:seed             # Seed admin (08000000001/admin123) + konten
npm run server:dev          # Jalankan di port 3000
```

### 4. Admin Panel

```bash
cd apps/admin
npm install
npm run dev                 # Jalankan di port 5173
# Buka http://localhost:5173 — login: 08000000001/admin123
```

### 5. Mobile App

```bash
cd apps/mobile
npm install
npx expo start              # Scan QR dengan Expo Go
```

## Fitur

| Fitur | Jamaah | Muthawwif | Admin |
|-------|--------|-----------|-------|
| Beranda / dashboard | Ihram status, agenda, rombongan | Monitoring anggota, SOS alert | - |
| Tuntunan ibadah | Umrah (5 tahap) + Haji (6 tahap) | Sama | Edit konten |
| Doa & bacaan | 6 doa dengan Arab + Latin + terjemahan | Sama | Edit konten |
| Jadwal rombongan | Lihat timeline | Lihat + edit | CRUD |
| Peta & geofence miqat | GPS, jarak ke miqat, peringatan ihram | - | - |
| SOS darurat | Kirim SOS + lokasi + kartu medis | Terima alert, resolve | - |
| Kelola user | - | - | CRUD user + assign role |
| Kelola rombongan | - | - | CRUD group + assign anggota |

## API Endpoints

### Auth
- `POST /auth/login` — Login (phone + password)
- `POST /auth/refresh` — Refresh token
- `POST /auth/logout` — Logout
- `GET /auth/me` — Profil lengkap user

### Users (Admin)
- `GET/POST /users` — List + create
- `GET/PATCH/DELETE /users/:id` — Detail + update + soft-delete

### Groups (Admin)
- `GET/POST /groups` — List + create
- `GET/PATCH/DELETE /groups/:id` — Detail + update + delete
- `GET/POST /groups/:id/members` — Anggota + assign
- `DELETE /groups/:id/members/:userId` — Keluarkan

### Content (Read: semua, Write: admin)
- `GET/POST /ibadah-guides` — Tuntunan ibadah
- `GET/PUT/DELETE /ibadah-guides/:id`
- `GET/POST /duas` — Doa & bacaan
- `GET/PUT/DELETE /duas/:id`

### Schedules
- `GET/POST /groups/:id/schedules` — Jadwal rombongan
- `PUT/DELETE /schedules/:id` — (admin + muthawwif)

### Geofence
- `GET /miqat-zones` — Daftar zona miqat
- `GET /miqat-zones/nearest?lat=&lng=` — Miqat terdekat + jarak
- `GET /ihram/status` — Status ihram
- `POST /ihram/toggle` — Toggle ihram
- `POST /locations` — Update lokasi

### SOS
- `POST /sos` — Kirim SOS
- `GET /sos/active` — SOS aktif sendiri
- `DELETE /sos/:id` — Batalkan SOS
- `PATCH /sos/:id/resolve` — Resolve (muthawwif/admin)
- `GET /groups/:id/sos` — SOS aktif rombongan

### Monitoring (Muthawwif/Admin)
- `GET /groups/:id/members/status` — Status semua anggota + lokasi + ihram

## Testing

```bash
npm run test -w server       # Unit tests (crypto, geofence)
```

## Deployment (Production)

```bash
# Set secrets di .env
docker compose up -d         # PostgreSQL + Server
# Server auto-migrate pada startup
```

Atau manual di VPS:
```bash
npm run server:build         # Compile TypeScript
npm run db:migrate           # Migrate database
node dist/index.js           # Start server
```

### Maintenance
```bash
npm run db:cleanup -w server  # Hapus token expired + audit log lama
```

## Integrasi Safar (back-office travel)

Mabrur menerima sinkronisasi rombongan dari **[Safar](https://github.com/galihsidik86/simabrur)** (sistem back-office: pendaftaran → pembayaran → operasional → akuntansi). Auth mesin-ke-mesin via header `X-Service-Token` (env `SAFAR_SYNC_TOKEN`, min 32 char — kosong = integrasi nonaktif, endpoint menjawab 503).

- `POST /integrations/safar/sync` — upsert idempoten group + users + members + schedules (kunci `external_ref` = UUID entitas Safar). Password awal hanya untuk akun baru; akun lama tidak di-reset. Agenda hasil sinkron ber-tag `external_source='safar'` (agenda buatan muthawwif tidak disentuh).
- `GET /integrations/safar/groups/:externalRef/status` — monitoring anggota + SOS aktif untuk dashboard Safar.

Perubahan skema: `users.external_ref`, `groups.external_ref` (unique, nullable), `schedules.external_source`. Tidak menyentuh algoritme geospasial/artefak riset.

## Keamanan

- Password: bcrypt (12 rounds)
- Data sensitif (paspor, catatan medis): AES-256-GCM
- Auth: JWT access (15min) + refresh token rotation (30 hari)
- RBAC: cek server-side tiap endpoint
- Rate limiting: 10 login/15 menit
- Audit trail: semua mutasi tercatat
- Input: validasi Zod server-side
- Headers: Helmet (HSTS, X-Frame-Options, CSP)
