import { useState } from "react";
import { X } from "lucide-react";
import type { ApiKey } from "../types.ts";

const KNOWN_PROJECTS = [
  "mind-diary",
  "project-bridge",
  "ai-lunch-mind",
  "auto-spec-test",
  "docker-app-portal",
  "onshape-skill",
];

interface Props {
  keyItem: ApiKey;
  onClose: () => void;
  onSave: (id: number, data: { account_name: string; projects: string }) => Promise<void>;
}

export function EditKeyModal({ keyItem, onClose, onSave }: Props) {
  const [accountName, setAccountName] = useState(keyItem.account_name);
  const [selectedProjects, setSelectedProjects] = useState<string[]>(keyItem.projects);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleProject(p: string) {
    setSelectedProjects((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onSave(keyItem.id, {
        account_name: accountName.trim(),
        projects: selectedProjects.join(","),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Edit Key</h2>
            <p className="text-xs text-gray-500 font-mono mt-0.5">…{keyItem.key_suffix}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
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
              Used In Projects
            </label>
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
              {loading ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
