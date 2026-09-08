import { describe, expect, it } from "vitest";
import { loadAccountWorkspace } from "../src/workspaces/account";
import { loadAccountDerivedWorkspace, loadFullAccountWorkspace } from "../src/workspaces/accountDerived";

describe("account workspace", () => {
  it("loads account summary together with vault tags, target rules and wishlist", async () => {
    const result = await loadAccountWorkspace({
      profile: {
        async getAccountSummary() {
          return {
            account_name: "tester",
            destiny_membership_id: "123",
            membership_type: 1,
            characters: [],
            vault: { item_count: 0, items: [], sample_items: [] },
            materials: { item_count: 0, items: [] }
          };
        },
        async getActivitySummary() {
          return {
            recent: { total: 0, pve: { total: 0, completed: 0 }, pvp: { total: 0, completed: 0 }, other: { total: 0, completed: 0 } },
            raids: { entries: [] },
            recent_items: []
          };
        }
      },
      localData: {
        async getVaultTags() {
          return { items: { sample: { tag: "keep" } } };
        },
        async getLocalTargetRules() {
          return {
            action_policy: "notify_only",
            armor: [],
            weapons: []
          };
        },
        async getEquipmentTargetStore() {
          return {
            version: 1,
            action_policy: "notify_only",
            created_at: "2026-08-08T00:00:00.000Z",
            updated_at: "2026-08-08T00:00:00.000Z",
            targets: []
          };
        },
        async getDimWishlist() {
          return {
            title: "Test Wishlist",
            rules: []
          };
        },
        async getLocalCommunityRecommendations() {
          return null;
        },
        async saveDimWishlist() {
          throw new Error("not used");
        },
        async clearDimWishlist() {
          throw new Error("not used");
        },
        async saveLocalCommunityRecommendations() {
          throw new Error("not used");
        },
        async clearLocalCommunityRecommendations() {
          throw new Error("not used");
        },
        async saveVaultTag() {
          throw new Error("not used");
        },
        async saveVaultTagsBatch() {
          throw new Error("not used");
        },
        async saveVaultNote() {
          throw new Error("not used");
        },
        async saveLocalTargetRules() {
          throw new Error("not used");
        },
        async clearLocalTargetRules() {
          throw new Error("not used");
        },
        async saveEquipmentTargetStore() {
          throw new Error("not used");
        },
        async clearEquipmentTargetStore() {
          throw new Error("not used");
        }
      }
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") {
      throw new Error("unexpected failure");
    }

    expect(result.data.account.account_name).toBe("tester");
    expect(result.data.tags.items.sample?.tag).toBe("keep");
    expect(result.data.targetRules.action_policy).toBe("notify_only");
    expect(result.data.wishlist?.title).toBe("Test Wishlist");
  });

  it("keeps the account snapshot when local enhancement data fails", async () => {
    const result = await loadAccountWorkspace({
      profile: {
        async getAccountSummary() {
          return {
            account_name: "tester",
            destiny_membership_id: "123",
            membership_type: 1,
            characters: [],
            vault: { item_count: 0, items: [], sample_items: [] },
            materials: { item_count: 0, items: [] }
          };
        },
        async getActivitySummary() {
          return {
            recent: { total: 0, pve: { total: 0, completed: 0 }, pvp: { total: 0, completed: 0 }, other: { total: 0, completed: 0 } },
            raids: { entries: [] },
            recent_items: []
          };
        }
      },
      localData: {
        async getVaultTags() {
          throw new Error("tags unavailable");
        },
        async getLocalTargetRules() {
          throw new Error("rules unavailable");
        },
        async getEquipmentTargetStore() {
          throw new Error("equipment targets unavailable");
        },
        async getDimWishlist() {
          throw new Error("wishlist unavailable");
        },
        async getLocalCommunityRecommendations() {
          return null;
        },
        async saveDimWishlist() {
          throw new Error("not used");
        },
        async clearDimWishlist() {
          throw new Error("not used");
        },
        async saveLocalCommunityRecommendations() {
          throw new Error("not used");
        },
        async clearLocalCommunityRecommendations() {
          throw new Error("not used");
        },
        async saveVaultTag() {
          throw new Error("not used");
        },
        async saveVaultTagsBatch() {
          throw new Error("not used");
        },
        async saveVaultNote() {
          throw new Error("not used");
        },
        async saveLocalTargetRules() {
          throw new Error("not used");
        },
        async clearLocalTargetRules() {
          throw new Error("not used");
        },
        async saveEquipmentTargetStore() {
          throw new Error("not used");
        },
        async clearEquipmentTargetStore() {
          throw new Error("not used");
        }
      }
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") {
      throw new Error("unexpected failure");
    }

    expect(result.data.account.account_name).toBe("tester");
    expect(result.data.tags.items).toEqual({});
    expect(result.data.targetRules).toEqual({
      action_policy: "notify_only",
      armor: [],
      weapons: []
    });
    expect(result.data.wishlist).toBeNull();
    expect(result.data.warnings.map((warning) => warning.source)).toEqual([
      "vault-tags",
      "target-rules",
      "equipment-targets",
      "wishlist"
    ]);
  });

  it("loads full account workspace including derived activity and community matches in one app-layer call", async () => {
    const result = await loadFullAccountWorkspace({
      profile: {
        async getAccountSummary() {
          return {
            account_name: "tester",
            destiny_membership_id: "123",
            membership_type: 1,
            characters: [
              {
                character_id: "char-1",
                class_name: "猎人",
                equipped_items: [],
                equipment_groups: [],
                inventory_items: [],
                inventory_groups: [],
                postmaster_items: [],
                loadout_slots: []
              }
            ],
            vault: { item_count: 1, items: [{ hash: 123, name: "Test Gun", item_type: "Gun", tier: "Legendary", group_key: "weapons", bucket_name: "能量武器" }], sample_items: [] },
            materials: { item_count: 0, items: [] }
          };
        },
        async getActivitySummary() {
          return {
            recent: { total: 1, pve: { total: 1, completed: 1 }, pvp: { total: 0, completed: 0 }, other: { total: 0, completed: 0 } },
            raids: { entries: [] },
            recent_items: []
          };
        },
        async matchCommunityVaultItems() {
          return {
            matches: [{
              hash: 123,
              canonical_weapon_name: "Test Gun",
              coverage: "covered",
              match_status: "full_match",
              recommendation_state: "priority",
              matched: 1,
              partial: 0,
              available: 1,
              modes: ["pve"],
              sample_perks: [],
              source_label: "本地社区表"
            }],
            issues: []
          };
        }
      },
      localData: {
        async getVaultTags() {
          return { items: { sample: { tag: "keep" } } };
        },
        async getLocalTargetRules() {
          return {
            action_policy: "notify_only",
            armor: [],
            weapons: []
          };
        },
        async getEquipmentTargetStore() {
          return {
            version: 1,
            action_policy: "notify_only",
            created_at: "2026-08-08T00:00:00.000Z",
            updated_at: "2026-08-08T00:00:00.000Z",
            targets: []
          };
        },
        async getDimWishlist() {
          return {
            title: "Test Wishlist",
            rules: []
          };
        },
        async getLocalCommunityRecommendations() {
          return null;
        },
        async saveDimWishlist() {
          throw new Error("not used");
        },
        async clearDimWishlist() {
          throw new Error("not used");
        },
        async saveLocalCommunityRecommendations() {
          throw new Error("not used");
        },
        async clearLocalCommunityRecommendations() {
          throw new Error("not used");
        },
        async saveVaultTag() {
          throw new Error("not used");
        },
        async saveVaultTagsBatch() {
          throw new Error("not used");
        },
        async saveVaultNote() {
          throw new Error("not used");
        },
        async saveLocalTargetRules() {
          throw new Error("not used");
        },
        async clearLocalTargetRules() {
          throw new Error("not used");
        },
        async saveEquipmentTargetStore() {
          throw new Error("not used");
        },
        async clearEquipmentTargetStore() {
          throw new Error("not used");
        }
      }
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") {
      throw new Error("unexpected failure");
    }

    expect(result.data.account.account_name).toBe("tester");
    expect(result.data.tags.items.sample?.tag).toBe("keep");
    expect(result.data.targetRules.action_policy).toBe("notify_only");
    expect(result.data.wishlist?.title).toBe("Test Wishlist");
    expect(result.data.activitySummary?.recent.total).toBe(1);
    expect(result.data.vaultRecommendationCardSummary.get("hash:123")?.matched).toBe(1);
  });

  it("loads the activity slice without triggering community matching", async () => {
    let communityCalls = 0;
    const result = await loadAccountDerivedWorkspace({
      profile: {
        async getAccountSummary() {
          throw new Error("not used");
        },
        async getActivitySummary() {
          return {
            recent: { total: 0, pve: { total: 0, completed: 0 }, pvp: { total: 0, completed: 0 }, other: { total: 0, completed: 0 } },
            raids: { entries: [] },
            recent_items: []
          };
        },
        async matchCommunityVaultItems() {
          communityCalls += 1;
          return { matches: [], issues: [] };
        }
      }
    }, {
      account_name: "tester",
      destiny_membership_id: "123",
      membership_type: 1,
      characters: [],
      vault: { item_count: 0, items: [], sample_items: [] },
      materials: { item_count: 0, items: [] }
    }, {
      includeActivity: true,
      includeCommunityMatch: false
    });

    expect(result.status).toBe("success");
    expect(communityCalls).toBe(0);
  });
});
