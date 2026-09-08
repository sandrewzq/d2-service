import { useEffect, useRef, useState } from "react";
import { loadAccountWorkspace, loadAccountDerivedWorkspace } from "@d2-tools/app/account";
import type { VaultRecommendationScanState } from "@d2-tools/app/account";
import {
  api } from "../../api/client";
import type { AccountItemActionPatch, AccountSummary, ActivityHistorySummary, DimWishlist, EquipmentTargetStore, StartupState, RecommendationCardSummary, LocalTargetRules, VaultTags } from "../../api/types";
import { createEmptyEquipmentTargetStore } from "@d2-tools/core/targets/equipmentTargets";
import { services } from "../../api/services";
import {
  applyAccountEntityPatches,
  getAccountStoreRevision,
  getAccountSummarySnapshot,
  replaceAccountSummary,
  useAccountWorkspaceSummaryStore
} from "../../shared/stores/accountEntityStore";
import { formatBungieLoginError } from "./loginErrors";
import { startRendererPerformanceSpan } from "../../shared/performance/rendererPerformanceDiagnostics";

type DiagnosticsBridge = {
  refreshDiagnostics: () => Promise<void>;
};

type AccountRefreshReason = "initial" | "manual" | "auto" | "write-action";

export function useAccountWorkspace(input: {
  state: StartupState;
  diagnostics: DiagnosticsBridge;
  subscribeToEntityPatches?: boolean;
  onLoginComplete: () => void;
  onManifestInitialized: () => void;
}) {
  const [loginMessage, setLoginMessage] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [manifestMessage, setManifestMessage] = useState("");
  const [manifestError, setManifestError] = useState("");
  const [isInitializingManifest, setIsInitializingManifest] = useState(false);
  // 仓库激活时产品根只跟随权威账号快照；单件本地 Patch 由仓库实体
  // 选择器消费，避免一次锁定或转移重新执行整个产品 Shell。离开仓库
  // 后恢复完整订阅，其他菜单继续获得最新账号实体。
  const accountSummary = useAccountWorkspaceSummaryStore(input.subscribeToEntityPatches);
  const [vaultTags, setVaultTags] = useState<VaultTags>({ items: {} });
  const [localTargetRules, setLocalTargetRules] = useState<LocalTargetRules>({
    action_policy: "notify_only",
    armor: [],
    weapons: []
  });
  const [equipmentTargetStore, setEquipmentTargetStore] = useState<EquipmentTargetStore>(() => createEmptyEquipmentTargetStore());
  const [accountError, setAccountError] = useState("");
  const [accountSyncMessage, setAccountSyncMessage] = useState("");
  const [accountWarning, setAccountWarning] = useState("");
  const [isLoadingAccount, setIsLoadingAccount] = useState(false);
  const [isShowingCachedAccount, setIsShowingCachedAccount] = useState(false);
  const [lastAccountLoadedAt, setLastAccountLoadedAt] = useState<Date | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [activitySummary, setActivitySummary] = useState<ActivityHistorySummary | null>(null);
  const [activityMessage, setActivityMessage] = useState("");
  const [activityError, setActivityError] = useState("");
  const [importedWishlist, setImportedWishlist] = useState<DimWishlist | null>(null);
  const [vaultRecommendationCardSummary, setVaultRecommendationCardSummary] = useState<Map<string, RecommendationCardSummary>>(new Map());
  const [isVaultCommunityMatchLoading, setIsVaultCommunityMatchLoading] = useState(false);
  const [vaultRecommendationScan, setVaultRecommendationScan] = useState<VaultRecommendationScanState>(() => createIdleVaultRecommendationScan());
  const accountRequestSequenceRef = useRef(0);
  const derivedRequestSequenceRef = useRef(0);
  const communityRequestSequenceRef = useRef(0);
  const recommendationScanAccountKeyRef = useRef("");
  const accountLoadingSequenceRef = useRef(0);
  const hasLoadedLocalAccountDataRef = useRef(false);
  const hasStartedInitialAccountRefreshRef = useRef(false);
  const accountRefreshRequestRef = useRef<{
    promise: Promise<AccountSummary | null>;
    authoritative: boolean;
  } | null>(null);

  useEffect(() => {
    let active = true;
    void api.getCachedAccountSnapshot()
      .then((cached) => {
        if (!active || !cached || getAccountSummarySnapshot()) return;
        if (!applyAccountSummary(cached.snapshot)) return;
        setIsShowingCachedAccount(true);
        const cachedAt = new Date(cached.saved_at);
        setLastAccountLoadedAt(Number.isNaN(cachedAt.getTime()) ? null : cachedAt);
        setAccountSyncMessage(`正在显示 ${formatCachedTime(cached.saved_at)} 的本地缓存`);
        setActivityMessage(`正在显示上次装备数据（${formatCachedTime(cached.saved_at)}）；本次同步完成后页面会自动更新`);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    // 开发模式只热更新 Renderer 时，旧 preload 可能暂时还没有这个事件入口。
    // 保持页面可用；完整重启 Desktop 后会恢复主进程快照推送。
    if (typeof api.onAccountSnapshotChanged !== "function") return undefined;
    return api.onAccountSnapshotChanged((summary) => {
      // Main AccountSession can be refreshed by another account consumer. Keep
      // every menu on the same snapshot instead of waiting for a page-local read.
      const acceptedSummary = applyAccountSummary(summary);
      if (!acceptedSummary) return;
      setIsShowingCachedAccount(false);
      setLastAccountLoadedAt(new Date());
    });
  }, []);

  useEffect(() => {
    if (hasStartedInitialAccountRefreshRef.current) return;
    if (input.state.cards.bungieConfig.status !== "ready" || input.state.cards.account.status !== "ready") return;
    hasStartedInitialAccountRefreshRef.current = true;
    void refreshAccountSnapshot("initial");
  }, [input.state.cards.account.status, input.state.cards.bungieConfig.status]);

  function setAccountSummaryState(summary: AccountSummary | null) {
    replaceAccountSummary(summary);
  }

  function applyAccountSummary(
    summary: AccountSummary,
    requestStartedRevision?: number,
    authoritative = false
  ): AccountSummary | null {
    const accepted = replaceAccountSummary(summary, { requestStartedRevision, authoritative });
    if (!accepted) return null;
    const acceptedSummary = getAccountSummarySnapshot();
    if (!acceptedSummary) return null;
    setSelectedCharacterId((current) => {
      if (current && acceptedSummary.characters.some((character) => character.character_id === current)) {
        return current;
      }
      return acceptedSummary.characters[0]?.character_id ?? "";
    });
    return acceptedSummary;
  }

  function applyAcceptedAccountActionPatches(patches: readonly AccountItemActionPatch[]) {
    // 与 DIM 一致：Bungie 写接口明确成功后，直接把单件变化提交到本地
    // 确认态。后续正常 Profile 前进时再以服务器事实自然校准。
    const span = startRendererPerformanceSpan("account-patch.apply", {
      patchCount: patches.length,
      instanceCount: new Set(patches.map((patch) => patch.item_instance_id)).size
    });
    try {
      applyAccountEntityPatches(patches);
    } finally {
      span.end({ revision: getAccountStoreRevision() });
    }
    setAccountSyncMessage("");
  }

  async function loginBungie() {
    setIsLoggingIn(true);
    setLoginMessage("");
    setLoginError("");

    try {
      const result = await api.loginBungie();
      hasStartedInitialAccountRefreshRef.current = true;
      accountRequestSequenceRef.current += 1;
      accountRefreshRequestRef.current = null;
      hasLoadedLocalAccountDataRef.current = false;
      derivedRequestSequenceRef.current += 1;
      communityRequestSequenceRef.current += 1;
      setAccountSummaryState(null);
      setAccountSyncMessage("");
      setIsShowingCachedAccount(false);
      setSelectedCharacterId("");
      setActivitySummary(null);
      setVaultRecommendationCardSummary(new Map());
      setVaultRecommendationScan(createIdleVaultRecommendationScan());
      recommendationScanAccountKeyRef.current = "";
      setIsVaultCommunityMatchLoading(false);
      setActivityMessage("");
      setActivityError("");
      setLoginMessage(result.message);
      input.onLoginComplete();
      await input.diagnostics.refreshDiagnostics();
      await refreshAccountSnapshot("initial");
    } catch (error) {
      setLoginError(formatBungieLoginError(error));
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function initializeManifest() {
    setIsInitializingManifest(true);
    setManifestMessage("");
    setManifestError("");

    try {
      const status = await api.initializeManifest();
      setManifestMessage(`资料库已初始化：${status.version ?? "未知版本"}`);
      input.onManifestInitialized();
      await input.diagnostics.refreshDiagnostics();
    } catch (error) {
      setManifestError(error instanceof Error ? error.message : "资料库初始化失败");
    } finally {
      setIsInitializingManifest(false);
    }
  }

  async function refreshAccountSnapshot(
    reason: AccountRefreshReason = getAccountSummarySnapshot() ? "manual" : "initial"
  ) {
    // 每次同步开始都清除上一轮读取错误；否则手动同步期间旧错误会一直
    // 覆盖页面。主进程负责把权威请求排到已有 in-flight 请求之后。
    setAccountError("");
    const previousSummary = getAccountSummarySnapshot();
    if (reason === "manual") setAccountSyncMessage("正在同步角色装备、背包、仓库和配装");
    // 初次读取和用户手动同步属于可见的前台动作；定时、回到前台和
    // 写操作触发的同步都在后台完成，不占用手动同步按钮的忙碌状态。
    const foreground = reason === "initial" || reason === "manual";
    const authoritative = reason === "manual" || reason === "write-action";
    const existingRequest = accountRefreshRequestRef.current;
    if (existingRequest) {
      if (!authoritative || existingRequest.authoritative) {
        if (foreground) setIsLoadingAccount(true);
        try {
          return await existingRequest.promise;
        } finally {
          if (foreground) setIsLoadingAccount(false);
        }
      }
      await existingRequest.promise.catch(() => null);
      if (accountRefreshRequestRef.current === existingRequest) {
        accountRefreshRequestRef.current = null;
      }
      return refreshAccountSnapshot(reason);
    }
    const requestSequence = ++accountRequestSequenceRef.current;
    const requestStartedRevision = getAccountStoreRevision();
    const loadingSequence = foreground ? ++accountLoadingSequenceRef.current : 0;
    if (foreground) setIsLoadingAccount(true);
    const request = (async (): Promise<AccountSummary | null> => {
      try {
        let summary: AccountSummary;
        if (!hasLoadedLocalAccountDataRef.current) {
          const workspace = await loadAccountWorkspace(services, {
            forceAccountRefresh: true,
            authoritativeAccountRefresh: reason === "manual" || reason === "write-action"
          });
          if (requestSequence !== accountRequestSequenceRef.current) return null;
          if (workspace.status !== "success") {
            throw new Error(workspace.error?.message ?? "账号数据读取失败");
          }
          summary = workspace.data.account;
          setVaultTags(workspace.data.tags);
          setLocalTargetRules(workspace.data.targetRules);
          setEquipmentTargetStore(workspace.data.equipmentTargets);
          setImportedWishlist(workspace.data.wishlist);
          hasLoadedLocalAccountDataRef.current = true;
          setAccountWarning(workspace.data.warnings.length
            ? `本地增强数据读取失败：${formatAccountWorkspaceWarnings(workspace.data.warnings)}`
            : "");
        } else {
          summary = await api.getAccountSummary({
            force: true,
            authoritative: reason === "manual" || reason === "write-action"
          });
          if (requestSequence !== accountRequestSequenceRef.current) return null;
        }

        const acceptedSummary = applyAccountSummary(
          summary,
          requestStartedRevision,
          reason === "manual" || reason === "write-action"
        );
        if (!acceptedSummary) {
          throw new Error("同步返回的账号快照早于页面当前状态，本次结果未应用");
        }
        summary = acceptedSummary;
        setIsShowingCachedAccount(false);
        setLastAccountLoadedAt(new Date());
        if (reason === "manual") {
          setAccountSyncMessage(formatAccountSyncMessage(previousSummary, summary, reason));
        } else if (reason === "initial" || reason === "auto") {
          // 初始与静默同步只更新数据和时间，不保留绿色成功横幅。
          // 玩家刚完成的单件操作因此不会与历史同步成功提示重复。
          setAccountSyncMessage("");
        }
        const shouldRefreshCommunityMatch = !previousSummary
          || !recommendationScanAccountKeyRef.current
          || !hasSameWeaponRecommendationInputs(previousSummary, summary);
        if (shouldRefreshCommunityMatch) {
          communityRequestSequenceRef.current += 1;
          recommendationScanAccountKeyRef.current = "";
          setIsVaultCommunityMatchLoading(false);
          setVaultRecommendationScan((current) => ({
            phase: current.scanned_weapon_count || vaultRecommendationCardSummary.size ? "partial" : "idle",
            total_weapon_count: countAccountWeapons(summary),
            scanned_weapon_count: vaultRecommendationCardSummary.size,
            covered_weapon_count: [...vaultRecommendationCardSummary.values()].filter((item) => item.coverage === "covered").length,
            retained_result_count: vaultRecommendationCardSummary.size,
            message: vaultRecommendationCardSummary.size
              ? "装备数据已更新，当前暂时显示上次推荐结果，后台正在按变化实例重新核对。"
              : undefined
          }));
        }
        if (reason === "initial" || reason === "manual") {
          setActivityMessage(reason === "manual"
            ? hasSameProfileVersion(previousSummary, summary)
              ? "装备数据已同步，游戏中的内容没有变化"
              : "装备数据已从游戏更新"
            : "装备数据已同步，最近活动会继续在后台读取");
        }
        if (reason === "initial") void refreshAccountDerivedData(summary);
        // 推荐核对只依赖武器实例与 Roll。取出、存入、装备和锁定只改变
        // 位置或状态，不再清空当前结果，也不再触发整账号推荐重算。
        if (shouldRefreshCommunityMatch) {
          void loadVaultCommunityMatch(summary).catch(() => undefined);
        }
        return summary;
      } catch (error) {
        if (requestSequence !== accountRequestSequenceRef.current) return null;
        const message = error instanceof Error ? error.message : "账号数据读取失败";
        const resolvedMessage = getAccountLoadErrorMessage(input.state, message);
        if (getAccountSummarySnapshot()) {
          if (reason === "auto") {
            setAccountSyncMessage("自动同步暂时失败，继续显示上次装备数据");
            return null;
          }
          setIsShowingCachedAccount(true);
          if (reason !== "write-action") setAccountSyncMessage("同步失败，继续显示上次账号数据");
          setAccountError(`${formatAccountRefreshFailurePrefix(reason)}，仍显示上次装备数据。${resolvedMessage}`);
        } else {
          setAccountError(resolvedMessage);
          setAccountSummaryState(null);
        }
        return null;
      }
    })();
    accountRefreshRequestRef.current = { promise: request, authoritative };
    try {
      return await request;
    } finally {
      if (accountRefreshRequestRef.current?.promise === request) {
        accountRefreshRequestRef.current = null;
      }
      if (foreground && loadingSequence === accountLoadingSequenceRef.current) {
        setIsLoadingAccount(false);
      }
    }
  }

  async function refreshAccountDerivedData(summary = getAccountSummarySnapshot()) {
    if (!summary) return;

    const requestSequence = ++derivedRequestSequenceRef.current;
    setActivityError("");
    setActivityMessage("");
    const derived = await loadAccountDerivedWorkspace(services, summary, {
      includeActivity: true,
      includeCommunityMatch: false
    });
    if (requestSequence !== derivedRequestSequenceRef.current) return;
    if (derived.status === "success") {
      setActivitySummary(derived.data.activitySummary);
      setActivityMessage(derived.data.activitySummary ? "最近活动已更新" : "");
      return;
    }

    setActivitySummary(null);
    setActivityError(derived.error?.message ?? "最近活动读取失败");
  }

  async function loadVaultCommunityMatch(
    summary = getAccountSummarySnapshot(),
    options: { force?: boolean; weaponHashes?: readonly number[] } = {}
  ) {
    if (!summary) return;
    const affectedWeaponHashes = options.weaponHashes?.length
      ? new Set(options.weaponHashes)
      : null;
    if (options.weaponHashes && !affectedWeaponHashes?.size) return;
    const accountKey = `${summary.membership_type}:${summary.destiny_membership_id}`;
    if (!options.force && recommendationScanAccountKeyRef.current === accountKey) return;

    const requestSequence = ++communityRequestSequenceRef.current;
    const totalWeaponCount = countAccountWeapons(summary);
    const scopedWeaponCount = affectedWeaponHashes
      ? countAccountWeapons(summary, affectedWeaponHashes)
      : totalWeaponCount;
    const retainedCardSummaries = vaultRecommendationCardSummary;
    const retainedResultCount = retainedCardSummaries.size;
    const startedAt = new Date().toISOString();
    setIsVaultCommunityMatchLoading(true);
    setVaultRecommendationScan({
      phase: "scanning",
      total_weapon_count: totalWeaponCount,
      scanned_weapon_count: 0,
      covered_weapon_count: 0,
      retained_result_count: retainedResultCount,
      started_at: startedAt,
      message: affectedWeaponHashes
        ? `推荐规则已变化，正在重新核对 ${scopedWeaponCount} 件受影响武器；其他结果保持不变。`
        : retainedResultCount
          ? `正在重新核对 ${totalWeaponCount} 件账号武器，暂时保留上次 ${retainedResultCount} 件结果。`
          : `正在核对 ${totalWeaponCount} 件账号武器。`
    });
    let derived: Awaited<ReturnType<typeof loadAccountDerivedWorkspace>>;
    try {
      derived = await loadAccountDerivedWorkspace(services, summary, {
        includeActivity: false,
        includeCommunityMatch: true,
        ...(affectedWeaponHashes
          ? { communityMatchWeaponHashes: [...affectedWeaponHashes] }
          : {})
      });
    } catch (error) {
      if (requestSequence !== communityRequestSequenceRef.current) return;
      const message = error instanceof Error ? error.message : "武器推荐来源核对失败";
      setVaultRecommendationScan({
        phase: retainedResultCount ? "partial" : "error",
        total_weapon_count: totalWeaponCount,
        scanned_weapon_count: retainedResultCount,
        covered_weapon_count: [...retainedCardSummaries.values()].filter((item) => item.coverage === "covered").length,
        retained_result_count: retainedResultCount,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        message: retainedResultCount
          ? `本次核对失败，继续显示上次 ${retainedResultCount} 件结果：${message}`
          : message
      });
      setIsVaultCommunityMatchLoading(false);
      return;
    }
    if (requestSequence !== communityRequestSequenceRef.current) return;
    if (derived.status === "success") {
      const blockingIssue = derived.data.vaultRecommendationIssues.find((issue) => issue.severity === "blocking");
      if (blockingIssue) {
        setVaultRecommendationScan({
          phase: retainedResultCount ? "partial" : "error",
          total_weapon_count: totalWeaponCount,
          scanned_weapon_count: retainedResultCount,
          covered_weapon_count: [...retainedCardSummaries.values()].filter((item) => item.coverage === "covered").length,
          retained_result_count: retainedResultCount,
          started_at: startedAt,
          completed_at: new Date().toISOString(),
          blocking_reason: blockingIssue.code,
          issues: derived.data.vaultRecommendationIssues,
          manifest_version: derived.data.vaultRecommendationManifestVersion,
          recommendation_revision: derived.data.vaultRecommendationRevision,
          recommendation_schema_version: derived.data.vaultRecommendationSchemaVersion,
          message: retainedResultCount
            ? `${blockingIssue.message} 继续显示上次 ${retainedResultCount} 件结果。`
            : blockingIssue.message
        });
        setIsVaultCommunityMatchLoading(false);
        return;
      }
      recommendationScanAccountKeyRef.current = accountKey;
      const nextCardSummaries = affectedWeaponHashes
        ? mergeIncrementalRecommendationCardSummaries(
            vaultRecommendationCardSummary,
            derived.data.vaultRecommendationCardSummary,
            affectedWeaponHashes
          )
        : reconcileRecommendationCardSummaries(
            vaultRecommendationCardSummary,
            derived.data.vaultRecommendationCardSummary,
            new Set(derived.data.vaultRecommendationChangedInstanceIds)
          );
      setVaultRecommendationCardSummary(nextCardSummaries);
      const warningMessage = derived.data.vaultRecommendationIssues.map((issue) => issue.message).join(" ");
      setVaultRecommendationScan({
        phase: derived.data.vaultRecommendationIssues.length ? "partial" : "complete",
        total_weapon_count: totalWeaponCount,
        scanned_weapon_count: nextCardSummaries.size,
        covered_weapon_count: [...nextCardSummaries.values()].filter((item) => item.coverage === "covered").length,
        retained_result_count: 0,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        issues: derived.data.vaultRecommendationIssues,
        manifest_version: derived.data.vaultRecommendationManifestVersion,
        recommendation_revision: derived.data.vaultRecommendationRevision,
        recommendation_schema_version: derived.data.vaultRecommendationSchemaVersion,
        ...(warningMessage ? { message: warningMessage } : {})
      });
    } else {
      const message = derived.error?.message ?? "武器推荐来源核对失败";
      setVaultRecommendationScan({
        phase: retainedResultCount ? "partial" : "error",
        total_weapon_count: totalWeaponCount,
        scanned_weapon_count: retainedResultCount,
        covered_weapon_count: [...retainedCardSummaries.values()].filter((item) => item.coverage === "covered").length,
        retained_result_count: retainedResultCount,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        message: retainedResultCount
          ? `本次核对失败，继续显示上次 ${retainedResultCount} 件结果：${message}`
          : message
      });
    }
    setIsVaultCommunityMatchLoading(false);
  }

  return {
    loginMessage,
    loginError,
    isLoggingIn,
    manifestMessage,
    manifestError,
    isInitializingManifest,
    accountSummary,
    setAccountSummary: setAccountSummaryState,
    applyAcceptedAccountActionPatches,
    vaultTags,
    setVaultTags,
    localTargetRules,
    setLocalTargetRules,
    equipmentTargetStore,
    setEquipmentTargetStore,
    accountError,
    setAccountError,
    accountSyncMessage,
    accountWarning,
    isLoadingAccount,
    isShowingCachedAccount,
    lastAccountLoadedAt,
    selectedCharacterId,
    setSelectedCharacterId,
    activitySummary,
    activityMessage,
    activityError,
    importedWishlist,
    setImportedWishlist,
    vaultRecommendationCardSummary,
    isVaultCommunityMatchLoading,
    vaultRecommendationScan,
    loginBungie,
    initializeManifest,
    loadAccountSummary: refreshAccountSnapshot,
    refreshAccountSnapshot,
    loadActivitySummary: refreshAccountDerivedData,
    loadVaultCommunityMatch,
    refreshAccountDerivedData
  };
}

function createIdleVaultRecommendationScan(): VaultRecommendationScanState {
  return {
    phase: "idle",
    total_weapon_count: 0,
    scanned_weapon_count: 0,
    covered_weapon_count: 0,
    retained_result_count: 0
  };
}

function countAccountWeapons(summary: AccountSummary, hashes?: ReadonlySet<number>): number {
  return [
    ...summary.characters.flatMap((character) => [
      ...character.equipped_items,
      ...character.inventory_items,
      ...character.postmaster_items
    ]),
    ...summary.vault.items
  ].filter((item) => item.group_key === "weapons" && (!hashes || hashes.has(item.hash))).length;
}

function hasSameWeaponRecommendationInputs(
  previous: AccountSummary,
  next: AccountSummary
): boolean {
  const previousKeys = buildWeaponRecommendationInputKeys(previous);
  const nextKeys = buildWeaponRecommendationInputKeys(next);
  if (previousKeys.length !== nextKeys.length) return false;
  return previousKeys.every((key, index) => key === nextKeys[index]);
}

function buildWeaponRecommendationInputKeys(summary: AccountSummary): string[] {
  return [
    ...summary.characters.flatMap((character) => [
      ...character.equipped_items,
      ...character.inventory_items,
      ...character.postmaster_items
    ]),
    ...summary.vault.items
  ]
    .filter((item) => item.group_key === "weapons")
    .map((item) => {
      const fallbackRoll = item.socket_plugs
        .map((plug) => `${plug.socket_index ?? ""}:${plug.hash}`)
        .join(",");
      return [
        item.instance_id ?? "",
        item.hash,
        item.weapon_roll?.fingerprint ?? fallbackRoll
      ].join(":");
    })
    .sort();
}

function mergeIncrementalRecommendationCardSummaries(
  current: ReadonlyMap<string, RecommendationCardSummary>,
  fresh: ReadonlyMap<string, RecommendationCardSummary>,
  affectedWeaponHashes: ReadonlySet<number>
): Map<string, RecommendationCardSummary> {
  const merged = new Map<string, RecommendationCardSummary>();
  for (const [key, summary] of current) {
    if (!affectedWeaponHashes.has(summary.hash)) merged.set(key, summary);
  }
  for (const [key, summary] of fresh) merged.set(key, summary);
  return merged;
}

function reconcileRecommendationCardSummaries(
  current: ReadonlyMap<string, RecommendationCardSummary>,
  fresh: ReadonlyMap<string, RecommendationCardSummary>,
  changedInstanceIds: ReadonlySet<string>
): Map<string, RecommendationCardSummary> {
  if (!current.size) return new Map(fresh);
  const reconciled = new Map<string, RecommendationCardSummary>();
  for (const [key, summary] of fresh) {
    const previous = current.get(key);
    reconciled.set(
      key,
      !previous || !summary.instance_id || changedInstanceIds.has(summary.instance_id)
        ? summary
        : previous
    );
  }
  return reconciled;
}

function formatCachedTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "时间未知" : date.toLocaleString("zh-CN");
}

function formatAccountWorkspaceWarnings(warnings: Array<{ source: string; message: string }>): string {
  return warnings.map((warning) => `${formatAccountWarningSource(warning.source)}：${warning.message}`).join("；");
}

function formatAccountWarningSource(source: string): string {
  if (source === "vault-tags") return "本地标签";
  if (source === "target-rules") return "目标规则";
  if (source === "equipment-targets") return "装备目标";
  if (source === "wishlist") return "DIM wishlist";
  return "本地数据";
}

function formatAccountRefreshFailurePrefix(reason: AccountRefreshReason): string {
  if (reason === "auto") return "自动同步装备数据失败";
  if (reason === "write-action") return "操作后同步装备数据失败";
  if (reason === "manual") return "同步装备数据失败";
  return "读取装备数据失败";
}

function formatAccountSyncMessage(
  previous: AccountSummary | null,
  next: AccountSummary,
  reason: AccountRefreshReason
): string {
  if (reason === "initial" || !previous) return "装备数据已从游戏同步";
  if (hasSameProfileVersion(previous, next)) {
    return "装备数据已同步，游戏中的内容没有变化";
  }
  const previousVaultIds = new Set(previous.vault.items.flatMap((item) => item.instance_id ? [item.instance_id] : []));
  const nextVaultIds = new Set(next.vault.items.flatMap((item) => item.instance_id ? [item.instance_id] : []));
  const movedOut = [...previousVaultIds].filter((instanceId) => !nextVaultIds.has(instanceId)).length;
  const movedIn = [...nextVaultIds].filter((instanceId) => !previousVaultIds.has(instanceId)).length;
  const changes = [
    movedOut ? `${movedOut} 件装备移出仓库` : "",
    movedIn ? `${movedIn} 件装备移入仓库` : ""
  ].filter(Boolean);
  if (changes.length) return `装备数据已同步：${changes.join("，")}`;
  const countDelta = next.vault.item_count - previous.vault.item_count;
  if (countDelta) return `装备数据已同步：仓库总数${countDelta > 0 ? "增加" : "减少"} ${Math.abs(countDelta)} 件`;
  return "装备数据已同步，游戏中的内容没有变化";
}

function hasSameProfileVersion(
  previous: AccountSummary | null,
  next: AccountSummary
): boolean {
  return Boolean(
    previous?.profile_minted_at
    && next.profile_minted_at
    && previous.profile_minted_at === next.profile_minted_at
  );
}

function getAccountLoadErrorMessage(state: StartupState, message: string): string {
  if (state.cards.bungieConfig.status !== "ready") {
    return `未连接 Bungie：请先在设置里填写 Bungie API Key、Client ID 和 Client Secret。${message}`;
  }

  if (state.cards.account.status !== "ready") {
    return `账号还没有登录：请先完成 Bungie 登录。${message}`;
  }

  return `登录可能已失效，请重新登录 Bungie。${message}`;
}
