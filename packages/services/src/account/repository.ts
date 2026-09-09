import type {
  AccountItemDetailQuery,
  AccountSnapshot
} from "@d2-tools/core/account/summary";
import type { AccountPursuitSummary } from "@d2-tools/core/account/pursuits";
import {
  createDataResource,
  type DataResource,
  type DataResourceError
} from "./resource.js";
import type { AccountItemDetailResult, AccountSession } from "./session.js";
import { recordAccountCacheMetric } from "./cacheMetrics.js";

export type AccountDataRepositoryOptions = {
  session: AccountSession;
  now?: () => number;
  initialPursuits?: {
    data: AccountPursuitSummary;
    fetchedAt: string;
  };
  resolveItemQuery?: (snapshot: AccountSnapshot, instanceId: string) => AccountItemDetailQuery | null;
  onSnapshotRequest?: (outcome: "started" | "cache-hit" | "in-flight-reused") => void;
};

export type AccountDataRepository = {
  getSnapshot(options?: { freshness?: "cached" | "allow-stale" | "refresh" }): Promise<DataResource<AccountSnapshot>>;
  getPursuits(options?: { freshness?: "cached" | "allow-stale" | "refresh" }): Promise<DataResource<AccountPursuitSummary>>;
  getItemDetail(instanceId: string, options?: { freshness?: "cached" | "allow-stale" | "refresh" }): Promise<DataResource<AccountItemDetailResult>>;
  prefetchItems(instanceIds: readonly string[], options?: { priority?: "visible" | "background" }): Promise<void>;
  invalidate(input: { scope: "all" | "snapshot" | "pursuits" | "items" | "item"; instance_id?: string }): void;
  subscribe(resource: "snapshot" | "pursuits" | "item", key: string | undefined, listener: (value: DataResource<unknown>) => void): () => void;
};

/**
 * Shared facade for account and item-detail data. Account snapshots only change
 * after an explicit refresh; item details may still use their versioned cache.
 */
export function createAccountDataRepository(options: AccountDataRepositoryOptions): AccountDataRepository {
  const now = options.now ?? Date.now;
  let snapshotResource: DataResource<AccountSnapshot> | undefined;
  let snapshotRequest: Promise<DataResource<AccountSnapshot>> | undefined;
  let pursuitResource: DataResource<AccountPursuitSummary> | undefined = options.initialPursuits
    ? createDataResource({
        data: options.initialPursuits.data,
        source: "local",
        fetchedAt: options.initialPursuits.fetchedAt
      }, now())
    : undefined;
  let pursuitRequest: {
    forceRefresh: boolean;
    promise: Promise<DataResource<AccountPursuitSummary>>;
  } | undefined;
  let pursuitEpoch = 0;
  let repositoryEpoch = 0;
  let itemRepositoryEpoch = 0;
  const itemResources = new Map<string, DataResource<AccountItemDetailResult>>();
  const itemRequests = new Map<string, Promise<DataResource<AccountItemDetailResult>>>();
  const itemEpochs = new Map<string, number>();
  const listeners = new Map<string, Set<(value: DataResource<unknown>) => void>>();
  const reportSnapshotRequest = (outcome: "started" | "cache-hit" | "in-flight-reused") => {
    try {
      options.onSnapshotRequest?.(outcome);
    } catch {
      // Diagnostics must never alter repository reads.
    }
  };

  return {
    getSnapshot: (input = {}) => getSnapshot(input.freshness ?? "cached"),
    getPursuits: (input = {}) => getPursuits(input.freshness ?? "cached"),
    getItemDetail: (instanceId, input = {}) => getItemDetail(instanceId, input.freshness ?? "cached"),
    prefetchItems: async (instanceIds, input = {}) => {
      const uniqueIds = [...new Set(instanceIds.filter(Boolean))];
      await runWithConcurrency(uniqueIds, input.priority === "visible" ? 3 : 2, (id) => (
        getItemDetail(id, input.priority === "visible" ? "cached" : "allow-stale").then(() => undefined)
      ));
    },
    invalidate(input) {
      if (input.scope === "all") {
        repositoryEpoch += 1;
        itemRepositoryEpoch += 1;
        pursuitEpoch += 1;
        snapshotResource = undefined;
        pursuitResource = undefined;
        pursuitRequest = undefined;
        itemResources.clear();
        itemRequests.clear();
        itemEpochs.clear();
        return;
      }
      if (input.scope === "snapshot") {
        repositoryEpoch += 1;
        itemRepositoryEpoch += 1;
        snapshotResource = undefined;
        itemResources.clear();
        itemRequests.clear();
        return;
      }
      if (input.scope === "pursuits") {
        pursuitEpoch += 1;
        pursuitResource = undefined;
        pursuitRequest = undefined;
        return;
      }
      if (input.scope === "items") {
        itemRepositoryEpoch += 1;
        itemResources.clear();
        itemRequests.clear();
        itemEpochs.clear();
        return;
      }
      if (input.instance_id) {
        itemEpochs.set(input.instance_id, (itemEpochs.get(input.instance_id) ?? 0) + 1);
        itemResources.delete(input.instance_id);
        itemRequests.delete(input.instance_id);
        emit("item", input.instance_id, createDataResource({ data: null, source: "local", unavailable: true }, now()));
      }
    },
    subscribe(resource, key, listener) {
      const mapKey = `${resource}:${key ?? "default"}`;
      const set = listeners.get(mapKey) ?? new Set();
      set.add(listener);
      listeners.set(mapKey, set);
      return () => {
        set.delete(listener);
        if (!set.size) listeners.delete(mapKey);
      };
    }
  };

  async function getSnapshot(freshness: "cached" | "allow-stale" | "refresh"): Promise<DataResource<AccountSnapshot>> {
    const existing = snapshotResource;
    if (!existing && freshness !== "refresh") {
      recordAccountCacheMetric("snapshot", "miss");
      if (snapshotRequest) {
        reportSnapshotRequest("in-flight-reused");
        return snapshotRequest;
      }
      reportSnapshotRequest("started");
      snapshotRequest = loadSnapshotFromSession("cached").finally(() => {
        snapshotRequest = undefined;
      });
      return snapshotRequest;
    }
    if (!existing?.data && freshness !== "refresh") {
      recordAccountCacheMetric("snapshot", "miss");
    }
    if (existing?.data && freshness !== "refresh") {
      recordAccountCacheMetric("snapshot", "hit");
      reportSnapshotRequest("cache-hit");
      return existing;
    }
    if (snapshotRequest) {
      reportSnapshotRequest("in-flight-reused");
      return snapshotRequest;
    }
    recordAccountCacheMetric("snapshot", "refresh");
    reportSnapshotRequest("started");
    snapshotRequest = refreshSnapshot(true).finally(() => {
      snapshotRequest = undefined;
    });
    return snapshotRequest;
  }

  async function getPursuits(freshness: "cached" | "allow-stale" | "refresh"): Promise<DataResource<AccountPursuitSummary>> {
    const existing = pursuitResource;
    if (existing?.data && freshness !== "refresh") return existing;
    if (pursuitRequest) {
      if (freshness === "refresh" && !pursuitRequest.forceRefresh) {
        await pursuitRequest.promise.catch(() => undefined);
        return getPursuits("refresh");
      }
      return pursuitRequest.promise;
    }
    const previous = pursuitResource;
    const requestEpoch = pursuitEpoch;
    if (previous?.data && freshness === "refresh") {
      pursuitResource = withRefreshing(previous);
      emit("pursuits", undefined, pursuitResource);
    }
    const promise = (async () => {
      try {
        const data = await options.session.getPursuitSummary({
          freshness: freshness === "refresh" ? "refresh" : "cached"
        });
        if (requestEpoch !== pursuitEpoch) {
          return pursuitResource ?? createDataResource<AccountPursuitSummary>({
            data: null,
            source: "local",
            unavailable: true
          }, now());
        }
        pursuitResource = createDataResource({
          data,
          source: freshness === "refresh" ? "remote" : "merged",
          fetchedAt: new Date(now()).toISOString()
        }, now());
      } catch (error) {
        if (requestEpoch !== pursuitEpoch) {
          return pursuitResource ?? createDataResource<AccountPursuitSummary>({
            data: null,
            source: "local",
            unavailable: true
          }, now());
        }
        pursuitResource = createDataResource({
          data: previous?.data ?? null,
          source: previous?.source ?? "local",
          fetchedAt: previous?.fetchedAt,
          staleAt: new Date(now()).toISOString(),
          error: toResourceError(error)
        }, now());
      }
      emit("pursuits", undefined, pursuitResource);
      return pursuitResource;
    })().finally(() => {
      if (pursuitRequest?.promise === promise) pursuitRequest = undefined;
    });
    pursuitRequest = { forceRefresh: freshness === "refresh", promise };
    return promise;
  }

  async function loadSnapshotFromSession(freshness: "cached" | "refresh"): Promise<DataResource<AccountSnapshot>> {
    try {
      const data = await options.session.getSnapshot({ freshness });
      const fetchedAt = new Date(now()).toISOString();
      snapshotResource = createDataResource({
        data,
        // AccountSession may satisfy this call from its persisted snapshot or
        // perform the first remote read; `merged` avoids claiming either
        // source without an explicit provenance field.
        source: "merged",
        fetchedAt
      }, now());
      emit("snapshot", undefined, snapshotResource);
      return snapshotResource;
    } catch (error) {
      recordAccountCacheMetric("snapshot", "error");
      const resource = createDataResource<AccountSnapshot>({
        data: null,
        source: "local",
        error: toResourceError(error)
      }, now());
      snapshotResource = resource;
      emit("snapshot", undefined, resource);
      return resource;
    }
  }

  async function refreshSnapshot(force = false): Promise<DataResource<AccountSnapshot>> {
    if (!force) recordAccountCacheMetric("snapshot", "refresh");
    const requestEpoch = repositoryEpoch;
    const previous = snapshotResource;
    if (previous?.data) {
      snapshotResource = withRefreshing(previous);
      emit("snapshot", undefined, snapshotResource);
    }
    try {
      const data = await options.session.getSnapshot({ freshness: "refresh" });
      if (requestEpoch !== repositoryEpoch) {
        return snapshotResource ?? createDataResource<AccountSnapshot>({ data: null, source: "local", unavailable: true }, now());
      }
      const fetchedAt = new Date(now()).toISOString();
      snapshotResource = createDataResource({
        data,
        source: "remote",
        fetchedAt
      }, now());
      emit("snapshot", undefined, snapshotResource);
      return snapshotResource;
    } catch (error) {
      recordAccountCacheMetric("snapshot", "error");
      const fallback = previous?.data ?? null;
      snapshotResource = createDataResource({
        data: fallback,
        source: previous?.source ?? "local",
        fetchedAt: previous?.fetchedAt,
        staleAt: new Date(now()).toISOString(),
        error: toResourceError(error)
      }, now());
      emit("snapshot", undefined, snapshotResource);
      return snapshotResource;
    }
  }

  async function getItemDetail(instanceId: string, freshness: "cached" | "allow-stale" | "refresh"): Promise<DataResource<AccountItemDetailResult>> {
    const existing = itemResources.get(instanceId);
    if (!existing?.data && freshness !== "refresh") {
      recordAccountCacheMetric("item-detail", "miss");
    }
    if (existing?.data && freshness !== "refresh") {
      recordAccountCacheMetric("item-detail", "hit");
      return existing;
    }
    const pending = itemRequests.get(instanceId);
    if (pending) return pending;
    if (!existing) recordAccountCacheMetric("item-detail", "miss");
    if (freshness === "refresh") recordAccountCacheMetric("item-detail", "refresh");
    const request = refreshItem(instanceId, freshness === "refresh").finally(() => {
      if (itemRequests.get(instanceId) === request) itemRequests.delete(instanceId);
    });
    itemRequests.set(instanceId, request);
    return request;
  }

  async function refreshItem(instanceId: string, force = false): Promise<DataResource<AccountItemDetailResult>> {
    if (!force) recordAccountCacheMetric("item-detail", "refresh");
    const requestEpoch = itemEpochs.get(instanceId) ?? 0;
    const requestRepositoryEpoch = itemRepositoryEpoch;
    const previous = itemResources.get(instanceId);
    if (previous?.data) {
      const refreshing = withRefreshing(previous);
      itemResources.set(instanceId, refreshing);
      emit("item", instanceId, refreshing);
    }
    try {
      const snapshot = (await getSnapshot("allow-stale")).data;
      const query = snapshot && (options.resolveItemQuery?.(snapshot, instanceId) ?? findItemQuery(snapshot, instanceId));
      if (!query) throw new Error("当前账号快照中找不到该装备");
      const detail = await options.session.getItemDetail(query, { freshness: force ? "refresh" : "cached" });
      if (requestRepositoryEpoch !== itemRepositoryEpoch
        || requestEpoch !== (itemEpochs.get(instanceId) ?? 0)) {
        return itemResources.get(instanceId) ?? createDataResource<AccountItemDetailResult>({ data: null, source: "local", unavailable: true }, now());
      }
      const fetchedAt = detail.fetched_at ?? new Date(now()).toISOString();
      const resource = createDataResource({
        data: detail,
        source: detail.fetched_at ? "local" : "remote",
        fetchedAt
      }, now());
      itemResources.set(instanceId, resource);
      emit("item", instanceId, resource);
      return resource;
    } catch (error) {
      recordAccountCacheMetric("item-detail", "error");
      const resource = createDataResource({
        data: previous?.data ?? null,
        source: previous?.source ?? "local",
        fetchedAt: previous?.fetchedAt,
        staleAt: new Date(now()).toISOString(),
        error: toResourceError(error)
      }, now());
      itemResources.set(instanceId, resource);
      emit("item", instanceId, resource);
      return resource;
    }
  }

  function emit(resource: "snapshot" | "pursuits" | "item", key: string | undefined, value: DataResource<unknown>): void {
    listeners.get(`${resource}:${key ?? "default"}`)?.forEach((listener) => listener(value));
  }

  function withRefreshing<T>(resource: DataResource<T>): DataResource<T> {
    return createDataResource({
      data: resource.data,
      source: resource.source,
      fetchedAt: resource.fetchedAt,
      staleAt: resource.staleAt,
      refreshing: true,
      ...(resource.error ? { error: resource.error } : {})
    }, now());
  }
}

async function runWithConcurrency<T>(items: readonly T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index]!);
    }
  });
  await Promise.all(runners);
}

function findItemQuery(snapshot: AccountSnapshot, instanceId: string): AccountItemDetailQuery | null {
  const create = (item: { instance_id?: string; hash: number }, characterId?: string) => item.instance_id === instanceId
    ? {
        destiny_membership_id: snapshot.destiny_membership_id,
        membership_type: snapshot.membership_type,
        instance_id: instanceId,
        item_hash: item.hash,
        ...(characterId ? { character_id: characterId } : {})
      }
    : null;
  for (const item of snapshot.vault.items) {
    const query = create(item);
    if (query) return query;
  }
  for (const character of snapshot.characters) {
    for (const item of [...character.equipped_items, ...character.inventory_items, ...character.postmaster_items]) {
      const query = create(item, character.character_id);
      if (query) return query;
    }
  }
  return null;
}

function toResourceError(error: unknown): DataResourceError {
  return {
    code: typeof error === "object" && error && "code" in error && typeof error.code === "string" ? error.code : "account_data_unavailable",
    message: error instanceof Error ? error.message : "账号数据暂时不可用"
  };
}
