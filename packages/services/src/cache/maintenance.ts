import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { clearCachedAccountItemDetails } from "../account/itemDetailStore.js";
import { getAccountCacheMetrics, type AccountCacheMetrics } from "../account/cacheMetrics.js";

/** Volatile cache domains that can be inspected and cleared independently. */
export type CacheDomain =
  | "account-snapshot"
  | "account-pursuits"
  | "account-item-details"
  | "home-briefing"
  | "vendor-inventory"
  | "manifest-version-check";

export type CacheDomainStatus = {
  domain: CacheDomain;
  path: string;
  exists: boolean;
  bytes: number;
  updated_at?: string;
};

export type CacheStatus = {
  data_dir: string;
  generated_at: string;
  domains: CacheDomainStatus[];
  account_cache_metrics?: AccountCacheMetrics;
};

export type CacheClearResult = {
  cleared: CacheDomain[];
  removed_bytes: number;
  status: CacheStatus;
};

const allDomains: readonly CacheDomain[] = [
  "account-snapshot",
  "account-pursuits",
  "account-item-details",
  "home-briefing",
  "vendor-inventory",
  "manifest-version-check"
];

/**
 * Returns a lightweight, side-effect-free view of all volatile caches.
 * Manifest definition databases and user data are intentionally excluded.
 */
export function inspectCache(dataDir: string): CacheStatus {
  const paths = cachePaths(dataDir);
  return {
    data_dir: dataDir,
    generated_at: new Date().toISOString(),
    domains: allDomains.map((domain) => describeDomain(domain, paths[domain])),
    account_cache_metrics: getAccountCacheMetrics()
  };
}

/**
 * Clears selected volatile cache domains. Account item details are cleared by
 * deleting rows rather than unlinking the SQLite file, so an in-flight reader
 * cannot retain a stale file descriptor. The SQLite file is intentionally kept
 * for fast reopen and to avoid racing an active connection.
 */
export async function clearCache(
  dataDir: string,
  domains: readonly CacheDomain[] = allDomains
): Promise<CacheClearResult> {
  const selected = [...new Set(domains)].filter((domain): domain is CacheDomain =>
    allDomains.includes(domain)
  );
  const before = inspectCache(dataDir);
  const paths = cachePaths(dataDir);

  for (const domain of selected) {
    if (domain === "account-item-details") {
      // Avoid creating a new SQLite file just because the user pressed
      // "清理" on a fresh installation.
      if (existsSync(paths[domain])) {
        await clearCachedAccountItemDetails(dataDir);
      }
      continue;
    }
    removePath(paths[domain]);
  }

  const removedBytes = selected.reduce((total, domain) => {
    if (domain === "account-item-details") return total;
    const entry = before.domains.find((item) => item.domain === domain);
    return total + (entry?.bytes ?? 0);
  }, 0);
  return {
    cleared: selected,
    removed_bytes: removedBytes,
    status: inspectCache(dataDir)
  };
}

function cachePaths(dataDir: string): Record<CacheDomain, string> {
  return {
    "account-snapshot": join(dataDir, "account-snapshot-cache.json"),
    "account-pursuits": join(dataDir, "account-pursuit-cache.json"),
    "account-item-details": join(dataDir, "cache", "account-cache.sqlite"),
    "home-briefing": join(dataDir, "home-briefing-cache.json"),
    "vendor-inventory": join(dataDir, "vendor-inventory-cache.json"),
    "manifest-version-check": join(dataDir, "manifest", "version-check.json")
  };
}

function describeDomain(domain: CacheDomain, path: string): CacheDomainStatus {
  const exists = existsSync(path);
  return {
    domain,
    path,
    exists,
    bytes: exists ? sizeOf(path) : 0,
    ...(exists ? { updated_at: modifiedAt(path) } : {})
  };
}

function removePath(path: string): void {
  try {
    rmSync(path, { recursive: true, force: true });
  } catch {
    // Cache cleanup is best effort; a locked file is retried next time.
  }
}

function sizeOf(path: string): number {
  try {
    const info = statSync(path);
    if (info.isFile()) return info.size;
    if (!info.isDirectory()) return 0;
    return readdirSync(path, { withFileTypes: true }).reduce((total, entry) => {
      return total + sizeOf(join(path, entry.name));
    }, 0);
  } catch {
    return 0;
  }
}

function modifiedAt(path: string): string | undefined {
  try {
    return statSync(path).mtime.toISOString();
  } catch {
    return undefined;
  }
}
