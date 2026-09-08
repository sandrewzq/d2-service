import { parentPort } from "node:worker_threads";
import type { DefinitionComponentData, DefinitionRecord } from "@d2-tools/core/manifest/definitions";
import {
  createRecommendationCardSummary,
  type VaultCommunityMatchResult,
  type VaultItemInstanceMatchInfo,
  type VaultItemMatchInput,
  type WeaponIdentityRelation
} from "@d2-tools/core/community-perks";
import { loadDimWishlist } from "@d2-tools/services/analysis/wishlistStore";
import { createDefaultCommunityPerkService } from "@d2-tools/services/community/perkRecommendation";
import {
  collectRelatedWeaponRecommendationItemHashes,
  collectWeaponRecommendationCandidateItemHashes
} from "@d2-tools/services/community/weaponRecommendationKnowledge";
import {
  buildVaultRecommendationMatchRevision,
  createVaultWeaponRollFingerprint,
  partitionVaultRecommendationMatchCache,
  saveVaultRecommendationMatchCache,
  type VaultRecommendationMatchCacheContext,
  type VaultRecommendationMatchCachePartition
} from "@d2-tools/services/community/vaultRecommendationMatchCache";
import {
  createCompositeDefinitionReader,
  createJsonDefinitionReader,
  createSqliteDefinitionReader,
  type DefinitionReader
} from "@d2-tools/services/gameData/sqlite";
import { createSqliteGameDataCatalog } from "@d2-tools/services/gameData/sqlite";
import { loadActiveSqliteManifest, type SqliteManifestActivation } from "@d2-tools/services/manifest/lifecycle";
import type { RecommendationWorkerMatchInput } from "../runtime/recommendationRuntime.js";

type RecommendationWorkerRequest = {
  id: number;
  operation: "match" | "ping" | "close";
  input?: RecommendationWorkerMatchInput;
};

type OpenRuntime = {
  key: string;
  activation: SqliteManifestActivation;
  catalog: ReturnType<typeof createSqliteGameDataCatalog>;
  reader: DefinitionReader;
};

let runtime: OpenRuntime | null = null;
let requestQueue = Promise.resolve();

parentPort?.on("message", (request: RecommendationWorkerRequest) => {
  requestQueue = requestQueue.then(
    () => handleRequest(request),
    () => handleRequest(request)
  ).then(
    (result) => parentPort?.postMessage({ id: request.id, ok: true, result }),
    (error) => parentPort?.postMessage({
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : "推荐匹配失败"
    })
  ).then(() => undefined);
});

async function handleRequest(request: RecommendationWorkerRequest): Promise<unknown> {
  if (request.operation === "close") {
    closeRuntime();
    return null;
  }
  if (request.operation === "ping") return true;
  if (!request.input) throw new Error("推荐匹配缺少请求参数");
  return matchVaultItems(request.input);
}

async function matchVaultItems(input: RecommendationWorkerMatchInput): Promise<VaultCommunityMatchResult> {
  const current = ensureRuntime(input);
  const cacheContext = buildCacheContext(input);
  const cachePartition = readCachePartition(input.data_dir, input.items, cacheContext);
  const matchesByIndex = new Map(cachePartition.cached_by_index);

  if (cachePartition.missing.length) {
    const missingItems = cachePartition.missing.map((entry) => entry.item);
    const itemHashes = missingItems.map((item) => item.hash);
    const rootItems = getDefinitions(current, "DestinyInventoryItemDefinition", itemHashes);
    const targetWeaponIdentityRelations = await loadWeaponIdentityRelations(current, itemHashes);
    const queries = missingItems.map((item) => ({
      item_hash: item.hash,
      localized_names: [
        item.item_name?.trim() ?? "",
        rootItems[String(item.hash)]?.displayProperties?.name?.trim() ?? ""
      ].filter(Boolean)
    }));
    const candidateItemHashes = collectWeaponRecommendationCandidateItemHashes(
      input.data_dir,
      queries,
      targetWeaponIdentityRelations
    );
    const weaponIdentityRelations = mergeWeaponIdentityRelations(
      targetWeaponIdentityRelations,
      await loadWeaponIdentityRelations(current, candidateItemHashes)
    );
    const relatedItemHashes = collectRelatedWeaponRecommendationItemHashes(
      input.data_dir,
      queries,
      weaponIdentityRelations
    );
    const definitions = loadCommunityDefinitions(
      current,
      uniqueHashes([...itemHashes, ...relatedItemHashes]),
      dimRulePerkHashes(input.data_dir, itemHashes)
    );
    const service = createDefaultCommunityPerkService({ data: { data_dir: input.data_dir } });
    const freshMatches = await service.matchVaultItemInstances(missingItems, {
      manifest_version: input.manifest_version,
      itemDefinitions: definitions.items,
      plugSetDefinitions: definitions.plugSets,
      weaponIdentityRelations
    });
    cachePartition.missing.forEach((entry, index) => {
      const match = freshMatches[index];
      if (match) matchesByIndex.set(entry.index, match);
    });
    try {
      saveVaultRecommendationMatchCache(
        input.data_dir,
        cachePartition.missing.flatMap((entry, index) => {
          const match = freshMatches[index];
          return match ? [{ item: entry.item, roll_fingerprint: entry.roll_fingerprint, match }] : [];
        }),
        cacheContext
      );
    } catch {
      // 派生缓存不可用时继续返回实时核对结果。
    }
  }

  const matches = input.items.flatMap((_item, index) => {
    const match = matchesByIndex.get(index);
    return match ? [match] : [];
  });
  return {
    matches: input.include_evidence ? matches : [],
    card_summaries: matches.map(createRecommendationCardSummary),
    changed_instance_ids: cachePartition.missing.flatMap(({ item }) => (
      item.instance_id ? [item.instance_id] : []
    )),
    issues: [],
    manifest_version: input.manifest_version,
    recommendation_revision: cacheContext.recommendation_revision,
    ...(input.recommendation_schema_version !== undefined
      ? { recommendation_schema_version: input.recommendation_schema_version }
      : {})
  };
}

function ensureRuntime(input: RecommendationWorkerMatchInput): OpenRuntime {
  const activation = loadActiveSqliteManifest(input.data_dir, input.manifest_language);
  if (!activation || activation.manifestVersion !== input.manifest_version) {
    closeRuntime();
    throw new Error("推荐匹配所需资料库版本已变化，请稍后重试");
  }
  const key = [
    input.data_dir,
    input.manifest_language,
    activation.manifestVersion,
    activation.activatedAt
  ].join("\u0000");
  if (runtime?.key === key) return runtime;

  closeRuntime();
  const sqliteReader = createSqliteDefinitionReader({
    databasePath: activation.databasePath,
    batchSize: 256,
    cacheSize: 1_024
  });
  const reader = activation.supplementDataDir && activation.supplementComponents.length
    ? createCompositeDefinitionReader(
        sqliteReader,
        createJsonDefinitionReader({
          getDataDir: () => activation.supplementDataDir!,
          language: input.manifest_language
        })
      )
    : sqliteReader;
  try {
    const catalog = createSqliteGameDataCatalog({
      databasePath: activation.databasePath,
      searchIndexPath: activation.searchIndexPath,
      cacheSize: 4_000,
      secondarySearchIndexPaths: activation.englishSearchIndexPath
        ? [activation.englishSearchIndexPath]
        : [],
      manifestVersion: activation.manifestVersion,
      language: input.manifest_language,
      ...(activation.supplementDataDir && activation.supplementComponents.length
        ? {
            jsonSupplement: {
              getDataDir: () => activation.supplementDataDir!,
              language: input.manifest_language
            }
          }
        : {})
    });
    runtime = { key, activation, catalog, reader };
    return runtime;
  } catch (error) {
    reader.close();
    throw error;
  }
}

function closeRuntime(): void {
  const current = runtime;
  runtime = null;
  current?.catalog.close?.();
  current?.reader.close();
}

function buildCacheContext(input: RecommendationWorkerMatchInput): VaultRecommendationMatchCacheContext {
  let recommendationRevision = input.curated_revision;
  try {
    recommendationRevision = buildVaultRecommendationMatchRevision(input.data_dir, input.curated_revision);
  } catch {
    // 推荐库不可读时仍使用当前已知 revision，缓存只作为优化。
  }
  return {
    account_key: input.account_key,
    manifest_version: input.manifest_version,
    manifest_language: input.manifest_language,
    recommendation_revision: recommendationRevision
  };
}

function readCachePartition(
  dataDir: string,
  items: VaultItemMatchInput[],
  context: VaultRecommendationMatchCacheContext
): VaultRecommendationMatchCachePartition {
  try {
    return partitionVaultRecommendationMatchCache(dataDir, items, context);
  } catch {
    return {
      cached_by_index: new Map<number, VaultItemInstanceMatchInfo>(),
      missing: items.map((item, index) => ({
        index,
        item,
        roll_fingerprint: createVaultWeaponRollFingerprint(item)
      }))
    };
  }
}

function loadCommunityDefinitions(
  current: OpenRuntime,
  itemHashes: number[],
  extraPlugHashes: number[] = []
): { items: DefinitionComponentData; plugSets: DefinitionComponentData } {
  const rootItems = getDefinitions(current, "DestinyInventoryItemDefinition", itemHashes);
  const itemRecords = Object.values(rootItems) as DefinitionRecord[];
  const socketEntries = itemRecords.flatMap((item) => (
    (item.sockets?.socketEntries ?? []) as Array<{
      singleInitialItemHash?: number;
      reusablePlugItems?: Array<{ plugItemHash?: number }>;
      reusablePlugSetHash?: number;
      randomizedPlugSetHash?: number;
    }>
  ));
  const plugSetHashes = socketEntries.flatMap((entry) => [
    ...numberValue(entry.reusablePlugSetHash),
    ...numberValue(entry.randomizedPlugSetHash)
  ]);
  const plugSets = getDefinitions(current, "DestinyPlugSetDefinition", plugSetHashes);
  const directPlugHashes = socketEntries.flatMap((entry) => [
    ...numberValue(entry.singleInitialItemHash),
    ...(entry.reusablePlugItems ?? []).flatMap((plug) => numberValue(plug.plugItemHash))
  ]);
  const plugSetItemHashes = (Object.values(plugSets) as DefinitionRecord[]).flatMap((plugSet) => (
    ((plugSet.reusablePlugItems as Array<{ plugItemHash?: number }> | undefined) ?? [])
      .flatMap((plug) => numberValue(plug.plugItemHash))
  ));
  const plugItems = getDefinitions(
    current,
    "DestinyInventoryItemDefinition",
    [...directPlugHashes, ...plugSetItemHashes, ...extraPlugHashes]
  );
  return { items: { ...rootItems, ...plugItems }, plugSets };
}

function getDefinitions(
  current: OpenRuntime,
  component: Parameters<DefinitionReader["getMany"]>[0],
  hashes: Iterable<number>
): DefinitionComponentData {
  return current.reader.getMany(component, uniqueHashes([...hashes]));
}

async function loadWeaponIdentityRelations(
  current: OpenRuntime,
  itemHashes: number[]
): Promise<WeaponIdentityRelation[]> {
  if (!itemHashes.length) return [];
  try {
    return await current.catalog.getWeaponIdentityRelations({ item_hashes: uniqueHashes(itemHashes) });
  } catch {
    return [];
  }
}

function mergeWeaponIdentityRelations(
  ...groups: ReadonlyArray<readonly WeaponIdentityRelation[]>
): WeaponIdentityRelation[] {
  const relations = new Map<number, WeaponIdentityRelation>();
  for (const relation of groups.flat()) relations.set(relation.item_hash, relation);
  return [...relations.values()];
}

function dimRulePerkHashes(dataDir: string, itemHashes: number[]): number[] {
  try {
    const wanted = new Set(itemHashes);
    return [...new Set((loadDimWishlist(dataDir)?.rules ?? [])
      .filter((rule) => wanted.has(rule.item_hash))
      .flatMap((rule) => rule.perk_hashes))];
  } catch {
    return [];
  }
}

function numberValue(value: unknown): number[] {
  return typeof value === "number" && Number.isFinite(value) ? [value] : [];
}

function uniqueHashes(values: number[]): number[] {
  return [...new Set(values.filter((value) => (
    Number.isInteger(value) && value >= 0 && value <= 4_294_967_295
  )))];
}
