import { Knex } from 'knex';

/**
 * Permintaan revisi v2 #6 — Kartu Taksi di SOS.
 * Data hotel diisi admin/muthawwif sekali per rombongan (Makkah & Madinah), lalu
 * berlaku untuk semua jamaah. Nomor kamar per anggota per kota (biasanya berbeda).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('group_hotels', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE');
    t.string('city', 10).notNullable(); // 'makkah' | 'madinah' (divalidasi di API)
    t.string('name_ar', 150).notNullable();
    t.string('name_latin', 150);
    t.string('address_ar', 500).notNullable();
    t.string('phone', 30);
    t.timestamps(true, true);
    t.unique(['group_id', 'city']);
  });
  await knex.raw(`ALTER TABLE group_hotels ADD CONSTRAINT group_hotels_city_check CHECK (city IN ('makkah', 'madinah'))`);

  await knex.schema.alterTable('group_members', (t) => {
    t.string('room_makkah', 20);
    t.string('room_madinah', 20);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('group_members', (t) => {
    t.dropColumn('room_makkah');
    t.dropColumn('room_madinah');
  });
  await knex.schema.dropTableIfExists('group_hotels');
}
