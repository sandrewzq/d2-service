import { useCallback, useSyncExternalStore } from "react";

export type VaultQuickAction = "lock" | "unlock" | "transfer";

type ActiveVaultQuickAction = {
  itemKey: string;
  action: VaultQuickAction;
};

export type VaultQuickActionStore = {
  getActive: () => ActiveVaultQuickAction | null;
  getItemSnapshot: (itemKey: string) => VaultQuickAction | undefined;
  setActive: (active: ActiveVaultQuickAction | null) => void;
  subscribeItem: (itemKey: string, listener: () => void) => () => void;
};

export function createVaultQuickActionStore(): VaultQuickActionStore {
  let active: ActiveVaultQuickAction | null = null;
  const listenersByItemKey = new Map<string, Set<() => void>>();

  function notifyItem(itemKey: string | undefined) {
    if (!itemKey) return;
    for (const listener of listenersByItemKey.get(itemKey) ?? []) listener();
  }

  return {
    getActive: () => active,
    getItemSnapshot: (itemKey) => active?.itemKey === itemKey ? active.action : undefined,
    setActive: (next) => {
      if (active?.itemKey === next?.itemKey && active?.action === next?.action) return;
      const previousItemKey = active?.itemKey;
      active = next;
      notifyItem(previousItemKey);
      if (next?.itemKey !== previousItemKey) notifyItem(next?.itemKey);
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

export function useVaultQuickAction(
  store: VaultQuickActionStore,
  itemKey: string
): VaultQuickAction | undefined {
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
