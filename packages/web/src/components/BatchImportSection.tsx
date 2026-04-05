import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Upload } from "lucide-react";

const KNOWN_PROJECTS = [
  "mind-diary",
  "project-bridge",
  "ai-lunch-mind",
  "auto-spec-test",
  "docker-app-portal",
  "onshape-skill",
];

// Client-side parser mirrors the server-side parseBatchInput logic for live preview
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

    if (line.startsWith("export ")) line = line.slice(7).trim();

    const eqIdx = line.indexOf("=");
    if (eqIdx !== -1) {
      const lhs = line.slice(0, eqIdx).trim();
      if (/^\w+$/.test(lhs)) {
        line = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      }
    }

    if (line.includes(",")) {
      extracted.push(...line.split(",").map((p) => p.trim()).filter(Boolean));
    } else if (line) {
      extracted.push(line);
    }
  }

  if (extracted.length === 0 && text.includes(",")) {
    extracted.push(...text.split(",").map((p) => p.trim()).filter(Boolean));
  }

  return extracted;
}

interface ImportResult {
  imported: number;
  duplicates: number;
  invalid: number;
  errors: string[];
}

interface Props {
  onImported: () => void;
}

export function BatchImportSection({ onImported }: Props) {
  const [open, setOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [accountName, setAccountName] = useState("");
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const parsedKeys = useMemo(() => parseBatchInput(rawText), [rawText]);

  function toggleProject(p: string) {
    setSelectedProjects((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  async function handleImport() {
    if (parsedKeys.length === 0) return;
    setImporting(true);
    setResult(null);
    try {
      const res = await fetch("/api/keys/batch-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_text: rawText,
          account_name: accountName,
          projects: selectedProjects.join(","),
        }),
      });
      const data: ImportResult = await res.json();
      setResult(data);
      if (data.imported > 0) {
        onImported();
        setRawText("");
      }
    } catch {
      setResult({ imported: 0, duplicates: 0, invalid: 0, errors: ["Network error"] });
    } finally {
      setImporting(false);
    }
  }

  const keyCount = parsedKeys.length;

  return (
    <div className="mb-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Upload size={15} className="text-gray-400" />
          Batch Import
        </span>
        {open ? (
          <ChevronUp size={15} className="text-gray-400" />
        ) : (
          <ChevronDown size={15} className="text-gray-400" />
        )}
      </button>

      {open && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          {/* Textarea */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Paste Keys
            </label>
            <textarea
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                setResult(null);
              }}
              rows={6}
              placeholder={
                "One key per line:\nAIzaSy...\n\nkey=value format:\nGEMINI_API_KEY_1=AIzaSy...\n\nJSON array:\n[\"AIzaSy...\", \"AIzaSy...\"]"
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
            {rawText.trim() && (
              <p className="text-xs mt-1 text-gray-500">
                {keyCount === 0
                  ? "No keys detected"
                  : `Detected ${keyCount} key${keyCount > 1 ? "s" : ""}`}
              </p>
            )}
          </div>

          {/* Account + Projects */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account / Owner
              </label>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g. kevinc6131"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Projects
              </label>
              <div className="flex flex-wrap gap-1.5">
                {KNOWN_PROJECTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggleProject(p)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      selectedProjects.includes(p)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Result */}
          {result && (
            <div
              className={`rounded-lg px-4 py-3 text-sm border ${
                result.imported > 0
                  ? "bg-green-50 border-green-200"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <div className="flex items-center gap-2 mb-1 font-medium">
                {result.imported > 0 ? (
                  <>
                    <CheckCircle2 size={15} className="text-green-600" />
                    <span className="text-green-700">Import complete</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={15} className="text-gray-500" />
                    <span className="text-gray-700">Nothing imported</span>
                  </>
                )}
              </div>
              <ul className="text-xs text-gray-600 space-y-0.5">
                {result.imported > 0 && <li>✓ {result.imported} imported</li>}
                {result.duplicates > 0 && (
                  <li>
                    ↷ {result.duplicates} duplicate{result.duplicates > 1 ? "s" : ""} skipped
                  </li>
                )}
                {result.invalid > 0 && (
                  <li>✗ {result.invalid} invalid format</li>
                )}
              </ul>
              {result.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs text-gray-500 cursor-pointer">
                    Show errors ({result.errors.length})
                  </summary>
                  <ul className="mt-1 text-xs text-red-600 space-y-0.5">
                    {result.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          {/* Import button */}
          <div className="flex justify-end">
            <button
              onClick={handleImport}
              disabled={importing || keyCount === 0}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Upload size={14} />
              {importing
                ? "Importing…"
                : keyCount > 0
                ? `Import ${keyCount} Key${keyCount > 1 ? "s" : ""}`
                : "Import Keys"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
