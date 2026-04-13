import type { Database } from "better-sqlite3";

export function runMigrations(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      key_value   TEXT    NOT NULL UNIQUE,
      account_name TEXT   NOT NULL DEFAULT '',
      status      TEXT    NOT NULL DEFAULT 'unknown',
      last_tested_at TEXT,
      projects    TEXT    NOT NULL DEFAULT '',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Additive migrations — safe to run on existing DBs
  const addCols = [
    "ALTER TABLE api_keys ADD COLUMN rpd_limit INTEGER",
    "ALTER TABLE api_keys ADD COLUMN rpd_remaining INTEGER",
    "ALTER TABLE api_keys ADD COLUMN reset_at TEXT",
    "ALTER TABLE api_keys ADD COLUMN status_reason TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE api_keys ADD COLUMN quota_scope TEXT NOT NULL DEFAULT ''",
  ];
  for (const sql of addCols) {
    try { db.exec(sql); } catch { /* column already exists */ }
  }

  db.exec("UPDATE api_keys SET status = 'available' WHERE status = 'active'");
  db.exec("UPDATE api_keys SET status = 'rate_limited' WHERE status = 'cooldown'");

  console.log("[migrate] done");
}
