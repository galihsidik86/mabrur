# Tabel Hasil Simulasi (format naskah)

> Dihasilkan otomatis oleh `verify-manuscript.ts` dari `monte_carlo_results.json` (seed=42).

**Tabel 3.** Galat Haversine dibandingkan dengan Model Elipsoid Vincenty

| Skenario jarak | MAE (m) | RMSE (m) | Error rata-rata (%) | Error maks (%) |
|---|---|---|---|---|
| Lokal Masjidil Haram (0–0,5 km) | 0,649 | 0,811 | 0,2000 | 0,4267 |
| Skala Miqat (10–450 km) | 521,533 | 675,987 | 0,2654 | 0,4270 |

**Tabel 4.** Akurasi Klasifikasi Geofence Miqat (Radius Deteksi 1.000 m)

| σ (m) | Akurasi (%) | Presisi (%) | Recall (%) | F1 (%) |
|---|---|---|---|---|
| 0 | 100,00 | 100,00 | 100,00 | 100,00 |
| 1 | 100,00 | 100,00 | 100,00 | 100,00 |
| 3 | 99,92 | 99,87 | 99,94 | 99,91 |
| 5 | 99,81 | 99,68 | 99,84 | 99,76 |
| 10 | 99,69 | 99,59 | 99,62 | 99,61 |
| 15 | 99,45 | 99,49 | 99,11 | 99,30 |

**Tabel 5.** Akurasi Klasifikasi Poligon Wilayah Arafah (Ray Casting)

| σ (m) | Akurasi (%) | Presisi (%) | Recall (%) | F1 (%) |
|---|---|---|---|---|
| 0 | 100,00 | 100,00 | 100,00 | 100,00 |
| 1 | 99,98 | 100,00 | 99,96 | 99,98 |
| 3 | 99,95 | 99,99 | 99,93 | 99,96 |
| 5 | 99,84 | 99,82 | 99,90 | 99,86 |
| 10 | 99,63 | 99,68 | 99,68 | 99,68 |
| 15 | 99,44 | 99,48 | 99,55 | 99,52 |

**Tabel 6.** Performa Akurasi Penghitung Putaran Tawaf (Target = 7 Putaran)

| σ (m) | Rata-rata putaran | Akurasi tepat-7 (%) | MAE | RMSE |
|---|---|---|---|---|
| 0 | 7,00 | 100,00 | 0,000 | 0,000 |
| 1 | 7,00 | 100,00 | 0,000 | 0,000 |
| 3 | 7,00 | 100,00 | 0,000 | 0,000 |
| 5 | 7,00 | 100,00 | 0,000 | 0,000 |
| 10 | 7,00 | 100,00 | 0,000 | 0,000 |
| 15 | 7,31 | 72,67 | 0,313 | 0,632 |

**Tabel 7.** Performa Akurasi Penghitung Lintasan Sa'i (Target = 7 Lintasan)

| σ (m) | Rata-rata lintasan | Akurasi tepat-7 (%) | MAE | RMSE |
|---|---|---|---|---|
| 0 | 7,00 | 100,00 | 0,000 | 0,000 |
| 1 | 7,00 | 100,00 | 0,000 | 0,000 |
| 3 | 7,00 | 100,00 | 0,000 | 0,000 |
| 5 | 7,00 | 100,00 | 0,000 | 0,000 |
| 10 | 7,00 | 100,00 | 0,000 | 0,000 |
| 15 | 7,00 | 100,00 | 0,000 | 0,000 |

**Tabel 8.** Akurasi Identifikasi Pilar Jamarat (Klasifikasi Spasial Multi-Kelas)

| σ (m) | Akurasi benar (%) | Salah pilar (%) | Tak terdeteksi (%) |
|---|---|---|---|
| 0 | 100,00 | 0,00 | 0,00 |
| 1 | 100,00 | 0,00 | 0,00 |
| 3 | 100,00 | 0,00 | 0,00 |
| 5 | 100,00 | 0,00 | 0,00 |
| 10 | 97,31 | 0,03 | 2,67 |
| 15 | 83,53 | 0,32 | 16,15 |

**Tabel 9.** Confusion Matrix Klasifikasi Jamarat pada Tingkat Derau Ekstrem (σ = 15 m)

| Sebenarnya \ Prediksi | Ula | Wustha | Aqabah | Tak terdeteksi |
|---|---|---|---|---|
| **Ula** | 3328 | 4 | 0 | 668 |
| **Wustha** | 2 | 3364 | 18 | 616 |
| **Aqabah** | 0 | 14 | 3332 | 654 |

