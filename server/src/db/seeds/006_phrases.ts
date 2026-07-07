import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  const has = await knex('arabic_phrases').first();
  if (has) return;

  await knex('arabic_phrases').insert([
    { category: 'salam', sort_order: 1, indonesian: 'Assalamualaikum', arabic: 'السلام عليكم', transliteration: 'As-salaamu alaikum' },
    { category: 'salam', sort_order: 2, indonesian: 'Terima kasih', arabic: 'جزاك الله خيراً', transliteration: 'Jazaakallahu khairan' },
    { category: 'salam', sort_order: 3, indonesian: 'Maaf / permisi', arabic: 'عفواً', transliteration: 'Afwan' },
    { category: 'arah', sort_order: 4, indonesian: 'Di mana Masjidil Haram?', arabic: 'أين المسجد الحرام؟', transliteration: 'Ainal-masjidil-haraam?' },
    { category: 'arah', sort_order: 5, indonesian: 'Di mana toilet?', arabic: 'أين الحمام؟', transliteration: 'Ainal-hammaam?' },
    { category: 'arah', sort_order: 6, indonesian: 'Ke kanan', arabic: 'يمين', transliteration: 'Yamiin' },
    { category: 'arah', sort_order: 7, indonesian: 'Ke kiri', arabic: 'يسار', transliteration: 'Yasaar' },
    { category: 'arah', sort_order: 8, indonesian: 'Lurus', arabic: 'على طول', transliteration: 'Ala tuul' },
    { category: 'belanja', sort_order: 9, indonesian: 'Berapa harganya?', arabic: 'بكم هذا؟', transliteration: 'Bikam haadza?' },
    { category: 'belanja', sort_order: 10, indonesian: 'Terlalu mahal', arabic: 'غالي جداً', transliteration: 'Ghaalii jiddan' },
    { category: 'belanja', sort_order: 11, indonesian: 'Saya mau beli ini', arabic: 'أريد أن أشتري هذا', transliteration: 'Uriidu an asytarii haadza' },
    { category: 'darurat', sort_order: 12, indonesian: 'Tolong!', arabic: 'ساعدوني!', transliteration: 'Saa\'iduunii!' },
    { category: 'darurat', sort_order: 13, indonesian: 'Saya sakit', arabic: 'أنا مريض', transliteration: 'Ana mariidh' },
    { category: 'darurat', sort_order: 14, indonesian: 'Saya tersesat', arabic: 'أنا تائه', transliteration: 'Ana taa-ih' },
    { category: 'darurat', sort_order: 15, indonesian: 'Rumah sakit', arabic: 'مستشفى', transliteration: 'Mustashfa' },
    { category: 'makanan', sort_order: 16, indonesian: 'Air minum', arabic: 'ماء', transliteration: 'Maa\'' },
    { category: 'makanan', sort_order: 17, indonesian: 'Makanan', arabic: 'طعام', transliteration: 'Ta\'aam' },
    { category: 'makanan', sort_order: 18, indonesian: 'Restoran', arabic: 'مطعم', transliteration: 'Mat\'am' },
  ]);

  console.log('  Frasa Arab (18 frasa) berhasil ditambahkan.');
}
