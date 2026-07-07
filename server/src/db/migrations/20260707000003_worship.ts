import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Logbook ibadah harian
  await knex.schema.createTable('logbook', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    t.date('date').notNullable();
    t.text('content');
    t.text('mood'); // grateful, reflective, tired, inspired
    t.timestamps(true, true);
    t.unique(['user_id', 'date']);
  });

  // Bookmark doa
  await knex.schema.createTable('dua_bookmarks', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    t.uuid('dua_id').references('id').inTable('duas').onDelete('CASCADE').notNullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.unique(['user_id', 'dua_id']);
  });

  // Checklist persiapan
  await knex.schema.createTable('checklist_items', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    t.string('text').notNullable();
    t.string('category'); // dokumen, pakaian, obat, elektronik, lainnya
    t.boolean('checked').defaultTo(false);
    t.integer('sort_order').defaultTo(0);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Saved locations (hotel, dll)
  await knex.schema.createTable('saved_locations', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    t.string('name').notNullable();
    t.double('lat').notNullable();
    t.double('lng').notNullable();
    t.text('notes');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Tawaf/Sai counter sessions
  await knex.schema.createTable('counter_sessions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    t.string('type').notNullable(); // tawaf, sai, dzikir
    t.integer('count').defaultTo(0);
    t.integer('target').defaultTo(7);
    t.string('label');
    t.boolean('completed').defaultTo(false);
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('completed_at');
  });

  // Frasa Arab
  await knex.schema.createTable('arabic_phrases', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('category').notNullable();
    t.string('indonesian').notNullable();
    t.string('arabic').notNullable();
    t.string('transliteration');
    t.integer('sort_order').defaultTo(0);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('arabic_phrases');
  await knex.schema.dropTableIfExists('counter_sessions');
  await knex.schema.dropTableIfExists('saved_locations');
  await knex.schema.dropTableIfExists('checklist_items');
  await knex.schema.dropTableIfExists('dua_bookmarks');
  await knex.schema.dropTableIfExists('logbook');
}
