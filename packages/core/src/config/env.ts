import type { ConfigEnv, D2Config } from "./schema.js";

export function applyEnvOverrides(config: D2Config, env: ConfigEnv): D2Config {
  return {
    bungie: {
      api_key: env.BUNGIE_API_KEY ?? config.bungie.api_key,
      client_id: env.BUNGIE_CLIENT_ID ?? config.bungie.client_id,
      client_secret: env.BUNGIE_CLIENT_SECRET ?? config.bungie.client_secret,
      redirect_uri: env.BUNGIE_REDIRECT_URI ?? config.bungie.redirect_uri
    },
    data: {
      data_dir: env.D2_DATA_DIR ?? config.data.data_dir,
      manifest_language: env.D2_MANIFEST_LANGUAGE ?? config.data.manifest_language
    },
    ai: {
      protocol: env.AI_PROTOCOL ?? config.ai.protocol,
      api_key: env.AI_API_KEY ?? config.ai.api_key,
      model: env.AI_MODEL ?? config.ai.model,
      base_url: env.AI_BASE_URL ?? config.ai.base_url
    },
    features: {
      color_mode: parseColorModeEnv(env.D2_COLOR_MODE, config.features.color_mode),
      density: parseDensityEnv(env.D2_UI_DENSITY, config.features.density),
      interface_locale: parseInterfaceLocaleEnv(env.D2_INTERFACE_LOCALE, config.features.interface_locale),
      manifest_language_follows_interface: parseBooleanEnv(
        env.D2_MANIFEST_LANGUAGE_FOLLOWS_INTERFACE,
        config.features.manifest_language_follows_interface
      )
    }
  };
}

function parseColorModeEnv(value: string | undefined, fallback: D2Config["features"]["color_mode"]): D2Config["features"]["color_mode"] {
  if (value === "light" || value === "dark") {
    return value;
  }

  return fallback;
}

function parseDensityEnv(value: string | undefined, fallback: D2Config["features"]["density"]): D2Config["features"]["density"] {
  if (value === "compact" || value === "standard" || value === "comfortable") {
    return value;
  }

  return fallback;
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLocaleLowerCase());
}

function parseInterfaceLocaleEnv(value: string | undefined, fallback: D2Config["features"]["interface_locale"]): D2Config["features"]["interface_locale"] {
  if (value === "zh-CN" || value === "en-US") {
    return value;
  }

  return fallback;
}
