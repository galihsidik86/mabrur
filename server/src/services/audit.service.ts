import { db } from '../db';

export async function audit(
  userId: string,
  action: string,
  entity?: string,
  entityId?: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    await db('audit_logs').insert({
      user_id: userId,
      action,
      entity: entity ?? null,
      entity_id: entityId ?? null,
      details: details ? JSON.stringify(details) : null,
    });
  } catch (err) {
    console.error('[AUDIT] Gagal menulis audit log:', err);
  }
}
