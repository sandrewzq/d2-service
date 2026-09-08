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
        accountSummary
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
        onAddFavorite: (item) => void library.addSelectedItemToFavorites(item),
        onRemoveFavorite: (hash) => void library.removeFavorite(hash),
        onLocateOwnedItem: session.locateVaultItem
      }}
    />
  );
}
