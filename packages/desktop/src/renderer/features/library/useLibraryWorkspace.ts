import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  mergeLibraryVendorSourcePaths,
  normalizeLibraryPerkSearchPayload,
  type LibraryPerkRelatedEquipmentState
} from "@d2-tools/app/library";
import type {
  WeeklyFarmingCatalogResource,
  WeeklyFarmingRequest
} from "@d2-tools/core/weekly/farming";
import {
  api } from "../../api/client";
import type {
  ItemSearchResult,
  LibraryHistory,
  LibraryRuntimeCapabilities,
  LiveItemAvailability,
  PerkSearchResult,
  VaultItemMatchInfo,
  WeeklySummary
} from "../../api/types";
import { useManifestStatus } from "../../shared/hooks/useManifestStatus";
import {
  defaultLibraryEquipmentFilter,
  defaultLibraryPerkFilter,
  type LibraryEquipmentFilter,
  type LibraryPerkFilter,
  type LibraryViewMode
} from "../../utils/libraryFilters";

export function useLibraryWorkspace(input: {
  vendorSourcePaths?: Map<number, string[]>;
  weeklySummary?: WeeklySummary | null;
} = {}) {
  const [libraryViewMode, setLibraryViewMode] = useState<LibraryViewMode>("equipment");
  const [items, setItems] = useState<ItemSearchResult[]>([]);
  const [perks, setPerks] = useState<PerkSearchResult[]>([]);
  const [perkRelatedEquipment, setPerkRelatedEquipment] = useState<Record<string, LibraryPerkRelatedEquipmentState>>({});
  const [equipmentFilters, setEquipmentFilters] = useState<LibraryEquipmentFilter>(defaultLibraryEquipmentFilter);
  const [perkFilters, setPerkFilters] = useState<LibraryPerkFilter>(defaultLibraryPerkFilter);
  const [equipmentSearchTouched, setEquipmentSearchTouched] = useState(false);
  const [perkSearchTouched, setPerkSearchTouched] = useState(false);
  const [libraryHistory, setLibraryHistory] = useState<LibraryHistory>({ recent: [], favorites: [] });
  const [aliasDraft, setAliasDraft] = useState("");
  const [aliasTargetDraft, setAliasTargetDraft] = useState("");
  const [aliasKind, setAliasKind] = useState<"item" | "perk">("item");
  const [aliasMessage, setAliasMessage] = useState("");
  const [aliasError, setAliasError] = useState("");
  const [favoriteError, setFavoriteError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [libraryCommunityMatch, setLibraryCommunityMatch] = useState<Map<number, VaultItemMatchInfo>>(new Map());
  const [liveAvailability, setLiveAvailability] = useState<LiveItemAvailability | null>(null);
  const [liveAvailabilityError, setLiveAvailabilityError] = useState("");
  const [isLoadingLiveAvailability, setIsLoadingLiveAvailability] = useState(false);
  const [weeklyFarmingCatalog, setWeeklyFarmingCatalog] = useState<WeeklyFarmingCatalogResource | null>(null);
  const [weeklyFarmingError, setWeeklyFarmingError] = useState("");
  const [weeklyFarmingRecommendationError, setWeeklyFarmingRecommendationError] = useState("");
  const [isLoadingWeeklyFarming, setIsLoadingWeeklyFarming] = useState(false);
  const [weeklyFarmingCommunityMatch, setWeeklyFarmingCommunityMatch] = useState<Map<number, VaultItemMatchInfo>>(new Map());
  const manifestStatusState = useManifestStatus();
  const relatedRequestGeneration = useRef(0);
  const weeklyFarmingRequestGeneration = useRef(0);
  const libraryRuntimeCapabilities = useRef<LibraryRuntimeCapabilities | null>(null);
  const weeklyFarmingRequestKey = JSON.stringify(buildWeeklyFarmingRequest(input.weeklySummary));
  const weeklyFarmingRequest = useMemo<WeeklyFarmingRequest>(
    () => JSON.parse(weeklyFarmingRequestKey) as WeeklyFarmingRequest,
    [weeklyFarmingRequestKey]
  );

  const loadWeeklyFarming = useCallback(async (force = false) => {
    const generation = ++weeklyFarmingRequestGeneration.current;
    if (!weeklyFarmingRequest.activities.length) {
      setWeeklyFarmingCatalog(null);
      setWeeklyFarmingCommunityMatch(new Map());
      setWeeklyFarmingError("");
      setWeeklyFarmingRecommendationError("");
      setIsLoadingWeeklyFarming(false);
      return;
    }
    setIsLoadingWeeklyFarming(true);
    setWeeklyFarmingError("");
    setWeeklyFarmingRecommendationError("");
    try {
      const catalog = await api.getWeeklyFarmingCatalog({ ...weeklyFarmingRequest, force });
      if (generation !== weeklyFarmingRequestGeneration.current) return;
      setWeeklyFarmingCatalog(catalog);
      const items = catalog.activities.flatMap((activity) => activity.items);
      if (!items.length) {
        setWeeklyFarmingCommunityMatch(new Map());
        return;
      }
      try {
        const result = await api.matchCommunityVaultItems(
          items.map((item) => ({ hash: item.hash, item_name: item.name })),
          { include_evidence: false }
        );
        if (generation !== weeklyFarmingRequestGeneration.current) return;
        const blockingIssue = result.issues.find((issue) => issue.severity === "blocking");
        if (blockingIssue) {
          setWeeklyFarmingRecommendationError(blockingIssue.message);
          return;
        }
        setWeeklyFarmingCommunityMatch(new Map((result.card_summaries ?? []).map((match) => [match.hash, {
          matched: match.matched,
          available: match.available,
          modes: match.modes,
          source_label: match.sources[0]?.source_label
            ?? (match.dim ? "DIM Wishlist" : undefined)
        }])));
      } catch (error) {
        if (generation !== weeklyFarmingRequestGeneration.current) return;
        setWeeklyFarmingRecommendationError(error instanceof Error ? error.message : "T20 推荐核对失败");
      }
    } catch (error) {
      if (generation !== weeklyFarmingRequestGeneration.current) return;
      setWeeklyFarmingError(error instanceof Error ? error.message : "本周刷取数据读取失败");
    } finally {
      if (generation === weeklyFarmingRequestGeneration.current) {
        setIsLoadingWeeklyFarming(false);
      }
    }
  }, [weeklyFarmingRequest]);

  useEffect(() => {
    if (libraryViewMode !== "weekly_farming") return;
    void loadWeeklyFarming(false);
  }, [libraryViewMode, loadWeeklyFarming, manifestStatusState.manifestStatus?.version]);

  useEffect(() => {
    relatedRequestGeneration.current += 1;
    setPerkRelatedEquipment({});
  }, [manifestStatusState.manifestStatus?.version]);

  useEffect(() => {
    if (libraryViewMode !== "equipment" || !items.length) {
      setLibraryCommunityMatch(new Map());
      return;
    }
    const uniqueHashes = [...new Set(items.map((item) => item.hash))];
    const inputs = uniqueHashes.map((hash) => ({ hash, socket_plugs: undefined }));
    api.matchCommunityVaultItems(inputs)
      .then((result) => {
        const map = new Map<number, VaultItemMatchInfo>();
        for (const item of result.matches) {
          map.set(item.hash, {
            matched: item.matched,
            available: item.available,
            ...(item.perk_pool_count !== undefined ? { perk_pool_count: item.perk_pool_count } : {}),
            ...(item.combo_count !== undefined ? { combo_count: item.combo_count } : {}),
            modes: item.modes,
            sample_perks: item.sample_perks,
            source_label: item.source_label
          });
        }
        setLibraryCommunityMatch(map);
      })
      .catch((error) => {
        console.warn("资料库社区推荐匹配失败：", error);
      });
  }, [libraryViewMode, items]);

  useEffect(() => {
    if (libraryViewMode !== "equipment" || !items.length) {
      setLiveAvailability(null);
      setLiveAvailabilityError("");
      setIsLoadingLiveAvailability(false);
      return;
    }

    let cancelled = false;
    const uniqueHashes = [...new Set(items.map((item) => item.hash))];
    setIsLoadingLiveAvailability(true);
    setLiveAvailabilityError("");

    api.getLiveItemAvailability(uniqueHashes)
      .then((result) => {
        if (cancelled) return;
        setLiveAvailability(mergeLibraryVendorSourcePaths(result, input.vendorSourcePaths));
      })
      .catch((error) => {
        if (cancelled) return;
        setLiveAvailability(buildVendorPathAvailability(uniqueHashes, input.vendorSourcePaths));
        setLiveAvailabilityError(error instanceof Error ? error.message : "实时状态查询失败");
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingLiveAvailability(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [input.vendorSourcePaths, libraryViewMode, items]);

  async function loadLibraryHistory() {
    try {
      setLibraryHistory(await api.getLibraryHistory());
    } catch {
      setLibraryHistory({ recent: [], favorites: [] });
    }
  }

  async function searchItems(input: { mode?: LibraryViewMode; query?: string } = {}) {
    const activeMode = input.mode ?? libraryViewMode;
    if (activeMode === "weekly_farming") {
      await loadWeeklyFarming(true);
      return;
    }
    setIsSearching(true);
    setSearchError("");
    if (activeMode === "perks") {
      setPerkSearchTouched(true);
    } else {
      setEquipmentSearchTouched(true);
    }

    const activeQuery = input.query ?? (activeMode === "perks"
      ? perkFilters.query
      : equipmentFilters.query);

    try {
      if (activeMode === "perks") {
        relatedRequestGeneration.current += 1;
        setPerkRelatedEquipment({});
        const rawResults = await api.searchPerks(activeQuery) as unknown;
        const normalized = normalizeLibraryPerkSearchPayload(rawResults);
        const runtimeCapabilities = typeof api.getLibraryRuntimeCapabilities === "function"
          ? await api.getLibraryRuntimeCapabilities().catch(() => null)
          : null;
        const supportsRelatedPaging = runtimeCapabilities?.contract_version === 2
          && runtimeCapabilities.supports_perk_families
          && runtimeCapabilities.supports_related_equipment_paging
          && runtimeCapabilities.supports_related_variant_matches;
        libraryRuntimeCapabilities.current = supportsRelatedPaging ? runtimeCapabilities : null;
        const visiblePerks = supportsRelatedPaging
          ? normalized.perks
          : normalized.perks.map((perk) => ({
              ...perk,
              related_count_status: "unavailable" as const
            }));
        setPerks(visiblePerks);
        setPerkRelatedEquipment(supportsRelatedPaging ? {} : Object.fromEntries(
          visiblePerks
            .filter((perk) => perk.related_count > 0)
            .map((perk) => [perk.key, {
              items: [],
              total: perk.related_count,
              hasMore: false,
              isLoading: false,
              isLoaded: true,
              error: "Desktop 运行时合同过旧，已停止展示缺少图标和版本的关联摘要。请重新构建并重启应用。",
              isBlocked: true
            }])
        ));
        setItems([]);
      } else {
        setItems(await api.searchItems(activeQuery));
        setPerks([]);
      }
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "搜索失败");
      setItems([]);
      setPerks([]);
    } finally {
      setIsSearching(false);
    }
  }

  function selectRecentEquipmentQuery(query: string) {
    setLibraryViewMode("equipment");
    setEquipmentFilters((current) => ({ ...current, query }));
    void searchItems({ mode: "equipment", query });
  }

  async function loadPerkRelatedEquipment(perk: PerkSearchResult, loadMore = false) {
    const current = perkRelatedEquipment[perk.key];
    if (current?.isLoading || (loadMore && !current?.hasMore) || (!loadMore && current?.isLoaded)) {
      return;
    }

    const offset = loadMore ? current?.items.length ?? 0 : 0;
    const generation = relatedRequestGeneration.current;
    if (!libraryRuntimeCapabilities.current || typeof api.getPerkRelatedEquipment !== "function") {
      setPerkRelatedEquipment((states) => ({
        ...states,
        [perk.key]: {
          items: states[perk.key]?.items ?? [],
          total: states[perk.key]?.total ?? perk.related_count,
          hasMore: false,
          isLoading: false,
          isLoaded: Boolean(states[perk.key]?.items.length),
          error: "Desktop 运行时合同过旧，请重新构建并重启应用后再加载完整关联装备。",
          isBlocked: true
        }
      }));
      return;
    }
    setPerkRelatedEquipment((states) => ({
      ...states,
      [perk.key]: {
        items: loadMore ? states[perk.key]?.items ?? [] : [],
        total: states[perk.key]?.total ?? perk.related_count,
        hasMore: states[perk.key]?.hasMore ?? perk.related_count > 0,
        isLoading: true,
        isLoaded: states[perk.key]?.isLoaded ?? false,
        error: ""
      }
    }));

    try {
      const page = await api.getPerkRelatedEquipment({
        perk_hashes: perk.hashes,
        offset,
        limit: 20
      });
      if (generation !== relatedRequestGeneration.current) return;
      setPerkRelatedEquipment((states) => {
        const previousItems = loadMore ? states[perk.key]?.items ?? [] : [];
        const nextItems = page.items.map((entry) => ({
          ...entry.item,
          matchedPerkHashes: entry.matched_perk_hashes,
          matchedPerkVariants: entry.matched_variants
        }));
        const items = [...new Map(
          [...previousItems, ...nextItems].map((item) => [item.hash, item])
        ).values()];
        return {
          ...states,
          [perk.key]: {
            items,
            total: page.total,
            hasMore: page.has_more,
            isLoading: false,
            isLoaded: true,
            error: ""
          }
        };
      });
    } catch (error) {
      if (generation !== relatedRequestGeneration.current) return;
      setPerkRelatedEquipment((states) => ({
        ...states,
        [perk.key]: {
          items: states[perk.key]?.items ?? [],
          total: states[perk.key]?.total ?? perk.related_count,
          hasMore: states[perk.key]?.hasMore ?? false,
          isLoading: false,
          isLoaded: false,
          error: error instanceof Error ? error.message : "关联装备读取失败"
        }
      }));
    }
  }

  async function saveAlias() {
    setAliasMessage("");
    setAliasError("");
    try {
      await api.saveItemAlias({
        alias: aliasDraft,
        target: aliasTargetDraft,
        kind: aliasKind
      });
      setAliasDraft("");
      setAliasTargetDraft("");
      setAliasMessage("别名已保存，下次搜索会自动命中。");
    } catch (error) {
      setAliasError(error instanceof Error ? error.message : "别名保存失败");
    }
  }

  async function addSelectedItemToFavorites(item: ItemSearchResult | PerkSearchResult) {
    setFavoriteError("");
    try {
      setLibraryHistory(await api.addFavoriteItem({ hash: item.hash, name: item.name, icon: item.icon }));
    } catch (error) {
      setFavoriteError(error instanceof Error ? error.message : "收藏失败");
    }
  }

  async function removeFavorite(hash: number) {
    setFavoriteError("");
    try {
      setLibraryHistory(await api.removeFavoriteItem(hash));
    } catch (error) {
      setFavoriteError(error instanceof Error ? error.message : "取消收藏失败");
    }
  }

  function clearLibraryFilters() {
    setSearchError("");
    if (libraryViewMode === "equipment") {
      setEquipmentFilters(defaultLibraryEquipmentFilter);
      setItems([]);
      setLiveAvailability(null);
      setLiveAvailabilityError("");
      setEquipmentSearchTouched(false);
    } else if (libraryViewMode === "perks") {
      setPerkFilters(defaultLibraryPerkFilter);
      setPerks([]);
      relatedRequestGeneration.current += 1;
      setPerkRelatedEquipment({});
      setPerkSearchTouched(false);
    }
  }

  return {
    addSelectedItemToFavorites,
    aliasDraft,
    aliasKind,
    aliasMessage,
    aliasError,
    aliasTargetDraft,
    clearLibraryFilters,
    equipmentFilters,
    equipmentSearchTouched,
    favoriteError,
    isLoadingLiveAvailability,
    isLoadingManifestStatus: manifestStatusState.isLoadingManifestStatus,
    isInitializingManifest: manifestStatusState.isInitializingManifest,
    isSearching,
    items,
    libraryCommunityMatch,
    weeklyFarmingCatalog,
    weeklyFarmingCommunityMatch,
    weeklyFarmingError,
    weeklyFarmingRecommendationError,
    isLoadingWeeklyFarming,
    libraryHistory,
    libraryViewMode,
    liveAvailability,
    liveAvailabilityError,
    loadLibraryHistory,
    initializeManifest: manifestStatusState.initializeManifest,
    manifestTask: manifestStatusState.manifestTask,
    manifestStatus: manifestStatusState.manifestStatus,
    manifestStatusError: manifestStatusState.manifestStatusError,
    perkFilters,
    perkSearchTouched,
    perks,
    perkRelatedEquipment,
    loadPerkRelatedEquipment,
    loadWeeklyFarming,
    removeFavorite,
    refreshManifestStatus: manifestStatusState.refreshManifestStatus,
    repairManifest: manifestStatusState.repairManifest,
    saveAlias,
    searchError,
    searchItems,
    selectRecentEquipmentQuery,
    setAliasDraft,
    setAliasKind,
    setAliasTargetDraft,
    setEquipmentFilters,
    setLibraryHistory,
    setLibraryViewMode,
    setPerkFilters
  };
}

function buildWeeklyFarmingRequest(summary: WeeklySummary | null | undefined): WeeklyFarmingRequest {
  if (!summary) return { activities: [] };
  const activities = ([
    ["raid", summary.priorities.rotating_raid],
    ["dungeon", summary.priorities.rotating_dungeon]
  ] as const).flatMap(([kind, priority]) => (
    priority.status === "ready"
      ? (priority.entries ?? []).map((entry) => ({
          kind,
          title: entry.title,
          related_hashes: entry.related_hashes,
          source: entry.source ?? priority.source
        }))
      : []
  ));
  return {
    reset_at: summary.weekly_reset.next_reset_iso,
    activities
  };
}

function buildVendorPathAvailability(
  itemHashes: number[],
  sourcePaths: Map<number, string[]> | undefined
): LiveItemAvailability | null {
  if (!sourcePaths?.size) return null;
  const items = Object.fromEntries(itemHashes.map((hash) => {
    const paths = sourcePaths.get(hash) ?? [];
    return [String(hash), paths.length ? {
      hash,
      status: "character_vendor" as const,
      label: "当前商人售卖",
      description: paths.join("；"),
      sources: paths.map((label) => ({ kind: "character_vendor" as const, label }))
    } : {
      hash,
      status: "manifest_only" as const,
      label: "未发现当前公开入口",
      description: "当前只保留资料库来源线索。",
      sources: []
    }];
  }));
  return {
    checked_at: new Date().toISOString(),
    items,
    milestone_clues: [],
    account_scope: "character"
  };
}
