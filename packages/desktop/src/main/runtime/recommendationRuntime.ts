import { Worker } from "node:worker_threads";
import type {
  VaultCommunityMatchResult,
  VaultItemMatchInput
} from "@d2-tools/core/community-perks";
import { measureRuntime } from "./runtimeMetrics.js";

export type RecommendationWorkerMatchInput = {
  data_dir: string;
  account_key: string;
  manifest_version: string;
  manifest_language: string;
  curated_revision: string;
  recommendation_schema_version?: number;
  items: VaultItemMatchInput[];
  include_evidence: boolean;
};

type RecommendationOperation = "match" | "ping" | "close";

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

let worker: Worker | null = null;
let nextRequestId = 1;
let suspended = false;
let closeRequest: Promise<void> | null = null;
const pendingRequests = new Map<number, PendingRequest>();
const resumeWaiters = new Set<ResumeWaiter>();
const operationTimeoutMs: Record<RecommendationOperation, number> = {
  match: 120_000,
  ping: 5_000,
  close: 5_000
};

export function matchVaultRecommendationsInWorker(
  input: RecommendationWorkerMatchInput
): Promise<VaultCommunityMatchResult> {
  return measureRuntime(
    "recommendation.match-vault",
    () => requestWorker<VaultCommunityMatchResult>("match", input),
    { measurePayload: true }
  );
}

export function verifyRecommendationRuntime(): Promise<void> {
  return requestWorker("ping").then(() => undefined);
}

export async function closeRecommendationRuntime(): Promise<void> {
  suspended = true;
  if (closeRequest) return closeRequest;
  const current = worker;
  if (!current) return;
  const operation = (async () => {
    try {
      await requestWorker("close", undefined, current);
    } finally {
      if (worker === current) worker = null;
      await current.terminate();
      rejectPendingForWorker(current, new Error("推荐匹配 Worker 已关闭"));
    }
  })();
  closeRequest = operation;
  try {
    await operation;
  } finally {
    if (closeRequest === operation) closeRequest = null;
  }
}

export function resumeRecommendationRuntime(): void {
  suspended = false;
  for (const waiter of resumeWaiters) {
    clearTimeout(waiter.timeout);
    waiter.resolve();
  }
  resumeWaiters.clear();
}

function requestWorker<TResult>(
  operation: RecommendationOperation,
  input?: RecommendationWorkerMatchInput,
  targetWorker?: Worker
): Promise<TResult> {
  if (operation !== "close" && suspended) {
    return waitForRuntimeResume().then(() => requestWorker<TResult>(operation, input));
  }
  const activeWorker = targetWorker ?? ensureWorker();
  const id = nextRequestId++;
  return new Promise<TResult>((resolve, reject) => {
    const timeout = setTimeout(() => {
      const pending = pendingRequests.get(id);
      if (!pending) return;
      pendingRequests.delete(id);
      pending.reject(new Error(`推荐匹配 Worker 超时：${operation}`));
      if (worker === activeWorker) worker = null;
      rejectPendingForWorker(activeWorker, new Error("推荐匹配 Worker 已因超时重启"));
      void activeWorker.terminate().catch(() => undefined);
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
      reject(error instanceof Error ? error : new Error("推荐匹配请求发送失败"));
    }
  });
}

function waitForRuntimeResume(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const waiter: ResumeWaiter = {
      resolve,
      timeout: setTimeout(() => {
        resumeWaiters.delete(waiter);
        reject(new Error("资料库切换时间过长，请稍后重试推荐匹配"));
      }, 30_000)
    };
    resumeWaiters.add(waiter);
  });
}

function ensureWorker(): Worker {
  if (worker) return worker;
  const nextWorker = new Worker(new URL("../workers/recommendationWorker.js", import.meta.url));
  nextWorker.on("message", (message: {
    id: number;
    ok: boolean;
    result?: unknown;
    error?: string;
  }) => {
    const pending = pendingRequests.get(message.id);
    if (!pending || pending.worker !== nextWorker) return;
    pendingRequests.delete(message.id);
    clearTimeout(pending.timeout);
    if (message.ok) pending.resolve(message.result);
    else pending.reject(new Error(message.error ?? "推荐匹配失败"));
  });
  nextWorker.once("error", (error) => {
    if (worker === nextWorker) worker = null;
    rejectPendingForWorker(nextWorker, error);
  });
  nextWorker.once("exit", (code) => {
    if (worker === nextWorker) worker = null;
    rejectPendingForWorker(
      nextWorker,
      new Error(code === 0 ? "推荐匹配 Worker 已退出" : `推荐匹配 Worker 异常退出：${code}`)
    );
  });
  worker = nextWorker;
  return nextWorker;
}

function rejectPendingForWorker(targetWorker: Worker, error: Error): void {
  for (const [id, pending] of pendingRequests) {
    if (pending.worker !== targetWorker) continue;
    clearTimeout(pending.timeout);
    pending.reject(error);
    pendingRequests.delete(id);
  }
}
