# Suara Rombongan — Prototipe (broadcast muthawwif → jamaah)

Pengganti handy talky: muthawwif menyiarkan suara (memandu doa/dzikir) ke seluruh
jamaah se-rombongan secara real-time; jamaah **hanya mendengar** (broadcast satu arah).
Dibangun di atas **LiveKit** (WebRTC SFU, self-host).

Status: **prototipe** di branch `feat/voice-broadcast`. Kode sudah lengkap & ter-compile
(server + mobile), TAPI belum di-build native / diuji end-to-end (butuh server LiveKit
berjalan + 2 perangkat).

## ⚠️ Baca dulu: keterbatasan yang menentukan
- **Ketergantungan sinyal data.** Beda dari HT (radio mandiri), fitur ini butuh
  data seluler/WiFi. Saat PUNCAK tawaf (jaringan seluler paling macet) keandalannya
  belum terbukti — **wajib uji lapangan** sebelum diandalkan sebagai pengganti HT.
  Kemungkinan besar berperan sebagai *pelengkap*, bukan pengganti penuh saat puncak.
- Butuh **VPS ber-IP publik** untuk LiveKit + **wss (TLS)** untuk klien mobile.
- Baterai: siaran + earphone selama ritual berjam-jam → sarankan power bank.

## Arsitektur
```
Muthawwif (publish) ─┐
                     ├─► LiveKit SFU (self-host) ─► Jamaah (subscribe/listen only)
Jamaah (listen)  ────┘
        ▲
        └─ token dari mabrur-api: GET /voice/token
           (peran dari group_members.role_in_group → muthawwif=publish, lainnya=listen)
Room = "group-<groupId>" (satu saluran per rombongan)
```
Broadcast satu-arah **ditegakkan di server**: token jamaah tidak diberi hak `canPublish`.

## 1. Jalankan LiveKit (self-host)
```bash
cd docs/voice-broadcast
docker run --rm livekit/livekit-server generate-keys   # salin key & secret ke livekit.yaml
# edit livekit.yaml: isi keys, (opsional) sesuaikan port
docker compose -f docker-compose.livekit.yml up -d
```
Buka firewall VPS: TCP 7880 & 7881, UDP 50000-60000. Sediakan **wss** (TLS) via reverse
proxy (nginx/Caddy) yang meneruskan ke `:7880`, mis. `wss://voice.sosmartpro.com`.

## 2. Konfigurasi mabrur-api
Tambahkan ke `.env` (nilai key/secret HARUS sama dengan `livekit.yaml`):
```
LIVEKIT_URL=wss://voice.sosmartpro.com
LIVEKIT_API_KEY=APIxxxx
LIVEKIT_API_SECRET=xxxxxxxx
```
Tanpa ketiga env ini, `GET /voice/token` menjawab **503 NOT_CONFIGURED** (fitur mati aman).
Deploy server seperti biasa (`git pull && npm install && npm run server:build && pm2 restart mabrur-api`).
`npm install` perlu karena ada dependensi baru `livekit-server-sdk`.

## 3. Build & uji aplikasi mobile
Modul WebRTC bersifat native → butuh prebuild + build.

**Prasyarat build (penting — gotcha yang sudah terbukti):**
- **JDK 17–21** (mis. JBR Android Studio). JDK 24/25 membuat langkah *prefab*
  WebRTC gagal (`GeneratePrefabPackages` menganggap warning "restricted method"
  JVM sebagai error). Set `JAVA_HOME` ke JDK 21 sebelum build.
- `livekit-client` sudah masuk dependencies (peer dep `@livekit/react-native`;
  tanpa ini Metro gagal resolve saat bundling).
- Setelah `prebuild --clean`, `android/local.properties` terhapus → buat ulang
  `sdk.dir=<path Android SDK>`.

```bash
cd apps/mobile
npm install                       # pasang dep LiveKit + livekit-client (branch ini)
npx expo prebuild -p android      # terapkan config plugin (izin mikrofon, minSdk, dll)
export JAVA_HOME="/path/ke/jdk21" # JBR Android Studio: .../Android Studio/jbr
cd android && ./gradlew assembleRelease
```
Uji end-to-end butuh **2 perangkat** di rombongan yang sama:
- Login sebagai **muthawwif** → Alat Ibadah → **Suara Rombongan** → "Mulai Siaran".
- Login sebagai **jamaah** → Suara Rombongan → otomatis mendengar; indikator
  "Muthawwif berbicara" menyala saat muthawwif bicara.

## ⚠️ Kembali ke master dengan aman (penting sebelum build rilis jamaah)
`node_modules/` & `android/` dipakai bersama semua branch dan tidak di-git.
Setelah bereksperimen di branch ini, sebelum membangun APK rilis dari `master`:
```bash
git checkout master
cd apps/mobile
npm install                       # buang dep LiveKit (tak ada di package.json master)
npx expo prebuild -p android --clean   # regen android/ bersih tanpa WebRTC (bila perlu)
cd android && ./gradlew assembleRelease
```
Ini mencegah WebRTC ikut ter-bundle ke APK jamaah lewat autolinking.

## Biaya & operasional
- Self-host LiveKit: tanpa biaya per-menit; Anda tanggung 1 VPS + bandwidth. Untuk
  broadcast (1 bicara, N dengar) beban ringan-menengah per rombongan.
- Skala banyak rombongan serentak → pantau CPU/bandwidth VPS; LiveKit single-node
  cukup untuk puluhan room kecil, multi-node butuh Redis (di luar cakupan prototipe).

## Catatan agama
Ini kanal komunikasi (bukan konten). Isi bimbingan doa/dzikir tetap tanggung jawab
muthawwif secara live.
```
