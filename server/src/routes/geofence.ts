import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import * as geoService from '../services/geofence.service';

const router = Router();
router.use(authenticate);

// GET /miqat-zones
router.get('/miqat-zones', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const zones = await geoService.listZones();
    res.json({ data: zones });
  } catch (err) { next(err); }
});

// GET /miqat-zones/nearest?lat=&lng=
const nearestSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

router.get(
  '/miqat-zones/nearest',
  validate(nearestSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { lat, lng } = req.query as any;
      const result = await geoService.nearestMiqat(Number(lat), Number(lng));
      res.json({ data: result });
    } catch (err) { next(err); }
  },
);

// GET /ihram/status
router.get('/ihram/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await geoService.getIhram(req.auth!.sub);
    res.json({ data: status });
  } catch (err) { next(err); }
});

// POST /ihram/toggle
const toggleSchema = z.object({
  is_ihram: z.boolean(),
  niat_type: z.enum(['umrah', 'haji']).optional(),
});

router.post(
  '/ihram/toggle',
  validate(toggleSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await geoService.toggleIhram(
        req.auth!.sub, req.body.is_ihram, req.body.niat_type,
      );
      res.json({ data: result });
    } catch (err) { next(err); }
  },
);

// POST /locations
const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().optional(),
});

router.post(
  '/locations',
  validate(locationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await geoService.updateLocation(
        req.auth!.sub, req.body.lat, req.body.lng, req.body.accuracy,
      );
      res.json({ data: { ok: true } });
    } catch (err) { next(err); }
  },
);

export default router;
