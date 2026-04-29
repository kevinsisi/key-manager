# key-manager

自架的 Gemini API Key 池管理工具 — 集中儲存、驗證、分組、匯出多把 Gemini API key，給 HomeProject 各 AI 服務（mind-diary、project-bridge、auto-spec-test、sheet-to-car、ai-lunch-mind…）共用。

## 一句話描述

把散落在各專案 `.env` 裡的 Gemini key 統一收進一個 SQLite 池，提供 web UI 批次匯入、即時測試（SSE）、`.env` 格式匯出，與 trusted bucket 配額摘要 API。

## 部署位置

- **公開網址**：`key.sisihome.org:7823`（家用內網 + Tailscale）
- **Image**：`kevin950805/key-manager:latest`

## 技術棧

- **後端**：Node.js 20 (Alpine) + Express 4 + TypeScript（ESM）
- **DB**：SQLite（better-sqlite3 + WAL mode）
- **前端**：React 19 + Vite 6 + Tailwind CSS 3.4 + lucide-react
- **Monorepo**：npm workspaces（`packages/server` + `packages/web`）
- **打包**：multi-stage Dockerfile（build → runtime）

## 主要功能

| 功能 | 說明 |
|---|---|
| 單把新增 | 驗證 `AIza` 前綴 + 最少 20 字元 |
| 批次匯入 | 支援 JSON array、`key=value` 行格式、export prefix、CSV |
| 即時測試 | `POST /test-all` 用 SSE 流式回報每把 key 的測試結果 |
| 四態狀態 | `available` / `exhausted` / `rate_limited` / `invalid` — 根據 Google API 200/429/4xx 區分 |
| 帳號 / 專案分組 | 每把 key 綁定 `account_name` 與 `projects` 標籤（第一個 tag 視為配額 bucket） |
| 匯出 | `.env` 格式（依帳號分組，遮罩 / 完整兩種模式） |
| Quota Summary | `/api/keys/quota-summary` 提供 trusted bucket-aware 配額計算 |

## 資料表 schema

```sql
api_keys (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  key_value       TEXT NOT NULL UNIQUE,
  account_name    TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'unknown',  -- active|invalid|cooldown|unknown
  last_tested_at  TEXT,
  projects        TEXT NOT NULL DEFAULT '',          -- 逗號分隔
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
)
```

## API（base：`/api/keys`）

| Method | Path | 說明 |
|---|---|---|
| GET | `/` | 列出所有 key（遮罩最後 8 碼） |
| GET | `/export?trusted_only=1` | 匯出可用 key（unmask） |
| POST | `/` | 新增單把 |
| POST | `/batch-import` | 批次匯入 |
| PUT | `/:id` | 更新 `account_name` / `projects` |
| DELETE | `/:id` | 刪除 |
| POST | `/:id/test` | 測試單把（10s timeout，呼叫 Gemini gemini-2.0-flash） |
| POST | `/test-all` | SSE 流式測試全部 |
| GET | `/quota-summary` | 配額摘要（raw + trusted bucket） |

## 部署

```bash
docker compose up -d
# 對外 port 7823 → /api + 靜態 SPA
```

### 環境變數

| 變數 | 預設 | 說明 |
|---|---|---|
| `PORT` | `7823` | Express listen port |
| `DATABASE_PATH` | `./data/key-manager.db` | SQLite 路徑 |
| `TZ` | `Asia/Taipei` | 時區 |

Volume：`key-manager-data:/app/data`（SQLite 資料持久化）。

## 開發

```bash
npm install
npm run dev    # concurrently: server (7823) + web (Vite)
```

## URL

- Repo：<https://github.com/kevinsisi/key-manager>
- Image：`kevin950805/key-manager:latest`
- 內部網址：`http://key.sisihome.org:7823`
