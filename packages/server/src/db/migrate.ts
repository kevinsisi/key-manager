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
  ];
  for (const sql of addCols) {
    try { db.exec(sql); } catch { /* column already exists */ }
  }

  console.log("[migrate] done");
}
