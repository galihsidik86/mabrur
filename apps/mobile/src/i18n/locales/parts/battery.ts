// Teks bahasa untuk: petunjuk hemat baterai agar notifikasi tidak tertahan (BatteryHint).
// Kunci wajib berawalan 'battery.'. batteryEn wajib punya kunci yang persis sama.
// Nama menu berbeda antarversi Android — langkah ditulis sebagai arah umum, bukan jalur pasti.

export const batteryId = {
  'battery.section': 'Notifikasi & baterai',
  'battery.title': 'Notifikasi tidak muncul saat aplikasi ditutup?',
  'battery.body': 'Sebagian HP menahan aplikasi di latar belakang untuk menghemat baterai, sehingga pesan, SOS, dan lokasi rombongan bisa terlambat. Ubah pengaturan berikut sekali saja:',
  'battery.show_steps': 'Lihat caranya',
  'battery.dismiss': 'Tutup',
  'battery.open_battery': 'Buka pengaturan baterai',
  'battery.open_app': 'Buka pengaturan aplikasi',
  'battery.open_failed': 'Pengaturan tidak bisa dibuka otomatis. Buka lewat aplikasi Pengaturan di HP.',
  'battery.steps.xiaomi': '1. Pengaturan → Aplikasi → Kelola aplikasi → Mabrur.\n2. Nyalakan Mulai otomatis (Autostart).\n3. Penghemat baterai → pilih Tanpa batasan.',
  'battery.steps.oppo': '1. Pengaturan → Aplikasi → Manajemen aplikasi → Mabrur.\n2. Penggunaan baterai → izinkan Aktivitas latar belakang dan Mulai otomatis.\n3. Matikan pengoptimalan baterai untuk Mabrur.',
  'battery.steps.vivo': '1. Pengaturan → Baterai → Konsumsi daya latar belakang tinggi → nyalakan Mabrur.\n2. Pengaturan → Aplikasi → Mulai otomatis → nyalakan Mabrur.',
  'battery.steps.samsung': '1. Pengaturan → Aplikasi → Mabrur → Baterai → pilih Tidak dibatasi.\n2. Perawatan perangkat → Baterai → Batas penggunaan latar belakang: pastikan Mabrur tidak ada di daftar Aplikasi tidur.',
  'battery.steps.huawei': '1. Pengaturan → Baterai → Peluncuran aplikasi → Mabrur.\n2. Matikan Kelola otomatis, lalu nyalakan Peluncuran otomatis, Peluncuran sekunder, dan Jalankan di latar belakang.',
  'battery.steps.generic': '1. Pengaturan → Aplikasi → Mabrur → Baterai → pilih Tidak dibatasi atau Jangan optimalkan.\n2. Pastikan notifikasi Mabrur diizinkan, termasuk Pesan Rombongan dan SOS Darurat.',
} as const;

export const batteryEn: Record<keyof typeof batteryId, string> = {
  'battery.section': 'Notifications & battery',
  'battery.title': 'Notifications not showing when the app is closed?',
  'battery.body': 'Some phones pause apps in the background to save battery, so messages, SOS alerts and group locations may arrive late. Change these settings once:',
  'battery.show_steps': 'Show me how',
  'battery.dismiss': 'Close',
  'battery.open_battery': 'Open battery settings',
  'battery.open_app': 'Open app settings',
  'battery.open_failed': 'Settings could not be opened automatically. Open them from your phone\'s Settings app.',
  'battery.steps.xiaomi': '1. Settings → Apps → Manage apps → Mabrur.\n2. Turn on Autostart.\n3. Battery saver → choose No restrictions.',
  'battery.steps.oppo': '1. Settings → Apps → App management → Mabrur.\n2. Battery usage → allow Background activity and Auto launch.\n3. Turn off battery optimization for Mabrur.',
  'battery.steps.vivo': '1. Settings → Battery → High background power consumption → turn on Mabrur.\n2. Settings → Apps → Autostart → turn on Mabrur.',
  'battery.steps.samsung': '1. Settings → Apps → Mabrur → Battery → choose Unrestricted.\n2. Device care → Battery → Background usage limits: make sure Mabrur is not in Sleeping apps.',
  'battery.steps.huawei': '1. Settings → Battery → App launch → Mabrur.\n2. Turn off Manage automatically, then turn on Auto-launch, Secondary launch and Run in background.',
  'battery.steps.generic': '1. Settings → Apps → Mabrur → Battery → choose Unrestricted or Don\'t optimize.\n2. Make sure Mabrur notifications are allowed, including Group Messages and Emergency SOS.',
};
