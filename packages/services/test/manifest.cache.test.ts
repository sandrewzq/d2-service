import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { D2Config } from "@d2-tools/core/config/schema";
import type { DestinyManifestMetadata } from "@d2-tools/core/manifest/metadata";
import { selectManifestLanguagePath } from "@d2-tools/core/manifest/metadata";
import { requiredDefinitionComponents } from "@d2-tools/core/manifest/definitions";
import {
  checkManifestVersion,
  clearManifestCache,
  getManifestStatus,
  initializeManifestMetadata,
  loadManifestMetadataCache,
  saveManifestMetadataCache
} from "../src/manifest/cache";
import {
  getDefinitionStatus,
  initializeDefinitionComponent
} from "../src/manifest/definitions";

const manifest: DestinyManifestMetadata = {
  version: "123",
  mobileWorldContentPaths: {
    "en": "/common/destiny2_content/sqlite/en/world_sql_content.sqlite",
    "zh-chs": "/common/destiny2_content/sqlite/zh-chs/world_sql_content.sqlite"
  },
  jsonWorldComponentContentPaths: {
    "zh-chs": {
      DestinyInventoryItemDefinition: "/common/destiny2_content/json/zh-chs/items.json"
    }
  }
};

function config(dataDir: string): D2Config {
  return {
    bungie: {
      api_key: "api-key",
      client_id: "client",
      client_secret: "secret",
      redirect_uri: "https://127.0.0.1:28780/oauth/callback"
    },
    data: {
      data_dir: dataDir,
      manifest_language: "zh-chs"
    },
    ai: {
      protocol: "",
      api_key: "",
      model: "",
      base_url: "",
    }
  };
}

describe("manifest metadata service adapter", () => {
  it("clears incomplete manifest caches so a repair can rebuild them", () => {
    const dataDir = mkdtempSync(join(tmpdir(), "d2-tools-manifest-"));

    saveManifestMetadataCache({
      dataDir,
      language: "zh-chs",
      metadata: manifest,
      cachedAt: "2026-06-18T00:00:00.000Z"
    });

    clearManifestCache(dataDir);

    expect(loadManifestMetadataCache(dataDir)).toBeNull();
    expect(getManifestStatus(dataDir)).toEqual({ initialized: false });
  });

  it("clears in-memory definition caches with the repaired files", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "d2-tools-manifest-"));

    await initializeDefinitionComponent({
      dataDir,
      language: "zh-chs",
      metadata: manifest,
      component: "DestinyInventoryItemDefinition",
      fetchJson: async () => ({ "1": { hash: 1 } })
    });
    expect(getDefinitionStatus(dataDir, "DestinyInventoryItemDefinition").initialized).toBe(true);

    clearManifestCache(dataDir);

    expect(getDefinitionStatus(dataDir, "DestinyInventoryItemDefinition")).toEqual({ initialized: false });
  });

  it("persists metadata cache and exposes status", () => {
    const dataDir = mkdtempSync(join(tmpdir(), "d2-tools-manifest-"));

    saveManifestMetadataCache({
      dataDir,
      language: "zh-chs",
      metadata: manifest,
      cachedAt: "2026-06-18T00:00:00.000Z"
    });

    expect(loadManifestMetadataCache(dataDir)).toEqual({
      cached_at: "2026-06-18T00:00:00.000Z",
      language: "zh-chs",
      sqlite_path: "/common/destiny2_content/sqlite/zh-chs/world_sql_content.sqlite",
      metadata: manifest
    });
    expect(getManifestStatus(dataDir)).toEqual({
      initialized: true,
      version: "123",
      language: "zh-chs",
      sqlite_path: "/common/destiny2_content/sqlite/zh-chs/world_sql_content.sqlite",
      cached_at: "2026-06-18T00:00:00.000Z",
      definitions: requiredDefinitionComponents.map((component) => ({ initialized: false, component })),
      missing_required_components: requiredDefinitionComponents
    });
  });

  it("initializes metadata through an injected fetcher", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "d2-tools-manifest-"));
    const seenApiKeys: string[] = [];

    const status = await initializeManifestMetadata({
      config: config(dataDir),
      fetchMetadata: async (apiKey) => {
        seenApiKeys.push(apiKey);
        return manifest;
      },
      now: () => new Date("2026-06-18T01:02:03.000Z")
    });

    expect(seenApiKeys).toEqual(["api-key"]);
    expect(status).toEqual({
      initialized: true,
      version: "123",
      language: "zh-chs",
      sqlite_path: "/common/destiny2_content/sqlite/zh-chs/world_sql_content.sqlite",
      cached_at: "2026-06-18T01:02:03.000Z",
      definitions: requiredDefinitionComponents.map((component) => ({ initialized: false, component })),
      missing_required_components: requiredDefinitionComponents
    });
  });

  it("checks latest manifest version without replacing the local cache", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "d2-tools-manifest-"));
    saveManifestMetadataCache({
      dataDir,
      language: "zh-chs",
      metadata: manifest,
      cachedAt: "2026-06-18T00:00:00.000Z"
    });

    const latestManifest: DestinyManifestMetadata = {
      ...manifest,
      version: "124"
    };
    const status = await checkManifestVersion({
      config: config(dataDir),
      fetchMetadata: async () => latestManifest,
      now: () => new Date("2026-06-29T01:02:03.000Z")
    });

    expect(status).toMatchObject({
      initialized: true,
      version: "123",
      latest_version: "124",
      needs_update: true,
      checked_at: "2026-06-29T01:02:03.000Z"
    });
    expect(loadManifestMetadataCache(dataDir)?.metadata.version).toBe("123");
  });

  it("marks the manifest for update when the configured language changes", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "d2-tools-manifest-"));
    saveManifestMetadataCache({
      dataDir,
      language: "zh-chs",
      metadata: manifest,
      cachedAt: "2026-06-18T00:00:00.000Z"
    });

    const nextConfig = config(dataDir);
    nextConfig.data.manifest_language = "en";
    const status = await checkManifestVersion({
      config: nextConfig,
      fetchMetadata: async () => manifest,
      now: () => new Date("2026-06-29T01:02:03.000Z")
    });

    expect(status).toMatchObject({
      version: "123",
      latest_version: "123",
      language: "zh-chs",
      needs_update: true
    });
  });
});

describe("manifest metadata pure core helpers", () => {
  it("selects the configured language path when available", () => {
    expect(selectManifestLanguagePath(manifest, "zh-chs"))
      .toBe("/common/destiny2_content/sqlite/zh-chs/world_sql_content.sqlite");
  });

  it("falls back to English when the configured language is missing", () => {
    expect(selectManifestLanguagePath(manifest, "fr"))
      .toBe("/common/destiny2_content/sqlite/en/world_sql_content.sqlite");
  });
});
