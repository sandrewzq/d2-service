import type {
  WeeklyActivityEntry,
  WeeklyPriorityKind,
  WeeklySummary
} from "@d2-tools/core/weekly/summary";
import type { CharacterPowerView } from "./accountPower.js";

export type AccountPowerRouteRewardTier = "pinnacle" | "powerful" | "unknown";
export type AccountPowerRouteItemStatus = "available" | "completed" | "unavailable" | "unknown";

export type AccountPowerRouteItemView = {
  key: string;
  activityName: string;
  activityTypeLabel: string;
  rewardLabel: string;
  rewardTier: AccountPowerRouteRewardTier;
  status: AccountPowerRouteItemStatus;
  statusLabel: string;
  progressLabel?: string;
  valueLabel: string;
  reason: string;
  sourceLabel: string;
};

export type AccountPowerRouteView = {
  status: "ready" | "partial" | "unavailable";
  baselineLabel: string;
  lowSlotLabels: string[];
  availableCount: number;
  items: AccountPowerRouteItemView[];
  sourceLabel: string;
  isRefreshing: boolean;
  errorMessage?: string;
};

const powerRouteKinds = ["nightfall", "rotating_raid", "rotating_dungeon"] as const satisfies readonly WeeklyPriorityKind[];
type PowerRouteKind = (typeof powerRouteKinds)[number];

const activityTypeLabels: Record<PowerRouteKind, string> = {
  nightfall: "日落挑战",
  rotating_raid: "周常突袭",
  rotating_dungeon: "周常地牢"
};

export function buildAccountPowerRoute(input: {
  characterId: string;
  power: CharacterPowerView;
  weeklySummary: WeeklySummary | null;
}): AccountPowerRouteView {
  const lowSlots = input.power.dropBaseline.rows.filter((row) => (
    typeof row.delta === "number" && row.delta < 0
  ));
  const lowSlotLabels = lowSlots.map((row) => `${row.label}低 ${Math.abs(row.delta!)}`);
  const base = {
    baselineLabel: input.power.dropBaseline.label,
    lowSlotLabels,
    sourceLabel: input.weeklySummary?.weekly_reset.label ?? "等待 Bungie 周奖励数据"
  };

  if (!input.weeklySummary) {
    return {
      ...base,
      status: "unavailable",
      availableCount: 0,
      items: [],
      isRefreshing: false
    };
  }

  const allItems = powerRouteKinds.flatMap((kind) => {
    const priority = input.weeklySummary!.priorities[kind];
    return (priority.entries ?? []).map((entry, index) => buildRouteItem({
      characterId: input.characterId,
      entry,
      kind,
      index,
      power: input.power,
      lowSlotLabels
    }));
  });
  const items = allItems
    .filter((item) => item.rewardTier !== "unknown")
    .sort(compareRouteItems);
  const hasPendingSource = powerRouteKinds.some((kind) => input.weeklySummary!.priorities[kind].status !== "ready");
  const hasUnknownItem = items.some((item) => item.status === "unknown");

  return {
    ...base,
    status: !hasPendingSource && !hasUnknownItem ? "ready" : "partial",
    availableCount: items.filter((item) => item.status === "available" && item.rewardTier !== "unknown").length,
    items,
    isRefreshing: false
  };
}

function buildRouteItem(input: {
  characterId: string;
  entry: WeeklyActivityEntry;
  kind: PowerRouteKind;
  index: number;
  power: CharacterPowerView;
  lowSlotLabels: string[];
}): AccountPowerRouteItemView {
  const characterState = input.entry.characters?.find((state) => state.character_id === input.characterId);
  const challenge = characterState?.challenge;
  const rewardTier = classifyRewardTier(input.entry);
  const status: AccountPowerRouteItemStatus = !characterState
    ? "unknown"
    : challenge
    ? challenge.complete ? "completed" : "available"
    : "unavailable";

  return {
    key: `${input.kind}-${input.entry.related_hashes?.[0] ?? input.index}-${input.characterId}`,
    activityName: input.entry.title,
    activityTypeLabel: activityTypeLabels[input.kind],
    rewardLabel: rewardLabel(input.entry, rewardTier),
    rewardTier,
    status,
    statusLabel: status === "available"
      ? "本周可做"
      : status === "completed"
        ? "本周已完成"
        : status === "unavailable"
          ? "当前无可领取挑战"
          : "角色状态待确认",
    progressLabel: challenge?.progress_label,
    valueLabel: routeValueLabel(rewardTier, status, input.power, input.lowSlotLabels),
    reason: routeReason(rewardTier, status, input.power, input.lowSlotLabels),
    sourceLabel: input.entry.source ?? input.entry.evidence ?? "Bungie CharacterActivities"
  };
}

function classifyRewardTier(entry: WeeklyActivityEntry): AccountPowerRouteRewardTier {
  const rewardNames = (entry.rewards ?? []).map((reward) => reward.name.trim());
  if (rewardNames.some((name) => /^(?:巅峰装备|高阶装备|Pinnacle Gear)(?:\s|$)/i.test(name))) return "pinnacle";
  if (rewardNames.some((name) => /^(?:强力装备|Powerful Gear)(?:\s|$)/i.test(name))) return "powerful";
  return "unknown";
}

function rewardLabel(entry: WeeklyActivityEntry, tier: AccountPowerRouteRewardTier): string {
  const matchingRewards = (entry.rewards ?? []).filter((reward) => (
    tier === "pinnacle"
      ? /^(?:巅峰装备|高阶装备|Pinnacle Gear)(?:\s|$)/i.test(reward.name.trim())
      : tier === "powerful"
        ? /^(?:强力装备|Powerful Gear)(?:\s|$)/i.test(reward.name.trim())
        : true
  ));
  if (matchingRewards.length) return matchingRewards.slice(0, 2).map((reward) => reward.name).join(" / ");
  return tier === "pinnacle" ? "巅峰装备" : tier === "powerful" ? "强力装备" : "奖励类型待确认";
}

function routeValueLabel(
  tier: AccountPowerRouteRewardTier,
  status: AccountPowerRouteItemStatus,
  power: CharacterPowerView,
  lowSlotLabels: string[]
): string {
  if (status === "completed") return "本周奖励已完成";
  if (status === "unavailable") return "当前不可执行";
  if (status === "unknown" || tier === "unknown") return "无法确认提光价值";
  if (!power.dropBaseline.complete) return "等待完整光等数据";
  return lowSlotLabels.length ? "可能补齐低光槽位" : "仍有提光机会";
}

function routeReason(
  tier: AccountPowerRouteRewardTier,
  status: AccountPowerRouteItemStatus,
  power: CharacterPowerView,
  lowSlotLabels: string[]
): string {
  if (status === "completed") return "该角色本周已经完成这项挑战，不再列为下一步。";
  if (status === "unavailable") return "Bungie 当前没有为该角色返回可领取挑战；可能已经完成或当前不可用，不列为下一步。";
  if (status === "unknown") return "Bungie 没有返回该角色对应挑战的完成状态，暂不推荐执行。";
  if (tier === "unknown") return "奖励名称未明确标注强力或巅峰，不能仅凭活动名称猜测它会提光。";
  if (!power.dropBaseline.complete) return "奖励类型已确认，但账号奖励掉落基准不完整，暂不能判断提升空间。";
  if (lowSlotLabels.length) {
    return `${lowSlotLabels.slice(0, 3).join("、")}；奖励掉落槽位随机，仍可能补齐低光槽位。`;
  }
  return "八槽当前齐平；该奖励仍可能高于当前基准，具体提升取决于实际掉落。";
}

function compareRouteItems(left: AccountPowerRouteItemView, right: AccountPowerRouteItemView): number {
  const rank = (item: AccountPowerRouteItemView): number => {
    if (item.status === "available" && item.rewardTier === "pinnacle") return 0;
    if (item.status === "available" && item.rewardTier === "powerful") return 1;
    if (item.status === "completed" && item.rewardTier !== "unknown") return 2;
    if (item.status === "unavailable" && item.rewardTier !== "unknown") return 3;
    return 4;
  };
  return rank(left) - rank(right)
    || left.activityTypeLabel.localeCompare(right.activityTypeLabel, "zh-CN")
    || left.activityName.localeCompare(right.activityName, "zh-CN")
    || left.key.localeCompare(right.key);
}
