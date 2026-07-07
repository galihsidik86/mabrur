import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Ziarah / tempat penting
  await knex.schema.createTable('ziarah_places', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name').notNullable();
    t.text('description');
    t.string('category').notNullable(); // masjid, bersejarah, alam
    t.string('location_name');
    t.double('lat');
    t.double('lng');
    t.text('tips');
    t.integer('sort_order').defaultTo(0);
    t.timestamps(true, true);
  });

  // Group chat messages
  await knex.schema.createTable('messages', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('group_id').references('id').inTable('groups').onDelete('CASCADE').notNullable();
    t.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    t.text('text').notNullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.index(['group_id', 'created_at']);
  });

  // SOS photo
  await knex.schema.alterTable('sos_alerts', (t) => {
    t.text('photo_url').nullable();
  });

  // Onboarding flag
  await knex.schema.alterTable('users', (t) => {
    t.boolean('onboarded').defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => { t.dropColumn('onboarded'); });
  await knex.schema.alterTable('sos_alerts', (t) => { t.dropColumn('photo_url'); });
  await knex.schema.dropTableIfExists('messages');
  await knex.schema.dropTableIfExists('ziarah_places');
}
