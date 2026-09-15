# Paket Reproduksi — Pengujian Akurasi Algoritma Geospasial

Direktori ini adalah paket reproduksi untuk naskah **"Pengujian Akurasi Algoritma
Geospasial untuk Deteksi Ritual Haji Berbasis GPS terhadap Galat Posisi"**
(sistem Mabrur). Seluruh angka pada tabel dan gambar naskah dihasilkan dari skrip
di direktori ini dan dapat direproduksi secara identik.

## Prasyarat

- Node.js ≥ 18 dan `npm install` di root repositori (menyediakan `tsx`)
- `playwright` (untuk `charts.js`) **BELUM** ada di `package.json` manapun di repo
  ini (gap pra-eksisting, bukan sesuatu yang ditambahkan revisi ini) — install manual
  sebelum menjalankan grafik: `npm install --no-save playwright && npx playwright
  install chromium`. Direkomendasikan menambah `playwright` ke `devDependencies`
  root `package.json` agar `npm install` saja sudah cukup (di luar cakupan tugas ini).
- Python 3 dengan `pip install python-docx` — *opsional*, hanya untuk membangun draf Word

## Reproduksi Hasil Naskah (satu perintah)

```bash
npm run simulate
```

Perintah ini (durasi ± 100 detik pada mesin kelas laptop — naik dari ±2 detik
sebelum revisi 2026-09-14 karena penambahan eksperimen R4/R6/R8/R9, lihat di
bawah):
1. Menjalankan seluruh simulasi Monte Carlo (`run.ts`) — seed **mulberry32(42)** —
   dan menulis `results/summary.md`, seluruh CSV eksperimen, serta
   `results/monte_carlo_results.json`.
2. Membandingkan **138 sel** hasil (algoritma inti, Tabel 3–9) terhadap angka
   naskah via `verify-manuscript.ts` — menulis `results/TABLES.md` (tabel format
   naskah) dan `results/MANUSCRIPT_DIFF.md` (laporan COCOK/BEDA per sel; toleransi
   0,01; confusion matrix harus sama persis). Exit code 1 bila ada sel BEDA.
   (Eksperimen tambahan R4/R6/R8/R9 belum punya angka acuan naskah — CSV-nya
   ditulis tapi tidak diverifikasi terhadap `NASKAH` di langkah ini.)

Karena PRNG ber-seed dan tidak ada sumber non-determinisme (tidak ada
`Date.now()`/`Math.random()` di manapun dalam harness — diverifikasi jalan dua
kali berturut-turut, seluruh berkas keluaran byte-identik), output identik
bit-per-bit antar eksekusi maupun antar mesin. SHA-256 keluaran (konten LF,
diverifikasi 2026-09-15 setelah revisi kebijakan tawaf "tidak pernah dini" —
lihat "Revisi 2026-09-15" di bawah; hanya baris `tawaf_*` yang berubah dari
verifikasi 2026-09-14):

| Berkas | SHA-256 |
|---|---|
| `miqat_accuracy.csv` | `b6d19b7762ce7e12b7a1ce7889b6e8cfd3fee5db96c1fcd1d04bd2e4ab70aeab` |
| `arafah_accuracy.csv` | `ab49472a35bafca16e34ab4e2cbc282c9e4808ffbe18e8cf3572ad7679b094af` |
| `tawaf_accuracy.csv` | `f484ed7f7195002059ab5a026eb3cabb99b57509d050060dcb46dc8ac8f97f39` |
| `sai_accuracy.csv` | `a3171ca481caba0c71ce44de3260ddacd23609bf49a3ca7385ccf11b92a4d637` |
| `jamarat_accuracy.csv` | `dc864adbe8f2f519b82e0de69b71af226e26d51b5a9c0e9103e1d16a37b03ea3` |
| `tawaf_scenarios.csv` (R8) | `81494922bed72f6629846492abba3b2463d4a5534485dea4a0921fee43d4074d` |
| `sai_scenarios.csv` (R9) | `1d44d5c99c95571a0c011d7c32923ab6aa02940f251a4b3b01884b64ef3b3d23` |
| `noise_models.csv` (R6) | `a478aa3f92c66d0751c5821b54bc6c9f125d5024169c1b2a9d89690b08be914a` |
| `analytic_check.csv` (R4) | `be0e5f989092d53278fb2ded672540bb5d445c723c74f6373295acc014a58698` |
| `boundary_error_curve.csv` (R4) | `e12f0fbc2ba0670ffaf23ff8ec090ecc5c563e9c4bbfeac3a4d00c7d16966a33` |
| `tawaf_histogram.csv` | `d4fe513d8f2700e015c31825bce5c111c9de589c591c9f5772b67758b8e8f0f0` |
| `tawaf_early_trigger.csv` | `4095a982125a312ea8180e1931a5974c6493033e40c042fc3e1886fe12abb756` |
| `monte_carlo_results.json` | `199f369b7e19d486b2f211a61f002554108e868d344eec5c4ff26c44a7fc9a19` |

> Catatan EOL: git dapat mengonversi berkas ke CRLF saat checkout di Windows
> (`core.autocrlf`). Hash di atas dihitung atas konten LF sebagaimana ditulis
> skrip; normalisasi `\r\n → \n` sebelum menghitung hash bila perlu.

## Menjalankan per langkah

```bash
# 1) Simulasi Monte Carlo → results/summary.md + 5 CSV + monte_carlo_results.json
npx tsx docs/accuracy-test/run.ts

# 2) Verifikasi terhadap angka naskah → TABLES.md + MANUSCRIPT_DIFF.md
npx tsx docs/accuracy-test/verify-manuscript.ts

# 3) Grafik → results/figures/*.png (8 gambar @2x, sejak R8/R4 2026-09-14) + captions.md
node docs/accuracy-test/charts.js

# 4) Validasi lapangan (replay GPS riil dari field_logs/*.gpx) → FIELD_VALIDATION.md
npm run replay          # lihat gps-replay/README.md; --demo untuk fixture sintetis
npm run test:replay     # unit test parser + transformasi koordinat
```

Simulasi memakai PRNG mulberry32 dengan benih tetap (`SEED = 42`) dan tidak
memanggil `Date.now()`/`Math.random()`, sehingga eksekusi ulang menghasilkan
CSV yang identik bit-per-bit. Parameter utama ada di bagian atas `run.ts`:
`SIGMAS = [0, 1, 3, 5, 10, 15]` (meter, per sumbu), konversi meter→derajat
(`M_PER_DEG_LAT = 111320`; bujur dikali `cos(lintang)`).

### Angka kunci untuk verifikasi cepat

Setelah menjalankan langkah (1), nilai-nilai berikut harus muncul persis
(tawaf **diperbarui 2026-09-15** — lihat "Revisi 2026-09-15" di bawah):

| Sumber | Nilai yang diharapkan |
|---|---|
| `tawaf_accuracy.csv`, σ=5 | akurasi tepat-7 = **97,67%**, rata-rata 6,98 |
| `tawaf_accuracy.csv`, σ=10 | akurasi tepat-7 = **92,67%**, rata-rata 6,95 |
| `tawaf_accuracy.csv`, σ=15 | akurasi tepat-7 = **28,33%**, rata-rata 6,43, CI95 [23,53%, 33,68%] |
| `sai_accuracy.csv`, semua σ | akurasi tepat-7 = **100,00%** |
| `jamarat_accuracy.csv`, σ=15 | benar = **83,53%**, salah pilar = 0,32%, tak terdeteksi = 16,15% |
| `miqat_accuracy.csv`, σ=15 | akurasi = **99,45%** |
| `arafah_accuracy.csv`, σ=15 | akurasi = **99,44%** |
| `summary.md`, bagian 0 | Safa–Marwah = **419,0 m**; antar-jamarat 76,0 / 68,2 / 144,0 m |

## Pemetaan keluaran → naskah

| Keluaran | Naskah |
|---|---|
| `miqat_accuracy.csv` | Tabel 4; Gambar 2 |
| `arafah_accuracy.csv` | Tabel 5; Gambar 3 |
| `tawaf_accuracy.csv` + `tawaf_histogram.csv` + `tawaf_early_trigger.csv` | Tabel 6; Gambar 4 |
| `sai_accuracy.csv` | Tabel 7; Gambar 5 |
| `jamarat_accuracy.csv` | Tabel 8–9; Gambar 6 |
| `summary.md` bag. 1 | Tabel 3 (Haversine vs Vincenty) |
| `figures/fig1-gabungan.png` | Gambar 1 (ringkasan enam algoritma) |
| `tawaf_scenarios.csv` + `figures/fig7-*.png` | R8 — sensitivitas radius/mode/skenario Tawaf (belum ada nomor tabel/gambar naskah resmi) |
| `sai_scenarios.csv` | R9 — sensitivitas titik balik/lateral Sa'i (belum ada nomor tabel naskah resmi) |
| `noise_models.csv` | R6 — perbandingan model derau iid/AR(1)/Gauss-Markov/bias (belum ada nomor tabel naskah resmi) |
| `analytic_check.csv` + `boundary_error_curve.csv` + `figures/fig8-*.png` | R4 — validasi analitik vs Monte Carlo (belum ada nomor tabel/gambar naskah resmi) |

## Asal algoritma yang diuji (R10, 2026-09-14)

Koordinat sakral & algoritma murni **diimpor LANGSUNG** (bukan disalin) dari
`apps/mobile/src/services/sacred-zones-core.ts` via `docs/accuracy-test/sim-core.ts`
— pola impor yang sama dipakai `docs/accuracy-test/gps-replay/*`. Ini
menggantikan pendekatan salinan-verbatim sebelum 2026-09-14.

| Algoritma / data | Sumber | Cara didapat |
|---|---|---|
| Koordinat (KAABAH, SAFA, MARWAH, ARAFAH_BOUNDARY, JAMARAT) | `sacred-zones-core.ts` | diimpor |
| Poligon Arafah (ray casting) | `sacred-zones-core.ts` (`isPointInPolygon`) | diimpor |
| Penghitung tawaf | `sacred-zones-core.ts` (`TawafTracker`) | diimpor |
| Penghitung sa'i | `sacred-zones-core.ts` (`SaiTracker`) | diimpor |
| Identifikasi jamarat | `sacred-zones-core.ts` (`detectNearestJamarat`) | diimpor |
| Haversine | `apps/mobile/src/services/location.ts` | **salinan** — `location.ts` mengimpor `expo-location`, gagal di runtime Node/tsx harness. Formula identik verbatim dgn `location.ts:3-16` DAN dgn fungsi privat `distanceMeters` di `sacred-zones-core.ts` (tidak diekspor, tidak bisa diimpor) — sinkronisasi manual wajib bila salah satu berubah. |
| Geofence miqat (batas 1.000 m, data 5 zona) | `server/src/db/seeds/004_miqat_zones.ts` | **salinan** — bukan bagian `sacred-zones-core.ts`, cerminan seed server (lintas-bahasa TS server ↔ harness, tidak bisa diimpor langsung) |

`TawafTracker` publik tidak diadaptasi sama sekali untuk harness — signature
`update(lat, lng, now?)` sudah menerima `now` opsional secara native di produksi
(dipakai callback `onChange`, bukan debounce — debounce waktu sudah dihapus
dari algoritma produksi, lihat "Revisi 2026-09-14").

## Revisi 2026-09-14 — perbaikan arah Tawaf & eksperimen tambahan

**Bug kritis diperbaiki di produksi** (`TawafTracker`, lihat
`apps/mobile/src/services/sacred-zones-core.ts` dan
`docs/laporan-logika-perhitungan.md` §3): skema lama mendeteksi "putaran" saat
sudut melintasi 0° dari (0°,90°) ke (−90°,0°) — itu **SEARAH JARUM JAM (CW)**,
padahal tawaf yang sah harus **BERLAWANAN jarum jam (CCW)**. Skema baru
mengakumulasi **sudut kumulatif ter-unwrap** (toleransi hitung `ROUND_TOL_DEG=60°`,
guard outlier `MAX_STEP_DEG=150°`, **tanpa debounce waktu** — terbukti tak
diperlukan karena `bestCum` monoton naik, lihat komentar di kode produksi).

Harness (`run.ts`) sebelumnya memakai lintasan tawaf **CW** yang secara
kebetulan cocok dengan algoritma CW lama (keduanya bug, saling menutupi —
angka lama σ=15: tepat-7 72,67% TERLIHAT masuk akal tapi dihasilkan pasangan
salah+salah). Setelah lintasan diubah ke **CCW** (selaras algoritma produksi
yang sudah benar) dan seluruh algoritma diimpor langsung dari produksi (R10),
angka Tabel 6 BERUBAH SIGNIFIKAN pada σ besar (σ=10: 100%→94,33%; σ=15:
72,67%→26,67%) — ini **hasil yang diharapkan**, bukan regresi: radius kecil
(25 m) membuat derau tangensial (dalam derajat) besar pada σ tinggi, dan
sekarang diuji dengan pasangan lintasan+algoritma yang BENAR-BENAR CCW-vs-CCW.
`verify-manuscript.ts` `NASKAH.tawaf` diperbarui mengikuti angka baru ini
(dengan komentar penjelasan di kode).

**Eksperimen baru** (lihat `docs/accuracy-test/experiments/*.ts`):
- **R8** (`tawaf-scenarios.ts`): sensitivitas radius edar r∈{12,15,25,40,60}m,
  mode default/adaptif, 3 skenario lintasan (ideal / mulai=selesai tanpa diam /
  mulai=selesai dgn diam 30 dtk), σ 11 nilai, 500 percobaan/sel (330 sel) →
  `results/tawaf_scenarios.csv`, `figures/fig7-*.png`.
- **R9** (`sai-scenarios.ts`): sensitivitas titik balik (berhenti o meter
  sebelum Safa/Marwah) × pergeseran lateral l × σ, 500 percobaan/sel (90 sel)
  → `results/sai_scenarios.csv`. **Temuan non-monoton dicatat**: pada o=25 m
  (persis di tepi radius zona 25 m), akurasi tepat-7 TIDAK monoton naik/turun
  terhadap σ (mis. 13,6% @σ=5 vs 64,2% @σ=15) — kemungkinan efek diskret
  "tepi pisau" (noise kecil belum cukup membantu menyentuh zona, noise besar
  memberi lebih banyak kesempatan menyentuhnya pada sampel-sampel dekat
  titik balik); BELUM divalidasi independen, dicatat sebagai temuan yang
  perlu peninjauan, bukan kesimpulan final.
- **R6** (`noise-models.ts`): iid vs AR(1) per-sumbu (ρ dari data lapangan
  `field_characterization.json`, dibaca saat runtime bukan hardcode) vs
  Gauss-Markov (τ=30/120 dtk) vs bias konstan+iid, diterapkan ke tawaf
  skenario III r=25, sa'i, dan jamarat (iid+bias saja, posisi statis) →
  `results/noise_models.csv`.
- **R4** (`analytic.ts`): cek akurasi analitik (pendekatan pita-batas
  `0,7979σ/2500` utk miqat, `0,7979σ·keliling/luas` utk Arafah, distribusi
  Rice utk jamarat tak-terdeteksi) vs Monte Carlo → `results/analytic_check.csv`;
  kurva P(salah) vs jarak-bertanda `d` ke batas geofence lingkaran (MC vs
  Φ(−|d|/σ) analitik) → `results/boundary_error_curve.csv`,
  `figures/fig8-*.png`. **Catatan metode**: kurva batas dihitung dalam bidang
  East/North lokal (BUKAN lat/lng+haversine) — diagnostik awal menemukan bias
  sistematik ~1,1–1,4 m antara penempatan titik via proyeksi equirectangular
  dan pengukuran via haversine pada R=1.000 m, cukup besar relatif σ=3 m utk
  merusak validasi tepat di d=0 (MC≈35% bukan ≈50% teoretis); memakai bidang
  Euclidean 2D langsung (konsisten dgn asumsi rumus analitik itu sendiri)
  menghapus artefak ini (MC≈50% setelah perbaikan, cocok Φ). Lihat komentar
  di `experiments/analytic.ts`.
- **R5** (Wilson 95% CI): kolom `ci_lo`/`ci_hi` ditambahkan di AKHIR seluruh
  CSV/JSON proporsi utama (miqat/arafah/tawaf/sai/jamarat) — kolom lama TIDAK
  diubah/dipindah, `charts.js` (pemetaan kolom by-name) & `verify-manuscript.ts`
  (field JSON spesifik) tidak terpengaruh. Fungsi `wilson95()` di `stats.ts`,
  diuji `gps-replay/__tests__/stats.test.ts`.

File pendukung baru: `docs/accuracy-test/sim-core.ts` (RNG, noise, haversine,
Vincenty, MIQAT, metrik — primitif bersama), `docs/accuracy-test/stats.ts`
(Wilson CI, AR(1) stasioner, distribusi Rice, normal baku, geometri bantuan),
`docs/accuracy-test/experiments/{tawaf-scenarios,sai-scenarios,noise-models,analytic}.ts`.

## Revisi 2026-09-15 — kebijakan "tidak pernah dini" (Tawaf)

**Temuan review (handoff `05v-code-reviewer-tawaf.md`)**: `ROUND_TOL_DEG=60°`
(revisi 2026-09-14) adalah toleransi NEGATIF — putaran dianggap selesai 60°
**SEBELUM** 360k° tercapai — yang ternyata membuat aplikasi mengumumkan
"putaran selesai" rata-rata **~30 m busur (p50), hingga ~41 m (p95)** SEBELUM
jamaah benar-benar menyelesaikan putaran ke-7 (r=25 m, σ=5 m, mode adaptif —
konfigurasi produksi `tools.tsx`). Untuk aplikasi yang menghitung ibadah wajib,
ini berisiko fikih (jamaah bisa berhenti sebelum genap 7 putaran).

**Perbaikan** (lihat `apps/mobile/src/services/sacred-zones-core.ts`
§`TawafTracker` dan `docs/laporan-logika-perhitungan.md` §3 untuk detail):
`ROUND_TOL_DEG` **dihapus**, diganti dua mekanisme yang HANYA memperlambat
pemicuan (tidak pernah mempercepatnya): (1) referensi sudut awal = rata-rata
sirkular `REF_SAMPLES=3` sampel pertama (bias aman-ke-belakang), (2) margin=0
murni terhadap ambang `360k°` (tanpa toleransi positif). Ditambah perbaikan
M2: keluar-masuk band kini melacak durasi jeda eksplisit (`MAX_GAP_SEC=90 dtk`)
alih-alih membekukan referensi secara diam-diam (dulu berisiko kurang-hitung
tanpa sinyal saat jamaah terdorong keluar-masuk band).

**Evaluasi numerik parameter** (handoff `05c-tdd-guide-tawaf-never-early.md`):
kombinasi jendela-rata-rata K-sampel dan margin positif dicoba sebagai
kandidat tambahan tapi DITOLAK — keduanya menukar sebagian besar perbaikan
p95-dini dengan penurunan tajam proporsi tepat-7 (jendela ekor 30 dtk
pasca-selesai terlalu pendek untuk konvergensi rata-rata pada σ=5 m/r=25 m).
Desain akhir (`REF_SAMPLES=3`, margin=0) diverifikasi **0 m dini pada σ=0**
(bukan mendekati nol) dan proporsi tepat-7 ≥95% pada σ=5 (r=25/60, mode
default/adaptif) — TAPI p95 pemicuan-dini aktual pada σ=5 adalah **~7–11 m**,
TERBUKTI TIDAK mencapai target aspirasional ≤5 m yang ditetapkan di awal
perencanaan tugas ini. Ini keterbatasan yang melekat pada presisi GPS
konsumer (σ≈5 m) relatif terhadap radius edar sekecil 25 m dan jendela ekor
30 detik, bukan kegagalan implementasi — didokumentasikan apa adanya.

**Dampak pada lintasan harness**: `TawafTracker` kini merata-ratakan 3 sampel
pertama sebagai referensi — lintasan yang mulai DINGIN sambil LANGSUNG
bergerak (tanpa jeda) kehilangan ~1-2 langkah rotasi ke referensi TANPA cara
memulihkannya bila tak ada gerak/diam lanjutan pasca-selesai, memberi
UNDER-COUNT SISTEMATIS (bukan bug) bahkan pada σ=0. Lintasan Tabel 6 utama
(`run.ts`) dan Skenario I (R8) diberi *settle* (diam di titik mulai) + *tail*
(diam di titik selesai, sesuai kebijakan UI "GPS aktif ≥30 dtk") agar
merepresentasikan penggunaan wajar. **Skenario II (R8) SENGAJA dipertahankan**
tanpa settle di awal (kasus adversarial "mulai dingin tanpa jeda") — hasil
rata2 ≈6 (bukan 7) pada σ rendah untuk skenario ini WAJAR & DIHARAPKAN,
dilaporkan apa adanya di `results/tawaf_scenarios.csv` (scenario=II), bukan
disembunyikan.

**Kolom baru** (ditambahkan DI AKHIR, kolom lama tidak berubah nama/posisi):
`late_deg_p50/p95` + `late_arc_m_p50/p95` di `tawaf_early_trigger.csv`,
`late_deg_mean` di `tawaf_scenarios.csv` — melaporkan sisi KETERLAMBATAN
(aman, trade-off desain) terpisah dari sisi dini.

Angka Tabel 6 tawaf berubah kecil di σ rendah (100%→97,67–98,67% pada σ=1–5;
lihat "Angka kunci" di atas) — trade-off yang disengaja demi jaminan
"tidak pernah dini", bukan regresi kualitas algoritma.

## Catatan model derau

Parameter σ adalah simpangan baku **per sumbu koordinat** (East/North). Galat
horizontal (radial) resultan mengikuti distribusi Rayleigh dengan rata-rata
≈ 1,25σ, sehingga rentang uji σ = 1–15 m setara galat horizontal rata-rata
≈ 1,3–18,8 m — mencakup rentang empiris 5–13 m yang dilaporkan literatur akurasi
GPS ponsel.

## Struktur direktori

```
accuracy-test/
├── run.ts                     Orkestrator Monte Carlo (deterministik, impor dari sim-core.ts)
├── sim-core.ts                RNG mulberry32, noise, haversine, Vincenty, MIQAT, metrik
├── stats.ts                   Wilson CI, AR(1) stasioner, Rice, normal baku, geometri bantuan
├── experiments/
│   ├── tawaf-scenarios.ts     R8 — radius/mode/skenario lintasan Tawaf
│   ├── sai-scenarios.ts       R9 — titik balik & lateral Sa'i
│   ├── noise-models.ts        R6 — iid vs AR(1) vs Gauss-Markov vs bias
│   └── analytic.ts            R4 — cek analitik vs MC + kurva batas geofence
├── charts.js                  Pembangkit 8 grafik PNG (playwright — lihat "Prasyarat")
├── verify-manuscript.ts       Bandingkan 138 sel inti vs NASKAH, tulis TABLES.md/MANUSCRIPT_DIFF.md
├── build-docx.py              Perakit draf Word dari hasil (opsional)
└── results/
    ├── summary.md             Seluruh tabel hasil (algoritma inti + ringkasan eksperimen R4/R6/R8/R9)
    ├── *_accuracy.csv         Data 6 algoritma inti (desimal titik; kolom ci_lo/ci_hi di akhir, R5)
    ├── tawaf_scenarios.csv    R8 (330 sel x 500 percobaan)
    ├── sai_scenarios.csv      R9 (90 sel x 500 percobaan)
    ├── noise_models.csv       R6 (108 sel x 500 percobaan, format panjang: target,model,sigma,...)
    ├── analytic_check.csv     R4(a) — miqat/arafah/jamarat analitik vs MC
    ├── boundary_error_curve.csv  R4(b) — P(salah) MC vs Phi(-|d|/sigma), 84 sel x 20.000 sampel
    ├── tawaf_histogram.csv    Distribusi jumlah putaran per sigma (Tabel 6)
    ├── tawaf_early_trigger.csv  Pemicuan dini hitungan ke-7 (derajat/meter, Tabel 6)
    └── figures/               8 PNG @2x + captions.md
```
