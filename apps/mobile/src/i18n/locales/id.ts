// Bahasa Indonesia — sumber kunci. File bahasa lain wajib punya kunci yang sama
// (dipaksa oleh tipe TranslationKey + tes server/tests/i18n.test.ts).
// Teks Arab tidak pernah masuk ke sini: tulisan Arab tidak berubah mengikuti bahasa.

export const id = {
  // Bahasa
  'lang.label': 'Bahasa',
  'lang.id': 'Indonesia',
  'lang.en': 'English',

  // Login
  'login.tagline': 'Panduan haji & umrah',
  'login.phone': 'Nomor HP',
  'login.password': 'Password',
  'login.password_placeholder': 'Masukkan password',
  'login.show_password': 'Tampilkan password',
  'login.hide_password': 'Sembunyikan password',
  'login.submit': 'Masuk',
  'login.required': 'Nomor HP dan password wajib diisi',
  'login.failed': 'Login gagal',
  'login.footer': 'Hubungi admin rombongan untuk mendapatkan akun.',

  // Menu bawah
  'nav.home': 'Beranda',
  'nav.map': 'Peta',
  'nav.guide': 'Ibadah',
  'nav.doa': 'Doa',
  'nav.schedule': 'Jadwal',

  // Mode
  'mode.jamaah': 'Jamaah',
  'mode.muthawwif': 'Muthawwif',
  'mode.muthawwif_title': 'Mode Muthawwif',

  // Beranda
  'home.greeting': "Assalamu'alaikum,",
  'home.hi': 'Hai, {name}',
  'home.ihram_status': 'STATUS IHRAM',
  'home.in_ihram': 'Sudah berihram',
  'home.not_ihram': 'Belum berihram',
  'home.badge_active': 'AKTIF',
  'home.badge_prepare': 'SIAPKAN',
  'home.nearest_miqat': 'MIQAT TERDEKAT',
  'home.waiting_gps': 'Menunggu GPS',
  'home.distance': 'JARAK KE BATAS',
  'home.open_miqat_map': 'Buka peta batas miqat',
  'home.next_agenda': 'Agenda berikutnya',
  'home.see_all': 'Lihat semua ›',
  'home.your_group': 'Rombongan kamu',
  'home.members': '{count} anggota',
  'home.muthawwif': 'Muthawwif: {name}',

  // Menu cepat
  'quick.guide': 'Tuntunan',
  'quick.doa': 'Doa',
  'quick.schedule': 'Jadwal',
  'quick.tools': 'Alat Ibadah',

  // Tanggal — singkatan bulan, dipisah koma (Jan..Des)
  'date.months_short': 'JAN,FEB,MAR,APR,MEI,JUN,JUL,AGU,SEP,OKT,NOV,DES',

  // Peringatan miqat
  'miqat.warn_title': 'Pakai ihram sekarang',
  'miqat.warn_sub': 'Batas miqat tinggal {distance} lagi',
  'miqat.ready_title': 'Kamu sudah berihram',
  'miqat.ready_sub': 'Niat umrah sudah dilafalkan',
  'miqat.approach_title': 'Menuju miqat',
  'miqat.approach_sub': 'Belum berihram · masih aman',
  'miqat.distance_label': 'Jarak ke garis miqat',
  'miqat.notif_title': 'Pakai ihram sekarang!',
  'miqat.notif_body': 'Kamu {km} km dari batas miqat {miqat}. Berihram & niat sebelum melewati garis.',

  // Angka
  'number.decimal_sep': ',',

  // Berbagi lokasi (izin & notifikasi layanan latar belakang)
  'loc.consent_title': 'Bagikan lokasi ke muthawwif',
  'loc.consent_body': 'Mabrur membagikan lokasi Anda hanya kepada muthawwif rombongan Anda, termasuk saat aplikasi ditutup, agar Anda tidak tertinggal dan cepat ditemukan bila terpisah. Lokasi juga dipakai untuk peringatan miqat.',
  'loc.consent_hint': 'Pada layar berikutnya pilih "Izinkan sepanjang waktu".',
  'loc.later': 'Nanti',
  'loc.continue': 'Lanjutkan',
  'loc.denied_title': 'Izin lokasi belum diberikan',
  'loc.denied_body': 'Buka Pengaturan → Izin → Lokasi, lalu pilih "Izinkan sepanjang waktu" agar posisi Anda terpantau muthawwif.',
  'loc.open_settings': 'Buka Pengaturan',
  'loc.gps_off_title': 'GPS mati',
  'loc.gps_off_body': 'Nyalakan GPS/Lokasi di HP Anda agar posisi Anda terpantau rombongan.',
  'loc.active_title': 'Lokasi aktif',
  'loc.active_body': 'Terima kasih, posisi Anda kini terpantau muthawwif rombongan.',
  'loc.service_body': 'Lokasi dibagikan ke muthawwif rombongan & untuk peringatan miqat',

  // SOS
  'sos.header_label': 'BANTUAN DARURAT',
  'sos.title': 'SOS',
  'sos.sent_title': 'Sinyal darurat terkirim',
  'sos.sent_sub': 'Muthawwif & petugas kloter menerima lokasi kamu secara real-time. Tetap di tempat bila memungkinkan.',
  'sos.sharing': 'Lokasi sedang dibagikan',
  'sos.cancel': 'Batalkan SOS',
  'sos.instruction': 'Pilih jenis keadaan darurat, lalu tekan tombol SOS.',
  'sos.cat.medis': 'Medis',
  'sos.cat.tersesat': 'Tersesat',
  'sos.cat.kehilangan': 'Kehilangan',
  'sos.photo_attached': 'Foto terlampir',
  'sos.photo_optional': 'Ambil foto (opsional)',
  'sos.send': 'Kirim SOS sekarang',
  'sos.send_sub': 'Lokasi kamu akan dibagikan',
  'sos.contact_muthawwif': 'Muthawwif',
  'sos.emergency': 'Darurat {number}',
  'sos.hide': 'Sembunyikan',
  'sos.history': 'Riwayat SOS ({count})',
  'sos.status.active': 'Aktif',
  'sos.status.resolved': 'Selesai',
  'sos.status.cancelled': 'Dibatalkan',
  'sos.med_card': 'Kartu identitas & medis',
  'sos.med.name': 'NAMA',
  'sos.med.kloter': 'KLOTER',
  'sos.med.blood': 'GOL. DARAH',
  'sos.med.passport': 'NO. PASPOR',
  'sos.med.history': 'RIWAYAT MEDIS',
  'sos.err.title': 'Gagal',
  'sos.err.send': 'Tidak dapat mengirim SOS',
  'sos.err.cancel': 'Tidak dapat membatalkan SOS',
  'sos.err.no_number_title': 'Nomor tidak tersedia',
  'sos.err.no_number': 'Kontak muthawwif belum tersinkron. Coba buka menu grup saat online.',
  'sos.err.phone': 'Tidak dapat membuka aplikasi telepon.',

  // Kurs
  'kurs.from': 'Dari',
  'kurs.to': 'Ke',
  'kurs.swap': 'Tukar arah konversi',
  'kurs.amount_placeholder': 'Jumlah {code}',
  'kurs.rate_line': '1 {from} = {rate} {to}',
  'kurs.updated': 'Kurs diperbarui {time}',
  'kurs.offline': 'Offline — memakai kurs tersimpan terakhir',
  'kurs.fallback': 'Kurs perkiraan: sumber kurs belum dapat dihubungi',
  'kurs.no_data': 'Kurs belum tersedia. Sambungkan internet sekali untuk mengunduh kurs.',
  'kurs.disclaimer': 'Kurs bersifat indikatif. Kurs di tempat penukaran uang bisa berbeda.',
  'kurs.attribution': 'Sumber kurs: Exchange Rate API (open.er-api.com)',
  'kurs.select_title': 'Pilih mata uang',
  'kurs.search': 'Cari nama atau kode (mis. USD, Ringgit)',

  // Profil
  'profile.title': 'Profil',
  'profile.edit': 'Edit Profil',
  'profile.stats': 'Statistik Perjalanan',
  'profile.change_password': 'Ganti Password',
  'profile.logout': 'Keluar',

  // Umum
  'common.save': 'Simpan',
  'common.cancel': 'Batal',
  'common.loading': 'Memuat...',
} as const;

export type TranslationKey = keyof typeof id;
