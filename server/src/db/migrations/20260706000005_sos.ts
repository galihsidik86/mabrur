import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('sos_alerts', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    t.uuid('group_id').references('id').inTable('groups').onDelete('CASCADE');
    t.string('category').notNullable(); // medis, tersesat, kehilangan
    t.double('lat');
    t.double('lng');
    t.string('status').notNullable().defaultTo('active'); // active, resolved, cancelled
    t.uuid('resolved_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('resolved_at');
    t.index(['group_id', 'status']);
    t.index(['user_id', 'status']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('sos_alerts');
}
