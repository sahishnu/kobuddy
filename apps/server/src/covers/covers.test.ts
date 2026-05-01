import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { CoverCandidate } from '@kobuddy/common';
import { book } from '@kobuddy/db/schema';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInMemoryDb } from '../test-util/in-memory-db.js';
import { seedBook } from '../test-util/seed.js';
import { testAppConfig } from '../test-util/test-config.js';
import {
  applyCoverCandidate,
  applyCustomCover,
  autoCoverAfterIsbnChange,
  deleteCover,
  listCoverCandidates,
  listIsbnCandidates,
  readCoverBytes,
} from './index.js';
import { coverRelPath } from './storage.js';

function tmpCfg(): {
  cfg: ReturnType<typeof testAppConfig>;
  cleanup: () => void;
} {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kobuddy-cover-'));
  const cfg = testAppConfig({ DATA_PATH: dir });
  return {
    cfg,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

describe('covers façade', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('listCoverCandidates merges mocked provider responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('openlibrary.org/search.json')) {
        return new Response(
          JSON.stringify({
            docs: [
              {
                cover_i: 42,
                title: 'OL Title',
                author_name: ['Auth'],
                first_publish_year: 2000,
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes('googleapis.com/books/v1/volumes')) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    });
    const { cfg, cleanup } = tmpCfg();
    try {
      const list = await listCoverCandidates(cfg, 'OL Title', 'Auth', null);
      expect(list.some((c) => c.providerId === 'id:42')).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('listIsbnCandidates returns deduped ISBN rows', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('openlibrary.org/search.json')) {
        return new Response(
          JSON.stringify({
            docs: [
              {
                key: '/works/W1',
                title: 'Book',
                author_name: ['P'],
                isbn: ['9780306406157'],
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    });
    const { cfg, cleanup } = tmpCfg();
    try {
      const list = await listIsbnCandidates(cfg, 'Book', 'P');
      expect(list).toHaveLength(1);
      expect(list[0].isbn).toBe('9780306406157');
    } finally {
      cleanup();
    }
  });

  it('applyCoverCandidate persists bytes when download succeeds', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(Buffer.alloc(600), { status: 200 }),
    );
    const db = createInMemoryDb();
    const { cfg, cleanup } = tmpCfg();
    try {
      seedBook(db, { md5: 'm1' });
      const candidate: CoverCandidate = {
        provider: 'googlebooks',
        providerId: 'v1',
        title: 't',
        authors: 'a',
        thumbnailUrl: 'https://example.com/cover.jpg',
      };
      const ok = await applyCoverCandidate(db, cfg, 'm1', candidate);
      expect(ok).toBe(true);
      const [row] = db.select().from(book).where(eq(book.md5, 'm1')).all();
      expect(row?.coverPath).toBe(coverRelPath('m1'));
      expect(row?.coverSource).toBe('googlebooks:v1');
      const fp = path.join(cfg.DATA_PATH, coverRelPath('m1'));
      expect(fs.existsSync(fp)).toBe(true);
      expect(fs.readFileSync(fp).length).toBe(600);
    } finally {
      cleanup();
    }
  });

  it('applyCustomCover sets manual source', async () => {
    const db = createInMemoryDb();
    const { cfg, cleanup } = tmpCfg();
    try {
      seedBook(db, { md5: 'm2' });
      await applyCustomCover(db, cfg, 'm2', Buffer.alloc(400));
      const [row] = db.select().from(book).where(eq(book.md5, 'm2')).all();
      expect(row?.coverSource).toBe('manual');
    } finally {
      cleanup();
    }
  });

  it('readCoverBytes loads from DATA_PATH', async () => {
    const { cfg, cleanup } = tmpCfg();
    try {
      const rel = 'covers/manual.jpg';
      const fp = path.join(cfg.DATA_PATH, rel);
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      fs.writeFileSync(fp, Buffer.from([1, 2, 3]));
      const buf = await readCoverBytes(cfg, rel);
      expect(buf?.length).toBe(3);
    } finally {
      cleanup();
    }
  });

  it('deleteCover removes file and clears book columns', async () => {
    const db = createInMemoryDb();
    const { cfg, cleanup } = tmpCfg();
    try {
      seedBook(db, { md5: 'm3' });
      await applyCustomCover(db, cfg, 'm3', Buffer.alloc(400));
      await deleteCover(db, cfg, 'm3');
      const [row] = db.select().from(book).where(eq(book.md5, 'm3')).all();
      expect(row?.coverPath).toBeNull();
      expect(row?.coverSource).toBeNull();
    } finally {
      cleanup();
    }
  });

  it('autoCoverAfterIsbnChange skips when user had a manual cover', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const db = createInMemoryDb();
    const { cfg, cleanup } = tmpCfg();
    try {
      seedBook(db, { md5: 'm4' });
      await db
        .update(book)
        .set({ isbn: '9780306406157', coverSource: 'manual' })
        .where(eq(book.md5, 'm4'))
        .run();
      await autoCoverAfterIsbnChange(db, cfg, 'm4', true, '9780306406157');
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      cleanup();
    }
  });

  it('autoCoverAfterIsbnChange skips when newIsbn is null', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const db = createInMemoryDb();
    const { cfg, cleanup } = tmpCfg();
    try {
      seedBook(db, { md5: 'm5' });
      await autoCoverAfterIsbnChange(db, cfg, 'm5', false, null);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      cleanup();
    }
  });

  it('autoCoverAfterIsbnChange skips when book row has no isbn', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const db = createInMemoryDb();
    const { cfg, cleanup } = tmpCfg();
    try {
      seedBook(db, { md5: 'm6' });
      await autoCoverAfterIsbnChange(db, cfg, 'm6', false, '9780306406157');
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      cleanup();
    }
  });

  it('autoCoverAfterIsbnChange downloads first candidate when book has isbn', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('openlibrary.org/isbn/')) {
        return new Response(JSON.stringify({ title: 'Hi' }), { status: 200 });
      }
      if (url.includes('openlibrary.org/search.json')) {
        return new Response(
          JSON.stringify({
            docs: [
              {
                cover_i: 99,
                title: 'Hi',
                author_name: ['Z'],
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes('covers.openlibrary.org')) {
        return new Response(Buffer.alloc(600), { status: 200 });
      }
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    });
    const db = createInMemoryDb();
    const { cfg, cleanup } = tmpCfg();
    try {
      seedBook(db, { md5: 'm7', title: 'Hi', authors: 'Z' });
      await db
        .update(book)
        .set({ isbn: '9780306406157' })
        .where(eq(book.md5, 'm7'))
        .run();
      await autoCoverAfterIsbnChange(db, cfg, 'm7', false, '9780306406157');
      const [row] = db.select().from(book).where(eq(book.md5, 'm7')).all();
      expect(row?.coverSource).toBe('openlibrary:id:99');
    } finally {
      cleanup();
    }
  });

  it('applyCoverCandidate returns false when download fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(Buffer.alloc(100), { status: 200 }),
    );
    const db = createInMemoryDb();
    const { cfg, cleanup } = tmpCfg();
    try {
      seedBook(db, { md5: 'm8' });
      const candidate: CoverCandidate = {
        provider: 'googlebooks',
        providerId: 'v1',
        title: 't',
        authors: 'a',
        thumbnailUrl: 'https://example.com/small.jpg',
      };
      const ok = await applyCoverCandidate(db, cfg, 'm8', candidate);
      expect(ok).toBe(false);
      const [row] = db.select().from(book).where(eq(book.md5, 'm8')).all();
      expect(row?.coverPath).toBeNull();
    } finally {
      cleanup();
    }
  });
});
