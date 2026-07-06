import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('ibadah_guides', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.enu('type', ['umrah', 'haji'], {
      useNative: true,
      enumName: 'ibadah_type',
    }).notNullable();
    t.integer('step_number').notNullable();
    t.string('title').notNullable();
    t.string('subtitle');
    t.text('steps_text');
    t.text('arabic_text');
    t.text('latin_text');
    t.uuid('updated_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);
    t.unique(['type', 'step_number']);
  });

  await knex.schema.createTable('duas', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('title').notNullable();
    t.string('context');
    t.text('arabic_text');
    t.text('latin_text');
    t.text('translation');
    t.integer('sort_order').notNullable().defaultTo(0);
    t.uuid('updated_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('duas');
  await knex.schema.dropTableIfExists('ibadah_guides');
  await knex.raw('DROP TYPE IF EXISTS ibadah_type');
}
