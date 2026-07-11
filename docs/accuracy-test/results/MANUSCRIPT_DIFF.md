# Laporan Verifikasi: Hasil Kode vs Angka Naskah

- Toleransi sel desimal: |kode − naskah| < 0,01 (sel bilangan bulat: harus sama persis)
- Seed: mulberry32(42) | sigma: {0, 1, 3, 5, 10, 15} m
- Total sel dibandingkan: 138 | COCOK: 138 | BEDA: 0

## STATUS: SEMUA COCOK ✔

## Rincian per tabel

### Tabel 2 (geometri)

| Sel | Kode | Naskah | Status |
|---|---|---|---|
| safa_marwah_m | 419 | 419 | COCOK |
| jamarat_ula_wustha_m | 76 | 76 | COCOK |
| jamarat_wustha_aqabah_m | 68,2 | 68,2 | COCOK |
| jamarat_ula_aqabah_m | 144 | 144 | COCOK |

### Tabel 3 (Haversine)

| Sel | Kode | Naskah | Status |
|---|---|---|---|
| lokal.mae | 0,649 | 0,649 | COCOK |
| lokal.rmse | 0,811 | 0,811 | COCOK |
| lokal.meanPct | 0,2 | 0,2 | COCOK |
| lokal.maxPct | 0,4267 | 0,4267 | COCOK |
| miqat.mae | 521,533 | 521,533 | COCOK |
| miqat.rmse | 675,987 | 675,987 | COCOK |
| miqat.meanPct | 0,2654 | 0,2654 | COCOK |
| miqat.maxPct | 0,427 | 0,427 | COCOK |

### Tabel 4 (Miqat)

| Sel | Kode | Naskah | Status |
|---|---|---|---|
| sigma=0 akurasi | 100 | 100 | COCOK |
| sigma=0 presisi | 100 | 100 | COCOK |
| sigma=0 recall | 100 | 100 | COCOK |
| sigma=0 f1 | 100 | 100 | COCOK |
| sigma=1 akurasi | 100 | 100 | COCOK |
| sigma=1 presisi | 100 | 100 | COCOK |
| sigma=1 recall | 100 | 100 | COCOK |
| sigma=1 f1 | 100 | 100 | COCOK |
| sigma=3 akurasi | 99,92 | 99,92 | COCOK |
| sigma=3 presisi | 99,87 | 99,87 | COCOK |
| sigma=3 recall | 99,94 | 99,94 | COCOK |
| sigma=3 f1 | 99,91 | 99,91 | COCOK |
| sigma=5 akurasi | 99,81 | 99,81 | COCOK |
| sigma=5 presisi | 99,68 | 99,68 | COCOK |
| sigma=5 recall | 99,84 | 99,84 | COCOK |
| sigma=5 f1 | 99,76 | 99,76 | COCOK |
| sigma=10 akurasi | 99,69 | 99,69 | COCOK |
| sigma=10 presisi | 99,59 | 99,59 | COCOK |
| sigma=10 recall | 99,62 | 99,62 | COCOK |
| sigma=10 f1 | 99,61 | 99,61 | COCOK |
| sigma=15 akurasi | 99,45 | 99,45 | COCOK |
| sigma=15 presisi | 99,49 | 99,49 | COCOK |
| sigma=15 recall | 99,11 | 99,11 | COCOK |
| sigma=15 f1 | 99,3 | 99,3 | COCOK |

### Tabel 5 (Arafah)

| Sel | Kode | Naskah | Status |
|---|---|---|---|
| sigma=0 akurasi | 100 | 100 | COCOK |
| sigma=0 presisi | 100 | 100 | COCOK |
| sigma=0 recall | 100 | 100 | COCOK |
| sigma=0 f1 | 100 | 100 | COCOK |
| sigma=1 akurasi | 99,98 | 99,98 | COCOK |
| sigma=1 presisi | 100 | 100 | COCOK |
| sigma=1 recall | 99,96 | 99,96 | COCOK |
| sigma=1 f1 | 99,98 | 99,98 | COCOK |
| sigma=3 akurasi | 99,95 | 99,95 | COCOK |
| sigma=3 presisi | 99,99 | 99,99 | COCOK |
| sigma=3 recall | 99,93 | 99,93 | COCOK |
| sigma=3 f1 | 99,96 | 99,96 | COCOK |
| sigma=5 akurasi | 99,84 | 99,84 | COCOK |
| sigma=5 presisi | 99,82 | 99,82 | COCOK |
| sigma=5 recall | 99,9 | 99,9 | COCOK |
| sigma=5 f1 | 99,86 | 99,86 | COCOK |
| sigma=10 akurasi | 99,63 | 99,63 | COCOK |
| sigma=10 presisi | 99,68 | 99,68 | COCOK |
| sigma=10 recall | 99,68 | 99,68 | COCOK |
| sigma=10 f1 | 99,68 | 99,68 | COCOK |
| sigma=15 akurasi | 99,44 | 99,44 | COCOK |
| sigma=15 presisi | 99,48 | 99,48 | COCOK |
| sigma=15 recall | 99,55 | 99,55 | COCOK |
| sigma=15 f1 | 99,52 | 99,52 | COCOK |

### Tabel 6 (Tawaf)

| Sel | Kode | Naskah | Status |
|---|---|---|---|
| sigma=0 mean | 7 | 7 | COCOK |
| sigma=0 exact7 | 100 | 100 | COCOK |
| sigma=0 mae | 0 | 0 | COCOK |
| sigma=0 rmse | 0 | 0 | COCOK |
| sigma=1 mean | 7 | 7 | COCOK |
| sigma=1 exact7 | 100 | 100 | COCOK |
| sigma=1 mae | 0 | 0 | COCOK |
| sigma=1 rmse | 0 | 0 | COCOK |
| sigma=3 mean | 7 | 7 | COCOK |
| sigma=3 exact7 | 100 | 100 | COCOK |
| sigma=3 mae | 0 | 0 | COCOK |
| sigma=3 rmse | 0 | 0 | COCOK |
| sigma=5 mean | 7 | 7 | COCOK |
| sigma=5 exact7 | 100 | 100 | COCOK |
| sigma=5 mae | 0 | 0 | COCOK |
| sigma=5 rmse | 0 | 0 | COCOK |
| sigma=10 mean | 7 | 7 | COCOK |
| sigma=10 exact7 | 100 | 100 | COCOK |
| sigma=10 mae | 0 | 0 | COCOK |
| sigma=10 rmse | 0 | 0 | COCOK |
| sigma=15 mean | 7,31 | 7,31 | COCOK |
| sigma=15 exact7 | 72,67 | 72,67 | COCOK |
| sigma=15 mae | 0,313 | 0,313 | COCOK |
| sigma=15 rmse | 0,632 | 0,632 | COCOK |

### Tabel 7 (Sa'i)

| Sel | Kode | Naskah | Status |
|---|---|---|---|
| sigma=0 mean | 7 | 7 | COCOK |
| sigma=0 exact7 | 100 | 100 | COCOK |
| sigma=0 mae | 0 | 0 | COCOK |
| sigma=0 rmse | 0 | 0 | COCOK |
| sigma=1 mean | 7 | 7 | COCOK |
| sigma=1 exact7 | 100 | 100 | COCOK |
| sigma=1 mae | 0 | 0 | COCOK |
| sigma=1 rmse | 0 | 0 | COCOK |
| sigma=3 mean | 7 | 7 | COCOK |
| sigma=3 exact7 | 100 | 100 | COCOK |
| sigma=3 mae | 0 | 0 | COCOK |
| sigma=3 rmse | 0 | 0 | COCOK |
| sigma=5 mean | 7 | 7 | COCOK |
| sigma=5 exact7 | 100 | 100 | COCOK |
| sigma=5 mae | 0 | 0 | COCOK |
| sigma=5 rmse | 0 | 0 | COCOK |
| sigma=10 mean | 7 | 7 | COCOK |
| sigma=10 exact7 | 100 | 100 | COCOK |
| sigma=10 mae | 0 | 0 | COCOK |
| sigma=10 rmse | 0 | 0 | COCOK |
| sigma=15 mean | 7 | 7 | COCOK |
| sigma=15 exact7 | 100 | 100 | COCOK |
| sigma=15 mae | 0 | 0 | COCOK |
| sigma=15 rmse | 0 | 0 | COCOK |

### Tabel 8 (Jamarat)

| Sel | Kode | Naskah | Status |
|---|---|---|---|
| sigma=0 benar | 100 | 100 | COCOK |
| sigma=0 salahPilar | 0 | 0 | COCOK |
| sigma=0 takTerdeteksi | 0 | 0 | COCOK |
| sigma=1 benar | 100 | 100 | COCOK |
| sigma=1 salahPilar | 0 | 0 | COCOK |
| sigma=1 takTerdeteksi | 0 | 0 | COCOK |
| sigma=3 benar | 100 | 100 | COCOK |
| sigma=3 salahPilar | 0 | 0 | COCOK |
| sigma=3 takTerdeteksi | 0 | 0 | COCOK |
| sigma=5 benar | 100 | 100 | COCOK |
| sigma=5 salahPilar | 0 | 0 | COCOK |
| sigma=5 takTerdeteksi | 0 | 0 | COCOK |
| sigma=10 benar | 97,31 | 97,31 | COCOK |
| sigma=10 salahPilar | 0,03 | 0,03 | COCOK |
| sigma=10 takTerdeteksi | 2,67 | 2,67 | COCOK |
| sigma=15 benar | 83,53 | 83,53 | COCOK |
| sigma=15 salahPilar | 0,32 | 0,32 | COCOK |
| sigma=15 takTerdeteksi | 16,15 | 16,15 | COCOK |

### Tabel 9 (Confusion)

| Sel | Kode | Naskah | Status |
|---|---|---|---|
| ula->ula | 3328 | 3328 | COCOK |
| ula->wustha | 4 | 4 | COCOK |
| ula->aqabah | 0 | 0 | COCOK |
| ula->none | 668 | 668 | COCOK |
| wustha->ula | 2 | 2 | COCOK |
| wustha->wustha | 3364 | 3364 | COCOK |
| wustha->aqabah | 18 | 18 | COCOK |
| wustha->none | 616 | 616 | COCOK |
| aqabah->ula | 0 | 0 | COCOK |
| aqabah->wustha | 14 | 14 | COCOK |
| aqabah->aqabah | 3332 | 3332 | COCOK |
| aqabah->none | 654 | 654 | COCOK |

