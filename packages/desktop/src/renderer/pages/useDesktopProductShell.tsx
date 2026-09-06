import {
  ControlButton,
  buildVaultCleanupProtectionIndex,
  getLocaleCopy,
  ShellSidebarAccountSummary,
  ShellSidebarActions,
  StartupGate,
  type ProductPreferences,
  type ShellAssistantMode,
  type ShellBackgroundTaskItem,
  type ShellPageKey,
  type ShellStatusItem
} from "@d2-tools/ui";
import { buildVendorItemSourcePaths } from "@d2-tools/app/vendors";
import { getAllKnownAccountItemsWithSource } from "@d2-tools/app/loadouts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import type { AccountSummary, AppUpdateSnapshot, BackgroundTaskSnapshot, ManifestStatus, StartupState } from "../api/types";
import { GlobalAssistantSidebar } from "../components/GlobalAssistantSidebar";
import { useAccountWorkspace } from "../features/account/useAccountWorkspace";
import { useDailySummary } from "../features/daily/useDailySummary";
import { useHomePageDerivedState } from "../features/home/useHomePageDerivedState";
import { useLibraryWorkspace } from "../features/library/useLibraryWorkspace";
import { useLoadoutTemplates } from "../features/loadouts/useLoadoutTemplates";
import { useLocalLoadoutPlans } from "../features/loadouts/useLocalLoadoutPlans";
import { useDiagnosticsSettings } from "../features/settings/useDiagnosticsSettings";
import { useVendorsWorkspace } from "../features/vendors/useVendorsWorkspace";
import { useVendorDefinitionDetail } from "../features/vendors/useVendorDefinitionDetail";
import type { DesktopMenuSession } from "./providers/DesktopMenuProviderContext";
import {
  useDesktopProductWriteActions,
  type AccountWriteSyncActivity
} from "./useDesktopProductWriteActions";

type SettingsInitialSection = "overview" | "account" | "library" | "bungie";

const ACCOUNT_AUTO_REFRESH_INTERVAL_MS = 10 * 60_000;
const ACCOUNT_RESUME_REVALIDATE_MS = 2 * 60_000;
const ACCOUNT_STATUS_STALE_THRESHOLD_MS = 12 * 60_000;

export function useDesktopProductShell(props: {
  state: StartupState;
  onConfigChanged: () => void;
  onLoginComplete: () => void;
  onManifestInitialized: () => void;
}) {
  const visualEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const visualInitialPage = visualEnv?.VITE_D2_VISUAL_PAGE;
  const visualColorMode = isColorMode(visualEnv?.VITE_D2_VISUAL_THEME) ? visualEnv?.VITE_D2_VISUAL_THEME : undefined;
  const startupStep = props.state.nextStep;
  const initialPage: ShellPageKey = isShellPageKey(visualInitialPage)
    ? visualInitialPage
    : "home";
  const [activePage, setActivePage] = useState<ShellPageKey>(initialPage);
  const [settingsInitialSection, setSettingsInitialSection] = useState<SettingsInitialSection>(
    props.state.cards.bungieConfig.status === "missing" ? "bungie" : "overview"
  );
  const [assistantMode, setAssistantMode] = useState<ShellAssistantMode>(null);
  const vaultFactsRef = useRef<string[]>([]);
  const setVaultFacts = useCallback((facts: string[]) => {
    if (sameStringArray(vaultFactsRef.current, facts)) return;
    vaultFactsRef.current = facts;
  }, []);
  const [vaultLocateRequest, setVaultLocateRequest] = useState<{
    hash: number;
    name: string;
    requestId: number;
  } | null>(null);
  const [vaultTargetLocateRequest, setVaultTargetLocateRequest] = useState<{
    targetId: string;
    requestId: number;
  } | null>(null);
  const [armorResultTraceRequest, setArmorResultTraceRequest] = useState<{
    resultId: string;
    candidateId: string;
    requestId: number;
  } | null>(null);
  const isVisualCapture = visualEnv?.VITE_D2_VISUAL_CAPTURE === "1";
  const daily = useDailySummary();
  const diagnostics = useDiagnosticsSettings({
    onConfigChanged: props.onConfigChanged,
    initialColorMode: visualColorMode ?? props.state.colorMode,
    initialDensity: props.state.density ?? "standard",
    initialLanguagePreferences: props.state.languagePreferences
  });
  const desktopPlatformActions = useMemo(() => ({
    openExternal: (url: string) => window.d2.openExternal(url),
    setColorMode: (mode: "light" | "dark") => window.d2?.setWindowColorMode?.(mode),
    windowControls: {
      minimize: () => window.d2.minimizeWindow(),
      toggleMaximize: () => window.d2.toggleMaximizeWindow(),
      close: () => window.d2.closeWindow()
    }
  }), []);
  const accountWorkspace = useAccountWorkspace({
    state: props.state,
    diagnostics,
    onLoginComplete: props.onLoginComplete,
    onManifestInitialized: props.onManifestInitialized
  });
  const {
    accountSummary,
    applyCommittedAccountActionPatches,
    confirmCommittedAccountActionPatches,
    discardCommittedAccountActionPatches,
    pendingCommittedAccountPatchCount,
    vaultTags,
    setVaultTags,
    accountError,
    setAccountError,
    accountWarning,
    isLoadingAccount,
    lastAccountLoadedAt,
    selectedCharacterId,
    activitySummary,
    importedWishlist,
    localTargetRules,
    setLocalTargetRules,
    equipmentTargetStore,
    setEquipmentTargetStore,
    vaultCommunityInstanceMatch,
    refreshAccountSnapshot
  } = accountWorkspace;
  const refreshAccountAfterWrite = () => refreshAccountSnapshot("write-action");
  const reloadAccountAfterWrite = async () => {
    await refreshAccountSnapshot("write-action");
  };
  const vendorsWorkspace = useVendorsWorkspace({
    accountSummary,
    selectedCharacterId,
    active: activePage === "vendors",
    loadCachedInventory: api.getCachedVendorInventory,
    loadInventory: api.refreshVendorInventory
  });
  const vendorSourcePaths = useMemo(
    () => buildVendorItemSourcePaths(vendorsWorkspace.model),
    [vendorsWorkspace.model]
  );
  const itemDetailCacheScopeKey = useMemo(() => [
    accountSummary
      ? `${accountSummary.membership_type}:${accountSummary.destiny_membership_id}`
      : "signed-out",
    diagnostics.manifestStatus?.version ?? "manifest-unavailable",
    diagnostics.manifestStatus?.language ?? ""
  ].join("\u0000"), [
    accountSummary?.destiny_membership_id,
    accountSummary?.membership_type,
    diagnostics.manifestStatus?.language,
    diagnostics.manifestStatus?.version
  ]);
  const library = useLibraryWorkspace({ vendorSourcePaths });
  const loadoutLibrary = useLoadoutTemplates();
  const cleanupProtectedItemKeys = useMemo(() => ({
    instanceIds: new Set([
      ...loadoutLibrary.templates.flatMap((template) => (
        template.items.flatMap((item) => item.instance_id ? [item.instance_id] : [])
      )),
      ...(accountSummary?.characters.flatMap((character) => (
        character.loadout_slots.flatMap((slot) => (
          slot.items.flatMap((item) => item.instance_id ? [item.instance_id] : [])
        ))
      )) ?? [])
    ]),
    bucketHashKeys: new Set<string>(),
    hashKeys: new Set<number>()
  }), [accountSummary?.characters, loadoutLibrary.templates]);
  const itemDetailCleanupProtection = useMemo(() => accountSummary
    ? buildVaultCleanupProtectionIndex({
        items: getAllKnownAccountItemsWithSource(accountSummary),
        tags: vaultTags,
        highlightedItemKeys: cleanupProtectedItemKeys,
        communityInstanceMatch: vaultCommunityInstanceMatch,
        recommendationReady: accountWorkspace.vaultRecommendationScan.phase === "complete"
      })
    : new Map<string, string[]>(), [
      accountSummary,
      cleanupProtectedItemKeys,
      accountWorkspace.vaultRecommendationScan.phase,
      vaultCommunityInstanceMatch,
      vaultTags
    ]);
  const localLoadoutPlans = useLocalLoadoutPlans({ refreshAccount: refreshAccountAfterWrite });
  const writeActions = useDesktopProductWriteActions({
    accountSummary,
    applyCommittedAccountActionPatches,
    confirmCommittedAccountActionPatches,
    discardCommittedAccountActionPatches,
    pendingCommittedAccountPatchCount,
    diagnostics,
    vaultTags,
    setVaultTags,
    importedWishlist,
    localTargetRules,
    cleanupProtectionByItemKey: itemDetailCleanupProtection,
    itemDetailCacheScopeKey,
    recommendationRevision: accountWorkspace.vaultRecommendationScan.recommendation_revision,
    setAccountError,
    loadAccountSummary: reloadAccountAfterWrite,
    loadoutLibrary,
    onRecentHistoryChanged: library.setLibraryHistory
  });
  const accountWriteSyncActivity = writeActions.accountWriteSyncActivity;
  const refreshAccountManually = () => {
    writeActions.clearCompletedWriteFeedback();
    return refreshAccountSnapshot("manual");
  };
  const itemDetail = writeActions.itemDetail;
  const vendorDefinitionDetail = useVendorDefinitionDetail({ vendorSourcePaths, vaultTags });
  const isRunningItemAction = writeActions.isRunningItemAction;

  function handlePageChange(page: ShellPageKey) {
    if (startupStep !== "home" && page !== "home" && page !== "settings") return;
    itemDetail.closeSelectedItemDetail();
    vendorDefinitionDetail.close();
    if (page === "settings") {
      setSettingsInitialSection("overview");
    }
    setActivePage(page);
  }

  function openBungieSettings() {
    setSettingsInitialSection("bungie");
    itemDetail.closeSelectedItemDetail();
    vendorDefinitionDetail.close();
    setActivePage("settings");
  }

  function openStartupSettings() {
    setSettingsInitialSection(startupStep === "bungie-config" ? "bungie" : "account");
    itemDetail.closeSelectedItemDetail();
    vendorDefinitionDetail.close();
    setActivePage("settings");
  }

  function openBackgroundTasks(task?: ShellBackgroundTaskItem) {
    setSettingsInitialSection(task?.type?.startsWith("manifest-") ? "library" : "overview");
    setActivePage("settings");
  }

  function locateVaultItem(item: { hash: number; name: string }) {
    setVaultLocateRequest((current) => ({
      ...item,
      requestId: (current?.requestId ?? 0) + 1
    }));
    setActivePage("vault");
  }

  function locateVaultTarget(targetId: string) {
    setVaultTargetLocateRequest((current) => ({
      targetId,
      requestId: (current?.requestId ?? 0) + 1
    }));
    setActivePage("vault");
  }

  function locateArmorResultReference(reference: { resultId: string; candidateId: string }) {
    setArmorResultTraceRequest((current) => ({
      ...reference,
      requestId: (current?.requestId ?? 0) + 1
    }));
    setActivePage("loadouts");
  }

  useEffect(() => {
    if (isVisualCapture) {
      return;
    }
    void diagnostics.refreshDiagnostics();
    void library.loadLibraryHistory();
  }, [isVisualCapture]);

  const isManifestReady = diagnostics.manifestStatus
    ? Boolean(
        diagnostics.manifestStatus.initialized
        && !diagnostics.manifestStatus.missing_required_components?.length
      )
    : props.state.cards.manifest.status === "ready";
  const canRefreshAccount = props.state.cards.bungieConfig.status === "ready"
    && props.state.cards.account.status === "ready";
  const refreshAccountRef = useRef(refreshAccountSnapshot);
  const lastAccountLoadedAtRef = useRef(lastAccountLoadedAt);
  refreshAccountRef.current = refreshAccountSnapshot;
  lastAccountLoadedAtRef.current = lastAccountLoadedAt;

  useEffect(() => {
    if (isVisualCapture || !canRefreshAccount) return undefined;

    const refreshIfDue = () => {
      if (document.visibilityState !== "visible" || navigator.onLine === false) return;
      const loadedAt = lastAccountLoadedAtRef.current;
      if (loadedAt && Date.now() - loadedAt.getTime() < ACCOUNT_AUTO_REFRESH_INTERVAL_MS) return;
      void refreshAccountRef.current("auto");
    };
    refreshIfDue();
    const intervalId = window.setInterval(refreshIfDue, ACCOUNT_AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [canRefreshAccount, isVisualCapture]);

  useEffect(() => {
    if (isVisualCapture || !canRefreshAccount) return undefined;

    const refreshAfterResume = () => {
      if (document.visibilityState !== "visible" || navigator.onLine === false) return;
      const loadedAt = lastAccountLoadedAtRef.current;
      if (loadedAt && Date.now() - loadedAt.getTime() < ACCOUNT_RESUME_REVALIDATE_MS) return;
      void refreshAccountRef.current("auto");
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshAfterResume();
    };
    window.addEventListener("focus", refreshAfterResume);
    window.addEventListener("online", refreshAfterResume);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", refreshAfterResume);
      window.removeEventListener("online", refreshAfterResume);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [canRefreshAccount, isVisualCapture]);

  useEffect(() => {
    if (startupStep !== "home") {
      setActivePage("home");
    } else {
      setActivePage((current) => current === "settings" ? "home" : current);
    }
  }, [startupStep]);

  useEffect(() => {
    if (isVisualCapture || !isManifestReady) return;
    void daily.loadDailySummary();
  }, [isManifestReady, isVisualCapture]);

  const activeLoadoutTemplate = loadoutLibrary.activeTemplate;
  const homeDerivedState = useHomePageDerivedState({
    activePage,
    state: props.state,
    accountSummary,
    selectedCharacterId,
    activeLoadoutTemplate,
    library,
    diagnostics
  });
  const currentPageMeta = homeDerivedState.currentPageMeta;
  const baseAssistantPageContext = homeDerivedState.assistantPageContext;
  const getAssistantPageContext = useCallback(() => (
    activePage === "vault" && vaultFactsRef.current.length
      ? {
          ...baseAssistantPageContext,
          facts: [...baseAssistantPageContext.facts, ...vaultFactsRef.current]
        }
      : baseAssistantPageContext
  ), [activePage, baseAssistantPageContext]);
  const assistantPageContext = getAssistantPageContext();
  const isAiConfigured = homeDerivedState.isAiConfigured;
  const appUpdateSnapshot = diagnostics.appUpdateSnapshot;
  const shellStatus = buildShellStatus({
    manifestStatus: diagnostics.manifestStatus,
    manifestStatusError: diagnostics.manifestStatusError,
    manifestTask: diagnostics.manifestTask,
    accountSummary,
    lastAccountLoadedAt,
    isLoadingAccount,
    accountWriteSyncActivity,
    accountError,
    accountWarning,
    isShowingCachedAccount: accountWorkspace.isShowingCachedAccount,
    canRefreshAccount,
    isBungieConfigured: props.state.cards.bungieConfig.status === "ready",
    isAiConfigured,
    appUpdateSnapshot,
    interfaceLocale: diagnostics.languagePreferences.interfaceLocale,
    onRepairManifest: () => void diagnostics.repairManifest(),
    onOpenAppUpdateSettings: () => {
      setSettingsInitialSection("overview");
      handlePageChange("settings");
    }
  });

  const productPreferences: ProductPreferences = {
    ...diagnostics.languagePreferences,
    colorMode: diagnostics.colorMode,
    density: diagnostics.density
  };

  function handleProductPreferencesChange(preferences: ProductPreferences) {
    if (preferences.colorMode !== diagnostics.colorMode) {
      void diagnostics.toggleColorMode();
    }

    const density = preferences.density ?? "standard";
    if (density !== diagnostics.density) {
      void diagnostics.saveDensity(density);
    }

    if (
      preferences.interfaceLocale !== diagnostics.languagePreferences.interfaceLocale
      || preferences.bungieLocale !== diagnostics.languagePreferences.bungieLocale
      || preferences.followInterfaceLocaleForBungie !== diagnostics.languagePreferences.followInterfaceLocaleForBungie
    ) {
      void diagnostics.saveLanguagePreferences({
        interfaceLocale: preferences.interfaceLocale,
        bungieLocale: preferences.bungieLocale,
        followInterfaceLocaleForBungie: preferences.followInterfaceLocaleForBungie
      });
    }
  }

  const menuSession: DesktopMenuSession = {
    state: props.state,
    onConfigure: openBungieSettings,
    onConfigChanged: props.onConfigChanged,
    setActivePage,
    settingsInitialSection,
    setSettingsInitialSection,
    setVaultFacts,
    vaultLocateRequest,
    locateVaultItem,
    vaultTargetLocateRequest,
    locateVaultTarget,
    armorResultTraceRequest,
    locateArmorResultReference,
    dismissArmorResultTrace: () => setArmorResultTraceRequest(null),
    lastAccountLoadedAt,
    refreshAccountManually,
    account: accountWorkspace,
    daily,
    diagnostics,
    home: homeDerivedState,
    library,
    loadouts: loadoutLibrary,
    localLoadoutPlans,
    vendors: vendorsWorkspace,
    vendorDefinitionDetail,
    writeActions
  };

  const assistantPanel = (
    <GlobalAssistantSidebar
      assistantMode={assistantMode}
      isConfigured={isAiConfigured}
      account={accountSummary}
      daily={daily.dailySummary}
      activity={activitySummary}
      pageContext={assistantPageContext}
      getPageContext={getAssistantPageContext}
      tags={vaultTags}
      isLoadingAccount={isLoadingAccount}
      onLoadAccount={() => void refreshAccountManually()}
      onConfigureAi={() => {
        setActivePage("settings");
        setAssistantMode(null);
      }}
      onOpenArtifact={(artifact) => {
        localLoadoutPlans.prefillFromAssistant(artifact);
        setActivePage("loadouts");
        setAssistantMode(null);
      }}
      onClose={() => setAssistantMode(null)}
    />
  );

  return {
    activePage,
    assistantMode,
    assistantPanel,
    backgroundTasks: diagnostics.backgroundTasks,
    openBackgroundTasks,
    handleAssistantModeChange: setAssistantMode,
    handlePageChange,
    handleProductPreferencesChange,
    itemDetailModalProps: {
      accountSummary,
      accountOperationFeedback: writeActions.accountOperationFeedback,
      aiSettingsEnableLightgg: diagnostics.aiSettings.enable_lightgg,
      importedWishlist,
      itemDetail,
      isRunningItemAction,
      localTargetRules,
      equipmentTargetStore,
      communityInstanceMatch: vaultCommunityInstanceMatch,
      recommendationScan: accountWorkspace.vaultRecommendationScan,
      onLocateOwnedItem: locateVaultItem,
      interfaceLocale: diagnostics.languagePreferences.interfaceLocale,
      vendorDefinitionDetail,
      vaultTags
    },
    menuSession,
    startupGate: startupStep !== "home" && activePage !== "settings" ? (
      <StartupGate
        step={startupStep}
        isManifestReady={isManifestReady}
        isManifestBusy={diagnostics.isInitializingManifest}
        manifestError={diagnostics.manifestStatusError}
        isBusy={accountWorkspace.isLoggingIn}
        error={accountWorkspace.loginError || accountWorkspace.accountError}
        onConfigure={openBungieSettings}
        onLogin={() => void accountWorkspace.loginBungie()}
        onOpenSettings={openStartupSettings}
      />
    ) : null,
    pageHeader: {
      title: currentPageMeta.title,
      subtitle: currentPageMeta.subtitle,
      actions: activePage === "home" ? (
        daily.dailyError ? null : (
          <ControlButton
            variant="secondary"
            aria-busy={daily.isLoadingDaily}
            disabled={daily.isLoadingDaily || !isManifestReady}
            onClick={() => void daily.loadDailySummary(true)}
          >
            刷新公开情报
          </ControlButton>
        )
      ) : activePage === "account" ? (
        accountSummary ? (
          <>
            <ControlButton variant="secondary" disabled={accountWorkspace.isLoggingIn} onClick={() => void accountWorkspace.loginBungie()}>重新登录 Bungie</ControlButton>
            <ControlButton variant="primary" aria-busy={isLoadingAccount} disabled={isLoadingAccount} onClick={() => void refreshAccountManually()}>同步装备数据</ControlButton>
          </>
        ) : null
      ) : activePage === "vault" ? (
        accountSummary ? <ControlButton variant="primary" aria-busy={isLoadingAccount} disabled={isLoadingAccount} onClick={() => void refreshAccountManually()}>同步装备数据</ControlButton> : null
      ) : activePage === "library" ? (
        <>
          <ControlButton onClick={() => void diagnostics.refreshManifestStatus()}>重新检查资料库</ControlButton>
          <ControlButton variant="primary" disabled={diagnostics.isInitializingManifest} onClick={() => void diagnostics.repairManifest()}>修复资料库</ControlButton>
        </>
      ) : activePage === "vendors" ? (
        accountSummary && vendorsWorkspace.model.vendors.length ? <ControlButton variant={vendorsWorkspace.model.statusBanner?.tone === "error" ? "primary" : "secondary"} aria-busy={vendorsWorkspace.isManualRefreshing} disabled={vendorsWorkspace.isManualRefreshing} onClick={() => void vendorsWorkspace.refresh()}>刷新商人库存</ControlButton> : null
      ) : null
    },
    platformActions: desktopPlatformActions,
    productPreferences,
    sidebarHeader: (
      <ShellSidebarAccountSummary
        accountName={accountSummary?.account_name}
        characterCount={accountSummary?.characters.length}
        vaultItemCount={accountSummary?.vault.item_count}
        vaultCapacity={accountSummary?.vault.capacity}
      />
    ),
    sidebarFooter: (
      <ShellSidebarActions
        isAiOpen={assistantMode !== null}
        onToggleAi={() => setAssistantMode((current) => current === null ? "ai" : null)}
      />
    ),
    shellStatus
  };
}

function buildShellStatus(input: {
  manifestStatus: ManifestStatus | null;
  manifestStatusError: string;
  manifestTask: BackgroundTaskSnapshot | null;
  accountSummary: AccountSummary | null;
  lastAccountLoadedAt: Date | null;
  isLoadingAccount: boolean;
  accountWriteSyncActivity: AccountWriteSyncActivity;
  accountError: string;
  accountWarning: string;
  isShowingCachedAccount: boolean;
  canRefreshAccount: boolean;
  isBungieConfigured: boolean;
  isAiConfigured: boolean;
  appUpdateSnapshot: AppUpdateSnapshot | null;
  interfaceLocale: ProductPreferences["interfaceLocale"];
  onRepairManifest: () => void;
  onOpenAppUpdateSettings: () => void;
}): ShellStatusItem[] {
  const needsLibraryRepair = Boolean(input.manifestStatus?.missing_required_components?.length);
  const waitingForBungieConfig = !input.isBungieConfigured;
  const accountSnapshotStale = isAccountSnapshotStale(input.lastAccountLoadedAt);
  const shellCopy = getLocaleCopy(input.interfaceLocale).shell;
  const appUpdateStatus = getAppUpdateShellStatus(input.appUpdateSnapshot, shellCopy.update);

  return [
    {
      key: "bungie",
      label: "Bungie",
      value: input.isBungieConfigured ? "已配置" : "未配置",
      tone: input.isBungieConfigured ? "ready" : "warning",
      priority: input.isBungieConfigured ? "quiet" : "attention"
    },
    {
      key: "account",
      label: "账号",
      value: formatAccountShellStatus(input.accountSummary, input.lastAccountLoadedAt, input.isLoadingAccount, input.accountWriteSyncActivity, input.isShowingCachedAccount, input.accountError, input.accountWarning, input.canRefreshAccount),
      tone: getAccountStatusTone(input.accountSummary, input.lastAccountLoadedAt, input.isLoadingAccount, input.accountWriteSyncActivity, input.isShowingCachedAccount, input.accountError, input.accountWarning, input.canRefreshAccount),
      priority: input.accountError || input.accountWarning || accountSnapshotStale || input.isLoadingAccount || input.accountWriteSyncActivity.active ? "attention" : "standard",
      kind: "task",
      active: input.isLoadingAccount || input.accountWriteSyncActivity.active
    },
    {
      key: "library",
      label: "资料库",
      value: waitingForBungieConfig
        ? "等待配置"
        : input.manifestStatusError
        ? "检查失败"
        : (needsLibraryRepair ? "修复资料库" : formatManifestShellStatus(input.manifestStatus, input.manifestTask, input.interfaceLocale)),
      tone: waitingForBungieConfig ? "neutral" : input.manifestStatusError ? "error" : input.manifestTask && ["queued", "running", "retrying"].includes(input.manifestTask.status) ? "pending" : getManifestStatusTone(input.manifestStatus),
      priority: waitingForBungieConfig ? "standard" : input.manifestStatusError || needsLibraryRepair || input.manifestTask?.availability === "blocked" ? "attention" : "standard",
      actionLabel: waitingForBungieConfig || !needsLibraryRepair ? undefined : "修复资料库",
      onAction: waitingForBungieConfig || !needsLibraryRepair ? undefined : input.onRepairManifest
    },
    {
      key: "ai",
      label: "AI",
      value: input.isAiConfigured ? "已配置" : "未配置",
      tone: input.isAiConfigured ? "ready" : "warning",
      priority: input.isAiConfigured ? "quiet" : "standard"
    },
    {
      key: "app-version",
      kind: "update",
      ...appUpdateStatus,
      actionLabel: appUpdateStatus.priority === "quiet" ? undefined : shellCopy.update.open,
      onAction: appUpdateStatus.priority === "quiet" ? undefined : input.onOpenAppUpdateSettings
    }
  ];
}

function formatAccountShellStatus(
  accountSummary: AccountSummary | null,
  lastAccountLoadedAt: Date | null,
  isLoadingAccount: boolean,
  accountWriteSyncActivity: AccountWriteSyncActivity,
  isShowingCachedAccount: boolean,
  accountError: string,
  accountWarning: string,
  canRefreshAccount: boolean
): string {
  if (accountError && accountSummary) return "同步失败 · 显示上次装备数据";
  if (accountError) return "读取失败";
  if (accountWriteSyncActivity.active) {
    if (accountWriteSyncActivity.phase === "finalizing") return "正在核对最终状态";
    if (accountWriteSyncActivity.delayed) return "游戏数据延迟";
    return accountWriteSyncActivity.pendingCount > 0
      ? `${accountWriteSyncActivity.pendingCount} 项待确认`
      : "等待游戏状态";
  }
  if (isLoadingAccount) return accountSummary ? "正在同步装备数据" : "正在读取装备数据";
  if (accountWarning && accountSummary) return "增强数据异常";
  if (accountSummary) {
    const loadedAt = formatTime(lastAccountLoadedAt);
    if (isShowingCachedAccount) return loadedAt ? `本地缓存 · ${loadedAt}` : "本地缓存";
    const snapshotAge = getAccountSnapshotAge(lastAccountLoadedAt);
    if (snapshotAge !== undefined && snapshotAge > ACCOUNT_STATUS_STALE_THRESHOLD_MS) {
      return `待同步 · ${formatAccountAge(snapshotAge)}`;
    }
    return loadedAt ? `已核对 · ${loadedAt}` : "已核对";
  }
  return canRefreshAccount ? "可同步" : "未登录";
}

function getAccountStatusTone(
  accountSummary: AccountSummary | null,
  lastAccountLoadedAt: Date | null,
  isLoadingAccount: boolean,
  accountWriteSyncActivity: AccountWriteSyncActivity,
  isShowingCachedAccount: boolean,
  accountError: string,
  accountWarning: string,
  canRefreshAccount: boolean
): ShellStatusItem["tone"] {
  if (accountError) return "error";
  if (accountWriteSyncActivity.active) return accountWriteSyncActivity.delayed ? "warning" : "pending";
  if (isLoadingAccount) return "pending";
  if (isShowingCachedAccount && accountSummary) return "warning";
  if (accountWarning && accountSummary) return "warning";
  if (isAccountSnapshotStale(lastAccountLoadedAt)) return "warning";
  if (accountSummary) return "ready";
  return canRefreshAccount ? "warning" : "neutral";
}

function isAccountSnapshotStale(lastAccountLoadedAt: Date | null): boolean {
  const age = getAccountSnapshotAge(lastAccountLoadedAt);
  return age !== undefined && age > ACCOUNT_STATUS_STALE_THRESHOLD_MS;
}

function getAccountSnapshotAge(lastAccountLoadedAt: Date | null): number | undefined {
  return lastAccountLoadedAt ? Math.max(0, Date.now() - lastAccountLoadedAt.getTime()) : undefined;
}

function formatAccountAge(ageMs: number): string {
  const seconds = Math.max(1, Math.round(ageMs / 1000));
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  return `${Math.round(minutes / 60)} 小时`;
}

function formatManifestShellStatus(
  status: ManifestStatus | null,
  task: BackgroundTaskSnapshot | null,
  interfaceLocale: ProductPreferences["interfaceLocale"]
): string {
  if (task && ["queued", "running", "retrying"].includes(task.status)) {
    if (task.status === "retrying") return interfaceLocale === "en-US" ? "Waiting to retry" : "等待重试";
    const phase = formatManifestTaskPhase(task.phase, interfaceLocale);
    const progress = task.progress_percent === undefined ? "" : ` ${Math.round(task.progress_percent)}%`;
    if (phase) return `${phase}${progress}`;
    return task.availability === "usable"
      ? interfaceLocale === "en-US" ? "Updating" : "后台更新"
      : interfaceLocale === "en-US" ? "Preparing" : "准备中";
  }
  if (!status) return "读取中";
  if (!status.initialized) return "未准备";
  if (status.missing_required_components?.length) return "需修复";
  if (status.needs_update) return "可更新";
  return formatLibraryVersion(status.version) ?? "可用";
}

function formatManifestTaskPhase(
  phase: string | undefined,
  interfaceLocale: ProductPreferences["interfaceLocale"]
): string | undefined {
  if (!phase) return undefined;
  const labels: Record<string, string> = interfaceLocale === "en-US"
    ? {
        metadata: "Checking",
        download: "Downloading",
        extract: "Extracting",
        validate: "Verifying",
        index: "Indexing",
        "download-secondary": "Downloading helper data",
        "index-secondary": "Indexing helper data",
        "reuse-local": "Rebuilding index",
        activate: "Switching"
      }
    : {
        metadata: "检查版本",
        download: "下载中",
        extract: "解压中",
        validate: "校验中",
        index: "建立索引",
        "download-secondary": "下载辅助数据",
        "index-secondary": "建立辅助索引",
        "reuse-local": "重建索引",
        activate: "切换中"
      };
  return labels[phase];
}

function getAppUpdateShellStatus(
  snapshot: AppUpdateSnapshot | null,
  copy: ReturnType<typeof getLocaleCopy>["shell"]["update"]
): Pick<ShellStatusItem, "label" | "value" | "tone" | "priority"> {
  if (!snapshot) {
    return { label: copy.versionLabel, value: copy.reading, tone: "neutral", priority: "quiet" };
  }

  const currentVersion = formatAppVersion(snapshot.current_version);
  const availableVersion = snapshot.available_version ? formatAppVersion(snapshot.available_version) : undefined;
  const downloadedVersion = snapshot.downloaded_version
    ? formatAppVersion(snapshot.downloaded_version)
    : availableVersion;

  switch (snapshot.status) {
    case "idle":
      return { label: copy.versionLabel, value: currentVersion, tone: "neutral", priority: "quiet" };
    case "checking":
      return { label: copy.updateLabel, value: copy.checking, tone: "pending", priority: "standard" };
    case "available":
      return { label: copy.updateLabel, value: copy.available(availableVersion), tone: "pending", priority: "attention" };
    case "downloading":
      return { label: copy.updateLabel, value: copy.downloading(availableVersion, snapshot.progress_percent), tone: "pending", priority: "attention" };
    case "downloaded":
      return { label: copy.updateLabel, value: copy.downloaded(downloadedVersion), tone: "warning", priority: "critical" };
    case "error":
      return { label: copy.updateLabel, value: copy.error, tone: "error", priority: "attention" };
    case "not_available":
    default:
      return { label: copy.versionLabel, value: currentVersion, tone: "ready", priority: "quiet" };
  }
}

function formatAppVersion(version: string): string {
  return version.startsWith("v") ? version : `v${version}`;
}

function isShellPageKey(value: string | undefined): value is ShellPageKey {
  return value === "home" || value === "account" || value === "vault" || value === "loadouts" || value === "library" || value === "vendors" || value === "settings";
}

function isColorMode(value: string | undefined): value is "light" | "dark" {
  return value === "light" || value === "dark";
}

function formatLibraryVersion(version?: string): string | undefined {
  if (!version) return undefined;
  const match = version.match(/(?:^|\.)(\d{2})\.(\d{2})\.(\d{2})(?:\.|-)/);
  if (!match) return undefined;
  const yearNumber = Number(match[1]);
  const fullYear = yearNumber < 80 ? 2000 + yearNumber : 1900 + yearNumber;
  return `${fullYear}/${match[2]}/${match[3]}`;
}

function formatTime(date: Date | null): string | undefined {
  if (!date) return undefined;
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function getManifestStatusTone(status: ManifestStatus | null): ShellStatusItem["tone"] {
  if (!status) return "neutral";
  if (!status.initialized || status.missing_required_components?.length || status.needs_update) return "warning";
  return "ready";
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
