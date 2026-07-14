import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Rekaman trace GPS dari mode Perekam GPS (riset validasi lapangan).
  // Titik disimpan sebagai JSONB [{t,lat,lon,acc}] — satu sesi ±2.000 titik
  // (~150 KB), jauh di bawah batas praktis JSONB.
  await knex.schema.createTable('gps_trace_sessions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    t.string('label').notNullable();
    t.bigInteger('started_at').notNullable(); // epoch ms
    t.bigInteger('ended_at');                 // epoch ms
    t.integer('point_count').notNullable();
    t.jsonb('points').notNullable();
    t.string('device');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('gps_trace_sessions');
}
