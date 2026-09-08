import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { applyEnvOverrides } from "@d2-tools/core/config/env";
import { defaultConfig } from "@d2-tools/core/config/defaults";
import type { ConfigEnv, D2Config } from "@d2-tools/core/config/schema";
import { defaultDataDir } from "./dataDir.js";

export type ConfigStoreOptions = {
  dataDir?: string;
  env?: ConfigEnv;
};

const CURRENT_CONFIG_VERSION = 3;

export function configPath(dataDir: string): string {
  return join(dataDir, "config.json");
}

export function loadConfig(options: ConfigStoreOptions = {}): D2Config {
  const selectedDataDir = selectDataDir(options);
  mkdirSync(selectedDataDir, { recursive: true });

  const path = configPath(selectedDataDir);
  let base: D2Config;
  if (existsSync(path)) {
    const parsed = parseConfigForMigration(readFileSync(path, "utf8"), selectedDataDir);
    base = parsed.config;
    if (parsed.migrated) {
      persistMigratedConfig(path, base);
      removeRetiredLightggCache(selectedDataDir);
    }
  } else {
    base = defaultConfig(selectedDataDir);
  }

  base.data.data_dir = selectedDataDir;
  return applyEnvOverrides(base, options.env ?? process.env);
}

function selectDataDir(options: ConfigStoreOptions): string {
  if (options.dataDir) return options.dataDir;
  if (options.env?.D2_DATA_DIR) return options.env.D2_DATA_DIR;

  return defaultDataDir();
}

export function saveConfig(config: D2Config, options: { dataDir?: string } = {}): void {
  const selectedDataDir = options.dataDir ?? config.data.data_dir ?? defaultDataDir();
  mkdirSync(selectedDataDir, { recursive: true });
  const persistedConfig: D2Config = {
    ...config,
    ai: {
      ...config.ai,
      data_sharing_consent: config.ai.data_sharing_consent === true
    }
  };
  writeFileSync(
    configPath(selectedDataDir),
    `${JSON.stringify({ ...persistedConfig, config_version: CURRENT_CONFIG_VERSION }, null, 2)}\n`,
    "utf8"
  );
}

type ParsedConfig = {
  config: D2Config;
  migrated: boolean;
};

function parseConfigForMigration(text: string, dataDir: string): ParsedConfig {
  const value = JSON.parse(text) as unknown;
  if (!isRecord(value)) throw new Error("config.json 格式无效。");
  rejectUnknownFields(value, ["config_version", "bungie", "data", "ai", "features"], "根配置");

  const configVersion = value.config_version === undefined
    ? 0
    : requireConfigVersion(value.config_version);
  if (configVersion > CURRENT_CONFIG_VERSION) {
    throw new Error(`config.json 版本 ${configVersion} 高于当前支持版本 ${CURRENT_CONFIG_VERSION}。`);
  }

  const defaults = defaultConfig(dataDir);
  const bungie = requireRecord(value.bungie, "bungie");
  const data = requireRecord(value.data, "data");
  // 0.0.1～0.0.2 的配置没有 features，早期 AI 配置也缺少后续新增字段。
  // 迁移阶段允许缺少历史字段并生成当前配置；分区存在但类型错误仍然拒绝。
  const ai = optionalRecord(value.ai, "ai");
  const features = optionalRecord(value.features, "features");
  rejectUnknownFields(bungie, ["api_key", "client_id", "client_secret", "redirect_uri"], "bungie");
  rejectUnknownFields(data, ["data_dir", "manifest_language"], "data");
  rejectUnknownFields(ai, ["protocol", "provider", "api_key", "model", "base_url", "data_sharing_consent", "enable_lightgg", "force_lightgg"], "ai");
  if (ai.enable_lightgg !== undefined) requireBoolean(ai.enable_lightgg, "ai.enable_lightgg");
  if (ai.force_lightgg !== undefined) requireBoolean(ai.force_lightgg, "ai.force_lightgg");
  // 兼容旧配置中的本地写操作开关；写操作现在只受 Bungie 权限和操作确认约束。
  rejectUnknownFields(features, ["write_actions_enabled", "color_mode", "density", "interface_locale", "manifest_language_follows_interface"], "features");
  if (features.write_actions_enabled !== undefined) {
    requireBoolean(features.write_actions_enabled, "features.write_actions_enabled");
  }
  if (configVersion === CURRENT_CONFIG_VERSION && hasMissingCurrentFields(bungie, data, ai, features)) {
    throw new Error("config.json 已标记为当前版本，但缺少必要字段；请恢复迁移备份后重试。");
  }

  const config: D2Config = {
    bungie: {
      api_key: requireStringOrDefault(bungie.api_key, defaults.bungie.api_key, "bungie.api_key"),
      client_id: requireStringOrDefault(bungie.client_id, defaults.bungie.client_id, "bungie.client_id"),
      client_secret: requireStringOrDefault(bungie.client_secret, defaults.bungie.client_secret, "bungie.client_secret"),
      redirect_uri: normalizeRedirectUri(
        requireStringOrDefault(bungie.redirect_uri, defaults.bungie.redirect_uri, "bungie.redirect_uri")
      )
    },
    data: {
      data_dir: requireStringOrDefault(data.data_dir, defaults.data.data_dir, "data.data_dir"),
      manifest_language: requireStringOrDefault(data.manifest_language, defaults.data.manifest_language, "data.manifest_language")
    },
    ai: {
      protocol: requireEnum(
        resolveAiProtocol(ai),
        "ai.protocol",
        ["", "openai_responses", "openai_chat_completions", "anthropic_messages"]
      ),
      api_key: requireStringOrDefault(ai.api_key, defaults.ai.api_key, "ai.api_key"),
      model: requireStringOrDefault(ai.model, defaults.ai.model, "ai.model"),
      base_url: requireStringOrDefault(ai.base_url, defaults.ai.base_url, "ai.base_url"),
      data_sharing_consent: requireBoolean(
        ai.data_sharing_consent === undefined ? false : ai.data_sharing_consent,
        "ai.data_sharing_consent"
      )
    },
    features: {
      color_mode: requireEnumOrDefault(features.color_mode, defaults.features.color_mode, "features.color_mode", ["light", "dark"]),
      density: requireEnumOrDefault(features.density, defaults.features.density, "features.density", ["compact", "standard", "comfortable"]),
      interface_locale: requireEnumOrDefault(features.interface_locale, defaults.features.interface_locale, "features.interface_locale", ["zh-CN", "en-US"]),
      manifest_language_follows_interface: requireBoolean(
        features.manifest_language_follows_interface === undefined
          ? defaults.features.manifest_language_follows_interface
          : features.manifest_language_follows_interface,
        "features.manifest_language_follows_interface"
      )
    }
  };
  config.data.data_dir = dataDir;

  return {
    config,
    migrated: configVersion !== CURRENT_CONFIG_VERSION
      || ai.provider !== undefined
      || ai.enable_lightgg !== undefined
      || ai.force_lightgg !== undefined
      || features.write_actions_enabled !== undefined
      || hasMissingCurrentFields(bungie, data, ai, features)
  };
}

function hasMissingCurrentFields(
  bungie: Record<string, unknown>,
  data: Record<string, unknown>,
  ai: Record<string, unknown>,
  features: Record<string, unknown>
): boolean {
  return sectionMissing(bungie, ["api_key", "client_id", "client_secret", "redirect_uri"])
    || sectionMissing(data, ["data_dir", "manifest_language"])
    || sectionMissing(ai, ["protocol", "api_key", "model", "base_url", "data_sharing_consent"])
    || sectionMissing(features, ["color_mode", "density", "interface_locale", "manifest_language_follows_interface"]);
}

function sectionMissing(section: Record<string, unknown>, fields: readonly string[]): boolean {
  return fields.some((field) => section[field] === undefined);
}

function persistMigratedConfig(path: string, config: D2Config): void {
  const backupPath = `${path}.pre-migration-${migrationTimestamp()}.bak`;
  const tempPath = `${path}.migration-${process.pid}.tmp`;
  const originalTempPath = `${path}.migration-original-${process.pid}.tmp`;
  const serialized = `${JSON.stringify({ ...config, config_version: CURRENT_CONFIG_VERSION }, null, 2)}\n`;

  copyFileSync(path, backupPath);
  try {
    writeFileSync(tempPath, serialized, "utf8");
    renameSync(path, originalTempPath);
    renameSync(tempPath, path);
  } catch (error) {
    if (!existsSync(path) && existsSync(originalTempPath)) {
      renameSync(originalTempPath, path);
    }
    throw error;
  } finally {
    try {
      if (existsSync(tempPath)) unlinkSync(tempPath);
      if (existsSync(originalTempPath)) unlinkSync(originalTempPath);
    } catch {
      // Cleanup failures do not invalidate the migrated config or hide the original error.
    }
  }
}

function removeRetiredLightggCache(dataDir: string): void {
  try {
    rmSync(join(dataDir, "cache", "lightgg"), { recursive: true, force: true });
  } catch {
    // 旧功能缓存清理失败不应阻止配置升级或应用启动。
  }
}

function migrationTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function requireConfigVersion(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error("config.json 的 config_version 必须是非负整数。");
  }
  return value as number;
}

function resolveAiProtocol(ai: Record<string, unknown>): unknown {
  if (ai.protocol !== undefined) return ai.protocol;

  const provider = requireStringOrDefault(ai.provider, "", "ai.provider");
  if (!provider || provider === "none") return "";
  if (provider === "openai_responses") return "openai_responses";
  if (provider === "anthropic" || provider === "anthropic_messages") return "anthropic_messages";
  if (["openai", "openai_chat", "openai_compatible", "deepseek", "custom"].includes(provider)) {
    return "openai_chat_completions";
  }
  return provider;
}

function normalizeRedirectUri(value: string): string {
  return value === "http://127.0.0.1:28780/oauth/callback"
    ? "https://127.0.0.1:28780/oauth/callback"
    : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`config.json 缺少 ${field} 配置。`);
  return value;
}

function optionalRecord(value: unknown, field: string): Record<string, unknown> {
  if (value === undefined) return {};
  return requireRecord(value, field);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`config.json 的 ${field} 必须是字符串。`);
  return value;
}

function requireStringOrDefault(value: unknown, fallback: string, field: string): string {
  return requireString(value === undefined ? fallback : value, field);
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new Error(`config.json 的 ${field} 必须是布尔值。`);
  return value;
}

function requireEnum<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(`config.json 的 ${field} 值无效。`);
  }
  return value as T;
}

function requireEnumOrDefault<T extends string>(
  value: unknown,
  fallback: T,
  field: string,
  allowed: readonly T[]
): T {
  return requireEnum(value === undefined ? fallback : value, field, allowed);
}

function rejectUnknownFields(value: Record<string, unknown>, allowed: readonly string[], section: string): void {
  const allowedFields = new Set(allowed);
  const unknown = Object.keys(value).find((field) => !allowedFields.has(field));
  if (unknown) throw new Error(`config.json 的 ${section} 包含未知字段 ${unknown}。`);
}
