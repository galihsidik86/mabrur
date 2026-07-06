import { db } from '../db';
import { AppError } from '../middleware/error-handler';
import { audit } from './audit.service';

export async function createGroup(
  data: { name: string; kloter_code: string; year: number },
  adminId: string,
) {
  const exists = await db('groups').where('kloter_code', data.kloter_code).first();
  if (exists) throw new AppError(409, 'Kode kloter sudah digunakan', 'DUPLICATE');

  const [group] = await db('groups')
    .insert({
      name: data.name,
      kloter_code: data.kloter_code,
      year: data.year,
      created_by: adminId,
    })
    .returning('*');

  await audit(adminId, 'group.create', 'groups', group.id);
  return group;
}

export async function listGroups(filters: {
  search?: string;
  year?: number;
  page?: number;
  limit?: number;
}) {
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 20, 100);
  const offset = (page - 1) * limit;

  let query = db('groups');

  if (filters.search) {
    query = query.where(function () {
      this.whereILike('name', `%${filters.search}%`).orWhereILike(
        'kloter_code',
        `%${filters.search}%`,
      );
    });
  }
  if (filters.year) query = query.where('year', filters.year);

  const [{ count }] = await query.clone().count();
  const groups = await query
    .select(
      'groups.*',
      db.raw(
        '(SELECT count(*) FROM group_members WHERE group_id = groups.id AND is_active = true)::int as member_count',
      ),
    )
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset);

  return { data: groups, meta: { total: Number(count), page, limit } };
}

export async function listGroupsForUser(
  userId: string,
  filters: { search?: string; year?: number; page?: number; limit?: number },
) {
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 20, 100);
  const offset = (page - 1) * limit;

  let query = db('groups')
    .join('group_members', 'group_members.group_id', 'groups.id')
    .where({
      'group_members.user_id': userId,
      'group_members.is_active': true,
    });

  if (filters.search) {
    query = query.where(function () {
      this.whereILike('groups.name', `%${filters.search}%`).orWhereILike(
        'groups.kloter_code',
        `%${filters.search}%`,
      );
    });
  }
  if (filters.year) query = query.where('groups.year', filters.year);

  const [{ count }] = await query.clone().count();
  const groups = await query
    .select(
      'groups.*',
      db.raw(
        '(SELECT count(*) FROM group_members gm WHERE gm.group_id = groups.id AND gm.is_active = true)::int as member_count',
      ),
    )
    .orderBy('groups.created_at', 'desc')
    .limit(limit)
    .offset(offset);

  return { data: groups, meta: { total: Number(count), page, limit } };
}

export async function getGroup(id: string) {
  const group = await db('groups').where('id', id).first();
  if (!group) throw new AppError(404, 'Rombongan tidak ditemukan', 'NOT_FOUND');
  return group;
}

export async function updateGroup(
  id: string,
  data: Partial<{ name: string; kloter_code: string; year: number }>,
  adminId: string,
) {
  const group = await db('groups').where('id', id).first();
  if (!group) throw new AppError(404, 'Rombongan tidak ditemukan', 'NOT_FOUND');

  if (data.kloter_code) {
    const dup = await db('groups')
      .where('kloter_code', data.kloter_code)
      .whereNot('id', id)
      .first();
    if (dup) throw new AppError(409, 'Kode kloter sudah digunakan', 'DUPLICATE');
  }

  const [updated] = await db('groups')
    .where('id', id)
    .update({ ...data, updated_at: new Date() })
    .returning('*');

  await audit(adminId, 'group.update', 'groups', id);
  return updated;
}

export async function deleteGroup(id: string, adminId: string) {
  const group = await db('groups').where('id', id).first();
  if (!group) throw new AppError(404, 'Rombongan tidak ditemukan', 'NOT_FOUND');

  await db('groups').where('id', id).delete();
  await audit(adminId, 'group.delete', 'groups', id);
}

export async function assertMember(groupId: string, userId: string) {
  const member = await db('group_members')
    .where({ group_id: groupId, user_id: userId, is_active: true })
    .first();
  if (!member) {
    throw new AppError(403, 'Anda bukan anggota rombongan ini', 'FORBIDDEN');
  }
  return member;
}

export async function listMembers(groupId: string) {
  const group = await db('groups').where('id', groupId).first();
  if (!group) throw new AppError(404, 'Rombongan tidak ditemukan', 'NOT_FOUND');

  const members = await db('group_members')
    .join('users', 'users.id', 'group_members.user_id')
    .where({
      'group_members.group_id': groupId,
      'group_members.is_active': true,
    })
    .select(
      'group_members.id as membership_id',
      'users.id',
      'users.name',
      'users.phone',
      'users.role',
      'group_members.role_in_group',
      'group_members.joined_at',
    )
    .orderBy('group_members.joined_at');

  return members;
}

export async function addMember(
  groupId: string,
  data: { user_id: string; role_in_group: string },
  adminId: string,
) {
  const group = await db('groups').where('id', groupId).first();
  if (!group) throw new AppError(404, 'Rombongan tidak ditemukan', 'NOT_FOUND');

  const user = await db('users')
    .where({ id: data.user_id, is_active: true })
    .first();
  if (!user) throw new AppError(404, 'Pengguna tidak ditemukan', 'NOT_FOUND');

  const exists = await db('group_members')
    .where({ group_id: groupId, user_id: data.user_id })
    .first();

  if (exists) {
    if (exists.is_active) {
      throw new AppError(409, 'Pengguna sudah menjadi anggota rombongan ini', 'DUPLICATE');
    }
    // Reaktivasi anggota yang sebelumnya dikeluarkan
    const [reactivated] = await db('group_members')
      .where('id', exists.id)
      .update({
        is_active: true,
        role_in_group: data.role_in_group,
        joined_at: new Date(),
      })
      .returning('*');

    await audit(adminId, 'group.member.reactivate', 'group_members', exists.id, {
      group_id: groupId,
      user_id: data.user_id,
    });
    return reactivated;
  }

  const [member] = await db('group_members')
    .insert({
      group_id: groupId,
      user_id: data.user_id,
      role_in_group: data.role_in_group,
    })
    .returning('*');

  await audit(adminId, 'group.member.add', 'group_members', member.id, {
    group_id: groupId,
    user_id: data.user_id,
    role: data.role_in_group,
  });
  return member;
}

export async function removeMember(
  groupId: string,
  userId: string,
  adminId: string,
) {
  const member = await db('group_members')
    .where({ group_id: groupId, user_id: userId, is_active: true })
    .first();
  if (!member) {
    throw new AppError(404, 'Anggota tidak ditemukan di rombongan ini', 'NOT_FOUND');
  }

  await db('group_members').where('id', member.id).update({ is_active: false });
  await audit(adminId, 'group.member.remove', 'group_members', member.id, {
    group_id: groupId,
    user_id: userId,
  });
}
