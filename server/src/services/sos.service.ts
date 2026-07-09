import { db } from '../db';
import { AppError } from '../middleware/error-handler';
import { audit } from './audit.service';
import { notifyGroupMuthawwif } from './push.service';

const FIELDS = [
  'sos_alerts.id', 'sos_alerts.user_id', 'sos_alerts.group_id',
  'sos_alerts.category', 'sos_alerts.lat', 'sos_alerts.lng',
  'sos_alerts.status', 'sos_alerts.created_at', 'sos_alerts.resolved_at',
];

export async function create(
  userId: string,
  data: { category: string; lat?: number; lng?: number },
) {
  // Cek SOS aktif — satu user hanya boleh punya satu SOS aktif
  const active = await db('sos_alerts')
    .where({ user_id: userId, status: 'active' })
    .first();
  if (active) throw new AppError(409, 'Kamu sudah memiliki SOS aktif', 'DUPLICATE');

  // Cari group user
  const membership = await db('group_members')
    .where({ user_id: userId, is_active: true })
    .first();

  const [sos] = await db('sos_alerts')
    .insert({
      user_id: userId,
      group_id: membership?.group_id ?? null,
      category: data.category,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
    })
    .returning('*');

  await audit(userId, 'sos.create', 'sos_alerts', sos.id, { category: data.category });

  // Push notification ke muthawwif
  if (membership?.group_id) {
    const user = await db('users').where('id', userId).select('name').first();
    const catLabel: Record<string, string> = { medis: 'Medis', tersesat: 'Tersesat', kehilangan: 'Kehilangan' };
    notifyGroupMuthawwif(
      membership.group_id,
      'SOS Darurat',
      `${user?.name || 'Jamaah'} butuh bantuan (${catLabel[data.category] || data.category})`,
      { type: 'sos', sosId: sos.id },
    ).catch(() => {});
  }
  return sos;
}

export async function getActive(userId: string) {
  return db('sos_alerts')
    .where({ user_id: userId, status: 'active' })
    .first();
}

export async function cancel(id: string, userId: string) {
  const sos = await db('sos_alerts').where('id', id).first();
  if (!sos) throw new AppError(404, 'SOS tidak ditemukan', 'NOT_FOUND');
  if (sos.user_id !== userId) throw new AppError(403, 'Bukan SOS milikmu', 'FORBIDDEN');
  if (sos.status !== 'active') throw new AppError(400, 'SOS sudah tidak aktif', 'INVALID_STATE');

  const [updated] = await db('sos_alerts')
    .where('id', id)
    .update({ status: 'cancelled', resolved_at: new Date() })
    .returning('*');

  await audit(userId, 'sos.cancel', 'sos_alerts', id);
  return updated;
}

export async function resolve(id: string, resolvedBy: string) {
  // Perbaikan: gunakan WHERE status='active' pada UPDATE untuk mencegah race condition
  // Sebelumnya ada celah TOCTOU antara SELECT dan UPDATE
  const [updated] = await db('sos_alerts')
    .where({ id, status: 'active' })
    .update({ status: 'resolved', resolved_by: resolvedBy, resolved_at: new Date() })
    .returning('*');

  if (!updated) {
    const exists = await db('sos_alerts').where('id', id).first();
    if (!exists) throw new AppError(404, 'SOS tidak ditemukan', 'NOT_FOUND');
    throw new AppError(400, 'SOS sudah tidak aktif', 'INVALID_STATE');
  }

  await audit(resolvedBy, 'sos.resolve', 'sos_alerts', id);
  return updated;
}

export async function listByGroup(groupId: string) {
  return db('sos_alerts')
    .join('users', 'users.id', 'sos_alerts.user_id')
    .where({ 'sos_alerts.group_id': groupId, 'sos_alerts.status': 'active' })
    .select(
      ...FIELDS,
      'users.name as user_name',
      'users.phone as user_phone',
    )
    .orderBy('sos_alerts.created_at', 'desc');
}
