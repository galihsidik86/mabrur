# Paket Reproduksi — Pengujian Akurasi Algoritma Geospasial

Direktori ini adalah paket reproduksi untuk naskah **"Pengujian Akurasi Algoritma
Geospasial untuk Deteksi Ritual Haji Berbasis GPS terhadap Galat Posisi"**
(sistem Mabrur). Seluruh angka pada tabel dan gambar naskah dihasilkan dari skrip
di direktori ini dan dapat direproduksi secara identik.

## Prasyarat

- Node.js ≥ 18 dan `npm install` di root repositori (menyediakan `tsx` dan `playwright`)
- Python 3 dengan `pip install python-docx` — *opsional*, hanya untuk membangun draf Word

## Reproduksi Hasil Naskah (satu perintah)

```bash
npm run simulate
```

Perintah ini (durasi ± 2 detik pada mesin kelas laptop):
1. Menjalankan seluruh simulasi Monte Carlo (`run.ts`) — seed **mulberry32(42)** —
   dan menulis `results/summary.md`, 5 CSV, serta `results/monte_carlo_results.json`.
2. Membandingkan **138 sel** hasil terhadap angka naskah (Tabel 2–9) via
   `verify-manuscript.ts` — menulis `results/TABLES.md` (tabel format naskah) dan
   `results/MANUSCRIPT_DIFF.md` (laporan COCOK/BEDA per sel; toleransi 0,01;
   confusion matrix harus sama persis). Exit code 1 bila ada sel BEDA.

Karena PRNG ber-seed dan tidak ada sumber non-determinisme, output identik
bit-per-bit antar eksekusi maupun antar mesin. SHA-256 keluaran (konten LF):

| Berkas | SHA-256 |
|---|---|
| `miqat_accuracy.csv` | `534d435e104ba94affde5217136163e42b613e8337111fe2dbed2cc0696e2efe` |
| `arafah_accuracy.csv` | `9c637cccbec03650c06c9244dd321d58148ab336d8bb610657e8b3f83d875bf7` |
| `tawaf_accuracy.csv` | `a6e76aa8967442259776d1c96773239b2699d99ba09597d5c077a0afde9388df` |
| `sai_accuracy.csv` | `4ee003be0ea15b0c1f3e2eab755ed452a483d4eb3906db02ed37630f06f8aa3d` |
| `jamarat_accuracy.csv` | `aa248ed956b1fff9fa6d63567861db3033a214909b96e3ddf0da777fd038762b` |
| `monte_carlo_results.json` | `dce3ecda36e7e1cfe6e86b17e135dffe8e396ecc0b28536a587e0ff95ea538ca` |

> Catatan EOL: git dapat mengonversi berkas ke CRLF saat checkout di Windows
> (`core.autocrlf`). Hash di atas dihitung atas konten LF sebagaimana ditulis
> skrip; normalisasi `\r\n → \n` sebelum menghitung hash bila perlu.

## Menjalankan per langkah

```bash
# 1) Simulasi Monte Carlo → results/summary.md + 5 CSV + monte_carlo_results.json
npx tsx docs/accuracy-test/run.ts

# 2) Verifikasi terhadap angka naskah → TABLES.md + MANUSCRIPT_DIFF.md
npx tsx docs/accuracy-test/verify-manuscript.ts

# 3) Grafik → results/figures/*.png (6 gambar @2x) + captions.md
node docs/accuracy-test/charts.js
```

Simulasi memakai PRNG mulberry32 dengan benih tetap (`SEED = 42`) dan tidak
memanggil `Date.now()`/`Math.random()`, sehingga eksekusi ulang menghasilkan
CSV yang identik bit-per-bit. Parameter utama ada di bagian atas `run.ts`:
`SIGMAS = [0, 1, 3, 5, 10, 15]` (meter, per sumbu), konversi meter→derajat
(`M_PER_DEG_LAT = 111320`; bujur dikali `cos(lintang)`).

### Angka kunci untuk verifikasi cepat

Setelah menjalankan langkah (1), nilai-nilai berikut harus muncul persis:

| Sumber | Nilai yang diharapkan |
|---|---|
| `tawaf_accuracy.csv`, σ=15 | akurasi tepat-7 = **72,67%**, rata-rata 7,31 |
| `sai_accuracy.csv`, semua σ | akurasi tepat-7 = **100,00%** |
| `jamarat_accuracy.csv`, σ=15 | benar = **83,53%**, salah pilar = 0,32%, tak terdeteksi = 16,15% |
| `miqat_accuracy.csv`, σ=15 | akurasi = **99,45%** |
| `arafah_accuracy.csv`, σ=15 | akurasi = **99,44%** |
| `summary.md`, bagian 0 | Safa–Marwah = **419,0 m**; antar-jamarat 76,0 / 68,2 / 144,0 m |

## Pemetaan keluaran → naskah

| Keluaran | Naskah |
|---|---|
| `miqat_accuracy.csv` | Tabel 4; Gambar 1 |
| `arafah_accuracy.csv` | Tabel 5; Gambar 2 |
| `tawaf_accuracy.csv` | Tabel 6; Gambar 3 |
| `sai_accuracy.csv` | Tabel 7; Gambar 4 |
| `jamarat_accuracy.csv` | Tabel 8–9; Gambar 5 |
| `summary.md` bag. 1 | Tabel 3 (Haversine vs Vincenty) |
| `figures/fig1-gabungan.png` | Gambar 6 |

## Asal algoritma yang diuji

Keenam algoritma di `run.ts` **disalin verbatim** dari kode produksi:

| Algoritma | Sumber produksi |
|---|---|
| Haversine | `apps/mobile/src/services/location.ts` (formula identik di `server/src/services/geofence.service.ts`) |
| Geofence miqat (batas 1.000 m) | `server/src/services/geofence.service.ts` (`nearestMiqat`, field `within_boundary`); data zona: `server/src/db/seeds/004_miqat_zones.ts` |
| Poligon Arafah (ray casting) | `apps/mobile/src/services/sacred-zones.ts` (`isPointInPolygon`) |
| Penghitung tawaf | `sacred-zones.ts` (`TawafTracker`) |
| Penghitung sa'i | `sacred-zones.ts` (`SaiTracker`) |
| Identifikasi jamarat | `sacred-zones.ts` (`detectNearestJamarat`) |

**Satu-satunya adaptasi** terhadap kode produksi: pada `TawafTracker`, pemanggilan
waktu sistem `Date.now()` diganti parameter `now` eksplisit agar simulasi
deterministik; callback antarmuka (`onChange`, vibrasi) yang tidak memengaruhi
logika keputusan tidak ikut disalin. Logika deteksi (ambang, debounce 120 s,
kondisi persilangan sudut) tidak diubah sama sekali.

## Catatan model derau

Parameter σ adalah simpangan baku **per sumbu koordinat** (East/North). Galat
horizontal (radial) resultan mengikuti distribusi Rayleigh dengan rata-rata
≈ 1,25σ, sehingga rentang uji σ = 1–15 m setara galat horizontal rata-rata
≈ 1,3–18,8 m — mencakup rentang empiris 5–13 m yang dilaporkan literatur akurasi
GPS ponsel.

## Struktur direktori

```
accuracy-test/
├── run.ts               Harness simulasi Monte Carlo (mandiri, deterministik)
├── charts.js            Pembangkit 6 grafik PNG (playwright)
├── build-docx.py        Perakit draf Word dari hasil (opsional)
└── results/
    ├── summary.md       Seluruh tabel hasil dalam satu dokumen
    ├── *_accuracy.csv   Data per algoritma (desimal titik)
    └── figures/         PNG @2x + captions.md
```
