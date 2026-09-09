import type {
  AccountItemDetail,
  AccountSnapshot,
  AccountSummary,
  DestinyProfileResponse
} from "@d2-tools/core/account/summary";
import type { AccountPursuitSummary } from "@d2-tools/core/account/pursuits";
import {
  createAccountSession,
  type AccountInvalidation,
  type AccountItemPatch,
  type AccountSession,
  type AccountSessionDiagnosticEvent
} from "@d2-tools/services/account/session";
import { createAccountDataRepository, type AccountDataRepository } from "@d2-tools/services/account/repository";
import type { BungieRequestOptions } from "@d2-tools/services/bungie/session";
import {
  loadCachedAccountSnapshot,
  saveCachedAccountSnapshot
} from "@d2-tools/services/account/snapshotStore";
import { createAccountItemDetailStore } from "@d2-tools/services/account/itemDetailStore";
import {
  loadCachedAccountPursuits,
  saveCachedAccountPursuits
} from "@d2-tools/services/account/pursuitStore";
import { loadManifestMetadataCache } from "@d2-tools/services/manifest/cache";
import { loadConfig } from "@d2-tools/services/config/store";
import { loadOAuthToken } from "@d2-tools/services/oauth/tokenStore";
import { loadFreshOAuthToken } from "../ipc/authSession.js";
import { fetchSharedBungieJson } from "./bungieSession.js";
import { getDefinitions } from "./gameDataRuntime.js";
import { measureRuntime, recordRuntimeMetric } from "./runtimeMetrics.js";
import { createAccountDefinitionLoader } from "./accountDefinitions.js";

type AccountSessionState = {
  key: string;
  session: AccountSession;
  repository: AccountDataRepository;
};

let sessionState: AccountSessionState | null = null;
let sessionRequest: Promise<AccountSessionState> | null = null;
const loadAccountDefinitions = createAccountDefinitionLoader(getDefinitions);
const accountSnapshotListeners = new Set<(snapshot: AccountSnapshot) => void>();

export function subscribeAccountSnapshotChanged(
  listener: (snapshot: AccountSnapshot) => void
): () => void {
  accountSnapshotListeners.add(listener);
  return () => accountSnapshotListeners.delete(listener);
}

export type AccountItemLocation = {
  kind: "vault" | "character" | "postmaster";
  characterId?: string;
};

export async function getAccountSnapshot(
  freshness: "cached" | "refresh" = "cached",
  options: { authoritative?: boolean } = {}
): Promise<AccountSnapshot> {
  const state = await getAccountSessionState();
  return measureRuntime<AccountSnapshot>(
    "account.snapshot",
    async () => {
      if (options.authoritative) {
        const snapshot = await state.session.getSnapshot({ freshness, authoritative: true });
        // 权威同步直接读取 Session，完成后必须清掉 Repository 中可能仍然
        // 保留的旧资源；下一次本地优先读取会从 Session 的新快照重新建资源。
        state.repository.invalidate({ scope: "snapshot" });
        return snapshot;
      }
      const resource = await state.repository.getSnapshot({ freshness });
      if (freshness === "refresh" && resource.error) {
        throw new Error(resource.error.message);
      }
      if (resource.data) return resource.data;
      throw new Error(resource.error?.message ?? "账号数据暂时不可用");
    },
    { measurePayload: true }
  );
}

export async function getAccountSnapshotResource(
  freshness: "cached" | "refresh" = "cached"
) {
  const state = await getAccountSessionState();
  return state.repository.getSnapshot({ freshness });
}

export async function getAccountPursuitResource(
  freshness: "cached" | "refresh" = "cached"
) {
  const state = await getAccountSessionState();
  return state.repository.getPursuits({ freshness });
}

export async function getAccountPursuitSummary(
  freshness: "cached" | "refresh" = "cached"
): Promise<AccountPursuitSummary> {
  const resource = await getAccountPursuitResource(freshness);
  if (resource.data) return resource.data;
  throw new Error(resource.error?.message ?? "任务数据暂时不可用");
}

export async function getAccountItemDetailResource(
  instanceId: string,
  freshness: "cached" | "refresh" = "cached"
) {
  const state = await getAccountSessionState();
  return state.repository.getItemDetail(instanceId, { freshness });
}

export async function getArmorPlannerAccountSummary(
  freshness: "cached" | "refresh" = "cached"
): Promise<AccountSummary> {
  const session = await getAccountSession();
  return measureRuntime<AccountSummary>(
    "account.armor-planner-summary",
    () => session.getArmorPlannerSummary({ freshness }),
    { measurePayload: true }
  );
}

export async function getAccountProfileComponents(
  components: readonly number[],
  freshness: "cached" | "refresh" = "cached"
): Promise<DestinyProfileResponse> {
  const session = await getAccountSession();
  return session.getProfileComponents({ components, freshness });
}

export async function warmAccountSession(): Promise<boolean> {
  const config = loadConfig();
  if (!loadOAuthToken(config.data.data_dir)?.membership_id) return false;
  await getAccountSession();
  return true;
}

export async function getAccountItemDetailByInstanceId(
  instanceId: string,
  freshness: "cached" | "refresh" = "cached"
): Promise<AccountItemDetail> {
  const repository = await getAccountDataRepository();
  return measureRuntime<AccountItemDetail>(
    "account.item-detail",
    async () => {
      const resource = await repository.getItemDetail(instanceId, { freshness });
      if (resource.data) return resource.data;
      throw new Error(resource.error?.message ?? "当前账号快照中找不到该装备，请刷新账号后重试");
    },
    { measurePayload: true }
  );
}

export async function resolveAccountItemLocation(
  instanceId: string,
  freshness: "cached" | "refresh" = "cached"
): Promise<AccountItemLocation | null> {
  const snapshot = await getAccountSnapshot(freshness);
  if (snapshot.vault.items.some((item) => item.instance_id === instanceId)) {
    return { kind: "vault" };
  }
  for (const character of snapshot.characters) {
    if ([...character.equipped_items, ...character.inventory_items]
      .some((item) => item.instance_id === instanceId)) {
      return { kind: "character", characterId: character.character_id };
    }
    if (character.postmaster_items.some((item) => item.instance_id === instanceId)) {
      return { kind: "postmaster", characterId: character.character_id };
    }
  }
  return null;
}

export async function patchAccountSession(
  patch: AccountItemPatch,
  options: { revalidate?: boolean; preserve?: boolean } = {}
): Promise<void> {
  const state = await getAccountSessionState();
  state.session.patch(patch, options);
  state.repository.invalidate({ scope: "item", instance_id: patch.item_instance_id });
}

export async function invalidateAccountSession(input: AccountInvalidation): Promise<void> {
  const state = await getAccountSessionState();
  state.session.invalidate(input);
  if (input.scope === "item") {
    state.repository.invalidate({ scope: "item", instance_id: input.instance_id });
  } else if (input.scope === "item-details") {
    state.repository.invalidate({ scope: "items" });
  } else if (input.scope === "pursuits") {
    state.repository.invalidate({ scope: "pursuits" });
  } else if (input.scope === "all" || input.scope === "snapshot" || input.scope === "profile") {
    state.repository.invalidate({ scope: input.scope === "profile" ? "all" : input.scope });
  }
}

export async function invalidateAccountItemDetails(instanceIds?: readonly string[]): Promise<void> {
  if (!instanceIds?.length) {
    await invalidateAccountSession({ scope: "item-details" });
    return;
  }
  await Promise.all(instanceIds.map((instanceId) => (
    invalidateAccountSession({ scope: "item", instance_id: instanceId })
  )));
}

export function resetAccountSession(): void {
  sessionState = null;
  sessionRequest = null;
}

async function getAccountDataRepository(): Promise<AccountDataRepository> {
  const state = await getAccountSessionState();
  return state.repository;
}

async function getAccountSession(): Promise<AccountSession> {
  const state = await getAccountSessionState();
  return state.session;
}

async function getAccountSessionState(): Promise<AccountSessionState> {
  const config = loadConfig();
  const configuredAccountId = loadOAuthToken(config.data.data_dir)?.membership_id ?? "";
  const manifestRevision = loadManifestMetadataCache(config.data.data_dir)?.metadata.version?.trim() ?? "";
  const key = [
    config.data.data_dir,
    config.data.manifest_language,
    manifestRevision,
    config.bungie.api_key,
    config.bungie.client_id,
    configuredAccountId
  ].join("\u0000");
  if (sessionState?.key === key) {
    return sessionState;
  }
  if (sessionRequest) {
    return sessionRequest;
  }

  const request = (async () => {
    const storedToken = loadOAuthToken(config.data.data_dir);
    let activeAccountId = storedToken?.membership_id;
    let pendingSnapshotSave: {
      accountId: string;
      snapshot: AccountSnapshot;
      manifestRevision?: string;
    } | null = null;
    let snapshotSavePromise: Promise<void> | null = null;
    const enqueueSnapshotSave = (snapshot: AccountSnapshot): Promise<void> => {
      if (!activeAccountId) return Promise.resolve();
      if (snapshotSavePromise) {
        recordRuntimeMetric("account.refresh.persistence.coalesced", 0);
      }
      const manifestRevision = loadManifestMetadataCache(config.data.data_dir)?.metadata.version;
      pendingSnapshotSave = {
        accountId: activeAccountId,
        snapshot,
        ...(manifestRevision ? { manifestRevision } : {})
      };
      if (!snapshotSavePromise) {
        snapshotSavePromise = (async () => {
          while (pendingSnapshotSave) {
            const nextSave = pendingSnapshotSave;
            pendingSnapshotSave = null;
            await measureRuntime("account.refresh.persistence", () => (
              saveCachedAccountSnapshot(config.data.data_dir, nextSave.snapshot, new Date(), {
                accountId: nextSave.accountId,
                ...(nextSave.manifestRevision ? { manifestRevision: nextSave.manifestRevision } : {})
              })
            ));
          }
        })().finally(() => {
          snapshotSavePromise = null;
          if (pendingSnapshotSave) void enqueueSnapshotSave(pendingSnapshotSave.snapshot);
        });
      }
      return snapshotSavePromise;
    };
    const cached = activeAccountId
      ? await loadCachedAccountSnapshot(config.data.data_dir, { accountId: activeAccountId })
      : null;
    const cachedPursuits = activeAccountId
      ? await loadCachedAccountPursuits(config.data.data_dir, activeAccountId)
      : null;
    const session = createAccountSession({
      apiKey: config.bungie.api_key,
      getAccessToken: async () => {
        const token = await loadFreshOAuthToken(loadConfig());
        activeAccountId = token.membership_id;
        return token.access_token;
      },
      fetchJson: <T>(
        path: string,
        accessToken: string,
        requestOptions?: BungieRequestOptions
      ) => fetchSharedBungieJson<T>(
        config.bungie.api_key,
        path,
        accessToken,
        requestOptions
      ),
      loadDefinitions: loadAccountDefinitions,
      itemDetailStore: createAccountItemDetailStore(config.data.data_dir),
      manifestRevision: manifestRevision || "manifest-unavailable",
      initialSnapshot: cached?.snapshot,
      initialPursuitSummary: cachedPursuits?.summary,
      onSnapshot: (snapshot) => {
        publishAccountSnapshotChanged(snapshot);
        return enqueueSnapshotSave(snapshot);
      },
      onPursuitSummary: (summary) => activeAccountId
        ? saveCachedAccountPursuits(config.data.data_dir, activeAccountId, summary).then(() => undefined)
        : undefined,
      onDiagnostic: recordAccountSessionDiagnostic
    });
    const repository = createAccountDataRepository({
      session,
      ...(cachedPursuits ? {
        initialPursuits: {
          data: cachedPursuits.summary,
          fetchedAt: cachedPursuits.saved_at
        }
      } : {}),
      onSnapshotRequest: (outcome) => {
        recordRuntimeMetric(`account.refresh.repository.${outcome}`, 0);
      }
    });
    sessionState = { key, session, repository };
    return sessionState;
  })();
  sessionRequest = request;
  try {
    return await request;
  } finally {
    if (sessionRequest === request) sessionRequest = null;
  }
}

function publishAccountSnapshotChanged(snapshot: AccountSnapshot): void {
  for (const listener of accountSnapshotListeners) {
    try {
      listener(snapshot);
    } catch {
      // Renderer notification must never alter account refresh or persistence.
    }
  }
}

function recordAccountSessionDiagnostic(event: AccountSessionDiagnosticEvent): void {
  const stageKey = `account.refresh.${event.stage}`;
  recordRuntimeMetric(`${stageKey}.${event.outcome}`, event.duration_ms);
  if (event.outcome === "completed") {
    recordRuntimeMetric(stageKey, event.duration_ms);
  }
}
