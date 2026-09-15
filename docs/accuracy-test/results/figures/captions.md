# Usulan Caption Gambar (untuk naskah jurnal)

PNG sengaja **tanpa judul tertanam** — jurnal menempatkan caption di bawah gambar via template.
Semua gambar @2x (≈1824 px lebar), siap sisip. Regenerasi: `node docs/accuracy-test/charts.js`
(setelah `npx tsx docs/accuracy-test/run.ts` bila data berubah).

| File | Usulan caption |
|---|---|
| `fig1-gabungan.png` | **Gambar 1.** Perbandingan akurasi enam algoritma deteksi ritual terhadap tingkat galat GPS (σ). Sa'i, Geofence Miqat, dan Deteksi Arafah bertahan > 99% pada seluruh σ, sedangkan penghitung Tawaf dan deteksi Jamarat menurun pada σ ≥ 10 m. |
| `fig2-miqat-metrik.png` | **Gambar 2.** Metrik klasifikasi Geofence Miqat (akurasi, presisi, recall, F1) terhadap σ; seluruh metrik tetap di atas 99,1%. |
| `fig3-arafah-metrik.png` | **Gambar 3.** Metrik klasifikasi Deteksi Arafah (ray-casting polygon) terhadap σ; kesalahan terkonsentrasi pada pita tepi poligon. |
| `fig4-tawaf.png` | **Gambar 4.** Akurasi tepat-7 penghitung Tawaf otomatis (skema sudut kumulatif CCW + kebijakan "tidak pernah dini", revisi 2026-09-15); andal hingga σ = 5 m (97,67–98,67%), menurun ke 92,67% pada σ = 10 m dan 28,33% pada σ = 15 m — radius edar kecil (25 m) membuat derau tangensial signifikan dalam derajat pada σ besar. Penurunan kecil di σ rendah (dibanding 100% pada skema toleransi lama) adalah trade-off yang disengaja: sistem menjamin tidak pernah mengumumkan putaran selesai sebelum waktunya (0 m dini pada σ = 0), sedikit mengorbankan proporsi tepat-7 demi keamanan fikih. |
| `fig5-sai.png` | **Gambar 5.** Akurasi tepat-7 penghitung Sa'i otomatis; 100% pada seluruh σ berkat separasi geometris Safa–Marwah (377 m, titik puncak OSM) yang jauh melampaui galat GPS. Skala sumbu-y disamakan dengan Gambar 4 untuk perbandingan. |
| `fig6-jamarat-hasil.png` | **Gambar 6.** Komposisi hasil deteksi Jamarat terhadap σ: kesalahan salah-pilar nyaris nol (0% pada seluruh σ, pilar terpisah 153–387 m); degradasi pada σ besar didominasi kegagalan deteksi (posisi terukur keluar radius 30 m). |
| `fig7-tawaf-skenario3-radius.png` | **Gambar 7.** Sensitivitas radius edar Tawaf (skenario III — mulai=selesai, diam 30 dtk di awal+akhir; mode adaptif) terhadap σ, per radius r ∈ {12,15,25,40,60} m. Radius kecil (12–15 m, umum di lantai atas Masjidil Haram) jauh lebih rentan derau dibanding radius besar (40–60 m, lantai dasar/mataf luar). Data lengkap: `results/tawaf_scenarios.csv`. |
| `fig8-boundary-mc-vs-analitik.png` | **Gambar 8.** Validasi analitik geofence lingkaran: P(salah klasifikasi) hasil Monte Carlo (titik, 20.000 sampel/sel) berimpit dengan kurva analitik Φ(−\|d\|/σ) (garis) pada berbagai σ, terhadap jarak bertanda d ke batas (negatif = di dalam geofence). Kecocokan MC–analitik mengonfirmasi validitas pendekatan bidang-datar untuk R=1.000 m ≫ σ. Data lengkap: `results/boundary_error_curve.csv`. |

**Catatan aksesibilitas/cetak**: tiap seri dibedakan dengan warna *dan* bentuk marker
(lingkaran/persegi/segitiga/wajik), sehingga gambar tetap terbaca pada cetakan grayscale.
Palet tervalidasi bebas ambigu untuk pembaca buta warna (ΔE terburuk 24,2; ambang ≥ 12).
Nilai lengkap setiap titik tersedia pada tabel hasil (Tabel 1–7 naskah / CSV di `results/`).
