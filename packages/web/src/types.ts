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
}

export interface QuotaSummary {
  total: number;
  available: number;
  exhausted: number;
  rate_limited: number;
  invalid: number;
  unknown: number;
  neverTested: number;
  keys: {
    id: number;
    account_name: string;
    key_suffix: string;
    status: string;
    reset_at: string | null;
    last_tested_at: string | null;
  }[];
}
