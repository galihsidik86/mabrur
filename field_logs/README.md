# field_logs — Rekaman Trace GPS Lapangan

Taruh berkas **GPX** (atau CSV berkolom time/lat/lon/accuracy) hasil perekaman
berjalan kaki di direktori ini, lalu jalankan `npm run replay`.

Skenario minimal (interval 1 detik, aktifkan pencatatan *accuracy*):

1. **Lapangan terbuka** — jalan lurus ±300 m tanpa halangan langit.
2. **Padat bangunan / koridor sempit** — proxy *urban canyon*.
3. **Bolak-balik lurus ±400 m × 7 kali** — proxy sa'i.

Panduan lengkap + asumsi metodologi: `docs/accuracy-test/gps-replay/README.md`.
Berkas di direktori ini tidak di-commit otomatis — commit manual bila ingin
menyertakannya sebagai lampiran reproduksi naskah.
