import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { dialog, ipcMain } from "electron";
import type { DefinitionComponentData, DefinitionRecord } from "@d2-tools/core/manifest/definitions";
import {
  type LocalCommunityRecommendationTable,
  type SavePersonalWeaponKnowledgeInput,
  type SourceOptions,
  type VaultCommunityMatchOptions,
  type WeaponIdentityRelation,
  type VaultItemMatchInput
} from "@d2-tools/core/community-perks";
import { loadConfig } from "@d2-tools/services/config/store";
import {
  clearLocalCommunityRecommendations,
  loadLocalCommunityRecommendations,
  saveLocalCommunityRecommendations
} from "@d2-tools/services/community/localCommunityRecommendations";
import { createDefaultCommunityPerkService } from "@d2-tools/services/community/perkRecommendation";
import {
  collectWeaponRecommendationCandidateItemHashes,
  collectWeaponRecommendationItemHashes,
  collectWeaponRecommendationNamesWithoutItemIds,
  collectWeaponRecommendationPlugHashes,
  collectWeaponRecommendationPlugSetHashes,
  collectRelatedWeaponRecommendationItemHashes,
  createWeaponRecommendationCsvTemplate,
  exportWeaponRecommendationPlayerCsv,
  importWeaponRecommendationCsv,
  invalidateWeaponRecommendationKnowledgeCache,
  previewWeaponRecommendationCsv,
  readWeaponRecommendationKnowledgeStatus,
  type WeaponKnowledgeImportPreview,
  type WeaponKnowledgeValidationContext
} from "@d2-tools/services/community/weaponRecommendationKnowledge";
import {
  clearCuratedRecommendationDataset,
  listRecommendationManagedRules,
  readRecommendationManagementSnapshot,
  recommendationSourceItemHashes,
  updateRecommendationManagedRule,
  updateRecommendationManagedSource,
  type RecommendationManagedRule,
  type RecommendationManagementSnapshot
} from "@d2-tools/services/community/recommendationManagement";
import {
  advanceVaultRecommendationMatchCacheRevision,
  buildVaultRecommendationMatchRevision
} from "@d2-tools/services/community/vaultRecommendationMatchCache";
import {
  deletePersonalWeaponKnowledge,
  loadPersonalWeaponKnowledge,
  savePersonalWeaponKnowledge,
  setPersonalWeaponKnowledgeEnabled
} from "@d2-tools/services/community/personalWeaponKnowledge";
import { startBackgroundTask } from "../backgroundTasks.js";
import { getDefinitions, getGameDataCatalog } from "../runtime/gameDataRuntime.js";
import { loadDimWishlist } from "@d2-tools/services/analysis/wishlistStore";
import { loadManifestVersionCheckCache } from "@d2-tools/services/manifest/cache";
import { loadOAuthToken } from "@d2-tools/services/oauth/tokenStore";
import { classifyCommunityIpcError, encodeDesktopIpcFailure } from "../../contracts/errors.js";
import { getDesktopManifestStatus } from "./manifest.js";
import { getAccountSnapshot } from "../runtime/accountSession.js";
import { removeDimWishlistEquipmentTargets } from "./targets.js";
import { matchVaultRecommendationsInWorker } from "../runtime/recommendationRuntime.js";

const pendingKnowledgeImports = new Map<string, { path: string; fingerprint: string }>();

export function registerCommunityIpcHandlers(): void {
  ipcMain.handle("community:knowledge:template:export", async () => {
    const config = loadConfig();
    const result = await dialog.showSaveDialog({
      title: "导出武器推荐玩家模板",
      defaultPath: join(config.data.data_dir, "武器推荐玩家模板.csv"),
      filters: [{ name: "CSV 文件", extensions: ["csv"] }]
    });
    if (result.canceled || !result.filePath) {
      return { canceled: true, message: "已取消导出玩家模板。" };
    }
    await writeFile(result.filePath, createWeaponRecommendationCsvTemplate(), "utf8");
    return {
      canceled: false,
      file_path: result.filePath,
      message: "普通玩家模板已导出。只需填写武器、来源、用途和推荐 Perk；武器 ID 可留空，官方身份、图标和来源信息由应用读取资料库补齐。"
    };
  });

  ipcMain.handle("community:knowledge:player:export", async () => {
    const config = loadConfig();
    const result = await dialog.showSaveDialog({
      title: "导出可编辑武器推荐",
      defaultPath: join(config.data.data_dir, "武器推荐-可编辑.csv"),
      filters: [{ name: "CSV 文件", extensions: ["csv"] }]
    });
    if (result.canceled || !result.filePath) {
      return { canceled: true, message: "已取消导出可编辑武器推荐。" };
    }
    await writeFile(result.filePath, exportWeaponRecommendationPlayerCsv(config.data.data_dir), "utf8");
    return {
      canceled: false,
      file_path: result.filePath,
      message: "可编辑武器推荐已导出。系统字段未包含在文件中，重新导入时会自动补齐。"
    };
  });

  ipcMain.handle("community:knowledge:import:select", async () => {
    const config = loadConfig();
    const result = await dialog.showOpenDialog({
      title: "选择武器推荐知识库 CSV",
      defaultPath: join(config.data.data_dir, "imports"),
      properties: ["openFile"],
      filters: [{ name: "武器推荐知识库 CSV", extensions: ["csv"] }]
    });
    const path = result.filePaths[0];
    if (result.canceled || !path) return null;

    const strictPreview = await previewStrictWeaponKnowledgeCsv(path);
    const preview = strictPreview.preview;
    pendingKnowledgeImports.clear();
    if (preview.importable_recommendation_count === 0) return preview;
    const token = randomUUID();
    pendingKnowledgeImports.set(token, { path, fingerprint: preview.fingerprint });
    return { ...preview, token };
  });

  ipcMain.handle("community:knowledge:import:confirm", async (_event, token: string) => {
    const pending = pendingKnowledgeImports.get(token);
    if (!pending) throw new Error("武器推荐 CSV 预览已失效，请重新选择文件。");
    pendingKnowledgeImports.delete(token);
    const verified = await previewStrictWeaponKnowledgeCsv(pending.path);
    const verifiedPreview = verified.preview;
    if (verifiedPreview.fingerprint !== pending.fingerprint) {
      throw new Error("武器推荐 CSV 在预览后发生了变化，请重新选择文件。");
    }
    if (verifiedPreview.importable_recommendation_count === 0) {
      throw new Error(formatKnowledgeImportIssue(verifiedPreview));
    }
    const config = loadConfig();
    const result = await importWeaponRecommendationCsv(
      config.data.data_dir,
      pending.path,
      pending.fingerprint,
      verified.validation
    );
    return result;
  });

  ipcMain.handle("community:knowledge:status:get", () => {
    const config = loadConfig();
    return readWeaponRecommendationKnowledgeStatus(config.data.data_dir);
  });

  ipcMain.handle("community:management:get", async () => {
    const config = loadConfig();
    return enrichRecommendationManagement(
      config.data.data_dir,
      readRecommendationManagementSnapshot(config.data.data_dir)
    );
  });

  ipcMain.handle("community:management:rules", async (_event, sourceKey: string, query?: string) => {
    const config = loadConfig();
    return hydrateRecommendationManagedRules(
      listRecommendationManagedRules(config.data.data_dir, sourceKey, query)
    );
  });

  ipcMain.handle("community:management:source:set", async (_event, sourceKey: string, state: "active" | "disabled" | "removed") => {
    const config = loadConfig();
    const affectedWeaponHashes = recommendationSourceItemHashes(config.data.data_dir, sourceKey);
    const snapshot = updateRecommendationManagedSource(config.data.data_dir, sourceKey, state);
    if (sourceKey === "dim_wishlist" && state === "removed") {
      await removeDimWishlistEquipmentTargets(config.data.data_dir).catch(() => undefined);
    }
    invalidateWeaponRecommendationKnowledgeCache(config.data.data_dir);
    advanceRecommendationMatchCacheRevision(config.data.data_dir, affectedWeaponHashes);
    return enrichRecommendationManagement(config.data.data_dir, {
      ...snapshot,
      affected_weapon_hashes: affectedWeaponHashes
    });
  });

  ipcMain.handle("community:management:rule:set", async (_event, input: {
    source_key: string;
    rule_stable_id: string;
    state: "active" | "removed";
    reason?: string;
    source_revision?: string;
  }) => {
    const config = loadConfig();
    const affectedWeaponHashes = listRecommendationManagedRules(config.data.data_dir, input.source_key)
      .find((rule) => rule.rule_stable_id === input.rule_stable_id)
      ?.weapon_hashes ?? [];
    const snapshot = updateRecommendationManagedRule(config.data.data_dir, input);
    invalidateWeaponRecommendationKnowledgeCache(config.data.data_dir);
    advanceRecommendationMatchCacheRevision(config.data.data_dir, affectedWeaponHashes);
    return enrichRecommendationManagement(config.data.data_dir, {
      ...snapshot,
      affected_weapon_hashes: affectedWeaponHashes
    });
  });

  ipcMain.handle("community:management:curated:clear", async () => {
    const config = loadConfig();
    const affectedWeaponHashes = uniqueHashes(
      readRecommendationManagementSnapshot(config.data.data_dir).sources
        .filter((source) => source.kind === "curated")
        .flatMap((source) => recommendationSourceItemHashes(config.data.data_dir, source.source_key))
    );
    const snapshot = clearCuratedRecommendationDataset(config.data.data_dir);
    invalidateWeaponRecommendationKnowledgeCache(config.data.data_dir);
    advanceRecommendationMatchCacheRevision(config.data.data_dir, affectedWeaponHashes);
    return enrichRecommendationManagement(config.data.data_dir, {
      ...snapshot,
      affected_weapon_hashes: affectedWeaponHashes
    });
  });

  ipcMain.handle("community:local:get", () => {
    const config = loadConfig();
    return loadLocalCommunityRecommendations(config.data.data_dir);
  });

  ipcMain.handle("community:local:save", (_event, table: LocalCommunityRecommendationTable) => {
    const config = loadConfig();
    return saveLocalCommunityRecommendations(config.data.data_dir, table);
  });

  ipcMain.handle("community:local:clear", () => {
    const config = loadConfig();
    clearLocalCommunityRecommendations(config.data.data_dir);
    return null;
  });

  ipcMain.handle("community:personal:get", (_event, weaponName?: string) => {
    const config = loadConfig();
    return loadPersonalWeaponKnowledge(config.data.data_dir, weaponName);
  });

  ipcMain.handle("community:personal:save", (_event, input: SavePersonalWeaponKnowledgeInput) => {
    const config = loadConfig();
    return savePersonalWeaponKnowledge(config.data.data_dir, input);
  });

  ipcMain.handle("community:personal:set-enabled", (_event, id: string, enabled: boolean) => {
    const config = loadConfig();
    return setPersonalWeaponKnowledgeEnabled(config.data.data_dir, id, enabled);
  });

  ipcMain.handle("community:personal:delete", (_event, id: string) => {
    const config = loadConfig();
    return deletePersonalWeaponKnowledge(config.data.data_dir, id);
  });

  ipcMain.handle("community:recommendations:get", async (_event, item_hash: number, options?: SourceOptions) => {
    const config = loadConfig();
    const service = createDefaultCommunityPerkService(config);
    const itemHash = Number(item_hash);
    const rootItems = await getDefinitions(
      "DestinyInventoryItemDefinition",
      [itemHash],
      { projection: "community-match" }
    );
    const targetWeaponIdentityRelations = await loadWeaponIdentityRelations([itemHash]);
    const queries = [{
      item_hash: itemHash,
      localized_names: [
        options?.item_name?.trim() ?? "",
        rootItems[String(itemHash)]?.displayProperties?.name?.trim() ?? ""
      ].filter(Boolean)
    }];
    const candidateItemHashes = collectWeaponRecommendationCandidateItemHashes(
      config.data.data_dir,
      queries,
      targetWeaponIdentityRelations
    );
    const weaponIdentityRelations = mergeWeaponIdentityRelations(
      targetWeaponIdentityRelations,
      await loadWeaponIdentityRelations(candidateItemHashes)
    );
    const relatedItemHashes = collectRelatedWeaponRecommendationItemHashes(
      config.data.data_dir,
      queries,
      weaponIdentityRelations
    );
    const dimPerkHashes = dimRulePerkHashes(config.data.data_dir, [itemHash]);
    const definitions = await loadCommunityDefinitions(
      uniqueHashes([itemHash, ...relatedItemHashes]),
      dimPerkHashes
    );

    const merged: SourceOptions = {
      manifest_version: getDesktopManifestStatus().version,
      itemDefinitions: { ...definitions.items, ...options?.itemDefinitions },
      plugSetDefinitions: { ...definitions.plugSets, ...options?.plugSetDefinitions },
      englishItemDefinitions: options?.englishItemDefinitions,
      englishPlugSetDefinitions: options?.englishPlugSetDefinitions,
      weaponIdentityRelations,
      item_name: options?.item_name
    };

    return service.getRecommendationsWithAllSources(itemHash, merged);
  });

  ipcMain.handle("community:vault:match", async (
    _event,
    items: VaultItemMatchInput[],
    options?: VaultCommunityMatchOptions
  ) => {
    return encodeDesktopIpcFailure(() => {
      const result = matchVaultCommunityItems(items, options);
      if (options?.include_evidence === false) {
        startBackgroundTask({
          type: "community-analysis",
          title: "分析仓库推荐",
          message: "正在匹配内置推荐知识库、DIM Wishlist 和自定义推荐规则。",
          run: async () => {
            await result;
          }
        });
      }
      return result;
    }, classifyCommunityIpcError);
  });

  ipcMain.handle("community:vault:evidence:get", async (_event, item: VaultItemMatchInput) => {
    return encodeDesktopIpcFailure(async () => {
      const result = await matchVaultCommunityItems([item]);
      return result.matches[0] ?? null;
    }, classifyCommunityIpcError);
  });

}

async function previewStrictWeaponKnowledgeCsv(path: string): Promise<{
  preview: WeaponKnowledgeImportPreview;
  validation: WeaponKnowledgeValidationContext;
}> {
  const manifestVersion = getDesktopManifestStatus().version?.trim() ?? "";
  if (!manifestVersion) throw new Error("资料库尚未准备完成，不能严格校验武器推荐 CSV。");
  const csvText = readFileSync(path, "utf8");
  const itemHashes = collectWeaponRecommendationItemHashes(csvText);
  const namesWithoutItemIds = collectWeaponRecommendationNamesWithoutItemIds(csvText);
  const searchedHashes = namesWithoutItemIds.length === 0
    ? []
    : (await Promise.all(namesWithoutItemIds.map((weaponName) => (
      getGameDataCatalog().searchItems({ query: weaponName, limit: 20 })
    )))).flat().map((item) => item.hash);
  const definitionHashes = [...new Set([...itemHashes, ...searchedHashes])];
  const itemDefinitions = await getDefinitions(
    "DestinyInventoryItemDefinition",
    definitionHashes,
    { projection: "community-match" }
  );
  const plugSetHashes = collectWeaponRecommendationPlugSetHashes(itemDefinitions);
  const plugSetDefinitions = await getDefinitions(
    "DestinyPlugSetDefinition",
    plugSetHashes,
    { projection: "community-match" }
  );
  const plugHashes = collectWeaponRecommendationPlugHashes(itemDefinitions, plugSetDefinitions);
  const plugDefinitions = await getDefinitions(
    "DestinyInventoryItemDefinition",
    plugHashes,
    { projection: "community-match" }
  );
  const semanticDefinitions = {
    item_definitions: itemDefinitions,
    plug_set_definitions: plugSetDefinitions,
    plug_definitions: plugDefinitions
  };
  return {
    preview: previewWeaponRecommendationCsv(csvText, path, semanticDefinitions),
    validation: {
      manifest_version: manifestVersion,
      semantic_definitions: semanticDefinitions
    }
  };
}

function formatKnowledgeImportIssue(preview: WeaponKnowledgeImportPreview): string {
  const issue = preview.blocking_issues[0];
  if (!issue) return "武器推荐 CSV 存在无法通过官方资料校验的内容。";
  return `武器推荐 CSV 没有可导入的有效记录。第 ${issue.row_number} 行“${issue.weapon_name}”的${issue.field}“${issue.value}”：${issue.message}`;
}

async function matchVaultCommunityItems(
  items: VaultItemMatchInput[],
  options: VaultCommunityMatchOptions = {}
) {
  const config = loadConfig();
  const manifestStatus = getDesktopManifestStatus();
  const versionCheck = loadManifestVersionCheckCache(config.data.data_dir);
  if (!manifestStatus.initialized || manifestStatus.missing_required_components?.length) {
    return {
      matches: [],
      issues: [{
        code: "manifest_unavailable",
        severity: "blocking",
        message: "资料库尚未准备完成，暂时不能精确核对武器插槽。"
      }],
      ...(manifestStatus.version ? { manifest_version: manifestStatus.version } : {})
    };
  }
  const manifestOutdated = Boolean(
    versionCheck?.needs_update
    || (versionCheck?.latest_version && versionCheck.latest_version !== manifestStatus.version)
  );
  if (manifestOutdated) {
    return {
      matches: [],
      issues: [{
        code: "manifest_outdated",
        severity: "blocking",
        message: "资料库存在新版本；更新后才能按当前官方插槽精确核对。"
      }],
      ...(manifestStatus.version ? { manifest_version: manifestStatus.version } : {})
    };
  }
  const knowledgeStatus = readWeaponRecommendationKnowledgeStatus(config.data.data_dir);
  const verifiedKnowledgeAvailable = Boolean(
    knowledgeStatus
    && knowledgeStatus.recommendation_count > 0
    && knowledgeStatus.source_fingerprint
    && knowledgeStatus.validation_state === "verified"
    && knowledgeStatus.validated_manifest_version === manifestStatus.version
  );
  // 兼容旧版本已经导入的推荐库：旧库缺少新版校验元数据时，不应让
  // 用户突然只看到 DIM。旧数据仍参与匹配，但明确标记为未复核，
  // 新版严格导入仍会在确认前完成完整语义校验。
  const legacyKnowledgeAvailable = Boolean(
    knowledgeStatus
    && knowledgeStatus.recommendation_count > 0
    && knowledgeStatus.source_fingerprint
    && knowledgeStatus.validation_state === "unverified"
    && !knowledgeStatus.validated_manifest_version
  );
  const issues = verifiedKnowledgeAvailable ? [] : legacyKnowledgeAvailable ? [{
    code: "recommendation_legacy_unverified" as const,
    severity: "warning" as const,
    message: "当前使用旧版中文推荐数据，尚未按本资料库版本完成复核；建议导入最新武器推荐 CSV。"
  }] : [{
    code: "recommendation_unavailable" as const,
    severity: "warning" as const,
    message: "中文推荐知识库当前不可用；仍会继续核对 DIM 和本机自定义推荐。"
  }];
  const result = await matchVaultRecommendationsInWorker({
    data_dir: config.data.data_dir,
    account_key: loadOAuthToken(config.data.data_dir)?.membership_id?.trim() ?? "",
    manifest_version: manifestStatus.version ?? "",
    manifest_language: manifestStatus.language ?? config.data.manifest_language,
    curated_revision: knowledgeStatus?.source_fingerprint ?? "",
    recommendation_schema_version: knowledgeStatus?.schema_version,
    items,
    include_evidence: options.include_evidence !== false
  });
  return { ...result, issues };
}

async function loadCommunityDefinitions(itemHashes: number[], extraPlugHashes: number[] = []): Promise<{
  items: DefinitionComponentData;
  plugSets: DefinitionComponentData;
}> {
  const rootItems = await getDefinitions(
    "DestinyInventoryItemDefinition",
    itemHashes,
    { projection: "community-match" }
  );
  const itemRecords = Object.values(rootItems) as DefinitionRecord[];
  const socketEntries = itemRecords.flatMap((item) =>
    (item.sockets?.socketEntries ?? []) as Array<{
      singleInitialItemHash?: number;
      reusablePlugItems?: Array<{ plugItemHash?: number }>;
      reusablePlugSetHash?: number;
      randomizedPlugSetHash?: number;
    }>
  );
  const plugSetHashes = socketEntries.flatMap((entry) => [
    ...numberValue(entry.reusablePlugSetHash),
    ...numberValue(entry.randomizedPlugSetHash)
  ]);
  const plugSets = await getDefinitions(
    "DestinyPlugSetDefinition",
    plugSetHashes,
    { projection: "community-match" }
  );
  const directPlugHashes = socketEntries.flatMap((entry) => [
    ...numberValue(entry.singleInitialItemHash),
    ...(entry.reusablePlugItems ?? []).flatMap((plug) => numberValue(plug.plugItemHash))
  ]);
  const plugSetItemHashes = (Object.values(plugSets) as DefinitionRecord[]).flatMap((plugSet) =>
    ((plugSet.reusablePlugItems as Array<{ plugItemHash?: number }> | undefined) ?? [])
      .flatMap((plug) => numberValue(plug.plugItemHash))
  );
  const plugItems = await getDefinitions(
    "DestinyInventoryItemDefinition",
    [...directPlugHashes, ...plugSetItemHashes, ...extraPlugHashes],
    { projection: "community-match" }
  );

  return {
    items: { ...rootItems, ...plugItems },
    plugSets
  };
}

async function loadWeaponIdentityRelations(itemHashes: number[]): Promise<WeaponIdentityRelation[]> {
  if (!itemHashes.length) return [];
  try {
    return await getGameDataCatalog().getWeaponIdentityRelations({
      item_hashes: uniqueHashes(itemHashes)
    });
  } catch {
    // 旧索引或关系读取异常时保留精确 Hash 行为，不退回模糊名称合并。
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
  return [...new Set(values.filter((value) => Number.isInteger(value) && value >= 0 && value <= 4_294_967_295))];
}

function advanceRecommendationMatchCacheRevision(dataDir: string, affectedWeaponHashes: readonly number[]): void {
  try {
    const curatedRevision = readWeaponRecommendationKnowledgeStatus(dataDir)?.source_fingerprint ?? "";
    advanceVaultRecommendationMatchCacheRevision(
      dataDir,
      buildVaultRecommendationMatchRevision(dataDir, curatedRevision),
      affectedWeaponHashes
    );
  } catch {
    // 派生缓存失效失败不影响来源操作；下一次核对会按 revision 自动重建。
  }
}

async function enrichRecommendationManagement(
  dataDir: string,
  snapshot: RecommendationManagementSnapshot
): Promise<RecommendationManagementSnapshot> {
  const accountCountByHash = await loadCachedAccountCountByHash();
  return {
    ...snapshot,
    removed_rules: await hydrateRecommendationManagedRules(snapshot.removed_rules, accountCountByHash),
    sources: snapshot.sources.map((source) => {
      let affectedInstanceCount = 0;
      try {
        for (const itemHash of recommendationSourceItemHashes(dataDir, source.source_key)) {
          affectedInstanceCount += accountCountByHash.get(itemHash) ?? 0;
        }
      } catch {
        // 数据源已经移除或暂时不可读时按 0 展示，不阻断其他来源。
      }
      return { ...source, affected_instance_count: affectedInstanceCount };
    })
  };
}

async function hydrateRecommendationManagedRules(
  rules: RecommendationManagedRule[],
  accountCountByHash?: ReadonlyMap<number, number>
): Promise<RecommendationManagedRule[]> {
  const instanceCounts = accountCountByHash ?? await loadCachedAccountCountByHash();
  const hashes = new Set<number>();
  for (const rule of rules) {
    rule.weapon_hashes.forEach((hash) => hashes.add(hash));
    for (const requirement of rule.requirements) {
      for (const name of requirement.names) {
        const hash = exactUnsignedHash(name);
        if (hash !== null) hashes.add(hash);
      }
    }
  }
  if (!hashes.size) {
    return rules.map((rule) => ({ ...rule, affected_instance_count: 0 }));
  }

  let definitions: DefinitionComponentData = {};
  try {
    definitions = await getDefinitions(
      "DestinyInventoryItemDefinition",
      hashes,
      { projection: "community-match" }
    );
  } catch {
    // Definition 读取失败时仍返回规则与影响数量，名称保留原始 Hash 文案。
  }
  const displayName = (hash: number): string => (
    (definitions[String(hash)] as DefinitionRecord | undefined)?.displayProperties?.name?.trim()
    || String(hash)
  );
  return rules.map((rule) => ({
    ...rule,
    affected_instance_count: rule.weapon_hashes.reduce((count, hash) => count + (instanceCounts.get(hash) ?? 0), 0),
    weapon_name: rule.weapon_hashes[0] !== undefined
      ? displayName(rule.weapon_hashes[0])
      : rule.weapon_name,
    requirements: rule.requirements.map((requirement) => ({
      ...requirement,
      names: requirement.names.map((name) => {
        const hash = exactUnsignedHash(name);
        return hash === null ? name : displayName(hash);
      })
    }))
  }));
}

async function loadCachedAccountCountByHash(): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  try {
    const account = await getAccountSnapshot("cached");
    const accountItems = [
      ...account.vault.items,
      ...account.characters.flatMap((character) => [
        ...character.equipped_items,
        ...character.inventory_items,
        ...character.postmaster_items
      ])
    ];
    for (const item of accountItems) {
      counts.set(item.hash, (counts.get(item.hash) ?? 0) + 1);
    }
  } catch {
    // 来源管理仍可离线使用；账号影响数量只是辅助信息。
  }
  return counts;
}

function exactUnsignedHash(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const hash = Number(value);
  return Number.isInteger(hash) && hash >= 0 && hash <= 0xffff_ffff ? hash : null;
}
