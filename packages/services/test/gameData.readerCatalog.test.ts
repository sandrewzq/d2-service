import { describe, expect, it } from "vitest";
import { createMemoryDefinitionReader } from "../src/gameData/memoryDefinitionReader";
import { createReaderGameDataCatalog } from "../src/gameData/readerCatalog";
import type { GameDataSearchIndex, GameDataSearchKind } from "../src/gameData/searchIndex";

describe("reader game data catalog", () => {
  it("expands same-name item versions through the search index relation", async () => {
    const catalog = createReaderGameDataCatalog({
      reader: createMemoryDefinitionReader({
        DestinyInventoryItemDefinition: {
          101: itemDefinition(101, "releases.unknown-1"),
          102: itemDefinition(102, "releases.unknown-2")
        }
      }),
      searchIndex: {
        search() {
          return [101];
        },
        getItemVersionHashes(itemHashes, limit) {
          expect([...itemHashes]).toEqual([101]);
          return [101, 102].slice(0, limit);
        },
        getRelatedItemSummary() {
          return { total: 0, hashes: [] };
        },
        getRelatedItemPage() {
          return { total: 0, items: [] };
        },
        getPlugHashes() {
          return [];
        },
        getEnumHashes() {
          return [];
        },
        close() {}
      }
    });

    const results = await catalog.searchItems({ query: "同名武器", limit: 10 });

    expect(results.map((result) => result.hash)).toEqual([101, 102]);
    catalog.close();
  });

  it("projects localized perk definitions from English sidecar candidates", async () => {
    const searches: Array<{ kind: GameDataSearchKind; terms: string[]; limit: number }> = [];
    const searchIndex = createSearchIndex(searches);
    const catalog = createReaderGameDataCatalog({
      reader: createMemoryDefinitionReader({
        DestinySandboxPerkDefinition: {
          101: perkDefinition(101, "击杀弹匣", "击杀后换弹可提高伤害。"),
          102: perkDefinition(102, "狂暴", "击杀可暂时提高伤害。")
        },
        DestinyInventoryItemDefinition: {
          201: {
            hash: 201,
            displayProperties: { name: "击杀弹匣插件" },
            perks: [{ perkHash: 101 }]
          },
          301: {
            hash: 301,
            displayProperties: { name: "测试手炮" },
            sockets: {
              socketEntries: [{ reusablePlugItems: [{ plugItemHash: 201 }] }]
            }
          }
        }
      }),
      searchIndex
    });

    const englishResults = await catalog.searchPerks({ query: "Kill Clip", limit: 1 });
    const aliasResults = await catalog.searchPerks({
      query: "kc",
      aliases: {
        entries: [{ alias: "kc", target: "Kill Clip", kind: "perk" }]
      }
    });
    const chineseResults = await catalog.searchPerks({ query: "击杀弹匣" });

    expect(englishResults).toEqual([{
      key: "perk:101",
      hash: 101,
      hashes: [101],
      name: "击杀弹匣",
      description: "击杀后换弹可提高伤害。",
      variants: [{
        sandbox_perk_hash: 101,
        plug_hashes: [201],
        kind: "other",
        description: "击杀后换弹可提高伤害。",
        related_count: 1
      }],
      related_count: 1,
      related_groups: []
    }]);
    expect(aliasResults.map((result) => result.hash)).toEqual([101, 102]);
    expect(chineseResults.map((result) => result.hash)).toEqual([101]);
    expect(searches).toEqual([
      { kind: "perk", terms: ["Kill Clip"], limit: 80 },
      { kind: "perk", terms: ["kc", "Kill Clip"], limit: 160 },
      { kind: "perk", terms: ["击杀弹匣"], limit: 160 }
    ]);

    catalog.close();
  });
});

function createSearchIndex(
  searches: Array<{ kind: GameDataSearchKind; terms: string[]; limit: number }>
): GameDataSearchIndex {
  return {
    search(kind, terms, limit) {
      const termList = [...terms];
      searches.push({ kind, terms: termList, limit });
      if (termList.includes("Kill Clip") || termList.includes("kc")) {
        return [101, 102].slice(0, limit);
      }
      if (termList.includes("击杀弹匣")) {
        return [101].slice(0, limit);
      }
      return [];
    },
    getItemVersionHashes(itemHashes, limit) {
      return [...itemHashes].slice(0, limit);
    },
    getWeaponIdentityRelations() {
      return [];
    },
    getRelatedItemSummary(perkHashes) {
      const hashes = [...perkHashes].includes(101) ? [301] : [];
      return { total: hashes.length, hashes };
    },
    getRelatedItemPage(perkHashes, offset, limit) {
      const hashes = [...perkHashes].includes(101) ? [301] : [];
      return {
        total: hashes.length,
        items: hashes.slice(offset, offset + limit).map((hash) => ({ hash, perk_hashes: [101] }))
      };
    },
    getPlugHashes(perkHashes) {
      return [...perkHashes].includes(101) ? [201] : [];
    },
    getEnumHashes() {
      return [];
    },
    close() {}
  };
}

function perkDefinition(hash: number, name: string, description: string) {
  return {
    hash,
    displayProperties: { name, description }
  };
}

function itemDefinition(hash: number, releaseTrait: string) {
  return {
    hash,
    itemType: 3,
    classType: 3,
    traitIds: [releaseTrait],
    translationBlock: { weaponPatternHash: 9001 },
    displayProperties: {
      name: "同名武器",
      description: releaseTrait,
      icon: "/same.png"
    },
    inventory: { bucketTypeHash: 1498876634 }
  };
}
