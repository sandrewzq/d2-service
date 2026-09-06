export type DailySourceStatus = "ready" | "pending";

export type DailySummaryItem = {
  title: string;
  itemHash?: number;
  subtitle?: string;
  description?: string;
  source?: string;
  weeklyActivityKind?: "nightfall" | "rotating_raid" | "rotating_dungeon" | "weekly_bonus" | "special_event" | "public_clue";
  destinationName?: string;
  championTypes?: string[];
  shieldTypes?: string[];
  threatType?: string;
  expertSoloRewards?: string[];
  masterSoloRewards?: string[];
  vendorHash?: number;
  characterId?: string;
  vendorEnabled?: boolean;
  vendorRefreshDate?: string;
  vendorLocation?: string;
  iconUrl?: string;
  icon?: string;
  iconLabel?: string;
  costIconUrl?: string;
  classType?: number;
  items?: DailySummaryItem[];
};

export type DailySummarySource = {
  status: DailySourceStatus;
  label: string;
  message: string;
  items?: DailySummaryItem[];
};

export type DailySummary = {
  date_label: string;
  daily_reset: {
    label: string;
    next_reset_iso: string;
    time_remaining_label: string;
  };
  weekly_reset: {
    label: string;
    next_reset_iso: string;
    time_remaining_label: string;
  };
  sources: {
    rotations: DailySummarySource;
    vendors: DailySummarySource;
    lost_sector: DailySummarySource;
    weekly_report: DailySummarySource;
  };
  checklist: string[];
  recommendations: string[];
};

export type DailyLiveData = Partial<Record<keyof DailySummary["sources"], DailySummaryItem[]>>;

export type DailySummaryOptions = {
  timeZone?: string;
};

const dailyResetHourUtc = 17;
const weeklyResetDayUtc = 2; // Tuesday

export function buildDailySummary(
  now = new Date(),
  liveData: DailyLiveData = {},
  options: DailySummaryOptions = {}
): DailySummary {
  const timeZone = options.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  const nextDailyReset = nextDailyResetDate(now);
  const nextWeeklyReset = nextWeeklyResetDate(now);

  return {
    date_label: formatDate(now, timeZone),
    daily_reset: {
      label: `每日重置：${formatChineseDateTime(nextDailyReset, timeZone)}`,
      next_reset_iso: nextDailyReset.toISOString(),
      time_remaining_label: formatRemaining("每日重置", now, nextDailyReset)
    },
    weekly_reset: {
      label: `每周重置：${formatChineseDateTime(nextWeeklyReset, timeZone)}`,
      next_reset_iso: nextWeeklyReset.toISOString(),
      time_remaining_label: formatRemaining("每周重置", now, nextWeeklyReset)
    },
    sources: {
      rotations: sourceFromItems("今日轮换", liveData.rotations, "暂时没有可读的今日轮换名称，只显示重置时间。"),
      vendors: sourceFromItems("商人库存", liveData.vendors, "商人接口没有返回可读名称，暂不展示 hash。", 20),
      lost_sector: sourceFromItems("遗失区域", liveData.lost_sector, "今日遗失区域暂不可读，不展示猜测数据。", 9),
      weekly_report: sourceFromItems("本周活动线索", liveData.weekly_report, "本周活动线索暂不可读，不展示猜测数据。")
    },
    checklist: [
      "先同步账号，确认角色、仓库和材料数量。",
      "查看今日轮换、遗失区域和商人库存。",
      "检查仓库清理装备和疑似好 roll。",
      "查看本地方案，确认常用装备是否在角色身上。",
      "同步账号后查看最近活动和 Raid/Dungeon 摘要。"
    ],
    recommendations: [
      "今日面板只展示可读真实数据；看不到名字的 Bungie hash 会被隐藏。",
      "如果商人、遗失区域为空，先用仓库整理和资料库搜索继续测试。"
    ]
  };
}

function sourceFromItems(
  label: string,
  items: DailySummaryItem[] | undefined,
  pendingMessage: string,
  limit = 4
): DailySummarySource {
  const normalizedItems = (items ?? [])
    .filter((item) => item.title.trim())
    .slice(0, limit);
  if (!normalizedItems.length) {
    return pendingSource(label, pendingMessage);
  }

  return {
    status: "ready",
    label,
    message: `已找到 ${normalizedItems.length} 条可读信息。`,
    items: normalizedItems
  };
}

function pendingSource(label: string, message: string): DailySummarySource {
  return {
    status: "pending",
    label,
    message
  };
}

function nextDailyResetDate(now: Date): Date {
  const reset = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    dailyResetHourUtc,
    0,
    0,
    0
  ));
  if (now >= reset) {
    reset.setUTCDate(reset.getUTCDate() + 1);
  }
  return reset;
}

function nextWeeklyResetDate(now: Date): Date {
  const daily = nextDailyResetDate(now);
  const daysUntilTuesday = (weeklyResetDayUtc - daily.getUTCDay() + 7) % 7;
  const weekly = new Date(daily);
  weekly.setUTCDate(daily.getUTCDate() + daysUntilTuesday);
  return weekly;
}

function formatDate(date: Date, timeZone: string): string {
  const parts = dateParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatChineseDateTime(date: Date, timeZone: string): string {
  const parts = dateParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} ${timeZone}`;
}

function dateParts(date: Date, timeZone: string): Record<"year" | "month" | "day" | "hour" | "minute", string> {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);

  return {
    year: partValue(parts, "year"),
    month: partValue(parts, "month"),
    day: partValue(parts, "day"),
    hour: partValue(parts, "hour"),
    minute: partValue(parts, "minute")
  };
}

function partValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? "";
}

function formatRemaining(label: string, now: Date, target: Date): string {
  const remainingMinutes = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 60000));
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  return `距离${label}还有 ${hours} 小时 ${minutes} 分钟`;
}
