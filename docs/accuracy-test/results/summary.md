# Hasil Pengujian Akurasi Algoritma Geospasial — Sistem Mabrur

> Simulasi Monte Carlo, RNG mulberry32 ber-seed (seed=42) — hasil reproducible.
> Model noise GPS: Gaussian isotropik, sigma per sumbu (East/North) = {0, 1, 3, 5, 10, 15} m.
> sigma=0 = baseline tanpa noise (verifikasi kebenaran algoritma).

## 0. Karakteristik Geometri (konteks)

| Besaran | Nilai |
|---|---|
| Jarak Safa–Marwah | 419.0 m |
| Jarak Jamarat Ula–Wustha | 76.0 m |
| Jarak Jamarat Wustha–Aqabah | 68.2 m |
| Jarak Jamarat Ula–Aqabah | 144.0 m |
| Radius deteksi Jamarat | 30 m (2×radius=60 m < jarak pilar terdekat 68 m → tidak tumpang tindih) |
| Radius zona Sa'i (Safa/Marwah) | 25 m |
| Band radius Tawaf | 10–80 m dari Ka'bah |

## 1. Akurasi Haversine vs Vincenty (elipsoid WGS-84)

| Skenario jarak | MAE (m) | RMSE (m) | Error rata2 (%) | Error maks (%) |
|---|---|---|---|---|
| Lokal Masjidil Haram (0–0,5 km) | 0.649 | 0.811 | 0.2000 | 0.4267 |
| Skala Miqat (10–450 km) | 521.533 | 675.987 | 0.2654 | 0.4270 |

*Catatan: Haversine mengasumsikan bumi bola (R=6.371 km); Vincenty memodelkan elipsoid WGS-84.*

## 2. Geofence Miqat — klasifikasi 'dalam batas' (radius 1.000 m)

Ground truth = jarak sebenarnya ≤ 1.000 m. Prediksi = jarak dari posisi ber-noise ≤ 1.000 m.

| sigma (m) | Akurasi (%) | Presisi (%) | Recall (%) | F1 (%) |
|---|---|---|---|---|
| 0 | 100.00 | 100.00 | 100.00 | 100.00 |
| 1 | 100.00 | 100.00 | 100.00 | 100.00 |
| 3 | 99.92 | 99.87 | 99.94 | 99.91 |
| 5 | 99.81 | 99.68 | 99.84 | 99.76 |
| 10 | 99.69 | 99.59 | 99.62 | 99.61 |
| 15 | 99.45 | 99.49 | 99.11 | 99.30 |

## 3. Deteksi Arafah — point-in-polygon (ray casting, 5 titik)

Ground truth = point-in-polygon posisi bersih. Prediksi = point-in-polygon posisi ber-noise.

| sigma (m) | Akurasi (%) | Presisi (%) | Recall (%) | F1 (%) |
|---|---|---|---|---|
| 0 | 100.00 | 100.00 | 100.00 | 100.00 |
| 1 | 99.98 | 100.00 | 99.96 | 99.98 |
| 3 | 99.95 | 99.99 | 99.93 | 99.96 |
| 5 | 99.84 | 99.82 | 99.90 | 99.86 |
| 10 | 99.63 | 99.68 | 99.68 | 99.68 |
| 15 | 99.44 | 99.48 | 99.55 | 99.52 |

*Kesalahan terkonsentrasi di pita tepi poligon; interior/eksterior jauh selalu benar.*

## 4. Penghitung Tawaf Otomatis (target = 7 putaran)

| sigma (m) | Rata2 putaran | Akurasi tepat-7 (%) | MAE | RMSE |
|---|---|---|---|---|
| 0 | 7.00 | 100.00 | 0.000 | 0.000 |
| 1 | 7.00 | 100.00 | 0.000 | 0.000 |
| 3 | 7.00 | 100.00 | 0.000 | 0.000 |
| 5 | 7.00 | 100.00 | 0.000 | 0.000 |
| 10 | 7.00 | 100.00 | 0.000 | 0.000 |
| 15 | 7.31 | 72.67 | 0.313 | 0.632 |

*300 percobaan/sigma. Lintasan melingkar r=25 m, ~300 s/putaran (~0,52 m/s), sampling 3 s.*

## 5. Penghitung Sa'i Otomatis (target = 7 leg)

| sigma (m) | Rata2 leg | Akurasi tepat-7 (%) | MAE | RMSE |
|---|---|---|---|---|
| 0 | 7.00 | 100.00 | 0.000 | 0.000 |
| 1 | 7.00 | 100.00 | 0.000 | 0.000 |
| 3 | 7.00 | 100.00 | 0.000 | 0.000 |
| 5 | 7.00 | 100.00 | 0.000 | 0.000 |
| 10 | 7.00 | 100.00 | 0.000 | 0.000 |
| 15 | 7.00 | 100.00 | 0.000 | 0.000 |

*300 percobaan/sigma. Jarak Safa–Marwah 419 m, ~415–480 s/leg, sampling 3 s.*

## 6. Deteksi Jamarat — identifikasi 1 dari 3 pilar (radius 30 m)

Ground truth = pilar tempat jamaah berdiri (jarak ≤ 12 m dari pilar). Prediksi = jamarat terdekat dalam radius 30 m.

| sigma (m) | Akurasi benar (%) | Salah pilar (%) | Tak terdeteksi (%) |
|---|---|---|---|
| 0 | 100.00 | 0.00 | 0.00 |
| 1 | 100.00 | 0.00 | 0.00 |
| 3 | 100.00 | 0.00 | 0.00 |
| 5 | 100.00 | 0.00 | 0.00 |
| 10 | 97.31 | 0.03 | 2.67 |
| 15 | 83.53 | 0.32 | 16.15 |

### Confusion matrix Jamarat pada sigma = 15 m

| Sebenarnya \ Prediksi | Ula | Wustha | Aqabah | Tak terdeteksi |
|---|---|---|---|---|
| **Ula** | 3328 | 4 | 0 | 668 |
| **Wustha** | 2 | 3364 | 18 | 616 |
| **Aqabah** | 0 | 14 | 3332 | 654 |

*Pilar terpisah 68–144 m > 2×radius (60 m) → nyaris tidak ada salah-pilar. Degradasi di sigma besar didominasi "tak terdeteksi": noise mendorong posisi keluar radius 30 m.*

## Ringkasan & Temuan

- **Haversine**: galat terhadap elipsoid WGS-84 sangat kecil (< 0,5%), memadai untuk skala meter.
- **Sa'i**: paling tahan noise — pemisahan geometris Safa–Marwah (≈415 m) ≫ error GPS.
- **Geofence Miqat & Arafah**: kesalahan hanya di pita tepi selebar ~sigma; akurasi menurun landai.
- **Tawaf**: sensitif pada sigma besar (radius kecil 25 m); debounce 120 s meredam sebagian galat.
- **Jamarat**: pemisahan pilar (68–144 m) memadai → salah-pilar hampir nol; kerentanan justru "tak terdeteksi" saat sigma besar (noise keluar radius 30 m). Layak dibahas sebagai keterbatasan.

*Dibangun dari analisis kode Mabrur. Seed=42. CSV per algoritma tersimpan di `docs/accuracy-test/results/`.*