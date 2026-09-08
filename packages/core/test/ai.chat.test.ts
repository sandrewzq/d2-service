import { describe, expect, it } from "vitest";
import { buildAiChatContext, callAiWithWebSearch, extractAiSections, generateAiChatReply, generateVaultAiAdvice } from "../src/ai/chat.js";
import type { AccountItemSummary } from "../src/account/summary.js";
import type { D2Config } from "../src/config/schema.js";
import type { VaultTags } from "../src/vault/tags.js";

const items: AccountItemSummary[] = [
  {
    hash: 1,
    instance_id: "weapon-1",
    name: "Riskrunner",
    group_key: "weapons",
    tier: "Exotic",
    item_type: "Submachine Gun",
    power: 1990,
    socket_plugs: [{ hash: 11, name: "Voltshot" }]
  }
];

const tags: VaultTags = {
  items: {
    "weapon-1": { tag: "keep", note: "留给电猎清怪" }
  }
};

describe("AI chat analysis", () => {
  it("builds a sanitized chat context from account, vault, tags, and daily data", () => {
    const context = buildAiChatContext({
      account: {
        account_name: "Guardian",
        destiny_membership_id: "membership-1",
        membership_type: 3,
        characters: [{
          character_id: "char-1",
          class_name: "术士",
          light: 2010,
          equipped_items: items,
          equipment_groups: [],
          inventory_items: [{ ...items[0], instance_id: "weapon-2", name: "Beloved" }],
          inventory_groups: [],
          postmaster_items: [{ ...items[0], instance_id: "postmaster-1", name: "Edge Transit" }],
          loadout_slots: [{
            index: 0,
            name: "Boss DPS",
            item_count: 2,
            items: [
              { instance_id: "weapon-1", name: "Riskrunner", bucket_name: "能量武器" },
              { instance_id: "weapon-2", name: "Beloved", bucket_name: "特殊武器" }
            ]
          }]
        }],
        vault: {
          item_count: 1,
          items,
          sample_items: items
        },
        materials: {
          item_count: 1,
          items: [{ hash: 100, name: "增强核心", quantity: 10 }]
        }
      },
      tags,
      daily: {
        date_label: "2026-06-20",
        daily_reset: { label: "每日重置", next_reset_iso: "2026-06-20T17:00:00.000Z", time_remaining_label: "还有 3 小时" },
        weekly_reset: { label: "每周重置", next_reset_iso: "2026-06-23T17:00:00.000Z", time_remaining_label: "还有 3 天" },
        sources: {
          rotations: { status: "ready", label: "今日轮换", message: "已确认", items: [{ title: "日落" }] },
          vendors: { status: "pending", label: "商人", message: "未接入" },
          lost_sector: { status: "pending", label: "遗失区域", message: "未接入" },
          weekly_report: { status: "ready", label: "本周", message: "已确认", items: [{ title: "突袭轮换" }] }
        },
        checklist: ["检查高光等"],
        recommendations: ["先清理仓库"]
      },
      activity: null
    });

    expect(context).toContain("Guardian");
    expect(context).toContain("Riskrunner");
    expect(context).toContain("Beloved");
    expect(context).toContain("Edge Transit");
    expect(context).toContain("Boss DPS");
    expect(context).toContain("增强核心");
    expect(context).toContain("突袭轮换");
    expect(context).toContain("AI 只能建议");
    expect(context).not.toContain("client_secret");
    expect(context).not.toContain("access_token");
    expect(context).not.toContain("refresh_token");
    expect(context).not.toContain("api_key");
  });

  it("includes the full loaded account inventory context without truncating vault, material, or tag entries", () => {
    const manyItems = Array.from({ length: 90 }, (_, index): AccountItemSummary => ({
      hash: 1000 + index,
      instance_id: `vault-${index}`,
      name: `Vault Item ${index}`,
      group_key: "weapons",
      tier: "Legendary",
      item_type: "Hand Cannon",
      bucket_name: "动能武器",
      power: 1900 + index
    }));
    const manyTags: VaultTags = {
      items: Object.fromEntries(manyItems.map((item, index) => [
        item.instance_id,
        { tag: index % 2 ? "review" : "junk", note: `note-${index}` }
      ]))
    };

    const context = buildAiChatContext({
      account: {
        account_name: "Guardian",
        destiny_membership_id: "membership-1",
        membership_type: 3,
        characters: [],
        vault: {
          item_count: manyItems.length,
          items: manyItems,
          sample_items: manyItems.slice(0, 5)
        },
        materials: {
          item_count: 45,
          items: Array.from({ length: 45 }, (_, index) => ({
            hash: 2000 + index,
            name: `Material ${index}`,
            quantity: index
          }))
        }
      },
      tags: manyTags,
      daily: null,
      activity: null
    });

    expect(context).toContain("Vault Item 89");
    expect(context).toContain("Material 44");
    expect(context).toContain("note-89");
    expect(context).not.toContain("sample_items");
  });

  it("answers freeform AI chat questions with sanitized context", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];

    const result = await generateAiChatReply({
      config: config({
        ai: {
          protocol: "openai_chat_completions",
          api_key: "test-key",
          model: "gpt-test",
          base_url: "",
        }
      }),
      question: "哪些装备可以清理？",
      context: "仓库：Riskrunner，本地标记：保留。",
      fetcher: async (url, init) => {
        requests.push({ url: String(url), init: init ?? {} });
        return jsonResponse({
          choices: [{ message: { content: "建议先保留 Riskrunner，不要直接分解。" } }]
        });
      }
    });

    expect(requests[0].url).toBe("https://api.openai.com/v1/chat/completions");
    const body = JSON.stringify(JSON.parse(String(requests[0].init.body)));
    expect(body).toContain("哪些装备可以清理");
    expect(body).toContain("AI 不能直接执行锁定、转移、装备或分解");
    expect(body).not.toContain("test-key");
    expect(result.text).toBe("建议先保留 Riskrunner，不要直接分解。");
  });

  it("extracts facts, analysis, suggestions, and action reminders from AI text", () => {
    const sections = extractAiSections([
      "事实：",
      "- 仓库有 2 把同名武器",
      "分析：",
      "- 第一把更适合 PVE",
      "建议：",
      "- 保留第一把",
      "操作提醒：",
      "- 不会自动分解"
    ].join("\n"));

    expect(sections.facts).toEqual(["仓库有 2 把同名武器"]);
    expect(sections.analysis).toEqual(["第一把更适合 PVE"]);
    expect(sections.suggestions).toEqual(["保留第一把"]);
    expect(sections.action_reminders).toEqual(["不会自动分解"]);
  });

  it("returns local analysis without calling the network when AI is disabled", async () => {
    let called = false;

    const result = await generateVaultAiAdvice({
      config: config({ ai: { protocol: "", api_key: "", model: "", base_url: "" } }),
      items,
      tags,
      fetcher: async () => {
        called = true;
        throw new Error("unexpected network call");
      }
    });

    expect(called).toBe(false);
    expect(result.local.facts[0]).toBe("仓库共 1 件物品，其中武器 1 件、护甲 0 件、其他装备 0 件、其他 0 件。");
    expect(result.ai).toBeNull();
    expect(result.skipped_reason).toBe("AI 未启用。");
  });

  it("calls OpenAI Responses API with vault facts and tagged roll data", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];

    const result = await generateVaultAiAdvice({
      config: config({
        ai: {
          protocol: "openai_responses",
          api_key: "test-key",
          model: "gpt-test",
          base_url: "",
        }
      }),
      items,
      tags,
      fetcher: async (url, init) => {
        requests.push({ url: String(url), init: init ?? {} });
        return jsonResponse({ output_text: "这把 Riskrunner 建议保留，用于电弧场景。" });
      }
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("https://api.openai.com/v1/responses");
    expect(requests[0].init.headers).toMatchObject({
      Authorization: "Bearer test-key",
      "Content-Type": "application/json"
    });
    expect(JSON.stringify(JSON.parse(String(requests[0].init.body)))).toContain("Riskrunner");
    expect(JSON.stringify(JSON.parse(String(requests[0].init.body)))).toContain("Voltshot");
    expect(JSON.stringify(JSON.parse(String(requests[0].init.body)))).toContain("留给电猎清怪");
    expect(result.ai).toEqual({
      provider: "openai_responses",
      model: "gpt-test",
      text: "这把 Riskrunner 建议保留，用于电弧场景。",
      sections: {
        facts: [],
        analysis: [],
        suggestions: [],
        action_reminders: [],
        raw: "这把 Riskrunner 建议保留，用于电弧场景。"
      }
    });
  });

  it("calls an OpenAI-compatible chat endpoint and reports readable API errors", async () => {
    await expect(generateVaultAiAdvice({
      config: config({
        ai: {
          protocol: "openai_chat_completions",
          api_key: "test-key",
          model: "local-model",
          base_url: "http://127.0.0.1:11434/v1",
        }
      }),
      items,
      tags,
      fetcher: async (url) => {
        expect(String(url)).toBe("http://127.0.0.1:11434/v1/chat/completions");
        return jsonResponse({ error: { message: "bad request" } }, 400);
      }
    })).rejects.toThrow("AI 接口调用失败：bad request");
  });

  it("uses OpenAI Responses for an explicitly requested external web search", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];

    const result = await callAiWithWebSearch({
      config: config({
        ai: {
          protocol: "openai_responses",
          api_key: "test-key",
          model: "compatible-model",
          base_url: "https://example.test/v1"
        }
      }),
      query: "请查询这把武器的公开玩法资料",
      fetcher: async (url, init) => {
        requests.push({ url: String(url), init: init ?? {} });
        return jsonResponse({
          output_text: "结构化分析结果"
        });
      }
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("https://example.test/v1/responses");
    expect(JSON.parse(String(requests[0].init.body))).toMatchObject({
      model: "compatible-model",
      tools: [{ type: "web_search_preview" }]
    });
    expect(result.text).toBe("结构化分析结果");
  });

  it("uses an explicitly configured DeepSeek Chat Completions endpoint", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];

    const result = await generateVaultAiAdvice({
      config: config({
        ai: {
          protocol: "openai_chat_completions",
          api_key: "test-key",
          model: "deepseek-chat",
          base_url: "https://api.deepseek.com",
        }
      }),
      items,
      tags,
      fetcher: async (url, init) => {
        requests.push({ url: String(url), init: init ?? {} });
        return jsonResponse({
            choices: [{ message: { content: "DeepSeek 配置调用成功。" } }]
        });
      }
    });

    expect(requests[0].url).toBe("https://api.deepseek.com/chat/completions");
    expect(result.ai?.provider).toBe("openai_chat_completions");
    expect(result.ai?.text).toBe("DeepSeek 配置调用成功。");
  });

  it("calls Anthropic Messages API and parses text content", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];

    const result = await generateVaultAiAdvice({
      config: config({
        ai: {
          protocol: "anthropic_messages",
          api_key: "test-key",
          model: "claude-test",
          base_url: "",
        }
      }),
      items,
      tags,
      fetcher: async (url, init) => {
        requests.push({ url: String(url), init: init ?? {} });
        return jsonResponse({
          content: [{ type: "text", text: "Claude 分析结果。" }]
        });
      }
    });

    expect(requests[0].url).toBe("https://api.anthropic.com/v1/messages");
    expect(requests[0].init.headers).toMatchObject({
      "x-api-key": "test-key",
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    });
    expect(JSON.stringify(JSON.parse(String(requests[0].init.body)))).toContain("Riskrunner");
    expect(result.ai).toMatchObject({
      provider: "anthropic_messages",
      model: "claude-test",
      text: "Claude 分析结果。"
    });
  });
});

function config(overrides: Partial<D2Config>): D2Config {
  return {
    bungie: {
      api_key: "",
      client_id: "",
      client_secret: "",
      redirect_uri: "https://127.0.0.1:28780/oauth/callback"
    },
    data: {
      data_dir: "",
      manifest_language: "zh-chs"
    },
    ai: {
      protocol: "",
      api_key: "",
      model: "",
      base_url: "",
      ...overrides.ai
    },
    features: {
      color_mode: "light"
    }
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
