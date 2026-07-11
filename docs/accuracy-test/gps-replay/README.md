# gps-replay — Validasi Lapangan Algoritma Deteksi Ritual

Pipeline pelengkap simulasi Monte Carlo: memutar ulang (*replay*) trace GPS riil
ke **enam algoritma produksi** (diimpor langsung dari
`apps/mobile/src/services/sacred-zones-core.ts`, bukan salinan) dan
mengkuantifikasi seberapa jauh derau GPS riil menyimpang dari asumsi Gaussian
isotropik i.i.d. yang dipakai simulasi.

## Merekam trace (untuk data riil)

1. **Jalur utama — perekam internal Mabrur**: buka aplikasi → Alat Ibadah →
   **Perekam GPS (riset)** (`apps/mobile/app/gps-recorder.tsx`). Perekam memakai
   expo-location `Accuracy.BestForNavigation` — **stack lokasi yang sama dengan
   deteksi ritual produksi** — pada 1 titik/detik tanpa penyaringan jarak, menyimpan
   akurasi per titik, dan mengekspor GPX via share sheet. Ini menghilangkan
   pertanyaan reviewer soal perbedaan stack perekaman vs produksi.
   (Alternatif: aplikasi pihak ketiga mis. GPS Logger, interval 1 detik, ekspor GPX
   dengan *accuracy*.)
2. Rekam minimal 3 skenario berjalan kaki (pilihan skenario tersedia di layar perekam):
   - **A. Lapangan terbuka** — jalan lurus ±300 m di area tanpa halangan langit.
   - **B. Padat bangunan / koridor sempit** — proxy *urban canyon*.
   - **C. Bolak-balik lurus ±400 m × 7 kali** — proxy sa'i (mulai dan patokan ujung yang sama).
3. Salin berkas ke `field_logs/` (root repo), lalu:

```bash
npm run replay
```

Tanpa data riil, uji pipeline dengan fixture sintetis:

```bash
npm run replay -- --demo     # hasil bertanda DEMO — DILARANG dikutip naskah
npm run test:replay          # unit test parser + transformasi (23 test)
```

Keluaran: `docs/accuracy-test/results/FIELD_VALIDATION.md`,
`field_characterization.json`, dan PNG `results/figures/field-*.png`.

## Alur pipeline

```
GPX/CSV → parser (validasi, dedup, segmen) → ENU lokal → smoothing (MA-11)
  ├─ karakterisasi residual: σ per sumbu, Jarque-Bera, Q-Q, ACF
  └─ replay 6 algoritma (modul produksi) → laporan + banding vs Monte Carlo
```

## Asumsi & Keterbatasan (bahan eksplisit bab keterbatasan naskah)

1. **Georeferensi ulang.** Trace direkam di Indonesia; objek ritual ada di Makkah.
   Trace ditranslasikan/dirotasikan ke kerangka objek ritual sehingga **pola galat
   GPS-nya asli namun kerangka acuannya dipindahkan**. Konsekuensi: karakteristik
   konstelasi satelit/ionosfer lokasi asli ikut terbawa — bukan pengganti penuh
   perekaman di Makkah.
2. **Ground truth = lintasan terhalus** (moving average terpusat, jendela 11).
   Komponen galat berfrekuensi rendah (autokorelasi kuat, multipath berkelanjutan)
   sebagian terserap ke referensi sehingga **σ efektif adalah batas bawah**.
   Residual dipangkas half-window di kedua ujung untuk menghindari bias tepi.
3. **Sa'i memakai skala.** Koridor trace dipetakan ke Safa–Marwah 419 m dengan
   faktor skala s (dilaporkan per trace); derau ikut terskala sebesar s.
4. **Tawaf memakai superimposisi residual.** Trace jalan kaki tidak berbentuk
   lingkaran r=25 m, maka deret residual riil (grid 3 dtk) ditumpangkan ke
   lingkaran ideal 7 putaran. Bila deret lebih pendek dari 700 sampel, deret
   diulang (*tiling*) — pola berulang dicatat di laporan.
5. **Klasifikasi memusatkan sampel di pita batas** (25 penempatan deterministik,
   ±50 m; jamarat ±15 m). Akurasi replay TIDAK sebanding secara absolut dengan
   angka simulasi (yang menyebar sampel merata di area luas) — bandingkan
   antar-trace, atau baca kolom MC hanya sebagai referensi arah.
6. **hdop bukan meter.** Bila perangkat hanya menulis `<hdop>`, nilai dipakai
   sebagai proksi berlabel — bukan akurasi horizontal sesungguhnya.

## Antarmuka produksi yang dipakai

| Algoritma | Simbol produksi |
|---|---|
| Sa'i | `SaiTracker` |
| Tawaf | `TawafTracker` (parameter waktu diinjeksi dari timestamp trace) |
| Arafah | `isPointInPolygon` + `ARAFAH_BOUNDARY` |
| Miqat | `distanceMetersExport` (haversine produksi) + ring 1.000 m (zona seed Qarnul Manazil) |
| Jamarat | `detectNearestJamarat` |
