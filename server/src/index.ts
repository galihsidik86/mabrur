import app from './app';
import { config } from './config';
import { logger } from './logger';
import { scheduleMediaCleanup } from './services/media.service';

app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'Server Mabrur berjalan');
  // Masa simpan dokumentasi (180 hari) + sapu berkas yatim, tiap 6 jam.
  scheduleMediaCleanup();
});
