import { api } from "../../api/client";
import type { ActionLogEntry } from "../../api/types";
import {
  copyActionDiagnostic,
  copyDataBackupGuide,
  copyDiagnosticsExport,
  createDiagnosticsSettingsModel,
  loadActionLog
} from "./diagnosticsModel";
import {
  useActionLogState,
  useAiSettingsState,
  useColorModeState,
  useDensityState,
  useDiagnosticsStatusState,
  useLanguagePreferencesState
} from "./useDiagnosticsSettingsState";
import { useAppUpdateFlow } from "./useAppUpdateFlow";
import { useBackgroundTaskSummariesByTypes } from "../../shared/hooks/useBackgroundTasks";
import { useManifestStatus } from "../../shared/hooks/useManifestStatus";

const shellBackgroundTaskTypes = [
  "app-update-check",
  "app-update-download",
  "manifest-version-check",
  "manifest-update",
  "manifest-repair"
] as const;

export function useDiagnosticsSettings(input: {
  onConfigChanged: () => void;
  initialColorMode?: "light" | "dark";
  initialDensity?: "compact" | "standard" | "comfortable";
  initialLanguagePreferences?: {
    interfaceLocale: "zh-CN" | "en-US";
    bungieLocale: string;
    followInterfaceLocaleForBungie: boolean;
  };
}) {
  const diagnosticsStatus = useDiagnosticsStatusState();
  const aiSettingsState = useAiSettingsState();
  const actionLogState = useActionLogState();
  const appUpdateFlow = useAppUpdateFlow();
  // 根 Shell 只订阅会出现在全局状态区的任务。账号写后同步等高频任务
  // 留在对应功能域，避免每次进度变化重建整个菜单 Context。
  const backgroundTaskState = useBackgroundTaskSummariesByTypes(shellBackgroundTaskTypes);
  const manifestStatusState = useManifestStatus();
  const colorModeState = useColorModeState(input.initialColorMode);
  const densityState = useDensityState(input.initialDensity);
  const languagePreferencesState = useLanguagePreferencesState(normalizeInitialLanguagePreferences(input.initialLanguagePreferences));

  const settingsModel = createDiagnosticsSettingsModel({
    onConfigChanged: input.onConfigChanged,
    setDiagnosticDataDir: diagnosticsStatus.setDiagnosticDataDir,
    setDiagnosticManifestVersion: diagnosticsStatus.setDiagnosticManifestVersion,
    setDiagnosticError: diagnosticsStatus.setDiagnosticError,
    setIsRefreshingDiagnostics: diagnosticsStatus.setIsRefreshingDiagnostics,
    setAiSettings: aiSettingsState.setAiSettings,
    setColorMode: colorModeState.setColorMode,
    setDensity: densityState.setDensity,
    setLanguagePreferences: languagePreferencesState.setLanguagePreferences,
    setActionLog: actionLogState.setActionLog,
    setSettingsMessage: appUpdateFlow.setSettingsMessage,
    setSettingsError: appUpdateFlow.setSettingsError
  });

  return {
    actionLog: actionLogState.actionLog,
    actionLogResultFilter: actionLogState.actionLogResultFilter,
    actionLogTypeFilter: actionLogState.actionLogTypeFilter,
    aiSettings: aiSettingsState.aiSettings,
    activeBackgroundTasks: backgroundTaskState.activeBackgroundTasks,
    backgroundTasks: backgroundTaskState.backgroundTasks,
    checkAppUpdate: appUpdateFlow.checkAppUpdate,
    copyActionDiagnostic: (entry: ActionLogEntry) => copyActionDiagnostic(entry, appUpdateFlow.setSettingsMessage, appUpdateFlow.setSettingsError),
    copyDataBackupGuide: () => copyDataBackupGuide(diagnosticsStatus.diagnosticDataDir, appUpdateFlow.setSettingsMessage, appUpdateFlow.setSettingsError),
    copyDiagnosticsExport: () => copyDiagnosticsExport(appUpdateFlow.setSettingsMessage, appUpdateFlow.setSettingsError),
    copyAppUpdateDiagnostic: appUpdateFlow.copyAppUpdateDiagnostic,
    exportConfig: () => runConfigBackupAction(api.exportConfig, appUpdateFlow.setSettingsMessage, appUpdateFlow.setSettingsError),
    importConfig: () => runConfigBackupAction(api.importConfig, appUpdateFlow.setSettingsMessage, appUpdateFlow.setSettingsError),
    clearCache: () => runConfigBackupAction(api.clearCache, appUpdateFlow.setSettingsMessage, appUpdateFlow.setSettingsError),
    diagnosticDataDir: diagnosticsStatus.diagnosticDataDir,
    diagnosticError: diagnosticsStatus.diagnosticError,
    diagnosticManifestVersion: diagnosticsStatus.diagnosticManifestVersion,
    downloadAppUpdate: appUpdateFlow.downloadAppUpdate,
    handleAiSettingsSaved: settingsModel.handleAiSettingsSaved,
    colorMode: colorModeState.colorMode,
    density: densityState.density,
    languagePreferences: languagePreferencesState.languagePreferences,
    isRefreshingDiagnostics: diagnosticsStatus.isRefreshingDiagnostics,
    initializeManifest: manifestStatusState.initializeManifest,
    isInitializingManifest: manifestStatusState.isInitializingManifest,
    isLoadingManifestStatus: manifestStatusState.isLoadingManifestStatus,
    loadActionLog: () => loadActionLog(actionLogState.setActionLog, appUpdateFlow.setSettingsError),
    manifestTask: manifestStatusState.manifestTask,
    manifestStatus: manifestStatusState.manifestStatus,
    manifestStatusError: manifestStatusState.manifestStatusError,
    openAppUpdateDownloadPage: appUpdateFlow.openAppUpdateDownloadPage,
    quitAndInstallAppUpdate: appUpdateFlow.quitAndInstallAppUpdate,
    refreshManifestStatus: manifestStatusState.refreshManifestStatus,
    repairManifest: manifestStatusState.repairManifest,
    refreshDiagnostics: settingsModel.refreshDiagnostics,
    saveDensity: settingsModel.saveDensity,
    saveLanguagePreferences: settingsModel.saveLanguagePreferences,
    toggleColorMode: () => settingsModel.saveColorMode(colorModeState.colorMode === "light" ? "dark" : "light"),
    toggleInterfaceLocale: () => {
      const interfaceLocale = languagePreferencesState.languagePreferences.interfaceLocale === "zh-CN" ? "en-US" : "zh-CN";
      const bungieLocale = languagePreferencesState.languagePreferences.followInterfaceLocaleForBungie
        ? interfaceLocaleToBungieLocale(interfaceLocale)
        : languagePreferencesState.languagePreferences.bungieLocale;
      return settingsModel.saveLanguagePreferences({
        ...languagePreferencesState.languagePreferences,
        interfaceLocale,
        bungieLocale
      });
    },
    setActionLogResultFilter: actionLogState.setActionLogResultFilter,
    setActionLogTypeFilter: actionLogState.setActionLogTypeFilter,
    settingsError: appUpdateFlow.settingsError,
    settingsMessage: appUpdateFlow.settingsMessage,
    latestBackgroundTask: backgroundTaskState.latestBackgroundTask,
    appUpdateSnapshot: appUpdateFlow.appUpdateSnapshot
  };
}

function normalizeInitialLanguagePreferences(input: {
  interfaceLocale: "zh-CN" | "en-US";
  bungieLocale: string;
  followInterfaceLocaleForBungie: boolean;
} | undefined) {
  if (!input) return undefined;
  return {
    interfaceLocale: input.interfaceLocale,
    bungieLocale: input.bungieLocale === "en" ? "en" as const : "zh-chs" as const,
    followInterfaceLocaleForBungie: input.followInterfaceLocaleForBungie
  };
}

function interfaceLocaleToBungieLocale(locale: "zh-CN" | "en-US"): "zh-chs" | "en" {
  return locale === "en-US" ? "en" : "zh-chs";
}

async function runConfigBackupAction(
  action: () => Promise<{ ok: true; message: string; path?: string }>,
  setSettingsMessage: (message: string) => void,
  setSettingsError: (message: string) => void
): Promise<void> {
  setSettingsMessage("");
  setSettingsError("");

  try {
    const result = await action();
    setSettingsMessage(result.message);
  } catch (error) {
    setSettingsError(error instanceof Error ? error.message : "配置操作失败");
  }
}
