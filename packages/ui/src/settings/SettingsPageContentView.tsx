import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { getLocaleCopy } from "../i18n/copy.js";
import type { InterfaceLocale, SettingsCopy } from "../i18n/types.js";
import { getRovingFocusIndex } from "../interaction/rovingFocus.js";
import { formatFullDateTime } from "../time/formatTime.js";
import { SettingsAiConfigPanel, type SettingsAiAdapter } from "./SettingsAiConfigPanel.js";
import { SettingsButton } from "./SettingsButton.js";
import { SettingsSourcesSection } from "./SettingsSourcesSection.js";
import { ConfirmationDialog } from "../overlay/ConfirmationDialog.js";
import { SystemUpdateProgress, systemUpdateToneForStatus } from "../update/SystemUpdateProgress.js";

type AccountSummary = any;
type ActionLogEntry = any;
type BackgroundTaskSnapshot = any;
type ManifestStatus = any;
type AppUpdateSnapshot = any;

export type SettingsActionLogResultFilter = "all" | "success" | "pending" | "failed";
export type SettingsActionLogTypeFilter =
  | "all"
  | "set-lock"
  | "equip"
  | "insert-socket-plug"
  | "transfer"
  | "postmaster-pull"
  | "loadout-equip"
  | "loadout-snapshot"
  | "loadout-clear"
  | "loadout-update-identifiers"
  | "execution-verification";
export type SettingsDensity = "compact" | "standard" | "comfortable";

export type SettingsLanguagePreferences = {
  interfaceLocale: "zh-CN" | "en-US";
  bungieLocale: "zh-chs" | "en";
  followInterfaceLocaleForBungie: boolean;
};

export type SettingsBungieConfig = {
  bungie: { api_key: string; client_id: string; client_secret: string; redirect_uri: string };
};
export type SettingsBungieConfigInput = SettingsBungieConfig["bungie"];

export type SettingsPageContentViewProps = {
  interfaceLocale?: InterfaceLocale;
  initialSection?: SettingsSectionKey;
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
  aiSettingsAdapter: SettingsAiAdapter;
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
  colorMode?: "light" | "dark";
  onColorModeChange?: (mode: "light" | "dark") => void;
  density?: SettingsDensity;
  onDensityChange?: (density: SettingsDensity) => void;
  languagePreferences: SettingsLanguagePreferences;
  onLanguagePreferencesChange: (preferences: SettingsLanguagePreferences) => void;
  onLoadBungieConfig: () => Promise<SettingsBungieConfig>;
  onOpenBungiePortal: () => void;
  onSaveBungieConfig: (bungie: SettingsBungieConfigInput) => Promise<void>;
};

type SettingsSectionKey = "overview" | "language" | "account" | "library" | "bungie" | "ai" | "backup" | "sources" | "diagnostics";
type StatusTone = "neutral" | "pending" | "ready" | "warning" | "error";

function getSettingsMenu(copy: SettingsCopy): Array<{ key: SettingsSectionKey; label: string; hint: string }> {
  return [
    { key: "overview", ...copy.menu.overview },
    { key: "language", ...copy.menu.language },
    { key: "account", ...copy.menu.account },
    { key: "library", ...copy.menu.library },
    { key: "bungie", ...copy.menu.bungie },
    { key: "ai", ...copy.menu.ai },
    { key: "backup", ...copy.menu.backup },
    { key: "sources", ...copy.menu.sources },
    { key: "diagnostics", ...copy.menu.diagnostics }
  ];
}

function settingsText(copy: SettingsCopy, key: string): string {
  return copy.inline[key] ?? key;
}

export function SettingsPageContentView(props: SettingsPageContentViewProps) {
  const copy = getLocaleCopy(props.interfaceLocale ?? "zh-CN").settings;
  const interfaceLocale = props.interfaceLocale ?? "zh-CN";
  const settingsMenu = getSettingsMenu(copy);
  const initialSection = props.initialSection ?? "overview";
  const resolvedInitialSection: SettingsSectionKey = settingsMenu.some((item) => item.key === initialSection) ? initialSection : "overview";
  const [activeSection, setActiveSection] = useState<SettingsSectionKey>(resolvedInitialSection);
  const [bungieApiKey, setBungieApiKey] = useState("");
  const [bungieClientId, setBungieClientId] = useState("");
  const [bungieClientSecret, setBungieClientSecret] = useState("");
  const [bungieRedirectUri, setBungieRedirectUri] = useState("https://127.0.0.1:28780/oauth/callback");
  const [bungieMessage, setBungieMessage] = useState("");
  const [bungieError, setBungieError] = useState("");
  const [isLoadingBungieConfig, setIsLoadingBungieConfig] = useState(true);
  const [isSavingBungieConfig, setIsSavingBungieConfig] = useState(false);
  const [isAutoPreparingManifest, setIsAutoPreparingManifest] = useState(false);
  const [hasAutoManifestFailure, setHasAutoManifestFailure] = useState(false);
  const appUpdateTask = getAppUpdateTask(props.backgroundTasks);
  const updateUi = getAppUpdateUi(props.appUpdateSnapshot, copy, appUpdateTask);
  const manifestTask = getManifestTask(props.backgroundTasks);
  const libraryUi = getLibraryUi(props.manifestStatus, props.manifestStatusError, props.isLoadingManifestStatus, copy, manifestTask);
  const accountUi = getAccountUi(props.accountSummary, props.accountError, props.accountWarning, props.isLoadingAccount, copy);
  const bungieUi = getBungieUi({ isLoading: isLoadingBungieConfig, apiKey: bungieApiKey, clientId: bungieClientId, clientSecret: bungieClientSecret, redirectUri: bungieRedirectUri }, copy);
  const aiUi = getAiUi(props.isAiConfigured, copy);
  const backgroundTaskUi = getBackgroundTaskUi(props.backgroundTasks, copy);
  const libraryVersion = formatLibraryVersion(props.manifestStatus?.version);

  useEffect(() => {
    setActiveSection(resolvedInitialSection);
  }, [resolvedInitialSection]);

  const manifestIsReady = Boolean(
    props.manifestStatus?.initialized
      && !props.manifestStatus.missing_required_components?.length
  );

  useEffect(() => {
    if (!isAutoPreparingManifest) return;
    if (props.manifestStatusError && !props.isInitializingManifest) {
      setIsAutoPreparingManifest(false);
      setHasAutoManifestFailure(true);
      setBungieMessage("");
      setBungieError("");
      return;
    }
    if (manifestIsReady && !props.isInitializingManifest) {
      setIsAutoPreparingManifest(false);
      setHasAutoManifestFailure(false);
      setBungieError("");
      setBungieMessage(props.accountSummary ? settingsText(copy, "配置和资料库已准备完成。") : "");
    }
  }, [copy, isAutoPreparingManifest, manifestIsReady, props.accountSummary, props.isInitializingManifest, props.manifestStatusError]);

  useEffect(() => {
    let cancelled = false;
    void props.onLoadBungieConfig().then((config) => {
      if (cancelled) return;
      setBungieApiKey(config.bungie.api_key);
      setBungieClientId(config.bungie.client_id);
      setBungieClientSecret(config.bungie.client_secret);
      setBungieRedirectUri(config.bungie.redirect_uri);
    }).catch((error) => {
      if (!cancelled) setBungieError(error instanceof Error ? error.message : settingsText(copy, "Bungie 配置读取失败"));
    }).finally(() => {
      if (!cancelled) setIsLoadingBungieConfig(false);
    });
    return () => { cancelled = true; };
  }, []);

  async function saveBungieConfig() {
    setIsSavingBungieConfig(true);
    setBungieMessage("");
    setBungieError("");
    try {
      if (!bungieApiKey.trim() || !bungieClientId.trim() || !bungieClientSecret.trim()) {
        setBungieError(settingsText(copy, "请完整填写 API Key、Client ID 和 Client Secret 后再保存。"));
        return;
      }
      await props.onSaveBungieConfig({
        api_key: bungieApiKey.trim(),
        client_id: bungieClientId.trim(),
        client_secret: bungieClientSecret.trim(),
        redirect_uri: bungieRedirectUri.trim() || "https://127.0.0.1:28780/oauth/callback"
      });
      if (!manifestIsReady) {
        setIsAutoPreparingManifest(true);
        setHasAutoManifestFailure(false);
        setBungieError("");
        setBungieMessage("");
        props.onInitializeManifest();
      } else {
        setBungieMessage(props.accountSummary ? settingsText(copy, "Bungie 配置已保存。") : "");
      }
    } catch (error) {
      setBungieError(error instanceof Error ? error.message : settingsText(copy, "Bungie 配置保存失败"));
    } finally {
      setIsSavingBungieConfig(false);
    }
  }

  const sectionProps = { copy, interfaceLocale, accountUi, libraryUi, bungieUi, aiUi, backgroundTaskUi, libraryVersion, manifestTask, appUpdateTask, onOpenSources: () => setActiveSection("sources") };

  function handleDirectoryKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    const nextIndex = getRovingFocusIndex({
      key: event.key,
      currentIndex,
      itemCount: settingsMenu.length,
      orientation: "vertical"
    });
    if (nextIndex === null) return;
    event.preventDefault();
    const nextSection = settingsMenu[nextIndex];
    if (!nextSection) return;
    setActiveSection(nextSection.key);
    document.getElementById(`settings-menu-${nextSection.key}`)?.focus();
  }

  return (
    <div className="settings-page" data-reference-id="settings.workspace" data-surface="page">
      <div className="settings-workspace" data-surface="split">
        <aside className="settings-directory" data-reference-id="settings.directory" data-shell-role="side-rail" data-ui-kind="primary-navigation" data-scroll-region="pane" aria-label={copy.menuAriaLabel}>
          <div className="settings-directory-caption" data-ui-part="label" data-info-priority="support" data-text-tone="meta">{settingsText(copy, "设置目录")}</div>
          <nav className="settings-directory-list" data-surface="list" aria-label={copy.menuAriaLabel}>
            {settingsMenu.map((item, index) => (
              <button
                aria-controls={`settings-${item.key}`}
                aria-current={activeSection === item.key ? "page" : undefined}
                className={activeSection === item.key ? "is-active" : undefined}
                data-ui-kind="primary-navigation"
                data-control-variant="quiet"
                id={`settings-menu-${item.key}`}
                key={item.key}
                tabIndex={activeSection === item.key ? 0 : -1}
                type="button"
                onClick={() => setActiveSection(item.key)}
                onKeyDown={(event) => handleDirectoryKeyDown(event, index)}
              >
                <span className="settings-directory-label" data-ui-part="value" data-info-priority="support" data-text-tone="primary">{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>
        <main className="settings-content" data-reference-id="settings.content" data-surface="content-stack">
          {props.message ? <p className="settings-feedback" data-ui-kind="callout" data-ui-part="state" data-info-priority="decision" data-text-tone="status" data-status="success" role="status" aria-live="polite">{props.message}</p> : null}
          {props.error ? <p className="settings-feedback" data-ui-kind="callout" data-ui-part="state" data-info-priority="decision" data-text-tone="status" data-status="error" role="alert">{props.error}</p> : null}
          {activeSection === "overview" ? (
            <OverviewSection
              {...sectionProps}
              updateUi={updateUi}
              appVersion={props.appUpdateSnapshot?.current_version ?? settingsText(copy, "未读取")}
              updateSource={props.appUpdateSnapshot?.update_source_label ?? "GitHub Release"}
              updateCheckedAt={formatUpdateCheckedAt(props.appUpdateSnapshot?.last_checked_at, copy)}
              appUpdateSnapshot={props.appUpdateSnapshot}
              onCheckAppUpdate={props.onCheckAppUpdate}
              onDownloadAppUpdate={props.onDownloadAppUpdate}
              onQuitAndInstallAppUpdate={props.onQuitAndInstallAppUpdate}
              onOpenAppUpdateDownloadPage={props.onOpenAppUpdateDownloadPage}
              onCopyAppUpdateDiagnostic={props.onCopyAppUpdateDiagnostic}
              onOpenAccount={() => setActiveSection("account")}
              onRefreshManifestStatus={props.onRefreshManifestStatus}
              isLoadingManifestStatus={props.isLoadingManifestStatus}
              onOpenDiagnostics={() => setActiveSection("diagnostics")}
            />
          ) : null}
          {activeSection === "language" ? <LanguageSection {...sectionProps} preferences={props.languagePreferences} colorMode={props.colorMode ?? "light"} density={props.density ?? "standard"} onPreferencesChange={props.onLanguagePreferencesChange} onColorModeChange={props.onColorModeChange} onDensityChange={props.onDensityChange ?? (() => undefined)} /> : null}
          {activeSection === "account" ? <AccountSection {...sectionProps} lastAccountLoadedAt={props.lastAccountLoadedAt} accountSummary={props.accountSummary} onRefreshAccount={props.onRefreshAccount} onReauthorizeAccount={props.onReauthorizeAccount} isLoadingAccount={props.isLoadingAccount} /> : null}
          {activeSection === "library" ? <LibrarySection {...sectionProps} manifestStatus={props.manifestStatus} isInitializing={props.isInitializingManifest} onRefresh={props.onRefreshManifestStatus} onInitialize={props.onInitializeManifest} onRepair={props.onRepairManifest} /> : null}
          {activeSection === "bungie" ? <BungieSection copy={copy} bungieUi={bungieUi} dataDir={props.diagnosticDataDir} apiKey={bungieApiKey} clientId={bungieClientId} clientSecret={bungieClientSecret} redirectUri={bungieRedirectUri} isLoading={isLoadingBungieConfig} isSaving={isSavingBungieConfig} isPreparingManifest={isAutoPreparingManifest || props.isInitializingManifest} hasAutoManifestFailure={hasAutoManifestFailure} manifestError={props.manifestStatusError} manifestReady={manifestIsReady} isAccountReady={Boolean(props.accountSummary)} error={bungieError} message={bungieMessage} onApiKeyChange={setBungieApiKey} onClientIdChange={setBungieClientId} onClientSecretChange={setBungieClientSecret} onSave={() => void saveBungieConfig()} onOpenDataDir={props.onOpenDataDir} onOpenBungiePortal={props.onOpenBungiePortal} onLoginBungie={props.onReauthorizeAccount} onRetryManifest={() => { setBungieError(""); setBungieMessage(""); setIsAutoPreparingManifest(true); setHasAutoManifestFailure(false); props.onInitializeManifest(); }} /> : null}
          {activeSection === "ai" ? <SettingsSection id="ai" copy={copy} title={settingsText(copy, "AI 助手")} subtitle={settingsText(copy, "可选能力，不阻断账号、仓库、资料库等本地功能。")} badge={aiUi.statusLabel} tone={aiUi.tone}><SettingsAiConfigPanel adapter={props.aiSettingsAdapter} /></SettingsSection> : null}
          {activeSection === "backup" ? <BackupSection copy={copy} dataDir={props.diagnosticDataDir} onOpenDataDir={props.onOpenDataDir} onExport={props.onExportConfig} onImport={props.onImportConfig} onClearCache={props.onClearCache} onCopyGuide={props.onCopyDataBackupGuide} /> : null}
          {activeSection === "sources" ? <SettingsSourcesSection interfaceLocale={interfaceLocale} /> : null}
          {activeSection === "diagnostics" ? <DiagnosticsSection copy={copy} interfaceLocale={interfaceLocale} entries={filteredActionLog(props.actionLog, props.actionLogResultFilter, props.actionLogTypeFilter).slice(0, 8)} resultFilter={props.actionLogResultFilter} typeFilter={props.actionLogTypeFilter} onResultFilterChange={props.onActionLogResultFilterChange} onTypeFilterChange={props.onActionLogTypeFilterChange} onRefreshDiagnostics={props.onRefreshDiagnostics} onRefreshLog={props.onRefreshActionLog} onCopyExport={props.onCopyDiagnosticsExport} onCopyEntry={props.onCopyActionDiagnostic} /> : null}
        </main>
      </div>
    </div>
  );
}

function SettingsSection(props: { id: string; copy: SettingsCopy; title: string; subtitle: string; badge?: string; tone?: StatusTone; children: ReactNode }) {
  return <section className="settings-section" data-reference-id={`settings.section.${props.id}`} data-surface="section" id={`settings-${props.id}`} aria-labelledby={`settings-menu-${props.id}`}><header className="settings-section-head" data-ui-kind="page-section"><div><h2 data-ui-part="value" data-info-priority="display" data-text-tone="primary">{props.title}</h2><p data-ui-part="detail" data-info-priority="reading" data-text-tone="body">{props.subtitle}</p></div>{props.badge ? <StatusBadge tone={props.tone ?? "neutral"}>{props.badge}</StatusBadge> : null}</header>{props.children}</section>;
}

function SettingsPanel(props: { title: string; subtitle: string; badge?: string; tone?: StatusTone; children: ReactNode }) {
  return <section className="settings-panel" data-surface="section"><header className="settings-panel-head" data-surface="row"><div><h3 data-ui-part="value" data-info-priority="context" data-text-tone="primary">{props.title}</h3><p data-ui-part="detail" data-info-priority="reading" data-text-tone="body">{props.subtitle}</p></div>{props.badge ? <StatusBadge tone={props.tone ?? "neutral"}>{props.badge}</StatusBadge> : null}</header>{props.children}</section>;
}

function statusLevel(tone: StatusTone): "neutral" | "pending" | "success" | "warning" | "error" { return tone === "ready" ? "success" : tone; }
function StatusBadge(props: { tone: StatusTone; children: ReactNode }) { const status = statusLevel(props.tone); return <span className="settings-status-badge" data-ui-kind="status-chip" data-ui-part="state" data-info-priority="support" data-text-tone="status" data-status={status}>{props.children}</span>; }
function MetricGrid(props: { children: ReactNode; variant?: "overview" | "update" | "summary" }) { return <div className={`settings-metric-grid settings-${props.variant ?? "summary"}-metrics`} data-reference-id="settings.metrics" data-surface="frame" data-ui-kind="status-matrix">{props.children}</div>; }
function Metric(props: { label: string; value: string; detail: string; tone?: StatusTone; valueKind?: "fact" | "status" }) { const isStatus = props.valueKind === "status"; const status = isStatus ? statusLevel(props.tone ?? "neutral") : undefined; return <div className="settings-metric" data-surface="row" data-ui-kind="status-matrix-cell" data-status={status}><span data-ui-part="label" data-info-priority="support" data-text-tone="meta">{props.label}</span><strong data-ui-part="value" data-value-kind={isStatus ? "status" : "fact"} data-info-priority={isStatus ? "decision" : "context"} data-text-tone={isStatus ? "status" : "primary"} data-status={status}>{props.value}</strong><small data-ui-part="detail" data-info-priority="reading" data-text-tone="body">{props.detail}</small></div>; }
function SettingRow(props: { label: string; detail: string; children: ReactNode }) { return <div className="setting-row" data-surface="row" data-ui-kind="settings-row"><div><strong data-ui-part="value" data-info-priority="context" data-text-tone="primary">{props.label}</strong><p data-ui-part="detail" data-info-priority="reading" data-text-tone="body">{props.detail}</p></div><div className="setting-row-control" data-ui-part="action">{props.children}</div></div>; }
function SettingsActions(props: { children: ReactNode }) { return <div className="settings-actions" data-ui-part="action">{props.children}</div>; }
function VersionTable(props: { children: ReactNode }) { return <div className="settings-version-table" data-surface="list">{props.children}</div>; }
function VersionRow(props: { label: string; value: string }) { return <div className="settings-version-row" data-surface="row"><span data-ui-part="label" data-info-priority="support" data-text-tone="meta">{props.label}</span><strong data-ui-part="value" data-info-priority="reading" data-text-tone="body">{props.value}</strong></div>; }

function OverviewSection(props: any) {
  const { copy, accountUi, libraryUi, bungieUi, aiUi, backgroundTaskUi, libraryVersion, updateUi } = props;
  return <SettingsSection id="overview" copy={copy} title={copy.overview.title} subtitle={copy.overview.subtitle}>
    <MetricGrid variant="overview">
      <Metric label={copy.labels.account} value={accountUi.statusLabel} detail={accountUi.summary} tone={accountUi.tone} valueKind="status" />
      <Metric label={copy.labels.library} value={libraryVersion ?? libraryUi.statusLabel} detail={libraryUi.summary} />
      <Metric label={copy.labels.bungie} value={bungieUi.statusLabel} detail={bungieUi.summary} tone={bungieUi.tone} valueKind="status" />
      <Metric label={copy.labels.ai} value={aiUi.statusLabel} detail={aiUi.summary} tone={aiUi.tone} valueKind="status" />
      <Metric label={copy.labels.appVersion} value={props.appVersion} detail={updateUi.statusLabel} />
      <Metric label={copy.labels.backgroundTasks} value={backgroundTaskUi.statusLabel} detail={backgroundTaskUi.summary} tone={backgroundTaskUi.tone} valueKind="status" />
    </MetricGrid>
    <SettingsPanel title={settingsText(copy, "数据来源、参考项目与鸣谢")} subtitle={settingsText(copy, "公开列出应用使用的官方数据、社区资料和功能参考。") }>
      <div className="settings-sources-summary" data-surface="row">
        <div>
          <strong data-ui-part="value" data-info-priority="context" data-text-tone="primary">{settingsText(copy, "来源边界清晰可查")}</strong>
          <p data-ui-part="detail" data-info-priority="reading" data-text-tone="body">{settingsText(copy, "账号和实时轮换以 Bungie 为准；DIM、D2ArmorPicker 等项目仅作为功能或交互参考。")}</p>
        </div>
        <SettingsButton data-control-variant="secondary" onClick={props.onOpenSources}>{settingsText(copy, "查看来源与鸣谢")}</SettingsButton>
      </div>
    </SettingsPanel>
    <SettingsPanel title={settingsText(copy, "应用更新")} subtitle={settingsText(copy, "检查、下载并安装 d2-tools 新版本。")} badge={updateUi.statusLabel} tone={updateUi.tone}>
      <MetricGrid variant="update"><Metric label={settingsText(copy, "应用版本")} value={props.appVersion} detail={settingsText(copy, "当前安装版本")} /><Metric label={settingsText(copy, "更新来源")} value={props.updateSource} detail={settingsText(copy, "GitHub 连接失败时可打开下载页手动处理")} /><Metric label={settingsText(copy, "上次检查")} value={props.updateCheckedAt} detail={settingsText(copy, "应用更新检查时间")} /></MetricGrid>
      <AppUpdateProgress snapshot={props.appUpdateSnapshot} task={props.appUpdateTask} updateUi={updateUi} copy={copy} interfaceLocale={props.interfaceLocale} />
      <aside className="settings-download-warning" data-ui-kind="callout" data-status="warning" aria-label={settingsText(copy, "防骗提示")}>
        <strong data-ui-part="value" data-info-priority="decision" data-text-tone="status">{settingsText(copy, "防骗提示")}</strong>
        <p data-ui-part="detail" data-info-priority="reading" data-text-tone="body">{settingsText(copy, "官方版本永久免费。如果你是付费购买或通过收费渠道获得，请直接点击下方“打开下载页”获取官方版本。")}</p>
      </aside>
      <AppUpdateActions
        copy={copy}
        snapshot={props.appUpdateSnapshot}
        onCheck={props.onCheckAppUpdate}
        onDownload={props.onDownloadAppUpdate}
        onInstall={props.onQuitAndInstallAppUpdate}
        onOpenDownloadPage={props.onOpenAppUpdateDownloadPage}
        onCopyDiagnostic={props.onCopyAppUpdateDiagnostic}
      />
    </SettingsPanel>
    <SettingsPanel title={copy.overview.commonActionsTitle} subtitle={copy.overview.commonActionsSubtitle}>
      <div className="settings-group" data-surface="list"><SettingRow label={settingsText(copy, "管理账号")} detail={settingsText(copy, "查看装备同步状态、Bungie 登录状态和账号操作说明。")}><SettingsButton data-control-variant="secondary" onClick={props.onOpenAccount}>{settingsText(copy, "打开账号设置")}</SettingsButton></SettingRow>
      <SettingRow label={settingsText(copy, "检查资料库更新")} detail={settingsText(copy, "手动检查不受“每天自动检查一次”限制。")}><SettingsButton data-control-variant="secondary" disabled={props.isLoadingManifestStatus} onClick={props.onRefreshManifestStatus}>{settingsText(copy, "检查资料库版本")}</SettingsButton></SettingRow>
      <SettingRow label={settingsText(copy, "运行诊断")} detail={settingsText(copy, "检查账号、资料库、后台任务和本地数据目录。")}><SettingsButton data-control-variant="secondary" onClick={props.onOpenDiagnostics}>{settingsText(copy, "查看诊断")}</SettingsButton></SettingRow></div>
    </SettingsPanel>
  </SettingsSection>;
}

function AppUpdateActions(props: {
  copy: SettingsCopy;
  snapshot: AppUpdateSnapshot | null;
  onCheck: () => void;
  onDownload: () => void;
  onInstall: () => void;
  onOpenDownloadPage: () => void;
  onCopyDiagnostic: () => void;
}) {
  const [isInstallConfirmationOpen, setIsInstallConfirmationOpen] = useState(false);
  const status = props.snapshot?.status ?? "idle";
  const version = props.snapshot?.downloaded_version ?? props.snapshot?.available_version ?? "";
  const isChecking = status === "checking";
  const isDownloading = status === "downloading";
  const isDownloadError = status === "error" && props.snapshot?.operation_id?.includes(":download:");

  function openInstallConfirmation() {
    setIsInstallConfirmationOpen(true);
  }

  function cancelInstallConfirmation() {
    setIsInstallConfirmationOpen(false);
  }

  function confirmInstall() {
    setIsInstallConfirmationOpen(false);
    props.onInstall();
  }

  return (
    <>
      <div className="settings-action-row" aria-live="polite">
        <SettingsActions>
          {status === "available" ? <SettingsButton data-control-variant="primary" onClick={props.onDownload}>{settingsText(props.copy, "下载更新")}</SettingsButton> : null}
          {isDownloadError ? <SettingsButton data-control-variant="primary" onClick={props.onDownload}>{settingsText(props.copy, "重试下载")}</SettingsButton> : null}
          {status === "downloaded" ? <SettingsButton data-control-variant="primary" onClick={openInstallConfirmation}>{settingsText(props.copy, "重启并安装")}</SettingsButton> : null}
          {status === "idle" || status === "not_available" || (status === "error" && !isDownloadError) ? <SettingsButton data-control-variant={status === "error" ? "primary" : "secondary"} disabled={isChecking} aria-busy={isChecking} onClick={props.onCheck}>{status === "error" ? settingsText(props.copy, "重试检查") : settingsText(props.copy, "检查软件版本")}</SettingsButton> : null}
          {isDownloading ? <SettingsButton data-control-variant="secondary" disabled aria-busy="true">{settingsText(props.copy, "下载中")}</SettingsButton> : null}
          {status === "available" || status === "downloading" || status === "error" ? <SettingsButton data-control-variant="secondary" onClick={props.onOpenDownloadPage}>{settingsText(props.copy, "打开下载页")}</SettingsButton> : null}
          {status !== "checking" && status !== "downloading" ? <SettingsButton data-control-variant="secondary" onClick={props.onCopyDiagnostic}>{settingsText(props.copy, "复制更新诊断")}</SettingsButton> : null}
        </SettingsActions>
      </div>
      {isInstallConfirmationOpen ? (
        <ConfirmationDialog
          title={settingsText(props.copy, "重启并安装应用更新")}
          description={`${settingsText(props.copy, "将关闭 d2-tools 并安装版本")} ${version || settingsText(props.copy, "已下载版本")}，${settingsText(props.copy, "安装完成后应用会自动重新打开。")}`}
          confirmLabel={settingsText(props.copy, "重启并安装")}
          cancelLabel={settingsText(props.copy, "稍后处理")}
          onCancel={cancelInstallConfirmation}
          onConfirm={confirmInstall}
        />
      ) : null}
    </>
  );
}

function AppUpdateProgress(props: {
  snapshot: AppUpdateSnapshot | null;
  task: BackgroundTaskSnapshot | null;
  updateUi: { statusLabel: string; summary: string; tone: StatusTone };
  copy: SettingsCopy;
  interfaceLocale: InterfaceLocale;
}) {
  const status = props.snapshot?.status ?? "idle";
  if (status === "idle" || status === "not_available") return null;

  const task = props.task;
  const isActive = status === "checking" || status === "downloading" || task?.status === "retrying";
  const retryDetail = task?.status === "retrying" && task.next_retry_at
    ? `${settingsText(props.copy, "下次重试")}：${formatDateTime(task.next_retry_at, props.copy)}`
    : undefined;
  const tone = task?.status === "retrying"
    ? "warning"
    : status === "downloaded"
      ? "warning"
      : status === "error"
        ? "error"
        : "pending";

  return (
    <aside className="settings-feedback settings-system-update" data-ui-kind="callout" data-status={statusLevel(tone)} role={isActive ? "status" : undefined} aria-live={isActive ? "polite" : undefined}>
      <SystemUpdateProgress
        variant="detail"
        interfaceLocale={props.interfaceLocale}
        tone={tone}
        title={settingsText(props.copy, "应用更新")}
        statusLabel={task?.status === "retrying" ? settingsText(props.copy, "等待重试") : props.updateUi.statusLabel}
        message={task?.status === "retrying" ? task.error ?? task.message ?? props.updateUi.summary : props.updateUi.summary}
        detail={retryDetail}
        progressPercent={task?.progress_percent ?? props.snapshot?.progress_percent}
        indeterminate={isActive && task?.progress_percent === undefined && props.snapshot?.progress_percent === undefined}
        progressCurrentBytes={task?.progress_current_bytes}
        progressTotalBytes={task?.progress_total_bytes}
        progressBytesPerSecond={task?.progress_bytes_per_second}
      />
    </aside>
  );
}

function LanguageSection(props: any) {
  const { copy, preferences } = props;
  function update(patch: Partial<SettingsLanguagePreferences>) {
    const next = { ...preferences, ...patch };
    if (next.followInterfaceLocaleForBungie) next.bungieLocale = interfaceLocaleToBungieLocale(next.interfaceLocale);
    props.onPreferencesChange(next);
  }
  return <SettingsSection id="language" copy={copy} title={copy.menu.language.label} subtitle={settingsText(copy, "界面语言、资料库语言、主题与信息密度分别设置。")} badge={preferences.interfaceLocale === "zh-CN" ? settingsText(copy, "中文") : "English"}>
    <SettingRow label={settingsText(copy, "界面语言")} detail={settingsText(copy, "控制菜单、按钮、设置、状态、诊断和空状态文案。")}><select data-ui-kind="field" aria-label={settingsText(copy, "界面语言")} value={preferences.interfaceLocale} onChange={(event) => update({ interfaceLocale: event.target.value as SettingsLanguagePreferences["interfaceLocale"] })}><option value="zh-CN">{settingsText(copy, "中文")}</option><option value="en-US">English</option></select></SettingRow>
    <SettingRow label={settingsText(copy, "资料库语言")} detail={settingsText(copy, "控制装备名、Perk、活动名等 Bungie Manifest 数据；后续资料库读取或更新时生效。")}><select data-ui-kind="field" aria-label={settingsText(copy, "资料库语言")} disabled={preferences.followInterfaceLocaleForBungie} value={preferences.bungieLocale} onChange={(event) => update({ bungieLocale: event.target.value as SettingsLanguagePreferences["bungieLocale"] })}><option value="zh-chs">{settingsText(copy, "简体中文")} zh-chs</option><option value="en">English en</option></select></SettingRow>
    <SettingRow label={settingsText(copy, "跟随界面语言")} detail={settingsText(copy, "开启后，切换界面语言会同步切换资料库语言。")}><label className="setting-toggle" data-ui-kind="switch"><input checked={preferences.followInterfaceLocaleForBungie} type="checkbox" onChange={(event) => update({ followInterfaceLocaleForBungie: event.target.checked })} />{settingsText(copy, "跟随")}</label></SettingRow>
    <SettingRow label={settingsText(copy, "界面主题")} detail={settingsText(copy, "切换整个工作区的深色或浅色视觉。")}><select data-ui-kind="field" aria-label={settingsText(copy, "界面主题")} disabled={!props.onColorModeChange} value={props.colorMode} onChange={(event) => props.onColorModeChange?.(event.target.value as "light" | "dark")}><option value="dark">{settingsText(copy, "深色")}</option><option value="light">{settingsText(copy, "浅色")}</option></select></SettingRow>
    <SettingRow label={settingsText(copy, "信息密度")} detail={settingsText(copy, "调整列表、卡片和操作区的垂直间距，不改变功能与数据量。")}><select data-ui-kind="field" aria-label={settingsText(copy, "信息密度")} value={props.density} onChange={(event) => props.onDensityChange(event.target.value as SettingsDensity)}><option value="compact">{settingsText(copy, "紧凑")}</option><option value="standard">{settingsText(copy, "标准")}</option><option value="comfortable">{settingsText(copy, "舒适")}</option></select></SettingRow>
    <p className="settings-button-note" data-ui-part="detail" data-info-priority="reading" data-text-tone="body">{settingsText(copy, "语言设置保存后会在后台检查对应资料库语言数据；主题与密度立即生效。")}</p>
  </SettingsSection>;
}

function AccountSection(props: any) {
  const { copy, accountUi, accountSummary } = props;
  return <SettingsSection id="account" copy={copy} title={copy.menu.account.label} subtitle={settingsText(copy, "管理 Bungie 登录，并控制角色装备、背包、仓库和配装的数据同步。")} badge={accountUi.statusLabel} tone={accountUi.tone}>
    <MetricGrid><Metric label={settingsText(copy, "当前账号")} value={accountSummary?.account_name ?? settingsText(copy, "未登录")} detail={accountSummary ? settingsText(copy, "Bungie 登录正常") : settingsText(copy, "登录后可同步装备数据")} /><Metric label={settingsText(copy, "装备数据")} value={accountUi.statusLabel} detail={accountUi.summary} /><Metric label={settingsText(copy, "上次同步")} value={formatAccountLoadedAt(props.lastAccountLoadedAt, accountSummary, copy)} detail={settingsText(copy, "最近一次从游戏同步装备数据的时间")} /><Metric label={settingsText(copy, "自动同步")} value={settingsText(copy, "每 10 分钟")} detail={settingsText(copy, "回到前台或恢复网络后也会补同步")} /></MetricGrid>
    <VersionTable><VersionRow label={settingsText(copy, "打开应用时")} value={settingsText(copy, "自动同步一次装备数据")} /><VersionRow label={settingsText(copy, "应用保持前台")} value={settingsText(copy, "每 10 分钟自动同步一次")} /><VersionRow label={settingsText(copy, "重新回到前台")} value={settingsText(copy, "数据超过 2 分钟时补同步")} /><VersionRow label={settingsText(copy, "需要手动同步时")} value={settingsText(copy, "在游戏内或其他设备移动装备后，或页面显示与游戏不一致时")} /><VersionRow label={settingsText(copy, "需要重新登录时")} value={settingsText(copy, "登录失效、权限异常或需要切换 Bungie 账号时")} /><VersionRow label={settingsText(copy, "同步范围")} value={settingsText(copy, "角色装备、背包、仓库和游戏内配装")} /></VersionTable>
    <div className="settings-group settings-spaced-group" data-surface="list">
      <SettingRow label={settingsText(copy, "同步装备数据")} detail={settingsText(copy, "从游戏更新角色装备、背包、仓库和配装。游戏内或其他设备发生变化后使用。")}><SettingsButton data-control-variant="primary" aria-busy={props.isLoadingAccount} disabled={props.isLoadingAccount} onClick={props.onRefreshAccount}>{settingsText(copy, "同步装备数据")}</SettingsButton></SettingRow>
      <SettingRow label={settingsText(copy, "Bungie 登录")} detail={settingsText(copy, "仅在登录失效、权限异常或需要切换账号时使用；日常更新装备不需要重新登录。")}><SettingsButton data-control-variant="secondary" onClick={props.onReauthorizeAccount}>{settingsText(copy, "重新登录 Bungie")}</SettingsButton></SettingRow>
    </div>
  </SettingsSection>;
}

function LibrarySection(props: any) {
  const { copy, interfaceLocale, libraryUi, libraryVersion, manifestStatus, manifestTask } = props;
  return <SettingsSection id="library" copy={copy} title={copy.menu.library.label} subtitle={settingsText(copy, "装备、Perk、活动和商人数据。")} badge={libraryUi.statusLabel} tone={libraryUi.tone}>
    <MetricGrid><Metric label={settingsText(copy, "资料库日期")} value={libraryVersion ?? settingsText(copy, "未读取")} detail={settingsText(copy, "从完整版本号解析")} /><Metric label={settingsText(copy, "资料完整性")} value={formatLibraryIntegrity(manifestStatus, copy)} detail={settingsText(copy, "用于搜索和详情判断")} /><Metric label={settingsText(copy, "上次更新")} value={formatDateTime(manifestStatus?.cached_at, copy)} detail={settingsText(copy, "成功重建资料库的时间")} /><Metric label={settingsText(copy, "更新规则")} value={settingsText(copy, "每天自动检查一次")} detail={settingsText(copy, "手动检查、立即更新和修复不受限制")} /></MetricGrid>
    <VersionTable><VersionRow label={settingsText(copy, "资料库版本")} value={libraryVersion ?? settingsText(copy, "未读取")} /><VersionRow label={settingsText(copy, "当前版本")} value={manifestStatus?.version ?? settingsText(copy, "未初始化")} /><VersionRow label={settingsText(copy, "最新版本")} value={manifestStatus?.latest_version ?? settingsText(copy, "等待检查")} /><VersionRow label={settingsText(copy, "上次检查")} value={formatDateTime(manifestStatus?.checked_at, copy)} /><VersionRow label={settingsText(copy, "自动检查")} value={settingsText(copy, "启动后或打开资料库状态时触发；同一本地日期只自动检查一次")} /><VersionRow label={settingsText(copy, "自动更新")} value={settingsText(copy, "未初始化、不完整或发现新版时后台更新；失败时保留旧资料库")} /><VersionRow label={settingsText(copy, "手动操作")} value={settingsText(copy, "检查资料库版本、立即更新、修复资料库始终立即执行")} /></VersionTable>
    {manifestTask ? <ManifestTaskStatus task={manifestTask} copy={copy} interfaceLocale={interfaceLocale} /> : null}
    <div className="settings-action-row"><SettingsActions><SettingsButton data-control-variant="secondary" disabled={props.isLoading} onClick={props.onRefresh}>{settingsText(copy, "检查资料库版本")}</SettingsButton><SettingsButton data-control-variant="primary" disabled={props.isInitializing} onClick={props.onInitialize}>{props.isInitializing ? settingsText(copy, "更新中...") : settingsText(copy, "立即更新")}</SettingsButton><SettingsButton data-control-variant="danger" disabled={props.isInitializing} onClick={props.onRepair}>{settingsText(copy, "修复资料库")}</SettingsButton></SettingsActions></div>
  </SettingsSection>;
}

function ManifestTaskStatus(props: { task: BackgroundTaskSnapshot; copy: SettingsCopy; interfaceLocale: InterfaceLocale }) {
  const task = props.task;
  const active = task.status === "queued" || task.status === "running" || task.status === "retrying";
  const status = task.status === "failed" || task.status === "blocked"
    ? "error"
    : task.status === "success"
      ? "success"
      : task.status === "retrying"
        ? "warning"
        : "pending";
  const availability = task.availability === "usable"
    ? settingsText(props.copy, "旧资料库仍可使用，完成后自动切换。")
    : task.availability === "limited"
      ? settingsText(props.copy, "正在切换资料库，当前查询会自动等待。")
      : settingsText(props.copy, "当前没有兼容的旧资料库，搜索和详情需要等待完成。");
  const retry = task.status === "retrying" && task.next_retry_at
    ? `${settingsText(props.copy, "下次重试")}：${formatDateTime(task.next_retry_at, props.copy)}`
    : "";
  return <aside className="settings-feedback settings-manifest-task" data-ui-kind="callout" data-status={status} role={active ? "status" : undefined} aria-live={active ? "polite" : undefined}>
    <SystemUpdateProgress
      variant="detail"
      interfaceLocale={props.interfaceLocale}
      tone={systemUpdateToneForStatus(task.status)}
      title={task.title}
      statusLabel={task.status === "retrying" ? settingsText(props.copy, "等待重试") : task.status === "success" ? settingsText(props.copy, "已完成") : settingsText(props.copy, "更新中")}
      message={task.status === "failed" || task.status === "retrying" ? task.error ?? task.message : task.message}
      detail={`${availability}${retry ? ` ${retry}` : ""}`}
      progressPercent={task.progress_percent}
      indeterminate={active && task.progress_percent === undefined}
      progressCurrentBytes={task.progress_current_bytes}
      progressTotalBytes={task.progress_total_bytes}
      progressBytesPerSecond={task.progress_bytes_per_second}
    />
  </aside>;
}

function BungieSection(props: any) {
  const { copy } = props;
  const disabled = props.isLoading || props.isSaving || props.isPreparingManifest;
  return <SettingsSection id="bungie" copy={copy} title={settingsText(copy, "Bungie 接口配置")} subtitle={settingsText(copy, "应用级接口，不等同于当前登录账号。")} badge={props.bungieUi.statusLabel} tone={props.bungieUi.tone}>
    <div className="settings-config-help" data-ui-kind="callout">
      <h3 data-ui-part="value" data-info-priority="context" data-text-tone="primary">{settingsText(copy, "第一步：创建 Bungie Application")}</h3>
      <p data-ui-part="detail" data-info-priority="reading" data-text-tone="body">{settingsText(copy, "先打开 Bungie 官方开发者页面，登录你的 Bungie 账号，然后创建一个新的 Application。")}</p>
      <SettingsActions>
        <SettingsButton width="content" data-control-variant="secondary" onClick={props.onOpenBungiePortal}>{settingsText(copy, "打开 Bungie 官方开发者页面")}</SettingsButton>
      </SettingsActions>
      <p data-ui-part="detail" data-info-priority="reading" data-text-tone="body">{settingsText(copy, "在 Application 页面中找到下面三个字段，逐个复制到本工具：")}</p>
      <dl>
        <div><dt data-info-priority="support" data-text-tone="primary">API Key</dt><dd data-info-priority="reading" data-text-tone="body">{settingsText(copy, "Bungie Application 页面里的 API Key")}</dd></div>
        <div><dt data-info-priority="support" data-text-tone="primary">Client ID</dt><dd data-info-priority="reading" data-text-tone="body">{settingsText(copy, "Bungie Application 页面里的 Client ID")}</dd></div>
        <div><dt data-info-priority="support" data-text-tone="primary">Client Secret</dt><dd data-info-priority="reading" data-text-tone="body">{settingsText(copy, "Bungie Application 页面里的 Client Secret")}</dd></div>
      </dl>
      <p data-ui-part="detail" data-info-priority="reading" data-text-tone="body">{settingsText(copy, "在 Bungie Application 页面把 OAuth 回调地址填写为：")}<code>https://127.0.0.1:28780/oauth/callback</code></p>
      <p data-ui-part="detail" data-info-priority="support" data-text-tone="meta">{settingsText(copy, "不要填写 Bungie 自动生成的授权地址。Client Secret 只保存在你的电脑上，不要发给别人。")}</p>
    </div>
    <div className="settings-config-fields">
      <label data-info-priority="support" data-text-tone="primary">Bungie API Key<input data-ui-kind="field" disabled={disabled} placeholder={settingsText(copy, "复制 Bungie Application 页面里的 API Key")} type="text" value={props.apiKey} onChange={(event) => props.onApiKeyChange(event.target.value)} /></label>
      <label data-info-priority="support" data-text-tone="primary">Bungie Client ID<input data-ui-kind="field" disabled={disabled} placeholder={settingsText(copy, "复制 Bungie Application 页面里的 Client ID")} value={props.clientId} onChange={(event) => props.onClientIdChange(event.target.value)} /></label>
      <label data-info-priority="support" data-text-tone="primary">Bungie Client Secret<input data-ui-kind="field" disabled={disabled} placeholder={settingsText(copy, "复制 Bungie Application 页面里的 Client Secret")} type="text" value={props.clientSecret} onChange={(event) => props.onClientSecretChange(event.target.value)} /></label>
      <label data-info-priority="support" data-text-tone="primary">{settingsText(copy, "回调地址")}<input data-ui-kind="field" disabled value={props.redirectUri} /></label>
      <label data-info-priority="support" data-text-tone="primary">{settingsText(copy, "数据目录")}<input data-ui-kind="field" disabled value={props.dataDir || settingsText(copy, "未读取到配置目录")} /></label>
    </div>
    <SettingsActions><SettingsButton data-control-variant="primary" disabled={disabled} onClick={props.onSave}>{props.isSaving ? settingsText(copy, "保存中...") : props.isPreparingManifest ? settingsText(copy, "正在准备资料库...") : settingsText(copy, "保存配置")}</SettingsButton><SettingsButton data-control-variant="secondary" onClick={props.onOpenDataDir}>{settingsText(copy, "打开数据目录")}</SettingsButton></SettingsActions>
    {props.isPreparingManifest ? <p className="settings-feedback" data-ui-kind="callout" data-ui-part="state" data-info-priority="decision" data-text-tone="status" data-status="pending" role="status" aria-live="polite">{settingsText(copy, "配置已保存，正在自动准备资料库，请稍候…")}</p> : null}
    {!props.isPreparingManifest && props.hasAutoManifestFailure && props.manifestError ? <div className="settings-feedback" data-ui-kind="callout" data-ui-part="state" data-info-priority="decision" data-text-tone="status" data-status="error" role="alert"><strong>{settingsText(copy, "资料库自动准备失败")}</strong><p>{settingsText(copy, "配置已经保存，不需要重新填写。请检查网络后重试。")}</p><small>{settingsText(copy, "失败原因：")} {props.manifestError}</small><SettingsButton data-control-variant="primary" onClick={props.onRetryManifest}>{settingsText(copy, "重试准备资料库")}</SettingsButton></div> : null}
    {props.bungieUi.tone === "ready" && !props.isAccountReady ? <div className="settings-feedback" data-ui-kind="callout" data-info-priority="decision" data-text-tone="status" data-status="success" role="status" aria-live="polite"><strong>{settingsText(copy, "Bungie 配置已完成，现在可以登录")}</strong><p>{settingsText(copy, "登录不依赖资料库。登录后会先读取账号，资料库继续在后台准备，名称和图标会在准备完成后补齐。")}</p><SettingsButton data-control-variant="primary" onClick={props.onLoginBungie}>{settingsText(copy, "登录 Bungie")}</SettingsButton></div> : null}
    {props.error ? <p className="settings-feedback" data-ui-kind="callout" data-ui-part="state" data-info-priority="decision" data-text-tone="status" data-status="error" role="alert">{props.error}</p> : null}
    {props.message ? <p className="settings-feedback" data-ui-kind="callout" data-ui-part="state" data-info-priority="decision" data-text-tone="status" data-status="success" role="status" aria-live="polite">{props.message}</p> : null}
  </SettingsSection>;
}

function BackupSection(props: any) {
  const { copy } = props;
  return <SettingsSection id="backup" copy={copy} title={copy.menu.backup.label} subtitle={settingsText(copy, "低频但需要可发现的维护能力。")}>
    <div className="settings-group" data-surface="list">
      <SettingRow label={settingsText(copy, "数据目录")} detail={props.dataDir || settingsText(copy, "未读取到配置目录")}><SettingsButton data-control-variant="secondary" onClick={props.onOpenDataDir}>{settingsText(copy, "打开")}</SettingsButton></SettingRow>
      <SettingRow label={settingsText(copy, "创建便携备份")} detail={settingsText(copy, "备份偏好、愿望单、标签和本地方案，不包含账号令牌、密钥、资料库、缓存或日志。")}><SettingsButton data-control-variant="primary" onClick={props.onExport}>{settingsText(copy, "创建备份")}</SettingsButton></SettingRow>
      <SettingRow label={settingsText(copy, "恢复便携备份")} detail={settingsText(copy, "恢复前自动保存本机回滚备份；目标电脑仍需重新登录并填写密钥。")}><SettingsButton data-control-variant="secondary" onClick={props.onImport}>{settingsText(copy, "恢复备份")}</SettingsButton></SettingRow>
      <SettingRow label={settingsText(copy, "清理缓存")} detail={settingsText(copy, "清理临时缓存，不删除账号授权、设置和本地标记。")}><SettingsButton data-control-variant="secondary" onClick={props.onClearCache}>{settingsText(copy, "清理")}</SettingsButton></SettingRow>
      <SettingRow label={settingsText(copy, "迁移说明")} detail={settingsText(copy, "优先使用便携备份；只有需要保留账号令牌时才手动复制整个数据目录。")}><SettingsButton data-control-variant="secondary" onClick={props.onCopyGuide}>{settingsText(copy, "复制备份/迁移说明")}</SettingsButton></SettingRow>
    </div>
  </SettingsSection>;
}

function DiagnosticsSection(props: any) {
  const { copy } = props;
  return <SettingsSection id="diagnostics" copy={copy} title={copy.menu.diagnostics.label} subtitle={settingsText(copy, "默认展示最近关键事件。")}>
    <SettingRow label={settingsText(copy, "诊断摘要")} detail={settingsText(copy, "检查账号、资料库、后台任务和本地数据目录；异常信息可复制为脱敏诊断。")}><SettingsButton data-control-variant="secondary" onClick={props.onCopyExport}>{settingsText(copy, "复制脱敏诊断")}</SettingsButton></SettingRow>
    <div className="settings-log-toolbar">
      <div className="settings-log-filters">
        <label className="compact-field" data-info-priority="support" data-text-tone="meta">{settingsText(copy, "结果")}<select data-ui-kind="field" value={props.resultFilter} onChange={(event) => props.onResultFilterChange(event.target.value as SettingsActionLogResultFilter)}><option value="all">{settingsText(copy, "全部")}</option><option value="success">{settingsText(copy, "成功")}</option><option value="pending">{settingsText(copy, "已受理")}</option><option value="failed">{settingsText(copy, "失败")}</option></select></label>
        <label className="compact-field" data-info-priority="support" data-text-tone="meta">{settingsText(copy, "类型")}<select data-ui-kind="field" value={props.typeFilter} onChange={(event) => props.onTypeFilterChange(event.target.value as SettingsActionLogTypeFilter)}><option value="all">{settingsText(copy, "全部")}</option><option value="set-lock">{settingsText(copy, "锁定状态")}</option><option value="equip">{settingsText(copy, "装备")}</option><option value="insert-socket-plug">{settingsText(copy, "切换武器 Perk")}</option><option value="transfer">{settingsText(copy, "仓库转移")}</option><option value="postmaster-pull">{settingsText(copy, "邮政官取回")}</option><option value="loadout-equip">{settingsText(copy, "应用游戏内配装栏")}</option><option value="loadout-snapshot">{settingsText(copy, "覆盖游戏内配装栏")}</option><option value="loadout-clear">{settingsText(copy, "清空游戏内配装栏")}</option><option value="loadout-update-identifiers">{settingsText(copy, "更新游戏内配装标识")}</option><option value="execution-verification">{settingsText(copy, "执行验证")}</option></select></label>
      </div>
      <SettingsActions><SettingsButton data-control-variant="secondary" onClick={props.onRefreshDiagnostics}>{settingsText(copy, "运行诊断")}</SettingsButton><SettingsButton data-control-variant="secondary" onClick={props.onRefreshLog}>{settingsText(copy, "刷新日志")}</SettingsButton></SettingsActions>
    </div>
    {props.entries.length ? (
      <div className="settings-log-list" data-surface="list">
        {props.entries.map((entry: ActionLogEntry) => {
          const status = actionLogStatusTone(entry);
          const statusLabel = actionLogStatusLabel(entry, copy);
          return <div className="settings-log-entry" data-surface="row" data-ui-kind="operation-log" data-status={status} key={entry.id}>
            <div><strong data-ui-part="value" data-info-priority="context" data-text-tone="primary">{formatActionLogTitle(entry, copy)}</strong><time data-ui-part="detail" data-info-priority="support" data-text-tone="meta">{formatFullDateTime(entry.created_at, "-")}</time></div>
            <span className="settings-log-message" data-ui-part="detail" data-info-priority="reading" data-text-tone="body">{entry.message ?? "-"}{entry.execution_id ? <small title={entry.execution_id}> · {settingsText(copy, "执行")} {formatActionTraceReference(entry.execution_id)}{entry.step_id ? ` / ${settingsText(copy, "步骤")} ${entry.step_id}` : ""}</small> : null}</span>
            <div className="settings-log-actions" data-ui-part="action"><span className="settings-status-badge" data-ui-kind="status-chip" data-ui-part="state" data-info-priority="support" data-text-tone="status" data-status={status}>{statusLabel}</span>{!entry.ok ? <SettingsButton data-control-variant="secondary" onClick={() => props.onCopyEntry(entry)}>{settingsText(copy, "复制诊断")}</SettingsButton> : null}</div>
          </div>;
        })}
      </div>
    ) : <div className="settings-empty" data-surface="empty" data-ui-part="state" data-info-priority="reading" data-text-tone="body">{settingsText(copy, "还没有符合当前筛选条件的写操作记录。")}</div>}
  </SettingsSection>;
}

function getAccountUi(accountSummary: AccountSummary | null, error: string, warning: string, isLoading: boolean, copy: SettingsCopy): { statusLabel: string; summary: string; tone: StatusTone } {
  if (error && accountSummary) return { statusLabel: settingsText(copy, "同步失败"), summary: `${settingsText(copy, "显示上次装备数据")}：${error}`, tone: "error" };
  if (error) return { statusLabel: settingsText(copy, "读取失败"), summary: error, tone: "error" };
  if (isLoading) return accountSummary ? { statusLabel: settingsText(copy, "同步中"), summary: settingsText(copy, "正在同步角色装备、背包、仓库和配装。"), tone: "warning" } : { statusLabel: settingsText(copy, "读取中"), summary: settingsText(copy, "正在读取装备数据。"), tone: "warning" };
  if (warning && accountSummary) return { statusLabel: settingsText(copy, "已同步"), summary: warning, tone: "warning" };
  if (accountSummary) return { statusLabel: settingsText(copy, "已同步"), summary: `${settingsText(copy, "角色")} ${accountSummary.characters.length} ${settingsText(copy, "个")}，${settingsText(copy, "仓库")} ${accountSummary.vault.item_count} ${settingsText(copy, "件")}`, tone: "ready" };
  return { statusLabel: settingsText(copy, "未登录"), summary: settingsText(copy, "登录后可同步角色装备、背包和仓库。"), tone: "neutral" };
}

function getBungieUi(input: { isLoading: boolean; apiKey: string; clientId: string; clientSecret: string; redirectUri: string }, copy: SettingsCopy): { statusLabel: string; summary: string; tone: "neutral" | "ready" | "warning" } {
  if (input.isLoading) return { statusLabel: settingsText(copy, "读取中"), summary: settingsText(copy, "正在读取本地 Bungie 应用配置。"), tone: "neutral" };
  if (input.apiKey.trim() && input.clientId.trim() && input.clientSecret.trim() && input.redirectUri.trim()) return { statusLabel: settingsText(copy, "已配置"), summary: settingsText(copy, "接口配置与回调地址可用"), tone: "ready" };
  return { statusLabel: settingsText(copy, "未配置"), summary: settingsText(copy, "需要填写 Bungie API Key、Client ID 和 Secret。"), tone: "warning" };
}

function getAiUi(isConfigured: boolean, copy: SettingsCopy): { statusLabel: string; summary: string; tone: "ready" | "warning" } { return isConfigured ? { statusLabel: settingsText(copy, "已配置"), summary: settingsText(copy, "可用于装备分析、perk 解读和仓库建议。"), tone: "ready" } : { statusLabel: settingsText(copy, "未配置"), summary: settingsText(copy, "不影响本地账号和资料库功能"), tone: "warning" }; }
function getBackgroundTaskUi(tasks: BackgroundTaskSnapshot[], copy: SettingsCopy): { statusLabel: string; summary: string; tone: "neutral" | "pending" | "warning" | "error" } { const active = tasks.filter((task) => task.status === "queued" || task.status === "running" || task.status === "retrying"); const failed = tasks.find((task) => task.status === "blocked" || task.status === "failed"); if (failed) return { statusLabel: settingsText(copy, "需关注"), summary: failed.title, tone: "error" }; if (active.length) return { statusLabel: `${active.length} ${settingsText(copy, "个运行中")}`, summary: active[0]?.title ?? settingsText(copy, "后台任务运行中"), tone: active.some((task) => task.status === "retrying") ? "warning" : "pending" }; return { statusLabel: settingsText(copy, "空闲"), summary: settingsText(copy, "没有正在运行或阻断的任务。"), tone: "neutral" }; }
function getAppUpdateUi(snapshot: AppUpdateSnapshot | null, copy: SettingsCopy, task: BackgroundTaskSnapshot | null): { statusLabel: string; summary: string; tone: StatusTone } {
  if (!snapshot) return { statusLabel: settingsText(copy, "读取中"), summary: settingsText(copy, "正在读取更新状态。"), tone: "neutral" };
  if (task?.status === "retrying") return { statusLabel: settingsText(copy, "等待重试"), summary: task.error ?? task.message ?? settingsText(copy, "应用会在后台继续重试。"), tone: "warning" };
  if (snapshot.status === "checking") return { statusLabel: settingsText(copy, "检查中"), summary: settingsText(copy, "正在连接更新服务。"), tone: "pending" };
  if (snapshot.status === "available") return { statusLabel: settingsText(copy, "发现新版本"), summary: `${settingsText(copy, "发现新版本")} ${snapshot.available_version ?? ""}${settingsText(copy, "可先下载，下载完成后再重启安装。")}`, tone: "pending" };
  if (snapshot.status === "not_available") {
    if (snapshot.error) return { statusLabel: settingsText(copy, "未检查"), summary: snapshot.user_message ?? snapshot.error, tone: "neutral" };
    return { statusLabel: settingsText(copy, "当前已是最新版本"), summary: snapshot.user_message ?? settingsText(copy, "当前已是最新版本。"), tone: "ready" };
  }
  if (snapshot.status === "downloading") return { statusLabel: settingsText(copy, "下载中"), summary: snapshot.user_message ?? settingsText(copy, "正在下载更新。"), tone: "pending" };
  if (snapshot.status === "downloaded") return { statusLabel: settingsText(copy, "等待重启"), summary: snapshot.user_message ?? `${settingsText(copy, "更新")} ${snapshot.downloaded_version ?? snapshot.available_version ?? ""} ${settingsText(copy, "已下载。")}`, tone: "warning" };
  if (snapshot.status === "error") {
    const retryHint = snapshot.retrying ? settingsText(copy, "应用会在后台继续重试。") : "";
    return { statusLabel: settingsText(copy, "更新受阻"), summary: [snapshot.user_message ?? snapshot.error ?? settingsText(copy, "更新检查失败。"), retryHint].filter(Boolean).join(" "), tone: "error" };
  }
  return { statusLabel: settingsText(copy, "未检查"), summary: settingsText(copy, "尚未检查软件版本。"), tone: "neutral" };
}
function getLibraryUi(status: ManifestStatus | null, error: string, isLoading: boolean, copy: SettingsCopy, task: BackgroundTaskSnapshot | null): { statusLabel: string; summary: string; tone: StatusTone } { if (task && ["queued", "running", "retrying"].includes(task.status)) return { statusLabel: task.status === "retrying" ? settingsText(copy, "等待重试") : settingsText(copy, "更新中"), summary: task.status === "retrying" ? task.error ?? task.message ?? settingsText(copy, "应用会在后台继续重试。") : task.message ?? settingsText(copy, "正在后台更新资料库。"), tone: task.status === "retrying" ? "warning" : "pending" }; if (error) return { statusLabel: settingsText(copy, "检查失败"), summary: status?.initialized ? settingsText(copy, "未能检查新版；本地资料库仍可继续使用。") : error, tone: status?.initialized ? "warning" : "error" }; if (isLoading && !status) return { statusLabel: settingsText(copy, "检查中"), summary: settingsText(copy, "正在检查资料库是否有新版。"), tone: "pending" }; if (!status || !status.initialized) return { statusLabel: settingsText(copy, "未准备"), summary: settingsText(copy, "资料库尚未准备，部分搜索和解析功能不可用。"), tone: "warning" }; if (status.missing_required_components?.length) return { statusLabel: settingsText(copy, "需修复"), summary: `${settingsText(copy, "资料库内容不完整，缺失")} ${status.missing_required_components.length} ${settingsText(copy, "项。")}`, tone: "warning" }; if (status.missing_optional_components?.length) return { statusLabel: settingsText(copy, "可用"), summary: `${settingsText(copy, "英文辅助数据缺失")} ${status.missing_optional_components.length} ${settingsText(copy, "项，英文匹配能力可能降低。")}`, tone: "warning" }; if (status.needs_update) return { statusLabel: settingsText(copy, "可更新"), summary: settingsText(copy, "发现新版资料库，将在后台更新。"), tone: "warning" }; return { statusLabel: settingsText(copy, "可用"), summary: settingsText(copy, "装备、Perk、活动和商人数据可用。"), tone: "ready" }; }

function getAppUpdateTask(tasks: BackgroundTaskSnapshot[]): BackgroundTaskSnapshot | null {
  return tasks.find((task) => (
    (task.type === "app-update-check" || task.type === "app-update-download")
    && (task.status === "queued" || task.status === "running" || task.status === "retrying")
  )) ?? tasks.find((task) => task.type === "app-update-check" || task.type === "app-update-download") ?? null;
}

function getManifestTask(tasks: BackgroundTaskSnapshot[]): BackgroundTaskSnapshot | null {
  return tasks.find((task) => (
    (task.type === "manifest-update" || task.type === "manifest-repair")
    && (task.status === "queued" || task.status === "running" || task.status === "retrying")
  )) ?? tasks.find((task) => task.type === "manifest-update" || task.type === "manifest-repair") ?? null;
}

function formatLibraryVersion(version?: string): string | undefined { const match = version?.match(/(?:^|\.)(\d{2})\.(\d{2})\.(\d{2})(?:\.|-)/); if (!match) return undefined; return `${Number(match[1]) < 80 ? 2000 + Number(match[1]) : 1900 + Number(match[1])}/${match[2]}/${match[3]}`; }
function formatLibraryIntegrity(status: ManifestStatus | null, copy: SettingsCopy): string { if (!status?.initialized) return settingsText(copy, "未准备"); if (status.missing_required_components?.length) return `${settingsText(copy, "缺失")} ${status.missing_required_components.length} ${settingsText(copy, "项，需修复")}`; if (status.missing_optional_components?.length) return `${settingsText(copy, "辅助数据缺失")} ${status.missing_optional_components.length} ${settingsText(copy, "项")}`; return settingsText(copy, "完整"); }
function formatDateTime(value: string | undefined, copy: SettingsCopy): string { return formatFullDateTime(value, settingsText(copy, "未读取")); }
function formatUpdateCheckedAt(value: string | undefined, copy: SettingsCopy): string { return formatFullDateTime(value, settingsText(copy, "未检查")); }
function formatAccountLoadedAt(loadedAt: Date | null, accountSummary: AccountSummary | null, copy: SettingsCopy): string { if (!accountSummary) return settingsText(copy, "未读取"); if (!loadedAt) return settingsText(copy, "本次启动已读取"); return formatFullDateTime(loadedAt, settingsText(copy, "本次启动已读取")); }
function formatActionLogTitle(entry: ActionLogEntry, copy: SettingsCopy): string { const labels: Record<string, string> = { "set-lock": settingsText(copy, "锁定状态"), equip: settingsText(copy, "装备"), "insert-socket-plug": settingsText(copy, "切换武器 Perk"), transfer: settingsText(copy, "仓库转移"), "postmaster-pull": settingsText(copy, "邮政官取回"), "loadout-equip": settingsText(copy, "应用游戏内配装栏"), "loadout-snapshot": settingsText(copy, "覆盖游戏内配装栏"), "execution-verification": settingsText(copy, "执行验证") }; return [actionLogStatusLabel(entry, copy), labels[entry.action], entry.item_name].filter(Boolean).join(" / "); }
function formatActionTraceReference(value: string): string { const suffix = value.split(":").at(-1) ?? value; return suffix.slice(0, 12); }
function isPendingActionLog(entry: ActionLogEntry): boolean {
  return Boolean(
    entry.ok
    && entry.action !== "execution-verification"
    && /请求已受理|正在确认/.test(entry.message ?? "")
    && entry.verification_status !== "verified"
  );
}
function actionLogStatusTone(entry: ActionLogEntry): "success" | "warning" | "error" {
  if (!entry.ok) return "error";
  if (entry.verification_status === "partial" || entry.verification_status === "unavailable" || entry.verification_status === "mismatch") return "warning";
  if (isPendingActionLog(entry)) return "warning";
  return "success";
}
function actionLogStatusLabel(entry: ActionLogEntry, copy: SettingsCopy): string {
  if (entry.verification_status === "verified") return settingsText(copy, "已确认");
  if (entry.verification_status === "partial") return settingsText(copy, "部分完成");
  if (entry.verification_status === "unavailable") return settingsText(copy, "不可用");
  if (entry.verification_status === "mismatch") return settingsText(copy, "不一致");
  if (isPendingActionLog(entry)) return settingsText(copy, "已受理");
  return entry.ok ? settingsText(copy, "成功") : settingsText(copy, "失败");
}
function filteredActionLog(entries: ActionLogEntry[], result: SettingsActionLogResultFilter, action: SettingsActionLogTypeFilter): ActionLogEntry[] {
  return entries.filter((entry) => {
    const pending = isPendingActionLog(entry);
    const matchesResult = result === "all"
      || (result === "success" && entry.ok && !pending)
      || (result === "pending" && pending)
      || (result === "failed" && !entry.ok);
    return matchesResult && (action === "all" || entry.action === action);
  });
}
function interfaceLocaleToBungieLocale(locale: SettingsLanguagePreferences["interfaceLocale"]): SettingsLanguagePreferences["bungieLocale"] { return locale === "en-US" ? "en" : "zh-chs"; }
