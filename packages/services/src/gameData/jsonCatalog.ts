import {
  classifyPerkVariantKind,
  findRelatedEquipmentDefinitions,
  searchPerkDefinitions
} from "@d2-tools/core/items/perkSearch";
import {
  getItemSearchResultByHash,
  searchItemDefinitions,
  type ItemSearchResult
} from "@d2-tools/core/items/search";
import type { DefinitionComponentName } from "@d2-tools/core/manifest/definitions";
import { loadDefinitionComponent } from "../manifest/definitions.js";
import { getGameDataRuntimeCapabilities, type GameDataCatalog } from "./catalog.js";
import { buildWeaponIdentityRelations, relatedWeaponIdentityRelations } from "./weaponIdentity.js";

export type JsonGameDataCatalogOptions = {
  getDataDir: () => string;
};

export function createJsonGameDataCatalog(options: JsonGameDataCatalogOptions): GameDataCatalog {
  const load = (component: DefinitionComponentName) => (
    loadDefinitionComponent(options.getDataDir(), component)
  );

  return {
    async getRuntimeCapabilities() {
      return getGameDataRuntimeCapabilities();
    },

    async searchItems(input) {
      const definitions = load("DestinyInventoryItemDefinition");
      if (!definitions) {
        throw new Error("请先初始化资料库");
      }

      return searchItemDefinitions(definitions, input.query, {
        limit: input.limit ?? 20,
        plugSetDefinitions: load("DestinyPlugSetDefinition") ?? undefined,
        statDefinitions: load("DestinyStatDefinition") ?? undefined,
        collectibleDefinitions: load("DestinyCollectibleDefinition") ?? undefined,
        breakerTypeDefinitions: load("DestinyBreakerTypeDefinition") ?? undefined,
        damageTypeDefinitions: load("DestinyDamageTypeDefinition") ?? undefined,
        seasonDefinitions: load("DestinySeasonDefinition") ?? undefined,
        equipableItemSetDefinitions: load("DestinyEquipableItemSetDefinition") ?? undefined,
        sandboxPerkDefinitions: load("DestinySandboxPerkDefinition") ?? undefined,
        aliases: input.aliases
      });
    },

    async searchPerks(input) {
      const perkDefinitions = load("DestinySandboxPerkDefinition");
      if (!perkDefinitions) {
        throw new Error("请先初始化资料库");
      }

      return searchPerkDefinitions(perkDefinitions, input.query, {
        limit: input.limit ?? 20,
        itemDefinitions: load("DestinyInventoryItemDefinition") ?? undefined,
        plugSetDefinitions: load("DestinyPlugSetDefinition") ?? undefined,
        aliases: input.aliases
      });
    },

    async getPerkRelatedEquipment(input) {
      const definitions = load("DestinyInventoryItemDefinition");
      if (!definitions) {
        throw new Error("请先初始化资料库");
      }
      const plugSetDefinitions = load("DestinyPlugSetDefinition") ?? undefined;
      const relatedDefinitions = findRelatedEquipmentDefinitions(
        input.perk_hashes,
        definitions,
        plugSetDefinitions
      );
      const offset = Math.max(0, Math.trunc(input.offset ?? 0));
      const limit = Math.max(1, Math.min(Math.trunc(input.limit ?? 20), 100));
      const pageDefinitions = relatedDefinitions.slice(offset, offset + limit);
      const relatedHashesByPerk = new Map(input.perk_hashes.map((perkHash) => [
        perkHash,
        new Set(findRelatedEquipmentDefinitions([perkHash], definitions, plugSetDefinitions)
          .map((definition) => Number(definition.hash) >>> 0))
      ]));
      const variantKinds = new Map(input.perk_hashes.map((perkHash) => [
        perkHash,
        classifyPerkVariantKind(perkHash, definitions)
      ]));
      const itemOptions = {
        plugSetDefinitions,
        statDefinitions: load("DestinyStatDefinition") ?? undefined,
        collectibleDefinitions: load("DestinyCollectibleDefinition") ?? undefined,
        breakerTypeDefinitions: load("DestinyBreakerTypeDefinition") ?? undefined,
        damageTypeDefinitions: load("DestinyDamageTypeDefinition") ?? undefined,
        seasonDefinitions: load("DestinySeasonDefinition") ?? undefined,
        equipableItemSetDefinitions: load("DestinyEquipableItemSetDefinition") ?? undefined,
        sandboxPerkDefinitions: load("DestinySandboxPerkDefinition") ?? undefined
      };
      return {
        total: relatedDefinitions.length,
        items: pageDefinitions.flatMap((definition) => {
          const item = getItemSearchResultByHash(definitions, Number(definition.hash), itemOptions);
          if (!item) return [];
          const matchedPerkHashes = input.perk_hashes.filter((perkHash) => (
            relatedHashesByPerk.get(perkHash)?.has(item.hash)
          ));
          return [{
            item,
            matched_perk_hashes: matchedPerkHashes,
            matched_variants: [...new Set(matchedPerkHashes.map((perkHash) => (
              variantKinds.get(perkHash) ?? "other"
            )))]
          }];
        }),
        offset,
        has_more: offset + pageDefinitions.length < relatedDefinitions.length
      };
    },

    async getItemDetail(input) {
      const definitions = load("DestinyInventoryItemDefinition");
      if (!definitions) {
        throw new Error("请先初始化资料库");
      }

      return getItemSearchResultByHash(definitions, Number(input.hash), {
        plugSetDefinitions: load("DestinyPlugSetDefinition") ?? undefined,
        statDefinitions: load("DestinyStatDefinition") ?? undefined,
        collectibleDefinitions: load("DestinyCollectibleDefinition") ?? undefined,
        breakerTypeDefinitions: load("DestinyBreakerTypeDefinition") ?? undefined,
        damageTypeDefinitions: load("DestinyDamageTypeDefinition") ?? undefined,
        seasonDefinitions: load("DestinySeasonDefinition") ?? undefined,
        equipableItemSetDefinitions: load("DestinyEquipableItemSetDefinition") ?? undefined,
        sandboxPerkDefinitions: load("DestinySandboxPerkDefinition") ?? undefined,
        includeAllPerks: true
      });
    },

    async getWeaponIdentityRelations(input) {
      const definitions = load("DestinyInventoryItemDefinition");
      if (!definitions) throw new Error("请先初始化资料库");
      return relatedWeaponIdentityRelations(
        buildWeaponIdentityRelations(Object.values(definitions)),
        input.item_hashes
      );
    }
  };
}
