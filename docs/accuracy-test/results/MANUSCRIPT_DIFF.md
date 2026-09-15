# Laporan Verifikasi: Hasil Kode vs Angka Naskah

- Toleransi sel desimal: |kode − naskah| < 0,01 (sel bilangan bulat: harus sama persis)
- Seed: mulberry32(42) | sigma: {0, 1, 3, 5, 10, 15} m
- Total sel dibandingkan: 138 | COCOK: 138 | BEDA: 0

## STATUS: SEMUA COCOK ✔

## Rincian per tabel

### Tabel 2 (geometri)

| Sel | Kode | Naskah | Status |
|---|---|---|---|
| safa_marwah_m | 376,7 | 376,7 | COCOK |
| jamarat_ula_wustha_m | 153,2 | 153,2 | COCOK |
| jamarat_wustha_aqabah_m | 235,7 | 235,7 | COCOK |
| jamarat_ula_aqabah_m | 387 | 387 | COCOK |

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
| sigma=1 presisi | 99,96 | 99,96 | COCOK |
| sigma=1 recall | 99,96 | 99,96 | COCOK |
| sigma=1 f1 | 99,96 | 99,96 | COCOK |
| sigma=3 akurasi | 99,96 | 99,96 | COCOK |
| sigma=3 presisi | 99,88 | 99,88 | COCOK |
| sigma=3 recall | 99,92 | 99,92 | COCOK |
| sigma=3 f1 | 99,9 | 99,9 | COCOK |
| sigma=5 akurasi | 99,92 | 99,92 | COCOK |
| sigma=5 presisi | 99,84 | 99,84 | COCOK |
| sigma=5 recall | 99,8 | 99,8 | COCOK |
| sigma=5 f1 | 99,82 | 99,82 | COCOK |
| sigma=10 akurasi | 99,83 | 99,83 | COCOK |
| sigma=10 presisi | 99,69 | 99,69 | COCOK |
| sigma=10 recall | 99,5 | 99,5 | COCOK |
| sigma=10 f1 | 99,6 | 99,6 | COCOK |
| sigma=15 akurasi | 99,54 | 99,54 | COCOK |
| sigma=15 presisi | 99,15 | 99,15 | COCOK |
| sigma=15 recall | 98,82 | 98,82 | COCOK |
| sigma=15 f1 | 98,98 | 98,98 | COCOK |

### Tabel 6 (Tawaf)

| Sel | Kode | Naskah | Status |
|---|---|---|---|
| sigma=0 mean | 7 | 7 | COCOK |
| sigma=0 exact7 | 100 | 100 | COCOK |
| sigma=0 mae | 0 | 0 | COCOK |
| sigma=0 rmse | 0 | 0 | COCOK |
| sigma=1 mean | 6,99 | 6,99 | COCOK |
| sigma=1 exact7 | 98,67 | 98,67 | COCOK |
| sigma=1 mae | 0,013 | 0,013 | COCOK |
| sigma=1 rmse | 0,115 | 0,115 | COCOK |
| sigma=3 mean | 6,99 | 6,99 | COCOK |
| sigma=3 exact7 | 98,67 | 98,67 | COCOK |
| sigma=3 mae | 0,013 | 0,013 | COCOK |
| sigma=3 rmse | 0,115 | 0,115 | COCOK |
| sigma=5 mean | 6,98 | 6,98 | COCOK |
| sigma=5 exact7 | 97,67 | 97,67 | COCOK |
| sigma=5 mae | 0,023 | 0,023 | COCOK |
| sigma=5 rmse | 0,153 | 0,153 | COCOK |
| sigma=10 mean | 6,95 | 6,95 | COCOK |
| sigma=10 exact7 | 92,67 | 92,67 | COCOK |
| sigma=10 mae | 0,073 | 0,073 | COCOK |
| sigma=10 rmse | 0,271 | 0,271 | COCOK |
| sigma=15 mean | 6,43 | 6,43 | COCOK |
| sigma=15 exact7 | 28,33 | 28,33 | COCOK |
| sigma=15 mae | 1,197 | 1,197 | COCOK |
| sigma=15 rmse | 1,607 | 1,607 | COCOK |

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
| sigma=10 salahPilar | 0 | 0 | COCOK |
| sigma=10 takTerdeteksi | 2,69 | 2,69 | COCOK |
| sigma=15 benar | 83,53 | 83,53 | COCOK |
| sigma=15 salahPilar | 0 | 0 | COCOK |
| sigma=15 takTerdeteksi | 16,47 | 16,47 | COCOK |

### Tabel 9 (Confusion)

| Sel | Kode | Naskah | Status |
|---|---|---|---|
| ula->ula | 3328 | 3328 | COCOK |
| ula->wustha | 0 | 0 | COCOK |
| ula->aqabah | 0 | 0 | COCOK |
| ula->none | 672 | 672 | COCOK |
| wustha->ula | 0 | 0 | COCOK |
| wustha->wustha | 3364 | 3364 | COCOK |
| wustha->aqabah | 0 | 0 | COCOK |
| wustha->none | 636 | 636 | COCOK |
| aqabah->ula | 0 | 0 | COCOK |
| aqabah->wustha | 0 | 0 | COCOK |
| aqabah->aqabah | 3332 | 3332 | COCOK |
| aqabah->none | 668 | 668 | COCOK |

