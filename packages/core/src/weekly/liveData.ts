import type { BungieJsonFetcher } from "../bungie/transport.js";
import { isIronBannerActivityMode } from "../activities/modes.js";
import type { DefinitionComponentData, DefinitionRecord } from "../manifest/definitions.js";
import { classifyBucket } from "../items/classification.js";
import type { BungieOAuthToken } from "../oauth/login.js";
import type {
  WeeklyActivityReward,
  WeeklyIronBannerChallenge,
  WeeklyIronBannerLootItem,
  WeeklyIronBannerLootPool,
  WeeklyIronBannerRewardGroup,
  WeeklyIronBannerSummary,
  WeeklyLiveData,
  WeeklyPriorityKind,
  WeeklySummaryItem
} from "./summary.js";

type PublicMilestone = {
  startDate?: string | null;
  endDate?: string | null;
  displayProperties?: {
    name?: string;
    description?: string;
  };
  activities?: Array<{
    activityHash?: number;
  }>;
  availableQuests?: Array<{
    questItemHash?: number;
  }>;
};

type DestinyProfileActivitiesResponse = {
  characters?: {
    data?: Record<string, { characterId?: string }>;
  };
  characterActivities?: {
    data?: Record<string, {
      availableActivities?: DestinyAvailableActivity[];
    }>;
  };
};

type UserMembershipData = {
  destinyMemberships?: DestinyMembership[];
  primaryMembershipId?: string;
};

type DestinyMembership = {
  membershipId: string;
  membershipType: number;
};

type DestinyAvailableActivity = {
  activityHash?: number;
  modifierHashes?: number[];
  challenges?: Array<{
    objective?: {
      objectiveHash?: number;
      progress?: number;
      completionValue?: number;
      complete?: boolean;
      visible?: boolean;
    };
  }>;
  visibleRewards?: Array<{
    displayBehavior?: number;
    rewardItems?: Array<{
      itemQuantity?: {
        itemHash?: number;
      };
    }>;
  }>;
};

type CharacterVendorResponse = {
  characterId: string;
  vendors?: {
    data?: Record<string, {
      vendorHash?: number;
      enabled?: boolean;
      canPurchase?: boolean;
      nextRefreshDate?: string;
    }>;
  };
  categories?: {
    data?: Record<string, {
      categories?: Array<{
        displayCategoryIndex?: number;
        itemIndexes?: number[];
      }>;
    }>;
  };
  sales?: {
    data?: Record<string, Record<string, unknown> & {
      saleItems?: Record<string, VendorSale>;
    }>;
  };
};

type VendorSale = {
  vendorItemIndex?: number;
  itemHash?: number;
  costs?: Array<{
    itemHash?: number;
    quantity?: number;
  }>;
};

export type BuildWeeklyLiveDataInput = {
  now?: Date;
  milestones?: Record<string, PublicMilestone>;
  profile?: DestinyProfileActivitiesResponse;
  characterVendors?: CharacterVendorResponse[];
  definitions?: {
    activities?: DefinitionComponentData | null;
    milestones?: DefinitionComponentData | null;
    vendors?: DefinitionComponentData | null;
    items?: DefinitionComponentData | null;
    objectives?: DefinitionComponentData | null;
    modifiers?: DefinitionComponentData | null;
  };
};

export type FetchWeeklyLiveDataOptions = {
  token?: BungieOAuthToken | null;
  definitions?: BuildWeeklyLiveDataInput["definitions"];
  fetchJson: BungieJsonFetcher;
};

export async function fetchWeeklyLiveData(options: FetchWeeklyLiveDataOptions): Promise<WeeklyLiveData> {
  const { fetchJson } = options;
  const milestones = await fetchJson<Record<string, PublicMilestone>>("/Destiny2/Milestones/")
    .catch(() => undefined);
  const profile = options.token?.access_token
    ? await fetchProfileActivities({
      accessToken: options.token.access_token,
      fetchJson
    }).catch(() => undefined)
    : undefined;

  return buildWeeklyLiveDataFromBungie({
    milestones,
    profile,
    definitions: options.definitions
  });
}

async function fetchProfileActivities(input: {
  accessToken: string;
  fetchJson: <T>(path: string, accessToken?: string) => Promise<T>;
}): Promise<DestinyProfileActivitiesResponse> {
  const memberships = await input.fetchJson<UserMembershipData>(
    "/User/GetMembershipsForCurrentUser/",
    input.accessToken
  );
  const membership = selectDestinyMembership(memberships);
  return input.fetchJson<DestinyProfileActivitiesResponse>(
    `/Destiny2/${membership.membershipType}/Profile/${membership.membershipId}/?components=200,204`,
    input.accessToken
  );
}

function selectDestinyMembership(data: UserMembershipData): DestinyMembership {
  const memberships = data.destinyMemberships ?? [];
  const selected = memberships.find((membership) => membership.membershipId === data.primaryMembershipId)
    ?? memberships[0];
  if (!selected) {
    throw new Error("当前 Bungie 账号没有 Destiny 档案");
  }

  return selected;
}

export function buildWeeklyLiveDataFromBungie(input: BuildWeeklyLiveDataInput): WeeklyLiveData {
  const items: WeeklySummaryItem[] = [];
  const publicClues: WeeklySummaryItem[] = [];
  const definitions = input.definitions ?? {};

  items.push(...mapProfileActivities(input.profile, definitions));

  for (const [hash, milestone] of Object.entries(input.milestones ?? {})) {
    const milestoneDefinition = definitionRecord(definitions.milestones, Number(hash));
    const milestoneName = readableName(milestone) ?? milestoneDefinition?.displayProperties?.name?.trim();
    const milestoneDescription = milestone.displayProperties?.description
      ?? milestoneDefinition?.displayProperties?.description;
    const activityNames = (milestone.activities ?? [])
      .map((activity) => definitionName(definitions.activities, activity.activityHash))
      .filter(Boolean) as string[];
    const questNames = (milestone.availableQuests ?? [])
      .map((quest) => definitionName(definitions.items, quest.questItemHash))
      .filter(Boolean) as string[];
    const names = [...activityNames, ...questNames].slice(0, 6);

    if (!milestoneName && !names.length) {
      continue;
    }

    const candidateText = [milestoneName, names.join(" "), milestoneDescription].filter(Boolean).join(" ");
    const weeklyActivityKind = inferWeeklyActivityKind(candidateText);
    const item: WeeklySummaryItem = {
      title: milestoneName ? `Bungie 公共里程碑：${milestoneName}` : `Bungie 公共活动：${names[0]}`,
      subtitle: names.length ? `非完整掉落地图；${names.slice(0, 3).join(" / ")}` : "Bungie 公共里程碑",
      description: milestoneDescription,
      source: "Bungie",
      weeklyActivityKind
    };

    if (weeklyActivityKind && weeklyActivityKind !== "public_clue" && !isPublicMilestoneOnlyClue(weeklyActivityKind)) {
      items.push(item);
    } else {
      publicClues.push({ ...item, weeklyActivityKind: "public_clue" });
    }
  }

  return {
    items: uniqueByKindAndTitle(items).slice(0, 12),
    iron_banner: buildIronBannerSummary(input, definitions, input.now ?? new Date()),
    public_clues: uniqueByTitle(publicClues).slice(0, 4)
  };
}

type IronBannerMilestoneWindow = {
  status: "active" | "upcoming" | "inactive";
  milestoneHash: number;
  startsAt?: string;
  endsAt?: string;
};

function buildIronBannerSummary(
  input: BuildWeeklyLiveDataInput,
  definitions: NonNullable<BuildWeeklyLiveDataInput["definitions"]>,
  now: Date
): WeeklyIronBannerSummary {
  const characterData = input.profile?.characterActivities?.data;
  const totalCharacterIds = Object.keys(input.profile?.characters?.data ?? characterData ?? {});
  const lootPool = buildIronBannerLootPool(input.characterVendors ?? [], definitions, now);
  const milestoneWindow = findIronBannerMilestoneWindow(input.milestones, definitions, now);
  if (!input.profile || !characterData) {
    if (milestoneWindow?.status === "active" || milestoneWindow?.status === "upcoming") {
      return createMilestoneConfirmedIronBanner(totalCharacterIds.length, lootPool, milestoneWindow);
    }
    return createIronBannerState("unavailable", totalCharacterIds.length, {
      title: "铁旗状态待确认",
      detail: "登录 Bungie 后读取角色活动、每周挑战和萨拉丁库存。"
    }, lootPool);
  }

  const characterEntries: WeeklyIronBannerSummary["characters"]["entries"] = {};
  const activeActivities: Array<{ characterId: string; activity: DestinyAvailableActivity; definition: DefinitionRecord }> = [];
  for (const [characterId, component] of Object.entries(characterData)) {
    const matches = (component.availableActivities ?? []).flatMap((activity) => {
      const definition = definitionRecord(definitions.activities, activity.activityHash);
      return definition && isIronBannerActivityDefinition(definition)
        ? [{ activity, definition }]
        : [];
    });
    const match = matches.find(({ activity }) => Boolean(ironBannerChallenge(activity, definitions.objectives)))
      ?? matches[0];
    if (!match) continue;
    const challenge = ironBannerChallenge(match.activity, definitions.objectives);
    characterEntries[characterId] = {
      character_id: characterId,
      activity_hash: match.activity.activityHash,
      challenge
    };
    activeActivities.push({ characterId, activity: match.activity, definition: match.definition });
  }

  if (!activeActivities.length) {
    if (milestoneWindow?.status === "active" || milestoneWindow?.status === "upcoming") {
      return createMilestoneConfirmedIronBanner(totalCharacterIds.length, lootPool, milestoneWindow);
    }
    return createIronBannerState("inactive", totalCharacterIds.length, {
      title: "铁旗当前未开放",
      detail: "固定保留此区域；当前角色活动列表没有返回铁旗玩法。"
    }, lootPool);
  }

  const representative = activeActivities[0];
  const activityName = activityDisplayName(representative.definition) ?? "铁旗";
  const playlistName = ironBannerPlaylistName(representative.definition);
  const relatedHashes = uniqueNumbers([
    representative.activity.activityHash,
    ...activityModifierHashes(representative.definition),
    ...Object.values(characterEntries).flatMap((entry) => numberList(entry.challenge?.objective_hash))
  ]);

  const timing = ironBannerTimingFields(milestoneWindow?.status === "active" ? milestoneWindow : undefined);
  if (!timing.ends_at && lootPool.refresh_at) {
    timing.next_refresh_at = lootPool.refresh_at;
    timing.timing_source = "Bungie Character Vendors";
  }

  return {
    status: "active",
    title: "铁旗已开放",
    detail: [activityName, playlistName, "限时熔炉竞技场"].filter(Boolean).join(" · "),
    activity_name: activityName,
    activity_icon: representative.definition.displayProperties?.icon,
    playlist_name: playlistName,
    evidence: relatedHashes.length ? `活动与目标 Hash：${relatedHashes.join(" / ")}` : undefined,
    source: "Bungie CharacterActivities + 当前 Manifest",
    ...timing,
    related_hashes: relatedHashes,
    characters: {
      available_count: activeActivities.length,
      total_count: totalCharacterIds.length,
      entries: characterEntries
    },
    reward_groups: ironBannerRewardGroups(representative.activity, definitions.items),
    loot_pool: lootPool
  };
}

function createMilestoneConfirmedIronBanner(
  totalCharacters: number,
  lootPool: WeeklyIronBannerLootPool,
  milestone: IronBannerMilestoneWindow
): WeeklyIronBannerSummary {
  const upcoming = milestone.status === "upcoming";
  return {
    status: upcoming ? "upcoming" : "active",
    title: upcoming ? "铁旗即将开放" : "铁旗已开放",
    detail: upcoming
      ? "Bungie 公共里程碑已提供铁旗开放时间。"
      : "Bungie 公共里程碑已确认开放；当前角色挑战数据待读取。",
    activity_name: "铁旗",
    playlist_name: upcoming ? undefined : "当前玩法待读取",
    source: "Bungie Public Milestones + 当前 Manifest",
    evidence: `里程碑 Hash：${milestone.milestoneHash}`,
    related_hashes: [milestone.milestoneHash],
    ...ironBannerTimingFields(milestone),
    characters: {
      available_count: 0,
      total_count: totalCharacters,
      entries: {}
    },
    reward_groups: [],
    loot_pool: lootPool
  };
}

function createIronBannerState(
  status: "inactive" | "unavailable",
  totalCharacters: number,
  copy: { title: string; detail: string },
  lootPool: WeeklyIronBannerLootPool = emptyIronBannerLootPool()
): WeeklyIronBannerSummary {
  return {
    status,
    title: copy.title,
    detail: copy.detail,
    characters: {
      available_count: 0,
      total_count: totalCharacters,
      entries: {}
    },
    reward_groups: [],
    loot_pool: lootPool
  };
}

function findIronBannerMilestoneWindow(
  milestones: Record<string, PublicMilestone> | undefined,
  definitions: NonNullable<BuildWeeklyLiveDataInput["definitions"]>,
  now: Date
): IronBannerMilestoneWindow | undefined {
  const timestamp = now.getTime();
  const candidates = Object.entries(milestones ?? {}).flatMap(([hash, milestone]) => {
    const milestoneHash = Number(hash);
    if (!Number.isFinite(milestoneHash)) return [];
    const milestoneDefinition = definitionRecord(definitions.milestones, milestoneHash);
    const activityDefinitions = (milestone.activities ?? [])
      .map((activity) => definitionRecord(definitions.activities, activity.activityHash))
      .filter((definition): definition is DefinitionRecord => Boolean(definition));
    const milestoneText = [
      readableName(milestone),
      milestoneDefinition?.displayProperties?.name,
      milestoneDefinition?.displayProperties?.description,
      ...activityDefinitions.flatMap((definition) => [
        definition.displayProperties?.name,
        definition.displayProperties?.description,
        definition.originalDisplayProperties?.name,
        definition.originalDisplayProperties?.description
      ])
    ].filter(Boolean).join(" ");
    if (!isIronBannerText(milestoneText)
      && !activityDefinitions.some((definition) => isIronBannerActivityDefinition(definition))) {
      return [];
    }

    const startsAt = normalizedIsoDate(milestone.startDate);
    const endsAt = normalizedIsoDate(milestone.endDate);
    const startsTimestamp = startsAt ? Date.parse(startsAt) : undefined;
    const endsTimestamp = endsAt ? Date.parse(endsAt) : undefined;
    const status = startsTimestamp !== undefined && timestamp < startsTimestamp
      ? "upcoming"
      : endsTimestamp !== undefined && timestamp >= endsTimestamp
        ? "inactive"
        : "active";
    return [{
      status,
      milestoneHash,
      startsAt,
      endsAt
    } satisfies IronBannerMilestoneWindow];
  });

  return candidates.sort((left, right) => {
    const statusOrder = { active: 0, upcoming: 1, inactive: 2 } as const;
    const statusDifference = statusOrder[left.status] - statusOrder[right.status];
    if (statusDifference) return statusDifference;
    const leftBoundary = Date.parse(left.startsAt ?? left.endsAt ?? "");
    const rightBoundary = Date.parse(right.startsAt ?? right.endsAt ?? "");
    return (Number.isFinite(leftBoundary) ? leftBoundary : Number.MAX_SAFE_INTEGER)
      - (Number.isFinite(rightBoundary) ? rightBoundary : Number.MAX_SAFE_INTEGER);
  })[0];
}

function ironBannerTimingFields(
  milestone: IronBannerMilestoneWindow | undefined
): Pick<WeeklyIronBannerSummary, "starts_at" | "ends_at" | "next_refresh_at" | "timing_source"> {
  if (!milestone) return {};
  const timing: Pick<WeeklyIronBannerSummary, "starts_at" | "ends_at" | "next_refresh_at" | "timing_source"> = {
    timing_source: "Bungie Public Milestones"
  };
  if (milestone.startsAt) timing.starts_at = milestone.startsAt;
  if (milestone.endsAt) timing.ends_at = milestone.endsAt;
  return timing;
}

function normalizedIsoDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function isIronBannerActivityDefinition(definition: DefinitionRecord): boolean {
  const directMode = typeof definition.directActivityModeType === "number"
    ? definition.directActivityModeType
    : undefined;
  const modes = Array.isArray(definition.activityModeTypes)
    ? definition.activityModeTypes.filter((mode): mode is number => typeof mode === "number")
    : [];
  if ([directMode, ...modes].some((mode) => mode !== undefined && isIronBannerActivityMode(mode))) {
    return true;
  }
  return isIronBannerText([
    definition.displayProperties?.name,
    definition.displayProperties?.description,
    definition.originalDisplayProperties?.name,
    definition.originalDisplayProperties?.description
  ].filter(Boolean).join(" "));
}

function ironBannerPlaylistName(definition: DefinitionRecord): string {
  const matchmaking = definition.matchmaking as { isMatchmade?: boolean } | undefined;
  return matchmaking?.isMatchmade === false ? "非匹配活动" : "匹配开放";
}

function activityModifierHashes(definition: DefinitionRecord): number[] {
  const modifiers = definition.modifiers as Array<{ activityModifierHash?: number }> | undefined;
  return (modifiers ?? []).flatMap((modifier) => numberList(modifier.activityModifierHash));
}

function ironBannerChallenge(
  activity: DestinyAvailableActivity,
  definitions: DefinitionComponentData | null | undefined
): WeeklyIronBannerChallenge | undefined {
  const challenge = (activity.challenges ?? []).find((candidate) => candidate.objective?.visible !== false)
    ?? activity.challenges?.[0];
  const objective = challenge?.objective;
  if (!objective) return undefined;
  const definition = definitionRecord(definitions, objective.objectiveHash);
  const completionValue = positiveNumber(objective.completionValue)
    ?? positiveNumber(definition?.completionValue)
    ?? 1;
  const progress = Math.max(0, finiteNumber(objective.progress) ?? 0);
  return {
    objective_hash: objective.objectiveHash,
    progress,
    completion_value: completionValue,
    complete: objective.complete === true || progress >= completionValue,
    progress_label: definition?.progressDescription?.trim() || undefined,
    description: definition?.displayProperties?.description?.trim() || undefined
  };
}

function ironBannerRewardGroups(
  activity: DestinyAvailableActivity,
  definitions: DefinitionComponentData | null | undefined
): WeeklyIronBannerRewardGroup[] {
  return (activity.visibleRewards ?? []).flatMap((group, index) => {
    const items = rewardItems(group.rewardItems, definitions);
    if (!items.length) return [];
    const conditional = group.displayBehavior === 1;
    return [{
      display_behavior: group.displayBehavior,
      label: conditional ? "概率掉落提示" : (index === 0 ? "活动奖励提示" : "额外奖励提示"),
      note: conditional
        ? "条件可见的通用熔炉掉落，不计入铁旗专属奖励。"
        : "当前角色活动列表可见，不代表每局必定获得。",
      conditional,
      items
    }];
  });
}

function rewardItems(
  rewards: Array<{ itemQuantity?: { itemHash?: number } }> | undefined,
  definitions: DefinitionComponentData | null | undefined
): WeeklyActivityReward[] {
  return uniqueNumbers((rewards ?? []).flatMap((reward) => numberList(reward.itemQuantity?.itemHash)))
    .map((hash) => activityReward(hash, definitions))
    .filter((reward): reward is WeeklyActivityReward => Boolean(reward));
}

function activityReward(
  hash: number,
  definitions: DefinitionComponentData | null | undefined
): WeeklyActivityReward | undefined {
  const definition = definitionRecord(definitions, hash);
  const name = definition?.displayProperties?.name?.trim();
  if (!name) return undefined;
  const reward: WeeklyActivityReward = { hash, name };
  if (definition?.displayProperties?.icon) reward.icon = definition.displayProperties.icon;
  if (typeof definition?.itemTypeDisplayName === "string") reward.item_type = definition.itemTypeDisplayName;
  const group = classifyBucket(definition?.inventory?.bucketTypeHash)?.group;
  if (group) reward.group_key = group;
  return reward;
}

function buildIronBannerLootPool(
  responses: CharacterVendorResponse[],
  definitions: NonNullable<BuildWeeklyLiveDataInput["definitions"]>,
  now: Date
): WeeklyIronBannerLootPool {
  if (!responses.length) return emptyIronBannerLootPool();
  const vendorHashes = collectIronBannerVendorHashes(responses, definitions);
  const offers = responses.flatMap((response) => collectIronBannerVendorOffers(response, vendorHashes, definitions));
  const uniqueOffers = uniqueIronBannerOffers(offers);
  const attunement = uniqueOffers.filter((offer) => offer.semantic === "attunement");
  const focusing = uniqueOffers.filter((offer) => offer.semantic === "focusing");
  const weapons = focusing.filter((offer) => offer.item.group_key === "weapons");
  const armor = focusing.filter((offer) => offer.item.group_key === "armor");
  const featured = [...weapons.slice(0, 3), ...armor.slice(0, 1)].map((offer) => offer.item);
  const refreshCandidates = responses.flatMap((response) => Object.entries(response.vendors?.data ?? {}))
    .map(([key, vendor]) => ({
      vendorHash: vendor.vendorHash ?? Number(key),
      vendor,
      definition: definitionRecord(definitions.vendors, vendor.vendorHash ?? Number(key))
    }))
    .filter(({ vendorHash }) => vendorHashes.has(vendorHash));
  const refreshAt = refreshCandidates
    .filter(({ definition }) => definition?.vendorIdentifier?.toUpperCase() === "IRON_BANNER")
    .map(({ vendor }) => vendor.nextRefreshDate)
    .filter((value): value is string => Boolean(value))
    .filter((value) => {
      const timestamp = Date.parse(value);
      return Number.isFinite(timestamp) && timestamp > now.getTime();
    })
    .sort()[0];
  return {
    status: vendorHashes.size ? "ready" : "pending",
    source: vendorHashes.size
      ? "Bungie Character Vendors + 当前 Manifest"
      : "当前未读取到萨拉丁商人库存",
    refresh_at: refreshAt,
    attunement_count: attunement.length,
    weapon_offer_count: weapons.length,
    armor_offer_count: armor.length,
    featured_items: featured
  };
}

function emptyIronBannerLootPool(): WeeklyIronBannerLootPool {
  return {
    status: "pending",
    source: "等待 Bungie Character Vendors",
    attunement_count: 0,
    weapon_offer_count: 0,
    armor_offer_count: 0,
    featured_items: []
  };
}

type IronBannerVendorOffer = {
  semantic: "attunement" | "focusing" | "other";
  item: WeeklyIronBannerLootItem;
};

function collectIronBannerVendorHashes(
  responses: CharacterVendorResponse[],
  definitions: NonNullable<BuildWeeklyLiveDataInput["definitions"]>
): Set<number> {
  const hashes = new Set<number>();
  const sales = responses.flatMap((response) => vendorSales(response));
  for (const { vendorHash, sale } of sales) {
    const vendorDefinition = definitionRecord(definitions.vendors, vendorHash);
    const itemDefinition = definitionRecord(definitions.items, sale.itemHash);
    const costDefinitions = (sale.costs ?? []).map((cost) => definitionRecord(definitions.items, cost.itemHash));
    if (isIronBannerText(definitionText(vendorDefinition))
      || isIronBannerText(definitionText(itemDefinition))
      || costDefinitions.some((definition) => isIronBannerText(definitionText(definition)))) {
      hashes.add(vendorHash);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const { vendorHash, sale } of sales) {
      const previewVendorHash = previewVendor(definitionRecord(definitions.items, sale.itemHash));
      if (hashes.has(vendorHash) && previewVendorHash !== undefined && !hashes.has(previewVendorHash)) {
        hashes.add(previewVendorHash);
        changed = true;
      }
    }
  }
  return hashes;
}

function collectIronBannerVendorOffers(
  response: CharacterVendorResponse,
  vendorHashes: Set<number>,
  definitions: NonNullable<BuildWeeklyLiveDataInput["definitions"]>
): IronBannerVendorOffer[] {
  return vendorSales(response).flatMap(({ vendorHash, sale, itemIndex }) => {
    if (!vendorHashes.has(vendorHash) || sale.itemHash === undefined) return [];
    const definition = definitionRecord(definitions.items, sale.itemHash);
    const group = classifyBucket(definition?.inventory?.bucketTypeHash)?.group;
    if (group !== "weapons" && group !== "armor") return [];
    const baseReward = activityReward(sale.itemHash, definitions.items);
    if (!baseReward) return [];
    const category = vendorCategoryText(response, vendorHash, itemIndex, definitions.vendors);
    const vendorText = definitionText(definitionRecord(definitions.vendors, vendorHash));
    const semanticText = `${category} ${vendorText}`;
    const semantic = /attun|同调/i.test(semanticText)
      ? "attunement"
      : /focus|聚焦|解码|focusing/i.test(semanticText)
        ? "focusing"
        : "other";
    return [{
      semantic,
      item: {
        ...baseReward,
        cost_label: formatVendorCosts(sale, definitions.items)
      }
    }];
  });
}

function vendorSales(response: CharacterVendorResponse): Array<{
  vendorHash: number;
  itemIndex: number;
  sale: VendorSale;
}> {
  return Object.entries(response.sales?.data ?? {}).flatMap(([vendorKey, rawSales]) => {
    const vendorHash = Number(vendorKey);
    return collectSales(rawSales).flatMap(([itemKey, sale]) => {
      if (!isVendorSale(sale)) return [];
      return [{ vendorHash, itemIndex: sale.vendorItemIndex ?? Number(itemKey), sale }];
    });
  });
}

function collectSales(rawSales: (Record<string, unknown> & { saleItems?: Record<string, VendorSale> }) | undefined): Array<[string, VendorSale]> {
  if (!rawSales) return [];
  const nested = Object.entries(rawSales.saleItems ?? {});
  const direct = Object.entries(rawSales).flatMap(([key, value]) => {
    if (key === "saleItems") return [];
    if (isVendorSale(value)) return [[key, value] as [string, VendorSale]];
    if (!value || typeof value !== "object") return [];
    return Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, VendorSale] => isVendorSale(entry[1]));
  });
  return [...nested, ...direct];
}

function vendorCategoryText(
  response: CharacterVendorResponse,
  vendorHash: number,
  itemIndex: number,
  definitions: DefinitionComponentData | null | undefined
): string {
  const definition = definitionRecord(definitions, vendorHash);
  const categoryIndex = response.categories?.data?.[String(vendorHash)]?.categories
    ?.find((category) => category.itemIndexes?.includes(itemIndex))?.displayCategoryIndex
    ?? vendorDefinitionItemCategory(definition, itemIndex);
  const displayCategories = definition?.displayCategories as Array<{
    identifier?: string;
    displayProperties?: { name?: string };
  }> | undefined;
  const category = categoryIndex === undefined ? undefined : displayCategories?.[categoryIndex];
  return [category?.identifier, category?.displayProperties?.name].filter(Boolean).join(" ");
}

function vendorDefinitionItemCategory(definition: DefinitionRecord | undefined, itemIndex: number): number | undefined {
  const itemList = definition?.itemList as Array<{ displayCategoryIndex?: number }> | undefined;
  return itemList?.[itemIndex]?.displayCategoryIndex;
}

function formatVendorCosts(
  sale: VendorSale,
  definitions: DefinitionComponentData | null | undefined
): string | undefined {
  const labels = (sale.costs ?? []).flatMap((cost) => {
    const name = definitionName(definitions, cost.itemHash);
    if (!name) return [];
    return [`${Math.max(0, cost.quantity ?? 0)} ${name}`];
  });
  return labels.length ? labels.join(" · ") : undefined;
}

function uniqueIronBannerOffers(offers: IronBannerVendorOffer[]): IronBannerVendorOffer[] {
  const seen = new Set<string>();
  return offers.filter((offer) => {
    const key = `${offer.semantic}:${offer.item.hash}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function previewVendor(definition: DefinitionRecord | undefined): number | undefined {
  const preview = definition?.preview as { previewVendorHash?: number } | undefined;
  return preview?.previewVendorHash;
}

function definitionText(definition: DefinitionRecord | undefined): string {
  const vendorIdentifier = typeof definition?.vendorIdentifier === "string" ? definition.vendorIdentifier : undefined;
  return [
    vendorIdentifier,
    definition?.displayProperties?.name,
    definition?.displayProperties?.description,
    definition?.itemTypeDisplayName
  ].filter(Boolean).join(" ");
}

function isIronBannerText(value: string): boolean {
  return /铁旗|Iron Banner|萨拉丁|Saladin|IRON_BANNER/i.test(value);
}

function isVendorSale(value: unknown): value is VendorSale {
  return typeof value === "object" && value !== null && typeof (value as VendorSale).itemHash === "number";
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function positiveNumber(value: unknown): number | undefined {
  const number = finiteNumber(value);
  return number !== undefined && number > 0 ? number : undefined;
}

function numberList(value: unknown): number[] {
  return typeof value === "number" && Number.isFinite(value) ? [value] : [];
}

function uniqueNumbers(values: Array<number | undefined>): number[] {
  return [...new Set(values.filter((value): value is number => typeof value === "number" && Number.isFinite(value)))];
}

type ElementalSurgeKey = "solar" | "arc" | "void" | "stasis" | "strand";

type ActiveElementalSurge = {
  key: ElementalSurgeKey;
  hash: number;
  name: string;
};

const elementalSurgeOrder: ElementalSurgeKey[] = ["solar", "arc", "void", "stasis", "strand"];

function mapProfileActivities(
  profile: DestinyProfileActivitiesResponse | undefined,
  definitions: NonNullable<BuildWeeklyLiveDataInput["definitions"]>
): WeeklySummaryItem[] {
  const items: WeeklySummaryItem[] = [];
  const activityGroups = new Map<number, DestinyAvailableActivity[]>();
  const activeSurges = new Map<ElementalSurgeKey, {
    name: string;
    modifierHashes: Set<number>;
    activityHashes: Set<number>;
  }>();

  for (const component of Object.values(profile?.characterActivities?.data ?? {})) {
    for (const activity of component.availableActivities ?? []) {
      const activityHash = activity.activityHash;
      if (activityHash === undefined) {
        continue;
      }
      const group = activityGroups.get(activityHash) ?? [];
      group.push(activity);
      activityGroups.set(activityHash, group);
    }
  }

  for (const [activityHash, activities] of activityGroups) {
    const activity = mergeProfileActivities(activities);

    const activityDefinition = definitionRecord(definitions.activities, activityHash);
    const challengeObjectives = (activity.challenges ?? [])
      .map((challenge) => challenge.objective?.objectiveHash)
      .filter((hash): hash is number => hash !== undefined);
    const objectiveTexts = challengeObjectives.map((hash) => objectiveText(definitions.objectives, hash));
    const activityName = activityDisplayName(activityDefinition);
    if (!activityName) {
      continue;
    }

    if (!activityDefinition?.activityModeTypes?.includes(5)) {
      for (const surge of activityElementalSurges(activity, definitions.modifiers)) {
        const aggregate = activeSurges.get(surge.key) ?? {
          name: surge.name,
          modifierHashes: new Set<number>(),
          activityHashes: new Set<number>()
        };
        aggregate.modifierHashes.add(surge.hash);
        aggregate.activityHashes.add(activityHash);
        activeSurges.set(surge.key, aggregate);
      }
    }

    if (objectiveTexts.some(isGrandmasterVanguardAlertObjective)) {
      items.push({
        title: activityName,
        subtitle: "先锋行动 · 宗师先锋警戒",
        description: rewardDescription(activity, definitions.items),
        source: "Bungie CharacterActivities",
        weeklyActivityKind: "nightfall",
        related_hashes: [activityHash, ...challengeObjectives],
        rewards: activityRewards(activity, definitions.items)
      });
      continue;
    }

    if (isRaidActivity(activityDefinition) && objectiveTexts.some(isWeeklyRaidChallengeObjective)) {
      items.push({
        title: activityName,
        subtitle: "周常突袭挑战",
        description: rewardDescription(activity, definitions.items),
        source: "Bungie CharacterActivities",
        weeklyActivityKind: "rotating_raid",
        related_hashes: [activityHash, ...challengeObjectives],
        rewards: activityRewards(activity, definitions.items)
      });
      continue;
    }

    if (isDungeonActivity(activityDefinition) && objectiveTexts.some(isWeeklyDungeonChallengeObjective)) {
      items.push({
        title: activityName,
        subtitle: "周常地牢挑战",
        description: rewardDescription(activity, definitions.items),
        source: "Bungie CharacterActivities",
        weeklyActivityKind: "rotating_dungeon",
        related_hashes: [activityHash, ...challengeObjectives],
        rewards: activityRewards(activity, definitions.items)
      });
    }
  }

  const orderedSurges = elementalSurgeOrder.flatMap((key) => {
    const surge = activeSurges.get(key);
    return surge ? [surge] : [];
  });
  if (orderedSurges.length) {
    items.unshift({
      title: orderedSurges.map((surge) => surge.name).join(" / "),
      description: "仅对活动详情中列出对应修饰词的 PvE 内容生效；不作用于全部 PvE 或 PvP。",
      source: "Bungie CharacterActivities modifierHashes + 当前 Manifest",
      weeklyActivityKind: "weekly_surge",
      related_hashes: uniqueNumbers(orderedSurges.flatMap((surge) => [
        ...surge.modifierHashes,
        ...surge.activityHashes
      ]))
    });
  }

  return items;
}

function mergeProfileActivities(activities: DestinyAvailableActivity[]): DestinyAvailableActivity {
  const first = activities[0] ?? {};
  const challenges = new Map<number, NonNullable<DestinyAvailableActivity["challenges"]>[number]>();
  for (const activity of activities) {
    for (const challenge of activity.challenges ?? []) {
      const objectiveHash = challenge.objective?.objectiveHash;
      if (objectiveHash !== undefined) {
        challenges.set(objectiveHash, challenge);
      }
    }
  }

  return {
    ...first,
    modifierHashes: uniqueNumbers(activities.flatMap((activity) => activity.modifierHashes ?? [])),
    challenges: [...challenges.values()],
    visibleRewards: activities.flatMap((activity) => activity.visibleRewards ?? [])
  };
}

function inferWeeklyActivityKind(value: string): WeeklyPriorityKind | "public_clue" | undefined {
  if (/试炼|Trials|铁旗|Iron Banner/i.test(value)) return undefined;
  if (/日落|Nightfall/i.test(value)) return "nightfall";
  if (/特殊活动|限时活动|曙光|英灵日|守护者游戏|至日|Event|Festival|Solstice|Guardian Games/i.test(value)) return "special_event";
  if (/守望者尖塔|预言|二象性|贪婪之握|异端深渊|破碎王座|战争领主的废墟|鬼魅深渊|Spire of the Watcher|Prophecy|Duality|Grasp of Avarice|Pit of Heresy|Shattered Throne|Warlord'?s Ruin|Ghosts of the Deep/i.test(value)) {
    return "rotating_dungeon";
  }
  if (/国王的陨落|克洛塔的末日|深岩墓室|玻璃拱顶|救赎花园|最后一愿|门徒誓约|梦魇根源|救赎边缘|King'?s Fall|Crota'?s End|Deep Stone Crypt|Vault of Glass|Garden of Salvation|Last Wish|Vow of the Disciple|Root of Nightmares|Salvation'?s Edge/i.test(value)) {
    return "rotating_raid";
  }
  return "public_clue";
}

function activityElementalSurges(
  activity: DestinyAvailableActivity,
  modifiers: DefinitionComponentData | null | undefined
): ActiveElementalSurge[] {
  return (activity.modifierHashes ?? []).flatMap((hash) => {
    const name = definitionRecord(modifiers, hash)?.displayProperties?.name?.trim() ?? "";
    const key = elementalSurgeKey(name);
    return key ? [{ key, hash, name }] : [];
  });
}

function elementalSurgeKey(name: string): ElementalSurgeKey | undefined {
  if (/^(?:烈日激涌|Solar Surge)$/i.test(name)) return "solar";
  if (/^(?:电弧激涌|Arc Surge)$/i.test(name)) return "arc";
  if (/^(?:虚空激涌|Void Surge)$/i.test(name)) return "void";
  if (/^(?:冰影激涌|Stasis Surge)$/i.test(name)) return "stasis";
  if (/^(?:缚丝激涌|Strand Surge)$/i.test(name)) return "strand";
  return undefined;
}

function isPublicMilestoneOnlyClue(kind: WeeklyPriorityKind): boolean {
  return kind === "rotating_raid" || kind === "rotating_dungeon";
}

function definitionRecord(definitions: DefinitionComponentData | null | undefined, hash: number | undefined): DefinitionRecord | undefined {
  if (hash === undefined) return undefined;
  return definitions?.[String(hash)];
}

function definitionName(definitions: DefinitionComponentData | null | undefined, hash: number | undefined): string | undefined {
  return definitionRecord(definitions, hash)?.displayProperties?.name?.trim();
}

function activityDisplayName(activity: DefinitionRecord | undefined): string | undefined {
  return activity?.originalDisplayProperties?.name?.trim()
    || activity?.displayProperties?.name?.replace(/\s*[:：]\s*(?:普通|标准|大师|专家|高级|宗师|自定义|匹配)$/i, "").trim()
    || undefined;
}

function objectiveText(definitions: DefinitionComponentData | null | undefined, hash: number): string {
  const definition = definitionRecord(definitions, hash);
  return [
    definition?.displayProperties?.name,
    definition?.displayProperties?.description,
    definition?.progressDescription
  ].filter(Boolean).join(" ");
}

function isGrandmasterVanguardAlertObjective(value: string): boolean {
  return /Grandmaster Vanguard Alerts|宗师先锋警戒/i.test(value);
}

function isWeeklyRaidChallengeObjective(value: string): boolean {
  return /Weekly Raid Challenge|周常突袭挑战/i.test(value);
}

function isWeeklyDungeonChallengeObjective(value: string): boolean {
  return /Weekly Dungeon Challenge|周常地牢挑战/i.test(value);
}

function isRaidActivity(activity: DefinitionRecord | undefined): boolean {
  return activity?.activityTypeHash === 2043403989
    || activity?.directActivityModeType === 4
    || activityModeTypes(activity).includes(4);
}

function isDungeonActivity(activity: DefinitionRecord | undefined): boolean {
  return activity?.activityTypeHash === 608898761
    || activityModeTypes(activity).includes(82);
}

function activityModeTypes(activity: DefinitionRecord | undefined): number[] {
  const values = activity?.activityModeTypes;
  return Array.isArray(values) ? values.filter((value): value is number => typeof value === "number") : [];
}

function activityRewards(
  activity: DestinyAvailableActivity,
  definitions: DefinitionComponentData | null | undefined
): WeeklyActivityReward[] {
  const rewardHashes = new Set(
    (activity.visibleRewards ?? [])
      .flatMap((reward) => reward.rewardItems ?? [])
      .map((rewardItem) => rewardItem.itemQuantity?.itemHash)
      .filter((hash): hash is number => hash !== undefined)
  );

  return [...rewardHashes]
    .map((hash) => {
      const definition = definitionRecord(definitions, hash);
      const name = definition?.displayProperties?.name?.trim();
      if (!name) return undefined;
      const reward: WeeklyActivityReward = { hash, name };
      if (definition?.displayProperties?.icon) {
        reward.icon = definition.displayProperties.icon;
      }
      if (typeof definition?.itemTypeDisplayName === "string") {
        reward.item_type = definition.itemTypeDisplayName;
      }
      const group = classifyBucket(definition?.inventory?.bucketTypeHash)?.group;
      if (group) reward.group_key = group;
      return reward;
    })
    .filter((reward): reward is WeeklyActivityReward => Boolean(reward));
}

function rewardDescription(
  activity: DestinyAvailableActivity,
  definitions: DefinitionComponentData | null | undefined
): string | undefined {
  const rewards = activityRewards(activity, definitions);
  if (!rewards.length) return undefined;
  return `奖励：${rewards.map((reward) => reward.name).join(" / ")}`;
}

function readableName(milestone: PublicMilestone): string | undefined {
  return milestone.displayProperties?.name?.trim();
}

function uniqueByTitle(items: WeeklySummaryItem[]): WeeklySummaryItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.title)) return false;
    seen.add(item.title);
    return true;
  });
}

function uniqueByKindAndTitle(items: WeeklySummaryItem[]): WeeklySummaryItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.weeklyActivityKind ?? "unknown"}:${item.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
