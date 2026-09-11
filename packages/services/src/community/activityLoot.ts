import type {
  WeeklyFarmingCatalogActivity,
  WeeklyFarmingCatalogResource,
  WeeklyFarmingPatternProgress,
  WeeklyFarmingRequest,
  WeeklyFarmingActivityKind,
  WeeklyFarmingRotationActivity
} from "@d2-tools/core/weekly/farming";
import type { DefinitionComponentData, DefinitionRecord } from "@d2-tools/core/manifest/definitions";

export type ActivityLootDatasetItem = {
  item_hash: number;
  item_variant: "normal" | "adept" | "timelost" | "harrowed" | "reprised" | "other";
  drop_scope: "activity" | "encounter" | "final_chest" | "secret_chest" | "challenge";
  pattern_record_hash?: number;
};

export type ActivityLootDatasetActivity = {
  key: string;
  activity_hash: number;
  activity_kind: WeeklyFarmingActivityKind;
  names: string[];
  source_hash: number;
  source_label: string;
  source_url: string;
  source_license: string;
  evidence_note: string;
  verified_at: string;
  items: ActivityLootDatasetItem[];
};

export type ActivityLootDatasetV1 = {
  schema: "activity-loot.v1";
  revision: string;
  manifest_version: string;
  activities: ActivityLootDatasetActivity[];
};

const dimSourceInfoUrl = "https://github.com/DestinyItemManager/DIM/blob/2a115690fd20717c4a8daa185eccd027226d4832/src/data/d2/source-info-v2.ts";
const sourceLicense = "Bungie Manifest；DIM 来源索引为 MIT";
const verifiedAt = "2026-09-10";

/**
 * 首批只维护当前真实轮换覆盖。关系来自 Bungie Collectible sourceHash，
 * 并用 DIM 的 MIT 来源索引交叉核对。它确认“来自该活动”，不声称具体遭遇战。
 */
export const activityLootDatasetV1: ActivityLootDatasetV1 = {
  schema: "activity-loot.v1",
  revision: "2026-09-10.1",
  manifest_version: "244213.26.06.29.2000-1-bnet.65864",
  activities: [
    {
      key: "vow-of-the-disciple",
      activity_hash: 1441982566,
      activity_kind: "raid",
      names: ["门徒誓约", "Vow of the Disciple"],
      source_hash: 1007078046,
      source_label: "Bungie Collectible：来源“门徒誓约”突袭",
      source_url: dimSourceInfoUrl,
      source_license: sourceLicense,
      evidence_note: "当前 Manifest sourceHash 1007078046；仅确认活动级来源。",
      verified_at: verifiedAt,
      items: [
        { item_hash: 999767358, item_variant: "normal", drop_scope: "activity", pattern_record_hash: 989023188 },
        { item_hash: 613334176, item_variant: "normal", drop_scope: "activity", pattern_record_hash: 422252754 },
        { item_hash: 768621510, item_variant: "normal", drop_scope: "activity", pattern_record_hash: 2896258222 },
        { item_hash: 3428521585, item_variant: "normal", drop_scope: "activity", pattern_record_hash: 3868889639 },
        { item_hash: 3886416794, item_variant: "normal", drop_scope: "activity", pattern_record_hash: 1057921323 },
        { item_hash: 2534546147, item_variant: "normal", drop_scope: "activity", pattern_record_hash: 876397380 },
        { item_hash: 3505113722, item_variant: "normal", drop_scope: "activity" }
      ]
    },
    {
      key: "salvations-edge",
      activity_hash: 1541433876,
      activity_kind: "raid",
      names: ["救赎的边缘", "救赎边缘", "Salvation's Edge"],
      source_hash: 2700267533,
      source_label: "Bungie Collectible：来源“救赎的边缘”突袭",
      source_url: dimSourceInfoUrl,
      source_license: sourceLicense,
      evidence_note: "当前 Manifest sourceHash 2700267533；仅确认活动级来源。",
      verified_at: verifiedAt,
      items: [
        { item_hash: 445197843, item_variant: "normal", drop_scope: "activity", pattern_record_hash: 2043998246 },
        { item_hash: 859869931, item_variant: "normal", drop_scope: "activity", pattern_record_hash: 3842096181 },
        { item_hash: 535198113, item_variant: "normal", drop_scope: "activity", pattern_record_hash: 1077926398 },
        { item_hash: 1770490683, item_variant: "normal", drop_scope: "activity", pattern_record_hash: 3208349713 },
        { item_hash: 3569407878, item_variant: "normal", drop_scope: "activity", pattern_record_hash: 2577052324 },
        { item_hash: 1258168956, item_variant: "normal", drop_scope: "activity", pattern_record_hash: 519472433 },
        { item_hash: 3284383335, item_variant: "normal", drop_scope: "activity" }
      ]
    },
    {
      key: "grasp-of-avarice",
      activity_hash: 4078656646,
      activity_kind: "dungeon",
      names: ["贪婪之握", "Grasp of Avarice"],
      source_hash: 675740011,
      source_label: "Bungie Collectible：来源“贪婪之握”地牢",
      source_url: dimSourceInfoUrl,
      source_license: sourceLicense,
      evidence_note: "当前 Manifest sourceHash 675740011；仅确认活动级来源。",
      verified_at: verifiedAt,
      items: [
        { item_hash: 1648948519, item_variant: "reprised", drop_scope: "activity" },
        { item_hash: 1518956169, item_variant: "reprised", drop_scope: "activity" },
        { item_hash: 944708986, item_variant: "reprised", drop_scope: "activity" },
        { item_hash: 386864872, item_variant: "reprised", drop_scope: "activity" }
      ]
    },
    {
      key: "warlords-ruin",
      activity_hash: 2004855007,
      activity_kind: "dungeon",
      names: ["战争领主的废墟", "Warlord's Ruin"],
      source_hash: 613435025,
      source_label: "Bungie Collectible：来源“战争领主的废墟”地牢",
      source_url: dimSourceInfoUrl,
      source_license: sourceLicense,
      evidence_note: "当前 Manifest sourceHash 613435025；仅确认活动级来源。",
      verified_at: verifiedAt,
      items: [
        { item_hash: 1054567917, item_variant: "normal", drop_scope: "activity" },
        { item_hash: 2525261820, item_variant: "normal", drop_scope: "activity" },
        { item_hash: 3886719505, item_variant: "normal", drop_scope: "activity" },
        { item_hash: 4119503981, item_variant: "normal", drop_scope: "activity" },
        { item_hash: 2554513694, item_variant: "normal", drop_scope: "activity" }
      ]
    }
  ]
};

export function matchActivityLootDataset(
  rotation: readonly WeeklyFarmingRotationActivity[],
  dataset: ActivityLootDatasetV1 = activityLootDatasetV1
): Array<{ rotation: WeeklyFarmingRotationActivity; activity?: ActivityLootDatasetActivity }> {
  return rotation.map((entry) => ({
    rotation: entry,
    activity: dataset.activities.find((candidate) => activityMatches(candidate, entry))
  }));
}

export function collectActivityLootItemHashes(
  request: WeeklyFarmingRequest,
  dataset: ActivityLootDatasetV1 = activityLootDatasetV1
): number[] {
  assertValidActivityLootDataset(dataset);
  return uniqueNumbers(matchActivityLootDataset(request.activities, dataset)
    .flatMap((match) => match.activity?.items.map((item) => item.item_hash) ?? []));
}

/**
 * 按活动 Hash 查询受控掉落数据集的武器清单，供首页核心活动卡装配掉落池。
 * 数据集未覆盖该活动时返回空数组，调用方回退到现有奖励展示。
 */
export function lootPoolItemHashesForActivity(
  activityHash: number,
  dataset: ActivityLootDatasetV1 = activityLootDatasetV1
): number[] {
  const activity = dataset.activities.find((candidate) => (
    toUnsignedHash(candidate.activity_hash) === toUnsignedHash(activityHash)
  ));
  return activity ? activity.items.map((item) => toUnsignedHash(item.item_hash)) : [];
}

export function buildWeeklyFarmingCatalogResource(input: {
  request: WeeklyFarmingRequest;
  manifestVersion?: string;
  itemDefinitions: DefinitionComponentData;
  profileRecords?: Record<string, {
    state?: number;
    objectives?: Array<{
      progress?: number;
      completionValue?: number;
      complete?: boolean;
      visible?: boolean;
    }>;
  }>;
  patternReadFailed?: boolean;
  now?: Date;
  dataset?: ActivityLootDatasetV1;
}): WeeklyFarmingCatalogResource {
  const dataset = input.dataset ?? activityLootDatasetV1;
  assertValidActivityLootDataset(dataset);
  const matches = matchActivityLootDataset(input.request.activities, dataset);
  const warnings: string[] = [];
  const activities: WeeklyFarmingCatalogActivity[] = matches.map(({ rotation, activity }) => {
    if (!activity) {
      warnings.push(`${rotation.title} 尚未进入 activity-loot.v1 受控数据集。`);
      return {
        key: `uncovered:${rotation.kind}:${normalizeActivityName(rotation.title)}`,
        kind: rotation.kind,
        title: rotation.title,
        rotation_source: rotation.source ?? "Bungie 当前轮换",
        related_hashes: rotation.related_hashes ?? [],
        coverage: "not_covered",
        coverage_note: "当前轮换已确认，但活动掉落关系尚未完成证据核对。",
        items: []
      };
    }

    const items = activity.items.flatMap((item) => {
      const definition = input.itemDefinitions[String(toUnsignedHash(item.item_hash))] as DefinitionRecord | undefined;
      const name = definition?.displayProperties?.name?.trim();
      if (!definition || !name) {
        warnings.push(`${rotation.title} 的装备 ${item.item_hash} 在当前资料库中不存在，已停止展示。`);
        return [];
      }
      if (definition.itemType !== 3) {
        warnings.push(`${rotation.title} 的 ${name} 当前不是武器定义，已停止展示。`);
        return [];
      }
      return [{
        hash: toUnsignedHash(item.item_hash),
        name,
        icon: definition.displayProperties?.icon,
        item_type: definition.itemTypeDisplayName,
        variant: item.item_variant,
        drop_scope: item.drop_scope,
        source_hash: activity.source_hash,
        source_label: activity.source_label,
        source_url: activity.source_url,
        source_license: activity.source_license,
        verified_at: activity.verified_at,
        pattern: buildPatternProgress(
          item.pattern_record_hash,
          input.profileRecords,
          input.patternReadFailed === true
        )
      }];
    });

    if (items.length !== activity.items.length) {
      warnings.push(`${rotation.title} 的受控掉落关系与当前资料库不完全一致。`);
    }
    return {
      key: activity.key,
      kind: activity.activity_kind,
      title: rotation.title,
      rotation_source: rotation.source ?? "Bungie 当前轮换",
      related_hashes: rotation.related_hashes ?? [],
      coverage: "confirmed_activity_source",
      coverage_note: `${activity.evidence_note} 不包含具体遭遇战分配。`,
      items
    };
  });

  if (input.patternReadFailed) {
    warnings.push("Bungie 图样进度读取失败；活动与装备来源仍可使用。 ");
  }
  if (input.manifestVersion && input.manifestVersion !== dataset.manifest_version) {
    warnings.push(`掉落关系核对于 ${dataset.manifest_version}；当前资料库为 ${input.manifestVersion}。装备 Hash 仍存在，但活动来源关系需要随下一版数据集重新核对。`);
  }
  const matchedCount = activities.filter((activity) => activity.coverage === "confirmed_activity_source").length;
  const status = activities.length === 0
    ? "unavailable"
    : matchedCount === activities.length && !warnings.length && !input.patternReadFailed
      ? "ready"
      : "partial";

  return {
    schema: dataset.schema,
    revision: dataset.revision,
    manifest_version: input.manifestVersion,
    verified_manifest_version: dataset.manifest_version,
    reset_at: input.request.reset_at,
    fetched_at: (input.now ?? new Date()).toISOString(),
    status,
    activities,
    warnings: uniqueStrings(warnings.map((warning) => warning.trim()).filter(Boolean))
  };
}

export function validateActivityLootDataset(dataset: ActivityLootDatasetV1): string[] {
  const errors: string[] = [];
  const activityKeys = new Set<string>();
  for (const activity of dataset.activities) {
    if (!activity.key.trim()) errors.push("活动 key 不能为空。");
    if (activityKeys.has(activity.key)) errors.push(`活动 key 重复：${activity.key}`);
    activityKeys.add(activity.key);
    if (!Number.isFinite(activity.activity_hash)) errors.push(`${activity.key} 缺少有效 activity_hash。`);
    if (!Number.isFinite(activity.source_hash)) errors.push(`${activity.key} 缺少有效 source_hash。`);
    if (!activity.names.some((name) => name.trim())) errors.push(`${activity.key} 缺少可匹配的正式名称。`);
    if (!activity.source_url.startsWith("https://")) errors.push(`${activity.key} 缺少可追溯的 HTTPS 来源。`);
    if (!activity.source_license.trim()) errors.push(`${activity.key} 缺少来源许可说明。`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(activity.verified_at)) errors.push(`${activity.key} 的 verified_at 无效。`);
    if (!activity.items.length) errors.push(`${activity.key} 没有任何受控装备关系。`);
    const itemHashes = new Set<number>();
    for (const item of activity.items) {
      const hash = toUnsignedHash(item.item_hash);
      if (!hash) errors.push(`${activity.key} 存在无效装备 Hash。`);
      if (itemHashes.has(hash)) errors.push(`${activity.key} 重复登记装备 ${hash}。`);
      itemHashes.add(hash);
    }
  }
  return uniqueStrings(errors);
}

function assertValidActivityLootDataset(dataset: ActivityLootDatasetV1): void {
  const errors = validateActivityLootDataset(dataset);
  if (errors.length) {
    throw new Error(`activity-loot.v1 校验失败：${errors.join("；")}`);
  }
}

function buildPatternProgress(
  recordHash: number | undefined,
  records: Record<string, {
    state?: number;
    objectives?: Array<{
      progress?: number;
      completionValue?: number;
      complete?: boolean;
      visible?: boolean;
    }>;
  }> | undefined,
  readFailed: boolean
): WeeklyFarmingPatternProgress {
  if (recordHash === undefined) return { status: "not_craftable" };
  if (readFailed) return { status: "unavailable", record_hash: recordHash, reason: "read_failed" };
  const record = records?.[String(toUnsignedHash(recordHash))];
  if (!record) return { status: "unavailable", record_hash: recordHash, reason: "not_returned" };
  const state = record.state ?? 0;
  if ((state & 32) !== 0) {
    return { status: "unavailable", record_hash: recordHash, reason: "entitlement_unowned" };
  }
  if ((state & 8) !== 0 || (state & 16) !== 0) {
    return { status: "unavailable", record_hash: recordHash, reason: "record_hidden" };
  }
  const objective = record.objectives?.find((candidate) => (
    candidate.visible !== false
    && typeof candidate.completionValue === "number"
    && candidate.completionValue > 0
  ));
  if (!objective?.completionValue) {
    return { status: "unavailable", record_hash: recordHash, reason: "objective_missing" };
  }
  const completionValue = Math.max(1, objective.completionValue);
  const progress = Math.min(completionValue, Math.max(0, objective.progress ?? 0));
  const complete = objective.complete === true || progress >= completionValue;
  return {
    status: complete ? "complete" : "in_progress",
    record_hash: toUnsignedHash(recordHash),
    progress,
    completion_value: completionValue,
    remaining: Math.max(0, completionValue - progress)
  };
}

function activityMatches(
  candidate: ActivityLootDatasetActivity,
  rotation: WeeklyFarmingRotationActivity
): boolean {
  if (candidate.activity_kind !== rotation.kind) return false;
  const hashes = new Set((rotation.related_hashes ?? []).map(toUnsignedHash));
  if (hashes.has(toUnsignedHash(candidate.activity_hash))) return true;
  const title = normalizeActivityName(rotation.title);
  return candidate.names.some((name) => title.includes(normalizeActivityName(name)));
}

function normalizeActivityName(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[：:·'’“”\-\s]/g, "");
}

function toUnsignedHash(value: number): number {
  return Number(value) >>> 0;
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values.map(toUnsignedHash))];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
