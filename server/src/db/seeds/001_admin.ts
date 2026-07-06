import { Knex } from 'knex';
import bcrypt from 'bcryptjs';

export async function seed(knex: Knex): Promise<void> {
  const exists = await knex('users').where('phone', '08000000001').first();
  if (exists) return;

  const hash = await bcrypt.hash('admin123', 12);
  await knex('users').insert({
    phone: '08000000001',
    password_hash: hash,
    name: 'Administrator',
    role: 'admin',
  });
  console.log('  Admin dibuat: 08000000001 / admin123 (GANTI password di production!)');
}
