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
  console.log('Rolling back migrasi terakhir...');
  const [batch, migrations] = await db.migrate.rollback();
  if (migrations.length === 0) {
    console.log('Tidak ada migrasi untuk di-rollback.');
  } else {
    console.log(`Batch ${batch}: ${migrations.length} migrasi di-rollback`);
    for (const m of migrations) console.log(`  - ${path.basename(String(m))}`);
  }
  await db.destroy();
}

run().catch((err) => {
  console.error('Rollback gagal:', err);
  process.exit(1);
});
