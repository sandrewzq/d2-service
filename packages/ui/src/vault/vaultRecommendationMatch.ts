import type { AccountItemSummary } from "@d2-tools/core/account/summary";
import type { DimWishlist } from "@d2-tools/core/analysis/wishlistImport";
import type {
  RecommendationCardDimSummary,
  RecommendationCardSourceSummary,
  RecommendationCardSummary,
  RecommendationSourceMatch,
  VaultItemInstanceMatchInfo
} from "@d2-tools/core/community-perks";
import {
  isDimRecommendationSource,
  presentCuratedRecommendationMatch
} from "../recommendationMatchPresentation.js";

export type VaultRecommendationSourceSummary = {
  sourceId: string;
  sourceLabel: string;
  shortLabel: string;
  state: "full" | "core" | "close" | "key_missing" | "not_matched" | "weapon_only" | "uncheckable";
  matched: number;
  available: number;
  matchedPerkCount: number;
  perkRequirementCount: number;
  uncheckablePerkCount: number;
  matchedRequirementCount: number;
  requirementCount: number;
  uncheckableRequirementCount: number;
  dimBestMatchedRequirementCount: number;
  dimBestRequirementCount: number;
  unit: "item" | "combo";
  purposes: Array<"pve" | "pvp" | "general">;
  resultText: string;
  text: string;
  detail: string;
};

export type VaultRecommendationSummaryIndex = ReadonlyMap<
  string,
  VaultRecommendationSourceSummary[]
>;

export type VaultRecommendationResult = "matched" | "partial" | "not_matched" | "uncheckable" | "uncovered";

export type VaultRecommendationMetricKey = `${number}/${number}`;
export type VaultRecommendationPrimaryFilter =
  | "all"
  | VaultRecommendationMetricKey
  | "unrequired"
  | "uncheckable"
  | "uncovered";
export type VaultRecommendationCompleteFilter = "all" | VaultRecommendationMetricKey;

export type VaultRecommendationFilterFact = {
  kind: "curated" | "dim";
  primaryKey: Exclude<VaultRecommendationPrimaryFilter, "all">;
  completeKey?: VaultRecommendationMetricKey;
};

export type VaultRecommendationFilterFactIndex = ReadonlyMap<
  string,
  ReadonlyMap<string, VaultRecommendationFilterFact>
>;

export type VaultRecommendationSourceOption = {
  sourceId: string;
  sourceLabel: string;
  shortLabel: string;
  count: number;
};

export type VaultRecommendationManagedSourceOptionInput = {
  source_key: string;
  label: string;
  configured: boolean;
  state: "active" | "disabled" | "removed";
};

const sourceOrder = new Map([
  ["aegis", 0],
  ["lgpig", 1],
  ["yxcrallxy", 2],
  ["sayalarry", 3],
  ["dim_voltron", 4],
  ["dim_wishlist", 4]
]);
const dimRulesByWishlist = new WeakMap<DimWishlist, Map<number, DimWishlist["rules"]>>();
let cachedSummaryIndexInput: {
  instanceMatchMap?: ReadonlyMap<string, VaultItemInstanceMatchInfo>;
  cardSummaryMap?: ReadonlyMap<string, RecommendationCardSummary>;
  wishlist?: DimWishlist | null;
  itemSignatures: Map<string, string>;
  index: Map<string, VaultRecommendationSourceSummary[]>;
} | null = null;

export function getVaultCommunityInstanceKey(item: AccountItemSummary): string {
  return item.instance_id ?? `hash:${item.hash}`;
}

export function buildVaultRecommendationSourceSummaries(
  item: AccountItemSummary,
  instanceMatch?: VaultItemInstanceMatchInfo,
  wishlist?: DimWishlist | null,
  cardSummary?: RecommendationCardSummary
): VaultRecommendationSourceSummary[] {
  const summaries = cardSummary
    ? cardSummary.sources
        .filter((source) => !isDimRecommendationSource(source.source_id))
        .map(cardSourceSummary)
    : (instanceMatch?.source_matches ?? [])
        .filter((source) => !isDimRecommendationSource(source.source_id))
        .map(sourceMatchSummary);
  // DIM 必须按完整愿望单组合核对。CSV 中为阅读汇总而展开的 dim_voltron
  // 候选池不能伪装成人工来源栏位，否则会把不同组合错误拼成 x/y。
  const dimSummary = cardSummary
    ? cardSummary.dim
      ? buildDimInstanceSummary(cardSummary.dim)
      : null
    : instanceMatch
      ? instanceMatch.dim_wishlist
        ? buildDimInstanceSummary(instanceMatch.dim_wishlist)
        : null
      : buildDimWishlistSummary(item, wishlist);
  if (dimSummary) summaries.push(dimSummary);
  return summaries.sort(compareSourceSummaries);
}

export function buildVaultRecommendationSummaryIndex(
  items: readonly AccountItemSummary[],
  instanceMatchMap?: ReadonlyMap<string, VaultItemInstanceMatchInfo>,
  wishlist?: DimWishlist | null,
  cardSummaryMap?: ReadonlyMap<string, RecommendationCardSummary>
): Map<string, VaultRecommendationSourceSummary[]> {
  const weaponItems = items.filter((item) => item.group_key === "weapons");
  const itemSignatures = new Map(weaponItems.map((item) => {
    const instanceKey = getVaultCommunityInstanceKey(item);
    return [instanceKey, recommendationItemSignature(item)] as const;
  }));
  if (
    cachedSummaryIndexInput !== null
    && cachedSummaryIndexInput.instanceMatchMap === instanceMatchMap
    && cachedSummaryIndexInput.cardSummaryMap === cardSummaryMap
    && cachedSummaryIndexInput.wishlist === wishlist
    && sameRecommendationItemSignatures(cachedSummaryIndexInput.itemSignatures, itemSignatures)
  ) {
    return cachedSummaryIndexInput.index;
  }

  const index = new Map<string, VaultRecommendationSourceSummary[]>();
  for (const item of weaponItems) {
    const instanceKey = getVaultCommunityInstanceKey(item);
    index.set(
      instanceKey,
      buildVaultRecommendationSourceSummaries(
        item,
        instanceMatchMap?.get(instanceKey),
        wishlist,
        cardSummaryMap?.get(instanceKey)
      )
    );
  }
  cachedSummaryIndexInput = { instanceMatchMap, cardSummaryMap, wishlist, itemSignatures, index };
  return index;
}

function recommendationItemSignature(item: AccountItemSummary): string {
  return [
    item.hash,
    item.weapon_roll?.fingerprint ?? "",
    (item.socket_plugs ?? []).map((plug) => plug.hash).join(",")
  ].join(":");
}

function sameRecommendationItemSignatures(
  previous: ReadonlyMap<string, string>,
  next: ReadonlyMap<string, string>
): boolean {
  if (previous.size !== next.size) return false;
  for (const [instanceKey, signature] of next) {
    if (previous.get(instanceKey) !== signature) return false;
  }
  return true;
}

function buildDimInstanceSummary(
  match: NonNullable<VaultItemInstanceMatchInfo["dim_wishlist"]> | RecommendationCardDimSummary
): VaultRecommendationSourceSummary {
  const missingRequirementCount = Math.max(0, match.best_requirement_count - match.best_matched_requirement_count);
  const isClose = match.matched_combo_count === 0 && match.best_matched_requirement_count > 0 && missingRequirementCount > 0;
  const state = match.state;
  const bestCombinationText = match.best_requirement_count > 0
    ? `最佳组合 ${match.best_matched_requirement_count}/${match.best_requirement_count}`
    : "未指定组合";
  const resultText = state === "uncheckable"
    ? `组合无法判断 · ${bestCombinationText}`
    : `符合 ${match.matched_combo_count} 套 · ${bestCombinationText}`;
  const text = `DIM：${resultText}`;
  return {
    sourceId: "dim_wishlist",
    sourceLabel: "DIM社区愿望单",
    shortLabel: "DIM",
    state,
    matched: match.matched_combo_count,
    available: match.combo_count,
    matchedPerkCount: 0,
    perkRequirementCount: 0,
    uncheckablePerkCount: 0,
    matchedRequirementCount: match.best_matched_requirement_count,
    requirementCount: match.best_requirement_count,
    uncheckableRequirementCount: state === "uncheckable" ? Math.max(1, match.best_requirement_count - match.best_matched_requirement_count) : 0,
    dimBestMatchedRequirementCount: match.best_matched_requirement_count,
    dimBestRequirementCount: match.best_requirement_count,
    unit: "combo",
    purposes: match.modes,
    resultText,
    text,
    detail: `DIM社区愿望单：${resultText}${state === "uncheckable" ? "；当前武器 Roll 数据不完整" : isClose ? `；最接近的一套还缺 ${missingRequirementCount} 项` : ""}${state !== "uncheckable" && match.uncheckable_combo_count ? `；另有 ${match.uncheckable_combo_count} 套无法判断` : ""}。`
  };
}

function selectBestDimCombination<T extends {
  matched_requirement_count: number;
  requirement_count: number;
}>(rules: readonly T[]): T | undefined {
  return rules.reduce<T | undefined>((best, rule) => {
    if (!best) return rule;
    const ruleComplete = rule.requirement_count > 0
      && rule.matched_requirement_count === rule.requirement_count;
    const bestComplete = best.requirement_count > 0
      && best.matched_requirement_count === best.requirement_count;
    if (ruleComplete !== bestComplete) return ruleComplete ? rule : best;
    const ratioDifference = rule.matched_requirement_count * best.requirement_count
      - best.matched_requirement_count * rule.requirement_count;
    if (ratioDifference !== 0) return ratioDifference > 0 ? rule : best;
    if (rule.requirement_count !== best.requirement_count) {
      return rule.requirement_count > best.requirement_count ? rule : best;
    }
    return rule.matched_requirement_count > best.matched_requirement_count ? rule : best;
  }, undefined);
}

export function hasPositiveRecommendationSummary(summary: VaultRecommendationSourceSummary): boolean {
  return summary.state === "full" || summary.state === "core";
}

export function inferVaultRecommendationResult(
  summaries: readonly VaultRecommendationSourceSummary[],
  aggregateState?: VaultItemInstanceMatchInfo["recommendation_state"]
): VaultRecommendationResult {
  if (!summaries.length) return "uncovered";
  if (summaries.some((summary) => summary.state === "uncheckable")) return "uncheckable";
  const hasPositive = summaries.some(hasPositiveRecommendationSummary);
  if (hasPositive && aggregateState === "priority") return "matched";
  if (hasPositive && aggregateState === "compare") return "partial";
  const hasNegative = summaries.some((summary) => summary.state === "key_missing" || summary.state === "not_matched");
  if (hasPositive && !hasNegative) return "matched";
  if (hasPositive || summaries.some((summary) => (
    summary.state === "core"
    || summary.state === "close"
    || summary.state === "weapon_only"
    || summary.matched > 0
  ))) return "partial";
  return "not_matched";
}

export function inferVaultRecommendationResultForSource(
  summaries: readonly VaultRecommendationSourceSummary[],
  sourceId: string
): VaultRecommendationResult {
  const canonicalSourceId = canonicalVaultRecommendationSourceId(sourceId);
  const sourceSummaries = summaries.filter((candidate) => (
    canonicalVaultRecommendationSourceId(candidate.sourceId) === canonicalSourceId
  ));
  if (!sourceSummaries.length) return "uncovered";
  if (sourceSummaries.some((summary) => summary.state === "full" || summary.state === "core")) {
    return "matched";
  }
  if (sourceSummaries.some((summary) => (
    summary.matched > 0
    || summary.state === "close"
    || summary.state === "weapon_only"
  ))) {
    return "partial";
  }
  if (sourceSummaries.some((summary) => summary.state === "uncheckable")) return "uncheckable";
  return "not_matched";
}

export function selectVaultRecommendationSourceSummaries(
  summaries: readonly VaultRecommendationSourceSummary[]
): VaultRecommendationSourceSummary[] {
  const summariesBySource = new Map<string, VaultRecommendationSourceSummary>();
  for (const summary of summaries) {
    const sourceId = canonicalVaultRecommendationSourceId(summary.sourceId);
    const current = summariesBySource.get(sourceId);
    if (!current || isBetterSourceSummary(summary, current)) {
      summariesBySource.set(sourceId, summary);
    }
  }
  return [...summariesBySource.values()].sort(compareSourceSummaries);
}

export function buildVaultRecommendationFilterFactIndex(
  summaryIndex: VaultRecommendationSummaryIndex
): Map<string, Map<string, VaultRecommendationFilterFact>> {
  const factIndex = new Map<string, Map<string, VaultRecommendationFilterFact>>();
  for (const [instanceKey, summaries] of summaryIndex) {
    const factsBySource = new Map<string, VaultRecommendationFilterFact>();
    for (const summary of selectVaultRecommendationSourceSummaries(summaries)) {
      const sourceId = canonicalVaultRecommendationSourceId(summary.sourceId);
      factsBySource.set(sourceId, recommendationFilterFactFromSummary(summary));
    }
    if (factsBySource.size) factIndex.set(instanceKey, factsBySource);
  }
  return factIndex;
}

export function getVaultRecommendationFilterFact(
  factIndex: VaultRecommendationFilterFactIndex,
  instanceKey: string,
  sourceId: string
): VaultRecommendationFilterFact | undefined {
  return factIndex.get(instanceKey)?.get(canonicalVaultRecommendationSourceId(sourceId));
}

export function vaultRecommendationPrimaryFilterLabel(
  filter: VaultRecommendationPrimaryFilter,
  isDim: boolean
): string {
  if (filter === "all") return "全部";
  if (filter === "unrequired") return isDim ? "未指定组合" : "未要求";
  if (filter === "uncheckable") return "无法判断";
  if (filter === "uncovered") return "未收录";
  return filter;
}

export function compareVaultRecommendationMetricKeys(
  left: VaultRecommendationMetricKey,
  right: VaultRecommendationMetricKey
): number {
  const [leftMatched = 0, leftRequired = 1] = left.split("/").map(Number);
  const [rightMatched = 0, rightRequired = 1] = right.split("/").map(Number);
  const ratioDifference = rightMatched * leftRequired - leftMatched * rightRequired;
  return ratioDifference
    || rightRequired - leftRequired
    || rightMatched - leftMatched;
}

function recommendationFilterFactFromSummary(
  summary: VaultRecommendationSourceSummary
): VaultRecommendationFilterFact {
  if (isDimRecommendationSource(summary.sourceId)) {
    return {
      kind: "dim",
      primaryKey: summary.state === "uncheckable"
        ? "uncheckable"
        : summary.dimBestRequirementCount > 0
          ? `${summary.dimBestMatchedRequirementCount}/${summary.dimBestRequirementCount}`
          : "unrequired"
    };
  }
  const primaryKey: VaultRecommendationFilterFact["primaryKey"] = summary.perkRequirementCount === 0
    ? summary.state === "uncheckable" && summary.requirementCount > 0
      ? "uncheckable"
      : "unrequired"
    : summary.uncheckablePerkCount > 0
      ? "uncheckable"
      : `${summary.matchedPerkCount}/${summary.perkRequirementCount}`;
  return {
    kind: "curated",
    primaryKey,
    ...(summary.requirementCount > 0
      ? { completeKey: `${summary.matchedRequirementCount}/${summary.requirementCount}` as VaultRecommendationMetricKey }
      : {})
  };
}

export function buildVaultRecommendationSourceOptions(
  summaryGroups: ReadonlyArray<readonly VaultRecommendationSourceSummary[]>,
  managedSources: readonly VaultRecommendationManagedSourceOptionInput[] = []
): VaultRecommendationSourceOption[] {
  const options = new Map<string, VaultRecommendationSourceOption>();
  const managedSourcesById = new Map(managedSources.map((source) => (
    [canonicalVaultRecommendationSourceId(source.source_key), source] as const
  )));
  for (const source of managedSources) {
    if (!source.configured || source.state !== "active") continue;
    const sourceId = canonicalVaultRecommendationSourceId(source.source_key);
    if (!sourceOrder.has(sourceId)) continue;
    const sourceLabel = displayVaultRecommendationSourceLabel(sourceId, source.label);
    options.set(sourceId, {
      sourceId,
      sourceLabel,
      shortLabel: compactVaultRecommendationSourceLabel(sourceId, sourceLabel),
      count: 0
    });
  }
  for (const summaries of summaryGroups) {
    const summariesBySource = new Map(summaries.map((summary) => (
      [canonicalVaultRecommendationSourceId(summary.sourceId), summary] as const
    )));
    for (const summary of summariesBySource.values()) {
      const sourceId = canonicalVaultRecommendationSourceId(summary.sourceId);
      if (!sourceOrder.has(sourceId)) continue;
      const managedSource = managedSourcesById.get(sourceId);
      if (managedSource && (!managedSource.configured || managedSource.state !== "active")) continue;
      const existing = options.get(sourceId);
      if (existing) {
        existing.count += 1;
      } else {
        options.set(sourceId, {
          sourceId,
          sourceLabel: summary.sourceLabel,
          shortLabel: summary.shortLabel,
          count: 1
        });
      }
    }
  }
  return [...options.values()].sort((left, right) => (
    (sourceOrder.get(left.sourceId) ?? 99) - (sourceOrder.get(right.sourceId) ?? 99)
    || left.sourceLabel.localeCompare(right.sourceLabel, "zh-Hans-CN")
  ));
}

export function canonicalVaultRecommendationSourceId(sourceId: string): string {
  return sourceId === "dim_voltron" ? "dim_wishlist" : sourceId;
}

export function vaultRecommendationResultLabel(result: VaultRecommendationResult): string {
  if (result === "matched") return "符合推荐";
  if (result === "partial") return "部分符合";
  if (result === "not_matched") return "未符合";
  if (result === "uncheckable") return "无法判断";
  return "无推荐";
}

export function vaultSourceRecommendationResultLabel(result: VaultRecommendationResult): string {
  if (result === "matched") return "符合推荐";
  if (result === "partial") return "部分符合";
  if (result === "not_matched") return "未符合";
  if (result === "uncheckable") return "无法判断";
  return "未收录";
}

export function formatRecommendationPurposes(
  purposes: Array<"pve" | "pvp" | "general">
): string {
  const unique = [...new Set(purposes)];
  return unique.length
    ? unique.map((purpose) => purpose === "pve" ? "PVE" : purpose === "pvp" ? "PVP" : "通用").join(" / ")
    : "用途未注明";
}

function sourceMatchSummary(source: RecommendationSourceMatch): VaultRecommendationSourceSummary {
  const sourceLabel = displayVaultRecommendationSourceLabel(source.source_id, source.source_label);
  const shortSourceLabel = compactVaultRecommendationSourceLabel(source.source_id, sourceLabel);
  const presentation = presentCuratedRecommendationMatch(source, sourceLabel);
  return {
    sourceId: source.source_id,
    sourceLabel,
    shortLabel: shortSourceLabel,
    state: source.state,
    matched: presentation.matchedRequirementCount,
    available: presentation.requirementCount,
    matchedPerkCount: presentation.matchedPerkCount,
    perkRequirementCount: presentation.perkRequirementCount,
    uncheckablePerkCount: source.slots.filter((slot) => (
      (slot.slot === "perk1" || slot.slot === "perk2") && slot.state === "uncheckable"
    )).length,
    matchedRequirementCount: presentation.matchedRequirementCount,
    requirementCount: presentation.requirementCount,
    uncheckableRequirementCount: presentation.uncheckableRequirementCount,
    dimBestMatchedRequirementCount: 0,
    dimBestRequirementCount: 0,
    unit: "item",
    purposes: source.purposes,
    resultText: presentation.summary,
    text: `${shortSourceLabel}：${presentation.summary}`,
    detail: presentation.detail
  };
}

function cardSourceSummary(source: RecommendationCardSourceSummary): VaultRecommendationSourceSummary {
  const sourceLabel = displayVaultRecommendationSourceLabel(source.source_id, source.source_label);
  const shortSourceLabel = compactVaultRecommendationSourceLabel(source.source_id, sourceLabel);
  const resultText = source.state === "weapon_only" || source.requirement_count === 0
    ? "仅推荐武器 · 未指定 Roll"
    : `${source.perk_requirement_count > 0
        ? `Perk ${source.matched_perk_count}/${source.perk_requirement_count}`
        : "Perk 未要求"} · 完整 ${source.matched_requirement_count}/${source.requirement_count}${source.uncheckable_requirement_count > 0
          ? ` · ${source.uncheckable_requirement_count} 项无法判断`
          : ""}`;
  return {
    sourceId: source.source_id,
    sourceLabel,
    shortLabel: shortSourceLabel,
    state: source.state,
    matched: source.matched_requirement_count,
    available: source.requirement_count,
    matchedPerkCount: source.matched_perk_count,
    perkRequirementCount: source.perk_requirement_count,
    uncheckablePerkCount: source.uncheckable_perk_count,
    matchedRequirementCount: source.matched_requirement_count,
    requirementCount: source.requirement_count,
    uncheckableRequirementCount: source.uncheckable_requirement_count,
    dimBestMatchedRequirementCount: 0,
    dimBestRequirementCount: 0,
    unit: "item",
    purposes: source.purposes,
    resultText,
    text: `${shortSourceLabel}：${resultText}`,
    detail: source.state === "weapon_only" || source.requirement_count === 0
      ? `${sourceLabel}：来源推荐这把武器，但没有指定需要核对的 Roll。`
      : `${sourceLabel}：${resultText}。同栏候选任选其一，不同栏位分别核对。`
  };
}

function buildDimWishlistSummary(
  item: AccountItemSummary,
  wishlist?: DimWishlist | null
): VaultRecommendationSourceSummary | undefined {
  if (!wishlist || item.group_key !== "weapons") return undefined;
  const rules = dimRulesForItemHash(wishlist, item.hash);
  if (!rules.length) return undefined;
  const comboRules = rules.filter((rule) => rule.perk_hashes.length > 0);
  const weaponOnlyRules = rules.filter((rule) => rule.perk_hashes.length === 0);
  if (!comboRules.length) {
    return {
      sourceId: "dim_voltron",
      sourceLabel: "DIM社区愿望单",
      shortLabel: "DIM",
      state: "weapon_only",
      matched: 0,
      available: 0,
      matchedPerkCount: 0,
      perkRequirementCount: 0,
      uncheckablePerkCount: 0,
      matchedRequirementCount: 0,
      requirementCount: 0,
      uncheckableRequirementCount: 0,
      dimBestMatchedRequirementCount: 0,
      dimBestRequirementCount: 0,
      unit: "combo",
      purposes: [...new Set(weaponOnlyRules.map((rule) => rule.mode))],
      resultText: "仅推荐武器 · 未指定组合",
      text: "DIM：仅推荐武器 · 未指定组合",
      detail: "DIM社区愿望单：来源推荐这把武器，但没有指定需要核对的 Perk 组合。"
    };
  }
  const ownedHashes = new Set([
    ...(item.weapon_roll?.sockets.flatMap((socket) => socket.owned_plugs.map((plug) => plug.hash)) ?? []),
    ...(item.socket_plugs ?? []).map((plug) => plug.hash)
  ]);
  const ruleProgress = comboRules.map((rule) => ({
    rule,
    matched_requirement_count: rule.perk_hashes.reduce(
      (count, hash) => count + (ownedHashes.has(hash) ? 1 : 0),
      0
    ),
    requirement_count: rule.perk_hashes.length
  }));
  const matchedRules = ruleProgress
    .filter((progress) => progress.matched_requirement_count === progress.requirement_count)
    .map((progress) => progress.rule);
  const matched = matchedRules.length;
  const bestRule = selectBestDimCombination(ruleProgress);
  const missingRequirementCount = bestRule
    ? Math.max(0, bestRule.requirement_count - bestRule.matched_requirement_count)
    : 0;
  const isClose = Boolean(bestRule && bestRule.matched_requirement_count > 0 && missingRequirementCount > 0);
  const purposes = [...new Set((matchedRules.length ? matchedRules : rules).map((rule) => rule.mode))];
  const bestCombinationText = bestRule
    ? `最佳组合 ${bestRule.matched_requirement_count}/${bestRule.requirement_count}`
    : "未指定组合";
  const combinationResultText = `符合 ${matched} 套 · ${bestCombinationText}`;
  if (!matched && weaponOnlyRules.length) {
    return {
      sourceId: "dim_voltron",
      sourceLabel: "DIM社区愿望单",
      shortLabel: "DIM",
      state: "weapon_only",
      matched: 0,
      available: comboRules.length,
      matchedPerkCount: 0,
      perkRequirementCount: 0,
      uncheckablePerkCount: 0,
      matchedRequirementCount: bestRule?.matched_requirement_count ?? 0,
      requirementCount: bestRule?.requirement_count ?? 0,
      uncheckableRequirementCount: 0,
      dimBestMatchedRequirementCount: bestRule?.matched_requirement_count ?? 0,
      dimBestRequirementCount: bestRule?.requirement_count ?? 0,
      unit: "combo",
      purposes,
      resultText: combinationResultText,
      text: `DIM：${combinationResultText}`,
      detail: `DIM社区愿望单：${combinationResultText}；来源同时包含仅推荐武器的记录${isClose ? `；最接近的一套还缺 ${missingRequirementCount} 项` : ""}。`
    };
  }
  return {
    sourceId: "dim_voltron",
    sourceLabel: "DIM社区愿望单",
    shortLabel: "DIM",
    state: matched > 0 ? "full" : isClose ? "close" : "not_matched",
    matched,
    available: comboRules.length,
    matchedPerkCount: 0,
    perkRequirementCount: 0,
    uncheckablePerkCount: 0,
    matchedRequirementCount: bestRule?.matched_requirement_count ?? 0,
    requirementCount: bestRule?.requirement_count ?? 0,
    uncheckableRequirementCount: 0,
    dimBestMatchedRequirementCount: bestRule?.matched_requirement_count ?? 0,
    dimBestRequirementCount: bestRule?.requirement_count ?? 0,
    unit: "combo",
    purposes,
    resultText: combinationResultText,
    text: `DIM：${combinationResultText}`,
    detail: `DIM社区愿望单：${combinationResultText}${isClose ? `；最接近的一套还缺 ${missingRequirementCount} 项` : ""}。`
  };
}

function dimRulesForItemHash(wishlist: DimWishlist, itemHash: number): DimWishlist["rules"] {
  let rulesByItemHash = dimRulesByWishlist.get(wishlist);
  if (!rulesByItemHash) {
    rulesByItemHash = new Map<number, DimWishlist["rules"]>();
    wishlist.rules.forEach((rule) => {
      const existing = rulesByItemHash!.get(rule.item_hash);
      if (existing) existing.push(rule);
      else rulesByItemHash!.set(rule.item_hash, [rule]);
    });
    dimRulesByWishlist.set(wishlist, rulesByItemHash);
  }
  return rulesByItemHash.get(itemHash) ?? [];
}

function compareSourceSummaries(
  left: VaultRecommendationSourceSummary,
  right: VaultRecommendationSourceSummary
): number {
  const dimDifference = Number(isDimRecommendationSource(left.sourceId))
    - Number(isDimRecommendationSource(right.sourceId));
  if (dimDifference) return dimDifference;
  const rankDifference = summaryRank(left) - summaryRank(right);
  if (rankDifference) return rankDifference;
  const sourceDifference = (sourceOrder.get(left.sourceId) ?? 99) - (sourceOrder.get(right.sourceId) ?? 99);
  if (sourceDifference) return sourceDifference;
  return left.sourceLabel.localeCompare(right.sourceLabel, "zh-Hans-CN");
}

function summaryRank(summary: VaultRecommendationSourceSummary): number {
  if (summary.state === "full") return 0;
  if (summary.state === "core") return 1;
  if (summary.state === "close" || summary.state === "weapon_only") return 2;
  if (summary.state === "key_missing" || summary.state === "not_matched") return 3;
  return 4;
}

function isBetterSourceSummary(
  candidate: VaultRecommendationSourceSummary,
  current: VaultRecommendationSourceSummary
): boolean {
  const rankDifference = summaryRank(candidate) - summaryRank(current);
  if (rankDifference) return rankDifference < 0;
  if (candidate.matched !== current.matched) return candidate.matched > current.matched;
  if (candidate.available !== current.available) return candidate.available > current.available;
  return candidate.detail.length > current.detail.length;
}

export function displayVaultRecommendationSourceLabel(sourceId: string, sourceLabel?: string): string {
  if (sourceId === "aegis") return "Aegis推荐";
  if (sourceId === "lgpig") return "LGpig推荐";
  if (sourceId === "yxcrallxy") return "YXCRALLXY推荐表";
  if (sourceId === "sayalarry") return "Sayalarry推荐表";
  if (sourceId === "dim_voltron" || sourceId === "dim_wishlist") return "DIM社区愿望单";
  return sourceLabel || sourceId || "推荐来源";
}

function compactVaultRecommendationSourceLabel(sourceId: string, sourceLabel: string): string {
  if (sourceId === "aegis") return "Aegis";
  if (sourceId === "lgpig") return "LGpig";
  if (sourceId === "yxcrallxy") return "YXCRALLXY";
  if (sourceId === "sayalarry") return "Sayalarry";
  if (sourceId === "dim_voltron" || sourceId === "dim_wishlist") return "DIM";
  return sourceLabel.replace(/推荐表|推荐|社区愿望单/gu, "") || sourceLabel;
}
