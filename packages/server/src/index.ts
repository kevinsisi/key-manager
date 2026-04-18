import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { db } from "./db/connection.js";
import { runMigrations } from "./db/migrate.js";
import keysRouter from "./routes/keys.js";

// ── Migrations ─────────────────────────────────────────────────────
runMigrations(db);

// ── Ensure data dir ────────────────────────────────────────────────
const dataBase = process.env.DATABASE_PATH
  ? path.dirname(process.env.DATABASE_PATH)
  : "./data";
fs.mkdirSync(path.resolve(dataBase), { recursive: true });

// ── Express ────────────────────────────────────────────────────────
const app = express();
const PORT = Number(process.env.PORT) || 7823;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// ── API routes ─────────────────────────────────────────────────────
app.use("/api/keys", keysRouter);

// ── Serve built web UI ─────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(__dirname, "../../web/dist");

if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(webDist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`[key-manager] listening on :${PORT}`);
});
