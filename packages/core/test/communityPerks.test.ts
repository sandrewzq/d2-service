import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { saveDimWishlist } from "../../services/src/analysis/wishlistStore.js";
import { saveLocalCommunityRecommendations } from "../../services/src/community/localCommunityRecommendations.js";
import { parseLocalCommunityRecommendations } from "../src/community-perks/localCommunityImport.js";
import { CommunityPerkRecommendationService } from "../src/community-perks/index.js";
import {
  createDefaultCommunityPerkService,
  createDimWishlistSource
} from "../../services/src/community/perkRecommendation.js";
import type { CommunityPerkSource, WeaponRecommendation } from "../src/community-perks/index.js";
import type { DefinitionComponentData } from "../src/manifest/definitions.js";

const itemDefinitions: DefinitionComponentData = {
  "11": {
    hash: 11,
    displayProperties: {
      name: "电流激荡",
      description: "中文 perk"
    }
  },
  "22": {
    hash: 22,
    displayProperties: {
      name: "快速连发",
      description: "中文 perk"
    }
  },
  "123": {
    hash: 123,
    displayProperties: {
      name: "测试武器",
      description: "test weapon"
    },
    sockets: {
      socketEntries: [
        {
          reusablePlugItems: [{ plugItemHash: 11 }, { plugItemHash: 22 }]
        }
      ]
    }
  }
};
const englishItemDefinitions: DefinitionComponentData = {
  "11": {
    hash: 11,
    displayProperties: {
      name: "Voltshot",
      description: "english perk"
    }
  },
  "22": {
    hash: 22,
    displayProperties: {
      name: "Rapid Hit",
      description: "english perk"
    }
  }
};

describe("community perk recommendations", () => {
  it("returns recommendations from a local DIM wishlist", async () => {
    const dir = mkdtempSync(join(tmpdir(), "d2-tools-community-"));
    saveDimWishlist(dir, {
      title: "Test Picks",
      rules: [
        { item_hash: 123, perk_hashes: [11, 22], mode: "pve", note: "PVE clear" },
        { item_hash: 123, perk_hashes: [11, 33], mode: "pvp", note: "" },
        { item_hash: 456, perk_hashes: [44], mode: "general", note: "" }
      ]
    });

    const service = createDefaultCommunityPerkService({ data: { data_dir: dir } });
    const result = await service.getRecommendations(123, { item_name: "Test Weapon" });

    expect(result).not.toBeNull();
    expect(result?.item_hash).toBe(123);
    expect(result?.item_name).toBe("Test Weapon");
    expect(result?.combos).toHaveLength(2);
    expect(result?.combos[0].mode).toBe("pve");
    expect(result?.combos[1].mode).toBe("pvp");
    expect(result?.combos[0].source).toBe("dim_wishlist");
    expect(result?.combos[0].note).toBe("PVE clear");
    expect(result?.matched_modes).toContain("pve");
    expect(result?.matched_modes).toContain("pvp");
    expect(result?.source_label).toBe("DIM Wishlist");
    expect(result?.sample_size).toBe(2);
    expect(result?.individual_perks?.map((perk) => perk.hash)).toEqual([11, 22, 33]);
  });

  it("returns recommendations from a local community table", async () => {
    const dir = mkdtempSync(join(tmpdir(), "d2-tools-community-"));
    saveLocalCommunityRecommendations(dir, {
      title: "中文社区表",
      rules: [
        {
          item_hash: 123,
          perk_hashes: [11, 22],
          mode: "pve",
          note: "手动导入的清怪组合",
          source_label: "本地社区表"
        }
      ]
    });

    const service = createDefaultCommunityPerkService({ data: { data_dir: dir } });
    const result = await service.getRecommendations(123, { item_name: "Test Weapon" });

    expect(result?.source_label).toBe("本地社区表");
    expect(result?.combos[0].source).toBe("local_community");
    expect(result?.combos[0].note).toBe("手动导入的清怪组合");
    expect(result?.individual_perks?.map((perk) => perk.hash)).toEqual([11, 22]);
    expect(result?.disclaimer).toContain("中文社区表");
  });

  it("returns null when no wishlist exists", async () => {
    const dir = mkdtempSync(join(tmpdir(), "d2-tools-community-"));
    const service = createDefaultCommunityPerkService({ data: { data_dir: dir } });
    const result = await service.getRecommendations(123, {});
    expect(result).toBeNull();
  });

  it("returns null when no rules match the requested item", async () => {
    const dir = mkdtempSync(join(tmpdir(), "d2-tools-community-"));
    saveDimWishlist(dir, {
      title: "Test Picks",
      rules: [{ item_hash: 999, perk_hashes: [11], mode: "general", note: "" }]
    });

    const service = createDefaultCommunityPerkService({ data: { data_dir: dir } });
    const result = await service.getRecommendations(123, {});
    expect(result).toBeNull();
  });

  it("matches vault items against community combos", async () => {
    const dir = mkdtempSync(join(tmpdir(), "d2-tools-community-"));
    saveDimWishlist(dir, {
      title: "Test Picks",
      rules: [
        { item_hash: 123, perk_hashes: [11, 22], mode: "pve", note: "" },
        { item_hash: 123, perk_hashes: [11, 33], mode: "pvp", note: "" }
      ]
    });

    const service = createDefaultCommunityPerkService({ data: { data_dir: dir } });
    const matches = await service.matchVaultItems([
      { hash: 123, socket_plugs: [{ hash: 11 }, { hash: 22 }] },
      { hash: 123, socket_plugs: [{ hash: 11 }, { hash: 33 }] },
      { hash: 123, socket_plugs: [{ hash: 11 }] }
    ]);

    expect(matches.get(123)?.matched).toBe(2);
    expect(matches.get(123)?.available).toBe(2);
    expect(matches.get(123)?.modes).toContain("pve");
    expect(matches.get(123)?.modes).toContain("pvp");

    const noMatch = await service.matchVaultItems([
      { hash: 123, socket_plugs: [{ hash: 11 }] }
    ]);
    expect(noMatch.get(123)?.matched).toBe(0);
    expect(noMatch.get(123)?.available).toBe(2);
  });

  it("aggregates every enabled local source when matching vault items", async () => {
    const dir = mkdtempSync(join(tmpdir(), "d2-tools-community-"));
    saveLocalCommunityRecommendations(dir, {
      title: "Custom Picks",
      rules: [{ item_hash: 123, perk_hashes: [11, 22], mode: "pve", note: "" }]
    });
    saveDimWishlist(dir, {
      title: "DIM Picks",
      rules: [{ item_hash: 123, perk_hashes: [33, 44], mode: "pvp", note: "" }]
    });

    const service = createDefaultCommunityPerkService({ data: { data_dir: dir } });
    const matches = await service.matchVaultItems([
      { hash: 123, socket_plugs: [{ hash: 11 }, { hash: 22 }] },
      { hash: 123, socket_plugs: [{ hash: 33 }, { hash: 44 }] }
    ]);

    expect(matches.get(123)?.matched).toBe(2);
    expect(matches.get(123)?.available).toBe(2);
    expect(matches.get(123)?.modes).toEqual(expect.arrayContaining(["pve", "pvp"]));
    expect(matches.get(123)?.source_label).toContain("自定义推荐规则");
    expect(matches.get(123)?.source_label).toContain("DIM Wishlist");
  });

  it.each([
    { curatedMode: "pve" as const, expected: "compare" as const },
    { curatedMode: "pvp" as const, expected: "priority" as const },
    { curatedMode: "general" as const, expected: "compare" as const }
  ])("resolves DIM PVE and curated $curatedMode evidence as $expected", async ({ curatedMode, expected }) => {
    const curated = source("Curated", async () => recommendation({
      matched_modes: [curatedMode],
      source_label: "人工来源",
      source_records: [{
        rule_stable_id: `curated-${curatedMode}`,
        source_id: "aegis",
        source_label: "Aegis推荐",
        purposes: [curatedMode],
        requirements: [{
          slot: "perk1",
          label: "Perk 1",
          candidate_names: ["目标 Perk"],
          candidates: [{ hash: 11, name: "目标 Perk" }],
          unresolved_candidate_names: []
        }]
      }]
    }));
    const dim = source("DIM", async () => recommendation({
      matched_modes: ["pve"],
      source_label: "DIM Wishlist",
      combos: [{
        rule_stable_id: "dim-pve",
        perks: [{ hash: 22, name: "DIM Perk" }],
        source: "dim_wishlist",
        mode: "pve"
      }]
    }));
    const service = new CommunityPerkRecommendationService([curated, dim]);

    const [match] = await service.matchVaultItemInstances([{
      hash: 123,
      instance_id: "instance-1",
      weapon_roll: {
        fingerprint: "roll-1",
        complete: true,
        incomplete_reasons: [],
        sockets: [
          {
            socket_index: 3,
            slot: "perk1",
            label: "Perk 1",
            current_plug: { hash: 99, name: "其他 Perk", selected: true },
            owned_plugs: [{ hash: 99, name: "其他 Perk", selected: true }],
            complete: true,
            incomplete_reasons: []
          },
          {
            socket_index: 4,
            slot: "perk2",
            label: "Perk 2",
            current_plug: { hash: 22, name: "DIM Perk", selected: true },
            owned_plugs: [{ hash: 22, name: "DIM Perk", selected: true }],
            complete: true,
            incomplete_reasons: []
          }
        ]
      }
    }]);

    expect(match?.recommendation_state).toBe(expected);
    expect(match?.match_status).toBe(expected === "priority" ? "full_match" : "partial_match");
  });

  it("includes english perk previews for vault and library community matches", async () => {
    const dir = mkdtempSync(join(tmpdir(), "d2-tools-community-"));
    saveDimWishlist(dir, {
      title: "Test Picks",
      rules: [
        { item_hash: 123, perk_hashes: [11, 22], mode: "pve", note: "" }
      ]
    });

    const service = createDefaultCommunityPerkService({ data: { data_dir: dir } });
    const matches = await service.matchVaultItems(
      [{ hash: 123, socket_plugs: [{ hash: 11 }, { hash: 22 }] }, { hash: 123 }],
      { itemDefinitions, englishItemDefinitions }
    );

    expect(matches.get(123)?.sample_perks).toEqual([
      expect.objectContaining({ hash: 11, name: "电流激荡", englishName: "Voltshot" }),
      expect.objectContaining({ hash: 22, name: "快速连发", englishName: "Rapid Hit" })
    ]);
    expect(matches.get(123)?.source_label).toBe("DIM Wishlist");
  });

  it("validates offline weapon sample fixtures through local community matching", async () => {
    const dir = mkdtempSync(join(tmpdir(), "d2-tools-community-"));
    const fixture = readFileSync(new URL("fixtures/local-community-samples.json", import.meta.url), "utf8");
    const table = parseLocalCommunityRecommendations(fixture);
    saveLocalCommunityRecommendations(dir, table);

    expect(table.rules.length).toBeGreaterThanOrEqual(2);
    expect(new Set(table.rules.map((rule) => rule.item_hash)).size).toBeGreaterThanOrEqual(2);

    const service = createDefaultCommunityPerkService({ data: { data_dir: dir } });
    const firstRule = table.rules[0];
    const recommendation = await service.getRecommendations(firstRule.item_hash, { item_name: "Fixture Weapon" });

    expect(recommendation?.source_label).toContain("本地社区表");
    expect(recommendation?.combos[0].source).toBe("local_community");
    expect(recommendation?.combos[0].perks.map((perk) => perk.hash)).toEqual(firstRule.perk_hashes);

    const matches = await service.matchVaultItems(table.rules.map((rule) => ({
      hash: rule.item_hash,
      socket_plugs: rule.perk_hashes.map((hash) => ({ hash }))
    })));
    for (const rule of table.rules) {
      expect(matches.get(rule.item_hash)?.matched).toBeGreaterThanOrEqual(1);
    }
  });

  it("creates a dim wishlist source that reports availability", () => {
    const dir = mkdtempSync(join(tmpdir(), "d2-tools-community-"));
    saveDimWishlist(dir, {
      title: "Available Picks",
      rules: [{ item_hash: 1, perk_hashes: [1], mode: "general", note: "" }]
    });

    const source = createDimWishlistSource(dir);
    expect(source.isAvailable({ data: { data_dir: dir } })).toBe(true);
  });

  it("keeps a visible fallback warning when one source fails and another source succeeds", async () => {
    const failingSource = source("社区来源", async () => {
      throw new Error("社区来源查询失败");
    });
    const wishlist = source("DIM Wishlist", async () => recommendation({
      source_label: "DIM Wishlist",
      combos: [{ perks: [{ hash: 11, name: "Voltshot" }], source: "dim_wishlist", mode: "pve" }]
    }));
    const service = new CommunityPerkRecommendationService([failingSource, wishlist]);

    const result = await service.getRecommendationsWithAllSources(123, { item_name: "Test Weapon" });

    expect(result?.combos).toHaveLength(1);
    expect(result?.source_warnings).toContain("社区来源 查询失败，已显示 DIM Wishlist 数据。");
  });
});

function recommendation(overrides: Partial<WeaponRecommendation> = {}): WeaponRecommendation {
  return {
    item_hash: 123,
    item_name: "Test Weapon",
    combos: [],
    matched_modes: [],
    ...overrides
  };
}

function source(
  name: string,
  getRecommendations: CommunityPerkSource["getRecommendations"]
): CommunityPerkSource {
  return {
    name,
    isAvailable: () => true,
    getRecommendations
  };
}
