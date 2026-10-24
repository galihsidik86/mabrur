// Teks bahasa untuk: Al-Qur'an (app/quran.tsx, app/quran-read.tsx).
// Kunci wajib berawalan 'quran.' agar tidak bentrok dengan bagian lain.
// quranEn wajib punya kunci yang persis sama (dipaksa tipe + server/tests/i18n.test.ts).
// Teks Arab & terjemahan Kemenag tidak ada di sini — datanya di assets/quran/quran-v1.db.

export const quranId = {
  'quran.title': "Al-Qur'an",
  'quran.tab_surah': 'Surah',
  'quran.tab_juz': 'Juz',
  'quran.search': 'Cari surah (nama, arti, atau nomor)',
  'quran.no_result': 'Surah tidak ditemukan',
  'quran.surah_info': '{place} · {count} ayat',
  'quran.place.makkiyah': 'Makkiyah',
  'quran.place.madaniyah': 'Madaniyah',
  'quran.juz_label': 'Juz {n}',
  'quran.ayah_label': 'Ayat {n}',
  'quran.continue': 'Lanjutkan membaca',
  'quran.continue_sub': '{surah} · ayat {ayah}',
  'quran.no_bookmark': 'Ketuk ikon penanda pada ayat untuk menyimpan posisi terakhir dibaca.',
  'quran.bookmark': 'Tandai ayat {ayah} sebagai terakhir dibaca',
  'quran.bookmarked': 'Ayat {ayah}, ditandai terakhir dibaca',
  'quran.font_smaller': 'Perkecil huruf',
  'quran.font_larger': 'Perbesar huruf',
  'quran.load_failed': "Data Al-Qur'an gagal dibuka. Pastikan memori HP cukup, lalu coba lagi.",
  'quran.retry': 'Coba lagi',
  'quran.translation_note': 'Terjemahan Kemenag RI (edisi penyempurnaan 2019)',
  'quran.source': 'Sumber: {source}',
};

export const quranEn: Record<keyof typeof quranId, string> = {
  'quran.title': "Qur'an",
  'quran.tab_surah': 'Surah',
  'quran.tab_juz': 'Juz',
  'quran.search': 'Search surah (name, meaning, or number)',
  'quran.no_result': 'No surah found',
  'quran.surah_info': '{place} · {count} verses',
  'quran.place.makkiyah': 'Meccan',
  'quran.place.madaniyah': 'Medinan',
  'quran.juz_label': 'Juz {n}',
  'quran.ayah_label': 'Verse {n}',
  'quran.continue': 'Continue reading',
  'quran.continue_sub': '{surah} · verse {ayah}',
  'quran.no_bookmark': 'Tap the bookmark icon on a verse to save where you stopped reading.',
  'quran.bookmark': 'Mark verse {ayah} as last read',
  'quran.bookmarked': 'Verse {ayah}, marked as last read',
  'quran.font_smaller': 'Smaller text',
  'quran.font_larger': 'Larger text',
  'quran.load_failed': "Could not open the Qur'an data. Make sure your phone has enough storage, then try again.",
  'quran.retry': 'Try again',
  'quran.translation_note': 'Translation in Indonesian by the Indonesian Ministry of Religious Affairs (2019 edition)',
  'quran.source': 'Source: {source}',
};
