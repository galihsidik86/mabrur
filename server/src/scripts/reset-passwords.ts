/*
 * Reset password massal (untuk lingkungan uji).
 *
 *   npm run reset-passwords                 # DRY-RUN: hanya menampilkan daftar
 *   npm run reset-passwords -- --yes        # terapkan (password random per user, dicetak)
 *   RESET_PASSWORD='Kata$andi9' npm run reset-passwords -- --yes   # password seragam
 *   npm run reset-passwords -- --yes --roles muthawwif,jamaah      # batasi role
 *   npm run reset-passwords -- --yes --include-admin               # ikut reset admin
 *
 * PERINGATAN: mengubah password user ASLI dan mencabut semua sesi mereka.
 * Password baru (kalau random) HANYA muncul di keluaran ini — catat sebelum hilang.
 * Default: admin DIKECUALIKAN (agar tak terkunci), dan tanpa --yes tidak ada
 * perubahan apa pun.
 */
import knex from 'knex';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { config } from '../config';

const db = knex({ client: 'pg', connection: config.DATABASE_URL });

// password acak mudah dibaca (tanpa karakter ambigu)
function genPassword(): string {
  const alfa = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buf = randomBytes(10);
  let out = '';
  for (let i = 0; i < 10; i++) out += alfa[buf[i] % alfa.length];
  return out + '#7'; // pastikan lolos aturan min length & variasi
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--yes');
  const includeAdmin = argv.includes('--include-admin');
  const ri = argv.indexOf('--roles');
  const roles = ri >= 0 && argv[ri + 1]
    ? argv[ri + 1].split(',').map((s) => s.trim())
    : (includeAdmin ? ['admin', 'muthawwif', 'jamaah'] : ['muthawwif', 'jamaah']);
  return { apply, roles };
}

async function run() {
  const { apply, roles } = parseArgs();
  const fixed = process.env.RESET_PASSWORD;
  if (fixed && fixed.length < 6) throw new Error('RESET_PASSWORD minimal 6 karakter');

  const users = await db('users').whereIn('role', roles).orderBy('role').orderBy('phone');
  if (users.length === 0) {
    console.log(`Tidak ada user dengan role: ${roles.join(', ')}`);
    return;
  }

  console.log(`Mode: ${apply ? 'TERAPKAN' : 'DRY-RUN (tidak ada perubahan)'}`);
  console.log(`Role disertakan: ${roles.join(', ')}  |  Password: ${fixed ? 'seragam (RESET_PASSWORD)' : 'random per user'}`);
  console.log('');
  console.log('ROLE       PHONE           NAMA                          PASSWORD BARU');
  console.log('-'.repeat(78));

  const rows: Array<{ id: string; phone: string; pwd: string }> = [];
  for (const u of users) {
    const pwd = fixed || genPassword();
    rows.push({ id: u.id, phone: u.phone, pwd });
    const shown = fixed ? '(sesuai RESET_PASSWORD)' : pwd;
    console.log(`${String(u.role).padEnd(10)} ${String(u.phone).padEnd(15)} ${String(u.name).slice(0, 28).padEnd(29)} ${shown}`);
  }

  if (!apply) {
    console.log('\nDRY-RUN selesai. Tambah "--yes" untuk benar-benar mengganti password.');
    return;
  }

  let n = 0;
  for (const r of rows) {
    const hash = await bcrypt.hash(r.pwd, 12);
    await db('users').where('id', r.id).update({ password_hash: hash });
    await db('refresh_tokens').where('user_id', r.id).delete();
    n++;
  }
  console.log(`\nSelesai: ${n} password direset, semua sesi lama dicabut.`);
  if (!fixed) console.log('Catat tabel di atas — password random tidak bisa ditampilkan ulang.');
}

run()
  .catch((e) => { console.error('GAGAL:', e.message); process.exit(1); })
  .finally(() => db.destroy());
