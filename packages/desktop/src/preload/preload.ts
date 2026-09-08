import { contextBridge, ipcRenderer } from "electron";
import type { ActivityHistorySummary } from "@d2-tools/core/activities/history";
import type {
  BuildGuideMatchResult,
  BuildGuideRequirement
} from "@d2-tools/core/assistant/guideSchema";
import type {
  AiChatReplyResult,
  AiConnectionTestResult,
  AiModelListResult,
  ItemAiAdviceInput,
  ItemAiAdviceResult,
  VaultAiAdviceResult
} from "@d2-tools/core/ai/chat";
import type { AiSettings } from "@d2-tools/core/ai/settings";
import type { VaultAnalysisResult } from "@d2-tools/core/analysis/vault";
import type { LocalTargetRules } from "@d2-tools/core/analysis/targets";
import type {
  EquipmentTargetStore
} from "@d2-tools/core/targets/equipmentTargets";
import type { DimWishlist, DimWishlistImportPreview } from "@d2-tools/core/analysis/wishlistImport";
import type {
  WeaponKnowledgeImportPreview,
  WeaponKnowledgeImportResult,
  WeaponRecommendationKnowledgeStatus
} from "@d2-tools/services/community/weaponRecommendationKnowledge";
import type {
  RecommendationManagedRule,
  RecommendationManagementSnapshot
} from "@d2-tools/services/community/recommendationManagement";
import type {
  DimWishlistOnlineActivationResult,
  DimWishlistOnlinePreview,
  DimWishlistOnlineStatus
} from "@d2-tools/services/community/dimWishlistUpdates";
import type {
  LocalCommunityRecommendationTable,
  VaultCommunityMatchOptions,
  VaultCommunityMatchResult,
  VaultItemInstanceMatchInfo,
  VaultItemMatchInput,
  WeaponRecommendation
} from "@d2-tools/core/community-perks";
import type {
  PersonalWeaponKnowledgeTable,
  SavePersonalWeaponKnowledgeInput
} from "@d2-tools/core/community-perks/personalWeaponKnowledge";
import type { D2Config } from "@d2-tools/core/config/schema";
import type { HealthStatus } from "@d2-tools/core/health";
import type { ItemAliases, ItemAliasEntry } from "@d2-tools/core/items/aliases";
import type { ItemDefinitionDetail } from "@d2-tools/core/items/detail";
import type { LiveItemAvailability } from "@d2-tools/core/items/liveAvailability";
import type {
  PerkRelatedEquipmentPage,
  PerkRelatedEquipmentQuery,
  PerkSearchResult
} from "@d2-tools/core/items/perkSearch";
import type { ItemSearchResult } from "@d2-tools/core/items/search";
import type { ArmorSetCatalogEntry } from "@d2-tools/core/items/equipableItemSet";
import type { LibraryHistory, LibraryHistoryItem } from "@d2-tools/core/library/history";
import type { GuideSourceReadPreview } from "../contracts/guides.js";
import type { CreateLoadoutTemplateInput, LoadoutTemplate } from "@d2-tools/core/loadouts/templates";
import type {
  CreateLocalLoadoutPlanInput,
  DimLoadoutImportPreview,
  LocalLoadoutPlan,
  UpdateLocalLoadoutPlanInput
} from "../contracts/loadouts.js";
import type { SaveVaultNoteInput, SaveVaultTagInput, VaultTags } from "@d2-tools/core/vault/tags";
import type { WeeklySummary } from "@d2-tools/core/weekly/summary";
import type {
  AccountItemDetail,
  AccountItemDetailResource,
  AccountItemDetailRequestOptions,
  AccountItemSummary,
  AccountSummary,
  AccountSummaryRequestOptions,
  AccountResourceRequestOptions,
  AccountSnapshotResource,
  AuthLoginResult,
  CachedAccountSnapshot
} from "../contracts/account.js";
import type {
  ActionDebugTraceEntry,
  ActionDebugTraceInput,
  AccountWriteVerificationInput,
  ActionLogEntry,
  ActionVerificationRecordInput,
  ApplySocketPlugsActionInput,
  BatchEquipItemsInput,
  BatchItemActionResult,
  BatchTransferPlan,
  BatchTransferItemsInput,
  InsertSocketPlugActionInput,
  ItemActionPlan,
  ItemActionPlanInput,
  ItemActionResult,
  ItemEquipActionInput,
  ItemLockActionInput,
  ItemTransferActionInput,
  LoadoutEquipActionInput,
  LoadoutClearActionInput,
  LoadoutIdentifiersActionInput,
  LoadoutSnapshotActionInput,
  PostmasterPullActionInput
} from "../contracts/actions.js";
import type {
  ArmorPlannerClientRunRequest,
  ArmorPlannerClientRunResult,
  ArmorPlannerWorkspaceJob
} from "../contracts/armor.js";
import type { DailySummary, HomeBriefing } from "../contracts/daily.js";
import type {
  ManifestStatus,
  ManifestStatusRequestOptions,
  StartupState
} from "../contracts/manifest.js";
import type {
  VendorInventoryRequest,
  VendorInventorySnapshot
} from "../contracts/vendors.js";
import type {
  DesktopIpcErrorDetails,
  DesktopIpcErrorPayload
} from "../contracts/errors.js";
import type {
  AssetCacheTaskCompletion,
  AssetCacheTaskInput,
  BackgroundTaskSnapshot
} from "../shared/backgroundTasks.js";
import type { AppUpdateSnapshot } from "../shared/updateTypes.js";

const accountSnapshotChangedChannel: typeof import("../contracts/account.js").accountSnapshotChangedChannel =
  "account:snapshot:changed";

type PreloadCacheDomain =
  | "asset-cache"
  | "account-snapshot"
  | "account-item-details"
  | "home-briefing"
  | "vendor-inventory"
  | "manifest-version-check";
type PreloadCacheStatus = {
  data_dir: string;
  generated_at: string;
  domains: Array<{
    domain: PreloadCacheDomain;
    path: string;
    exists: boolean;
    bytes: number;
    updated_at?: string;
  }>;
  account_cache_metrics?: {
    generated_at: string;
    snapshot: PreloadCacheMetricCounts;
    item_detail: PreloadCacheMetricCounts;
    total: PreloadCacheMetricCounts;
  };
};
type PreloadCacheMetricCounts = {
  hit: number;
  miss: number;
  stale: number;
  refresh: number;
  error: number;
};
type PreloadConfigBackupResult = { ok: true; message: string; path?: string; cache?: PreloadCacheStatus };

type RendererCacheStorage = {
  keys: () => Promise<string[]>;
  delete: (cacheName: string) => Promise<boolean>;
};

async function clearRendererAssetCaches(): Promise<void> {
  const rendererCaches = (globalThis as typeof globalThis & { caches?: RendererCacheStorage }).caches;
  if (!rendererCaches) return;
  try {
    const names = await rendererCaches.keys();
    await Promise.all(
      names
        .filter((name) => name.startsWith("d2-tools-game-assets-"))
        .map((name) => rendererCaches.delete(name))
    );
  } catch {
    // Asset cache cleanup is best effort and must never block settings actions.
  }
}

contextBridge.exposeInMainWorld("d2", {
  getHealth: () => ipcRenderer.invoke("health:get") as Promise<HealthStatus>,
  getConfig: () => ipcRenderer.invoke("config:get") as Promise<D2Config>,
  saveConfig: (config: D2Config) => ipcRenderer.invoke("config:save", config) as Promise<D2Config>,
  openDataDir: () => ipcRenderer.invoke("config:open-data-dir") as Promise<void>,
  exportConfig: () => ipcRenderer.invoke("config:export") as Promise<PreloadConfigBackupResult>,
  importConfig: () => ipcRenderer.invoke("config:import") as Promise<PreloadConfigBackupResult>,
  getCacheStatus: () => ipcRenderer.invoke("config:cache-status") as Promise<PreloadCacheStatus>,
  clearCache: async (domains?: readonly PreloadCacheDomain[]) => {
    const result = await ipcRenderer.invoke("config:clear-cache", domains) as PreloadConfigBackupResult;
    // CacheStorage lives in the renderer process, so clear it alongside the
    // main-process cache domains without coupling the main process to DOM APIs.
    if (!domains || domains.includes("asset-cache")) {
      await clearRendererAssetCaches();
    }
    return result;
  },
  listAiModels: (ai: AiSettings) => ipcRenderer.invoke("ai:models", ai) as Promise<AiModelListResult>,
  testAiConnection: () => ipcRenderer.invoke("ai:test") as Promise<AiConnectionTestResult>,
  loginBungie: () => ipcRenderer.invoke("auth:login") as Promise<AuthLoginResult>,
  getAccountSummary: (options?: AccountSummaryRequestOptions) =>
    invokeDesktopIpc<AccountSummary>("account:summary", options),
  onAccountSnapshotChanged: (callback: (snapshot: AccountSummary) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: AccountSummary) => callback(snapshot);
    ipcRenderer.on(accountSnapshotChangedChannel, listener);
    return () => {
      ipcRenderer.removeListener(accountSnapshotChangedChannel, listener);
    };
  },
  getCachedAccountSnapshot: () =>
    ipcRenderer.invoke("account:snapshot:cached") as Promise<CachedAccountSnapshot | null>,
  getAccountItemDetail: (instanceId: string, options?: AccountItemDetailRequestOptions) =>
    invokeDesktopIpc<AccountItemDetail>("account:item-detail", instanceId, options),
  getAccountSnapshotResource: (options?: AccountResourceRequestOptions) =>
    invokeDesktopIpc<AccountSnapshotResource>("account:resource:snapshot", options),
  getAccountItemDetailResource: (instanceId: string, options?: AccountResourceRequestOptions) =>
    invokeDesktopIpc<AccountItemDetailResource>("account:resource:item-detail", instanceId, options),
  planArmor: <Job extends ArmorPlannerWorkspaceJob>(request: ArmorPlannerClientRunRequest<Job>) =>
    invokeDesktopIpc<ArmorPlannerClientRunResult<Job>>("armor:plan", request),
  invalidateArmorPlanner: (scopeId?: string) =>
    invokeDesktopIpc<void>("armor:invalidate", scopeId),
  getItemDetail: (hash: number) => invokeDesktopIpc<ItemDefinitionDetail>("items:detail", hash),
  getStartupState: () => ipcRenderer.invoke("startup:get") as Promise<StartupState>,
  setWindowColorMode: (colorMode: "light" | "dark") =>
    ipcRenderer.invoke("window:set-color-mode", colorMode) as Promise<void>,
  minimizeWindow: () => ipcRenderer.invoke("window:minimize") as Promise<void>,
  toggleMaximizeWindow: () => ipcRenderer.invoke("window:toggle-maximize") as Promise<void>,
  closeWindow: () => ipcRenderer.invoke("window:close") as Promise<void>,
  openExternal: (url: string) =>
    ipcRenderer.invoke("shell:open-external", url) as Promise<void>,
  openLegalDocument: (document: "project-license" | "third-party-notices") =>
    ipcRenderer.invoke("shell:open-legal-document", document) as Promise<void>,
  getBackgroundTasks: () => ipcRenderer.invoke("background-tasks:list") as Promise<BackgroundTaskSnapshot[]>,
  onBackgroundTasksChanged: (callback: (tasks: BackgroundTaskSnapshot[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, tasks: BackgroundTaskSnapshot[]) => callback(tasks);
    ipcRenderer.on("background-tasks:changed", listener);
    return () => ipcRenderer.removeListener("background-tasks:changed", listener);
  },
  queueAssetCacheTask: (input: AssetCacheTaskInput) =>
    ipcRenderer.invoke("background-tasks:asset-cache:start", input) as Promise<BackgroundTaskSnapshot>,
  completeAssetCacheTask: (input: AssetCacheTaskCompletion) =>
    ipcRenderer.invoke("background-tasks:asset-cache:complete", input) as Promise<{ ok: boolean }>,
  getManifestStatus: (options?: ManifestStatusRequestOptions) =>
    invokeDesktopIpc<ManifestStatus>("manifest:status", options),
  initializeManifest: () => invokeDesktopIpc<ManifestStatus>("manifest:initialize"),
  repairManifest: () => invokeDesktopIpc<ManifestStatus>("manifest:repair"),
  getLibraryRuntimeCapabilities: () => invokeDesktopIpc<{
    contract_version: 1 | 2;
    supports_perk_families: boolean;
    supports_related_equipment_paging: boolean;
    supports_related_variant_matches: boolean;
  }>("library:capabilities"),
  searchItems: (query: string) => invokeDesktopIpc<ItemSearchResult[]>("items:search", query),
  searchPerks: (query: string) => invokeDesktopIpc<PerkSearchResult[]>("items:perks:search", query),
  getPerkRelatedEquipment: (input: PerkRelatedEquipmentQuery) =>
    invokeDesktopIpc<PerkRelatedEquipmentPage<ItemSearchResult>>("items:perks:related", input),
  getArmorSetCatalog: () => invokeDesktopIpc<ArmorSetCatalogEntry[]>("items:armor-sets:list"),
  getLiveItemAvailability: (itemHashes: number[]) =>
    invokeDesktopIpc<LiveItemAvailability>("items:live-availability", itemHashes),
  getItemAliases: () => ipcRenderer.invoke("aliases:get") as Promise<ItemAliases>,
  saveItemAlias: (input: ItemAliasEntry) => ipcRenderer.invoke("aliases:save", input) as Promise<ItemAliases>,
  getLibraryHistory: () => ipcRenderer.invoke("library:history:get") as Promise<LibraryHistory>,
  addRecentItem: (item: Omit<LibraryHistoryItem, "viewed_at">) =>
    ipcRenderer.invoke("library:recent:add", item) as Promise<LibraryHistory>,
  addFavoriteItem: (item: Omit<LibraryHistoryItem, "viewed_at">) =>
    ipcRenderer.invoke("library:favorite:add", item) as Promise<LibraryHistory>,
  removeFavoriteItem: (hash: number) =>
    ipcRenderer.invoke("library:favorite:remove", hash) as Promise<LibraryHistory>,
  readGuideSource: (url: string) =>
    ipcRenderer.invoke("guides:source:read", url) as Promise<GuideSourceReadPreview>,
  listLoadoutTemplates: () => ipcRenderer.invoke("loadouts:list") as Promise<LoadoutTemplate[]>,
  createLoadoutTemplate: (input: CreateLoadoutTemplateInput) =>
    ipcRenderer.invoke("loadouts:create", input) as Promise<LoadoutTemplate>,
  renameLoadoutTemplate: (id: string, name: string) =>
    ipcRenderer.invoke("loadouts:rename", { id, name }) as Promise<LoadoutTemplate>,
  deleteLoadoutTemplate: (id: string) => ipcRenderer.invoke("loadouts:delete", id) as Promise<LoadoutTemplate[]>,
  listLocalLoadoutPlans: () => ipcRenderer.invoke("loadouts:plans:list") as Promise<LocalLoadoutPlan[]>,
  createLocalLoadoutPlan: (input: CreateLocalLoadoutPlanInput) =>
    ipcRenderer.invoke("loadouts:plans:create", input) as Promise<LocalLoadoutPlan>,
  updateLocalLoadoutPlan: (id: string, input: UpdateLocalLoadoutPlanInput) =>
    ipcRenderer.invoke("loadouts:plans:update", { id, plan: input }) as Promise<LocalLoadoutPlan>,
  deleteLocalLoadoutPlan: (id: string) =>
    ipcRenderer.invoke("loadouts:plans:delete", id) as Promise<LocalLoadoutPlan[]>,
  previewDimLoadoutImport: (url: string) =>
    invokeDesktopIpc<DimLoadoutImportPreview>("loadouts:dim:preview", url),
  createLoadoutTemplateTransferPlan: (input: {
    template: LoadoutTemplate;
    target_character_id: string;
    available_items: AccountSummary["vault"]["items"];
    equipped_items: AccountSummary["vault"]["items"];
  }) => ipcRenderer.invoke("loadouts:transfer-plan", input) as Promise<BatchTransferPlan>,
  getDimWishlist: () => ipcRenderer.invoke("wishlist:get") as Promise<DimWishlist | null>,
  saveDimWishlist: (wishlist: DimWishlist) => ipcRenderer.invoke("wishlist:save", wishlist) as Promise<DimWishlist>,
  clearDimWishlist: () => ipcRenderer.invoke("wishlist:clear") as Promise<null>,
  selectDimWishlistFile: () =>
    ipcRenderer.invoke("wishlist:import:select") as Promise<DimWishlistImportPreview | null>,
  confirmDimWishlistImport: (token: string) =>
    ipcRenderer.invoke("wishlist:import:confirm", token) as Promise<DimWishlist>,
  getDimWishlistOnlineStatus: () =>
    ipcRenderer.invoke("wishlist:online:status") as Promise<DimWishlistOnlineStatus>,
  checkDimWishlistOnlineUpdate: () =>
    ipcRenderer.invoke("wishlist:online:check") as Promise<DimWishlistOnlinePreview>,
  confirmDimWishlistOnlineUpdate: (token: string) =>
    ipcRenderer.invoke("wishlist:online:confirm", token) as Promise<DimWishlistOnlineActivationResult>,
  getLocalTargetRules: () => ipcRenderer.invoke("targets:get") as Promise<LocalTargetRules>,
  saveLocalTargetRules: (rules: LocalTargetRules) =>
    ipcRenderer.invoke("targets:save", rules) as Promise<LocalTargetRules>,
  clearLocalTargetRules: () => ipcRenderer.invoke("targets:clear") as Promise<LocalTargetRules>,
  getEquipmentTargetStore: () => ipcRenderer.invoke("equipment-targets:get") as Promise<EquipmentTargetStore>,
  saveEquipmentTargetStore: (store: EquipmentTargetStore) =>
    ipcRenderer.invoke("equipment-targets:save", store) as Promise<EquipmentTargetStore>,
  clearEquipmentTargetStore: () => ipcRenderer.invoke("equipment-targets:clear") as Promise<EquipmentTargetStore>,
  getLocalCommunityRecommendations: () =>
    ipcRenderer.invoke("community:local:get") as Promise<LocalCommunityRecommendationTable | null>,
  saveLocalCommunityRecommendations: (table: LocalCommunityRecommendationTable) =>
    ipcRenderer.invoke("community:local:save", table) as Promise<LocalCommunityRecommendationTable>,
  clearLocalCommunityRecommendations: () => ipcRenderer.invoke("community:local:clear") as Promise<null>,
  getPersonalWeaponKnowledge: (weaponName?: string) =>
    ipcRenderer.invoke("community:personal:get", weaponName) as Promise<PersonalWeaponKnowledgeTable>,
  savePersonalWeaponKnowledge: (input: SavePersonalWeaponKnowledgeInput) =>
    ipcRenderer.invoke("community:personal:save", input) as Promise<PersonalWeaponKnowledgeTable>,
  setPersonalWeaponKnowledgeEnabled: (id: string, enabled: boolean) =>
    ipcRenderer.invoke("community:personal:set-enabled", id, enabled) as Promise<PersonalWeaponKnowledgeTable>,
  deletePersonalWeaponKnowledge: (id: string) =>
    ipcRenderer.invoke("community:personal:delete", id) as Promise<PersonalWeaponKnowledgeTable>,
  exportWeaponKnowledgeCsvTemplate: () =>
    ipcRenderer.invoke("community:knowledge:template:export") as Promise<{
      canceled: boolean;
      file_path?: string;
      message: string;
    }>,
  exportWeaponKnowledgePlayerCsv: () =>
    ipcRenderer.invoke("community:knowledge:player:export") as Promise<{
      canceled: boolean;
      file_path?: string;
      message: string;
    }>,
  selectWeaponKnowledgeCsv: () =>
    ipcRenderer.invoke("community:knowledge:import:select") as Promise<(WeaponKnowledgeImportPreview & { token?: string }) | null>,
  confirmWeaponKnowledgeCsvImport: (token: string) =>
    ipcRenderer.invoke("community:knowledge:import:confirm", token) as Promise<WeaponKnowledgeImportResult>,
  getWeaponKnowledgeStatus: () =>
    ipcRenderer.invoke("community:knowledge:status:get") as Promise<WeaponRecommendationKnowledgeStatus | null>,
  getRecommendationManagement: () =>
    ipcRenderer.invoke("community:management:get") as Promise<RecommendationManagementSnapshot>,
  listRecommendationRules: (sourceKey: string, query?: string) =>
    ipcRenderer.invoke("community:management:rules", sourceKey, query) as Promise<RecommendationManagedRule[]>,
  setRecommendationSourceState: (sourceKey: string, state: "active" | "disabled" | "removed") =>
    ipcRenderer.invoke("community:management:source:set", sourceKey, state) as Promise<RecommendationManagementSnapshot>,
  setRecommendationRuleState: (input: { source_key: string; rule_stable_id: string; state: "active" | "removed"; reason?: string; source_revision?: string }) =>
    ipcRenderer.invoke("community:management:rule:set", input) as Promise<RecommendationManagementSnapshot>,
  clearCuratedRecommendationDataset: () =>
    ipcRenderer.invoke("community:management:curated:clear") as Promise<RecommendationManagementSnapshot>,
  getVaultTags: () => ipcRenderer.invoke("vault:tags:get") as Promise<VaultTags>,
  saveVaultTag: (input: SaveVaultTagInput) => ipcRenderer.invoke("vault:tag:save", input) as Promise<VaultTags>,
  saveVaultTagsBatch: (inputs: SaveVaultTagInput[]) =>
    ipcRenderer.invoke("vault:tags:save-batch", inputs) as Promise<VaultTags>,
  saveVaultNote: (input: SaveVaultNoteInput) => ipcRenderer.invoke("vault:note:save", input) as Promise<VaultTags>,
  analyzeVault: (input: { items: AccountItemSummary[]; tags: VaultTags }) =>
    ipcRenderer.invoke("analysis:vault", input) as Promise<VaultAnalysisResult>,
  generateVaultAiAdvice: (input: { items: AccountItemSummary[]; tags: VaultTags }) =>
    ipcRenderer.invoke("analysis:vault:ai", input) as Promise<VaultAiAdviceResult>,
  generateItemAiAdvice: (input: Omit<ItemAiAdviceInput, "config">) =>
    ipcRenderer.invoke("analysis:item:ai", input) as Promise<ItemAiAdviceResult>,
  sendAiChat: (input: { question: string; context: string }) =>
    ipcRenderer.invoke("analysis:chat:ai", input) as Promise<AiChatReplyResult>,
  parseBuildGuide: (input: { rawText: string; aiText?: string }) =>
    ipcRenderer.invoke("assistant:guide:parse", input),
  matchBuildGuide: (input: { requirement: BuildGuideRequirement; characterId?: string }) =>
    ipcRenderer.invoke("assistant:guide:match", input),
  createGuideLoadoutDraft: (input: { match: BuildGuideMatchResult; characterId: string; fallbackName: string }) =>
    ipcRenderer.invoke("assistant:guide:draft", input),
  setItemLockState: (input: ItemLockActionInput) =>
    invokeDesktopIpc<ItemActionResult>("actions:item:set-lock", input),
  equipItem: (input: ItemEquipActionInput) =>
    invokeDesktopIpc<ItemActionResult>("actions:item:equip", input),
  insertSocketPlug: (input: InsertSocketPlugActionInput) =>
    invokeDesktopIpc<ItemActionResult>("actions:item:insert-socket-plug", input),
  applySocketPlugs: (input: ApplySocketPlugsActionInput) =>
    invokeDesktopIpc<ItemActionResult>("actions:item:apply-socket-plugs", input),
  transferItem: (input: ItemTransferActionInput) =>
    invokeDesktopIpc<ItemActionResult>("actions:item:transfer", input),
  batchEquipItems: (input: BatchEquipItemsInput) =>
    invokeDesktopIpc<BatchItemActionResult>("actions:items:batch-equip", input),
  batchTransferItems: (input: BatchTransferItemsInput) =>
    invokeDesktopIpc<BatchItemActionResult>("actions:items:batch-transfer", input),
  startAccountWriteVerification: (input: AccountWriteVerificationInput) =>
    invokeDesktopIpc<BackgroundTaskSnapshot>("actions:verification:start", input),
  pullFromPostmaster: (input: PostmasterPullActionInput) =>
    invokeDesktopIpc<ItemActionResult>("actions:item:pull-postmaster", input),
  equipLoadout: (input: LoadoutEquipActionInput) =>
    invokeDesktopIpc<ItemActionResult>("actions:loadout:equip", input),
  snapshotLoadout: (input: LoadoutSnapshotActionInput) =>
    invokeDesktopIpc<ItemActionResult>("actions:loadout:snapshot", input),
  clearLoadout: (input: LoadoutClearActionInput) =>
    invokeDesktopIpc<ItemActionResult>("actions:loadout:clear", input),
  updateLoadoutIdentifiers: (input: LoadoutIdentifiersActionInput) =>
    invokeDesktopIpc<ItemActionResult>("actions:loadout:update-identifiers", input),
  getActionLog: () => ipcRenderer.invoke("actions:log:get") as Promise<ActionLogEntry[]>,
  recordActionDebugTrace: (input: ActionDebugTraceInput) =>
    ipcRenderer.invoke("actions:debug:record", input) as Promise<ActionDebugTraceEntry>,
  recordActionVerification: (input: ActionVerificationRecordInput) =>
    ipcRenderer.invoke("actions:verification:record", input) as Promise<ActionLogEntry>,
  createItemActionPlan: (input: ItemActionPlanInput) =>
    ipcRenderer.invoke("actions:plan:item", input) as Promise<ItemActionPlan>,
  createBatchTransferPlan: (input: { character_id: string; transfer_to_vault: boolean; items: AccountSummary["vault"]["items"] }) =>
    ipcRenderer.invoke("actions:plan:batch-transfer", input) as Promise<BatchTransferPlan>,
  getHomeBriefing: (options?: { force?: boolean }) => invokeDesktopIpc<HomeBriefing>("home:briefing", options),
  refreshHomeBriefing: () => invokeDesktopIpc<HomeBriefing>("home:briefing:refresh"),
  getDailySummary: () => invokeDesktopIpc<DailySummary>("daily:summary"),
  getWeeklySummary: () => invokeDesktopIpc<WeeklySummary>("weekly:summary"),
  getVendorInventory: (input: VendorInventoryRequest) =>
    ipcRenderer.invoke("vendors:inventory", input) as Promise<VendorInventorySnapshot>,
  getCachedVendorInventory: (input: VendorInventoryRequest) =>
    ipcRenderer.invoke("vendors:inventory:cached", input) as Promise<VendorInventorySnapshot | null>,
  refreshVendorInventory: (input: VendorInventoryRequest) =>
    ipcRenderer.invoke("vendors:inventory:refresh", input) as Promise<VendorInventorySnapshot>,
  getActivitySummary: (input: { membership_type: number; membership_id: string; character_ids: string[] }) =>
    ipcRenderer.invoke("activities:summary", input) as Promise<ActivityHistorySummary>,
  exportDiagnostics: () => ipcRenderer.invoke("diagnostics:export") as Promise<string>,
  getUpdateStatus: () => ipcRenderer.invoke("updates:get-status") as Promise<AppUpdateSnapshot>,
  checkForUpdates: () => ipcRenderer.invoke("updates:check") as Promise<AppUpdateSnapshot>,
  downloadUpdate: () => ipcRenderer.invoke("updates:download") as Promise<AppUpdateSnapshot>,
  quitAndInstallUpdate: () => ipcRenderer.invoke("updates:quit-and-install") as Promise<void>,
  openUpdateDownloadPage: () => ipcRenderer.invoke("updates:open-download-page") as Promise<void>,
  onUpdateStatusChanged: (callback: (snapshot: AppUpdateSnapshot) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: AppUpdateSnapshot) => callback(snapshot);
    ipcRenderer.on("updates:status", listener);
    return () => ipcRenderer.removeListener("updates:status", listener);
  },
  getCommunityPerkRecommendations: (item_hash: number, options?: { item_name?: string }) =>
    ipcRenderer.invoke("community:recommendations:get", item_hash, options) as Promise<WeaponRecommendation | null>,
  matchCommunityVaultItems: (items: VaultItemMatchInput[], options?: VaultCommunityMatchOptions) =>
    invokeDesktopIpc<VaultCommunityMatchResult>("community:vault:match", items, options),
  getCommunityVaultItemMatchEvidence: (item: VaultItemMatchInput) =>
    invokeDesktopIpc<VaultItemInstanceMatchInfo | null>("community:vault:evidence:get", item)
});

async function invokeDesktopIpc<TResult>(
  channel: string,
  ...args: unknown[]
): Promise<TResult> {
  try {
    return await ipcRenderer.invoke(channel, ...args) as TResult;
  } catch (error) {
    throw toDesktopIpcError(error, { channel });
  }
}

const desktopIpcTransportPrefix = "D2_IPC_ERROR:";

function toDesktopIpcError(
  error: unknown,
  details?: DesktopIpcErrorDetails
): Error & DesktopIpcErrorPayload {
  const payload = readDesktopIpcErrorPayload(error) ?? {
    code: "IPC_INVOKE_FAILED",
    message: errorMessage(error, "桌面服务调用失败"),
    retryable: true,
    causeCategory: "internal" as const
  };
  const ipcError = new Error(payload.message) as Error & DesktopIpcErrorPayload;
  ipcError.name = "DesktopIpcError";
  ipcError.code = payload.code;
  ipcError.retryable = payload.retryable;
  if (payload.causeCategory) ipcError.causeCategory = payload.causeCategory;
  if (details || payload.details) {
    ipcError.details = { ...payload.details, ...details };
  }
  return ipcError;
}

function readDesktopIpcErrorPayload(error: unknown): DesktopIpcErrorPayload | null {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const markerIndex = message.indexOf(desktopIpcTransportPrefix);
  if (markerIndex < 0) return null;
  try {
    const encoded = message.slice(markerIndex + desktopIpcTransportPrefix.length).trim();
    const parsed = JSON.parse(decodeURIComponent(encoded)) as Partial<DesktopIpcErrorPayload>;
    if (typeof parsed.code !== "string"
      || typeof parsed.message !== "string"
      || typeof parsed.retryable !== "boolean") {
      return null;
    }
    return parsed as DesktopIpcErrorPayload;
  } catch {
    return null;
  }
}

function errorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message
    .replace(/^Error invoking remote method '[^']+':\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .trim() || fallback;
}
