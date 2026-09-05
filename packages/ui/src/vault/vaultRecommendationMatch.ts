import type { AccountItemSummary } from "@d2-tools/core/account/summary";
import type { DimWishlist } from "@d2-tools/core/analysis/wishlistImport";
import type {
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

export function getVaultCommunityInstanceKey(item: AccountItemSummary): string {
  return item.instance_id ?? `hash:${item.hash}`;
}

export function buildVaultRecommendationSourceSummaries(
  item: AccountItemSummary,
  instanceMatch?: VaultItemInstanceMatchInfo,
  wishlist?: DimWishlist | null
): VaultRecommendationSourceSummary[] {
  const summaries = (instanceMatch?.source_matches ?? [])
    .filter((source) => (
      source.source_id !== "dim_voltron"
      && source.source_id !== "dim_wishlist"
    ))
    .map(sourceMatchSummary);
  // DIM 必须按完整愿望单组合核对。CSV 中为阅读汇总而展开的 dim_voltron
  // 候选池不能伪装成人工来源栏位，否则会把不同组合错误拼成 x/y。
  const dimSummary = instanceMatch
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
  wishlist?: DimWishlist | null
): Map<string, VaultRecommendationSourceSummary[]> {
  const index = new Map<string, VaultRecommendationSourceSummary[]>();
  for (const item of items) {
    if (item.group_key !== "weapons") continue;
    const instanceKey = getVaultCommunityInstanceKey(item);
    index.set(
      instanceKey,
      buildVaultRecommendationSourceSummaries(item, instanceMatchMap?.get(instanceKey), wishlist)
    );
  }
  return index;
}

function buildDimInstanceSummary(
  match: NonNullable<VaultItemInstanceMatchInfo["dim_wishlist"]>
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
  const summary = summaries.find((candidate) => (
    canonicalVaultRecommendationSourceId(candidate.sourceId) === canonicalSourceId
  ));
  if (!summary) return "uncovered";
  if (summary.state === "uncheckable") return "uncheckable";
  if (summary.state === "full" || summary.state === "core") return "matched";
  if (summary.state === "close" || summary.state === "weapon_only") return "partial";
  if (summary.state === "key_missing" || summary.state === "not_matched") return "not_matched";
  if (summary.matched > 0) return "partial";
  return "not_matched";
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
    unit: "item",
    purposes: source.purposes,
    resultText: presentation.summary,
    text: `${shortSourceLabel}：${presentation.summary}`,
    detail: presentation.detail
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
