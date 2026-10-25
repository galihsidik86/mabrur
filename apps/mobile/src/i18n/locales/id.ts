// Bahasa Indonesia — sumber kunci. File bahasa lain wajib punya kunci yang sama
// (dipaksa oleh tipe TranslationKey + tes server/tests/i18n.test.ts).
// Teks Arab tidak pernah masuk ke sini: tulisan Arab tidak berubah mengikuti bahasa.
import { toolsId } from './parts/tools';
import { monitorId } from './parts/monitor';
import { accountId } from './parts/account';
import { contentId } from './parts/content';
import { prayerId } from './parts/prayer';
import { quranId } from './parts/quran';
import { documentationId } from './parts/documentation';
import { batteryId } from './parts/battery';

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
  'nav.guide': 'Tuntunan',
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
  'quick.tools': 'Alat Ibadah',
  'quick.prayer': 'Salat & Kiblat',
  'quick.quran': "Al-Qur'an",
  'quick.documentation': 'Dokumentasi',

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
  'sos.photo_failed': 'Foto gagal terkirim karena sinyal lemah. SOS tetap terkirim tanpa foto.',
  'sos.no_location': 'Lokasi kamu belum terbaca GPS saat SOS dikirim. Sebutkan posisimu saat muthawwif menghubungi.',
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

  // Frasa Arab
  'phrase.empty': 'Frasa belum tersedia. Sambungkan internet sekali untuk mengunduh daftar frasa.',
  'phrase.cat.salam': 'Salam & sopan santun',
  'phrase.cat.arah': 'Arah & tempat',
  'phrase.cat.transportasi': 'Transportasi',
  'phrase.cat.belanja': 'Belanja',
  'phrase.cat.darurat': 'Darurat',
  'phrase.cat.makanan': 'Makanan & minuman',
  'phrase.listen': 'Dengarkan pengucapan',
  'phrase.stop': 'Hentikan suara',
  'phrase.audio_note': 'Suara dibacakan mesin suara HP (bukan rekaman ustaz). Ketuk ikon speaker untuk mendengar.',
  'phrase.no_voice_title': 'Suara Arab belum terpasang',
  'phrase.no_voice_body': 'HP ini belum punya suara bahasa Arab. Pasang lewat Pengaturan → Text-to-speech → bahasa Arab (perlu internet sekali untuk mengunduh), lalu coba lagi.',
  'phrase.open_tts': 'Buka pengaturan suara',

  // Kartu Taksi
  'sos.taxi_card': 'Kartu Taksi',
  'sos.taxi_card_sub': 'Tunjukkan alamat hotel ke sopir atau polisi',
  'taxi.title': 'Kartu Taksi',
  'taxi.subtitle': 'Tunjukkan layar ini ke sopir taksi atau polisi',
  'taxi.emergency_title': 'Nomor darurat Arab Saudi',
  'taxi.emergency.unified': 'Darurat',
  'taxi.emergency.police': 'Polisi',
  'taxi.emergency.ambulance': 'Ambulans',
  'taxi.emergency.fire': 'Pemadam',
  'taxi.leader_title': 'Muthawwif / ketua rombongan',
  'taxi.call': 'Telepon',
  'taxi.whatsapp': 'WhatsApp',
  'taxi.whatsapp_failed': 'Tidak dapat membuka WhatsApp.',
  'taxi.city.makkah': 'Hotel Makkah',
  'taxi.city.madinah': 'Hotel Madinah',
  'taxi.hotel_phone': 'Telepon hotel',
  'taxi.room_line': 'Kamar {room} · Rombongan: {group}',
  'taxi.group_line': 'Rombongan: {group}',
  'taxi.choose_phrase': 'Pilih kalimat yang ditampilkan di kartu',
  'taxi.phrase.take_me': 'Tolong antar saya ke hotel ini',
  'taxi.phrase.lost': 'Saya jamaah umroh dan tersesat dari rombongan. Mohon bantu saya sampai ke hotel ini atau hubungi ketua rombongan',
  'taxi.phrase.call': 'Tolong hubungi nomor ini',
  'taxi.phrase.medical': 'Saya butuh bantuan medis',
  'taxi.missing': 'Data kartu belum lengkap ({fields}). Hubungi muthawwif Anda. Kalimat dan nomor darurat tetap bisa dipakai.',
  'taxi.missing.hotel': 'hotel',
  'taxi.missing.hotel_phone': 'telepon hotel',
  'taxi.missing.room': 'nomor kamar',
  'taxi.missing.leader': 'kontak muthawwif',
  'taxi.offline': 'Offline — memakai data kartu yang tersimpan terakhir',
  'taxi.no_group': 'Anda belum terdaftar di rombongan. Hubungi admin travel Anda.',

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
  'common.back': 'Kembali',
  'common.close': 'Tutup',
  'common.pick_datetime': 'Ketuk untuk memilih tanggal & jam',
  'a11y.chat': 'Chat rombongan',
  'a11y.chat_unread': 'Chat rombongan, {count} pesan belum dibaca',
  'a11y.profile': 'Profil',
  'a11y.show_password': 'Tampilkan password',
  'a11y.hide_password': 'Sembunyikan password',
  'a11y.upload_session': 'Unggah sesi {label}',
  'a11y.share_session': 'Bagikan sesi {label}',
  'a11y.delete_session': 'Hapus sesi {label}',
  'a11y.rating_star': '{n} bintang',
  'a11y.undo_stone': 'Kurangi satu lemparan',
  'a11y.checklist_add': 'Tambah ke daftar',
  'a11y.checklist_delete': 'Hapus {item}',
  'a11y.tools_menu': 'Kembali ke menu alat',
  'a11y.voice_stop': 'Hentikan siaran suara',
  'common.retry': 'Coba lagi',
  'common.load_failed': 'Gagal memuat. Periksa koneksi internet, lalu coba lagi.',
  'common.no_group': 'Anda belum terdaftar di rombongan. Hubungi admin travel atau muthawwif Anda.',
  'common.failed_title': 'Gagal',
  'common.offline_saved': 'Tidak tersambung ke server. Perubahan disimpan di HP dan belum terkirim.',

  // Bagian per fitur (locales/parts/*)
  ...toolsId,
  ...monitorId,
  ...accountId,
  ...contentId,
  ...prayerId,
  ...quranId,
  ...documentationId,
  ...batteryId,
} as const;

export type TranslationKey = keyof typeof id;
