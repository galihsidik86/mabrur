import { db } from '../db';
import { Knex } from 'knex';

export async function withTransaction<T>(
  fn: (trx: Knex.Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (trx) => {
    return fn(trx);
  });
}
