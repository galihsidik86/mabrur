import { db } from '../db';
import { AppError } from '../middleware/error-handler';
import { audit } from './audit.service';
import { assertMember } from './group.service';
import { shapeTaxiCard, type City, type HotelInput, type HotelRow, type TaxiCard } from './taxi-card-core';

const ROOM_COLUMN: Record<City, 'room_makkah' | 'room_madinah'> = {
  makkah: 'room_makkah',
  madinah: 'room_madinah',
};

/** Admin, atau muthawwif aktif di rombongan ini. */
export async function assertGroupLeader(groupId: string, userId: string, role: string): Promise<void> {
  if (role === 'admin') return;
  const member = await db('group_members')
    .where({ group_id: groupId, user_id: userId, is_active: true, role_in_group: 'muthawwif' })
    .first();
  if (!member) throw new AppError(403, 'Hanya admin atau muthawwif rombongan ini', 'FORBIDDEN');
}

/** Kartu taksi milik pengguna sendiri (hanya anggota aktif rombongan). */
export async function getTaxiCard(groupId: string, userId: string): Promise<TaxiCard> {
  const membership = await assertMember(groupId, userId);
  const [group, hotels, leaders] = await Promise.all([
    db('groups').where('id', groupId).first('name', 'kloter_code'),
    db('group_hotels').where('group_id', groupId).select<HotelRow[]>('city', 'name_ar', 'name_latin', 'address_ar', 'phone'),
    db('group_members')
      .join('users', 'users.id', 'group_members.user_id')
      .where({ 'group_members.group_id': groupId, 'group_members.is_active': true, 'group_members.role_in_group': 'muthawwif' })
      .where('users.is_active', true)
      .orderBy('group_members.joined_at')
      .select('users.name', 'users.phone'),
  ]);
  if (!group) throw new AppError(404, 'Rombongan tidak ditemukan', 'NOT_FOUND');

  return shapeTaxiCard({
    group,
    hotels,
    membership: { room_makkah: membership.room_makkah ?? null, room_madinah: membership.room_madinah ?? null },
    leaders,
  });
}

export async function listHotels(groupId: string): Promise<HotelRow[]> {
  return db('group_hotels').where('group_id', groupId).orderBy('city')
    .select('city', 'name_ar', 'name_latin', 'address_ar', 'phone');
}

export async function upsertHotel(groupId: string, city: City, input: HotelInput, actorId: string): Promise<HotelRow> {
  const group = await db('groups').where('id', groupId).first('id');
  if (!group) throw new AppError(404, 'Rombongan tidak ditemukan', 'NOT_FOUND');

  const row = {
    group_id: groupId,
    city,
    name_ar: input.name_ar,
    name_latin: input.name_latin || null,
    address_ar: input.address_ar,
    phone: input.phone || null,
    updated_at: new Date(),
  };
  const [saved] = await db('group_hotels')
    .insert(row)
    .onConflict(['group_id', 'city'])
    .merge(['name_ar', 'name_latin', 'address_ar', 'phone', 'updated_at'])
    .returning(['city', 'name_ar', 'name_latin', 'address_ar', 'phone']);

  await audit(actorId, 'group.hotel_upsert', 'groups', groupId, { city });
  return saved;
}

export async function deleteHotel(groupId: string, city: City, actorId: string): Promise<void> {
  const deleted = await db('group_hotels').where({ group_id: groupId, city }).delete();
  if (deleted) await audit(actorId, 'group.hotel_delete', 'groups', groupId, { city });
}

export async function setMemberRoom(
  groupId: string, memberUserId: string, city: City, roomNumber: string | null, actorId: string,
): Promise<void> {
  const [membership] = await db('group_members')
    .where({ group_id: groupId, user_id: memberUserId, is_active: true })
    .update({ [ROOM_COLUMN[city]]: roomNumber })
    .returning('id');
  if (!membership) throw new AppError(404, 'Anggota tidak ditemukan di rombongan ini', 'NOT_FOUND');
  // entityId = id keanggotaan (konsisten dengan entitas group_members); nilai baru dicatat.
  await audit(actorId, 'group.member_room', 'group_members', membership.id, {
    group_id: groupId, user_id: memberUserId, city, room_number: roomNumber,
  });
}
