import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('miqat_zones', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name').notNullable();
    t.string('zone_type').notNullable(); // 'miqat' | 'haram'
    t.double('center_lat').notNullable();
    t.double('center_lng').notNullable();
    t.integer('radius_meters').notNullable();
    t.integer('warning_radius').notNullable().defaultTo(3000);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('ihram_status', (t) => {
    t.uuid('user_id').primary().references('id').inTable('users').onDelete('CASCADE');
    t.boolean('is_ihram').notNullable().defaultTo(false);
    t.string('niat_type', 10); // 'umrah' | 'haji'
    t.timestamp('changed_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('user_locations', (t) => {
    t.uuid('user_id').primary().references('id').inTable('users').onDelete('CASCADE');
    t.double('lat').notNullable();
    t.double('lng').notNullable();
    t.float('accuracy');
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_locations');
  await knex.schema.dropTableIfExists('ihram_status');
  await knex.schema.dropTableIfExists('miqat_zones');
}
