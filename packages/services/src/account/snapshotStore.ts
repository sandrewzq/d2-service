import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  sanitizeAccountSnapshot,
  type AccountSnapshot
} from "@d2-tools/core/account/summary";

export type CachedAccountSnapshot = {
  version: 2;
  account_id?: string;
  saved_at: string;
  /**
   * Monotonic, lexicographically sortable revision for this persisted snapshot.
   * Older version=2 files may not contain this field.
   */
  snapshot_revision?: string;
  /**
   * Manifest revision used to build the snapshot, when the caller knows it.
   * This is intentionally optional: the store must never invent a Manifest version.
   */
  manifest_revision?: string;
  snapshot: AccountSnapshot;
};

export type AccountSnapshotCacheOptions = {
  accountId?: string;
  /** Explicit Manifest version associated with this snapshot, if available. */
  manifestRevision?: string;
};

const fileName = "account-snapshot-cache.json";
const saveQueues = new Map<string, Promise<void>>();
let temporarySequence = 0;

export async function loadCachedAccountSnapshot(
  dataDir: string,
  options: AccountSnapshotCacheOptions = {}
): Promise<CachedAccountSnapshot | null> {
  try {
    const parsed = JSON.parse(await readFile(snapshotPath(dataDir), "utf8")) as Partial<CachedAccountSnapshot>;
    if (parsed.version !== 2
      || !parsed.saved_at
      || !isAccountSnapshot(parsed.snapshot)
      || (options.accountId !== undefined && parsed.account_id !== options.accountId)) {
      return null;
    }
    return {
      version: 2,
      ...(typeof parsed.account_id === "string" ? { account_id: parsed.account_id } : {}),
      saved_at: parsed.saved_at,
      ...(normalizeRevision(parsed.snapshot_revision)
        ? { snapshot_revision: normalizeRevision(parsed.snapshot_revision) }
        : {}),
      ...(normalizeManifestRevision(parsed.manifest_revision)
        ? { manifest_revision: normalizeManifestRevision(parsed.manifest_revision) }
        : {}),
      snapshot: sanitizeAccountSnapshot(parsed.snapshot)
    };
  } catch {
    return null;
  }
}

export async function saveCachedAccountSnapshot(
  dataDir: string,
  snapshot: AccountSnapshot,
  now = new Date(),
  options: AccountSnapshotCacheOptions = {}
): Promise<CachedAccountSnapshot> {
  const target = snapshotPath(dataDir);
  const previous = saveQueues.get(target) ?? Promise.resolve();
  const operation = previous.catch(() => undefined).then(async () => {
    await mkdir(dataDir, { recursive: true });
    const previousRevision = await readPersistedRevision(target);
    const cached: CachedAccountSnapshot = {
      version: 2,
      ...(options.accountId ? { account_id: options.accountId } : {}),
      saved_at: now.toISOString(),
      snapshot_revision: createNextRevision(previousRevision, now.getTime()),
      ...(normalizeManifestRevision(options.manifestRevision)
        ? { manifest_revision: normalizeManifestRevision(options.manifestRevision) }
        : {}),
      snapshot: sanitizeAccountSnapshot(snapshot)
    };
    const temporary = `${target}.tmp-${process.pid}-${Date.now()}-${temporarySequence++}`;
    try {
      await writeFile(temporary, `${JSON.stringify(cached)}\n`, "utf8");
      await rename(temporary, target);
      return cached;
    } finally {
      await rm(temporary, { force: true }).catch(() => undefined);
    }
  });
  const tail = operation.then(() => undefined, () => undefined);
  saveQueues.set(target, tail);
  try {
    return await operation;
  } finally {
    if (saveQueues.get(target) === tail) saveQueues.delete(target);
  }
}

const revisionWidth = 24;

async function readPersistedRevision(target: string): Promise<bigint | null> {
  try {
    const parsed = JSON.parse(await readFile(target, "utf8")) as Partial<CachedAccountSnapshot>;
    return parseRevision(parsed.snapshot_revision);
  } catch {
    return null;
  }
}

function createNextRevision(previous: bigint | null, timestampMs: number): string {
  // Reserve six decimal digits for writes occurring within the same millisecond.
  // The resulting decimal string remains lexicographically sortable.
  const timestampRevision = BigInt(Math.max(0, Math.floor(timestampMs))) * 1_000_000n;
  const next = previous !== null && previous >= timestampRevision
    ? previous + 1n
    : timestampRevision;
  return next.toString().padStart(revisionWidth, "0");
}

function parseRevision(value: unknown): bigint | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function normalizeRevision(value: unknown): string | undefined {
  const parsed = parseRevision(value);
  return parsed === null ? undefined : parsed.toString().padStart(revisionWidth, "0");
}

function normalizeManifestRevision(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function snapshotPath(dataDir: string): string {
  return join(dataDir, fileName);
}

function isAccountSnapshot(value: unknown): value is AccountSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<AccountSnapshot>;
  return typeof snapshot.account_name === "string"
    && typeof snapshot.destiny_membership_id === "string"
    && typeof snapshot.membership_type === "number"
    && Array.isArray(snapshot.characters)
    && Boolean(snapshot.vault && Array.isArray(snapshot.vault.items))
    && Boolean(snapshot.materials && Array.isArray(snapshot.materials.items));
}
