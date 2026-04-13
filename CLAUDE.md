# key-manager — CLAUDE.md

## Project Overview

**key-manager** is a self-hosted Gemini API key pool manager deployed at `key.sisihome.org:7823`.
It stores, validates, and organizes Google Gemini API keys with batch import, live testing (SSE), and `.env`-style export.

---

## Architecture

### Monorepo Layout

```
key-manager/
├── packages/
│   ├── server/          # Express.js API + static file serving
│   │   └── src/
│   │       ├── index.ts         # Entry point, port 7823
│   │       ├── routes/keys.ts   # All /api/keys endpoints
│   │       └── db/
│   │           ├── connection.ts  # better-sqlite3 setup, WAL mode
│   │           └── migrate.ts     # Schema definition
│   └── web/             # React 19 + Vite 6 SPA
│       └── src/
│           ├── App.tsx            # Root component, all state management
│           ├── types.ts           # Shared TypeScript interfaces
│           └── components/
│               ├── AddKeyModal.tsx
│               ├── EditKeyModal.tsx
│               ├── BatchImportSection.tsx
│               └── StatusBadge.tsx
├── Dockerfile           # Multi-stage: build (Node 20-alpine) → runtime
├── docker-compose.yml   # Image: kevin950805/key-manager:latest, port 7823
├── package.json         # Root workspace (npm workspaces)
└── tsconfig.json        # Root TS config, ES2022, NodeNext
```

### Tech Stack

| Layer | Tech |
|-------|------|
| Runtime | Node.js 20 (Alpine Docker) |
| Server | Express 4.21, TypeScript (ESM) |
| Database | better-sqlite3 11.7 (SQLite, WAL mode) |
| Frontend | React 19, Vite 6, Tailwind CSS 3.4 |
| Icons | lucide-react 0.468 |
| Dev | tsx (watch mode), concurrently |

### Database Schema — `api_keys`

```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
key_value       TEXT NOT NULL UNIQUE
account_name    TEXT NOT NULL DEFAULT ''
status          TEXT NOT NULL DEFAULT 'unknown'  -- 'active' | 'invalid' | 'cooldown' | 'unknown'
last_tested_at  TEXT  -- ISO datetime, nullable
projects        TEXT NOT NULL DEFAULT ''          -- comma-separated project names
created_at      TEXT NOT NULL DEFAULT (datetime('now'))
```

- DB path: `DATABASE_PATH` env var or `./data/key-manager.db`
- Volume: `key-manager-data:/app/data`

---

## API Endpoints

Base path: `/api/keys`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List all keys (masked: last 8 chars + asterisks) |
| `GET` | `/export` | Export active/cooldown keys, unmasked, grouped by account |
| `POST` | `/` | Add single key (validates `AIza` prefix, min 20 chars) |
| `POST` | `/batch-import` | Bulk import — accepts JSON array, `key=value`, export prefix, CSV |
| `PUT` | `/:id` | Update `account_name` and `projects` |
| `DELETE` | `/:id` | Remove key |
| `POST` | `/:id/test` | Test single key against Google API → `{status}` |
| `POST` | `/test-all` | Test all keys via SSE stream (`text/event-stream`); emits `{id, status}` per key |
| `GET` | `/quota-summary` | Aggregate raw key counts + trusted quota-bucket summary |

**Key validation:** must start with `AIza`, min length 20.

**Test endpoint (v1.3.0+):** `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={key}`, 10s timeout.
- Uses a minimal `generateContent` request body to verify real quota availability, not just key validity.
- **Four-state status mapping:**

| HTTP Response | Status | Meaning |
|--------------|--------|---------|
| 200 | `available` | Key is valid and has quota |
| 429 (quota exceeded) | `exhausted` | Key valid but daily/minute quota used up |
| 429 (rate limited) | `rate_limited` | Temporarily throttled; retry later |
| 400 / 403 / other | `invalid` | Key is revoked, invalid, or rejected |

- **Gemini free-tier limitation:** Free-tier keys do NOT return `X-RateLimit-*` headers. The only reliable way to distinguish `exhausted` vs `rate_limited` is by parsing the error message body from the 429 response.

**quota-summary endpoint:** `GET /api/keys/quota-summary`
- Returns both raw per-key status counts and trusted bucket-aware counts.
- `projects` tags are interpreted as quota-bucket hints; the **first tag** is treated as the canonical bucket ID.
- Keys without bucket tags are reported as `unscoped` and do **not** count toward `trusted_available_keys`.
- Buckets whose keys disagree (`available` + `exhausted` in the same bucket) are marked `mixed` and do **not** count toward trusted capacity.
- Used by consumers (e.g., `ai-core`) to decide whether a pool is truly usable without exposing full key values.

---

## Deployment

### Infrastructure

- Deployed on a **self-hosted Raspberry Pi** runner via GitHub Actions
- CI/CD: `.github/workflows/` — builds Docker image, pushes to DockerHub, deploys via SSH
- DockerHub image: `kevin950805/key-manager:latest`
- Timezone: `TZ=Asia/Taipei` (set in container)

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `7823` | Server listen port |
| `DATABASE_PATH` | `./data/key-manager.db` | SQLite file path |
| `TZ` | `Asia/Taipei` | Container timezone |

### Build & Run

```bash
# Development
npm run dev           # Runs server (tsx watch) + web (vite) concurrently

# Production build
npm run build         # tsc (server) + vite build (web)
npm start             # node packages/server/dist/index.js

# Docker
docker compose up -d
```

---

## Consumer Sync Integration

key-manager acts as the central key registry. Consumer services (built on `@kevinsisi/ai-core`) sync keys via the `/api/keys/export` endpoint.

### Export Endpoint Response Format

`GET /api/keys/export` returns unmasked keys grouped by account:

```json
{
  "keys": [
    { "key_value": "AIza...", "account_name": "account1", "status": "active" },
    { "key_value": "AIza...", "account_name": "account2", "status": "cooldown" }
  ]
}
```

Default mode remains legacy/raw for backward compatibility, but `GET /api/keys/export?trusted_only=1` returns only keys from trusted `available` buckets.

### Consumer Sync Workflow

| Step | Direction | Operation |
|------|-----------|-----------|
| `syncFromManager` | key-manager → consumer | Pull from `GET /api/keys/export`, seed local `KeyPool` via `addApiKey()` |
| `testAllKeys` | consumer → Gemini API | Validate each key; update cooldown state locally |
| `reportToManager` | consumer → key-manager | (Optional) Push updated key statuses back via `PUT /:id` or custom endpoint |
| `getKeyStatus` | consumer reads pool | Use `KeyPool.status()` or `getKeyList()` for per-key state |

### Usage Pattern

- Call `syncFromManager` at service startup (or on a cron) to seed the local pool.
- After syncing, use `KeyPool` normally — key rotation and cooldown are handled by `@kevinsisi/ai-core`.
- The `quota-summary` endpoint (`GET /api/keys/quota-summary`) gives aggregate counts without exposing key values — use it for health checks or dashboards.

### Reference Implementation

`sheet-to-car` (`src/routes/keys.ts`) is the canonical reference for the full sync + test + report cycle.

---

## Constraints & Rules

1. **Do not upgrade existing package versions.** Pin all packages at their current versions.
2. **ESM only.** Both packages use `"type": "module"`. Avoid CommonJS patterns (`require`, `module.exports`).
3. **No ORM.** Use `better-sqlite3` directly with raw SQL. Keep queries in `routes/keys.ts` or `db/`.
4. **No auth layer.** This is a private, self-hosted tool on a trusted network. Do not add authentication middleware unless explicitly requested.
5. **Single binary / static serve.** The server serves the built web assets from `../../web/dist`. Do not split into separate deployment targets.
6. **Tailwind only for styling.** Do not introduce CSS-in-JS or additional styling libraries.
7. **Key masking is mandatory.** Never return full `key_value` in the `/` list endpoint. Only `/export` may return unmasked keys.
8. **SQLite WAL mode must remain enabled.** Required for concurrent read performance.
9. **Port 7823 is canonical.** Do not change the default port without updating docker-compose and documentation.
10. **Test API calls use a 10-second timeout.** Do not increase this; it impacts the SSE test-all UX.
