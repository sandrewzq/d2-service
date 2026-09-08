import { describe, expect, it } from "vitest";
import { generateItemAiAdvice } from "../src/ai/chat.js";
import type { D2Config } from "../src/config/schema.js";
import type { VaultTags } from "../src/vault/tags.js";

const tags: VaultTags = {
  items: {
    "weapon-1": { tag: "keep" }
  }
};

describe("AI item analysis", () => {
  it("returns local score without calling the network when AI is disabled", async () => {
    let called = false;

    const result = await generateItemAiAdvice({
      config: config({ protocol: "", api_key: "", model: "", base_url: "" }),
      item: item(),
      tags,
      fetcher: async () => {
        called = true;
        throw new Error("unexpected network call");
      }
    });

    expect(called).toBe(false);
    expect(result.ai).toBeNull();
    expect(result.skipped_reason).toBe("AI 未启用。");
  });

  it("calls a configured Chat Completions endpoint with item roll", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];

    const result = await generateItemAiAdvice({
      config: config({
        protocol: "openai_chat_completions",
        api_key: "key",
        model: "deepseek-chat",
        base_url: "https://api.deepseek.com",
        data_sharing_consent: true
      }),
      item: item(),
      tags,
      fetcher: async (url, init) => {
        requests.push({ url: String(url), init: init ?? {} });
        return new Response(JSON.stringify({
          choices: [{ message: { content: "建议保留，适合电弧清怪。" } }]
        }), { status: 200 });
      }
    });

    const body = JSON.stringify(JSON.parse(String(requests[0].init.body)));
    expect(requests[0].url).toBe("https://api.deepseek.com/chat/completions");
    expect(body).toContain("Riskrunner");
    expect(body).toContain("Voltshot");
    expect(body).toContain("留给电猎清怪");
    expect(result.ai?.text).toBe("建议保留，适合电弧清怪。");
  });
});

function item() {
  return {
    hash: 1,
    instance_id: "weapon-1",
    name: "Riskrunner",
    group_key: "weapons" as const,
    bucket_name: "能量武器",
    item_type: "Submachine Gun",
    tier: "Exotic",
    locked: true,
    note: "留给电猎清怪",
    socket_plugs: [{ hash: 11, name: "Voltshot" }]
  };
}

function config(ai: D2Config["ai"]): D2Config {
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
    ai
  };
}
