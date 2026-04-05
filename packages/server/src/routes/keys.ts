import { Router } from "express";
import { db } from "../db/connection.js";

const router = Router();

// ── Types ─────────────────────────────────────────────────────────
interface ApiKey {
  id: number;
  key_value: string;
  account_name: string;
  status: string;
  last_tested_at: string | null;
  projects: string;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return "*".repeat(key.length - 8) + key.slice(-8);
}

function toPublic(row: ApiKey) {
  return {
    id: row.id,
    account_name: row.account_name,
    key_masked: maskKey(row.key_value),
    key_suffix: row.key_value.slice(-8),
    status: row.status,
    last_tested_at: row.last_tested_at,
    projects: row.projects
      ? row.projects.split(",").map((p) => p.trim()).filter(Boolean)
      : [],
    created_at: row.created_at,
  };
}

async function testKey(
  key: string
): Promise<"active" | "invalid" | "cooldown"> {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (res.ok) return "active";
    if (res.status === 429) return "cooldown";
    return "invalid";
  } catch {
    return "invalid";
  }
}

// ── GET /api/keys ─────────────────────────────────────────────────
router.get("/", (_req, res) => {
  const rows = db
    .prepare("SELECT * FROM api_keys ORDER BY created_at DESC")
    .all() as ApiKey[];
  res.json(rows.map(toPublic));
});

// ── POST /api/keys ────────────────────────────────────────────────
router.post("/", (req, res) => {
  const { key_value, account_name = "", projects = "" } = req.body ?? {};

  if (!key_value || typeof key_value !== "string") {
    res.status(400).json({ error: "key_value is required" });
    return;
  }
  if (!key_value.startsWith("AIza") || key_value.length < 20) {
    res.status(400).json({
      error: "Invalid key format — must start with AIza and be ≥20 chars",
    });
    return;
  }

  try {
    const result = db
      .prepare(
        `INSERT INTO api_keys (key_value, account_name, projects)
         VALUES (?, ?, ?)`
      )
      .run(key_value.trim(), account_name.trim(), projects.trim());

    const row = db
      .prepare("SELECT * FROM api_keys WHERE id = ?")
      .get(result.lastInsertRowid) as ApiKey;
    res.status(201).json(toPublic(row));
  } catch (err: any) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      res.status(409).json({ error: "Key already exists" });
    } else {
      res.status(500).json({ error: "Failed to add key" });
    }
  }
});

// ── PUT /api/keys/:id ─────────────────────────────────────────────
router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const { account_name, projects } = req.body ?? {};

  const row = db.prepare("SELECT * FROM api_keys WHERE id = ?").get(id) as
    | ApiKey
    | undefined;
  if (!row) {
    res.status(404).json({ error: "Key not found" });
    return;
  }

  db.prepare(
    `UPDATE api_keys SET account_name = ?, projects = ? WHERE id = ?`
  ).run(
    account_name !== undefined ? String(account_name).trim() : row.account_name,
    projects !== undefined ? String(projects).trim() : row.projects,
    id
  );

  const updated = db
    .prepare("SELECT * FROM api_keys WHERE id = ?")
    .get(id) as ApiKey;
  res.json(toPublic(updated));
});

// ── DELETE /api/keys/:id ──────────────────────────────────────────
router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const result = db.prepare("DELETE FROM api_keys WHERE id = ?").run(id);
  if (result.changes === 0) {
    res.status(404).json({ error: "Key not found" });
    return;
  }
  res.json({ ok: true });
});

// ── POST /api/keys/:id/test ───────────────────────────────────────
router.post("/:id/test", async (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM api_keys WHERE id = ?").get(id) as
    | ApiKey
    | undefined;
  if (!row) {
    res.status(404).json({ error: "Key not found" });
    return;
  }

  const status = await testKey(row.key_value);
  db.prepare(
    `UPDATE api_keys SET status = ?, last_tested_at = datetime('now') WHERE id = ?`
  ).run(status, id);

  const updated = db
    .prepare("SELECT * FROM api_keys WHERE id = ?")
    .get(id) as ApiKey;
  res.json(toPublic(updated));
});

// ── POST /api/keys/test-all ───────────────────────────────────────
// Server-Sent Events stream — each event is a JSON line with the updated key
router.post("/test-all", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const rows = db
    .prepare("SELECT * FROM api_keys ORDER BY id")
    .all() as ApiKey[];

  for (const row of rows) {
    const status = await testKey(row.key_value);
    db.prepare(
      `UPDATE api_keys SET status = ?, last_tested_at = datetime('now') WHERE id = ?`
    ).run(status, row.id);

    const updated = db
      .prepare("SELECT * FROM api_keys WHERE id = ?")
      .get(row.id) as ApiKey;
    res.write(`data: ${JSON.stringify(toPublic(updated))}\n\n`);
  }

  res.write("data: {\"done\":true}\n\n");
  res.end();
});

export default router;
