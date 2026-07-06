import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  const hasGuides = await knex('ibadah_guides').first();
  if (hasGuides) return;

  // ---- UMRAH (5 tahap) ----
  await knex('ibadah_guides').insert([
    {
      type: 'umrah', step_number: 1,
      title: 'Ihram & niat',
      subtitle: 'Di miqat, sebelum masuk Makkah',
      steps_text: '• Mandi sunnah, wangi sebelum ihram\n• Kenakan 2 kain ihram (pria) / busana syar\u2019i (wanita)\n• Salat sunnah ihram 2 rakaat\n• Berniat umrah di miqat, lalu mulai talbiyah',
      arabic_text: '\u0644\u064E\u0628\u0651\u064E\u064A\u0652\u0643\u064E \u0627\u0644\u0644\u0651\u064E\u0647\u064F\u0645\u0651\u064E \u0639\u064F\u0645\u0652\u0631\u064E\u0629\u064B',
      latin_text: 'Labbaikallahumma \u02BBumratan',
    },
    {
      type: 'umrah', step_number: 2,
      title: 'Talbiyah',
      subtitle: 'Sepanjang jalan menuju Masjidil Haram',
      steps_text: '• Perbanyak talbiyah dengan suara (pria) hingga tiba di Ka\u2019bah\n• Jaga larangan ihram\n• Perbanyak doa & istighfar',
      arabic_text: '\u0644\u064E\u0628\u0651\u064E\u064A\u0652\u0643\u064E \u0644\u064E\u0627 \u0634\u064E\u0631\u0650\u064A\u0643\u064E \u0644\u064E\u0643\u064E \u0644\u064E\u0628\u0651\u064E\u064A\u0652\u0643',
      latin_text: 'Labbaika laa syariika laka labbaik',
    },
    {
      type: 'umrah', step_number: 3,
      title: 'Tawaf',
      subtitle: '7 putaran mengelilingi Ka\u2019bah',
      steps_text: '• Mulai dari Hajar Aswad, Ka\u2019bah di sebelah kiri\n• 7 putaran berlawanan arah jarum jam\n• Salat 2 rakaat di belakang Maqam Ibrahim\n• Minum air Zamzam',
      arabic_text: '\u0631\u064E\u0628\u0651\u064E\u0646\u064E\u0627 \u0622\u062A\u0650\u0646\u064E\u0627 \u0641\u0650\u064A \u0627\u0644\u062F\u0651\u064F\u0646\u0652\u064A\u064E\u0627 \u062D\u064E\u0633\u064E\u0646\u064E\u0629\u064B',
      latin_text: 'Rabbanaa aatinaa fid-dunyaa hasanah',
    },
    {
      type: 'umrah', step_number: 4,
      title: 'Sa\u2019i',
      subtitle: '7 kali Shafa \u2013 Marwah',
      steps_text: '• Mulai dari bukit Shafa menuju Marwah\n• 7 kali perjalanan (Shafa\u2192Marwah = 1)\n• Pria berlari kecil di antara pilar hijau\n• Berdoa menghadap Ka\u2019bah di tiap bukit',
      arabic_text: '\u0625\u0650\u0646\u0651\u064E \u0627\u0644\u0635\u0651\u064E\u0641\u064E\u0627 \u0648\u064E\u0627\u0644\u0652\u0645\u064E\u0631\u0652\u0648\u064E\u0629\u064E \u0645\u0650\u0646\u0652 \u0634\u064E\u0639\u064E\u0627\u0626\u0650\u0631\u0650 \u0627\u0644\u0644\u0651\u064E\u0647',
      latin_text: 'Innash-shafaa wal-marwata min sya\u02BBaa\u2019irillah',
    },
    {
      type: 'umrah', step_number: 5,
      title: 'Tahallul',
      subtitle: 'Mencukur / memotong rambut',
      steps_text: '• Pria: cukur gundul (afdhal) atau potong sebagian\n• Wanita: potong ujung rambut seukuran ruas jari\n• Dengan tahallul, ibadah umrah selesai & larangan ihram gugur',
      arabic_text: '\u0627\u0644\u0652\u062D\u064E\u0645\u0652\u062F\u064F \u0644\u0650\u0644\u0651\u064E\u0647\u0650 \u0627\u0644\u0651\u064E\u0630\u0650\u064A \u0642\u064E\u0636\u064E\u0649 \u0639\u064E\u0646\u0651\u064E\u0627 \u0646\u064F\u0633\u064F\u0643\u064E\u0646\u064E\u0627',
      latin_text: 'Alhamdulillaahil-ladzii qadhaa \u02BBannaa nusukanaa',
    },
  ]);

  // ---- HAJI (6 tahap) ----
  await knex('ibadah_guides').insert([
    {
      type: 'haji', step_number: 1,
      title: 'Ihram haji',
      subtitle: '8 Dzulhijjah dari Makkah',
      steps_text: '• Berihram & niat haji dari tempat menginap\n• Menuju Mina, bermalam (Tarwiyah)\n• Perbanyak talbiyah',
      arabic_text: '\u0644\u064E\u0628\u0651\u064E\u064A\u0652\u0643\u064E \u0627\u0644\u0644\u0651\u064E\u0647\u064F\u0645\u0651\u064E \u062D\u064E\u062C\u0651\u064B\u0627',
      latin_text: 'Labbaikallahumma hajjan',
    },
    {
      type: 'haji', step_number: 2,
      title: 'Wukuf di Arafah',
      subtitle: '9 Dzulhijjah \u2014 rukun utama',
      steps_text: '• Hadir di Arafah sejak tergelincir matahari hingga maghrib\n• Perbanyak doa, dzikir, istighfar\n• Puncak ibadah haji \u2014 tak sah haji tanpa wukuf',
      arabic_text: '\u0644\u064E\u0627 \u0625\u0650\u0644\u064E\u0670\u0647\u064E \u0625\u0650\u0644\u0651\u064E\u0627 \u0627\u0644\u0644\u0651\u064E\u0647\u064F \u0648\u064E\u062D\u0652\u062F\u064E\u0647\u064F \u0644\u064E\u0627 \u0634\u064E\u0631\u0650\u064A\u0643\u064E \u0644\u064E\u0647',
      latin_text: 'Laa ilaaha illallaahu wahdahu laa syariika lah',
    },
    {
      type: 'haji', step_number: 3,
      title: 'Mabit di Muzdalifah',
      subtitle: 'Malam 10 Dzulhijjah',
      steps_text: '• Bermalam sejenak di Muzdalifah\n• Mengumpulkan batu kerikil untuk lontar jumrah\n• Salat Maghrib & Isya dijamak',
      arabic_text: '\u0641\u064E\u0627\u0630\u0652\u0643\u064F\u0631\u064F\u0648\u0627 \u0627\u0644\u0644\u0651\u064E\u0647\u064E \u0639\u0650\u0646\u0652\u062F\u064E \u0627\u0644\u0652\u0645\u064E\u0634\u0652\u0639\u064E\u0631\u0650 \u0627\u0644\u0652\u062D\u064E\u0631\u064E\u0627\u0645',
      latin_text: 'Fadzkurullaaha \u02BBindal-masy\u02BBaril-haraam',
    },
    {
      type: 'haji', step_number: 4,
      title: 'Mina & lontar jumrah',
      subtitle: '10\u201313 Dzulhijjah',
      steps_text: '• Lontar Jumrah Aqabah (10 Dzulhijjah), 7 kerikil\n• Tahallul awal: cukur rambut\n• Hari Tasyriq: lontar 3 jumrah tiap hari\n• Mabit di Mina',
      arabic_text: '\u0627\u0644\u0644\u0651\u064E\u0647\u064F \u0623\u064E\u0643\u0652\u0628\u064E\u0631',
      latin_text: 'Allaahu akbar (tiap lemparan kerikil)',
    },
    {
      type: 'haji', step_number: 5,
      title: 'Tawaf Ifadah & Sa\u2019i',
      subtitle: 'Rukun haji di Masjidil Haram',
      steps_text: '• Kembali ke Makkah untuk Tawaf Ifadah\n• Dilanjutkan Sa\u2019i Shafa\u2013Marwah\n• Tahallul tsani: seluruh larangan ihram gugur',
      arabic_text: '\u0631\u064E\u0628\u0651\u064E\u0646\u064E\u0627 \u062A\u064E\u0642\u064E\u0628\u0651\u064E\u0644\u0652 \u0645\u0650\u0646\u0651\u064E\u0627',
      latin_text: 'Rabbanaa taqabbal minnaa',
    },
    {
      type: 'haji', step_number: 6,
      title: 'Tawaf Wada\u2019',
      subtitle: 'Sebelum meninggalkan Makkah',
      steps_text: '• Tawaf perpisahan 7 putaran\n• Ibadah penutup sebelum pulang\n• Berdoa memohon diterima & bisa kembali',
      arabic_text: '\u0627\u0644\u0644\u0651\u064E\u0647\u064F\u0645\u0651\u064E \u0644\u064E\u0627 \u062A\u064E\u062C\u0652\u0639\u064E\u0644\u0652\u0647\u064F \u0622\u062E\u0650\u0631\u064E \u0627\u0644\u0652\u0639\u064E\u0647\u0652\u062F',
      latin_text: 'Allaahumma laa taj\u02BBalhu aakhiral-\u02BBahd',
    },
  ]);

  // ---- DOA (6 doa) ----
  await knex('duas').insert([
    {
      sort_order: 1, title: 'Niat umrah', context: 'Di miqat',
      arabic_text: '\u0644\u064E\u0628\u0651\u064E\u064A\u0652\u0643\u064E \u0627\u0644\u0644\u0651\u064E\u0647\u064F\u0645\u0651\u064E \u0628\u0650\u0639\u064F\u0645\u0652\u0631\u064E\u0629',
      latin_text: 'Labbaikallahumma bi \u02BBumrah',
      translation: 'Aku penuhi panggilan-Mu ya Allah untuk berumrah.',
    },
    {
      sort_order: 2, title: 'Talbiyah', context: 'Sepanjang perjalanan ihram',
      arabic_text: '\u0644\u064E\u0628\u0651\u064E\u064A\u0652\u0643\u064E \u0627\u0644\u0644\u0651\u064E\u0647\u064F\u0645\u0651\u064E \u0644\u064E\u0628\u0651\u064E\u064A\u0652\u0643\u060C \u0644\u064E\u0628\u0651\u064E\u064A\u0652\u0643\u064E \u0644\u064E\u0627 \u0634\u064E\u0631\u0650\u064A\u0643\u064E \u0644\u064E\u0643\u064E \u0644\u064E\u0628\u0651\u064E\u064A\u0652\u0643',
      latin_text: 'Labbaikallahumma labbaik, labbaika laa syariika laka labbaik',
      translation: 'Aku penuhi panggilan-Mu, tiada sekutu bagi-Mu, aku penuhi panggilan-Mu.',
    },
    {
      sort_order: 3, title: 'Doa masuk Masjidil Haram', context: 'Saat memasuki masjid',
      arabic_text: '\u0627\u0644\u0644\u0651\u064E\u0647\u064F\u0645\u0651\u064E \u0627\u0641\u0652\u062A\u064E\u062D\u0652 \u0644\u0650\u064A \u0623\u064E\u0628\u0652\u0648\u064E\u0627\u0628\u064E \u0631\u064E\u062D\u0652\u0645\u064E\u062A\u0650\u0643',
      latin_text: 'Allaahummaftah lii abwaaba rahmatik',
      translation: 'Ya Allah, bukakanlah untukku pintu-pintu rahmat-Mu.',
    },
    {
      sort_order: 4, title: 'Doa melihat Ka\u2019bah', context: 'Pertama melihat Ka\u2019bah',
      arabic_text: '\u0627\u0644\u0644\u0651\u064E\u0647\u064F\u0645\u0651\u064E \u0632\u0650\u062F\u0652 \u0647\u064E\u0630\u064E\u0627 \u0627\u0644\u0652\u0628\u064E\u064A\u0652\u062A\u064E \u062A\u064E\u0634\u0652\u0631\u0650\u064A\u0641\u064B\u0627 \u0648\u064E\u062A\u064E\u0639\u0652\u0638\u0650\u064A\u0645\u064B\u0627',
      latin_text: 'Allaahumma zid haadzal-baita tasyriifan wa ta\u02BBzhiiman',
      translation: 'Ya Allah, tambahkanlah kemuliaan dan keagungan pada Baitullah ini.',
    },
    {
      sort_order: 5, title: 'Doa sa\u2019i di Shafa & Marwah', context: 'Di atas kedua bukit',
      arabic_text: '\u0625\u0650\u0646\u0651\u064E \u0627\u0644\u0635\u0651\u064E\u0641\u064E\u0627 \u0648\u064E\u0627\u0644\u0652\u0645\u064E\u0631\u0652\u0648\u064E\u0629\u064E \u0645\u0650\u0646\u0652 \u0634\u064E\u0639\u064E\u0627\u0626\u0650\u0631\u0650 \u0627\u0644\u0644\u0651\u064E\u0647',
      latin_text: 'Innash-shafaa wal-marwata min sya\u02BBaa\u2019irillah',
      translation: 'Sesungguhnya Shafa dan Marwah termasuk syiar-syiar Allah.',
    },
    {
      sort_order: 6, title: 'Doa wukuf di Arafah', context: '9 Dzulhijjah',
      arabic_text: '\u0644\u064E\u0627 \u0625\u0650\u0644\u064E\u0670\u0647\u064E \u0625\u0650\u0644\u0651\u064E\u0627 \u0627\u0644\u0644\u0651\u064E\u0647\u064F \u0648\u064E\u062D\u0652\u062F\u064E\u0647\u064F \u0644\u064E\u0627 \u0634\u064E\u0631\u0650\u064A\u0643\u064E \u0644\u064E\u0647',
      latin_text: 'Laa ilaaha illallaahu wahdahu laa syariika lah',
      translation: 'Tiada Tuhan selain Allah, Yang Maha Esa, tiada sekutu bagi-Nya.',
    },
  ]);

  console.log('  Konten ibadah (11 tuntunan + 6 doa) berhasil ditambahkan.');
}
