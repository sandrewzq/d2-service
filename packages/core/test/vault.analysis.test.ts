import { describe, expect, it } from "vitest";
import { analyzeVault } from "../src/analysis/vault.js";
import type { AccountItemSummary } from "../src/account/summary.js";
import type { VaultTags } from "../src/vault/tags.js";

const items: AccountItemSummary[] = [
  item({
    instance_id: "riskrunner-1",
    name: "Riskrunner",
    group_key: "weapons",
    tier: "Exotic",
    socket_plugs: [{ hash: 1, name: "Voltshot" }]
  }),
  item({
    instance_id: "helmet-1",
    name: "Helmet A",
    group_key: "armor",
    tier: "Legendary",
    socket_plugs: []
  }),
  item({
    instance_id: "vehicle-1",
    name: "Vehicle A",
    group_key: "equipment",
    tier: "Exotic",
    socket_plugs: []
  })
];

const tags: VaultTags = {
  items: {
    "riskrunner-1": { tag: "keep", note: "留给电猎清怪" },
    "helmet-1": { tag: "review" },
    "vehicle-1": { tag: "junk" }
  }
};

describe("vault analysis", () => {
  it("builds fact, analysis, and suggestion sections from vault items and local tags", () => {
    const result = analyzeVault({ items, tags });

    expect(result.facts).toEqual([
      "仓库共 3 件物品，其中武器 1 件、护甲 1 件、其他装备 1 件、其他 0 件。",
      "本地标记：保留 1 件、待定 1 件、清理 1 件、待刷 0 件、配装用 0 件、未标记 0 件。",
      "已读取实际 roll 的物品 1 件。"
    ]);
    expect(result.analysis).toContain("保留标记集中在 Riskrunner。");
    expect(result.analysis).toContain("待定标记集中在 Helmet A，适合后续人工确认。");
    expect(result.suggestions).toContain("优先查看“待定”标记的 1 件装备，确认是否改为保留或清理。");
    expect(result.items.keep.map((entry) => entry.name)).toEqual(["Riskrunner"]);
    expect(result.items.keep[0].note).toBe("留给电猎清怪");
  });
});

function item(overrides: Partial<AccountItemSummary>): AccountItemSummary {
  return {
    hash: 1,
    name: "Item",
    group_key: "other",
    socket_plugs: [],
    ...overrides
  };
}
