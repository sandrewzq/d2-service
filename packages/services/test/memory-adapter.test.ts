import { describe, expect, it } from "vitest";
import type { AccountSummary } from "@d2-tools/core/account/summary";
import { loadFullAccountWorkspace } from "../../app/src/workspaces/accountDerived";
import { sendAssistantMessage } from "../../app/src/workspaces/assistant";
import { loadVaultPageWorkspace } from "../../app/src/workspaces/vaultPage";
import { createMemoryServices } from "../src/memoryAdapter";

describe("memory services adapter", () => {
  it("runs app workspaces without desktop bridge or window.d2", async () => {
    const services = createMemoryServices({
      account: createMemoryAccount(),
      activitySummary: {
        recent: { total: 1, pve: { total: 1, completed: 1 }, pvp: { total: 0, completed: 0 }, other: { total: 0, completed: 0 } },
        raids: { entries: [] },
        recent_items: []
      },
      vaultTags: {
        items: {
          "vault-1": { tag: "keep" }
        }
      },
      wishlist: {
        title: "Memory Wishlist",
        rules: []
      },
      localTargetRules: {
        action_policy: "notify_only",
        armor: [],
        weapons: []
      },
      communityMatches: [{
        hash: 9001,
        instance_id: "vault-1",
        canonical_weapon_name: "测试武器",
        coverage: "covered",
        match_status: "full_match",
        recommendation_state: "priority",
        matched: 1,
        partial: 0,
        available: 1,
        modes: ["pve"],
        sample_perks: [],
        source_label: "内存推荐"
      }],
      aiReply: {
        provider: "memory",
        model: "test-model",
        text: "内存回复"
      }
    });

    const account = await loadFullAccountWorkspace(services);
    const vault = await loadVaultPageWorkspace(services);
    const assistant = await sendAssistantMessage(services, {
      question: "看一下仓库",
      context: "当前测试"
    });

    expect(account.status).toBe("success");
    expect(vault.status).toBe("success");
    expect(assistant.status).toBe("success");
    if (account.status !== "success" || vault.status !== "success" || assistant.status !== "success") {
      throw new Error("unexpected workspace failure");
    }

    expect(account.data.account.account_name).toBe("memory-user");
    expect(account.data.vaultRecommendationCardSummary.get("vault-1")?.matched).toBe(1);
    expect(vault.data.vaultItems.map((item) => item.name)).toEqual(["内存手炮"]);
    expect(vault.data.tags.items["vault-1"]?.tag).toBe("keep");
    expect(assistant.data.reply.text).toBe("内存回复");

    const saved = await services.localData.saveVaultTag({ item_key: "vault-1", tag: "review" });
    expect(saved.items["vault-1"]?.tag).toBe("review");
    expect((await services.localData.getVaultTags()).items["vault-1"]?.tag).toBe("review");
  });

  it("serves dynamic AI replies through the same service contract", async () => {
    const services = createMemoryServices({
      account: createMemoryAccount(),
      aiReply: (input) => ({
        provider: "memory",
        model: "dynamic-model",
        text: `收到：${input.question}`
      })
    });

    const assistant = await sendAssistantMessage(services, {
      question: "第三阶段验证",
      context: "memory adapter"
    });
    expect(assistant.status).toBe("success");
    if (assistant.status !== "success") {
      throw new Error("unexpected assistant failure");
    }
    expect(assistant.data.reply.text).toContain("第三阶段验证");
  });
});

function createMemoryAccount(): AccountSummary {
  return {
    account_name: "memory-user",
    destiny_membership_id: "membership-1",
    membership_type: 1,
    characters: [{
      character_id: "char-1",
      class_name: "猎人",
      equipped_items: [],
      equipment_groups: [],
      inventory_items: [],
      inventory_groups: [],
      postmaster_items: [],
      loadout_slots: []
    }],
    vault: {
      item_count: 1,
      items: [{
        hash: 9001,
        instance_id: "vault-1",
        name: "内存手炮",
        item_type: "Hand Cannon",
        tier: "Legendary",
        group_key: "weapons",
        bucket_name: "能量武器"
      }],
      sample_items: []
    },
    materials: { item_count: 0, items: [] }
  };
}
