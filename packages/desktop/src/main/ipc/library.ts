import { ipcMain } from "electron";
import {
  classifyGameDataIpcError,
  encodeDesktopIpcFailure
} from "../../contracts/errors.js";
import { loadConfig } from "@d2-tools/services/config/store";
import {
  loadItemAliases,
  saveItemAlias,
  type ItemAliasEntry
} from "@d2-tools/services/items/aliases";
import { buildLiveItemAvailabilityFromBungie } from "@d2-tools/core/items/liveAvailability";
import type {
  WeeklyFarmingCatalogResource,
  WeeklyFarmingRequest
} from "@d2-tools/core/weekly/farming";
import {
  buildWeeklyFarmingCatalogResource,
  collectActivityLootItemHashes
} from "@d2-tools/services/community/activityLoot";
import {
  addFavoriteItem,
  addRecentItem,
  loadLibraryHistory,
  removeFavoriteItem,
  type LibraryHistoryItem
} from "@d2-tools/services/library/history";
import {
  type BungieHomeSnapshot,
  type BungieVendorsResponse
} from "@d2-tools/services/bungie/session";
import { getArmorSetCatalog, getDefinitions, getGameDataCatalog } from "../runtime/gameDataRuntime.js";
import { getAccountProfileComponents } from "../runtime/accountSession.js";
import { getSharedBungieSession } from "../runtime/bungieSession.js";
import { loadFreshOAuthToken } from "./authSession.js";
import { getDesktopManifestStatus } from "./manifest.js";

export function registerLibraryIpcHandlers(): void {
  ipcMain.handle("library:capabilities", async () => {
    const catalog = getGameDataCatalog() as {
      getRuntimeCapabilities?: () => Promise<{
        contract_version: number;
        supports_perk_families: boolean;
        supports_related_equipment_paging: boolean;
        supports_related_variant_matches: boolean;
      }>;
    };
    try {
      if (catalog.getRuntimeCapabilities) return await catalog.getRuntimeCapabilities();
    } catch {
      // An older worker does not know this operation and must be treated as contract v1.
    }
    return {
      contract_version: 1,
      supports_perk_families: false,
      supports_related_equipment_paging: false,
      supports_related_variant_matches: false
    };
  });

  ipcMain.handle("items:search", (_event, query: string) => encodeDesktopIpcFailure(() => {
    const config = loadConfig();
    return getGameDataCatalog().searchItems({
      query,
      limit: 20,
      aliases: loadItemAliases(config.data.data_dir)
    });
  }, classifyGameDataIpcError));

  ipcMain.handle("items:perks:search", (_event, query: string) => encodeDesktopIpcFailure(() => {
    const config = loadConfig();
    return getGameDataCatalog().searchPerks({
      query,
      limit: 20,
      aliases: loadItemAliases(config.data.data_dir)
    });
  }, classifyGameDataIpcError));

  ipcMain.handle("items:perks:related", (_event, input: { perk_hashes: number[]; offset?: number; limit?: number }) => (
    encodeDesktopIpcFailure(() => getGameDataCatalog().getPerkRelatedEquipment({
      perk_hashes: Array.isArray(input?.perk_hashes)
        ? input.perk_hashes.map(Number).filter(Number.isFinite)
        : [],
      offset: Number(input?.offset ?? 0),
      limit: Number(input?.limit ?? 20)
    }), classifyGameDataIpcError)
  ));

  ipcMain.handle("items:armor-sets:list", () => encodeDesktopIpcFailure(
    () => getArmorSetCatalog(),
    classifyGameDataIpcError
  ));

  ipcMain.handle("items:live-availability", (_event, itemHashes: number[]) => encodeDesktopIpcFailure(async () => {
    const config = loadConfig();
    const token = await loadFreshOAuthToken(config).catch(() => null);
    const snapshot = await getSharedBungieSession(config.bungie.api_key).getHomeSnapshot({
      accessToken: token?.access_token
    });
    const normalizedItemHashes = Array.isArray(itemHashes) ? itemHashes.map(Number) : [];

    return buildLiveItemAvailabilityFromBungie({
      itemHashes: normalizedItemHashes,
      publicVendors: snapshot.publicVendors,
      characterVendors: snapshot.characterVendors,
      milestones: snapshot.milestones,
      definitions: await loadAvailabilityDefinitions(snapshot, normalizedItemHashes)
    });
  }, classifyGameDataIpcError));

  ipcMain.handle("library:weekly-farming:get", (_event, rawRequest: WeeklyFarmingRequest) => (
    encodeDesktopIpcFailure(
      () => loadWeeklyFarmingCatalog(normalizeWeeklyFarmingRequest(rawRequest)),
      classifyGameDataIpcError
    )
  ));

  ipcMain.handle("items:detail", (_event, hash: number) => encodeDesktopIpcFailure(async () => {
    const detail = await getGameDataCatalog().getItemDetail({ hash: Number(hash) });
    if (!detail) {
      throw new Error("未找到物品详情");
    }

    return detail;
  }, classifyGameDataIpcError));

  ipcMain.handle("aliases:get", () => {
    const config = loadConfig();
    return loadItemAliases(config.data.data_dir);
  });

  ipcMain.handle("aliases:save", (_event, input: ItemAliasEntry) => {
    const config = loadConfig();
    return saveItemAlias(config.data.data_dir, input);
  });

  ipcMain.handle("library:history:get", () => {
    const config = loadConfig();
    return loadLibraryHistory(config.data.data_dir);
  });

  ipcMain.handle("library:recent:add", (_event, item: Omit<LibraryHistoryItem, "viewed_at">) => {
    const config = loadConfig();
    return addRecentItem(config.data.data_dir, item);
  });

  ipcMain.handle("library:favorite:add", (_event, item: Omit<LibraryHistoryItem, "viewed_at">) => {
    const config = loadConfig();
    return addFavoriteItem(config.data.data_dir, item);
  });

  ipcMain.handle("library:favorite:remove", (_event, hash: number) => {
    const config = loadConfig();
    return removeFavoriteItem(config.data.data_dir, Number(hash));
  });
}

async function loadWeeklyFarmingCatalog(
  request: WeeklyFarmingRequest
): Promise<WeeklyFarmingCatalogResource> {
  const itemHashes = collectActivityLootItemHashes(request);
  const [itemDefinitions, recordsResult] = await Promise.all([
    getDefinitions("DestinyInventoryItemDefinition", itemHashes, { projection: "display-summary" }),
    getAccountProfileComponents([900], request.force ? "refresh" : "cached")
      .then((profile) => ({ records: profile.profileRecords?.data?.records, failed: false }))
      .catch(() => ({ records: undefined, failed: true }))
  ]);
  return buildWeeklyFarmingCatalogResource({
    request,
    manifestVersion: getDesktopManifestStatus().version,
    itemDefinitions,
    profileRecords: recordsResult.records,
    patternReadFailed: recordsResult.failed
  });
}

function normalizeWeeklyFarmingRequest(value: WeeklyFarmingRequest): WeeklyFarmingRequest {
  const activities = Array.isArray(value?.activities)
    ? value.activities.flatMap((activity) => {
        if (!activity || (activity.kind !== "raid" && activity.kind !== "dungeon")) return [];
        const title = typeof activity.title === "string" ? activity.title.trim() : "";
        if (!title) return [];
        return [{
          kind: activity.kind,
          title,
          related_hashes: Array.isArray(activity.related_hashes)
            ? activity.related_hashes.map(Number).filter(Number.isFinite)
            : [],
          source: typeof activity.source === "string" ? activity.source : undefined
        }];
      })
    : [];
  return {
    activities,
    reset_at: typeof value?.reset_at === "string" ? value.reset_at : undefined,
    force: value?.force === true
  };
}

async function loadAvailabilityDefinitions(
  snapshot: BungieHomeSnapshot,
  itemHashes: number[]
) {
  const milestones = snapshot.milestones ?? {};
  const vendorResponses = [snapshot.publicVendors, ...snapshot.characterVendors]
    .filter((response): response is BungieVendorsResponse => Boolean(response));
  const milestoneHashes = Object.keys(milestones).map(Number);
  const activityHashes = Object.values(milestones).flatMap((milestone) =>
    (milestone.activities ?? []).flatMap((activity) => numberValue(activity.activityHash))
  );
  const milestoneItemHashes = Object.values(milestones).flatMap((milestone) => [
    ...(milestone.availableQuests ?? []).flatMap((quest) => numberValue(quest.questItemHash))
  ]);
  const vendorHashes = vendorResponses.flatMap((response) =>
    Object.entries(response.vendors?.data ?? {}).flatMap(([key, vendor]) =>
      numberValue(vendor.vendorHash ?? Number(key))
    )
  );
  const vendorSaleItemHashes = vendorResponses.flatMap((response) =>
    Object.values(response.sales?.data ?? {}).flatMap((sales) =>
      Object.values(sales?.saleItems ?? {}).flatMap((sale) => [
        ...numberValue(sale.itemHash),
        ...(sale.costs ?? []).flatMap((cost) => numberValue(cost.itemHash))
      ])
    )
  );
  const [activities, milestoneDefinitions, vendors, items] = await Promise.all([
    getDefinitions("DestinyActivityDefinition", activityHashes),
    getDefinitions("DestinyMilestoneDefinition", milestoneHashes),
    getDefinitions("DestinyVendorDefinition", vendorHashes),
    getDefinitions("DestinyInventoryItemDefinition", [
      ...itemHashes,
      ...milestoneItemHashes,
      ...vendorSaleItemHashes
    ])
  ]);

  return {
    activities,
    milestones: milestoneDefinitions,
    vendors,
    items
  };
}

function numberValue(value: unknown): number[] {
  return typeof value === "number" && Number.isFinite(value) ? [value] : [];
}
