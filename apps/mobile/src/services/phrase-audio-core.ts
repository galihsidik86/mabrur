// Pemilihan suara Arab untuk tombol dengar frasa (Permintaan 3, opsional).
// Modul murni tanpa impor Expo — dites dari server/tests.

export interface VoiceInfo {
  identifier: string;
  language: string;
}

/** Bahasa yang dikirim ke mesin TTS bila HP tidak melaporkan daftar suara. */
export const ARABIC_FALLBACK_LANGUAGE = 'ar-SA';

const isArabic = (language: string) => /^ar([-_]|$)/i.test(language);

/**
 * Suara Arab terbaik yang terpasang: ar-SA (logat Saudi, paling dekat dengan yang didengar
 * jamaah di Tanah Suci), lalu ar-* lain. null = HP tidak punya suara Arab.
 */
export function pickArabicVoice(voices: readonly VoiceInfo[]): VoiceInfo | null {
  const arabic = voices.filter((v) => isArabic(v.language));
  return arabic.find((v) => /^ar[-_]SA$/i.test(v.language)) ?? arabic[0] ?? null;
}

export type ArabicVoiceStatus = 'available' | 'missing' | 'unknown';

/**
 * Daftar suara kosong biasanya berarti mesin TTS belum siap (Android) — tetap dicoba bicara,
 * jangan langsung bilang "tidak ada suara Arab".
 */
export function arabicVoiceStatus(voices: readonly VoiceInfo[]): ArabicVoiceStatus {
  if (voices.length === 0) return 'unknown';
  return pickArabicVoice(voices) ? 'available' : 'missing';
}
