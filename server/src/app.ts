import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { logger } from './logger';
import { errorHandler } from './middleware/error-handler';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import groupRoutes from './routes/groups';
import contentRoutes from './routes/content';
import scheduleRoutes from './routes/schedules';
import geofenceRoutes from './routes/geofence';
import monitoringRoutes from './routes/monitoring';
import sosRoutes from './routes/sos';
import featuresRoutes from './routes/features';
import enhancementsRoutes from './routes/enhancements';
import worshipRoutes from './routes/worship';
import path from 'path';
import { db } from './db';

const app = express();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('short'));

// Health check
app.get('/health', async (_req, res) => {
  try {
    await db.raw('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// API routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/groups', groupRoutes);
app.use('/', contentRoutes);
app.use('/', scheduleRoutes);
app.use('/', geofenceRoutes);
app.use('/', monitoringRoutes);
app.use('/', sosRoutes);
app.use('/', featuresRoutes);
app.use('/', enhancementsRoutes);
app.use('/', worshipRoutes);
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// 404
app.use((_req, res) => {
  res.status(404).json({
    error: { message: 'Endpoint tidak ditemukan', code: 'NOT_FOUND' },
  });
});

// Global error handler
app.use(errorHandler);

export default app;
