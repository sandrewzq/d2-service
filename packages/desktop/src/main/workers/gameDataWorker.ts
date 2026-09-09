import { parentPort } from "node:worker_threads";
import type {
  DefinitionComponentData,
  DefinitionComponentName,
  DefinitionRecord
} from "@d2-tools/core/manifest/definitions";
import {
  buildArmorSetCatalog,
  type ArmorSetCatalogEntry
} from "@d2-tools/core/items/equipableItemSet";
import { loadConfig } from "@d2-tools/services/config/store";
import {
  createArmorPlannerManifestData,
  loadSqliteArmorRuleset,
  type ArmorPlannerManifestData
} from "@d2-tools/services/armor/manifest";
import {
  createCompositeDefinitionReader,
  createJsonDefinitionReader,
  createSqliteDefinitionReader,
  type DefinitionReader
} from "@d2-tools/services/gameData/sqlite";
import { createSqliteGameDataCatalog } from "@d2-tools/services/gameData/sqlite";
import {
  loadActiveSqliteManifest,
  type SqliteManifestActivation
} from "@d2-tools/services/manifest/lifecycle";
import type { DefinitionProjection } from "../runtime/gameDataRuntime.js";

type GameDataWorkerRequest = {
  id: number;
  operation:
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
  input?: unknown;
};

type DefinitionRequest = {
  component: DefinitionComponentName;
  hashes: number[];
  projection?: DefinitionProjection;
};

type OpenRuntime = {
  key: string;
  activation: SqliteManifestActivation;
  catalog: ReturnType<typeof createSqliteGameDataCatalog>;
  reader: DefinitionReader;
  armorSetCatalog?: ArmorSetCatalogEntry[];
  armorPlannerManifestData?: ArmorPlannerManifestData;
};

let runtime: OpenRuntime | null = null;

parentPort?.on("message", (request: GameDataWorkerRequest) => {
  void handleRequest(request).then(
    (result) => parentPort?.postMessage({ id: request.id, ok: true, result }),
    (error) => parentPort?.postMessage({
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : "资料库查询失败"
    })
  );
});

async function handleRequest(request: GameDataWorkerRequest): Promise<unknown> {
  if (request.operation === "close") {
    closeRuntime();
    return null;
  }

  const current = ensureRuntime();
  if (request.operation === "ping") {
    return {
      manifestVersion: current.activation.manifestVersion,
      activatedAt: current.activation.activatedAt
    };
  }
  if (request.operation === "getRuntimeCapabilities") {
    return current.catalog.getRuntimeCapabilities();
  }
  if (request.operation === "searchItems") {
    return current.catalog.searchItems(request.input as Parameters<typeof current.catalog.searchItems>[0]);
  }
  if (request.operation === "searchPerks") {
    return current.catalog.searchPerks(request.input as Parameters<typeof current.catalog.searchPerks>[0]);
  }
  if (request.operation === "getPerkRelatedEquipment") {
    return current.catalog.getPerkRelatedEquipment(
      request.input as Parameters<typeof current.catalog.getPerkRelatedEquipment>[0]
    );
  }
  if (request.operation === "getItemDetail") {
    return current.catalog.getItemDetail(request.input as Parameters<typeof current.catalog.getItemDetail>[0]);
  }
  if (request.operation === "getWeaponIdentityRelations") {
    return current.catalog.getWeaponIdentityRelations(
      request.input as Parameters<typeof current.catalog.getWeaponIdentityRelations>[0]
    );
  }
  if (request.operation === "getDefinitions") {
    const input = request.input as DefinitionRequest;
    const definitions = current.reader.getMany(input.component, input.hashes);
    return projectDefinitions(input.component, definitions, input.projection);
  }
  if (request.operation === "listArmorSets") {
    return listArmorSets(current);
  }
  if (request.operation === "getArmorPlannerManifestData") {
    return getArmorPlannerManifestData(current);
  }
  throw new Error("未知资料库查询操作");
}

function listArmorSets(current: OpenRuntime): ArmorSetCatalogEntry[] {
  if (current.armorSetCatalog) {
    return current.armorSetCatalog;
  }
  const definitions = current.reader.getAll("DestinyEquipableItemSetDefinition");
  const itemDefinitions = current.reader.getMany(
    "DestinyInventoryItemDefinition",
    Object.values(definitions).flatMap((definition) => definition.setItems ?? [])
  );
  const sandboxPerkDefinitions = current.reader.getMany(
    "DestinySandboxPerkDefinition",
    Object.values(definitions).flatMap((definition) => (
      (definition.setPerks ?? []).flatMap((bonus) => (
        typeof bonus.sandboxPerkHash === "number" ? [bonus.sandboxPerkHash] : []
      ))
    ))
  );
  const catalog = buildArmorSetCatalog(definitions, itemDefinitions, sandboxPerkDefinitions);
  current.armorSetCatalog = catalog;
  return catalog;
}

function getArmorPlannerManifestData(current: OpenRuntime): ArmorPlannerManifestData {
  if (current.armorPlannerManifestData) return current.armorPlannerManifestData;
  const rulesetBuild = loadSqliteArmorRuleset({
    databasePath: current.activation.databasePath,
    manifestVersion: current.activation.manifestVersion,
    manifestLanguage: current.activation.language
  });
  const data = createArmorPlannerManifestData({
    manifestVersion: current.activation.manifestVersion,
    manifestLanguage: current.activation.language,
    rulesetBuild,
    armorSetCatalog: listArmorSets(current)
  });
  current.armorPlannerManifestData = data;
  return data;
}

function projectDefinitions(
  component: DefinitionComponentName,
  definitions: DefinitionComponentData,
  projection: DefinitionProjection | undefined
): DefinitionComponentData {
  if (!projection) return definitions;
  if (projection === "catalyst-record") {
    const projected: DefinitionComponentData = {};
    for (const [hash, definition] of Object.entries(definitions)) {
      if (isCatalystRecordDefinition(component, definition)) {
        projected[hash] = projectCatalystRecordDefinition(definition);
      }
    }
    return projected;
  }
  if (projection === "pursuit-record") {
    return Object.fromEntries(Object.entries(definitions).map(([hash, definition]) => [hash, compactObject({
      hash: definition.hash,
      displayProperties: compactObject({
        name: definition.displayProperties?.name,
        description: definition.displayProperties?.description,
        icon: definition.displayProperties?.icon
      }),
      objectiveHashes: definition.objectiveHashes,
      expirationInfo: definition.expirationInfo,
      rewardItems: definition.rewardItems,
      recordTypeName: definition.recordTypeName
    })]));
  }
  if (projection === "pursuit-node") {
    return Object.fromEntries(Object.entries(definitions).map(([hash, definition]) => [hash, compactObject({
      hash: definition.hash,
      displayProperties: compactObject({ name: definition.displayProperties?.name }),
      children: definition.children
    })]));
  }
  return Object.fromEntries(Object.entries(definitions).map(([hash, definition]) => [
    hash,
    projection === "account-snapshot"
      ? projectAccountSnapshotDefinition(component, definition)
      : projection === "community-match"
        ? projectCommunityMatchDefinition(component, definition)
        : projectDisplaySummaryDefinition(component, definition)
  ]));
}

function isCatalystRecordDefinition(
  component: DefinitionComponentName,
  definition: DefinitionRecord
): boolean {
  if (component !== "DestinyRecordDefinition") return false;
  const type = definition.recordTypeName?.trim().toLocaleLowerCase() ?? "";
  return type.includes("异域催化")
    || type.includes("exotic catalyst");
}

function projectCatalystRecordDefinition(definition: DefinitionRecord): DefinitionRecord {
  return compactObject({
    hash: definition.hash,
    displayProperties: compactObject({
      name: definition.displayProperties?.name,
      description: definition.displayProperties?.description,
      icon: definition.displayProperties?.icon
    }),
    objectiveHashes: definition.objectiveHashes,
    recordTypeName: definition.recordTypeName
  });
}

function projectCommunityMatchDefinition(
  component: DefinitionComponentName,
  definition: DefinitionRecord
): DefinitionRecord {
  if (component === "DestinyPlugSetDefinition") {
    return compactObject({
      hash: definition.hash,
      reusablePlugItems: definition.reusablePlugItems?.map((plug) => compactObject({
        plugItemHash: plug.plugItemHash
      }))
    });
  }
  if (component !== "DestinyInventoryItemDefinition") return definition;
  return compactObject({
    hash: definition.hash,
    displayProperties: compactObject({
      name: definition.displayProperties?.name,
      description: definition.displayProperties?.description,
      icon: definition.displayProperties?.icon
    }),
    itemTypeDisplayName: definition.itemTypeDisplayName,
    itemType: definition.itemType,
    classType: definition.classType,
    inventory: compactObject({ bucketTypeHash: definition.inventory?.bucketTypeHash }),
    equippingBlock: compactObject({
      equipmentSlotTypeHash: definition.equippingBlock?.equipmentSlotTypeHash,
      damageType: definition.equippingBlock?.damageType
    }),
    defaultDamageTypeHash: definition.defaultDamageTypeHash,
    traitIds: definition.traitIds,
    isAdept: definition.isAdept,
    isHolofoil: definition.isHolofoil,
    plug: compactObject({ plugCategoryIdentifier: definition.plug?.plugCategoryIdentifier }),
    sourceData: compactObject({ sourceString: definition.sourceData?.sourceString }),
    sockets: definition.sockets
      ? {
          socketEntries: (definition.sockets.socketEntries ?? []).map((entry) => compactObject({
            hidePerksInItemTooltip: entry.hidePerksInItemTooltip,
            singleInitialItemHash: entry.singleInitialItemHash,
            reusablePlugItems: entry.reusablePlugItems?.map((plug) => compactObject({
              plugItemHash: plug.plugItemHash
            })),
            reusablePlugSetHash: entry.reusablePlugSetHash,
            randomizedPlugSetHash: entry.randomizedPlugSetHash
          }))
        }
      : undefined
  });
}

function projectDisplaySummaryDefinition(
  component: DefinitionComponentName,
  definition: DefinitionRecord
): DefinitionRecord {
  if (component === "DestinyInventoryItemDefinition") {
    return projectInventoryItemSummary(definition);
  }
  if (component === "DestinyVendorDefinition") {
    return compactObject({
      hash: definition.hash,
      vendorIdentifier: definition.vendorIdentifier,
      displayProperties: compactObject({
        name: definition.displayProperties?.name,
        description: definition.displayProperties?.description,
        icon: definition.displayProperties?.icon
      }),
      itemList: Array.isArray(definition.itemList)
        ? definition.itemList.map((item) => compactObject({
            displayCategoryIndex: item.displayCategoryIndex,
            redirectToSaleIndexes: item.redirectToSaleIndexes
          }))
        : undefined,
      displayCategories: Array.isArray(definition.displayCategories)
        ? definition.displayCategories.map((category) => compactObject({
            identifier: category.identifier,
            displayProperties: compactObject({ name: category.displayProperties?.name })
          }))
        : undefined,
      locations: Array.isArray(definition.locations)
        ? definition.locations.map((location) => compactObject({
            destinationHash: location.destinationHash
          }))
        : undefined
    });
  }
  return definition;
}

function projectAccountSnapshotDefinition(
  component: DefinitionComponentName,
  definition: DefinitionRecord
): DefinitionRecord {
  if (component === "DestinyInventoryItemDefinition") {
    return projectInventoryItemSummary(definition);
  }
  if (component === "DestinyInventoryBucketDefinition") {
    return compactObject({
      hash: definition.hash,
      itemCount: definition.itemCount,
      displayProperties: compactObject({ name: definition.displayProperties?.name })
    });
  }
  if (component === "DestinyLoadoutNameDefinition") {
    return compactObject({
      hash: definition.hash,
      name: definition.name,
      displayProperties: compactObject({ name: definition.displayProperties?.name })
    });
  }
  if (component === "DestinyEquipableItemSetDefinition") {
    return compactObject({
      hash: definition.hash,
      displayProperties: compactObject({ name: definition.displayProperties?.name })
    });
  }
  if (component === "DestinyObjectiveDefinition") {
    return compactObject({ hash: definition.hash, progressDescription: definition.progressDescription });
  }
  return definition;
}

function projectInventoryItemSummary(definition: DefinitionRecord): DefinitionRecord {
  return compactObject({
    hash: definition.hash,
    displayProperties: compactObject({
      name: definition.displayProperties?.name,
      icon: definition.displayProperties?.icon
    }),
    itemTypeDisplayName: definition.itemTypeDisplayName,
    traitIds: definition.traitIds,
    itemType: definition.itemType,
    classType: definition.classType,
    inventory: compactObject({
      tierTypeName: definition.inventory?.tierTypeName,
      bucketTypeHash: definition.inventory?.bucketTypeHash,
      suppressExpirationWhenObjectivesComplete: definition.inventory?.suppressExpirationWhenObjectivesComplete,
      expiredInActivityMessage: definition.inventory?.expiredInActivityMessage
    }),
    itemCategoryHashes: definition.itemCategoryHashes,
    value: definition.value?.itemValue
      ? compactObject({
          itemValue: definition.value.itemValue.map((reward) => compactObject({
            itemHash: reward.itemHash,
            quantity: reward.quantity
          }))
        })
      : undefined,
    objectives: definition.objectives
      ? compactObject({ questlineItemHash: definition.objectives.questlineItemHash })
      : undefined,
    setData: definition.setData
      ? compactObject({
          questLineName: definition.setData.questLineName,
          itemList: definition.setData.itemList?.map((item) => compactObject({ itemHash: item.itemHash }))
        })
      : undefined,
    equippingBlock: compactObject({
      ammoType: definition.equippingBlock?.ammoType,
      equipableItemSetHash: definition.equippingBlock?.equipableItemSetHash
    }),
    plug: compactObject({ plugCategoryIdentifier: definition.plug?.plugCategoryIdentifier }),
    preview: definition.preview
      ? compactObject({ previewVendorHash: definition.preview.previewVendorHash })
      : undefined
  });
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && (
      typeof entry !== "object"
      || entry === null
      || Array.isArray(entry)
      || Object.keys(entry).length > 0
    ))
  ) as T;
}

function ensureRuntime(): OpenRuntime {
  const config = loadConfig();
  const language = config.data.manifest_language;
  const activation = loadActiveSqliteManifest(config.data.data_dir, language);
  if (!activation) {
    closeRuntime();
    throw new Error("SQLite 资料库尚未就绪，请先更新资料库");
  }
  const key = [
    config.data.data_dir,
    language,
    activation.manifestVersion,
    activation.activatedAt
  ].join("\u0000");
  if (runtime?.key === key) {
    return runtime;
  }

  closeRuntime();
  const sqliteReader = createSqliteDefinitionReader({
    databasePath: activation.databasePath,
    batchSize: 128,
    cacheSize: 384
  });
  const reader = activation.supplementDataDir && activation.supplementComponents.length
    ? createCompositeDefinitionReader(
        sqliteReader,
        createJsonDefinitionReader({
          getDataDir: () => activation.supplementDataDir!,
          language
        })
      )
    : sqliteReader;
  try {
    const catalog = createSqliteGameDataCatalog({
      databasePath: activation.databasePath,
      searchIndexPath: activation.searchIndexPath,
      cacheSize: 2_000,
      secondarySearchIndexPaths: activation.englishSearchIndexPath
        ? [activation.englishSearchIndexPath]
        : [],
      manifestVersion: activation.manifestVersion,
      language,
      ...(activation.supplementDataDir && activation.supplementComponents.length
        ? {
            jsonSupplement: {
              getDataDir: () => activation.supplementDataDir!,
              language
            }
          }
        : {})
    });
    runtime = { key, activation, catalog, reader };
    return runtime;
  } catch (error) {
    reader.close();
    throw error;
  }
}

function closeRuntime(): void {
  const current = runtime;
  runtime = null;
  if (!current) {
    return;
  }
  try {
    current.catalog.close();
  } finally {
    current.reader.close();
  }
}
