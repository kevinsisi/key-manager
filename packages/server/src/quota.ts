export type NormalizedStatus = "available" | "exhausted" | "rate_limited" | "invalid" | "error" | "unknown";
export type BucketTrust = "scoped" | "mixed" | "unscoped";
export type BucketStatus = NormalizedStatus | "mixed";

export interface KeyRecordLike {
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
  status_reason?: string | null;
  quota_scope?: string | null;
}

export interface BucketSummary {
  bucket_id: string;
  label: string;
  trust: BucketTrust;
  status: BucketStatus;
  projects: string[];
  key_count: number;
  usable_key_count: number;
  status_breakdown: Record<NormalizedStatus, number>;
  account_names: string[];
  key_suffixes: string[];
  warning: string | null;
}

export interface KeyAssessment {
  row: KeyRecordLike;
  normalized_status: NormalizedStatus;
  projects: string[];
  bucket_id: string | null;
  bucket_label: string;
  bucket_trust: BucketTrust;
  bucket_status: BucketStatus;
  bucket_warning: string | null;
}

export interface QuotaSummaryResult {
  assessments: KeyAssessment[];
  buckets: BucketSummary[];
  warnings: string[];
  rawCounts: Record<NormalizedStatus, number>;
  trustedAvailableKeys: number;
  trustedAvailableBuckets: number;
  unscopedKeys: number;
  mixedBuckets: number;
  neverTested: number;
}

const NORMALIZED_STATUSES: NormalizedStatus[] = ["available", "exhausted", "rate_limited", "invalid", "error", "unknown"];

export function normalizeStatus(status: string): NormalizedStatus {
  const value = String(status || "").trim().toLowerCase();
  if (value === "active") return "available";
  if (value === "cooldown") return "rate_limited";
  if (NORMALIZED_STATUSES.includes(value as NormalizedStatus)) return value as NormalizedStatus;
  return "unknown";
}

export function parseProjects(text: string): string[] {
  return String(text || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function createEmptyBreakdown(): Record<NormalizedStatus, number> {
  return {
    available: 0,
    exhausted: 0,
    rate_limited: 0,
    invalid: 0,
    error: 0,
    unknown: 0,
  };
}

function buildBucketId(projects: string[]): string | null {
  if (projects.length === 0) return null;
  return projects[0].trim().toLowerCase();
}

function decideBucketStatus(entries: Array<{ normalized_status: NormalizedStatus }>): { trust: BucketTrust; status: BucketStatus; warning: string | null } {
  const quotaStatuses = new Set(
    entries
      .map((entry) => entry.normalized_status)
      .filter((status) => status === "available" || status === "exhausted" || status === "rate_limited")
  );

  if (quotaStatuses.size > 1) {
    return {
      trust: "mixed",
      status: "mixed",
      warning: "Keys in the same quota bucket reported conflicting quota states.",
    };
  }

  if (quotaStatuses.has("available")) return { trust: "scoped", status: "available", warning: null };
  if (quotaStatuses.has("rate_limited")) return { trust: "scoped", status: "rate_limited", warning: null };
  if (quotaStatuses.has("exhausted")) return { trust: "scoped", status: "exhausted", warning: null };
  if (entries.some((entry) => entry.normalized_status === "invalid")) return { trust: "scoped", status: "invalid", warning: null };
  if (entries.some((entry) => entry.normalized_status === "error")) return { trust: "scoped", status: "error", warning: null };
  return { trust: "scoped", status: "unknown", warning: null };
}

export function summarizeQuota(rows: KeyRecordLike[]): QuotaSummaryResult {
  const rawCounts = createEmptyBreakdown();
  const neverTested = rows.filter((row) => row.last_tested_at === null).length;
  const bucketGroups = new Map<string, KeyAssessment[]>();
  const assessments: KeyAssessment[] = rows.map((row) => {
    const normalized_status = normalizeStatus(row.status);
    rawCounts[normalized_status] += 1;
    const projects = parseProjects(row.projects);
    const bucket_id = buildBucketId(projects);
    const assessment: KeyAssessment = {
      row,
      normalized_status,
      projects,
      bucket_id,
      bucket_label: projects.length > 0 ? projects.join(", ") : "Unscoped",
      bucket_trust: bucket_id ? "scoped" : "unscoped",
      bucket_status: bucket_id ? normalized_status : "unknown",
      bucket_warning: bucket_id ? null : "No quota bucket tag assigned; project-level quota trust is unknown.",
    };
    if (bucket_id) {
      const group = bucketGroups.get(bucket_id);
      if (group) group.push(assessment);
      else bucketGroups.set(bucket_id, [assessment]);
    }
    return assessment;
  });

  const buckets: BucketSummary[] = [];
  for (const [bucket_id, entries] of bucketGroups.entries()) {
    const breakdown = createEmptyBreakdown();
    const projects = [...new Set(entries.flatMap((entry) => entry.projects))];
    const account_names = [...new Set(entries.map((entry) => entry.row.account_name.trim()).filter(Boolean))];
    const key_suffixes = entries.map((entry) => entry.row.key_value.slice(-8));
    entries.forEach((entry) => {
      breakdown[entry.normalized_status] += 1;
    });
    const decision = decideBucketStatus(entries);
    entries.forEach((entry) => {
      entry.bucket_trust = decision.trust;
      entry.bucket_status = decision.status;
      entry.bucket_warning = decision.warning;
    });
    buckets.push({
      bucket_id,
      label: projects.join(", "),
      trust: decision.trust,
      status: decision.status,
      projects,
      key_count: entries.length,
      usable_key_count: entries.filter((entry) => entry.normalized_status === "available").length,
      status_breakdown: breakdown,
      account_names,
      key_suffixes,
      warning: decision.warning,
    });
  }

  buckets.sort((left, right) => left.label.localeCompare(right.label, "en"));

  const warnings: string[] = [];
  const unscopedKeys = assessments.filter((entry) => entry.bucket_trust === "unscoped").length;
  const mixedBuckets = buckets.filter((bucket) => bucket.trust === "mixed").length;

  if (unscopedKeys > 0) {
    warnings.push(`${unscopedKeys} key(s) have no quota bucket tag. Their project-level quota cannot be trusted.`);
  }
  if (mixedBuckets > 0) {
    warnings.push(`${mixedBuckets} quota bucket(s) reported conflicting key states. Re-test or fix bucket tagging before trusting them.`);
  }

  return {
    assessments,
    buckets,
    warnings,
    rawCounts,
    trustedAvailableKeys: assessments.filter(
      (entry) => entry.bucket_trust === "scoped" && entry.bucket_status === "available" && entry.normalized_status === "available"
    ).length,
    trustedAvailableBuckets: buckets.filter((bucket) => bucket.trust === "scoped" && bucket.status === "available").length,
    unscopedKeys,
    mixedBuckets,
    neverTested,
  };
}
