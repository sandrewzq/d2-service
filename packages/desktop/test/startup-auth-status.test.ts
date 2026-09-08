import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { D2Config } from "@d2-tools/core/config/schema";
import { saveOAuthToken } from "@d2-tools/services/oauth/tokenStore";
import { getStartupAuthStatus } from "../src/main/ipc/authSession";

function config(dataDir: string): D2Config {
  return {
    bungie: {
      api_key: "api",
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
    },
    features: {
      color_mode: "light"
    }
  };
}

describe("startup auth status", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not refresh expired OAuth tokens during startup status checks", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "d2-tools-startup-auth-"));
    saveOAuthToken(dataDir, {
      access_token: "expired-access-token",
      token_type: "Bearer",
      expires_in: 1,
      refresh_token: "refresh-token",
      created_at: "2020-01-01T00:00:00.000Z"
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(getStartupAuthStatus(config(dataDir))).resolves.toEqual({ status: "valid" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
