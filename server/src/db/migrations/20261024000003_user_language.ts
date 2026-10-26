import { Knex } from 'knex';

/** Permintaan revisi v2 #7: bahasa pilihan pengguna, dipakai server untuk push notification. */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.string('language', 5).notNullable().defaultTo('id');
  });
  await knex.raw(`ALTER TABLE users ADD CONSTRAINT users_language_check CHECK (language IN ('id', 'en'))`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('language');
  });
}
