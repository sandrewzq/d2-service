import type { D2Config } from "../config/schema.js";
import { isAiSettingsConfigured } from "../ai/settings.js";

export type StartupStep = "bungie-config" | "login" | "home";
export type StatusValue = "ready" | "missing" | "skipped";
export type StartupAuthStatus = {
  status: "missing" | "valid" | "invalid";
  message?: string;
};

export type StartupState = {
  nextStep: StartupStep;
  colorMode: D2Config["features"]["color_mode"];
  density?: D2Config["features"]["density"];
  languagePreferences: {
    interfaceLocale: D2Config["features"]["interface_locale"];
    bungieLocale: string;
    followInterfaceLocaleForBungie: boolean;
  };
  cards: {
    bungieConfig: { status: StatusValue; label: string };
    account: { status: StatusValue; label: string };
    manifest: { status: StatusValue; label: string; needsUpdate?: boolean; lastUpdated?: string };
    ai: { status: StatusValue; label: string };
  };
};

export function hasRequiredBungieConfig(config: D2Config): boolean {
  return Boolean(
    config.bungie.api_key.trim()
      && config.bungie.client_id.trim()
      && config.bungie.client_secret.trim()
      && config.bungie.redirect_uri.trim()
  );
}

export function computeStartupState(input: {
  config: D2Config;
  hasToken: boolean;
  hasManifest: boolean;
  manifestCachedAt?: string;
  auth?: StartupAuthStatus;
  now?: Date;
}): StartupState {
  const bungieReady = hasRequiredBungieConfig(input.config);
  const auth = input.auth ?? { status: input.hasToken ? "valid" : "missing" };
  const accountReady = auth.status === "valid";
  const accountLabel = getAccountLabel(auth);
  const aiConfigured = isAiSettingsConfigured(input.config.ai);

  const manifestStatus = input.hasManifest && input.manifestCachedAt
    ? getManifestCardState(input.manifestCachedAt, input.now)
    : { status: input.hasManifest ? "ready" as const : "missing" as const, label: input.hasManifest ? "资料库已初始化" : "资料库未初始化" };

  return {
    nextStep: !bungieReady ? "bungie-config" : !accountReady ? "login" : "home",
    colorMode: input.config.features.color_mode,
    density: input.config.features.density,
    languagePreferences: {
      interfaceLocale: input.config.features.interface_locale,
      bungieLocale: input.config.data.manifest_language,
      followInterfaceLocaleForBungie: input.config.features.manifest_language_follows_interface
    },
    cards: {
      bungieConfig: {
        status: bungieReady ? "ready" : "missing",
        label: bungieReady ? "Bungie 配置已完成" : "需要填写 Bungie 配置"
      },
      account: {
        status: accountReady ? "ready" : "missing",
        label: accountLabel
      },
      manifest: manifestStatus,
      ai: {
        status: aiConfigured ? "ready" : "skipped",
        label: aiConfigured
          ? "AI 已配置"
          : input.config.ai.protocol.trim()
            ? "AI 待确认数据发送"
            : "AI 未配置"
      }
    }
  };
}

function getManifestCardState(
  cachedAtISO: string,
  now?: Date
): { status: StartupState["cards"]["manifest"]["status"]; label: string; needsUpdate: boolean; lastUpdated: string } {
  const lastUpdated = formatChineseDate(cachedAtISO);
  const stale = manifestNeedsRefresh(cachedAtISO, now);

  return {
    status: "ready",
    label: stale
      ? `资料库上次更新于 ${lastUpdated}，每周三凌晨 1:00 重置，建议更新`
      : "资料库已初始化，每周三凌晨 1:00 重置后可更新",
    needsUpdate: stale,
    lastUpdated
  };
}

function getLastWeeklyReset(now: Date): Date {
  const dayOfWeek = now.getUTCDay();
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 17, 0, 0));

  let daysSinceReset: number;
  if (dayOfWeek >= 2) {
    daysSinceReset = dayOfWeek - 2;
    if (daysSinceReset === 0 && now.getTime() < reset.getTime()) {
      daysSinceReset = 7;
    }
  } else {
    daysSinceReset = dayOfWeek + 5;
  }

  reset.setUTCDate(reset.getUTCDate() - daysSinceReset);
  return reset;
}

export function manifestNeedsRefresh(cachedAtISO: string, now?: Date): boolean {
  const cachedAt = new Date(cachedAtISO);
  const lastReset = getLastWeeklyReset(now ?? new Date());
  if (isNaN(cachedAt.getTime())) return false;
  return cachedAt < lastReset;
}

function formatChineseDate(isoString: string): string {
  const d = new Date(isoString);
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric"
  }).formatToParts(d);
  const month = parts.find((part) => part.type === "month")?.value ?? `${d.getUTCMonth() + 1}`;
  const day = parts.find((part) => part.type === "day")?.value ?? `${d.getUTCDate()}`;
  return `${month}月${day}日`;
}

function getAccountLabel(auth: StartupAuthStatus): string {
  if (auth.status === "valid") {
    return "Bungie 账号已登录";
  }

  if (auth.status === "invalid") {
    return auth.message?.trim() || "Bungie 登录已失效，请重新登录";
  }

  return "需要登录 Bungie";
}
