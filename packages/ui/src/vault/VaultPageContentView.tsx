import { memo, useDeferredValue, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { AccountItemSummary } from "@d2-tools/core/account/summary";
import type { ArmorSetCatalogItem } from "@d2-tools/core/items/equipableItemSet";
import type { DimWishlist } from "@d2-tools/core/analysis/wishlistImport";
import type { LocalTargetRules } from "@d2-tools/core/analysis/targets";
import type { EquipmentTargetStore } from "@d2-tools/core/targets/equipmentTargets";
import type { VaultItemInstanceMatchInfo } from "@d2-tools/core/community-perks";
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
  buildVaultRecommendationSourceOptions,
  buildVaultRecommendationSummaryIndex,
  canonicalVaultRecommendationSourceId,
  getVaultCommunityInstanceKey,
  inferVaultRecommendationResultForSource,
  vaultSourceRecommendationResultLabel,
  type VaultRecommendationResult,
  type VaultRecommendationSummaryIndex
} from "./vaultRecommendationMatch.js";
import { buildVaultCleanupProtectionIndex } from "./vaultCleanupProtection.js";

type VaultWorkspaceTab = "filters" | "duplicates" | "recommendations";
type VaultRecommendationView = "weapons" | "targets";
type VaultRecommendationFilter = VaultRecommendationResult | "all";
type VaultQuickAction = "lock" | "transfer";
type VaultAccountResourceStatus = "unavailable" | "cached" | "stale" | "loading" | "refreshing" | "ready" | "error";

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
const vaultRecommendationFilters: Array<{ key: VaultRecommendationFilter; label: string }> = [
  { key: "all", label: "全部" },
  { key: "matched", label: "符合推荐" },
  { key: "partial", label: "部分符合" },
  { key: "not_matched", label: "未符合" },
  { key: "uncheckable", label: "无法判断" },
  { key: "uncovered", label: "未收录" }
];
const emptyVaultRecommendationResultIndex: ReadonlyMap<string, VaultRecommendationResult> = new Map();

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
  communityInstanceMatch?: Map<string, VaultItemInstanceMatchInfo>;
  recommendationSourceState?: VaultRecommendationSourceState;
  wishlistActions?: VaultWishlistActions;
  onCopyRecommendationAudit?: () => void | Promise<void>;
  targetRulesActions?: VaultTargetRulesActions;
  onContextFactsChange?: (facts: string[]) => void;
  onLoadItemDetail?: (item: AccountItemSummary) => Promise<AccountItemSummary>;
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
  const [recommendationSourceFilter, setRecommendationSourceFilter] = useState("");
  const [recommendationFilter, setRecommendationFilter] = useState<VaultRecommendationFilter>("all");
  const [lockFilter, setLockFilter] = useState<VaultLockFilter>("all");
  const [slotFilter, setSlotFilter] = useState<VaultSlotFilter>("all");
  const [locationFilter, setLocationFilter] = useState<VaultLocationFilter>("vault");
  const [ammoFilter, setAmmoFilter] = useState<VaultAmmoFilter>("all");
  const [itemTypeFilter, setItemTypeFilter] = useState("all");
  const [rarityFilter, setRarityFilter] = useState<VaultRarityFilter>("all");
  const [gearTierFilter, setGearTierFilter] = useState<VaultGearTierFilter>("all");
  const [classFilter, setClassFilter] = useState<VaultClassFilter>("all");
  const [damageFilter, setDamageFilter] = useState<VaultDamageFilter>("all");
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
  const [activeQuickAction, setActiveQuickAction] = useState<{ itemKey: string; action: VaultQuickAction } | null>(null);
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
  const recommendationSummaryByInstance = useMemo(
    () => buildVaultRecommendationSummaryIndex(
      props.items,
      props.communityInstanceMatch,
      props.wishlist
    ),
    [props.communityInstanceMatch, props.items, props.wishlist]
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

  const filteredVaultItems = useMemo(
    () => sortVaultItems(
      filterVaultItems(props.items, {
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
        armorSet: armorSetFilter,
        armorStatRules,
        frames: frameFilters,
        tags: props.tags,
        wishlist: props.wishlist,
        localTargetRules: props.localTargetRules
      }),
      sortKey,
      props.tags
    ),
    [ammoFilter, armorSetFilter, armorStatRules, classFilter, damageFilter, deferredQuery, frameFilters, gearTierFilter, group, itemTypeFilter, locationFilter, lockFilter, props.currentCharacterId, props.items, props.localTargetRules, props.tags, props.wishlist, rarityFilter, slotFilter, sortKey, tagFilter]
  );
  const availableRecommendationSources = useMemo(() => buildVaultRecommendationSourceOptions(
    props.items.filter((item) => item.group_key === "weapons").map((item) => (
      recommendationSummaryByInstance.get(getVaultCommunityInstanceKey(item)) ?? []
    )),
    managedRecommendationSources
  ), [managedRecommendationSources, props.items, recommendationSummaryByInstance]);
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
  const selectedRecommendationSource = recommendationSourceOptions.find((option) => (
    option.sourceId === recommendationSourceFilter
  ));
  const selectedRecommendationSourceLabel = selectedRecommendationSource?.sourceLabel;

  useEffect(() => {
    if (!recommendationSourceFilter) return;
    if (availableRecommendationSources.some((option) => option.sourceId === recommendationSourceFilter)) return;
    setRecommendationSourceFilter("");
    setRecommendationFilter("all");
  }, [availableRecommendationSources, recommendationSourceFilter]);

  const recommendationResultByItemKey = useMemo(() => {
    const index = new Map<string, VaultRecommendationResult>();
    if (!recommendationSourceFilter) return emptyVaultRecommendationResultIndex;
    for (const item of props.items) {
      if (item.group_key !== "weapons") continue;
      const result = resolveVaultRecommendationResultForSource(
        item,
        recommendationSummaryByInstance,
        recommendationSourceFilter,
        props.communityInstanceMatch,
        props.recommendationSourceState?.recommendationScan.phase === "complete"
      );
      if (result) index.set(getVaultSelectionItemKey(item), result);
    }
    return index;
  }, [props.communityInstanceMatch, props.items, props.recommendationSourceState?.recommendationScan.phase, recommendationSourceFilter, recommendationSummaryByInstance]);
  const recommendationFilterOptions = useMemo(() => {
    const counts: Record<VaultRecommendationResult, number> = {
      matched: 0,
      partial: 0,
      not_matched: 0,
      uncheckable: 0,
      uncovered: 0
    };
    for (const item of filteredVaultItems) {
      const result = recommendationResultByItemKey.get(getVaultSelectionItemKey(item));
      if (result) counts[result] += 1;
    }
    return vaultRecommendationFilters.map((option) => ({
      ...option,
      count: option.key === "all" ? filteredVaultItems.length : counts[option.key]
    }));
  }, [filteredVaultItems, recommendationResultByItemKey]);
  const filteredItems = useMemo(
    () => !recommendationSourceFilter || recommendationFilter === "all"
      ? filteredVaultItems
      : filteredVaultItems.filter((item) => (
        recommendationResultByItemKey.get(getVaultSelectionItemKey(item)) === recommendationFilter
      )),
    [filteredVaultItems, recommendationFilter, recommendationResultByItemKey, recommendationSourceFilter]
  );
  const activeRecommendationResultFilterIndex = recommendationSourceFilter && recommendationFilter !== "all"
    ? recommendationResultByItemKey
    : undefined;
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
  const cleanupActionItems = useMemo(
    () => (selectedItems.length
      ? selectMarkedCleanupItems(selectedItems, props.tags)
      : selectMarkedCleanupItems(props.items, props.tags))
      .filter((item) => getItemSourceKind(item) === "vault"),
    [props.items, props.tags, selectedItems]
  );
  const cleanupProtectionByItemKey = useMemo(() => buildVaultCleanupProtectionIndex({
    items: props.items,
    tags: props.tags,
    highlightedItemKeys: props.cleanupProtectedItemKeys ?? props.highlightedItemKeys,
    communityInstanceMatch: props.communityInstanceMatch,
    recommendationReady: props.recommendationSourceState?.recommendationScan.phase === "complete"
  }), [props.cleanupProtectedItemKeys, props.communityInstanceMatch, props.highlightedItemKeys, props.items, props.recommendationSourceState?.recommendationScan.phase, props.tags]);
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
  const groups = useMemo(() => buildVaultGroups(props.items), [props.items]);
  const slotFilters = useMemo(() => {
    const candidates = filterVaultItems(props.items, {
      group,
      query: deferredQuery,
      tag: tagFilter,
      lock: lockFilter,
      slot: "all",
      location: locationFilter,
      currentCharacterId: props.currentCharacterId,
      ammo: ammoFilter,
      itemType: itemTypeFilter,
      rarity: rarityFilter,
      gearTier: gearTierFilter,
      classType: classFilter,
      damageType: damageFilter,
      armorSet: armorSetFilter,
      armorStatRules,
      frames: frameFilters,
      tags: props.tags,
      wishlist: props.wishlist,
      localTargetRules: props.localTargetRules
    }).filter((item) => matchesVaultRecommendationResultFilter(
        item,
        activeRecommendationResultFilterIndex,
        recommendationFilter
      ));
    return buildVaultSlotFilters(candidates);
  }, [activeRecommendationResultFilterIndex, ammoFilter, armorSetFilter, armorStatRules, classFilter, damageFilter, deferredQuery, frameFilters, gearTierFilter, group, itemTypeFilter, locationFilter, lockFilter, props.currentCharacterId, props.items, props.localTargetRules, props.tags, props.wishlist, rarityFilter, recommendationFilter, tagFilter]);
  const locationFilters = useMemo(() => {
    const candidates = filterVaultItems(props.items, {
      group: "weapons",
      query: deferredQuery,
      tag: tagFilter,
      lock: lockFilter,
      slot: slotFilter,
      location: "all",
      currentCharacterId: props.currentCharacterId,
      ammo: ammoFilter,
      itemType: itemTypeFilter,
      rarity: rarityFilter,
      gearTier: gearTierFilter,
      classType: classFilter,
      damageType: damageFilter,
      armorSet: armorSetFilter,
      armorStatRules,
      frames: frameFilters,
      tags: props.tags,
      wishlist: props.wishlist,
      localTargetRules: props.localTargetRules
    }).filter((item) => matchesVaultRecommendationResultFilter(
        item,
        activeRecommendationResultFilterIndex,
        recommendationFilter
      ));
    return buildVaultLocationFilters(candidates, props.currentCharacterId);
  }, [activeRecommendationResultFilterIndex, ammoFilter, armorSetFilter, armorStatRules, classFilter, damageFilter, deferredQuery, frameFilters, gearTierFilter, itemTypeFilter, lockFilter, props.currentCharacterId, props.items, props.localTargetRules, props.tags, props.wishlist, rarityFilter, recommendationFilter, slotFilter, tagFilter]);
  const availableFrameFilters = useMemo(() => {
    const candidates = filterVaultItems(props.items, {
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
      armorSet: armorSetFilter,
      armorStatRules,
      frames: [],
      tags: props.tags,
      wishlist: props.wishlist,
      localTargetRules: props.localTargetRules
    }).filter((item) => matchesVaultRecommendationResultFilter(
        item,
        activeRecommendationResultFilterIndex,
        recommendationFilter
      ));
    return buildVaultFrameFilters(candidates);
  }, [activeRecommendationResultFilterIndex, ammoFilter, armorSetFilter, armorStatRules, classFilter, damageFilter, deferredQuery, gearTierFilter, group, itemTypeFilter, locationFilter, lockFilter, props.currentCharacterId, props.items, props.localTargetRules, props.tags, props.wishlist, rarityFilter, recommendationFilter, slotFilter, tagFilter]);
  const armorSetFilters = useMemo(
    () => buildVaultArmorSetFilters(props.armorSetCatalog, props.items),
    [props.armorSetCatalog, props.items]
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
    const candidates = filterVaultItems(props.items, {
      group: "weapons",
      query: deferredQuery,
      tag: tagFilter,
      lock: lockFilter,
      slot: slotFilter,
      location: locationFilter,
      currentCharacterId: props.currentCharacterId,
      ammo: ammoFilter,
      itemType: "all",
      rarity: rarityFilter,
      gearTier: gearTierFilter,
      classType: classFilter,
      damageType: damageFilter,
      armorSet: armorSetFilter,
      armorStatRules,
      frames: frameFilters,
      tags: props.tags,
      wishlist: props.wishlist,
      localTargetRules: props.localTargetRules
    }).filter((item) => matchesVaultRecommendationResultFilter(
        item,
        activeRecommendationResultFilterIndex,
        recommendationFilter
      ));
    candidates.filter((item) => item.item_type).forEach((item) => {
      const itemType = item.item_type ?? "";
      counts.set(itemType, (counts.get(itemType) ?? 0) + 1);
    });
    return [...counts.entries()]
      .map(([key, count]) => ({ key, label: key, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "zh-Hans-CN"));
  }, [activeRecommendationResultFilterIndex, ammoFilter, armorSetFilter, armorStatRules, classFilter, damageFilter, deferredQuery, frameFilters, gearTierFilter, locationFilter, lockFilter, props.currentCharacterId, props.items, props.localTargetRules, props.tags, props.wishlist, rarityFilter, recommendationFilter, slotFilter, tagFilter]);
  const duplicateSummary = useMemo(
    () => hasVisitedDuplicateTab ? buildVaultDuplicateSummary(props.items, props.tags) : emptyDuplicateSummary,
    [hasVisitedDuplicateTab, props.items, props.tags]
  );
  const duplicateGroupKeyByItemKey = useMemo(() => new Map(
    duplicateSummary.groups.flatMap((duplicateGroup) => duplicateGroup.items.map((entry) => [entry.item_key, duplicateGroup.group_key] as const))
  ), [duplicateSummary]);
  const pendingDuplicateGroupCount = useMemo(
    () => duplicateSummary.groups.filter((duplicateGroup) => duplicateGroup.items.some((item) => item.tag !== "keep" && item.tag !== "review" && item.tag !== "junk")).length,
    [duplicateSummary]
  );
  const completedDuplicateGroupCount = duplicateSummary.total_duplicate_groups - pendingDuplicateGroupCount;
  const vaultItemCount = props.vaultItemCount ?? props.items.length;
  const accountWeaponCount = useMemo(
    () => props.items.filter((item) => item.group_key === "weapons").length,
    [props.items]
  );
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
    classFilter,
    armorSetFilter,
    armorSetLabel,
    lockFilter,
    tagFilter,
    recommendationSourceLabel: selectedRecommendationSource?.sourceLabel,
    recommendationFilter,
    frameFilterCount: frameFilters.length,
    armorRuleCount: armorStatRules.length
  }), [ammoFilter, armorSetFilter, armorSetLabel, armorStatRules.length, classFilter, damageFilter, frameFilters.length, gearTierFilter, group, itemTypeFilter, locationFilter, lockFilter, query, rarityFilter, recommendationFilter, selectedRecommendationSource?.sourceLabel, slotFilter, sortKey, tagFilter]);
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
    armorSetFilter,
    armorSetLabel,
    frameFilters,
    armorStatRules,
    filteredCount: filteredVaultItems.length,
    totalCount: props.items.length
  }), [ammoFilter, armorSetFilter, armorSetLabel, armorStatRules, classFilter, damageFilter, filteredVaultItems.length, frameFilters, gearTierFilter, group, itemTypeFilter, locationFilter, lockFilter, props.items.length, query, rarityFilter, slotFilter, tagFilter]);

  useEffect(() => {
    props.onContextFactsChange?.([
      ...contextFacts,
      ...(selectedRecommendationSourceLabel ? [`推荐来源：${selectedRecommendationSourceLabel}`] : []),
      ...(!selectedRecommendationSourceLabel || recommendationFilter === "all"
        ? []
        : [`该来源结果：${vaultSourceRecommendationResultLabel(recommendationFilter)}`]),
      `当前结果：${filteredItems.length} 件`
    ]);
  }, [contextFacts, filteredItems.length, props.onContextFactsChange, recommendationFilter, selectedRecommendationSourceLabel]);

  function resetFilterState(
    resetQuery = true,
    nextLocation: VaultLocationFilter = group === "weapons" ? "vault" : "all"
  ) {
    if (resetQuery) setQuery("");
    setSortKey("name");
    setTagFilter("all");
    setRecommendationSourceFilter("");
    setRecommendationFilter("all");
    setLockFilter("all");
    setSlotFilter("all");
    setLocationFilter(nextLocation);
    setAmmoFilter("all");
    setItemTypeFilter("all");
    setRarityFilter("all");
    setGearTierFilter("all");
    setClassFilter("all");
    setDamageFilter("all");
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
      setRecommendationSourceFilter("");
      setRecommendationFilter("all");
      setAmmoFilter("all");
      setItemTypeFilter("all");
      setDamageFilter("all");
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
    if (!props.cleanupActions || activeQuickAction) return;
    const itemKey = getVaultSelectionItemKey(item);
    const itemIndex = filteredItems.findIndex((candidate) => getVaultSelectionItemKey(candidate) === itemKey);
    const itemWillLeaveResults = (action === "transfer" && locationFilter === "vault")
      || (action === "lock" && lockFilter === "unlocked");
    const fallbackItem = itemWillLeaveResults
      ? filteredItems[itemIndex + 1] ?? filteredItems[itemIndex - 1]
      : item;
    const targetCharacterId = getQuickActionCharacterId(item, props.cleanupActions.currentCharacterId);
    if (!targetCharacterId) {
      setBatchMessage(`${action === "lock" ? "加锁" : "取出"}失败：当前没有可用角色。`);
      requestQuickActionFocus(itemKey);
      return;
    }

    setActiveQuickAction({ itemKey, action });
    setBatchMessage(action === "lock" ? `正在加锁：${item.name}` : `正在取出到${props.cleanupActions.currentCharacterLabel ?? "当前角色"}：${item.name}`);
    try {
      if (action === "lock") {
        await props.cleanupActions.onLockItem(item, targetCharacterId);
        setBatchMessage(`已加锁：${item.name}`);
      } else {
        const result = await props.cleanupActions.onBatchTransferToCharacter([item], targetCharacterId);
        if (!result.success_count) {
          throw new Error(result.failure_messages?.[0] || result.message || "Bungie 未接受这次取出操作");
        }
        setBatchMessage(`已取出到${props.cleanupActions.currentCharacterLabel ?? "当前角色"}：${item.name}`);
      }
      if (fallbackItem) requestQuickActionFocus(getVaultSelectionItemKey(fallbackItem));
    } catch (error) {
      setBatchMessage(`${action === "lock" ? "加锁" : "取出"}失败：${error instanceof Error ? error.message : "操作未完成"}`);
      requestQuickActionFocus(itemKey);
    } finally {
      setActiveQuickAction(null);
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
          {activeVaultTab === "filters" && group === "weapons" ? (
            <div className="vault-recommendation-filter" aria-label="按推荐来源筛选">
              <span>推荐筛选</span>
              <label>
                <small>1 来源</small>
                <select
                  aria-label="推荐来源"
                  value={recommendationSourceFilter}
                  onChange={(event) => {
                    setRecommendationSourceFilter(event.target.value);
                    setRecommendationFilter("all");
                  }}
                >
                  <option value="">选择来源</option>
                  {recommendationSourceOptions.map((option) => (
                    <option key={option.sourceId} value={option.sourceId}>
                      {option.sourceLabel} · 覆盖 {option.count}
                    </option>
                  ))}
                </select>
              </label>
              {recommendationSourceFilter ? (
                <div role="group" aria-label={`${selectedRecommendationSource?.sourceLabel ?? "当前来源"}匹配结果`}>
                  <small>2 结果</small>
                  <span>
                    {recommendationFilterOptions.map((option) => (
                      <button
                        type="button"
                        key={option.key}
                        disabled={option.count === 0}
                        aria-pressed={recommendationFilter === option.key}
                        onClick={() => setRecommendationFilter(option.key)}
                      >
                        <span>{option.label}</span><small>{option.count}</small>
                      </button>
                    ))}
                  </span>
                </div>
              ) : <small className="vault-recommendation-filter-hint">先选择来源，再按该来源结果筛选</small>}
            </div>
          ) : null}
          <div className="vault-workflow-meta">
            {props.accountResourceStatus ? <span className={`ui-badge ${vaultResourceStatusTone(props.accountResourceStatus)}`} data-ui-kind="status-chip" data-status={props.accountResourceStatus}>{vaultResourceStatusLabel(props.accountResourceStatus)}</span> : null}
            <span className="ui-badge status-neutral" data-ui-kind="status-chip">
              {group === "weapons" ? `账号武器 ${accountWeaponCount} 件` : `仓库已读取 ${vaultItemCount} 件`}
            </span>
            <span className="ui-badge status-pending" data-ui-kind="status-chip">当前结果 {filteredItems.length} 件</span>
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
              onQueryChange={setQuery}
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
              onArmorSetFilterChange={setArmorSetFilter}
              onGroupChange={switchVaultFilterMode}
              onToggleFrameFilter={toggleFrameFilter}
            />
            <section className="vault-results-column vault-browse-results" data-surface="section" data-contract-id="vault.results" data-vault-scroll-pane="filters">
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
                onToggleOrganizing={() => {
                  if (isOrganizing) setSelectedKeys(new Set());
                  setIsOrganizing((current) => !current);
                }}
                onVisibleSelectionChange={selectVisibleItems}
                onClearSelection={() => setSelectedKeys(new Set())}
                onCleanupTargetCharacterChange={setCleanupTargetCharacterId}
                onApplyBatchTag={batchActions.applyBatchTag}
                onRunSelectedBulkLock={runSelectedBulkLock}
                onRunSelectedBulkMove={batchActions.runSelectedBulkMove}
                onRunCleanupAction={batchActions.runCleanupAction}
              />
              <div className="vault-column-head">
                <div><h3>{group === "weapons" ? locationFilterLabels[locationFilter] : "仓库装备矩阵"}</h3><span>{filteredItems.length} 件 · {sortLabels[sortKey]}</span></div>
                <button type="button" data-ui-kind="button" data-control-variant="secondary" disabled={!activeFilterLabels.length} onClick={() => resetFilterState()}>重置筛选</button>
              </div>
              <div className="vault-active-filters" aria-label="已生效筛选条件">
                <strong>已生效条件</strong>
                <div>{activeFilterLabels.length ? activeFilterLabels.map((label) => <span className="ui-badge status-neutral" key={label}>{label}</span>) : <span>当前范围没有附加筛选条件。</span>}</div>
              </div>
              <VaultItemSections
                sections={filteredSections}
                highlightedItemKeys={props.highlightedItemKeys}
                tags={props.tags}
                recommendationSummaryByInstance={recommendationSummaryByInstance}
                preferredRecommendationSourceId={recommendationSourceFilter || undefined}
                isOrganizing={isOrganizing}
                isSearchActive={Boolean(query.trim())}
                selectedKeys={selectedKeys}
                openingItemKey={props.openingItemKey}
                currentCharacterId={props.cleanupActions?.currentCharacterId}
                currentCharacterLabel={props.cleanupActions?.currentCharacterLabel}
                activeQuickAction={activeQuickAction}
                quickActionsDisabled={Boolean(activeQuickAction) || isBatchSaving || batchActions.isBatchSaving}
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
            communityInstanceMatch={props.communityInstanceMatch}
            cleanupProtectionByItemKey={cleanupProtectionByItemKey}
            locateRequest={duplicateLocateRequest}
            openingItemKey={props.openingItemKey}
            isBatchSaving={isBatchSaving}
            recommendationRevision={props.recommendationSourceState?.recommendationScan.recommendation_revision}
            onLoadItemDetail={props.onLoadItemDetail}
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
                communityInstanceMatch={props.communityInstanceMatch}
                recommendationSummaryByInstance={recommendationSummaryByInstance}
                highlightedItemKeys={props.highlightedItemKeys}
                sourceState={props.recommendationSourceState}
                managedSources={managedRecommendationSources}
                sourceOptions={availableRecommendationSources}
                resultByItemKey={recommendationResultByItemKey}
                activeSourceId={recommendationSourceFilter}
                activeFilter={recommendationFilter}
                wishlistActions={props.wishlistActions}
                managementLocked={hasPendingDuplicateChanges}
                canOrganizeItem={(item) => duplicateGroupKeyByItemKey.has(getVaultSelectionItemKey(item))}
                onCopyAuditReport={props.onCopyRecommendationAudit}
                onActiveSourceChange={setRecommendationSourceFilter}
                onActiveFilterChange={setRecommendationFilter}
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
  classFilter: VaultClassFilter;
  armorSetFilter: VaultArmorSetFilter;
  armorSetLabel?: string;
  lockFilter: VaultLockFilter;
  tagFilter: VaultTagFilter;
  recommendationSourceLabel?: string;
  recommendationFilter: VaultRecommendationFilter;
  frameFilterCount: number;
  armorRuleCount: number;
}): string[] {
  return [
    input.query.trim() ? `搜索：${input.query.trim()}` : "",
    input.sortKey !== "name" ? sortLabels[input.sortKey] : "",
    input.slotFilter !== "all" ? `槽位：${input.slotFilter}` : "",
    input.locationFilter !== "all" ? `所在位置：${locationFilterLabels[input.locationFilter]}` : "",
    input.itemTypeFilter !== "all" ? `类型：${input.itemTypeFilter}` : "",
    input.rarityFilter !== "all" ? `稀有度：${rarityFilterLabels[input.rarityFilter]}` : "",
    input.gearTierFilter !== "all" ? `阶级：${gearTierFilterLabels[input.gearTierFilter]}` : "",
    input.ammoFilter !== "all" ? `弹药：${ammoFilterLabels[input.ammoFilter]}` : "",
    input.damageFilter !== "all" ? `属性：${damageFilterLabels[input.damageFilter]}` : "",
    input.classFilter !== "all" ? `职业：${classFilterLabels[input.classFilter]}` : "",
    input.armorSetFilter !== "all" ? `护甲套装：${input.armorSetLabel ?? input.armorSetFilter}` : "",
    input.lockFilter !== "all" ? lockFilterLabels[input.lockFilter] : "",
    input.tagFilter !== "all" ? `整理状态：${input.tagFilter === "untagged" ? input.group === "weapons" ? "未整理" : "未标记" : tagLabels[input.tagFilter]}` : "",
    input.recommendationSourceLabel ? `推荐来源：${input.recommendationSourceLabel}` : "",
    input.recommendationSourceLabel && input.recommendationFilter !== "all"
      ? `该来源结果：${vaultSourceRecommendationResultLabel(input.recommendationFilter)}`
      : "",
    input.frameFilterCount ? `武器框架：${input.frameFilterCount} 项` : "",
    input.armorRuleCount ? `护甲属性：${input.armorRuleCount} 条` : ""
  ].filter(Boolean);
}

function matchesVaultRecommendationResultFilter(
  item: AccountItemSummary,
  resultByItemKey: ReadonlyMap<string, VaultRecommendationResult> | undefined,
  filter: VaultRecommendationFilter
): boolean {
  if (!resultByItemKey || filter === "all") return true;
  return resultByItemKey.get(getVaultSelectionItemKey(item)) === filter;
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

function resolveVaultRecommendationResultForSource(
  item: AccountItemSummary,
  recommendationSummaryByInstance: VaultRecommendationSummaryIndex,
  sourceId: string,
  communityInstanceMatch: ReadonlyMap<string, VaultItemInstanceMatchInfo> | undefined,
  recommendationScanComplete: boolean
): VaultRecommendationResult | undefined {
  if (item.group_key !== "weapons") return undefined;
  const instanceKey = getVaultCommunityInstanceKey(item);
  const summaries = recommendationSummaryByInstance.get(getVaultCommunityInstanceKey(item)) ?? [];
  if (summaries.some((summary) => (
    canonicalVaultRecommendationSourceId(summary.sourceId) === canonicalVaultRecommendationSourceId(sourceId)
  ))) {
    return inferVaultRecommendationResultForSource(summaries, sourceId);
  }
  return recommendationScanComplete || communityInstanceMatch?.has(instanceKey)
    ? "uncovered"
    : undefined;
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
