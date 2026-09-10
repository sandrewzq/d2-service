import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { VendorInventorySnapshot } from "@d2-tools/core/vendors/inventory";
import {
  createDataResource,
  type DataResource,
  type DataResourceError,
  type DataResourceStateInput
} from "../account/resource.js";

export type VendorInventoryCacheContext = {
  membershipType: number;
  membershipId: string;
  characterIds: readonly string[];
  detailVendorHashes?: readonly number[];
  manifestLanguage: string;
};

export type CachedVendorInventory = {
  saved_at: string;
  snapshot: VendorInventorySnapshot;
};

/** 商人库存缓存的统一资源包装，保留旧缓存 DTO 兼容性。 */
export type CachedVendorInventoryResource = DataResource<CachedVendorInventory>;

export type VendorInventoryResourceOptions = {
  now?: Date | number;
  /** 本地库存保持 cached 状态的时间，默认 5 分钟。 */
  freshTtlMs?: number;
  loading?: boolean;
  refreshing?: boolean;
  error?: DataResourceError;
};

const defaultFreshTtlMs = 5 * 60 * 1000;

type VendorInventoryCacheFile = {
  version: 2;
  entries: Record<string, CachedVendorInventory>;
};

const fileName = "vendor-inventory-cache.json";
const maxEntries = 12;
const saveQueues = new Map<string, Promise<void>>();
let temporarySequence = 0;

export function createVendorInventoryCacheKey(context: VendorInventoryCacheContext): string {
  const characterIds = [...new Set(context.characterIds)].sort();
  const detailVendorHashes = [...new Set(context.detailVendorHashes ?? [])]
    .filter((hash) => Number.isInteger(hash) && hash > 0)
    .sort((left, right) => left - right);
  return JSON.stringify([
    context.manifestLanguage,
    context.membershipType,
    context.membershipId,
    characterIds,
    detailVendorHashes
  ]);
}

export async function loadCachedVendorInventory(
  dataDir: string,
  context: VendorInventoryCacheContext
): Promise<CachedVendorInventory | null> {
  const file = await readCacheFile(dataDir);
  const exact = file.entries[createVendorInventoryCacheKey(context)];
  if (exact) return exact;
  return Object.entries(file.entries)
    .filter(([key]) => isCompatibleCacheKey(key, context))
    .map(([, cached]) => cached)
    .sort((left, right) => right.saved_at.localeCompare(left.saved_at))[0]
    ?? null;
}

/**
 * 将商人库存缓存转换为 DataResource。过期库存不会被丢弃，
 * 由调用方在 stale 状态下触发后台刷新即可。
 */
export function createVendorInventoryResource(
  cached: CachedVendorInventory | null,
  options: VendorInventoryResourceOptions = {}
): CachedVendorInventoryResource {
  if (!cached) {
    return createDataResource<CachedVendorInventory>({
      data: null,
      source: "local",
      unavailable: !options.loading,
      loading: options.loading,
      error: options.error
    }, options.now);
  }
  const freshTtlMs = normalizeTtl(options.freshTtlMs);
  const savedAt = Date.parse(cached.saved_at);
  const hasPartialFailure = cached.snapshot.status !== "ready";
  const staleAt = Number.isFinite(savedAt)
    ? new Date(Math.min(
      hasPartialFailure ? savedAt - 1 : savedAt + freshTtlMs,
      ...collectNextRefreshTimestamps(cached.snapshot)
    )).toISOString()
    : new Date(0).toISOString();
  const input: DataResourceStateInput<CachedVendorInventory> = {
    data: cached,
    source: "local",
    fetchedAt: cached.snapshot.fetchedAt,
    staleAt,
    error: options.error ?? (cached.snapshot.status === "error" && cached.snapshot.errorMessage
      ? { code: "vendor-inventory", message: cached.snapshot.errorMessage }
      : undefined),
    refreshing: options.refreshing
  };
  return createDataResource(input, options.now);
}

/** 读取并包装商人缓存，供 IPC / repository 直接使用。 */
export async function loadVendorInventoryResource(
  dataDir: string,
  context: VendorInventoryCacheContext,
  options: VendorInventoryResourceOptions = {}
): Promise<CachedVendorInventoryResource> {
  const cached = await loadCachedVendorInventory(dataDir, context);
  return createVendorInventoryResource(cached, options);
}

export async function saveCachedVendorInventory(
  dataDir: string,
  context: VendorInventoryCacheContext,
  snapshot: VendorInventorySnapshot,
  now = new Date()
): Promise<CachedVendorInventory> {
  const cached: CachedVendorInventory = {
    saved_at: now.toISOString(),
    snapshot
  };
  const target = cachePath(dataDir);
  const previous = saveQueues.get(target) ?? Promise.resolve();
  const operation = previous.catch(() => undefined).then(async () => {
    const file = await readCacheFile(dataDir);
    file.entries[createVendorInventoryCacheKey(context)] = cached;
    file.entries = Object.fromEntries(
      Object.entries(file.entries)
        .sort(([, left], [, right]) => right.saved_at.localeCompare(left.saved_at))
        .slice(0, maxEntries)
    );
    await mkdir(dataDir, { recursive: true });
    const temporary = `${target}.tmp-${process.pid}-${Date.now()}-${temporarySequence++}`;
    try {
      await writeFile(temporary, `${JSON.stringify(file)}\n`, "utf8");
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
  return cached;
}

async function readCacheFile(dataDir: string): Promise<VendorInventoryCacheFile> {
  try {
    const parsed = JSON.parse(await readFile(cachePath(dataDir), "utf8")) as Partial<VendorInventoryCacheFile>;
    if (parsed.version !== 2 || !parsed.entries || typeof parsed.entries !== "object") {
      return emptyCacheFile();
    }
    return {
      version: 2,
      entries: Object.fromEntries(Object.entries(parsed.entries).filter((entry): entry is [string, CachedVendorInventory] => (
        typeof entry[1]?.saved_at === "string" && isVendorInventorySnapshot(entry[1]?.snapshot)
      )))
    };
  } catch {
    return emptyCacheFile();
  }
}

function emptyCacheFile(): VendorInventoryCacheFile {
  return { version: 2, entries: {} };
}

function cachePath(dataDir: string): string {
  return join(dataDir, fileName);
}

function isCompatibleCacheKey(
  key: string,
  context: VendorInventoryCacheContext
): boolean {
  try {
    const parsed = JSON.parse(key) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 5) return false;
    const [manifestLanguage, membershipType, membershipId, characterIds, detailVendorHashes] = parsed;
    if (
      manifestLanguage !== context.manifestLanguage
      || membershipType !== context.membershipType
      || membershipId !== context.membershipId
      || !Array.isArray(characterIds)
      || !Array.isArray(detailVendorHashes)
    ) return false;
    const requestedCharacterIds = [...new Set(context.characterIds)].sort();
    const cachedCharacterIds = characterIds.filter((value): value is string => typeof value === "string").sort();
    if (JSON.stringify(cachedCharacterIds) !== JSON.stringify(requestedCharacterIds)) return false;
    const cachedDetailVendorHashes = new Set(
      detailVendorHashes.filter((value): value is number => (
        typeof value === "number" && Number.isInteger(value) && value > 0
      ))
    );
    return (context.detailVendorHashes ?? [])
      .filter((hash) => Number.isInteger(hash) && hash > 0)
      .every((hash) => cachedDetailVendorHashes.has(hash));
  } catch {
    return false;
  }
}

function isVendorInventorySnapshot(value: unknown): value is VendorInventorySnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<VendorInventorySnapshot>;
  return typeof snapshot.status === "string"
    && typeof snapshot.fetchedAt === "string"
    && Array.isArray(snapshot.vendors)
    && Boolean(snapshot.characterContexts && typeof snapshot.characterContexts === "object");
}

function normalizeTtl(value: number | undefined): number {
  return Number.isFinite(value) && (value as number) > 0
    ? value as number
    : defaultFreshTtlMs;
}

function collectNextRefreshTimestamps(snapshot: VendorInventorySnapshot): number[] {
  return snapshot.vendors
    .flatMap((vendor) => vendor.nextRefreshAt ? [Date.parse(vendor.nextRefreshAt)] : [])
    .filter((timestamp) => Number.isFinite(timestamp));
}
