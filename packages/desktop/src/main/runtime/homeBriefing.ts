import { buildDailyLiveDataFromBungie } from "@d2-tools/core/daily/liveData";
import { buildDailySummary, type DailySummary } from "@d2-tools/core/daily/summary";
import { isXurActiveAt, xurPeriodKey, xurVendorHash } from "@d2-tools/core/daily/xurSchedule";
import type { D2Config } from "@d2-tools/core/config/schema";
import type { DefinitionComponentData, DefinitionRecord } from "@d2-tools/core/manifest/definitions";
import { buildWeeklyLiveDataFromBungie } from "@d2-tools/core/weekly/liveData";
import {
  buildWeeklySummary,
  type WeeklyActivityReward,
  type WeeklySummary,
  type WeeklySummaryItem
} from "@d2-tools/core/weekly/summary";
import { lootPoolItemHashesForActivity } from "@d2-tools/services/community/activityLoot";
import {
  type BungieHomeSnapshot,
  type BungiePublicSale,
  type BungieVendorsResponse
} from "@d2-tools/services/bungie/session";
import { loadConfig } from "@d2-tools/services/config/store";
import { getManifestStatus } from "@d2-tools/services/manifest/cache";
import {
  loadCachedHomeBriefing,
  saveCachedHomeBriefing,
  type CachedHomeBriefing
} from "@d2-tools/services/home/briefingStore";
import type { HomeBriefing } from "../../contracts/daily.js";
import { loadFreshOAuthToken, type FreshOAuthToken } from "../ipc/authSession.js";
import { getDefinitions } from "./gameDataRuntime.js";
import { getSharedBungieSession } from "./bungieSession.js";
import { measureRuntime } from "./runtimeMetrics.js";

export type HomeBriefingRefreshOptions = {
  force?: boolean;
};

let tokenRequest: {
  contextKey: string;
  promise: Promise<FreshOAuthToken | null>;
} | null = null;
let briefingRequest: {
  contextKey: string;
  force: boolean;
  promise: Promise<CachedHomeBriefing>;
} | null = null;
let cachedBriefing: CachedHomeBriefing | null = null;
let cacheLoadRequest: { contextKey: string; promise: Promise<CachedHomeBriefing | null> } | null = null;

export async function getHomeBriefing(options: HomeBriefingRefreshOptions = {}): Promise<HomeBriefing> {
  const config = loadConfig();
  const token = await loadTokenOnce(config);
  const manifest = getManifestStatus(config.data.data_dir);
  const contextKey = [
    config.data.data_dir,
    token?.membership_id ?? "public",
    manifest.version ?? "manifest-unavailable",
    manifest.language ?? config.data.manifest_language
  ].join("\u0000");
  const now = new Date();
  const cached = await loadBriefingCache(config.data.data_dir, contextKey);
  const refreshPlan = createRefreshPlan(cached, now, Boolean(options.force));
  if (cached && !refreshPlan.activities && !refreshPlan.vendors) {
    return briefingFromCache(cached, now);
  }
  if (briefingRequest?.contextKey === contextKey) {
    if (!options.force || briefingRequest.force) {
      return briefingFromCache(await briefingRequest.promise, new Date());
    }
    await briefingRequest.promise.catch(() => undefined);
    return getHomeBriefing({ force: true });
  }

  const promise = measureRuntime(
    "home.briefing",
    () => buildHomeBriefing(
      config,
      token,
      cached,
      contextKey,
      refreshPlan,
      Boolean(options.force)
    ),
    { measurePayload: true }
  ).then(async (value) => {
    cachedBriefing = value;
    await saveCachedHomeBriefing(config.data.data_dir, value);
    return value;
  });
  briefingRequest = { contextKey, force: Boolean(options.force), promise };
  void promise.then(
    () => clearBriefingRequest(promise),
    () => clearBriefingRequest(promise)
  );
  return briefingFromCache(await promise, new Date());
}

async function buildHomeBriefing(
  config: D2Config,
  token: FreshOAuthToken | null,
  cached: CachedHomeBriefing | null,
  contextKey: string,
  refreshPlan: HomeRefreshPlan,
  forceRefresh: boolean
): Promise<CachedHomeBriefing> {
  const bungieSession = getSharedBungieSession(config.bungie.api_key);
  const snapshot = await bungieSession.getHomeSnapshot({
    accessToken: token?.access_token,
    includeMilestones: refreshPlan.activities,
    includeProfile: refreshPlan.activities,
    includeVendors: refreshPlan.vendors,
    forceRefresh
  });
  const definitions = await loadHomeDefinitions(snapshot);
  const activeActivityHashes = collectProfileActivityHashes(snapshot);
  const now = new Date();
  const dailyLiveData = buildDailyLiveDataFromBungie({
    milestones: snapshot.milestones,
    publicVendors: snapshot.publicVendors,
    characterVendors: snapshot.characterVendors,
    activeLostSectorActivityHashes: activeActivityHashes,
    definitions,
    now
  });
  const weeklyLiveData = buildWeeklyLiveDataFromBungie({
    now,
    milestones: snapshot.milestones,
    profile: snapshot.profile,
    characterVendors: snapshot.characterVendors,
    definitions
  });
  const lootPoolHashes = collectRotatingLootPoolHashes(weeklyLiveData.items ?? []);
  if (lootPoolHashes.length) {
    const lootDefinitions = await getDefinitions("DestinyInventoryItemDefinition", lootPoolHashes);
    Object.assign(definitions.items, lootDefinitions);
  }
  const freshDaily = buildDailySummary(now, dailyLiveData);
  const daily = cached ? {
    ...freshDaily,
    sources: {
      rotations: refreshPlan.activities ? freshDaily.sources.rotations : cached.daily.sources.rotations,
      lost_sector: refreshPlan.activities ? freshDaily.sources.lost_sector : cached.daily.sources.lost_sector,
      weekly_report: refreshPlan.activities ? freshDaily.sources.weekly_report : cached.daily.sources.weekly_report,
      vendors: refreshPlan.vendors ? freshDaily.sources.vendors : cached.daily.sources.vendors
    }
  } : freshDaily;
  const weekly = refreshPlan.activities || !cached
    ? attachRotatingLootPools(buildWeeklySummary(now, weeklyLiveData), definitions.items)
    : cached.weekly;
  return {
    version: 9,
    context_key: contextKey,
    saved_at: now.toISOString(),
    fetched_at: snapshot.fetchedAt,
    daily_period_key: dailyPeriodKey(now),
    weekly_period_key: weeklyPeriodKey(now),
    xur_period_key: xurPeriodKey(now),
    xur_refresh_at: findXurRefreshAt(daily, now),
    daily,
    weekly
  };
}

/**
 * 轮换突袭与轮换地牢的掉落池来自受控数据集（Bungie Collectible + DIM 交叉核对）。
 * 首页周报里只装配武器清单；数据集未覆盖的活动保留原有聚合奖励展示。
 */
function collectRotatingLootPoolHashes(items: WeeklySummaryItem[]): number[] {
  const hashes = new Set<number>();
  for (const item of items) {
    if (item.weeklyActivityKind !== "rotating_raid" && item.weeklyActivityKind !== "rotating_dungeon") {
      continue;
    }
    const activityHash = item.related_hashes?.[0];
    if (typeof activityHash !== "number" || !Number.isFinite(activityHash)) continue;
    for (const hash of lootPoolItemHashesForActivity(activityHash)) hashes.add(hash);
  }
  return [...hashes];
}

function attachRotatingLootPools(
  summary: WeeklySummary,
  itemDefinitions: DefinitionComponentData
): WeeklySummary {
  const priorities = { ...summary.priorities };
  for (const kind of ["rotating_raid", "rotating_dungeon"] as const) {
    const priority = priorities[kind];
    const entries = (priority.entries ?? []).map((entry) => {
      const lootPool = buildLootPool(entry.related_hashes?.[0], itemDefinitions);
      return lootPool.length ? { ...entry, loot_pool: lootPool } : entry;
    });
    priorities[kind] = { ...priority, entries };
  }
  return { ...summary, priorities };
}

function buildLootPool(
  activityHash: number | undefined,
  itemDefinitions: DefinitionComponentData
): WeeklyActivityReward[] {
  if (typeof activityHash !== "number" || !Number.isFinite(activityHash)) return [];
  return lootPoolItemHashesForActivity(activityHash)
    .map((hash) => {
      const definition = itemDefinitions[String(hash)];
      const name = definition?.displayProperties?.name?.trim();
      if (!name) return undefined;
      const reward: WeeklyActivityReward = { hash, name, group_key: "weapons" };
      if (definition.displayProperties?.icon) reward.icon = definition.displayProperties.icon;
      if (typeof definition.itemTypeDisplayName === "string") reward.item_type = definition.itemTypeDisplayName;
      return reward;
    })
    .filter((reward): reward is WeeklyActivityReward => Boolean(reward));
}

async function loadHomeDefinitions(snapshot: BungieHomeSnapshot): Promise<{
  activities: DefinitionComponentData;
  milestones: DefinitionComponentData;
  vendors: DefinitionComponentData;
  items: DefinitionComponentData;
  modifiers: DefinitionComponentData;
  destinations: DefinitionComponentData;
  places: DefinitionComponentData;
  objectives: DefinitionComponentData;
}> {
  const milestoneHashes = Object.keys(snapshot.milestones ?? {}).map(Number);
  const milestoneActivityHashes = Object.values(snapshot.milestones ?? {}).flatMap((milestone) =>
    (milestone.activities ?? []).flatMap((activity) => numberValue(activity.activityHash))
  );
  const milestoneItemHashes = Object.values(snapshot.milestones ?? {}).flatMap((milestone) =>
    (milestone.availableQuests ?? []).flatMap((quest) => numberValue(quest.questItemHash))
  );
  const profileActivityHashes = collectProfileActivityHashes(snapshot);
  const objectiveHashes = Object.values(snapshot.profile?.characterActivities?.data ?? {}).flatMap((component) =>
    (component.availableActivities ?? []).flatMap((activity) =>
      (activity.challenges ?? []).flatMap((challenge) => numberValue(challenge.objective?.objectiveHash))
    )
  );
  const profileRewardHashes = Object.values(snapshot.profile?.characterActivities?.data ?? {}).flatMap((component) =>
    (component.availableActivities ?? []).flatMap((activity) =>
      (activity.visibleRewards ?? []).flatMap((reward) =>
        (reward.rewardItems ?? []).flatMap((item) => numberValue(item.itemQuantity?.itemHash))
      )
    )
  );
  const vendorResponses = [snapshot.publicVendors, ...snapshot.characterVendors]
    .filter((response): response is BungieVendorsResponse => Boolean(response));
  const vendorHashes = vendorResponses.flatMap(collectVendorHashes);
  const saleItemHashes = vendorResponses.flatMap(collectVendorSales).flatMap((sale) => [
    ...numberValue(sale.itemHash),
    ...(sale.costs ?? []).flatMap((cost) => numberValue(cost.itemHash))
  ]);

  const [activities, milestones, vendors, items, objectives] = await Promise.all([
    getDefinitions("DestinyActivityDefinition", [...milestoneActivityHashes, ...profileActivityHashes]),
    getDefinitions("DestinyMilestoneDefinition", milestoneHashes),
    getDefinitions("DestinyVendorDefinition", vendorHashes, { projection: "display-summary" }),
    getDefinitions("DestinyInventoryItemDefinition", [
      ...milestoneItemHashes,
      ...profileRewardHashes,
      ...saleItemHashes
    ], { projection: "display-summary" }),
    getDefinitions("DestinyObjectiveDefinition", objectiveHashes)
  ]);

  const activityRecords = Object.values(activities) as DefinitionRecord[];
  const modifierHashes = activityRecords.flatMap((activity) =>
    ((activity.modifiers as Array<{ activityModifierHash?: number }> | undefined) ?? [])
      .flatMap((modifier) => numberValue(modifier.activityModifierHash))
  );
  const activeModifierHashes = Object.values(snapshot.profile?.characterActivities?.data ?? {}).flatMap((component) =>
    (component.availableActivities ?? []).flatMap((activity) => activity.modifierHashes ?? [])
  );
  const destinationHashes = [
    ...activityRecords.flatMap((activity) => numberValue(activity.destinationHash)),
    ...collectVendorDestinationHashes(vendorResponses, vendors)
  ];
  const placeHashes = activityRecords.flatMap((activity) => numberValue(activity.placeHash));
  const activityRewardHashes = activityRecords.flatMap((activity) =>
    ((activity.rewards as Array<{ rewardItems?: Array<{ itemHash?: number }> }> | undefined) ?? [])
      .flatMap((reward) => (reward.rewardItems ?? []).flatMap((item) => numberValue(item.itemHash)))
  );
  const challengeRewardHashes = activityRecords.flatMap((activity) =>
    (((activity as DefinitionRecord & {
      challenges?: Array<{
        dummyRewards?: Array<{ itemHash?: number }>;
        displayRewards?: Array<{ itemQuantity?: { itemHash?: number } }>;
      }>;
    }).challenges) ?? [])
      .flatMap((challenge) => [
        ...(challenge.dummyRewards ?? []).flatMap((item) => numberValue(item.itemHash)),
        ...(challenge.displayRewards ?? []).flatMap((item) => numberValue(item.itemQuantity?.itemHash))
      ])
  );
  const [modifiers, destinations, places, activityRewardItems] = await Promise.all([
    getDefinitions("DestinyActivityModifierDefinition", [...modifierHashes, ...activeModifierHashes]),
    getDefinitions("DestinyDestinationDefinition", destinationHashes),
    getDefinitions("DestinyPlaceDefinition", placeHashes),
    getDefinitions(
      "DestinyInventoryItemDefinition",
      [...activityRewardHashes, ...challengeRewardHashes],
      { projection: "display-summary" }
    )
  ]);

  return {
    activities,
    milestones,
    vendors,
    items: { ...items, ...activityRewardItems },
    modifiers,
    destinations,
    places,
    objectives
  };
}

function collectProfileActivityHashes(snapshot: BungieHomeSnapshot): number[] {
  return Object.values(snapshot.profile?.characterActivities?.data ?? {}).flatMap((component) =>
    (component.availableActivities ?? []).flatMap((activity) => numberValue(activity.activityHash))
  );
}

function collectVendorHashes(response: BungieVendorsResponse): number[] {
  return [...new Set([
    ...Object.entries(response.vendors?.data ?? {}).flatMap(([key, vendor]) =>
      numberValue(vendor.vendorHash ?? Number(key))
    ),
    ...Object.keys(response.sales?.data ?? {}).flatMap((key) => numberValue(Number(key)))
  ])];
}

function collectVendorSales(response: BungieVendorsResponse): BungiePublicSale[] {
  return Object.values(response.sales?.data ?? {}).flatMap((sales) => {
    if (!sales) return [];
    return Object.entries(sales).flatMap(([key, value]) => {
      if (key === "saleItems") {
        return Object.values(sales.saleItems ?? {}).filter(isPublicSale);
      }
      if (isPublicSale(value)) return [value];
      return value ? Object.values(value).filter(isPublicSale) : [];
    });
  });
}

function collectVendorDestinationHashes(
  responses: BungieVendorsResponse[],
  vendorDefinitions: DefinitionComponentData
): number[] {
  return responses.flatMap((response) =>
    Object.entries(response.vendors?.data ?? {}).flatMap(([key, vendor]) => {
      const vendorHash = vendor.vendorHash ?? Number(key);
      const definition = vendorDefinitions[String(vendorHash)] as (DefinitionRecord & {
        locations?: Array<{ destinationHash?: number }>;
      }) | undefined;
      if (vendor.vendorLocationIndex === undefined) return [];
      return numberValue(definition?.locations?.[vendor.vendorLocationIndex]?.destinationHash);
    })
  );
}

function isPublicSale(value: unknown): value is BungiePublicSale {
  return typeof value === "object"
    && value !== null
    && typeof (value as BungiePublicSale).itemHash === "number";
}

function numberValue(value: unknown): number[] {
  return typeof value === "number" && Number.isFinite(value) ? [value] : [];
}

type HomeRefreshPlan = {
  activities: boolean;
  vendors: boolean;
};

function createRefreshPlan(
  cached: CachedHomeBriefing | null,
  now: Date,
  force: boolean
): HomeRefreshPlan {
  if (force || !cached) return { activities: true, vendors: true };
  return {
    activities: cached.daily_period_key !== dailyPeriodKey(now)
      || cached.weekly_period_key !== weeklyPeriodKey(now)
      || ironBannerBoundaryReached(cached.weekly.iron_banner, now),
    vendors: cached.xur_period_key !== xurPeriodKey(now)
      || isExpired(cached.xur_refresh_at, now)
  };
}

function ironBannerBoundaryReached(
  ironBanner: CachedHomeBriefing["weekly"]["iron_banner"],
  now: Date
): boolean {
  const boundary = ironBanner.status === "upcoming"
    ? ironBanner.starts_at
    : ironBanner.status === "active"
      ? ironBanner.ends_at ?? ironBanner.next_refresh_at
      : undefined;
  if (!boundary) return false;
  const timestamp = Date.parse(boundary);
  return Number.isFinite(timestamp) && timestamp <= now.getTime();
}

function briefingFromCache(cached: CachedHomeBriefing, now: Date): HomeBriefing {
  const currentDaily = buildDailySummary(now);
  const currentWeekly = buildWeeklySummary(now);
  return {
    fetched_at: cached.fetched_at,
    daily: {
      ...hideInactiveXur(cached.daily, now),
      date_label: currentDaily.date_label,
      daily_reset: currentDaily.daily_reset,
      weekly_reset: currentDaily.weekly_reset
    },
    weekly: {
      ...cached.weekly,
      weekly_reset: currentWeekly.weekly_reset
    }
  };
}

async function loadBriefingCache(dataDir: string, contextKey: string): Promise<CachedHomeBriefing | null> {
  if (cachedBriefing?.context_key === contextKey) return cachedBriefing;
  if (cacheLoadRequest?.contextKey === contextKey) return cacheLoadRequest.promise;
  const promise = loadCachedHomeBriefing(dataDir, contextKey).then((value) => {
    if (value) cachedBriefing = value;
    return value;
  });
  cacheLoadRequest = { contextKey, promise };
  void promise.then(
    () => clearCacheLoadRequest(promise),
    () => clearCacheLoadRequest(promise)
  );
  return promise;
}

function dailyPeriodKey(now: Date): string {
  return latestUtcBoundary(now, [0, 1, 2, 3, 4, 5, 6]).toISOString();
}

function weeklyPeriodKey(now: Date): string {
  return latestUtcBoundary(now, [2]).toISOString();
}

function latestUtcBoundary(now: Date, weekdays: number[]): Date {
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - offset,
      17,
      0,
      0,
      0
    ));
    if (weekdays.includes(candidate.getUTCDay()) && candidate <= now) return candidate;
  }
  return new Date(now);
}

function findXurRefreshAt(daily: DailySummary, now: Date): string | undefined {
  if (!isXurActiveAt(now)) return undefined;
  const timestamp = now.getTime();
  const timestamps = (daily.sources.vendors.items ?? [])
    .filter((item) => item.vendorHash === xurVendorHash)
    .map((item) => item.vendorRefreshDate)
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value) && value > timestamp)
    .sort((left, right) => left - right);
  return timestamps.length ? new Date(timestamps[0]).toISOString() : undefined;
}

function hideInactiveXur(daily: DailySummary, now: Date): DailySummary {
  if (isXurActiveAt(now)) return daily;
  return {
    ...daily,
    sources: {
      ...daily.sources,
      vendors: {
        ...daily.sources.vendors,
        items: daily.sources.vendors.items?.filter((item) => item.vendorHash !== xurVendorHash)
      }
    }
  };
}

function isExpired(value: string | undefined, now: Date): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= now.getTime();
}

function loadTokenOnce(config: Parameters<typeof loadFreshOAuthToken>[0]): Promise<FreshOAuthToken | null> {
  const contextKey = `${config.data.data_dir}\u0000${config.bungie.client_id}`;
  if (tokenRequest?.contextKey === contextKey) {
    return tokenRequest.promise;
  }
  const promise = loadFreshOAuthToken(config).catch(() => null);
  tokenRequest = { contextKey, promise };
  void promise.then(
    () => clearTokenRequest(promise),
    () => clearTokenRequest(promise)
  );
  return promise;
}

function clearBriefingRequest(promise: Promise<CachedHomeBriefing>): void {
  if (briefingRequest?.promise === promise) {
    briefingRequest = null;
  }
}

function clearCacheLoadRequest(promise: Promise<CachedHomeBriefing | null>): void {
  if (cacheLoadRequest?.promise === promise) cacheLoadRequest = null;
}

function clearTokenRequest(promise: Promise<FreshOAuthToken | null>): void {
  if (tokenRequest?.promise === promise) {
    tokenRequest = null;
  }
}
