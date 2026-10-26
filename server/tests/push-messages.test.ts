import { describe, it, expect } from 'vitest';
import { pushText, pushLang, tokensByLang, PUSH_MESSAGES } from '../src/services/push-messages';

describe('push dalam bahasa penerima', () => {
  it('pushLang: hanya id/en, selain itu Indonesia', () => {
    expect(pushLang('en')).toBe('en');
    expect(pushLang('id')).toBe('id');
    expect(pushLang(null)).toBe('id');
    expect(pushLang('ar')).toBe('id');
  });

  it('pushText mengisi parameter sesuai bahasa', () => {
    expect(pushText('id', 'sos.body', { name: 'Siti', category: pushText('id', 'sos.cat.medis') }))
      .toBe('Siti butuh bantuan (Medis)');
    expect(pushText('en', 'sos.body', { name: 'Siti', category: pushText('en', 'sos.cat.medis') }))
      .toBe('Siti needs help (Medical)');
  });

  it('kedua bahasa punya kunci & placeholder yang sama', () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    expect(Object.keys(PUSH_MESSAGES.en).sort()).toEqual(Object.keys(PUSH_MESSAGES.id).sort());
    for (const k of Object.keys(PUSH_MESSAGES.id) as Array<keyof typeof PUSH_MESSAGES.id>) {
      expect(ph(PUSH_MESSAGES.en[k]), k).toEqual(ph(PUSH_MESSAGES.id[k]));
    }
  });

  it('tokensByLang: kelompok per bahasa, token unik, kosong dibuang', () => {
    const groups = tokensByLang([
      { push_token: 'A', language: 'en' },
      { push_token: 'B', language: 'id' },
      { push_token: 'A', language: 'en' },
      { push_token: 'C', language: null },
      { push_token: '', language: 'en' },
    ]);
    expect(groups.get('en')).toEqual(['A']);
    expect(groups.get('id')).toEqual(['B', 'C']);
  });
});
