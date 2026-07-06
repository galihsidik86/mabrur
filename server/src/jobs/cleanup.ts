import { db } from '../db';

export async function cleanExpiredTokens(): Promise<number> {
  const result = await db('refresh_tokens')
    .where('expires_at', '<', new Date())
    .delete();
  return result;
}

export async function cleanOldAuditLogs(daysToKeep = 90): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysToKeep);
  const result = await db('audit_logs')
    .where('created_at', '<', cutoff)
    .delete();
  return result;
}

// Run standalone: tsx src/jobs/cleanup.ts
if (require.main === module) {
  (async () => {
    console.log('Menjalankan cleanup...');
    const tokens = await cleanExpiredTokens();
    console.log(`  ${tokens} refresh token kedaluwarsa dihapus`);
    const logs = await cleanOldAuditLogs();
    console.log(`  ${logs} audit log lama (>90 hari) dihapus`);
    await db.destroy();
    console.log('Cleanup selesai.');
  })();
}
