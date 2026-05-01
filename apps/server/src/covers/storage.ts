import fs from 'node:fs';
import path from 'node:path';
import { book } from '@kobuddy/db/schema';
import { eq } from 'drizzle-orm';
import type { AppConfig } from '../config.js';
import type { DbClient } from '../lib/db.js';

export function coverRelPath(md5: string): string {
  return `covers/${md5}.jpg`;
}

function coverAbsPath(cfg: AppConfig, md5: string): string {
  return path.join(cfg.DATA_PATH, coverRelPath(md5));
}

export async function saveCoverFile(
  db: DbClient,
  cfg: AppConfig,
  md5: string,
  bytes: Buffer,
  source: string,
): Promise<void> {
  const rel = coverRelPath(md5);
  const fp = coverAbsPath(cfg, md5);
  await fs.promises.mkdir(path.dirname(fp), { recursive: true });
  await fs.promises.writeFile(fp, bytes);
  await db
    .update(book)
    .set({ coverPath: rel, coverSource: source })
    .where(eq(book.md5, md5));
}

export async function deleteCoverFile(
  db: DbClient,
  cfg: AppConfig,
  md5: string,
): Promise<void> {
  const [b] = await db.select().from(book).where(eq(book.md5, md5)).limit(1);
  if (b?.coverPath) {
    const fp = path.join(cfg.DATA_PATH, b.coverPath);
    try {
      await fs.promises.unlink(fp);
    } catch {
      /* file may already be gone */
    }
  }
  await db
    .update(book)
    .set({ coverPath: null, coverSource: null })
    .where(eq(book.md5, md5));
}

export async function readCoverFile(
  cfg: AppConfig,
  coverPath: string,
): Promise<Buffer | null> {
  const fp = path.join(cfg.DATA_PATH, coverPath);
  try {
    return await fs.promises.readFile(fp);
  } catch {
    return null;
  }
}
