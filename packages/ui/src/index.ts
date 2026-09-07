export const uiPackageName = "@d2-tools/ui";
export { GameAssetImage } from "./media/GameAssetImage.js";
export type { GameAssetImageProps } from "./media/GameAssetImage.js";
export { gameAssetCacheName } from "./media/assetCache.js";
export type { GameAssetCacheNamespace } from "./media/assetCache.js";
export { GameCombatIcon, gameDamageTypeKey } from "./media/GameCombatIcon.js";
export type {
  GameAmmoTypeKey,
  GameChampionTypeKey,
  GameCombatIconProps,
  GameDamageTypeKey
} from "./media/GameCombatIcon.js";
export { ControlButton } from "./control/ControlButton.js";
export type {
  ControlButtonProps,
  ControlButtonShape,
  ControlButtonSize,
  ControlButtonVariant,
  ControlButtonWidth
} from "./control/ControlButton.js";
export { RefreshControlButton } from "./control/RefreshControlButton.js";
export type { RefreshControlButtonProps } from "./control/RefreshControlButton.js";
export { AccountPageContentView } from "./account/AccountPageContentView.js";
export type { AccountPageContentViewProps } from "./account/AccountPageContentView.js";
export { AiAssistantPanelView } from "./assistant/AiAssistantPanelView.js";
export type {
  AiAssistantContextView,
  AiAssistantHistoryEntryView,
  AiAssistantMessageView,
  AiAssistantPanelViewProps
} from "./assistant/AiAssistantPanelView.js";
export { AppShell } from "./shell/AppShell.js";
export { SystemUpdateProgress, systemUpdateToneForStatus } from "./update/SystemUpdateProgress.js";
export type {
  SystemUpdateProgressProps,
  SystemUpdateProgressVariant,
  SystemUpdateTone
} from "./update/SystemUpdateProgress.js";
export {
  formatCompactDateTime,
  formatFullDateTime,
  formatScheduleDateTime,
  formatStandardDateTime
} from "./time/formatTime.js";
export type { TimeValue } from "./time/formatTime.js";
export { ShellSidebarAccountSummary, ShellSidebarActions } from "./shell/ShellSidebar.js";
export { HomePageContentView } from "./home/HomePageContentView.js";
export type { HomeDailyItem, HomeDailySummary, HomeStartupState, HomePageContentViewProps, HomeWeeklyActivityReward, HomeWeeklySummary } from "./home/HomePageContentView.js";
export { getLocaleCopy, localeCopy } from "./i18n/copy.js";
export {
  defaultProductPreferences,
  getBungieLocaleForInterface,
  getEffectiveBungieLocale,
  getNextInterfaceLocale
} from "./i18n/preferences.js";
export type {
  AccountCopy,
  BungieManifestLocale,
  InterfaceLocale,
  LocaleCopy,
  ProductPreferences,
  SettingsCopy,
  VendorsCopy,
  ShellCopy
} from "./i18n/types.js";
export { getLibraryRandomPerkGroups, getLibraryWeaponPerkColumns, LibraryDefinitionDialog, LibraryPageContentView } from "./library/LibraryPageContentView.js";
export type { LibraryPageActions, LibraryPageContentViewProps } from "./library/LibraryPageContentView.js";
export type {
  LibraryDropAccessKey,
  LibraryEquipmentFilter,
  LibraryPerkFilter,
  LibraryViewMode
} from "./library/libraryFilters.js";
export { LoadoutsPageContentView } from "./loadouts/LoadoutsPageContentView.js";
export type { LoadoutsPageActions } from "./loadouts/LoadoutsPageContentView.js";
export type { LoadoutActionFeedbackState } from "./loadouts/loadoutActionFeedback.js";
export { SharedItemDetailDialog, SharedItemDetailLoading } from "./item-detail/SharedItemDetailDialog.js";
export type {
  SharedItemDetailDialogProps,
  SharedItemDetailView,
  VendorOfferContext
} from "./item-detail/SharedItemDetailDialog.js";
export { DetailInstanceActionPanel } from "./item-detail/DetailInstanceActionPanel.js";
export type {
  DetailInstanceAction,
  DetailInstanceActionPanelProps,
  DetailInstanceTagAction
} from "./item-detail/DetailInstanceActionPanel.js";
export { WeaponDetailContent } from "./item-detail/weapon/WeaponDetailContent.js";
export type {
  WeaponDetailAnalysis,
  WeaponDetailContentActions,
  WeaponConfigurationWriteFeedback,
  WeaponDetailContentProps,
  WeaponDetailSection
} from "./item-detail/weapon/WeaponDetailContent.js";
export { ArmorDetailContent } from "./item-detail/armor/ArmorDetailContent.js";
export type {
  ArmorDetailAnalysis,
  ArmorDetailContentActions,
  ArmorDetailContentProps,
  ArmorDetailSection
} from "./item-detail/armor/ArmorDetailContent.js";
export { ProductShellHost } from "./product/ProductShellHost.js";
export type { ProductShellHostProps } from "./product/types.js";
export {
  ProductWorkspaceCommandBar,
  ProductWorkspaceContentStack,
  ProductWorkspaceEmptyState,
  ProductWorkspaceHeader,
  ProductWorkspacePage,
  ProductWorkspacePanel,
  ProductWorkspaceSideRail,
  ProductWorkspaceSplit
} from "./workspace/ProductWorkspace.js";
export { getLocalizedNavItems, navItems } from "./shell/navigation.js";
export { SettingsPageContentView } from "./settings/SettingsPageContentView.js";
export { StartupGate } from "./startup/StartupGate.js";
export type { StartupGateProps, StartupGateStep } from "./startup/StartupGate.js";
export { SettingsAiConfigPanel } from "./settings/SettingsAiConfigPanel.js";
export type {
  SettingsActionLogResultFilter,
  SettingsActionLogTypeFilter,
  SettingsBungieConfig,
  SettingsBungieConfigInput,
  SettingsLanguagePreferences,
  SettingsPageContentViewProps
} from "./settings/SettingsPageContentView.js";
export type { SettingsAiAdapter } from "./settings/SettingsAiConfigPanel.js";
export { VendorsPageContentView } from "./vendors/VendorsPageContentView.js";
export { getVendorEquipmentKind } from "./vendors/vendorEquipment.js";
export type { VendorEquipmentKind } from "./vendors/vendorEquipment.js";
export type {
  VendorDetailToolbarView,
  VendorOfferContextView,
  VendorServiceView,
  VendorCostView,
  VendorInventoryGroupView,
  VendorInventoryItemView,
  VendorInventorySectionView,
  VendorContentSectionView,
  VendorProgressionView,
  VendorRailSectionView,
  VendorScopeOptionView,
  VendorsPageActions,
  VendorsPageContentViewProps,
  VendorsPageModelView
} from "./vendors/VendorsPageContentView.js";
export { VaultPageContentView } from "./vault/VaultPageContentView.js";
export { VaultArmorFilterPanel } from "./vault/VaultArmorFilterPanel.js";
export { VaultDuplicateGroups } from "./vault/VaultDuplicateGroups.js";
export { VaultFilterToolbar } from "./vault/VaultFilterToolbar.js";
export { VaultItemSections } from "./vault/VaultItemSections.js";
export { MemoizedVaultListItem, VaultListItem, formatVaultItemMeta } from "./vault/VaultListItem.js";
export { VaultOrganizePanel } from "./vault/VaultOrganizePanel.js";
export { VaultRecommendationEvidencePanel } from "./vault/VaultRecommendationEvidencePanel.js";
export type { VaultRecommendationSourceState } from "./vault/VaultRecommendationEvidencePanel.js";
export { buildVaultCleanupProtectionIndex } from "./vault/vaultCleanupProtection.js";
export {
  buildVaultRecommendationSourceSummaries,
  buildVaultRecommendationSummaryIndex,
  getVaultCommunityInstanceKey
} from "./vault/vaultRecommendationMatch.js";
export type {
  VaultRecommendationCompleteFilter,
  VaultRecommendationFilterFact,
  VaultRecommendationFilterFactIndex,
  VaultRecommendationMetricKey,
  VaultRecommendationPrimaryFilter,
  VaultRecommendationSourceSummary,
  VaultRecommendationSummaryIndex
} from "./vault/vaultRecommendationMatch.js";
export { VaultWishlistManager } from "./vault/VaultWishlistManager.js";
export type { VaultWishlistActions } from "./vault/VaultWishlistManager.js";
export { VaultTargetRulesPanel } from "./vault/VaultTargetRulesPanel.js";
export type { VaultTargetRulesActions } from "./vault/VaultTargetRulesPanel.js";
export { useVaultBatchActions } from "./vault/useVaultBatchActions.js";
export type { VaultCleanupActions } from "./vault/useVaultBatchActions.js";
export type {
  AppShellLayoutProps,
  PlatformActions,
  ShellAssistantMode,
  ShellBackgroundTaskItem,
  ShellNavItem,
  ShellPageKey,
  ShellStatusItem
} from "./shell/types.js";
