# Paket Reproduksi — Pengujian Akurasi Algoritma Geospasial

Direktori ini adalah paket reproduksi untuk naskah **"Pengujian Akurasi Algoritma
Geospasial untuk Deteksi Ritual Haji Berbasis GPS terhadap Galat Posisi"**
(sistem Mabrur). Seluruh angka pada tabel dan gambar naskah dihasilkan dari skrip
di direktori ini dan dapat direproduksi secara identik.

## Prasyarat

- Node.js ≥ 18 dan `npm install` di root repositori (menyediakan `tsx` dan `playwright`)
- Python 3 dengan `pip install python-docx` — *opsional*, hanya untuk membangun draf Word

## Menjalankan

```bash
# 1) Simulasi Monte Carlo → results/summary.md + 5 CSV (deterministik)
npx tsx docs/accuracy-test/run.ts

# 2) Grafik → results/figures/*.png (6 gambar @2x) + captions.md
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
