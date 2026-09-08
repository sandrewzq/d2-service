import { useEffect, useRef, useState } from "react";
import { api } from "../../api/client";
import type { AccountItemDetail, AccountItemSummary, ItemDefinitionDetail, ItemSearchResult, LibraryHistory } from "../../api/types";
import {
  createSelectedItemPreview,
  getItemKey,
  mergeSelectedItemDetail,
  selectedItemToAccountItem,
  type SameNameItemSummary,
  type SelectedItemDetail,
  type SelectedItemSource,
  type SelectedItemSourceKind
} from "@d2-tools/app/items";

export {
  createSelectedItemPreview,
  getItemKey,
  mergeSelectedItemDetail,
  selectedItemToAccountItem
};
export type {
  SameNameItemSummary,
  SelectedItemDetail,
  SelectedItemSource,
  SelectedItemSourceKind
};

type ItemOpenContext = {
  item: AccountItemSummary | ItemSearchResult;
  source: SelectedItemSource;
  itemKey: string;
  isCurrent: () => boolean;
};

const ITEM_DETAIL_CACHE_LIMIT = 80;
const ACCOUNT_ITEM_DETAIL_CACHE_LIMIT = 24;

// 进程级实例详情缓存：仓库同名整理与详情弹层可能同时请求同一实例。
// 统一在这里做短生命周期的内存复用和 in-flight 去重，避免页面之间重复 IPC。
const sharedAccountDetailCache = new Map<string, AccountItemDetail>();
const sharedAccountDetailRequests = new Map<string, Promise<AccountItemDetail>>();
const sharedAccountDetailVersions = new Map<string, number>();
const SHARED_ACCOUNT_DETAIL_CACHE_LIMIT = 120;

export function loadAccountItemDetailCached(
  instanceId: string,
  options: { scopeKey?: string; rollFingerprint?: string; force?: boolean } = {}
): Promise<AccountItemDetail> {
  const key = accountDetailCacheKey(options.scopeKey ?? "default", instanceId, options.rollFingerprint);
  const instanceScopeKey = accountDetailInstanceScopeKey(options.scopeKey ?? "default", instanceId);
  if (!options.force) {
    const cached = sharedAccountDetailCache.get(key);
    if (cached) {
      sharedAccountDetailCache.delete(key);
      sharedAccountDetailCache.set(key, cached);
      return Promise.resolve(cached);
    }
    const pending = sharedAccountDetailRequests.get(key);
    if (pending) return pending;
  }

  const requestVersion = (sharedAccountDetailVersions.get(instanceScopeKey) ?? 0) + 1;
  sharedAccountDetailVersions.set(instanceScopeKey, requestVersion);
  let request: Promise<AccountItemDetail>;
  request = api.getAccountItemDetail(instanceId, options.force ? { force: true } : undefined)
    .then((detail) => {
      if (sharedAccountDetailRequests.get(key) !== request
        || sharedAccountDetailVersions.get(instanceScopeKey) !== requestVersion) return detail;
      sharedAccountDetailRequests.delete(key);
      const resolvedKey = accountDetailCacheKey(
        options.scopeKey ?? "default",
        instanceId,
        detail.weapon_roll?.fingerprint ?? options.rollFingerprint
      );
      sharedAccountDetailCache.delete(resolvedKey);
      sharedAccountDetailCache.set(resolvedKey, detail);
      while (sharedAccountDetailCache.size > SHARED_ACCOUNT_DETAIL_CACHE_LIMIT) {
        const oldest = sharedAccountDetailCache.keys().next().value;
        if (oldest === undefined) break;
        sharedAccountDetailCache.delete(oldest);
      }
      return detail;
    })
    .catch((error) => {
      if (sharedAccountDetailRequests.get(key) === request) sharedAccountDetailRequests.delete(key);
      throw error;
    });
  sharedAccountDetailRequests.set(key, request);
  return request;
}

export function invalidateCachedAccountItemDetail(instanceId: string, scopeKey = "default"): void {
  const prefix = `${scopeKey}:${instanceId}:`;
  const instanceScopeKey = accountDetailInstanceScopeKey(scopeKey, instanceId);
  sharedAccountDetailVersions.set(instanceScopeKey, (sharedAccountDetailVersions.get(instanceScopeKey) ?? 0) + 1);
  for (const key of sharedAccountDetailCache.keys()) {
    if (key.startsWith(prefix)) sharedAccountDetailCache.delete(key);
  }
  for (const key of sharedAccountDetailRequests.keys()) {
    if (key.startsWith(prefix)) sharedAccountDetailRequests.delete(key);
  }
}

export function useItemDetail(options: {
  cacheScopeKey?: string;
  onOpenStart?: (context: ItemOpenContext) => void;
  onRecentHistoryChanged?: (history: LibraryHistory) => void;
} = {}) {
  const cacheScopeKey = options.cacheScopeKey ?? "default";
  const [selectedItem, setSelectedItem] = useState<SelectedItemDetail | null>(null);
  const [itemDetailLoadingKey, setItemDetailLoadingKey] = useState("");
  const [itemDetailError, setItemDetailError] = useState("");
  const itemDetailCacheRef = useRef(new Map<number, ItemDefinitionDetail>());
  const accountItemDetailCacheRef = useRef(new Map<string, AccountItemDetail>());
  const cacheScopeKeyRef = useRef(cacheScopeKey);
  const requestSequenceRef = useRef(0);

  useEffect(() => {
    if (cacheScopeKeyRef.current !== cacheScopeKey) {
      resetDetailState(cacheScopeKey);
    }
  }, [cacheScopeKey]);

  useEffect(() => () => {
    invalidateRequestsAndClearCaches();
  }, []);

  async function openItemDetail(item: AccountItemSummary | ItemSearchResult, source: SelectedItemSource = {}) {
    if (cacheScopeKeyRef.current !== cacheScopeKey) {
      resetDetailState(cacheScopeKey);
    }
    setItemDetailError("");
    const itemKey = getItemKey(item);
    const instanceId = "instance_id" in item ? item.instance_id : undefined;
    const requestScopeKey = cacheScopeKeyRef.current;
    const requestSequence = ++requestSequenceRef.current;
    const isCurrent = () => (
      requestSequenceRef.current === requestSequence
      && cacheScopeKeyRef.current === requestScopeKey
    );
    const preview = createSelectedItemPreview(item, source);
    const accountCacheKey = instanceId
      ? accountDetailCacheKey(requestScopeKey, instanceId, preview.weapon_roll?.fingerprint)
      : "";
    const canRenderPreview = preview.group_key === "weapons" || preview.group_key === "armor";
    setItemDetailLoadingKey(itemKey);
    setSelectedItem(canRenderPreview ? preview : null);

    options.onOpenStart?.({
      item,
      source,
      itemKey,
      isCurrent
    });

    void api.addRecentItem({ hash: item.hash, name: item.name, icon: item.icon })
      .then((history) => {
        options.onRecentHistoryChanged?.(history);
      })
      .catch(() => {
        // Recent-item history is a convenience feature; item detail should still open if it cannot be saved.
      });

    const cachedDetail = itemDetailCacheRef.current.get(item.hash)
      ? touchItemDetailCache(itemDetailCacheRef.current, item.hash)
      : null;
    const cachedAccountDetail = instanceId
      ? touchAccountItemDetailCache(accountItemDetailCacheRef.current, accountCacheKey)
      : null;
    const needsDefinitionDetail = !cachedDetail;
    const shouldAutoLoadDefinition = needsDefinitionDetail
      && (!instanceId || preview.group_key === "armor");
    const hasPendingCriticalDetail = shouldAutoLoadDefinition;
    const initialLoadingState = {
      definition: shouldAutoLoadDefinition,
      instance: false
    };
    if (cachedDetail || cachedAccountDetail) {
      setSelectedItem((current) => {
        if (current && current.item_key !== itemKey) {
          return current;
        }
        const base = current ?? preview;
        const withDefinition = cachedDetail ? mergeSelectedItemDetail(base, cachedDetail) : base;
        const merged = cachedAccountDetail ? mergeAccountItemDetail(withDefinition, cachedAccountDetail) : withDefinition;
        return {
          ...merged,
          is_detail_loading: hasPendingCriticalDetail,
          detail_loading: initialLoadingState
        };
      });
    }
    if (!hasPendingCriticalDetail) {
      setItemDetailLoadingKey((current) => current === itemKey ? "" : current);
      return;
    }

    const pendingRequests: Promise<void>[] = [];
    if (shouldAutoLoadDefinition) {
      pendingRequests.push(api.getItemDetail(item.hash)
        .then((detail) => {
          if (!isCurrent()) return;
          itemDetailCacheRef.current.set(item.hash, detail);
          evictOldestCacheEntry(itemDetailCacheRef.current, ITEM_DETAIL_CACHE_LIMIT);
          setSelectedItem((current) => {
            if (current && current.item_key !== itemKey) return current;
            const withDefinition = mergeSelectedItemDetail(current ?? preview, detail);
            const latestAccountDetail = instanceId
              ? accountItemDetailCacheRef.current.get(accountCacheKey)
              : null;
            const merged = latestAccountDetail
              ? mergeAccountItemDetail(withDefinition, latestAccountDetail)
              : withDefinition;
            return withDetailLoadingState(merged, {
              definition: false,
              instance: false
            });
          });
        })
        .catch((error) => {
          if (!isCurrent()) return;
          setSelectedItem((current) => current?.item_key === itemKey
            ? withDetailLoadingState(current, {
                definition: false,
                instance: false
              })
            : current);
          appendItemDetailError(
            setItemDetailError,
            errorMessage(error, "物品定义详情读取失败")
          );
        }));
    }

    await Promise.allSettled(pendingRequests);
    if (!isCurrent()) return;
    setSelectedItem((current) => {
      if (!current || current.item_key !== itemKey) return current;
      return withDetailLoadingState(current, { definition: false, instance: false });
    });
    setItemDetailLoadingKey((current) => current === itemKey ? "" : current);
  }

  async function loadSelectedItemFullDetail(): Promise<void> {
    const current = selectedItem;
    if (!current) return;
    const itemKey = current.item_key;
    const instanceId = current.instance_id;
    const requestScopeKey = cacheScopeKeyRef.current;
    const requestSequence = requestSequenceRef.current;
    const isCurrent = () => requestSequenceRef.current === requestSequence
      && cacheScopeKeyRef.current === requestScopeKey;
    const cachedDefinition = touchItemDetailCache(itemDetailCacheRef.current, current.hash);
    const cachedInstance = instanceId
      ? touchAccountItemDetailCache(
          accountItemDetailCacheRef.current,
          accountDetailCacheKey(requestScopeKey, instanceId, current.weapon_roll?.fingerprint)
        )
      : null;
    const needsDefinition = !cachedDefinition;
    const needsInstance = Boolean(instanceId && !cachedInstance);
    if (!needsDefinition && !needsInstance) {
      setSelectedItem((value) => value?.item_key === itemKey
        ? withDetailLoadingState(
            cachedInstance
              ? mergeAccountItemDetail(cachedDefinition ? mergeSelectedItemDetail(value, cachedDefinition) : value, cachedInstance)
              : cachedDefinition ? mergeSelectedItemDetail(value, cachedDefinition) : value,
            { definition: false, instance: false }
          )
        : value);
      return;
    }

    setItemDetailError("");
    setItemDetailLoadingKey(itemKey);
    setSelectedItem((value) => value?.item_key === itemKey
      ? withDetailLoadingState(value, { definition: needsDefinition, instance: needsInstance })
      : value);
    const requests: Promise<void>[] = [];
    if (needsDefinition) {
      requests.push(api.getItemDetail(current.hash).then((detail) => {
        if (!isCurrent()) return;
        itemDetailCacheRef.current.set(current.hash, detail);
        evictOldestCacheEntry(itemDetailCacheRef.current, ITEM_DETAIL_CACHE_LIMIT);
        setSelectedItem((value) => value?.item_key === itemKey
          ? withDetailLoadingState(mergeSelectedItemDetail(value, detail), {
              definition: false,
              instance: value.detail_loading?.instance ?? needsInstance
            })
          : value);
      }).catch((error) => {
        if (!isCurrent()) return;
        appendItemDetailError(setItemDetailError, errorMessage(error, "物品定义详情读取失败"));
      }));
    }
    if (instanceId && needsInstance) {
      requests.push(loadAccountItemDetailCached(instanceId, {
        scopeKey: requestScopeKey,
        rollFingerprint: current.weapon_roll?.fingerprint
      }).then((detail) => {
        if (!isCurrent()) return;
        accountItemDetailCacheRef.current.set(
          accountDetailCacheKey(
            requestScopeKey,
            instanceId,
            detail.weapon_roll?.fingerprint ?? current.weapon_roll?.fingerprint
          ),
          detail
        );
        evictOldestCacheEntry(accountItemDetailCacheRef.current, ACCOUNT_ITEM_DETAIL_CACHE_LIMIT);
        setSelectedItem((value) => value?.item_key === itemKey
          ? withDetailLoadingState(mergeAccountItemDetail(value, detail), {
              definition: value.detail_loading?.definition ?? needsDefinition,
              instance: false
            })
          : value);
      }).catch((error) => {
        if (!isCurrent()) return;
        appendItemDetailError(setItemDetailError, errorMessage(error, "完整实例 Roll 读取失败"));
      }));
    }
    await Promise.allSettled(requests);
    if (!isCurrent()) return;
    setSelectedItem((value) => value?.item_key === itemKey
      ? withDetailLoadingState(value, { definition: false, instance: false })
      : value);
    setItemDetailLoadingKey((value) => value === itemKey ? "" : value);
  }

  async function refreshSelectedItemDetail(): Promise<AccountItemDetail | null> {
    const current = selectedItem;
    if (!current?.instance_id) return null;
    const itemKey = current.item_key;
    const instanceId = current.instance_id;
    const requestScopeKey = cacheScopeKeyRef.current;
    const requestSequence = ++requestSequenceRef.current;
    const isCurrent = () => (
      requestSequenceRef.current === requestSequence
      && cacheScopeKeyRef.current === requestScopeKey
    );
    deleteAccountItemDetailCacheEntries(accountItemDetailCacheRef.current, requestScopeKey, instanceId);
    invalidateCachedAccountItemDetail(instanceId, requestScopeKey);
    setItemDetailError("");
    setItemDetailLoadingKey(itemKey);
    setSelectedItem((value) => value?.item_key === itemKey
      ? withDetailLoadingState(value, { definition: false, instance: true })
      : value);
    try {
      const detail = await loadAccountItemDetailCached(instanceId, {
        scopeKey: requestScopeKey,
        rollFingerprint: current.weapon_roll?.fingerprint,
        force: true
      });
      if (!isCurrent()) return null;
      accountItemDetailCacheRef.current.set(
        accountDetailCacheKey(
          requestScopeKey,
          instanceId,
          detail.weapon_roll?.fingerprint ?? current.weapon_roll?.fingerprint
        ),
        detail
      );
      evictOldestCacheEntry(accountItemDetailCacheRef.current, ACCOUNT_ITEM_DETAIL_CACHE_LIMIT);
      setSelectedItem((value) => value?.item_key === itemKey
        ? withDetailLoadingState(mergeAccountItemDetail(value, detail), { definition: false, instance: false })
        : value);
      return detail;
    } catch (error) {
      if (!isCurrent()) return null;
      setSelectedItem((value) => value?.item_key === itemKey
        ? withDetailLoadingState(value, { definition: false, instance: false })
        : value);
      setItemDetailError(errorMessage(error, "账号实例详情刷新失败"));
      throw error;
    } finally {
      if (isCurrent()) {
        setItemDetailLoadingKey((value) => value === itemKey ? "" : value);
      }
    }
  }

  function closeSelectedItemDetail() {
    invalidateRequests();
    setItemDetailLoadingKey("");
    setSelectedItem(null);
    setItemDetailError("");
  }

  function resetDetailState(nextScopeKey: string): void {
    cacheScopeKeyRef.current = nextScopeKey;
    invalidateRequestsAndClearCaches();
    setItemDetailLoadingKey("");
    setSelectedItem(null);
    setItemDetailError("");
  }

  function invalidateRequestsAndClearCaches(): void {
    invalidateRequests();
    itemDetailCacheRef.current.clear();
    accountItemDetailCacheRef.current.clear();
  }

  function invalidateRequests(): void {
    requestSequenceRef.current += 1;
  }

  return {
    selectedItem,
    setSelectedItem,
    itemDetailLoadingKey,
    itemDetailError,
    openItemDetail,
    loadSelectedItemFullDetail,
    refreshSelectedItemDetail,
    closeSelectedItemDetail
  };
}

function touchItemDetailCache(
  cache: Map<number, ItemDefinitionDetail>,
  hash: number
): ItemDefinitionDetail | null {
  const detail = cache.get(hash);
  if (!detail) return null;

  cache.delete(hash);
  cache.set(hash, detail);
  return detail;
}

function touchAccountItemDetailCache(
  cache: Map<string, AccountItemDetail>,
  key: string
): AccountItemDetail | null {
  const detail = cache.get(key);
  if (!detail) return null;

  cache.delete(key);
  cache.set(key, detail);
  return detail;
}

function deleteAccountItemDetailCacheEntries(
  cache: Map<string, AccountItemDetail>,
  scopeKey: string,
  instanceId: string
): void {
  const prefix = `${scopeKey}:${instanceId}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

function evictOldestCacheEntry<TKey, TValue>(cache: Map<TKey, TValue>, limit: number): void {
  while (cache.size > limit) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) return;
    cache.delete(oldestKey);
  }
}

function mergeAccountItemDetail(
  current: SelectedItemDetail,
  detail: AccountItemDetail
): SelectedItemDetail {
  return {
    ...current,
    instance_id: detail.instance_id,
    power: current.power ?? detail.power,
    locked: current.locked ?? detail.locked,
    armor_stats: detail.armor_stats,
    armor_stat_breakdown: detail.armor_stat_breakdown,
    armor_energy: detail.armor_energy,
    weapon_stats: detail.weapon_stats ?? current.weapon_stats,
    instance: detail.instance || current.instance
      ? { ...detail.instance, ...current.instance }
      : undefined,
    item_objectives: detail.item_objectives,
    catalyst: detail.catalyst,
    sockets: detail.sockets,
    weapon_roll: detail.weapon_roll ?? current.weapon_roll,
    socket_plugs: detail.socket_plugs,
    group_key: detail.group_key,
    bucket_hash: detail.bucket_hash,
    bucket_name: detail.bucket_name,
    weapon_frame: detail.weapon_frame ?? current.weapon_frame,
    detail_loaded: {
      definition: current.detail_loaded?.definition ?? false,
      instance: true
    }
  };
}

function accountDetailCacheKey(scopeKey: string, instanceId: string, rollFingerprint?: string): string {
  return `${scopeKey}:${instanceId}:${rollFingerprint?.trim() || "unknown-roll"}`;
}

function accountDetailInstanceScopeKey(scopeKey: string, instanceId: string): string {
  return `${scopeKey}:${instanceId}`;
}

function withDetailLoadingState(
  item: SelectedItemDetail,
  detailLoading: NonNullable<SelectedItemDetail["detail_loading"]>
): SelectedItemDetail {
  return {
    ...item,
    detail_loading: detailLoading,
    is_detail_loading: detailLoading.definition || detailLoading.instance
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function appendItemDetailError(
  setError: (value: string | ((current: string) => string)) => void,
  message: string
): void {
  setError((current) => {
    if (!current) return message;
    return current.split("；").includes(message) ? current : `${current}；${message}`;
  });
}
