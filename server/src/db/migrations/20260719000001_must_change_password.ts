import { Knex } from 'knex';

/**
 * Wajib ganti password saat login pertama — utk akun yang password awalnya
 * diketahui pihak lain (dibuat via sinkron Safar, atau di-reset admin).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.boolean('must_change_password').notNullable().defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('must_change_password');
  });
}
