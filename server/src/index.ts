import app from './app';
import { config } from './config';

app.listen(config.PORT, () => {
  console.log(
    `[mabrur] Server berjalan di port ${config.PORT} (${config.NODE_ENV})`,
  );
});
