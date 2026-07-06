import knex from 'knex';
import path from 'path';
import { config } from '../config';

const db = knex({
  client: 'pg',
  connection: config.DATABASE_URL,
  migrations: {
    directory: path.join(__dirname, 'migrations'),
    extension: 'ts',
  },
});

async function run() {
  console.log('Menjalankan migrasi...');
  const [batch, migrations] = await db.migrate.latest();
  if (migrations.length === 0) {
    console.log('Database sudah up-to-date.');
  } else {
    console.log(`Batch ${batch}: ${migrations.length} migrasi berhasil`);
    for (const m of migrations) console.log(`  + ${path.basename(String(m))}`);
  }
  await db.destroy();
}

run().catch((err) => {
  console.error('Migrasi gagal:', err);
  process.exit(1);
});
