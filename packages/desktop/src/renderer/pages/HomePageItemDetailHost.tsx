import { startTransition, useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import type { AccountOperationFeedbackView } from "@d2-tools/app/account";
import { getItemKey } from "@d2-tools/app/items";
import type {
  AccountItemActionPatch,
  LibraryHistory,
  VaultTags
} from "../api/types";
import { useItemDetailWorkspace } from "../shared/hooks/useItemDetailWorkspace";
import {
  itemDetailOverlayCommands,
  useItemDetailOverlayRequest
} from "../shared/stores/itemDetailOverlayStore";
import { HomePageItemDetailModal } from "./HomePageItemDetailModal";

type ItemDetailModalProps = ComponentProps<typeof HomePageItemDetailModal>;

export type HomePageItemDetailHostProps = Omit<
  ItemDetailModalProps,
  "accountOperationFeedback" | "isRunningItemAction" | "itemActionMessage" | "itemDetail" | "itemDetailOverlay"
> & {
  accountOperationFeedback?: AccountOperationFeedbackView;
  isRunningItemAction: boolean;
  detailCacheScopeKey: string;
  recommendationRevision?: string;
  cleanupProtectionByItemKey?: ReadonlyMap<string, readonly string[]>;
  diagnostics: {
    aiSettings: { enable_lightgg: boolean };
  };
  setAccountError: (message: string) => void;
  setVaultTags: (tags: VaultTags) => void;
  applyAcceptedAccountActionPatches: (patches: readonly AccountItemActionPatch[]) => void;
  onRecentHistoryChanged: (history: LibraryHistory) => void;
};

const skipClosedSettingsActionLogRefresh = async (): Promise<void> => undefined;

export function HomePageItemDetailHost(props: HomePageItemDetailHostProps) {
  const command = useItemDetailOverlayRequest();
  const handledRevisionRef = useRef(0);
  const isItemDetailOpenRef = useRef(false);
  const pendingRecentHistoryRef = useRef<LibraryHistory | null>(null);
  const [detailOperationFeedback, setDetailOperationFeedback] = useState<AccountOperationFeedbackView>();
  const [isRunningDetailAction, setIsRunningDetailAction] = useState(false);
  const [detailActionMessage, setDetailActionMessage] = useState("");
  const [readyRevision, setReadyRevision] = useState(0);
  const {
    detailCacheScopeKey,
    recommendationRevision,
    cleanupProtectionByItemKey,
    diagnostics,
    setAccountError,
    setVaultTags,
    applyAcceptedAccountActionPatches,
    onRecentHistoryChanged,
    ...modalProps
  } = props;
  const deferRecentHistoryUpdate = useCallback((history: LibraryHistory) => {
    if (isItemDetailOpenRef.current) {
      pendingRecentHistoryRef.current = history;
      return;
    }
    onRecentHistoryChanged(history);
  }, [onRecentHistoryChanged]);
  const itemDetail = useItemDetailWorkspace({
    accountSummary: props.accountSummary,
    vaultTags: props.vaultTags,
    setVaultTags,
    importedWishlist: props.importedWishlist,
    cleanupProtectionByItemKey,
    detailCacheScopeKey,
    recommendationRevision,
    localTargetRules: props.localTargetRules,
    diagnostics: {
      aiSettings: diagnostics.aiSettings,
      loadActionLog: skipClosedSettingsActionLogRefresh
    },
    setAccountError,
    setAccountOperationFeedback: setDetailOperationFeedback,
    setIsRunningItemAction: setIsRunningDetailAction,
    setItemActionMessage: setDetailActionMessage,
    applyAcceptedAccountActionPatches,
    onRecentHistoryChanged: deferRecentHistoryUpdate
  });
  const openItemDetailRef = useRef(itemDetail.openItemDetail);
  const closeItemDetailRef = useRef(itemDetail.closeSelectedItemDetail);
  openItemDetailRef.current = itemDetail.openItemDetail;
  closeItemDetailRef.current = itemDetail.closeSelectedItemDetail;
  const hasOpenOverlayRequest = command.request?.kind === "open";
  isItemDetailOpenRef.current = hasOpenOverlayRequest || Boolean(itemDetail.selectedItem);

  useEffect(() => {
    if (hasOpenOverlayRequest || itemDetail.selectedItem || !pendingRecentHistoryRef.current) return;
    const history = pendingRecentHistoryRef.current;
    pendingRecentHistoryRef.current = null;
    onRecentHistoryChanged(history);
  }, [hasOpenOverlayRequest, itemDetail.selectedItem, onRecentHistoryChanged]);

  useEffect(() => {
    if (!command.request || handledRevisionRef.current === command.revision) return;
    handledRevisionRef.current = command.revision;
    setDetailOperationFeedback(undefined);
    setDetailActionMessage("");
    setReadyRevision(0);
    if (command.request.kind === "close") {
      setIsRunningDetailAction(false);
      closeItemDetailRef.current();
      return;
    }
    void openItemDetailRef.current(command.request.item, command.request.source);
  }, [command]);

  const openingRequest = command.request?.kind === "open" ? command.request : null;
  const openingItemKey = openingRequest ? getItemKey(openingRequest.item) : "";
  const selectedItemReady = Boolean(
    openingRequest
    && itemDetail.selectedItem?.item_key === openingItemKey
    && !itemDetail.selectedItem.is_detail_loading
  );

  useEffect(() => {
    if (!selectedItemReady || !openingRequest) return;
    const revision = command.revision;
    startTransition(() => setReadyRevision(revision));
  }, [command.revision, openingRequest, selectedItemReady]);

  return (
    <HomePageItemDetailModal
      {...modalProps}
      accountOperationFeedback={detailOperationFeedback ?? props.accountOperationFeedback}
      isRunningItemAction={isRunningDetailAction || props.isRunningItemAction}
      itemActionMessage={detailActionMessage}
      itemDetail={itemDetail}
      itemDetailOverlay={openingRequest ? {
        openingItem: openingRequest.item,
        isReady: readyRevision === command.revision && selectedItemReady
      } : null}
    />
  );
}
