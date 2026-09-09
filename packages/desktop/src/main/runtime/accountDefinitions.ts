import type {
  AccountDefinitionData,
  AccountDefinitionLoader,
  AccountDefinitionRequest
} from "@d2-tools/core/account/summary";
import type {
  DefinitionComponentData,
  DefinitionComponentName,
  DefinitionRecord
} from "@d2-tools/core/manifest/definitions";
import type { DefinitionProjection } from "./gameDataRuntime.js";

type DefinitionQuery = (
  component: DefinitionComponentName,
  hashes: Iterable<number>,
  options?: { projection?: DefinitionProjection }
) => Promise<DefinitionComponentData>;

type CatalystRecordCache = {
  resolvedHashes: Set<number>;
  definitions: DefinitionComponentData;
  loading?: Promise<void>;
};

export function createAccountDefinitionLoader(
  getDefinitions: DefinitionQuery
): AccountDefinitionLoader {
  const catalystRecordCache: CatalystRecordCache = {
    resolvedHashes: new Set(),
    definitions: {}
  };
  let cacheExpiresAt = Date.now() + 5 * 60_000;
  return (request) => {
    if (Date.now() >= cacheExpiresAt) {
      catalystRecordCache.resolvedHashes.clear();
      for (const hash of Object.keys(catalystRecordCache.definitions)) {
        delete catalystRecordCache.definitions[hash];
      }
      cacheExpiresAt = Date.now() + 5 * 60_000;
    }
    return loadAccountDefinitions(request, getDefinitions, catalystRecordCache);
  };
}

export async function loadAccountDefinitions(
  request: AccountDefinitionRequest,
  getDefinitions: DefinitionQuery,
  catalystRecordCache?: CatalystRecordCache
): Promise<AccountDefinitionData> {
  const itemHashes = new Set(request.itemHashes.map(toUnsignedHash));
  const bucketHashes = new Set(request.bucketHashes.map(toUnsignedHash));
  const plugSetHashes = new Set(request.plugSetHashes.map(toUnsignedHash));
  const itemDefinitions: DefinitionComponentData = {};
  const plugSetDefinitions: DefinitionComponentData = {};
  const queriedItemHashes = new Set<number>();
  const queriedPlugSetHashes = new Set<number>();
  const objectiveHashes = new Set(request.objectiveHashes.map(toUnsignedHash));
  const presentationNodeHashes = new Set((request.presentationNodeHashes ?? []).map(toUnsignedHash));
  const queriedPresentationNodeHashes = new Set<number>();
  const presentationNodeDefinitions: DefinitionComponentData = {};
  const pursuitRecordHashes = new Set<number>();
  const equipableItemSetHashes = new Set<number>();
  const definitionOptions = request.expandSocketPlugSets
    ? undefined
    : { projection: "account-snapshot" as const };

  while (
    hasUnqueriedHash(itemHashes, queriedItemHashes)
    || hasUnqueriedHash(plugSetHashes, queriedPlugSetHashes)
  ) {
    const loadedItems = await queryNewDefinitions(
      getDefinitions,
      "DestinyInventoryItemDefinition",
      itemHashes,
      queriedItemHashes,
      itemDefinitions,
      definitionOptions
    );
    for (const definition of loadedItems) {
      addHash(bucketHashes, definition.inventory?.bucketTypeHash);
      for (const step of definition.setData?.itemList ?? []) addHash(itemHashes, step.itemHash);
      addHash(itemHashes, definition.objectives?.questlineItemHash);
      addHash(equipableItemSetHashes, definition.equippingBlock?.equipableItemSetHash);
      if (!request.expandSocketPlugSets) continue;
      for (const socket of definition.sockets?.socketEntries ?? []) {
        addHash(itemHashes, socket.singleInitialItemHash);
        addHash(plugSetHashes, socket.reusablePlugSetHash);
        addHash(plugSetHashes, socket.randomizedPlugSetHash);
        for (const plug of socket.reusablePlugItems ?? []) addHash(itemHashes, plug.plugItemHash);
      }
    }

    const loadedPlugSets = await queryNewDefinitions(
      getDefinitions,
      "DestinyPlugSetDefinition",
      plugSetHashes,
      queriedPlugSetHashes,
      plugSetDefinitions,
      definitionOptions
    );
    if (request.expandSocketPlugSets) {
      for (const definition of loadedPlugSets) {
        for (const plug of definition.reusablePlugItems ?? []) addHash(itemHashes, plug.plugItemHash);
      }
    }
  }

  while (hasUnqueriedHash(presentationNodeHashes, queriedPresentationNodeHashes)) {
    const loadedNodes = await queryNewDefinitions(
      getDefinitions,
      "DestinyPresentationNodeDefinition",
      presentationNodeHashes,
      queriedPresentationNodeHashes,
      presentationNodeDefinitions,
      { projection: "pursuit-node" }
    );
    for (const definition of loadedNodes) {
      for (const child of definition.children?.presentationNodes ?? []) {
        addHash(presentationNodeHashes, child.presentationNodeHash);
      }
      for (const child of definition.children?.records ?? []) {
        addHash(pursuitRecordHashes, child.recordHash);
      }
    }
  }

  const recordDefinitions = await loadCatalystRecordDefinitions(
    request.recordHashes ?? [],
    getDefinitions,
    catalystRecordCache
  );
  const pursuitRecordDefinitions = pursuitRecordHashes.size
    ? await getDefinitions("DestinyRecordDefinition", pursuitRecordHashes, { projection: "pursuit-record" })
    : {};
  Object.assign(recordDefinitions, pursuitRecordDefinitions);
  for (const definition of Object.values(recordDefinitions)) {
    for (const objectiveHash of definition.objectiveHashes ?? []) addHash(objectiveHashes, objectiveHash);
  }

  const [
    bucketDefinitions,
    damageTypeDefinitions,
    equipableItemSetDefinitions,
    inventoryItemConstantsDefinitions,
    objectiveDefinitions,
    loadoutNameDefinitions
  ] = await Promise.all([
    getDefinitions("DestinyInventoryBucketDefinition", bucketHashes, definitionOptions),
    getDefinitions("DestinyDamageTypeDefinition", request.damageTypeHashes ?? [], definitionOptions),
    getDefinitions("DestinyEquipableItemSetDefinition", equipableItemSetHashes, definitionOptions),
    getDefinitions("DestinyInventoryItemConstantsDefinition", [1], definitionOptions),
    getDefinitions("DestinyObjectiveDefinition", objectiveHashes, definitionOptions),
    getDefinitions("DestinyLoadoutNameDefinition", request.loadoutNameHashes, definitionOptions)
  ]);
  return {
    itemDefinitions,
    inventoryItemConstantsDefinitions,
    plugSetDefinitions,
    bucketDefinitions,
    damageTypeDefinitions,
    equipableItemSetDefinitions,
    objectiveDefinitions,
    recordDefinitions,
    presentationNodeDefinitions,
    loadoutNameDefinitions
  };
}

async function loadCatalystRecordDefinitions(
  hashes: number[],
  getDefinitions: DefinitionQuery,
  cache?: CatalystRecordCache
): Promise<DefinitionComponentData> {
  const requested = [...new Set(hashes.map(toUnsignedHash))];
  if (!requested.length) return {};
  if (!cache) {
    return getDefinitions("DestinyRecordDefinition", requested, { projection: "catalyst-record" });
  }

  if (cache.loading) await cache.loading;
  const pending = requested.filter((hash) => !cache.resolvedHashes.has(hash));
  if (pending.length) {
    cache.loading = getDefinitions(
      "DestinyRecordDefinition",
      pending,
      { projection: "catalyst-record" }
    ).then((loaded) => {
      Object.assign(cache.definitions, loaded);
      for (const hash of pending) cache.resolvedHashes.add(hash);
    }).finally(() => {
      cache.loading = undefined;
    });
    await cache.loading;
  }

  const result: DefinitionComponentData = {};
  for (const hash of requested) {
    const definition = cache.definitions[String(hash)];
    if (definition) result[String(hash)] = definition;
  }
  return result;
}

async function queryNewDefinitions(
  getDefinitions: DefinitionQuery,
  component: "DestinyInventoryItemDefinition" | "DestinyPlugSetDefinition" | "DestinyPresentationNodeDefinition",
  hashes: Set<number>,
  queriedHashes: Set<number>,
  target: DefinitionComponentData,
  options?: { projection?: DefinitionProjection }
): Promise<DefinitionRecord[]> {
  const pending = [...hashes].filter((hash) => !queriedHashes.has(hash));
  for (const hash of pending) queriedHashes.add(hash);
  if (!pending.length) return [];
  const loaded = await getDefinitions(component, pending, options);
  Object.assign(target, loaded);
  return Object.values(loaded);
}

function hasUnqueriedHash(hashes: Set<number>, queriedHashes: Set<number>): boolean {
  for (const hash of hashes) if (!queriedHashes.has(hash)) return true;
  return false;
}

function addHash(target: Set<number>, hash: number | undefined): void {
  if (typeof hash === "number" && Number.isFinite(hash)) target.add(toUnsignedHash(hash));
}

function toUnsignedHash(hash: number): number {
  return hash >>> 0;
}
