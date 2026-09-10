import { selectLibraryPageModel, type LibraryPageCache, type LibraryPageState } from "@d2-tools/app/library";
import { LibraryPageContentView, type LibraryPageActions } from "@d2-tools/ui";
import { useMemo } from "react";

export type LibraryPageProps = {
  cache: LibraryPageCache;
  state: LibraryPageState;
  actions: LibraryPageActions;
};

export function LibraryPage(props: LibraryPageProps) {
  const model = useMemo(
    () => selectLibraryPageModel(props.cache, props.state),
    [
      props.cache.items,
      props.cache.perks,
      props.cache.perkRelatedEquipment,
      props.cache.libraryHistory,
      props.cache.libraryCommunityMatch,
      props.cache.liveAvailability,
      props.cache.liveAvailabilityError,
      props.cache.manifestStatus,
      props.cache.manifestStatusError,
      props.cache.accountSummary,
      props.cache.weeklyFarmingCatalog,
      props.cache.weeklyFarmingCommunityMatch,
      props.cache.weeklyFarmingInstanceMatches,
      props.cache.weeklyFarmingInstanceRecommendationReady,
      props.cache.weeklyFarmingError,
      props.cache.weeklyFarmingRecommendationError,
      props.cache.isLoadingWeeklyFarming,
      props.cache.isRefreshingWeeklyRotation,
      props.cache.weeklyRotationError,
      props.state.libraryViewMode,
      props.state.equipmentFilters,
      props.state.perkFilters,
      props.state.equipmentSearchTouched,
      props.state.perkSearchTouched,
      props.state.isSearching,
      props.state.searchError,
      props.state.aliasDraft,
      props.state.aliasTargetDraft,
      props.state.aliasKind,
      props.state.aliasMessage,
      props.state.aliasError,
      props.state.favoriteError,
      props.state.isLoadingLiveAvailability,
      props.state.isLoadingManifestStatus,
      props.state.isInitializingManifest,
      props.state.manifestTask,
      props.state.itemDetailLoadingKey
    ]
  );

  return (
    <LibraryPageContentView
      model={model}
      actions={props.actions}
    />
  );
}
