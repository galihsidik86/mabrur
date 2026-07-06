import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  const group = await knex('groups').where('kloter_code', 'SOC-14').first();
  if (!group) return;

  const has = await knex('schedules').where('group_id', group.id).first();
  if (has) return;

  await knex('schedules').insert([
    {
      group_id: group.id, sort_order: 1, status: 'done',
      title: 'Tiba di Madinah',
      location_name: 'Bandara AMAA',
      start_time: '2026-07-13T21:00:00+03:00',
    },
    {
      group_id: group.id, sort_order: 2, status: 'active',
      title: 'Berangkat ke miqat Bir Ali',
      location_name: 'Dzulhulaifah',
      start_time: '2026-07-14T08:30:00+03:00',
    },
    {
      group_id: group.id, sort_order: 3, status: 'upcoming',
      title: 'Umrah wajib',
      location_name: 'Masjidil Haram',
      start_time: '2026-07-14T14:00:00+03:00',
    },
    {
      group_id: group.id, sort_order: 4, status: 'upcoming',
      title: 'Ihram haji \u2192 Mina',
      location_name: 'Mina',
      start_time: '2026-08-08T06:00:00+03:00',
    },
    {
      group_id: group.id, sort_order: 5, status: 'upcoming',
      title: 'Wukuf di Arafah',
      location_name: 'Padang Arafah',
      start_time: '2026-08-09T12:00:00+03:00',
    },
    {
      group_id: group.id, sort_order: 6, status: 'upcoming',
      title: 'Lontar Jumrah Aqabah',
      location_name: 'Mina',
      start_time: '2026-08-10T05:00:00+03:00',
    },
  ]);

  console.log('  Jadwal rombongan SOC-14 (6 agenda) berhasil ditambahkan.');
}
