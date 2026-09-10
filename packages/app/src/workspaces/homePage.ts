import type { AccountSummary } from "@d2-tools/core/account/summary";
import type { LoadoutTemplate } from "@d2-tools/core/loadouts/templates";
import type {
  HomeDashboardDailySummary,
  HomeDashboardDiagnosticRow,
  HomeDashboardStartupState,
  HomeDashboardWeeklySummary,
  HomeDashboardWorkspace
} from "./homeDashboard.js";
import {
  homePageFocus,
  homePageLabels,
  homePageMetaMap,
  type HomePageKey
} from "./pageMetadata.js";
import type { LibraryViewMode } from "./libraryPage.js";

export type AssistantPageContext = {
  page_key: HomePageKey;
  page_label: string;
  focus: string;
  facts: string[];
};

export type HomePageModel = HomeDashboardWorkspace;

export type HomePageModelInput = {
  state: HomeDashboardStartupState;
  selectedCharacterId?: string;
  selectedCharacterLabel?: string;
  briefingFetchedAt?: string;
  diagnosticRows?: HomeDashboardDiagnosticRow[];
  diagnosticError?: string;
  accountError?: string;
  hasAccountData?: boolean;
  dailySummary?: HomeDashboardDailySummary | null;
  weeklySummary?: HomeDashboardWeeklySummary | null;
  dailyMessage?: string;
  dailyError?: string;
  isLoggingIn?: boolean;
  isLoadingAccount?: boolean;
  isInitializingManifest?: boolean;
  isRefreshingDiagnostics?: boolean;
  isLoadingDaily?: boolean;
  dailyResourceStatus?: HomePageModel["dailyResourceStatus"];
  dailyResourceSource?: HomePageModel["dailyResourceSource"];
};

export type HomePageDerivedState = {
  activePage: HomePageKey;
  account: AccountSummary | null;
  selectedCharacterId?: string | null;
  activeLoadoutName?: string | null;
  activeLoadoutTemplate?: LoadoutTemplate | null;
  libraryRecentNames?: string[];
  vaultFacts?: string[];
  libraryViewMode: LibraryViewMode;
  equipmentQuery: string;
  perkQuery: string;
  equipmentResultCount: number;
  perkResultCount: number;
  equipmentSearchTouched: boolean;
  perkSearchTouched: boolean;
  isAiConfigured: boolean;
  diagnosticRows: HomeDashboardDiagnosticRow[];
  pageMeta: { title: string; subtitle: string };
  assistantPageContext: AssistantPageContext;
  loadoutFacts: string[];
  libraryFacts: string[];
};

export function selectHomePageModel(input: HomePageModelInput): HomePageModel {
  return {
    state: input.state,
    selectedCharacterId: input.selectedCharacterId,
    selectedCharacterLabel: input.selectedCharacterLabel,
    briefingFetchedAt: input.briefingFetchedAt,
    diagnosticRows: input.diagnosticRows ?? [],
    diagnosticError: input.diagnosticError ?? "",
    accountError: input.accountError ?? "",
    hasAccountData: input.hasAccountData ?? false,
    dailySummary: input.dailySummary ?? null,
    weeklySummary: input.weeklySummary ?? null,
    dailyMessage: input.dailyMessage ?? "",
    dailyError: input.dailyError ?? "",
    isLoggingIn: input.isLoggingIn ?? false,
    isLoadingAccount: input.isLoadingAccount ?? false,
    isInitializingManifest: input.isInitializingManifest ?? false,
    isRefreshingDiagnostics: input.isRefreshingDiagnostics ?? false,
    isLoadingDaily: input.isLoadingDaily ?? false,
    dailyResourceStatus: input.dailyResourceStatus ?? (input.dailySummary ? "ready" : input.isLoadingDaily ? "loading" : "unavailable"),
    dailyResourceSource: input.dailyResourceSource ?? "merged"
  };
}

export function createHomePageDerivedState(input: Omit<HomePageDerivedState, "pageMeta" | "assistantPageContext" | "loadoutFacts" | "libraryFacts"> & {
  loadoutFacts?: string[];
  libraryFacts?: string[];
}): HomePageDerivedState {
  const loadoutFacts = input.loadoutFacts ?? buildLoadoutContextFacts({
    template: input.activeLoadoutTemplate ?? null,
    account: input.account
  });
  const libraryFacts = input.libraryFacts ?? buildLibraryContextFacts({
    viewMode: input.libraryViewMode,
    equipmentQuery: input.equipmentQuery,
    perkQuery: input.perkQuery,
    equipmentResultCount: input.equipmentResultCount,
    perkResultCount: input.perkResultCount,
    equipmentSearchTouched: input.equipmentSearchTouched,
    perkSearchTouched: input.perkSearchTouched
  });

  return {
    ...input,
    loadoutFacts,
    libraryFacts,
    pageMeta: resolvePageMeta(input.activePage),
    assistantPageContext: buildAssistantPageContext({
      activePage: input.activePage,
      account: input.account,
      selectedCharacterId: input.selectedCharacterId,
      activeLoadoutName: input.activeLoadoutName,
      libraryRecentNames: input.libraryRecentNames,
      vaultFacts: input.vaultFacts,
      loadoutFacts,
      libraryFacts
    })
  };
}

export function buildLoadoutContextFacts(input: {
  template: LoadoutTemplate | null;
  account: AccountSummary | null;
}): string[] {
  if (!input.template) {
    return ["当前没有选中的本地配装方案。"];
  }
  if (!input.account) {
    return [`配装方案：${input.template.name}，共 ${input.template.items.length} 件装备；账号数据未读取，暂不能判断缺失。`];
  }

  const knownItems = collectAccountItems(input.account);
  const readyCount = input.template.items.filter((item) => knownItems.some((knownItem) =>
    item.instance_id
      ? knownItem.instance_id === item.instance_id
      : knownItem.hash === item.hash
  )).length;
  const missingCount = Math.max(input.template.items.length - readyCount, 0);

  return [`配装缺失：${missingCount} 件，已找到 ${readyCount} / ${input.template.items.length} 件。`];
}

export function buildLibraryContextFacts(input: {
  viewMode: LibraryViewMode;
  equipmentQuery: string;
  perkQuery: string;
  equipmentResultCount: number;
  perkResultCount: number;
  equipmentSearchTouched: boolean;
  perkSearchTouched: boolean;
}): string[] {
  if (input.viewMode === "weekly_farming") {
    return ["资料库搜索：当前在本周刷取模式，展示本周可刷活动的掉落清单。"];
  }

  const isPerkMode = input.viewMode === "perks";
  const query = isPerkMode ? input.perkQuery : input.equipmentQuery;
  const touched = isPerkMode ? input.perkSearchTouched : input.equipmentSearchTouched;
  const count = isPerkMode ? input.perkResultCount : input.equipmentResultCount;
  const modeLabel = isPerkMode ? "Perk" : "装备";

  return [
    touched
      ? `资料库搜索：${modeLabel}${query.trim() ? ` / ${query.trim()}` : ""}，命中 ${count} 条。`
      : `资料库搜索：当前在${modeLabel}模式，尚未执行搜索。`
  ];
}

export function resolvePageMeta(page: HomePageKey) {
  return homePageMetaMap[page] ?? homePageMetaMap.home;
}

function buildAssistantPageContext(input: {
  activePage: HomePageKey;
  account: AccountSummary | null;
  selectedCharacterId?: string | null;
  activeLoadoutName?: string | null;
  libraryRecentNames?: string[];
  vaultFacts?: string[];
  loadoutFacts?: string[];
  libraryFacts?: string[];
}): AssistantPageContext {
  const selectedCharacter = input.account?.characters.find((character) => character.character_id === input.selectedCharacterId)
    ?? input.account?.characters[0]
    ?? null;
  const facts = [
    input.account
      ? `账号已读取：${input.account.characters.length} 个角色，仓库 ${input.account.vault.item_count} 件装备，材料 ${input.account.materials.item_count} 种。`
      : "账号数据未读取。",
    selectedCharacter
      ? `当前角色：${selectedCharacter.class_name}，光等 ${selectedCharacter.light}。`
      : "当前没有可用角色。",
    input.activeLoadoutName ? `当前配装方案：${input.activeLoadoutName}` : "",
    input.libraryRecentNames?.length ? `最近查看资料：${input.libraryRecentNames.slice(0, 5).join(" / ")}` : "",
    ...(input.vaultFacts ?? []),
    ...(input.loadoutFacts ?? []),
    ...(input.libraryFacts ?? [])
  ].filter(Boolean);

  return {
    page_key: input.activePage,
    page_label: homePageLabels[input.activePage],
    focus: homePageFocus[input.activePage],
    facts
  };
}

function collectAccountItems(account: AccountSummary) {
  return [
    ...account.characters.flatMap((character) => [
      ...character.equipped_items,
      ...character.inventory_items,
      ...character.postmaster_items
    ]),
    ...account.vault.items
  ];
}
