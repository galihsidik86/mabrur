# Sumber data Al-Qur'an (`quran-v1.db`)

Dibangun oleh `apps/mobile/scripts/build-quran.py`; teks tidak diubah sama sekali.

| Isi | Sumber | Lisensi / syarat |
|---|---|---|
| Teks Arab Utsmani berharakat, terjemahan bahasa Indonesia, catatan kaki | QuranEnc.com — "Indonesian Translation – Ministry of Religious Affairs" (`indonesian_affairs`, v1.0.1), terjemahan Kementerian Agama RI edisi penyempurnaan 2019, diterbitkan King Fahd Complex / Rowwad Translation Center | Boleh dipakai dengan mencantumkan sumber dan tanpa mengubah teks |
| Jumlah ayat, nama Arab & English, Makkiyah/Madaniyah, awal juz | Tanzil.net `quran-data.js` | CC BY 3.0 |
| Nama latin & arti nama surah (Indonesia) | npm `quran-json` 3.1.2 | CC BY 4.0 |

Validasi saat build: 114 surah / 6 236 ayat cocok dengan Tanzil; terjemahan dari API QuranEnc
dicocokkan satu per satu dengan berkas SQLite resmi QuranEnc (beda hanya format penanda catatan
kaki `[4]` vs `4)`); 30 juz tidak ada yang kosong. Seluruh karakter teks Arab tersedia di font Amiri.

Atribusi ditampilkan di aplikasi pada akhir setiap halaman baca.
Bila data diperbarui, naikkan nama berkas (`quran-v2.db`) agar HP yang sudah menyalin versi lama ikut memperbarui.
