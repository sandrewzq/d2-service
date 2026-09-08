import { SettingsPage } from "../../features/settings/SettingsPage";
import { api } from "../../api/client";
import { useBackgroundTasks } from "../../shared/hooks/useBackgroundTasks";
import { useAccountSummaryStore } from "../../shared/stores/accountEntityStore";
import { useDesktopMenuSession } from "./DesktopMenuProviderContext";
import { useEffect } from "react";

export function SettingsMenuProvider() {
  const session = useDesktopMenuSession();
  const diagnostics = session.diagnostics;
  const account = session.account;
  const accountSummary = useAccountSummaryStore();
  // 完整任务历史只在设置页实际挂载时订阅。
  const { backgroundTasks } = useBackgroundTasks();

  useEffect(() => {
    void diagnostics.loadActionLog();
  }, []);

  return (
    <SettingsPage
      interfaceLocale={diagnostics.languagePreferences.interfaceLocale}
      initialSection={session.settingsInitialSection}
      message={diagnostics.settingsMessage}
      error={diagnostics.settingsError}
      diagnosticDataDir={diagnostics.diagnosticDataDir}
      appUpdateSnapshot={diagnostics.appUpdateSnapshot}
      manifestStatus={diagnostics.manifestStatus}
      manifestStatusError={diagnostics.manifestStatusError}
      isLoadingManifestStatus={diagnostics.isLoadingManifestStatus}
      isInitializingManifest={diagnostics.isInitializingManifest}
      accountSummary={accountSummary}
      accountError={account.accountError}
      accountWarning={account.accountWarning}
      isLoadingAccount={account.isLoadingAccount}
      lastAccountLoadedAt={session.lastAccountLoadedAt}
      isAiConfigured={session.home.isAiConfigured}
      onRefreshAccount={session.refreshAccountManually}
      onReauthorizeAccount={() => void account.loginBungie()}
      backgroundTasks={backgroundTasks}
      actionLog={diagnostics.actionLog}
      actionLogResultFilter={diagnostics.actionLogResultFilter}
      actionLogTypeFilter={diagnostics.actionLogTypeFilter}
      onAiSettingsSaved={diagnostics.handleAiSettingsSaved}
      onBungieConfigSaved={session.onConfigChanged}
      onOpenBungiePortal={() => void api.openExternal("https://www.bungie.net/en/Application")}
      onOpenLegalDocument={(document) => void api.openLegalDocument(document)}
      onOpenDataDir={() => void api.openDataDir()}
      onCheckAppUpdate={() => void diagnostics.checkAppUpdate()}
      onDownloadAppUpdate={() => void diagnostics.downloadAppUpdate()}
      onQuitAndInstallAppUpdate={() => void diagnostics.quitAndInstallAppUpdate()}
      onOpenAppUpdateDownloadPage={() => void diagnostics.openAppUpdateDownloadPage()}
      onCopyAppUpdateDiagnostic={() => void diagnostics.copyAppUpdateDiagnostic()}
      onRefreshManifestStatus={() => void diagnostics.refreshManifestStatus()}
      onInitializeManifest={() => void diagnostics.initializeManifest()}
      onRepairManifest={() => void diagnostics.repairManifest()}
      onExportConfig={() => void diagnostics.exportConfig()}
      onImportConfig={() => void diagnostics.importConfig()}
      onClearCache={() => void diagnostics.clearCache()}
      onCopyDataBackupGuide={() => void diagnostics.copyDataBackupGuide()}
      onCopyDiagnosticsExport={() => void diagnostics.copyDiagnosticsExport()}
      onRefreshDiagnostics={() => void diagnostics.refreshDiagnostics()}
      onRefreshActionLog={() => void diagnostics.loadActionLog()}
      onActionLogResultFilterChange={diagnostics.setActionLogResultFilter}
      onActionLogTypeFilterChange={diagnostics.setActionLogTypeFilter}
      onCopyActionDiagnostic={(entry) => void diagnostics.copyActionDiagnostic(entry)}
      colorMode={diagnostics.colorMode}
      onColorModeChange={(mode) => {
        if (mode !== diagnostics.colorMode) void diagnostics.toggleColorMode();
      }}
      density={diagnostics.density}
      onDensityChange={(density) => {
        if (density !== diagnostics.density) void diagnostics.saveDensity(density);
      }}
      languagePreferences={diagnostics.languagePreferences}
      onLanguagePreferencesChange={(preferences) => void diagnostics.saveLanguagePreferences(preferences)}
    />
  );
}
