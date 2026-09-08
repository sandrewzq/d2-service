import { describe, expect, it } from "vitest";
import type { D2Config } from "../src/config/schema.js";
import { computeStartupState } from "../src/startup/startupState.js";

function config(overrides: Partial<D2Config["bungie"]> = {}): D2Config {
  return {
    bungie: {
      api_key: "",
      client_id: "",
      client_secret: "",
      redirect_uri: "https://127.0.0.1:28780/oauth/callback",
      ...overrides
    },
    data: {
      data_dir: "C:/Users/test/AppData/Roaming/d2-tools",
      manifest_language: "zh-chs"
    },
    ai: {
      protocol: "",
      api_key: "",
      model: "",
      base_url: "",
    },
    features: {
      color_mode: "light"
    }
  };
}

describe("startup state", () => {
  it("starts with Bungie configuration when the app is not configured", () => {
    const state = computeStartupState({ config: config(), hasToken: false, hasManifest: false });

    expect(state.nextStep).toBe("bungie-config");
    expect(state.cards.bungieConfig.status).toBe("missing");
    expect(state.cards.bungieConfig.label).toBe("需要填写 Bungie 配置");
    expect(state.cards.account.status).toBe("missing");
  });

  it("allows login before the background manifest is ready", () => {
    expect(computeStartupState({
      config: config({ api_key: "api", client_id: "client", client_secret: "secret" }),
      hasToken: false,
      hasManifest: false
    }).nextStep).toBe("login");
  });

  it("keeps the manifest status independent from the startup step", () => {
    const state = computeStartupState({
      config: config({ api_key: "api", client_id: "client", client_secret: "secret" }),
      hasToken: true,
      hasManifest: false
    });

    expect(state.nextStep).toBe("home");
    expect(state.cards.manifest.status).toBe("missing");
  });

  it("requires login after the manifest is ready", () => {
    expect(computeStartupState({
      config: config({ api_key: "api", client_id: "client", client_secret: "secret" }),
      hasToken: false,
      hasManifest: true
    }).nextStep).toBe("login");
  });

  it("requires login when a saved Bungie token is expired or invalid", () => {
    const state = computeStartupState({
      config: config({ api_key: "api", client_id: "client", client_secret: "secret" }),
      hasToken: true,
      hasManifest: true,
      auth: {
        status: "invalid",
        message: "Bungie 登录已失效，请重新登录"
      }
    });

    expect(state.nextStep).toBe("login");
    expect(state.cards.account.status).toBe("missing");
    expect(state.cards.account.label).toBe("Bungie 登录已失效，请重新登录");
  });

  it("returns Chinese status labels for the desktop home cards", () => {
    const state = computeStartupState({
      config: config({ api_key: "api", client_id: "client", client_secret: "secret" }),
      hasToken: true,
      hasManifest: true
    });

    expect(state.cards.bungieConfig.label).toBe("Bungie 配置已完成");
    expect(state.cards.account.label).toBe("Bungie 账号已登录");
    expect(state.cards.manifest.label).toBe("资料库已初始化");
    expect(state.cards.ai.label).toBe("AI 未配置");
  });

  it("carries the saved color mode into the desktop startup state", () => {
    const savedConfig = config({ api_key: "api", client_id: "client", client_secret: "secret" });
    savedConfig.features.color_mode = "dark";

    const state = computeStartupState({
      config: savedConfig,
      hasToken: true,
      hasManifest: true
    });

    expect(state.colorMode).toBe("dark");
  });

  it("marks manifest as needing update when cached before the latest weekly reset", () => {
    // 2026-06-22T15:00:00Z = Monday June 22 UTC, before Tuesday 17:00 reset
    const state = computeStartupState({
      config: config({ api_key: "api", client_id: "client", client_secret: "secret" }),
      hasToken: true,
      hasManifest: true,
      manifestCachedAt: "2026-06-22T15:00:00.000Z",
      now: new Date("2026-06-24T10:00:00.000Z") // Wednesday, after reset
    });

    expect(state.cards.manifest.needsUpdate).toBe(true);
    expect(state.cards.manifest.lastUpdated).toBe("6月22日");
    expect(state.cards.manifest.label).toBe("资料库上次更新于 6月22日，每周三凌晨 1:00 重置，建议更新");
  });

  it("does not mark manifest as needing update when cached after the latest weekly reset", () => {
    // 2026-06-23T18:00:00Z = Tuesday UTC after 17:00 reset, Beijing time 6月24日 02:00
    const state = computeStartupState({
      config: config({ api_key: "api", client_id: "client", client_secret: "secret" }),
      hasToken: true,
      hasManifest: true,
      manifestCachedAt: "2026-06-23T18:00:00.000Z",
      now: new Date("2026-06-24T10:00:00.000Z")
    });

    expect(state.cards.manifest.needsUpdate).toBe(false);
    expect(state.cards.manifest.lastUpdated).toBe("6月24日");
    expect(state.cards.manifest.label).toBe("资料库已初始化，每周三凌晨 1:00 重置后可更新");
  });

  it("does not set needsUpdate when manifest is missing", () => {
    const state = computeStartupState({
      config: config({ api_key: "api", client_id: "client", client_secret: "secret" }),
      hasToken: true,
      hasManifest: false
    });

    expect(state.cards.manifest.needsUpdate).toBeUndefined();
    expect(state.cards.manifest.lastUpdated).toBeUndefined();
    expect(state.cards.manifest.label).toBe("资料库未初始化");
  });
});
