export type {
  ItemDefinitionDetailLike,
  ItemSearchResultLike,
  SameNameItemSummary,
  SelectedItemDetail,
  SelectedItemSource,
  SelectedItemSourceKind
} from "./workspaces/itemDetail.js";
export {
  buildWishlistInsightText,
  collectSelectedSameNameItems,
  createSelectedItemPreview,
  formatVaultTagLabel as formatItemDetailVaultTagLabel,
  getItemKey,
  mergeSelectedItemDetail,
  selectBestSameNameItem,
  selectedItemToAccountItem,
  sortSameNameItems
} from "./workspaces/itemDetail.js";
export type {
  ArmorAbility,
  ArmorDetailEntryKind,
  ArmorDetailIdentity,
  ArmorDetailInstance,
  ArmorDetailInstanceLike,
  ArmorDetailObjectContext,
  ArmorDetailObjectKind,
  ArmorDetailSelectedItemLike,
  ArmorDetailSources,
  ArmorDetailViewModel,
  ArmorRecommendation,
  ArmorSocket,
  ArmorSourceEntry,
  ArmorStatTrack,
  BuildArmorDetailViewModelInput
} from "./workspaces/armorDetail.js";
export { buildArmorDetailViewModel } from "./workspaces/armorDetail.js";
export type {
  BuildWeaponDetailViewModelInput,
  WeaponCatalystSummary,
  WeaponConfigurationClassification,
  WeaponConfigurationKind,
  WeaponDetailAmmo,
  WeaponDetailChampionEffect,
  WeaponDetailConfiguration,
  WeaponDetailDamage,
  WeaponEnhancementSummary,
  WeaponDetailIdentity,
  WeaponDetailInstance,
  WeaponDetailInstanceLike,
  WeaponDetailInstanceMetadata,
  WeaponDetailLoadoutReference,
  WeaponDetailObjectContext,
  WeaponDetailSources,
  WeaponDetailUpgrades,
  WeaponDetailViewModel,
  WeaponPerkCandidate,
  WeaponPerkColumnRole,
  WeaponPerkPoolColumn,
  WeaponPerkPoolKind,
  WeaponPerkSelectionColumn,
  WeaponSocketPlugLike,
  WeaponRecommendation,
  WeaponRecommendationMatch,
  WeaponRecommendationPerkCandidate,
  WeaponSourceEntry,
  WeaponStatTrack,
  WeaponVendorOfferSummary
} from "./workspaces/weaponDetail.js";
export {
  buildWeaponDetailViewModel,
  buildWeaponStatTracks,
  classifyWeaponConfiguration,
  classifyWeaponSocketPlugs,
  isEnhancedWeaponPerk,
  isWeaponSystemPlug,
  perkGroupsToPoolColumns,
  weaponSocketColumnLabel
} from "./workspaces/weaponDetail.js";
