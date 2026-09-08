import type {
  AmmoTypeKey,
  ArmorSetCatalogEntry,
  DamageTypeSummary,
  EquipmentGroupKey,
  ItemDefinitionStat,
  ItemDefinitionVersionSummary,
  ItemPerkGroup,
  ItemReleaseSummary,
  EquipableItemSetSummary,
  ItemSourceSummary,
  LiveItemAvailability,
  WeaponBreakerTypeSummary,
  WeaponFrameSummary
} from "./sharedTypes";

export type LibraryApi = {
  getLibraryRuntimeCapabilities(): Promise<LibraryRuntimeCapabilities>;
  getItemDetail(hash: number): Promise<ItemDefinitionDetail>;
  getArmorSetCatalog(): Promise<ArmorSetCatalogEntry[]>;
  searchItems(query: string): Promise<ItemSearchResult[]>;
  searchPerks(query: string): Promise<PerkSearchResult[]>;
  getPerkRelatedEquipment(input: PerkRelatedEquipmentQuery): Promise<PerkRelatedEquipmentPage>;
  getLiveItemAvailability(itemHashes: number[]): Promise<LiveItemAvailability>;
  getItemAliases(): Promise<ItemAliases>;
  saveItemAlias(input: ItemAliasEntry): Promise<ItemAliases>;
  getLibraryHistory(): Promise<LibraryHistory>;
  addRecentItem(item: Omit<LibraryHistoryItem, "viewed_at">): Promise<LibraryHistory>;
  addFavoriteItem(item: Omit<LibraryHistoryItem, "viewed_at">): Promise<LibraryHistory>;
  removeFavoriteItem(hash: number): Promise<LibraryHistory>;
};

export type LibraryRuntimeCapabilities = {
  contract_version: 1 | 2;
  supports_perk_families: boolean;
  supports_related_equipment_paging: boolean;
  supports_related_variant_matches: boolean;
};

export type ItemDefinitionDetail = ItemSearchResult & {
};

export type ItemSearchResult = {
  hash: number;
  name: string;
  description: string;
  icon?: string;
  item_type?: string;
  tier?: string;
  class_type?: number;
  release?: ItemReleaseSummary;
  definition_version?: ItemDefinitionVersionSummary;
  armor_set?: EquipableItemSetSummary;
  class_name?: string;
  damage_type?: string;
  damage_type_summary?: DamageTypeSummary;
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
  armor_ability_groups?: Array<{
    key: string;
    name: string;
    category_identifier: string;
    options: Array<{
      hash: number;
      name: string;
      description: string;
      icon?: string;
    }>;
  }>;
  ammo_type?: AmmoTypeKey;
  bucket_hash?: number;
  bucket_name?: string;
  group_key?: EquipmentGroupKey;
  weapon_frame?: WeaponFrameSummary;
  breaker_type?: WeaponBreakerTypeSummary;
  source: ItemSourceSummary;
  definition_stats?: ItemDefinitionStat[];
  perks?: ItemPerkGroup[];
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

export type PerkRelatedEquipmentQuery = {
  perk_hashes: number[];
  offset?: number;
  limit?: number;
};

export type PerkRelatedEquipmentPage = {
  total: number;
  items: Array<{
    item: ItemSearchResult;
    matched_perk_hashes: number[];
    matched_variants: PerkVariantKind[];
  }>;
  offset: number;
  has_more: boolean;
};

export type ItemAliasEntry = {
  alias: string;
  target: string;
  kind: "item" | "perk";
};

export type ItemAliases = {
  entries: ItemAliasEntry[];
};

export type LibraryHistoryItem = {
  hash: number;
  name: string;
  icon?: string;
  viewed_at?: string;
};

export type LibraryHistory = {
  recent: LibraryHistoryItem[];
  favorites: LibraryHistoryItem[];
};
