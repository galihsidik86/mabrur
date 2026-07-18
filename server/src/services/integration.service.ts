import bcrypt from 'bcryptjs';
import { Knex } from 'knex';
import { db } from '../db';
import { AppError } from '../middleware/error-handler';
import { encrypt } from './crypto.service';
import { audit } from './audit.service';
import * as sosService from './sos.service';
import { getMemberStatuses } from './monitoring.service';

/**
 * Integrasi Safar — sinkronisasi rombongan dari back-office.
 * Idempoten: upsert berbasis external_ref (UUID entitas Safar); aman diulang.
 * TIDAK menyentuh algoritme geospasial / artefak riset.
 */

export interface SyncMemberInput {
  externalRef: string;
  phone: string;
  name: string;
  role: 'jamaah' | 'muthawwif';
  passportNo?: string | null;
  emergencyContact?: string | null;
  initialPassword?: string | null; // dipakai HANYA saat membuat user baru
}

export interface SyncPayload {
  group: { externalRef: string; name: string; kloterCode: string; year: number };
  members: SyncMemberInput[];
  schedules?: { title: string; locationName?: string | null; startTime: string; endTime?: string | null; sortOrder?: number }[];
}

export interface MemberResult {
  externalRef: string;
  phone: string;
  status: 'created' | 'updated' | 'conflict';
  mabrurUserId?: string;
  message?: string;
}

export async function syncFromSafar(payload: SyncPayload) {
  return db.transaction(async (trx) => {
    // ===== Group: upsert by external_ref (adopsi by kloter_code bila belum tertaut) =====
    let group = await trx('groups').where('external_ref', payload.group.externalRef).first();
    let groupStatus: 'created' | 'updated' = 'updated';
    if (!group) {
      const byKloter = await trx('groups').where('kloter_code', payload.group.kloterCode).first();
      if (byKloter && !byKloter.external_ref) {
        [group] = await trx('groups')
          .where('id', byKloter.id)
          .update({ external_ref: payload.group.externalRef, updated_at: new Date() })
          .returning('*');
      } else if (byKloter) {
        throw new AppError(409, `kloter_code ${payload.group.kloterCode} sudah dipakai rombongan lain`, 'KLOTER_CONFLICT');
      }
    }
    if (group) {
      [group] = await trx('groups')
        .where('id', group.id)
        .update({
          name: payload.group.name,
          kloter_code: payload.group.kloterCode,
          year: payload.group.year,
          updated_at: new Date(),
        })
        .returning('*');
    } else {
      groupStatus = 'created';
      [group] = await trx('groups')
        .insert({
          external_ref: payload.group.externalRef,
          name: payload.group.name,
          kloter_code: payload.group.kloterCode,
          year: payload.group.year,
        })
        .returning('*');
    }

    // ===== Members: upsert users + keanggotaan =====
    const results: MemberResult[] = [];
    const syncedUserIds: string[] = [];

    for (const m of payload.members) {
      const result = await upsertMember(trx, group.id, m);
      results.push(result);
      if (result.mabrurUserId) syncedUserIds.push(result.mabrurUserId);
    }

    // Anggota hasil sinkron sebelumnya yang tidak lagi dikirim → nonaktifkan keanggotaannya.
    // Anggota yang ditambahkan manual oleh admin Mabrur (users.external_ref NULL) tidak disentuh.
    await trx('group_members')
      .whereIn(
        'user_id',
        trx('users').select('id').whereNotNull('external_ref'),
      )
      .where('group_id', group.id)
      .where('is_active', true)
      .whereNotIn('user_id', syncedUserIds.length ? syncedUserIds : ['00000000-0000-0000-0000-000000000000'])
      .update({ is_active: false });

    // ===== Schedules: replace baris hasil sinkron; agenda muthawwif dibiarkan =====
    let scheduleCount = 0;
    if (payload.schedules) {
      await trx('schedules').where({ group_id: group.id, external_source: 'safar' }).del();
      for (const s of payload.schedules) {
        await trx('schedules').insert({
          group_id: group.id,
          title: s.title,
          location_name: s.locationName ?? null,
          start_time: new Date(s.startTime),
          end_time: s.endTime ? new Date(s.endTime) : null,
          status: 'upcoming',
          sort_order: s.sortOrder ?? 0,
          external_source: 'safar',
        });
        scheduleCount++;
      }
    }

    await audit(null as unknown as string, 'integration.safar.sync', 'groups', group.id, {
      externalRef: payload.group.externalRef,
      members: results.length,
      conflicts: results.filter((r) => r.status === 'conflict').length,
      schedules: scheduleCount,
    });

    return {
      mabrurGroupId: group.id as string,
      group: groupStatus,
      members: results,
      schedules: scheduleCount,
    };
  });
}

async function upsertMember(
  trx: Knex.Transaction,
  groupId: string,
  m: SyncMemberInput,
): Promise<MemberResult> {
  // 1) Cari by external_ref, lalu adopsi by phone (akun lama yang belum tertaut)
  let user = await trx('users').where('external_ref', m.externalRef).first();
  let created = false;

  if (!user) {
    const byPhone = await trx('users').where('phone', m.phone).first();
    if (byPhone) {
      if (byPhone.external_ref && byPhone.external_ref !== m.externalRef) {
        return {
          externalRef: m.externalRef,
          phone: m.phone,
          status: 'conflict',
          message: 'Nomor HP sudah dipakai akun lain yang tertaut ke data Safar berbeda',
        };
      }
      [user] = await trx('users')
        .where('id', byPhone.id)
        .update({ external_ref: m.externalRef, updated_at: new Date() })
        .returning('*');
    }
  }

  if (!user) {
    // 2) Buat baru — initialPassword wajib
    if (!m.initialPassword || m.initialPassword.length < 6) {
      return {
        externalRef: m.externalRef,
        phone: m.phone,
        status: 'conflict',
        message: 'initialPassword (min 6) wajib untuk anggota baru',
      };
    }
    created = true;
    const hash = await bcrypt.hash(m.initialPassword, 12);
    [user] = await trx('users')
      .insert({
        external_ref: m.externalRef,
        phone: m.phone,
        password_hash: hash,
        name: m.name,
        role: m.role,
        passport_no: m.passportNo ? encrypt(m.passportNo) : null,
        emergency_contact: m.emergencyContact ?? null,
      })
      .returning('*');
  } else {
    // 3) Update data induk (password TIDAK di-reset)
    const update: Record<string, unknown> = {
      name: m.name,
      passport_no: m.passportNo ? encrypt(m.passportNo) : user.passport_no,
      emergency_contact: m.emergencyContact ?? user.emergency_contact,
      is_active: true,
      updated_at: new Date(),
    };
    if (user.phone !== m.phone) {
      const dup = await trx('users').where('phone', m.phone).whereNot('id', user.id).first();
      if (dup) {
        return {
          externalRef: m.externalRef,
          phone: m.phone,
          status: 'conflict',
          mabrurUserId: user.id,
          message: 'Nomor HP baru sudah digunakan akun lain — data lain tetap diperbarui',
        };
      }
      update.phone = m.phone;
    }
    // Naikkan role jamaah → muthawwif bila perlu; admin tidak pernah diubah
    if (user.role === 'jamaah' && m.role === 'muthawwif') update.role = 'muthawwif';
    [user] = await trx('users').where('id', user.id).update(update).returning('*');
  }

  // 4) Keanggotaan group (reaktivasi bila pernah dicabut)
  const membership = await trx('group_members')
    .where({ group_id: groupId, user_id: user.id })
    .first();
  if (membership) {
    await trx('group_members')
      .where('id', membership.id)
      .update({ role_in_group: m.role, is_active: true });
  } else {
    await trx('group_members').insert({
      group_id: groupId,
      user_id: user.id,
      role_in_group: m.role,
    });
  }

  return {
    externalRef: m.externalRef,
    phone: m.phone,
    status: created ? 'created' : 'updated',
    mabrurUserId: user.id,
  };
}

/** Status lapangan utk Safar: monitoring anggota + SOS aktif, dicari by external_ref rombongan. */
export async function getGroupStatusForSafar(externalRef: string) {
  const group = await db('groups').where('external_ref', externalRef).first();
  if (!group) throw new AppError(404, 'Rombongan belum tersinkron ke Mabrur', 'NOT_FOUND');

  const [status, sos] = await Promise.all([
    getMemberStatuses(group.id),
    sosService.listByGroup(group.id),
  ]);

  return {
    group: { id: group.id, name: group.name, kloterCode: group.kloter_code, year: group.year },
    ...status,
    sos,
  };
}
