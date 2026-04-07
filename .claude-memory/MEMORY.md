# key-manager — Project Memory

## Project Identity

- **Name:** key-manager
- **URL:** `key.sisihome.org:7823`
- **Purpose:** Self-hosted Gemini API key pool manager — store, validate, organize Google Gemini API keys
- **Version:** 1.3.0

---

## Architecture

- **Monorepo:** npm workspaces — `packages/server` + `packages/web`
- **Server:** Express 4.21 + TypeScript (ESM), port 7823, serves web SPA as static files
- **Database:** SQLite via `better-sqlite3`, WAL mode, path via `DATABASE_PATH` env
- **Frontend:** React 19 + Vite 6 + Tailwind CSS 3.4
- **Deployment:** Docker on self-hosted Raspberry Pi runner, image `kevin950805/key-manager:latest`
- **Timezone:** `TZ=Asia/Taipei` in container

---

## Key Invariants

- Keys masked in list API (last 8 chars only); full value only in `/api/keys/export`
- Key validation: must start with `AIza`, min 20 chars
- Test endpoint: `https://generativelanguage.googleapis.com/v1beta/models?key=…`, 10s timeout
- Status values: `active` | `invalid` | `cooldown` | `unknown`
- `projects` field: comma-separated string in DB, not an array

---

## Tooling (added v1.3.0+)

| Tool | Config file | Scripts |
|------|-------------|---------|
| ESLint 9 (flat config) | `eslint.config.js` | `npm run lint`, `npm run lint:fix` |
| Prettier 3 | `.prettierrc` | `npm run format`, `npm run format:check` |

ESLint uses `typescript-eslint` strict + type-checked rules.
Prettier: `singleQuote: true`, `semi: true`, `tabWidth: 2`, `printWidth: 100`.

---

## Constraints

1. Do **not** upgrade existing package versions — only add new ones
2. Keep ESM (`"type": "module"`) — no `require()`
3. No ORM — raw `better-sqlite3` SQL only
4. No auth middleware (private/trusted network tool)
5. Server must serve web SPA static files (no separate deployment)
6. SQLite WAL mode must stay enabled
7. Port 7823 is canonical

---

## API Surface

`/api/keys` — GET list, GET /export, POST /, POST /batch-import, PUT /:id, DELETE /:id, POST /:id/test, POST /test-all (SSE)

---

## File Landmarks

| File | Role |
|------|------|
| `packages/server/src/routes/keys.ts` | All API endpoint logic |
| `packages/server/src/db/migrate.ts` | Schema definition |
| `packages/server/src/db/connection.ts` | DB singleton, WAL setup |
| `packages/web/src/App.tsx` | All frontend state & UI |
| `packages/web/src/types.ts` | Shared TS interfaces |
| `docker-compose.yml` | Production container config |
