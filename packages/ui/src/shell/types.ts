import type { ReactNode } from "react";
import type { InterfaceLocale, ProductPreferences } from "../i18n/types.js";

export type ShellPageKey = "home" | "account" | "vault" | "loadouts" | "library" | "vendors" | "settings";
export type ShellAssistantMode = "ai" | null;

export type ShellNavItem = {
  key: ShellPageKey;
  label: string;
};

export type ShellStatusItem = {
  key?: "bungie" | "account" | "library" | "ai" | "background" | "app-version";
  label: string;
  value: string;
  tone?: "neutral" | "pending" | "ready" | "warning" | "error";
  priority?: "quiet" | "standard" | "attention" | "critical";
  kind?: "health" | "update" | "task";
  active?: boolean;
  actionLabel?: string;
  onAction?: () => void;
};

export type ShellBackgroundTaskItem = {
  id?: string;
  task_id?: string;
  type?: string;
  title: string;
  status: "idle" | "queued" | "running" | "retrying" | "success" | "succeeded" | "failed" | "blocked" | "superseded";
  message?: string;
  error?: string;
  phase?: string;
  availability?: "usable" | "limited" | "blocked";
  progress_percent?: number;
  progress_current_bytes?: number;
  progress_total_bytes?: number;
  progress_bytes_per_second?: number;
  created_at?: string;
  started_at?: string;
  updated_at?: string;
  next_retry_at?: string;
};

export type PlatformActions = {
  openExternal: (url: string) => Promise<void> | void;
  setColorMode?: (mode: "light" | "dark") => Promise<void> | void;
  persistPreferences?: (preferences: ProductPreferences) => Promise<void> | void;
  windowControls?: {
    minimize: () => Promise<void> | void;
    toggleMaximize: () => Promise<void> | void;
    close: () => Promise<void> | void;
  };
};

export type AppShellLayoutProps = {
  activePage: ShellPageKey;
  assistantMode: ShellAssistantMode;
  onNavigate: (page: ShellPageKey) => void;
  onAssistantModeChange: (mode: ShellAssistantMode) => void;
  onColorModeToggle: () => void;
  onInterfaceLocaleToggle?: () => void;
  colorMode: "light" | "dark";
  density?: ProductPreferences["density"];
  interfaceLocale?: InterfaceLocale;
  assistantPanel: ReactNode;
  shellStatus: ShellStatusItem[];
  backgroundTasks?: ShellBackgroundTaskItem[];
  onOpenBackgroundTask?: (task: ShellBackgroundTaskItem) => void;
  sidebarHeader?: ReactNode;
  sidebarFooter?: ReactNode;
  children: ReactNode;
};
