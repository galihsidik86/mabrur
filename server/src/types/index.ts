export type UserRole = 'admin' | 'muthawwif' | 'jamaah';
export type GroupRole = 'jamaah' | 'muthawwif';

export interface AuthPayload {
  sub: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}
