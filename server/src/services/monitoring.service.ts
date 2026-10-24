import { db } from '../db';
import { AppError } from '../middleware/error-handler';
import { audit } from './audit.service';
import { sendPush } from './push.service';
import { pushText, tokensByLang } from './push-messages';
import { buildMemberStatuses, pickReminderTargets, reserveReminders, type MemberRow } from './monitoring-core';

export async function getMemberStatuses(groupId: string) {
  const group = await db('groups').where('id', groupId).first();
  if (!group) throw new AppError(404, 'Rombongan tidak ditemukan', 'NOT_FOUND');

  const rows: MemberRow[] = await db('group_members')
    .join('users', 'users.id', 'group_members.user_id')
    .leftJoin('user_locations', 'user_locations.user_id', 'users.id')
    .leftJoin('ihram_status', 'ihram_status.user_id', 'users.id')
    .where({
      'group_members.group_id': groupId,
      'group_members.is_active': true,
    })
    .select(
      'users.id',
      'users.name',
      'users.phone',
      'group_members.role_in_group',
      'user_locations.lat',
      'user_locations.lng',
      'user_locations.updated_at as loc_updated',
      'ihram_status.is_ihram',
      'ihram_status.niat_type',
    );

  const zones = await db('miqat_zones').where('zone_type', 'miqat');
  return buildMemberStatuses(rows, zones, Date.now());
}

// Waktu pengingat terakhir per rombongan -> per jamaah (in-memory; cukup untuk anti-spam
// satu proses PM2 — hilang saat restart, yang hanya berarti satu pengingat ekstra).
const lastReminderAt = new Map<string, Map<string, number>>();

export async function sendLocationReminders(groupId: string, senderId: string, userIds?: string[]) {
  const { members } = await getMemberStatuses(groupId);
  const sentLog = lastReminderAt.get(groupId) ?? new Map<string, number>();
  lastReminderAt.set(groupId, sentLog);
  const now = Date.now();
  const { targets, skipped_cooldown } = pickReminderTargets(members, userIds, sentLog, now);
  // Tanpa await di antara pick dan reserve: request paralel tidak bisa lolos jeda bersamaan.
  reserveReminders(sentLog, targets, now);

  const withToken: Array<{ id: string; push_token: string; language: string | null }> = targets.length === 0 ? [] : await db('users')
    .whereIn('id', targets)
    .where('is_active', true)
    .whereNotNull('push_token')
    .select('id', 'push_token', 'language');

  if (withToken.length > 0) {
    const sender = await db('users').where('id', senderId).select('name').first();
    // Satu push per bahasa penerima (users.language).
    for (const [lang, tokens] of tokensByLang(withToken)) {
      await sendPush(
        tokens,
        pushText(lang, 'reminder.title'),
        pushText(lang, 'reminder.body', { sender: sender?.name || pushText(lang, 'reminder.default_sender') }),
        { type: 'location_reminder', groupId },
        'default',
      );
    }
  }

  await audit(senderId, 'monitoring.location_reminder', 'groups', groupId, {
    sent: withToken.length, skipped_cooldown, targets: targets.length,
  });

  return {
    sent: withToken.length,
    skipped_cooldown,
    no_push_token: targets.length - withToken.length,
  };
}
