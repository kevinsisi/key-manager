export interface ApiKey {
  id: number;
  account_name: string;
  key_masked: string;
  key_suffix: string;
  status: "active" | "invalid" | "cooldown" | "unknown";
  last_tested_at: string | null;
  projects: string[];
  created_at: string;
}
