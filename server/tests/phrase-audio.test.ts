import { describe, it, expect } from 'vitest';
// Modul murni mobile (tanpa impor Expo) — dites di sini karena apps/mobile tidak punya test runner.
import { pickArabicVoice, arabicVoiceStatus } from '../../apps/mobile/src/services/phrase-audio-core';
import { batteryBrandOf, batteryStepsKey } from '../../apps/mobile/src/services/battery-hint-core';
import { id } from '../../apps/mobile/src/i18n/locales/id';

const v = (identifier: string, language: string) => ({ identifier, language });

describe('pickArabicVoice (audio frasa, Permintaan 3)', () => {
  it('mengutamakan ar-SA di atas logat Arab lain', () => {
    const voices = [v('en', 'en-US'), v('eg', 'ar-EG'), v('sa', 'ar-SA')];
    expect(pickArabicVoice(voices)?.identifier).toBe('sa');
  });

  it('memakai logat Arab lain bila ar-SA tidak ada (termasuk format ar_XA dan "ar" saja)', () => {
    expect(pickArabicVoice([v('en', 'en-US'), v('xa', 'ar_XA')])?.identifier).toBe('xa');
    expect(pickArabicVoice([v('ar', 'ar')])?.identifier).toBe('ar');
  });

  it('tidak salah mengenali bahasa lain yang kodenya berawalan "ar" (mis. Mapudungun "arn")', () => {
    expect(pickArabicVoice([v('arn', 'arn-CL'), v('hy', 'hy-AM')])).toBeNull();
  });

  it('status: kosong = belum diketahui (TTS belum siap), tanpa Arab = missing', () => {
    expect(arabicVoiceStatus([])).toBe('unknown');
    expect(arabicVoiceStatus([v('en', 'en-US')])).toBe('missing');
    expect(arabicVoiceStatus([v('sa', 'ar-SA')])).toBe('available');
  });
});

describe('batteryBrandOf (petunjuk hemat baterai, Permintaan 9)', () => {
  it('mengenali merek induk dan turunannya tanpa peduli huruf besar', () => {
    expect(batteryBrandOf('Xiaomi')).toBe('xiaomi');
    expect(batteryBrandOf(null, 'Redmi')).toBe('xiaomi');
    expect(batteryBrandOf('POCO')).toBe('xiaomi');
    expect(batteryBrandOf('realme')).toBe('oppo');
    expect(batteryBrandOf('OnePlus')).toBe('oppo');
    expect(batteryBrandOf('vivo')).toBe('vivo');
    expect(batteryBrandOf('samsung')).toBe('samsung');
    expect(batteryBrandOf('HONOR')).toBe('huawei');
  });

  it('merek tak dikenal atau null → petunjuk umum', () => {
    expect(batteryBrandOf('Google')).toBe('generic');
    expect(batteryBrandOf(null, undefined, '  ')).toBe('generic');
  });

  it('setiap merek punya teks langkah di file bahasa', () => {
    for (const brand of ['xiaomi', 'oppo', 'vivo', 'samsung', 'huawei', 'generic'] as const) {
      expect(id[batteryStepsKey(brand)], brand).toBeTruthy();
    }
  });
});
