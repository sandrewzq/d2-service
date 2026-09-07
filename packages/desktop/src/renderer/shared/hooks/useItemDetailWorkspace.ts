import { useEffect, useMemo, useRef, useState } from "react";
import type { AccountOperationFeedbackView } from "@d2-tools/app/account";
import { api } from "../../api/client";
import type { ActionLogType } from "@d2-tools/core/actions/log";
import type { AccountItemActionPatch, AccountItemDetail, AccountItemSummary, AccountSummary, ActionDebugTraceInput, DimWishlist, ItemActionResult, ItemAiAdviceResult, ItemSearchResult, LibraryHistory, LocalTargetRules, VaultTags, VaultTagValue, WeaponRecommendation } from "../../api/types";
import type { LiveItemAvailabilityEntry } from "@d2-tools/core/items/liveAvailability";
import {
  buildWishlistInsightText,
  collectSelectedSameNameItems,
  getItemKey,
  selectBestSameNameItem,
  selectedItemToAccountItem,
  type SameNameItemSummary
} from "@d2-tools/app/items";
import { protectVaultCleanupTagPlan } from "@d2-tools/app/vault";
import { services } from "../../api/services";
import {
  buildDuplicateGroupBatchTagPlan,
  buildVaultCleanupLocatorText,
  buildVaultDuplicateSummary
} from "../domain/vault/vaultCleanup";
import { buildItemChatGuideText, buildItemShareText } from "../../utils/itemShare";
import {
  useItemDetail
} from "./useItemDetail";
import { buildWeaponAiConfigurationContext } from "../components/item-detail/buildWeaponDetailView";

const ITEM_DETAIL_RECOMMENDATION_IDLE_TIMEOUT_MS = 700;
const ITEM_DETAIL_AUXILIARY_IDLE_TIMEOUT_MS = 1_600;

type DiagnosticsBridge = {
  aiSettings: { enable_lightgg: boolean };
  loadActionLog: () => Promise<void>;
};

export function useItemDetailWorkspace(input: {
  accountSummary: AccountSummary | null;
  detailCacheScopeKey: string;
  recommendationRevision?: string;
  cleanupProtectionByItemKey?: ReadonlyMap<string, readonly string[]>;
  vaultTags: VaultTags;
  setVaultTags: (tags: VaultTags) => void;
  importedWishlist: DimWishlist | null;
  localTargetRules: LocalTargetRules;
  diagnostics: DiagnosticsBridge;
  setAccountError: (message: string) => void;
  setAccountOperationFeedback: (feedback: AccountOperationFeedbackView | undefined) => void;
  setIsRunningItemAction: (isRunning: boolean) => void;
  setItemActionMessage: (message: string) => void;
  applyAcceptedAccountActionPatches: (patches: readonly AccountItemActionPatch[]) => void;
  onRecentHistoryChanged: (history: LibraryHistory) => void;
}) {
  const [communityRecommendations, setCommunityRecommendations] = useState<WeaponRecommendation | null>(null);
  const [communityRecommendationError, setCommunityRecommendationError] = useState("");
  const [isCommunityRecommendationsLoading, setIsCommunityRecommendationsLoading] = useState(false);
  const [selectedItemAvailability, setSelectedItemAvailability] = useState<LiveItemAvailabilityEntry | null>(null);
  const [selectedItemVersions, setSelectedItemVersions] = useState<ItemSearchResult[]>([]);
  const [isSelectedItemVersionsLoading, setIsSelectedItemVersionsLoading] = useState(false);
  const [itemAiResult, setItemAiResult] = useState<ItemAiAdviceResult | null>(null);
  const [itemAiError, setItemAiError] = useState("");
  const [itemNoteDraft, setItemNoteDraft] = useState("");
  const [itemNoteMessage, setItemNoteMessage] = useState("");
  const [itemShareMessage, setItemShareMessage] = useState("");
  const [isGeneratingItemAi, setIsGeneratingItemAi] = useState(false);
  const [selectedActionCharacterId, setSelectedActionCharacterId] = useState("");
  const workspaceRequestSequenceRef = useRef(0);
  const writeActionDebugQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const communityRecommendationCacheRef = useRef(new Map<string, WeaponRecommendation | null>());
  const communityRecommendationRequestsRef = useRef(new Map<string, Promise<WeaponRecommendation | null>>());
  const activeRecommendationCacheKeyRef = useRef("");

  const {
    selectedItem,
    itemDetailLoadingKey,
    itemDetailError,
    openItemDetail,
    loadSelectedItemFullDetail,
    refreshSelectedItemDetail,
    closeSelectedItemDetail: closeItemDetailCore
  } = useItemDetail({
    cacheScopeKey: input.detailCacheScopeKey,
    onOpenStart: ({ item, source, itemKey, isCurrent }) => {
      const workspaceRequestSequence = ++workspaceRequestSequenceRef.current;
      const isCurrentWorkspace = () => (
        workspaceRequestSequenceRef.current === workspaceRequestSequence
        && isCurrent()
      );
      const isWeapon = item.group_key === "weapons";
      const recommendationCacheKey = buildCommunityRecommendationCacheKey(
        input.detailCacheScopeKey,
        input.recommendationRevision,
        item.hash,
        item.name
      );
      const hasCachedRecommendation = isWeapon
        && communityRecommendationCacheRef.current.has(recommendationCacheKey);
      const cachedRecommendation = hasCachedRecommendation
        ? communityRecommendationCacheRef.current.get(recommendationCacheKey) ?? null
        : null;
      activeRecommendationCacheKeyRef.current = isWeapon ? recommendationCacheKey : "";
      const isCurrentRecommendation = () => (
        isCurrentWorkspace()
        && activeRecommendationCacheKeyRef.current === recommendationCacheKey
      );
      setItemAiResult(null);
      setItemAiError("");
      setItemNoteMessage("");
      setItemShareMessage("");
      input.setItemActionMessage("");
      setItemNoteDraft(input.vaultTags.items[itemKey]?.note ?? "");
      const defaultCharacterId = source.source_character_id
        ?? input.accountSummary?.characters[0]?.character_id
        ?? "";
      setSelectedActionCharacterId(defaultCharacterId);
      setCommunityRecommendations(cachedRecommendation);
      setCommunityRecommendationError("");
      setIsCommunityRecommendationsLoading(isWeapon && !hasCachedRecommendation);
      setSelectedItemAvailability(null);
      setSelectedItemVersions(isWeapon && "description" in item && "source" in item ? [item] : []);
      setIsSelectedItemVersionsLoading(isWeapon);
      scheduleWhenRendererIdle(() => {
        if (!isCurrentWorkspace()) return;
        if (isWeapon && !hasCachedRecommendation && isCurrentRecommendation()) {
          const existingRequest = communityRecommendationRequestsRef.current.get(recommendationCacheKey);
          const request = existingRequest ?? api.getCommunityPerkRecommendations(item.hash, { item_name: item.name });
          if (!existingRequest) communityRecommendationRequestsRef.current.set(recommendationCacheKey, request);
          void request
            .then((result) => {
              touchBoundedCache(
                communityRecommendationCacheRef.current,
                recommendationCacheKey,
                result,
                80
              );
              if (!isCurrentRecommendation()) return;
              setCommunityRecommendations(result);
            })
            .catch((error) => {
              if (!isCurrentRecommendation()) return;
              console.warn("社区推荐加载失败：", error);
              setCommunityRecommendationError("社区推荐读取失败，已保留 DIM 愿望单和本地目标判断。");
            })
            .finally(() => {
              if (communityRecommendationRequestsRef.current.get(recommendationCacheKey) === request) {
                communityRecommendationRequestsRef.current.delete(recommendationCacheKey);
              }
              if (!isCurrentRecommendation()) return;
              setIsCommunityRecommendationsLoading(false);
            });
        }
      }, ITEM_DETAIL_RECOMMENDATION_IDLE_TIMEOUT_MS, 280);
      scheduleWhenRendererIdle(() => {
        if (!isCurrentWorkspace()) return;
        if (isWeapon) {
          void api.searchItems(item.name)
            .then((results) => {
              if (!isCurrentWorkspace()) return;
              const versions = results
                .filter((candidate) => candidate.group_key === "weapons" && candidate.name.trim() === item.name.trim())
                .filter((candidate, index, all) => all.findIndex((entry) => entry.hash === candidate.hash) === index);
              setSelectedItemVersions(versions);
            })
            .catch((error) => {
              if (!isCurrentWorkspace()) return;
              console.warn("同名版本读取失败：", error);
            })
            .finally(() => {
              if (!isCurrentWorkspace()) return;
              setIsSelectedItemVersionsLoading(false);
            });
        }
        void api.getLiveItemAvailability([item.hash])
          .then((availability) => {
            if (!isCurrentWorkspace()) return;
            setSelectedItemAvailability(availability.items[String(item.hash)] ?? null);
          })
          .catch((error) => {
            if (!isCurrentWorkspace()) return;
            console.warn("实时获取状态读取失败：", error);
          });
      }, ITEM_DETAIL_AUXILIARY_IDLE_TIMEOUT_MS, 900);
    },
    onRecentHistoryChanged: input.onRecentHistoryChanged
  });

  useEffect(() => {
    workspaceRequestSequenceRef.current += 1;
    resetDetailWorkspaceState();
  }, [input.detailCacheScopeKey]);

  const selectedSameNameItems: SameNameItemSummary[] = useMemo(() => (
    selectedItem?.group_key === "weapons"
      ? []
      : collectSelectedSameNameItems(input.accountSummary, selectedItem)
  ), [input.accountSummary, selectedItem]);

  useEffect(() => {
    if (!selectedItem || selectedItem.group_key !== "weapons") return;
    const recommendationCacheKey = buildCommunityRecommendationCacheKey(
      input.detailCacheScopeKey,
      input.recommendationRevision,
      selectedItem.hash,
      selectedItem.name
    );
    if (activeRecommendationCacheKeyRef.current === recommendationCacheKey) return;
    activeRecommendationCacheKeyRef.current = recommendationCacheKey;

    const hasCachedRecommendation = communityRecommendationCacheRef.current.has(recommendationCacheKey);
    if (hasCachedRecommendation) {
      setCommunityRecommendations(communityRecommendationCacheRef.current.get(recommendationCacheKey) ?? null);
      setCommunityRecommendationError("");
      setIsCommunityRecommendationsLoading(false);
      return;
    }

    let active = true;
    setCommunityRecommendations(null);
    setCommunityRecommendationError("");
    setIsCommunityRecommendationsLoading(true);
    const existingRequest = communityRecommendationRequestsRef.current.get(recommendationCacheKey);
    const request = existingRequest
      ?? api.getCommunityPerkRecommendations(selectedItem.hash, { item_name: selectedItem.name });
    if (!existingRequest) communityRecommendationRequestsRef.current.set(recommendationCacheKey, request);
    void request
      .then((result) => {
        touchBoundedCache(communityRecommendationCacheRef.current, recommendationCacheKey, result, 80);
        if (!active || activeRecommendationCacheKeyRef.current !== recommendationCacheKey) return;
        setCommunityRecommendations(result);
      })
      .catch((error) => {
        if (!active || activeRecommendationCacheKeyRef.current !== recommendationCacheKey) return;
        console.warn("社区推荐重新读取失败：", error);
        setCommunityRecommendationError("推荐来源已变化，但最新推荐读取失败。请稍后重试。");
      })
      .finally(() => {
        if (communityRecommendationRequestsRef.current.get(recommendationCacheKey) === request) {
          communityRecommendationRequestsRef.current.delete(recommendationCacheKey);
        }
        if (!active || activeRecommendationCacheKeyRef.current !== recommendationCacheKey) return;
        setIsCommunityRecommendationsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    input.detailCacheScopeKey,
    input.recommendationRevision,
    selectedItem?.group_key,
    selectedItem?.hash,
    selectedItem?.name
  ]);

  async function generateItemAiAdvice(userKnowledge = "", allowExternalSearch = false) {
    if (!selectedItem?.group_key) return;
    const requestSequence = workspaceRequestSequenceRef.current;

    setIsGeneratingItemAi(true);
    setItemAiError("");
    setItemShareMessage("");

    try {
      const result = await api.generateItemAiAdvice({
        item: {
          hash: selectedItem.hash,
          instance_id: selectedItem.instance_id,
          name: selectedItem.name,
          icon: selectedItem.icon,
          item_type: selectedItem.item_type,
          tier: selectedItem.tier,
          bucket_name: selectedItem.bucket_name,
          group_key: selectedItem.group_key,
          power: selectedItem.power,
          locked: selectedItem.locked,
          armor_stats: selectedItem.armor_stats,
          armor_stat_breakdown: selectedItem.armor_stat_breakdown,
          socket_plugs: selectedItem.socket_plugs ?? [],
          description: selectedItem.description,
          note: selectedItem.item_key ? input.vaultTags.items[selectedItem.item_key]?.note : undefined
        },
        tags: input.vaultTags,
        user_knowledge: userKnowledge.trim() || undefined,
        builtin_knowledge: communityRecommendations,
        allow_external_search: allowExternalSearch,
        weapon_context: selectedItem.group_key === "weapons" ? {
          object_kind: selectedItem.instance_id ? "account_instance" : "definition",
          official_sources: [
            ...(selectedItemAvailability?.sources.map((source) => source.label) ?? []),
            ...(selectedItem.source.status === "ready" ? [selectedItem.source.description] : [])
          ],
          definition_stats: Object.fromEntries((selectedItem.definition_stats ?? []).map((stat) => [stat.name, stat.value])),
          current_stats: selectedItem.weapon_stats,
          ...buildWeaponAiConfigurationContext(selectedItem)
        } : undefined
      });
      if (workspaceRequestSequenceRef.current !== requestSequence) return;
      setItemAiResult(result);
    } catch (error) {
      if (workspaceRequestSequenceRef.current !== requestSequence) return;
      setItemAiError(error instanceof Error ? error.message : "AI 装备解读失败");
    } finally {
      if (workspaceRequestSequenceRef.current === requestSequence) {
        setIsGeneratingItemAi(false);
      }
    }
  }

  async function copySelectedItemSummary() {
    if (!selectedItem) return;

    const tag = input.vaultTags.items[selectedItem.item_key]?.tag ?? "none";
    const note = input.vaultTags.items[selectedItem.item_key]?.note ?? itemNoteDraft;
    const text = buildItemShareText({
      item: selectedItem,
      tag,
      note,
      aiText: itemAiResult?.ai?.text
    });

    try {
      await navigator.clipboard.writeText(text);
      setItemShareMessage("已复制装备结论");
    } catch {
      setItemShareMessage("复制失败，请检查系统剪贴板权限");
    }
  }

  async function copySelectedItemChatGuide() {
    if (!selectedItem) return;

    const tag = input.vaultTags.items[selectedItem.item_key]?.tag ?? "none";
    const note = input.vaultTags.items[selectedItem.item_key]?.note ?? itemNoteDraft;
    const text = buildItemChatGuideText({
      item: selectedItem,
      tag,
      note,
      aiText: itemAiResult?.ai?.text
    });

    try {
      await navigator.clipboard.writeText(text);
      setItemShareMessage("已复制群聊说明");
    } catch {
      setItemShareMessage("复制失败，请检查系统剪贴板权限");
    }
  }

  async function saveSelectedItemNote() {
    if (!selectedItem) return;

    setItemNoteMessage("");
    setItemShareMessage("");

    try {
      const tags = await services.localData.saveVaultNote({
        item_key: selectedItem.item_key,
        note: itemNoteDraft
      });
      input.setVaultTags(tags);
      setItemNoteDraft(tags.items[selectedItem.item_key]?.note ?? "");
      setItemNoteMessage("备注已保存");
    } catch (error) {
      setItemNoteMessage(error instanceof Error ? error.message : "备注保存失败");
    }
  }

  function closeSelectedItemDetail() {
    workspaceRequestSequenceRef.current += 1;
    closeItemDetailCore();
    resetDetailWorkspaceState();
  }

  function resetDetailWorkspaceState() {
    activeRecommendationCacheKeyRef.current = "";
    setCommunityRecommendations(null);
    setCommunityRecommendationError("");
    setIsCommunityRecommendationsLoading(false);
    setSelectedItemAvailability(null);
    setSelectedItemVersions([]);
    setIsSelectedItemVersionsLoading(false);
    setItemAiResult(null);
    setItemAiError("");
    setItemNoteDraft("");
    setItemNoteMessage("");
    setItemShareMessage("");
    setIsGeneratingItemAi(false);
    setSelectedActionCharacterId("");
  }

  async function saveSelectedItemTag(tag: VaultTagValue) {
    if (!selectedItem) return;

    setItemNoteMessage("");
    setItemShareMessage("");

    const protection = tag === "junk"
      ? input.cleanupProtectionByItemKey?.get(selectedItem.item_key) ?? []
      : [];
    if (protection.length) {
      setItemNoteMessage(`不能标为清理：${protection.join("、")}`);
      return;
    }

    try {
      const tags = await services.localData.saveVaultTag({
        item_key: selectedItem.item_key,
        tag
      });
      input.setVaultTags(tags);
      setItemNoteMessage(tag === "none" ? "已清除本地标记" : "已更新本地标记");
    } catch (error) {
      setItemNoteMessage(error instanceof Error ? error.message : "本地标记保存失败");
    }
  }

  async function copyWishlistInsight() {
    if (!selectedItem) return;
    const text = buildWishlistInsightText({
      selectedItem,
      vaultTags: input.vaultTags,
      importedWishlist: input.importedWishlist,
      localTargetRules: input.localTargetRules
    });
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setItemShareMessage("已复制命中结论");
    } catch {
      setItemShareMessage("复制失败，请检查系统剪贴板权限");
    }
  }

  async function copySameNameLocator(items: SameNameItemSummary[]) {
    if (!selectedItem || !items.length) return;

    const text = [
      `${selectedItem.name} / 同名定位清单`,
      `总计 ${items.length} 件`,
      "",
      buildVaultCleanupLocatorText(items, input.vaultTags)
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setItemShareMessage("已复制同名定位清单");
    } catch {
      setItemShareMessage("复制失败，请检查系统剪贴板权限");
    }
  }

  async function copyItemActionPlanText(
    actionInput: {
      action: "set-lock" | "equip" | "transfer";
      item_name: string;
      item_instance_id?: string;
      item_reference_hash?: number;
      character_id?: string;
      state?: boolean;
      transfer_to_vault?: boolean;
    }
  ) {
    input.setItemActionMessage("");
    try {
      const plan = await api.createItemActionPlan(actionInput);
      await navigator.clipboard.writeText([
        "d2-tools 装备操作计划",
        plan.title,
        plan.description,
        `需要确认：${plan.requires_confirmation ? "是" : "否"}`,
        "说明：这只是计划，不会执行 Bungie 写操作。"
      ].join("\n"));
      input.setItemActionMessage("已复制操作计划。");
    } catch (error) {
      input.setItemActionMessage(error instanceof Error ? error.message : "操作计划生成失败");
    }
  }

  async function saveVaultTagsBatch(inputs: Array<{ item_key: string; tag: VaultTagValue }>) {
    try {
      input.setVaultTags(await services.localData.saveVaultTagsBatch(inputs));
    } catch (error) {
      input.setAccountError(error instanceof Error ? error.message : "批量标记保存失败");
      throw error;
    }
  }

  async function applySameNameBatchTags(
    items: AccountItemSummary[],
    mode: Parameters<typeof buildDuplicateGroupBatchTagPlan>[1]
  ) {
    const group = buildVaultDuplicateSummary(items, input.vaultTags).groups[0];
    if (!group) return;

    setItemNoteMessage("");
    setItemShareMessage("");

    try {
      const plan = protectVaultCleanupTagPlan(
        buildDuplicateGroupBatchTagPlan(group, mode),
        input.cleanupProtectionByItemKey,
        input.vaultTags
      );
      await saveVaultTagsBatch(plan.inputs);
      setItemNoteMessage(
        `${mode === "keep-best-review-rest"
          ? "已将推荐项保留，其余标记为待定。"
          : mode === "keep-best-junk-rest"
            ? "已将推荐项保留，其余标记为清理。"
            : "已清除这组同名装备的本地标记。"}${plan.protectedCount
              ? ` ${plan.protectedCount} 件受保护，已保持原状态。`
              : ""}`
      );
    } catch (error) {
      setItemNoteMessage(error instanceof Error ? error.message : "同名装备批量标记失败");
    }
  }

  async function applySameNameCurrentKeepTags(
    items: AccountItemSummary[],
    currentItemKey: string,
    mode: "keep-current-review-rest" | "keep-current-junk-rest"
  ) {
    setItemNoteMessage("");
    setItemShareMessage("");

    try {
      const plan = protectVaultCleanupTagPlan(
        items.map((item) => ({
          item_key: getItemKey(item),
          tag: getItemKey(item) === currentItemKey
            ? "keep"
            : mode === "keep-current-review-rest"
              ? "review"
              : "junk"
        })),
        input.cleanupProtectionByItemKey,
        input.vaultTags
      );
      await saveVaultTagsBatch(plan.inputs);
      setItemNoteMessage(
        `${mode === "keep-current-review-rest"
          ? "已保留当前这件，其余同名装备已标记为待定。"
          : "已保留当前这件，其余同名装备已标记为清理。"}${plan.protectedCount
            ? ` ${plan.protectedCount} 件受保护，已保持原状态。`
            : ""}`
      );
    } catch (error) {
      setItemNoteMessage(error instanceof Error ? error.message : "同名装备批量标记失败");
    }
  }

  function openBestSameNameItem(items: SameNameItemSummary[]) {
    const bestItem = selectBestSameNameItem(items);
    if (!bestItem) return;

    void openItemDetail(bestItem, {
      source_character_id: bestItem.source_character_id,
      is_vault_item: bestItem.is_vault_item,
      is_postmaster_item: bestItem.is_postmaster_item
    });
  }

  async function runItemWriteAction(
    label: string,
    run: () => Promise<ItemActionResult>,
    options?: {
      keepDetailOpen?: boolean;
      feedbackScope?: "global" | "detail";
      onProgress?: (phase: "submitting" | "refreshing", message: string) => void;
      verifyRefreshedItem?: (detail: AccountItemDetail) => boolean;
      refreshMismatchMessage?: string;
      expectedAccountPatch?: AccountItemActionPatch;
    }
  ): Promise<{ ok: boolean; refreshed: boolean; message: string; cancelled?: boolean }> {
    const publishMessage = (message: string) => {
      if (options?.feedbackScope !== "detail") {
        input.setItemActionMessage(message);
      }
    };
    const publishProgress = (phase: "submitting" | "refreshing", message: string) => {
      publishMessage(message);
      options?.onProgress?.(phase, message);
    };

    if (!selectedItem || !input.accountSummary) {
      return { ok: false, refreshed: false, message: "装备详情已关闭或账号数据不可用。" };
    }
    if (!selectedItem.instance_id) {
      const message = "这个物品没有实例 ID，不能执行 Bungie 写操作。";
      publishMessage(message);
      return { ok: false, refreshed: false, message };
    }
    if (!selectedActionCharacterId) {
      const message = "请先选择目标角色。";
      publishMessage(message);
      return { ok: false, refreshed: false, message };
    }
    input.setIsRunningItemAction(true);
    const actionStartedAt = performance.now();
    const fallbackOperationId = createWriteActionOperationId();
    const debugAction = resolveWriteActionLogType(options?.expectedAccountPatch, label);
    const debugBase = {
      action: debugAction,
      item_name: selectedItem.name,
      item_instance_id: selectedItem.instance_id,
      character_id: selectedActionCharacterId
    } as const;
    const submittingMessage = `${label}正在提交到 Bungie...`;
    publishProgress("submitting", submittingMessage);
    if (options?.expectedAccountPatch) {
      input.setAccountOperationFeedback({
        tone: "pending",
        phase: "submitting",
        itemInstanceIds: [options.expectedAccountPatch.item_instance_id],
        message: submittingMessage
      });
    }
    setItemShareMessage("");

    try {
      const result = await run();
      const operationId = result.diagnostics?.operation_id ?? fallbackOperationId;
      const accountPatch = result.account_patch ?? options?.expectedAccountPatch;
      if (accountPatch) {
        input.applyAcceptedAccountActionPatches([accountPatch]);
        recordWriteActionDebug({
          ...debugBase,
          operation_id: operationId,
          phase: "account-patch-applied",
          elapsed_ms: performance.now() - actionStartedAt,
          reflected: true,
          message: "Bungie 写接口已受理，账号 Store 已提交单件局部变化"
        });
        const message = result.message;
        publishMessage(message);
        input.setAccountOperationFeedback({
          tone: "success",
          phase: "confirmed",
          itemInstanceIds: [accountPatch.item_instance_id],
          message
        });
        void input.diagnostics.loadActionLog().catch(() => undefined);
        return { ok: true, refreshed: false, message };
      }
      if (options?.keepDetailOpen) {
        try {
          publishProgress("refreshing", "写入请求已受理，正在读取服务器配置确认结果...");
          const refreshed = await refreshItemDetailUntilVerified({
            refresh: refreshSelectedItemDetail,
            verify: options.verifyRefreshedItem,
            onRetry: (attempt, total) => publishProgress(
              "refreshing",
              `Bungie 正在同步配置，正在重新读取（${attempt}/${total}）...`
            )
          });
          if (!refreshed) {
            const message = options.refreshMismatchMessage
              ?? "写入请求已受理，但 Bungie 返回的详情仍是旧状态，当前配置尚未确认。请稍后重新读取。";
            publishMessage(message);
            return { ok: true, refreshed: false, message };
          }
          publishMessage("已从 Bungie 读取并确认服务器最新配置。");
        } catch (error) {
          if (options?.feedbackScope !== "detail") {
            input.setAccountError(error instanceof Error ? error.message : "写入请求已受理，但读取装备配置失败");
          }
          const message = "写入请求已受理，但尚未确认服务器最新配置。请重新读取配置后再继续操作。";
          publishMessage(message);
          return {
            ok: true,
            refreshed: false,
            message
          };
        }
      } else {
        closeSelectedItemDetail();
        publishMessage(`${result.message} 页面会在下次账号同步时校准。`);
      }
      void input.diagnostics.loadActionLog().catch(() => undefined);
      const completionMessage = options?.keepDetailOpen
        ? "已从 Bungie 读取并确认服务器最新配置。"
        : `${result.message} 页面会在下次账号同步时校准。`;
      return {
        ok: true,
        refreshed: options?.keepDetailOpen === true,
        message: completionMessage
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : `${label}失败`;
      if (options?.expectedAccountPatch) {
        input.setAccountOperationFeedback({
          tone: "error",
          phase: "failed",
          itemInstanceIds: [options.expectedAccountPatch.item_instance_id],
          message
        });
      }
      if (options?.keepDetailOpen) {
        publishProgress("refreshing", "操作未完成，正在读取服务器当前配置...");
        await refreshSelectedItemDetail().catch(() => undefined);
      }
      publishMessage(message);
      await Promise.allSettled([input.diagnostics.loadActionLog()]);
      return { ok: false, refreshed: false, message };
    } finally {
      input.setIsRunningItemAction(false);
    }
  }

  async function refreshItemDetailUntilVerified(input: {
    refresh: () => Promise<AccountItemDetail | null>;
    verify?: (detail: AccountItemDetail) => boolean;
    onRetry: (attempt: number, total: number) => void;
  }): Promise<boolean> {
    const retryDelays = input.verify ? [0, 750, 1_500, 2_500, 4_000, 6_000] : [0];
    for (let index = 0; index < retryDelays.length; index += 1) {
      const delay = retryDelays[index];
      if (delay > 0) {
        input.onRetry(index + 1, retryDelays.length);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      const detail = await input.refresh();
      if (detail && (!input.verify || input.verify(detail))) return true;
    }
    return false;
  }

  function recordWriteActionDebug(event: ActionDebugTraceInput): void {
    writeActionDebugQueueRef.current = writeActionDebugQueueRef.current
      .catch(() => undefined)
      .then(() => api.recordActionDebugTrace(event))
      .catch((error) => {
        console.warn("写操作诊断日志记录失败：", error);
      });
  }

  function createWriteActionOperationId(): string {
    return typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `item-action-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function resolveWriteActionLogType(
    patch: AccountItemActionPatch | undefined,
    label: string
  ): ActionLogType {
    if (patch?.kind === "equip") return "equip";
    if (patch?.kind === "transfer") return "transfer";
    if (patch?.kind === "postmaster-pull") return "postmaster-pull";
    if (patch?.kind === "lock") return "set-lock";
    return label.includes("Perk") || label.includes("配置")
      ? "insert-socket-plug"
      : "equip";
  }

  return {
    selectedItem,
    selectedSameNameItems,
    selectedActionCharacterId,
    itemDetailLoadingKey,
    itemDetailError,
    communityRecommendations,
    communityRecommendationError,
    isCommunityRecommendationsLoading,
    selectedItemAvailability,
    selectedItemVersions,
    isSelectedItemVersionsLoading,
    itemAiResult,
    itemAiError,
    itemNoteDraft,
    itemNoteMessage,
    itemShareMessage,
    isGeneratingItemAi,
    openItemDetail,
    loadSelectedItemFullDetail,
    closeSelectedItemDetail,
    setItemNoteDraft,
    setSelectedActionCharacterId,
    generateItemAiAdvice,
    copySelectedItemSummary,
    copySelectedItemChatGuide,
    saveSelectedItemNote,
    saveSelectedItemTag,
    copyWishlistInsight,
    copySameNameLocator,
    copyItemActionPlanText,
    applySameNameBatchTags,
    applySameNameCurrentKeepTags,
    openBestSameNameItem,
    refreshSelectedItemDetail,
    runItemWriteAction
  };
}

function buildCommunityRecommendationCacheKey(
  detailScopeKey: string,
  recommendationRevision: string | undefined,
  itemHash: number,
  itemName: string
): string {
  return [
    detailScopeKey,
    recommendationRevision?.trim() || "recommendation-revision-pending",
    itemHash,
    itemName.trim()
  ].join("\u0000");
}

function touchBoundedCache<TKey, TValue>(
  cache: Map<TKey, TValue>,
  key: TKey,
  value: TValue,
  limit: number
): void {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > limit) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) return;
    cache.delete(oldest);
  }
}

function scheduleWhenRendererIdle(
  callback: () => void,
  timeout: number,
  fallbackDelay: number
): void {
  const idleScheduler = (globalThis as typeof globalThis & {
    requestIdleCallback?: (handler: () => void, options?: { timeout: number }) => number;
  }).requestIdleCallback;
  if (idleScheduler) {
    idleScheduler(callback, { timeout });
    return;
  }
  globalThis.setTimeout(callback, fallbackDelay);
}
