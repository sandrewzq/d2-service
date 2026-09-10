import type { ItemSearchResult, LibraryWeeklyFarmingItemView } from "@d2-tools/app/library";
import type { AccountItemSummary } from "../../api/types";
import { LibraryPage } from "../../features/library/LibraryPage";
import { useAccountSummaryStore } from "../../shared/stores/accountEntityStore";
import { useDesktopMenuSession } from "./DesktopMenuProviderContext";

export function LibraryMenuProvider() {
  const session = useDesktopMenuSession();
  const library = session.library;
  const accountSummary = useAccountSummaryStore();
  const itemDetail = session.itemDetail;

  return (
    <LibraryPage
      cache={{
        items: library.items,
        perks: library.perks,
        perkRelatedEquipment: library.perkRelatedEquipment,
        libraryHistory: library.libraryHistory,
        libraryCommunityMatch: library.libraryCommunityMatch,
        liveAvailability: library.liveAvailability,
        liveAvailabilityError: library.liveAvailabilityError,
        manifestStatus: library.manifestStatus,
        manifestStatusError: library.manifestStatusError,
        accountSummary,
        weeklyFarmingCatalog: library.weeklyFarmingCatalog,
        weeklyFarmingCommunityMatch: library.weeklyFarmingCommunityMatch,
        weeklyFarmingInstanceMatches: session.account.vaultRecommendationCardSummary,
        weeklyFarmingInstanceRecommendationReady: session.account.vaultRecommendationScan.phase === "complete",
        weeklyFarmingError: library.weeklyFarmingError,
        weeklyFarmingRecommendationError: library.weeklyFarmingRecommendationError,
        isLoadingWeeklyFarming: library.isLoadingWeeklyFarming,
        isRefreshingWeeklyRotation: session.daily.isLoadingDaily,
        weeklyRotationError: session.daily.dailyError
      }}
      state={{
        libraryViewMode: library.libraryViewMode,
        equipmentFilters: library.equipmentFilters,
        perkFilters: library.perkFilters,
        equipmentSearchTouched: library.equipmentSearchTouched,
        perkSearchTouched: library.perkSearchTouched,
        isSearching: library.isSearching,
        searchError: library.searchError,
        aliasDraft: library.aliasDraft,
        aliasTargetDraft: library.aliasTargetDraft,
        aliasKind: library.aliasKind,
        aliasMessage: library.aliasMessage,
        aliasError: library.aliasError,
        favoriteError: library.favoriteError,
        isLoadingLiveAvailability: library.isLoadingLiveAvailability,
        isLoadingManifestStatus: library.isLoadingManifestStatus,
        isInitializingManifest: library.isInitializingManifest,
        manifestTask: library.manifestTask,
        itemDetailLoadingKey: ""
      }}
      actions={{
        onViewModeChange: library.setLibraryViewMode,
        onEquipmentFiltersChange: (patch) => library.setEquipmentFilters((current) => ({ ...current, ...patch })),
        onPerkFiltersChange: (patch) => library.setPerkFilters((current) => ({ ...current, ...patch })),
        onSearch: () => void library.searchItems(),
        onSelectRecentQuery: library.selectRecentEquipmentQuery,
        onClearFilters: library.clearLibraryFilters,
        onRefreshManifestStatus: () => void library.refreshManifestStatus(),
        onInitializeManifest: () => void library.initializeManifest(),
        onRepairManifest: () => void library.repairManifest(),
        onAliasDraftChange: library.setAliasDraft,
        onAliasTargetDraftChange: library.setAliasTargetDraft,
        onAliasKindChange: library.setAliasKind,
        onSaveAlias: () => void library.saveAlias(),
        onOpenItemDetail: (item) => void itemDetail.openItemDetail(item),
        onLoadPerkRelatedEquipment: (perk, loadMore) => void library.loadPerkRelatedEquipment(perk, loadMore),
        onOpenRelatedItem: (item) => void itemDetail.openItemDetail(item),
        onRefreshWeeklyRotation: () => void session.daily.loadDailySummary(true),
        onRefreshWeeklyFarming: () => void library.loadWeeklyFarming(true),
        onOpenWeeklyFarmingItem: (row) => void itemDetail.openItemDetail(
          findWeeklyFarmingAccountItem(accountSummary, row)
            ?? toWeeklyFarmingDefinitionItem(row)
        ),
        onAddFavorite: (item) => void library.addSelectedItemToFavorites(item),
        onRemoveFavorite: (hash) => void library.removeFavorite(hash),
        onLocateOwnedItem: session.locateVaultItem
      }}
    />
  );
}

function findWeeklyFarmingAccountItem(
  accountSummary: ReturnType<typeof useAccountSummaryStore>,
  row: LibraryWeeklyFarmingItemView
): AccountItemSummary | undefined {
  if (!accountSummary) return undefined;
  const items = [
    ...accountSummary.vault.items,
    ...accountSummary.characters.flatMap((character) => [
      ...character.equipped_items,
      ...character.inventory_items,
      ...character.postmaster_items
    ])
  ];
  if (row.bestInstance?.instanceId) {
    const best = items.find((item) => item.instance_id === row.bestInstance?.instanceId);
    if (best) return best;
  }
  return items.find((item) => item.hash === row.item.hash);
}

function toWeeklyFarmingDefinitionItem(row: LibraryWeeklyFarmingItemView): ItemSearchResult {
  return {
    hash: row.item.hash,
    name: row.item.name,
    description: "",
    ...(row.item.icon ? { icon: row.item.icon } : {}),
    ...(row.item.item_type ? { item_type: row.item.item_type } : {}),
    group_key: "weapons",
    source: {
      status: "ready",
      label: "本周活动来源",
      description: row.item.source_label,
      source_hash: row.item.source_hash
    }
  };
}
