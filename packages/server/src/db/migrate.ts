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
  console.log("[migrate] done");
}
