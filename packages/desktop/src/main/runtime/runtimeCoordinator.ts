import type { HomeBriefing } from "../../contracts/daily.js";
import { loadConfig } from "@d2-tools/services/config/store";
import { recoverSqliteManifest } from "@d2-tools/services/manifest/lifecycle";
import {
  resetAccountSession,
  warmAccountSession
} from "./accountSession.js";
import { resetSharedBungieSession } from "./bungieSession.js";
import {
  closeGameDataRuntime,
  resumeGameDataRuntime,
  verifyGameDataRuntime
} from "./gameDataRuntime.js";
import { getHomeBriefing, type HomeBriefingRefreshOptions } from "./homeBriefing.js";
import { measureRuntime } from "./runtimeMetrics.js";
import { closeArmorPlannerRuntime } from "./armorPlannerRuntime.js";
import {
  closeRecommendationRuntime,
  resumeRecommendationRuntime
} from "./recommendationRuntime.js";

let initialized = false;
let runtimeGeneration = 0;
let manifestRecoveryRequest: Promise<boolean> | null = null;
let sqliteWarmupRequest: Promise<boolean> | null = null;
let accountCacheWarmupRequest: Promise<boolean> | null = null;
let backgroundRefreshRequest: Promise<void> | null = null;
let homeBriefingRequest: {
  force: boolean;
  promise: Promise<HomeBriefing>;
} | null = null;

export function initializeRuntimeCoordinator(): void {
  if (initialized) return;
  initialized = true;
}

export function warmRuntimeInBackground(): Promise<void> {
  initializeRuntimeCoordinator();
  if (backgroundRefreshRequest) return backgroundRefreshRequest;
  const generation = runtimeGeneration;
  const request = measureRuntime(
    "startup.background-refresh",
    () => runStagedWarmup(generation)
  );
  backgroundRefreshRequest = request;
  return request;
}

export async function getCoordinatedHomeBriefing(options: HomeBriefingRefreshOptions = {}): Promise<HomeBriefing> {
  initializeRuntimeCoordinator();
  const generation = runtimeGeneration;
  const recovered = await warmManifestRecovery(generation);
  const sqliteReady = recovered && await warmSqliteRuntime(generation);
  if (!sqliteReady) {
    throw new Error("本地资料库尚未就绪，请先初始化或修复资料库");
  }
  return requestHomeBriefing(options);
}

export function refreshCoordinatedHomeBriefing(): Promise<HomeBriefing> {
  return getCoordinatedHomeBriefing({ force: true });
}

export async function shutdownRuntimeCoordinator(): Promise<void> {
  invalidateWarmupStages();
  resetAccountSession();
  resetSharedBungieSession();
  await Promise.all([
    closeGameDataRuntime(),
    closeArmorPlannerRuntime(),
    closeRecommendationRuntime()
  ]);
  initialized = false;
}

export async function quiesceRuntimeForManifestActivation(): Promise<void> {
  invalidateWarmupStages();
  resetAccountSession();
  await Promise.all([closeGameDataRuntime(), closeRecommendationRuntime()]);
}

export function resumeRuntimeAfterManifestActivation(): void {
  resumeGameDataRuntime();
  resumeRecommendationRuntime();
  invalidateWarmupStages();
  void warmRuntimeInBackground();
}

async function runStagedWarmup(generation: number): Promise<void> {
  const recovered = await warmManifestRecovery(generation);
  if (!recovered || generation !== runtimeGeneration) return;

  const sqliteReady = await warmSqliteRuntime(generation);
  if (!sqliteReady || generation !== runtimeGeneration) return;

  await warmAccountCache(generation);
  if (generation !== runtimeGeneration) return;

  // 启动阶段只恢复本地账号会话。远程 Profile 由 Renderer 的全局账号
  // 控制器执行一次可见初始同步，避免主进程与页面形成两套刷新所有者。
  const homeRefresh = requestHomeBriefing();
  await Promise.allSettled([homeRefresh]);
}

function warmManifestRecovery(generation: number): Promise<boolean> {
  if (manifestRecoveryRequest) return manifestRecoveryRequest;
  manifestRecoveryRequest = measureRuntime("startup.manifest-recovery", () => (
    new Promise<boolean>((resolve) => {
      setImmediate(() => {
        if (generation !== runtimeGeneration) {
          resolve(false);
          return;
        }
        const config = loadConfig();
        recoverSqliteManifest(config.data.data_dir, config.data.manifest_language);
        resolve(generation === runtimeGeneration);
      });
    })
  )).catch(() => false);
  return manifestRecoveryRequest;
}

function warmSqliteRuntime(generation: number): Promise<boolean> {
  if (sqliteWarmupRequest) return sqliteWarmupRequest;
  sqliteWarmupRequest = measureRuntime("startup.sqlite-warmup", verifyGameDataRuntime)
    .then(() => generation === runtimeGeneration)
    .catch(() => false);
  return sqliteWarmupRequest;
}

function warmAccountCache(generation: number): Promise<boolean> {
  if (accountCacheWarmupRequest) return accountCacheWarmupRequest;
  accountCacheWarmupRequest = measureRuntime("startup.account-cache-warmup", warmAccountSession)
    .then((hasAccount) => hasAccount && generation === runtimeGeneration)
    .catch(() => false);
  return accountCacheWarmupRequest;
}

function requestHomeBriefing(options: HomeBriefingRefreshOptions = {}): Promise<HomeBriefing> {
  if (homeBriefingRequest) {
    if (!options.force || homeBriefingRequest.force) return homeBriefingRequest.promise;
    return homeBriefingRequest.promise.then(
      () => requestHomeBriefing({ force: true }),
      () => requestHomeBriefing({ force: true })
    );
  }
  const request = getHomeBriefing(options);
  homeBriefingRequest = { force: Boolean(options.force), promise: request };
  void request.then(
    () => clearHomeBriefingRequest(request),
    () => clearHomeBriefingRequest(request)
  );
  return request;
}

function clearHomeBriefingRequest(request: Promise<HomeBriefing>): void {
  if (homeBriefingRequest?.promise === request) homeBriefingRequest = null;
}

function invalidateWarmupStages(): void {
  runtimeGeneration += 1;
  manifestRecoveryRequest = null;
  sqliteWarmupRequest = null;
  accountCacheWarmupRequest = null;
  backgroundRefreshRequest = null;
  homeBriefingRequest = null;
}
