import { describe, expect, it } from "vitest";
import { buildDiagnosticsExport } from "../../services/src/diagnostics/export.js";

describe("diagnostics export", () => {
  it("redacts secrets while keeping useful status", () => {
    const text = buildDiagnosticsExport({
      app_version: "0.0.4",
      config: {
        bungie: {
          api_key: "api-secret",
          client_id: "client-id",
          client_secret: "client-secret",
          redirect_uri: "https://127.0.0.1:28780/oauth/callback"
        },
        data: { data_dir: "C:/Users/dell/AppData/Roaming/d2-tools", manifest_language: "zh-chs" },
        ai: { protocol: "openai_chat_completions", api_key: "ai-secret", model: "gpt-test", base_url: "https://api.example.com" },
        features: { color_mode: "dark" }
      },
      manifest: { initialized: true, version: "123", language: "zh-chs" },
      action_log: [{ id: "1", created_at: "now", action: "equip", ok: false, message: "scope denied" }],
      tool_audit_log: [{
        id: "tool-1",
        created_at: "later",
        tool: "d2.search_items",
        caller: "ai",
        ok: true,
        input_summary: "query=Riskrunner api_key=secret",
        result_summary: "1 result"
      }]
    });

    expect(text).toContain("0.0.4");
    expect(text).toContain("zh-chs");
    expect(text).toContain("[已脱敏]");
    expect(text).toContain("d2.search_items");
    expect(text).toContain("[redacted]");
    expect(text).not.toContain("api-secret");
    expect(text).not.toContain("client-secret");
    expect(text).not.toContain("ai-secret");
    expect(text).not.toContain("api_key=secret");
  });
});
