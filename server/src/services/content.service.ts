import { db } from '../db';
import { AppError } from '../middleware/error-handler';
import { audit } from './audit.service';

// ==================== Ibadah Guides ====================

const GUIDE_FIELDS = [
  'id', 'type', 'step_number', 'title', 'subtitle',
  'steps_text', 'arabic_text', 'latin_text', 'updated_at',
];

export async function listGuides(type?: string) {
  let query = db('ibadah_guides').select(GUIDE_FIELDS).orderBy('step_number');
  if (type) query = query.where('type', type);
  return query;
}

export async function getGuide(id: string) {
  const guide = await db('ibadah_guides').where('id', id).select(GUIDE_FIELDS).first();
  if (!guide) throw new AppError(404, 'Tuntunan tidak ditemukan', 'NOT_FOUND');
  return guide;
}

export async function createGuide(
  data: {
    type: string; step_number: number; title: string; subtitle?: string;
    steps_text?: string; arabic_text?: string; latin_text?: string;
  },
  adminId: string,
) {
  const dup = await db('ibadah_guides')
    .where({ type: data.type, step_number: data.step_number })
    .first();
  if (dup) throw new AppError(409, 'Nomor tahap sudah ada untuk tipe ini', 'DUPLICATE');

  const [guide] = await db('ibadah_guides')
    .insert({ ...data, updated_by: adminId })
    .returning(GUIDE_FIELDS);
  await audit(adminId, 'guide.create', 'ibadah_guides', guide.id);
  return guide;
}

export async function updateGuide(
  id: string,
  data: Partial<{
    title: string; subtitle: string; steps_text: string;
    arabic_text: string; latin_text: string; step_number: number;
  }>,
  adminId: string,
) {
  const guide = await db('ibadah_guides').where('id', id).first();
  if (!guide) throw new AppError(404, 'Tuntunan tidak ditemukan', 'NOT_FOUND');

  const [updated] = await db('ibadah_guides')
    .where('id', id)
    .update({ ...data, updated_by: adminId, updated_at: new Date() })
    .returning(GUIDE_FIELDS);
  await audit(adminId, 'guide.update', 'ibadah_guides', id);
  return updated;
}

export async function deleteGuide(id: string, adminId: string) {
  const guide = await db('ibadah_guides').where('id', id).first();
  if (!guide) throw new AppError(404, 'Tuntunan tidak ditemukan', 'NOT_FOUND');
  await db('ibadah_guides').where('id', id).delete();
  await audit(adminId, 'guide.delete', 'ibadah_guides', id);
}

// ==================== Duas ====================

const DUA_FIELDS = [
  'id', 'title', 'context', 'arabic_text',
  'latin_text', 'translation', 'sort_order', 'updated_at',
];

export async function listDuas() {
  return db('duas').select(DUA_FIELDS).orderBy('sort_order');
}

export async function getDua(id: string) {
  const dua = await db('duas').where('id', id).select(DUA_FIELDS).first();
  if (!dua) throw new AppError(404, 'Doa tidak ditemukan', 'NOT_FOUND');
  return dua;
}

export async function createDua(
  data: {
    title: string; context?: string; arabic_text?: string;
    latin_text?: string; translation?: string; sort_order?: number;
  },
  adminId: string,
) {
  if (!data.sort_order) {
    const last = await db('duas').max('sort_order as max').first();
    data.sort_order = (last?.max || 0) + 1;
  }
  const [dua] = await db('duas')
    .insert({ ...data, updated_by: adminId })
    .returning(DUA_FIELDS);
  await audit(adminId, 'dua.create', 'duas', dua.id);
  return dua;
}

export async function updateDua(
  id: string,
  data: Partial<{
    title: string; context: string; arabic_text: string;
    latin_text: string; translation: string; sort_order: number;
  }>,
  adminId: string,
) {
  const dua = await db('duas').where('id', id).first();
  if (!dua) throw new AppError(404, 'Doa tidak ditemukan', 'NOT_FOUND');

  const [updated] = await db('duas')
    .where('id', id)
    .update({ ...data, updated_by: adminId, updated_at: new Date() })
    .returning(DUA_FIELDS);
  await audit(adminId, 'dua.update', 'duas', id);
  return updated;
}

export async function deleteDua(id: string, adminId: string) {
  const dua = await db('duas').where('id', id).first();
  if (!dua) throw new AppError(404, 'Doa tidak ditemukan', 'NOT_FOUND');
  await db('duas').where('id', id).delete();
  await audit(adminId, 'dua.delete', 'duas', id);
}
