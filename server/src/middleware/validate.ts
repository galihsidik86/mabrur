import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validate(
  schema: ZodSchema,
  source: 'body' | 'query' | 'params' = 'body',
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const messages = result.error.errors.map(
        (e) => `${e.path.join('.')}: ${e.message}`,
      );
      res.status(400).json({
        error: {
          message: 'Data tidak valid',
          code: 'VALIDATION_ERROR',
          details: messages,
        },
      });
      return;
    }

    req[source] = result.data;
    next();
  };
}
