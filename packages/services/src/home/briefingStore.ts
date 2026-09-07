import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { DailySummary } from "@d2-tools/core/daily/summary";
import type { WeeklySummary } from "@d2-tools/core/weekly/summary";
import {
  createDataResource,
  type DataResource,
  type DataResourceError,
  type DataResourceStateInput
} from "../account/resource.js";

export type CachedHomeBriefing = {
  version: 6;
  context_key: string;
  saved_at: string;
  fetched_at: string;
  daily_period_key: string;
  weekly_period_key: string;
  xur_period_key: string;
  xur_refresh_at?: string;
  daily: DailySummary;
  weekly: WeeklySummary;
};

/**
 * 首页缓存统一资源包装。保留 `loadCachedHomeBriefing` 的旧返回值，
 * 新调用方可通过该类型获得 cached/stale 等生命周期状态。
 */
export type CachedHomeBriefingResource = DataResource<CachedHomeBriefing>;

export type HomeBriefingResourceOptions = {
  now?: Date | number;
  /** 本地缓存保持 cached 状态的时间，默认 5 分钟。 */
  freshTtlMs?: number;
  loading?: boolean;
  refreshing?: boolean;
  error?: DataResourceError;
};

const defaultFreshTtlMs = 5 * 60 * 1000;

const fileName = "home-briefing-cache.json";
const saveQueues = new Map<string, Promise<void>>();
let temporarySequence = 0;

export async function loadCachedHomeBriefing(
  dataDir: string,
  contextKey: string
): Promise<CachedHomeBriefing | null> {
  try {
    const parsed = JSON.parse(await readFile(cachePath(dataDir), "utf8")) as Partial<CachedHomeBriefing>;
    if (parsed.version !== 6
      || parsed.context_key !== contextKey
      || !parsed.saved_at
      || !parsed.fetched_at
      || !parsed.daily_period_key
      || !parsed.weekly_period_key
      || !parsed.xur_period_key
      || !isDailySummary(parsed.daily)
      || !isWeeklySummary(parsed.weekly)) {
      return null;
    }
    return parsed as CachedHomeBriefing;
  } catch {
    return null;
  }
}

/**
 * 将首页缓存转换为统一 DataResource。没有缓存时返回 unavailable，
 * 过期缓存仍保留 data 并标记 stale，便于 UI 先展示再后台刷新。
 */
export function createHomeBriefingResource(
  cached: CachedHomeBriefing | null,
  options: HomeBriefingResourceOptions = {}
): CachedHomeBriefingResource {
  if (!cached) {
    return createDataResource<CachedHomeBriefing>({
      data: null,
      source: "local",
      unavailable: !options.loading,
      loading: options.loading,
      error: options.error
    }, options.now);
  }
  const freshTtlMs = normalizeTtl(options.freshTtlMs);
  const savedAt = Date.parse(cached.saved_at);
  const staleAt = Number.isFinite(savedAt)
    ? new Date(Math.min(savedAt + freshTtlMs, ...collectBoundaryTimestamps(cached))).toISOString()
    : new Date(0).toISOString();
  const input: DataResourceStateInput<CachedHomeBriefing> = {
    data: cached,
    source: "local",
    fetchedAt: cached.fetched_at,
    staleAt,
    refreshing: options.refreshing,
    error: options.error
  };
  return createDataResource(input, options.now);
}

/** 读取并包装首页缓存，供 IPC / repository 直接使用。 */
export async function loadHomeBriefingResource(
  dataDir: string,
  contextKey: string,
  options: HomeBriefingResourceOptions = {}
): Promise<CachedHomeBriefingResource> {
  const cached = await loadCachedHomeBriefing(dataDir, contextKey);
  return createHomeBriefingResource(cached, options);
}

export async function saveCachedHomeBriefing(
  dataDir: string,
  value: CachedHomeBriefing
): Promise<void> {
  const target = cachePath(dataDir);
  const previous = saveQueues.get(target) ?? Promise.resolve();
  const operation = previous.catch(() => undefined).then(async () => {
    await mkdir(dataDir, { recursive: true });
    const temporary = `${target}.tmp-${process.pid}-${Date.now()}-${temporarySequence++}`;
    try {
      await writeFile(temporary, `${JSON.stringify(value)}\n`, "utf8");
      await rename(temporary, target);
    } finally {
      await rm(temporary, { force: true }).catch(() => undefined);
    }
  });
  const tail = operation.then(() => undefined, () => undefined);
  saveQueues.set(target, tail);
  try {
    await operation;
  } finally {
    if (saveQueues.get(target) === tail) saveQueues.delete(target);
  }
}

function cachePath(dataDir: string): string {
  return join(dataDir, fileName);
}

function isDailySummary(value: unknown): value is DailySummary {
  if (!value || typeof value !== "object") return false;
  const summary = value as Partial<DailySummary>;
  return Boolean(summary.daily_reset?.next_reset_iso)
    && Boolean(summary.weekly_reset?.next_reset_iso)
    && Boolean(summary.sources?.vendors)
    && Boolean(summary.sources?.lost_sector);
}

function isWeeklySummary(value: unknown): value is WeeklySummary {
  if (!value || typeof value !== "object") return false;
  const summary = value as Partial<WeeklySummary>;
  return Boolean(summary.weekly_reset?.next_reset_iso)
    && Boolean(summary.priorities?.nightfall)
    && Boolean(summary.iron_banner)
    && Array.isArray(summary.public_clues);
}

function normalizeTtl(value: number | undefined): number {
  return Number.isFinite(value) && (value as number) > 0
    ? value as number
    : defaultFreshTtlMs;
}

function collectBoundaryTimestamps(cached: CachedHomeBriefing): number[] {
  const values = [
    cached.daily.daily_reset?.next_reset_iso,
    cached.daily.weekly_reset?.next_reset_iso,
    cached.weekly.weekly_reset?.next_reset_iso,
    cached.xur_refresh_at
  ];
  return values
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter((timestamp) => Number.isFinite(timestamp));
}
