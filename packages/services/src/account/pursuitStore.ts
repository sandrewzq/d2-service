import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AccountPursuitSummary } from "@d2-tools/core/account/pursuits";

export type CachedAccountPursuits = {
  version: 1;
  account_id: string;
  saved_at: string;
  summary: AccountPursuitSummary;
};

const fileName = "account-pursuit-cache.json";
let temporarySequence = 0;

export async function loadCachedAccountPursuits(
  dataDir: string,
  accountId: string
): Promise<CachedAccountPursuits | null> {
  try {
    const parsed = JSON.parse(await readFile(join(dataDir, fileName), "utf8")) as Partial<CachedAccountPursuits>;
    if (parsed.version !== 1 || parsed.account_id !== accountId || !isPursuitSummary(parsed.summary)) return null;
    return parsed as CachedAccountPursuits;
  } catch {
    return null;
  }
}

export async function saveCachedAccountPursuits(
  dataDir: string,
  accountId: string,
  summary: AccountPursuitSummary,
  now = new Date()
): Promise<CachedAccountPursuits> {
  await mkdir(dataDir, { recursive: true });
  const target = join(dataDir, fileName);
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}-${temporarySequence++}`;
  const cached: CachedAccountPursuits = {
    version: 1,
    account_id: accountId,
    saved_at: now.toISOString(),
    summary
  };
  try {
    await writeFile(temporary, `${JSON.stringify(cached)}\n`, "utf8");
    await rename(temporary, target);
    return cached;
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

function isPursuitSummary(value: unknown): value is AccountPursuitSummary {
  if (!value || typeof value !== "object") return false;
  const summary = value as Partial<AccountPursuitSummary>;
  return Array.isArray(summary.items)
    && typeof summary.total_count === "number"
    && typeof summary.pending_count === "number"
    && typeof summary.expiring_count === "number"
    && typeof summary.tracked_count === "number";
}
