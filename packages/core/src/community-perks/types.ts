import type { DefinitionComponentData } from "../manifest/definitions.js";
import type {
  AccountWeaponRollPlugSummary,
  AccountWeaponRollSummary
} from "../account/summary.js";

export type RecommendationRequirementSlot =
  | "barrel"
  | "magazine"
  | "masterwork"
  | "perk1"
  | "perk2"
  | "origin";

export type PerkRef = {
  hash: number;
  name: string;
  englishName?: string;
  description?: string;
  icon?: string;
};

export type PerkCombo = {
  rule_stable_id?: string;
  perks: PerkRef[];
  source: "dim_wishlist" | "local_community";
  mode: "pve" | "pvp" | "general";
  note?: string;
  dim_diagnostic?: DimWishlistRuleDiagnostic;
};

export type DimWishlistDiagnosticSlot = RecommendationRequirementSlot | "special" | "unknown";

export type DimWishlistPerkDiagnostic = {
  original_hash: number;
  resolved_hash?: number;
  resolved_hashes?: number[];
  name: string;
  slot_candidates: DimWishlistDiagnosticSlot[];
  status: "exact" | "cross_slot_ambiguous" | "unknown_slot" | "special_socket";
};

export type DimWishlistRuleDiagnostic = {
  status:
    | "exact"
    | "same_slot_multiple_required"
    | "cross_slot_ambiguous"
    | "unknown_slot"
    | "special_socket";
  message: string;
  perks: DimWishlistPerkDiagnostic[];
};

export type WeaponRecommendation = {
  item_hash: number;
  item_name: string;
  combos: PerkCombo[];
  matched_modes: Array<"pve" | "pvp" | "general">;
  individual_perks?: PerkRef[];
  weapon_level_recommendations?: Array<{
    source: "dim_wishlist" | "local_community";
    mode: "pve" | "pvp" | "general";
    source_label: string;
    note?: string;
  }>;
  source_records?: RecommendationSourceRecord[];
  sample_size?: number;
  source_label?: string;
  source_warnings?: string[];
  disclaimer?: string;
};

export type RecommendationSourceRequirement = {
  slot: RecommendationRequirementSlot;
  label: string;
  candidate_names: string[];
  candidates: PerkRef[];
  unresolved_candidate_names: string[];
};

export type RecommendationSourceRecord = {
  rule_stable_id: string;
  source_id: string;
  source_label: string;
  source_url?: string;
  purposes: Array<"pve" | "pvp" | "general">;
  rating?: string;
  ranking?: string;
  note?: string;
  page_updated_at?: string;
  version?: string;
  source_location?: string;
  requirements: RecommendationSourceRequirement[];
};

export type RecommendationSourceSlotMatch = {
  slot: RecommendationRequirementSlot;
  label: string;
  state: "match" | "different" | "source_not_specified" | "uncheckable";
  source_candidate_names: string[];
  source_candidates: PerkRef[];
  unresolved_source_candidate_names: string[];
  instance_owned: AccountWeaponRollPlugSummary[];
  current_enabled: AccountWeaponRollPlugSummary[];
};

export type RecommendationSourceMatch = {
  rule_stable_id: string;
  source_id: string;
  source_label: string;
  source_url?: string;
  state:
    | "full"
    | "core"
    | "close"
    | "key_missing"
    | "not_matched"
    | "weapon_only"
    | "uncheckable";
  matched_requirement_count: number;
  requirement_count: number;
  checkable_requirement_count: number;
  uncheckable_requirement_count: number;
  purposes: Array<"pve" | "pvp" | "general">;
  rating?: string;
  ranking?: string;
  note?: string;
  page_updated_at?: string;
  version?: string;
  source_location?: string;
  slots: RecommendationSourceSlotMatch[];
};

export type SourceOptions = {
  manifest_version?: string;
  itemDefinitions?: DefinitionComponentData;
  plugSetDefinitions?: DefinitionComponentData;
  englishItemDefinitions?: DefinitionComponentData;
  englishPlugSetDefinitions?: DefinitionComponentData;
  weaponIdentityRelations?: WeaponIdentityRelation[];
  item_name?: string;
};

export type WeaponVariantKind =
  | "standard"
  | "adept"
  | "timelost"
  | "harrowed"
  | "holofoil"
  | "named_variant";

export type WeaponIdentityRelation = {
  item_hash: number;
  family_key: string;
  release_group_key: string;
  variant_kind: WeaponVariantKind;
  variant_tags: WeaponVariantKind[];
  canonical_item_hash: number;
  release_label?: string;
  relation_evidence: "release_trait" | "isolated";
};

export interface CommunityPerkSource {
  name: string;
  isAvailable(): boolean;
  getRecommendations(
    item_hash: number,
    options: SourceOptions
  ): Promise<WeaponRecommendation | null>;
}

export type VaultItemMatchInfo = {
  matched: number;
  available: number;
  perk_pool_count?: number;
  combo_count?: number;
  modes: Array<"pve" | "pvp" | "general">;
  sample_perks?: PerkRef[];
  source_label?: string;
};

export type VaultItemMatchInput = {
  hash: number;
  instance_id?: string;
  item_name?: string;
  socket_plugs?: Array<{ hash: number; socket_index?: number }>;
  weapon_roll?: AccountWeaponRollSummary;
};

export type VaultItemInstanceMatchInfo = VaultItemMatchInfo & {
  hash: number;
  instance_id?: string;
  canonical_weapon_name: string;
  coverage: "covered" | "uncovered";
  match_status: "full_match" | "partial_match" | "no_match" | "indeterminate";
  recommendation_state: "priority" | "compare" | "uncovered";
  partial: number;
  source_matches?: RecommendationSourceMatch[];
  dim_wishlist?: DimWishlistInstanceMatch;
};

export type RecommendationCardSourceSummary = {
  source_id: string;
  source_label: string;
  state: RecommendationSourceMatch["state"];
  purposes: Array<"pve" | "pvp" | "general">;
  matched_requirement_count: number;
  requirement_count: number;
  uncheckable_requirement_count: number;
  matched_perk_count: number;
  perk_requirement_count: number;
  uncheckable_perk_count: number;
};

export type RecommendationCardDimSummary = Omit<DimWishlistInstanceMatch, "rules"> & {
  matched_modes?: Array<"pve" | "pvp" | "general">;
};

/**
 * 仓库卡片、筛选与整理使用的轻量推荐事实。
 * 不包含逐栏候选、图标、说明、链接或 DIM 规则明细。
 */
export type RecommendationCardSummary = Pick<
  VaultItemInstanceMatchInfo,
  | "hash"
  | "instance_id"
  | "canonical_weapon_name"
  | "coverage"
  | "match_status"
  | "recommendation_state"
  | "matched"
  | "partial"
  | "available"
  | "modes"
> & {
  sources: RecommendationCardSourceSummary[];
  dim?: RecommendationCardDimSummary;
};

export type DimWishlistRuleInstanceMatch = {
  rule_stable_id?: string;
  mode: "pve" | "pvp" | "general";
  state: "match" | "partial" | "different" | "uncheckable";
  matched_requirement_count: number;
  requirement_count: number;
  diagnostic_status?: DimWishlistRuleDiagnostic["status"];
};

export type DimWishlistInstanceMatch = {
  state: "full" | "close" | "not_matched" | "uncheckable";
  matched_combo_count: number;
  partial_combo_count: number;
  uncheckable_combo_count: number;
  combo_count: number;
  best_matched_requirement_count: number;
  best_requirement_count: number;
  modes: Array<"pve" | "pvp" | "general">;
  rules: DimWishlistRuleInstanceMatch[];
};

export type VaultRecommendationDependencyIssueCode =
  | "manifest_unavailable"
  | "manifest_outdated"
  | "recommendation_legacy_unverified"
  | "recommendation_unavailable";

export type VaultRecommendationDependencyIssue = {
  code: VaultRecommendationDependencyIssueCode;
  severity: "warning" | "blocking";
  message: string;
};

export type VaultCommunityMatchResult = {
  matches: VaultItemInstanceMatchInfo[];
  card_summaries?: RecommendationCardSummary[];
  changed_instance_ids?: string[];
  issues: VaultRecommendationDependencyIssue[];
  manifest_version?: string;
  recommendation_revision?: string;
  recommendation_schema_version?: number;
};

export type VaultCommunityMatchOptions = {
  include_evidence?: boolean;
};
