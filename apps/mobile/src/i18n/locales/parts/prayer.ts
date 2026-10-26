// Teks bahasa untuk: Waktu Salat & Kiblat (app/prayer.tsx, components/QiblaCompass.tsx).
// Kunci wajib berawalan 'prayer.' agar tidak bentrok dengan bagian lain.
// prayerEn wajib punya kunci yang persis sama (dipaksa tipe + server/tests/i18n.test.ts).
// Istilah Indonesia baku (KBBI): Subuh, Zuhur, Asar, Magrib — bukan istilah Melayu (Solat, Zohor, Syuruk).

export const prayerId = {
  'prayer.title': 'Waktu Salat & Kiblat',

  // Nama waktu
  'prayer.name.fajr': 'Subuh',
  'prayer.name.sunrise': 'Terbit',
  'prayer.name.dhuha': 'Dhuha',
  'prayer.name.dhuhr': 'Zuhur',
  'prayer.name.asr': 'Asar',
  'prayer.name.maghrib': 'Magrib',
  'prayer.name.isha': 'Isya',

  // Tanggal Hijriah
  'prayer.hijri_date': '{day} {month} {year} H',
  'prayer.hijri_month.1': 'Muharam',
  'prayer.hijri_month.2': 'Safar',
  'prayer.hijri_month.3': 'Rabiulawal',
  'prayer.hijri_month.4': 'Rabiulakhir',
  'prayer.hijri_month.5': 'Jumadilawal',
  'prayer.hijri_month.6': 'Jumadilakhir',
  'prayer.hijri_month.7': 'Rajab',
  'prayer.hijri_month.8': 'Syakban',
  'prayer.hijri_month.9': 'Ramadan',
  'prayer.hijri_month.10': 'Syawal',
  'prayer.hijri_month.11': 'Zulkaidah',
  'prayer.hijri_month.12': 'Zulhijah',

  // Lokasi
  'prayer.locating': 'Mencari lokasi…',
  'prayer.location_coords': 'Lokasi {lat}, {lng}',
  'prayer.location_unknown': 'Lokasi belum diketahui · waktu untuk Makkah',

  // Kartu waktu sekarang
  'prayer.now': 'Sekarang',
  'prayer.next_in': 'Salat berikutnya {duration} lagi',
  'prayer.duration_hm': '{h} j {m} mnt',
  'prayer.duration_m': '{m} mnt',

  // Kompas kiblat
  'prayer.compass_label': 'Kompas kiblat',
  'prayer.dir_n': 'U',
  'prayer.dir_e': 'T',
  'prayer.dir_s': 'S',
  'prayer.dir_w': 'B',
  'prayer.aligned': 'Tepat',
  'prayer.hint_aligned': 'Anda sudah menghadap kiblat.',
  'prayer.hint_turn_right': 'Putar perlahan ke kanan {deg}° hingga kedua penanda sejajar.',
  'prayer.hint_turn_left': 'Putar perlahan ke kiri {deg}° hingga kedua penanda sejajar.',
  'prayer.qibla_degrees': 'Kiblat {deg}° dari utara',
  'prayer.waiting_gps': 'Menunggu GPS untuk menghitung arah kiblat…',
  'prayer.no_compass': 'Kompas tidak tersedia di perangkat ini. Gunakan arah {deg}° dari utara.',
  'prayer.calibrate': 'Akurasi kompas rendah — gerakkan HP membentuk angka 8, jauhkan dari logam/magnet.',

  // Status muat
  'prayer.loading': 'Menghitung waktu salat…',
  'prayer.load_failed': 'Waktu salat belum bisa dimuat. Periksa koneksi internet lalu coba lagi.',
  'prayer.retry': 'Coba lagi',
  'prayer.offline_cached': 'Offline · memakai jadwal tersimpan ({date})',
  'prayer.method': 'Metode perhitungan: {method}',
  'prayer.dhuha_note': 'Awal Dhuha diperkirakan 20 menit setelah terbit.',
  'prayer.slot_label': '{name} pukul {time}',
  'prayer.slot_current': 'sedang berlaku',
} as const;

export const prayerEn: Record<keyof typeof prayerId, string> = {
  'prayer.title': 'Prayer Times & Qibla',

  // Prayer names
  'prayer.name.fajr': 'Fajr',
  'prayer.name.sunrise': 'Sunrise',
  'prayer.name.dhuha': 'Duha',
  'prayer.name.dhuhr': 'Dhuhr',
  'prayer.name.asr': 'Asr',
  'prayer.name.maghrib': 'Maghrib',
  'prayer.name.isha': 'Isha',

  // Hijri date
  'prayer.hijri_date': '{day} {month} {year} AH',
  'prayer.hijri_month.1': 'Muharram',
  'prayer.hijri_month.2': 'Safar',
  'prayer.hijri_month.3': "Rabi' al-Awwal",
  'prayer.hijri_month.4': "Rabi' al-Thani",
  'prayer.hijri_month.5': 'Jumada al-Ula',
  'prayer.hijri_month.6': 'Jumada al-Akhirah',
  'prayer.hijri_month.7': 'Rajab',
  'prayer.hijri_month.8': "Sha'ban",
  'prayer.hijri_month.9': 'Ramadan',
  'prayer.hijri_month.10': 'Shawwal',
  'prayer.hijri_month.11': "Dhu al-Qa'dah",
  'prayer.hijri_month.12': 'Dhu al-Hijjah',

  // Location
  'prayer.locating': 'Finding your location…',
  'prayer.location_coords': 'Location {lat}, {lng}',
  'prayer.location_unknown': 'Location unknown · times for Makkah',

  // Current prayer card
  'prayer.now': 'Now',
  'prayer.next_in': 'Next prayer in {duration}',
  'prayer.duration_hm': '{h}h {m}m',
  'prayer.duration_m': '{m} min',

  // Qibla compass
  'prayer.compass_label': 'Qibla compass',
  'prayer.dir_n': 'N',
  'prayer.dir_e': 'E',
  'prayer.dir_s': 'S',
  'prayer.dir_w': 'W',
  'prayer.aligned': 'Aligned',
  'prayer.hint_aligned': 'You are facing the Qibla.',
  'prayer.hint_turn_right': 'Turn slowly to the right {deg}° until both markers line up.',
  'prayer.hint_turn_left': 'Turn slowly to the left {deg}° until both markers line up.',
  'prayer.qibla_degrees': 'Qibla {deg}° from north',
  'prayer.waiting_gps': 'Waiting for GPS to calculate the Qibla direction…',
  'prayer.no_compass': 'No compass on this device. Use {deg}° from north.',
  'prayer.calibrate': 'Low compass accuracy — move your phone in a figure-8, away from metal/magnets.',

  // Loading state
  'prayer.loading': 'Calculating prayer times…',
  'prayer.load_failed': "Prayer times couldn't be loaded. Check your internet connection and try again.",
  'prayer.retry': 'Try again',
  'prayer.offline_cached': 'Offline · using saved schedule ({date})',
  'prayer.method': 'Calculation method: {method}',
  'prayer.dhuha_note': 'Duha is estimated to begin 20 minutes after sunrise.',
  'prayer.slot_label': '{name} at {time}',
  'prayer.slot_current': 'current',
};
