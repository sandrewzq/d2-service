import { api } from "../../api/client";
import type { AccountItemActionPatch, AccountItemSummary, AccountSummary, BatchItemActionResult, ItemActionResult, VaultTags, VaultTagValue } from "../../api/types";
import { services } from "../../api/services";
import {
  buildVaultBatchTransferProgressMessage,
  buildVaultCleanupActionLabel,
  buildVaultCleanupNoTargetMessage,
  buildVaultCleanupWriteResultMessage,
  getVaultActionItemKey,
  selectVaultActionableItems
} from "../../shared/domain/vault/vaultCleanup";

type DiagnosticsBridge = {
  loadActionLog: () => Promise<void>;
};

export function useVaultWriteActions(input: {
  accountSummary: AccountSummary | null;
  diagnostics: DiagnosticsBridge;
  setVaultTags: (tags: VaultTags) => void;
  setAccountError: (message: string) => void;
  setIsRunningItemAction: (isRunning: boolean) => void;
  setItemActionMessage: (message: string) => void;
  applyAcceptedAccountActionPatches: (patches: readonly AccountItemActionPatch[]) => void;
}) {
  async function saveVaultTag(item: AccountItemSummary, tag: VaultTagValue) {
    try {
      input.setVaultTags(await services.localData.saveVaultTag({
        item_key: getVaultActionItemKey(item),
        tag
      }));
    } catch (error) {
      input.setAccountError(error instanceof Error ? error.message : "本地标记保存失败");
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

  async function runVaultCleanupWriteAction(
    label: string,
    items: AccountItemSummary[],
    targetCharacterId: string,
    run: (item: AccountItemSummary) => Promise<ItemActionResult>,
    filterItem: (item: AccountItemSummary) => boolean = () => true
  ): Promise<string> {
    if (!input.accountSummary) {
      return "请先同步装备数据。";
    }
    if (!targetCharacterId) {
      return buildVaultCleanupNoTargetMessage();
    }

    const actionableItems = selectVaultActionableItems(items, filterItem);
    if (!actionableItems.length) {
      return "没有可执行的装备。可能已经全部解锁，或缺少实例 ID。";
    }
    input.setIsRunningItemAction(true);
    input.setItemActionMessage("");

    let successCount = 0;
    let failedCount = 0;
    const accountPatches: AccountItemActionPatch[] = [];
    try {
      for (const item of actionableItems) {
        try {
          const result = await run(item);
          if (result.account_patch) accountPatches.push(result.account_patch);
          successCount += 1;
        } catch {
          failedCount += 1;
        }
      }
      if (accountPatches.length) {
        input.applyAcceptedAccountActionPatches(accountPatches);
      }
      void input.diagnostics.loadActionLog().catch(() => undefined);
    } finally {
      input.setIsRunningItemAction(false);
    }

    const resultMessage = buildVaultCleanupWriteResultMessage({ label, successCount, failedCount });
    const missingPatchCount = Math.max(0, successCount - accountPatches.length);
    return missingPatchCount
      ? `${resultMessage} 另有 ${missingPatchCount} 项会在下次账号同步后显示。`
      : resultMessage;
  }

  async function handleVaultCleanupUnlock(items: AccountItemSummary[], targetCharacterId: string): Promise<string> {
    return runVaultCleanupWriteAction(
      buildVaultCleanupActionLabel("unlock"),
      items,
      targetCharacterId,
      (item) => api.setItemLockState({
        membership_type: input.accountSummary?.membership_type ?? 0,
        character_id: targetCharacterId,
        item_id: item.instance_id ?? "",
        item_name: item.name,
        state: false
      }),
      (item) => item.locked === true
    );
  }

  async function handleVaultItemLock(
    item: AccountItemSummary,
    targetCharacterId: string,
    state = true
  ): Promise<string> {
    const actionLabel = state ? "加锁" : "解锁";
    if (!input.accountSummary) {
      throw new Error("请先同步装备数据。");
    }
    if (!targetCharacterId) {
      throw new Error(buildVaultCleanupNoTargetMessage());
    }
    if (!item.instance_id) {
      throw new Error(`这件装备缺少实例 ID，无法${actionLabel}。`);
    }
    if (item.locked === state) return `这件装备已经${state ? "锁定" : "解锁"}。`;

    const account = input.accountSummary;
    input.setIsRunningItemAction(true);
    input.setItemActionMessage(`正在${actionLabel}：${item.name}`);
    try {
      const result = await api.setItemLockState({
        membership_type: account.membership_type,
        character_id: targetCharacterId,
        item_id: item.instance_id,
        item_name: item.name,
        state
      });
      if (result.account_patch) {
        input.applyAcceptedAccountActionPatches([result.account_patch]);
      }
      void input.diagnostics.loadActionLog().catch(() => undefined);
      const message = result.message || `已提交${actionLabel}：${item.name}`;
      return result.account_patch
        ? message
        : `${message} 页面会在下次账号同步时校准。`;
    } finally {
      input.setIsRunningItemAction(false);
      input.setItemActionMessage("");
    }
  }

  async function handleVaultCleanupTransfer(items: AccountItemSummary[], targetCharacterId: string): Promise<BatchItemActionResult> {
    return runVaultBatchTransfer(items, targetCharacterId);
  }

  async function runVaultBatchTransfer(items: AccountItemSummary[], targetCharacterId: string): Promise<BatchItemActionResult> {
    if (!input.accountSummary) {
      throw new Error("请先同步装备数据。");
    }
    const account = input.accountSummary;

    if (!targetCharacterId) {
      throw new Error(buildVaultCleanupNoTargetMessage());
    }

    const actionableItems = selectVaultActionableItems(items);
    if (!actionableItems.length) {
      throw new Error("没有可执行的装备。可能缺少实例 ID。");
    }
    input.setIsRunningItemAction(true);
    input.setItemActionMessage(buildVaultBatchTransferProgressMessage(actionableItems.length));

    try {
      const result = await api.batchTransferItems({
        membership_type: account.membership_type,
        character_id: targetCharacterId,
        items: actionableItems.map((item) => ({
          membership_type: account.membership_type,
          character_id: targetCharacterId,
          item_id: item.instance_id ?? "",
          item_reference_hash: item.hash,
          item_name: item.name,
          transfer_to_vault: false
        }))
      });
      if (result.account_patches.length) {
        input.applyAcceptedAccountActionPatches(result.account_patches);
      }
      void input.diagnostics.loadActionLog().catch(() => undefined);
      const missingPatchCount = Math.max(0, result.success_count - result.account_patches.length);
      return missingPatchCount
        ? {
            ...result,
            message: `${result.message} 另有 ${missingPatchCount} 项会在下次账号同步后显示。`
          }
        : result;
    } catch (error) {
      throw error instanceof Error ? error : new Error("批量转移失败");
    } finally {
      input.setIsRunningItemAction(false);
      input.setItemActionMessage("");
    }
  }

  return {
    saveVaultTag,
    saveVaultTagsBatch,
    handleVaultItemLock,
    handleVaultCleanupUnlock,
    handleVaultCleanupTransfer
  };
}
