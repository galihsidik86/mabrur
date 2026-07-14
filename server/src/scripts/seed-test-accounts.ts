/*
 * Buat akun uji muthawwif + jamaah untuk pengujian aplikasi.
 *
 *   MUTHAWWIF_PASSWORD='...' JAMAAH_PASSWORD='...' npm run seed-test-accounts
 *
 * Password dibaca dari environment variable (tidak tersimpan di file/git).
 * Idempotent: jika phone sudah ada, password-nya di-update (akun tidak diduplikasi)
 * dan semua sesi lama dicabut. Phone default bisa ditimpa via env.
 */
import knex from 'knex';
import bcrypt from 'bcryptjs';
import { config } from '../config';

const db = knex({ client: 'pg', connection: config.DATABASE_URL });

interface AcctSpec { phone: string; name: string; role: 'muthawwif' | 'jamaah'; password: string | undefined; }

async function upsert(a: AcctSpec) {
  if (!a.password || a.password.length < 6) {
    throw new Error(`password untuk ${a.role} kosong / < 6 karakter (set env-nya)`);
  }
  const hash = await bcrypt.hash(a.password, 12);
  const existing = await db('users').where('phone', a.phone).first();
  if (existing) {
    await db('users').where('id', existing.id).update({
      password_hash: hash, name: a.name, role: a.role, is_active: true,
    });
    await db('refresh_tokens').where('user_id', existing.id).delete();
    console.log(`  [update] ${a.role.padEnd(9)} ${a.phone}  (${a.name}) — password diganti, sesi lama dicabut`);
  } else {
    await db('users').insert({ phone: a.phone, password_hash: hash, name: a.name, role: a.role });
    console.log(`  [baru]   ${a.role.padEnd(9)} ${a.phone}  (${a.name})`);
  }
}

async function run() {
  const accounts: AcctSpec[] = [
    {
      phone: process.env.MUTHAWWIF_PHONE || '08111111111',
      name: process.env.MUTHAWWIF_NAME || 'Muthawwif Uji',
      role: 'muthawwif',
      password: process.env.MUTHAWWIF_PASSWORD,
    },
    {
      phone: process.env.JAMAAH_PHONE || '08222222222',
      name: process.env.JAMAAH_NAME || 'Jamaah Uji',
      role: 'jamaah',
      password: process.env.JAMAAH_PASSWORD,
    },
  ];

  console.log('Membuat/memperbarui akun uji:');
  for (const a of accounts) await upsert(a);
  console.log('\nSelesai. Login pakai phone di atas + password yang Anda set.');
  console.log('(Password tidak ditampilkan — hanya Anda yang tahu dari env.)');
}

run()
  .catch((e) => { console.error('GAGAL:', e.message); process.exit(1); })
  .finally(() => db.destroy());
