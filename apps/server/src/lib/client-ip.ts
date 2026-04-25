import type { Context } from 'hono';

export function clientIp(c: Context): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-real-ip') ??
    'unknown'
  );
}
