# Draf Bab Jurnal — Pengujian Akurasi Algoritma Geospasial Sistem Mabrur

> **Angle A**: algoritma deteksi ritual haji/umrah berbasis GPS.
> Bagian ini siap-tempel untuk bab **Metode** dan **Hasil & Pembahasan** artikel jurnal (Sinta 3/4).
> Semua angka berasal dari `docs/accuracy-test/results/summary.md` (reproducible, seed=42).
> Tanda `[?]` = placeholder sitasi yang perlu dilengkapi penulis.

---

## 3. Metode Pengujian

### 3.1 Rancangan Eksperimen

Pengujian akurasi enam algoritma geospasial inti dilakukan melalui **simulasi Monte Carlo**. Pendekatan simulasi dipilih karena pengujian lapangan langsung di area Masjidil Haram, Arafah, dan Jamarat tidak dapat dilaksanakan secara praktis. Prinsip pengujian: setiap algoritma dijalankan dengan **kode sumber asli aplikasi** (disalin verbatim dari modul `sacred-zones.ts` dan `location.ts`), lalu diberi masukan berupa posisi *ground truth* yang telah diketahui secara geometris, dan diamati apakah keluaran algoritma tetap benar ketika posisi masukan diberi gangguan (*noise*) GPS.

Enam algoritma yang diuji:

| No | Algoritma | Teknik | Peran dalam sistem |
|----|-----------|--------|--------------------|
| 1 | Haversine | Great-circle distance | Dasar seluruh perhitungan jarak |
| 2 | Geofence Miqat | Point-in-circle | Peringatan batas miqat & ihram |
| 3 | Deteksi Arafah | Ray-casting polygon | Validasi keabsahan wukuf |
| 4 | Penghitung Tawaf | Angular crossing detection | Hitung otomatis 7 putaran |
| 5 | Penghitung Sa'i | Zone alternation | Hitung otomatis 7 leg Safa–Marwah |
| 6 | Deteksi Jamarat | Nearest-in-radius (3 kelas) | Identifikasi pilar lempar jumrah |

### 3.2 Model Gangguan (Noise) GPS

Ketidakpastian posisi GPS pada perangkat *smartphone* dimodelkan sebagai gangguan **Gaussian isotropik** yang ditambahkan pada komponen Timur (*East*) dan Utara (*North*) posisi sebenarnya:

```
posisi_terukur = posisi_sebenarnya + N(0, σ)   pada tiap sumbu (E, N)
```

dengan σ adalah simpangan baku galat posisi (meter). Konversi meter ke derajat menggunakan 1° lintang ≈ 111.320 m dan 1° bujur ≈ 111.320 × cos(lintang) m.

Pengujian menggunakan lima tingkat galat yang mengacu pada rentang akurasi GPS *smartphone* di ruang terbuka hingga lingkungan padat bangunan menurut literatur [?]: **σ ∈ {1, 3, 5, 10, 15} meter**, ditambah **σ = 0** sebagai *baseline* untuk memverifikasi kebenaran algoritma tanpa gangguan.

### 3.3 Variabel dan Metrik

- **Variabel bebas**: tingkat galat GPS (σ).
- **Variabel terikat**: metrik akurasi tiap algoritma.

Untuk algoritma **klasifikasi** (Geofence Miqat, Deteksi Arafah, Deteksi Jamarat) digunakan *confusion matrix* dengan metrik:

```
Akurasi   = (TP + TN) / (TP + TN + FP + FN)
Presisi   = TP / (TP + FP)
Recall    = TP / (TP + FN)
F1-score  = 2 × (Presisi × Recall) / (Presisi + Recall)
```

Untuk algoritma **pengukuran/penghitungan** (Haversine, Tawaf, Sa'i) digunakan galat terhadap nilai acuan:

```
MAE  = (1/n) Σ |ŷ − y|
RMSE = √[ (1/n) Σ (ŷ − y)² ]
```

Akurasi Haversine diukur terhadap **formula Vincenty** (model elipsoid WGS-84) sebagai acuan presisi tinggi. Akurasi Tawaf dan Sa'i diukur sebagai *counting accuracy* (persentase percobaan yang menghasilkan hitungan tepat = 7).

### 3.4 Prosedur dan Reproducibility

Bilangan acak dibangkitkan dengan generator *mulberry32* ber-*seed* tetap (seed = 42), sehingga seluruh hasil **dapat direproduksi secara identik**. Jumlah sampel: 5.000 pasang titik (Haversine), 8.000 titik/σ (Miqat), 12.000 titik/σ (Arafah), 300 percobaan lintasan/σ (Tawaf & Sa'i), dan 12.000 titik/σ (Jamarat). Lintasan Tawaf disimulasikan sebagai gerak melingkar berjari-jari 25 m (~0,52 m/s, laju tawaf padat), lintasan Sa'i sebagai gerak bolak-balik Safa–Marwah, keduanya dengan *sampling* 3 detik sesuai mode `BestForNavigation` aplikasi.

**Parameter geometris** (dihitung dari koordinat sistem):

| Besaran | Nilai |
|---|---|
| Jarak Safa–Marwah | 419,0 m |
| Jarak antar-Jamarat (Ula–Wustha / Wustha–Aqabah / Ula–Aqabah) | 76,0 / 68,2 / 144,0 m |
| Radius deteksi Jamarat | 30 m |
| Radius zona Sa'i (Safa/Marwah) | 25 m |
| Band radius Tawaf dari Ka'bah | 10–80 m |

---

## 4. Hasil dan Pembahasan

### 4.1 Akurasi Haversine terhadap Elipsoid WGS-84

**Tabel 1.** Galat Haversine vs Vincenty.

| Skenario jarak | MAE (m) | RMSE (m) | Error rata-rata (%) | Error maks (%) |
|---|---|---|---|---|
| Lokal Masjidil Haram (0–0,5 km) | 0,649 | 0,811 | 0,2000 | 0,4267 |
| Skala Miqat (10–450 km) | 521,533 | 675,987 | 0,2654 | 0,4270 |

Formula Haversine mengasumsikan bumi berbentuk bola sempurna (R = 6.371 km), sedangkan Vincenty memodelkan elipsoid. Galat relatif tetap **di bawah 0,5%** pada kedua skala. Untuk deteksi ritual berskala meter (tawaf, sa'i, jamarat), galat absolut < 1 m tidak berdampak signifikan. Pada skala miqat, galat absolut ratusan meter tampak besar namun masih ~0,27% dan berada jauh di bawah radius peringatan miqat 3.000 m, sehingga tidak mengubah keputusan geofence.

### 4.2 Geofence Miqat (Point-in-Circle)

**Tabel 2.** Akurasi klasifikasi "dalam batas miqat" (radius 1.000 m) terhadap σ.

| σ (m) | Akurasi (%) | Presisi (%) | Recall (%) | F1 (%) |
|---|---|---|---|---|
| 0 | 100,00 | 100,00 | 100,00 | 100,00 |
| 1 | 100,00 | 100,00 | 100,00 | 100,00 |
| 3 | 99,92 | 99,87 | 99,94 | 99,91 |
| 5 | 99,81 | 99,68 | 99,84 | 99,76 |
| 10 | 99,69 | 99,59 | 99,62 | 99,61 |
| 15 | 99,45 | 99,49 | 99,11 | 99,30 |

Akurasi menurun sangat landai, tetap **> 99,4%** bahkan pada σ = 15 m. Kesalahan hanya terjadi pada titik yang jaraknya sangat dekat dengan garis batas 1.000 m, di mana gangguan GPS dapat membalik klasifikasi. Karena radius peringatan aktual sistem (3.000 m) jauh lebih longgar, keandalan praktis fitur peringatan miqat sangat tinggi.

### 4.3 Deteksi Arafah (Ray-Casting Polygon)

**Tabel 3.** Akurasi klasifikasi dalam/luar poligon Arafah terhadap σ.

| σ (m) | Akurasi (%) | Presisi (%) | Recall (%) | F1 (%) |
|---|---|---|---|---|
| 0 | 100,00 | 100,00 | 100,00 | 100,00 |
| 1 | 99,98 | 100,00 | 99,96 | 99,98 |
| 3 | 99,95 | 99,99 | 99,93 | 99,96 |
| 5 | 99,84 | 99,82 | 99,90 | 99,86 |
| 10 | 99,63 | 99,68 | 99,68 | 99,68 |
| 15 | 99,44 | 99,48 | 99,55 | 99,52 |

Algoritma *ray-casting* mengklasifikasikan posisi dengan benar **> 99,4%** pada seluruh tingkat gangguan. Kesalahan terkonsentrasi pada pita sempit di sekitar tepi poligon (selebar ~σ); titik yang jauh di dalam atau di luar Arafah selalu diklasifikasikan benar. Ini relevan untuk validasi keabsahan wukuf, di mana kesalahan hanya mungkin bagi jamaah yang benar-benar berdiri tepat di garis batas.

### 4.4 Penghitung Tawaf Otomatis

**Tabel 4.** *Counting accuracy* Tawaf (target = 7 putaran, 300 percobaan/σ).

| σ (m) | Rata-rata putaran | Akurasi tepat-7 (%) | MAE | RMSE |
|---|---|---|---|---|
| 0 | 7,00 | 100,00 | 0,000 | 0,000 |
| 1 | 7,00 | 100,00 | 0,000 | 0,000 |
| 3 | 7,00 | 100,00 | 0,000 | 0,000 |
| 5 | 7,00 | 100,00 | 0,000 | 0,000 |
| 10 | 7,00 | 100,00 | 0,000 | 0,000 |
| 15 | 7,31 | 72,67 | 0,313 | 0,632 |

Penghitung tawaf sangat andal hingga **σ = 10 m (akurasi 100%)**, lalu menurun ke 72,67% pada σ = 15 m. Pada gangguan besar, posisi ber-*noise* di sekitar garis Hajar Aswad dapat memicu deteksi persilangan ganda; rata-rata putaran > 7 (7,31) menunjukkan kecenderungan **over-count**. Mekanisme *debounce* 120 detik meredam sebagian galat ini namun tidak sepenuhnya menghilangkannya pada radius tawaf yang kecil (25 m).

### 4.5 Penghitung Sa'i Otomatis

**Tabel 5.** *Counting accuracy* Sa'i (target = 7 leg, 300 percobaan/σ).

| σ (m) | Rata-rata leg | Akurasi tepat-7 (%) | MAE | RMSE |
|---|---|---|---|---|
| 0–15 | 7,00 | 100,00 | 0,000 | 0,000 |

Penghitung sa'i **sempurna (100%) pada seluruh tingkat gangguan**, termasuk σ = 15 m. Ketahanan ini disebabkan pemisahan geometris Safa–Marwah yang besar (419 m) — jauh melampaui skala gangguan GPS — sehingga transisi antar-zona selalu terdeteksi tanpa ambiguitas. Ini menunjukkan bahwa keandalan penghitung berbasis-zona berbanding lurus dengan rasio jarak-antar-zona terhadap galat GPS.

### 4.6 Deteksi Jamarat (Klasifikasi 3 Kelas)

**Tabel 6.** Akurasi identifikasi pilar Jamarat terhadap σ.

| σ (m) | Akurasi benar (%) | Salah pilar (%) | Tak terdeteksi (%) |
|---|---|---|---|
| 0 | 100,00 | 0,00 | 0,00 |
| 1 | 100,00 | 0,00 | 0,00 |
| 3 | 100,00 | 0,00 | 0,00 |
| 5 | 100,00 | 0,00 | 0,00 |
| 10 | 97,31 | 0,03 | 2,67 |
| 15 | 83,53 | 0,32 | 16,15 |

**Tabel 7.** *Confusion matrix* Jamarat pada σ = 15 m.

| Sebenarnya \ Prediksi | Ula | Wustha | Aqabah | Tak terdeteksi |
|---|---|---|---|---|
| **Ula** | 3.328 | 4 | 0 | 668 |
| **Wustha** | 2 | 3.364 | 18 | 616 |
| **Aqabah** | 0 | 14 | 3.332 | 654 |

Deteksi jamarat akurat 100% hingga σ = 5 m, lalu menurun ke 83,53% pada σ = 15 m. Yang penting: kesalahan **salah-pilar** hampir nol (≤ 0,32%) — karena jarak antar-pilar (68–144 m) melebihi dua kali radius deteksi (60 m), sehingga zona tidak tumpang tindih. Degradasi hampir seluruhnya berupa **"tak terdeteksi"** (16,15% pada σ = 15 m): gangguan besar mendorong posisi terukur keluar dari radius 30 m. Implikasinya, risiko utama pada gangguan tinggi bukan *salah identifikasi* melainkan *gagal deteksi*, yang dapat dimitigasi dengan memperbesar radius atau menggabungkan konteks urutan lempar per hari.

### 4.7 Ringkasan Ketahanan Antar-Algoritma

Tingkat ketahanan terhadap gangguan GPS berkorelasi dengan **rasio separasi geometris terhadap σ**:

1. **Sa'i** (separasi 419 m) — paling tahan, 100% di semua σ.
2. **Geofence Miqat & Arafah** (keputusan hanya sensitif di pita tepi) — > 99,4% di semua σ.
3. **Tawaf** (radius 25 m) — andal hingga σ = 10 m, menurun di σ = 15 m.
4. **Jamarat** (radius deteksi 30 m) — andal hingga σ = 5 m, menurun via non-deteksi di σ ≥ 10 m.

---

## 5. Keterbatasan

1. **Galat sistematik Haversine.** Asumsi bumi bola menimbulkan galat ~0,2–0,5% terhadap elipsoid; dapat diperkecil dengan Vincenty bila presisi jarak jauh diperlukan.
2. **Sensitivitas Tawaf pada gangguan besar.** Radius tawaf yang kecil (25 m) dan deteksi persilangan sudut membuat penghitung rawan *over-count* pada σ ≥ 15 m; ambang *debounce* dan penghalusan lintasan (mis. filter Kalman) berpotensi memperbaikinya.
3. **Kasus tepi garis Hajar Aswad.** Deteksi persilangan gagal bila sebuah sampel jatuh **tepat** pada sudut 0° (garis Hajar Aswad); dalam praktik peristiwa ini berpeluang nol karena gangguan GPS, namun merupakan celah logika yang perlu ditangani secara eksplisit.
4. **Non-deteksi Jamarat.** Pada σ tinggi, radius 30 m menyebabkan gagal-deteksi; perlu penyesuaian radius adaptif.
5. **Penyederhanaan batas Arafah/Namirah.** Poligon Arafah 5 titik dan Masjid Namirah sebagai titik tunggal + radius 200 m adalah aproksimasi dari batas sebenarnya.
6. **Simulasi vs lapangan.** Model Gaussian isotropik tidak menangkap *multipath* dan bias sistematik akibat menara tinggi di sekitar Masjidil Haram; validasi lapangan dengan jejak GPS nyata direkomendasikan sebagai penelitian lanjutan.

---

## Lampiran: Reproduksi Hasil

```bash
npx tsx docs/accuracy-test/run.ts
# Keluaran: docs/accuracy-test/results/summary.md + 5 file CSV (siap plot grafik akurasi-vs-σ)
```

## Placeholder Sitasi

- [?] Studi akurasi/galat posisi GPS pada *smartphone* (rentang σ ruang terbuka vs urban).
- [?] Formula Haversine — referensi metode great-circle.
- [?] Vincenty (1975) — perhitungan jarak pada elipsoid.
- [?] Algoritma point-in-polygon ray casting (mis. Shimrat / Franklin).
- [?] Metode simulasi Monte Carlo untuk evaluasi sistem geospasial.
