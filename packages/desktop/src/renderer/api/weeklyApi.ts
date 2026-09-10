import type {
  WeeklyActivityCharacterState,
  WeeklyIronBannerSummary
} from "@d2-tools/core/weekly/summary";

export type WeeklyApi = {
  getWeeklySummary(): Promise<WeeklySummary>;
};

export type WeeklySourceStatus = "ready" | "pending";

export type WeeklyPriorityKind =
  | "nightfall"
  | "rotating_raid"
  | "rotating_dungeon"
  | "weekly_surge"
  | "special_event";

export type WeeklySummaryPriority = {
  status: WeeklySourceStatus;
  title: string;
  detail: string;
  evidence?: string;
  source?: string;
  entries?: WeeklyActivityEntry[];
};

export type WeeklySummaryItem = {
  title: string;
  subtitle?: string;
  description?: string;
  source?: string;
  weeklyActivityKind?: WeeklyPriorityKind | "public_clue";
  related_hashes?: number[];
  rewards?: WeeklyActivityReward[];
  characters?: WeeklyActivityCharacterState[];
};

export type WeeklyActivityReward = {
  hash: number;
  name: string;
  icon?: string;
  item_type?: string;
};

export type WeeklyActivityEntry = {
  title: string;
  detail?: string;
  evidence?: string;
  source?: string;
  related_hashes?: number[];
  rewards?: WeeklyActivityReward[];
  characters?: WeeklyActivityCharacterState[];
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
