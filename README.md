# kobuddy

Self-hosted reading statistics for [KOReader](https://koreader.rocks): ingest `statistics.sqlite3` data from your device, browse totals and per-book history in a small web UI, and optionally fetch book covers from Open Library / Google Books.

This project was bootstrapped as a **sibling** to [KoInsight](https://github.com/GeorgeSG/KoInsight) (same general idea: plugin + server + UI), but with a slimmer scope (no kosync, no annotations) and a modern stack (pnpm, Hono, Drizzle, TanStack Query/Router, Mantine).

## Quick start (Docker)

1. Copy `.env.example` to `.env` and set `INGEST_TOKEN`, `ADMIN_PASSWORD`, and `SESSION_SECRET`.
2. Run:

```bash
docker compose up --build -d
```

3. Open `http://localhost:3000` for the dashboard, `http://localhost:3000/api/docs` for API docs, and download the plugin from `http://localhost:3000/plugin.zip`.

## Local development

```bash
pnpm install
cp .env.example .env
# edit .env — secrets must satisfy length checks in apps/server/src/config.ts
pnpm dev
```

- API + static UI: `http://127.0.0.1:3000` (Vite proxies `/api` when you run `pnpm --filter @kobuddy/web dev` separately, or use the server alone after `pnpm build`).
- Generate DB migrations after schema edits: `pnpm db:generate` (from repo root).

## KOReader plugin

1. Download `plugin.zip` from your server (`/plugin.zip`).
2. Extract so you have `koreader/plugins/kobuddy.koplugin/` (folder name must end with `.koplugin`).
3. In KOReader: **Tools → kobuddy → Server & token…** — set base URL (e.g. `http://192.168.1.10:3000`) and the same `INGEST_TOKEN` as on the server.
4. **Sync reading stats** (or enable **Sync on suspend**).

The plugin reads `KOReader/settings/statistics.sqlite3` (same layout KoInsight uses). Server plugin version must match `REQUIRED_PLUGIN_VERSION` (default `0.1.0`).

## Auth

- **Device → server**: `Authorization: Bearer <INGEST_TOKEN>` on `/api/ingest/*` POST routes.
- **Browser admin**: `POST /api/auth/login` with JSON `{ "password": "<ADMIN_PASSWORD>" }` sets an encrypted cookie (`iron-session`). Mutations (covers, hide book, edit ISBN/title) require that session. Set `PUBLIC_READ=false` to require login for `GET /api/books` and `GET /api/stats` as well.

## Layout

| Path | Role |
|------|------|
| `apps/server` | Hono API, SQLite + Drizzle, serves `apps/web/dist` in production |
| `apps/web` | React + Mantine dashboard |
| `packages/db` | Drizzle schema + SQL migrations |
| `packages/common` | Shared Zod ingest schemas + stats DTO types |
| `plugin/kobuddy.koplugin` | Lua plugin (zipped by `/plugin.zip`) |

## License

MIT
