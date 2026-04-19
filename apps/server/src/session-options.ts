import type { SessionOptions } from 'iron-session';
import type { AppConfig } from './config.js';

export function sessionOptions(cfg: AppConfig): SessionOptions {
  return {
    cookieName: 'kobuddy_session',
    password: cfg.SESSION_SECRET,
    cookieOptions: {
      secure: cfg.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
    },
  };
}
