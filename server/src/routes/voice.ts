import { Router, Request, Response, NextFunction } from 'express';
import { AccessToken } from 'livekit-server-sdk';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { config } from '../config';
import { db } from '../db';

// ==================== SUARA ROMBONGAN (LiveKit broadcast satu-arah) ====================
// Prototipe: muthawwif menyiarkan suara (memandu doa/dzikir) ke jamaah se-rombongan,
// pengganti handy talky. Broadcast SATU ARAH ditegakkan di token:
//   - muthawwif → canPublish=true  (boleh bicara)
//   - jamaah    → canPublish=false, canSubscribe=true (hanya dengar)
// Room = per grup ("group-<id>"). Butuh env LIVEKIT_URL/API_KEY/API_SECRET.

const router = Router();
router.use(authenticate);

router.get('/token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!config.LIVEKIT_URL || !config.LIVEKIT_API_KEY || !config.LIVEKIT_API_SECRET) {
      throw new AppError(503, 'Fitur suara rombongan belum dikonfigurasi', 'NOT_CONFIGURED');
    }

    const userId = req.auth!.sub;

    // Rombongan yang disiarkan/didengarkan. Muthawwif bisa berada di >1 rombongan,
    // jadi terima ?group=<id> agar bisa memilih (dan jamaah tetap di rombongannya).
    // Tanpa param → deterministik (orderBy group_id), bukan .first() acak.
    const groupParam = typeof req.query.group === 'string' ? req.query.group : undefined;
    let membership;
    if (groupParam) {
      membership = await db('group_members')
        .where({ user_id: userId, group_id: groupParam, is_active: true })
        .first();
      if (!membership) {
        throw new AppError(403, 'Kamu bukan anggota rombongan tersebut', 'FORBIDDEN');
      }
    } else {
      membership = await db('group_members')
        .where({ user_id: userId, is_active: true })
        .orderBy('group_id')
        .first();
    }
    if (!membership?.group_id) {
      throw new AppError(400, 'Kamu belum tergabung dalam rombongan', 'NO_GROUP');
    }

    const canPublish = membership.role_in_group === 'muthawwif';
    const room = `group-${membership.group_id}`;

    const user = await db('users').where('id', userId).select('name').first();

    const at = new AccessToken(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET, {
      identity: userId,
      name: user?.name || 'Jamaah',
      ttl: '2h',
    });
    at.addGrant({
      roomJoin: true,
      room,
      canPublish,          // hanya muthawwif
      canSubscribe: true,  // semua boleh dengar
      canPublishData: canPublish,
    });

    res.json({
      data: {
        url: config.LIVEKIT_URL,
        token: await at.toJwt(),
        room,
        role: canPublish ? 'speaker' : 'listener',
      },
    });
  } catch (err) { next(err); }
});

export default router;
