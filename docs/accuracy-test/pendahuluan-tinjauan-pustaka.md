# Draf Pendahuluan & Tinjauan Pustaka

> Pasangan dari `paper-draft.md` (bab Metode + Hasil). Sitasi bernomor [n] merujuk ke
> daftar referensi di bagian akhir — semuanya publikasi nyata hasil penelusuran,
> **tetap wajib diverifikasi** (DOI, volume, halaman) sebelum submit.
> Baca juga catatan penyuntingan di bagian paling bawah.

---

## 1. PENDAHULUAN

Indonesia memberangkatkan jamaah haji dalam jumlah yang tidak dimiliki negara mana pun. Musim haji 1445 H/2024 M mencatat 241.000 jamaah, kuota terbesar sepanjang sejarah penyelenggaraan haji Indonesia, dan sekitar 45.000 di antaranya berusia 65 tahun ke atas [1], [2]. Di balik angka itu ada persoalan yang berulang hampir setiap musim: jamaah tersesat. Laporan penyelenggaraan haji 2024 mencatat kasus jamaah lanjut usia yang kehilangan arah karena minimnya penunjuk jalan, dan Kementerian Agama sendiri menempatkan mitigasi risiko jamaah lansia sebagai catatan perbaikan layanan [2]. Persoalan ini tidak sederhana. Kawasan Masjidil Haram, Arafah, Muzdalifah, dan Mina pada puncak musim haji dipadati jutaan manusia, sementara seorang pembimbing (muthawwif) lazimnya harus mengawal puluhan jamaah sekaligus.

Ada satu karakter ibadah haji yang jarang disentuh aplikasi pendamping pada umumnya: keabsahannya terikat pada lokasi dan hitungan. Wukuf hanya sah bila dilakukan di dalam batas wilayah Arafah — dan batas ini bukan perkara sepele, karena sebagian bangunan Masjid Namirah justru berada di luarnya. Tawaf harus genap tujuh putaran mengelilingi Ka'bah, dihitung dari garis sejajar Hajar Aswad. Sa'i harus tujuh lintasan yang dimulai dari Safa dan berakhir di Marwah. Ihram harus diniatkan sebelum melintasi miqat. Bagi jamaah lansia yang kelelahan di tengah kepadatan, sekadar mengingat "ini putaran ke berapa" adalah beban kognitif tersendiri; salah hitung berarti keraguan terhadap sahnya ibadah yang telah dinanti puluhan tahun.

Aplikasi pendamping haji dan umrah yang tersedia saat ini, maupun yang dilaporkan dalam literatur, umumnya berhenti pada penyajian konten: materi manasik, kumpulan doa, dan jadwal kegiatan [3], [4], [5]. Beberapa penelitian telah melangkah ke pemantauan posisi jamaah berbasis geofencing [6], namun evaluasinya terbatas pada penerimaan pengguna melalui kuesioner, bukan pada ketepatan algoritmanya. Di sisi lain, penelitian deteksi ritual secara otomatis mulai bermunculan dengan pendekatan sensor inersia (IMU) [7], [8] dan visi komputer [9]. Pendekatan-pendekatan tersebut menjanjikan, tetapi membawa prasyarat yang berat untuk konteks jamaah Indonesia: model pembelajaran mesin yang harus dilatih, konsumsi komputasi yang tinggi, atau infrastruktur kamera yang hanya dimiliki otoritas setempat. Padahal setiap jamaah sudah menggenggam satu sensor posisi: GPS pada ponselnya.

Pertanyaannya, dapatkah deteksi ritual dibangun hanya dari geometri posisi GPS — tanpa pelatihan model, tanpa sensor tambahan — dan seberapa jauh ia bertahan terhadap galat pengukuran? Pertanyaan kedua ini yang justru paling menentukan dan paling jarang dijawab. Studi empiris menunjukkan galat horizontal GPS ponsel berkisar 5–8,5 m pada kondisi baik [10] dan mencapai 7–13 m di lingkungan perkotaan yang padat bangunan [11]. Lingkungan sekitar Masjidil Haram, yang dikelilingi menara-menara tinggi, termasuk kategori terburuk untuk penerimaan sinyal satelit. Sebuah algoritma penghitung tawaf yang bekerja sempurna pada koordinat ideal bisa saja gagal total pada koordinat yang bergeser sepuluh meter.

Penelitian ini merancang dan menguji enam algoritma geospasial untuk deteksi ritual haji dan umrah pada sistem Mabrur, sebuah aplikasi pendamping jamaah berbasis Android: (i) perhitungan jarak haversine, (ii) geofence miqat, (iii) deteksi batas Arafah dengan poligon ray casting, (iv) penghitung putaran tawaf berbasis persilangan sudut, (v) penghitung lintasan sa'i berbasis pergantian zona, dan (vi) identifikasi pilar jamarat. Kontribusi utamanya bukan pada masing-masing formula — haversine dan ray casting adalah metode mapan — melainkan pada tiga hal: pertama, komposisi keenamnya menjadi satu rangkaian deteksi ritual yang berjalan sepenuhnya di perangkat tanpa model terlatih; kedua, kerangka pengujian akurasi berbasis simulasi Monte Carlo dengan injeksi derau GPS Gaussian bertingkat (σ = 1–15 m) yang seluruhnya dapat direproduksi; ketiga, temuan kuantitatif tentang hubungan antara separasi geometris objek ritual dan ketahanan algoritma terhadap galat posisi, yang dapat menjadi dasar perancangan aplikasi sejenis.

Sisa naskah ini disusun sebagai berikut. Bagian 2 mengulas penelitian terkait dan landasan metode geometris yang digunakan. Bagian 3 memaparkan rancangan algoritma serta prosedur pengujian akurasinya. Bagian 4 menyajikan hasil pengujian beserta pembahasannya, dan Bagian 5 menutup dengan simpulan serta arah penelitian lanjutan.

---

## 2. TINJAUAN PUSTAKA

### 2.1 Aplikasi Pendamping Haji dan Umrah

Penelitian aplikasi haji dan umrah di Indonesia selama satu dekade terakhir dapat dikelompokkan menurut fungsi yang ditawarkannya. Kelompok pertama, dan yang paling banyak, adalah aplikasi pembelajaran manasik: penyajian tata cara ibadah, bacaan doa, dan materi bimbingan dalam bentuk digital sebagai pengganti buku saku [3], [4]. Kelompok kedua adalah aplikasi panduan perjalanan, seperti pemodelan Umrah Guide yang menstrukturkan informasi syarat, larangan ihram, dan prosedur umrah [5]. Kedua kelompok ini pada dasarnya memindahkan konten cetak ke layar ponsel; posisi jamaah tidak dilibatkan dalam logika aplikasi.

Kelompok ketiga mulai memanfaatkan lokasi. Budiawan dkk. mengembangkan aplikasi pemantauan jamaah berbasis geofencing dan Firebase Cloud Messaging untuk sebuah biro perjalanan, yang memungkinkan pembimbing memantau sebaran jamaahnya dan jamaah meminta bantuan [6]. Evaluasi yang dilaporkan berupa tingkat penerimaan: 93,33% pembimbing menilai aplikasi membantu pemantauan dan 86% jamaah menilainya bermanfaat. Angka tersebut menunjukkan kebutuhan yang nyata, namun menyisakan pertanyaan yang belum dijawab: seberapa tepat geofence itu sendiri bekerja, dan berapa banyak keputusan masuk/keluar zona yang salah akibat galat posisi. Sepanjang penelusuran penulis, belum ada penelitian aplikasi haji di Indonesia yang mengevaluasi akurasi algoritma lokasinya secara kuantitatif.

### 2.2 Deteksi Ritual Secara Otomatis

Di tingkat internasional, deteksi aktivitas ritual haji telah dicoba melalui beberapa jalur. Jalur pertama memakai sensor inersia. Kammoun dkk. mendeteksi aktivitas tawaf dan sa'i dari data akselerometer dan giroskop ponsel yang diproses dengan algoritma pengenalan aktivitas [7]; pendekatan serupa dikembangkan menjadi model penghitung putaran tawaf dan sa'i yang berjalan mandiri di perangkat [8]. Jalur kedua memakai visi komputer: jaringan saraf konvolusional untuk mengestimasi kepadatan dan menghitung individu pada rekaman video area tawaf, dengan akurasi yang dilaporkan sekitar 87% pada dataset HAJJv2 [9].

Kedua jalur tersebut memiliki wilayah keunggulannya masing-masing, tetapi juga batasan yang jelas. Pendekatan IMU peka terhadap variasi cara membawa ponsel dan gaya berjalan — faktor yang sulit dikendalikan pada jamaah lansia yang memakai kursi roda atau skuter, yang jumlahnya justru terus bertambah. Pendekatan visi membutuhkan infrastruktur kamera dan komputasi yang berada di luar kendali penyelenggara ibadah dari negara pengirim. Pendekatan geometris berbasis GPS, yang dipakai penelitian ini, menukar kecanggihan model dengan kesederhanaan: tidak ada pelatihan, tidak ada sensor tambahan, logikanya dapat diaudit baris per baris — kualitas yang relevan untuk perangkat lunak yang menyentuh keabsahan ibadah. Konsekuensinya, seluruh beban ketepatan berpindah ke satu titik: kualitas posisi GPS. Karena itu pengujian ketahanan terhadap galat posisi bukan pelengkap, melainkan inti dari validasi pendekatan ini.

### 2.3 Karakteristik Galat Posisi GPS pada Ponsel

Besaran galat GPS ponsel telah diukur pada berbagai kondisi. Zandbergen dan Barbeau mencatat median galat horizontal 5,0–8,5 m pada pengujian statis di ruang terbuka, dua sampai tiga kali lebih besar dibanding penerima GPS khusus [10]. Merry dan Bettinger mengukur galat 7–13 m di lingkungan perkotaan [11], dan studi-studi yang lebih baru pada berbagai merek ponsel melaporkan rentang 2–15 m terhadap posisi referensi diferensial [12]. Kawasan Masjidil Haram menghadirkan kombinasi terburuk dari kondisi-kondisi tersebut: gedung menjulang di sekelilingnya memantulkan sinyal satelit (efek multipath), sementara kepadatan manusia menghalangi pandangan langit. Rentang inilah yang menjadi dasar pemilihan tingkat derau σ = 1 sampai 15 m pada pengujian di Bagian 3: nilai kecil mewakili kondisi ideal ruang terbuka, nilai besar mewakili skenario pesimistis di sekitar bangunan tinggi.

### 2.4 Metode Geometris yang Menjadi Landasan

Tiga metode klasik menjadi fondasi algoritma yang diuji. Formula haversine menghitung jarak lingkaran besar antara dua koordinat dengan asumsi bumi berbentuk bola [13]; formula ini stabil secara numerik untuk jarak pendek — wilayah kerja utama deteksi ritual — namun membawa galat sistematik terhadap bentuk bumi yang sesungguhnya elipsoid. Formula Vincenty menghitung jarak pada elipsoid WGS-84 secara iteratif dengan ketelitian milimeter [14], sehingga lazim dipakai sebagai acuan pembanding; peran itu pula yang diberikan kepadanya dalam penelitian ini. Untuk menentukan apakah sebuah titik berada di dalam poligon, algoritma ray casting menarik garis dari titik uji dan menghitung paritas perpotongannya dengan sisi-sisi poligon [15]; kesederhanaannya menjadikan metode ini pilihan umum untuk geofence berbentuk bebas seperti batas wilayah Arafah.

### 2.5 Posisi Penelitian Ini

Rangkuman di atas memperlihatkan celah yang hendak diisi. Penelitian aplikasi haji di dalam negeri kuat pada sisi konten dan mulai menyentuh pemanfaatan lokasi, tetapi berhenti pada evaluasi penerimaan pengguna [3]–[6]. Penelitian deteksi ritual di luar negeri kuat pada sisi algoritma, tetapi bertumpu pada IMU atau visi komputer dengan prasyarat yang berat [7]–[9], dan belum ada yang menguji ketahanan pendekatannya terhadap galat posisi secara sistematis. Penelitian ini berdiri di persilangan keduanya: algoritma deteksi ritual berbasis geometri GPS murni yang dievaluasi bukan dengan kuesioner, melainkan dengan pengujian akurasi terkuantifikasi pada enam tingkat galat — disertai kode dan prosedur yang dapat direproduksi penuh.

---

## Daftar Referensi (VERIFIKASI SEBELUM SUBMIT)

Semua entri di bawah adalah publikasi nyata hasil penelusuran. Lengkapi/koreksi volume, nomor, halaman, dan DOI dari sumber aslinya; sesuaikan format dengan gaya selingkung jurnal target.

- [1] Databoks/Kemenag — kuota haji 2024 sebesar 241.000 jamaah (221.000 + 20.000 tambahan). Ganti dengan rujukan resmi Kemenag RI bila tersedia dokumen laporan penyelenggaraan.
- [2] NU Online / Kemenag — sekitar 45.000 jamaah lansia pada 2024; catatan kasus lansia tersesat dan arahan penguatan mitigasi risiko.
- [3] Aplikasi Pembelajaran Manasik Haji dan Umroh Berbasis Android — Bitnet: Jurnal Pendidikan Teknologi Informasi (UMPR).
- [4] Buku Saku Ibadah Manasik Haji dan Umroh Berbasis Android.
- [5] Pemodelan dan Implementasi Aplikasi Mobile Umrah Guide Menggunakan Unified Modeling Language — Jurnal Sains dan Informatika, Politala.
- [6] Budiawan dkk., "Development of Android Based Hajj and Umrah Pilgrims Monitoring Application in Dago Wisata International," IJCCS (Indonesian Journal of Computing and Cybernetics Systems), UGM.
- [7] "Automatic Hajj and Umrah Ritual Detection Using IMU Sensors," KFUPM (±2022).
- [8] "Autonomous Mobile-Based Model for Tawaf/Sa'ay Rounds Counting with Supported Supplications from the Quran and Sunna'a" (2023).
- [9] "Hajj Crowd Management Using CNN-Based Approach" (2021) — akurasi 87% pada dataset KAU-Smart Crowd HAJJv2.
- [10] P. A. Zandbergen dan S. J. Barbeau, "Positional Accuracy of Assisted GPS Data from High-Sensitivity GPS-Enabled Mobile Phones," Journal of Navigation, vol. 64, no. 3, 2011.
- [11] K. Merry dan P. Bettinger, "Smartphone GPS accuracy study in an urban environment," PLOS ONE, vol. 14, no. 7, e0219890, 2019.
- [12] Studi komparatif akurasi GNSS ponsel vs GPS genggam (World Scientific News 202, 2025) — verifikasi kelayakan sumber; bila kurang kuat, ganti dengan studi sejenis di jurnal berindeks.
- [13] R. W. Sinnott, "Virtues of the Haversine," Sky & Telescope, vol. 68, no. 2, 1984.
- [14] T. Vincenty, "Direct and Inverse Solutions of Geodesics on the Ellipsoid with Application of Nested Equations," Survey Review, vol. 23, no. 176, 1975.
- [15] M. Shimrat, "Algorithm 112: Position of point relative to polygon," Communications of the ACM, vol. 5, no. 8, 1962. (Alternatif/pelengkap: E. Haines, "Point in Polygon Strategies," Graphics Gems IV, 1994.)

---

## Catatan Penyuntingan (baca sebelum dipakai — lalu hapus bagian ini)

1. **Sunting dengan suara Anda sendiri.** Teks ini sengaja ditulis spesifik dan tidak generik, tetapi penyuntingan personal tetap langkah terpenting — baik untuk kualitas maupun integritas. Titik paling efektif untuk ditulis ulang dengan pengalaman Anda: (a) paragraf pembuka Pendahuluan — tambahkan konteks yang Anda saksikan langsung (mis. pengalaman KBIH/travel di kota Anda); (b) alinea beban kognitif jamaah — anekdot nyata jauh lebih kuat dari formulasi umum; (c) alasan pemilihan pendekatan di 2.2.
2. **Verifikasi setiap referensi** langsung ke sumber aslinya (bukan ResearchGate) sebelum submit. Nama penulis [7]–[9] belum saya cantumkan lengkap — lengkapi dari dokumen aslinya. Angka [1], [2] rujuk ke dokumen resmi Kemenag bila ada.
3. **Kebijakan AI jurnal target.** Banyak jurnal Sinta kini meminta pernyataan penggunaan AI sebagai alat bantu. Periksa author guidelines jurnal target; bila diminta, cukup nyatakan AI dipakai sebagai alat bantu penyusunan draf dan seluruh isi diverifikasi penulis. Itu jalur yang aman dan makin lazim.
4. **Konsistensi dengan bab lain**: istilah yang dipakai di sini (mis. "persilangan sudut", "pergantian zona", "σ") sudah disamakan dengan `paper-draft.md`. Kalau Anda mengubah istilah di satu tempat, ubah di keduanya.
5. Bagian *sistematika naskah* (paragraf terakhir Pendahuluan) opsional — sebagian jurnal Sinta 3/4 tidak memakainya; hapus bila template jurnal tidak lazim memuatnya.
