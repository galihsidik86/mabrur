// Templat push notification dalam bahasa penerima (users.language) — murni, bisa dites.
// Isi yang ditulis pengguna (nama, cuplikan chat) tidak diterjemahkan.

export type PushLang = 'id' | 'en';

const ID = {
  'sos.title': 'SOS Darurat',
  'sos.body': '{name} butuh bantuan ({category})',
  'sos.unknown_name': 'Jamaah',
  'sos.cat.medis': 'Medis',
  'sos.cat.tersesat': 'Tersesat',
  'sos.cat.kehilangan': 'Kehilangan',
  'reminder.title': 'Aktifkan lokasi Anda',
  'reminder.body': '{sender} meminta Anda menyalakan GPS & izin lokasi Mabrur agar posisi Anda terpantau rombongan. Ketuk untuk mengaktifkan.',
  'reminder.default_sender': 'Muthawwif',
} as const;

export type PushKey = keyof typeof ID;

const EN: Record<PushKey, string> = {
  'sos.title': 'Emergency SOS',
  'sos.body': '{name} needs help ({category})',
  'sos.unknown_name': 'A pilgrim',
  'sos.cat.medis': 'Medical',
  'sos.cat.tersesat': 'Lost',
  'sos.cat.kehilangan': 'Missing item',
  'reminder.title': 'Turn on your location',
  'reminder.body': '{sender} asks you to turn on GPS and location access for Mabrur so your group can see your position. Tap to turn it on.',
  'reminder.default_sender': 'Muthawwif',
};

export const PUSH_MESSAGES: Record<PushLang, Record<PushKey, string>> = { id: ID, en: EN };

export function pushLang(value: unknown): PushLang {
  return value === 'en' ? 'en' : 'id';
}

export function pushText(lang: PushLang, key: PushKey, params: Record<string, string> = {}): string {
  return PUSH_MESSAGES[lang][key].replace(/\{(\w+)\}/g, (m, name: string) => params[name] ?? m);
}

/** Kelompokkan token push per bahasa penerima (token unik, kosong dibuang). */
export function tokensByLang(
  recipients: Array<{ push_token: string | null; language: string | null }>,
): Map<PushLang, string[]> {
  const groups = new Map<PushLang, string[]>();
  const seen = new Set<string>();
  for (const r of recipients) {
    if (!r.push_token || seen.has(r.push_token)) continue;
    seen.add(r.push_token);
    const lang = pushLang(r.language);
    groups.set(lang, [...(groups.get(lang) ?? []), r.push_token]);
  }
  return groups;
}
