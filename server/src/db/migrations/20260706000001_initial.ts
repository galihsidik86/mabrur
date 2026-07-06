import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('phone', 20).unique().notNullable();
    t.string('password_hash').notNullable();
    t.string('name').notNullable();
    t.enu('role', ['admin', 'muthawwif', 'jamaah'], {
      useNative: true,
      enumName: 'user_role',
    }).notNullable().defaultTo('jamaah');
    t.text('passport_no');     // encrypted at app layer
    t.string('blood_type', 10);
    t.text('medical_notes');   // encrypted at app layer
    t.string('emergency_contact');
    t.string('push_token');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('groups', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name').notNullable();
    t.string('kloter_code').unique().notNullable();
    t.integer('year').notNullable();
    t.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('group_members', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('group_id').references('id').inTable('groups').onDelete('CASCADE').notNullable();
    t.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    t.enu('role_in_group', ['jamaah', 'muthawwif'], {
      useNative: true,
      enumName: 'group_role',
    }).notNullable().defaultTo('jamaah');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamp('joined_at').notNullable().defaultTo(knex.fn.now());
    t.unique(['group_id', 'user_id']);
  });

  await knex.schema.createTable('refresh_tokens', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    t.string('token_hash').unique().notNullable();
    t.timestamp('expires_at').notNullable();
    t.timestamps(true, true);
    t.index('user_id');
    t.index('expires_at');
  });

  await knex.schema.createTable('audit_logs', (t) => {
    t.bigIncrements('id').primary();
    t.uuid('user_id').references('id').inTable('users').onDelete('SET NULL');
    t.string('action').notNullable();
    t.string('entity');
    t.uuid('entity_id');
    t.jsonb('details');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.index(['user_id', 'created_at']);
    t.index('action');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('refresh_tokens');
  await knex.schema.dropTableIfExists('group_members');
  await knex.schema.dropTableIfExists('groups');
  await knex.schema.dropTableIfExists('users');
  await knex.raw('DROP TYPE IF EXISTS group_role');
  await knex.raw('DROP TYPE IF EXISTS user_role');
}
