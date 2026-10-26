import { Alert } from 'react-native';
import { getMeta, setMeta } from './db';
import { discardPendingAutoSessions } from './trace-recorder';
import type { TFunction } from './i18n';

// Persetujuan jamaah untuk merekam & mengirim jejak GPS saat mode otomatis Tawaf/Sa'i
// (data uji akurasi). Disimpan per akun di sync_meta — ikut terhapus saat logout,
// jadi pengguna berikutnya di HP yang sama ditanya lagi.
const CONSENT_KEY = 'gps_trace_consent';

export type TraceConsent = 'granted' | 'denied' | null;

export async function getTraceConsent(): Promise<TraceConsent> {
  const v = await getMeta(CONSENT_KEY);
  return v === 'granted' || v === 'denied' ? v : null;
}

export async function setTraceConsent(granted: boolean): Promise<void> {
  await setMeta(CONSENT_KEY, granted ? 'granted' : 'denied');
  // Menarik persetujuan: jejak otomatis yang belum terkirim tidak boleh terkirim belakangan.
  if (!granted) await discardPendingAutoSessions();
}

/**
 * Tanya sekali sebelum perekaman otomatis pertama; selanjutnya pakai jawaban tersimpan.
 * Penghitung otomatis tetap berjalan apa pun jawabannya — yang bergantung hanya perekaman.
 */
export async function ensureTraceConsent(t: TFunction): Promise<boolean> {
  const saved = await getTraceConsent();
  if (saved) return saved === 'granted';
  const answer = await new Promise<'granted' | 'denied' | 'dismissed'>((resolve) => {
    Alert.alert(
      t('consent.trace_title'),
      t('consent.trace_body'),
      [
        { text: t('consent.trace_deny'), style: 'cancel', onPress: () => resolve('denied') },
        { text: t('consent.trace_allow'), onPress: () => resolve('granted') },
      ],
      // Menutup dialog tanpa memilih = belum setuju, dan ditanya lagi lain kali.
      { cancelable: true, onDismiss: () => resolve('dismissed') },
    );
  });
  if (answer !== 'dismissed') await setTraceConsent(answer === 'granted');
  return answer === 'granted';
}
