import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('ratings', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    t.integer('rating').notNullable(); // 1-5
    t.text('feedback');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('chat_queue', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('group_id').notNullable();
    t.uuid('user_id').notNullable();
    t.text('text').notNullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('users', (t) => {
    t.string('theme').defaultTo('light'); // light | dark
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => { t.dropColumn('theme'); });
  await knex.schema.dropTableIfExists('chat_queue');
  await knex.schema.dropTableIfExists('ratings');
}
