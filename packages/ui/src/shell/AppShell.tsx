import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { getLocaleCopy } from "../i18n/copy.js";
import { getRovingFocusIndex } from "../interaction/rovingFocus.js";
import { SystemUpdateProgress, systemUpdateToneForStatus } from "../update/SystemUpdateProgress.js";
import { getLocalizedNavItems } from "./navigation.js";
import type { AppShellLayoutProps, PlatformActions, ShellAssistantMode, ShellPageKey } from "./types.js";

export type AppShellProps = AppShellLayoutProps & {
  platformActions: PlatformActions;
};

export function AppShell(props: AppShellProps) {
  const [isMobileStatusOpen, setIsMobileStatusOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const assistantTriggerRef = useRef<HTMLButtonElement>(null);
  const assistantPanelRef = useRef<HTMLElement>(null);
  const mobileStatusRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const assistantModeChangeRef = useRef(props.onAssistantModeChange);
  assistantModeChangeRef.current = props.onAssistantModeChange;
  const interfaceLocale = props.interfaceLocale ?? "zh-CN";
  const copy = getLocaleCopy(interfaceLocale).shell;
  const navItems = getLocalizedNavItems(interfaceLocale);
  const themeToggleLabel = props.colorMode === "light" ? copy.tools.switchToDark : copy.tools.switchToLight;
  const languageToggleLabel = interfaceLocale === "zh-CN" ? copy.tools.switchToEnglish : copy.tools.switchToChinese;
  const visibleShellStatus = props.shellStatus.filter((item) => item.key !== "background");
  const attentionStatusCount = visibleShellStatus.filter((item) => item.priority === "attention" || item.priority === "critical").length;
  const statusMenuLabel = attentionStatusCount > 0 ? `${copy.statusMenuLabel} · ${attentionStatusCount}` : copy.statusMenuLabel;
  const activePageLabel = navItems.find((item) => item.key === props.activePage)?.label ?? "";
  const isAssistantOverlay = useMediaQuery("(max-width: 980px)");
  const isAssistantOpen = props.assistantMode !== null;
  const shellClassName = [
    "app-shell",
    isAssistantOpen ? "assistant-open" : "",
    isSidebarCollapsed ? "sidebar-collapsed" : ""
  ].filter(Boolean).join(" ");

  function toggleAssistant() {
    setIsMobileStatusOpen(false);
    props.onAssistantModeChange(isAssistantOpen ? null : "ai");
  }

  function handleNavigationKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    const nextIndex = getRovingFocusIndex({
      key: event.key,
      currentIndex,
      itemCount: navItems.length,
      orientation: "vertical"
    });
    if (nextIndex === null) return;
    event.preventDefault();
    event.currentTarget.closest(".shell-nav")
      ?.querySelectorAll<HTMLButtonElement>("button")[nextIndex]
      ?.focus();
  }

  useEffect(() => {
    void props.platformActions.setColorMode?.(props.colorMode);
  }, [props.colorMode, props.platformActions]);

  useEffect(() => {
    setIsMobileStatusOpen(false);
  }, [props.activePage]);

  useEffect(() => {
    if (isAssistantOpen) {
      setIsMobileStatusOpen(false);
    }
  }, [isAssistantOpen]);

  useEffect(() => {
    if (!isMobileStatusOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        setIsMobileStatusOpen(false);
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !mobileStatusRef.current?.contains(event.target)) {
        setIsMobileStatusOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isMobileStatusOpen]);

  useEffect(() => {
    const shouldIsolateBackground = isAssistantOverlay && isAssistantOpen;
    sidebarRef.current?.toggleAttribute("inert", shouldIsolateBackground);
    contentRef.current?.toggleAttribute("inert", shouldIsolateBackground);

    if (!shouldIsolateBackground) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = assistantPanelRef.current;
    const focusable = getFocusableElements(panel);
    focusable[0]?.focus();

    function handleDrawerKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        assistantModeChangeRef.current(null);
        return;
      }

      if (event.key !== "Tab" || !panel) return;
      const elements = getFocusableElements(panel);
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", handleDrawerKeyDown);
    return () => {
      document.removeEventListener("keydown", handleDrawerKeyDown);
      sidebarRef.current?.removeAttribute("inert");
      contentRef.current?.removeAttribute("inert");
      (previousFocus ?? assistantTriggerRef.current)?.focus();
    };
  }, [isAssistantOpen, isAssistantOverlay]);

  return (
    <main className={shellClassName} data-color-mode={props.colorMode} data-density={props.density}>
      <header className="shell-titlebar shell-topbar" data-reference-id="shell.topbar" data-shell-role="titlebar" data-ui-kind="shell-chrome">
        <div className="shell-window-brand" data-reference-id="shell.brand" data-ui-kind="product-identity">
          <span className="shell-app-mark">D2</span>
          <div>
            <strong data-ui-part="value" data-info-priority="context" data-text-tone="primary">d2-tools</strong>
            <span data-ui-part="detail" data-info-priority="support" data-text-tone="meta">{copy.brandSubtitle}</span>
          </div>
        </div>
        <div
          ref={mobileStatusRef}
          className="shell-mobile-status"
          data-open={isMobileStatusOpen}
          onClickCapture={(event) => {
            if (event.target instanceof Element && event.target.closest("button.shell-status-action")) {
              setIsMobileStatusOpen(false);
            }
          }}
        >
          <button
            className="shell-mobile-status-trigger"
            type="button"
            data-ui-kind="button"
            data-control-variant="quiet"
            aria-controls="shell-global-status"
            aria-expanded={isMobileStatusOpen}
            data-attention={attentionStatusCount > 0 ? "true" : "false"}
            onClick={() => setIsMobileStatusOpen((current) => !current)}
          >
            {statusMenuLabel}
          </button>
          <div
            id="shell-global-status"
            className="shell-status-strip shell-global-status global-shell-status"
            data-reference-id="shell.status-strip"
            data-contract-id="shell.status-strip"
            data-ui-kind="shell-status-strip"
            aria-label={copy.statusAriaLabel}
          >
            {visibleShellStatus.map((item) => renderShellStatusItem(item))}
          </div>
        </div>
        <div className="shell-toolstrip" aria-label={copy.toolstripAriaLabel}>
          <button
            className={props.colorMode === "dark" ? "shell-tool-button shell-tool-theme active" : "shell-tool-button shell-tool-theme"}
            type="button"
            data-ui-kind="button"
            data-control-variant="quiet"
            title={themeToggleLabel}
            aria-label={themeToggleLabel}
            onClick={props.onColorModeToggle}
          >
            <ThemeToolIcon colorMode={props.colorMode} />
          </button>
          <button
            className="shell-tool-button shell-tool-locale"
            type="button"
            data-ui-kind="button"
            data-control-variant="quiet"
            title={languageToggleLabel}
            aria-label={languageToggleLabel}
            onClick={props.onInterfaceLocaleToggle}
          >
            {copy.tools.languageBadge}
          </button>
          <button
            className="shell-tool-button shell-tool-github"
            type="button"
            data-ui-kind="button"
            data-control-variant="quiet"
            title={copy.tools.github}
            aria-label={copy.tools.github}
            onClick={() => void props.platformActions.openExternal("https://github.com/sandrewzq/d2-tools")}
          >
            <svg aria-hidden="true" viewBox="0 0 16 16">
              <path d="M8 0.4a7.7 7.7 0 0 0-2.4 15c0.4 0.1 0.5-0.2 0.5-0.4v-1.5c-2.1 0.5-2.6-0.9-2.6-0.9-0.3-0.8-0.8-1-0.8-1-0.7-0.5 0.1-0.5 0.1-0.5 0.8 0.1 1.2 0.8 1.2 0.8 0.7 1.2 1.8 0.9 2.2 0.7 0.1-0.5 0.3-0.9 0.5-1.1-1.7-0.2-3.5-0.8-3.5-3.8 0-0.8 0.3-1.5 0.8-2.1-0.1-0.2-0.3-1 0.1-2 0 0 0.7-0.2 2.2 0.8A7.4 7.4 0 0 1 8 4c0.7 0 1.3 0.1 1.9 0.3 1.5-1 2.2-0.8 2.2-0.8 0.4 1 0.2 1.8 0.1 2 0.5 0.6 0.8 1.3 0.8 2.1 0 2.9-1.8 3.6-3.5 3.8 0.3 0.2 0.5 0.7 0.5 1.4V15c0 0.2 0.1 0.5 0.5 0.4A7.7 7.7 0 0 0 8 0.4Z" />
            </svg>
          </button>
          <button className="shell-tool-button" type="button" data-ui-kind="button" data-control-variant="quiet" title={copy.tools.settings} aria-label={copy.tools.settings} onClick={() => props.onNavigate("settings")}>
            <SettingsToolIcon />
          </button>
          <button
            type="button"
            className={isAssistantOpen ? "shell-tool-button shell-tool-ai active" : "shell-tool-button shell-tool-ai"}
            ref={assistantTriggerRef}
            data-ui-kind="button"
            data-control-variant="quiet"
            aria-pressed={isAssistantOpen}
            aria-label={copy.tools.openAiAssistant}
            title={copy.tools.aiAssistant}
            onClick={toggleAssistant}
          >
            AI
          </button>
        </div>
        <div className="shell-window-controls" aria-label={copy.windowControlsAriaLabel}>
          {props.platformActions.windowControls ? (
            <>
              <button
                className="shell-window-control-button window-minimize"
                type="button"
                data-ui-kind="button"
                data-control-variant="quiet"
                title={copy.windowControls.minimize}
                aria-label={copy.windowControls.minimize}
                onClick={() => void props.platformActions.windowControls?.minimize()}
              >
                <span aria-hidden="true" className="window-control-icon">－</span>
              </button>
              <button
                className="shell-window-control-button window-toggle-maximize"
                type="button"
                data-ui-kind="button"
                data-control-variant="quiet"
                title={copy.windowControls.toggleMaximize}
                aria-label={copy.windowControls.toggleMaximize}
                onClick={() => void props.platformActions.windowControls?.toggleMaximize()}
              >
                <span aria-hidden="true" className="window-control-icon">□</span>
              </button>
              <button
                className="shell-window-control-button window-close"
                type="button"
                data-ui-kind="button"
                data-control-variant="quiet"
                title={copy.windowControls.close}
                aria-label={copy.windowControls.close}
                onClick={() => void props.platformActions.windowControls?.close()}
              >
                <span aria-hidden="true" className="window-control-icon">×</span>
              </button>
            </>
          ) : null}
        </div>
      </header>
      <div className="shell-workspace">
        <aside ref={sidebarRef} className="shell-sidebar" data-reference-id="shell.sidebar" data-shell-role="sidebar" data-ui-kind="shell-sidebar" aria-label={copy.navigationAriaLabel} aria-hidden={isAssistantOverlay && isAssistantOpen ? true : undefined}>
          <div className="shell-sidebar-header">
            {props.sidebarHeader}
            <button
              className="shell-sidebar-collapse"
              type="button"
              data-ui-kind="button"
              data-control-variant="quiet"
              aria-label={isSidebarCollapsed ? copy.sidebar.expand : copy.sidebar.collapse}
              title={isSidebarCollapsed ? copy.sidebar.expand : copy.sidebar.collapse}
              aria-pressed={isSidebarCollapsed}
              onClick={() => setIsSidebarCollapsed((current) => !current)}
            >
              <span aria-hidden="true">{isSidebarCollapsed ? "›" : "‹"}</span>
            </button>
          </div>
          <nav className="shell-nav" data-ui-kind="primary-navigation">
            {navItems.map((item, index) => {
              const isActive = item.key === props.activePage;

              return (
                <button
                  className={isActive ? "active" : ""}
                  key={item.key}
                  type="button"
                  title={item.label}
                  aria-current={isActive ? "page" : undefined}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => props.onNavigate(item.key)}
                  onKeyDown={(event) => handleNavigationKeyDown(event, index)}
                >
                  <span className="shell-nav-mark" aria-hidden="true"><ShellNavIcon page={item.key} /></span>
                  <span className="shell-nav-label" data-ui-part="value" data-info-priority="context" data-text-tone="primary">{item.label}</span>
                </button>
              );
            })}
          </nav>
          {props.sidebarFooter ? <div className="shell-sidebar-footer">{props.sidebarFooter}</div> : null}
        </aside>
        <section ref={contentRef} className="shell-content" data-reference-id="shell.page-content" data-scroll-region="page" aria-hidden={isAssistantOverlay && isAssistantOpen ? true : undefined}>{props.children}</section>
        {isAssistantOpen && isAssistantOverlay ? (
          <button
            className="global-assistant-scrim"
            type="button"
            tabIndex={-1}
            aria-label={copy.assistant.close}
            onClick={() => props.onAssistantModeChange(null)}
          />
        ) : null}
        {props.assistantMode ? (
          <aside
            ref={assistantPanelRef}
            className="global-assistant-panel global-assistant-drawer"
            data-reference-id="shell.assistant"
            data-surface={isAssistantOverlay ? "drawer" : undefined}
            data-ui-kind={isAssistantOverlay ? "drawer" : "assistant-panel"}
            role={isAssistantOverlay ? "dialog" : undefined}
            aria-modal={isAssistantOverlay ? true : undefined}
            aria-labelledby="shell-assistant-title"
          >
            <div className="global-assistant-sidebar">
              <div className="assistant-workspace">
                <header className="assistant-workspace-header">
                  <div>
                    <h2 id="shell-assistant-title" data-text-tone="primary">{copy.assistant.title}</h2>
                    <p data-info-priority="trace" data-text-tone="meta">{copy.assistant.currentPage(activePageLabel)}</p>
                  </div>
                  <div className="assistant-workspace-header-actions">
                    <button
                      type="button"
                      data-ui-kind="button"
                      data-control-variant="quiet"
                      title={copy.tools.settings}
                      aria-label={copy.tools.settings}
                      onClick={() => {
                        props.onAssistantModeChange(null);
                        props.onNavigate("settings");
                      }}
                    >
                      <SettingsToolIcon />
                    </button>
                    <button type="button" data-assistant-close data-ui-kind="button" data-control-variant="quiet" onClick={() => props.onAssistantModeChange(null)} aria-label={copy.assistant.close} title={copy.assistant.close}>
                      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></svg>
                    </button>
                  </div>
                </header>
                <div
                  id="shell-assistant-panel"
                  className="assistant-workspace-body"
                  aria-label={copy.assistantPanelAriaLabel}
                >
                  {props.assistantPanel}
                </div>
              </div>
            </div>
          </aside>
        ) : null}
        <BackgroundTaskDock tasks={props.backgroundTasks ?? []} copy={copy.backgroundTasks} interfaceLocale={interfaceLocale} onOpenTask={props.onOpenBackgroundTask} />
      </div>
    </main>
  );
}

function BackgroundTaskDock(props: {
  tasks: NonNullable<AppShellLayoutProps["backgroundTasks"]>;
  copy: ReturnType<typeof getLocaleCopy>["shell"]["backgroundTasks"];
  interfaceLocale: "zh-CN" | "en-US";
  onOpenTask?: (task: NonNullable<AppShellLayoutProps["backgroundTasks"]>[number]) => void;
}) {
  const visibleTasks = [
    selectUpdateTaskForDock(props.tasks, "app"),
    selectUpdateTaskForDock(props.tasks, "manifest")
  ].filter((task): task is NonNullable<AppShellLayoutProps["backgroundTasks"]>[number] => Boolean(
    task && ["queued", "running", "retrying", "failed", "blocked"].includes(task.status)
  )).sort((left, right) => {
    const priorityDifference = backgroundTaskDisplayPriority(right.status) - backgroundTaskDisplayPriority(left.status);
    if (priorityDifference !== 0) return priorityDifference;
    return (left.started_at ?? left.created_at ?? left.updated_at ?? "").localeCompare(right.started_at ?? right.created_at ?? right.updated_at ?? "");
  });
  const task = visibleTasks[0];
  if (!task) return null;

  const progress = task.progress_percent === undefined ? undefined : Math.round(task.progress_percent);
  const statusLabel = task.status === "running" && progress !== undefined
    ? props.copy.status.runningProgress(progress)
    : task.status === "retrying"
      ? task.next_retry_at
        ? props.copy.status.retryingAt(formatRetryTime(task.next_retry_at))
        : props.copy.status.retrying
      : task.status === "failed"
        ? props.copy.status.failed
        : task.status === "blocked"
          ? props.copy.status.blocked
          : task.status === "queued"
            ? props.copy.status.queued
            : props.copy.status.running;

  return (
    <aside className="shell-background-task-dock" data-reference-id="shell.background-task-dock" data-ui-kind="background-task-dock" data-status={task.status} aria-label={props.copy.ariaLabel}>
      <button type="button" onClick={() => props.onOpenTask?.(task)} aria-label={`${props.copy.title}：${task.title}`}>
        <SystemUpdateProgress
          variant="dock"
          icon="↻"
          interfaceLocale={props.interfaceLocale}
          tone={systemUpdateToneForStatus(task.status)}
          title={task.title || props.copy.fallbackTitle}
          message={task.status === "failed" || task.status === "retrying" ? task.error ?? task.message ?? statusLabel : task.message ?? statusLabel}
          statusLabel={statusLabel}
          additionalTaskCount={visibleTasks.length - 1}
          progressPercent={progress}
          indeterminate={["queued", "running"].includes(task.status) && progress === undefined}
          progressCurrentBytes={task.progress_current_bytes}
          progressTotalBytes={task.progress_total_bytes}
          progressBytesPerSecond={task.progress_bytes_per_second}
        />
      </button>
    </aside>
  );
}

function selectUpdateTaskForDock(
  tasks: NonNullable<AppShellLayoutProps["backgroundTasks"]>,
  family: "app" | "manifest"
): NonNullable<AppShellLayoutProps["backgroundTasks"]>[number] | null {
  const familyTypes = family === "app"
    ? ["app-update-download", "app-update-check"]
    : ["manifest-update", "manifest-repair", "manifest-version-check"];
  const familyTasks = tasks
    .filter((task) => familyTypes.includes(task.type ?? ""))
    .sort((left, right) => (right.updated_at ?? "").localeCompare(left.updated_at ?? ""));
  for (const type of familyTypes) {
    const active = familyTasks.find((task) => task.type === type && ["queued", "running", "retrying"].includes(task.status));
    if (active) return active;
  }
  return familyTasks[0] ?? null;
}

function backgroundTaskDisplayPriority(status: string): number {
  if (status === "failed" || status === "blocked") return 4;
  if (status === "retrying") return 3;
  if (status === "running") return 2;
  if (status === "queued") return 1;
  return 0;
}

function formatRetryTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ShellNavIcon(props: { page: ShellPageKey }) {
  const iconProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.7",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };

  switch (props.page) {
    case "home":
      return <svg {...iconProps}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></svg>;
    case "account":
      return <svg {...iconProps}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
    case "vault":
      return <svg {...iconProps}><path d="M4 7h16v13H4zM3 3h18v4H3z" /><path d="M10 11h4" /></svg>;
    case "loadouts":
      return <svg {...iconProps}><path d="m12 2 9 5-9 5-9-5Z" /><path d="m3 12 9 5 9-5M3 17l9 5 9-5" /></svg>;
    case "guides":
      return <svg {...iconProps}><path d="M5 3h11a3 3 0 0 1 3 3v15H8a3 3 0 0 1-3-3Z" /><path d="M8 17h11M8 7h7M8 11h7" /></svg>;
    case "library":
      return <svg {...iconProps}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></svg>;
    case "vendors":
      return <svg {...iconProps}><path d="M3 9h18l-2-6H5Z" /><path d="M5 9v12h14V9M9 21v-6h6v6" /></svg>;
    case "settings":
      return <svg {...iconProps}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34A1.7 1.7 0 0 0 14 20.92V21h-4v-.08A1.7 1.7 0 0 0 8.97 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.52-1H3v-4h.08A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8.97 4.6 1.7 1.7 0 0 0 10 3.08V3h4v.08a1.7 1.7 0 0 0 1.03 1.52 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.13.62.68 1.05 1.32 1H21v4h-.28c-.64-.05-1.19.38-1.32 1Z" /></svg>;
  }
}

function ThemeToolIcon(props: { colorMode: "light" | "dark" }) {
  if (props.colorMode === "light") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.5 14.4A8.5 8.5 0 0 1 9.6 3.5 8.5 8.5 0 1 0 20.5 14.4Z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function SettingsToolIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.55V21h-4v-.08A1.7 1.7 0 0 0 8.97 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.52-1H3v-4h.08A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8.97 4.6 1.7 1.7 0 0 0 10 3.08V3h4v.08A1.7 1.7 0 0 0 15.03 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.13.62.68 1.05 1.32 1H21v4h-.28c-.64-.05-1.19.38-1.32 1Z" />
    </svg>
  );
}

function renderShellStatusItem(item: AppShellLayoutProps["shellStatus"][number]) {
  const status = item.tone ?? "neutral";
  const priority = item.priority ?? "standard";
  const kind = item.kind ?? "health";
  const semanticStatus = status === "ready" ? "success" : status;
  const className = [
    "shell-status-group",
    item.key === "account" ? "shell-account-status" : "",
    item.onAction && item.actionLabel ? "shell-status-action" : "",
    `status-${status}`
  ].filter(Boolean).join(" ");
  const accessibilityLabel = `${item.label}：${item.value}`;
  const ariaLive = item.active || (kind === "update" && priority !== "quiet") ? "polite" : undefined;
  const content = (
    <>
      <ShellStatusIcon priority={priority} status={status} statusKey={item.key} />
      <span data-ui-part="label" data-info-priority="support" data-text-tone="meta">{item.label}</span>
      <strong data-ui-part="value" data-info-priority="context" data-text-tone="primary">{item.value}</strong>
    </>
  );

  if (item.onAction && item.actionLabel) {
    return (
      <button className={className} type="button" title={item.actionLabel} aria-label={`${item.actionLabel}：${accessibilityLabel}`} aria-live={ariaLive} aria-busy={item.active || undefined} data-active={item.active ? "true" : undefined} data-kind={kind} data-priority={priority} data-ui-kind="shell-status-item" data-status={semanticStatus} onClick={item.onAction} key={item.key ?? item.label}>
        {content}
      </button>
    );
  }

  return <span className={className} title={accessibilityLabel} aria-label={accessibilityLabel} aria-live={ariaLive} aria-busy={item.active || undefined} data-active={item.active ? "true" : undefined} data-kind={kind} data-priority={priority} data-ui-kind="shell-status-item" data-status={semanticStatus} key={item.key ?? item.label}>{content}</span>;
}

function ShellStatusIcon(props: {
  statusKey: AppShellLayoutProps["shellStatus"][number]["key"];
  status: NonNullable<AppShellLayoutProps["shellStatus"][number]["tone"]>;
  priority: NonNullable<AppShellLayoutProps["shellStatus"][number]["priority"]>;
}) {
  const commonProps = {
    "aria-hidden": true,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };

  switch (props.statusKey) {
    case "account":
      return <svg className="shell-status-icon" {...commonProps}><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></svg>;
    case "library":
      return <svg className="shell-status-icon" {...commonProps}><ellipse cx="12" cy="5" rx="7" ry="2.5" /><path d="M5 5v7c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V5" /><path d="M5 12v7c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-7" /></svg>;
    case "ai":
      return <svg className="shell-status-icon" {...commonProps}><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z" /><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z" /></svg>;
    case "app-version": {
      if (props.status === "error") {
        return <svg className="shell-status-icon" {...commonProps}><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v5M12 17.5v.1" /></svg>;
      }
      if (props.priority === "critical") {
        return <svg className="shell-status-icon" {...commonProps}><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></svg>;
      }
      if (props.status === "pending" && props.priority === "standard") {
        return <svg className="shell-status-icon" {...commonProps}><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></svg>;
      }
      if (props.status === "pending") {
        return <svg className="shell-status-icon" {...commonProps}><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>;
      }
      return <svg className="shell-status-icon" {...commonProps}><circle cx="12" cy="12" r="8" /><path d="m8.5 12 2.2 2.2 4.8-4.8" /></svg>;
    }
    case "bungie":
    default:
      return <svg className="shell-status-icon" {...commonProps}><circle cx="12" cy="12" r="8" /><path d="M4 12h16M12 4a12 12 0 0 1 0 16M12 4a12 12 0 0 0 0 16" /></svg>;
  }
}

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];

  return Array.from(container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter((element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true");
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const updateMatches = () => setMatches(mediaQuery.matches);
    updateMatches();
    mediaQuery.addEventListener("change", updateMatches);
    return () => mediaQuery.removeEventListener("change", updateMatches);
  }, [query]);

  return matches;
}
