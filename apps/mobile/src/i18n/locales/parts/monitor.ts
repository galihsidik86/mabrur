// Teks bahasa untuk: Peta & dashboard muthawwif (peta.tsx, MuthawwifDashboard.tsx, tracking-label.ts).
// Kunci wajib berawalan 'monitor.' agar tidak bentrok dengan bagian lain.
// monitorEn wajib punya kunci yang persis sama (dipaksa tipe + server/tests/i18n.test.ts).

export const monitorId = {
  // Label status lokasi (tracking-label.ts)
  'monitor.seen_just_now': 'baru saja',
  'monitor.seen_minutes_ago': '{minutes} mnt lalu',
  'monitor.seen_at_time': 'pukul {hh}.{mm}',
  'monitor.seen_at_date': '{dd}/{mo} {hh}.{mm}',
  'monitor.status_tracked': 'Terpantau · {seen}',
  'monitor.status_stale': 'Terakhir terlihat {seen}',
  'monitor.status_none': 'Belum ada lokasi',
  'monitor.from_muthawwif': '{distance} dari muthawwif',
  'monitor.from_place': '{distance} dari {place}',

  // Peta: tab
  'monitor.tab_miqat': 'Miqat',
  'monitor.tab_map': 'Peta',
  'monitor.tab_arafah': 'Arafah',
  'monitor.tab_monitor': 'Monitor',
  'monitor.your_position': 'Posisi Anda',

  // Peta: izin & miqat
  'monitor.perm_title': 'Izin Lokasi',
  'monitor.perm_body': 'Mabrur memerlukan akses lokasi untuk fitur geofence miqat.',
  'monitor.popup_radius': 'Radius: {meters}m',
  'monitor.nearest_miqat': 'Miqat terdekat: {name}',
  'monitor.miqat_boundary_caps': 'BATAS MIQAT',
  'monitor.legend_miqat': 'Batas miqat',
  'monitor.legend_haram': 'Tanah Haram',
  'monitor.progress_miqat': 'Miqat',
  'monitor.progress_journey': 'Perjalanan menuju batas',
  'monitor.ihram_cancel': 'Batalkan status ihram',
  'monitor.ihram_confirm': 'Saya sudah berihram & berniat',
  'monitor.haram_rules_title': 'Batas & larangan Tanah Haram',
  'monitor.haram_rule_hunt': 'Di dalam Tanah Haram dilarang berburu & membunuh binatang liar.',
  'monitor.haram_rule_plants': 'Dilarang menebang pohon atau mencabut tanaman yang tumbuh sendiri.',
  'monitor.haram_rule_ihram': 'Selama ihram: tidak memakai wangi-wangian, memotong rambut/kuku, atau menikah.',

  // Peta: Arafah
  'monitor.namirah_marker': 'Masjid Namirah (batas rawan!)',
  'monitor.arafah_polygon': 'Batas Padang Arafah — wukuf sah di dalam area ini',
  'monitor.arafah_title': 'Area Wukuf Arafah',
  'monitor.arafah_line_area': 'Area hijau = batas Padang Arafah. Wukuf HANYA sah di dalam area ini.',
  'monitor.arafah_line_namirah': '🕌 Masjid Namirah: sebagian di luar Arafah — hati-hati!',
  'monitor.arafah_line_tool': 'Gunakan fitur Wukuf di Alat Ibadah untuk monitoring posisi real-time.',

  // Peta: Monitor (muthawwif)
  'monitor.tracked_count': '{tracked} dari {total} jamaah terpantau',
  'monitor.map_legend': '🟢 Aman · 🔴 Perlu perhatian · 🟤 Lokasi lama (posisi terakhir) · Diperbarui tiap 15 detik',
  'monitor.no_location_count': 'Belum ada lokasi ({count})',
  'monitor.no_location_hint': 'Kirim pengingat dari daftar Status rombongan di Beranda.',

  // Dashboard muthawwif
  'monitor.stat_total': 'Total jamaah',
  'monitor.stat_tracked': 'Terpantau',
  'monitor.stat_untracked': 'Tidak terpantau',
  'monitor.sending': 'Mengirim…',
  'monitor.remind_all': 'Ingatkan {count} jamaah untuk aktifkan lokasi',
  'monitor.group_status': 'Status rombongan',
  'monitor.open_on_map_hint': 'Buka posisi di peta',
  'monitor.remind_member_label': 'Kirim pengingat lokasi ke {name}',
  'monitor.chip_attention': 'Perhatian',
  'monitor.chip_safe': 'Aman',
  'monitor.empty_members': 'Belum ada data anggota',
  'monitor.reminder_title': 'Pengingat lokasi',
  'monitor.reminder_sent': '{count} pengingat terkirim.',
  'monitor.reminder_cooldown': '{count} jamaah baru saja diingatkan (tunggu 5 menit).',
  'monitor.reminder_no_token': '{count} jamaah tidak bisa menerima notifikasi (belum login di aplikasi atau notifikasi dimatikan). Hubungi lewat telepon/WhatsApp.',
  'monitor.reminder_failed_title': 'Gagal mengirim',
  'monitor.reminder_failed_body': 'Pengingat tidak terkirim. Periksa koneksi internet lalu coba lagi.',
  'monitor.member_no_location': 'Belum ada lokasi dari jamaah ini. Kirim pengingat untuk mengaktifkan GPS & izin lokasi?',
  'monitor.send_reminder': 'Kirim pengingat',

  // Dashboard muthawwif: kartu SOS
  'monitor.sos_title': 'SOS DARURAT',
  'monitor.sos_minutes_ago': '{minutes} menit lalu',
  'monitor.sos_view_location': 'Lihat Lokasi',
  'monitor.sos_no_gps': 'Lokasi GPS tidak tersedia',
  'monitor.sos_no_phone': 'Nomor HP tidak tersedia',
  'monitor.sos_call': 'Telepon',
  'monitor.sos_resolve': 'Selesai',
  'monitor.sos_resolve_title': 'Selesaikan SOS',
  'monitor.sos_resolve_confirm': 'Yakin SOS dari {name} sudah ditangani?',
  'monitor.sos_resolve_yes': 'Ya, Selesai',
  'monitor.sos_wa_message': 'Assalamualaikum {name}, kami menerima sinyal SOS ({category}) dari Anda. Apakah Anda baik-baik saja? Kami sedang menuju lokasi Anda.',
} as const;

export const monitorEn: Record<keyof typeof monitorId, string> = {
  // Location status labels (tracking-label.ts)
  'monitor.seen_just_now': 'just now',
  'monitor.seen_minutes_ago': '{minutes} min ago',
  'monitor.seen_at_time': 'at {hh}:{mm}',
  'monitor.seen_at_date': '{dd}/{mo} {hh}:{mm}',
  'monitor.status_tracked': 'Tracked · {seen}',
  'monitor.status_stale': 'Last seen {seen}',
  'monitor.status_none': 'No location yet',
  'monitor.from_muthawwif': '{distance} from muthawwif',
  'monitor.from_place': '{distance} from {place}',

  // Map: tabs
  'monitor.tab_miqat': 'Miqat',
  'monitor.tab_map': 'Map',
  'monitor.tab_arafah': 'Arafah',
  'monitor.tab_monitor': 'Monitor',
  'monitor.your_position': 'Your position',

  // Map: permission & miqat
  'monitor.perm_title': 'Location Permission',
  'monitor.perm_body': 'Mabrur needs location access for the miqat geofence feature.',
  'monitor.popup_radius': 'Radius: {meters}m',
  'monitor.nearest_miqat': 'Nearest miqat: {name}',
  'monitor.miqat_boundary_caps': 'MIQAT BOUNDARY',
  'monitor.legend_miqat': 'Miqat boundary',
  'monitor.legend_haram': 'Haram boundary',
  'monitor.progress_miqat': 'Miqat',
  'monitor.progress_journey': 'Journey to the boundary',
  'monitor.ihram_cancel': 'Cancel ihram status',
  'monitor.ihram_confirm': "I'm in ihram & have made my intention",
  'monitor.haram_rules_title': 'Haram boundary & prohibitions',
  'monitor.haram_rule_hunt': 'Inside the Haram, hunting and killing wild animals is forbidden.',
  'monitor.haram_rule_plants': 'Cutting trees or uprooting plants that grow on their own is forbidden.',
  'monitor.haram_rule_ihram': 'While in ihram: no perfume, no cutting hair/nails, and no marriage.',

  // Map: Arafah
  'monitor.namirah_marker': 'Namirah Mosque (critical boundary!)',
  'monitor.arafah_polygon': 'Arafah plain boundary — wukuf is valid inside this area',
  'monitor.arafah_title': 'Arafah Wukuf Area',
  'monitor.arafah_line_area': 'Green area = Arafah plain boundary. Wukuf is ONLY valid inside this area.',
  'monitor.arafah_line_namirah': '🕌 Namirah Mosque: partly outside Arafah — be careful!',
  'monitor.arafah_line_tool': 'Use the Wukuf feature in Worship Tools for real-time position monitoring.',

  // Map: Monitor (muthawwif)
  'monitor.tracked_count': '{tracked} of {total} pilgrims tracked',
  'monitor.map_legend': '🟢 Safe · 🔴 Needs attention · 🟤 Old location (last position) · Updated every 15 seconds',
  'monitor.no_location_count': 'No location yet ({count})',
  'monitor.no_location_hint': 'Send a reminder from the Group status list on Home.',

  // Muthawwif dashboard
  'monitor.stat_total': 'Total pilgrims',
  'monitor.stat_tracked': 'Tracked',
  'monitor.stat_untracked': 'Not tracked',
  'monitor.sending': 'Sending…',
  'monitor.remind_all': 'Remind {count} pilgrims to turn on location',
  'monitor.group_status': 'Group status',
  'monitor.open_on_map_hint': 'Open position on the map',
  'monitor.remind_member_label': 'Send location reminder to {name}',
  'monitor.chip_attention': 'Attention',
  'monitor.chip_safe': 'Safe',
  'monitor.empty_members': 'No member data yet',
  'monitor.reminder_title': 'Location reminder',
  'monitor.reminder_sent': '{count} reminders sent.',
  'monitor.reminder_cooldown': '{count} pilgrims were just reminded (wait 5 minutes).',
  'monitor.reminder_no_token': "{count} pilgrims can't receive notifications (not logged in to the app or notifications turned off). Contact them by phone/WhatsApp.",
  'monitor.reminder_failed_title': 'Failed to send',
  'monitor.reminder_failed_body': 'The reminder was not sent. Check your internet connection and try again.',
  'monitor.member_no_location': 'No location from this pilgrim yet. Send a reminder to turn on GPS & location permission?',
  'monitor.send_reminder': 'Send reminder',

  // Muthawwif dashboard: SOS card
  'monitor.sos_title': 'EMERGENCY SOS',
  'monitor.sos_minutes_ago': '{minutes} minutes ago',
  'monitor.sos_view_location': 'View Location',
  'monitor.sos_no_gps': 'GPS location not available',
  'monitor.sos_no_phone': 'Phone number not available',
  'monitor.sos_call': 'Call',
  'monitor.sos_resolve': 'Resolve',
  'monitor.sos_resolve_title': 'Resolve SOS',
  'monitor.sos_resolve_confirm': 'Are you sure the SOS from {name} has been handled?',
  'monitor.sos_resolve_yes': 'Yes, Resolved',
  'monitor.sos_wa_message': 'Assalamualaikum {name}, we received an SOS signal ({category}) from you. Are you okay? We are on our way to your location.',
};
