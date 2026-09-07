import type { WeeklyIronBannerSummary } from "@d2-tools/core/weekly/summary";

export type HomeDashboardDiagnosticRow = {
  label?: string;
  value?: string;
  tone?: string;
};

export type HomeDashboardDailyItem = {
  title: string;
  itemHash?: number;
  characterId?: string;
  subtitle?: string;
  description?: string;
  source?: string;
  iconUrl?: string;
  icon?: string;
  iconLabel?: string;
  classType?: number;
  vendorHash?: number;
  vendorEnabled?: boolean;
  vendorRefreshDate?: string;
  vendorLocation?: string;
  items?: HomeDashboardDailyItem[];
};

export type HomeDashboardDailySource = {
  status: "neutral" | "ready" | "warning" | "error" | "pending";
  label?: string;
  message: string;
  items?: HomeDashboardDailyItem[];
};

export type HomeDashboardDailySummary = {
  date_label?: string;
  daily_reset: {
    label: string;
    next_reset_iso?: string;
    time_remaining_label: string;
  };
  weekly_reset: {
    label: string;
    next_reset_iso?: string;
    time_remaining_label: string;
  };
  sources: {
    rotations: HomeDashboardDailySource;
    vendors: HomeDashboardDailySource;
    lost_sector: HomeDashboardDailySource;
    weekly_report: HomeDashboardDailySource;
  };
  checklist: string[];
  recommendations?: string[];
};

export type HomeDashboardWeeklyPriorityKind =
  | "nightfall"
  | "rotating_raid"
  | "rotating_dungeon"
  | "weekly_surge"
  | "special_event";

export type HomeDashboardWeeklyActivityReward = {
  hash: number;
  name: string;
  icon?: string;
  item_type?: string;
  group_key?: "weapons" | "armor" | "equipment" | "other";
};

export type HomeDashboardWeeklyActivityEntry = {
  title: string;
  detail?: string;
  evidence?: string;
  source?: string;
  related_hashes?: number[];
  rewards?: HomeDashboardWeeklyActivityReward[];
};

export type HomeDashboardWeeklySummary = {
  weekly_reset: {
    label: string;
    next_reset_iso?: string;
    time_remaining_label: string;
  };
  priorities: Record<HomeDashboardWeeklyPriorityKind, {
    status: "ready" | "pending" | "warning" | "error";
    title: string;
    detail: string;
    evidence?: string;
    source?: string;
    entries?: HomeDashboardWeeklyActivityEntry[];
  }>;
  iron_banner: WeeklyIronBannerSummary;
  public_clues: Array<{
    title: string;
    subtitle?: string;
    description?: string;
    source?: string;
    weeklyActivityKind?: HomeDashboardWeeklyPriorityKind | "public_clue";
  }>;
};

export type HomeDashboardStartupState = {
  cards: {
    manifest: {
      label: string;
      status: string;
      lastUpdated?: string;
      needsUpdate?: boolean;
    };
  };
};

export type HomeDashboardWorkspace = {
  state: HomeDashboardStartupState;
  selectedCharacterId?: string;
  selectedCharacterLabel?: string;
  briefingFetchedAt?: string;
  diagnosticRows: HomeDashboardDiagnosticRow[];
  diagnosticError: string;
  accountError: string;
  hasAccountData: boolean;
  dailySummary: HomeDashboardDailySummary | null;
  weeklySummary: HomeDashboardWeeklySummary | null;
  dailyMessage: string;
  dailyError: string;
  isLoggingIn: boolean;
  isLoadingAccount: boolean;
  isInitializingManifest: boolean;
  isRefreshingDiagnostics: boolean;
  isLoadingDaily: boolean;
  /** 首页情报统一资源生命周期状态。 */
  dailyResourceStatus: "unavailable" | "loading" | "refreshing" | "ready" | "stale" | "error";
  dailyResourceSource: "local" | "remote" | "merged";
};

export type HomeDashboardActions = {
  onConfigure: () => void;
  onLogin: () => void;
  onLoadAccount: () => void;
  onInitializeManifest: () => void;
  onConfigureAi: () => void;
  onRefreshDiagnostics: () => void;
  onNavigate: (page: "home" | "account" | "vault" | "loadouts" | "library" | "vendors" | "settings") => void;
  onRefreshDaily: () => void;
  onOpenWeeklyActivityReward: (reward: HomeDashboardWeeklyActivityReward) => void;
};

export type HomeDashboardItemDetailTarget = {
  hash: number;
  name: string;
  description: string;
  icon?: string;
  item_type?: string;
  group_key?: "weapons" | "armor";
  source: {
    status: "missing";
    label: string;
    description: string;
  };
};

const armorRewardTypePattern = /头盔|臂铠|胸部护甲|胸甲|腿部护甲|腿甲|职业物品|护甲|helmet|gauntlets|chest armor|leg armor|class item|armor/i;
const weaponRewardTypePattern = /步枪|手炮|弓|霰弹枪|狙击枪|榴弹发射器|机枪|火箭发射器|剑|融合步枪|线性融合步枪|冲锋枪|手枪|偃月|weapon|rifle|launcher|cannon|shotgun|sniper|sword|glaive|bow/i;

export function createHomeWeeklyActivityRewardDetailTarget(
  reward: HomeDashboardWeeklyActivityReward
): HomeDashboardItemDetailTarget {
  const itemType = reward.item_type?.trim() ?? "";
  const groupKey = reward.group_key === "weapons" || reward.group_key === "armor"
    ? reward.group_key
    : armorRewardTypePattern.test(itemType)
      ? "armor"
      : (weaponRewardTypePattern.test(itemType) ? "weapons" : undefined);

  return {
    hash: reward.hash,
    name: reward.name,
    description: "本周活动已确认该奖励，正在读取完整装备定义。",
    icon: reward.icon,
    item_type: reward.item_type,
    group_key: groupKey,
    source: {
      status: "missing",
      label: "来源详情待读取",
      description: "打开详情后从当前 Manifest 读取官方来源。"
    }
  };
}
