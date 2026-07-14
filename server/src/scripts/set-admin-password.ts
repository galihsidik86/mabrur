/*
 * Ganti password akun admin di database.
 *
 *   NEW_ADMIN_PASSWORD='PasswordKuatAnda' npm run set-admin-pass
 *   NEW_ADMIN_PASSWORD='...' ADMIN_PHONE='08xxxx' npm run set-admin-pass
 *
 * Password dibaca dari environment variable agar TIDAK pernah tersimpan di file
 * maupun histori git. Semua refresh token akun tersebut dihapus (sesi lama
 * langsung tidak berlaku). Jalankan di server produksi setelah deploy.
 */
import knex from 'knex';
import bcrypt from 'bcryptjs';
import { config } from '../config';

const db = knex({ client: 'pg', connection: config.DATABASE_URL });

async function run() {
  const pwd = process.env.NEW_ADMIN_PASSWORD;
  const phone = process.env.ADMIN_PHONE || '08000000001';

  if (!pwd || pwd.length < 8) {
    console.error('GAGAL: set NEW_ADMIN_PASSWORD (minimal 8 karakter).');
    console.error("Contoh: NEW_ADMIN_PASSWORD='PasswordKuatAnda' npm run set-admin-pass");
    process.exit(1);
  }

  const user = await db('users').where('phone', phone).first();
  if (!user) {
    console.error(`GAGAL: user dengan phone ${phone} tidak ditemukan.`);
    process.exit(1);
  }

  const hash = await bcrypt.hash(pwd, 12);
  await db('users').where('id', user.id).update({ password_hash: hash });
  const removed = await db('refresh_tokens').where('user_id', user.id).delete();

  console.log(`OK: password untuk ${user.name} (${phone}, role: ${user.role}) berhasil diganti.`);
  console.log(`    ${removed} sesi lama dicabut. Login ulang dengan password baru.`);
}

run()
  .catch((e) => { console.error('GAGAL:', e.message); process.exit(1); })
  .finally(() => db.destroy());
