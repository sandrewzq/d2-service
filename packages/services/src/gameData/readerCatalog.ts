import { expandAliasQuery } from "@d2-tools/core/items/aliases";
import {
  classifyPerkVariantKind,
  collectRelatedGroups,
  projectPerkSearchResults,
  type PerkVariantKind
} from "@d2-tools/core/items/perkSearch";
import {
  getItemSearchResultByHash,
  selectCanonicalEquipmentDefinitions,
  type ItemSearchResult
} from "@d2-tools/core/items/search";
import { classifyBucket } from "@d2-tools/core/items/classification";
import type {
  DefinitionComponentData,
  DefinitionRecord
} from "@d2-tools/core/manifest/definitions";
import { getGameDataRuntimeCapabilities, type GameDataCatalog } from "./catalog.js";
import type { DefinitionReader } from "./definitionReader.js";
import { toUnsignedHash } from "./definitionReader.js";
import type { GameDataSearchIndex } from "./searchIndex.js";

export type ReaderGameDataCatalogOptions = {
  reader: DefinitionReader;
  searchIndex: GameDataSearchIndex;
};

export type ManagedGameDataCatalog = GameDataCatalog & {
  close(): void;
};

export function createReaderGameDataCatalog(
  options: ReaderGameDataCatalogOptions
): ManagedGameDataCatalog {
  return {
    async getRuntimeCapabilities() {
      return getGameDataRuntimeCapabilities();
    },

    async searchItems(input) {
      const terms = input.aliases
        ? expandAliasQuery(input.query, input.aliases)
        : [input.query.trim()];
      const limit = input.limit ?? 20;
      const matchedHashes = options.searchIndex.search(
        "item",
        terms,
        Math.max(limit * 4, 40)
      );
      const candidateHashes = options.searchIndex.getItemVersionHashes(
        matchedHashes,
        Math.max(limit * 4, 40)
      );
      const candidates = options.reader.getMany(
        "DestinyInventoryItemDefinition",
        candidateHashes
      );
      const context = hydrateItemContext(
        options.reader,
        options.searchIndex,
        Object.values(candidates)
      );
      const canonicalHashes = selectCanonicalEquipmentDefinitions(Object.values(candidates))
        .map((definition) => Number(definition.hash))
        .filter((hash) => Number.isFinite(hash));
      const results = canonicalHashes
        .map((hash) => getItemSearchResultByHash(context.items, hash, {
          plugSetDefinitions: context.plugSets,
          statDefinitions: context.stats,
          collectibleDefinitions: context.collectibles,
          breakerTypeDefinitions: context.breakerTypes,
          damageTypeDefinitions: context.damageTypes,
          seasonDefinitions: context.seasons,
          equipableItemSetDefinitions: context.equipableItemSets,
          sandboxPerkDefinitions: context.sandboxPerks
        }))
        .filter((result): result is ItemSearchResult => Boolean(result));

      return results.slice(0, limit);
    },

    async searchPerks(input) {
      const terms = input.aliases
        ? expandAliasQuery(input.query, input.aliases)
        : [input.query.trim()];
      const limit = input.limit ?? 20;
      const perkHashes = options.searchIndex.search(
        "perk",
        terms,
        Math.max(limit * 8, 80)
      );
      const perkDefinitions = options.reader.getMany(
        "DestinySandboxPerkDefinition",
        perkHashes
      );
      const perkIconDefinitions = options.reader.getMany(
        "DestinyInventoryItemDefinition",
        options.searchIndex.getPlugHashes(perkHashes)
      );
      const results = projectPerkSearchResults(perkHashes, perkDefinitions, {
        limit,
        perkIconDefinitions
      });
      return results.map((result) => {
        const summary = options.searchIndex.getRelatedItemSummary(result.hashes);
        const relatedDefinitions = options.reader.getMany(
          "DestinyInventoryItemDefinition",
          summary.hashes
        );
        return {
          ...result,
          variants: result.variants.map((variant) => ({
            ...variant,
            related_count: options.searchIndex
              .getRelatedItemSummary([variant.sandbox_perk_hash])
              .total
          })),
          related_count: summary.total,
          related_groups: collectRelatedGroups(Object.values(relatedDefinitions))
        };
      });
    },

    async getPerkRelatedEquipment(input) {
      const offset = Math.max(0, Math.trunc(input.offset ?? 0));
      const limit = Math.max(1, Math.min(Math.trunc(input.limit ?? 20), 100));
      const page = options.searchIndex.getRelatedItemPage(input.perk_hashes, offset, limit);
      const definitions = options.reader.getMany(
        "DestinyInventoryItemDefinition",
        page.items.map((entry) => entry.hash)
      );
      const context = hydrateItemContext(
        options.reader,
        options.searchIndex,
        Object.values(definitions)
      );
      const perkPlugDefinitions = options.reader.getMany(
        "DestinyInventoryItemDefinition",
        options.searchIndex.getPlugHashes(input.perk_hashes)
      );
      const variantKinds = new Map(input.perk_hashes.map((perkHash) => [
        Number(perkHash) >>> 0,
        classifyPerkVariantKind(perkHash, perkPlugDefinitions)
      ]));
      const items = page.items
        .map((entry) => {
          const item = getItemSearchResultByHash(context.items, entry.hash, {
            plugSetDefinitions: context.plugSets,
            statDefinitions: context.stats,
            collectibleDefinitions: context.collectibles,
            breakerTypeDefinitions: context.breakerTypes,
            damageTypeDefinitions: context.damageTypes,
            seasonDefinitions: context.seasons,
            equipableItemSetDefinitions: context.equipableItemSets,
            sandboxPerkDefinitions: context.sandboxPerks
          });
          if (!item) return null;
          return {
            item,
            matched_perk_hashes: entry.perk_hashes,
            matched_variants: uniqueVariantKinds(entry.perk_hashes.map((hash) => (
              variantKinds.get(hash) ?? "other"
            )))
          };
        })
        .filter((result): result is NonNullable<typeof result> => Boolean(result));

      return {
        total: page.total,
        items,
        offset,
        has_more: offset + page.items.length < page.total
      };
    },

    async getItemDetail(input) {
      const requestedDefinition = options.reader.get("DestinyInventoryItemDefinition", input.hash);
      if (!requestedDefinition) {
        return null;
      }
      const definition = resolveItemDetailDefinition(options.reader, requestedDefinition);
      const context = hydrateItemContext(options.reader, options.searchIndex, [definition]);
      return getItemSearchResultByHash(context.items, Number(definition.hash), {
        plugSetDefinitions: context.plugSets,
        statDefinitions: context.stats,
        collectibleDefinitions: context.collectibles,
        breakerTypeDefinitions: context.breakerTypes,
        damageTypeDefinitions: context.damageTypes,
        seasonDefinitions: context.seasons,
        equipableItemSetDefinitions: context.equipableItemSets,
        sandboxPerkDefinitions: context.sandboxPerks,
        includeAllPerks: true
      });
    },

    async getWeaponIdentityRelations(input) {
      return options.searchIndex.getWeaponIdentityRelations(input.item_hashes);
    },

    close() {
      try {
        options.searchIndex.close();
      } finally {
        options.reader.close();
      }
    }
  };
}

function resolveItemDetailDefinition(
  reader: DefinitionReader,
  definition: DefinitionRecord
): DefinitionRecord {
  if (classifyBucket(definition.inventory?.bucketTypeHash)?.group === "weapons") {
    return definition;
  }

  const patternHash = Number(definition.translationBlock?.weaponPatternHash);
  const definitionHash = toUnsignedHash(Number(definition.hash));
  if (!Number.isFinite(patternHash) || patternHash <= 0 || toUnsignedHash(patternHash) === definitionHash) {
    return definition;
  }

  const canonicalDefinition = reader.get("DestinyInventoryItemDefinition", patternHash);
  return canonicalDefinition
    && classifyBucket(canonicalDefinition.inventory?.bucketTypeHash)?.group === "weapons"
    ? canonicalDefinition
    : definition;
}

function uniqueVariantKinds(kinds: PerkVariantKind[]): PerkVariantKind[] {
  const order: Record<PerkVariantKind, number> = { standard: 0, enhanced: 1, other: 2 };
  return [...new Set(kinds)].sort((left, right) => order[left] - order[right]);
}

type ItemDefinitionContext = {
  items: DefinitionComponentData;
  plugSets: DefinitionComponentData;
  stats: DefinitionComponentData;
  collectibles: DefinitionComponentData;
  breakerTypes: DefinitionComponentData;
  damageTypes: DefinitionComponentData;
  seasons: DefinitionComponentData;
  equipableItemSets: DefinitionComponentData;
  sandboxPerks: DefinitionComponentData;
};

function hydrateItemContext(
  reader: DefinitionReader,
  searchIndex: GameDataSearchIndex,
  roots: DefinitionRecord[]
): ItemDefinitionContext {
  const linkedItemHashes = roots.flatMap(collectLinkedItemHashes);
  const linkedItems = reader.getMany("DestinyInventoryItemDefinition", linkedItemHashes);
  const itemSeeds = [...roots, ...Object.values(linkedItems)];
  const plugSets = reader.getMany(
    "DestinyPlugSetDefinition",
    collectPlugSetHashes(itemSeeds)
  );
  const plugHashes = uniqueNumbers([
    ...itemSeeds.flatMap(collectDirectPlugHashes),
    ...Object.values(plugSets).flatMap((definition) => (
      (definition.reusablePlugItems ?? [])
        .map((item) => item.plugItemHash)
        .filter((hash): hash is number => typeof hash === "number")
    ))
  ]);
  const plugs = reader.getMany("DestinyInventoryItemDefinition", plugHashes);
  const allItems = definitionData([...roots, ...Object.values(linkedItems), ...Object.values(plugs)]);
  const relevantRecords = Object.values(allItems);

  const equipableItemSets = reader.getMany(
    "DestinyEquipableItemSetDefinition",
    relevantRecords
      .map((definition) => definition.equippingBlock?.equipableItemSetHash)
      .filter((hash): hash is number => typeof hash === "number")
  );

  return {
    items: allItems,
    plugSets,
    stats: reader.getMany("DestinyStatDefinition", collectStatHashes(roots)),
    collectibles: reader.getMany(
      "DestinyCollectibleDefinition",
      relevantRecords
        .map((definition) => definition.collectibleHash)
        .filter((hash): hash is number => typeof hash === "number")
    ),
    breakerTypes: reader.getMany(
      "DestinyBreakerTypeDefinition",
      [
        // Some intrinsic Perks encode champion effects by Perk hash, so their
        // owning item has no breaker enum to index directly.
        ...searchIndex.getEnumHashes("breaker", [1, 2, 3]),
        ...relevantRecords
          .map((definition) => definition.breakerTypeHash)
          .filter((hash): hash is number => typeof hash === "number"),
        ...searchIndex.getEnumHashes(
          "breaker",
          relevantRecords
            .map((definition) => definition.breakerType)
            .filter((value): value is number => typeof value === "number")
        )
      ]
    ),
    damageTypes: reader.getMany(
      "DestinyDamageTypeDefinition",
      [
        ...relevantRecords.flatMap((definition) => [
          ...(typeof definition.defaultDamageTypeHash === "number"
            ? [definition.defaultDamageTypeHash]
            : []),
          ...(definition.damageTypeHashes ?? [])
        ]),
        ...searchIndex.getEnumHashes(
          "damage",
          relevantRecords.flatMap((definition) => [
            ...(typeof definition.defaultDamageType === "number"
              ? [definition.defaultDamageType]
              : []),
            ...(typeof definition.equippingBlock?.damageType === "number"
              ? [definition.equippingBlock.damageType]
              : [])
          ])
        )
      ]
    ),
    seasons: reader.getMany(
      "DestinySeasonDefinition",
      relevantRecords
        .map((definition) => definition.seasonHash)
        .filter((hash): hash is number => typeof hash === "number")
    ),
    equipableItemSets,
    sandboxPerks: reader.getMany(
      "DestinySandboxPerkDefinition",
      Object.values(equipableItemSets).flatMap((set) => (
        (set.setPerks ?? [])
          .map((bonus) => bonus.sandboxPerkHash)
          .filter((hash): hash is number => typeof hash === "number")
      ))
    )
  };
}

function definitionData(records: DefinitionRecord[]): DefinitionComponentData {
  return Object.fromEntries(
    records
      .map((record) => [String(toUnsignedHash(Number(record.hash))), record] as const)
      .filter(([hash]) => hash !== "0")
  );
}

function collectPlugSetHashes(definitions: DefinitionRecord[]): number[] {
  return uniqueNumbers(definitions.flatMap((definition) => (
    (definition.sockets?.socketEntries ?? []).flatMap((entry) => [
      ...(typeof entry.reusablePlugSetHash === "number" ? [entry.reusablePlugSetHash] : []),
      ...(typeof entry.randomizedPlugSetHash === "number" ? [entry.randomizedPlugSetHash] : [])
    ])
  )));
}

function collectDirectPlugHashes(definition: DefinitionRecord): number[] {
  return uniqueNumbers((definition.sockets?.socketEntries ?? []).flatMap((entry) => [
    ...(typeof entry.singleInitialItemHash === "number" ? [entry.singleInitialItemHash] : []),
    ...(entry.reusablePlugItems ?? [])
      .map((item) => item.plugItemHash)
      .filter((hash): hash is number => typeof hash === "number")
  ]));
}

function collectLinkedItemHashes(definition: DefinitionRecord): number[] {
  return uniqueNumbers([
    ...(typeof definition.translationBlock?.artArrangementHash === "number"
      ? [definition.translationBlock.artArrangementHash]
      : []),
    ...(definition.translationBlock?.arrangements ?? [])
      .map((arrangement) => arrangement.artArrangementHash)
      .filter((hash): hash is number => typeof hash === "number")
  ]).filter((hash) => hash !== toUnsignedHash(Number(definition.hash)));
}

function collectStatHashes(definitions: DefinitionRecord[]): number[] {
  return uniqueNumbers(definitions.flatMap((definition) => (
    Object.entries(definition.stats?.stats ?? {}).map(([key, stat]) => (
      Number(stat.statHash ?? key)
    ))
  )));
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(
    values
      .map(toUnsignedHash)
      .filter((hash) => hash > 0)
  )];
}
