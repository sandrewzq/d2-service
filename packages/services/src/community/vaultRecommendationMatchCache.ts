import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  VaultItemInstanceMatchInfo,
  VaultItemMatchInput
} from "@d2-tools/core/community-perks";
import { openRecommendationDatabase } from "./recommendationDatabase.js";
import { recommendationOverrideRevision } from "./recommendationOverrides.js";

const databaseFileName = "account-cache.sqlite";
// 旧缓存可能是在中文推荐库不可用、或未解析名称被误判为无法核对时生成；
// 当前匹配语义已改变，必须整体失效，避免继续显示历史错误结果。
const matchAlgorithmVersion = 12;

export type VaultRecommendationMatchCacheContext = {
  account_key: string;
  manifest_version: string;
  manifest_language: string;
  recommendation_revision: string;
};

export type VaultRecommendationMatchCachePartition = {
  cached_by_index: Map<number, VaultItemInstanceMatchInfo>;
  missing: Array<{ index: number; item: VaultItemMatchInput; roll_fingerprint: string }>;
};

export function buildVaultRecommendationMatchRevision(
  dataDir: string,
  curatedRevision: string
): string {
  const database = openRecommendationDatabase(dataDir);
  try {
    const externalRows = database.prepare(`
      SELECT source_kind, source_fingerprint
      FROM external_recommendation_sets
      ORDER BY source_kind
    `).all() as Array<{ source_kind: string; source_fingerprint: string }>;
    return sha256(JSON.stringify({
      match_algorithm_version: matchAlgorithmVersion,
      curated_revision: curatedRevision,
      external_revisions: externalRows,
      override_revision: recommendationOverrideRevision(dataDir)
    }));
  } finally {
    database.close();
  }
}

export function partitionVaultRecommendationMatchCache(
  dataDir: string,
  items: VaultItemMatchInput[],
  context: VaultRecommendationMatchCacheContext
): VaultRecommendationMatchCachePartition {
  const cachedByIndex = new Map<number, VaultItemInstanceMatchInfo>();
  const missing: VaultRecommendationMatchCachePartition["missing"] = [];
  if (!context.account_key) {
    items.forEach((item, index) => {
      missing.push({ index, item, roll_fingerprint: createVaultWeaponRollFingerprint(item) });
    });
    return { cached_by_index: cachedByIndex, missing };
  }
  const database = openAccountCacheDatabase(dataDir);
  try {
    const read = database.prepare(`
      SELECT item_hash, roll_fingerprint, manifest_version, manifest_language,
             recommendation_revision, match_json
      FROM vault_weapon_match_cache
      WHERE account_key = ? AND instance_id = ?
    `);
    items.forEach((item, index) => {
      const rollFingerprint = createVaultWeaponRollFingerprint(item);
      if (!item.instance_id) {
        missing.push({ index, item, roll_fingerprint: rollFingerprint });
        return;
      }
      const row = read.get(context.account_key, item.instance_id) as MatchCacheRow | undefined;
      const cached = row
        && row.item_hash === item.hash
        && row.roll_fingerprint === rollFingerprint
        && row.manifest_version === context.manifest_version
        && row.manifest_language === context.manifest_language
        && row.recommendation_revision === context.recommendation_revision
          ? parseMatch(row.match_json, item.instance_id, item.hash)
          : null;
      if (cached) cachedByIndex.set(index, cached);
      else missing.push({ index, item, roll_fingerprint: rollFingerprint });
    });
  } finally {
    database.close();
  }
  return { cached_by_index: cachedByIndex, missing };
}

export function saveVaultRecommendationMatchCache(
  dataDir: string,
  entries: Array<{
    item: VaultItemMatchInput;
    roll_fingerprint: string;
    match: VaultItemInstanceMatchInfo;
  }>,
  context: VaultRecommendationMatchCacheContext,
  now = new Date()
): void {
  if (!context.account_key) return;
  const persistable = entries.filter((entry) => Boolean(entry.item.instance_id));
  if (!persistable.length) return;
  const database = openAccountCacheDatabase(dataDir);
  try {
    const write = database.prepare(`
      INSERT INTO vault_weapon_match_cache (
        account_key, instance_id, item_hash, roll_fingerprint, manifest_version, manifest_language,
        recommendation_revision, match_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_key, instance_id) DO UPDATE SET
        item_hash = excluded.item_hash,
        roll_fingerprint = excluded.roll_fingerprint,
        manifest_version = excluded.manifest_version,
        manifest_language = excluded.manifest_language,
        recommendation_revision = excluded.recommendation_revision,
        match_json = excluded.match_json,
        updated_at = excluded.updated_at
    `);
    database.exec("BEGIN IMMEDIATE;");
    try {
      persistable.forEach(({ item, roll_fingerprint, match }) => {
        const instanceId = item.instance_id;
        if (!instanceId) return;
        write.run(
          context.account_key,
          instanceId,
          item.hash,
          roll_fingerprint,
          context.manifest_version,
          context.manifest_language,
          context.recommendation_revision,
          JSON.stringify(match),
          now.toISOString()
        );
      });
      database.exec("COMMIT;");
    } catch (error) {
      database.exec("ROLLBACK;");
      throw error;
    }
  } finally {
    database.close();
  }
}

/**
 * A source/rule edit changes the composite recommendation revision globally,
 * but only weapons covered by that edit need to be recalculated. Remove those
 * rows and advance every unaffected row to the new revision so the next account
 * sync does not repeat work that is known to be semantically unchanged.
 */
export function advanceVaultRecommendationMatchCacheRevision(
  dataDir: string,
  recommendationRevision: string,
  affectedWeaponHashes: readonly number[]
): void {
  const database = openAccountCacheDatabase(dataDir);
  try {
    const removeAffected = database.prepare("DELETE FROM vault_weapon_match_cache WHERE item_hash = ?");
    database.exec("BEGIN IMMEDIATE;");
    try {
      for (const itemHash of new Set(affectedWeaponHashes)) removeAffected.run(itemHash);
      database.prepare("UPDATE vault_weapon_match_cache SET recommendation_revision = ?")
        .run(recommendationRevision);
      database.exec("COMMIT;");
    } catch (error) {
      database.exec("ROLLBACK;");
      throw error;
    }
  } finally {
    database.close();
  }
}

export function createVaultWeaponRollFingerprint(item: VaultItemMatchInput): string {
  const socketPlugs = [...(item.socket_plugs ?? [])]
    .map((plug) => ({ hash: plug.hash, socket_index: plug.socket_index ?? -1 }))
    .sort((left, right) => left.socket_index - right.socket_index || left.hash - right.hash);
  const rollSockets = [...(item.weapon_roll?.sockets ?? [])]
    .map((socket) => ({
      slot: socket.slot,
      socket_index: socket.socket_index,
      complete: socket.complete,
      current_plug: socket.current_plug
        ? { hash: socket.current_plug.hash, name: socket.current_plug.name }
        : null,
      owned_plugs: [...socket.owned_plugs]
        .map((plug) => ({ hash: plug.hash, name: plug.name }))
        .sort((left, right) => left.hash - right.hash || left.name.localeCompare(right.name))
    }))
    .sort((left, right) => left.socket_index - right.socket_index || left.slot.localeCompare(right.slot));
  return sha256(JSON.stringify({
    hash: item.hash,
    item_name: item.item_name ?? "",
    socket_plugs: socketPlugs,
    weapon_roll: item.weapon_roll
      ? { fingerprint: item.weapon_roll.fingerprint, complete: item.weapon_roll.complete, sockets: rollSockets }
      : null
  }));
}

type MatchCacheRow = {
  item_hash: number;
  roll_fingerprint: string;
  manifest_version: string;
  manifest_language: string;
  recommendation_revision: string;
  match_json: string;
};

function openAccountCacheDatabase(dataDir: string): DatabaseSync {
  mkdirSync(join(dataDir, "cache"), { recursive: true });
  const database = new DatabaseSync(join(dataDir, "cache", databaseFileName), { timeout: 5_000 });
  database.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
  const existingColumns = database.prepare("PRAGMA table_info(vault_weapon_match_cache)").all() as Array<{
    name?: string;
    pk?: number;
  }>;
  const existingPrimaryKey = existingColumns
    .filter((column) => Number(column.pk ?? 0) > 0)
    .sort((left, right) => Number(left.pk ?? 0) - Number(right.pk ?? 0))
    .map((column) => column.name);
  if (existingColumns.length > 0 && (
    !existingColumns.some((column) => column.name === "account_key")
    || JSON.stringify(existingPrimaryKey) !== JSON.stringify(["account_key", "instance_id"])
  )) {
    database.exec("DROP TABLE vault_weapon_match_cache;");
  }
  database.exec(`
    CREATE TABLE IF NOT EXISTS vault_weapon_match_cache (
      account_key TEXT NOT NULL,
      instance_id TEXT NOT NULL,
      item_hash INTEGER NOT NULL CHECK (item_hash >= 0 AND item_hash <= 4294967295),
      roll_fingerprint TEXT NOT NULL,
      manifest_version TEXT NOT NULL,
      manifest_language TEXT NOT NULL,
      recommendation_revision TEXT NOT NULL,
      match_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (account_key, instance_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_vault_weapon_match_revision
      ON vault_weapon_match_cache(account_key, manifest_version, manifest_language, recommendation_revision);
    CREATE INDEX IF NOT EXISTS idx_vault_weapon_match_item
      ON vault_weapon_match_cache(item_hash);
  `);
  return database;
}

function parseMatch(
  value: string,
  instanceId: string,
  itemHash: number
): VaultItemInstanceMatchInfo | null {
  try {
    const parsed = JSON.parse(value) as Partial<VaultItemInstanceMatchInfo>;
    if (parsed.instance_id !== instanceId || parsed.hash !== itemHash) return null;
    if (typeof parsed.canonical_weapon_name !== "string" || !parsed.canonical_weapon_name) return null;
    if (parsed.coverage !== "covered" && parsed.coverage !== "uncovered") return null;
    if (parsed.recommendation_state !== "priority"
      && parsed.recommendation_state !== "compare"
      && parsed.recommendation_state !== "uncovered") return null;
    if (!Array.isArray(parsed.modes)) return null;
    return parsed as VaultItemInstanceMatchInfo;
  } catch {
    return null;
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
