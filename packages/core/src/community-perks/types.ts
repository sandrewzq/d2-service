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
  popularity?: number;
  source: "dim_wishlist" | "ai_lightgg" | "local_community";
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
    source: "dim_wishlist" | "ai_lightgg" | "local_community";
    mode: "pve" | "pvp" | "general";
    source_label: string;
    note?: string;
  }>;
  source_records?: RecommendationSourceRecord[];
  sample_size?: number;
  source_label?: string;
  ai_analysis?: string;
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
  item_name?: string;
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
  issues: VaultRecommendationDependencyIssue[];
  manifest_version?: string;
  recommendation_revision?: string;
  recommendation_schema_version?: number;
};
