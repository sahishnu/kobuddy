import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.dirname(fileURLToPath(import.meta.url));

/** Resolve migrations folder for both `tsx src/index.ts` and `node dist/index.js`. */
export function defaultMigrationsPath(): string {
  return path.resolve(serverDir, '../../../../packages/db/migrations');
}

export function resolveSqlitePath(
  dataPath: string,
  databaseFile: string,
): string {
  const dir = path.resolve(dataPath);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, databaseFile);
}

export function coversDir(dataPath: string): string {
  const dir = path.join(path.resolve(dataPath), 'covers');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
