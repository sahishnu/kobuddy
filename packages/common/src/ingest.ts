import { z } from 'zod';

const nullableString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null ? '' : v));

export const koreaderBookSchema = z.object({
  id: z.number(),
  md5: z.string().min(1),
  title: nullableString,
  authors: nullableString,
  notes: z.number().optional().default(0),
  last_open: z.number().optional().default(0),
  highlights: z.number().optional().default(0),
  pages: z.number().optional().default(0),
  series: nullableString,
  language: nullableString,
  total_read_time: z.number().optional(),
  total_read_pages: z.number().optional(),
});

export type KoreaderBook = z.infer<typeof koreaderBookSchema>;

export const pageStatPayloadSchema = z.object({
  page: z.number(),
  start_time: z.number(),
  duration: z.number(),
  total_pages: z.number(),
  book_md5: z.string().min(1),
  device_id: z.string().min(1),
});

export type PageStatPayload = z.infer<typeof pageStatPayloadSchema>;

function normalizeStatsInput(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') return [];
  return [];
}

export const ingestPayloadSchema = z.object({
  version: z.string().min(1),
  books: z.array(koreaderBookSchema),
  stats: z.preprocess(normalizeStatsInput, z.array(pageStatPayloadSchema)),
});

export type IngestPayload = z.infer<typeof ingestPayloadSchema>;

export const devicePayloadSchema = z.object({
  id: z.string().min(1),
  model: z.string().min(1),
  version: z.string().min(1),
});

export type DevicePayload = z.infer<typeof devicePayloadSchema>;
