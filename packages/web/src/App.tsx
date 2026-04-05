import { useCallback, useEffect, useState } from "react";
import { Key, Plus, RefreshCw, Zap, Edit2, Trash2, TestTube, ClipboardCopy, Check } from "lucide-react";
import { StatusBadge } from "./components/StatusBadge.tsx";
import { AddKeyModal } from "./components/AddKeyModal.tsx";
import { EditKeyModal } from "./components/EditKeyModal.tsx";
import { BatchImportSection } from "./components/BatchImportSection.tsx";
import type { ApiKey } from "./types.ts";

// ── API helpers ────────────────────────────────────────────────────
async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json as T;
}

// ── Stats bar ──────────────────────────────────────────────────────
function Stats({ keys }: { keys: ApiKey[] }) {
  const counts = keys.reduce(
    (acc, k) => {
      acc[k.status] = (acc[k.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      {[
        { label: "Total", value: keys.length, color: "text-gray-900" },
        { label: "Active", value: counts.active ?? 0, color: "text-green-600" },
        { label: "Invalid", value: counts.invalid ?? 0, color: "text-red-600" },
        { label: "Cooldown", value: counts.cooldown ?? 0, color: "text-yellow-600" },
      ].map(({ label, value, color }) => (
        <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────
export default function App() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editKey, setEditKey] = useState<ApiKey | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<ApiKey[]>("/api/keys");
      setKeys(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(data: { key_value: string; account_name: string; projects: string }) {
    const created = await apiFetch<ApiKey>("/api/keys", {
      method: "POST",
      body: JSON.stringify(data),
    });
    setKeys((prev) => [created, ...prev]);
  }

  async function handleSave(id: number, data: { account_name: string; projects: string }) {
    const updated = await apiFetch<ApiKey>(`/api/keys/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    setKeys((prev) => prev.map((k) => (k.id === id ? updated : k)));
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this key?")) return;
    await apiFetch(`/api/keys/${id}`, { method: "DELETE" });
    setKeys((prev) => prev.filter((k) => k.id !== id));
  }

  async function handleTestOne(id: number) {
    setTestingId(id);
    try {
      const updated = await apiFetch<ApiKey>(`/api/keys/${id}/test`, { method: "POST" });
      setKeys((prev) => prev.map((k) => (k.id === id ? updated : k)));
    } finally {
      setTestingId(null);
    }
  }

  async function handleTestAll() {
    setTesting(true);
    setProgress("Starting…");
    try {
      const res = await fetch("/api/keys/test-all", { method: "POST" });
      if (!res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          const json = JSON.parse(payload);
          if (json.done) {
            setProgress(null);
          } else {
            setProgress(`Tested: …${json.key_suffix} → ${json.status}`);
            setKeys((prev) => prev.map((k) => (k.id === json.id ? json : k)));
          }
        }
      }
    } finally {
      setTesting(false);
      setProgress(null);
    }
  }

  async function handleCopyKeys() {
    const data = await apiFetch<{ total: number; groups: Record<string, string[]> }>("/api/keys/export");
    const { total, groups } = data;

    const lines: string[] = [];
    lines.push(`# ===== 可用 Key Pool（${total} keys，去重後）=====`);

    for (const [owner, ownerKeys] of Object.entries(groups)) {
      lines.push("");
      lines.push(`# -${owner} (${ownerKeys.length})`);
      for (const k of ownerKeys) lines.push(k);
    }

    lines.push("");
    lines.push(`# ===== .env 一鍵貼上（去重 ${total} keys）=====`);
    const allKeys = Object.values(groups).flat();
    lines.push(`# GEMINI_API_KEYS=${allKeys.join(",")}`);

    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    const d = new Date(iso + (iso.endsWith("Z") ? "" : "Z"));
    return d.toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <Key size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900 leading-tight">Key Manager</h1>
          <p className="text-xs text-gray-500">Gemini API key pool dashboard</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats */}
        <Stats keys={keys} />

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Add Key
          </button>
          <button
            onClick={handleTestAll}
            disabled={testing || keys.length === 0}
            className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <Zap size={16} className={testing ? "animate-pulse" : ""} />
            {testing ? "Testing…" : "Test All Keys"}
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={handleCopyKeys}
            disabled={keys.filter((k) => k.status === "active" || k.status === "cooldown").length === 0}
            className="inline-flex items-center gap-2 border border-purple-300 text-purple-700 bg-purple-50 px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors disabled:opacity-50"
            title="複製全部可用金鑰（按擁有者分組 + .env 格式）"
          >
            {copied ? <Check size={16} className="text-green-600" /> : <ClipboardCopy size={16} />}
            {copied ? "已複製！" : "複製可用金鑰"}
          </button>
          {progress && (
            <span className="text-sm text-gray-500 italic">{progress}</span>
          )}
        </div>

        {/* Batch Import */}
        <BatchImportSection onImported={load} />

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
          ) : keys.length === 0 ? (
            <div className="text-center py-16">
              <Key size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">No keys yet. Add one to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-left">
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Account</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Key</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Last Tested</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Projects</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {keys.map((k) => (
                    <tr key={k.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {k.account_name || <span className="text-gray-400 italic">—</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-500 text-xs">
                        {k.key_masked}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={k.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {formatDate(k.last_tested_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {k.projects.length > 0 ? (
                            k.projects.map((p) => (
                              <span
                                key={p}
                                className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs"
                              >
                                {p}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400 text-xs italic">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleTestOne(k.id)}
                            disabled={testingId === k.id}
                            title="Test this key"
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                          >
                            <TestTube size={15} className={testingId === k.id ? "animate-pulse" : ""} />
                          </button>
                          <button
                            onClick={() => setEditKey(k)}
                            title="Edit"
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(k.id)}
                            title="Delete"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {showAdd && (
        <AddKeyModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />
      )}
      {editKey && (
        <EditKeyModal
          keyItem={editKey}
          onClose={() => setEditKey(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
