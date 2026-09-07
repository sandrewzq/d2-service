import { useEffect, useState } from "react";
import { getLocaleCopy } from "../i18n/copy.js";
import type { InterfaceLocale, HomeCopy } from "../i18n/types.js";
import { isXurActiveAt, nextXurBoundaryAt, xurVendorHash } from "@d2-tools/core/daily/xurSchedule";
import type { WeeklyIronBannerSummary } from "@d2-tools/core/weekly/summary";
import type { ShellPageKey } from "../shell/types.js";
import type { VendorInventoryItemView, VendorOfferContextView } from "../vendors/VendorsPageContentView.js";
import { GameAssetImage } from "../media/GameAssetImage.js";
import { RefreshControlButton } from "../control/RefreshControlButton.js";
import { formatFullDateTime, formatScheduleDateTime } from "../time/formatTime.js";
import { createXurItemIconUrl, normalizeBungieIconUrl } from "./homeIconArt.js";
export type HomeTone = "neutral" | "ready" | "warning" | "error";
export type HomeDailyItem = {
  title: string;
  itemHash?: number;
  subtitle?: string;
  description?: string;
  source?: string;
  weeklyActivityKind?: HomeWeeklyActivityKind;
  related_hashes?: number[];
  rewards?: HomeWeeklyActivityReward[];
  iconUrl?: string;
  icon?: string;
  iconLabel?: string;
  classType?: number;
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
  items?: HomeDailyItem[];
};
export type HomeWeeklyActivityKind = "nightfall" | "rotating_raid" | "rotating_dungeon" | "weekly_bonus" | "special_event" | "public_clue";
export type HomeDailySource = {
  status: HomeTone | "pending";
  message: string;
  items?: HomeDailyItem[];
};
export type HomeDailySummary = {
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
    weekly_report: HomeDailySource;
    rotations: HomeDailySource;
    vendors: HomeDailySource;
    lost_sector: HomeDailySource;
  };
  checklist: string[];
};
export type HomeWeeklyPriorityKind =
  | "nightfall"
  | "rotating_raid"
  | "rotating_dungeon"
  | "weekly_bonus"
  | "special_event";
export type HomeWeeklySummary = {
  weekly_reset: {
    label: string;
    next_reset_iso?: string;
    time_remaining_label: string;
  };
  priorities: Record<HomeWeeklyPriorityKind, {
    status: "ready" | "pending" | "warning" | "error";
    title: string;
    detail: string;
    evidence?: string;
    source?: string;
    entries?: HomeWeeklyActivityEntry[];
  }>;
  iron_banner: WeeklyIronBannerSummary;
  public_clues: HomeDailyItem[];
};
export type HomeWeeklyActivityReward = {
  hash: number;
  name: string;
  icon?: string;
  item_type?: string;
  group_key?: "weapons" | "armor" | "equipment" | "other";
};
export type HomeWeeklyActivityEntry = {
  title: string;
  detail?: string;
  evidence?: string;
  source?: string;
  related_hashes?: number[];
  rewards?: HomeWeeklyActivityReward[];
};
export type HomeStartupState = {
  cards: {
    manifest: {
      label: string;
      status: string;
      lastUpdated?: string;
      needsUpdate?: boolean;
    };
  };
};
export type HomeDiagnosticRow = {
  tone?: string;
};
type HomeWeeklyPriority = HomeWeeklySummary["priorities"][HomeWeeklyPriorityKind];
type HomeConfirmedXur = {
  title: string;
  location?: string;
  refreshLabel?: string;
  inventoryCount: number;
  missingItemCount: number;
  isPartial: boolean;
  items: HomeDailyItem[];
};
const hiddenHomeXurItemTitles = new Set([
  "更多奇异优惠",
  "奇异装备优惠",
  "仄",
  "奇异记忆水晶",
  "More Exotic Offers",
  "Exotic Gear Offers",
  "Xur",
  "Xûr",
  "Exotic Engram"
]);
export type HomePageContentViewProps = {
  interfaceLocale?: InterfaceLocale;
  selectedCharacterId?: string;
  selectedCharacterLabel?: string;
  briefingFetchedAt?: string;
  state?: HomeStartupState;
  isLoggingIn?: boolean;
  isLoadingAccount?: boolean;
  isInitializingManifest?: boolean;
  isRefreshingDiagnostics?: boolean;
  diagnosticRows?: HomeDiagnosticRow[];
  diagnosticError?: string;
  accountError?: string;
  hasAccountData?: boolean;
  dailySummary?: HomeDailySummary | null;
  weeklySummary?: HomeWeeklySummary | null;
  dailyMessage?: string;
  dailyError?: string;
  isLoadingDaily?: boolean;
  dailyResourceStatus?: "unavailable" | "loading" | "refreshing" | "ready" | "stale" | "error";
  dailyResourceSource?: "local" | "remote" | "merged";
  onNavigate?: (page: ShellPageKey) => void;
  onRefreshDaily?: () => void;
  onOpenWeeklyActivityReward?: (reward: HomeWeeklyActivityReward) => void;
  onOpenXurOffer?: (item: VendorInventoryItemView, context: VendorOfferContextView) => void;
};
function homeText(copy: HomeCopy, key: string): string {
  return copy.inline[key] ?? key;
}
export function HomePageContentView(props: HomePageContentViewProps) {
  const interfaceLocale = props.interfaceLocale ?? "zh-CN";
  const copy = getLocaleCopy(interfaceLocale).home;
  const clock = useHomeClock();
  const dailySummary = props.dailySummary ?? null;
  const weeklySummary = props.weeklySummary ?? null;
  const dailyError = props.dailyError ?? "";
  const isLoadingDaily = props.isLoadingDaily ?? false;
  const xur = dailyError || isLoadingDaily
    ? null
    : buildConfirmedXur(dailySummary?.sources.vendors, copy, clock, props.selectedCharacterId);
  return (
    <HomePageContent
      copy={copy}
      interfaceLocale={interfaceLocale}
      dailySummary={dailySummary}
      weeklySummary={weeklySummary}
      hasAccountData={props.hasAccountData ?? false}
      clock={clock}
      xur={xur}
      selectedCharacterId={props.selectedCharacterId}
      selectedCharacterLabel={props.selectedCharacterLabel}
      briefingFetchedAt={props.briefingFetchedAt}
      dailyMessage={props.dailyMessage ?? ""}
      dailyError={dailyError}
      isLoadingDaily={isLoadingDaily}
      dailyResourceStatus={props.dailyResourceStatus ?? (dailySummary ? "ready" : isLoadingDaily ? "loading" : dailyError ? "error" : "unavailable")}
      dailyResourceSource={props.dailyResourceSource ?? "merged"}
      onNavigate={props.onNavigate}
      onRefreshDaily={props.onRefreshDaily}
      onOpenWeeklyActivityReward={props.onOpenWeeklyActivityReward}
      onOpenXurOffer={props.onOpenXurOffer}
    />
  );
}
function HomePageContent(props: {
  copy: HomeCopy;
  interfaceLocale: InterfaceLocale;
  dailySummary: HomeDailySummary | null;
  weeklySummary: HomeWeeklySummary | null;
  hasAccountData: boolean;
  clock: Date;
  xur: HomeConfirmedXur | null;
  selectedCharacterId?: string;
  selectedCharacterLabel?: string;
  briefingFetchedAt?: string;
  dailyMessage: string;
  dailyError: string;
  isLoadingDaily: boolean;
  dailyResourceStatus: "unavailable" | "loading" | "refreshing" | "ready" | "stale" | "error";
  dailyResourceSource: "local" | "remote" | "merged";
  onNavigate?: (page: ShellPageKey) => void;
  onRefreshDaily?: () => void;
  onOpenWeeklyActivityReward?: (reward: HomeWeeklyActivityReward) => void;
  onOpenXurOffer?: (item: VendorInventoryItemView, context: VendorOfferContextView) => void;
}) {
  const priorities = props.weeklySummary?.priorities;
  const showAccountGatedRotations = props.hasAccountData
    && Boolean(props.weeklySummary)
    && isCurrentWeeklyBriefing(props.briefingFetchedAt, props.clock)
    && !props.dailyError
    && !props.isLoadingDaily
    && props.dailyResourceStatus === "ready";
  const activities = [
    { kind: "nightfall", label: homeText(props.copy, "日落打击"), priority: priorities?.nightfall },
    ...(showAccountGatedRotations && priorities?.rotating_raid?.status === "ready" ? [
      { kind: "raid" as const, label: homeText(props.copy, "本周轮换突袭"), priority: priorities?.rotating_raid },
    ] : []),
    ...(showAccountGatedRotations && priorities?.rotating_dungeon?.status === "ready" ? [
      { kind: "dungeon" as const, label: homeText(props.copy, "本周轮换地牢"), priority: priorities?.rotating_dungeon }
    ] : [])
  ] as const;
  const xur = props.xur;
  const xurItems = xur?.items ?? [];
  const refreshEntries = buildRefreshEntries(props.dailySummary, props.weeklySummary, props.clock, props.interfaceLocale, props.copy);
  const xurTiming = buildXurTiming(props.clock, props.interfaceLocale, props.copy);
  return (
    <section className="home-page" data-page-view="home" data-surface="page">
      {props.dailyError || props.dailyMessage || props.isLoadingDaily ? (
        <section className="home-feedback-band" data-surface="section" aria-live="polite">
          {props.dailyError ? <HomeFeedback status="error" message={props.dailyError} retryLabel={props.copy.actions.retryHomeIntel} onRetry={props.onRefreshDaily} /> : null}
          {props.dailyMessage ? <HomeFeedback status="success" message={props.dailyMessage} /> : null}
          {props.isLoadingDaily ? <HomeFeedback status="pending" message={props.copy.actions.refreshingHomeIntel} /> : null}
        </section>
      ) : null}
      <section className="home-content-band" data-surface="section">
        <div className="home-resource-summary" role="status" aria-live="polite">
          <div className="home-resource-identity">
            <span data-ui-part="label" data-info-priority="support" data-text-tone="meta">{props.copy.labels.homeIntel}</span>
            <HomeResourceStatus status={props.dailyResourceStatus} source={props.dailyResourceSource} />
          </div>
          {props.briefingFetchedAt ? (
            <time className="home-resource-updated" dateTime={props.briefingFetchedAt} data-info-priority="support" data-text-tone="meta">
              {props.copy.labels.lastRefreshed} {formatFullDateTime(props.briefingFetchedAt)}
            </time>
          ) : (
            <span className="home-resource-updated" data-info-priority="support" data-text-tone="meta">{props.copy.labels.notRefreshed}</span>
          )}
        </div>
        <div className="home-refresh-strip" data-surface="frame" data-ui-kind="status-matrix" aria-label="首页数据刷新节奏">
          {refreshEntries.map((entry) => <HomeRefreshCell key={entry.key} entry={entry} />)}
        </div>
      </section>
      <section className="home-content-band home-signals-band" data-surface="section" aria-label="限时活动与本周活动焦点">
        <div className="weekly-signal-grid" data-surface="content-stack">
          <IronBannerCard
            summary={props.weeklySummary?.iron_banner}
            selectedCharacterId={props.selectedCharacterId}
            clock={props.clock}
            copy={props.copy}
            onNavigate={props.onNavigate}
          />
          <HomeSignal copy={props.copy} label={homeText(props.copy, "本周活动焦点")} emptyLabel={homeText(props.copy, "暂无")} priority={priorities?.weekly_bonus} />
          {priorities?.special_event?.status === "ready" ? (
            <HomeSignal copy={props.copy} className="home-special-event-signal" label={homeText(props.copy, "限时活动")} priority={priorities.special_event} />
          ) : null}
        </div>
      </section>
      <section className="home-content-band home-core-band" data-surface="section" aria-label="本周核心活动">
        <div className="weekly-activity-grid" data-surface="content-stack">
          {activities.map((activity) => (
            <HomeActivityCard
              key={activity.kind}
              {...activity}
              featured={activity.kind === "nightfall"}
              copy={props.copy}
              onOpenReward={props.onOpenWeeklyActivityReward}
            />
          ))}
        </div>
      </section>
      <section className="home-content-band home-vendor-band" data-surface="section" data-contract-id="home.vendor-stock" data-source="Vendor API + current library">
        <div className="home-vendor-module" data-surface="frame" data-ui-kind="summary-frame">
          <div className="home-band-heading">
            <div className="home-vendor-title">
              <span data-ui-part="label" data-info-priority="support" data-text-tone="meta">{homeText(props.copy, "周末商人")}</span>
              <div className="home-vendor-heading-line">
                <h2 data-ui-part="value" data-info-priority="display" data-text-tone="primary">{homeText(props.copy, "仄本周八件轮换")}</h2>
                <HomeResourceStatus status={props.dailyResourceStatus} source={props.dailyResourceSource} />
              </div>
            </div>
            <div className="home-vendor-timing" aria-label={`${xurTiming.label}时间`}>
              <span data-ui-part="label" data-info-priority="support" data-text-tone="meta">{xurTiming.label}</span>
              <strong data-ui-part="value" data-info-priority="decision" data-text-tone="primary" data-value-kind="fact">{xurTiming.moment}</strong>
              <small data-ui-part="state" data-info-priority="decision" data-text-tone="countdown" data-value-kind="countdown">{xurTiming.countdown}</small>
            </div>
            {xur ? (
              <button
                type="button"
                data-ui-kind="button" data-control-variant="secondary"
                disabled={!props.onNavigate}
                onClick={() => props.onNavigate?.("vendors")}
              >
                {homeText(props.copy, "打开仄的完整库存")}
              </button>
            ) : null}
          </div>
          <div className="home-vendor-content" data-surface="content-stack" data-status={homeVendorStatus(props)} aria-live="polite" aria-busy={props.isLoadingDaily}>
            {xur ? (
              <>
                <div className="home-vendor-overview" data-surface="row">
                  <div className="home-vendor-summary">
                    <span data-ui-part="label" data-info-priority="support" data-text-tone="meta">{homeText(props.copy, "本周八件轮换")}</span>
                    <strong data-ui-part="value" data-info-priority="decision" data-text-tone="primary">
                      {formatHomeVendorSummary(xur, xurItems.length)}
                    </strong>
                  </div>
                  <div className="home-vendor-summary">
                    <span data-ui-part="label" data-info-priority="support" data-text-tone="meta">{homeText(props.copy, "当前位置")}</span>
                    <strong data-ui-part="value" data-info-priority="context" data-text-tone="primary">{xur.location ?? xur.title}</strong>
                  </div>
                </div>
                <div className="home-vendor-stock-grid">
                  {xurItems.map((item, index) => (
                    <HomeXurOffer
                      item={item}
                      key={`${item.title}-${item.vendorHash ?? "xur"}-${index}`}
                      vendorName={xur.title}
                      copy={props.copy}
                      refreshLabel={xur.refreshLabel}
                      onOpenXurOffer={props.onOpenXurOffer}
                    />
                  ))}
                  {xur.missingItemCount ? <HomeMissingXurOffer copy={props.copy} count={xur.missingItemCount} /> : null}
                </div>
              </>
            ) : (
              <HomeXurState
                copy={props.copy}
                source={props.dailySummary?.sources.vendors}
                isLoading={props.isLoadingDaily}
                error={props.dailyError}
                onRetry={props.dailyError ? undefined : props.onRefreshDaily}
              />
            )}
          </div>
          <small className="home-vendor-source" data-ui-part="source" data-info-priority="trace" data-text-tone="meta">
            {formatHomeVendorSource({
              xur,
              fetchedAt: props.briefingFetchedAt,
              selectedCharacterLabel: props.selectedCharacterLabel,
              isLoading: props.isLoadingDaily,
              error: props.dailyError
            })}
          </small>
        </div>
      </section>
    </section>
  );
}

function HomeResourceStatus(props: {
  status: "unavailable" | "loading" | "refreshing" | "ready" | "stale" | "error";
  source: "local" | "remote" | "merged";
}) {
  const labels: Record<typeof props.status, string> = {
    unavailable: "暂无数据",
    loading: "首次读取",
    refreshing: "后台同步中",
    ready: "已同步",
    stale: "缓存已过期",
    error: "读取失败"
  };
  const sourceLabels: Record<typeof props.source, string> = { local: "本地", remote: "远端", merged: "本地优先" };
  return <span className="app-chip home-resource-status" data-ui-kind="status-chip" data-status={props.status} title={`来源：${sourceLabels[props.source]}`}>{labels[props.status]}</span>;
}

type HomeRefreshEntry = { key: "daily" | "weekly"; label: string; moment: string; countdown: string; impact: string };
type HomeXurTiming = { label: string; moment: string; countdown: string };

function HomeFeedback(props: { status: "success" | "pending" | "error"; message: string; retryLabel?: string; onRetry?: () => void }) {
  return (
    <div
      className="home-feedback"
      data-ui-kind="callout"
      data-status={props.status}
      role={props.status === "error" ? "alert" : "status"}
    >
      <span data-ui-part="state" data-info-priority="decision" data-text-tone="status" data-status={props.status}>{props.message}</span>
      {props.status === "error" && props.onRetry ? (
        <RefreshControlButton variant="primary" onClick={props.onRetry}>{props.retryLabel ?? "重新读取首页情报"}</RefreshControlButton>
      ) : null}
    </div>
  );
}

function useHomeClock() {
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const interval = window.setInterval(() => setClock(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);
  return clock;
}

function buildRefreshEntries(
  daily: HomeDailySummary | null,
  weekly: HomeWeeklySummary | null,
  clock: Date,
  locale: InterfaceLocale,
  copy: HomeCopy
): HomeRefreshEntry[] {
  return [
    { key: "daily", label: homeText(copy, "每日更新"), moment: `下次：${resetMoment(daily?.daily_reset, homeText(copy, "时间待确认"), locale)}`, countdown: `倒计时：${resetCountdown(daily?.daily_reset, clock, copy)}`, impact: homeText(copy, "今日轮换、遗失区域") },
    { key: "weekly", label: homeText(copy, "每周更新"), moment: `下次：${resetMoment(weekly?.weekly_reset ?? daily?.weekly_reset, homeText(copy, "时间待确认"), locale)}`, countdown: `倒计时：${resetCountdown(weekly?.weekly_reset ?? daily?.weekly_reset, clock, copy)}`, impact: homeText(copy, "日落、轮换、活动焦点") }
  ];
}

function buildXurTiming(clock: Date, locale: InterfaceLocale, copy: HomeCopy): HomeXurTiming {
  const target = nextXurBoundaryAt(clock);
  const active = isXurActiveAt(clock);
  return {
    label: homeText(copy, active ? "仄离开" : "仄到访"),
    moment: formatScheduleDateTime(target, locale, homeText(copy, "时间待确认")),
    countdown: `${homeText(copy, "倒计时")}：${compactDuration(clock, target, copy)}`
  };
}

function resetMoment(reset: { label: string; next_reset_iso?: string } | undefined, fallback: string, locale: InterfaceLocale) {
  if (reset?.next_reset_iso) {
    const target = new Date(reset.next_reset_iso);
    if (Number.isFinite(target.getTime())) return formatScheduleDateTime(target, locale, fallback);
  }
  return (reset?.label ?? fallback).replace(/^(?:每日|每周)重置[：:]\s*/i, "");
}

function resetCountdown(reset: { next_reset_iso?: string; time_remaining_label: string } | undefined, clock: Date, copy: HomeCopy) {
  if (reset?.next_reset_iso) {
    const target = new Date(reset.next_reset_iso);
    if (Number.isFinite(target.getTime())) return compactDuration(clock, target, copy);
  }
  return compactResetCountdown(reset?.time_remaining_label ?? "", "") || homeText(copy, "倒计时待确认");
}

function compactDuration(now: Date, target: Date, copy: HomeCopy) {
  const minutes = Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 60_000));
  const days = Math.floor(minutes / 1_440);
  const hours = Math.floor((minutes % 1_440) / 60);
  const rest = minutes % 60;
  if (days) return `${days} ${homeText(copy, "天")} ${hours} ${homeText(copy, "小时")}`;
  return `${hours} ${homeText(copy, "小时")} ${rest} ${homeText(copy, "分钟")}`;
}

function HomeRefreshCell(props: { entry: HomeRefreshEntry }) {
  return (
    <div className="home-refresh-cell" data-refresh={props.entry.key}>
      <div className="home-refresh-heading">
        <RefreshGlyph kind={props.entry.key} />
        <span data-ui-part="label" data-info-priority="support" data-text-tone="body">{props.entry.label}</span>
      </div>
      <strong data-ui-part="value" data-info-priority="decision" data-text-tone="primary" data-value-kind="fact">{props.entry.moment}</strong>
      <small data-ui-part="state" data-info-priority="decision" data-text-tone="countdown" data-value-kind="countdown">{props.entry.countdown}</small>
      <small className="home-refresh-impact" data-ui-part="detail" data-info-priority="support" data-text-tone="body">影响：{props.entry.impact}</small>
    </div>
  );
}

function RefreshGlyph(props: { kind: HomeRefreshEntry["key"] }) {
  if (props.kind === "daily") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>;
}

function HomeActivityCard(props: {
  kind: "nightfall" | "raid" | "dungeon";
  label: string;
  priority: HomeWeeklyPriority | undefined;
  featured: boolean;
  copy: HomeCopy;
  onOpenReward?: (reward: HomeWeeklyActivityReward) => void;
}) {
  const entries = homePriorityEntries(props.priority);
  const status = entries.length ? "success" : "pending";
  return (
    <article className={`weekly-activity-card is-${props.kind}`} data-surface="frame" data-ui-kind="summary-frame" data-status={status}>
      <header>
        <span data-ui-part="label" data-info-priority="context" data-text-tone="primary">{props.label}</span>
        <strong data-ui-part="state" data-info-priority="support" data-text-tone="status" data-status={status}>
          {entries.length ? `${entries.length} ${homeText(props.copy, "项已确认")}` : homeText(props.copy, "待确认")}
        </strong>
      </header>
      {entries.length ? (
        <div className="weekly-activity-list">
          {entries.map((entry) => (
            <HomeActivityEntry
              key={`${props.kind}-${entry.title}`}
              entry={entry}
              featured={props.featured}
              copy={props.copy}
              onOpenReward={props.onOpenReward}
            />
          ))}
        </div>
      ) : <HomeEmpty label={activityEmptyLabel(props.priority)} />}
    </article>
  );
}

function HomeActivityEntry(props: {
  entry: HomeWeeklyActivityEntry;
  featured: boolean;
  copy: HomeCopy;
  onOpenReward?: (reward: HomeWeeklyActivityReward) => void;
}) {
  const rewards = props.entry.rewards?.filter((reward) => reward.name.trim()) ?? [];
  return (
    <div className={props.featured ? "weekly-activity-entry is-featured" : "weekly-activity-entry"}>
      <div className="weekly-activity-copy">
        <h3 data-ui-part="value" data-info-priority="decision" data-text-tone="primary">{props.entry.title}</h3>
        {props.entry.detail ? <p data-ui-part="detail" data-info-priority="reading" data-text-tone="body">{props.entry.detail}</p> : null}
      </div>
      <div className="weekly-activity-reward-panel">
        <span data-ui-part="label" data-info-priority="support" data-text-tone="meta">{homeText(props.copy, "本周奖励")}</span>
        <div className="weekly-activity-reward-list">
          {rewards.length ? rewards.map((reward) => (
            <HomeActivityReward key={reward.hash} reward={reward} onOpen={props.onOpenReward} />
          )) : (
            <div className="weekly-activity-reward is-pending">
              <div>
                <strong data-ui-part="value" data-info-priority="context" data-text-tone="primary">{homeText(props.copy, "奖励待确认")}</strong>
                <small data-ui-part="detail" data-info-priority="reading" data-text-tone="body">{homeText(props.copy, "公开接口尚未返回可读奖励。")}</small>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HomeActivityReward(props: {
  reward: HomeWeeklyActivityReward;
  onOpen?: (reward: HomeWeeklyActivityReward) => void;
}) {
  const content = <>
      {props.reward.icon ? (
        <span className="weekly-activity-reward-icon"><GameAssetImage src={normalizeBungieIconUrl(props.reward.icon) ?? props.reward.icon} alt="" loading="eager" /></span>
      ) : <span className="weekly-activity-reward-icon is-missing" aria-label={`${props.reward.name} 无图标`}>?</span>}
      <div>
        <strong data-ui-part="value" data-info-priority="context" data-text-tone="primary">{props.reward.name}</strong>
        {props.reward.item_type ? <small data-ui-part="detail" data-info-priority="reading" data-text-tone="body">{props.reward.item_type}</small> : null}
      </div>
    </>;

  const isActionable = Boolean(props.onOpen)
    && Number.isFinite(props.reward.hash)
    && props.reward.hash > 0
    && isHomeEquipmentReward(props.reward);
  if (!isActionable) return <div className="weekly-activity-reward">{content}</div>;

  return (
    <button
      type="button"
      className="weekly-activity-reward is-actionable"
      data-ui-kind="button"
      data-control-variant="quiet"
      aria-label={`查看${props.reward.name}详情`}
      onClick={() => props.onOpen?.(props.reward)}
    >
      {content}
    </button>
  );
}

function isHomeEquipmentReward(reward: HomeWeeklyActivityReward): boolean {
  if (reward.group_key === "weapons" || reward.group_key === "armor") return true;
  if (reward.group_key === "equipment" || reward.group_key === "other") return false;
  return /武器|步枪|手炮|弓|霰弹枪|狙击枪|榴弹发射器|机枪|火箭发射器|剑|融合步枪|冲锋枪|手枪|偃月|护甲|头盔|臂铠|胸甲|胸部护甲|腿甲|腿部护甲|职业物品|weapon|rifle|launcher|cannon|shotgun|sniper|sword|glaive|bow|armor|helmet|gauntlets|chest|leg armor|class item/i.test(reward.item_type?.trim() ?? "");
}

function isCurrentWeeklyBriefing(fetchedAt: string | undefined, now: Date): boolean {
  if (!fetchedAt) return false;
  const fetchedTimestamp = Date.parse(fetchedAt);
  if (!Number.isFinite(fetchedTimestamp)) return false;
  const currentWeeklyBoundary = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    17,
    0,
    0,
    0
  ));
  const daysSinceTuesday = (currentWeeklyBoundary.getUTCDay() - 2 + 7) % 7;
  currentWeeklyBoundary.setUTCDate(currentWeeklyBoundary.getUTCDate() - daysSinceTuesday);
  if (currentWeeklyBoundary > now) currentWeeklyBoundary.setUTCDate(currentWeeklyBoundary.getUTCDate() - 7);
  return fetchedTimestamp >= currentWeeklyBoundary.getTime();
}

function HomeXurOffer(props: {
  item: HomeDailyItem;
  vendorName: string;
  copy: HomeCopy;
  refreshLabel?: string;
  onOpenXurOffer?: (item: VendorInventoryItemView, context: VendorOfferContextView) => void;
}) {
  const iconTone = getHomeXurTone(props.item);
  const iconUrl = normalizeBungieIconUrl(props.item.iconUrl ?? props.item.icon)
    ?? createXurItemIconUrl({ iconTone, iconLabel: props.item.iconLabel, label: props.item.title });
  const classNote = getHomeXurClassNote(props.item);
  const typeLabel = [
    classNote,
    props.item.subtitle && props.item.subtitle !== classNote ? props.item.subtitle : ""
  ].filter(Boolean).join(" · ");

  const content = <>
      <span className="home-vendor-stock-icon"><GameAssetImage alt="" src={iconUrl} /></span>
      <span className="home-vendor-stock-copy">
        <span data-ui-part="label" data-info-priority="support" data-text-tone="meta">{typeLabel || homeText(props.copy, "类型与职业备注未返回")}</span>
        <strong data-ui-part="value" data-info-priority="context" data-text-tone="primary">{props.item.title}</strong>
        <small data-ui-part="detail" data-info-priority="reading" data-text-tone="body">{props.item.description || props.item.source || homeText(props.copy, "当前轮换商品")}</small>
      </span>
      <span className="home-vendor-stock-state" data-ui-part="state" data-info-priority="support" data-text-tone="status" data-status="success">{homeText(props.copy, "本周轮换")}</span>
  </>;
  if (props.item.itemHash === undefined || !props.onOpenXurOffer) {
    return <article className="home-vendor-stock-item" data-ui-kind="object-card">{content}</article>;
  }

  const offer = createHomeXurOffer(props.item, iconTone, iconUrl, props.vendorName);
  const context = createHomeXurOfferContext(props.item, props.vendorName, props.refreshLabel);
  return (
    <button
      type="button"
      className="home-vendor-stock-item"
      data-ui-kind="object-card"
      data-control-variant="quiet"
      aria-label={`查看${props.item.title}详情`}
      onClick={() => props.onOpenXurOffer?.(offer, context)}
    >
      {content}
    </button>
  );
}

function createHomeXurOffer(
  item: HomeDailyItem,
  tone: VendorInventoryItemView["tone"],
  iconUrl: string,
  vendorName: string
): VendorInventoryItemView {
  return {
    id: `home-xur-${item.vendorHash ?? "unknown"}-${item.itemHash}`,
    itemHash: item.itemHash,
    vendorHash: item.vendorHash,
    characterIds: item.characterId ? [item.characterId] : undefined,
    name: item.title,
    itemType: item.subtitle?.trim() || "当前轮换商品",
    summary: item.source?.trim() || "Bungie 当前商人库存",
    cost: item.description?.trim(),
    iconLabel: item.iconLabel?.trim() || item.title.slice(0, 1) || "?",
    iconUrl,
    tone,
    status: "unknown",
    sourcePath: `${vendorName} / 本周八件轮换`
  };
}

function createHomeXurOfferContext(
  item: HomeDailyItem,
  vendorName: string,
  refreshLabel?: string
): VendorOfferContextView {
  return {
    vendorName,
    inventoryPath: `${vendorName} / 本周八件轮换`,
    costLabel: item.description?.trim() || "当前公开库存未返回费用",
    affordabilityLabel: item.characterId
      ? "需要当前角色货币余额校验"
      : "公共库存未返回当前角色货币余额",
    characterLabel: item.characterId ? "当前角色商人库存" : "公共商人库存",
    refreshLabel: refreshLabel || "当前刷新时间未返回"
  };
}

function getHomeXurTone(item: HomeDailyItem): "exotic" | "weapon" | "armor" | "material" {
  const value = [item.title, item.subtitle, item.description, item.source].filter(Boolean).join(" ");
  if (/护甲|头盔|臂铠|胸甲|腿甲|职业|泰坦|猎人|术士|Armor|Helmet|Gauntlets|Chest|Leg/i.test(value)) return "armor";
  if (/材料|货币|模组|赏金|Material|Currency|Mod|Bounty/i.test(value)) return "material";
  if (/异域|Exotic/i.test(value)) return "exotic";
  return "weapon";
}

function getHomeXurClassNote(item: HomeDailyItem): string {
  if (item.classType === 0) return "泰坦";
  if (item.classType === 1) return "猎人";
  if (item.classType === 2) return "术士";
  if (item.classType === 3) return "全职业";
  const value = [item.subtitle, item.description, item.source].filter(Boolean).join(" · ");
  const match = value.match(/猎人|泰坦|术士|Hunter|Titan|Warlock/i);
  return match?.[0] ?? "职业备注未返回";
}

function homePriorityEntries(priority: HomeWeeklyPriority | undefined): HomeWeeklyActivityEntry[] {
  if (!priority || priority.status !== "ready") return [];
  const entries = priority.entries?.filter((entry) => entry.title.trim()) ?? [];
  return entries.length
    ? entries
    : [{ title: priority.title, detail: priority.detail, source: priority.source }];
}
function HomeSignal(props: {
  className?: string;
  label: string;
  emptyLabel?: string;
  priority: HomeWeeklyPriority | undefined;
  copy: HomeCopy;
}) {
  const ready = props.priority?.status === "ready";
  const empty = !ready && Boolean(props.emptyLabel);
  const status = ready ? "success" : empty ? "neutral" : "pending";
  return (
    <article className={`weekly-signal-card${props.className ? ` ${props.className}` : ""}`} data-surface="frame" data-ui-kind="summary-frame" data-status={status}>
      <header>
        <span data-ui-part="label" data-info-priority="context" data-text-tone="primary">{props.label}</span>
        <span className="app-chip" data-ui-kind="status-chip" data-ui-part="state" data-info-priority="support" data-text-tone="status" data-status={status}>{ready ? homeText(props.copy, "已确认") : props.emptyLabel ?? homeText(props.copy, "待确认")}</span>
      </header>
      <div className="weekly-signal-copy">
        <strong data-ui-part="value" data-info-priority="decision" data-text-tone="primary">{props.priority?.title ?? homeText(props.copy, "公开接口尚未确认")}</strong>
        <p data-ui-part="detail" data-info-priority="reading" data-text-tone="body">{props.priority?.detail ?? homeText(props.copy, "当前不展示历史活动或推测内容。")}</p>
      </div>
    </article>
  );
}

function IronBannerCard(props: {
  summary: WeeklyIronBannerSummary | undefined;
  selectedCharacterId?: string;
  clock: Date;
  copy: HomeCopy;
  onNavigate?: (page: ShellPageKey) => void;
}) {
  const summary = props.summary;
  const active = summary?.status === "active";
  const upcoming = summary?.status === "upcoming";
  const status = active ? "success" : summary?.status === "inactive" ? "warning" : "pending";
  const characterEntries = Object.values(summary?.characters.entries ?? {});
  const selectedCharacter = (props.selectedCharacterId
    ? summary?.characters.entries[props.selectedCharacterId]
    : undefined) ?? characterEntries[0];
  const challenge = selectedCharacter?.challenge;
  const progress = Math.max(0, challenge?.progress ?? 0);
  const completion = Math.max(1, challenge?.completion_value ?? 1);
  const progressPercent = Math.min(100, Math.round((progress / completion) * 100));
  const rewardNames = [...new Set(
    (summary?.reward_groups ?? [])
      .filter((group) => !group.conditional)
      .flatMap((group) => group.items.map((item) => item.name.trim()))
      .filter(Boolean)
  )].slice(0, 2);
  const challengeCopy = [challenge?.description, challenge?.progress_label].filter(Boolean).join(" ");
  const rewardLabel = [
    /大幅提升|高阶|巅峰|powerful|pinnacle/i.test(challengeCopy) ? "高阶装备" : undefined,
    ...rewardNames
  ].filter((value): value is string => Boolean(value)).join(" · ")
    || (challenge ? "完成挑战后领取奖励" : "奖励数据待读取");
  const timingLabel = ironBannerTimingLabel(summary, props.clock, props.copy);
  const statusLabel = active
    ? "正在开放"
    : upcoming
      ? "即将开放"
      : summary?.status === "inactive"
        ? "当前未开放"
        : "状态待确认";
  const activityName = active && summary?.activity_name?.trim() ? summary.activity_name.trim() : "铁旗";
  const modeLabel = active
    ? activityName !== "铁旗" ? activityName : summary?.playlist_name?.trim()
    : undefined;
  const characterAvailability = summary && summary.characters.available_count > 0
    ? `账号内 ${summary.characters.available_count} 个角色可参与`
    : "账号角色挑战待读取";

  return (
    <article className="iron-banner-card" data-surface="frame" data-ui-kind="summary-frame" data-status={status}>
      <header className="iron-banner-heading">
        <div className="iron-banner-identity">
          <div>
            <h3 data-ui-part="value" data-info-priority="display" data-text-tone="primary">铁旗</h3>
            {modeLabel ? <small data-ui-part="detail" data-info-priority="support" data-text-tone="body">当前模式：{modeLabel}</small> : null}
          </div>
        </div>
        <div className="iron-banner-timing">
          <span className="app-chip" data-ui-kind="status-chip" data-ui-part="state" data-info-priority="support" data-text-tone="status" data-status={status}>{statusLabel}</span>
          <strong data-ui-part="state" data-info-priority="decision" data-text-tone="countdown" data-value-kind="countdown">{timingLabel}</strong>
        </div>
      </header>

      {active ? (
        <div className="iron-banner-summary">
          <section className="iron-banner-challenge" aria-label="当前角色铁旗挑战">
            <div className="iron-banner-challenge-line">
              <span data-ui-part="label" data-info-priority="support" data-text-tone="meta">当前角色挑战</span>
              <strong data-ui-part="value" data-info-priority="decision" data-text-tone="primary">
                {challenge ? challenge.complete ? "已完成" : `${progress} / ${completion}` : "挑战待读取"}
              </strong>
              <small data-ui-part="detail" data-info-priority="support" data-text-tone="body">{characterAvailability}</small>
            </div>
            {challenge ? (
              <div className="iron-banner-progress-track" aria-label={`铁旗挑战进度 ${progress}/${completion}`}>
                <i style={{ width: `${progressPercent}%` }} />
              </div>
            ) : null}
          </section>
          <section className="iron-banner-reward-summary" aria-label="铁旗挑战奖励">
            <span data-ui-part="label" data-info-priority="support" data-text-tone="meta">挑战奖励</span>
            <strong data-ui-part="value" data-info-priority="decision" data-text-tone="primary">{rewardLabel}</strong>
          </section>
          {props.onNavigate ? (
            <button type="button" className="iron-banner-vendor-action" data-ui-kind="button" data-control-variant="secondary" onClick={() => props.onNavigate?.("vendors")}>
              查看萨拉丁
            </button>
          ) : null}
        </div>
      ) : (
        <div className="iron-banner-compact-state">
          <strong data-ui-part="value" data-info-priority="decision" data-text-tone="primary">{summary?.title ?? "铁旗状态待确认"}</strong>
          <p data-ui-part="detail" data-info-priority="reading" data-text-tone="body">{summary?.detail ?? "登录 Bungie 后读取当前铁旗轮换。"}</p>
        </div>
      )}
    </article>
  );
}

function ironBannerTimingLabel(
  summary: WeeklyIronBannerSummary | undefined,
  clock: Date,
  copy: HomeCopy
): string {
  const vendorRefreshTiming = summary?.timing_source?.includes("Character Vendors") ?? false;
  const targetValue = summary?.status === "active"
    ? vendorRefreshTiming
      ? summary.next_refresh_at ?? summary.ends_at
      : summary.ends_at ?? summary.next_refresh_at
    : summary?.status === "upcoming"
      ? summary.starts_at
      : undefined;
  if (targetValue) {
    const target = new Date(targetValue);
    if (Number.isFinite(target.getTime())) {
      const prefix = summary?.status === "active"
        ? vendorRefreshTiming
          ? "距库存刷新"
          : summary.ends_at
            ? "距结束"
            : summary.next_refresh_at
              ? "距库存刷新"
              : "结束时间待确认"
        : "距开放";
      return `${homeText(copy, prefix)} ${compactDuration(clock, target, copy)}`;
    }
  }
  if (summary?.status === "active") return homeText(copy, "结束时间待确认");
  if (summary?.status === "upcoming") return homeText(copy, "开放时间待确认");
  if (summary?.status === "inactive") return homeText(copy, "下次开放时间待确认");
  return homeText(copy, "时间待确认");
}

function HomeEmpty(props: { label: string }) {
  return <div className="weekly-activity-empty" data-ui-part="detail" data-info-priority="reading" data-text-tone="body">{props.label}</div>;
}

function activityEmptyLabel(priority: HomeWeeklyPriority | undefined): string {
  if (priority?.status === "error") return "本周内容暂不可用。";
  if (priority?.status === "warning") return "本周内容部分待确认。";
  return "本周内容待确认。";
}

function HomeXurState(props: {
  copy: HomeCopy;
  source: HomeDailySource | undefined;
  isLoading: boolean;
  error: string;
  onRetry?: () => void;
}) {
  if (props.error || props.source?.status === "error") {
    return (
      <HomeVendorModuleState
        status="error"
        title={homeText(props.copy, "本周轮换暂不可用")}
        detail={homeText(props.copy, "本次读取失败，未显示过期库存。")}
        onRetry={props.onRetry}
      />
    );
  }

  if (props.isLoading || !props.source) {
    return (
      <>
        <HomeVendorModuleState
          status="pending"
          title={homeText(props.copy, "正在读取本周八件轮换")}
          detail={homeText(props.copy, "等待公开商人数据和当前资料库返回。")}
        />
        <div className="home-vendor-stock-grid" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => <i className="home-vendor-skeleton" key={index} />)}
        </div>
      </>
    );
  }

  return (
    <HomeVendorModuleState
      status="warning"
      title={homeText(props.copy, "当前没有可确认的仄本周八件轮换")}
      detail={homeText(props.copy, "商人未开放或本周轮换暂不可见。")}
    />
  );
}

function HomeVendorModuleState(props: {
  status: "pending" | "warning" | "error";
  title: string;
  detail: string;
  onRetry?: () => void;
}) {
  return (
    <div className="home-vendor-module-state" data-status={props.status}>
      <strong data-ui-part="value" data-info-priority="decision" data-text-tone="status" data-status={props.status}>{props.title}</strong>
      <span data-ui-part="detail" data-info-priority="reading" data-text-tone="body">{props.detail}</span>
      {props.onRetry ? <button type="button" data-ui-kind="button" data-control-variant="primary" onClick={props.onRetry}>重新读取商人库存</button> : null}
    </div>
  );
}

function HomeMissingXurOffer(props: { count: number; copy: HomeCopy }) {
  return (
    <article className="home-vendor-stock-item" data-ui-kind="object-card" data-status="warning">
      <span className="home-vendor-stock-icon is-missing" aria-hidden="true">?</span>
      <span className="home-vendor-stock-copy">
        <span data-ui-part="label" data-info-priority="support" data-text-tone="meta">{homeText(props.copy, "资料库定义待补齐")}</span>
        <strong data-ui-part="value" data-info-priority="context" data-text-tone="primary">{props.count} {homeText(props.copy, "件轮换商品暂无可读名称")}</strong>
        <small data-ui-part="detail" data-info-priority="reading" data-text-tone="body">{homeText(props.copy, "Vendor API 已确认存在，不使用猜测名称、类型或图标。")}</small>
      </span>
      <span className="home-vendor-stock-state" data-ui-part="state" data-info-priority="support" data-text-tone="status" data-status="warning">{homeText(props.copy, "部分可用")}</span>
    </article>
  );
}

function formatHomeVendorSummary(xur: HomeConfirmedXur, visibleCount: number): string {
  if (xur.isPartial || xur.missingItemCount) {
    return `${visibleCount} 件已确认 · ${xur.missingItemCount} 件定义待补齐`;
  }
  return `${xur.inventoryCount} 件轮换商品`;
}

function formatHomeVendorSource(input: {
  xur: HomeConfirmedXur | null;
  fetchedAt?: string;
  selectedCharacterLabel?: string;
  isLoading: boolean;
  error: string;
}): string {
  if (input.isLoading) return "来源：Vendor API + 当前资料库 · 正在确认主商人轮换";
  if (input.error) return "来源：Vendor API · 本次读取失败，未使用过期库存";
  if (!input.xur) return "来源：Vendor API · 当前未返回有效轮换";
  const details = [
    input.fetchedAt ? `真实读取 ${formatFullDateTime(input.fetchedAt)}` : "读取时间未返回",
    input.selectedCharacterLabel || "公共商人库存",
    input.xur.isPartial || input.xur.missingItemCount
      ? "部分轮换定义缺失"
      : `${input.xur.inventoryCount} 件本周轮换完整`
  ];
  return `来源：Vendor API + 当前资料库 · ${details.join(" · ")}`;
}

function homeVendorStatus(props: { xur: HomeConfirmedXur | null; isLoadingDaily: boolean; dailyError: string }): "success" | "pending" | "warning" | "error" {
  if (props.isLoadingDaily) return "pending";
  if (props.dailyError) return "error";
  if (!props.xur) return "warning";
  return props.xur.isPartial || props.xur.missingItemCount ? "warning" : "success";
}

function buildConfirmedXur(
  source: HomeDailySource | undefined,
  copy: HomeCopy,
  now: Date,
  selectedCharacterId?: string
): HomeConfirmedXur | null {
  if (!source || !["ready", "warning"].includes(source.status) || !isXurActiveAt(now)) return null;
  const xurVendors = source.items?.filter((item) => item.vendorHash === xurVendorHash || /仄|Xur|Xûr/i.test(item.title)) ?? [];
  const vendor = xurVendors.find((item) => item.characterId === selectedCharacterId)
    ?? xurVendors.find((item) => Boolean(item.characterId))
    ?? xurVendors[0];
  const candidates = (vendor?.items ?? []).filter((item) => {
    const title = item.title.trim();
    return !title || !hiddenHomeXurItemTitles.has(title);
  });
  const items = candidates.filter((item) => item.title.trim());
  const missingItemCount = candidates.length - items.length;
  if (!vendor || vendor.vendorEnabled === false || (!items.length && !missingItemCount)) return null;
  return {
    title: vendor.title,
    location: vendor.vendorLocation,
    refreshLabel: formatXurDepartureLabel(now, copy),
    inventoryCount: candidates.length,
    missingItemCount,
    isPartial: source.status === "warning",
    items
  };
}
function formatXurDepartureLabel(now: Date, copy: HomeCopy): string {
  return `${homeText(copy, "离开还有")} ${compactDuration(now, nextXurBoundaryAt(now), copy)}`;
}
function compactResetCountdown(value: string, label: string): string {
  return value
    .trim()
    .replace(new RegExp(`^距离${escapeRegExp(label)}还有\\s*`, "i"), "")
    .replace(/^距离(?:每日|每周)重置还有\s*/i, "");
}
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
