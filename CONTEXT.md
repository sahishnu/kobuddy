# kobuddy domain context

Crisp definitions for domain terms. Architecture language (module, seam, adapter, depth) lives in the `improve-codebase-architecture` skill's `LANGUAGE.md` and is intentionally kept separate from this file.

## Core entities

- **Device** — a reading app / piece of hardware. Identified by `device.id` sent from ingest (KOReader plugin uses a hardware id). The literal id `unknown-device` is reserved for ingest that can't attribute a Device (bulk SQLite import without a device hint, or JSON import whose `stats[].device_id` is all empty).
- **Book** — one row per KOReader-style document fingerprint (`book.md5`). `title` / `authors` / `series` / `language` come from KOReader; `customTitle` / `isbn` / `hidden` / `completedAt` / `coverPath` are our layer.
- **BookDevice** — the per-`Device` rollup for a `Book`: progress counts, last open, reading time. Composite PK `(bookMd5, deviceId)`. A Book read on two Devices has two BookDevice rows; consumers usually want `max(...)` across them.
- **BookDevice aggregate (per Book)** — for a given Book, the rollup across its BookDevice rows: `max(totalReadPages)`, `max(pages)`, `max(coalesce(lastOpen, 0))`, plus `completedAt` from the Book row. Visible-book rollups live in `apps/server/src/books/book-device-aggregates.ts`. Shelf eligibility, Currently Reading selection, and `StatsOverview.totalPagesRead` all use this rollup (SQL fragments and/or loaded rows).
- **PageStat** — a single KOReader reading segment mirrored from `page_stat_data`. Uniqueness: `(deviceId, bookMd5, page, startTime)`. Re-ingest updates `duration` / `totalPages` on conflict.

## Domain concepts

- **Visible Book / Visible PageStat** — a Book with `hidden = false`, and any PageStat whose Book is visible. All public read paths (`/api/books`, `/api/stats/*`) must respect this invariant. Admin mutation paths may read hidden rows by md5.
- **Currently Reading Book** — the Visible Book that is *unfinished* (`completedAt IS NULL` AND `max(totalReadPages) < max(pages)`) with the highest recent `max(lastOpen)` across its BookDevice rows. Used by:
  - the home dashboard card (decorated with cover + pages + totalReadPages + lastOpen),
  - the shelf mode in the books list to **exclude** the currently-reading Book from the general shelf.
- **Shelf-eligible Book** — a Visible Book that either has `max(totalReadPages) ≥ SHELF_MIN_READ_PAGES` (currently 5) or is effectively finished (`max(pages) > 0 AND max(totalReadPages) ≥ max(pages)`). Used by the home shelf.
- **StatsOverview** — the full dashboard DTO returned by `GET /api/stats`. Timezone-scoped: **every** field that depends on civil-calendar semantics honours the caller's IANA `timeZone`. Includes totals, per-month/day breakdowns, calendar, streaks, hourly reading profile, current week ISO deltas, and the Currently Reading Book.
- **StatsByBook** — per-Book stats for one md5: total reading time, per-month, per-day-of-week, calendar. Only returned for Visible Books (hidden Books return `null` / 404).
- **Ingest** — turning KOReader raw input (either JSON via plugin or an uploaded `statistics.sqlite3`) into our tables (`apps/server/src/ingest/`). Must run inside a **synchronous** `better-sqlite3` transaction.

  **Ingest policy** (merge / filter / device selection):

  1. **Bad row — `duration`** — drop stats where `duration` is not a finite number or is not strictly positive.
  2. **Bad row — `total_pages`** — drop stats where `total_pages` is not a finite number or is not strictly positive.
  3. **Device from batch** — after filtering, the effective device id is the first stat row’s non-empty `device_id` string (JSON path); SQLite upload supplies `device_id` on every parsed stat from the multipart hint.
  4. **Device fallback** — if no safe stat carries a `device_id`, use `unknown-device` and upsert a placeholder `Device` row for it.
  5. **`BookDevice` upsert** — on conflict: always set `pages`, `notes`, `highlights` from the payload; set `last_open` only when the incoming value is strictly positive, else keep the existing row; set `total_read_time` / `total_read_pages` only when the incoming value is strictly positive, else keep the existing row (never overwrite positive counters with zero).
  6. **`PageStat` upsert** — on conflict, set `duration` and `totalPages` from the incoming row (`excluded`), replacing prior values.

## Invariants

- **One clock per response**: the timezone passed to `StatsOverview` applies to every civil-calendar field it contains. There is no server-local clock mixed in.
- **Hidden is structural**: the `hidden` filter is applied at the module interface for Visible queries, not repeated by callers.
- **showHidden is admin-only**: `GET /api/books?showHidden=true` lists hidden books only when the session is an admin session; otherwise the flag is ignored and only visible books are returned (even under `PUBLIC_READ`).
- **Ingest → cache**: cache invalidation follows a successful Ingest. Ingest itself does not know about the cache.

## Interface reuse

- Any DTO that crosses the HTTP seam between `apps/server` and `apps/web` lives in `@kobuddy/common` and is imported by both sides. Do not redefine these types in web or infer them locally.
- Server-local types (Drizzle row shapes, ingest policy internals, module-internal return types that never hit the wire) stay in the module.
- Wire-facing DTOs currently in `@kobuddy/common`: `StatsOverview`, `StatsByBook`, `CalendarDay`, `CurrentReadingBook`, `PerMonthReadingTime`, `PerDayOfTheWeek`, `WeekDayReading`, `HourlyReadingBlock`, `BookListItem`, `BookDetail`, `KoreaderBook`, `PageStatPayload`, `IngestPayload`, `DevicePayload`.

## Config knobs

- `PUBLIC_READ` — if true, `/api/books` and `/api/stats` are public GETs; mutations still require admin session.
- `INGEST_TOKEN` — Bearer on `/api/ingest/*` POSTs from Devices.
- `REQUIRED_PLUGIN_VERSION` — enforced on plugin-initiated ingest payloads.
- `READING_GOAL_BOOKS` — optional annual books goal surfaced in `StatsOverview`.
