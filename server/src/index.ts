import app from './app';
import { config } from './config';
import { logger } from './logger';
import { scheduleMediaCleanup } from './services/media.service';

// Unggahan video Dokumentasi (≤ 40 MB) lewat sinyal lemah bisa lebih dari 5 menit (bawaan Node).
// Header tetap dibatasi headersTimeout (60 dtk), dan body hanya dibaca setelah cek login + keanggotaan.
const UPLOAD_REQUEST_TIMEOUT_MS = 15 * 60_000;

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'Server Mabrur berjalan');
  // Masa simpan dokumentasi (180 hari) + sapu berkas yatim, tiap 6 jam.
  scheduleMediaCleanup();
});
server.requestTimeout = UPLOAD_REQUEST_TIMEOUT_MS;
