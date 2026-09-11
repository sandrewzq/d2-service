import { memo, useCallback, useDeferredValue, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { AccountItemSummary } from "@d2-tools/core/account/summary";
import type { ArmorSetCatalogItem } from "@d2-tools/core/items/equipableItemSet";
import type { DimWishlist } from "@d2-tools/core/analysis/wishlistImport";
import type { LocalTargetRules } from "@d2-tools/core/analysis/targets";
import type { EquipmentTargetStore } from "@d2-tools/core/targets/equipmentTargets";
import type { RecommendationCardSummary, VaultItemInstanceMatchInfo } from "@d2-tools/core/community-perks";
import type { SaveVaultTagInput, VaultTags, VaultTagValue } from "@d2-tools/core/vault/tags";
import { matchesLoadoutTemplateItem, type LoadoutTemplateLookup } from "@d2-tools/app/loadouts";
import {
  armorStatLabels,
  ammoFilterLabels,
  buildVaultArmorSetFilters,
  buildVaultDuplicateSummary,
  buildVaultContextFacts,
  buildVaultFrameFilters,
  buildVaultGroups,
  buildVaultLocationFilters,
  buildVaultSections,
  buildVaultSlotFilters,
  applyVisibleVaultSelection,
  buildVaultSelectionSummary,
  classFilterLabels,
  craftingFilterLabels,
  damageFilterLabels,
  defaultVaultGroupTab,
  filterVaultItems,
  gearTierFilterLabels,
  lockFilterLabels,
  locationFilterLabels,
  protectVaultCleanupTagPlan,
  rarityFilterLabels,
  getVaultSelectionItemKey,
  selectMarkedCleanupItems,
  sortVaultItems,
  sortLabels,
  tagLabels,
  type VaultAmmoFilter,
  type VaultArmorSetFilter,
  type VaultArmorStatRule,
  type VaultClassFilter,
  type VaultCraftingFilter,
  type VaultDamageFilter,
  type VaultFrameFilter,
  type VaultGearTierFilter,
  type VaultGroupFilter,
  type VaultLockFilter,
  type VaultLocationFilter,
  type VaultRarityFilter,
  type VaultSlotFilter,
  type VaultSortKey,
  type VaultTagFilter
} from "@d2-tools/app/vault";
import { VaultDuplicateGroups } from "./VaultDuplicateGroups.js";
import {
  VaultFilterToolbar,
  type VaultArmorSetCatalogStatus
} from "./VaultFilterToolbar.js";
import { VaultItemSections } from "./VaultItemSections.js";
import {
  VaultRecommendationEvidencePanel,
  type VaultRecommendationSourceState
} from "./VaultRecommendationEvidencePanel.js";
import type {
  VaultRecommendationManagedSource,
  VaultWishlistActions
} from "./VaultWishlistManager.js";
import {
  VaultTargetRulesPanel,
  type VaultTargetRulesActions
} from "./VaultTargetRulesPanel.js";
import type { VaultCleanupActions } from "./useVaultBatchActions.js";
import { useVaultBatchActions } from "./useVaultBatchActions.js";
import { VaultOrganizePanel } from "./VaultOrganizePanel.js";
import { getRovingFocusIndex } from "../interaction/rovingFocus.js";
import {
  buildVaultRecommendationFilterFactIndex,
  buildVaultRecommendationSourceOptions,
  buildVaultRecommendationSummaryIndex,
  canonicalVaultRecommendationSourceId,
  compareVaultRecommendationMetricKeys,
  getVaultRecommendationFilterFact,
  getVaultCommunityInstanceKey,
  vaultRecommendationPrimaryFilterLabel,
  type VaultRecommendationCompleteFilter,
  type VaultRecommendationFilterFact,
  type VaultRecommendationFilterFactIndex,
  type VaultRecommendationMetricKey,
  type VaultRecommendationPrimaryFilter
} from "./vaultRecommendationMatch.js";
import { buildVaultCleanupProtectionIndex } from "./vaultCleanupProtection.js";
import { createVaultItemCollectionStore } from "./vaultItemCollectionStore.js";
import {
  createVaultQuickActionStore,
  type VaultQuickAction
} from "./vaultQuickActionStore.js";
import { VaultQueryIndex, type VaultIndexedQuery } from "./vaultQueryIndex.js";

type VaultWorkspaceTab = "filters" | "duplicates" | "recommendations";
type VaultRecommendationView = "weapons" | "targets";
type VaultAccountResourceStatus = "unavailable" | "cached" | "stale" | "loading" | "refreshing" | "ready" | "error";
type VaultRecommendationSourceSelection = {
  sourceId: string;
  primaryFilter: VaultRecommendationPrimaryFilter;
  completeFilter: VaultRecommendationCompleteFilter;
};

const vaultWorkspaceTabs: Array<{ key: VaultWorkspaceTab; label: string }> = [
  { key: "filters", label: "1 浏览装备" },
  { key: "recommendations", label: "2 看推荐" },
  { key: "duplicates", label: "3 整理同名" }
];
const emptyDuplicateSummary: ReturnType<typeof buildVaultDuplicateSummary> = {
  total_duplicate_groups: 0,
  total_duplicate_items: 0,
  groups: []
};
const emptyCleanupProtection = new Map<string, string[]>();
const DormantVaultWorkspacePanel = memo(function DormantVaultWorkspacePanel(props: {
  active: boolean;
  id: string;
  labelledBy: string;
  className: string;
  scrollPane?: VaultWorkspaceTab;
  children: ReactNode;
}) {
  return (
    <div
      id={props.id}
      role="tabpanel"
      aria-labelledby={props.labelledBy}
      className={props.className}
      data-vault-scroll-pane={props.scrollPane}
      hidden={!props.active}
    >
      {props.children}
    </div>
  );
}, (previous, next) => !previous.active && !next.active
  && previous.id === next.id
  && previous.labelledBy === next.labelledBy
  && previous.className === next.className
  && previous.scrollPane === next.scrollPane);

export function VaultPageContentView(props: {
  items: AccountItemSummary[];
  currentCharacterId?: string;
  armorSetCatalog: ArmorSetCatalogItem[];
  armorSetCatalogStatus: VaultArmorSetCatalogStatus;
  accountResourceStatus?: VaultAccountResourceStatus;
  accountResourceMessage?: string;
  accountResourceError?: string;
  vaultItemCount?: number;
  highlightedItemKeys?: LoadoutTemplateLookup | null;
  cleanupProtectedItemKeys?: LoadoutTemplateLookup | null;
  highlightedLabel?: string;
  tags: VaultTags;
  wishlist?: DimWishlist | null;
  localTargetRules?: LocalTargetRules | null;
  equipmentTargetStore?: EquipmentTargetStore | null;
  openingItemKey?: string;
  locateRequest?: { hash: number; name: string; requestId: number } | null;
  targetLocateRequest?: { targetId: string; requestId: number } | null;
  recommendationCardSummary?: ReadonlyMap<string, RecommendationCardSummary>;
  recommendationSourceState?: VaultRecommendationSourceState;
  wishlistActions?: VaultWishlistActions;
  onCopyRecommendationAudit?: () => void | Promise<void>;
  targetRulesActions?: VaultTargetRulesActions;
  onContextFactsChange?: (facts: string[]) => void;
  onLoadItemDetail?: (item: AccountItemSummary) => Promise<AccountItemSummary>;
  onLoadRecommendationEvidence?: (items: AccountItemSummary[]) => Promise<VaultItemInstanceMatchInfo[]>;
  onOpenItem: (item: AccountItemSummary) => void;
  onSaveTag: (item: AccountItemSummary, tag: VaultTagValue) => void | Promise<void>;
  onSaveTagBatch: (inputs: SaveVaultTagInput[]) => void | Promise<void>;
  cleanupActions?: VaultCleanupActions;
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [group, setGroup] = useState<VaultGroupFilter>(defaultVaultGroupTab);
  const [sortKey, setSortKey] = useState<VaultSortKey>("name");
  const [tagFilter, setTagFilter] = useState<VaultTagFilter>("all");
  const [recommendationSourceSelections, setRecommendationSourceSelections] = useState<VaultRecommendationSourceSelection[]>([]);
  const [lockFilter, setLockFilter] = useState<VaultLockFilter>("all");
  const [slotFilter, setSlotFilter] = useState<VaultSlotFilter>("all");
  const [locationFilter, setLocationFilter] = useState<VaultLocationFilter>("vault");
  const [ammoFilter, setAmmoFilter] = useState<VaultAmmoFilter>("all");
  const [itemTypeFilter, setItemTypeFilter] = useState("all");
  const [rarityFilter, setRarityFilter] = useState<VaultRarityFilter>("all");
  const [gearTierFilter, setGearTierFilter] = useState<VaultGearTierFilter>("all");
  const [classFilter, setClassFilter] = useState<VaultClassFilter>("all");
  const [damageFilter, setDamageFilter] = useState<VaultDamageFilter>("all");
  const [craftingFilter, setCraftingFilter] = useState<VaultCraftingFilter>("all");
  const [armorSetFilter, setArmorSetFilter] = useState<VaultArmorSetFilter>("all");
  const [armorStatRules, setArmorStatRules] = useState<VaultArmorStatRule[]>([]);
  const [frameFilters, setFrameFilters] = useState<VaultFrameFilter>([]);
  const [activeVaultTab, setActiveVaultTab] = useState<VaultWorkspaceTab>("filters");
  const [activeRecommendationView, setActiveRecommendationView] = useState<VaultRecommendationView>("weapons");
  const [hasVisitedDuplicateTab, setHasVisitedDuplicateTab] = useState(false);
  const [duplicateLocateRequest, setDuplicateLocateRequest] = useState<{ groupKey: string; requestId: number } | null>(null);
  const [batchMessage, setBatchMessage] = useState("");
  const [isBatchSaving, setIsBatchSaving] = useState(false);
  const [hasPendingDuplicateChanges, setHasPendingDuplicateChanges] = useState(false);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [cleanupTargetCharacterId, setCleanupTargetCharacterId] = useState("");
  const quickActionStore = useMemo(createVaultQuickActionStore, []);
  const [quickActionFocusRequest, setQuickActionFocusRequest] = useState<{ itemKey: string; requestId: number } | null>(null);
  const [managedRecommendationSources, setManagedRecommendationSources] = useState<VaultRecommendationManagedSource[]>([]);
  const workspaceScrollPositionsRef = useRef<Record<VaultWorkspaceTab, number>>({
    filters: 0,
    recommendations: 0,
    duplicates: 0
  });
  const filterScrollPositionRef = useRef(0);
  const workspaceId = useId();
  const tabIds = useMemo(() => Object.fromEntries(vaultWorkspaceTabs.map((tab) => [tab.key, `${workspaceId}-${tab.key}-tab`])) as Record<VaultWorkspaceTab, string>, [workspaceId]);
  const panelIds = useMemo(() => Object.fromEntries(vaultWorkspaceTabs.map((tab) => [tab.key, `${workspaceId}-${tab.key}-panel`])) as Record<VaultWorkspaceTab, string>, [workspaceId]);
  const recommendationTabIds: Record<VaultRecommendationView, string> = {
    weapons: `${workspaceId}-recommendation-weapons-tab`,
    targets: `${workspaceId}-recommendation-targets-tab`
  };
  const recommendationPanelIds: Record<VaultRecommendationView, string> = {
    weapons: `${workspaceId}-recommendation-weapons-panel`,
    targets: `${workspaceId}-recommendation-targets-panel`
  };
  const recommendationWorkflowStatus = vaultRecommendationWorkflowStatus(props.recommendationSourceState?.recommendationScan);
  const itemCollectionStore = useMemo(() => createVaultItemCollectionStore(props.items), []);
  const vaultQueryIndex = useMemo(() => new VaultQueryIndex(), []);
  const vaultQueryRevision = vaultQueryIndex.replaceItems(props.items, props.currentCharacterId);
  const staticCatalogItems = useStableVaultCatalogItems(props.items);
  useLayoutEffect(() => {
    itemCollectionStore.replaceItems(props.items);
  }, [itemCollectionStore, props.items]);
  const recommendationSummaryByInstance = useMemo(
    () => buildVaultRecommendationSummaryIndex(
      props.items,
      undefined,
      props.wishlist,
      props.recommendationCardSummary
    ),
    [props.items, props.recommendationCardSummary, props.wishlist]
  );
  const recommendationFilterFactByInstance = useMemo(
    () => buildVaultRecommendationFilterFactIndex(recommendationSummaryByInstance),
    [recommendationSummaryByInstance]
  );

  useEffect(() => {
    const getRecommendationManagement = props.wishlistActions?.getRecommendationManagement;
    if (!getRecommendationManagement) {
      setManagedRecommendationSources([]);
      return;
    }
    let active = true;
    void getRecommendationManagement().then(
      (snapshot) => {
        if (active) setManagedRecommendationSources((current) => (
          sameManagedRecommendationSources(current, snapshot.sources) ? current : snapshot.sources
        ));
      },
      () => undefined
    );
    return () => {
      active = false;
    };
  }, [props.recommendationSourceState?.recommendationScan.recommendation_revision, props.wishlistActions?.getRecommendationManagement]);

  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    const scrollRoot = getVaultWorkspaceScrollRoot(panelIds, activeVaultTab);
    if (!scrollRoot) return;
    const frame = requestAnimationFrame(() => {
      scrollRoot.scrollTo({ top: workspaceScrollPositionsRef.current[activeVaultTab] ?? 0 });
      if (activeVaultTab === "filters") {
        document.querySelector<HTMLElement>(".vault-page .vault-filter-workbench")
          ?.scrollTo({ top: filterScrollPositionRef.current });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [activeVaultTab, panelIds]);

  useEffect(() => {
    if (!props.locateRequest) return;
    setQuery(String(props.locateRequest.hash));
    setGroup("weapons");
    resetFilterState(false, "all");
    setActiveVaultTab("filters");
  }, [props.locateRequest?.requestId]);

  useEffect(() => {
    if (!props.targetLocateRequest) return;
    setActiveVaultTab("recommendations");
    setActiveRecommendationView("targets");
  }, [props.targetLocateRequest?.requestId]);

  useEffect(() => {
    const characters = props.cleanupActions?.characters ?? [];
    if (characters.some((character) => character.character_id === cleanupTargetCharacterId)) return;
    setCleanupTargetCharacterId(props.cleanupActions?.currentCharacterId ?? characters[0]?.character_id ?? "");
  }, [cleanupTargetCharacterId, props.cleanupActions?.characters, props.cleanupActions?.currentCharacterId]);

  const indexedFilter = useMemo<VaultIndexedQuery>(() => ({
    group,
    lock: lockFilter,
    slot: slotFilter,
    location: locationFilter,
    ammo: ammoFilter,
    itemType: itemTypeFilter,
    rarity: rarityFilter,
    gearTier: gearTierFilter,
    classType: classFilter,
    damageType: damageFilter,
    crafting: craftingFilter,
    armorSet: armorSetFilter,
    frames: frameFilters
  }), [ammoFilter, armorSetFilter, classFilter, craftingFilter, damageFilter, frameFilters, gearTierFilter, group, itemTypeFilter, locationFilter, lockFilter, rarityFilter, slotFilter]);
  const queryIndexedItems = useCallback((
    overrides: Partial<VaultIndexedQuery> = {},
    allowedItemKeys?: ReadonlySet<string>
  ) => {
    const nextIndexedFilter = { ...indexedFilter, ...overrides };
    return filterVaultItems(vaultQueryIndex.query(nextIndexedFilter, { allowedItemKeys }), {
        group,
        query: deferredQuery,
        tag: tagFilter,
        lock: lockFilter,
        slot: slotFilter,
        location: locationFilter,
        currentCharacterId: props.currentCharacterId,
        ammo: ammoFilter,
        itemType: itemTypeFilter,
        rarity: rarityFilter,
        gearTier: gearTierFilter,
        classType: classFilter,
        damageType: damageFilter,
        crafting: craftingFilter,
        armorSet: armorSetFilter,
        armorStatRules,
        frames: frameFilters,
        tags: props.tags,
        wishlist: props.wishlist,
        localTargetRules: props.localTargetRules,
        ...overrides
      });
  }, [armorStatRules, deferredQuery, group, indexedFilter, props.currentCharacterId, props.localTargetRules, props.tags, props.wishlist, tagFilter, vaultQueryIndex, vaultQueryRevision]);
  const filteredVaultItems = useMemo(
    () => sortVaultItems(
      queryIndexedItems(),
      sortKey,
      props.tags
    ),
    [props.items, props.tags, queryIndexedItems, sortKey]
  );
  const availableRecommendationSources = useMemo(() => buildVaultRecommendationSourceOptions(
    staticCatalogItems.filter((item) => item.group_key === "weapons").map((item) => (
      recommendationSummaryByInstance.get(getVaultCommunityInstanceKey(item)) ?? []
    )),
    managedRecommendationSources
  ), [managedRecommendationSources, recommendationSummaryByInstance, staticCatalogItems]);
  const recommendationSourceOptions = useMemo(() => {
    const contextualCounts = new Map(buildVaultRecommendationSourceOptions(
      filteredVaultItems.map((item) => (
        recommendationSummaryByInstance.get(getVaultCommunityInstanceKey(item)) ?? []
      ))
    ).map((option) => [option.sourceId, option.count]));
    return availableRecommendationSources.map((option) => ({
      ...option,
      count: contextualCounts.get(option.sourceId) ?? 0
    }));
  }, [availableRecommendationSources, filteredVaultItems, recommendationSummaryByInstance]);
  const selectedRecommendationSourceIds = recommendationSourceSelections.map((selection) => selection.sourceId);
  const firstRecommendationSelection = recommendationSourceSelections[0];
  const recommendationPrimaryFilter = firstRecommendationSelection?.primaryFilter ?? "all";
  const recommendationCompleteFilter = firstRecommendationSelection?.completeFilter ?? "all";
  const recommendationSourceIsDim = Boolean(
    firstRecommendationSelection
    && canonicalVaultRecommendationSourceId(firstRecommendationSelection.sourceId) === "dim_wishlist"
  );

  function toggleRecommendationSource(sourceId: string) {
    setRecommendationSourceSelections((current) => {
      if (current.some((selection) => selection.sourceId === sourceId)) {
        return current.filter((selection) => selection.sourceId !== sourceId);
      }
      const nextSelection: VaultRecommendationSourceSelection = {
        sourceId,
        primaryFilter: "all",
        completeFilter: "all"
      };
      return [...current, nextSelection];
    });
  }

  function updateRecommendationSourceSelection(
    sourceId: string,
    patch: Partial<Pick<VaultRecommendationSourceSelection, "primaryFilter" | "completeFilter">>
  ) {
    setRecommendationSourceSelections((current) => current.map((selection) => (
      selection.sourceId === sourceId ? { ...selection, ...patch } : selection
    )));
  }

  useEffect(() => {
    if (!recommendationSourceSelections.length) return;
    const available = new Set(availableRecommendationSources.map((option) => option.sourceId));
    const next = recommendationSourceSelections.filter((selection) => available.has(selection.sourceId));
    if (next.length === recommendationSourceSelections.length) return;
    setRecommendationSourceSelections(next);
  }, [availableRecommendationSources, recommendationSourceSelections]);

  const recommendationFilterState = useMemo(() => buildVaultRecommendationFilterState({
    contextualItems: filteredVaultItems,
    factIndex: recommendationFilterFactByInstance,
    selections: recommendationSourceSelections,
    sourceIds: availableRecommendationSources.map((source) => source.sourceId),
    recommendationCardSummary: props.recommendationCardSummary,
    recommendationScanComplete: props.recommendationSourceState?.recommendationScan.phase === "complete"
  }), [availableRecommendationSources, filteredVaultItems, props.recommendationCardSummary, props.recommendationSourceState?.recommendationScan.phase, recommendationFilterFactByInstance, recommendationSourceSelections]);
  const recommendationAllowedItemKeys = useMemo(() => buildVaultRecommendationAllowedItemKeys({
    catalogItems: staticCatalogItems,
    factIndex: recommendationFilterFactByInstance,
    selections: recommendationSourceSelections,
    recommendationCardSummary: props.recommendationCardSummary,
    recommendationScanComplete: props.recommendationSourceState?.recommendationScan.phase === "complete"
  }), [props.recommendationCardSummary, props.recommendationSourceState?.recommendationScan.phase, recommendationFilterFactByInstance, recommendationSourceSelections, staticCatalogItems]);
  const filteredItems = recommendationFilterState.items;
  const recommendationSourceFilterStates = recommendationFilterState.sources;
  useEffect(() => {
    setRecommendationSourceSelections((current) => {
      let changed = false;
      const next = current.map((selection) => {
        const state = recommendationSourceFilterStates.find((item) => item.sourceId === selection.sourceId);
        if (!state) return selection;
        const primaryValid = selection.primaryFilter === "all"
          || state.primaryOptions.some((option) => option.key === selection.primaryFilter);
        const completeValid = selection.completeFilter === "all"
          || state.completeOptions.some((option) => option.key === selection.completeFilter);
        if (primaryValid && completeValid) return selection;
        changed = true;
        return {
          ...selection,
          primaryFilter: primaryValid ? selection.primaryFilter : "all",
          completeFilter: completeValid && primaryValid ? selection.completeFilter : "all"
        };
      });
      return changed ? next : current;
    });
  }, [recommendationSourceFilterStates]);
  const recommendationSelectionLabels = useMemo(() => recommendationSourceSelections.flatMap((selection) => {
    const source = recommendationSourceOptions.find((option) => option.sourceId === selection.sourceId);
    const sourceState = recommendationSourceFilterStates.find((state) => state.sourceId === selection.sourceId);
    if (!source || !sourceState) return [];
    const labels = [`推荐来源：${source.sourceLabel}`];
    if (selection.primaryFilter !== "all") {
      labels.push(`${sourceState.isDim ? "最佳组合" : "核心 Perk"}：${vaultRecommendationPrimaryFilterLabel(selection.primaryFilter, sourceState.isDim)}`);
    }
    if (!sourceState.isDim && selection.completeFilter !== "all") {
      labels.push(`完整命中：${selection.completeFilter}`);
    }
    return labels;
  }), [recommendationSourceFilterStates, recommendationSourceOptions, recommendationSourceSelections]);
  const selectedItems = useMemo(
    () => props.items.filter((item) => selectedKeys.has(getVaultSelectionItemKey(item))),
    [props.items, selectedKeys]
  );
  const selectedVaultItems = useMemo(
    () => selectedItems.filter((item) => getItemSourceKind(item) === "vault"),
    [selectedItems]
  );
  const selectedLockableItems = useMemo(
    () => selectedItems.filter((item) => Boolean(item.instance_id) && !item.locked),
    [selectedItems]
  );
  const selectedVisibleCount = useMemo(
    () => filteredItems.reduce((count, item) => count + (selectedKeys.has(getVaultSelectionItemKey(item)) ? 1 : 0), 0),
    [filteredItems, selectedKeys]
  );
  const needsCleanupProtection = isOrganizing || activeVaultTab === "duplicates";
  const cleanupActionItems = useMemo(
    () => needsCleanupProtection ? (selectedItems.length
      ? selectMarkedCleanupItems(selectedItems, props.tags)
      : selectMarkedCleanupItems(props.items, props.tags))
      .filter((item) => getItemSourceKind(item) === "vault") : [],
    [needsCleanupProtection, props.items, props.tags, selectedItems]
  );
  const cleanupProtectionByItemKey = useMemo(() => needsCleanupProtection
    ? buildVaultCleanupProtectionIndex({
        items: props.items,
        tags: props.tags,
        highlightedItemKeys: props.cleanupProtectedItemKeys ?? props.highlightedItemKeys,
        recommendationCardSummary: props.recommendationCardSummary,
        recommendationReady: props.recommendationSourceState?.recommendationScan.phase === "complete"
      })
    : emptyCleanupProtection,
  [needsCleanupProtection, props.cleanupProtectedItemKeys, props.highlightedItemKeys, props.items, props.recommendationCardSummary, props.recommendationSourceState?.recommendationScan.phase, props.tags]);
  const safeCleanupActionItems = useMemo(() => cleanupActionItems.filter((item) => (
    (cleanupProtectionByItemKey.get(getVaultCommunityInstanceKey(item))?.length ?? 0) === 0
  )), [cleanupActionItems, cleanupProtectionByItemKey]);
  const selectedProtectedCount = useMemo(() => selectedItems.filter((item) => (
    (cleanupProtectionByItemKey.get(getVaultCommunityInstanceKey(item))?.length ?? 0) > 0
  )).length, [cleanupProtectionByItemKey, selectedItems]);
  const cleanupTargetCharacterLabel = useMemo(
    () => props.cleanupActions?.characters.find((character) => character.character_id === cleanupTargetCharacterId)?.class_name ?? "目标角色",
    [cleanupTargetCharacterId, props.cleanupActions?.characters]
  );
  const selectionSummary = useMemo(
    () => buildVaultSelectionSummary({ selectedTotalCount: selectedItems.length, selectedVisibleCount }),
    [selectedItems.length, selectedVisibleCount]
  );
  const batchActions = useVaultBatchActions({
    selectedItems,
    vaultActionItems: selectedVaultItems,
    cleanupActionItems: safeCleanupActionItems,
    cleanupActions: props.cleanupActions,
    cleanupTargetCharacterId,
    cleanupTargetCharacterLabel,
    cleanupProtectionByItemKey,
    setSelectedKeys,
    onSaveTagBatch: props.onSaveTagBatch
  });
  const filteredSections = useMemo(() => buildVaultSections(filteredItems), [filteredItems]);
  const groups = useMemo(() => buildVaultGroups(staticCatalogItems), [staticCatalogItems]);
  const slotFilters = useMemo(() => {
    const candidates = queryIndexedItems({ slot: "all" }, recommendationAllowedItemKeys);
    return buildVaultSlotFilters(candidates);
  }, [queryIndexedItems, recommendationAllowedItemKeys]);
  const locationFilters = useMemo(() => {
    const candidates = queryIndexedItems({ group: "weapons", location: "all" }, recommendationAllowedItemKeys);
    return buildVaultLocationFilters(candidates, props.currentCharacterId);
  }, [props.currentCharacterId, queryIndexedItems, recommendationAllowedItemKeys]);
  const availableFrameFilters = useMemo(() => {
    const candidates = queryIndexedItems({ frames: [] }, recommendationAllowedItemKeys);
    return buildVaultFrameFilters(candidates);
  }, [queryIndexedItems, recommendationAllowedItemKeys]);
  const armorSetFilters = useMemo(
    () => buildVaultArmorSetFilters(props.armorSetCatalog, staticCatalogItems),
    [props.armorSetCatalog, staticCatalogItems]
  );
  const armorSetLabel = useMemo(
    () => armorSetFilters.find((option) => option.key === armorSetFilter)?.label,
    [armorSetFilter, armorSetFilters]
  );
  useEffect(() => {
    if (armorSetFilter === "all") return;
    if (props.armorSetCatalogStatus !== "ready"
      || !armorSetFilters.some((option) => option.key === armorSetFilter)) {
      setArmorSetFilter("all");
    }
  }, [armorSetFilter, armorSetFilters, props.armorSetCatalogStatus]);
  const itemTypeFilters = useMemo(() => {
    const counts = new Map<string, number>();
    const candidates = queryIndexedItems({ group: "weapons", itemType: "all" }, recommendationAllowedItemKeys);
    candidates.filter((item) => item.item_type).forEach((item) => {
      const itemType = item.item_type ?? "";
      counts.set(itemType, (counts.get(itemType) ?? 0) + 1);
    });
    return [...counts.entries()]
      .map(([key, count]) => ({ key, label: key, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "zh-Hans-CN"));
  }, [queryIndexedItems, recommendationAllowedItemKeys]);
  const needsDuplicateSummary = activeVaultTab !== "filters";
  const duplicateSummary = useMemo(
    () => needsDuplicateSummary ? buildVaultDuplicateSummary(props.items, props.tags) : emptyDuplicateSummary,
    [needsDuplicateSummary, props.items, props.tags]
  );
  const duplicateGroupKeyByItemKey = useMemo(() => new Map(
    duplicateSummary.groups.flatMap((duplicateGroup) => duplicateGroup.items.map((entry) => [entry.item_key, duplicateGroup.group_key] as const))
  ), [duplicateSummary]);
  const pendingDuplicateGroupCount = useMemo(
    () => duplicateSummary.groups.filter((duplicateGroup) => duplicateGroup.items.some((item) => item.tag !== "keep" && item.tag !== "review" && item.tag !== "junk")).length,
    [duplicateSummary]
  );
  const completedDuplicateGroupCount = duplicateSummary.total_duplicate_groups - pendingDuplicateGroupCount;
  const loadoutMatchCount = useMemo(
    () => props.highlightedItemKeys ? filteredItems.filter((item) => matchesLoadoutTemplateItem(item, props.highlightedItemKeys)).length : 0,
    [filteredItems, props.highlightedItemKeys]
  );
  const activeFilterLabels = useMemo(() => buildActiveFilterLabels({
    group,
    query,
    sortKey,
    slotFilter,
    locationFilter,
    itemTypeFilter,
    rarityFilter,
    gearTierFilter,
    ammoFilter,
    damageFilter,
    craftingFilter,
    classFilter,
    armorSetFilter,
    armorSetLabel,
    lockFilter,
    tagFilter,
    recommendationSelectionLabels,
    frameFilterCount: frameFilters.length,
    armorRuleCount: armorStatRules.length
  }), [ammoFilter, armorSetFilter, armorSetLabel, armorStatRules.length, classFilter, craftingFilter, damageFilter, frameFilters.length, gearTierFilter, group, itemTypeFilter, locationFilter, lockFilter, query, rarityFilter, recommendationSelectionLabels, slotFilter, sortKey, tagFilter]);
  const contextFacts = useMemo(() => buildVaultContextFacts({
    group,
    query,
    tagFilter,
    lockFilter,
    slotFilter,
    locationFilter,
    ammoFilter,
    itemTypeFilter,
    rarityFilter,
    gearTierFilter,
    classFilter,
    damageFilter,
    craftingFilter,
    armorSetFilter,
    armorSetLabel,
    frameFilters,
    armorStatRules,
    filteredCount: filteredVaultItems.length,
    totalCount: props.items.length
  }), [ammoFilter, armorSetFilter, armorSetLabel, armorStatRules, classFilter, craftingFilter, damageFilter, filteredVaultItems.length, frameFilters, gearTierFilter, group, itemTypeFilter, locationFilter, lockFilter, props.items.length, query, rarityFilter, slotFilter, tagFilter]);

  useEffect(() => {
    props.onContextFactsChange?.([
      ...contextFacts,
      ...recommendationSelectionLabels,
      `当前结果：${filteredItems.length} 件`
    ]);
  }, [contextFacts, filteredItems.length, props.onContextFactsChange, recommendationSelectionLabels]);

  function resetFilterState(
    resetQuery = true,
    nextLocation: VaultLocationFilter = group === "weapons" ? "vault" : "all"
  ) {
    if (resetQuery) setQuery("");
    setSortKey("name");
    setTagFilter("all");
    setRecommendationSourceSelections([]);
    setLockFilter("all");
    setSlotFilter("all");
    setLocationFilter(nextLocation);
    setAmmoFilter("all");
    setItemTypeFilter("all");
    setRarityFilter("all");
    setGearTierFilter("all");
    setClassFilter("all");
    setDamageFilter("all");
    setCraftingFilter("all");
    setArmorSetFilter("all");
    setArmorStatRules([]);
    setFrameFilters([]);
    setBatchMessage("");
  }

  function switchVaultFilterMode(nextGroup: VaultGroupFilter) {
    setGroup(nextGroup);
    setSlotFilter("all");
    setLocationFilter(nextGroup === "weapons" ? "vault" : "all");
    if (nextGroup !== "weapons") {
      setRecommendationSourceSelections([]);
      setAmmoFilter("all");
      setItemTypeFilter("all");
      setDamageFilter("all");
      setCraftingFilter("all");
      setFrameFilters([]);
    }
    if (nextGroup !== "armor") {
      setClassFilter("all");
      setArmorSetFilter("all");
      setArmorStatRules([]);
    }
    if (nextGroup === "equipment") {
      setRarityFilter("all");
      setGearTierFilter("all");
    }
  }

  function addArmorStatRule() {
    setArmorStatRules((current) => {
      const used = new Set(current.map((rule) => rule.stat));
      const nextStat = (Object.keys(armorStatLabels) as Array<Exclude<VaultArmorStatRule["stat"], "">>).find((stat) => !used.has(stat));
      return nextStat ? [...current, { stat: nextStat, min: 10 }] : current;
    });
  }

  function toggleFrameFilter(key: string) {
    setFrameFilters((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]);
  }

  function switchVaultTab(tab: VaultWorkspaceTab) {
    if (typeof document !== "undefined") {
      const scrollRoot = getVaultWorkspaceScrollRoot(panelIds, activeVaultTab);
      if (scrollRoot) workspaceScrollPositionsRef.current[activeVaultTab] = scrollRoot.scrollTop;
      if (activeVaultTab === "filters") {
        filterScrollPositionRef.current = document.querySelector<HTMLElement>(".vault-page .vault-filter-workbench")?.scrollTop ?? 0;
      }
    }
    if (tab === "duplicates") setHasVisitedDuplicateTab(true);
    setActiveVaultTab(tab);
    setBatchMessage("");
  }

  function openDuplicateGroupForItem(item: AccountItemSummary) {
    const groupKey = duplicateGroupKeyByItemKey.get(getVaultSelectionItemKey(item));
    if (!groupKey) return;
    switchVaultTab("duplicates");
    setDuplicateLocateRequest((current) => ({
      groupKey,
      requestId: (current?.requestId ?? 0) + 1
    }));
  }

  function handleVaultTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const currentIndex = vaultWorkspaceTabs.findIndex((tab) => tab.key === activeVaultTab);
    const nextIndex = getRovingFocusIndex({
      key: event.key,
      currentIndex,
      itemCount: vaultWorkspaceTabs.length,
      orientation: "horizontal"
    });
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = vaultWorkspaceTabs[nextIndex]?.key ?? "filters";
    switchVaultTab(nextTab);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus();
  }

  function handleRecommendationViewKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const views: VaultRecommendationView[] = ["weapons", "targets"];
    const nextIndex = getRovingFocusIndex({
      key: event.key,
      currentIndex: views.indexOf(activeRecommendationView),
      itemCount: views.length,
      orientation: "horizontal"
    });
    if (nextIndex === null) return;
    event.preventDefault();
    setActiveRecommendationView(views[nextIndex] ?? "weapons");
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus();
  }

  async function applyDuplicateGroupTags(groupName: string, inputs: SaveVaultTagInput[]) {
    setIsBatchSaving(true);
    setBatchMessage(`正在应用 ${groupName} 的整理状态...`);
    try {
      const plan = protectVaultCleanupTagPlan(inputs, cleanupProtectionByItemKey, props.tags);
      await props.onSaveTagBatch(plan.inputs);
      setBatchMessage(`已应用 ${groupName} 的整理状态。${plan.protectedCount
        ? ` ${plan.protectedCount} 件受保护，已保持原标签。`
        : ""}`);
    } catch (error) {
      setBatchMessage(error instanceof Error ? error.message : "同名组整理状态保存失败");
    } finally {
      setIsBatchSaving(false);
    }
  }

  function toggleSelectedItem(item: AccountItemSummary) {
    const key = getVaultSelectionItemKey(item);
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectVisibleItems(mode: "replace" | "append" | "remove") {
    setSelectedKeys((current) => applyVisibleVaultSelection(current, filteredItems, mode));
    setIsOrganizing(true);
  }

  function toggleOrganizing() {
    if (isOrganizing) setSelectedKeys(new Set());
    setIsOrganizing((current) => !current);
  }

  function requestQuickActionFocus(itemKey: string) {
    setQuickActionFocusRequest((current) => ({
      itemKey,
      requestId: (current?.requestId ?? 0) + 1
    }));
  }

  async function runSelectedBulkLock() {
    if (!props.cleanupActions || !selectedLockableItems.length || isBatchSaving) return;
    setIsBatchSaving(true);
    batchActions.setActiveBatchAction("批量加锁");
    setBatchMessage(`正在加锁 ${selectedLockableItems.length} 件装备...`);
    let successCount = 0;
    const failures: string[] = [];
    for (const item of selectedLockableItems) {
      const targetCharacterId = getQuickActionCharacterId(
        item,
        props.cleanupActions.currentCharacterId ?? cleanupTargetCharacterId
      );
      if (!targetCharacterId) {
        failures.push(`${item.name}：没有可用角色`);
        continue;
      }
      try {
        await props.cleanupActions.onLockItem(item, targetCharacterId);
        successCount += 1;
      } catch (error) {
        failures.push(`${item.name}：${error instanceof Error ? error.message : "加锁失败"}`);
      }
    }
    setBatchMessage([
      successCount ? `已加锁 ${successCount} 件装备。` : "没有装备成功加锁。",
      failures.length ? `${failures.length} 件失败：${failures.slice(0, 3).join("；")}${failures.length > 3 ? "；其余失败请查看应用日志" : ""}` : ""
    ].filter(Boolean).join(" "));
    batchActions.setActiveBatchAction("");
    setIsBatchSaving(false);
  }

  async function runQuickAction(item: AccountItemSummary, action: VaultQuickAction) {
    if (!props.cleanupActions || quickActionStore.getActive()) return;
    const itemKey = getVaultSelectionItemKey(item);
    const itemIndex = filteredItems.findIndex((candidate) => getVaultSelectionItemKey(candidate) === itemKey);
    const lockState = action === "lock" ? true : action === "unlock" ? false : undefined;
    const actionLabel = action === "transfer" ? "取出" : lockState ? "加锁" : "解锁";
    const itemWillLeaveResults = (action === "transfer" && locationFilter === "vault")
      || (lockState !== undefined && lockFilter !== "all");
    const fallbackItem = itemWillLeaveResults
      ? filteredItems[itemIndex + 1] ?? filteredItems[itemIndex - 1]
      : item;
    const targetCharacterId = getQuickActionCharacterId(item, props.cleanupActions.currentCharacterId);
    if (!targetCharacterId) {
      setBatchMessage(`${actionLabel}失败：当前没有可用角色。`);
      requestQuickActionFocus(itemKey);
      return;
    }

    quickActionStore.setActive({ itemKey, action });
    setBatchMessage(action === "transfer"
      ? `正在取出到${props.cleanupActions.currentCharacterLabel ?? "当前角色"}：${item.name}`
      : `正在${actionLabel}：${item.name}`);
    try {
      if (lockState !== undefined) {
        await props.cleanupActions.onLockItem(item, targetCharacterId, lockState);
        setBatchMessage(`已${actionLabel}：${item.name}`);
      } else {
        const result = await props.cleanupActions.onBatchTransferToCharacter([item], targetCharacterId);
        if (!result.success_count) {
          throw new Error(result.failure_messages?.[0] || result.message || "Bungie 未接受这次取出操作");
        }
        setBatchMessage(`已取出到${props.cleanupActions.currentCharacterLabel ?? "当前角色"}：${item.name}`);
      }
      if (fallbackItem) requestQuickActionFocus(getVaultSelectionItemKey(fallbackItem));
    } catch (error) {
      setBatchMessage(`${actionLabel}失败：${error instanceof Error ? error.message : "操作未完成"}`);
      requestQuickActionFocus(itemKey);
    } finally {
      quickActionStore.setActive(null);
    }
  }

  return (
    <div className="vault-page">
      <div className="vault-sticky-zone">
        <div className="vault-workflow-bar" data-surface="section">
          <div className="vault-workflow-tabs" data-ui-kind="segmented-control" role="tablist" aria-label="仓库工作台">
            {vaultWorkspaceTabs.map((tab) => (
              <button type="button" data-ui-kind="button" data-control-variant="quiet" role="tab" id={tabIds[tab.key]} aria-controls={panelIds[tab.key]} aria-selected={activeVaultTab === tab.key} tabIndex={activeVaultTab === tab.key ? 0 : -1} key={tab.key} className={activeVaultTab === tab.key ? "active" : ""} onClick={() => switchVaultTab(tab.key)} onKeyDown={handleVaultTabKeyDown}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="vault-workflow-meta">
            {props.accountResourceStatus && props.accountResourceStatus !== "ready" ? <span className={`ui-badge ${vaultResourceStatusTone(props.accountResourceStatus)}`} data-ui-kind="status-chip" data-status={props.accountResourceStatus}>{vaultResourceStatusLabel(props.accountResourceStatus)}</span> : null}
            <button type="button" className={`ui-badge vault-recommendation-status-link status-${recommendationWorkflowStatus.tone}`} data-ui-kind="status-chip" data-status={recommendationWorkflowStatus.tone} onClick={() => { setActiveRecommendationView("weapons"); switchVaultTab("recommendations"); }}>{recommendationWorkflowStatus.label}</button>
            {props.highlightedItemKeys ? <span className="ui-badge status-success" data-ui-kind="status-chip">配装命中 {loadoutMatchCount} 件</span> : null}
          </div>
        </div>
        {props.accountResourceError ? <p className="status-message status-error" role="alert">{props.accountResourceError}</p> : props.accountResourceMessage ? <p className={`status-message ${props.accountResourceStatus === "cached" || props.accountResourceStatus === "refreshing" ? "status-warning" : "status-ready"}`} role="status">{props.accountResourceMessage}</p> : null}
        {(batchMessage || batchActions.batchMessage) ? <p className={(batchMessage || batchActions.batchMessage).includes("失败") ? "status-message status-error" : "status-message status-ready"}>{batchMessage || batchActions.batchMessage}</p> : null}
      </div>

      {activeVaultTab === "filters" ? (
        <div id={panelIds.filters} role="tabpanel" aria-labelledby={tabIds.filters} className="vault-workspace-panel vault-browse-panel">
          <div className="vault-browse">
            <VaultFilterToolbar
              query={query}
              sortKey={sortKey}
              tagFilter={tagFilter}
              armorStatRules={armorStatRules}
              lockFilter={lockFilter}
              slotFilter={slotFilter}
              locationFilter={locationFilter}
              ammoFilter={ammoFilter}
              itemTypeFilter={itemTypeFilter}
              rarityFilter={rarityFilter}
              gearTierFilter={gearTierFilter}
              classFilter={classFilter}
              damageFilter={damageFilter}
              craftingFilter={craftingFilter}
              armorSetFilter={armorSetFilter}
              frameFilters={frameFilters}
              group={group}
              groups={groups}
              slotFilters={slotFilters}
              locationFilters={locationFilters}
              itemTypeFilters={itemTypeFilters}
              armorSetFilters={armorSetFilters}
              armorSetCatalogStatus={props.armorSetCatalogStatus}
              availableFrameFilters={availableFrameFilters}
              activeFilterCount={activeFilterLabels.length}
              onQueryChange={setQuery}
              onResetFilters={resetFilterState}
              onSortKeyChange={setSortKey}
              onTagFilterChange={setTagFilter}
              onAddArmorStatRule={addArmorStatRule}
              onClearArmorStatRules={() => setArmorStatRules([])}
              onRemoveArmorStatRule={(index) => setArmorStatRules((current) => current.filter((_, itemIndex) => itemIndex !== index))}
              onUpdateArmorStatRule={(index, rule) => setArmorStatRules((current) => current.map((item, itemIndex) => itemIndex === index ? rule : item))}
              onLockFilterChange={setLockFilter}
              onSlotFilterChange={setSlotFilter}
              onLocationFilterChange={setLocationFilter}
              onAmmoFilterChange={setAmmoFilter}
              onItemTypeFilterChange={setItemTypeFilter}
              onRarityFilterChange={setRarityFilter}
              onGearTierFilterChange={setGearTierFilter}
              onClassFilterChange={setClassFilter}
              onDamageFilterChange={setDamageFilter}
              onCraftingFilterChange={setCraftingFilter}
              onArmorSetFilterChange={setArmorSetFilter}
              onGroupChange={switchVaultFilterMode}
              onToggleFrameFilter={toggleFrameFilter}
            />
            <section className="vault-results-column vault-browse-results" data-surface="section" data-contract-id="vault.results" data-vault-scroll-pane="filters">
              <div className="vault-results-command-row">
                {group === "weapons" ? (
                  <div className="vault-recommendation-filter" role="group" aria-label="按推荐来源筛选">
                    <div className="vault-recommendation-source-list" role="group" aria-label="推荐来源多选">
                      {recommendationSourceOptions.map((option) => {
                        const selection = recommendationSourceSelections.find((item) => item.sourceId === option.sourceId);
                        const sourceState = recommendationSourceFilterStates.find((state) => state.sourceId === option.sourceId);
                        const active = Boolean(selection && sourceState);
                        if (!sourceState) return null;
                        const directOptions = sourceState.primaryOptions.filter((item) => item.key === "all" || isVaultRecommendationMetricKey(item.key));
                        const otherOptions = sourceState.primaryOptions.filter((item) => item.key !== "all" && !isVaultRecommendationMetricKey(item.key));
                        return (
                          <div className={`vault-recommendation-source-row${active ? " is-active" : ""}`} key={option.sourceId}>
                            <div className="vault-recommendation-source-head">
                              <button
                                type="button"
                                className="vault-recommendation-source-toggle"
                                aria-pressed={active}
                                aria-expanded={active}
                                aria-label={`${option.sourceLabel}，覆盖 ${option.count} 件${active ? "，已选中" : ""}`}
                                title={`${option.sourceLabel} · 覆盖 ${option.count} 件`}
                                onClick={() => toggleRecommendationSource(option.sourceId)}
                              >
                                <span className="vault-recommendation-source-check" aria-hidden="true">{active ? "✓" : ""}</span>
                                <span>{option.sourceLabel}</span>
                                <small className="vault-recommendation-option-count">{option.count}</small>
                              </button>
                            </div>
                            {active && selection ? (
                              <div className={`vault-recommendation-source-conditions${sourceState.isDim ? " is-dim" : ""}`} role="group" aria-label={`${option.sourceLabel}${sourceState.isDim ? "最佳组合" : "核心 Perk"}筛选`}>
                                <div className="vault-recommendation-primary-filter" role="group" aria-label={`${option.sourceLabel}${sourceState.isDim ? "最佳组合" : "核心 Perk"}命中筛选`}>
                                  <span>
                                    {directOptions.map((filterOption) => (
                                      <button
                                        type="button"
                                        key={filterOption.key}
                                        disabled={filterOption.count === 0}
                                        aria-pressed={selection.primaryFilter === filterOption.key}
                                        aria-label={`${option.sourceLabel}${sourceState.isDim ? "最佳组合" : "核心 Perk"}${formatVaultRecommendationMetricOptionLabel(filterOption.key, sourceState.isDim)}，${filterOption.count} 件`}
                                        title={`${sourceState.isDim ? "最佳组合" : "核心 Perk"}：${formatVaultRecommendationMetricOptionLabel(filterOption.key, sourceState.isDim)}，${filterOption.count} 件`}
                                        onClick={() => updateRecommendationSourceSelection(option.sourceId, { primaryFilter: filterOption.key, completeFilter: "all" })}
                                      >
                                        <span>{formatVaultRecommendationMetricOptionLabel(filterOption.key, sourceState.isDim)}</span>
                                        <small className="vault-recommendation-option-count" aria-hidden="true">{filterOption.count}</small>
                                      </button>
                                    ))}
                                  </span>
                                </div>
                                {otherOptions.length ? (
                                  <label className="vault-recommendation-other-filter">
                                    <span className="sr-only">{option.sourceLabel}其他推荐状态</span>
                                    <select
                                      aria-label={`${option.sourceLabel}其他推荐状态`}
                                      value={selection.primaryFilter === "all" || isVaultRecommendationMetricKey(selection.primaryFilter) ? "" : selection.primaryFilter}
                                      onChange={(event) => updateRecommendationSourceSelection(option.sourceId, { primaryFilter: (event.target.value || "all") as VaultRecommendationPrimaryFilter, completeFilter: "all" })}
                                    >
                                      <option value="">其他状态</option>
                                      {otherOptions.map((filterOption) => (
                                        <option key={filterOption.key} value={filterOption.key} disabled={filterOption.count === 0}>{filterOption.label} · {filterOption.count}</option>
                                      ))}
                                    </select>
                                  </label>
                                ) : null}
                                {!sourceState.isDim && sourceState.completeOptions.length > 1 ? (
                                  <label className="vault-recommendation-complete-filter">
                                    <span className="sr-only">{option.sourceLabel}完整命中筛选</span>
                                    <select
                                      aria-label={`${option.sourceLabel}完整命中筛选`}
                                      value={selection.completeFilter}
                                      onChange={(event) => updateRecommendationSourceSelection(option.sourceId, { completeFilter: event.target.value as VaultRecommendationCompleteFilter })}
                                    >
                                      {sourceState.completeOptions.map((filterOption) => (
                                        <option key={filterOption.key} value={filterOption.key} disabled={filterOption.count === 0}>{filterOption.key === "all" ? "完整：不限" : `完整 ${filterOption.key}`} · {filterOption.count}</option>
                                      ))}
                                    </select>
                                  </label>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                <div className="vault-results-command-summary" aria-live="polite">
                  <span>{group === "weapons" ? locationFilterLabels[locationFilter] : "仓库装备"}</span>
                  <strong>{filteredItems.length} 件</strong>
                  <span>{activeFilterLabels.length} 项条件</span>
                  <span>{sortLabels[sortKey]}</span>
                </div>
                <button
                  type="button"
                  className="vault-batch-toggle"
                  data-ui-kind="button"
                  data-control-variant="secondary"
                  aria-expanded={isOrganizing}
                  onClick={toggleOrganizing}
                >
                  {isOrganizing ? "退出批量" : "批量选择"}
                </button>
              </div>
              <VaultOrganizePanel
                isOrganizing={isOrganizing}
                filteredItemCount={filteredItems.length}
                selectedItemCount={selectedItems.length}
                selectedVaultItemCount={selectedVaultItems.length}
                selectedLockableItemCount={selectedLockableItems.length}
                selectedProtectedCount={selectedProtectedCount}
                selectionSummary={selectionSummary}
                activeBatchAction={batchActions.activeBatchAction}
                isBatchSaving={isBatchSaving || batchActions.isBatchSaving}
                cleanupActions={props.cleanupActions}
                cleanupCharacters={props.cleanupActions?.characters ?? []}
                cleanupTargetCharacterId={cleanupTargetCharacterId}
                markedCleanupItemCount={cleanupActionItems.length}
                protectedCleanupItemCount={cleanupActionItems.length - safeCleanupActionItems.length}
                cleanupActionItems={safeCleanupActionItems}
                tags={props.tags}
                onVisibleSelectionChange={selectVisibleItems}
                onClearSelection={() => setSelectedKeys(new Set())}
                onCleanupTargetCharacterChange={setCleanupTargetCharacterId}
                onApplyBatchTag={batchActions.applyBatchTag}
                onRunSelectedBulkLock={runSelectedBulkLock}
                onRunSelectedBulkMove={batchActions.runSelectedBulkMove}
                onRunCleanupAction={batchActions.runCleanupAction}
              />
              <VaultItemSections
                sections={filteredSections}
                itemCollectionStore={itemCollectionStore}
                highlightedItemKeys={props.highlightedItemKeys}
                tags={props.tags}
                recommendationSummaryByInstance={recommendationSummaryByInstance}
                preferredRecommendationSourceId={selectedRecommendationSourceIds[0] || undefined}
                isOrganizing={isOrganizing}
                isSearchActive={Boolean(query.trim())}
                selectedKeys={selectedKeys}
                openingItemKey={props.openingItemKey}
                currentCharacterId={props.cleanupActions?.currentCharacterId}
                currentCharacterLabel={props.cleanupActions?.currentCharacterLabel}
                quickActionStore={quickActionStore}
                quickActionsDisabled={isBatchSaving || batchActions.isBatchSaving}
                focusRequest={quickActionFocusRequest}
                emptyMessage="没有匹配的装备。请调整左侧条件或重置筛选。"
                onSelectItem={props.onOpenItem}
                onToggleSelected={toggleSelectedItem}
                onQuickAction={runQuickAction}
              />
            </section>
          </div>
        </div>
      ) : null}

      {hasVisitedDuplicateTab ? (
        <DormantVaultWorkspacePanel
          id={panelIds.duplicates}
          labelledBy={tabIds.duplicates}
          className="vault-workspace-panel"
          scrollPane="duplicates"
          active={activeVaultTab === "duplicates"}
        >
          <div className="vault-summary-strip">
            <div><span>待整理同名组</span><strong>{pendingDuplicateGroupCount} 组</strong></div>
            <div><span>已整理组</span><strong>{completedDuplicateGroupCount} 组</strong></div>
            <div><span>重复实例</span><strong>{duplicateSummary.total_duplicate_items} 件</strong></div>
          </div>
          <VaultDuplicateGroups
            duplicateSummary={duplicateSummary}
            items={props.items}
            recommendationSummaryByInstance={recommendationSummaryByInstance}
            localTargetRules={props.localTargetRules}
            equipmentTargetStore={props.equipmentTargetStore}
            highlightedItemKeys={props.highlightedItemKeys}
            cleanupProtectionByItemKey={cleanupProtectionByItemKey}
            locateRequest={duplicateLocateRequest}
            openingItemKey={props.openingItemKey}
            isBatchSaving={isBatchSaving}
            recommendationRevision={props.recommendationSourceState?.recommendationScan.recommendation_revision}
            onLoadItemDetail={props.onLoadItemDetail}
            onLoadRecommendationEvidence={props.onLoadRecommendationEvidence}
            onOpenItem={props.onOpenItem}
            onApplyGroupTags={applyDuplicateGroupTags}
            onPendingChange={setHasPendingDuplicateChanges}
          />
        </DormantVaultWorkspacePanel>
      ) : null}

      {activeVaultTab === "recommendations" ? (
        <div id={panelIds.recommendations} role="tabpanel" aria-labelledby={tabIds.recommendations} className="vault-recommendations vault-workspace-panel" data-vault-scroll-pane="recommendations">
          <div className="vault-recommendation-view-tabs" data-ui-kind="segmented-control" role="tablist" aria-label="推荐与目标内容">
            <button type="button" role="tab" id={recommendationTabIds.weapons} aria-controls={recommendationPanelIds.weapons} aria-selected={activeRecommendationView === "weapons"} tabIndex={activeRecommendationView === "weapons" ? 0 : -1} className={activeRecommendationView === "weapons" ? "active" : ""} onClick={() => setActiveRecommendationView("weapons")} onKeyDown={handleRecommendationViewKeyDown}>武器推荐</button>
            <button type="button" role="tab" id={recommendationTabIds.targets} aria-controls={recommendationPanelIds.targets} aria-selected={activeRecommendationView === "targets"} tabIndex={activeRecommendationView === "targets" ? 0 : -1} className={activeRecommendationView === "targets" ? "active" : ""} onClick={() => setActiveRecommendationView("targets")} onKeyDown={handleRecommendationViewKeyDown}>个人目标</button>
          </div>
          {activeRecommendationView === "weapons" ? (
            <div id={recommendationPanelIds.weapons} className="vault-recommendation-view-panel" role="tabpanel" aria-labelledby={recommendationTabIds.weapons}>
              <VaultRecommendationEvidencePanel
                items={props.items}
                tags={props.tags}
                wishlist={props.wishlist}
                recommendationCardSummary={props.recommendationCardSummary}
                recommendationSummaryByInstance={recommendationSummaryByInstance}
                highlightedItemKeys={props.highlightedItemKeys}
                sourceState={props.recommendationSourceState}
                managedSources={managedRecommendationSources}
                sourceOptions={availableRecommendationSources}
                filterFactByInstance={recommendationFilterFactByInstance}
                activeSourceId={selectedRecommendationSourceIds[0] ?? ""}
                activePrimaryFilter={recommendationPrimaryFilter}
                activeCompleteFilter={recommendationCompleteFilter}
                wishlistActions={props.wishlistActions}
                managementLocked={hasPendingDuplicateChanges}
                canOrganizeItem={(item) => duplicateGroupKeyByItemKey.has(getVaultSelectionItemKey(item))}
                onCopyAuditReport={props.onCopyRecommendationAudit}
                onActiveSourceChange={(sourceId) => {
                  setRecommendationSourceSelections(sourceId ? [{ sourceId, primaryFilter: "all", completeFilter: "all" }] : []);
                }}
                onActivePrimaryFilterChange={(filter) => {
                  const sourceId = selectedRecommendationSourceIds[0];
                  if (sourceId) updateRecommendationSourceSelection(sourceId, { primaryFilter: filter, completeFilter: "all" });
                }}
                onActiveCompleteFilterChange={(filter) => {
                  const sourceId = selectedRecommendationSourceIds[0];
                  if (sourceId) updateRecommendationSourceSelection(sourceId, { completeFilter: filter });
                }}
                onOpenItem={props.onOpenItem}
                onOrganizeItem={openDuplicateGroupForItem}
              />
            </div>
          ) : (
            <section id={recommendationPanelIds.targets} className="vault-personal-targets vault-recommendation-view-panel" data-surface="section" role="tabpanel" aria-labelledby={recommendationTabIds.targets}>
              <div className="vault-column-head"><div><h3>个人装备目标</h3><span>你自己保存的刷取目标、攻略引用和兼容规则</span></div></div>
              <VaultTargetRulesPanel items={props.items} rules={props.localTargetRules ?? { action_policy: "notify_only", armor: [], weapons: [] }} equipmentTargetStore={props.equipmentTargetStore} targetLocateRequest={props.targetLocateRequest} actions={props.targetRulesActions} />
            </section>
          )}
        </div>
      ) : null}
    </div>
  );
}

function getVaultWorkspaceScrollRoot(
  panelIds: Record<VaultWorkspaceTab, string>,
  tab: VaultWorkspaceTab
): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const page = document.querySelector<HTMLElement>(".vault-page");
  const pane = tab === "filters"
    ? page?.querySelector<HTMLElement>('[data-vault-scroll-pane="filters"]') ?? null
    : document.getElementById(panelIds[tab]);
  if (pane && getComputedStyle(pane).overflowY !== "visible") return pane;
  return page;
}

function vaultResourceStatusLabel(status: VaultAccountResourceStatus): string {
  switch (status) {
    case "cached": return "本地缓存";
    case "stale": return "缓存已过期";
    case "refreshing": return "正在同步装备数据";
    case "loading": return "正在读取装备数据";
    case "ready": return "装备数据已同步";
    case "error": return "读取失败";
    default: return "装备数据不可用";
  }
}

function vaultResourceStatusTone(status: VaultAccountResourceStatus): string {
  switch (status) {
    case "cached":
    case "ready": return "status-success";
    case "stale": return "status-warning";
    case "refreshing":
    case "loading": return "status-pending";
    case "error": return "status-error";
    default: return "status-neutral";
  }
}

function vaultRecommendationWorkflowStatus(scan?: VaultRecommendationSourceState["recommendationScan"]): { label: string; tone: "neutral" | "pending" | "success" | "error" } {
  if (scan?.blocking_reason === "recommendation_unavailable"
    || scan?.issues?.some((issue) => issue.code === "recommendation_unavailable")) {
    return { label: "推荐数据未准备", tone: "pending" };
  }
  if (scan?.phase === "scanning") return { label: "正在核对推荐", tone: "pending" };
  if (scan?.phase === "partial") return { label: "部分核对完成", tone: "pending" };
  if (scan?.phase === "error") return { label: "推荐核对失败", tone: "error" };
  if (scan?.phase === "complete") return { label: `已核对 ${scan.scanned_weapon_count} 件`, tone: "success" };
  return { label: "尚未核对", tone: "neutral" };
}

type VaultRecommendationFilterOption<T extends string> = {
  key: T;
  label: string;
  count: number;
};

type VaultRecommendationSourceFilterState = {
  sourceId: string;
  isDim: boolean;
  primaryOptions: Array<VaultRecommendationFilterOption<VaultRecommendationPrimaryFilter>>;
  completeOptions: Array<VaultRecommendationFilterOption<VaultRecommendationCompleteFilter>>;
};

function buildVaultRecommendationFilterState(input: {
  contextualItems: readonly AccountItemSummary[];
  factIndex: VaultRecommendationFilterFactIndex;
  selections: readonly VaultRecommendationSourceSelection[];
  sourceIds: readonly string[];
  recommendationCardSummary?: ReadonlyMap<string, RecommendationCardSummary>;
  recommendationScanComplete: boolean;
}): {
  items: AccountItemSummary[];
  sources: VaultRecommendationSourceFilterState[];
} {
  const sourceIds = input.sourceIds.length
    ? input.sourceIds
    : input.selections.map((selection) => selection.sourceId);
  if (!sourceIds.length) return { items: [...input.contextualItems], sources: [] };
  const sourceStates: VaultRecommendationSourceFilterState[] = sourceIds.map((sourceId) => {
    const selection = input.selections.find((item) => item.sourceId === sourceId) ?? { sourceId, primaryFilter: "all", completeFilter: "all" };
    const isDim = canonicalVaultRecommendationSourceId(sourceId) === "dim_wishlist";
    const candidates = input.contextualItems.filter((item) => input.selections.every((other) => (
      other.sourceId === sourceId || matchesSourceSelection(item, other, input)
    )));
    const primaryCounts = new Map<Exclude<VaultRecommendationPrimaryFilter, "all">, number>();
    const completeCounts = new Map<VaultRecommendationMetricKey, number>();
    const metricKeys = new Set<VaultRecommendationMetricKey>();
    const completeKeys = new Set<VaultRecommendationMetricKey>();
    for (const item of candidates) {
      const fact = getSourceFact(item, sourceId, input);
      if (!fact) continue;
      primaryCounts.set(fact.primaryKey, (primaryCounts.get(fact.primaryKey) ?? 0) + 1);
      if (isVaultRecommendationMetricKey(fact.primaryKey)) metricKeys.add(fact.primaryKey);
      if (!isDim && fact.completeKey) completeKeys.add(fact.completeKey);
    }
    const primaryOptions: Array<VaultRecommendationFilterOption<VaultRecommendationPrimaryFilter>> = [
      { key: "all", label: "全部", count: candidates.filter((item) => hasSourceRecord(item, sourceId, input.factIndex)).length },
      ...[...metricKeys].sort(compareVaultRecommendationMetricKeys).map((key) => ({ key, label: key, count: primaryCounts.get(key) ?? 0 })),
      ...(["unrequired", "uncheckable", "uncovered"] as const).map((key) => ({ key, label: vaultRecommendationPrimaryFilterLabel(key, isDim), count: primaryCounts.get(key) ?? 0 }))
    ];
    const completeBase = candidates.filter((item) => {
      const fact = getSourceFact(item, sourceId, input);
      return selection.primaryFilter === "all"
        ? hasSourceRecord(item, sourceId, input.factIndex)
        : Boolean(fact && fact.primaryKey === selection.primaryFilter);
    });
    for (const item of completeBase) {
      const completeKey = getSourceFact(item, sourceId, input)?.completeKey;
      if (completeKey) completeCounts.set(completeKey, (completeCounts.get(completeKey) ?? 0) + 1);
    }
    return {
      sourceId,
      isDim,
      primaryOptions,
      completeOptions: [
        { key: "all", label: "不限", count: completeBase.length },
        ...[...completeKeys].sort(compareVaultRecommendationMetricKeys).map((key) => ({ key, label: key, count: completeCounts.get(key) ?? 0 }))
      ]
    };
  });
  const items = input.contextualItems.filter((item) => input.selections.every((selection) => matchesSourceSelection(item, selection, input)));
  return { items, sources: sourceStates };
}

function getSourceFact(item: AccountItemSummary, sourceId: string, input: {
  factIndex: VaultRecommendationFilterFactIndex;
  recommendationCardSummary?: ReadonlyMap<string, RecommendationCardSummary>;
  recommendationScanComplete: boolean;
}): VaultRecommendationFilterFact | undefined {
  const fact = getVaultRecommendationFilterFact(input.factIndex, getVaultCommunityInstanceKey(item), sourceId);
  if (fact) return fact;
  if (input.recommendationScanComplete || input.recommendationCardSummary?.has(getVaultCommunityInstanceKey(item))) {
    return { kind: canonicalVaultRecommendationSourceId(sourceId) === "dim_wishlist" ? "dim" : "curated", primaryKey: "uncovered" };
  }
  return undefined;
}

function hasSourceRecord(item: AccountItemSummary, sourceId: string, factIndex: VaultRecommendationFilterFactIndex): boolean {
  return Boolean(getVaultRecommendationFilterFact(factIndex, getVaultCommunityInstanceKey(item), sourceId));
}

function matchesSourceSelection(item: AccountItemSummary, selection: VaultRecommendationSourceSelection, input: {
  factIndex: VaultRecommendationFilterFactIndex;
  recommendationCardSummary?: ReadonlyMap<string, RecommendationCardSummary>;
  recommendationScanComplete: boolean;
}): boolean {
  const fact = getSourceFact(item, selection.sourceId, input);
  if (!fact) return false;
  return (selection.primaryFilter === "all"
    ? hasSourceRecord(item, selection.sourceId, input.factIndex)
    : fact.primaryKey === selection.primaryFilter)
    && (selection.completeFilter === "all" || fact.completeKey === selection.completeFilter);
}

function buildVaultRecommendationAllowedItemKeys(input: {
  catalogItems: readonly AccountItemSummary[];
  factIndex: VaultRecommendationFilterFactIndex;
  selections: readonly VaultRecommendationSourceSelection[];
  recommendationCardSummary?: ReadonlyMap<string, RecommendationCardSummary>;
  recommendationScanComplete: boolean;
}): ReadonlySet<string> | undefined {
  if (!input.selections.length) {
    return undefined;
  }
  const allowed = new Set<string>();
  for (const item of input.catalogItems) {
    if (input.selections.every((selection) => matchesSourceSelection(item, selection, input))) {
      allowed.add(getVaultSelectionItemKey(item));
    }
  }
  return allowed;
}

function isVaultRecommendationMetricKey(
  value: Exclude<VaultRecommendationPrimaryFilter, "all">
): value is VaultRecommendationMetricKey {
  return value.includes("/");
}

function useStableVaultCatalogItems(items: AccountItemSummary[]): AccountItemSummary[] {
  const cachedRef = useRef<{ signatures: string[]; items: AccountItemSummary[] }>({
    signatures: [],
    items: []
  });
  return useMemo(() => {
    const signatures = items.map(vaultCatalogItemSignature).sort();
    if (sameStringList(cachedRef.current.signatures, signatures)) {
      return cachedRef.current.items;
    }
    cachedRef.current = { signatures, items };
    return items;
  }, [items]);
}

function vaultCatalogItemSignature(item: AccountItemSummary): string {
  return [
    getVaultSelectionItemKey(item),
    item.hash,
    item.group_key,
    item.item_type ?? "",
    item.class_type ?? "",
    item.ammo_type ?? "",
    item.equipment_bucket_hash ?? "",
    item.armor_set?.hash ?? "",
    item.weapon_frame?.key ?? ""
  ].join(":");
}

function sameStringList(previous: readonly string[], next: readonly string[]): boolean {
  return previous.length === next.length
    && previous.every((value, index) => value === next[index]);
}

function formatVaultRecommendationMetricOptionLabel(
  key: VaultRecommendationPrimaryFilter,
  isDim = false
): string {
  if (key === "all") return "全部";
  if (!isVaultRecommendationMetricKey(key)) return vaultRecommendationPrimaryFilterLabel(key, isDim);
  const [matched, required] = key.split("/").map(Number);
  if (matched === required) return `全中 ${key}`;
  if (matched === 0) return `未命中 ${key}`;
  return `命中 ${key}`;
}

function buildActiveFilterLabels(input: {
  group: VaultGroupFilter;
  query: string;
  sortKey: VaultSortKey;
  slotFilter: VaultSlotFilter;
  locationFilter: VaultLocationFilter;
  itemTypeFilter: string;
  rarityFilter: VaultRarityFilter;
  gearTierFilter: VaultGearTierFilter;
  ammoFilter: VaultAmmoFilter;
  damageFilter: VaultDamageFilter;
  craftingFilter: VaultCraftingFilter;
  classFilter: VaultClassFilter;
  armorSetFilter: VaultArmorSetFilter;
  armorSetLabel?: string;
  lockFilter: VaultLockFilter;
  tagFilter: VaultTagFilter;
  recommendationSelectionLabels: readonly string[];
  frameFilterCount: number;
  armorRuleCount: number;
}): string[] {
  return [
    input.query.trim() ? `搜索：${input.query.trim()}` : "",
    input.sortKey !== "name" ? sortLabels[input.sortKey] : "",
    input.slotFilter !== "all" ? `槽位：${input.slotFilter}` : "",
    input.locationFilter !== (input.group === "weapons" ? "vault" : "all")
      ? `所在位置：${locationFilterLabels[input.locationFilter]}`
      : "",
    input.itemTypeFilter !== "all" ? `类型：${input.itemTypeFilter}` : "",
    input.rarityFilter !== "all" ? `稀有度：${rarityFilterLabels[input.rarityFilter]}` : "",
    input.gearTierFilter !== "all" ? `阶级：${gearTierFilterLabels[input.gearTierFilter]}` : "",
    input.ammoFilter !== "all" ? `弹药：${ammoFilterLabels[input.ammoFilter]}` : "",
    input.damageFilter !== "all" ? `属性：${damageFilterLabels[input.damageFilter]}` : "",
    input.craftingFilter !== "all" ? `锻造状态：${craftingFilterLabels[input.craftingFilter]}` : "",
    input.classFilter !== "all" ? `职业：${classFilterLabels[input.classFilter]}` : "",
    input.armorSetFilter !== "all" ? `护甲套装：${input.armorSetLabel ?? input.armorSetFilter}` : "",
    input.lockFilter !== "all" ? lockFilterLabels[input.lockFilter] : "",
    input.tagFilter !== "all" ? `整理状态：${input.tagFilter === "untagged" ? input.group === "weapons" ? "未整理" : "未标记" : tagLabels[input.tagFilter]}` : "",
    ...input.recommendationSelectionLabels,
    input.frameFilterCount ? `武器框架：${input.frameFilterCount} 项` : "",
    input.armorRuleCount ? `护甲属性：${input.armorRuleCount} 条` : ""
  ].filter(Boolean);
}

function sameManagedRecommendationSources(
  left: readonly VaultRecommendationManagedSource[],
  right: readonly VaultRecommendationManagedSource[]
): boolean {
  return left.length === right.length && left.every((source, index) => {
    const candidate = right[index];
    return candidate?.source_key === source.source_key
      && candidate.label === source.label
      && candidate.kind === source.kind
      && candidate.state === source.state
      && candidate.configured === source.configured
      && candidate.rule_count === source.rule_count
      && candidate.weapon_count === source.weapon_count
      && candidate.revision === source.revision
      && candidate.imported_at === source.imported_at
      && candidate.affected_instance_count === source.affected_instance_count;
  });
}

function getQuickActionCharacterId(item: AccountItemSummary, currentCharacterId?: string): string {
  const locatedItem = item as AccountItemSummary & { source_character_id?: string };
  return getItemSourceKind(item) === "vault"
    ? currentCharacterId ?? ""
    : locatedItem.source_character_id ?? currentCharacterId ?? "";
}

function getItemSourceKind(item: AccountItemSummary): "equipped" | "inventory" | "vault" | "postmaster" {
  if ("source_kind" in item) {
    const sourceKind = item.source_kind;
    if (sourceKind === "equipped" || sourceKind === "inventory" || sourceKind === "postmaster") {
      return sourceKind;
    }
  }
  return "vault";
}
