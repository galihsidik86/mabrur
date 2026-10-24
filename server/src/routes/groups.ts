import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import * as groupService from '../services/group.service';
import * as taxiCardService from '../services/taxi-card.service';
import { citySchema, hotelInputSchema, roomInputSchema, memberListForViewer, type City } from '../services/taxi-card-core';

const router = Router();

function param(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

router.use(authenticate);

const createSchema = z.object({
  name: z.string().min(1, 'Nama rombongan wajib diisi').max(100),
  kloter_code: z
    .string()
    .min(1, 'Kode kloter wajib diisi')
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, 'Kode kloter hanya boleh huruf, angka, dan strip'),
  year: z.number().int().min(2024).max(2100),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  kloter_code: z
    .string()
    .min(1)
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/)
    .optional(),
  year: z.number().int().min(2024).max(2100).optional(),
});

const addMemberSchema = z.object({
  user_id: z.string().uuid('ID pengguna harus format UUID'),
  role_in_group: z.enum(['jamaah', 'muthawwif']),
});

const listSchema = z.object({
  search: z.string().max(100).optional(),
  year: z.coerce.number().int().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// List: admin melihat semua, lainnya hanya grup sendiri
router.get(
  '/',
  validate(listSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result =
        req.auth!.role === 'admin'
          ? await groupService.listGroups(req.query as any)
          : await groupService.listGroupsForUser(req.auth!.sub, req.query as any);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/',
  authorize('admin'),
  validate(createSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const group = await groupService.createGroup(req.body, req.auth!.sub);
      res.status(201).json({ data: group });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.auth!.role !== 'admin') {
        await groupService.assertMember(param(req.params.id), req.auth!.sub);
      }
      const group = await groupService.getGroup(param(req.params.id));
      res.json({ data: group });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  '/:id',
  authorize('admin'),
  validate(updateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const group = await groupService.updateGroup(
        param(req.params.id),
        req.body,
        req.auth!.sub,
      );
      res.json({ data: group });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/:id',
  authorize('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await groupService.deleteGroup(param(req.params.id), req.auth!.sub);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

// === Members ===

router.get(
  '/:id/members',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let canSeeRooms = req.auth!.role === 'admin';
      if (!canSeeRooms) {
        const membership = await groupService.assertMember(param(req.params.id), req.auth!.sub);
        canSeeRooms = membership.role_in_group === 'muthawwif';
      }
      const members = await groupService.listMembers(param(req.params.id));
      res.json({ data: memberListForViewer(members, canSeeRooms) });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/:id/members',
  authorize('admin'),
  validate(addMemberSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const member = await groupService.addMember(
        param(req.params.id),
        req.body,
        req.auth!.sub,
      );
      res.status(201).json({ data: member });
    } catch (err) {
      next(err);
    }
  },
);

// === Kartu Taksi (hotel per kota + nomor kamar) ===

const groupParams = z.object({ id: z.string().uuid() });
const hotelParams = z.object({ id: z.string().uuid(), city: citySchema });
const memberParams = z.object({ id: z.string().uuid(), userId: z.string().uuid() });

// Kartu taksi milik pengguna sendiri — hanya anggota aktif rombongan.
router.get(
  '/:id/taxi-card',
  validate(groupParams, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await taxiCardService.getTaxiCard(param(req.params.id), req.auth!.sub) });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/:id/hotels',
  validate(groupParams, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await taxiCardService.assertGroupLeader(param(req.params.id), req.auth!.sub, req.auth!.role);
      res.json({ data: await taxiCardService.listHotels(param(req.params.id)) });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  '/:id/hotels/:city',
  validate(hotelParams, 'params'),
  validate(hotelInputSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const groupId = param(req.params.id);
      await taxiCardService.assertGroupLeader(groupId, req.auth!.sub, req.auth!.role);
      const hotel = await taxiCardService.upsertHotel(groupId, param(req.params.city) as City, req.body, req.auth!.sub);
      res.json({ data: hotel });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/:id/hotels/:city',
  validate(hotelParams, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const groupId = param(req.params.id);
      await taxiCardService.assertGroupLeader(groupId, req.auth!.sub, req.auth!.role);
      await taxiCardService.deleteHotel(groupId, param(req.params.city) as City, req.auth!.sub);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  '/:id/members/:userId/room',
  validate(memberParams, 'params'),
  validate(roomInputSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const groupId = param(req.params.id);
      await taxiCardService.assertGroupLeader(groupId, req.auth!.sub, req.auth!.role);
      await taxiCardService.setMemberRoom(
        groupId, param(req.params.userId), req.body.city, req.body.room_number, req.auth!.sub,
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/:id/members/:userId',
  authorize('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await groupService.removeMember(
        param(req.params.id),
        param(req.params.userId),
        req.auth!.sub,
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

export default router;
