export type ConfigApi = {
  getHealth(): Promise<{ ok: true; service: string; version: string; timestamp: string }>;
  getConfig(): Promise<D2Config>;
  saveConfig(config: D2Config): Promise<D2Config>;
  openDataDir(): Promise<void>;
  exportConfig(): Promise<ConfigBackupResult>;
  importConfig(): Promise<ConfigBackupResult>;
  getCacheStatus(): Promise<CacheStatus>;
  clearCache(domains?: readonly CacheDomain[]): Promise<ConfigBackupResult>;
  listAiModels(ai: AiSettings): Promise<AiModelListResult>;
  testAiConnection(): Promise<AiConnectionTestResult>;
};

export type ConfigBackupResult = {
  ok: true;
  message: string;
  path?: string;
  cache?: CacheStatus;
};

export type CacheDomain =
  | "account-snapshot"
  | "account-item-details"
  | "home-briefing"
  | "vendor-inventory"
  | "manifest-version-check";

export type CacheStatus = {
  data_dir: string;
  generated_at: string;
  domains: Array<{
    domain: CacheDomain;
    path: string;
    exists: boolean;
    bytes: number;
    updated_at?: string;
  }>;
  account_cache_metrics?: {
    generated_at: string;
    snapshot: CacheMetricCounts;
    item_detail: CacheMetricCounts;
    total: CacheMetricCounts;
  };
};

export type CacheMetricCounts = {
  hit: number;
  miss: number;
  stale: number;
  refresh: number;
  error: number;
};

export type D2Config = {
  bungie: {
    api_key: string;
    client_id: string;
    client_secret: string;
    redirect_uri: string;
  };
  data: {
    data_dir: string;
    manifest_language: string;
  };
  ai: {
    protocol: string;
    api_key: string;
    model: string;
    base_url: string;
  };
  features: {
    color_mode: "light" | "dark";
    density: "compact" | "standard" | "comfortable";
    interface_locale: "zh-CN" | "en-US";
    manifest_language_follows_interface: boolean;
  };
};

export type AiSettings = D2Config["ai"];

export type AiModelListResult = {
  protocol: string;
  models: string[];
  source: "remote" | "fallback";
  message: string;
};

export type AiConnectionTestResult = {
  ok: true;
  protocol: string;
  model: string;
  message: string;
};
