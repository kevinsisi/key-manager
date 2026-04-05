import Database from "better-sqlite3";
import path from "node:path";

const dbPath = process.env.DATABASE_PATH || path.resolve("data", "key-manager.db");
export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
