import type { D2Config } from "./schema.js";

export function defaultConfig(dataDir: string): D2Config {
  return {
    bungie: {
      api_key: "",
      client_id: "",
      client_secret: "",
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
      base_url: ""
    },
    features: {
      color_mode: "light",
      density: "standard",
      interface_locale: "zh-CN",
      manifest_language_follows_interface: true
    }
  };
}
