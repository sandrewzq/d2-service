import type {
  RecommendationCardSummary,
  VaultCommunityMatchOptions,
  VaultItemInstanceMatchInfo,
  VaultCommunityMatchResult,
  VaultItemMatchInfo,
  VaultItemMatchInput,
  WeaponRecommendation
} from "@d2-tools/core/community-perks";
import type { DimWishlistImportPreview } from "@d2-tools/core/analysis/wishlistImport";

export type {
  AccountItemDetail,
  AccountItemPlugSummary,
  AccountItemSnapshot,
  AccountItemSummary,
  AccountSnapshot,
  AmmoTypeKey,
  ArmorEnergySummary,
  ArmorStatBreakdownSummary,
  ArmorStatSummary,
  EquipmentGroupKey,
  WeaponFrameSummary,
  WeaponStatKey,
  WeaponStatSummary
} from "@d2-tools/core/account/summary";
export type { ArmorStatKey } from "@d2-tools/core/loadouts/analysis";
export type { ItemPerkGroup, ItemPlugSummary } from "@d2-tools/core/items/perks";
export type { ItemDefinitionStat } from "@d2-tools/core/items/search";
export type { ItemDefinitionVersionSummary, ItemReleaseSummary } from "@d2-tools/core/items/release";
export type { ArmorSetCatalogEntry, ArmorSetCatalogItem, EquipableItemSetSummary } from "@d2-tools/core/items/equipableItemSet";
export type { WeaponBreakerTypeSummary } from "@d2-tools/core/items/breakerTypes";
export type { DamageTypeSummary } from "@d2-tools/core/items/damageTypes";
export type { LiveItemAvailability } from "@d2-tools/core/items/liveAvailability";
export type { ItemSourceSummary } from "@d2-tools/core/items/source";
export type {
  BuildGuideLoadoutDraft,
  BuildGuideMatchResult,
  BuildGuideParseResult,
  BuildGuideRequirement
} from "@d2-tools/core/assistant/guideSchema";
export type { RecommendationCardSummary, VaultCommunityMatchOptions, VaultCommunityMatchResult, VaultItemInstanceMatchInfo, VaultItemMatchInfo, VaultItemMatchInput, WeaponRecommendation };
export type {
  DimWishlistImportPreview
};

export type DimWishlistOnlineStatus = {
  source_url: string;
  current_revision: string;
  current_fingerprint: string;
  activated_at: string;
  checked_at: string;
  latest_revision: string;
  latest_commit_at: string;
  rule_count: number;
  weapon_count: number;
};

export type DimWishlistOnlinePreview = DimWishlistOnlineStatus & {
  token?: string;
  update_available: boolean;
  file_name: string;
  title: string;
  preview_fingerprint: string;
  mode_counts: Record<"pve" | "pvp" | "general", number>;
  authors: string[];
  tags: string[];
};

export type DimWishlistOnlineActivationResult = {
  wishlist: import("./vaultApi").DimWishlist;
  status: DimWishlistOnlineStatus;
};

export type WeaponRecommendationKnowledgeStatus = {
  schema_version: number;
  semantic_validation_version: number;
  validated_manifest_version: string;
  validation_state: "verified" | "unverified";
  dataset_revision: string;
  database_path: string;
  source_fingerprint: string;
  imported_at: string;
  recommendation_count: number;
  weapon_count: number;
  source_count: number;
  skipped_row_count: number;
};

export type WeaponKnowledgeImportPreview = {
  file_name: string;
  import_mode: "merge" | "replace";
  recommendation_count: number;
  importable_recommendation_count: number;
  weapon_count: number;
  source_count: number;
  source_labels: string[];
  fingerprint: string;
  blocking_issue_count: number;
  skipped_row_count: number;
  blocking_issues: Array<{
    row_number: number;
    weapon_name: string;
    source_label: string;
    field: "推荐来源" | "武器ID" | "武器" | "枪管" | "弹匣" | "大师" | "Perk 1" | "Perk 2" | "起源特性";
    value: string;
    message: string;
  }>;
};

export type WeaponKnowledgeImportResult = WeaponRecommendationKnowledgeStatus & {
  file_name: string;
  imported_row_count: number;
  import_mode: "merge" | "replace";
};

export type WeaponKnowledgeImportSelection = WeaponKnowledgeImportPreview & {
  token?: string;
};

export type RecommendationManagedSource = {
  source_key: string;
  label: string;
  kind: "curated" | "dim";
  state: "active" | "disabled" | "removed";
  configured: boolean;
  rule_count: number;
  weapon_count: number;
  revision: string;
  imported_at: string;
  affected_instance_count?: number;
};

export type RecommendationManagedRule = {
  source_key: string;
  source_label: string;
  rule_stable_id: string;
  weapon_hashes: number[];
  weapon_name: string;
  purposes: Array<"pve" | "pvp" | "general">;
  requirements: Array<{ slot: string; names: string[] }>;
  note: string;
  state: "active" | "removed";
  review_required: boolean;
  source_revision: string;
  reason: string;
  affected_instance_count?: number;
};

export type RecommendationManagementSnapshot = {
  curated_revision: string;
  dim_revision: string;
  sources: RecommendationManagedSource[];
  removed_rules: RecommendationManagedRule[];
  affected_weapon_hashes?: number[];
};

export type FileExportResult = {
  canceled: boolean;
  file_path?: string;
  message: string;
};

export type AiAdviceSections = {
  facts: string[];
  analysis: string[];
  suggestions: string[];
  action_reminders: string[];
  raw: string;
};
