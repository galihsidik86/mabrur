import { Knex } from 'knex';

/**
 * Permintaan revisi v2 #3: frasa Arab di Alat Ibadah diberi harakat lengkap
 * (fathah, kasrah, dhammah, sukun, tasydid, tanwin, mad) + arti & latin English.
 *
 * Migrasi data (bukan seed): seed 006 hanya mengisi tabel kosong, jadi database
 * yang sudah berjalan tidak akan pernah menerima perbaikan lewat seed.
 * Aman untuk DB yang mungkin pernah diedit manual (tidak ada UI admin untuk tabel ini):
 * - frasa lama diperbarui hanya bila teks Indonesia DAN Arab-nya masih persis seed 006
 *   (atau sudah sama dengan teks baru -> idempoten setelah rollback); hasil edit dilewati;
 * - frasa lama yang tidak ditemukan TIDAK disisipkan ulang (hormati hapus/ganti nama);
 * - frasa baru disisipkan hanya bila teks Indonesianya belum ada.
 *
 * PERLU DIPERIKSA ustaz/ahli bahasa Arab sebelum rilis (lihat dokumen permintaan).
 * Lima frasa contoh dari dokumen disalin persis dari dokumen tersebut.
 */
export interface PhraseRow {
  category: string;
  sort_order: number;
  indonesian: string;
  english: string;
  arabic: string;
  transliteration: string; // ejaan Indonesia (dz, ts, sy, dh)
  transliteration_en: string; // ejaan Inggris (dh, th, sh)
  /** Nilai persis di seed 006 — kunci pencocokan baris lama. */
  legacy?: { indonesian: string; arabic: string };
}

export interface ExistingPhrase {
  id: string;
  indonesian: string;
  arabic: string;
}

type PhraseData = Omit<PhraseRow, 'legacy'>;

export interface PhraseMigrationPlan {
  updates: Array<{ id: string; data: PhraseData }>;
  inserts: PhraseData[];
  /** Teks Indonesia frasa yang dilewati (diedit/dihapus/bentrok) — dicatat di log. */
  skipped: string[];
}

/** Rencana murni (tanpa DB) agar aturan pencocokan bisa dites. */
export function planPhraseMigration(existing: ExistingPhrase[]): PhraseMigrationPlan {
  const byIndonesian = (text: string) =>
    existing.filter((r) => r.indonesian === text).sort((a, b) => a.id.localeCompare(b.id));

  return PHRASES.reduce<PhraseMigrationPlan>((plan, { legacy, ...data }) => {
    const candidates = byIndonesian(legacy?.indonesian ?? data.indonesian);
    const match = candidates.find((r) => r.arabic === data.arabic || (legacy && r.arabic === legacy.arabic));
    if (match) return { ...plan, updates: [...plan.updates, { id: match.id, data }] };
    if (!legacy && candidates.length === 0) return { ...plan, inserts: [...plan.inserts, data] };
    return { ...plan, skipped: [...plan.skipped, legacy?.indonesian ?? data.indonesian] };
  }, { updates: [], inserts: [], skipped: [] });
}

export const PHRASES: PhraseRow[] = [
  // Salam
  { category: 'salam', sort_order: 1, legacy: { indonesian: 'Assalamualaikum', arabic: 'السلام عليكم' },
    indonesian: 'Assalamualaikum', english: 'Peace be upon you',
    arabic: 'السَّلَامُ عَلَيْكُمْ', transliteration: "As-salamu 'alaikum", transliteration_en: "As-salamu 'alaykum" },
  { category: 'salam', sort_order: 2, legacy: { indonesian: 'Terima kasih', arabic: 'جزاك الله خيراً' },
    indonesian: 'Terima kasih', english: 'Thank you (may Allah reward you)',
    arabic: 'جَزَاكَ اللّٰهُ خَيْرًا', transliteration: 'Jazakallahu khairan', transliteration_en: 'Jazakallahu khayran' },
  { category: 'salam', sort_order: 3, legacy: { indonesian: 'Maaf / permisi', arabic: 'عفواً' },
    indonesian: 'Maaf / permisi', english: 'Excuse me / Sorry',
    arabic: 'عَفْوًا', transliteration: "'Afwan", transliteration_en: "'Afwan" },

  // Arah & tempat
  { category: 'arah', sort_order: 4, legacy: { indonesian: 'Di mana Masjidil Haram?', arabic: 'أين المسجد الحرام؟' },
    indonesian: 'Di mana Masjidil Haram?', english: 'Where is Masjid al-Haram (the Grand Mosque)?',
    arabic: 'أَيْنَ الْمَسْجِدُ الْحَرَامُ؟', transliteration: 'Aina al-Masjid al-Haram?', transliteration_en: 'Ayna al-Masjid al-Haram?' },
  { category: 'arah', sort_order: 5, legacy: { indonesian: 'Di mana toilet?', arabic: 'أين الحمام؟' },
    indonesian: 'Di mana toilet?', english: 'Where is the toilet?',
    arabic: 'أَيْنَ الْحَمَّامُ؟', transliteration: 'Ainal hammam?', transliteration_en: 'Ayna al-hammam?' },
  { category: 'arah', sort_order: 6, legacy: { indonesian: 'Ke kanan', arabic: 'يمين' },
    indonesian: 'Ke kanan', english: 'To the right',
    arabic: 'إِلَى الْيَمِينِ', transliteration: 'Ilal yamin', transliteration_en: 'Ila al-yamin' },
  { category: 'arah', sort_order: 7, legacy: { indonesian: 'Ke kiri', arabic: 'يسار' },
    indonesian: 'Ke kiri', english: 'To the left',
    arabic: 'إِلَى الْيَسَارِ', transliteration: 'Ilal yasar', transliteration_en: 'Ila al-yasar' },
  // Ungkapan lisan yang umum dipahami sopir; sukun di akhir = bentuk waqaf.
  { category: 'arah', sort_order: 8, legacy: { indonesian: 'Lurus', arabic: 'على طول' },
    indonesian: 'Lurus', english: 'Straight ahead',
    arabic: 'عَلَى طُولْ', transliteration: "'Ala thul", transliteration_en: "'Ala tul" },

  // Transportasi (contoh dari dokumen permintaan)
  { category: 'transportasi', sort_order: 9,
    indonesian: 'Tolong antar saya ke hotel ini', english: 'Please take me to this hotel.',
    arabic: 'مِنْ فَضْلِكَ، أَوْصِلْنِي إِلَى هٰذَا الْفُنْدُقِ',
    transliteration: 'Min fadhlik, aushilni ila hadzal funduq', transliteration_en: 'Min fadlik, awsilni ila hadha al-funduq' },
  { category: 'transportasi', sort_order: 10,
    indonesian: 'Berapa ongkosnya?', english: 'How much is the fare?',
    arabic: 'كَمِ الْأُجْرَةُ؟', transliteration: 'Kam al-ujrah?', transliteration_en: 'Kam al-ujrah?' },

  // Belanja
  { category: 'belanja', sort_order: 11, legacy: { indonesian: 'Berapa harganya?', arabic: 'بكم هذا؟' },
    indonesian: 'Berapa harganya?', english: 'How much is this?',
    arabic: 'بِكَمْ هٰذَا؟', transliteration: 'Bikam hadza?', transliteration_en: 'Bikam hadha?' },
  { category: 'belanja', sort_order: 12, legacy: { indonesian: 'Terlalu mahal', arabic: 'غالي جداً' },
    indonesian: 'Terlalu mahal', english: 'Too expensive',
    arabic: 'غَالٍ جِدًّا', transliteration: 'Ghalin jiddan', transliteration_en: 'Ghalin jiddan' },
  { category: 'belanja', sort_order: 13, legacy: { indonesian: 'Saya mau beli ini', arabic: 'أريد أن أشتري هذا' },
    indonesian: 'Saya mau beli ini', english: 'I want to buy this',
    arabic: 'أُرِيدُ أَنْ أَشْتَرِيَ هٰذَا', transliteration: 'Uridu an asytariya hadza', transliteration_en: 'Uridu an ashtariya hadha' },

  // Darurat
  { category: 'darurat', sort_order: 14, legacy: { indonesian: 'Tolong!', arabic: 'ساعدوني!' },
    indonesian: 'Tolong!', english: 'Help!',
    arabic: 'سَاعِدُونِي!', transliteration: "Sa'iduni!", transliteration_en: "Sa'iduni!" },
  { category: 'darurat', sort_order: 15, legacy: { indonesian: 'Saya tersesat', arabic: 'أنا تائه' },
    indonesian: 'Saya tersesat', english: 'I am lost',
    arabic: 'أَنَا تَائِهٌ', transliteration: "Ana ta'ih", transliteration_en: "Ana ta'ih" },
  { category: 'darurat', sort_order: 16,
    indonesian: 'Saya tersesat, tolong bantu saya', english: 'I am lost. Please help me.',
    arabic: 'أَنَا تَائِهٌ، سَاعِدْنِي مِنْ فَضْلِكَ',
    transliteration: "Ana ta'ih, sa'idni min fadhlik", transliteration_en: "Ana ta'ih, sa'idni min fadlik" },
  { category: 'darurat', sort_order: 17, legacy: { indonesian: 'Saya sakit', arabic: 'أنا مريض' },
    indonesian: 'Saya sakit', english: 'I am sick',
    arabic: 'أَنَا مَرِيضٌ', transliteration: 'Ana maridh', transliteration_en: 'Ana marid' },
  { category: 'darurat', sort_order: 18,
    indonesian: 'Saya butuh bantuan medis', english: 'I need medical help.',
    arabic: 'أَحْتَاجُ إِلَى مُسَاعَدَةٍ طِبِّيَّةٍ',
    transliteration: "Ahtaju ila musa'adah thibbiyyah", transliteration_en: "Ahtaju ila musa'adah tibbiyyah" },
  { category: 'darurat', sort_order: 19, legacy: { indonesian: 'Rumah sakit', arabic: 'مستشفى' },
    indonesian: 'Rumah sakit', english: 'Hospital',
    arabic: 'مُسْتَشْفًى', transliteration: 'Mustasyfa', transliteration_en: 'Mustashfa' },

  // Makanan & minuman
  { category: 'makanan', sort_order: 20, legacy: { indonesian: 'Air minum', arabic: 'ماء' },
    indonesian: 'Air minum', english: 'Drinking water',
    arabic: 'مَاءٌ', transliteration: "Ma'", transliteration_en: "Ma'" },
  { category: 'makanan', sort_order: 21, legacy: { indonesian: 'Makanan', arabic: 'طعام' },
    indonesian: 'Makanan', english: 'Food',
    arabic: 'طَعَامٌ', transliteration: "Tha'am", transliteration_en: "Ta'am" },
  { category: 'makanan', sort_order: 22, legacy: { indonesian: 'Restoran', arabic: 'مطعم' },
    indonesian: 'Restoran', english: 'Restaurant',
    arabic: 'مَطْعَمٌ', transliteration: "Math'am", transliteration_en: "Mat'am" },
];

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('arabic_phrases', (t) => {
    t.string('english');
    t.string('transliteration_en');
  });

  // knex sudah membungkus migrasi ini dalam satu transaksi (DDL Postgres transaksional).
  const existing: ExistingPhrase[] = await knex('arabic_phrases').select('id', 'indonesian', 'arabic');
  const plan = planPhraseMigration(existing);
  for (const { id, data } of plan.updates) {
    await knex('arabic_phrases').where('id', id).update(data);
  }
  if (plan.inserts.length > 0) await knex('arabic_phrases').insert(plan.inserts);
  if (plan.skipped.length > 0) {
    console.warn(`[phrases_harakat] Dilewati (sudah diedit/dihapus/bentrok, periksa manual): ${plan.skipped.join('; ')}`);
  }
}

export async function down(knex: Knex): Promise<void> {
  // Teks berharakat dibiarkan (tetap valid untuk skema lama); hanya kolom baru dihapus.
  await knex.schema.alterTable('arabic_phrases', (t) => {
    t.dropColumn('english');
    t.dropColumn('transliteration_en');
  });
}
