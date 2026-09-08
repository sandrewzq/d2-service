export type D2Config = {
  bungie: {
    api_key: string;
    client_id: string;
    client_secret: string;
    redirect_uri: string;
  };
  data: {
    data_dir: string;
    manifest_language: string;
  };
  ai: {
    protocol: string;
    api_key: string;
    model: string;
    base_url: string;
  };
  features: {
    color_mode: "light" | "dark";
    density: "compact" | "standard" | "comfortable";
    interface_locale: "zh-CN" | "en-US";
    manifest_language_follows_interface: boolean;
  };
};

export type ConfigEnv = Partial<Record<
  | "BUNGIE_API_KEY"
  | "BUNGIE_CLIENT_ID"
  | "BUNGIE_CLIENT_SECRET"
  | "BUNGIE_REDIRECT_URI"
  | "D2_DATA_DIR"
  | "D2_MANIFEST_LANGUAGE"
  | "D2_COLOR_MODE"
  | "D2_UI_DENSITY"
  | "D2_INTERFACE_LOCALE"
  | "D2_MANIFEST_LANGUAGE_FOLLOWS_INTERFACE"
  | "AI_PROTOCOL"
  | "AI_API_KEY"
  | "AI_MODEL"
  | "AI_BASE_URL",
  string
>>;
