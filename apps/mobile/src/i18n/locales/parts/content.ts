// Teks bahasa untuk: Jadwal, tuntunan, doa, notifikasi jadwal.
// Kunci wajib berawalan 'content.' agar tidak bentrok dengan bagian lain.
// contentEn wajib punya kunci yang persis sama (dipaksa tipe + server/tests/i18n.test.ts).
// Catatan: hanya "chrome" aplikasi; isi dari server (langkah tuntunan, arti doa, judul jadwal) tidak diterjemahkan di sini.

export const contentId = {
  // Jadwal
  'content.schedule_title': 'Jadwal & agenda',
  'content.schedule_sub_group': 'Rangkaian ibadah {group}.',
  'content.schedule_sub': 'Rangkaian ibadah rombongan.',
  'content.schedule_close': 'Tutup',
  'content.schedule_add': 'Tambah Jadwal',
  'content.schedule_ph_title': 'Judul agenda',
  'content.schedule_ph_location': 'Lokasi',
  'content.schedule_time_label': 'Waktu mulai',
  'content.schedule_required': 'Judul dan waktu wajib diisi',
  'content.schedule_failed': 'Gagal',
  'content.schedule_save': 'Simpan',
  'content.schedule_empty': 'Belum ada jadwal untuk rombongan Anda. Jadwal muncul di sini setelah muthawwif menambahkannya.',
  'content.status_done': 'Selesai',
  'content.status_active': 'Hari ini',
  'content.status_upcoming': 'Nanti',

  // Tuntunan ibadah
  'content.guide_title': 'Tuntunan ibadah',
  'content.guide_sub': 'Panduan langkah demi langkah, urut & jelas.',
  'content.tab_umrah': 'Umrah',
  'content.tab_hajj': 'Haji',
  'content.tab_ziyarah': 'Ziarah',
  'content.guide_steps_count': '{count} tahap · ketuk untuk membuka langkah & doa',
  'content.guide_prayer_label': 'DOA SAAT {title}',
  'content.ziyarah_tips': 'TIPS',
  'content.ziyarah_empty': 'Belum ada tempat ziarah yang ditambahkan admin travel Anda.',
  'content.guide_empty': 'Belum ada tuntunan untuk bagian ini. Admin travel Anda dapat menambahkannya.',
  'content.dua_empty': 'Belum ada doa yang ditambahkan admin travel Anda.',

  // Doa
  'content.dua_title': 'Doa & bacaan',
  'content.dua_sub': 'Arab, latin, dan terjemahannya.',

  // Notifikasi pengingat jadwal
  'content.notif_reminder_title': 'Agenda segera dimulai',
  'content.notif_reminder_body': '{title}{location} dalam 30 menit',

  // Nama kanal notifikasi Android
  'content.channel_default': 'Default',
  'content.channel_sos': 'SOS Darurat',
  'content.channel_chat': 'Pesan Rombongan',
  'content.channel_geofence': 'Peringatan Miqat',
} as const;

export const contentEn: Record<keyof typeof contentId, string> = {
  'content.schedule_title': 'Schedule & agenda',
  'content.schedule_sub_group': 'Worship itinerary for {group}.',
  'content.schedule_sub': "Your group's worship itinerary.",
  'content.schedule_close': 'Close',
  'content.schedule_add': 'Add Schedule',
  'content.schedule_ph_title': 'Agenda title',
  'content.schedule_ph_location': 'Location',
  'content.schedule_time_label': 'Start time',
  'content.schedule_required': 'Title and time are required',
  'content.schedule_failed': 'Failed',
  'content.schedule_save': 'Save',
  'content.schedule_empty': 'No schedule for your group yet. It appears here once your muthawwif adds it.',
  'content.status_done': 'Done',
  'content.status_active': 'Today',
  'content.status_upcoming': 'Upcoming',

  'content.guide_title': 'Worship guide',
  'content.guide_sub': 'Step-by-step guidance, in order & clear.',
  'content.tab_umrah': 'Umrah',
  'content.tab_hajj': 'Hajj',
  'content.tab_ziyarah': 'Ziyarah',
  'content.guide_steps_count': "{count} stages · tap to open steps & du'a",
  'content.guide_prayer_label': "DU'A FOR {title}",
  'content.ziyarah_tips': 'TIPS',
  'content.ziyarah_empty': 'Your travel admin has not added any ziyarah places yet.',
  'content.guide_empty': 'No guide for this section yet. Your travel admin can add one.',
  'content.dua_empty': 'Your travel admin has not added any duas yet.',

  'content.dua_title': "Du'a & recitations",
  'content.dua_sub': 'Arabic, transliteration, and translation.',

  'content.notif_reminder_title': 'Agenda starting soon',
  'content.notif_reminder_body': '{title}{location} in 30 minutes',

  'content.channel_default': 'Default',
  'content.channel_sos': 'Emergency SOS',
  'content.channel_chat': 'Group Messages',
  'content.channel_geofence': 'Miqat Alerts',
};
