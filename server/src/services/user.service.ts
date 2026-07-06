import bcrypt from 'bcryptjs';
import { db } from '../db';
import { AppError } from '../middleware/error-handler';
import { encrypt, decrypt } from './crypto.service';
import { audit } from './audit.service';

const PUBLIC_FIELDS = [
  'id', 'phone', 'name', 'role', 'blood_type',
  'emergency_contact', 'is_active', 'created_at',
];

export async function createUser(
  data: {
    phone: string;
    password: string;
    name: string;
    role: string;
    passport_no?: string;
    blood_type?: string;
    medical_notes?: string;
    emergency_contact?: string;
  },
  adminId: string,
) {
  const exists = await db('users').where('phone', data.phone).first();
  if (exists) throw new AppError(409, 'Nomor HP sudah terdaftar', 'DUPLICATE');

  const hash = await bcrypt.hash(data.password, 12);

  const [user] = await db('users')
    .insert({
      phone: data.phone,
      password_hash: hash,
      name: data.name,
      role: data.role,
      passport_no: data.passport_no ? encrypt(data.passport_no) : null,
      blood_type: data.blood_type ?? null,
      medical_notes: data.medical_notes ? encrypt(data.medical_notes) : null,
      emergency_contact: data.emergency_contact ?? null,
    })
    .returning(PUBLIC_FIELDS);

  await audit(adminId, 'user.create', 'users', user.id, { role: data.role });
  return user;
}

export async function listUsers(filters: {
  role?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 20, 100);
  const offset = (page - 1) * limit;

  let query = db('users').where('is_active', true);

  if (filters.role) query = query.where('role', filters.role);
  if (filters.search) {
    query = query.where(function () {
      this.whereILike('name', `%${filters.search}%`).orWhereILike(
        'phone',
        `%${filters.search}%`,
      );
    });
  }

  const [{ count }] = await query.clone().count();
  const users = await query
    .select(PUBLIC_FIELDS)
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset);

  return { data: users, meta: { total: Number(count), page, limit } };
}

export async function getUser(id: string) {
  const user = await db('users')
    .where({ id, is_active: true })
    .select([...PUBLIC_FIELDS, 'passport_no', 'medical_notes'])
    .first();

  if (!user) throw new AppError(404, 'Pengguna tidak ditemukan', 'NOT_FOUND');

  if (user.passport_no) user.passport_no = decrypt(user.passport_no);
  if (user.medical_notes) user.medical_notes = decrypt(user.medical_notes);

  return user;
}

export async function updateUser(
  id: string,
  data: Partial<{
    name: string;
    phone: string;
    role: string;
    password: string;
    passport_no: string;
    blood_type: string;
    medical_notes: string;
    emergency_contact: string;
  }>,
  adminId: string,
) {
  const user = await db('users').where({ id, is_active: true }).first();
  if (!user) throw new AppError(404, 'Pengguna tidak ditemukan', 'NOT_FOUND');

  const update: Record<string, unknown> = { updated_at: new Date() };

  if (data.name) update.name = data.name;
  if (data.phone) {
    const dup = await db('users')
      .where('phone', data.phone)
      .whereNot('id', id)
      .first();
    if (dup) throw new AppError(409, 'Nomor HP sudah digunakan', 'DUPLICATE');
    update.phone = data.phone;
  }
  if (data.role) update.role = data.role;
  if (data.password) update.password_hash = await bcrypt.hash(data.password, 12);
  if (data.passport_no !== undefined) {
    update.passport_no = data.passport_no ? encrypt(data.passport_no) : null;
  }
  if (data.blood_type !== undefined) update.blood_type = data.blood_type || null;
  if (data.medical_notes !== undefined) {
    update.medical_notes = data.medical_notes ? encrypt(data.medical_notes) : null;
  }
  if (data.emergency_contact !== undefined) {
    update.emergency_contact = data.emergency_contact || null;
  }

  const [updated] = await db('users')
    .where('id', id)
    .update(update)
    .returning(PUBLIC_FIELDS);

  await audit(adminId, 'user.update', 'users', id, {
    fields: Object.keys(data),
  });
  return updated;
}

export async function deleteUser(id: string, adminId: string) {
  const user = await db('users').where({ id, is_active: true }).first();
  if (!user) throw new AppError(404, 'Pengguna tidak ditemukan', 'NOT_FOUND');

  if (user.role === 'admin') {
    const result = await db('users')
      .where({ role: 'admin', is_active: true })
      .count()
      .first();
    if (Number(result?.count) <= 1) {
      throw new AppError(400, 'Tidak bisa menghapus admin terakhir', 'LAST_ADMIN');
    }
  }

  await db('users')
    .where('id', id)
    .update({ is_active: false, updated_at: new Date() });

  await audit(adminId, 'user.delete', 'users', id);
}
