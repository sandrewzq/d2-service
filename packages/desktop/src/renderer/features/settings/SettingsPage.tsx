import {
  SettingsPageContentView,
  type InterfaceLocale,
  type SettingsActionLogResultFilter,
  type SettingsActionLogTypeFilter,
  type SettingsAiAdapter,
  type SettingsBungieConfigInput
} from "@d2-tools/ui";
import { selectSettingsPageModel } from "@d2-tools/app/settings";
import { api } from "../../api/client";
import type { AccountSummary, ActionLogEntry, AppUpdateSnapshot, BackgroundTaskSnapshot, ManifestStatus } from "../../api/types";
import type { LanguagePreferences } from "./diagnosticsModel";
import { useMemo } from "react";

export type { SettingsActionLogResultFilter, SettingsActionLogTypeFilter };

export function SettingsPage(props: {
  interfaceLocale?: InterfaceLocale;
  initialSection?: "overview" | "account" | "library" | "bungie";
  message: string;
  error: string;
  diagnosticDataDir: string;
  appUpdateSnapshot: AppUpdateSnapshot | null;
  manifestStatus: ManifestStatus | null;
  manifestStatusError: string;
  isLoadingManifestStatus: boolean;
  isInitializingManifest: boolean;
  accountSummary: AccountSummary | null;
  accountError: string;
  accountWarning: string;
  isLoadingAccount: boolean;
  lastAccountLoadedAt: Date | null;
  isAiConfigured: boolean;
  onRefreshAccount: () => void;
  onReauthorizeAccount: () => void;
  backgroundTasks: BackgroundTaskSnapshot[];
  actionLog: ActionLogEntry[];
  actionLogResultFilter: SettingsActionLogResultFilter;
  actionLogTypeFilter: SettingsActionLogTypeFilter;
  onAiSettingsSaved: () => void;
  onBungieConfigSaved: () => void;
  onOpenBungiePortal: () => void;
  onOpenDataDir: () => void;
  onCheckAppUpdate: () => void;
  onDownloadAppUpdate: () => void;
  onQuitAndInstallAppUpdate: () => void;
  onOpenAppUpdateDownloadPage: () => void;
  onCopyAppUpdateDiagnostic: () => void;
  onRefreshManifestStatus: () => void;
  onInitializeManifest: () => void;
  onRepairManifest: () => void;
  onExportConfig: () => void;
  onImportConfig: () => void;
  onClearCache: () => void;
  onCopyDataBackupGuide: () => void;
  onCopyDiagnosticsExport: () => void;
  onRefreshDiagnostics: () => void;
  onRefreshActionLog: () => void;
  onActionLogResultFilterChange: (filter: SettingsActionLogResultFilter) => void;
  onActionLogTypeFilterChange: (filter: SettingsActionLogTypeFilter) => void;
  onCopyActionDiagnostic: (entry: ActionLogEntry) => void;
  colorMode: "light" | "dark";
  onColorModeChange: (mode: "light" | "dark") => void;
  density: "compact" | "standard" | "comfortable";
  onDensityChange: (density: "compact" | "standard" | "comfortable") => void;
  languagePreferences: LanguagePreferences;
  onLanguagePreferencesChange: (preferences: LanguagePreferences) => void;
}) {
  const initialSection = (props.initialSection
    ?? (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_D2_VISUAL_SETTINGS_SECTION
    ?? "overview") as Parameters<typeof SettingsPageContentView>[0]["initialSection"];
  const model = useMemo(() => selectSettingsPageModel({
    interfaceLocale: props.interfaceLocale,
    initialSection,
    message: props.message,
    error: props.error,
    diagnosticDataDir: props.diagnosticDataDir,
    appUpdateSnapshot: props.appUpdateSnapshot,
    manifestStatus: props.manifestStatus,
    manifestStatusError: props.manifestStatusError,
    isLoadingManifestStatus: props.isLoadingManifestStatus,
    isInitializingManifest: props.isInitializingManifest,
    accountSummary: props.accountSummary,
    accountError: props.accountError,
    accountWarning: props.accountWarning,
    isLoadingAccount: props.isLoadingAccount,
    lastAccountLoadedAt: props.lastAccountLoadedAt,
    isAiConfigured: props.isAiConfigured,
    backgroundTasks: props.backgroundTasks,
    actionLog: props.actionLog,
    actionLogResultFilter: props.actionLogResultFilter,
    actionLogTypeFilter: props.actionLogTypeFilter,
    languagePreferences: props.languagePreferences
  }), [
    props.interfaceLocale,
    initialSection,
    props.message,
    props.error,
    props.diagnosticDataDir,
    props.appUpdateSnapshot,
    props.manifestStatus,
    props.manifestStatusError,
    props.isLoadingManifestStatus,
    props.isInitializingManifest,
    props.accountSummary,
    props.accountError,
    props.accountWarning,
    props.isLoadingAccount,
    props.lastAccountLoadedAt,
    props.isAiConfigured,
    props.backgroundTasks,
    props.actionLog,
    props.actionLogResultFilter,
    props.actionLogTypeFilter,
    props.languagePreferences
  ]);
  const aiSettingsAdapter = useMemo<SettingsAiAdapter>(() => ({
    load: async () => (await api.getConfig()).ai,
    save: async (ai) => {
      const current = await api.getConfig();
      await api.saveConfig({ ...current, ai });
    },
    listModels: (ai) => api.listAiModels(ai),
    testConnection: () => api.testAiConnection(),
    onSaved: props.onAiSettingsSaved
  }), [props.onAiSettingsSaved]);
  return (
    <SettingsPageContentView
      {...props}
      {...model}
      aiSettingsAdapter={aiSettingsAdapter}
      onLoadBungieConfig={() => api.getConfig()}
      onOpenBungiePortal={props.onOpenBungiePortal}
      onInitializeManifest={props.onInitializeManifest}
      onSaveBungieConfig={async (bungie) => {
        await saveBungieConfig(bungie);
        props.onBungieConfigSaved();
      }}
    />
  );
}

async function saveBungieConfig(bungie: SettingsBungieConfigInput): Promise<void> {
  const current = await api.getConfig();
  await api.saveConfig({
    ...current,
    bungie: {
      ...current.bungie,
      ...bungie
    }
  });
}
