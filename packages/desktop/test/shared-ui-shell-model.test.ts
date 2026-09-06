import { describe, expect, it } from "vitest";
import { navItems } from "../../ui/src/index";

describe("shared UI shell model", () => {
  it("exports platform-neutral shell navigation", () => {
    expect(navItems).toEqual([
      { key: "home", label: "首页" },
      { key: "account", label: "账号" },
      { key: "vault", label: "仓库" },
      { key: "loadouts", label: "配装" },
      { key: "library", label: "资料库" },
      { key: "vendors", label: "商人" },
      { key: "settings", label: "设置" }
    ]);
  });
});
