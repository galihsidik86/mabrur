import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { db } from '../db';

const router = Router();
router.use(authenticate);

function param(v: string | string[]): string { return Array.isArray(v) ? v[0] : v; }

// ==================== COUNTER (Tawaf/Sai/Dzikir) ====================

// Perbaikan: batasi panjang string type dan label
router.post('/counter', validate(z.object({
  type: z.string().min(1).max(50), target: z.number().int().min(1).max(10000).optional(), label: z.string().max(100).optional(),
})), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [s] = await db('counter_sessions').insert({
      user_id: req.auth!.sub, type: req.body.type,
      target: req.body.target || 7, label: req.body.label,
    }).returning('*');
    res.status(201).json({ data: s });
  } catch (err) { next(err); }
});

router.patch('/counter/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = param(req.params.id);
    const s = await db('counter_sessions').where({ id, user_id: req.auth!.sub }).first();
    if (!s) return res.status(404).json({ error: { message: 'Tidak ditemukan', code: 'NOT_FOUND' } });
    const count = Math.min((s.count || 0) + 1, s.target);
    const completed = count >= s.target;
    const [updated] = await db('counter_sessions').where('id', id).update({
      count, completed, completed_at: completed ? new Date() : null,
    }).returning('*');
    res.json({ data: updated });
  } catch (err) { next(err); }
});

router.get('/counter', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = await db('counter_sessions').where('user_id', req.auth!.sub)
      .orderBy('created_at', 'desc').limit(20);
    res.json({ data: sessions });
  } catch (err) { next(err); }
});

// ==================== LOGBOOK ====================

router.get('/logbook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entries = await db('logbook').where('user_id', req.auth!.sub)
      .orderBy('date', 'desc').limit(30);
    res.json({ data: entries });
  } catch (err) { next(err); }
});

// Perbaikan: validasi format tanggal dan batasi panjang mood
router.post('/logbook', validate(z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'), content: z.string().max(5000), mood: z.string().max(20).optional(),
})), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [entry] = await db('logbook').insert({
      user_id: req.auth!.sub, ...req.body,
    }).onConflict(['user_id', 'date']).merge().returning('*');
    res.json({ data: entry });
  } catch (err) { next(err); }
});

// ==================== BOOKMARK DOA ====================

router.get('/dua-bookmarks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookmarks = await db('dua_bookmarks').join('duas', 'duas.id', 'dua_bookmarks.dua_id')
      .where('dua_bookmarks.user_id', req.auth!.sub)
      .select('duas.*', 'dua_bookmarks.id as bookmark_id');
    res.json({ data: bookmarks });
  } catch (err) { next(err); }
});

router.post('/dua-bookmarks/:duaId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await db('dua_bookmarks').insert({
      user_id: req.auth!.sub, dua_id: param(req.params.duaId),
    }).onConflict(['user_id', 'dua_id']).ignore();
    res.json({ data: { ok: true } });
  } catch (err) { next(err); }
});

router.delete('/dua-bookmarks/:duaId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await db('dua_bookmarks').where({
      user_id: req.auth!.sub, dua_id: param(req.params.duaId),
    }).delete();
    res.json({ data: { ok: true } });
  } catch (err) { next(err); }
});

// ==================== CHECKLIST ====================

router.get('/checklist', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await db('checklist_items').where('user_id', req.auth!.sub).orderBy('sort_order');
    res.json({ data: items });
  } catch (err) { next(err); }
});

router.post('/checklist', validate(z.object({
  text: z.string().min(1).max(200), category: z.string().optional(),
})), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const last = await db('checklist_items').where('user_id', req.auth!.sub).max('sort_order as max').first();
    const [item] = await db('checklist_items').insert({
      user_id: req.auth!.sub, text: req.body.text,
      category: req.body.category || 'lainnya', sort_order: (last?.max || 0) + 1,
    }).returning('*');
    res.status(201).json({ data: item });
  } catch (err) { next(err); }
});

router.patch('/checklist/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [item] = await db('checklist_items')
      .where({ id: param(req.params.id), user_id: req.auth!.sub })
      .update({ checked: req.body.checked ?? true }).returning('*');
    res.json({ data: item });
  } catch (err) { next(err); }
});

router.delete('/checklist/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await db('checklist_items').where({ id: param(req.params.id), user_id: req.auth!.sub }).delete();
    res.status(204).send();
  } catch (err) { next(err); }
});

// ==================== SAVED LOCATIONS ====================

router.get('/saved-locations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const locs = await db('saved_locations').where('user_id', req.auth!.sub).orderBy('created_at', 'desc');
    res.json({ data: locs });
  } catch (err) { next(err); }
});

// Perbaikan: validasi batas koordinat untuk mencegah data invalid
router.post('/saved-locations', validate(z.object({
  name: z.string().min(1).max(100), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), notes: z.string().max(500).optional(),
})), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [loc] = await db('saved_locations').insert({
      user_id: req.auth!.sub, ...req.body,
    }).returning('*');
    res.status(201).json({ data: loc });
  } catch (err) { next(err); }
});

router.delete('/saved-locations/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await db('saved_locations').where({ id: param(req.params.id), user_id: req.auth!.sub }).delete();
    res.status(204).send();
  } catch (err) { next(err); }
});

// ==================== ARABIC PHRASES ====================

router.get('/phrases', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const phrases = await db('arabic_phrases').orderBy('sort_order');
    res.json({ data: phrases });
  } catch (err) { next(err); }
});

// ==================== HEALTH TIPS (static) ====================

router.get('/health-tips', async (_req: Request, res: Response) => {
  res.json({ data: [
    { id: '1', title: 'Cegah Dehidrasi', icon: 'water', tips: 'Minum minimal 3 liter/hari. Bawa botol air selalu. Hindari minuman berkafein saat panas. Minum air Zamzam di setiap kesempatan.' },
    { id: '2', title: 'Hindari Heatstroke', icon: 'sunny', tips: 'Pakai payung/topi saat di luar. Hindari berjalan 11:00-15:00. Kenali gejala: pusing, mual, kulit kering. Segera cari tempat teduh dan minum air jika merasa tidak enak badan.' },
    { id: '3', title: 'Jaga Kebersihan', icon: 'hand-left', tips: 'Cuci tangan sering dengan sabun. Pakai masker di keramaian. Bawa hand sanitizer. Hindari menyentuh wajah.' },
    { id: '4', title: 'Obat Penting', icon: 'medkit', tips: 'Bawa: paracetamol, obat diare, oralit, plester luka, obat pribadi. Simpan di tas kecil yang selalu dibawa. Catat nama obat dalam bahasa Inggris.' },
    { id: '5', title: 'Istirahat Cukup', icon: 'moon', tips: 'Tidur minimal 6 jam. Gunakan waktu antara shalat untuk istirahat. Jangan memaksakan diri saat kelelahan — ibadah di lain waktu lebih baik.' },
    { id: '6', title: 'Perawatan Kaki', icon: 'footsteps', tips: 'Pakai sandal nyaman. Cuci & keringkan kaki setelah berjalan. Bawa plester anti lecet. Rendam kaki air hangat di malam hari.' },
  ]});
});

// ==================== PRAYER TIMES (calculated) ====================

router.get('/prayer-times', async (req: Request, res: Response) => {
  // Perbaikan: NaN || default tetap NaN karena NaN bukan falsy
  // Gunakan isFinite() untuk mendeteksi NaN/Infinity
  const rawLat = Number(req.query.lat);
  const rawLng = Number(req.query.lng);
  const lat = isFinite(rawLat) ? Math.max(-90, Math.min(90, rawLat)) : 21.4225;
  const lng = isFinite(rawLng) ? Math.max(-180, Math.min(180, rawLng)) : 39.8262;
  const now = new Date();

  // Simplified prayer time calculation (approximate for Makkah/Madinah region)
  // In production, use a proper library like adhan-js
  const day = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const declination = 23.45 * Math.sin((2 * Math.PI / 365) * (day - 81));
  const eqTime = 9.87 * Math.sin(2 * (2 * Math.PI / 365) * (day - 81)) - 7.53 * Math.cos((2 * Math.PI / 365) * (day - 81)) - 1.5 * Math.sin((2 * Math.PI / 365) * (day - 81));
  // Estimate timezone from longitude (±0.5h accuracy, sufficient for prayer times)
  const rawTz = Number(req.query.tz);
  const tz = isFinite(rawTz) ? rawTz : Math.round(lng / 15);
  const solarNoon = 12 - lng / 15 - eqTime / 60 + tz;

  const toRad = (d: number) => d * Math.PI / 180;
  const toDeg = (r: number) => r * 180 / Math.PI;
  const decRad = toRad(declination);
  const latRad = toRad(lat);

  const hourAngle = (altitude: number) => {
    const a = toRad(altitude);
    const cosH = (Math.sin(a) - Math.sin(latRad) * Math.sin(decRad)) /
                 (Math.cos(latRad) * Math.cos(decRad));
    if (cosH > 1) return 0;
    if (cosH < -1) return 12;
    return toDeg(Math.acos(cosH)) / 15;
  };

  const fmt = (h: number) => {
    if (!isFinite(h)) return '--:--';
    const hh = Math.floor(h); const mm = Math.round((h - hh) * 60);
    return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
  };

  const fajrHA = hourAngle(-18);
  const sunriseHA = hourAngle(-0.833);

  // Asr (Shafi'i): shadow = object height + noon shadow
  const noonShadowAngle = Math.abs(lat - declination);
  const asrAlt = toDeg(Math.atan(1 / (1 + Math.tan(toRad(noonShadowAngle)))));
  const asrHA = hourAngle(asrAlt);

  const maghribHA = hourAngle(-0.833);
  const ishaHA = hourAngle(-17.5);

  res.json({ data: {
    date: now.toISOString().slice(0, 10),
    location: { lat, lng },
    times: {
      fajr: fmt(solarNoon - fajrHA),
      sunrise: fmt(solarNoon - sunriseHA),
      dhuhr: fmt(solarNoon + 0.05),
      asr: fmt(solarNoon + asrHA),
      maghrib: fmt(solarNoon + maghribHA),
      isha: fmt(solarNoon + ishaHA),
    },
  }});
});

// ==================== CURRENCY CONVERTER ====================

router.get('/currency', async (_req: Request, res: Response) => {
  // Static rate — in production, fetch from API
  res.json({ data: { sar_to_idr: 4250, idr_to_sar: 1 / 4250, updated: '2026-07-07' }});
});

export default router;
