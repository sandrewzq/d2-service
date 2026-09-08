import { expandAliasQuery } from "@d2-tools/core/items/aliases";
import type { PerkSearchResult, PerkVariantKind } from "@d2-tools/core/items/perkSearch";
import type { ItemSearchResult } from "@d2-tools/core/items/search";
import type { WeaponIdentityRelation } from "@d2-tools/core/community-perks";
import { relatedWeaponIdentityRelations } from "./weaponIdentity.js";
import { getGameDataRuntimeCapabilities, type GameDataCatalog, type ItemSearchQuery, type PerkSearchQuery } from "./catalog.js";

export type MemoryGameDataCatalogSeed = {
  items?: ItemSearchResult[];
  perks?: PerkSearchResult[];
  perkRelatedEquipment?: Record<string, ItemSearchResult[]>;
  itemDetails?: Record<string, ItemSearchResult>;
  weaponIdentityRelations?: WeaponIdentityRelation[];
};

export function createMemoryGameDataCatalog(seed: MemoryGameDataCatalogSeed = {}): GameDataCatalog {
  const items = seed.items ?? [];
  const perks = seed.perks ?? [];

  return {
    async getRuntimeCapabilities() {
      return getGameDataRuntimeCapabilities();
    },

    async searchItems(input) {
      return filterSearchResults(items, input, (item) => `${item.name}\n${item.description}`);
    },

    async searchPerks(input) {
      return filterSearchResults(perks, input, (perk) => `${perk.name}\n${perk.description}`);
    },

    async getPerkRelatedEquipment(input) {
      const relatedItems = collectRelatedItems(input.perk_hashes, seed);
      const offset = Math.max(0, Math.trunc(input.offset ?? 0));
      const limit = Math.max(1, Math.min(Math.trunc(input.limit ?? 20), 100));
      return {
        total: relatedItems.length,
        items: relatedItems.slice(offset, offset + limit),
        offset,
        has_more: offset + limit < relatedItems.length
      };
    },

    async getItemDetail(input) {
      return seed.itemDetails?.[String(input.hash)]
        ?? items.find((item) => item.hash === input.hash)
        ?? null;
    },

    async getWeaponIdentityRelations(input) {
      return relatedWeaponIdentityRelations(seed.weaponIdentityRelations ?? [], input.item_hashes);
    }
  };
}

function collectRelatedItems(
  perkHashes: number[],
  seed: MemoryGameDataCatalogSeed
): Array<{ item: ItemSearchResult; matched_perk_hashes: number[]; matched_variants: PerkVariantKind[] }> {
  const variantKinds = new Map<number, PerkVariantKind>();
  for (const perk of seed.perks ?? []) {
    for (const variant of perk.variants) {
      variantKinds.set(variant.sandbox_perk_hash, variant.kind);
    }
  }
  const related = new Map<number, { item: ItemSearchResult; matched_perk_hashes: Set<number> }>();
  for (const perkHash of perkHashes) {
    for (const item of seed.perkRelatedEquipment?.[String(perkHash)] ?? []) {
      const current = related.get(item.hash) ?? { item, matched_perk_hashes: new Set<number>() };
      current.matched_perk_hashes.add(perkHash);
      related.set(item.hash, current);
    }
  }
  return [...related.values()].map((entry) => ({
    item: entry.item,
    matched_perk_hashes: [...entry.matched_perk_hashes].sort((left, right) => left - right),
    matched_variants: [...new Set([...entry.matched_perk_hashes].map((hash) => variantKinds.get(hash) ?? "other"))]
  }));
}

function filterSearchResults<TResult>(
  results: TResult[],
  input: ItemSearchQuery | PerkSearchQuery,
  searchableText: (result: TResult) => string
): TResult[] {
  const terms = input.aliases ? expandAliasQuery(input.query, input.aliases) : [input.query.trim()];
  const normalizedTerms = terms.map((term) => term.toLocaleLowerCase()).filter(Boolean);
  if (!normalizedTerms.length) {
    return [];
  }

  return results
    .filter((result) => {
      const text = searchableText(result).toLocaleLowerCase();
      return normalizedTerms.some((term) => text.includes(term));
    })
    .slice(0, input.limit ?? 20);
}
