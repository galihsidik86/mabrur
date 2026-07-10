# Usulan Caption Gambar (untuk naskah jurnal)

PNG sengaja **tanpa judul tertanam** — jurnal menempatkan caption di bawah gambar via template.
Semua gambar @2x (≈1824 px lebar), siap sisip. Regenerasi: `node docs/accuracy-test/charts.js`
(setelah `npx tsx docs/accuracy-test/run.ts` bila data berubah).

| File | Usulan caption |
|---|---|
| `fig1-gabungan.png` | **Gambar 1.** Perbandingan akurasi enam algoritma deteksi ritual terhadap tingkat galat GPS (σ). Sa'i, Geofence Miqat, dan Deteksi Arafah bertahan > 99% pada seluruh σ, sedangkan penghitung Tawaf dan deteksi Jamarat menurun pada σ ≥ 10 m. |
| `fig2-miqat-metrik.png` | **Gambar 2.** Metrik klasifikasi Geofence Miqat (akurasi, presisi, recall, F1) terhadap σ; seluruh metrik tetap di atas 99,1%. |
| `fig3-arafah-metrik.png` | **Gambar 3.** Metrik klasifikasi Deteksi Arafah (ray-casting polygon) terhadap σ; kesalahan terkonsentrasi pada pita tepi poligon. |
| `fig4-tawaf.png` | **Gambar 4.** Akurasi tepat-7 penghitung Tawaf otomatis; andal hingga σ = 10 m (100%), menurun ke 72,67% pada σ = 15 m akibat over-count di sekitar garis Hajar Aswad. |
| `fig5-sai.png` | **Gambar 5.** Akurasi tepat-7 penghitung Sa'i otomatis; 100% pada seluruh σ berkat separasi geometris Safa–Marwah (419 m) yang jauh melampaui galat GPS. Skala sumbu-y disamakan dengan Gambar 4 untuk perbandingan. |
| `fig6-jamarat-hasil.png` | **Gambar 6.** Komposisi hasil deteksi Jamarat terhadap σ: kesalahan salah-pilar nyaris nol (≤ 0,32%); degradasi pada σ besar didominasi kegagalan deteksi (posisi terukur keluar radius 30 m). |

**Catatan aksesibilitas/cetak**: tiap seri dibedakan dengan warna *dan* bentuk marker
(lingkaran/persegi/segitiga/wajik), sehingga gambar tetap terbaca pada cetakan grayscale.
Palet tervalidasi bebas ambigu untuk pembaca buta warna (ΔE terburuk 24,2; ambang ≥ 12).
Nilai lengkap setiap titik tersedia pada tabel hasil (Tabel 1–7 naskah / CSV di `results/`).
