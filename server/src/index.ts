import app from './app';
import { config } from './config';
import { logger } from './logger';

app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'Server Mabrur berjalan');
});
