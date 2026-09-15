# Hasil Pengujian Akurasi Algoritma Geospasial — Sistem Mabrur

> Simulasi Monte Carlo, RNG mulberry32 ber-seed (seed=42) — hasil reproducible.
> Model noise GPS: Gaussian isotropik, sigma per sumbu (East/North) = {0, 1, 3, 5, 10, 15} m.
> sigma=0 = baseline tanpa noise (verifikasi kebenaran algoritma).

## 0. Karakteristik Geometri (konteks)

| Besaran | Nilai |
|---|---|
| Jarak Safa–Marwah | 376.7 m |
| Jarak Jamarat Ula–Wustha | 153.2 m |
| Jarak Jamarat Wustha–Aqabah | 235.7 m |
| Jarak Jamarat Ula–Aqabah | 387.0 m |
| Radius deteksi Jamarat | 30 m (2×radius=60 m < jarak pilar terdekat 153 m → tidak tumpang tindih) |
| Radius zona Sa'i (Safa/Marwah) | 25 m |
| Band radius Tawaf (default) | 10–80 m dari Ka'bah |

## 1. Akurasi Haversine vs Vincenty (elipsoid WGS-84)

| Skenario jarak | MAE (m) | RMSE (m) | Error rata2 (%) | Error maks (%) |
|---|---|---|---|---|
| Lokal Masjidil Haram (0–0,5 km) | 0.649 | 0.811 | 0.2000 | 0.4267 |
| Skala Miqat (10–450 km) | 521.533 | 675.987 | 0.2654 | 0.4270 |

*Catatan: Haversine mengasumsikan bumi bola (R=6.371 km); Vincenty memodelkan elipsoid WGS-84.*

## 2. Geofence Miqat — klasifikasi 'dalam batas' (radius 1.000 m)

Ground truth = jarak sebenarnya ≤ 1.000 m. Prediksi = jarak dari posisi ber-noise ≤ 1.000 m.

| sigma (m) | Akurasi (%) | Presisi (%) | Recall (%) | F1 (%) | CI95 akurasi |
|---|---|---|---|---|---|
| 0 | 100.00 | 100.00 | 100.00 | 100.00 | [99.95, 100.00] |
| 1 | 100.00 | 100.00 | 100.00 | 100.00 | [99.95, 100.00] |
| 3 | 99.92 | 99.87 | 99.94 | 99.91 | [99.84, 99.97] |
| 5 | 99.81 | 99.68 | 99.84 | 99.76 | [99.69, 99.89] |
| 10 | 99.69 | 99.59 | 99.62 | 99.61 | [99.54, 99.79] |
| 15 | 99.45 | 99.49 | 99.11 | 99.30 | [99.26, 99.59] |

## 3. Deteksi Arafah — point-in-polygon (ray casting, 36 titik, poligon OSM way 1377422823)

Ground truth = point-in-polygon posisi bersih. Prediksi = point-in-polygon posisi ber-noise.

| sigma (m) | Akurasi (%) | Presisi (%) | Recall (%) | F1 (%) | CI95 akurasi |
|---|---|---|---|---|---|
| 0 | 100.00 | 100.00 | 100.00 | 100.00 | [99.97, 100.00] |
| 1 | 99.98 | 99.96 | 99.96 | 99.96 | [99.94, 100.00] |
| 3 | 99.96 | 99.88 | 99.92 | 99.90 | [99.90, 99.98] |
| 5 | 99.92 | 99.84 | 99.80 | 99.82 | [99.86, 99.96] |
| 10 | 99.83 | 99.69 | 99.50 | 99.60 | [99.73, 99.89] |
| 15 | 99.54 | 99.15 | 98.82 | 98.98 | [99.40, 99.65] |

*Kesalahan terkonsentrasi di pita tepi poligon; interior/eksterior jauh selalu benar.*

## 4. Penghitung Tawaf Otomatis (target = 7 putaran)

| sigma (m) | Rata2 putaran | Akurasi tepat-7 (%) | CI95 tepat-7 | MAE | RMSE |
|---|---|---|---|---|---|
| 0 | 7.00 | 100.00 | [98.74, 100.00] | 0.000 | 0.000 |
| 1 | 6.99 | 98.67 | [96.62, 99.48] | 0.013 | 0.115 |
| 3 | 6.99 | 98.67 | [96.62, 99.48] | 0.013 | 0.115 |
| 5 | 6.98 | 97.67 | [95.26, 98.87] | 0.023 | 0.153 |
| 10 | 6.95 | 92.67 | [89.15, 95.11] | 0.073 | 0.271 |
| 15 | 6.43 | 28.33 | [23.53, 33.68] | 1.197 | 1.607 |

*300 percobaan/sigma. Lintasan melingkar CCW r=25 m, ~300 s/putaran (~0,52 m/s), sampling 3 s, t0=1700000000000, settle 5 sampel di titik mulai + tail 10 sampel di titik selesai (kebijakan UI "GPS aktif ≥30 dtk").*
*Pemicuan dini/terlambat: sudut/jarak-busur posisi BENAR (noiseless) saat hitungan ke-7 terpicu, relatif thd selesainya 7 putaran geometris (2520°) — negatif (`early_deg_*`) = dini (kebijakan menjamin ini TIDAK PERNAH terjadi pada sigma=0), positif (`late_deg_*`) = terlambat (aman, trade-off desain); hanya percobaan tepat-7. Lihat `results/tawaf_early_trigger.csv`.*
*Histogram jumlah putaran per sigma: `results/tawaf_histogram.csv`.*

## 5. Penghitung Sa'i Otomatis (target = 7 leg)

| sigma (m) | Rata2 leg | Akurasi tepat-7 (%) | CI95 tepat-7 | MAE | RMSE |
|---|---|---|---|---|---|
| 0 | 7.00 | 100.00 | [98.74, 100.00] | 0.000 | 0.000 |
| 1 | 7.00 | 100.00 | [98.74, 100.00] | 0.000 | 0.000 |
| 3 | 7.00 | 100.00 | [98.74, 100.00] | 0.000 | 0.000 |
| 5 | 7.00 | 100.00 | [98.74, 100.00] | 0.000 | 0.000 |
| 10 | 7.00 | 100.00 | [98.74, 100.00] | 0.000 | 0.000 |
| 15 | 7.00 | 100.00 | [98.74, 100.00] | 0.000 | 0.000 |

*300 percobaan/sigma. Jarak Safa–Marwah 377 m, ~415–480 s/leg, sampling 3 s.*

## 6. Deteksi Jamarat — identifikasi 1 dari 3 pilar (radius 30 m)

Ground truth = pilar tempat jamaah berdiri (jarak ≤ 12 m dari pilar). Prediksi = jamarat terdekat dalam radius 30 m.

| sigma (m) | Akurasi benar (%) | CI95 benar | Salah pilar (%) | Tak terdeteksi (%) |
|---|---|---|---|---|
| 0 | 100.00 | [99.97, 100.00] | 0.00 | 0.00 |
| 1 | 100.00 | [99.97, 100.00] | 0.00 | 0.00 |
| 3 | 100.00 | [99.97, 100.00] | 0.00 | 0.00 |
| 5 | 100.00 | [99.97, 100.00] | 0.00 | 0.00 |
| 10 | 97.31 | [97.00, 97.58] | 0.00 | 2.69 |
| 15 | 83.53 | [82.86, 84.19] | 0.00 | 16.47 |

### Confusion matrix Jamarat pada sigma = 15 m

| Sebenarnya \ Prediksi | Ula | Wustha | Aqabah | Tak terdeteksi |
|---|---|---|---|---|
| **Jamarat Ula (Kecil)** | 3328 | 0 | 0 | 672 |
| **Jamarat Wustha (Tengah)** | 0 | 3364 | 0 | 636 |
| **Jamarat Aqabah (Besar)** | 0 | 0 | 3332 | 668 |

*Pilar terpisah 153–387 m > 2×radius (60 m) → nyaris tidak ada salah-pilar. Degradasi di sigma besar didominasi "tak terdeteksi": noise mendorong posisi keluar radius 30 m.*

## 7. Skenario Tawaf tambahan (R8) — radius edar, mode, skenario mulai/diam

Ringkas di `results/tawaf_scenarios.csv` (500 percobaan/sel; lihat file eksperimen untuk definisi skenario I/II/III).
*Catatan kebijakan "tidak pernah dini" (2026-09-15): Skenario II (mulai dingin sambil langsung berjalan, TANPA diam di awal) SENGAJA dipertahankan sbg kasus adversarial — rata2 putaran WAJAR ~6 (bukan 7) pada sigma rendah karena referensi awal (rata-rata 3 sampel pertama) kehilangan sedikit rotasi yang tak bisa dipulihkan tanpa gerak/diam lanjutan pasca-selesai. Ini bukan bug, melainkan konsekuensi langsung dari jaminan "tidak pernah dini" — dilaporkan apa adanya (lihat `results/tawaf_scenarios.csv`, scenario=II). Skenario I & III sudah disesuaikan (settle/tail) agar merepresentasikan penggunaan wajar sesuai kebijakan UI.*

| Skenario | Mode | r (m) | sigma | Tepat-7 (%) | CI95 | Rata2 putaran | MAE |
|---|---|---|---|---|---|---|---|
| III | adaptif | 25 | 5 | 97.8 | [96.1, 98.77] | 6.978 | 0.022 |
| III | adaptif | 25 | 10 | 94.4 | [92.03, 96.1] | 6.956 | 0.056 |
| III | adaptif | 25 | 15 | 27.6 | [23.86, 31.68] | 5.93 | 1.142 |
| III | adaptif | 12 | 5 | 94.4 | [92.03, 96.1] | 6.944 | 0.056 |
| III | adaptif | 12 | 10 | 13.2 | [10.51, 16.45] | 5.82 | 1.996 |
| III | adaptif | 12 | 15 | 9 | [6.79, 11.83] | 4.322 | 3.334 |

*3 skenario × 5 radius × 2 mode × 11 sigma = 330 sel, 500 percobaan/sel -> `results/tawaf_scenarios.csv` (daftar lengkap).*
## 8. Skenario Sa'i tambahan (R9) — offset titik balik & lateral

Ringkas di `results/sai_scenarios.csv` (500 percobaan/sel).

| o (m) | l (m) | sigma | Tepat-7 (%) | CI95 | Rata2 leg | MAE |
|---|---|---|---|---|---|---|
| 0 | 0 | 5 | 100 | [99.24, 100] | 7 | 0 |
| 0 | 0 | 15 | 100 | [99.24, 100] | 7 | 0 |
| 20 | 0 | 5 | 96 | [93.9, 97.4] | 6.934 | 0.066 |
| 20 | 0 | 15 | 93.8 | [91.33, 95.6] | 6.908 | 0.092 |
| 25 | 0 | 5 | 20.4 | [17.1, 24.15] | 4.674 | 2.326 |
| 25 | 0 | 15 | 71.4 | [67.29, 75.19] | 6.508 | 0.492 |
| 30 | 0 | 5 | 0 | [0, 0.76] | 0.664 | 6.336 |
| 30 | 0 | 15 | 33.8 | [29.79, 38.06] | 5.512 | 1.488 |

*Jarak-lurus SAFA-MARWAH terpakai (Lc) = 377.1 m. sqrt(o²+l²) > 25 m → zona tidak pernah terdeteksi (lihat kolom exact7_pct=0 pada baris terkait di CSV).*
*5 o × 3 l × 6 sigma = 90 sel, 500 percobaan/sel -> `results/sai_scenarios.csv` (daftar lengkap).*
## 9. Perbandingan model derau (R6) — iid vs AR(1) vs Gauss-Markov vs bias

Ringkas di `results/noise_models.csv` (500 percobaan/sel; jamarat 4.000/kelas seperti eksperimen utama).

| Target | Model | sigma | Metrik | Nilai |
|---|---|---|---|---|
| tawaf_III_r25_adaptif | iid | 10 | exact7_pct | 94.2 |
| tawaf_III_r25_adaptif | ar1_field | 10 | exact7_pct | 94.2 |
| tawaf_III_r25_adaptif | bias10 | 10 | exact7_pct | 68.4 |
| sai_o0_l0 | iid | 10 | exact7_pct | 100 |
| sai_o0_l0 | ar1_field | 10 | exact7_pct | 100 |
| sai_o0_l0 | bias10 | 10 | exact7_pct | 99.8 |
| jamarat | iid | 10 | takTerdeteksi | 2.63 |
| jamarat | bias10 | 10 | takTerdeteksi | 7.44 |

*rho_1s lapangan (rata-rata antar trace, field_characterization.json): E=0.6326, N=0.5335 -> rho_3s = rho_1s^3: E=0.2532, N=0.1519.*
*6 model x {tawaf III r25 default+adaptif, sai o0/o20} x 4 sigma, + 3 model x jamarat x 4 sigma = 108 sel, 500 percobaan/sel (jamarat 4000/kelas) -> `results/noise_models.csv`.*
## 10. Cek analitik vs Monte Carlo (R4)

Ringkas di `results/analytic_check.csv` dan `results/boundary_error_curve.csv`.

**Analitik vs MC (subset):**

| Metrik | sigma | MC (%) | Analitik (%) | Selisih |
|---|---|---|---|---|
| miqat_error_rate | 5 | 0,190 | 0,160 | 0,030 |
| miqat_error_rate | 10 | 0,310 | 0,319 | 0,009 |
| miqat_error_rate | 15 | 0,550 | 0,479 | 0,071 |
| arafah_error_rate | 5 | 0,080 | 0,113 | 0,033 |
| arafah_error_rate | 10 | 0,170 | 0,226 | 0,056 |
| arafah_error_rate | 15 | 0,460 | 0,338 | 0,122 |
| jamarat_undetected | 5 | 0,000 | 0,003 | 0,003 |
| jamarat_undetected | 10 | 2,690 | 2,626 | 0,064 |
| jamarat_undetected | 15 | 16,470 | 16,414 | 0,056 |

**Kurva batas (subset d=0, sigma-lihat):**

| d (m) | sigma | P(salah) MC (%) | Phi(-\|d\|/sigma) (%) | d99 (m) |
|---|---|---|---|---|
| -20 | 3 | 0.000 | 0.000 | 6.979 |
| -20 | 5 | 0.000 | 0.003 | 11.632 |
| -20 | 10 | 2.265 | 2.275 | 23.263 |
| -20 | 15 | 9.360 | 9.121 | 34.895 |
| 0 | 3 | 49.975 | 50.000 | 6.979 |
| 0 | 5 | 49.795 | 50.000 | 11.632 |
| 0 | 10 | 50.100 | 50.000 | 23.263 |
| 0 | 15 | 50.745 | 50.000 | 34.895 |
| 20 | 3 | 0.000 | 0.000 | 6.979 |
| 20 | 5 | 0.000 | 0.003 | 11.632 |
| 20 | 10 | 2.460 | 2.275 | 23.263 |
| 20 | 15 | 8.800 | 9.121 | 34.895 |

*Keliling poligon Arafah = 15178.5 m; luas kotak sampel = 53.669 km². Kurva batas lengkap (21 d x 4 sigma, 20000 sampel/sel) -> `results/boundary_error_curve.csv`.*
## Ringkasan & Temuan

- **Haversine**: galat terhadap elipsoid WGS-84 sangat kecil (< 0,5%), memadai untuk skala meter.
- **Sa'i**: paling tahan noise — pemisahan geometris Safa–Marwah (≈377 m) ≫ error GPS.
- **Geofence Miqat & Arafah**: kesalahan hanya di pita tepi selebar ~sigma; akurasi menurun landai, sesuai prediksi analitik Φ(−d/σ) (§10).
- **Tawaf**: sensitif pada sigma besar (radius kecil 25 m); skema sudut kumulatif CCW menerapkan kebijakan "tidak pernah dini" (referensi awal rata-rata sirkular + margin=0, tanpa toleransi positif) — pemicuan TIDAK PERNAH mendahului 360k° (0 m dini pada sigma=0), dengan trade-off sedikit KETERLAMBATAN dan penurunan kecil proporsi tepat-7 di sigma rendah (§4) — lihat §7 untuk sensitivitas radius/mode/skenario.
- **Jamarat**: pemisahan pilar (153–387 m) memadai → salah-pilar hampir nol; kerentanan justru "tak terdeteksi" saat sigma besar (noise keluar radius 30 m), konsisten dengan model Rice analitik (§10).

*Dibangun dari analisis kode Mabrur. Seed=42. CSV per algoritma tersimpan di `docs/accuracy-test/results/`.*