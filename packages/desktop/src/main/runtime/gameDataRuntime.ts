import { Worker } from "node:worker_threads";
import type { DefinitionComponentData, DefinitionComponentName } from "@d2-tools/core/manifest/definitions";
import type { WeaponIdentityRelation } from "@d2-tools/core/community-perks";
import type {
  PerkRelatedEquipmentPage,
  PerkRelatedEquipmentQuery,
  PerkSearchResult
} from "@d2-tools/core/items/perkSearch";
import type { ItemSearchResult } from "@d2-tools/core/items/search";
import type { ArmorSetCatalogEntry } from "@d2-tools/core/items/equipableItemSet";
import type { ArmorPlannerManifestData } from "@d2-tools/services/armor/manifest";
import type {
  GameDataCatalog,
  GameDataRuntimeCapabilities,
  ItemDetailQuery,
  ItemSearchQuery,
  PerkSearchQuery,
  WeaponIdentityQuery
} from "@d2-tools/services/gameData";
import { measureRuntime } from "./runtimeMetrics.js";

type GameDataOperation =
  | "getRuntimeCapabilities"
  | "searchItems"
  | "searchPerks"
  | "getPerkRelatedEquipment"
  | "getItemDetail"
  | "getWeaponIdentityRelations"
  | "getDefinitions"
  | "listArmorSets"
  | "getArmorPlannerManifestData"
  | "ping"
  | "close";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  worker: Worker;
};

type ResumeWaiter = {
  resolve: () => void;
  timeout: ReturnType<typeof setTimeout>;
};

export type DefinitionProjection = "account-snapshot" | "catalyst-record" | "community-match" | "display-summary";

let worker: Worker | null = null;
let nextRequestId = 1;
let suspended = false;
let closeRequest: Promise<void> | null = null;
const resumeWaiters = new Set<ResumeWaiter>();
const pendingRequests = new Map<number, PendingRequest>();
const workerTimeoutCounts = new WeakMap<Worker, number>();
const closeTimeoutMs = 5_000;
const workerRestartTimeoutThreshold = 2;
const operationTimeoutMs: Record<GameDataOperation, number> = {
  getRuntimeCapabilities: 5_000,
  searchItems: 15_000,
  searchPerks: 15_000,
  getPerkRelatedEquipment: 15_000,
  getItemDetail: 15_000,
  getWeaponIdentityRelations: 15_000,
  getDefinitions: 30_000,
  listArmorSets: 30_000,
  getArmorPlannerManifestData: 30_000,
  ping: 5_000,
  close: closeTimeoutMs
};

const catalog: GameDataCatalog = {
  getRuntimeCapabilities() {
    return request<GameDataRuntimeCapabilities>("getRuntimeCapabilities");
  },

  searchItems(input: ItemSearchQuery) {
    return measureRuntime(
      "game-data.search-items",
      () => request<ItemSearchResult[]>("searchItems", input),
      { measurePayload: true }
    );
  },
  searchPerks(input: PerkSearchQuery) {
    return measureRuntime(
      "game-data.search-perks",
      () => request<PerkSearchResult[]>("searchPerks", input),
      { measurePayload: true }
    );
  },
  getPerkRelatedEquipment(input: PerkRelatedEquipmentQuery) {
    return measureRuntime(
      "game-data.perk-related-equipment",
      () => request<PerkRelatedEquipmentPage<ItemSearchResult>>("getPerkRelatedEquipment", input),
      { measurePayload: true }
    );
  },
  getItemDetail(input: ItemDetailQuery) {
    return measureRuntime(
      "game-data.item-detail",
      () => request<ItemSearchResult | null>("getItemDetail", input),
      { measurePayload: true }
    );
  },
  getWeaponIdentityRelations(input: WeaponIdentityQuery) {
    return measureRuntime(
      "game-data.weapon-identity",
      () => request<WeaponIdentityRelation[]>("getWeaponIdentityRelations", input),
      { measurePayload: true }
    );
  }
};

export function getGameDataCatalog(): GameDataCatalog {
  return catalog;
}

export function getArmorSetCatalog(): Promise<ArmorSetCatalogEntry[]> {
  return measureRuntime(
    "game-data.armor-set-catalog",
    () => request<ArmorSetCatalogEntry[]>("listArmorSets"),
    { measurePayload: true }
  );
}

export function getArmorPlannerManifestData(): Promise<ArmorPlannerManifestData> {
  return measureRuntime(
    "game-data.armor-planner-manifest",
    () => request<ArmorPlannerManifestData>("getArmorPlannerManifestData"),
    { measurePayload: true }
  );
}

export function getDefinitions(
  component: DefinitionComponentName,
  hashes: Iterable<number>,
  options: { projection?: DefinitionProjection } = {}
): Promise<DefinitionComponentData> {
  const detailKey = [
    "game-data.definition-batch",
    component,
    options.projection ?? "full"
  ].join(".");
  return measureRuntime(
    "game-data.definition-batch",
    () => request<DefinitionComponentData>("getDefinitions", {
      component,
      hashes: [...new Set([...hashes].map((hash) => hash >>> 0))],
      projection: options.projection
    }),
    { measurePayload: true, additionalKeys: [detailKey] }
  );
}

export async function closeGameDataRuntime(): Promise<void> {
  suspended = true;
  if (closeRequest) {
    return closeRequest;
  }
  const current = worker;
  if (!current) {
    return;
  }
  const operation = (async () => {
    try {
      await withTimeout(
        request("close", undefined, current),
        closeTimeoutMs,
        "关闭资料库查询 worker 超时"
      );
    } finally {
      if (worker === current) worker = null;
      await current.terminate();
      rejectPendingRequests(new Error("资料库查询 worker 已关闭"));
    }
  })();
  closeRequest = operation;
  try {
    await operation;
  } finally {
    if (closeRequest === operation) closeRequest = null;
  }
}

export function resumeGameDataRuntime(): void {
  suspended = false;
  for (const waiter of resumeWaiters) {
    clearTimeout(waiter.timeout);
    waiter.resolve();
  }
  resumeWaiters.clear();
}

export function verifyGameDataRuntime(): Promise<void> {
  return request("ping").then(() => undefined);
}

function request<TResult>(
  operation: GameDataOperation,
  input?: unknown,
  targetWorker?: Worker
): Promise<TResult> {
  if (operation !== "close" && suspended) {
    return waitForRuntimeResume().then(() => request<TResult>(operation, input));
  }
  const activeWorker = targetWorker ?? ensureWorker();
  const id = nextRequestId++;
  return new Promise<TResult>((resolve, reject) => {
    const timeout = setTimeout(() => {
      const pending = pendingRequests.get(id);
      if (!pending) return;
      pendingRequests.delete(id);
      pending.reject(new Error(`资料库查询超时：${operation}`));
      if (operation !== "close") {
        handleWorkerRequestTimeout(activeWorker);
      }
    }, operationTimeoutMs[operation]);
    pendingRequests.set(id, {
      resolve: (value) => resolve(value as TResult),
      reject,
      timeout,
      worker: activeWorker
    });
    try {
      activeWorker.postMessage({ id, operation, input });
    } catch (error) {
      clearTimeout(timeout);
      pendingRequests.delete(id);
      reject(error instanceof Error ? error : new Error("资料库查询请求发送失败"));
    }
  });
}

function waitForRuntimeResume(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const waiter: ResumeWaiter = {
      resolve,
      timeout: setTimeout(() => {
        resumeWaiters.delete(waiter);
        reject(new Error("资料库切换时间过长，请稍后重试"));
      }, 30_000)
    };
    resumeWaiters.add(waiter);
  });
}

function ensureWorker(): Worker {
  if (worker) {
    return worker;
  }
  const nextWorker = new Worker(new URL("../workers/gameDataWorker.js", import.meta.url));
  nextWorker.on("message", (message: {
    id: number;
    ok: boolean;
    result?: unknown;
    error?: string;
  }) => {
    const pending = pendingRequests.get(message.id);
    if (!pending || pending.worker !== nextWorker) {
      return;
    }
    pendingRequests.delete(message.id);
    clearTimeout(pending.timeout);
    workerTimeoutCounts.set(nextWorker, 0);
    if (message.ok) {
      pending.resolve(message.result);
    } else {
      pending.reject(new Error(message.error ?? "资料库查询失败"));
    }
  });
  nextWorker.once("error", (error) => {
    if (worker !== nextWorker) return;
    worker = null;
    rejectPendingRequests(error);
  });
  nextWorker.once("exit", (code) => {
    if (worker !== nextWorker) return;
    worker = null;
    if (code !== 0) {
      rejectPendingRequests(new Error(`资料库查询 worker 异常退出：${code}`));
    } else {
      rejectPendingRequests(new Error("资料库查询 worker 已退出"));
    }
  });
  worker = nextWorker;
  return nextWorker;
}

function rejectPendingRequests(error: Error): void {
  for (const pending of pendingRequests.values()) {
    clearTimeout(pending.timeout);
    pending.reject(error);
  }
  pendingRequests.clear();
}

function handleWorkerRequestTimeout(targetWorker: Worker): void {
  const timeoutCount = (workerTimeoutCounts.get(targetWorker) ?? 0) + 1;
  workerTimeoutCounts.set(targetWorker, timeoutCount);
  if (timeoutCount < workerRestartTimeoutThreshold) return;

  if (worker === targetWorker) worker = null;
  rejectPendingRequestsForWorker(
    targetWorker,
    new Error("资料库查询 worker 连续超时，已重新启动")
  );
  void targetWorker.terminate().catch(() => undefined);
}

function rejectPendingRequestsForWorker(targetWorker: Worker, error: Error): void {
  for (const [id, pending] of pendingRequests) {
    if (pending.worker !== targetWorker) continue;
    clearTimeout(pending.timeout);
    pending.reject(error);
    pendingRequests.delete(id);
  }
}

function withTimeout<TResult>(
  promise: Promise<TResult>,
  timeoutMs: number,
  message: string
): Promise<TResult> {
  return new Promise<TResult>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    void promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}
