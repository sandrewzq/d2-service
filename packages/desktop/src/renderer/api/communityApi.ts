import type {
  DimWishlistImportPreview,
  DimWishlistOnlineActivationResult,
  DimWishlistOnlinePreview,
  DimWishlistOnlineStatus,
  FileExportResult,
  RecommendationManagedRule,
  RecommendationManagementSnapshot,
  VaultCommunityMatchOptions,
  VaultCommunityMatchResult,
  VaultItemInstanceMatchInfo,
  VaultItemMatchInput,
  WeaponKnowledgeImportResult,
  WeaponKnowledgeImportSelection,
  WeaponRecommendationKnowledgeStatus,
  WeaponRecommendation
} from "./sharedTypes";
import type { DimWishlist, LocalCommunityRecommendationTable } from "./vaultApi";
import type {
  PersonalWeaponKnowledgeTable,
  SavePersonalWeaponKnowledgeInput
} from "@d2-tools/core/community-perks/personalWeaponKnowledge";

export type CommunityApi = {
  getDimWishlist(): Promise<DimWishlist | null>;
  saveDimWishlist(wishlist: DimWishlist): Promise<DimWishlist>;
  clearDimWishlist(): Promise<null>;
  selectDimWishlistFile(): Promise<DimWishlistImportPreview | null>;
  confirmDimWishlistImport(token: string): Promise<DimWishlist>;
  getDimWishlistOnlineStatus(): Promise<DimWishlistOnlineStatus>;
  checkDimWishlistOnlineUpdate(): Promise<DimWishlistOnlinePreview>;
  confirmDimWishlistOnlineUpdate(token: string): Promise<DimWishlistOnlineActivationResult>;
  exportWeaponKnowledgeCsvTemplate(): Promise<FileExportResult>;
  exportWeaponKnowledgePlayerCsv(): Promise<FileExportResult>;
  selectWeaponKnowledgeCsv(): Promise<WeaponKnowledgeImportSelection | null>;
  confirmWeaponKnowledgeCsvImport(token: string): Promise<WeaponKnowledgeImportResult>;
  getWeaponKnowledgeStatus(): Promise<WeaponRecommendationKnowledgeStatus | null>;
  getRecommendationManagement(): Promise<RecommendationManagementSnapshot>;
  listRecommendationRules(sourceKey: string, query?: string): Promise<RecommendationManagedRule[]>;
  setRecommendationSourceState(sourceKey: string, state: "active" | "disabled" | "removed"): Promise<RecommendationManagementSnapshot>;
  setRecommendationRuleState(input: { source_key: string; rule_stable_id: string; state: "active" | "removed"; reason?: string; source_revision?: string }): Promise<RecommendationManagementSnapshot>;
  clearCuratedRecommendationDataset(): Promise<RecommendationManagementSnapshot>;
  getLocalCommunityRecommendations(): Promise<LocalCommunityRecommendationTable | null>;
  saveLocalCommunityRecommendations(table: LocalCommunityRecommendationTable): Promise<LocalCommunityRecommendationTable>;
  clearLocalCommunityRecommendations(): Promise<null>;
  getPersonalWeaponKnowledge(weaponName?: string): Promise<PersonalWeaponKnowledgeTable>;
  savePersonalWeaponKnowledge(input: SavePersonalWeaponKnowledgeInput): Promise<PersonalWeaponKnowledgeTable>;
  setPersonalWeaponKnowledgeEnabled(id: string, enabled: boolean): Promise<PersonalWeaponKnowledgeTable>;
  deletePersonalWeaponKnowledge(id: string): Promise<PersonalWeaponKnowledgeTable>;
  getCommunityPerkRecommendations(item_hash: number, options?: { item_name?: string }): Promise<WeaponRecommendation | null>;
  matchCommunityVaultItems(items: VaultItemMatchInput[], options?: VaultCommunityMatchOptions): Promise<VaultCommunityMatchResult>;
  getCommunityVaultItemMatchEvidence(item: VaultItemMatchInput): Promise<VaultItemInstanceMatchInfo | null>;
};
