import { api } from "../../api/client";
import type { ActionLogEntry, D2Config } from "../../api/types";
import { formatAssistantCapabilityAuditDiagnostics } from "../../shared/domain/assistant/assistantCapabilityAudit";

export type DiagnosticsBridge = {
  refreshDiagnostics: () => Promise<void>;
};

export type LanguagePreferences = {
  interfaceLocale: D2Config["features"]["interface_locale"];
  bungieLocale: "zh-chs" | "en";
  followInterfaceLocaleForBungie: boolean;
};

export function createDiagnosticsSettingsState() {
  return {
    diagnosticDataDir: "",
    diagnosticManifestVersion: undefined as string | undefined,
    diagnosticError: "",
    isRefreshingDiagnostics: false,
    aiSettings: {
      protocol: "",
      api_key: "",
      model: "",
      base_url: ""
    } as D2Config["ai"],
    colorMode: "light" as D2Config["features"]["color_mode"],
    density: "standard" as D2Config["features"]["density"],
    languagePreferences: {
      interfaceLocale: "zh-CN",
      bungieLocale: "zh-chs",
      followInterfaceLocaleForBungie: true
    } as LanguagePreferences,
    actionLog: [] as ActionLogEntry[],
    actionLogResultFilter: "all" as "all" | "success" | "pending" | "failed",
    actionLogTypeFilter: "all" as ActionLogEntry["action"] | "all"
  };
}

export function createDiagnosticsSettingsModel(input: {
  onConfigChanged: () => void;
  setDiagnosticDataDir: (value: string) => void;
  setDiagnosticManifestVersion: (value: string | undefined) => void;
  setDiagnosticError: (value: string) => void;
  setIsRefreshingDiagnostics: (value: boolean) => void;
  setAiSettings: (value: D2Config["ai"]) => void;
  setColorMode: (value: D2Config["features"]["color_mode"]) => void;
  setDensity: (value: D2Config["features"]["density"]) => void;
  setLanguagePreferences: (value: LanguagePreferences) => void;
  setActionLog: (value: ActionLogEntry[]) => void;
  setSettingsMessage: (value: string) => void;
  setSettingsError: (value: string) => void;
}) {
  async function refreshDiagnostics() {
    input.setIsRefreshingDiagnostics(true);
    input.setDiagnosticError("");

    try {
      const [config, manifest, log] = await Promise.all([
        api.getConfig(),
        api.getManifestStatus(),
        api.getActionLog()
      ]);
      input.setDiagnosticDataDir(config.data.data_dir);
      input.setDiagnosticManifestVersion(manifest.version);
      input.setAiSettings(config.ai);
      input.setColorMode(config.features.color_mode);
      input.setDensity(config.features.density);
      input.setLanguagePreferences(languagePreferencesFromConfig(config));
      input.setActionLog(log);
    } catch (error) {
      input.setDiagnosticError(error instanceof Error ? error.message : "状态诊断失败");
    } finally {
      input.setIsRefreshingDiagnostics(false);
    }
  }

  function handleAiSettingsSaved() {
    input.onConfigChanged();
    void refreshDiagnostics();
  }

  async function saveColorMode(mode: D2Config["features"]["color_mode"]) {
    input.setSettingsError("");
    input.setColorMode(mode);

    try {
      const config = await api.getConfig();
      const nextConfig: D2Config = {
        ...config,
        features: {
          ...config.features,
          color_mode: mode
        }
      };
      const saved = await api.saveConfig(nextConfig);
      input.setColorMode(saved.features.color_mode);
      input.onConfigChanged();
    } catch (error) {
      input.setSettingsError(error instanceof Error ? error.message : "颜色模式保存失败");
      void refreshDiagnostics();
    }
  }

  async function saveDensity(density: D2Config["features"]["density"]) {
    input.setSettingsError("");
    input.setDensity(density);

    try {
      const config = await api.getConfig();
      const saved = await api.saveConfig({
        ...config,
        features: {
          ...config.features,
          density
        }
      });
      input.setDensity(saved.features.density);
      input.onConfigChanged();
    } catch (error) {
      input.setSettingsError(error instanceof Error ? error.message : "信息密度保存失败");
      void refreshDiagnostics();
    }
  }

  async function saveLanguagePreferences(preferences: LanguagePreferences) {
    input.setSettingsMessage("");
    input.setSettingsError("");
    input.setLanguagePreferences(preferences);

    try {
      const config = await api.getConfig();
      const nextConfig: D2Config = {
        ...config,
        data: {
          ...config.data,
          manifest_language: preferences.bungieLocale
        },
        features: {
          ...config.features,
          interface_locale: preferences.interfaceLocale,
          manifest_language_follows_interface: preferences.followInterfaceLocaleForBungie
        }
      };
      const saved = await api.saveConfig(nextConfig);
      input.setLanguagePreferences(languagePreferencesFromConfig(saved));
      input.setSettingsMessage("语言设置已保存，正在后台检查资料库语言数据。");
      input.onConfigChanged();
      await api.getManifestStatus();
    } catch (error) {
      input.setSettingsError(error instanceof Error ? error.message : "语言设置保存失败");
      void refreshDiagnostics();
    }
  }

  return {
    refreshDiagnostics,
    handleAiSettingsSaved,
    saveColorMode,
    saveDensity,
    saveLanguagePreferences
  };
}

export function languagePreferencesFromConfig(config: D2Config): LanguagePreferences {
  const interfaceLocale = config.features.interface_locale === "en-US" ? "en-US" : "zh-CN";
  return {
    interfaceLocale,
    bungieLocale: config.data.manifest_language === "en" ? "en" : "zh-chs",
    followInterfaceLocaleForBungie: config.features.manifest_language_follows_interface
  };
}

export async function loadActionLog(setActionLog: (entries: ActionLogEntry[]) => void, setSettingsError: (value: string) => void) {
  try {
    setActionLog(await api.getActionLog());
  } catch (error) {
    setSettingsError(error instanceof Error ? error.message : "操作日志读取失败");
  }
}

export async function copyDiagnosticsExport(setSettingsMessage: (value: string) => void, setSettingsError: (value: string) => void) {
  setSettingsMessage("");
  setSettingsError("");
  try {
    const diagnostics = await api.exportDiagnostics();
    await navigator.clipboard.writeText([
      diagnostics,
      "",
      formatAssistantCapabilityAuditDiagnostics()
    ].join("\n"));
    setSettingsMessage("已复制脱敏诊断导出");
  } catch (error) {
    setSettingsError(error instanceof Error ? error.message : "诊断导出失败");
  }
}

export async function copyDataBackupGuide(
  dataDir: string,
  setSettingsMessage: (value: string) => void,
  setSettingsError: (value: string) => void
) {
  setSettingsMessage("");
  setSettingsError("");
  try {
    await navigator.clipboard.writeText(buildDataBackupGuide(dataDir));
    setSettingsMessage("已复制备份/迁移说明");
  } catch {
    setSettingsError("复制失败，请检查系统剪贴板权限");
  }
}

export function buildDataBackupGuide(dataDir: string): string {
  const normalizedDataDir = dataDir || "当前未读取到数据目录，请先刷新诊断状态";
  return [
    "d2-tools 数据备份与迁移",
    "",
    `数据目录：${normalizedDataDir}`,
    "",
    "推荐备份：",
    "1. 在设置页选择“创建便携备份”。",
    "2. 便携备份包含偏好、愿望单、目标规则、独立装备目标、本地标签、本地方案和我的推荐，不包含账号令牌、Bungie/AI 密钥、Manifest 资料库、缓存或日志；旧版本攻略 JSON 仅作为遗留数据保留，不再参与应用运行。",
    "3. 把备份文件保存到安全位置，再安装新版或迁移电脑。",
    "",
    "恢复 / 迁移：",
    "1. 在目标电脑安装并首次启动 d2-tools。",
    "2. 在设置页选择“恢复便携备份”，确认后应用会先创建本机回滚备份。",
    "3. 重启 d2-tools，重新登录 Bungie，并填写需要的 Bungie/AI 密钥。",
    "4. 检查愿望单、本地标签、目标规则和本地方案。",
    "",
    "高级完整复制：",
    "如需保留账号令牌，可在完全关闭 d2-tools 后复制整个数据目录。该目录包含账号令牌和密钥，只能保存在可信位置。",
    "",
    "诊断：",
    "设置页的脱敏诊断导出不包含 token、client secret 或 API Key，排查问题时可一并复制。"
  ].join("\n");
}

export async function copyActionDiagnostic(entry: ActionLogEntry, setSettingsMessage: (value: string) => void, setSettingsError: (value: string) => void) {
  try {
    await navigator.clipboard.writeText(buildActionDiagnosticText(entry));
    setSettingsMessage("已复制操作诊断");
  } catch {
    setSettingsError("复制失败，请检查系统剪贴板权限");
  }
}

function buildActionDiagnosticText(entry: ActionLogEntry): string {
  return [
    "d2-tools 写操作诊断",
    `时间：${entry.created_at}`,
    `操作：${entry.action}`,
    `结果：${actionLogResultLabel(entry)}`,
    `物品：${entry.item_name ?? "-"}`,
    `物品实例：${entry.item_instance_id ?? "-"}`,
    `角色：${entry.character_id ?? "-"}`,
    `计划：${entry.plan_id ?? "-"}`,
    `确认：${entry.confirmation_id ?? "-"}`,
    `执行：${entry.execution_id ?? "-"}`,
    `步骤：${entry.step_id ?? "-"}`,
    `验证：${entry.verification_status ?? "-"}`,
    `信息：${entry.message ?? "-"}`,
    "",
    "说明：这段诊断不会包含 token、client secret 或 API Key。"
  ].join("\n");
}

function actionLogResultLabel(entry: ActionLogEntry): string {
  if (entry.verification_status === "verified") return "已确认";
  if (entry.verification_status === "partial") return "部分完成";
  if (entry.verification_status === "unavailable") return "不可用";
  if (entry.verification_status === "mismatch") return "不一致";
  if (
    entry.ok
    && entry.action !== "execution-verification"
    && /请求已受理|正在确认/.test(entry.message ?? "")
  ) return "已受理";
  return entry.ok ? "成功" : "失败";
}
