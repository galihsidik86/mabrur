import { Knex } from 'knex';

/**
 * Permintaan revisi v2 #2b — video Dokumentasi (maks 60 detik, 720p; lihat media-core.ts).
 * Durasi dari HP disimpan untuk label di album; jenis & ukuran diperiksa server dari isi berkas.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('group_media', (t) => {
    t.integer('duration_ms');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('group_media', (t) => {
    t.dropColumn('duration_ms');
  });
}
