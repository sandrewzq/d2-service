import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  sanitizeAccountItemSummary,
  type AccountItemDetail
} from "@d2-tools/core/account/summary";

/** Identifies one account-owned item detail cache entry. */
export type AccountItemDetailCacheKey = {
  membership_type: number;
  destiny_membership_id: string;
  manifest_revision: string;
  instance_id: string;
};

export type CachedAccountItemDetail = AccountItemDetailCacheKey & {
  fetched_at: string;
  detail: AccountItemDetail;
};

export type AccountItemDetailCacheStore = {
  get(key: AccountItemDetailCacheKey): Promise<CachedAccountItemDetail | null>;
  set(
    key: AccountItemDetailCacheKey,
    detail: AccountItemDetail,
    now?: Date
  ): Promise<CachedAccountItemDetail>;
  delete(key: AccountItemDetailCacheKey): Promise<boolean>;
  clear(account?: AccountItemDetailCacheAccount): Promise<number>;
};

export type AccountItemDetailCacheAccount = Pick<
  AccountItemDetailCacheKey,
  "membership_type" | "destiny_membership_id"
>;

const databaseFileName = "account-cache.sqlite";
const saveQueues = new Map<string, Promise<unknown>>();

/**
 * Creates the durable account item detail store.
 *
 * Account-owned data deliberately lives in a separate SQLite database from
 * the read-only Manifest database. The old JSON cache is never interpreted;
 * malformed or legacy files therefore safely behave as an empty cache.
 */
export function createAccountItemDetailStore(dataDir: string): AccountItemDetailCacheStore {
  return {
    get: (key) => loadCachedAccountItemDetail(dataDir, key),
    set: (key, detail, now) => saveCachedAccountItemDetail(dataDir, key, detail, now),
    delete: (key) => deleteCachedAccountItemDetail(dataDir, key),
    clear: (account) => clearCachedAccountItemDetails(dataDir, account)
  };
}

export async function loadCachedAccountItemDetail(
  dataDir: string,
  key: AccountItemDetailCacheKey
): Promise<CachedAccountItemDetail | null> {
  assertCacheKey(key);
  try {
    const database = await openDatabase(dataDir);
    try {
      const row = database.prepare(`
        SELECT membership_type, destiny_membership_id, manifest_revision, instance_id, fetched_at, detail_json
        FROM account_item_details
        WHERE membership_type = ? AND destiny_membership_id = ?
          AND manifest_revision = ? AND instance_id = ?
      `).get(
        key.membership_type,
        key.destiny_membership_id,
        key.manifest_revision,
        key.instance_id
      ) as DetailRow | undefined;
      return row ? parseDetailRow(row) : null;
    } finally {
      database.close();
    }
  } catch {
    return null;
  }
}

export async function saveCachedAccountItemDetail(
  dataDir: string,
  key: AccountItemDetailCacheKey,
  detail: AccountItemDetail,
  now = new Date()
): Promise<CachedAccountItemDetail> {
  assertCacheKey(key);
  if (detail.instance_id !== key.instance_id) {
    throw new Error("Account item detail instance_id does not match its cache key");
  }
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Account item detail cache timestamp is invalid");
  }
  const cached: CachedAccountItemDetail = {
    ...key,
    fetched_at: now.toISOString(),
    detail: sanitizeAccountItemSummary(detail)
  };
  await enqueueMutation(dataDir, (database) => {
    database.prepare(`
      INSERT INTO account_item_details (
        membership_type, destiny_membership_id, manifest_revision, instance_id, fetched_at, detail_json
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(membership_type, destiny_membership_id, manifest_revision, instance_id) DO UPDATE SET
        fetched_at = excluded.fetched_at,
        detail_json = excluded.detail_json
    `).run(
      key.membership_type,
      key.destiny_membership_id,
      key.manifest_revision,
      key.instance_id,
      cached.fetched_at,
      JSON.stringify(cached.detail)
    );
  });
  return cached;
}

export async function deleteCachedAccountItemDetail(
  dataDir: string,
  key: AccountItemDetailCacheKey
): Promise<boolean> {
  assertCacheKey(key);
  let deleted = false;
  await enqueueMutation(dataDir, (database) => {
    const result = database.prepare(`
      DELETE FROM account_item_details
      WHERE membership_type = ? AND destiny_membership_id = ?
        AND manifest_revision = ? AND instance_id = ?
    `).run(key.membership_type, key.destiny_membership_id, key.manifest_revision, key.instance_id);
    deleted = Number(result.changes) > 0;
  });
  return deleted;
}

/** Clears all account item details, or only entries for one membership. */
export async function clearCachedAccountItemDetails(
  dataDir: string,
  account?: AccountItemDetailCacheAccount
): Promise<number> {
  if (account) assertCacheAccount(account);
  let removed = 0;
  await enqueueMutation(dataDir, (database) => {
    const result = account
      ? database.prepare(`
        DELETE FROM account_item_details
        WHERE membership_type = ? AND destiny_membership_id = ?
      `).run(account.membership_type, account.destiny_membership_id)
      : database.prepare("DELETE FROM account_item_details").run();
    removed = Number(result.changes);
  });
  return removed;
}

export function createAccountItemDetailCacheKey(key: AccountItemDetailCacheKey): string {
  assertCacheKey(key);
  return JSON.stringify([
    key.membership_type,
    key.destiny_membership_id,
    key.manifest_revision,
    key.instance_id
  ]);
}

type DetailRow = {
  membership_type: number;
  destiny_membership_id: string;
  manifest_revision: string;
  instance_id: string;
  fetched_at: string;
  detail_json: string;
};

async function enqueueMutation<T>(
  dataDir: string,
  operation: (database: DatabaseSync) => T | Promise<T>
): Promise<T> {
  const target = databasePath(dataDir);
  const previous = saveQueues.get(target) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(async () => {
    const database = await openDatabase(dataDir);
    let transactionStarted = false;
    try {
      database.exec("BEGIN IMMEDIATE;");
      transactionStarted = true;
      const result = await operation(database);
      database.exec("COMMIT;");
      return result;
    } catch (error) {
      if (transactionStarted) {
        try {
          database.exec("ROLLBACK;");
        } catch {
          // Ignore rollback errors while preserving the original failure.
        }
      }
      throw error;
    } finally {
      database.close();
    }
  });
  saveQueues.set(target, current);
  try {
    return await current;
  } finally {
    if (saveQueues.get(target) === current) saveQueues.delete(target);
  }
}

async function openDatabase(dataDir: string): Promise<DatabaseSync> {
  const target = databasePath(dataDir);
  await mkdir(join(dataDir, "cache"), { recursive: true });
  let database: DatabaseSync | undefined;
  try {
    database = new DatabaseSync(target, { timeout: 5_000 });
    database.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
    database.exec(`
      CREATE TABLE IF NOT EXISTS account_item_details (
        membership_type INTEGER NOT NULL,
        destiny_membership_id TEXT NOT NULL,
        manifest_revision TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        fetched_at TEXT NOT NULL,
        detail_json TEXT NOT NULL,
        PRIMARY KEY (membership_type, destiny_membership_id, manifest_revision, instance_id)
      );
    `);
    validateSchema(database);
  } catch (error) {
    try {
      database?.close();
    } catch {
      // Ignore close errors for an unusable database.
    }
    if (!(error instanceof Error) || !error.message.includes("schema is invalid")) {
      return createMemoryDatabase();
    }
    try {
      database = new DatabaseSync(target, { timeout: 5_000 });
      database.exec(`
        DROP TABLE IF EXISTS account_item_details;
        CREATE TABLE account_item_details (
          membership_type INTEGER NOT NULL,
          destiny_membership_id TEXT NOT NULL,
          manifest_revision TEXT NOT NULL,
          instance_id TEXT NOT NULL,
          fetched_at TEXT NOT NULL,
          detail_json TEXT NOT NULL,
          PRIMARY KEY (membership_type, destiny_membership_id, manifest_revision, instance_id)
        );
      `);
    } catch {
      // A read-only or otherwise unavailable directory degrades to an
      // in-memory database. Callers still receive a safe empty cache.
      return createMemoryDatabase();
    }
  }
  if (!database) {
    throw new Error("Account item detail cache database could not be opened");
  }
  return database;
}

function createMemoryDatabase(): DatabaseSync {
  const database = new DatabaseSync(":memory:");
  database.exec(`
    CREATE TABLE account_item_details (
      membership_type INTEGER NOT NULL,
      destiny_membership_id TEXT NOT NULL,
      manifest_revision TEXT NOT NULL,
      instance_id TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      detail_json TEXT NOT NULL,
      PRIMARY KEY (membership_type, destiny_membership_id, manifest_revision, instance_id)
    );
  `);
  return database;
}

function validateSchema(database: DatabaseSync): void {
  const columns = database.prepare("PRAGMA table_info(account_item_details)").all() as Array<{
    name: string;
    pk: number;
  }>;
  const required = [
    "membership_type",
    "destiny_membership_id",
    "manifest_revision",
    "instance_id",
    "fetched_at",
    "detail_json"
  ];
  if (!required.every((column) => columns.some((entry) => entry.name === column))) {
    throw new Error("Account item detail cache schema is invalid");
  }
  const primaryKey = columns
    .filter((column) => column.pk > 0)
    .sort((left, right) => left.pk - right.pk)
    .map((column) => column.name);
  if (JSON.stringify(primaryKey) !== JSON.stringify([
    "membership_type",
    "destiny_membership_id",
    "manifest_revision",
    "instance_id"
  ])) {
    throw new Error("Account item detail cache schema is invalid");
  }
}

function parseDetailRow(row: DetailRow): CachedAccountItemDetail | null {
  try {
    const detail = JSON.parse(row.detail_json) as AccountItemDetail;
    if (!isAccountItemDetail(detail) || !Number.isFinite(Date.parse(row.fetched_at))) return null;
    return {
      membership_type: row.membership_type,
      destiny_membership_id: row.destiny_membership_id,
      manifest_revision: row.manifest_revision,
      instance_id: row.instance_id,
      fetched_at: row.fetched_at,
      detail: sanitizeAccountItemSummary(detail)
    };
  } catch {
    return null;
  }
}

function databasePath(dataDir: string): string {
  return join(dataDir, "cache", databaseFileName);
}

function assertCacheKey(key: AccountItemDetailCacheKey): void {
  if (!Number.isInteger(key.membership_type) || key.membership_type < 0) {
    throw new Error("Account item detail cache membership_type is invalid");
  }
  if (!nonEmptyString(key.destiny_membership_id)
    || !nonEmptyString(key.manifest_revision)
    || !nonEmptyString(key.instance_id)) {
    throw new Error("Account item detail cache membership, manifest revision or instance id is invalid");
  }
}

function assertCacheAccount(account: AccountItemDetailCacheAccount): void {
  if (!Number.isInteger(account.membership_type) || account.membership_type < 0) {
    throw new Error("Account item detail cache membership_type is invalid");
  }
  if (!nonEmptyString(account.destiny_membership_id)) {
    throw new Error("Account item detail cache membership id is invalid");
  }
}

function isAccountItemDetail(value: unknown): value is AccountItemDetail {
  if (!isRecord(value)) return false;
  return nonEmptyString(value.instance_id)
    && typeof value.hash === "number"
    && typeof value.name === "string"
    && typeof value.group_key === "string"
    && Array.isArray(value.sockets)
    && Array.isArray(value.socket_plugs);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
