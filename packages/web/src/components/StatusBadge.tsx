type Status = "available" | "exhausted" | "rate_limited" | "invalid" | "error" | "unknown";

const styles: Record<Status, string> = {
  available:    "bg-green-100 text-green-800 border border-green-200",
  exhausted:    "bg-red-100 text-red-800 border border-red-200",
  rate_limited: "bg-yellow-100 text-yellow-800 border border-yellow-200",
  invalid:      "bg-gray-100 text-gray-500 border border-gray-200",
  error:        "bg-orange-100 text-orange-700 border border-orange-200",
  unknown:      "bg-gray-100 text-gray-400 border border-gray-200",
};

const labels: Record<Status, string> = {
  available:    "Available",
  exhausted:    "Exhausted",
  rate_limited: "Rate Limited",
  invalid:      "Invalid",
  error:        "Error",
  unknown:      "Untested",
};

export function StatusBadge({ status }: { status: string }) {
  const s = (status as Status) in styles ? (status as Status) : "unknown";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[s]}`}>
      {labels[s]}
    </span>
  );
}
