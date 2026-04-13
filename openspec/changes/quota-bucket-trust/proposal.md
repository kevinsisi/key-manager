## Why

目前 key-manager 只在 key 粒度顯示 `available / exhausted / rate_limited / invalid`，但 Gemini free-tier quota 常常是多把 key 共用同一個 Google project bucket。這造成：

1. UI / API 看起來很多 key `available`，實際上同一個 project quota 已經耗盡。
2. `/quota-summary` 與 `/export` 缺乏可信度資訊，消費者無法分辨哪些 key 是「原始可用」但「不可信」。
3. 現有資料仍可能混有舊狀態字串（如 `active` / `cooldown`），新版 summary 直接失真。

## What Changes

- 在 server 端建立 bucket-aware quota summary：以 `projects` tag 當作 quota bucket 線索，區分 `scoped / mixed / unscoped`。
- 正規化 legacy status (`active -> available`, `cooldown -> rate_limited`)。
- 擴充 `quota-summary` 與 `export`，加入 trusted/untrusted 視角與警告。
- Web UI 顯示 bucket warning 與 trusted key/bucket 數。
- Add/Edit/Batch import UI 明確把 `projects` 用途改成 quota bucket tags，而不是模糊的 app 使用列表。

## Impact

- Server: `packages/server/src/routes/keys.ts`, migrations, new quota helper
- Web: `packages/web/src/App.tsx`, modal/import components, shared types
- Consumer guidance: `ai-core` / docs should align to `trusted_only` export semantics
