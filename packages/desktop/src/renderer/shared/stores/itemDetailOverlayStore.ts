import { useSyncExternalStore } from "react";
import type { AccountItemSummary, ItemSearchResult } from "../../api/types";
import { getItemKey, type SelectedItemSource } from "@d2-tools/app/items";
import { startRendererPerformanceInteraction } from "../performance/rendererPerformanceDiagnostics";

type ItemDetailOverlayRequest =
  | {
      kind: "open";
      item: AccountItemSummary | ItemSearchResult;
      source: SelectedItemSource;
    }
  | { kind: "close" };

type ItemDetailOverlaySnapshot = {
  revision: number;
  request: ItemDetailOverlayRequest | null;
};

export type ItemDetailOverlayCommands = {
  openItemDetail: (
    item: AccountItemSummary | ItemSearchResult,
    source?: SelectedItemSource
  ) => void;
  closeSelectedItemDetail: () => void;
};

const listeners = new Set<() => void>();
let snapshot: ItemDetailOverlaySnapshot = {
  revision: 0,
  request: null
};

export const itemDetailOverlayCommands: ItemDetailOverlayCommands = {
  openItemDetail(item, source = {}) {
    startRendererPerformanceInteraction("item-detail-open", getItemKey(item), {
      hash: item.hash,
      hasInstance: "instance_id" in item && Boolean(item.instance_id),
      group: item.group_key
    });
    publish({ kind: "open", item, source });
  },
  closeSelectedItemDetail() {
    publish({ kind: "close" });
  }
};

export function useItemDetailOverlayRequest(): ItemDetailOverlaySnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function publish(request: ItemDetailOverlayRequest): void {
  snapshot = {
    revision: snapshot.revision + 1,
    request
  };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ItemDetailOverlaySnapshot {
  return snapshot;
}
