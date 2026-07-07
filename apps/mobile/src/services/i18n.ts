import { create } from 'zustand';

type Lang = 'id' | 'en' | 'ar';

const translations: Record<string, Record<Lang, string>> = {
  // Auth
  'login.title': { id: 'Masuk', en: 'Login', ar: 'تسجيل الدخول' },
  'login.phone': { id: 'Nomor HP', en: 'Phone Number', ar: 'رقم الهاتف' },
  'login.password': { id: 'Password', en: 'Password', ar: 'كلمة المرور' },
  'login.submit': { id: 'Masuk', en: 'Sign In', ar: 'دخول' },

  // Nav
  'nav.beranda': { id: 'Beranda', en: 'Home', ar: 'الرئيسية' },
  'nav.peta': { id: 'Peta', en: 'Map', ar: 'خريطة' },
  'nav.ibadah': { id: 'Ibadah', en: 'Worship', ar: 'عبادة' },
  'nav.doa': { id: 'Doa', en: 'Prayers', ar: 'دعاء' },
  'nav.jadwal': { id: 'Jadwal', en: 'Schedule', ar: 'جدول' },

  // Beranda
  'home.greeting': { id: "Assalamu'alaikum,", en: "Assalamu'alaikum,", ar: 'السلام عليكم،' },
  'home.ihram_status': { id: 'STATUS IHRAM', en: 'IHRAM STATUS', ar: 'حالة الإحرام' },
  'home.not_ihram': { id: 'Belum berihram', en: 'Not in ihram', ar: 'لم يحرم بعد' },
  'home.in_ihram': { id: 'Sudah berihram', en: 'In ihram', ar: 'محرم' },
  'home.nearest_miqat': { id: 'MIQAT TERDEKAT', en: 'NEAREST MIQAT', ar: 'أقرب ميقات' },
  'home.distance': { id: 'JARAK KE BATAS', en: 'DISTANCE TO BOUNDARY', ar: 'المسافة للحد' },
  'home.next_agenda': { id: 'Agenda berikutnya', en: 'Next agenda', ar: 'الأجندة التالية' },
  'home.your_group': { id: 'Rombongan kamu', en: 'Your group', ar: 'مجموعتك' },

  // Ibadah
  'ibadah.title': { id: 'Tuntunan ibadah', en: 'Worship Guide', ar: 'دليل العبادة' },
  'ibadah.umrah': { id: 'Umrah', en: 'Umrah', ar: 'عمرة' },
  'ibadah.haji': { id: 'Haji', en: 'Hajj', ar: 'حج' },
  'ibadah.ziarah': { id: 'Ziarah', en: 'Visit', ar: 'زيارة' },

  // Doa
  'doa.title': { id: 'Doa & bacaan', en: 'Prayers & Readings', ar: 'الأدعية والأذكار' },

  // Jadwal
  'jadwal.title': { id: 'Jadwal & agenda', en: 'Schedule & Agenda', ar: 'الجدول والأجندة' },

  // SOS
  'sos.title': { id: 'SOS', en: 'SOS', ar: 'طوارئ' },
  'sos.send': { id: 'Kirim SOS sekarang', en: 'Send SOS now', ar: 'أرسل طوارئ الآن' },
  'sos.sent': { id: 'Sinyal darurat terkirim', en: 'Emergency signal sent', ar: 'تم إرسال إشارة الطوارئ' },
  'sos.cancel': { id: 'Batalkan SOS', en: 'Cancel SOS', ar: 'إلغاء الطوارئ' },
  'sos.history': { id: 'Riwayat SOS', en: 'SOS History', ar: 'سجل الطوارئ' },

  // Profile
  'profile.title': { id: 'Profil', en: 'Profile', ar: 'الملف الشخصي' },
  'profile.edit': { id: 'Edit Profil', en: 'Edit Profile', ar: 'تعديل الملف' },
  'profile.stats': { id: 'Statistik Perjalanan', en: 'Journey Stats', ar: 'إحصائيات الرحلة' },
  'profile.change_password': { id: 'Ganti Password', en: 'Change Password', ar: 'تغيير كلمة المرور' },
  'profile.logout': { id: 'Keluar', en: 'Sign Out', ar: 'خروج' },

  // Chat
  'chat.title': { id: 'Chat Rombongan', en: 'Group Chat', ar: 'محادثة المجموعة' },
  'chat.placeholder': { id: 'Ketik pesan...', en: 'Type a message...', ar: '...اكتب رسالة' },

  // Common
  'common.save': { id: 'Simpan', en: 'Save', ar: 'حفظ' },
  'common.cancel': { id: 'Batal', en: 'Cancel', ar: 'إلغاء' },
  'common.loading': { id: 'Memuat...', en: 'Loading...', ar: '...جاري التحميل' },
  'common.coming_soon': { id: 'Segera hadir', en: 'Coming soon', ar: 'قريباً' },
};

interface I18nState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

export const useI18n = create<I18nState>((set, get) => ({
  lang: 'id',
  setLang: (lang: Lang) => set({ lang }),
  t: (key: string) => {
    const entry = translations[key];
    if (!entry) return key;
    return entry[get().lang] || entry.id || key;
  },
}));
