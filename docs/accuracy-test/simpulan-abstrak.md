# Draf Simpulan & Abstrak

> Pasangan penutup dari `pendahuluan-tinjauan-pustaka.md` dan `paper-draft.md`.
> Abstrak ditulis terakhir memang disengaja — ia merangkum naskah yang sudah final.
> Setelah Anda menyunting bab-bab lain, baca ulang abstrak ini dan samakan angkanya
> bila ada yang berubah. Catatan penyuntingan di bagian bawah (hapus sebelum submit).

---

## 5. SIMPULAN

Penelitian ini menjawab satu pertanyaan yang selama ini dilewatkan oleh pengembangan aplikasi pendamping haji: seberapa jauh deteksi ritual berbasis geometri GPS dapat dipercaya ketika posisi yang diterimanya salah. Enam algoritma pada sistem Mabrur diuji melalui simulasi Monte Carlo dengan injeksi derau Gaussian pada enam tingkat galat (σ = 0 sampai 15 m), menggunakan kode produksi aplikasi tanpa modifikasi logika. Seluruh algoritma terbukti benar pada kondisi ideal (σ = 0, akurasi 100%), sehingga setiap penurunan kinerja yang teramati murni disebabkan galat posisi, bukan cacat logika.

Hasil pengujian memperlihatkan tiga tingkatan ketahanan. Pada tingkatan pertama, penghitung sa'i bertahan sempurna (100%) hingga galat terburuk, dan geofence miqat maupun deteksi batas Arafah tetap di atas 99,4% — kesalahan hanya muncul pada pita sempit di sekitar garis batas. Pada tingkatan kedua, penghitung tawaf andal penuh hingga σ = 10 m namun turun ke 72,67% pada σ = 15 m dengan kecenderungan kelebihan hitung di sekitar garis Hajar Aswad. Pada tingkatan ketiga, identifikasi pilar jamarat akurat penuh hingga σ = 5 m lalu melemah menjadi 83,53% pada σ = 15 m; yang perlu digarisbawahi, kesalahan identifikasi antar-pilar nyaris tidak terjadi (maksimum 0,32%) — penurunan hampir seluruhnya berupa kegagalan deteksi karena posisi terukur terdorong keluar radius 30 m. Pola ketiga tingkatan ini mengerucut pada satu temuan umum: ketahanan algoritma geometris ditentukan oleh rasio antara separasi geometris objek ritual dan besar galat posisi. Jarak Safa–Marwah yang 419 m membuat sa'i praktis kebal terhadap galat GPS ponsel; radius tawaf yang hanya 25 m menjadikannya komponen paling rawan.

Temuan tersebut membawa implikasi praktis yang langsung dapat dipakai perancang aplikasi sejenis. Karena galat GPS ponsel di lingkungan padat bangunan berada pada kisaran 7–13 m, seluruh algoritma yang diuji berada dalam wilayah kerja yang aman untuk kondisi lapangan tipikal — kecuali pada skenario terburuk di sekitar Masjidil Haram, tempat penghitung tawaf dan deteksi jamarat memerlukan mitigasi tambahan. Mitigasi yang paling menjanjikan mengikuti arah temuan: penghalusan lintasan (misalnya tapis Kalman) sebelum deteksi persilangan sudut untuk tawaf, dan radius deteksi adaptif atau pemanfaatan konteks urutan lempar harian untuk jamarat.

Penelitian ini dibatasi oleh sifat simulasinya: model derau Gaussian isotropik tidak menangkap bias multipath yang sesungguhnya terjadi di antara menara-menara sekitar Masjidil Haram, dan lintasan simulasi tidak memuat perilaku jamaah yang berhenti, berbalik, atau terbawa arus kerumunan. Validasi lapangan dengan rekaman jejak GPS nyata dari musim haji menjadi kelanjutan yang paling mendesak. Dua arah lanjutan lain telah disiapkan pada sistem yang sama: evaluasi fitur keselamatan jamaah (peringatan SOS dan pemantauan kelompok) serta evaluasi arsitektur luring-pertama untuk kondisi jaringan yang padat — keduanya melengkapi validasi algoritmik ini menuju penilaian sistem secara utuh.

---

## ABSTRAK

Keabsahan ibadah haji terikat pada lokasi dan hitungan: wukuf harus di dalam batas Arafah, tawaf genap tujuh putaran, dan sa'i tujuh lintasan dari Safa ke Marwah. Aplikasi pendamping haji yang ada umumnya berhenti pada penyajian konten manasik, sementara sistem yang memanfaatkan lokasi belum pernah diuji ketepatan algoritmanya terhadap galat GPS ponsel yang mencapai 7–13 m di lingkungan padat bangunan. Penelitian ini merancang enam algoritma deteksi ritual berbasis geometri posisi — perhitungan jarak haversine, geofence miqat, deteksi batas Arafah dengan ray casting, penghitung tawaf berbasis persilangan sudut, penghitung sa'i berbasis pergantian zona, dan identifikasi pilar jamarat — lalu menguji akurasinya melalui simulasi Monte Carlo dengan injeksi derau Gaussian bertingkat (σ = 1–15 m) yang sepenuhnya dapat direproduksi. Hasilnya: penghitung sa'i bertahan 100% pada seluruh tingkat galat; geofence miqat dan deteksi Arafah di atas 99,4%; penghitung tawaf andal hingga σ = 10 m (100%) sebelum turun ke 72,67% pada σ = 15 m; identifikasi jamarat akurat hingga σ = 5 m dengan kesalahan antar-pilar maksimum 0,32%. Ketahanan algoritma terbukti ditentukan oleh rasio separasi geometris objek ritual terhadap besar galat posisi, temuan yang dapat menjadi dasar perancangan aplikasi ibadah berbasis lokasi. Pada rentang galat GPS ponsel yang tipikal, keenam algoritma berada dalam wilayah kerja yang aman tanpa memerlukan model pembelajaran mesin maupun sensor tambahan.

**Kata kunci:** deteksi ritual haji; geofencing; akurasi GPS; simulasi Monte Carlo; haversine; point-in-polygon

---

## ABSTRACT

The validity of Hajj rituals is bound to location and count: wukuf must take place within the boundaries of Arafah, tawaf requires exactly seven circuits, and sa'i seven laps from Safa to Marwah. Existing Hajj companion applications mostly stop at presenting ritual guidance content, while location-aware systems have never had their algorithms tested against smartphone GPS errors, which reach 7–13 m in built-up environments. This study designs six position-geometry-based ritual detection algorithms — haversine distance computation, miqat geofencing, Arafah boundary detection using ray casting, an angular-crossing tawaf counter, a zone-alternation sa'i counter, and jamarat pillar identification — and evaluates their accuracy through fully reproducible Monte Carlo simulation with graduated Gaussian noise injection (σ = 1–15 m). The results show three tiers of robustness: the sa'i counter remains perfect (100%) at all noise levels; miqat geofencing and Arafah detection stay above 99.4%; the tawaf counter is fully reliable up to σ = 10 m (100%) before dropping to 72.67% at σ = 15 m; and jamarat identification is accurate up to σ = 5 m with cross-pillar misidentification never exceeding 0.32%. Algorithm robustness is shown to be governed by the ratio of the ritual objects' geometric separation to the magnitude of positioning error — a finding that can inform the design of similar location-based worship applications. Within the typical range of smartphone GPS error, all six algorithms operate safely without requiring machine learning models or additional sensors.

**Keywords:** Hajj ritual detection; geofencing; GPS accuracy; Monte Carlo simulation; haversine; point-in-polygon

---

## Catatan Penyuntingan (hapus sebelum submit)

1. **Panjang abstrak** ±230 kata — umumnya pas untuk Sinta 3/4 (batas lazim 150–250). Bila jurnal target membatasi 200 kata, kalimat yang paling aman dipangkas: rincian enam algoritma (cukup "enam algoritma geospasial") dan kalimat terakhir.
2. **Kata kunci** disusun dari-spesifik-ke-umum; sesuaikan jumlahnya dengan selingkung (lazim 3–6). Bila jurnal meminta kata kunci berbeda dari judul, pastikan "haji" tidak dobel dengan judul naskah.
3. **Kalimat penutup Simpulan** menyebut dua penelitian lanjutan (keselamatan jamaah, luring-pertama) — ini sengaja menyiapkan jalan untuk artikel Angle B dan C Anda tanpa self-plagiarism, karena hanya disebut sebagai arah, bukan hasil. Biarkan, kecuali Anda ingin menyembunyikan rencana itu dari pembaca.
4. **Konsistensi angka**: 72,67% / 83,53% / 99,4% / 0,32% / 419 m / σ = 1–15 m harus identik dengan tabel di `paper-draft.md`. Kalau Anda menjalankan ulang simulasi dengan parameter berbeda, perbarui ketiga file sekaligus.
5. **Judul naskah** belum dibuat. Usulan (pilih satu, atau olah sendiri):
   - "Pengujian Akurasi Algoritma Geospasial untuk Deteksi Ritual Haji Berbasis GPS terhadap Galat Posisi"
   - "Ketahanan Algoritma Deteksi Tawaf, Sa'i, dan Geofence Ritual Haji terhadap Galat GPS: Evaluasi Simulasi Monte Carlo"
   - "Deteksi Ritual Haji Berbasis Geometri Posisi GPS dan Evaluasi Akurasinya pada Berbagai Tingkat Galat"
