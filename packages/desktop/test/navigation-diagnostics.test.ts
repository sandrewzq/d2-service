import { describe, expect, it } from "vitest";
import { buildDiagnosticRows } from "../src/renderer/components/DiagnosticsPanel";
import { navItems } from "../../ui/src/shell/navigation";
import type { StartupState } from "../src/renderer/api/types";

function startupState(): StartupState {
  return {
    nextStep: "login",
    cards: {
      bungieConfig: { status: "ready", label: "Bungie 配置已完成" },
      account: { status: "missing", label: "需要登录 Bungie 账号" },
      manifest: { status: "ready", label: "资料库已初始化" },
      ai: { status: "skipped", label: "AI 未配置" }
    }
  };
}

describe("desktop shell navigation and diagnostics", () => {
  it("defines the first public navigation entries", () => {
    expect(navItems.map((item) => item.key)).toEqual([
      "home",
      "account",
      "vault",
      "loadouts",
      "library",
      "vendors",
      "settings"
    ]);
  });

  it("builds readable diagnostic rows from startup state and local paths", () => {
    const rows = buildDiagnosticRows({
      state: startupState(),
      dataDir: "C:\\Users\\player\\AppData\\Roaming\\d2-tools",
      manifestVersion: "12345"
    });

    expect(rows).toContainEqual({
      label: "本地数据目录",
      value: "C:\\Users\\player\\AppData\\Roaming\\d2-tools",
      tone: "neutral"
    });
    expect(rows).toContainEqual({
      label: "账号登录",
      value: "需要登录 Bungie 账号",
      tone: "warning"
    });
    expect(rows).toContainEqual({
      label: "资料库版本",
      value: "12345",
      tone: "ok"
    });
  });
});
