import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  summarizeItemPerks,
  type ItemPlugSummary
} from "@d2-tools/core/items/perks";
import {
  classifyWeaponRollSocket,
  type AccountWeaponRollPlugSummary
} from "@d2-tools/core/account/summary";
import type {
  DefinitionComponentData,
  DefinitionRecord
} from "@d2-tools/core/manifest/definitions";
import type {
  CommunityPerkSource,
  PerkRef,
  RecommendationRequirementSlot,
  RecommendationSourceRecord,
  SourceOptions,
  WeaponRecommendation
} from "@d2-tools/core/community-perks";
import {
  openRecommendationDatabase,
  recommendationDatabasePath,
  recommendationDatabaseSchemaVersion,
  recommendationSemanticValidationVersion,
  recommendationMetadataValue
} from "./recommendationDatabase.js";
import { reconcileRecommendationRuleOverrides } from "./recommendationOverrides.js";

const requiredCsvHeaders = [
  "页面", "分类", "武器", "评级", "排名", "来源URL", "页面更新时间", "来源位置",
  "图标", "图标图标URL", "属性", "框架", "赛季", "来源", "勇士", "勇士图标URL",
  "弹药生成", "枪管", "弹匣", "大师", "Perk 1", "Perk 2", "起源特性", "注解",
  "护盾", "充能效率", "武器ID", "英文名称", "版本", "推荐来源", "用途"
] as const;
const playerCsvHeaders = [
  "武器", "武器ID", "英文名称", "推荐来源", "用途", "第一列", "第二列",
  "Perk 1", "Perk 2", "大师", "起源特性", "评级", "备注"
] as const;
const stableSourceKeys: Record<string, string> = {
  Aegis推荐: "aegis",
  LGpig推荐: "lgpig",
  YXCRALLXY推荐表: "yxcrallxy",
  Sayalarry推荐表: "sayalarry",
  DIM社区愿望单: "dim_voltron"
};
const stableSourceUrls: Record<string, string> = {
  Aegis推荐: "https://docs.google.com/spreadsheets/d/1JM-0SlxVDAi-C6rGVlLxa-J1WGewEeL8Qvq4htWZHhY/edit?gid=346832350#gid=346832350",
  LGpig推荐: "https://destiny2-starside-dea-mods-d1g0j2rile2323f73.webapps.tcloudbase.com/pve-farming/index.html",
  YXCRALLXY推荐表: "https://docs.qq.com/sheet/DYkR5enNIdUt1VFhK?tab=000001&_t=1788087335795&nlc=1",
  Sayalarry推荐表: "https://sa7vp10ytxr.feishu.cn/wiki/W3ySwdahTiNRUJklJNBc0CMPnkb",
  DIM社区愿望单: "https://github.com/48klocs/dim-wish-list-sources"
};
const curatedSourceKeys = [...new Set(
  Object.values(stableSourceKeys).filter((sourceKey) => sourceKey !== "dim_voltron")
)];

export type WeaponRecommendationKnowledgeStatus = {
  schema_version: number;
  semantic_validation_version: number;
  validated_manifest_version: string;
  validation_state: "verified" | "unverified";
  dataset_revision: string;
  database_path: string;
  source_fingerprint: string;
  imported_at: string;
  recommendation_count: number;
  weapon_count: number;
  source_count: number;
  skipped_row_count: number;
};

export type WeaponKnowledgeImportPreview = {
  file_name: string;
  import_mode: "merge" | "replace";
  recommendation_count: number;
  importable_recommendation_count: number;
  weapon_count: number;
  source_count: number;
  source_labels: string[];
  fingerprint: string;
  blocking_issue_count: number;
  skipped_row_count: number;
  blocking_issues: WeaponKnowledgeImportIssue[];
};

export type WeaponKnowledgeImportIssue = {
  row_number: number;
  weapon_name: string;
  source_label: string;
  field: "推荐来源" | "武器ID" | "武器" | "枪管" | "弹匣" | "大师" | "Perk 1" | "Perk 2" | "起源特性";
  value: string;
  message: string;
};

export type WeaponKnowledgeSemanticDefinitions = {
  item_definitions: DefinitionComponentData;
  plug_set_definitions: DefinitionComponentData;
  plug_definitions: DefinitionComponentData;
};

export type WeaponKnowledgeValidationContext = {
  manifest_version: string;
  semantic_definitions: WeaponKnowledgeSemanticDefinitions;
};

export type WeaponKnowledgeImportResult = WeaponRecommendationKnowledgeStatus & {
  file_name: string;
  imported_row_count: number;
  import_mode: "merge" | "replace";
};

type KnowledgeRecommendation = {
  id: number;
  rule_stable_id: string;
  identity_key: string;
  weapon_name: string;
  normalized_weapon_name: string;
  english_name: string;
  normalized_english_name: string;
  source_id: string;
  source_label: string;
  source_url: string;
  source_default_url: string;
  purpose: Array<"pve" | "pvp" | "general">;
  rating: string;
  ranking: string;
  note: string;
  page_updated_at: string;
  version: string;
  source_location: string;
  item_hashes: number[];
  requirements: Record<RecommendationRequirementSlot, string[]>;
};

type KnowledgeCache = {
  byName: Map<string, KnowledgeRecommendation[]>;
  byItemHash: Map<number, KnowledgeRecommendation[]>;
  validatedManifestVersion: string;
  legacyUnverified: boolean;
};

const knowledgeCaches = new Map<string, KnowledgeCache | null>();

export function invalidateWeaponRecommendationKnowledgeCache(dataDir: string): void {
  knowledgeCaches.delete(recommendationDatabasePath(dataDir));
}

/** Returns the player-editable column contract for manually maintained knowledge CSV files. */
export function createWeaponRecommendationCsvTemplate(): string {
  return `\uFEFF${playerCsvHeaders.join(",")}\r\n`;
}

/** Returns the publisher/maintainer-only complete evidence template. */
export function createWeaponRecommendationFullCsvTemplate(): string {
  return `\uFEFF${requiredCsvHeaders.join(",")}\r\n`;
}

/** Exports the current curated knowledge as a player-editable CSV. */
export function exportWeaponRecommendationPlayerCsv(dataDir: string): string {
  const database = openRecommendationDatabase(dataDir);
  try {
    const rows = database.prepare(`
      SELECT r.id, r.weapon_name, r.english_name, r.rating, r.note,
             s.label AS source_label
      FROM weapon_recommendations r
      JOIN recommendation_sources s ON s.id = r.source_id
      WHERE s.source_key != 'dim_voltron'
      ORDER BY s.source_key, r.weapon_name, r.id
    `).all() as Array<{
      id: number;
      weapon_name: string;
      english_name: string;
      rating: string;
      note: string;
      source_label: string;
    }>;
    if (!rows.length) return `\uFEFF${playerCsvHeaders.join(",")}\r\n`;
    const ids = database.prepare(`
      SELECT recommendation_id, item_hash
      FROM weapon_recommendation_item_ids
      ORDER BY recommendation_id, item_hash
    `).all() as Array<{ recommendation_id: number; item_hash: number }>;
    const purposes = database.prepare(`
      SELECT recommendation_id, purpose
      FROM weapon_recommendation_purposes
      ORDER BY recommendation_id, purpose
    `).all() as Array<{ recommendation_id: number; purpose: string }>;
    const perks = database.prepare(`
      SELECT recommendation_id, slot, ordinal, perk_name
      FROM weapon_recommendation_perks
      ORDER BY recommendation_id, slot, ordinal
    `).all() as Array<{ recommendation_id: number; slot: RecommendationRequirementSlot; ordinal: number; perk_name: string }>;
    const idsByRecommendation = groupExportValues(ids, "item_hash");
    const purposesByRecommendation = groupExportValues(purposes, "purpose");
    const perksByRecommendation = new Map<number, Partial<Record<RecommendationRequirementSlot, string[]>>>();
    for (const perk of perks) {
      const bySlot = perksByRecommendation.get(perk.recommendation_id) ?? {};
      bySlot[perk.slot] = [...(bySlot[perk.slot] ?? []), perk.perk_name];
      perksByRecommendation.set(perk.recommendation_id, bySlot);
    }
    const output = [playerCsvHeaders.join(",")];
    for (const row of rows) {
      const rowPerks = perksByRecommendation.get(row.id) ?? {};
      output.push([
        row.weapon_name,
        (idsByRecommendation.get(row.id) ?? []).join(" / "),
        row.english_name,
        row.source_label,
        (purposesByRecommendation.get(row.id) ?? []).join(" / "),
        (rowPerks.barrel ?? []).join(" / "),
        (rowPerks.magazine ?? []).join(" / "),
        (rowPerks.perk1 ?? []).join(" / "),
        (rowPerks.perk2 ?? []).join(" / "),
        (rowPerks.masterwork ?? []).join(" / "),
        (rowPerks.origin ?? []).join(" / "),
        row.rating,
        row.note
      ].map(csvEscape).join(","));
    }
    return `\uFEFF${output.join("\r\n")}\r\n`;
  } finally {
    database.close();
  }
}

/** Validates a CSV without changing the active SQLite knowledge database. */
export function previewWeaponRecommendationCsv(
  text: string,
  fileName: string,
  semanticDefinitions?: WeaponKnowledgeSemanticDefinitions
): WeaponKnowledgeImportPreview {
  const rows = prepareWeaponRecommendationRows(
    curatedKnowledgeRows(parseKnowledgeCsv(text)),
    semanticDefinitions
  );
  const blockingIssues = semanticDefinitions
    ? validateWeaponRecommendationRows(rows, semanticDefinitions)
    : [];
  const skippedRows = new Set(blockingIssues.map((issue) => issue.row_number));
  const importableRows = rows.filter((row) => !skippedRows.has(csvRowNumber(row)));
  const importMode = rows[0]?.__format === "player" || skippedRows.size > 0 ? "merge" : "replace";
  const sourceLabels = [...new Set(importableRows.map((row) => row["推荐来源"].trim()))].sort((left, right) => (
    left.localeCompare(right, "zh-CN")
  ));
  return {
    file_name: basename(fileName) || "weapon-recommendations.csv",
    import_mode: importMode,
    recommendation_count: rows.length,
    importable_recommendation_count: importableRows.length,
    weapon_count: new Set(importableRows.map(weaponIdentityKey)).size,
    source_count: sourceLabels.length,
    source_labels: sourceLabels,
    fingerprint: csvFingerprint(text),
    blocking_issue_count: blockingIssues.length,
    skipped_row_count: skippedRows.size,
    blocking_issues: blockingIssues.slice(0, 50)
  };
}

export function collectWeaponRecommendationItemHashes(text: string): number[] {
  return [...new Set(curatedKnowledgeRows(parseKnowledgeCsv(text)).flatMap((row) => (
    splitValues(row["武器ID"] ?? "").map(Number).filter(isUnsignedHash)
  )))];
}

export function collectWeaponRecommendationWeaponNames(text: string): string[] {
  return [...new Set(curatedKnowledgeRows(parseKnowledgeCsv(text))
    .map((row) => row["武器"]?.trim() ?? "")
    .filter(Boolean))];
}

export function collectWeaponRecommendationNamesWithoutItemIds(text: string): string[] {
  return [...new Set(curatedKnowledgeRows(parseKnowledgeCsv(text))
    .filter((row) => !splitValues(row["武器ID"] ?? "").some((value) => isUnsignedHash(Number(value))))
    .map((row) => row["武器"]?.trim() ?? "")
    .filter(Boolean))];
}

export function collectWeaponRecommendationPlugSetHashes(
  itemDefinitions: DefinitionComponentData
): number[] {
  return uniqueHashes(Object.values(itemDefinitions).flatMap((definition) => (
    (definition.sockets?.socketEntries ?? []).flatMap((entry) => [
      entry.reusablePlugSetHash,
      entry.randomizedPlugSetHash
    ])
  )));
}

export function collectWeaponRecommendationPlugHashes(
  itemDefinitions: DefinitionComponentData,
  plugSetDefinitions: DefinitionComponentData
): number[] {
  return uniqueHashes([
    ...Object.values(itemDefinitions).flatMap((definition) => (
      (definition.sockets?.socketEntries ?? []).flatMap((entry) => [
        entry.singleInitialItemHash,
        ...(entry.reusablePlugItems ?? []).map((plug) => plug.plugItemHash)
      ])
    )),
    ...Object.values(plugSetDefinitions).flatMap((definition) => (
      (definition.reusablePlugItems ?? []).map((plug) => plug.plugItemHash)
    ))
  ]);
}

/**
 * Imports a previously previewed CSV and keeps a managed copy for later application starts.
 * A clean maintainer-only full package replaces the curated dataset. Player CSV files and
 * files with invalid rows merge only valid rows and leave unrelated existing records untouched.
 * Both the managed file and SQLite update are rolled back when the import fails.
 */
export async function importWeaponRecommendationCsv(
  dataDir: string,
  csvPath: string,
  expectedFingerprint: string,
  validation: WeaponKnowledgeValidationContext,
  now = new Date()
): Promise<WeaponKnowledgeImportResult> {
  const csvText = readFileSync(csvPath, "utf8");
  const preview = previewWeaponRecommendationCsv(csvText, csvPath, validation.semantic_definitions);
  if (preview.fingerprint !== expectedFingerprint) {
    throw new Error("武器推荐 CSV 在预览后发生了变化，请重新选择文件。");
  }
  if (preview.importable_recommendation_count === 0) {
    throw new Error("武器推荐 CSV 中没有可导入的有效记录，当前数据未更改。");
  }

  const managedPath = join(dataDir, "imports", "weapon-recommendations.csv");
  const staged = await stageManagedCsv(managedPath, csvText);
  try {
    const status = await syncWeaponRecommendationKnowledge(dataDir, managedPath, validation, now);
    if (!status) throw new Error("武器推荐 CSV 导入失败。");
    await staged.commit();
    return {
      ...status,
      file_name: preview.file_name,
      imported_row_count: preview.importable_recommendation_count,
      import_mode: preview.import_mode,
      skipped_row_count: preview.skipped_row_count
    };
  } catch (error) {
    await staged.rollback();
    throw error;
  }
}

export function readWeaponRecommendationKnowledgeStatus(
  dataDir: string
): WeaponRecommendationKnowledgeStatus | null {
  const path = recommendationDatabasePath(dataDir);
  if (!existsSync(path)) return null;
  let database: DatabaseSync | undefined;
  try {
    database = new DatabaseSync(path, { readOnly: true, timeout: 5_000 });
    return knowledgeStatus(database, path);
  } catch {
    return null;
  } finally {
    database?.close();
  }
}

/**
 * Imports the reviewed CSV into the durable application knowledge database.
 * Re-imports are skipped when the source fingerprint and schema version match.
 */
export async function syncWeaponRecommendationKnowledge(
  dataDir: string,
  csvPath: string,
  validation: WeaponKnowledgeValidationContext,
  now = new Date()
): Promise<WeaponRecommendationKnowledgeStatus | null> {
  if (!existsSync(csvPath)) return null;
  if (!Number.isFinite(now.getTime())) {
    throw new Error("武器推荐知识库导入时间无效。");
  }

  const csvText = readFileSync(csvPath, "utf8");
  const sourceFingerprint = csvFingerprint(csvText);
  const rows = prepareWeaponRecommendationRows(
    curatedKnowledgeRows(parseKnowledgeCsv(csvText)),
    validation.semantic_definitions
  );
  const manifestVersion = validation.manifest_version.trim();
  if (!manifestVersion) throw new Error("严格校验缺少资料库版本，当前推荐数据未更改。");
  const blockingIssues = validateWeaponRecommendationRows(rows, validation.semantic_definitions);
  const skippedRows = new Set(blockingIssues.map((issue) => issue.row_number));
  const validRows = rows.filter((row) => !skippedRows.has(csvRowNumber(row)));
  if (validRows.length === 0) {
    throw new Error("武器推荐 CSV 中没有可导入的有效记录，当前数据未更改。");
  }
  const partialImport = rows[0]?.__format === "player" || skippedRows.size > 0;
  const database = openRecommendationDatabase(dataDir);
  try {
    const currentFingerprint = recommendationMetadataValue(database, "source_fingerprint");
    const currentSchemaVersion = recommendationMetadataValue(database, "schema_version");
    const currentSemanticVersion = recommendationMetadataValue(database, "semantic_validation_version");
    const currentManifestVersion = recommendationMetadataValue(database, "validated_manifest_version");
    const currentPartialImport = recommendationMetadataValue(database, "partial_import");
    const currentCounts = database.prepare(`
      SELECT
        (SELECT COUNT(*) FROM weapon_recommendations) AS recommendation_count,
        (SELECT COUNT(*) FROM recommendation_sources) AS source_count
    `).get() as { recommendation_count: number; source_count: number };
    const expectedSourceCount = new Set(validRows.map((row) => stableSourceKeys[row["推荐来源"]?.trim() ?? ""] ?? normalizeName(row["推荐来源"] ?? ""))).size;
    if (
      currentFingerprint === sourceFingerprint
      && currentSchemaVersion === String(recommendationDatabaseSchemaVersion)
      && currentSemanticVersion === String(recommendationSemanticValidationVersion)
      && currentManifestVersion === manifestVersion
      && currentPartialImport === (partialImport ? "1" : "0")
      && (partialImport || (
        Number(currentCounts.recommendation_count) === validRows.length
        && Number(currentCounts.source_count) === expectedSourceCount
      ))
    ) {
      return knowledgeStatus(database, recommendationDatabasePath(dataDir));
    }

    replaceKnowledge(
      database,
      validRows,
      sourceFingerprint,
      manifestVersion,
      now.toISOString(),
      partialImport,
      skippedRows.size
    );
    invalidateWeaponRecommendationKnowledgeCache(dataDir);
    return knowledgeStatus(database, recommendationDatabasePath(dataDir));
  } finally {
    database.close();
  }
}

/** Creates the built-in name-level recommendation source backed by SQLite. */
export function createWeaponRecommendationKnowledgeSource(dataDir: string): CommunityPerkSource {
  let cache: KnowledgeCache | null | undefined;
  const loadCache = (): KnowledgeCache | null => {
    if (cache !== undefined) return cache;
    const path = recommendationDatabasePath(dataDir);
    if (knowledgeCaches.has(path)) {
      cache = knowledgeCaches.get(path) ?? null;
      return cache;
    }
    cache = loadKnowledgeCache(dataDir);
    knowledgeCaches.set(path, cache);
    return cache;
  };

  return {
    name: "内置武器推荐知识库",
    isAvailable: () => loadCache() !== null,
    async getRecommendations(item_hash: number, options: SourceOptions): Promise<WeaponRecommendation | null> {
      const knowledge = loadCache();
      if (!knowledge) return null;
      if (
        !options.manifest_version
        || (!knowledge.legacyUnverified && options.manifest_version !== knowledge.validatedManifestVersion)
      ) return null;

      const itemDefinition = options.itemDefinitions?.[String(item_hash)];
      const localizedNames = [
        options.item_name,
        itemDefinition?.displayProperties?.name
      ].filter((value): value is string => Boolean(value?.trim()));
      const englishName = options.englishItemDefinitions?.[String(item_hash)]?.displayProperties?.name;
      const matching = selectKnowledgeRecommendations(
        knowledge,
        item_hash,
        localizedNames,
        englishName
      );
      if (matching.length === 0) return null;

      const perkMap = buildWeaponPerkMap([
        item_hash,
        ...matching.flatMap((recommendation) => recommendation.item_hashes)
      ], options);
      const weaponLevelRecommendations: NonNullable<WeaponRecommendation["weapon_level_recommendations"]> = [];
      // DIM Voltron 必须由原生 Wishlist 解析器保留一行一个完整组合。
      // 四个人工来源 CSV 保存的是逐栏候选池，也不能把不同栏位做笛卡尔积拼成 Roll。
      const matchableRecommendations = matching.filter((recommendation) => recommendation.source_id !== "dim_voltron");
      const sourceRecords = matchableRecommendations.map((recommendation) => buildSourceRecord(recommendation, perkMap));
      const resolvedSourceLabels = new Set(matchableRecommendations.map((recommendation) => recommendation.source_label));
      for (const recommendation of matchableRecommendations) {
        const perk1Names = recommendation.requirements.perk1;
        const perk2Names = recommendation.requirements.perk2;
        if (perk1Names.length > 0 || perk2Names.length > 0) continue;
        for (const mode of recommendation.purpose) {
          weaponLevelRecommendations.push({
            source: "local_community",
            mode,
            source_label: recommendation.source_label,
            note: recommendationNote(recommendation)
          });
        }
      }
      if (weaponLevelRecommendations.length === 0 && sourceRecords.length === 0) return null;

      const modes = [
        ...weaponLevelRecommendations.map((entry) => entry.mode),
        ...sourceRecords.flatMap((record) => record.purposes)
      ];

      return {
        item_hash,
        item_name: itemDefinition?.displayProperties?.name ?? options.item_name ?? matching[0].weapon_name,
        combos: [],
        matched_modes: [...new Set(modes)],
        individual_perks: uniqueSourceRecordPerks(sourceRecords),
        ...(weaponLevelRecommendations.length ? { weapon_level_recommendations: weaponLevelRecommendations } : {}),
        source_records: sourceRecords,
        sample_size: matchableRecommendations.length,
        source_label: [...resolvedSourceLabels].join(" / "),
        disclaimer: "来自应用内置的本地武器推荐知识库，推荐按官方武器身份汇总，并保留来源原始的逐栏候选池。"
      };
    }
  };
}

function selectKnowledgeRecommendations(
  knowledge: KnowledgeCache,
  itemHash: number,
  localizedNames: string[],
  englishName?: string
): KnowledgeRecommendation[] {
  const exactMatches = knowledge.byItemHash.get(itemHash) ?? [];
  const englishKey = normalizeName(englishName ?? "");
  const localizedKeys = [...new Set(localizedNames.map(normalizeName).filter(Boolean))];
  const candidates = uniqueById([
    ...exactMatches,
    ...(englishKey ? knowledge.byName.get(englishKey) ?? [] : []),
    ...localizedKeys.flatMap((name) => knowledge.byName.get(name) ?? [])
  ]);
  const bySource = new Map<string, KnowledgeRecommendation[]>();
  for (const candidate of candidates) {
    const bucket = bySource.get(candidate.source_id) ?? [];
    bucket.push(candidate);
    bySource.set(candidate.source_id, bucket);
  }

  const selected: KnowledgeRecommendation[] = [];
  for (const sourceCandidates of bySource.values()) {
    const sourceExactMatches = sourceCandidates.filter((candidate) => candidate.item_hashes.includes(itemHash));
    if (sourceExactMatches.length) {
      selected.push(...sourceExactMatches);
      continue;
    }
    if (englishKey) {
      const sourceEnglishMatches = sourceCandidates.filter((candidate) => (
        candidate.normalized_english_name === englishKey
      ));
      if (sourceEnglishMatches.length) {
        selected.push(...sourceEnglishMatches);
        continue;
      }
    }
    // Hash 只用于优先确认身份。旧版、复刻版或高阶版拥有不同 Hash 时，
    // 只要当前来源中的官方中文名称唯一，仍共享同一条武器推荐。
    if (sourceCandidates.length === 1) {
      selected.push(sourceCandidates[0]);
    }
  }
  return uniqueById(selected);
}

export function collectRelatedWeaponRecommendationItemHashes(
  dataDir: string,
  queries: ReadonlyArray<{
    item_hash: number;
    localized_names?: string[];
    english_name?: string;
  }>
): number[] {
  const knowledge = loadKnowledgeCache(dataDir);
  if (!knowledge) return [];
  return uniqueHashes(queries.flatMap((query) => (
    selectKnowledgeRecommendations(
      knowledge,
      query.item_hash,
      query.localized_names ?? [],
      query.english_name
    ).flatMap((recommendation) => recommendation.item_hashes)
  )));
}

function replaceKnowledge(
  database: DatabaseSync,
  rows: Array<Record<string, string>>,
  sourceFingerprint: string,
  validatedManifestVersion: string,
  importedAt: string,
  partialImport: boolean,
  skippedRowCount: number
): void {
  const insertSource = database.prepare(`
    INSERT INTO recommendation_sources (source_key, label, source_url)
    VALUES (?, ?, ?)
    ON CONFLICT(source_key) DO UPDATE SET label = excluded.label, source_url = excluded.source_url
  `);
  const selectSource = database.prepare("SELECT id FROM recommendation_sources WHERE source_key = ?");
  const insertRecommendation = database.prepare(`
    INSERT INTO weapon_recommendations (
      rule_stable_id, identity_key, normalized_weapon_name, weapon_name, normalized_english_name, english_name, source_id,
      page, rating, ranking, category, source_url, page_updated_at, version, source_location,
      icon, icon_url, stats, frame, season, acquisition_source, champion, champion_icon_url,
      ammo_generation, note, shield, charge_efficiency
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?
    )
  `);
  const updateRecommendation = database.prepare(`
    UPDATE weapon_recommendations SET
      rule_stable_id = ?, identity_key = ?, normalized_weapon_name = ?, weapon_name = ?,
      normalized_english_name = ?, english_name = ?, source_url = ?, page = ?, rating = ?, ranking = ?,
      category = ?, page_updated_at = ?, version = ?, source_location = ?, icon = ?, icon_url = ?, stats = ?,
      frame = ?, season = ?, acquisition_source = ?, champion = ?, champion_icon_url = ?, ammo_generation = ?,
      note = ?, shield = ?, charge_efficiency = ?
    WHERE id = ?
  `);
  const selectExistingRecommendation = database.prepare(`
    SELECT r.id
    FROM weapon_recommendations r
    WHERE r.source_id = ? AND (r.rule_stable_id = ? OR r.identity_key = ?)
    ORDER BY CASE WHEN r.rule_stable_id = ? THEN 0 ELSE 1 END, r.id
    LIMIT 1
  `);
  const insertItemId = database.prepare(`
    INSERT OR IGNORE INTO weapon_recommendation_item_ids (recommendation_id, item_hash) VALUES (?, ?)
  `);
  const insertPurpose = database.prepare(`
    INSERT OR IGNORE INTO weapon_recommendation_purposes (recommendation_id, purpose) VALUES (?, ?)
  `);
  const insertPerk = database.prepare(`
    INSERT OR IGNORE INTO weapon_recommendation_perks (
      recommendation_id, slot, ordinal, perk_name, normalized_perk_name
    ) VALUES (?, ?, ?, ?, ?)
  `);
  const writeMetadata = database.prepare(`
    INSERT INTO knowledge_metadata (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  database.exec("BEGIN IMMEDIATE;");
  try {
    if (!partialImport) {
      database.exec(`
        DELETE FROM weapon_recommendation_perks;
        DELETE FROM weapon_recommendation_purposes;
        DELETE FROM weapon_recommendation_item_ids;
        DELETE FROM weapon_recommendations;
        DELETE FROM recommendation_sources;
      `);
    }
    database.exec(`
      DELETE FROM knowledge_metadata
      WHERE key IN (
        'schema_version', 'source_fingerprint', 'imported_at',
        'semantic_validation_version', 'validated_manifest_version', 'dataset_revision',
        'partial_import', 'skipped_row_count'
      );
    `);

    const ruleIdsBySource = new Map<string, Set<string>>();

    for (const row of rows) {
      const weaponName = row["武器"]?.trim();
      const sourceLabel = row["推荐来源"]?.trim();
      if (!weaponName || !sourceLabel) continue;

      const sourceKey = stableSourceKeys[sourceLabel] ?? normalizeName(sourceLabel);
      if (sourceKey === "dim_voltron") continue;
      insertSource.run(
        sourceKey,
        sourceLabel,
        stableSourceUrls[sourceLabel] ?? row["来源URL"]?.trim() ?? ""
      );
      const source = selectSource.get(sourceKey) as { id: number } | undefined;
      if (!source) continue;

      const ruleStableId = curatedRuleStableId(sourceKey, row);
      const identityKey = weaponIdentityKey(row);
      const recommendationValues = [
        ruleStableId,
        identityKey,
        normalizeName(weaponName),
        weaponName,
        normalizeName(row["英文名称"] ?? ""),
        row["英文名称"]?.trim() ?? "",
        source.id,
        row["页面"]?.trim() ?? "",
        row["评级"]?.trim() ?? "",
        row["排名"]?.trim() ?? "",
        row["分类"]?.trim() ?? "",
        row["来源URL"]?.trim() ?? "",
        row["页面更新时间"]?.trim() ?? "",
        row["版本"]?.trim() ?? "",
        row["来源位置"]?.trim() ?? "",
        row["图标"]?.trim() ?? "",
        row["图标图标URL"]?.trim() ?? "",
        row["属性"]?.trim() ?? "",
        row["框架"]?.trim() ?? "",
        row["赛季"]?.trim() ?? "",
        row["来源"]?.trim() ?? "",
        row["勇士"]?.trim() ?? "",
        row["勇士图标URL"]?.trim() ?? "",
        row["弹药生成"]?.trim() ?? "",
        row["注解"]?.trim() ?? "",
        row["护盾"]?.trim() ?? "",
        row["充能效率"]?.trim() ?? ""
      ];
      const existing = partialImport
        ? selectExistingRecommendation.get(source.id, ruleStableId, identityKey, ruleStableId) as { id: number } | undefined
        : undefined;
      const updateValues = [
        ...recommendationValues.slice(0, 6),
        recommendationValues[11],
        ...recommendationValues.slice(7, 11),
        ...recommendationValues.slice(12)
      ];
      const recommendationId = existing
        ? (updateRecommendation.run(
            ...updateValues,
            existing.id
          ), Number(existing.id))
        : Number(insertRecommendation.run(...recommendationValues).lastInsertRowid);
      database.prepare("DELETE FROM weapon_recommendation_perks WHERE recommendation_id = ?").run(recommendationId);
      database.prepare("DELETE FROM weapon_recommendation_purposes WHERE recommendation_id = ?").run(recommendationId);
      database.prepare("DELETE FROM weapon_recommendation_item_ids WHERE recommendation_id = ?").run(recommendationId);
      const sourceRuleIds = ruleIdsBySource.get(sourceKey) ?? new Set<string>();
      sourceRuleIds.add(ruleStableId);
      ruleIdsBySource.set(sourceKey, sourceRuleIds);

      const itemHashValues = splitValues(row["武器ID"] ?? "");
      const itemHashes = itemHashValues.map(Number);
      if (itemHashes.some((value) => !Number.isInteger(value) || value < 0 || value > 0xffff_ffff)) {
        throw new Error(`武器推荐 CSV 的武器 ID 无效：${weaponName} / ${sourceLabel}`);
      }
      for (const itemHash of itemHashes) {
        insertItemId.run(recommendationId, itemHash);
      }
      for (const purpose of parsePurposes(row["用途"] ?? "")) {
        insertPurpose.run(recommendationId, purpose);
      }
      for (const [slot, field] of [
        ["barrel", "枪管"],
        ["magazine", "弹匣"],
        ["masterwork", "大师"],
        ["perk1", "Perk 1"],
        ["perk2", "Perk 2"],
        ["origin", "起源特性"]
      ] as const) {
        requirementValues(row[field] ?? "").forEach((perkName, ordinal) => {
          insertPerk.run(recommendationId, slot, ordinal, perkName, normalizeName(perkName));
        });
      }
    }

    writeMetadata.run("schema_version", String(recommendationDatabaseSchemaVersion));
    writeMetadata.run("semantic_validation_version", String(recommendationSemanticValidationVersion));
    writeMetadata.run("validated_manifest_version", validatedManifestVersion);
    writeMetadata.run("source_fingerprint", sourceFingerprint);
    writeMetadata.run("dataset_revision", sourceFingerprint);
    writeMetadata.run("imported_at", importedAt);
    writeMetadata.run("partial_import", partialImport ? "1" : "0");
    writeMetadata.run("skipped_row_count", String(skippedRowCount));
    writeMetadata.run("curated_dataset_state", "active");
    if (!partialImport) {
      for (const sourceKey of curatedSourceKeys) {
        reconcileRecommendationRuleOverrides(
          database,
          sourceKey,
          ruleIdsBySource.get(sourceKey) ?? new Set<string>(),
          sourceFingerprint,
          importedAt
        );
      }
    }
    database.exec("COMMIT;");
  } catch (error) {
    try {
      database.exec("ROLLBACK;");
    } catch {
      // 保留原始导入错误。
    }
    throw error;
  }
}

function loadKnowledgeCache(dataDir: string): KnowledgeCache | null {
  const path = recommendationDatabasePath(dataDir);
  if (!existsSync(path)) return null;
  let database: DatabaseSync | undefined;
  try {
    database = new DatabaseSync(path, { readOnly: true, timeout: 5_000 });
    const semanticVersion = recommendationMetadataValue(database, "semantic_validation_version");
    const validatedManifestVersion = recommendationMetadataValue(database, "validated_manifest_version");
    const legacyUnverified = !semanticVersion || !validatedManifestVersion;
    if (!legacyUnverified && semanticVersion !== String(recommendationSemanticValidationVersion)) return null;
    const recommendations = database.prepare(`
      SELECT r.id, r.rule_stable_id, r.identity_key, r.weapon_name, r.normalized_weapon_name, r.english_name,
             r.normalized_english_name, s.source_key AS source_id, s.label AS source_label,
             r.source_url, s.source_url AS source_default_url, r.rating, r.ranking, r.note,
             r.page_updated_at, r.version, r.source_location
      FROM weapon_recommendations r
      JOIN recommendation_sources s ON s.id = r.source_id
      LEFT JOIN recommendation_source_overrides source_override
        ON source_override.source_key = s.source_key
      WHERE COALESCE(source_override.state, 'active') = 'active'
        AND NOT EXISTS (
          SELECT 1
          FROM recommendation_rule_overrides rule_override
          WHERE rule_override.source_key = s.source_key
            AND rule_override.rule_stable_id = r.rule_stable_id
            AND rule_override.state = 'removed'
            AND rule_override.review_required = 0
        )
      ORDER BY r.id
    `).all() as Array<Omit<KnowledgeRecommendation, "purpose" | "requirements" | "item_hashes">>;
    if (recommendations.length === 0) return null;

    const purposes = database.prepare(`
      SELECT recommendation_id, purpose FROM weapon_recommendation_purposes ORDER BY recommendation_id, purpose
    `).all() as Array<{ recommendation_id: number; purpose: "pve" | "pvp" | "general" }>;
    const perks = database.prepare(`
      SELECT recommendation_id, slot, perk_name
      FROM weapon_recommendation_perks
      ORDER BY recommendation_id, slot, ordinal
    `).all() as Array<{
      recommendation_id: number;
      slot: RecommendationRequirementSlot;
      perk_name: string;
    }>;
    const itemIds = database.prepare(`
      SELECT recommendation_id, item_hash
      FROM weapon_recommendation_item_ids
      ORDER BY recommendation_id, item_hash
    `).all() as Array<{ recommendation_id: number; item_hash: number }>;

    const purposesById = groupValues(purposes);
    const requirementsById = groupRequirements(perks);
    const itemHashesById = groupItemHashes(itemIds);
    const byName = new Map<string, KnowledgeRecommendation[]>();
    const byItemHash = new Map<number, KnowledgeRecommendation[]>();
    for (const row of recommendations) {
      const recommendation: KnowledgeRecommendation = {
        ...row,
        purpose: purposesById.get(row.id) ?? ["general"],
        item_hashes: itemHashesById.get(row.id) ?? [],
        requirements: requirementsById.get(row.id) ?? emptyRequirements()
      };
      for (const key of [row.normalized_weapon_name, row.normalized_english_name].filter(Boolean)) {
        const bucket = byName.get(key) ?? [];
        bucket.push(recommendation);
        byName.set(key, bucket);
      }
      for (const itemHash of recommendation.item_hashes) {
        const bucket = byItemHash.get(itemHash) ?? [];
        bucket.push(recommendation);
        byItemHash.set(itemHash, bucket);
      }
    }
    return { byName, byItemHash, validatedManifestVersion, legacyUnverified };
  } catch {
    return null;
  } finally {
    database?.close();
  }
}

function buildWeaponPerkMap(itemHashes: readonly number[], options: SourceOptions): Map<string, PerkRef[]> {
  const map = new Map<string, PerkRef[]>();
  if (!options.itemDefinitions) return map;

  for (const itemHash of uniqueHashes([...itemHashes])) {
    const itemDefinition = options.itemDefinitions[String(itemHash)];
    if (!itemDefinition) continue;
    const groups = summarizeItemPerks(itemDefinition, options.itemDefinitions, {
      plugSetDefinitions: options.plugSetDefinitions,
      maxPlugsPerSocket: null
    });
    for (const group of groups) {
      const role = classifyWeaponRollSocket(group.plugs.map((plug) => ({
        hash: plug.hash,
        name: plug.name,
        ...(plug.category_identifier ? { category_identifier: plug.category_identifier } : {}),
        ...(plug.item_type ? { item_type: plug.item_type } : {}),
        selected: false
      })));
      for (const plug of group.plugs) {
        addPerkReference(map, plug.name, plug);
        const englishName = options.englishItemDefinitions?.[String(plug.hash)]?.displayProperties?.name?.trim();
        if (englishName) addPerkReference(map, englishName, plug, englishName);
      }
      if (role === "masterwork") {
        const aliases = new Map<string, ItemPlugSummary>();
        for (const plug of group.plugs) {
          const alias = officialMasterworkName(plug.name);
          if (!alias) continue;
          const existing = aliases.get(alias);
          if (!existing || masterworkVisualPriority(plug.name) > masterworkVisualPriority(existing.name)) {
            aliases.set(alias, plug);
          }
        }
        for (const [alias, plug] of aliases) addPerkAliasReference(map, alias, plug);
      }
    }
  }
  return map;
}

function masterworkVisualPriority(value: string): number {
  if (/^\s*大师杰作\s*[：:]/u.test(value)) return 100;
  const level = Number(value.match(/^\s*(\d+)\s*阶\s*[：:]/u)?.[1] ?? 0);
  return Number.isFinite(level) ? level : 0;
}

function addPerkAliasReference(
  map: Map<string, PerkRef[]>,
  alias: string,
  plug: ItemPlugSummary
): void {
  const key = normalizeName(alias);
  if (!key || map.has(key)) return;
  map.set(key, [{
    hash: plug.hash,
    name: alias,
    description: plug.description,
    icon: plug.icon
  }]);
}

function addPerkReference(
  map: Map<string, PerkRef[]>,
  name: string,
  plug: ItemPlugSummary,
  englishName?: string
): void {
  const key = normalizeName(name);
  if (!key) return;
  const bucket = map.get(key) ?? [];
  if (!bucket.some((entry) => entry.hash === plug.hash)) {
    bucket.push({
      hash: plug.hash,
      name: plug.name,
      ...(englishName ? { englishName } : {}),
      description: plug.description,
      icon: plug.icon
    });
  }
  map.set(key, bucket);
}

function resolveRecommendedPerks(names: string[], map: Map<string, PerkRef[]>): PerkRef[] {
  const resolved = names.flatMap((name) => resolveRecommendedPerkName(name, map));
  return [...new Map(resolved.map((perk) => [perk.hash, perk])).values()];
}

function resolveRecommendedPerkName(name: string, map: Map<string, PerkRef[]>): PerkRef[] {
  const normalized = normalizeName(name);
  return normalized ? map.get(normalized) ?? [] : [];
}

function buildSourceRecord(
  recommendation: KnowledgeRecommendation,
  perkMap: Map<string, PerkRef[]>
): RecommendationSourceRecord {
  const requirements = recommendationSlots.flatMap(({ slot, label }) => {
    const names = recommendation.requirements[slot].filter((name) => !isUnspecifiedRequirementName(name));
    if (names.length === 0) return [];
    const resolvedNames = names.filter((name) => resolveRecommendedPerkName(name, perkMap).length > 0);
    return [{
      slot,
      label,
      // 来源中已经完成清洗的有效要求必须全部进入分母。当前 Hash 的定义池
      // 只负责补充可用 Hash，不能删除其他同名版本提出的 Perk 要求。
      candidate_names: names,
      candidates: resolveRecommendedPerks(names, perkMap),
      unresolved_candidate_names: names.filter((name) => !resolvedNames.includes(name))
    }];
  });
  return {
    rule_stable_id: recommendation.rule_stable_id,
    source_id: recommendation.source_id,
    source_label: recommendation.source_label,
    source_url: recommendation.source_url || recommendation.source_default_url || undefined,
    purposes: recommendation.purpose,
    ...(recommendation.rating ? { rating: recommendation.rating } : {}),
    ...(recommendation.ranking ? { ranking: recommendation.ranking } : {}),
    ...(recommendation.note ? { note: recommendation.note } : {}),
    ...(recommendation.page_updated_at ? { page_updated_at: recommendation.page_updated_at } : {}),
    ...(recommendation.version ? { version: recommendation.version } : {}),
    ...(recommendation.source_location ? { source_location: recommendation.source_location } : {}),
    requirements
  };
}

function isUnspecifiedRequirementName(value: string): boolean {
  const normalized = normalizeName(value);
  return normalized === "任意"
    || normalized === "不限"
    || normalized === "不限制"
    || normalized === "any";
}

const recommendationSlots: Array<{ slot: RecommendationRequirementSlot; label: string }> = [
  { slot: "barrel", label: "枪管/瞄具" },
  { slot: "magazine", label: "第二列" },
  { slot: "masterwork", label: "大师" },
  { slot: "perk1", label: "Perk 1" },
  { slot: "perk2", label: "Perk 2" },
  { slot: "origin", label: "起源特性" }
];

function recommendationNote(recommendation: KnowledgeRecommendation): string | undefined {
  return [
    `来源 ${recommendation.source_label}`,
    recommendation.rating ? `评级 ${recommendation.rating}` : "",
    recommendation.note
  ]
    .filter(Boolean)
    .join("；") || undefined;
}

function uniqueSourceRecordPerks(records: RecommendationSourceRecord[]): PerkRef[] {
  return [...new Map<number, PerkRef>(
    records
      .flatMap((record) => record.requirements)
      .flatMap((requirement) => requirement.candidates)
      .map((perk) => [perk.hash, perk] as const)
  ).values()];
}

function uniqueById(values: KnowledgeRecommendation[]): KnowledgeRecommendation[] {
  return [...new Map(values.map((value) => [value.id, value])).values()];
}

const strictRequirementFields = [
  ["枪管", "barrel"],
  ["弹匣", "magazine"],
  ["大师", "masterwork"],
  ["Perk 1", "perk1"],
  ["Perk 2", "perk2"],
  ["起源特性", "origin"]
] as const;

function validateWeaponRecommendationRows(
  rows: Array<Record<string, string>>,
  definitions: WeaponKnowledgeSemanticDefinitions
): WeaponKnowledgeImportIssue[] {
  const issues: WeaponKnowledgeImportIssue[] = [];
  const allDefinitions = {
    ...definitions.item_definitions,
    ...definitions.plug_definitions
  };

  const seenKeys = new Set<string>();
  rows.forEach((row, index) => {
    const rowNumber = csvRowNumber(row, index + 2);
    const weaponName = row["武器"]?.trim() ?? "";
    const sourceLabel = row["推荐来源"]?.trim() ?? "";
    const playerFormat = row.__format === "player";
    const expectedColumnCount = playerFormat ? playerCsvHeaders.length : requiredCsvHeaders.length;
    if (Number(row.__column_count ?? expectedColumnCount) !== expectedColumnCount) {
      issues.push({
        row_number: rowNumber,
        weapon_name: weaponName,
        source_label: sourceLabel,
        field: "武器",
        value: weaponName,
        message: `该行有 ${row.__column_count ?? "未知"} 列，${playerFormat ? "普通玩家模板" : "T20 完整数据包"}要求 ${expectedColumnCount} 列。`
      });
      return;
    }
    if (!weaponName || !sourceLabel) {
      issues.push({
        row_number: rowNumber,
        weapon_name: weaponName,
        source_label: sourceLabel,
        field: !weaponName ? "武器" : "推荐来源",
        value: !weaponName ? weaponName : sourceLabel,
        message: !weaponName ? "缺少武器名称。" : "缺少推荐来源。"
      });
      return;
    }
    const uniqueKey = `${weaponIdentityKey(row)}\u0000${normalizeName(sourceLabel)}`;
    if (seenKeys.has(uniqueKey)) {
      issues.push({
        row_number: rowNumber,
        weapon_name: weaponName,
        source_label: sourceLabel,
        field: "武器",
        value: weaponName,
        message: "该武器身份与来源在文件前文已经存在。"
      });
      return;
    }
    seenKeys.add(uniqueKey);
    const sourceKey = stableSourceKeys[sourceLabel];
    if (sourceKey === "dim_voltron") return;
    if (!sourceKey) {
      issues.push({
        row_number: rowNumber,
        weapon_name: weaponName,
        source_label: sourceLabel,
        field: "推荐来源",
        value: sourceLabel,
        message: "人工推荐只接受 Aegis、LGpig、YXCRALLXY 和 Sayalarry 四个已管理来源；DIM 必须使用独立 Wishlist 数据链。"
      });
      return;
    }
    const rawItemHashValues = splitValues(row["武器ID"] ?? "");
    const parsedItemHashes = rawItemHashValues.map(Number);
    const invalidItemHashes = parsedItemHashes.filter((hash) => !isUnsignedHash(hash));
    const itemHashes = parsedItemHashes.filter(isUnsignedHash);
    if (invalidItemHashes.length) {
      issues.push({
        row_number: rowNumber,
        weapon_name: weaponName,
        source_label: sourceLabel,
        field: "武器ID",
        value: rawItemHashValues.join(" / "),
        message: "武器 ID 必须是 0 到 4294967295 的整数。"
      });
      return;
    }
    const itemDefinitions = itemHashes.length
      ? itemHashes
        .filter((hash) => definitions.item_definitions[String(hash)])
        .map((hash) => definitions.item_definitions[String(hash)])
        .filter((definition): definition is DefinitionRecord => Boolean(definition))
      : Object.values(definitions.item_definitions).filter((definition) => (
        normalizeName(definition.displayProperties?.name ?? "") === normalizeName(weaponName)
      ));
    const missingHashes = itemHashes.filter((hash) => !definitions.item_definitions[String(hash)]);
    if ((!itemHashes.length && itemDefinitions.length === 0) || missingHashes.length) {
      issues.push({
        row_number: rowNumber,
        weapon_name: weaponName,
        source_label: sourceLabel,
        field: "武器ID",
        value: missingHashes.length ? missingHashes.join(" / ") : row["武器ID"] ?? "",
        message: missingHashes.length
          ? "武器 ID 不在当前官方资料库中。"
          : "无法根据官方中文名称找到可核对的武器；请补充武器 ID。"
      });
      return;
    }

    const mismatchedWeaponNames = itemDefinitions
      .map((definition) => definition.displayProperties?.name?.trim() ?? "")
      .filter((officialName) => normalizeName(officialName) !== normalizeName(weaponName));
    if (mismatchedWeaponNames.length) {
      issues.push({
        row_number: rowNumber,
        weapon_name: weaponName,
        source_label: sourceLabel,
        field: "武器",
        value: weaponName,
        message: `武器名称与所填武器 ID 的官方名称不一致：${[...new Set(mismatchedWeaponNames)].join(" / ") || "官方名称为空"}。`
      });
      return;
    }

    const officialNames = collectOfficialRequirementNames(
      itemDefinitions,
      allDefinitions,
      definitions.plug_set_definitions
    );
    for (const [field, slot] of strictRequirementFields) {
      for (const value of requirementValues(row[field] ?? "")) {
        const key = normalizeName(value);
        if (officialNames[slot].has(key)) continue;
        const otherSlot = strictRequirementFields.find(([, candidateSlot]) => (
          candidateSlot !== slot && officialNames[candidateSlot].has(key)
        ));
        issues.push({
          row_number: rowNumber,
          weapon_name: weaponName,
          source_label: sourceLabel,
          field,
          value,
          message: otherSlot
            ? `该官方名称属于“${otherSlot[0]}”，不属于当前栏位。`
            : "无法在这把武器任一已列版本的对应官方栏位中精确确认。"
        });
      }
    }
  });
  return issues;
}

function collectOfficialRequirementNames(
  itemDefinitions: DefinitionRecord[],
  allDefinitions: DefinitionComponentData,
  plugSetDefinitions: DefinitionComponentData
): Record<RecommendationRequirementSlot, Set<string>> {
  const names = Object.fromEntries(strictRequirementFields.map(([, slot]) => [slot, new Set<string>()])) as Record<
    RecommendationRequirementSlot,
    Set<string>
  >;
  for (const itemDefinition of itemDefinitions) {
    let traitIndex = 0;
    const groups = summarizeItemPerks(itemDefinition, allDefinitions, {
      plugSetDefinitions,
      maxPlugsPerSocket: null
    });
    for (const group of groups.sort((left, right) => left.socket_index - right.socket_index)) {
      const plugs: AccountWeaponRollPlugSummary[] = group.plugs.map((plug) => ({
        hash: plug.hash,
        name: plug.name,
        ...(plug.category_identifier ? { category_identifier: plug.category_identifier } : {}),
        ...(plug.item_type ? { item_type: plug.item_type } : {}),
        selected: false
      }));
      const role = classifyWeaponRollSocket(plugs);
      const slot: RecommendationRequirementSlot | undefined = role === "trait"
        ? (++traitIndex === 1 ? "perk1" : traitIndex === 2 ? "perk2" : undefined)
        : role === "barrel" || role === "magazine" || role === "masterwork" || role === "origin"
          ? role
          : undefined;
      if (!slot) continue;
      for (const plug of plugs) {
        const officialName = slot === "masterwork"
          ? officialMasterworkName(plug.name)
          : plug.name.trim();
        if (officialName) names[slot].add(normalizeName(officialName));
      }
    }
  }
  return names;
}

function officialMasterworkName(value: string): string {
  return value
    .replace(/^\s*\d+\s*阶\s*[：:]\s*/u, "")
    .replace(/^\s*大师杰作\s*[：:]\s*/u, "")
    .trim();
}

function requirementValues(value: string): string[] {
  return splitValues(value).filter((candidate) => ![
    "任意", "无", "none", "n/a", "-"
  ].includes(candidate.trim().toLocaleLowerCase()));
}

function uniqueHashes(values: Array<number | undefined>): number[] {
  return [...new Set(values.filter((value): value is number => isUnsignedHash(Number(value))).map(Number))];
}

function parseKnowledgeCsv(text: string): Array<Record<string, string>> {
  const records = parseCsvRecords(text.replace(/^\uFEFF/, ""));
  const headers = records.shift()?.map((value) => value.trim()) ?? [];
  const isFullFormat = headers.length === requiredCsvHeaders.length
    && requiredCsvHeaders.every((header, index) => headers[index] === header);
  const isPlayerFormat = headers.length === playerCsvHeaders.length
    && playerCsvHeaders.every((header, index) => headers[index] === header);
  if (!isFullFormat && !isPlayerFormat) {
    throw new Error(`武器推荐 CSV 表头不受支持：请使用普通玩家模板（${playerCsvHeaders.length} 列）或 T20 完整数据包（${requiredCsvHeaders.length} 列）。`);
  }
  const rows = records
    .map((record, index) => ({ record, rowNumber: index + 2 }))
    .filter(({ record }) => record.some((value) => value.trim()))
    .map(({ record, rowNumber }) => ({
      ...(isFullFormat
        ? Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""]))
        : playerRowToKnowledgeRow(Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""])) as Record<string, string>)),
      __row_number: String(rowNumber),
      __column_count: String(record.length),
      __format: isFullFormat ? "full" : "player"
    }));
  if (rows.length === 0) {
    throw new Error("武器推荐 CSV 没有可导入的数据行。");
  }
  return rows;
}

function playerRowToKnowledgeRow(row: Record<string, string>): Record<string, string> {
  return {
    页面: "",
    分类: "",
    武器: row["武器"] ?? "",
    评级: row["评级"] ?? "",
    排名: "",
    来源URL: "",
    页面更新时间: "",
    来源位置: "",
    图标: "",
    图标图标URL: "",
    属性: "",
    框架: "",
    赛季: "",
    来源: "",
    勇士: "",
    勇士图标URL: "",
    弹药生成: "",
    枪管: row["第一列"] ?? "",
    弹匣: row["第二列"] ?? "",
    大师: row["大师"] ?? "",
    "Perk 1": row["Perk 1"] ?? "",
    "Perk 2": row["Perk 2"] ?? "",
    起源特性: row["起源特性"] ?? "",
    注解: row["备注"] ?? "",
    护盾: "",
    充能效率: "",
    武器ID: row["武器ID"] ?? "",
    英文名称: row["英文名称"] ?? "",
    版本: "",
    推荐来源: row["推荐来源"] ?? "",
    用途: row["用途"] ?? ""
  };
}

function prepareWeaponRecommendationRows(
  rows: Array<Record<string, string>>,
  definitions?: WeaponKnowledgeSemanticDefinitions
): Array<Record<string, string>> {
  if (!definitions) return rows;
  return rows.map((row) => enrichWeaponRecommendationRow(row, definitions));
}

function enrichWeaponRecommendationRow(
  row: Record<string, string>,
  definitions: WeaponKnowledgeSemanticDefinitions
): Record<string, string> {
  const resolvedItems = resolveOfficialWeaponDefinitions(row, definitions.item_definitions);
  if (!resolvedItems.length) return row;
  const primary = resolvedItems[0].definition;
  const sourceLabel = row["推荐来源"]?.trim() ?? "";
  const resolvedHashes = uniqueHashes(resolvedItems.map((item) => item.hash));
  return {
    ...row,
    武器: row["武器"]?.trim() || primary.displayProperties?.name?.trim() || "",
    武器ID: row["武器ID"]?.trim() || resolvedHashes.join(" / "),
    页面: row["页面"]?.trim() || sourceLabel,
    分类: row["分类"]?.trim() || primary.itemTypeDisplayName?.trim() || "",
    来源URL: row["来源URL"]?.trim() || stableSourceUrls[sourceLabel] || "",
    来源位置: row["来源位置"]?.trim() || (row.__format === "player" ? "玩家简表导入" : ""),
    图标图标URL: row["图标图标URL"]?.trim() || primary.displayProperties?.icon?.trim() || "",
    来源: row["来源"]?.trim() || primary.sourceData?.sourceString?.trim() || ""
  };
}

function resolveOfficialWeaponDefinitions(
  row: Record<string, string>,
  definitions: DefinitionComponentData
): Array<{ hash: number; definition: DefinitionRecord }> {
  const requestedHashes = splitValues(row["武器ID"] ?? "")
    .map(Number)
    .filter(isUnsignedHash);
  if (requestedHashes.length) {
    return requestedHashes.flatMap((hash) => {
      const definition = definitions[String(hash)];
      return definition ? [{ hash, definition }] : [];
    });
  }

  const weaponName = normalizeName(row["武器"] ?? "");
  if (!weaponName) return [];
  return Object.entries(definitions).flatMap(([key, definition]) => {
    if (normalizeName(definition.displayProperties?.name ?? "") !== weaponName) return [];
    const hash = Number(definition.hash ?? key);
    return isUnsignedHash(hash) ? [{ hash, definition }] : [];
  });
}

function curatedKnowledgeRows(rows: Array<Record<string, string>>): Array<Record<string, string>> {
  return rows.filter((row) => {
    const sourceLabel = row["推荐来源"]?.trim() ?? "";
    return (stableSourceKeys[sourceLabel] ?? normalizeName(sourceLabel)) !== "dim_voltron";
  });
}

function csvRowNumber(row: Record<string, string>, fallback = 2): number {
  const value = Number(row.__row_number);
  return Number.isInteger(value) && value >= 2 ? value : fallback;
}

function groupExportValues<T extends { recommendation_id: number }, K extends Exclude<keyof T, "recommendation_id">>(
  rows: T[],
  field: K
): Map<number, string[]> {
  const grouped = new Map<number, string[]>();
  for (const row of rows) {
    const values = grouped.get(row.recommendation_id) ?? [];
    values.push(String(row[field] ?? ""));
    grouped.set(row.recommendation_id, values);
  }
  return grouped;
}

function csvEscape(value: string | number): string {
  const text = String(value ?? "");
  return /[",\r\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}

function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index++;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (character === "," && !quoted) {
      record.push(value);
      value = "";
      continue;
    }
    if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index++;
      record.push(value);
      records.push(record);
      record = [];
      value = "";
      continue;
    }
    value += character;
  }
  if (quoted) {
    throw new Error("武器推荐 CSV 存在未闭合的引号字段。");
  }
  if (value || record.length) {
    record.push(value);
    records.push(record);
  }
  return records;
}

function parsePurposes(value: string): Array<"pve" | "pvp" | "general"> {
  const normalized = value.toLocaleLowerCase();
  const purposes: Array<"pve" | "pvp" | "general"> = [];
  if (normalized.includes("pve")) purposes.push("pve");
  if (normalized.includes("pvp")) purposes.push("pvp");
  if (normalized.includes("通用") || normalized.includes("general") || purposes.length === 0) purposes.push("general");
  return purposes;
}

function splitValues(value: string): string[] {
  return [...new Set(value.split(/\s+\/\s+|[；;\n]+/).map((part) => part.trim()).filter(Boolean))];
}

function normalizeName(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{Z}\s]+/gu, "");
}

function weaponIdentityKey(row: Record<string, string>): string {
  const englishName = normalizeName(row["英文名称"] ?? "");
  if (englishName) return `en:${englishName}`;
  const itemHashes = splitValues(row["武器ID"] ?? "")
    .map(Number)
    .filter(isUnsignedHash)
    .sort((left, right) => left - right);
  if (itemHashes.length) return `hash:${itemHashes.join("|")}`;
  return `zh:${normalizeName(row["武器"] ?? "")}`;
}

function curatedRuleStableId(sourceKey: string, row: Record<string, string>): string {
  return createHash("sha256").update(JSON.stringify({
    source_key: sourceKey,
    weapon_identity: weaponIdentityKey(row),
    purposes: [...parsePurposes(row["用途"] ?? "")].sort(),
    requirements: Object.fromEntries(strictRequirementFields.map(([field, slot]) => [
      slot,
      requirementValues(row[field] ?? "").map(normalizeName).sort()
    ]))
  })).digest("hex");
}

function isUnsignedHash(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

function csvFingerprint(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function knowledgeStatus(database: DatabaseSync, path: string): WeaponRecommendationKnowledgeStatus {
  const counts = database.prepare(`
    SELECT
      (SELECT COUNT(*) FROM weapon_recommendations) AS recommendation_count,
      (SELECT COUNT(DISTINCT identity_key) FROM weapon_recommendations) AS weapon_count,
      (SELECT COUNT(*) FROM recommendation_sources) AS source_count
  `).get() as { recommendation_count: number; weapon_count: number; source_count: number };
  const semanticValidationVersion = Number(recommendationMetadataValue(database, "semantic_validation_version") || 0);
  const validatedManifestVersion = recommendationMetadataValue(database, "validated_manifest_version");
  const verified = semanticValidationVersion === recommendationSemanticValidationVersion
    && Boolean(validatedManifestVersion);
  return {
    schema_version: recommendationDatabaseSchemaVersion,
    semantic_validation_version: semanticValidationVersion,
    validated_manifest_version: validatedManifestVersion,
    validation_state: verified ? "verified" : "unverified",
    dataset_revision: recommendationMetadataValue(database, "dataset_revision"),
    database_path: path,
    source_fingerprint: recommendationMetadataValue(database, "source_fingerprint"),
    imported_at: recommendationMetadataValue(database, "imported_at"),
    recommendation_count: Number(counts.recommendation_count),
    weapon_count: Number(counts.weapon_count),
    source_count: Number(counts.source_count),
    skipped_row_count: Number(recommendationMetadataValue(database, "skipped_row_count") || 0)
  };
}

function groupValues(
  rows: Array<{ recommendation_id: number; purpose: "pve" | "pvp" | "general" }>
): Map<number, Array<"pve" | "pvp" | "general">> {
  const grouped = new Map<number, Array<"pve" | "pvp" | "general">>();
  for (const row of rows) grouped.set(row.recommendation_id, [...(grouped.get(row.recommendation_id) ?? []), row.purpose]);
  return grouped;
}

function groupItemHashes(
  rows: Array<{ recommendation_id: number; item_hash: number }>
): Map<number, number[]> {
  const grouped = new Map<number, number[]>();
  for (const row of rows) {
    grouped.set(row.recommendation_id, [...(grouped.get(row.recommendation_id) ?? []), row.item_hash]);
  }
  return grouped;
}

function groupRequirements(
  rows: Array<{
    recommendation_id: number;
    slot: RecommendationRequirementSlot;
    perk_name: string;
  }>
): Map<number, Record<RecommendationRequirementSlot, string[]>> {
  const grouped = new Map<number, Record<RecommendationRequirementSlot, string[]>>();
  for (const row of rows) {
    const requirements = grouped.get(row.recommendation_id) ?? emptyRequirements();
    requirements[row.slot].push(row.perk_name);
    grouped.set(row.recommendation_id, requirements);
  }
  return grouped;
}

function emptyRequirements(): Record<RecommendationRequirementSlot, string[]> {
  return {
    barrel: [],
    magazine: [],
    masterwork: [],
    perk1: [],
    perk2: [],
    origin: []
  };
}

async function stageManagedCsv(path: string, contents: string): Promise<{
  commit(): Promise<void>;
  rollback(): Promise<void>;
}> {
  await mkdir(dirname(path), { recursive: true });
  const suffix = `${process.pid}-${Date.now()}-${randomUUID()}`;
  const temporaryPath = `${path}.tmp-${suffix}`;
  const backupPath = `${path}.backup-${suffix}`;
  const hadPrevious = existsSync(path);
  await writeFile(temporaryPath, contents, "utf8");
  try {
    if (hadPrevious) await rename(path, backupPath);
    await rename(temporaryPath, path);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    if (hadPrevious && existsSync(backupPath) && !existsSync(path)) {
      await rename(backupPath, path).catch(() => undefined);
    }
    throw error;
  }

  return {
    async commit() {
      await rm(backupPath, { force: true }).catch(() => undefined);
    },
    async rollback() {
      await rm(path, { force: true }).catch(() => undefined);
      if (hadPrevious && existsSync(backupPath)) {
        await rename(backupPath, path);
      }
    }
  };
}
