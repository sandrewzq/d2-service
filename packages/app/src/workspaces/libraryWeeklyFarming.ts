import type { AccountItemSummary, AccountSummary } from "@d2-tools/core/account/summary";
import type { RecommendationCardSummary } from "@d2-tools/core/community-perks";
import {
  classifyWeeklyFarmingDecision,
  weeklyFarmingDecisionRank,
  type WeeklyFarmingCatalogItem,
  type WeeklyFarmingCatalogResource,
  type WeeklyFarmingDecision,
  type WeeklyFarmingPatternProgress
} from "@d2-tools/core/weekly/farming";
import type { VaultItemMatchInfo } from "./libraryPage.js";

export type LibraryWeeklyFarmingItemView = {
  item: WeeklyFarmingCatalogItem;
  decision: WeeklyFarmingDecision;
  decisionLabel: string;
  decisionDetail: string;
  recommendationLabel: string;
  recommendationKnown: boolean;
  recommendationCovered: boolean;
  ownedCount: number;
  ownedLocations: string[];
  bestInstance?: {
    instanceId?: string;
    label: string;
    detail: string;
    qualified: boolean;
  };
  patternLabel: string;
  patternDetail: string;
};

export type LibraryWeeklyFarmingActivityView = {
  key: string;
  kind: "raid" | "dungeon";
  title: string;
  coverage: "confirmed_activity_source" | "not_covered";
  coverageNote: string;
  rotationSource: string;
  itemCount: number;
  actionableCount: number;
  patternGapCount: number;
  satisfiedCount: number;
  items: LibraryWeeklyFarmingItemView[];
};

export type LibraryWeeklyFarmingView = {
  status: WeeklyFarmingCatalogResource["status"] | "loading" | "unavailable";
  isLoading: boolean;
  isRefreshingRotation: boolean;
  error: string;
  rotationError: string;
  recommendationError: string;
  resetAt?: string;
  fetchedAt?: string;
  revision?: string;
  manifestVersion?: string;
  verifiedManifestVersion?: string;
  warnings: string[];
  activityCount: number;
  itemCount: number;
  actionableCount: number;
  patternGapCount: number;
  satisfiedCount: number;
  activities: LibraryWeeklyFarmingActivityView[];
};

export function buildLibraryWeeklyFarmingView(input: {
  resource?: WeeklyFarmingCatalogResource | null;
  accountSummary?: AccountSummary | null;
  definitionMatches?: ReadonlyMap<number, VaultItemMatchInfo>;
  instanceMatches?: ReadonlyMap<string, RecommendationCardSummary>;
  instanceRecommendationReady?: boolean;
  isLoading?: boolean;
  isRefreshingRotation?: boolean;
  error?: string;
  rotationError?: string;
  recommendationError?: string;
}): LibraryWeeklyFarmingView {
  const resource = input.resource ?? null;
  const accountItems = collectAccountItems(input.accountSummary);
  const itemsByHash = groupAccountItemsByHash(accountItems);
  const definitionMatches = input.definitionMatches ?? new Map();
  const instanceMatches = input.instanceMatches ?? new Map();
  const activities = (resource?.activities ?? []).map((activity): LibraryWeeklyFarmingActivityView => {
    const items = activity.items.map((item) => {
      const owned = itemsByHash.get(item.hash) ?? [];
      const definitionMatch = definitionMatches.get(item.hash);
      const recommendationCovered = Boolean(definitionMatch && (definitionMatch.available ?? 0) > 0);
      const bestInstanceMatch = bestRecommendationMatch(owned, instanceMatches);
      const visibleBestInstance = bestInstanceMatch && owned.length > 0
        ? input.instanceRecommendationReady === true || bestInstanceMatch.qualified
          ? bestInstanceMatch
          : { ...bestInstanceMatch, label: "实例推荐仍在核对" }
        : bestInstanceMatch;
      const recommendationKnown = Boolean(definitionMatch)
        && !input.recommendationError
        && (
          owned.length === 0
          || input.instanceRecommendationReady === true
          || bestInstanceMatch?.qualified === true
        );
      const decision = classifyWeeklyFarmingDecision({
        recommendationCovered,
        recommendationKnown,
        hasQualifiedRoll: bestInstanceMatch?.qualified === true,
        ownedCount: owned.length,
        pattern: item.pattern
      });
      return {
        item,
        decision,
        decisionLabel: decisionLabel(decision),
        decisionDetail: decisionDetail(decision, item.pattern, owned.length),
        recommendationLabel: recommendationLabel(definitionMatch, input.isLoading === true, input.recommendationError ?? ""),
        recommendationKnown,
        recommendationCovered,
        ownedCount: owned.length,
        ownedLocations: summarizeLocations(owned, input.accountSummary),
        bestInstance: visibleBestInstance,
        patternLabel: patternLabel(item.pattern),
        patternDetail: patternDetail(item.pattern)
      };
    }).sort((left, right) => (
      weeklyFarmingDecisionRank(left.decision) - weeklyFarmingDecisionRank(right.decision)
      || left.item.name.localeCompare(right.item.name, "zh-CN")
      || left.item.hash - right.item.hash
    ));
    return {
      key: activity.key,
      kind: activity.kind,
      title: activity.title,
      coverage: activity.coverage,
      coverageNote: activity.coverage_note,
      rotationSource: activity.rotation_source,
      itemCount: items.length,
      actionableCount: items.filter(isActionable).length,
      patternGapCount: items.filter((item) => item.item.pattern.status === "in_progress").length,
      satisfiedCount: items.filter(isSatisfied).length,
      items
    };
  }).sort((left, right) => (
    weeklyFarmingActivityRank(left.kind) - weeklyFarmingActivityRank(right.kind)
    || left.key.localeCompare(right.key, "en")
  ));
  const allItems = activities.flatMap((activity) => activity.items);
  return {
    status: resource?.status ?? (input.isLoading ? "loading" : "unavailable"),
    isLoading: input.isLoading === true,
    isRefreshingRotation: input.isRefreshingRotation === true,
    error: input.error ?? "",
    rotationError: input.rotationError ?? "",
    recommendationError: input.recommendationError ?? "",
    resetAt: resource?.reset_at,
    fetchedAt: resource?.fetched_at,
    revision: resource?.revision,
    manifestVersion: resource?.manifest_version,
    verifiedManifestVersion: resource?.verified_manifest_version,
    warnings: resource?.warnings ?? [],
    activityCount: activities.length,
    itemCount: allItems.length,
    actionableCount: allItems.filter(isActionable).length,
    patternGapCount: allItems.filter((item) => item.item.pattern.status === "in_progress").length,
    satisfiedCount: allItems.filter(isSatisfied).length,
    activities
  };
}

function weeklyFarmingActivityRank(kind: LibraryWeeklyFarmingActivityView["kind"]): number {
  return kind === "raid" ? 0 : 1;
}

function collectAccountItems(summary: AccountSummary | null | undefined): AccountItemSummary[] {
  if (!summary) return [];
  return [
    ...summary.vault.items,
    ...summary.characters.flatMap((character) => [
      ...character.equipped_items,
      ...character.inventory_items,
      ...character.postmaster_items
    ])
  ];
}

function groupAccountItemsByHash(items: AccountItemSummary[]): Map<number, AccountItemSummary[]> {
  const result = new Map<number, AccountItemSummary[]>();
  for (const item of items) {
    const group = result.get(item.hash) ?? [];
    group.push(item);
    result.set(item.hash, group);
  }
  return result;
}

function bestRecommendationMatch(
  items: AccountItemSummary[],
  matches: ReadonlyMap<string, RecommendationCardSummary>
): LibraryWeeklyFarmingItemView["bestInstance"] {
  const candidates = items.flatMap((item) => {
    const match = item.instance_id ? matches.get(item.instance_id) : undefined;
    if (!match) return [];
    const qualified = match.match_status === "full_match"
      || match.sources.some((source) => source.state === "full" || source.state === "core")
      || match.dim?.state === "full";
    const source = match.sources.find((entry) => entry.state === "full" || entry.state === "core")
      ?? match.sources[0];
    const score = qualified ? 100 : match.match_status === "partial_match" ? 50 : match.partial;
    return [{
      score,
      instanceId: item.instance_id,
      qualified,
      label: qualified ? "已有合格实例" : match.coverage === "covered" ? "当前最佳仍有缺口" : "实例暂无推荐覆盖",
      detail: source
        ? `${source.source_label} · ${source.matched_requirement_count}/${source.requirement_count}`
        : match.available > 0
          ? `${match.matched}/${match.available} 个推荐 Perk 命中`
          : "未读取到可比较的推荐要求"
    }];
  });
  return candidates.sort((left, right) => right.score - left.score)[0];
}

function recommendationLabel(match: VaultItemMatchInfo | undefined, loading: boolean, error: string): string {
  if (match && (match.available ?? 0) > 0) return match.source_label || `${match.available} 条 T20 推荐要求`;
  if (match) return "暂无 T20 推荐覆盖";
  if (loading) return "正在核对 T20 推荐";
  return error ? "推荐状态无法确认" : "推荐数据尚未读取";
}

function summarizeLocations(items: AccountItemSummary[], summary: AccountSummary | null | undefined): string[] {
  if (!summary || !items.length) return [];
  const instanceIds = new Set(items.flatMap((item) => item.instance_id ? [item.instance_id] : []));
  const labels: string[] = [];
  const vaultCount = summary.vault.items.filter((item) => item.instance_id && instanceIds.has(item.instance_id)).length;
  if (vaultCount) labels.push(`仓库 ${vaultCount}`);
  for (const character of summary.characters) {
    const carried = [...character.equipped_items, ...character.inventory_items]
      .filter((item) => item.instance_id && instanceIds.has(item.instance_id)).length;
    const postmaster = character.postmaster_items
      .filter((item) => item.instance_id && instanceIds.has(item.instance_id)).length;
    if (carried) labels.push(`${character.class_name} ${carried}`);
    if (postmaster) labels.push(`${character.class_name}邮政官 ${postmaster}`);
  }
  return labels;
}

function isActionable(item: LibraryWeeklyFarmingItemView): boolean {
  return item.decision === "complete_pattern" || item.decision === "worth_farming";
}

function isSatisfied(item: LibraryWeeklyFarmingItemView): boolean {
  return item.decision === "satisfied" || item.decision === "qualified_roll";
}

function decisionLabel(decision: WeeklyFarmingDecision): string {
  switch (decision) {
    case "complete_pattern": return "继续补图样";
    case "worth_farming": return "值得继续刷";
    case "qualified_roll": return "已有合格 Roll";
    case "satisfied": return "当前已满足";
    case "information_insufficient": return "信息不足";
  }
}

function decisionDetail(decision: WeeklyFarmingDecision, pattern: WeeklyFarmingPatternProgress, ownedCount: number): string {
  switch (decision) {
    case "complete_pattern":
      return pattern.status === "in_progress" ? `T20 有推荐覆盖，图样还差 ${pattern.remaining} 个。` : "T20 有推荐覆盖，图样仍未完成。";
    case "worth_farming":
      return ownedCount ? "账号已有实例，但没有一把达到当前推荐要求。" : "T20 有推荐覆盖，账号尚未持有这个版本。";
    case "qualified_roll": return "账号里至少有一把实例达到 T20 的正式匹配条件。";
    case "satisfied": return "图样已完成，并且账号已有满足推荐条件的实例。";
    case "information_insufficient": return "当前推荐、图样或实例证据不足，系统不替玩家猜测是否毕业。";
  }
}

function patternLabel(pattern: WeeklyFarmingPatternProgress): string {
  switch (pattern.status) {
    case "not_craftable": return "不可制作";
    case "in_progress": return `${pattern.progress} / ${pattern.completion_value}`;
    case "complete": return "图样已完成";
    case "unavailable": return "图样无法确认";
  }
}

function patternDetail(pattern: WeeklyFarmingPatternProgress): string {
  switch (pattern.status) {
    case "not_craftable": return "当前装备定义没有制作图样。";
    case "in_progress": return `还差 ${pattern.remaining} 个图样进度。`;
    case "complete": return "Bungie ProfileRecords 已确认完成。";
    case "unavailable":
      return pattern.reason === "entitlement_unowned"
        ? "当前账号未拥有对应内容权限。"
        : pattern.reason === "record_hidden"
          ? "Bungie 当前隐藏了该图样记录。"
          : pattern.reason === "read_failed"
            ? "本次 Bungie 图样读取失败。"
            : "Bungie 没有返回可解释的图样目标。";
  }
}
