import { describe, expect, it } from "vitest";
import type { AccountItemSummary } from "@d2-tools/core/account/summary";
import { emptyLocalTargetRules } from "@d2-tools/core/analysis/targets";
import { selectVaultPageModel } from "../src/workspaces/vaultPage";

describe("vault page workspace", () => {
  it("exposes a page model selector for shared vault UI", () => {
    const model = selectVaultPageModel({
      account: {
        characters: [
          { character_id: "char-1", class_name: "猎人", equipped_items: [], inventory_items: [], postmaster_items: [] },
          { character_id: "char-2", class_name: "术士", equipped_items: [], inventory_items: [], postmaster_items: [] }
        ],
        vault: {
          item_count: 25,
          items: [vaultItem("item-1", 100, "测试武器")]
        }
      },
      selectedCharacterId: "char-2",
      activeLoadoutLookup: {
        instanceIds: new Set(["item-1"]),
        bucketHashKeys: new Set(),
        hashKeys: new Set([100])
      },
      activeLoadoutName: "宗师配装",
      tags: { items: { "item-1": { tag: "keep" } } },
      targetRules: emptyLocalTargetRules,
      wishlist: { title: "DIM", rules: [] }
    });

    expect(model.vaultItems.map((item) => item.instance_id)).toEqual(["item-1"]);
    expect(model.vaultItemCount).toBe(25);
    expect(model.currentCharacterId).toBe("char-2");
    expect(model.currentCharacterLabel).toBe("术士");
    expect(model.activeLoadoutLookup?.instanceIds.has("item-1")).toBe(true);
    expect(model.activeLoadoutName).toBe("宗师配装");
    expect(model.tags.items["item-1"]?.tag).toBe("keep");
    expect(model.targetRules).toBe(emptyLocalTargetRules);
    expect(model.wishlist?.title).toBe("DIM");
  });
});

function vaultItem(instanceId: string, hash: number, name: string): AccountItemSummary {
  return {
    hash,
    instance_id: instanceId,
    name,
    bucket_name: "Kinetic Weapons",
    group_key: "weapons",
    socket_plugs: []
  };
}
