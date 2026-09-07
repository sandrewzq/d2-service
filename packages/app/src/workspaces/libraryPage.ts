import type { AccountItemSummary, AccountSummary } from "@d2-tools/core/account/summary";
import type { WeaponBreakerTypeSummary } from "@d2-tools/core/items/breakerTypes";
import type { EquipableItemSetSummary } from "@d2-tools/core/items/equipableItemSet";
import type { ItemDefinitionVersionSummary, ItemReleaseSummary } from "@d2-tools/core/items/release";
import { formatLibraryVersion, matchesAnyKeyword, splitQueryTokens, uniqueInOrder, uniqueSorted } from "./libraryText.js";

export type AmmoTypeKey = "primary" | "special" | "heavy";
export type EquipmentGroupKey = "weapons" | "armor" | "equipment" | "other";

export type ItemSearchResult = {
  hash: number;
  name: string;
  description: string;
  icon?: string;
  item_type?: string;
  tier?: string;
  class_name?: string;
  damage_type?: string;
  breaker_type?: WeaponBreakerTypeSummary;
  is_adept?: boolean;
  origin_traits?: Array<{
    hash: number;
    name: string;
  }>;
  intrinsic_traits?: Array<{
    hash: number;
    name: string;
    description: string;
    icon?: string;
  }>;
  group_key?: EquipmentGroupKey;
  bucket_name?: string;
  ammo_type?: AmmoTypeKey;
  weapon_frame?: {
    key: string;
    name: string;
  };
  source: {
    status: "ready" | "missing";
    label: string;
    description: string;
    source_kind?: "item" | "collectible" | "linked_item" | "linked_collectible";
    source_hash?: number;
    linked_definition_hash?: number;
  };
  release?: ItemReleaseSummary;
  definition_version?: ItemDefinitionVersionSummary;
  armor_set?: EquipableItemSetSummary;
  definition_stats?: Array<{
    hash: number;
    name: string;
    value: number;
    display_maximum: number;
  }>;
  perks?: Array<{
    socket_index: number;
    plugs: Array<{
      hash: number;
      name: string;
      description: string;
      icon?: string;
    }>;
  }>;
};

export type PerkSearchResult = {
  key: string;
  hash: number;
  hashes: number[];
  name: string;
  description: string;
  icon?: string;
  variants: PerkVariant[];
  related_count: number;
  related_count_status?: "exact" | "unavailable";
  related_groups: EquipmentGroupKey[];
};

export type PerkVariantKind = "standard" | "enhanced" | "other";

export type PerkVariant = {
  sandbox_perk_hash: number;
  plug_hashes: number[];
  kind: PerkVariantKind;
  description: string;
  related_count: number;
};

export type LibraryPerkRelatedEquipmentItem = ItemSearchResult & {
  matchedPerkHashes?: number[];
  matchedPerkVariants?: PerkVariantKind[];
};

export type LibraryPerkRelatedEquipmentState = {
  items: LibraryPerkRelatedEquipmentItem[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  isLoaded: boolean;
  error: string;
  isBlocked?: boolean;
};

export type NormalizedLibraryPerkSearchPayload = {
  perks: PerkSearchResult[];
  legacyRelatedEquipment: Record<string, LibraryPerkRelatedEquipmentState>;
};

export type LibraryHistory = {
  recent: Array<{ hash: number; name: string; icon?: string; viewed_at?: string }>;
  favorites: Array<{ hash: number; name: string; icon?: string; viewed_at?: string }>;
};

export type ManifestStatus = {
  initialized: boolean;
  version?: string;
  latest_version?: string;
  needs_update?: boolean;
  checked_at?: string;
  language?: string;
  cached_at?: string;
  item_count?: number;
  perk_count?: number;
  relation_count?: number;
  missing_required_components?: string[];
};

export type LibraryManifestTaskState = {
  status: "idle" | "queued" | "running" | "retrying" | "success" | "failed" | "blocked" | "superseded";
  type?: string;
  title: string;
  message?: string;
  error?: string;
  hasUsableManifest?: boolean;
  phase?: string;
  availability?: "usable" | "limited" | "blocked";
  progress_percent?: number;
  progress_current_bytes?: number;
  progress_total_bytes?: number;
  progress_bytes_per_second?: number;
  started_at?: string;
  updated_at?: string;
  next_retry_at?: string;
};

export type LiveItemAvailability = {
  account_scope: "public" | "character";
  items: Record<string, LiveItemAvailabilityEntry>;
};

export type LiveItemAvailabilityEntry = {
  status: "character_vendor" | "public_vendor" | "public_activity" | "manifest_only" | "unknown";
  label: string;
  description: string;
  sources: Array<{
    kind: "character_vendor" | "public_vendor" | "public_activity";
    label: string;
    character_id?: string;
  }>;
};

export type VaultItemMatchInfo = {
  matched?: number;
  available?: number;
  perk_pool_count?: number;
  combo_count?: number;
  modes?: string[];
  source_label?: string;
  sample_perks?: Array<{
    name: string;
    englishName?: string;
  }>;
};

export type LibraryViewMode = "equipment" | "perks";
export type LibraryEquipmentGroupFilter = EquipmentGroupKey | "all";
export type LibraryRelatedItemsFilter = "all" | "yes" | "no";
export type LibrarySourceStatusFilter = ItemSearchResult["source"]["status"] | "all";
export type LibraryPerkPoolFilter = "all" | "yes" | "no";
export type LibraryDropAccessKey = "available" | "rotation" | "archived" | "unknown";
export type LibraryDropAccessFilter = LibraryDropAccessKey | "all";
export type LibraryAcquisitionStatus = "current" | "historical" | "unknown";

export type LibraryOwnershipEntry = {
  status: "owned" | "not_owned" | "unavailable";
  totalCount: number;
  vaultCount: number;
  locations: Array<{
    kind: "vault" | "equipped" | "inventory" | "postmaster";
    label: string;
    count: number;
    characterId?: string;
  }>;
};

export type LibraryEquipmentFilter = {
  query: string;
  group: LibraryEquipmentGroupFilter;
  ownership?: "all" | "owned" | "definition";
  tier: string;
  bucket: string;
  ammo: AmmoTypeKey | "all";
  frame: string[];
  sourceStatus: LibrarySourceStatusFilter;
  perkPool: LibraryPerkPoolFilter;
  dropAccess: LibraryDropAccessFilter;
  perkQuery: string;
};

export type LibraryPerkFilter = {
  query: string;
  relatedGroup: LibraryEquipmentGroupFilter;
  hasRelatedItems: LibraryRelatedItemsFilter;
};

export type LibraryFilterOption = {
  value: string;
  label: string;
};

export type LibraryEquipmentFilterOptions = {
  groups: LibraryFilterOption[];
  tiers: LibraryFilterOption[];
  buckets: LibraryFilterOption[];
  ammo: LibraryFilterOption[];
  frames: LibraryFilterOption[];
};

export type LibraryDropQueryGroup = {
  key: LibraryDropAccessKey;
  label: string;
  description: string;
  items: ItemSearchResult[];
};

export type LibraryPageCache = {
  items: ItemSearchResult[];
  perks: PerkSearchResult[];
  perkRelatedEquipment: Record<string, LibraryPerkRelatedEquipmentState>;
  libraryHistory: LibraryHistory;
  libraryCommunityMatch: Map<number, VaultItemMatchInfo>;
  liveAvailability: LiveItemAvailability | null;
  liveAvailabilityError: string;
  manifestStatus: ManifestStatus | null;
  manifestStatusError: string;
  accountSummary?: AccountSummary | null;
};

export type LibraryPageState = {
  libraryViewMode: LibraryViewMode;
  equipmentFilters: LibraryEquipmentFilter;
  perkFilters: LibraryPerkFilter;
  equipmentSearchTouched: boolean;
  perkSearchTouched: boolean;
  isSearching: boolean;
  searchError: string;
  aliasDraft: string;
  aliasTargetDraft: string;
  aliasKind: "item" | "perk";
  aliasMessage: string;
  aliasError: string;
  favoriteError: string;
  isLoadingLiveAvailability: boolean;
  isLoadingManifestStatus: boolean;
  isInitializingManifest: boolean;
  manifestTask: LibraryManifestTaskState | null;
  itemDetailLoadingKey: string;
};

export type LibraryManifestAlertModel = {
  kind: "error" | "loading" | "not_initialized" | "missing_components" | "needs_update" | "updating" | "retrying";
  className: "status-error" | "status-pending" | "status-warning";
  error?: string;
  hasUsableManifest?: boolean;
  missingComponentCount?: number;
  version?: string;
  latestVersion?: string;
  task?: LibraryManifestTaskState;
};

export type LibraryEquipmentResultView = {
  item: ItemSearchResult;
  dropAccess: LibraryDropAccessKey;
  communityMatch?: VaultItemMatchInfo;
  liveEntry?: LiveItemAvailabilityEntry;
  acquisitionStatus: LibraryAcquisitionStatus;
  ownership: LibraryOwnershipEntry;
  isFavorite: boolean;
  isDetailLoading: boolean;
};

export type LibraryDefinitionDetailView = Pick<
  LibraryEquipmentResultView,
  "item" | "dropAccess" | "communityMatch" | "liveEntry" | "acquisitionStatus" | "ownership"
>;

export type LibraryEquipmentResultGroupView = {
  key: LibraryDropAccessKey;
  items: LibraryEquipmentResultView[];
};

export type LibraryPerkResultView = {
  perk: PerkSearchResult;
  relatedGroupKeys: EquipmentGroupKey[];
  relatedItems: Array<LibraryPerkRelatedEquipmentItem & { isDetailLoading: boolean }>;
  relatedCount: number;
  isRelatedCountExact: boolean;
  hasRelatedItems: boolean;
  hasMoreRelatedItems: boolean;
  isRelatedItemsLoading: boolean;
  areRelatedItemsLoaded: boolean;
  relatedItemsError: string;
  isRelatedItemsBlocked: boolean;
};

export type LibraryPageModel = {
  manifestSummary: {
    initialized: boolean | null;
    version?: string;
    latestVersion?: string;
    activatedAt?: string;
    checkedAt?: string;
    language?: string;
    itemCount?: number;
    perkCount?: number;
    relationCount?: number;
    needsUpdate: boolean;
    missingComponentCount: number;
    statusError: string;
  };
  queryPanel: {
    viewMode: LibraryViewMode;
    primaryQuery: string;
    isManifestBlocked: boolean;
    equipmentFilters: LibraryEquipmentFilter;
    perkFilters: LibraryPerkFilter;
    equipmentFilterOptions: LibraryEquipmentFilterOptions;
    perkGroupOptions: LibraryFilterOption[];
  };
  results: {
    mode: LibraryViewMode;
    hitCount: number;
    searchTouched: boolean;
    equipmentGroups: LibraryEquipmentResultGroupView[];
    perks: LibraryPerkResultView[];
  };
  stats: {
    dropQuery: {
      total: number;
      sourced: number;
      perkPools: number;
    };
    live: {
      scope: LiveItemAvailability["account_scope"] | "none";
      characterVendor: number;
      publicVendor: number;
      publicActivity: number;
    };
  };
  aliasPanel: {
    draft: string;
    targetDraft: string;
    kind: "item" | "perk";
    message: string;
    error: string;
    history: LibraryHistory;
  };
  status: {
    isSearching: boolean;
    searchError: string;
    favoriteError: string;
    liveAvailabilityError: string;
    isLoadingLiveAvailability: boolean;
    isLoadingManifestStatus: boolean;
    isInitializingManifest: boolean;
    manifestTask: LibraryManifestTaskState | null;
    manifestVersionDate?: string;
  };
  manifestAlert: LibraryManifestAlertModel | null;
  emptyState: { kind: "not_searched" | "no_results" } | null;
};

const groupLabels: Record<LibraryEquipmentGroupFilter, string> = {
  all: "全部分类",
  weapons: "武器",
  armor: "护甲",
  equipment: "装备",
  other: "其他"
};

const groupOrder: LibraryEquipmentGroupFilter[] = ["all", "weapons", "armor", "equipment", "other"];

const ammoLabels: Record<AmmoTypeKey, string> = {
  primary: "主弹",
  special: "特殊",
  heavy: "重弹"
};

const ammoOrder: AmmoTypeKey[] = ["primary", "special", "heavy"];

export const defaultLibraryEquipmentFilter: LibraryEquipmentFilter = {
  query: "",
  group: "all",
  ownership: "all",
  tier: "all",
  bucket: "all",
  ammo: "all",
  frame: [],
  sourceStatus: "all",
  perkPool: "all",
  dropAccess: "all",
  perkQuery: ""
};

export const defaultLibraryPerkFilter: LibraryPerkFilter = {
  query: "",
  relatedGroup: "all",
  hasRelatedItems: "all"
};

export function normalizeLibraryPerkSearchPayload(value: unknown): NormalizedLibraryPerkSearchPayload {
  if (!Array.isArray(value)) {
    return { perks: [], legacyRelatedEquipment: {} };
  }

  const groups = new Map<string, {
    key?: string;
    name: string;
    description: string;
    icon?: string;
    hashes: Set<number>;
    variants: Map<number, PerkVariant>;
    relatedCount: number;
    relatedGroups: Set<EquipmentGroupKey>;
    legacyItems: Map<number, LibraryPerkRelatedEquipmentItem>;
    hasLegacyPayload: boolean;
    legacyTruncated: boolean;
  }>();

  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const hash = finiteNumber(entry.hash);
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    if (hash === undefined || !name) continue;

    const description = typeof entry.description === "string"
      ? entry.description.replace(/\s+/g, " ").trim()
      : "";
    const icon = typeof entry.icon === "string" && entry.icon ? entry.icon : undefined;
    const parsedVariants = normalizePerkVariants(entry, hash, description);
    const structuredKey = Array.isArray(entry.variants)
      && parsedVariants.length > 0
      && typeof entry.key === "string"
      && entry.key
      ? entry.key
      : undefined;
    const identity = structuredKey ?? [name.toLocaleLowerCase(), icon ?? ""].join("\u0000");
    const group = groups.get(identity) ?? {
      ...(structuredKey ? { key: structuredKey } : {}),
      name,
      description,
      ...(icon ? { icon } : {}),
      hashes: new Set<number>(),
      variants: new Map<number, PerkVariant>(),
      relatedCount: 0,
      relatedGroups: new Set<EquipmentGroupKey>(),
      legacyItems: new Map<number, LibraryPerkRelatedEquipmentItem>(),
      hasLegacyPayload: false,
      legacyTruncated: false
    };

    const hashes = Array.isArray(entry.hashes)
      ? entry.hashes.map(finiteNumber).filter((item): item is number => item !== undefined)
      : [hash];
    if (!hashes.length) hashes.push(hash);
    for (const candidateHash of hashes) group.hashes.add(candidateHash);
    for (const variant of parsedVariants) {
      group.variants.set(variant.sandbox_perk_hash, variant);
    }

    if (Array.isArray(entry.related_groups)) {
      for (const candidateGroup of entry.related_groups) {
        if (isEquipmentGroupKey(candidateGroup)) group.relatedGroups.add(candidateGroup);
      }
    }

    const legacyItems = Array.isArray(entry.related_items)
      ? entry.related_items.map(normalizeLegacyPerkRelatedItem).filter((item): item is ItemSearchResult => Boolean(item))
      : [];
    if (Array.isArray(entry.related_items)) group.hasLegacyPayload = true;
    for (const item of legacyItems) {
      group.legacyItems.set(item.hash, item);
      if (item.group_key) group.relatedGroups.add(item.group_key);
    }
    group.legacyTruncated ||= entry.related_items_truncated === true;
    const relatedCount = finiteNumber(entry.related_count) ?? legacyItems.length;
    group.relatedCount = Math.max(group.relatedCount, relatedCount, group.legacyItems.size);
    groups.set(identity, group);
  }

  const legacyRelatedEquipment: Record<string, LibraryPerkRelatedEquipmentState> = {};
  const perks = [...groups.values()].map((group) => {
    const hashes = [...group.hashes].sort((left, right) => left - right);
    const key = group.key ?? `perk:${hashes.join(",")}`;
    const variants = [...group.variants.values()].sort(comparePerkVariants);
    if (group.hasLegacyPayload && group.legacyItems.size) {
      legacyRelatedEquipment[key] = {
        items: [...group.legacyItems.values()],
        total: group.relatedCount,
        hasMore: group.legacyTruncated || group.relatedCount > group.legacyItems.size,
        isLoading: false,
        isLoaded: true,
        error: ""
      };
    }
    return {
      key,
      hash: hashes[0]!,
      hashes,
      name: group.name,
      description: variants.find((variant) => variant.kind === "standard")?.description
        ?? variants[0]?.description
        ?? group.description,
      ...(group.icon ? { icon: group.icon } : {}),
      variants,
      related_count: group.relatedCount,
      related_groups: [...group.relatedGroups]
    };
  });

  return { perks, legacyRelatedEquipment };
}

function normalizePerkVariants(
  entry: Record<string, unknown>,
  fallbackHash: number,
  fallbackDescription: string
): PerkVariant[] {
  if (Array.isArray(entry.variants)) {
    const variants = entry.variants.flatMap((value): PerkVariant[] => {
      if (!isRecord(value)) return [];
      const sandboxPerkHash = finiteNumber(value.sandbox_perk_hash);
      if (sandboxPerkHash === undefined) return [];
      const kind = value.kind === "standard" || value.kind === "enhanced" || value.kind === "other"
        ? value.kind
        : "other";
      return [{
        sandbox_perk_hash: sandboxPerkHash,
        plug_hashes: Array.isArray(value.plug_hashes)
          ? value.plug_hashes.map(finiteNumber).filter((hash): hash is number => hash !== undefined)
          : [],
        kind,
        description: typeof value.description === "string" ? value.description.trim() : fallbackDescription,
        related_count: finiteNumber(value.related_count) ?? 0
      }];
    });
    if (variants.length) return variants;
  }

  const hashes = Array.isArray(entry.hashes)
    ? entry.hashes.map(finiteNumber).filter((hash): hash is number => hash !== undefined)
    : [fallbackHash];
  return hashes.map((sandboxPerkHash) => ({
    sandbox_perk_hash: sandboxPerkHash,
    plug_hashes: [],
    kind: "other",
    description: fallbackDescription,
    related_count: finiteNumber(entry.related_count) ?? 0
  }));
}

function comparePerkVariants(left: PerkVariant, right: PerkVariant): number {
  const order: Record<PerkVariantKind, number> = { standard: 0, enhanced: 1, other: 2 };
  return order[left.kind] - order[right.kind]
    || left.sandbox_perk_hash - right.sandbox_perk_hash;
}

export function selectLibraryPageModel(cache: LibraryPageCache, state: LibraryPageState): LibraryPageModel {
  const ownership = buildLibraryOwnership(cache.accountSummary);
  const visibleItems = filterLibraryEquipmentItems(cache.items, state.equipmentFilters, ownership);
  const visiblePerks = filterLibraryPerks(cache.perks, state.perkFilters);
  const mode = state.libraryViewMode;
  const searchTouched = mode === "equipment" ? state.equipmentSearchTouched : state.perkSearchTouched;
  const hitCount = mode === "equipment" ? visibleItems.length : visiblePerks.length;

  return {
    manifestSummary: {
      initialized: cache.manifestStatus?.initialized ?? null,
      version: cache.manifestStatus?.version,
      latestVersion: cache.manifestStatus?.latest_version,
      activatedAt: cache.manifestStatus?.cached_at,
      checkedAt: cache.manifestStatus?.checked_at,
      language: cache.manifestStatus?.language,
      itemCount: cache.manifestStatus?.item_count,
      perkCount: cache.manifestStatus?.perk_count,
      relationCount: cache.manifestStatus?.relation_count,
      needsUpdate: Boolean(cache.manifestStatus?.needs_update),
      missingComponentCount: cache.manifestStatus?.missing_required_components?.length ?? 0,
      statusError: cache.manifestStatusError
    },
    queryPanel: {
      viewMode: mode,
      primaryQuery: mode === "equipment" ? state.equipmentFilters.query : state.perkFilters.query,
      isManifestBlocked: isManifestBlocked(cache.manifestStatus),
      equipmentFilters: state.equipmentFilters,
      perkFilters: state.perkFilters,
      equipmentFilterOptions: buildLibraryEquipmentFilterOptions(cache.items),
      perkGroupOptions: buildLibraryPerkGroupOptions(cache.perks)
    },
    results: {
      mode,
      hitCount,
      searchTouched,
      equipmentGroups: buildEquipmentResultGroups({
        visibleItems,
        history: cache.libraryHistory,
        communityMatch: cache.libraryCommunityMatch,
        liveAvailability: cache.liveAvailability,
        ownership,
        ownershipAvailable: Boolean(cache.accountSummary),
        itemDetailLoadingKey: state.itemDetailLoadingKey
      }),
      perks: visiblePerks.map((perk) => createPerkResultView(
        perk,
        cache.perkRelatedEquipment[perk.key],
        state.itemDetailLoadingKey
      ))
    },
    stats: {
      dropQuery: {
        total: visibleItems.length,
        sourced: visibleItems.filter((item) => item.source.status === "ready").length,
        perkPools: visibleItems.filter((item) => hasDisplayablePerkPool(item)).length
      },
      live: buildLiveAvailabilityStats(cache.liveAvailability, visibleItems)
    },
    aliasPanel: {
      draft: state.aliasDraft,
      targetDraft: state.aliasTargetDraft,
      kind: state.aliasKind,
      message: state.aliasMessage,
      error: state.aliasError,
      history: cache.libraryHistory
    },
    status: {
      isSearching: state.isSearching,
      searchError: state.searchError,
      favoriteError: state.favoriteError,
      liveAvailabilityError: cache.liveAvailabilityError,
      isLoadingLiveAvailability: state.isLoadingLiveAvailability,
      isLoadingManifestStatus: state.isLoadingManifestStatus,
      isInitializingManifest: state.isInitializingManifest,
      manifestTask: state.manifestTask,
      manifestVersionDate: formatLibraryVersion(cache.manifestStatus?.version)
    },
    manifestAlert: buildManifestAlertModel(
      cache.manifestStatus,
      cache.manifestStatusError,
      state.isLoadingManifestStatus,
      state.manifestTask
    ),
    emptyState: selectLibraryEmptyState({ searchTouched, isSearching: state.isSearching, searchError: state.searchError, hitCount })
  };
}

export function filterLibraryEquipmentItems(
  items: ItemSearchResult[],
  filter: LibraryEquipmentFilter,
  ownership: Map<number, LibraryOwnershipEntry> = new Map()
): ItemSearchResult[] {
  const query = filter.query.trim().toLocaleLowerCase();
  const ownershipFilter = filter.ownership ?? "all";
  const sourceStatus = filter.sourceStatus ?? "all";
  const perkPool = filter.perkPool ?? "all";
  const dropAccess = filter.dropAccess ?? "all";
  const perkTokens = splitQueryTokens(filter.perkQuery ?? "");

  return items.filter((item) => {
    if (filter.group !== "all" && item.group_key !== filter.group) return false;
    if (ownershipFilter === "owned" && ownership.get(item.hash)?.status !== "owned") return false;
    if (ownershipFilter === "definition" && ownership.get(item.hash)?.status === "owned") return false;
    if (filter.tier !== "all" && item.tier !== filter.tier) return false;
    if (filter.bucket !== "all" && item.bucket_name !== filter.bucket) return false;
    if (filter.ammo !== "all" && item.ammo_type !== filter.ammo) return false;
    if (filter.frame.length && !filter.frame.includes(item.weapon_frame?.key ?? "")) return false;
    if (sourceStatus !== "all" && item.source.status !== sourceStatus) return false;
    if (perkPool === "yes" && !hasDisplayablePerkPool(item)) return false;
    if (perkPool === "no" && hasDisplayablePerkPool(item)) return false;
    if (dropAccess !== "all" && classifyLibraryDropAccess(item) !== dropAccess) return false;
    if (perkTokens.length && !matchesPerkQuery(item, perkTokens)) return false;
    if (!query) return true;

    return [
      item.name,
      item.description,
      item.item_type,
      item.tier,
      item.bucket_name,
      item.weapon_frame?.name,
      item.source.description,
      ...(item.perks ?? []).flatMap((group) => group.plugs.map((plug) => plug.name))
    ]
      .filter(Boolean)
      .some((value) => value?.toLocaleLowerCase().includes(query));
  });
}

export function classifyLibraryDropAccess(item: ItemSearchResult): LibraryDropAccessKey {
  if (item.source.status !== "ready") {
    return "unknown";
  }

  const sourceText = item.source.description.toLocaleLowerCase();
  if (matchesAnyKeyword(sourceText, archivedSourceKeywords)) {
    return "archived";
  }
  if (matchesAnyKeyword(sourceText, rotationSourceKeywords)) {
    return "rotation";
  }
  return "available";
}

export function groupLibraryDropQueryItems(items: ItemSearchResult[]): LibraryDropQueryGroup[] {
  const groupMap: Record<LibraryDropAccessKey, ItemSearchResult[]> = {
    available: [],
    rotation: [],
    archived: [],
    unknown: []
  };

  for (const item of items) {
    groupMap[classifyLibraryDropAccess(item)].push(item);
  }

  return dropAccessGroups
    .map((group) => ({ ...group, items: groupMap[group.key] }))
    .filter((group) => group.items.length);
}

export function filterLibraryPerks(perks: PerkSearchResult[], filter: LibraryPerkFilter): PerkSearchResult[] {
  const query = filter.query.trim().toLocaleLowerCase();

  return perks.filter((perk) => {
    const relatedCount = finiteNumber(perk.related_count) ?? 0;
    const relatedGroups = Array.isArray(perk.related_groups) ? perk.related_groups : [];
    if (filter.hasRelatedItems === "yes" && relatedCount === 0) return false;
    if (filter.hasRelatedItems === "no" && relatedCount > 0) return false;
    if (filter.relatedGroup !== "all" && !relatedGroups.includes(filter.relatedGroup)) {
      return false;
    }
    if (!query) return true;

    return [
      perk.name,
      perk.description
    ]
      .filter(Boolean)
      .some((value) => value?.toLocaleLowerCase().includes(query));
  });
}

export function buildLibraryEquipmentFilterOptions(items: ItemSearchResult[]): LibraryEquipmentFilterOptions {
  const groups = groupOrder
    .filter((group) => group === "all" || items.some((item) => item.group_key === group))
    .map((group) => ({ value: group, label: groupLabels[group] }));

  return {
    groups,
    tiers: [
      { value: "all", label: "全部稀有度" },
      ...uniqueSorted(items.map((item) => item.tier)).map((value) => ({ value, label: value }))
    ],
    buckets: [
      { value: "all", label: "全部位置" },
      ...uniqueInOrder(items.map((item) => item.bucket_name)).map((value) => ({ value, label: value }))
    ],
    ammo: [
      { value: "all", label: "全部弹药" },
      ...ammoOrder
        .filter((ammo) => items.some((item) => item.ammo_type === ammo))
        .map((value) => ({ value, label: ammoLabels[value] }))
    ],
    frames: [
      { value: "all", label: "全部框架" },
      ...uniqueInOrder(items.map((item) => item.weapon_frame?.key))
        .map((value) => ({
          value,
          label: items.find((item) => item.weapon_frame?.key === value)?.weapon_frame?.name ?? value
        }))
    ]
  };
}

export function buildLibraryPerkGroupOptions(perks: PerkSearchResult[]): LibraryFilterOption[] {
  const presentGroups = new Set<EquipmentGroupKey>();

  for (const perk of perks) {
    for (const group of perk.related_groups ?? []) {
      presentGroups.add(group);
    }
  }

  return groupOrder
    .filter((group): group is LibraryEquipmentGroupFilter => group === "all" || presentGroups.has(group))
    .map((group) => ({ value: group, label: groupLabels[group] }));
}

export { formatLibraryVersion };

function buildEquipmentResultGroups(input: {
  visibleItems: ItemSearchResult[];
  history: LibraryHistory;
  communityMatch: Map<number, VaultItemMatchInfo>;
  liveAvailability: LiveItemAvailability | null;
  ownership: Map<number, LibraryOwnershipEntry>;
  ownershipAvailable: boolean;
  itemDetailLoadingKey: string;
}): LibraryEquipmentResultGroupView[] {
  return groupLibraryDropQueryItems(input.visibleItems).map((group) => ({
    key: group.key,
    items: group.items.map((item) => ({
      ...buildLibraryDefinitionDetailView({
        item,
        liveEntry: input.liveAvailability?.items[String(item.hash)],
        communityMatch: input.communityMatch.get(item.hash),
        ownership: input.ownership.get(item.hash),
        ownershipAvailable: input.ownershipAvailable
      }),
      isFavorite: input.history.favorites.some((favorite) => favorite.hash === item.hash),
      isDetailLoading: getItemKey(item) === input.itemDetailLoadingKey
    }))
  }));
}

export function buildLibraryDefinitionDetailView(input: {
  item: ItemSearchResult;
  liveEntry?: LiveItemAvailabilityEntry;
  communityMatch?: VaultItemMatchInfo;
  ownership?: LibraryOwnershipEntry;
  ownershipAvailable: boolean;
}): LibraryDefinitionDetailView {
  return {
    item: input.item,
    dropAccess: classifyLibraryDropAccess(input.item),
    communityMatch: input.communityMatch,
    liveEntry: input.liveEntry,
    acquisitionStatus: classifyLibraryAcquisitionStatus(input.item, input.liveEntry),
    ownership: input.ownership ?? {
      status: input.ownershipAvailable ? "not_owned" : "unavailable",
      totalCount: 0,
      vaultCount: 0,
      locations: []
    }
  };
}

export function mergeLibraryVendorSourcePaths<T extends LiveItemAvailability>(
  availability: T,
  sourcePaths: Map<number, string[]> | undefined
): T {
  if (!sourcePaths?.size) return availability;
  const items = { ...availability.items };
  for (const [itemHash, paths] of sourcePaths) {
    const entry = items[String(itemHash)];
    if (!entry || !paths.length) continue;
    const characterId = entry.sources.find((source) => source.kind === "character_vendor")?.character_id;
    items[String(itemHash)] = {
      ...entry,
      status: "character_vendor",
      label: "当前商人售卖",
      description: paths.join("；"),
      sources: [
        ...entry.sources.filter((source) => source.kind !== "character_vendor" && source.kind !== "public_vendor"),
        ...paths.map((label) => ({
          kind: "character_vendor" as const,
          label,
          ...(characterId ? { character_id: characterId } : {})
        }))
      ]
    };
  }
  return { ...availability, items, account_scope: "character" } as T;
}

export function buildLibraryVendorLiveEntry(
  paths: string[],
  characterId?: string
): LiveItemAvailabilityEntry | undefined {
  const normalizedPaths = [...new Set(paths.map((path) => path.trim()).filter(Boolean))];
  if (!normalizedPaths.length) return undefined;
  return {
    status: "character_vendor",
    label: "当前商人售卖",
    description: normalizedPaths.join("；"),
    sources: normalizedPaths.map((label) => ({
      kind: "character_vendor",
      label,
      ...(characterId ? { character_id: characterId } : {})
    }))
  };
}

export function buildLibraryOwnership(account: AccountSummary | null | undefined): Map<number, LibraryOwnershipEntry> {
  const ownership = new Map<number, LibraryOwnershipEntry>();
  if (!account) return ownership;

  addOwnedItems(ownership, account.vault.items, { kind: "vault", label: "仓库" });
  for (const character of account.characters) {
    addOwnedItems(ownership, character.equipped_items, {
      kind: "equipped",
      label: `${character.class_name}已装备`,
      characterId: character.character_id
    });
    addOwnedItems(ownership, character.inventory_items, {
      kind: "inventory",
      label: `${character.class_name}背包`,
      characterId: character.character_id
    });
    addOwnedItems(ownership, character.postmaster_items, {
      kind: "postmaster",
      label: `${character.class_name}邮政官`,
      characterId: character.character_id
    });
  }
  return ownership;
}

export function classifyLibraryAcquisitionStatus(
  item: ItemSearchResult,
  liveEntry: LiveItemAvailabilityEntry | undefined
): LibraryAcquisitionStatus {
  if (
    liveEntry?.status === "character_vendor"
    || liveEntry?.status === "public_vendor"
    || liveEntry?.status === "public_activity"
  ) return "current";
  if (item.source.status === "ready") return "historical";
  return "unknown";
}

function addOwnedItems(
  ownership: Map<number, LibraryOwnershipEntry>,
  items: AccountItemSummary[],
  location: Omit<LibraryOwnershipEntry["locations"][number], "count">
): void {
  const counts = new Map<number, number>();
  for (const item of items) counts.set(item.hash, (counts.get(item.hash) ?? 0) + 1);
  for (const [hash, count] of counts) {
    const entry = ownership.get(hash) ?? {
      status: "owned" as const,
      totalCount: 0,
      vaultCount: 0,
      locations: []
    };
    entry.totalCount += count;
    if (location.kind === "vault") entry.vaultCount += count;
    entry.locations.push({ ...location, count });
    ownership.set(hash, entry);
  }
}

function createPerkResultView(
  perk: PerkSearchResult,
  relatedState: LibraryPerkRelatedEquipmentState | undefined,
  itemDetailLoadingKey: string
): LibraryPerkResultView {
  const relatedItems = relatedState?.items ?? [];
  const relatedCount = relatedState?.total ?? finiteNumber(perk.related_count) ?? 0;
  return {
    perk,
    relatedGroupKeys: perk.related_groups ?? [],
    relatedItems: relatedItems.map((item) => ({
      ...item,
      isDetailLoading: itemDetailLoadingKey === `hash:${item.hash}`
    })),
    relatedCount,
    isRelatedCountExact: perk.related_count_status !== "unavailable",
    hasRelatedItems: relatedCount > 0,
    hasMoreRelatedItems: relatedState?.hasMore ?? false,
    isRelatedItemsLoading: relatedState?.isLoading ?? false,
    areRelatedItemsLoaded: relatedState?.isLoaded ?? false,
    relatedItemsError: relatedState?.error ?? "",
    isRelatedItemsBlocked: relatedState?.isBlocked ?? false
  };
}

function normalizeLegacyPerkRelatedItem(value: unknown): LibraryPerkRelatedEquipmentItem | null {
  if (!isRecord(value)) return null;
  const hash = finiteNumber(value.hash);
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (hash === undefined || !name) return null;
  const groupKey = isEquipmentGroupKey(value.group_key) ? value.group_key : undefined;
  return {
    hash,
    name,
    description: typeof value.description === "string" ? value.description : "",
    ...(typeof value.icon === "string" && value.icon ? { icon: value.icon } : {}),
    ...(typeof value.item_type === "string" && value.item_type ? { item_type: value.item_type } : {}),
    ...(groupKey ? { group_key: groupKey } : {}),
    ...(isRecord(value.release) ? { release: value.release as ItemReleaseSummary } : {}),
    source: {
      status: "missing",
      label: "获取来源",
      description: "当前 Desktop 运行时只返回了旧版关联摘要。"
    },
    matchedPerkHashes: [],
    matchedPerkVariants: []
  };
}

function isEquipmentGroupKey(value: unknown): value is EquipmentGroupKey {
  return value === "weapons" || value === "armor" || value === "equipment" || value === "other";
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function buildManifestAlertModel(
  status: ManifestStatus | null,
  error: string,
  isLoading: boolean,
  task: LibraryManifestTaskState | null
): LibraryManifestAlertModel | null {
  if (task && ["queued", "running", "retrying"].includes(task.status)) {
    return {
      kind: task.status === "retrying" ? "retrying" : "updating",
      className: task.status === "retrying" ? "status-warning" : "status-pending",
      task
    };
  }
  if (error) {
    return {
      kind: "error",
      className: status?.initialized ? "status-warning" : "status-error",
      error,
      hasUsableManifest: Boolean(status?.initialized)
    };
  }
  if (isLoading && !status) {
    return { kind: "loading", className: "status-pending" };
  }
  if (!status) {
    return null;
  }
  const missingComponents = status.missing_required_components ?? [];
  if (!status.initialized) {
    return { kind: "not_initialized", className: "status-warning" };
  }
  if (missingComponents.length) {
    return {
      kind: "missing_components",
      className: "status-warning",
      missingComponentCount: missingComponents.length
    };
  }
  if (status.needs_update) {
    return {
      kind: "needs_update",
      className: "status-warning",
      version: status.version,
      latestVersion: status.latest_version
    };
  }
  return null;
}

function isManifestBlocked(status: ManifestStatus | null): boolean {
  return !status || !status.initialized || Boolean(status.missing_required_components?.length);
}

function selectLibraryEmptyState(input: {
  searchTouched: boolean;
  isSearching: boolean;
  searchError: string;
  hitCount: number;
}): LibraryPageModel["emptyState"] {
  if (!input.searchTouched && !input.isSearching && !input.searchError) {
    return { kind: "not_searched" };
  }
  if (input.searchTouched && !input.isSearching && !input.searchError && !input.hitCount) {
    return { kind: "no_results" };
  }
  return null;
}

function buildLiveAvailabilityStats(
  liveAvailability: LiveItemAvailability | null,
  visibleItems: ItemSearchResult[]
): LibraryPageModel["stats"]["live"] {
  const visibleHashes = new Set(visibleItems.map((item) => String(item.hash)));
  const entries = Object.entries(liveAvailability?.items ?? {})
    .filter(([hash]) => visibleHashes.has(hash))
    .map(([, entry]) => entry);

  return {
    scope: liveAvailability?.account_scope ?? "none",
    characterVendor: entries.filter((entry) => entry.status === "character_vendor").length,
    publicVendor: entries.filter((entry) => entry.status === "public_vendor").length,
    publicActivity: entries.filter((entry) => entry.status === "public_activity").length
  };
}

function getItemKey(item: ItemSearchResult): string {
  const possibleInstanceItem = item as ItemSearchResult & { instance_id?: unknown };
  return typeof possibleInstanceItem.instance_id === "string" && possibleInstanceItem.instance_id
    ? possibleInstanceItem.instance_id
    : `hash:${item.hash}`;
}

const rotationSourceKeywords = [
  "rotation",
  "rotator",
  "iron banner",
  "trials",
  "nightfall",
  "grandmaster",
  "weekly",
  "轮换",
  "每周",
  "铁旗",
  "试炼",
  "夜幕",
  "宗师",
  "活动期间"
];

const archivedSourceKeywords = [
  "no longer",
  "unavailable",
  "legacy",
  "archive",
  "sunset",
  "已下架",
  "不再",
  "不可获取",
  "纪念碑",
  "传承"
];

const dropAccessGroups: Array<Omit<LibraryDropQueryGroup, "items">> = [
  {
    key: "available",
    label: "来源可确认",
    description: "来源字段可确认，但不等同于当前在线可刷；实时活动或商人轮换接入前只作为刷取线索。"
  },
  {
    key: "rotation",
    label: "等轮换",
    description: "来源说明包含铁旗、试炼、夜幕、每周或轮换类线索，需要结合当前轮换复查。"
  },
  {
    key: "archived",
    label: "已下架或待确认",
    description: "来源说明显示不可获取、传承或下架状态。"
  },
  {
    key: "unknown",
    label: "来源待补",
    description: "资料库暂未提供可确认来源。"
  }
];

function hasDisplayablePerkPool(item: ItemSearchResult): boolean {
  return item.perks?.some((group) => group.plugs.length) ?? false;
}

function matchesPerkQuery(item: ItemSearchResult, perkTokens: string[]): boolean {
  const perkNames = (item.perks ?? [])
    .flatMap((group) => group.plugs)
    .map((plug) => plug.name.toLocaleLowerCase())
    .join(" ");

  return perkTokens.every((token) => perkNames.includes(token));
}
