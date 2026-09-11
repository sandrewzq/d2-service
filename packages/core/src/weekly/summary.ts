export type WeeklySourceStatus = "ready" | "pending";

export type WeeklyPriorityKind =
  | "nightfall"
  | "rotating_raid"
  | "rotating_dungeon"
  | "weekly_surge"
  | "special_event";

export type WeeklySummaryItem = {
  title: string;
  subtitle?: string;
  description?: string;
  source?: string;
  weeklyActivityKind?: WeeklyPriorityKind | "public_clue";
  related_hashes?: number[];
  rewards?: WeeklyActivityReward[];
  loot_pool?: WeeklyActivityReward[];
  characters?: WeeklyActivityCharacterState[];
};

export type WeeklyActivityReward = {
  hash: number;
  name: string;
  icon?: string;
  item_type?: string;
  group_key?: "weapons" | "armor" | "equipment" | "other";
};

export type WeeklyIronBannerChallenge = {
  objective_hash?: number;
  progress: number;
  completion_value: number;
  complete: boolean;
  progress_label?: string;
  description?: string;
};

export type WeeklyActivityCharacterState = {
  character_id: string;
  challenge?: WeeklyIronBannerChallenge;
};

export type WeeklyIronBannerCharacter = {
  character_id: string;
  activity_hash?: number;
  challenge?: WeeklyIronBannerChallenge;
};

export type WeeklyIronBannerRewardGroup = {
  display_behavior?: number;
  label: string;
  note: string;
  conditional: boolean;
  items: WeeklyActivityReward[];
};

export type WeeklyIronBannerLootItem = WeeklyActivityReward & {
  cost_label?: string;
};

export type WeeklyIronBannerLootPool = {
  status: "ready" | "pending";
  source: string;
  refresh_at?: string;
  attunement_count: number;
  weapon_offer_count: number;
  armor_offer_count: number;
  featured_items: WeeklyIronBannerLootItem[];
};

export type WeeklyIronBannerSummary = {
  status: "active" | "upcoming" | "inactive" | "unavailable";
  title: string;
  detail: string;
  starts_at?: string;
  ends_at?: string;
  next_refresh_at?: string;
  timing_source?: string;
  activity_name?: string;
  activity_icon?: string;
  playlist_name?: string;
  evidence?: string;
  source?: string;
  related_hashes?: number[];
  characters: {
    available_count: number;
    total_count: number;
    entries: Record<string, WeeklyIronBannerCharacter>;
  };
  reward_groups: WeeklyIronBannerRewardGroup[];
  loot_pool: WeeklyIronBannerLootPool;
};

export type WeeklyActivityEntry = {
  title: string;
  detail?: string;
  evidence?: string;
  source?: string;
  related_hashes?: number[];
  rewards?: WeeklyActivityReward[];
  loot_pool?: WeeklyActivityReward[];
  characters?: WeeklyActivityCharacterState[];
};

export type WeeklySummaryPriority = {
  status: WeeklySourceStatus;
  title: string;
  detail: string;
  evidence?: string;
  source?: string;
  entries?: WeeklyActivityEntry[];
};

export type WeeklySummary = {
  weekly_reset: {
    label: string;
    next_reset_iso: string;
    time_remaining_label: string;
  };
  priorities: Record<WeeklyPriorityKind, WeeklySummaryPriority>;
  iron_banner: WeeklyIronBannerSummary;
  public_clues: WeeklySummaryItem[];
};

export type WeeklyLiveData = {
  items?: WeeklySummaryItem[];
  iron_banner?: WeeklyIronBannerSummary;
  public_clues?: WeeklySummaryItem[];
};

export type WeeklySummaryOptions = {
  timeZone?: string;
};

const weeklyResetDayUtc = 2; // Tuesday
const weeklyResetHourUtc = 17;

const priorityLabels: Record<WeeklyPriorityKind, { pendingTitle: string; pendingDetail: string }> = {
  nightfall: {
    pendingTitle: "宗师先锋警戒待确认",
    pendingDetail: "等待 Bungie 角色活动来源接入。"
  },
  rotating_raid: {
    pendingTitle: "轮换突袭待确认",
    pendingDetail: "确认后展示可刷奖励状态。"
  },
  rotating_dungeon: {
    pendingTitle: "轮换地牢待确认",
    pendingDetail: "确认后展示可刷奖励状态。"
  },
  weekly_surge: {
    pendingTitle: "本周活动激涌待确认",
    pendingDetail: "登录 Bungie 后读取当前活动实际返回的元素激涌。"
  },
  special_event: {
    pendingTitle: "暂无可确认特殊活动",
    pendingDetail: "只显示已确认的限时活动。"
  }
};

export function buildWeeklySummary(
  now = new Date(),
  liveData: WeeklyLiveData = {},
  options: WeeklySummaryOptions = {}
): WeeklySummary {
  const timeZone = options.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  const nextWeeklyReset = nextWeeklyResetDate(now);
  const items = liveData.items ?? [];

  return {
    weekly_reset: {
      label: `每周重置：${formatChineseDateTime(nextWeeklyReset, timeZone)}`,
      next_reset_iso: nextWeeklyReset.toISOString(),
      time_remaining_label: formatRemaining("每周重置", now, nextWeeklyReset)
    },
    priorities: {
      nightfall: buildPriority("nightfall", items),
      rotating_raid: buildPriority("rotating_raid", items),
      rotating_dungeon: buildPriority("rotating_dungeon", items),
      weekly_surge: buildPriority("weekly_surge", items),
      special_event: buildPriority("special_event", items)
    },
    iron_banner: liveData.iron_banner ?? createUnavailableIronBanner(),
    public_clues: (liveData.public_clues ?? [])
      .filter((item) => item.title.trim())
      .slice(0, 4)
  };
}

function createUnavailableIronBanner(): WeeklyIronBannerSummary {
  return {
    status: "unavailable",
    title: "铁旗状态待确认",
    detail: "登录 Bungie 并完成资料库初始化后读取当前铁旗轮换。",
    characters: {
      available_count: 0,
      total_count: 0,
      entries: {}
    },
    reward_groups: [],
    loot_pool: {
      status: "pending",
      source: "等待 Bungie Character Vendors",
      attunement_count: 0,
      weapon_offer_count: 0,
      armor_offer_count: 0,
      featured_items: []
    }
  };
}

function buildPriority(kind: WeeklyPriorityKind, items: WeeklySummaryItem[]): WeeklySummaryPriority {
  const matchingItems = items.filter((candidate) => candidate.weeklyActivityKind === kind && isConfirmedPriorityItem(kind, candidate));
  const item = matchingItems[0];
  if (!item) {
    const pending = priorityLabels[kind];
    return {
      status: "pending",
      title: pending.pendingTitle,
      detail: pending.pendingDetail
    };
  }

  return {
    status: "ready",
    title: extractPriorityTitle(kind, item),
    detail: [item.subtitle, item.description].filter(Boolean).join(" · ") || "本周来源已确认。",
    evidence: item.source,
    source: item.source,
    entries: matchingItems.map((candidate) => ({
      title: extractPriorityTitle(kind, candidate),
      detail: [candidate.subtitle, candidate.description].filter(Boolean).join(" · ") || undefined,
      evidence: candidate.source,
      source: candidate.source,
      related_hashes: candidate.related_hashes,
      rewards: candidate.rewards,
      loot_pool: candidate.loot_pool,
      characters: candidate.characters
    }))
  };
}

function isConfirmedPriorityItem(kind: WeeklyPriorityKind, item: WeeklySummaryItem): boolean {
  if (kind !== "rotating_raid" && kind !== "rotating_dungeon") {
    return true;
  }
  return !/Bungie.*(?:公共|public)|公共里程碑|非完整掉落地图/i.test(weeklyItemText(item));
}

function weeklyItemText(item: WeeklySummaryItem): string {
  return [item.title, item.subtitle, item.description, item.source].filter(Boolean).join(" ");
}

function extractPriorityTitle(kind: WeeklyPriorityKind, item: WeeklySummaryItem): string {
  if (kind === "rotating_raid") {
    return extractKnownActivityName(item, isKnownRaid) || sanitizeWeeklyText(item.title);
  }
  if (kind === "rotating_dungeon") {
    return extractKnownActivityName(item, isKnownDungeon) || sanitizeWeeklyText(item.title);
  }
  return sanitizeWeeklyText(item.title);
}

function extractKnownActivityName(item: WeeklySummaryItem, matcher: (value: string) => boolean): string {
  const candidates = [item.subtitle, item.title, item.description, item.source]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => splitWeeklyActivityCandidates(value));
  return candidates.find((candidate) => matcher(candidate)) ?? "";
}

function splitWeeklyActivityCandidates(value: string): string[] {
  return value
    .split(/[；;，,、/]|\s+\/\s+/)
    .map((part) => part.trim())
    .map((part) => part.replace(/^非完整掉落地图[:：]?\s*/i, ""))
    .map((part) => part.replace(/^Bungie\s*公共(?:里程碑|数据)[:：]?\s*/i, ""))
    .filter(Boolean);
}

function sanitizeWeeklyText(value: string | undefined): string {
  return (value ?? "")
    .replace(/^Bungie\s*公共(?:里程碑|数据)[:：]?\s*/i, "")
    .replace(/^非完整掉落地图[:：]?\s*/i, "")
    .trim();
}

function isKnownRaid(value: string): boolean {
  return /国王的陨落|克洛塔的末日|深岩墓室|玻璃拱顶|救赎花园|最后一愿|门徒誓约|梦魇根源|救赎边缘|King'?s Fall|Crota'?s End|Deep Stone Crypt|Vault of Glass|Garden of Salvation|Last Wish|Vow of the Disciple|Root of Nightmares|Salvation'?s Edge/i.test(value);
}

function isKnownDungeon(value: string): boolean {
  return /守望者尖塔|预言|二象性|贪婪之握|异端深渊|破碎王座|战争领主的废墟|鬼魅深渊|Spire of the Watcher|Prophecy|Duality|Grasp of Avarice|Pit of Heresy|Shattered Throne|Warlord'?s Ruin|Ghosts of the Deep/i.test(value);
}

function nextWeeklyResetDate(now: Date): Date {
  const daily = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    weeklyResetHourUtc,
    0,
    0,
    0
  ));
  const daysUntilTuesday = (weeklyResetDayUtc - daily.getUTCDay() + 7) % 7;
  const weekly = new Date(daily);
  weekly.setUTCDate(daily.getUTCDate() + daysUntilTuesday);
  if (weekly <= now) {
    weekly.setUTCDate(weekly.getUTCDate() + 7);
  }
  return weekly;
}

function formatRemaining(prefix: string, now: Date, target: Date): string {
  const diffMs = Math.max(target.getTime() - now.getTime(), 0);
  const totalMinutes = Math.ceil(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `距离${prefix}还有 ${days} 天 ${hours} 小时`;
  if (hours > 0) return `距离${prefix}还有 ${hours} 小时 ${minutes} 分钟`;
  return `距离${prefix}还有 ${minutes} 分钟`;
}

function formatChineseDateTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}
