# Refactor plan — progress tracker

Use this file with `CONTEXT.md` when continuing in a new chat. **Tick and annotate each PR as it lands.**

**Follow-on work (post PR 1–7):** see [`ARCHITECTURE-TODO.md`](./ARCHITECTURE-TODO.md) for the next deepening candidates, priorities, and agent handoff detail.

---

## Ordering rationale

**Dependencies**

- `books/current-reading.ts` is consumed by both StatsOverview (PR 2) and Book shelf mode (PR 5), so it lands first as its own piece (PR 1 — done).
- Composition-root cache invalidation (from PR 2) has to land with or before the Ingest reorg (PR 3), otherwise `ingest-service.ts`'s fire-and-forget `.catch(() => {})` lives through two PRs.
- Book's `updateBook` returning `BookUpdateResult` is what lets the Cover route call `autoCoverAfterIsbnChange(...)` cleanly, so Book lands before Cover's façade migration.
- Pure type moves to `@kobuddy/common` get their own PRs so type changes aren't mixed with refactors — easier review, easier revert.

**Final order**

1. Currently Reading module — small, isolated, proves the directory-as-module pattern.
2. StatsOverview module — core refactor; absorbs related work; composition-root invalidation.
3. Ingest module — self-contained; biggest test-coverage win.
4. Book DTOs → `@kobuddy/common` — pure type move, fast review.
5. Book module — core refactor; subtle `showHidden` admin-gating included.
6. Cover DTOs → `@kobuddy/common` + CoverProvider interface — internal Cover refactor, façade remains back-compat.
7. Cover façade + route simplification — completes `services/` deletion.

**Rough sizing (LOC of diff, ±30%)**


| PR  | ~LOC |
| --- | ---- |
| 1   | 200  |
| 2   | 700  |
| 3   | 600  |
| 4   | 150  |
| 5   | 700  |
| 6   | 500  |
| 7   | 500  |


**Total ~3,350.** Largest PRs (#2, #5, ~700 each) are the ceiling.

**What to ship first to de-risk**

PR 1 (Currently Reading) is the right first cut — ~200 lines, one clear deepening, introduces `books/`, establishes in-memory DB test substrate, low risk. If that lands clean, PR 2 is safe to attempt.

---

## Cross-cutting mechanics

### Test substrate (set up in PR 1, reused in PRs 1–7)

Add to `apps/server/src/test-util/` (or equivalent):

- `createInMemoryDb()` — opens `better-sqlite3(':memory:')`, runs all Drizzle migrations from `packages/db/migrations/`, returns `DbClient`.
- `seed()` helpers for Device / Book / BookDevice / PageStat with sensible defaults.

Used by every module-level test. Keeps tests fast (<50ms per test typically).

### `CONTEXT.md` maintenance

Each PR that sharpens or introduces a term updates `CONTEXT.md` in the same commit:


| PR  | CONTEXT.md                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------- |
| 1   | no changes (terms already added)                                                                          |
| 2   | no changes                                                                                                |
| 3   | the six merge/filter/device-selection rules become an **Ingest policy** subsection under the Ingest entry |
| 5   | `showHidden` admin-only rule under **Invariants** (see `showHidden is admin-only`)                        |
| 7   | no changes                                                                                                |


### Rollback posture

Each PR is independently revertable. The riskiest (**PR 2** — tz label change; **PR 5** — `showHidden` gating) have the most visible user impact; flag those with commit messages that clearly signal behaviour change so a revert is a clean `git revert <sha>`.

---

## PR 1 — Currently Reading module

**Scope:** Introduce `apps/server/src/books/current-reading.ts`. Migrate two callers. Delete `book-device-aggregates.ts`.

**Changes**

- New: `books/current-reading.ts` exporting `currentReadingBook(db: DbClient): Promise<CurrentReadingBook | null>`. Return type imported from `@kobuddy/common`.
- New: `books/` directory seeded.
- `routes/stats.ts`: remove local `loadCurrentReadingBook()`, import `currentReadingBook`.
- `routes/books.ts` shelf mode: replace `loadBookDeviceAggregates` + `pickCurrentReadingBookMd5` calls with `currentReadingBook`.
- Delete: `apps/server/src/stats/book-device-aggregates.ts`.
- Tests (new file `books/current-reading.test.ts`):
  - Empty DB → null.
  - One in-progress visible Book → decorated correctly.
  - Two in-progress → higher `lastOpen` wins.
  - Completed + in-progress → in-progress.
  - Only completed → null.
  - Hidden Book with high `lastOpen` → ignored.
  - Uses in-memory `better-sqlite3` with real Drizzle schema.

**Risk:** Very low. Two callers, one trivially decorated helper.

**Exit criteria:** Lint + tests green. Manual smoke: home dashboard still shows current book; shelf still excludes it.

- **Done** (2026-05-01)

**Completion notes**

- Added `books/current-reading.ts`, `constants.ts` (`SHELF_MIN_READ_PAGES`), `index.ts` re-exports.
- Removed `stats/book-device-aggregates.ts`; logic inlined in `current-reading.ts`.
- Test substrate: `test-util/in-memory-db.ts`, `test-util/seed.ts`.
- `CONTEXT.md`: unchanged (per plan).
- **Verify:** `pnpm --filter @kobuddy/server build` + `pnpm --filter @kobuddy/server test`. Repo `pnpm lint` may show pre-existing warnings; fix only what this PR touches.
- **Env:** If `better-sqlite3` fails with NODE_MODULE_VERSION mismatch, rebuild native addon for the Node version running tests.

---

## PR 2 — StatsOverview module

**Scope:** The big one. Fold `statsService` in, move cache inside, route becomes glue.

**Changes**

- New: `apps/server/src/stats/index.ts` exporting `statsOverview`, `statsCalendar`, `statsForBook`, `invalidateStatsCache`.
- Internal: `stats-dashboard.ts`, `stats-tz.ts`, `stats-queries.ts`, `stats-cache.ts` stop being imported from outside `stats/`.
- Fold `stats-service.ts` contents (tz-parameterized) into `stats/` module; delete `stats-service.ts`.
- Change: `perMonth` and `perDayOfTheWeek` use `Intl.DateTimeFormat({ timeZone, ... })` instead of date-fns server-local format. **User-visible:** month labels render in caller's tz.
- Change: `statsForBook(md5)` honours `book.hidden = false` (fix for the leak on `GET /api/stats/:md5`).
- Add `StatsByBook` type to `@kobuddy/common`.
- `routes/stats.ts`: three handlers each become 5–10 lines.
- **Composition-root invalidation:** `routes/ingest.ts` (3 POSTs) and `routes/books.ts` (`POST /import-sqlite`) each `await invalidateStatsCache(db)` after successful ingest. Remove the `.catch(() => {})` line from `ingest-service.ts`.

**Tests** (new file `stats/stats.test.ts`)

- All twelve `statsOverview` / `statsCalendar` / `statsForBook` cases laid out in the plan's test surface.
- `stats-dashboard.test.ts` stays, retargets imports from `stats/stats-dashboard.ts` (now internal). Rationale: the math is fiddly enough that losing those tests would be a net regression.
- Route-level: one HTTP test per ingest endpoint asserting cache invalidation happens (spy on `invalidateStatsCache` or observe `stats_cache` row deletion).

**Risk:** Medium. Timezone month-label behaviour change is user-visible. Validate with one end-to-end manual check.

**Exit criteria:** Tests green. Manual: `GET /api/stats?timeZone=Asia/Tokyo` returns month labels formatted in Japanese-calendar local time. `GET /api/stats/:md5` returns 404 for a hidden Book.

- **Done** (2026-05-01)

**Completion notes**

- `stats/index.ts` is the public façade: `statsOverview` (cache + `StatsOverview` DTO), `statsCalendar`, `statsForBook`, `invalidateStatsCache`, `isValidIanaTimeZone`. `routes/stats.ts` imports only from `stats/index.js`.
- `stats/aggregates.ts` replaces `stats-service.ts`; `getPerMonthReadingTime` / `perDayOfTheWeek` take `timeZone` and use `Intl` + `localYmdParts` for civil-calendar bucketing.
- `packages/common`: new `StatsByBook` (includes `statsTimeZone`). `GET /api/stats/:md5` returns 404 for hidden or missing books.
- Cache invalidation: removed from `ingest-service.ts`; `routes/ingest.ts` awaits `invalidateStatsCache` after successful `/device`, `/import`, `/import-sqlite`; `routes/books.ts` after admin `/import-sqlite`.
- Tests: `stats/stats.test.ts` (12 cases). `vitest.config.ts` excludes `dist/` from test runs. `test-util/test-config.ts` for deterministic `AppConfig`.
- **Behaviour change:** month/weekday breakdowns follow the request `timeZone`, not the server process default. Flag in commit message for revert.

---

## PR 3 — Ingest module

**Scope:** Reorganize + add the first real tests of ingest policy.

**Changes**

- New: `apps/server/src/ingest/index.ts` exporting `ingestFromJson`, `ingestFromKoreaderSqlite`, `registerDevice`, `UNKNOWN_DEVICE_ID`, type `IngestResult` (with new `pageStatsFiltered: number`).
- New: `apps/server/src/ingest/koreader-sqlite-parser.ts` — renamed from `services/koreader-statistics-sqlite.ts`. Tests move with it.
- Delete: `services/ingest-service.ts`, `services/sqlite-statistics-import.ts`, `services/koreader-statistics-sqlite.ts`.
- `routes/ingest.ts`: imports change, logs include `pageStatsFiltered`.
- `routes/books.ts` admin sqlite route: import path update.

**Tests** (new file `ingest/ingest.test.ts`)

- All eleven `ingestFromJson` / `ingestFromKoreaderSqlite` / `registerDevice` cases from the plan's test surface.
- Each of the six merge/filter/device-selection policies is its own test. These are the core rules that had zero coverage before.

**Risk:** Low–medium. Policy behaviour unchanged (only reorganized); tests are the real deliverable.

**Exit criteria:** Tests green. Plugin can still `/import` and `/import-sqlite`. Admin upload still works.

- **Done** (2026-05-01)

**Completion notes**

- New module `apps/server/src/ingest/`: `index.ts` (`ingestFromJson`, `ingestFromKoreaderSqlite`, `registerDevice`, `UNKNOWN_DEVICE_ID`, `deviceIdFromMultipartField`, `IngestResult` with `pageStatsFiltered`), `koreader-sqlite-parser.ts` (moved from `services/koreader-statistics-sqlite.ts`).
- Removed `services/ingest-service.ts`, `services/sqlite-statistics-import.ts`, `services/koreader-statistics-sqlite.ts` and their tests; parser tests live in `ingest/koreader-sqlite-parser.test.ts`.
- `ingest/ingest.test.ts` covers policy (filter, device selection, book_device merge, page_stat upsert, registerDevice, sqlite path). `routes/ingest.ts` and `routes/books.ts` import from `ingest/`; ingest logs and JSON responses include `pageStatsFiltered` where counts are returned.
- `CONTEXT.md`: **Ingest policy** subsection (six rules). `seedBookDevice` accepts optional `totalReadTime` for tests.
- **Verify:** `pnpm --filter @kobuddy/server build` + `pnpm --filter @kobuddy/server test` (rebuild `better-sqlite3` if `NODE_MODULE_VERSION` mismatch vs local Node).

---

## PR 4 — Book DTOs → `@kobuddy/common`

**Scope:** Pure type move. Tiny, reviewable in minutes.

**Changes**

- Add to `packages/common/src/stats.ts` (or a new `packages/common/src/books.ts`): `BookListItem`, `BookDetail`.
- Server `routes/books.ts`: handlers annotate return types as `BookListItem[]` / `BookDetail`.
- Web: delete `apps/web/src/lib/types.ts::BookListRow`. Every web file that referenced `BookListRow` now imports `BookListItem` from `@kobuddy/common`.

**Tests:** TypeScript is the test. No new runtime tests.

**Risk:** Near zero. If it compiles, it works.

**Exit criteria:** `pnpm build` green across both apps.

- **Done** (2026-05-01)

**Completion notes**

- New `packages/common/src/books.ts`: `BookListItem` (list row), `BookDetail` (`GET /api/books/:md5` inner `book`; `createdAt` as ISO string).
- Re-exported from `packages/common/src/index.ts`.
- `routes/books.ts`: list handler builds `BookListItem[]`; detail handler builds explicit `BookDetail` (`createdAt` via `toISOString()`).
- Web: removed `apps/web/src/lib/types.ts`; `BookListItem` imported from `@kobuddy/common` in `AdminBookEditDialog`, `HomePage`, `BooksPage`, `AdminBooksPage`.
- **Verify:** `pnpm build` at repo root.

---

## PR 5 — Book module

**Scope:** Extract Book CRUD from `routes/books.ts` into a real module.

**Changes**

- New: `apps/server/src/books/index.ts` exporting `listBooks`, `getBook`, `updateBook` with the agreed signatures.
- `routes/books.ts`: `GET /`, `GET /:md5`, `PUT /:md5`, `PUT /:md5/hide` become one-line calls. `**showHidden` admin-gating:** route passes `showHidden: session.isAdmin && query.showHidden === 'true'`.
- Route-level: after `updateBook` returns `isbnChanged: true`, call `tryAutoCoverAfterIsbnUpdate(...)` (still the old function from `services/cover-service.ts`; renamed in PR 7).
- `coverUrl` construction moves to three route-layer one-liners (books list, book detail, stats overview's current book card).

**Tests** (new `books/books.test.ts`)

- The twelve cases from the plan's test surface (`listBooks`, `getBook`, `updateBook`).
- One route-level test: `GET /?showHidden=true` without admin session returns only visible books.

**Risk:** Medium. `**showHidden` admin-gating is a behaviour change** — previously `PUBLIC_READ=true` + `?showHidden=true` would expose hidden Books. This is a **security tightening**; call it out in the PR description.

**Exit criteria:** Tests green. Web admin UI unchanged functionally.

- **Done** (2026-05-01)

**Completion notes**

- `apps/server/src/books/books.ts`: `listBooks`, `getBook`, `updateBook`, `setBookHidden`; list rows omit `coverUrl` until the route maps `coverUrl` from `coverPath`.
- `currentReadingBook` returns `CurrentReadingBookRow` (`coverPath` instead of `coverUrl`); `statsOverview` maps `coverUrl` at the stats layer.
- `routes/books.ts`: `showHidden` = `Boolean(session.isAdmin && query.showHidden === 'true')`; CRUD handlers delegate to the books module; `tryAutoCoverAfterIsbnUpdate` stays on the route when `updateBook` reports `isbnChanged`.
- Tests: `books/books.test.ts` (list/get/update/hide + route gating for non-admin + `showHidden=true`). `current-reading.test.ts` expects `coverPath` on the row type.
- `CONTEXT.md`: **showHidden is admin-only** invariant.
- **Verify:** `pnpm build`; `pnpm --filter @kobuddy/server test` after rebuilding `better-sqlite3` for local Node if needed.

---

## PR 6 — Cover DTOs + CoverProvider interface

**Scope:** Internal Cover refactor. Façade (`cover-lookup-service.ts` + `cover-service.ts`) continues to export the same functions during this PR — callers don't change.

**Changes**

- Add to `packages/common/src/books.ts`: `CoverProviderName`, `CoverCandidate`, `IsbnCandidate`.
- Web: delete local types in `AdminBookEditDialog.tsx`; import from common.
- Server: new `apps/server/src/covers/providers/provider.ts` with the `CoverProvider` interface + `ProviderResult` internal type.
- New `apps/server/src/covers/providers/open-library.ts` and `google-books.ts` — factory functions returning adapters.
- `cover-lookup-service.ts` rewrites internally to delegate to providers, but exports the same functions as before (`searchCoverCandidates`, `searchIsbnCandidates`, `fetchCoverBytes`) as adapter façade. No caller change yet.
- ISBN helpers move to `covers/isbn.ts`. Test file migrates with them (unchanged).

**Tests**

- New: `covers/providers/open-library.test.ts` + `covers/providers/google-books.test.ts` — mock `global.fetch`, assert URL construction, result mapping, `coverRef`/`isbns` extraction, `fetchBytes` behaviour including the < 500 byte rejection and http→https rewrite.
- `covers/isbn.test.ts` — existing tests unchanged.

**Risk:** Low. No caller-facing changes; swapping internals behind the same function names.

**Exit criteria:** Tests green. Routes still work identically.

- **Done** (2026-05-01)

**Completion notes**

- `packages/common/src/books.ts`: `CoverProviderName`, `CoverCandidate`, `IsbnCandidate` for wire + web.
- Web `AdminBookEditDialog.tsx` imports those types from `@kobuddy/common`.
- `apps/server/src/covers/isbn.ts` + `covers/isbn.test.ts` (migrated from deleted `services/cover-lookup-service.isbn.test.ts`).
- `covers/providers/provider.ts`: `CoverProvider` adapter interface and `CoverSearchInput` (no separate `ProviderResult` type — redundant).
- `covers/providers/http.ts`: shared `fetchJson`.
- `covers/providers/open-library.ts`, `google-books.ts` + fetch-mock tests (`open-library.test.ts`, `google-books.test.ts`).
- `services/cover-lookup-service.ts`: orchestrates both providers in parallel, same public API; re-exports ISBN helpers from `covers/isbn.ts`.
- `cover-service.ts`: `CoverCandidate` type from `@kobuddy/common`.
- **Bugfix (align with CONTEXT ingest policy):** `ingestFromJson` now assigns the batch effective `deviceId` to every `page_stat` row (was `s.device_id ?? deviceId`, which could reference devices never upserted).
- **Verify:** `pnpm build`; `pnpm --filter @kobuddy/server test` (rebuild `better-sqlite3` if Node native module mismatch).

---

## PR 7 — Cover façade + route simplification

**Scope:** Drop the compatibility shim from PR 6. Route handlers migrate to the new façade.

**Changes**

- New: `apps/server/src/covers/index.ts` with the full façade (`listCoverCandidates`, `listIsbnCandidates`, `applyCoverCandidate`, `applyCustomCover`, `readCoverBytes`, `deleteCover`, `autoCoverAfterIsbnChange`).
- New: `apps/server/src/covers/storage.ts` (internal) — fs + `book.coverPath`/`coverSource` writes.
- Delete: `services/cover-lookup-service.ts`, `services/cover-service.ts`.
- Delete: `apps/server/src/services/` directory (now empty).
- `routes/books.ts` seven cover/ISBN endpoints become ~5-line glue each. Total line count drops to ~100.
- `PUT /:md5`: replace `tryAutoCoverAfterIsbnUpdate(...)` with `autoCoverAfterIsbnChange(...)`.

**Tests** (new `covers/covers.test.ts`)

- Façade tests against in-memory DB + mocked providers: all six scenarios from the plan's test surface (`listCoverCandidates`, `applyCoverCandidate`, `applyCustomCover`, `deleteCover`, `autoCoverAfterIsbnChange` with each policy branch).

**Risk:** Medium. Biggest route-file diff. Validate manually: candidate list → pick → apply; upload custom; delete; edit ISBN and see auto-cover trigger.

**Exit criteria:** Tests green. `services/` directory gone. Full web admin flow still works end-to-end.

- **Done** (2026-05-01)

**Completion notes**

- `covers/index.ts`: public façade — `listCoverCandidates`, `listIsbnCandidates`, `applyCoverCandidate`, `applyCustomCover`, `readCoverBytes`, `deleteCover`, `autoCoverAfterIsbnChange`; re-exports `normalizeIsbnForStorage`, `pickPrimaryIsbnFromList`.
- `covers/lookup.ts`: provider orchestration (`searchCoverCandidates`, `searchIsbnCandidates`, `fetchCoverBytes`) moved from deleted `services/cover-lookup-service.ts`.
- `covers/storage.ts`: filesystem + Drizzle updates (formerly `cover-service.ts` helpers).
- Deleted `apps/server/src/services/` (`cover-lookup-service.ts`, `cover-service.ts`).
- `routes/books.ts`: imports only `covers/index.js`; ISBN auto + book `PUT` call `autoCoverAfterIsbnChange`.
- Tests: `covers/covers.test.ts` (in-memory DB, temp `DATA_PATH`, mocked `fetch`).
- **Verify:** `pnpm build`; `pnpm --filter @kobuddy/server test`.

---
