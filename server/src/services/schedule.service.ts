import { db } from '../db';
import { AppError } from '../middleware/error-handler';
import { audit } from './audit.service';

const FIELDS = [
  'id', 'group_id', 'title', 'location_name',
  'start_time', 'end_time', 'status', 'sort_order', 'updated_at',
];

export async function listByGroup(groupId: string) {
  const group = await db('groups').where('id', groupId).first();
  if (!group) throw new AppError(404, 'Rombongan tidak ditemukan', 'NOT_FOUND');
  return db('schedules').where('group_id', groupId).select(FIELDS).orderBy('sort_order');
}

export async function create(
  groupId: string,
  data: {
    title: string; location_name?: string;
    start_time: string; end_time?: string;
    status?: string; sort_order?: number;
  },
  userId: string,
) {
  const group = await db('groups').where('id', groupId).first();
  if (!group) throw new AppError(404, 'Rombongan tidak ditemukan', 'NOT_FOUND');

  if (!data.sort_order) {
    const last = await db('schedules').where('group_id', groupId).max('sort_order as max').first();
    data.sort_order = (last?.max || 0) + 1;
  }

  const [schedule] = await db('schedules')
    .insert({ ...data, group_id: groupId, updated_by: userId })
    .returning(FIELDS);
  await audit(userId, 'schedule.create', 'schedules', schedule.id, { group_id: groupId });
  return schedule;
}

export async function update(
  id: string,
  data: Partial<{
    title: string; location_name: string;
    start_time: string; end_time: string;
    status: string; sort_order: number;
  }>,
  userId: string,
) {
  const schedule = await db('schedules').where('id', id).first();
  if (!schedule) throw new AppError(404, 'Jadwal tidak ditemukan', 'NOT_FOUND');

  const [updated] = await db('schedules')
    .where('id', id)
    .update({ ...data, updated_by: userId, updated_at: new Date() })
    .returning(FIELDS);
  await audit(userId, 'schedule.update', 'schedules', id);
  return updated;
}

export async function remove(id: string, userId: string) {
  const schedule = await db('schedules').where('id', id).first();
  if (!schedule) throw new AppError(404, 'Jadwal tidak ditemukan', 'NOT_FOUND');
  await db('schedules').where('id', id).delete();
  await audit(userId, 'schedule.delete', 'schedules', id);
}

export async function getGroupIdBySchedule(id: string): Promise<string> {
  const schedule = await db('schedules').where('id', id).select('group_id').first();
  if (!schedule) throw new AppError(404, 'Jadwal tidak ditemukan', 'NOT_FOUND');
  return schedule.group_id;
}
