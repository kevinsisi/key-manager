export interface ApiKey {
  id: number;
  account_name: string;
  key_masked: string;
  key_suffix: string;
  status: "available" | "exhausted" | "rate_limited" | "invalid" | "error" | "unknown";
  last_tested_at: string | null;
  projects: string[];
  created_at: string;
  rpd_limit: number | null;
  rpd_remaining: number | null;
  reset_at: string | null;
  status_reason: string;
  quota_scope: "project" | "key" | "unknown";
}

export interface QuotaBucket {
  bucket_id: string;
  label: string;
  trust: "scoped" | "mixed" | "unscoped";
  status: "available" | "exhausted" | "rate_limited" | "invalid" | "error" | "unknown" | "mixed";
  projects: string[];
  key_count: number;
  usable_key_count: number;
  status_breakdown: Record<string, number>;
  account_names: string[];
  key_suffixes: string[];
  warning: string | null;
}

export interface QuotaSummary {
  total: number;
  available: number;
  exhausted: number;
  rate_limited: number;
  invalid: number;
  error: number;
  unknown: number;
  neverTested: number;
  trusted_available_keys: number;
  trusted_available_buckets: number;
  unscoped_keys: number;
  mixed_buckets: number;
  warnings: string[];
  buckets: QuotaBucket[];
  keys: {
    id: number;
    account_name: string;
    key_suffix: string;
    status: string;
    reset_at: string | null;
    last_tested_at: string | null;
    bucket_id: string | null;
    bucket_label: string;
    bucket_status: string;
    bucket_trust: string;
    quota_scope: string;
    status_reason: string;
  }[];
}
