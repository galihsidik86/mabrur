import knex from 'knex';
import { config } from '../config';

export const db = knex({
  client: 'pg',
  connection: {
    connectionString: config.DATABASE_URL,
    ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  },
  pool: { min: 2, max: 10 },
});
