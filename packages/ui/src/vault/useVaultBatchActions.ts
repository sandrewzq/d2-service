import { useState, type Dispatch, type SetStateAction } from "react";
import type { AccountItemSummary } from "@d2-tools/core/account/summary";
import type { SaveVaultTagInput, VaultTagValue } from "@d2-tools/core/vault/tags";
import {
  buildVaultBatchTagCopy,
  buildVaultBatchTagResultMessage,
  buildVaultBulkMoveResultMessage,
  buildVaultCleanupActionLabel,
  buildVaultCleanupActionProgressMessage,
  buildVaultCleanupNoTargetMessage,
  buildVaultSelectedBulkMoveNoSelectionMessage,
  buildVaultSelectedBulkMovePrepareMessage,
  getVaultSelectionItemKey
} from "@d2-tools/app/vault";

export type BatchItemActionResult = {
  success_count: number;
  failed_count: number;
  message?: string;
  failure_messages?: string[];
};

export type VaultCleanupActions = {
  characters: Array<{ character_id: string; class_name: string; light?: number }>;
  currentCharacterId?: string;
  currentCharacterLabel?: string;
  onLockItem: (item: AccountItemSummary, targetCharacterId: string, state?: boolean) => Promise<string>;
  onBatchUnlock: (items: AccountItemSummary[], targetCharacterId: string) => Promise<string>;
  onBatchTransferToCharacter: (items: AccountItemSummary[], targetCharacterId: string) => Promise<BatchItemActionResult>;
};

export function useVaultBatchActions(input: {
  selectedItems: AccountItemSummary[];
  vaultActionItems?: AccountItemSummary[];
  cleanupActionItems: AccountItemSummary[];
  cleanupActions?: VaultCleanupActions;
  cleanupTargetCharacterId: string;
  cleanupTargetCharacterLabel: string;
  cleanupProtectionByItemKey?: Map<string, string[]>;
  setSelectedKeys: Dispatch<SetStateAction<Set<string>>>;
  onSaveTagBatch: (inputs: SaveVaultTagInput[]) => void | Promise<void>;
}) {
  const [batchMessage, setBatchMessage] = useState("");
  const [isBatchSaving, setIsBatchSaving] = useState(false);
  const [activeBatchAction, setActiveBatchAction] = useState("");

  async function applyBatchTag(tag: VaultTagValue) {
    const copy = buildVaultBatchTagCopy(tag);
    setIsBatchSaving(true);
    setActiveBatchAction(copy.action);
    setBatchMessage(copy.loading);

    try {
      const protectedItems = tag === "junk"
        ? input.selectedItems.filter((item) => (
            (input.cleanupProtectionByItemKey?.get(item.instance_id ?? `hash:${item.hash}`)?.length ?? 0) > 0
          ))
        : [];
      const writableItems = tag === "junk"
        ? input.selectedItems.filter((item) => !protectedItems.includes(item))
        : input.selectedItems;
      if (writableItems.length) {
        await input.onSaveTagBatch(writableItems.map((item) => ({
          item_key: getVaultSelectionItemKey(item),
          tag
        })));
      }
      setBatchMessage(protectedItems.length
        ? `已处理 ${writableItems.length} 件；${protectedItems.length} 件受保护，未改为清理。`
        : buildVaultBatchTagResultMessage(writableItems.length));
      input.setSelectedKeys(new Set());
    } catch (error) {
      setBatchMessage(error instanceof Error ? error.message : "批量标记失败");
    } finally {
      setIsBatchSaving(false);
      setActiveBatchAction("");
    }
  }

  async function runSelectedBulkMove() {
    if (!input.cleanupActions) return;
    const actionableItems = input.vaultActionItems ?? input.selectedItems;
    if (!actionableItems.length) {
      setBatchMessage(buildVaultSelectedBulkMoveNoSelectionMessage());
      return;
    }
    if (!input.cleanupTargetCharacterId) {
      setBatchMessage(buildVaultCleanupNoTargetMessage());
      return;
    }

    setIsBatchSaving(true);
    setActiveBatchAction("批量移动");
    setBatchMessage(buildVaultSelectedBulkMovePrepareMessage(actionableItems.length));

    try {
      const result = await input.cleanupActions.onBatchTransferToCharacter(actionableItems, input.cleanupTargetCharacterId);
      setBatchMessage(buildVaultBulkMoveResultMessage(input.cleanupTargetCharacterLabel, result));
      input.setSelectedKeys(new Set());
    } catch (error) {
      setBatchMessage(error instanceof Error ? error.message : "批量移动失败");
    } finally {
      setIsBatchSaving(false);
      setActiveBatchAction("");
    }
  }

  async function runCleanupAction(action: "unlock" | "transfer") {
    if (!input.cleanupActions) return;
    if (!input.cleanupTargetCharacterId) {
      setBatchMessage(buildVaultCleanupNoTargetMessage());
      return;
    }

    setIsBatchSaving(true);
    setActiveBatchAction(buildVaultCleanupActionLabel(action));
    setBatchMessage(buildVaultCleanupActionProgressMessage(action));

    try {
      const message = action === "unlock"
        ? await input.cleanupActions.onBatchUnlock(input.cleanupActionItems, input.cleanupTargetCharacterId)
        : buildVaultBulkMoveResultMessage(
          input.cleanupTargetCharacterLabel,
          await input.cleanupActions.onBatchTransferToCharacter(input.cleanupActionItems, input.cleanupTargetCharacterId)
        );
      setBatchMessage(message);
    } catch (error) {
      setBatchMessage(error instanceof Error ? error.message : "清理操作失败");
    } finally {
      setIsBatchSaving(false);
      setActiveBatchAction("");
    }
  }

  return {
    activeBatchAction,
    applyBatchTag,
    batchMessage,
    isBatchSaving,
    runCleanupAction,
    runSelectedBulkMove,
    setBatchMessage,
    setActiveBatchAction
  };
}
