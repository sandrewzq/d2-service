import { useState } from "react";
import type { AccountOperationFeedbackView } from "@d2-tools/app/account";
import type {
  AccountSummary,
  AccountItemActionPatch,
  LoadoutTemplate,
  VaultTags
} from "../api/types";
import { useLoadoutActionFeedback } from "../features/loadouts/useLoadoutActionFeedback";
import { useLoadoutTemplateActions } from "../features/loadouts/useLoadoutTemplateActions";
import { useLoadoutWriteActions } from "../features/loadouts/useLoadoutWriteActions";
import { useVaultWriteActions } from "../features/vault/useVaultWriteActions";
import { itemDetailOverlayCommands } from "../shared/stores/itemDetailOverlayStore";

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
  loadoutLibrary: LoadoutLibraryBridge;
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
    openItemDetail: itemDetailOverlayCommands.openItemDetail
  });

  const vaultWriteActions = useVaultWriteActions({
    accountSummary: input.accountSummary,
    setVaultTags: input.setVaultTags,
    setAccountError: input.setAccountError,
    applyAcceptedAccountActionPatches: input.applyAcceptedAccountActionPatches
  });

  return {
    accountOperationFeedback,
    accountWriteSyncActivity: IDLE_ACCOUNT_WRITE_SYNC_ACTIVITY,
    itemActionMessage,
    isRunningItemAction,
    loadoutActionFeedback,
    loadoutMessage,
    loadoutTemplateActions,
    loadoutWriteActions,
    vaultWriteActions,
    clearCompletedWriteFeedback
  };
}
