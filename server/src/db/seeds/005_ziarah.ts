import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  const has = await knex('ziarah_places').first();
  if (has) return;

  await knex('ziarah_places').insert([
    { sort_order: 1, name: 'Masjidil Haram', category: 'masjid', location_name: 'Makkah', lat: 21.4225, lng: 39.8262, description: 'Masjid suci umat Islam, tempat Ka\'bah berada. Pusat ibadah haji dan umrah.', tips: 'Datang di luar jam puncak untuk tawaf yang lebih nyaman. Pintu masuk terdekat untuk tawaf: King Abdul Aziz Gate.' },
    { sort_order: 2, name: 'Masjid Nabawi', category: 'masjid', location_name: 'Madinah', lat: 24.4672, lng: 39.6112, description: 'Masjid Nabi Muhammad SAW di Madinah. Salat di masjid ini pahalanya 1.000 kali lipat.', tips: 'Raudhah buka setelah Subuh untuk jamaah wanita. Antri dari pintu 25 (King Fahd Gate).' },
    { sort_order: 3, name: 'Raudhah', category: 'masjid', location_name: 'Dalam Masjid Nabawi', lat: 24.4674, lng: 39.6114, description: 'Area antara mimbar dan makam Nabi SAW. Disebut "Taman Surga" — salah satu tempat mustajab berdoa.', tips: 'Jadwal terbatas, datang lebih awal. Bawa sajadah kecil.' },
    { sort_order: 4, name: 'Jabal Rahmah', category: 'bersejarah', location_name: 'Padang Arafah', lat: 21.3549, lng: 39.9842, description: 'Bukit tempat bertemunya Adam dan Hawa. Lokasi wukuf saat haji.', tips: 'Bawa air dan payung, sangat panas. Tidak wajib naik ke puncak.' },
    { sort_order: 5, name: 'Gua Hira', category: 'bersejarah', location_name: 'Jabal Nur, Makkah', lat: 21.4575, lng: 39.8583, description: 'Tempat turunnya wahyu pertama (Surah Al-Alaq). Nabi Muhammad SAW sering bertahannus di sini.', tips: 'Pendakian ~1.5 jam, bawa air. Sebaiknya naik pagi hari saat sejuk.' },
    { sort_order: 6, name: 'Jabal Tsur', category: 'bersejarah', location_name: 'Selatan Makkah', lat: 21.3767, lng: 39.8486, description: 'Gua tempat Nabi SAW dan Abu Bakar bersembunyi saat hijrah ke Madinah selama 3 hari.', tips: 'Pendakian lebih berat dari Jabal Nur. Tidak direkomendasikan untuk lansia.' },
    { sort_order: 7, name: 'Maqam Ibrahim', category: 'bersejarah', location_name: 'Dalam Masjidil Haram', lat: 21.4225, lng: 39.8264, description: 'Batu tempat Nabi Ibrahim AS berdiri saat membangun Ka\'bah. Salat 2 rakaat setelah tawaf dilakukan di belakangnya.', tips: 'Jika area terlalu ramai, boleh salat di mana saja dalam masjid dengan menghadap Maqam.' },
    { sort_order: 8, name: 'Sumur Zamzam', category: 'bersejarah', location_name: 'Dalam Masjidil Haram', lat: 21.4225, lng: 39.8265, description: 'Air suci yang dipercaya memiliki berkah. Bermula dari kisah Hajar dan Ismail AS.', tips: 'Air Zamzam tersedia gratis di dispenser seluruh masjid. Berdoa saat minum.' },
  ]);

  console.log('  Tempat ziarah (8 lokasi) berhasil ditambahkan.');
}
