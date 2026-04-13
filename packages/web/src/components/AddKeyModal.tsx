import { useState } from "react";
import { X } from "lucide-react";

const KNOWN_PROJECTS = [
  "mind-diary",
  "project-bridge",
  "sheet-to-car",
  "ai-lunch-mind",
  "auto-spec-test",
  "docker-app-portal",
  "onshape-skill",
];

function parseTags(text: string): string[] {
  return text.split(",").map((part) => part.trim()).filter(Boolean);
}

interface Props {
  onClose: () => void;
  onAdd: (key: { key_value: string; account_name: string; projects: string }) => Promise<void>;
}

export function AddKeyModal({ onClose, onAdd }: Props) {
  const [keyValue, setKeyValue] = useState("");
  const [accountName, setAccountName] = useState("");
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [projectText, setProjectText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleProject(p: string) {
    setSelectedProjects((prev) => {
      const next = prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p];
      setProjectText(next.join(", "));
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!keyValue.trim()) {
      setError("API key is required");
      return;
    }
    setLoading(true);
    try {
      await onAdd({
        key_value: keyValue.trim(),
        account_name: accountName.trim(),
        projects: parseTags(projectText).join(","),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to add key");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Add API Key</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Key <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              placeholder="AIza..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account / Owner
            </label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g. kevinc6131, housefun.dev.02"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quota Bucket Tags
            </label>
            <input
              type="text"
              value={projectText}
              onChange={(e) => {
                setProjectText(e.target.value);
                setSelectedProjects(parseTags(e.target.value));
              }}
              placeholder="e.g. molten-mariner-491403-r3, sheet-to-car"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
            />
            <p className="text-xs text-gray-500 mb-2">第一個 tag 會當作 quota bucket ID；共用同一個 Google project 的 keys 第一個 tag 必須一致。</p>
            <div className="flex flex-wrap gap-2">
              {KNOWN_PROJECTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggleProject(p)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
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

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Adding…" : "Add Key"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
