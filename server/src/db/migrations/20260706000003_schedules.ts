import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('schedules', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('group_id').references('id').inTable('groups').onDelete('CASCADE').notNullable();
    t.string('title').notNullable();
    t.string('location_name');
    t.timestamp('start_time').notNullable();
    t.timestamp('end_time');
    t.enu('status', ['upcoming', 'active', 'done'], {
      useNative: true,
      enumName: 'schedule_status',
    }).notNullable().defaultTo('upcoming');
    t.integer('sort_order').notNullable().defaultTo(0);
    t.uuid('updated_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);
    t.index(['group_id', 'sort_order']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('schedules');
  await knex.raw('DROP TYPE IF EXISTS schedule_status');
}
