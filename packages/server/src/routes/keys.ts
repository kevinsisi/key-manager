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
  rpd_limit: number | null;
  rpd_remaining: number | null;
  reset_at: string | null;
}

interface TestResult {
  status: "available" | "exhausted" | "rate_limited" | "invalid" | "error";
  resetAt: string | null;
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
    rpd_limit: row.rpd_limit ?? null,
    rpd_remaining: row.rpd_remaining ?? null,
    reset_at: row.reset_at ?? null,
  };
}

// Returns ISO string of next midnight in US/Pacific time, expressed in UTC
function nextPacificMidnightISO(): string {
  const now = new Date();
  // Get current date components in Pacific time
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const p = Object.fromEntries(parts.filter(x => x.type !== "literal").map(x => [x.type, Number(x.value)]));
  // Treat Pacific time components as fake UTC to compute offset
  const pacificAsUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const offsetMs = now.getTime() - pacificAsUTC; // e.g. +7h for PDT
  // Next Pacific midnight in UTC = next Pacific day 00:00:00 + offset
  const nextMidnightUTC = Date.UTC(p.year, p.month - 1, p.day + 1, 0, 0, 0) + offsetMs;
  return new Date(nextMidnightUTC).toISOString();
}

async function testKey(key: string): Promise<TestResult> {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "hi" }] }],
        generationConfig: { maxOutputTokens: 1 },
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) return { status: "available", resetAt: null };

    if (res.status === 429) {
      let body: unknown = {};
      try { body = await res.json(); } catch { /* ignore */ }
      const msg = JSON.stringify(body).toLowerCase();
      if (msg.includes("daily") || msg.includes("resource_exhausted")) {
        return { status: "exhausted", resetAt: nextPacificMidnightISO() };
      }
      if (msg.includes("rate")) {
        return { status: "rate_limited", resetAt: new Date(Date.now() + 60_000).toISOString() };
      }
      return { status: "exhausted", resetAt: nextPacificMidnightISO() };
    }

    if (res.status === 401 || res.status === 403) {
      return { status: "invalid", resetAt: null };
    }

    return { status: "error", resetAt: null };
  } catch {
    return { status: "error", resetAt: null };
  }
}

function applyTestResult(id: number, result: TestResult): void {
  db.prepare(
    `UPDATE api_keys
     SET status = ?, last_tested_at = datetime('now'),
         rpd_limit = NULL, rpd_remaining = NULL, reset_at = ?
     WHERE id = ?`
  ).run(result.status, result.resetAt, id);
}

// ── GET /api/keys ─────────────────────────────────────────────────
router.get("/", (_req, res) => {
  const rows = db
    .prepare("SELECT * FROM api_keys ORDER BY created_at DESC")
    .all() as ApiKey[];
  res.json(rows.map(toPublic));
});

// ── GET /api/keys/quota-summary ───────────────────────────────────
router.get("/quota-summary", (_req, res) => {
  const rows = db
    .prepare("SELECT * FROM api_keys ORDER BY created_at DESC")
    .all() as ApiKey[];

  const available = rows.filter((r) => r.status === "available").length;
  const exhausted = rows.filter((r) => r.status === "exhausted").length;
  const rateLimited = rows.filter((r) => r.status === "rate_limited").length;
  const invalid = rows.filter((r) => r.status === "invalid").length;
  const unknown = rows.filter((r) => r.status === "unknown").length;
  const neverTested = rows.filter((r) => r.last_tested_at === null).length;

  res.json({
    total: rows.length,
    available,
    exhausted,
    rate_limited: rateLimited,
    invalid,
    unknown,
    neverTested,
    keys: rows.map((r) => ({
      id: r.id,
      account_name: r.account_name,
      key_suffix: r.key_value.slice(-8),
      status: r.status,
      reset_at: r.reset_at ?? null,
      last_tested_at: r.last_tested_at,
    })),
  });
});

// ── GET /api/keys/export ──────────────────────────────────────────
// Returns full key values for active/cooldown keys, grouped by account (deduped)
router.get("/export", (_req, res) => {
  const rows = db
    .prepare(
      "SELECT * FROM api_keys WHERE status = 'available' ORDER BY account_name, created_at"
    )
    .all() as ApiKey[];

  const grouped = new Map<string, string[]>();
  const seenKeys = new Set<string>();

  for (const row of rows) {
    if (seenKeys.has(row.key_value)) continue;
    seenKeys.add(row.key_value);
    const owner = row.account_name.trim() || "無擁有者";
    if (!grouped.has(owner)) grouped.set(owner, []);
    grouped.get(owner)!.push(row.key_value);
  }

  res.json({
    total: seenKeys.size,
    groups: Object.fromEntries(grouped),
  });
});

// ── Helpers: batch input parser ────────────────────────────────────
function parseBatchInput(raw: string): string[] {
  const text = raw.trim();
  if (!text) return [];

  // JSON array
  if (text.startsWith("[")) {
    try {
      const arr = JSON.parse(text);
      if (Array.isArray(arr))
        return arr
          .filter((x) => typeof x === "string")
          .map((x) => (x as string).trim())
          .filter(Boolean);
    } catch {}
  }

  const lines = text.split(/\r?\n/);
  const extracted: string[] = [];

  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    // strip export prefix (.env style)
    if (line.startsWith("export ")) line = line.slice(7).trim();

    // key=value: take value after first =
    const eqIdx = line.indexOf("=");
    if (eqIdx !== -1) {
      const lhs = line.slice(0, eqIdx).trim();
      if (/^\w+$/.test(lhs)) {
        line = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      }
    }

    // comma-separated within a line
    if (line.includes(",")) {
      extracted.push(...line.split(",").map((p) => p.trim()).filter(Boolean));
    } else if (line) {
      extracted.push(line);
    }
  }

  // fallback: entire input is comma-separated (no newlines)
  if (extracted.length === 0 && text.includes(",")) {
    extracted.push(...text.split(",").map((p) => p.trim()).filter(Boolean));
  }

  return extracted;
}

// ── POST /api/keys/batch-import ────────────────────────────────────
router.post("/batch-import", (req, res) => {
  const { raw_text, account_name = "", projects = "" } = req.body ?? {};

  if (!raw_text || typeof raw_text !== "string") {
    res.status(400).json({ error: "raw_text is required" });
    return;
  }

  const candidates = parseBatchInput(raw_text);
  if (candidates.length === 0) {
    res.json({ imported: 0, duplicates: 0, invalid: 0, errors: [] });
    return;
  }

  const stmt = db.prepare(
    "INSERT INTO api_keys (key_value, account_name, projects) VALUES (?, ?, ?)"
  );

  let imported = 0;
  let duplicates = 0;
  let invalid = 0;
  const errors: string[] = [];

  for (const key of candidates) {
    const trimmed = key.trim();
    if (!trimmed.startsWith("AIza") || trimmed.length < 20) {
      invalid++;
      errors.push(`Invalid format: …${trimmed.slice(-8) || trimmed}`);
      continue;
    }
    try {
      stmt.run(trimmed, String(account_name).trim(), String(projects).trim());
      imported++;
    } catch (err: any) {
      if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
        duplicates++;
      } else {
        invalid++;
        errors.push(`Failed to insert: …${trimmed.slice(-8)}`);
      }
    }
  }

  res.json({ imported, duplicates, invalid, errors });
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

  const result = await testKey(row.key_value);
  applyTestResult(id, result);

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
    const result = await testKey(row.key_value);
    applyTestResult(row.id, result);

    const updated = db
      .prepare("SELECT * FROM api_keys WHERE id = ?")
      .get(row.id) as ApiKey;
    res.write(`data: ${JSON.stringify(toPublic(updated))}\n\n`);
  }

  res.write("data: {\"done\":true}\n\n");
  res.end();
});

export default router;
