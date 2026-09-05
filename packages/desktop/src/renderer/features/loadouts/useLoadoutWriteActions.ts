import { useRef } from "react";
import type { analyzeLoadoutTemplate } from "@d2-tools/core/loadouts/analysis";
import type { AccountOperationFeedbackView } from "@d2-tools/app/account";
import { api } from "../../api/client";
import {
  type AccountItemActionPatch,
  type AccountItemSummary,
  type AccountSummary,
  type AccountWriteVerificationInput,
  type BatchItemActionResult,
  type BuildGuideLoadoutDraft,
  type ItemActionResult,
  type ItemEquipActionInput,
  type LoadoutTemplate
} from "../../api/types";
import {
  buildHighestPowerAlreadyOptimalMessage,
  buildHighestPowerEquipProgressMessage,
  buildHighestPowerResultMessage,
  buildHighestPowerTransferProgressMessage,
  createHighestPowerEquipPlan,
  createHighestPowerExecutionPlan
} from "../../utils/highestPower";
import {
  buildMissingLoadoutTransferPlan
} from "../../utils/loadoutTransfer";
import {
  buildCharacterLoadoutTemplateName,
  buildLoadoutItemActionFailureMessage,
  buildLoadoutSlotActionConfirmText,
  buildLoadoutSlotActionLabel,
  buildLoadoutSlotActionProgressMessage,
  buildLoadoutTemplateDeletedMessage,
  buildLoadoutTemplateRenamedMessage,
  buildMissingLoadoutConfirmText,
  buildMissingLoadoutNoActionMessage,
  buildMissingLoadoutPrepareMessage,
  buildMissingLoadoutResultMessage,
  buildMissingLoadoutStepProgressMessage,
  buildSaveCharacterLoadoutSuccessMessage,
  buildSingleLoadoutEquipConfirmText,
  buildSingleLoadoutEquipMissingSourceMessage,
  buildSingleLoadoutEquipProgressMessage,
  buildSingleLoadoutEquipWrongLocationMessage,
  buildSingleLoadoutTransferConfirmText,
  buildSingleLoadoutTransferCancelledMessage,
  buildSingleLoadoutTransferNoActionMessage,
  buildSingleLoadoutTransferNoTargetMessage,
  buildSingleLoadoutTransferResultMessage,
  buildSingleLoadoutTransferStartMessage,
  buildSingleLoadoutTransferStepProgressMessage,
  getMissingLoadoutActionableCount
} from "../../utils/loadoutActions";
import { buildLoadoutActionFeedbackKey } from "../../utils/loadoutActionFeedback";
import type { SelectedItemSource } from "../../shared/hooks/useItemDetail";
import { findBestTemplateSourceItem } from "../../shared/domain/loadouts/loadoutSources";

type LoadoutLibraryBridge = {
  reloadTemplates: () => Promise<void>;
  renameTemplate: (template: LoadoutTemplate) => Promise<LoadoutTemplate>;
  deleteTemplate: (id: string) => Promise<LoadoutTemplate[]>;
};

type DiagnosticsBridge = {
  loadActionLog: () => Promise<void>;
};

type LoadoutActionFeedbackBridge = {
  setSingleActionFeedback: (key: string, state: "idle" | "pending" | "success") => void;
};

export function useLoadoutWriteActions(input: {
  accountSummary: AccountSummary | null;
  loadoutLibrary: LoadoutLibraryBridge;
  diagnostics: DiagnosticsBridge;
  loadoutActionFeedback: LoadoutActionFeedbackBridge;
  setLoadoutMessage: (message: string) => void;
  setItemActionMessage: (message: string) => void;
  setAccountOperationFeedback: (feedback: AccountOperationFeedbackView | undefined) => void;
  setIsRunningItemAction: (isRunning: boolean) => void;
  applyCommittedAccountActionPatches: (patches: readonly AccountItemActionPatch[]) => void;
  startHighestPowerVerification: (
    input: AccountWriteVerificationInput,
    options?: { surfaceFeedback?: boolean }
  ) => Promise<void>;
  loadAccountSummary: () => Promise<void>;
  openItemDetail: (item: AccountItemSummary, source?: SelectedItemSource) => void | Promise<void>;
}) {
  // 配装页可能从模板条目、迁移计划等多个入口同时打开同一实例。
  // 共享详情 hook 已负责跨页面缓存和 in-flight 去重，这里再挡住本 feature
  // 内重复的 open 调用，避免快速连点导致弹层状态反复切换或重复启动读取。
  const pendingSourceDetailOpens = useRef(new Map<string, Promise<void>>()).current;

  function applySuccessfulWriteResult(
    result: ItemActionResult | BatchItemActionResult
  ): {
    hasSuccessfulWrite: boolean;
    requiresFullRefresh: boolean;
    patches: AccountItemActionPatch[];
  } {
    const patches = "account_patches" in result
      ? result.account_patches
      : result.account_patch
        ? [result.account_patch]
        : [];
    const successCount = "success_count" in result ? result.success_count : 1;
    return {
      hasSuccessfulWrite: successCount > 0,
      requiresFullRefresh: successCount > patches.length,
      patches
    };
  }

  function applyAcceptedAccountPatches(patches: readonly AccountItemActionPatch[]): void {
    // Bungie 写接口成功后立即更新页面预计位置，并保留逐实例 Pending。
    // 后续 Profile 只负责确认或纠正，不能用延迟快照静默覆盖这次成功写入。
    if (patches.length) input.applyCommittedAccountActionPatches(patches);
  }

  function finishWriteActionsInBackground(options: {
    requiresFullRefresh: boolean;
    patches?: readonly AccountItemActionPatch[];
    characterId?: string;
    characterName?: string;
    failedCount?: number;
    operationId?: string;
  }): void {
    const account = input.accountSummary;
    const patches = collapseAccountWritePatches(options.patches ?? []);
    if (account && patches.length && options.characterId) {
      applyAcceptedAccountPatches(patches);
      const message = options.failedCount
        ? `请求已受理，正在确认 ${patches.length} 项变化；另有 ${options.failedCount} 项失败。`
        : `请求已受理，正在确认 ${patches.length} 项游戏内变化。`;
      input.setAccountOperationFeedback({
        tone: options.failedCount ? "warning" : "pending",
        phase: options.failedCount ? "partial" : "syncing",
        itemInstanceIds: patches.map((patch) => patch.item_instance_id),
        message
      });
      void input.startHighestPowerVerification({
        operation_id: options.operationId ?? createLoadoutWriteOperationId(),
        membership_type: account.membership_type,
        destiny_membership_id: account.destiny_membership_id,
        character_id: options.characterId,
        character_name: options.characterName,
        baseline_profile_minted_at: account.profile_minted_at,
        expected_patches: patches,
        accepted_count: patches.length,
        failed_count: options.failedCount ?? 0
      }, { surfaceFeedback: false });
    } else if (options.requiresFullRefresh) {
      void input.loadAccountSummary().catch(() => undefined);
    }
    void input.diagnostics.loadActionLog().catch(() => undefined);
  }

  async function saveCharacterLoadout(character: AccountSummary["characters"][number]) {
    input.setLoadoutMessage("");
    try {
      const template = await api.createLoadoutTemplate({
        name: buildCharacterLoadoutTemplateName(character),
        character_id: character.character_id,
        class_name: character.class_name,
        equipped_items: character.equipped_items
      });
      await input.loadoutLibrary.reloadTemplates();
      input.setLoadoutMessage(buildSaveCharacterLoadoutSuccessMessage(template.name));
    } catch (error) {
      input.setLoadoutMessage(error instanceof Error ? error.message : "配装模板保存失败");
    }
  }

  async function saveGuideDraft(draft: BuildGuideLoadoutDraft) {
    input.setLoadoutMessage("");
    try {
      const template = await api.createLoadoutTemplate({
        name: draft.name,
        character_id: draft.character_id,
        class_name: draft.class_name ?? "未知职业",
        equipped_items: draft.items.map((item) => ({
          hash: item.hash,
          instance_id: item.instance_id,
          name: item.name,
          bucket_name: item.bucket_name,
          item_type: item.item_type,
          group_key: "other",
          socket_plugs: []
        }))
      });
      await input.loadoutLibrary.reloadTemplates();
      input.setLoadoutMessage(`已保存攻略草稿：${template.name}`);
    } catch (error) {
      input.setLoadoutMessage(error instanceof Error ? error.message : "攻略草稿保存失败");
    }
  }

  async function equipHighestPowerItems(character: AccountSummary["characters"][number]) {
    input.setLoadoutMessage("");
    input.setItemActionMessage("正在提交最高光等装备请求...");
    input.setAccountOperationFeedback({
      tone: "pending",
      phase: "submitting",
      message: "正在提交最高光等装备请求..."
    });
    input.setIsRunningItemAction(true);
    let hasSuccessfulWrite = false;
    let verificationCharacter: AccountSummary["characters"][number] | undefined;
    const acceptedWritePatches: AccountItemActionPatch[] = [];
    const operationId = createHighestPowerOperationId();

    try {
      const account = input.accountSummary;
      if (!account) {
        const message = "当前没有可用账号数据，未执行最高光等写操作。";
        input.setLoadoutMessage(message);
        input.setAccountOperationFeedback({ tone: "error", phase: "failed", message });
        return;
      }
      const targetCharacter = account.characters.find((entry) => entry.character_id === character.character_id);
      if (!targetCharacter) {
        const message = "当前账号数据中找不到目标角色，未执行最高光等写操作。";
        input.setLoadoutMessage(message);
        input.setAccountOperationFeedback({ tone: "error", phase: "failed", message });
        return;
      }
      verificationCharacter = targetCharacter;
      const plan = createHighestPowerEquipPlan({
        character: targetCharacter,
        vaultItems: account.vault.items
      });
      const executionPlan = createHighestPowerExecutionPlan(plan);
      if (!plan.executable_items.length) {
        const message = buildHighestPowerAlreadyOptimalMessage(targetCharacter.class_name);
        input.setLoadoutMessage(message);
        input.setAccountOperationFeedback({ tone: "success", phase: "confirmed", message });
        return;
      }

      let transferAcceptedCount = 0;
      let transferFailureCount = 0;
      let successfullyTransferredItemIds = new Set<string>();
      let acceptedEquipItemIds = new Set<string>();
      let firstFailureReason: string | undefined;

      if (executionPlan.transfer_items.length) {
        const message = buildHighestPowerTransferProgressMessage(executionPlan.transfer_items.length);
        input.setItemActionMessage(message);
        input.setAccountOperationFeedback({ tone: "pending", phase: "submitting", message });
        if (executionPlan.transfer_items.length === 1) {
          const entry = executionPlan.transfer_items[0]!;
          const result = await api.transferItem({
            membership_type: account.membership_type,
            character_id: targetCharacter.character_id,
            item_id: entry.item.instance_id ?? "",
            item_reference_hash: entry.item.hash,
            item_name: entry.item.name,
            transfer_to_vault: false,
            trace: { operation_id: operationId }
          });
          const outcome = applySuccessfulWriteResult(result);
          hasSuccessfulWrite = outcome.hasSuccessfulWrite || hasSuccessfulWrite;
          acceptedWritePatches.push(...outcome.patches);
          applyAcceptedAccountPatches(outcome.patches);
          if (entry.item.instance_id) successfullyTransferredItemIds.add(entry.item.instance_id);
          transferAcceptedCount = successfullyTransferredItemIds.size;
        } else {
          const result = await api.batchTransferItems({
            membership_type: account.membership_type,
            character_id: targetCharacter.character_id,
            items: executionPlan.transfer_items.map((entry) => ({
              membership_type: account.membership_type,
              character_id: targetCharacter.character_id,
              item_id: entry.item.instance_id ?? "",
              item_reference_hash: entry.item.hash,
              item_name: entry.item.name,
              transfer_to_vault: false,
              trace: { operation_id: operationId }
            }))
          });
          firstFailureReason ??= result.failure_messages?.[0];
          const outcome = applySuccessfulWriteResult(result);
          hasSuccessfulWrite = outcome.hasSuccessfulWrite || hasSuccessfulWrite;
          acceptedWritePatches.push(...outcome.patches);
          applyAcceptedAccountPatches(outcome.patches);
          const attemptedTransferItemIds = new Set(
            executionPlan.transfer_items
              .map((entry) => entry.item.instance_id)
              .filter((itemId): itemId is string => Boolean(itemId))
          );
          successfullyTransferredItemIds = resolveBatchVerificationCandidateIds(
            attemptedTransferItemIds,
            result
          );
          transferAcceptedCount = successfullyTransferredItemIds.size;
        }
        transferFailureCount = executionPlan.transfer_items.length - transferAcceptedCount;
      }

      const equipItems = executionPlan.equip_items.filter((entry) => (
        entry.source !== "vault"
        || successfullyTransferredItemIds.has(entry.item.instance_id ?? "")
      ));

      if (equipItems.length) {
        const message = buildHighestPowerEquipProgressMessage(equipItems.length);
        input.setItemActionMessage(message);
        input.setAccountOperationFeedback({ tone: "pending", phase: "submitting", message });
        if (equipItems.length === 1) {
          const entry = equipItems[0]!;
          const result = await equipHighestPowerSingleItem({
            membership_type: account.membership_type,
            character_id: targetCharacter.character_id,
            item_id: entry.item.instance_id ?? "",
            item_name: entry.item.name,
            wait_for_character_inventory: entry.source === "vault",
            trace: { operation_id: operationId }
          });
          const outcome = applySuccessfulWriteResult(result);
          hasSuccessfulWrite = outcome.hasSuccessfulWrite || hasSuccessfulWrite;
          acceptedWritePatches.push(...outcome.patches);
          applyAcceptedAccountPatches(outcome.patches);
          if (entry.item.instance_id) acceptedEquipItemIds.add(entry.item.instance_id);
        } else {
          const result = await api.batchEquipItems({
            membership_type: account.membership_type,
            character_id: targetCharacter.character_id,
            items: equipItems.map((entry) => ({
              membership_type: account.membership_type,
              character_id: targetCharacter.character_id,
              item_id: entry.item.instance_id ?? "",
              item_name: entry.item.name,
              wait_for_character_inventory: entry.source === "vault",
              trace: { operation_id: operationId }
            }))
          });
          firstFailureReason ??= result.failure_messages?.[0];
          const outcome = applySuccessfulWriteResult(result);
          hasSuccessfulWrite = outcome.hasSuccessfulWrite || hasSuccessfulWrite;
          acceptedWritePatches.push(...outcome.patches);
          applyAcceptedAccountPatches(outcome.patches);
          const attemptedEquipItemIds = new Set(
            equipItems
              .map((entry) => entry.item.instance_id)
              .filter((itemId): itemId is string => Boolean(itemId))
          );
          acceptedEquipItemIds = resolveBatchVerificationCandidateIds(
            attemptedEquipItemIds,
            result
          );
        }
      }

      const equipFailureCount = equipItems.length - acceptedEquipItemIds.size;
      const failedSteps = transferFailureCount + equipFailureCount;
      const finalExpectedPatches: AccountItemActionPatch[] = [
        ...[...acceptedEquipItemIds].map((itemId) => ({
          kind: "equip" as const,
          item_instance_id: itemId,
          character_id: targetCharacter.character_id
        })),
        ...[...successfullyTransferredItemIds]
          .filter((itemId) => !acceptedEquipItemIds.has(itemId))
          .map((itemId) => ({
            kind: "transfer" as const,
            item_instance_id: itemId,
            character_id: targetCharacter.character_id,
            target: "character-inventory" as const
          }))
      ];
      if (!finalExpectedPatches.length) {
        const reason = firstFailureReason ? `首个失败原因：${firstFailureReason}` : "请在设置页查看操作日志。";
        const message = `最高光等执行失败：没有写入请求被受理。${reason}`;
        input.setLoadoutMessage(message);
        input.setAccountOperationFeedback({ tone: "error", phase: "failed", message });
        return;
      }

      const resultMessage = buildHighestPowerResultMessage({
        characterClassName: targetCharacter.class_name,
        transferSuccessCount: transferAcceptedCount,
        transferTotalCount: executionPlan.transfer_items.length,
        equipSuccessCount: acceptedEquipItemIds.size,
        equipTotalCount: equipItems.length,
        failedCount: failedSteps,
        failureReason: firstFailureReason
      });
      input.setLoadoutMessage(resultMessage);
      input.setAccountOperationFeedback({
        tone: failedSteps > 0 ? "warning" : "pending",
        phase: failedSteps > 0 ? "partial" : "syncing",
        itemInstanceIds: finalExpectedPatches.map((patch) => patch.item_instance_id),
        message: resultMessage
      });
      void input.startHighestPowerVerification({
        operation_id: operationId,
        membership_type: account.membership_type,
        destiny_membership_id: account.destiny_membership_id,
        character_id: targetCharacter.character_id,
        character_name: targetCharacter.class_name,
        baseline_profile_minted_at: account.profile_minted_at,
        expected_patches: finalExpectedPatches,
        accepted_count: finalExpectedPatches.length,
        failed_count: failedSteps
      }, { surfaceFeedback: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "装备最高光等失败";
      const account = input.accountSummary;
      const finalAcceptedPatches = collapseAccountWritePatches(acceptedWritePatches);
      if (account && verificationCharacter && finalAcceptedPatches.length) {
        applyAcceptedAccountPatches(finalAcceptedPatches);
        const partialMessage = `最高光等部分受理：正在确认 ${finalAcceptedPatches.length} 项变化；后续步骤失败：${message}`;
        input.setLoadoutMessage(partialMessage);
        input.setAccountOperationFeedback({
          tone: "warning",
          phase: "partial",
          itemInstanceIds: finalAcceptedPatches.map((patch) => patch.item_instance_id),
          message: partialMessage
        });
        void input.startHighestPowerVerification({
          operation_id: operationId,
          membership_type: account.membership_type,
          destiny_membership_id: account.destiny_membership_id,
          character_id: verificationCharacter.character_id,
          character_name: verificationCharacter.class_name,
          baseline_profile_minted_at: account.profile_minted_at,
          expected_patches: finalAcceptedPatches,
          accepted_count: finalAcceptedPatches.length,
          failed_count: 1
        }, { surfaceFeedback: false });
      } else {
        input.setLoadoutMessage(message);
        input.setAccountOperationFeedback({ tone: "error", phase: "failed", message });
      }
    } finally {
      if (hasSuccessfulWrite) {
        void input.diagnostics.loadActionLog().catch(() => undefined);
      }
      input.setItemActionMessage("");
      input.setIsRunningItemAction(false);
    }
  }

  function createHighestPowerOperationId(): string {
    return typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `highest-power-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  async function runLoadoutWriteAction(
    character: AccountSummary["characters"][number],
    slot: AccountSummary["characters"][number]["loadout_slots"][number],
    label: string,
    run: () => Promise<ItemActionResult>,
    expectedPatches: readonly AccountItemActionPatch[] = []
  ) {
    input.setLoadoutMessage("");
    input.setItemActionMessage(buildLoadoutSlotActionProgressMessage(label));

    if (!window.confirm(buildLoadoutSlotActionConfirmText({
      label,
      characterClassName: character.class_name,
      slotName: slot.name,
      slotIndex: slot.index
    }))) {
      return;
    }

    input.setIsRunningItemAction(true);
    try {
      const result = await run();
      const outcome = applySuccessfulWriteResult(result);
      const patches = [...outcome.patches, ...expectedPatches];
      const hasEquipPatch = patches.some((patch) => patch.kind === "equip");
      input.setLoadoutMessage(patches.length
        ? hasEquipPatch
          ? `${result.message}，正在确认游戏内状态。`
          : `${result.message}，页面已更新。`
        : "写入请求已受理，正在后台刷新账号数据。");
      finishWriteActionsInBackground({
        requiresFullRefresh: outcome.requiresFullRefresh,
        patches,
        characterId: character.character_id,
        characterName: character.class_name
      });
    } catch (error) {
      input.setLoadoutMessage(error instanceof Error ? error.message : `${label}失败`);
      await input.diagnostics.loadActionLog();
    } finally {
      input.setIsRunningItemAction(false);
    }
  }

  async function equipSavedLoadout(
    character: AccountSummary["characters"][number],
    slot: AccountSummary["characters"][number]["loadout_slots"][number]
  ) {
    await runLoadoutWriteAction(
      character,
      slot,
      buildLoadoutSlotActionLabel("equip", slot),
      () => api.equipLoadout({
        membership_type: input.accountSummary?.membership_type ?? 0,
        character_id: character.character_id,
        loadout_index: slot.index,
        loadout_name: slot.name
      }),
      slot.items.flatMap((item) => item.instance_id ? [{
        kind: "equip" as const,
        item_instance_id: item.instance_id,
        character_id: character.character_id
      }] : [])
    );
  }

  async function snapshotCurrentLoadout(
    character: AccountSummary["characters"][number],
    slot: AccountSummary["characters"][number]["loadout_slots"][number]
  ) {
    await runLoadoutWriteAction(
      character,
      slot,
      buildLoadoutSlotActionLabel("snapshot", slot),
      () => api.snapshotLoadout({
        membership_type: input.accountSummary?.membership_type ?? 0,
        character_id: character.character_id,
        loadout_index: slot.index,
        loadout_name: slot.name,
        loadout_name_hash: slot.name_hash,
        loadout_icon_hash: slot.icon_hash,
        loadout_color_hash: slot.color_hash
      })
    );
  }

  async function clearSavedLoadout(
    character: AccountSummary["characters"][number],
    slot: AccountSummary["characters"][number]["loadout_slots"][number]
  ) {
    await runLoadoutWriteAction(
      character,
      slot,
      "清空游戏内配装栏",
      () => api.clearLoadout({
        membership_type: input.accountSummary?.membership_type ?? 0,
        character_id: character.character_id,
        loadout_index: slot.index,
        loadout_name: slot.name
      })
    );
  }

  async function updateSavedLoadoutIdentifiers(
    character: AccountSummary["characters"][number],
    slot: AccountSummary["characters"][number]["loadout_slots"][number],
    identifiers: { name_hash?: number; icon_hash?: number; color_hash?: number }
  ) {
    await runLoadoutWriteAction(
      character,
      slot,
      "更新游戏内配装标识",
      () => api.updateLoadoutIdentifiers({
        membership_type: input.accountSummary?.membership_type ?? 0,
        character_id: character.character_id,
        loadout_index: slot.index,
        loadout_name: slot.name,
        loadout_name_hash: identifiers.name_hash,
        loadout_icon_hash: identifiers.icon_hash,
        loadout_color_hash: identifiers.color_hash
      })
    );
  }

  async function deleteLoadoutTemplate(id: string) {
    try {
      await input.loadoutLibrary.deleteTemplate(id);
      input.setLoadoutMessage(buildLoadoutTemplateDeletedMessage());
    } catch (error) {
      input.setLoadoutMessage(error instanceof Error ? error.message : "删除配装模板失败");
    }
  }

  async function renameLoadoutTemplate(template: LoadoutTemplate) {
    input.setLoadoutMessage("");
    try {
      const renamed = await input.loadoutLibrary.renameTemplate(template);
      input.setLoadoutMessage(buildLoadoutTemplateRenamedMessage(renamed.name));
    } catch (error) {
      input.setLoadoutMessage(error instanceof Error ? error.message : "本地方案重命名失败");
    }
  }

  async function executeMissingLoadoutTransfer(
    template: LoadoutTemplate,
    analysis: ReturnType<typeof analyzeLoadoutTemplate> | null
  ) {
    void analysis;
    if (!input.accountSummary) {
      input.setLoadoutMessage("请先同步装备数据。");
      return;
    }
    const account = input.accountSummary;

    const targetCharacter = account.characters.find((character) => character.character_id === template.character_id)
      ?? account.characters[0];
    if (!targetCharacter) {
      input.setLoadoutMessage("没有可用角色，无法转移缺失件。");
      return;
    }

    const transferPlan = buildMissingLoadoutTransferPlan({
      template,
      missingItems: template.items,
      accountSummary: account
    });
    const actionableItemCount = getMissingLoadoutActionableCount(transferPlan);
    if (!actionableItemCount) {
      input.setLoadoutMessage(buildMissingLoadoutNoActionMessage(transferPlan));
      return;
    }

    if (!window.confirm(buildMissingLoadoutConfirmText({
      targetCharacterClassName: targetCharacter.class_name,
      actionableItemCount,
      transferPlan
    }))) {
      input.setLoadoutMessage("已取消缺失件转移。");
      return;
    }

    input.setIsRunningItemAction(true);
    input.setItemActionMessage(buildMissingLoadoutPrepareMessage(actionableItemCount));
    let hasSuccessfulWrite = false;
    let requiresFullRefresh = false;
    let operationFailed = false;
    const acceptedPatches: AccountItemActionPatch[] = [];
    const operationId = createLoadoutWriteOperationId();

    try {
      let targetTransferCount = 0;
      let autoEquipCount = 0;
      let prepStepCount = 0;
      for (const step of transferPlan.steps) {
        if (step.phase === "equip-swap") {
          input.setItemActionMessage(buildMissingLoadoutStepProgressMessage(step, targetCharacter.class_name));
          const equipResult = await api.batchEquipItems({
            membership_type: account.membership_type,
            character_id: step.character_id,
            items: step.items.map((item) => ({
              membership_type: account.membership_type,
              character_id: step.character_id,
              item_id: item.item_id,
              item_name: item.item_name,
              wait_for_character_inventory: true
            }))
          });
          const outcome = applySuccessfulWriteResult(equipResult);
          hasSuccessfulWrite = outcome.hasSuccessfulWrite || hasSuccessfulWrite;
          requiresFullRefresh = outcome.requiresFullRefresh || requiresFullRefresh;
          acceptedPatches.push(...outcome.patches);

          if (equipResult.failed_count > 0) {
            throw new Error(equipResult.message || "替代装备装备失败，请检查来源角色装备状态后重试。");
          }
          prepStepCount += equipResult.success_count;
          continue;
        }
        if (step.phase === "pull-postmaster") {
          input.setItemActionMessage(buildMissingLoadoutStepProgressMessage(step, targetCharacter.class_name));
          for (const item of step.items) {
            const result = await api.pullFromPostmaster({
              membership_type: account.membership_type,
              character_id: step.character_id,
              item_id: item.item_id,
              item_reference_hash: item.item_reference_hash,
              source_bucket_hash: item.bucket_hash,
              item_name: item.item_name
            });
            const outcome = applySuccessfulWriteResult(result);
            hasSuccessfulWrite = outcome.hasSuccessfulWrite || hasSuccessfulWrite;
            requiresFullRefresh = outcome.requiresFullRefresh || requiresFullRefresh;
            acceptedPatches.push(...outcome.patches);
          }
          prepStepCount += step.items.length;
          continue;
        }
        if (step.phase === "equip-target") {
          input.setItemActionMessage(buildMissingLoadoutStepProgressMessage(step, targetCharacter.class_name));
          const equipResult = await api.batchEquipItems({
            membership_type: account.membership_type,
            character_id: step.character_id,
            items: step.items.map((item) => ({
              membership_type: account.membership_type,
              character_id: step.character_id,
              item_id: item.item_id,
              item_name: item.item_name,
              wait_for_character_inventory: true
            }))
          });
          const outcome = applySuccessfulWriteResult(equipResult);
          hasSuccessfulWrite = outcome.hasSuccessfulWrite || hasSuccessfulWrite;
          requiresFullRefresh = outcome.requiresFullRefresh || requiresFullRefresh;
          acceptedPatches.push(...outcome.patches);

          autoEquipCount += equipResult.success_count;
          if (equipResult.failed_count > 0) {
            throw new Error(equipResult.message || "方案装备自动穿戴失败，请检查当前角色状态后重试。");
          }
          continue;
        }
        input.setItemActionMessage(buildMissingLoadoutStepProgressMessage(step, targetCharacter.class_name));

        const result = await api.batchTransferItems({
          membership_type: account.membership_type,
          character_id: step.character_id,
          items: step.items.map((item) => ({
            membership_type: account.membership_type,
            character_id: step.character_id,
            item_id: item.item_id,
            item_reference_hash: item.item_reference_hash,
            item_name: item.item_name,
            transfer_to_vault: step.transfer_to_vault
          }))
        });
        const outcome = applySuccessfulWriteResult(result);
        hasSuccessfulWrite = outcome.hasSuccessfulWrite || hasSuccessfulWrite;
        requiresFullRefresh = outcome.requiresFullRefresh || requiresFullRefresh;
        acceptedPatches.push(...outcome.patches);
        if (step.phase === "to-character") {
          targetTransferCount += result.success_count;
        } else {
          prepStepCount += result.success_count;
        }

        if (result.failed_count > 0) {
          throw new Error(result.message || "缺失件转移未全部成功，请检查物品状态后重试。");
        }
      }
      const resultSummary = buildMissingLoadoutResultMessage({
        targetTransferCount,
        autoEquipCount,
        prepStepCount,
        blockedCount: transferPlan.blocked.length
      });
      input.setLoadoutMessage(`${resultSummary}${acceptedPatches.some((patch) => patch.kind === "equip")
        ? " 正在确认游戏内状态。"
        : " 页面已更新。"}`);
    } catch (error) {
      operationFailed = true;
      input.setLoadoutMessage(error instanceof Error ? error.message : "缺失件转移失败");
    } finally {
      if (hasSuccessfulWrite) finishWriteActionsInBackground({
        requiresFullRefresh,
        patches: acceptedPatches,
        characterId: targetCharacter.character_id,
        characterName: targetCharacter.class_name,
        failedCount: operationFailed ? 1 : 0,
        operationId
      });
      input.setIsRunningItemAction(false);
      input.setItemActionMessage("");
    }
  }

  async function executeSingleLoadoutItemTransfer(
    template: LoadoutTemplate,
    item: LoadoutTemplate["items"][number]
  ) {
    const feedbackKey = buildLoadoutActionFeedbackKey(template.id, item, "transfer");
    if (!input.accountSummary) {
      input.setLoadoutMessage("请先同步装备数据。");
      return;
    }
    const account = input.accountSummary;

    const targetCharacter = account.characters.find((character) => character.character_id === template.character_id)
      ?? account.characters[0];
    if (!targetCharacter) {
      input.setLoadoutMessage(buildSingleLoadoutTransferNoTargetMessage());
      return;
    }

    const transferPlan = buildMissingLoadoutTransferPlan({
      template: { ...template, items: [item] },
      missingItems: [item],
      accountSummary: account
    });
    const actionableItemCount = getMissingLoadoutActionableCount(transferPlan);
    if (!actionableItemCount) {
      input.setLoadoutMessage(buildSingleLoadoutTransferNoActionMessage({
        itemName: item.name,
        transferPlan
      }));
      return;
    }

    if (!window.confirm(buildSingleLoadoutTransferConfirmText(item.name))) {
      input.setLoadoutMessage(buildSingleLoadoutTransferCancelledMessage());
      return;
    }

    input.setIsRunningItemAction(true);
    input.loadoutActionFeedback.setSingleActionFeedback(feedbackKey, "pending");
    input.setItemActionMessage(buildSingleLoadoutTransferStartMessage(item.name));
    input.setLoadoutMessage(buildSingleLoadoutTransferStartMessage(item.name));
    let actionSucceeded = false;
    let hasSuccessfulWrite = false;
    let requiresFullRefresh = false;
    const acceptedPatches: AccountItemActionPatch[] = [];
    const operationId = createLoadoutWriteOperationId();

    try {
      let targetTransferCount = 0;
      let autoEquipCount = 0;
      let prepStepCount = 0;
      for (const step of transferPlan.steps) {
        if (step.phase === "equip-swap") {
          const stepMessage = buildSingleLoadoutTransferStepProgressMessage({
            step,
            itemName: item.name,
            targetCharacterClassName: targetCharacter.class_name
          });
          input.setItemActionMessage(stepMessage);
          input.setLoadoutMessage(stepMessage);
          const equipResult = await api.batchEquipItems({
            membership_type: account.membership_type,
            character_id: step.character_id,
            items: step.items.map((entry) => ({
              membership_type: account.membership_type,
              character_id: step.character_id,
              item_id: entry.item_id,
              item_name: entry.item_name,
              wait_for_character_inventory: true
            }))
          });
          const outcome = applySuccessfulWriteResult(equipResult);
          hasSuccessfulWrite = outcome.hasSuccessfulWrite || hasSuccessfulWrite;
          requiresFullRefresh = outcome.requiresFullRefresh || requiresFullRefresh;
          acceptedPatches.push(...outcome.patches);

          if (equipResult.failed_count > 0) {
            throw new Error(equipResult.message || "来源角色替换装备失败，请稍后重试。");
          }
          prepStepCount += equipResult.success_count;
          continue;
        }

        if (step.phase === "pull-postmaster") {
          const stepMessage = buildSingleLoadoutTransferStepProgressMessage({
            step,
            itemName: item.name,
            targetCharacterClassName: targetCharacter.class_name
          });
          input.setItemActionMessage(stepMessage);
          input.setLoadoutMessage(stepMessage);
          for (const entry of step.items) {
            const result = await api.pullFromPostmaster({
              membership_type: account.membership_type,
              character_id: step.character_id,
              item_id: entry.item_id,
              item_reference_hash: entry.item_reference_hash,
              source_bucket_hash: entry.bucket_hash,
              item_name: entry.item_name
            });
            const outcome = applySuccessfulWriteResult(result);
            hasSuccessfulWrite = outcome.hasSuccessfulWrite || hasSuccessfulWrite;
            requiresFullRefresh = outcome.requiresFullRefresh || requiresFullRefresh;
            acceptedPatches.push(...outcome.patches);
          }
          prepStepCount += step.items.length;
          continue;
        }

        if (step.phase === "equip-target") {
          const stepMessage = buildSingleLoadoutTransferStepProgressMessage({
            step,
            itemName: item.name,
            targetCharacterClassName: targetCharacter.class_name
          });
          input.setItemActionMessage(stepMessage);
          input.setLoadoutMessage(stepMessage);
          const equipResult = await api.batchEquipItems({
            membership_type: account.membership_type,
            character_id: step.character_id,
            items: step.items.map((entry) => ({
              membership_type: account.membership_type,
              character_id: step.character_id,
              item_id: entry.item_id,
              item_name: entry.item_name,
              wait_for_character_inventory: true
            }))
          });
          const outcome = applySuccessfulWriteResult(equipResult);
          hasSuccessfulWrite = outcome.hasSuccessfulWrite || hasSuccessfulWrite;
          requiresFullRefresh = outcome.requiresFullRefresh || requiresFullRefresh;
          acceptedPatches.push(...outcome.patches);

          autoEquipCount += equipResult.success_count;
          if (equipResult.failed_count > 0) {
            throw new Error(equipResult.message || "目标角色装备失败，请稍后重试。");
          }
          continue;
        }

        const stepMessage = buildSingleLoadoutTransferStepProgressMessage({
          step,
          itemName: item.name,
          targetCharacterClassName: targetCharacter.class_name
        });
        input.setItemActionMessage(stepMessage);
        input.setLoadoutMessage(stepMessage);

        const result = await api.batchTransferItems({
          membership_type: account.membership_type,
          character_id: step.character_id,
          items: step.items.map((entry) => ({
            membership_type: account.membership_type,
            character_id: step.character_id,
            item_id: entry.item_id,
            item_reference_hash: entry.item_reference_hash,
            item_name: entry.item_name,
            transfer_to_vault: step.transfer_to_vault
          }))
        });
        const outcome = applySuccessfulWriteResult(result);
        hasSuccessfulWrite = outcome.hasSuccessfulWrite || hasSuccessfulWrite;
        requiresFullRefresh = outcome.requiresFullRefresh || requiresFullRefresh;
        acceptedPatches.push(...outcome.patches);

        if (step.phase === "to-character") {
          targetTransferCount += result.success_count;
        } else {
          prepStepCount += result.success_count;
        }

        if (result.failed_count > 0) {
          throw new Error(result.message || "单件补齐未全部成功，请检查物品状态后重试。");
        }
      }

      const resultSummary = buildSingleLoadoutTransferResultMessage({
        itemName: item.name,
        targetTransferCount,
        autoEquipCount,
        prepStepCount
      });
      input.setLoadoutMessage(`${resultSummary}${acceptedPatches.some((patch) => patch.kind === "equip")
        ? " 正在确认游戏内状态。"
        : " 页面已更新。"}`);
      actionSucceeded = true;
    } catch (error) {
      input.setLoadoutMessage(error instanceof Error ? error.message : buildLoadoutItemActionFailureMessage("transfer", item.name));
    } finally {
      if (hasSuccessfulWrite) finishWriteActionsInBackground({
        requiresFullRefresh,
        patches: acceptedPatches,
        characterId: targetCharacter.character_id,
        characterName: targetCharacter.class_name,
        failedCount: actionSucceeded ? 0 : 1,
        operationId
      });
      input.setIsRunningItemAction(false);
      input.setItemActionMessage("");
      input.loadoutActionFeedback.setSingleActionFeedback(feedbackKey, "idle");
    }
  }

  async function equipSingleLoadoutItem(
    template: LoadoutTemplate,
    item: LoadoutTemplate["items"][number]
  ) {
    const feedbackKey = buildLoadoutActionFeedbackKey(template.id, item, "equip");
    if (!input.accountSummary) {
      input.setLoadoutMessage("请先同步装备数据。");
      return;
    }
    const account = input.accountSummary;

    const sourceItem = findBestTemplateSourceItem(item, account, template.character_id);
    if (!sourceItem?.instance_id) {
      input.setLoadoutMessage(buildSingleLoadoutEquipMissingSourceMessage(item.name));
      return;
    }
    if (sourceItem.source_kind !== "inventory" || sourceItem.source_character_id !== template.character_id) {
      input.setLoadoutMessage(buildSingleLoadoutEquipWrongLocationMessage(item.name));
      return;
    }

    if (!window.confirm(buildSingleLoadoutEquipConfirmText(item.name))) {
      input.setLoadoutMessage("已取消单件装备。");
      return;
    }

    input.setIsRunningItemAction(true);
    input.loadoutActionFeedback.setSingleActionFeedback(feedbackKey, "pending");
    input.setItemActionMessage(buildSingleLoadoutEquipProgressMessage(item.name));
    input.setLoadoutMessage(buildSingleLoadoutEquipProgressMessage(item.name));
    try {
      const result = await api.equipItem({
        membership_type: account.membership_type,
        character_id: template.character_id,
        item_id: sourceItem.instance_id,
        item_name: sourceItem.name
      });
      const outcome = applySuccessfulWriteResult(result);
      finishWriteActionsInBackground({
        requiresFullRefresh: outcome.requiresFullRefresh,
        patches: outcome.patches,
        characterId: template.character_id,
        characterName: account.characters.find((character) => character.character_id === template.character_id)?.class_name
      });
      input.setLoadoutMessage(outcome.patches.some((patch) => patch.kind === "equip")
        ? `${result.message}，正在确认游戏内状态。`
        : `${result.message}，页面已更新。`);
    } catch (error) {
      input.setLoadoutMessage(error instanceof Error ? error.message : buildLoadoutItemActionFailureMessage("equip", item.name));
    } finally {
      input.setIsRunningItemAction(false);
      input.setItemActionMessage("");
      input.loadoutActionFeedback.setSingleActionFeedback(feedbackKey, "idle");
    }
  }

  function openTemplateSourceItem(
    item: LoadoutTemplate["items"][number],
    templateCharacterId?: string
  ) {
    const matchedItem = findBestTemplateSourceItem(item, input.accountSummary, templateCharacterId);
    if (!matchedItem) {
      input.setLoadoutMessage(`没有找到「${item.name}」的可用来源。`);
      return;
    }

    const accountKey = input.accountSummary
      ? `${input.accountSummary.membership_type}:${input.accountSummary.destiny_membership_id}`
      : "signed-out";
    const instanceKey = matchedItem.instance_id
      ? `${accountKey}:${matchedItem.instance_id}`
      : `${accountKey}:hash:${matchedItem.hash}`;
    const pending = pendingSourceDetailOpens.get(instanceKey);
    if (pending) return;

    const openRequest = Promise.resolve(input.openItemDetail(matchedItem, {
      source_character_id: matchedItem.source_character_id,
      is_vault_item: matchedItem.is_vault_item,
      is_postmaster_item: matchedItem.is_postmaster_item
    })).then(() => undefined).finally(() => {
      if (pendingSourceDetailOpens.get(instanceKey) === openRequest) {
        pendingSourceDetailOpens.delete(instanceKey);
      }
    });
    pendingSourceDetailOpens.set(instanceKey, openRequest);
  }

  return {
    saveCharacterLoadout,
    saveGuideDraft,
    equipHighestPowerItems,
    equipSavedLoadout,
    snapshotCurrentLoadout,
    clearSavedLoadout,
    updateSavedLoadoutIdentifiers,
    deleteLoadoutTemplate,
    renameLoadoutTemplate,
    executeMissingLoadoutTransfer,
    executeSingleLoadoutItemTransfer,
    equipSingleLoadoutItem,
    openTemplateSourceItem
  };
}

function resolveBatchVerificationCandidateIds(
  attemptedItemIds: ReadonlySet<string>,
  result: BatchItemActionResult
): Set<string> {
  const reportedSuccessfulItemIds = new Set(result.succeeded_item_ids ?? []);
  if (reportedSuccessfulItemIds.size >= result.success_count) {
    return new Set(
      [...reportedSuccessfulItemIds].filter((itemId) => attemptedItemIds.has(itemId))
    );
  }

  const reportedFailedItemIds = new Set(result.failed_item_ids ?? []);
  return new Set(
    [...attemptedItemIds].filter((itemId) => !reportedFailedItemIds.has(itemId))
  );
}

function collapseAccountWritePatches(
  patches: readonly AccountItemActionPatch[]
): AccountItemActionPatch[] {
  const finalPatchByItem = new Map<string, AccountItemActionPatch>();
  for (const patch of patches) finalPatchByItem.set(patch.item_instance_id, patch);
  return [...finalPatchByItem.values()];
}

function createLoadoutWriteOperationId(): string {
  return typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `loadout-write-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function equipHighestPowerSingleItem(
  input: ItemEquipActionInput
): Promise<ItemActionResult> {
  const retryWaits = [0, 750, 2_000] as const;
  let lastError: unknown;
  for (const waitMs of retryWaits) {
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    try {
      return await api.equipItem(input);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error ?? "");
      if (!/1623|not in.*inventory|不在.*背包/i.test(message)) throw error;
    }
  }
  throw lastError;
}
