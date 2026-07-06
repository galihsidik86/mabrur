import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  const has = await knex('miqat_zones').first();
  if (has) return;

  await knex('miqat_zones').insert([
    {
      name: 'Dzulhulaifah (Bir Ali)',
      zone_type: 'miqat',
      center_lat: 24.4097,
      center_lng: 39.5433,
      radius_meters: 1000,
      warning_radius: 3000,
    },
    {
      name: 'Al-Juhfah (Rabigh)',
      zone_type: 'miqat',
      center_lat: 22.7267,
      center_lng: 39.0778,
      radius_meters: 1000,
      warning_radius: 3000,
    },
    {
      name: 'Qarnul Manazil',
      zone_type: 'miqat',
      center_lat: 21.6219,
      center_lng: 40.4344,
      radius_meters: 1000,
      warning_radius: 3000,
    },
    {
      name: 'Yalamlam',
      zone_type: 'miqat',
      center_lat: 20.5489,
      center_lng: 39.8733,
      radius_meters: 1000,
      warning_radius: 3000,
    },
    {
      name: 'Dhat Irq',
      zone_type: 'miqat',
      center_lat: 21.9269,
      center_lng: 40.4161,
      radius_meters: 1000,
      warning_radius: 3000,
    },
    {
      name: 'Tanah Haram',
      zone_type: 'haram',
      center_lat: 21.4225,
      center_lng: 39.8262,
      radius_meters: 12000,
      warning_radius: 1000,
    },
  ]);

  console.log('  Zona miqat (5 miqat + 1 haram) berhasil ditambahkan.');
}
