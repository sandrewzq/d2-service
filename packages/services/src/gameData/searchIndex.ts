import type { WeaponIdentityRelation } from "@d2-tools/core/community-perks";

export type GameDataSearchKind = "item" | "perk";

export type GameDataSearchIndex = {
  search(kind: GameDataSearchKind, terms: Iterable<string>, limit: number): number[];
  getItemVersionHashes(itemHashes: Iterable<number>, limit: number): number[];
  getWeaponIdentityRelations(itemHashes: Iterable<number>): WeaponIdentityRelation[];
  getRelatedItemSummary(perkHashes: Iterable<number>): { total: number; hashes: number[] };
  getRelatedItemPage(perkHashes: Iterable<number>, offset: number, limit: number): {
    total: number;
    items: Array<{ hash: number; perk_hashes: number[] }>;
  };
  getPlugHashes(perkHashes: Iterable<number>): number[];
  getEnumHashes(kind: "breaker" | "damage", enumValues: Iterable<number>): number[];
  close(): void;
};

export type GameDataSearchIndexBuildResult = {
  itemCount: number;
  perkCount: number;
  relationCount: number;
};
