import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  defaultProductPreferences,
  getBungieLocaleForInterface,
  getNextInterfaceLocale
} from "../i18n/preferences.js";
import type { ProductPreferences } from "../i18n/types.js";
import { NavigationGuardProvider, type NavigationGuard } from "../navigation/NavigationGuard.js";
import { ConfirmationDialog } from "../overlay/ConfirmationDialog.js";
import { AppShell } from "../shell/AppShell.js";
import type { ShellAssistantMode, ShellPageKey } from "../shell/types.js";
import { ProductWorkspaceHeader, ProductWorkspacePage } from "../workspace/ProductWorkspace.js";
import type { ProductShellHostProps } from "./types.js";

export function ProductShellHost(props: ProductShellHostProps) {
  const [uncontrolledActivePage, setUncontrolledActivePage] = useState<ShellPageKey>(props.initialPage ?? "home");
  const [uncontrolledAssistantMode, setUncontrolledAssistantMode] = useState<ShellAssistantMode>(props.initialAssistantMode ?? null);
  const [uncontrolledPreferences, setUncontrolledPreferences] = useState<ProductPreferences>({
    ...defaultProductPreferences,
    ...props.initialPreferences
  });
  const [navigationGuard, setNavigationGuard] = useState<(NavigationGuard & { token: symbol }) | null>(null);
  const [isNavigationConfirmationOpen, setIsNavigationConfirmationOpen] = useState(false);
  const navigationGuardRef = useRef(navigationGuard);
  const pendingNavigationActionRef = useRef<(() => void | Promise<void>) | null>(null);
  const allowNextUnloadRef = useRef(false);
  navigationGuardRef.current = navigationGuard;
  const activePage = props.activePage ?? uncontrolledActivePage;
  const assistantMode = props.assistantMode ?? uncontrolledAssistantMode;
  const preferences = props.preferences ?? uncontrolledPreferences;
  const providedPageHeader = typeof props.pageHeader === "function"
    ? props.pageHeader(activePage, preferences)
    : props.pageHeader;
  const pageHeader = {
    ...productPageHeaderMeta[activePage],
    actions: providedPageHeader?.actions
  };

  const registerNavigationGuard = useCallback((guard: NavigationGuard) => {
    const token = Symbol("navigation-guard");
    setNavigationGuard({ ...guard, token });
    return () => setNavigationGuard((current) => current?.token === token ? null : current);
  }, []);

  const requestGuardedNavigation = useCallback((action: () => void | Promise<void>) => {
    if (!navigationGuardRef.current) {
      void action();
      return;
    }
    pendingNavigationActionRef.current = action;
    setIsNavigationConfirmationOpen(true);
  }, []);

  function commitPageChange(page: ShellPageKey) {
    if (props.activePage === undefined) {
      setUncontrolledActivePage(page);
    }
    props.onPageChange?.(page);
  }

  function changePage(page: ShellPageKey) {
    if (page === activePage) return;
    requestGuardedNavigation(() => commitPageChange(page));
  }

  function cancelGuardedNavigation() {
    pendingNavigationActionRef.current = null;
    setIsNavigationConfirmationOpen(false);
  }

  function confirmGuardedNavigation() {
    const action = pendingNavigationActionRef.current;
    pendingNavigationActionRef.current = null;
    setIsNavigationConfirmationOpen(false);
    if (action) void action();
  }

  const guardedPlatformActions = useMemo(() => {
    if (!props.platformActions.windowControls) return props.platformActions;
    return {
      ...props.platformActions,
      windowControls: {
        ...props.platformActions.windowControls,
        close: () => {
          const requiresUnloadBypass = Boolean(navigationGuardRef.current);
          requestGuardedNavigation(() => {
            if (requiresUnloadBypass) allowNextUnloadRef.current = true;
            return props.platformActions.windowControls?.close();
          });
        }
      }
    };
  }, [props.platformActions, requestGuardedNavigation]);

  useEffect(() => {
    if (!navigationGuard) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (allowNextUnloadRef.current) {
        allowNextUnloadRef.current = false;
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [navigationGuard]);

  function changeAssistantMode(mode: ShellAssistantMode) {
    if (props.assistantMode === undefined) {
      setUncontrolledAssistantMode(mode);
    }
    props.onAssistantModeChange?.(mode);
  }

  function updatePreferences(updater: (current: ProductPreferences) => ProductPreferences) {
    const current = props.preferences ?? uncontrolledPreferences;
    const next = updater(current);

    if (props.preferences === undefined) {
      setUncontrolledPreferences(next);
    }

    props.onPreferencesChange?.(next);
    if (!props.onPreferencesChange) {
      void props.platformActions.persistPreferences?.(next);
    }
  }

  function toggleColorMode() {
    updatePreferences((current) => ({
      ...current,
      colorMode: current.colorMode === "light" ? "dark" : "light"
    }));
  }

  function toggleInterfaceLocale() {
    updatePreferences((current) => {
      const interfaceLocale = getNextInterfaceLocale(current.interfaceLocale);
      return {
        ...current,
        interfaceLocale,
        bungieLocale: current.followInterfaceLocaleForBungie
          ? getBungieLocaleForInterface(interfaceLocale)
          : current.bungieLocale
      };
    });
  }

  return (
    <NavigationGuardProvider register={registerNavigationGuard} request={requestGuardedNavigation}>
      <AppShell
        activePage={activePage}
        assistantMode={assistantMode}
        colorMode={preferences.colorMode}
        density={preferences.density ?? "standard"}
        interfaceLocale={preferences.interfaceLocale}
        shellStatus={props.shellStatus}
        backgroundTasks={props.backgroundTasks}
        onOpenBackgroundTask={props.onOpenBackgroundTask}
        sidebarHeader={props.sidebarHeader}
        sidebarFooter={props.sidebarFooter}
        assistantPanel={props.assistantPanel}
        platformActions={guardedPlatformActions}
        onNavigate={changePage}
        onAssistantModeChange={changeAssistantMode}
        onColorModeToggle={toggleColorMode}
        onInterfaceLocaleToggle={toggleInterfaceLocale}
      >
        <ProductWorkspacePage element="section" className="product-shell-page">
          {pageHeader ? (
            <ProductWorkspaceHeader className="product-shell-page-header" referenceId="shell.page-header" actions={pageHeader.actions}>
              {pageHeader.eyebrow ? <span className="product-workspace-eyebrow" data-ui-part="label" data-info-priority="support" data-text-tone="meta">{pageHeader.eyebrow}</span> : null}
              <h2 data-ui-part="value" data-info-priority="display" data-text-tone="primary">{pageHeader.title}</h2>
              <p data-ui-part="detail" data-info-priority="reading" data-text-tone="body">{pageHeader.subtitle}</p>
            </ProductWorkspaceHeader>
          ) : null}
          {props.renderPage(activePage, preferences)}
        </ProductWorkspacePage>
        {isNavigationConfirmationOpen && navigationGuard ? (
          <ConfirmationDialog
            title={navigationGuard.title}
            description={navigationGuard.description}
            confirmLabel={navigationGuard.confirmLabel ?? "确认离开"}
            cancelLabel={navigationGuard.cancelLabel ?? "留在当前页面"}
            onCancel={cancelGuardedNavigation}
            onConfirm={confirmGuardedNavigation}
          />
        ) : null}
      </AppShell>
    </NavigationGuardProvider>
  );
}

const productPageHeaderMeta: Record<ShellPageKey, { eyebrow: string; title: string; subtitle: string }> = {
  home: { eyebrow: "公开游戏世界", title: "本周情报", subtitle: "只展示 Bungie 公开接口与经过校验的公开机器数据，不猜测缺失内容。" },
  account: { eyebrow: "账号", title: "角色与账号数据", subtitle: "角色装备与背包保持按槽位对照，其他配置、任务和物品分别查看。" },
  vault: { eyebrow: "装备管理", title: "仓库工作台", subtitle: "真实工作流分为筛选列表、同名整理和推荐数据。" },
  loadouts: { eyebrow: "配装", title: "配装工作台", subtitle: "集中处理本地模板和 Bungie 游戏内配装栏的补齐、应用、覆盖与差异。" },
  library: { eyebrow: "资料库", title: "装备与 Perk 查询", subtitle: "使用本地资料库查询装备、版本、Perk 池、获取来源和账号持有实例。" },
  vendors: { eyebrow: "商人", title: "地点与商人库存", subtitle: "先按地点分组定位商人，再查看库存、子库存、任务、声望和等级奖励。" },
  settings: { eyebrow: "设置", title: "应用与数据", subtitle: "管理界面语言、账号读取、资料库、Bungie 接口、AI、备份和诊断。" }
};
