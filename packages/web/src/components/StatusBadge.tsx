type Status = "active" | "invalid" | "cooldown" | "unknown";

const styles: Record<Status, string> = {
  active: "bg-green-100 text-green-800 border border-green-200",
  invalid: "bg-red-100 text-red-800 border border-red-200",
  cooldown: "bg-yellow-100 text-yellow-800 border border-yellow-200",
  unknown: "bg-gray-100 text-gray-600 border border-gray-200",
};

const labels: Record<Status, string> = {
  active: "Active",
  invalid: "Invalid",
  cooldown: "Cooldown",
  unknown: "Untested",
};

export function StatusBadge({ status }: { status: string }) {
  const s = (status as Status) in styles ? (status as Status) : "unknown";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[s]}`}>
      {labels[s]}
    </span>
  );
}
