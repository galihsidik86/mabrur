import knex from 'knex';
import path from 'path';
import { config } from '../config';

const db = knex({
  client: 'pg',
  connection: config.DATABASE_URL,
  seeds: {
    directory: path.join(__dirname, 'seeds'),
    extension: 'ts',
  },
});

async function run() {
  console.log('Menjalankan seed...');
  const [seeds] = await db.seed.run();
  console.log(`${seeds.length} seed berhasil dijalankan.`);
  await db.destroy();
}

run().catch((err) => {
  console.error('Seed gagal:', err);
  process.exit(1);
});
