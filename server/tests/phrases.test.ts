import { describe, it, expect } from 'vitest';
import { PHRASES, planPhraseMigration } from '../src/db/migrations/20261024000001_phrases_harakat';

// Harakat: fathatan..sukun (U+064B–U+0652) + alif khanjariyah (U+0670).
const HARAKAT = /[ً-ْٰ]/;
const ARABIC_LETTER = /[ء-ي]/;

describe('data frasa Arab berharakat (Permintaan 3)', () => {
  it('setiap kata Arab punya harakat (tidak ada kata gundul)', () => {
    for (const p of PHRASES) {
      const words = p.arabic.split(/[\s،؟!.]+/).filter((w) => ARABIC_LETTER.test(w));
      for (const w of words) expect(HARAKAT.test(w), `${p.indonesian}: "${w}"`).toBe(true);
    }
  });

  it('arti & latin tersedia dalam Indonesia dan English', () => {
    for (const p of PHRASES) {
      expect(p.indonesian.trim(), p.arabic).not.toBe('');
      expect(p.english.trim(), p.indonesian).not.toBe('');
      expect(p.transliteration.trim(), p.indonesian).not.toBe('');
      expect(p.transliteration_en.trim(), p.indonesian).not.toBe('');
    }
  });

  it('tanpa duplikat & urutan unik', () => {
    expect(new Set(PHRASES.map((p) => p.indonesian)).size).toBe(PHRASES.length);
    expect(new Set(PHRASES.map((p) => p.sort_order)).size).toBe(PHRASES.length);
  });

  it('memuat contoh frasa dari dokumen permintaan dengan teks Arab yang sama persis', () => {
    const byIndo = new Map(PHRASES.map((p) => [p.indonesian, p.arabic]));
    expect(byIndo.get('Tolong antar saya ke hotel ini')).toBe('مِنْ فَضْلِكَ، أَوْصِلْنِي إِلَى هٰذَا الْفُنْدُقِ');
    expect(byIndo.get('Saya tersesat, tolong bantu saya')).toBe('أَنَا تَائِهٌ، سَاعِدْنِي مِنْ فَضْلِكَ');
    expect(byIndo.get('Di mana Masjidil Haram?')).toBe('أَيْنَ الْمَسْجِدُ الْحَرَامُ؟');
    expect(byIndo.get('Berapa ongkosnya?')).toBe('كَمِ الْأُجْرَةُ؟');
    expect(byIndo.get('Saya butuh bantuan medis')).toBe('أَحْتَاجُ إِلَى مُسَاعَدَةٍ طِبِّيَّةٍ');
  });

  it('18 frasa lama punya kunci pencocokan teks Indonesia + Arab lama dari seed 006', () => {
    const legacy = PHRASES.filter((p) => p.legacy);
    expect(legacy).toHaveLength(18);
    for (const p of legacy) {
      expect(p.legacy!.arabic, p.indonesian).not.toBe(p.arabic);
    }
  });
});

describe('rencana migrasi (aman untuk DB yang pernah diedit manual)', () => {
  const legacyRow = (indonesian: string, arabic: string) => ({ id: `id-${indonesian}`, indonesian, arabic });
  const seed006 = PHRASES.filter((p) => p.legacy).map((p) => legacyRow(p.legacy!.indonesian, p.legacy!.arabic));

  it('DB bersih dari seed 006: 18 diperbarui, frasa baru disisipkan', () => {
    const plan = planPhraseMigration(seed006);
    expect(plan.updates).toHaveLength(18);
    expect(plan.inserts).toHaveLength(PHRASES.length - 18);
    expect(plan.skipped).toEqual([]);
  });

  it('baris lama yang teks Arabnya sudah diedit admin tidak ditimpa', () => {
    const edited = seed006.map((r) => (r.indonesian === 'Lurus' ? { ...r, arabic: 'دُغْرِي' } : r));
    const plan = planPhraseMigration(edited);
    expect(plan.updates.map((u) => u.id)).not.toContain('id-Lurus');
    expect(plan.skipped).toContain('Lurus');
  });

  it('baris lama yang dihapus/diganti nama tidak disisipkan ulang (tidak ada duplikat)', () => {
    const plan = planPhraseMigration(seed006.filter((r) => r.indonesian !== 'Lurus'));
    expect(plan.inserts.map((i) => i.indonesian)).not.toContain('Lurus');
    expect(plan.skipped).toContain('Lurus');
  });

  it('idempoten: setelah rollback (kolom english hilang) migrasi ulang mengisi kembali semua baris', () => {
    const migrated = PHRASES.map((p) => legacyRow(p.indonesian, p.arabic));
    const plan = planPhraseMigration(migrated);
    expect(plan.updates).toHaveLength(PHRASES.length);
    expect(plan.inserts).toEqual([]);
    expect(plan.skipped).toEqual([]);
  });

  it('tabel kosong (instalasi baru, seed belum jalan) → semua frasa berharakat disisipkan', () => {
    const plan = planPhraseMigration([]);
    expect(plan.inserts).toHaveLength(PHRASES.length);
    expect(plan.inserts.every((i) => !('legacy' in i))).toBe(true);
    expect(plan.skipped).toEqual([]);
  });

  it('frasa baru tidak menimpa baris yang sudah ada dengan teks Indonesia sama', () => {
    const plan = planPhraseMigration([...seed006, legacyRow('Berapa ongkosnya?', 'بكم؟')]);
    expect(plan.inserts.map((i) => i.indonesian)).not.toContain('Berapa ongkosnya?');
    expect(plan.updates.map((u) => u.id)).not.toContain('id-Berapa ongkosnya?');
  });
});
