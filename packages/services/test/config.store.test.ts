import { describe, expect, it } from "vitest";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultDataDirForPlatform } from "../src/config/dataDir";
import { loadConfig, saveConfig } from "../src/config/store";

describe("config store service adapter", () => {
  it("uses d2-tools as the default data directory", () => {
    const originalAppData = process.env.APPDATA;
    const originalHome = process.env.HOME;
    const originalXdgDataHome = process.env.XDG_DATA_HOME;
    const appData = mkdtempSync(join(tmpdir(), "d2-tools-appdata-"));
    let expectedDataDir: string;
    if (process.platform === "win32") {
      process.env.APPDATA = appData;
      expectedDataDir = join(appData, "d2-tools");
    } else if (process.platform === "darwin") {
      process.env.HOME = appData;
      expectedDataDir = join(appData, "Library", "Application Support", "d2-tools");
    } else {
      process.env.XDG_DATA_HOME = appData;
      expectedDataDir = join(appData, "d2-tools");
    }

    try {
      const config = loadConfig({ env: {} });

      expect(config.data.data_dir).toBe(expectedDataDir);
    } finally {
      if (originalAppData === undefined) {
        delete process.env.APPDATA;
      } else {
        process.env.APPDATA = originalAppData;
      }
      if (originalHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = originalHome;
      }
      if (originalXdgDataHome === undefined) {
        delete process.env.XDG_DATA_HOME;
      } else {
        process.env.XDG_DATA_HOME = originalXdgDataHome;
      }
    }
  });

  it("resolves default data directories by platform without hard-coding APPDATA", () => {
    expect(defaultDataDirForPlatform({
      platform: "win32",
      env: { APPDATA: "C:\\Users\\player\\AppData\\Roaming" },
      homeDir: "C:\\Users\\player"
    })).toBe(join("C:\\Users\\player\\AppData\\Roaming", "d2-tools"));

    expect(defaultDataDirForPlatform({
      platform: "darwin",
      env: {},
      homeDir: "/Users/player"
    })).toBe(join("/Users/player", "Library", "Application Support", "d2-tools"));

    expect(defaultDataDirForPlatform({
      platform: "linux",
      env: { XDG_DATA_HOME: "/home/player/.local-data" },
      homeDir: "/home/player"
    })).toBe(join("/home/player/.local-data", "d2-tools"));

  });

  it("creates defaults in the selected data directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "d2-tools-config-"));
    const config = loadConfig({ dataDir: dir, env: {} });

    expect(config.data.data_dir).toBe(dir);
    expect(config.bungie.redirect_uri).toBe("https://127.0.0.1:28780/oauth/callback");
    expect(config.data.manifest_language).toBe("zh-chs");
    expect(config.features.color_mode).toBe("light");
    expect(config.features.interface_locale).toBe("zh-CN");
    expect(config.features.manifest_language_follows_interface).toBe(true);
  });

  it("persists GUI-provided Bungie credentials without logging them", () => {
    const dir = mkdtempSync(join(tmpdir(), "d2-tools-config-"));

    saveConfig(
      {
        bungie: {
          api_key: "api",
          client_id: "client",
          client_secret: "secret",
          redirect_uri: "https://127.0.0.1:28780/oauth/callback"
        },
        data: {
          data_dir: dir,
          manifest_language: "zh-chs"
        },
        ai: {
          protocol: "",
          api_key: "",
          model: "",
          base_url: ""
        },
        features: {
          color_mode: "dark",
          density: "standard",
          interface_locale: "en-US",
          manifest_language_follows_interface: false
        }
      },
      { dataDir: dir }
    );

    const raw = readFileSync(join(dir, "config.json"), "utf8");
    expect(raw).toContain("\"client_secret\": \"secret\"");

    const loaded = loadConfig({ dataDir: dir, env: {} });
    expect(loaded.bungie.client_secret).toBe("secret");
    expect(loaded.features.color_mode).toBe("dark");
    expect(loaded.features.interface_locale).toBe("en-US");
    expect(loaded.features.manifest_language_follows_interface).toBe(false);
  });

  it("lets env override config values", () => {
    const dir = mkdtempSync(join(tmpdir(), "d2-tools-config-"));
    saveConfig(
      {
        bungie: {
          api_key: "from-config",
          client_id: "client",
          client_secret: "secret",
          redirect_uri: "https://127.0.0.1:28780/oauth/callback"
        },
        data: {
          data_dir: dir,
          manifest_language: "zh-chs"
        },
        ai: {
          protocol: "",
          api_key: "",
          model: "",
          base_url: ""
        },
        features: {
          color_mode: "light",
          density: "standard",
          interface_locale: "zh-CN",
          manifest_language_follows_interface: true
        }
      },
      { dataDir: dir }
    );

    const loaded = loadConfig({
      dataDir: dir,
      env: {
        BUNGIE_API_KEY: "from-env",
        D2_MANIFEST_LANGUAGE: "en",
        D2_COLOR_MODE: "dark"
      }
    });

    expect(loaded.bungie.api_key).toBe("from-env");
    expect(loaded.data.manifest_language).toBe("en");
    expect(loaded.features.color_mode).toBe("dark");
  });

  it("migrates legacy ai.provider values to the current protocol field", () => {
    const dir = mkdtempSync(join(tmpdir(), "d2-tools-config-"));
    writeFileSync(
      join(dir, "config.json"),
      `${JSON.stringify({
        bungie: {
          api_key: "api",
          client_id: "client",
          client_secret: "secret",
          redirect_uri: "https://127.0.0.1:28780/oauth/callback"
        },
        data: {
          data_dir: dir,
          manifest_language: "zh-chs"
        },
        ai: {
          provider: "anthropic",
          api_key: "ai-key",
          model: "claude",
          base_url: "https://api.anthropic.com",
          enable_lightgg: false,
          force_lightgg: false
        },
        features: {
          write_actions_enabled: false,
          color_mode: "light",
          density: "standard",
          interface_locale: "zh-CN",
          manifest_language_follows_interface: true
        }
      }, null, 2)}\n`,
      "utf8"
    );

    const loaded = loadConfig({ dataDir: dir, env: {} });

    expect(loaded.ai.protocol).toBe("anthropic_messages");
    expect(loaded.ai.api_key).toBe("ai-key");
    expect("write_actions_enabled" in loaded.features).toBe(false);
    expect("enable_lightgg" in loaded.ai).toBe(false);
    expect("force_lightgg" in loaded.ai).toBe(false);
    const migrated = readFileSync(join(dir, "config.json"), "utf8");
    expect(migrated).toContain('"config_version": 3');
    expect(loaded.ai.data_sharing_consent).toBe(false);
    expect(migrated).not.toContain("enable_lightgg");
    expect(migrated).not.toContain("force_lightgg");
  });

  it("loads pre-density configs after an application upgrade", () => {
    const dir = mkdtempSync(join(tmpdir(), "d2-tools-config-"));
    writeFileSync(
      join(dir, "config.json"),
      `${JSON.stringify({
        bungie: {
          api_key: "api",
          client_id: "client",
          client_secret: "secret",
          redirect_uri: "http://127.0.0.1:28780/oauth/callback"
        },
        data: {
          data_dir: dir,
          manifest_language: "zh-chs"
        },
        ai: {
          provider: "none",
          api_key: "",
          model: "",
          base_url: ""
        },
        features: {
          color_mode: "light",
          interface_locale: "zh-CN"
        }
      }, null, 2)}\n`,
      "utf8"
    );

    const loaded = loadConfig({ dataDir: dir, env: {} });

    expect(loaded.features.density).toBe("standard");
    expect(loaded.features.manifest_language_follows_interface).toBe(true);
    expect(loaded.bungie.redirect_uri).toBe("https://127.0.0.1:28780/oauth/callback");
    expect(readFileSync(join(dir, "config.json"), "utf8")).toContain('"config_version": 3');
    expect(readdirSync(dir).some((name) => name.startsWith("config.json.pre-migration-") && name.endsWith(".bak"))).toBe(true);
  });

  it("loads very old configs that predate the features section", () => {
    const dir = mkdtempSync(join(tmpdir(), "d2-tools-config-"));
    writeFileSync(
      join(dir, "config.json"),
      `${JSON.stringify({
        bungie: {
          api_key: "api",
          client_id: "client",
          client_secret: "secret",
          redirect_uri: "https://127.0.0.1:28780/oauth/callback"
        },
        data: {
          data_dir: dir,
          manifest_language: "zh-chs"
        },
        ai: {
          provider: ""
        }
      }, null, 2)}\n`,
      "utf8"
    );

    const loaded = loadConfig({ dataDir: dir, env: {} });

    expect(loaded.features.color_mode).toBe("light");
    expect(loaded.features.density).toBe("standard");
    expect(loaded.features.interface_locale).toBe("zh-CN");
  });

  it("rejects config files that do not match the current schema", () => {
    const dir = mkdtempSync(join(tmpdir(), "d2-tools-config-"));
    writeFileSync(
      join(dir, "config.json"),
      `${JSON.stringify({ bungie: { api_key: "x" } }, null, 2)}\n`,
      "utf8"
    );

    expect(() => loadConfig({ dataDir: dir, env: {} })).toThrow("config.json 缺少 data 配置");
  });

});
