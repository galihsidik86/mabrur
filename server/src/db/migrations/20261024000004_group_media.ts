import { Knex } from 'knex';

/**
 * Permintaan revisi v2 #2 — Dokumentasi foto (video menyusul di 2b, kolom `kind` sudah disiapkan).
 * Berkas disimpan di luar folder publik /uploads (server/storage/media/<group_id>/), hanya dilayani
 * lewat endpoint yang memeriksa keanggotaan rombongan. Kuota & masa simpan: lihat media-core.ts.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('group_media', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE');
    t.uuid('uploader_id').references('id').inTable('users').onDelete('SET NULL');
    t.uuid('schedule_id').references('id').inTable('schedules').onDelete('SET NULL');
    t.string('kind', 10).notNullable().defaultTo('photo');
    t.string('mime', 40).notNullable();
    t.string('file_name', 80).notNullable();
    t.string('thumb_name', 80);
    t.integer('size_bytes').notNullable();
    t.integer('thumb_bytes').notNullable().defaultTo(0);
    t.integer('width');
    t.integer('height');
    t.string('caption', 200);
    t.boolean('is_official').notNullable().defaultTo(false);
    t.timestamp('taken_at', { useTz: true }).notNullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('expires_at', { useTz: true }).notNullable();
    // Kunci idempoten dari antrean HP: unggah ulang foto yang sama (respons sempat hilang) tidak menggandakan.
    t.uuid('client_uuid');
    t.index(['group_id', 'taken_at']);
    t.index(['expires_at']);
  });
  await knex.raw(`ALTER TABLE group_media ADD CONSTRAINT group_media_kind_check CHECK (kind IN ('photo', 'video'))`);
  await knex.raw(
    'CREATE UNIQUE INDEX group_media_client_uuid_unique ON group_media (group_id, uploader_id, client_uuid) WHERE client_uuid IS NOT NULL',
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('group_media');
}
