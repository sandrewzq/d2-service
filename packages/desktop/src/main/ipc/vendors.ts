import { ipcMain } from "electron";
import type { DefinitionComponentData, DefinitionRecord } from "@d2-tools/core/manifest/definitions";
import { loadConfig } from "@d2-tools/services/config/store";
import { fetchVendorInventorySnapshot } from "@d2-tools/services/vendors/liveInventory";
import {
  createVendorInventoryCacheKey,
  loadCachedVendorInventory,
  saveCachedVendorInventory,
  type VendorInventoryCacheContext
} from "@d2-tools/services/vendors/inventoryCache";
import type { VendorInventoryRequest } from "../../contracts/vendors.js";
import { fetchSharedBungieJson } from "../runtime/bungieSession.js";
import { getDefinitions } from "../runtime/gameDataRuntime.js";
import { measureRuntime } from "../runtime/runtimeMetrics.js";
import { loadFreshOAuthToken } from "./authSession.js";
import { startBackgroundTask } from "../backgroundTasks.js";

const vendorInventoryTimeoutMs = 30_000;
const vendorInventoryRequests = new Map<string, Promise<Awaited<ReturnType<typeof fetchVendorInventorySnapshot>>>>();

export function registerVendorIpcHandlers(): void {
  ipcMain.handle("vendors:inventory", (_event, input: VendorInventoryRequest) => scheduleVendorRefresh(input));
  ipcMain.handle("vendors:inventory:refresh", (_event, input: VendorInventoryRequest) => scheduleVendorRefresh(input));
  ipcMain.handle("vendors:inventory:cached", async (_event, input: VendorInventoryRequest) => {
    const config = loadConfig();
    const cached = await measureRuntime(
      "vendors.inventory.cache-read",
      () => loadCachedVendorInventory(config.data.data_dir, createCacheContext(input, config.data.manifest_language))
    );
    return cached?.snapshot ?? null;
  });
}

function scheduleVendorRefresh(input: VendorInventoryRequest) {
  const config = loadConfig();
  const cacheContext = createCacheContext(input, config.data.manifest_language);
  const requestKey = createVendorInventoryCacheKey(cacheContext);
  const existing = vendorInventoryRequests.get(requestKey);
  const request = existing ?? refreshVendorInventory(input);
  if (!existing) {
    startBackgroundTask({
      type: "vendor-refresh",
      title: "刷新商人库存",
      message: "正在读取商人库存与角色上下文。",
      run: async () => { await request; }
    });
  }
  return request;
}

function refreshVendorInventory(input: VendorInventoryRequest) {
  const config = loadConfig();
  const cacheContext = createCacheContext(input, config.data.manifest_language);
  const requestKey = createVendorInventoryCacheKey(cacheContext);
  const existing = vendorInventoryRequests.get(requestKey);
  if (existing) return existing;

  const request = measureRuntime("vendors.inventory.refresh", () => (
    runVendorInventoryWithTimeout(async (signal) => {
      const definitions: {
        vendors: DefinitionComponentData;
        items: DefinitionComponentData;
        destinations: DefinitionComponentData;
        vendorGroups: DefinitionComponentData;
      } = {
        vendors: {},
        items: {},
        destinations: {},
        vendorGroups: {}
      };
      const token = await measureRuntime("vendors.inventory.token", () => loadFreshOAuthToken(config));
      const snapshot = await fetchVendorInventorySnapshot({
        apiKey: config.bungie.api_key,
        accessToken: token.access_token,
        membershipType: input.membership_type,
        membershipId: input.membership_id,
        characterIds: input.character_ids,
        detailVendorHashes: input.detail_vendor_hashes,
        definitions,
        signal,
        fetchJson: createVendorDefinitionHydratingFetchJson({
          apiKey: config.bungie.api_key,
          accessToken: token.access_token,
          definitions,
          forceRefresh: Boolean(input.force_refresh)
        })
      });
      await saveCachedVendorInventory(config.data.data_dir, cacheContext, snapshot);
      return snapshot;
    })
  ));
  vendorInventoryRequests.set(requestKey, request);
  void request.finally(() => {
    if (vendorInventoryRequests.get(requestKey) === request) vendorInventoryRequests.delete(requestKey);
  }).catch(() => undefined);
  return request;
}

function createCacheContext(
  input: VendorInventoryRequest,
  manifestLanguage: string
): VendorInventoryCacheContext {
  return {
    membershipType: input.membership_type,
    membershipId: input.membership_id,
    characterIds: input.character_ids,
    detailVendorHashes: input.detail_vendor_hashes,
    manifestLanguage
  };
}

function createVendorDefinitionHydratingFetchJson(options: {
  apiKey: string;
  accessToken: string;
  definitions: {
    vendors: DefinitionComponentData;
    items: DefinitionComponentData;
    destinations: DefinitionComponentData;
    vendorGroups: DefinitionComponentData;
  };
  forceRefresh: boolean;
}): <T>(path: string, accessToken?: string) => Promise<T> {
  return async <T>(path: string, accessToken?: string): Promise<T> => {
    const payload = await measureRuntime("vendors.inventory.bungie-request", () => (
      fetchSharedBungieJson<T>(
        options.apiKey,
        path,
        accessToken ?? options.accessToken,
        {
          waitForRefresh: true,
          forceRefresh: options.forceRefresh
        }
      )
    ));
    const payloadItemHashes = collectNumericProperties(payload, new Set([
      "itemHash",
      "plugHash",
      "plugItemHash"
    ]));
    const payloadVendorHashes = new Set([
      ...collectNumericProperties(payload, new Set(["vendorHash"])),
      ...collectVendorComponentKeys(payload)
    ]);
    const payloadVendorGroupHashes = collectNumericProperties(payload, new Set(["vendorGroupHash"]));
    await measureRuntime("vendors.inventory.definition-hydration", async () => {
      const items = await getDefinitions("DestinyInventoryItemDefinition", payloadItemHashes);
      Object.assign(options.definitions.items, items);
      const previewVendorHashes = collectPreviewVendorHashesFromDefinitions(items);
      const vendorHashes = new Set([...payloadVendorHashes, ...previewVendorHashes]);
      const vendors = await getDefinitions("DestinyVendorDefinition", vendorHashes);
      Object.assign(options.definitions.vendors, vendors);

      const traversedStaticVendorHashes = new Set<number>();
      let pendingStaticVendorHashes = [...previewVendorHashes];
      while (pendingStaticVendorHashes.length) {
        const batch = [...new Set(pendingStaticVendorHashes)].filter((hash) => (
          hash > 0 && !traversedStaticVendorHashes.has(hash)
        ));
        pendingStaticVendorHashes = [];
        if (!batch.length) break;
        batch.forEach((hash) => traversedStaticVendorHashes.add(hash));

        const missingVendorHashes = batch.filter((hash) => !options.definitions.vendors[String(hash)]);
        if (missingVendorHashes.length) {
          Object.assign(
            options.definitions.vendors,
            await getDefinitions("DestinyVendorDefinition", missingVendorHashes)
          );
        }

        const staticVendors: DefinitionComponentData = {};
        for (const hash of batch) {
          const definition = options.definitions.vendors[String(hash)] as DefinitionRecord | undefined;
          const returnWithVendorRequest = (definition as (DefinitionRecord & {
            returnWithVendorRequest?: boolean;
          }) | undefined)?.returnWithVendorRequest;
          if (definition && returnWithVendorRequest !== true) {
            staticVendors[String(hash)] = definition;
          }
        }
        const staticItemHashes = collectNumericProperties(staticVendors, new Set([
          "itemHash",
          "plugHash",
          "plugItemHash"
        ]));
        if (!staticItemHashes.size) continue;
        const staticItems = await getDefinitions("DestinyInventoryItemDefinition", staticItemHashes);
        Object.assign(options.definitions.items, staticItems);
        pendingStaticVendorHashes.push(...collectPreviewVendorHashesFromDefinitions(staticItems));
      }

      const vendorGroupHashes = new Set<number>(payloadVendorGroupHashes);
      for (const vendor of Object.values(options.definitions.vendors) as DefinitionRecord[]) {
        const groups = vendor.groups as Array<{ vendorGroupHash?: number }> | undefined;
        for (const group of groups ?? []) {
          if (typeof group.vendorGroupHash === "number") {
            vendorGroupHashes.add(group.vendorGroupHash);
          }
        }
      }
      const destinationHashes = new Set(Object.values(options.definitions.vendors).flatMap((definition) => {
        const locations = definition.locations as Array<{ destinationHash?: number }> | undefined;
        return (locations ?? []).flatMap((location) =>
          typeof location.destinationHash === "number" ? [location.destinationHash] : []
        );
      }));
      Object.assign(
        options.definitions.destinations,
        await getDefinitions("DestinyDestinationDefinition", destinationHashes)
      );
      Object.assign(
        options.definitions.vendorGroups,
        await getDefinitions("DestinyVendorGroupDefinition", vendorGroupHashes)
      );
    });

    return payload;
  };
}

async function runVendorInventoryWithTimeout<T>(
  action: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutRequest = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      reject(new Error("商人库存读取超时，请检查网络后重试"));
      controller.abort();
    }, vendorInventoryTimeoutMs);
  });
  try {
    return await Promise.race([action(controller.signal), timeoutRequest]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (controller.signal.aborted || /timed out|timeout|AbortError/i.test(message)) {
      throw new Error("商人库存读取超时，请检查网络后重试");
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function collectNumericProperties(value: unknown, keys: Set<string>, output = new Set<number>()): Set<number> {
  if (!value || typeof value !== "object") return output;
  if (Array.isArray(value)) {
    for (const item of value) collectNumericProperties(item, keys, output);
    return output;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (keys.has(key) && typeof nested === "number" && Number.isFinite(nested)) {
      output.add(nested);
    }
    collectNumericProperties(nested, keys, output);
  }
  return output;
}

function collectVendorComponentKeys(value: unknown, output = new Set<number>()): Set<number> {
  if (!value || typeof value !== "object") return output;
  if (Array.isArray(value)) {
    for (const item of value) collectVendorComponentKeys(item, output);
    return output;
  }
  for (const [key, nested] of Object.entries(value)) {
    if ((key === "vendors" || key === "sales") && nested && typeof nested === "object") {
      const data = (nested as { data?: unknown }).data;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        for (const hash of Object.keys(data)) {
          const numericHash = Number(hash);
          if (Number.isFinite(numericHash)) output.add(numericHash);
        }
      }
    }
    collectVendorComponentKeys(nested, output);
  }
  return output;
}

function collectPreviewVendorHashesFromDefinitions(
  definitions: DefinitionComponentData
): number[] {
  return [...new Set(Object.values(definitions).flatMap((definition) => {
    const previewVendorHash = (definition.preview as { previewVendorHash?: number } | undefined)
      ?.previewVendorHash;
    return typeof previewVendorHash === "number" && previewVendorHash > 0
      ? [previewVendorHash]
      : [];
  }))];
}
