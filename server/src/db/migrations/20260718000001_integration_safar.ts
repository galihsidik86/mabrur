import { Knex } from 'knex';

/**
 * Integrasi Safar (back-office travel): kunci korelasi lintas sistem.
 * - external_ref = UUID entitas di Safar (jamaah/group_staff → users; rombongan → groups)
 * - schedules.external_source menandai agenda hasil sinkron (di-replace tiap sinkron;
 *   agenda buatan muthawwif — external_source NULL — tidak disentuh)
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.uuid('external_ref').unique().nullable();
  });
  await knex.schema.alterTable('groups', (t) => {
    t.uuid('external_ref').unique().nullable();
  });
  await knex.schema.alterTable('schedules', (t) => {
    t.string('external_source', 20).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('schedules', (t) => {
    t.dropColumn('external_source');
  });
  await knex.schema.alterTable('groups', (t) => {
    t.dropColumn('external_ref');
  });
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('external_ref');
  });
}
