import { useState } from "react";
import type { AccountOperationFeedbackView } from "@d2-tools/app/account";
import type {
  AccountSummary,
  AccountItemActionPatch,
  DimWishlist,
  LibraryHistory,
  LoadoutTemplate,
  LocalTargetRules,
  VaultTags
} from "../api/types";
import { useLoadoutActionFeedback } from "../features/loadouts/useLoadoutActionFeedback";
import { useLoadoutTemplateActions } from "../features/loadouts/useLoadoutTemplateActions";
import { useLoadoutWriteActions } from "../features/loadouts/useLoadoutWriteActions";
import { useVaultWriteActions } from "../features/vault/useVaultWriteActions";
import { useItemDetailWorkspace } from "../shared/hooks/useItemDetailWorkspace";

export type AccountWriteSyncActivity = {
  active: boolean;
  delayed: boolean;
  pendingCount: number;
  phase: "idle" | "waiting" | "finalizing";
  startedAtMs?: number;
};

const IDLE_ACCOUNT_WRITE_SYNC_ACTIVITY: AccountWriteSyncActivity = {
  active: false,
  delayed: false,
  pendingCount: 0,
  phase: "idle"
};

type DiagnosticsBridge = {
  aiSettings: { enable_lightgg: boolean };
  loadActionLog: () => Promise<void>;
};

type LoadoutLibraryBridge = {
  reloadTemplates: () => Promise<void>;
  renameTemplate: (template: LoadoutTemplate) => Promise<LoadoutTemplate>;
  deleteTemplate: (id: string) => Promise<LoadoutTemplate[]>;
};

export function useDesktopProductWriteActions(input: {
  accountSummary: AccountSummary | null;
  applyAcceptedAccountActionPatches: (patches: readonly AccountItemActionPatch[]) => void;
  diagnostics: DiagnosticsBridge;
  importedWishlist: DimWishlist | null;
  itemDetailCacheScopeKey: string;
  recommendationRevision?: string;
  loadoutLibrary: LoadoutLibraryBridge;
  localTargetRules: LocalTargetRules;
  cleanupProtectionByItemKey?: ReadonlyMap<string, readonly string[]>;
  onRecentHistoryChanged: (history: LibraryHistory) => void;
  setAccountError: (message: string) => void;
  setVaultTags: (tags: VaultTags) => void;
  vaultTags: VaultTags;
}) {
  const [loadoutMessage, setLoadoutMessage] = useState("");
  const [isRunningItemAction, setIsRunningItemAction] = useState(false);
  const [itemActionMessage, setItemActionMessage] = useState("");
  const [accountOperationFeedback, setAccountOperationFeedback] = useState<AccountOperationFeedbackView>();
  const loadoutActionFeedback = useLoadoutActionFeedback();

  function clearCompletedWriteFeedback(): void {
    setAccountOperationFeedback((current) => {
      if (!current) return current;
      return current.phase && [
        "confirmed",
        "partial-confirmed",
        "failed",
        "paused",
        "superseded"
      ].includes(current.phase)
        ? undefined
        : current;
    });
    setItemActionMessage("");
    setLoadoutMessage("");
  }

  const itemDetail = useItemDetailWorkspace({
    accountSummary: input.accountSummary,
    vaultTags: input.vaultTags,
    setVaultTags: input.setVaultTags,
    importedWishlist: input.importedWishlist,
    cleanupProtectionByItemKey: input.cleanupProtectionByItemKey,
    detailCacheScopeKey: input.itemDetailCacheScopeKey,
    recommendationRevision: input.recommendationRevision,
    localTargetRules: input.localTargetRules,
    diagnostics: input.diagnostics,
    setAccountError: input.setAccountError,
    setAccountOperationFeedback,
    setIsRunningItemAction,
    setItemActionMessage,
    applyAcceptedAccountActionPatches: input.applyAcceptedAccountActionPatches,
    onRecentHistoryChanged: input.onRecentHistoryChanged
  });

  const loadoutTemplateActions = useLoadoutTemplateActions({
    accountSummary: input.accountSummary,
    setLoadoutMessage
  });

  const loadoutWriteActions = useLoadoutWriteActions({
    accountSummary: input.accountSummary,
    loadoutLibrary: input.loadoutLibrary,
    diagnostics: input.diagnostics,
    loadoutActionFeedback,
    setLoadoutMessage,
    setItemActionMessage,
    setAccountOperationFeedback,
    setIsRunningItemAction,
    applyAcceptedAccountActionPatches: input.applyAcceptedAccountActionPatches,
    openItemDetail: itemDetail.openItemDetail
  });

  const vaultWriteActions = useVaultWriteActions({
    accountSummary: input.accountSummary,
    diagnostics: input.diagnostics,
    setVaultTags: input.setVaultTags,
    setAccountError: input.setAccountError,
    setIsRunningItemAction,
    setItemActionMessage,
    applyAcceptedAccountActionPatches: input.applyAcceptedAccountActionPatches
  });

  return {
    accountOperationFeedback,
    accountWriteSyncActivity: IDLE_ACCOUNT_WRITE_SYNC_ACTIVITY,
    itemActionMessage,
    itemDetail,
    isRunningItemAction,
    loadoutActionFeedback,
    loadoutMessage,
    loadoutTemplateActions,
    loadoutWriteActions,
    vaultWriteActions,
    clearCompletedWriteFeedback
  };
}
