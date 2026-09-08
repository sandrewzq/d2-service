import { useCallback, useSyncExternalStore } from "react";
import type { AccountItemSummary } from "@d2-tools/core/account/summary";
import { getVaultItemKey } from "@d2-tools/app/vault";

export type VaultItemCollectionStore = {
  getItemSnapshot: (itemKey: string) => AccountItemSummary | undefined;
  replaceItems: (items: readonly AccountItemSummary[]) => void;
  subscribeItem: (itemKey: string, listener: () => void) => () => void;
};

export function createVaultItemCollectionStore(
  initialItems: readonly AccountItemSummary[]
): VaultItemCollectionStore {
  let itemsByKey = indexItems(initialItems);
  const listenersByItemKey = new Map<string, Set<() => void>>();

  function notifyItem(itemKey: string) {
    for (const listener of listenersByItemKey.get(itemKey) ?? []) listener();
  }

  return {
    getItemSnapshot: (itemKey) => itemsByKey.get(itemKey),
    replaceItems: (items) => {
      const nextItemsByKey = indexItems(items);
      const changedItemKeys = new Set<string>();
      for (const [itemKey, item] of nextItemsByKey) {
        if (itemsByKey.get(itemKey) !== item) changedItemKeys.add(itemKey);
      }
      for (const itemKey of itemsByKey.keys()) {
        if (!nextItemsByKey.has(itemKey)) changedItemKeys.add(itemKey);
      }
      itemsByKey = nextItemsByKey;
      for (const itemKey of changedItemKeys) notifyItem(itemKey);
    },
    subscribeItem: (itemKey, listener) => {
      const listeners = listenersByItemKey.get(itemKey) ?? new Set<() => void>();
      listeners.add(listener);
      listenersByItemKey.set(itemKey, listeners);
      return () => {
        listeners.delete(listener);
        if (!listeners.size) listenersByItemKey.delete(itemKey);
      };
    }
  };
}

export function useVaultItemCollectionItem(
  store: VaultItemCollectionStore,
  itemKey: string
): AccountItemSummary | undefined {
  const subscribe = useCallback(
    (listener: () => void) => store.subscribeItem(itemKey, listener),
    [itemKey, store]
  );
  const getSnapshot = useCallback(
    () => store.getItemSnapshot(itemKey),
    [itemKey, store]
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function indexItems(items: readonly AccountItemSummary[]): Map<string, AccountItemSummary> {
  return new Map(items.flatMap((item) => (
    item.instance_id ? [[getVaultItemKey(item), item] as const] : []
  )));
}
