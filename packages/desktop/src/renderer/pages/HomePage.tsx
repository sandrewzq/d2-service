import { ProductShellHost } from "@d2-tools/ui";
import type { StartupState } from "../api/types";
import { HomePageItemDetailHost } from "./HomePageItemDetailHost";
import { HomePageRoutes } from "./HomePageRoutes";
import { DesktopMenuSessionProvider } from "./providers/DesktopMenuProviderContext";
import { RendererPerformanceProfiler } from "../shared/performance/RendererPerformanceProfiler";
import { useDesktopProductShell } from "./useDesktopProductShell";

export function HomePage(props: {
  state: StartupState;
  onConfigChanged: () => void;
  onLoginComplete: () => void;
  onManifestInitialized: () => void;
}) {
  const shell = useDesktopProductShell(props);

  return (
    <DesktopMenuSessionProvider value={shell.menuSession}>
      <ProductShellHost
        activePage={shell.activePage}
        assistantMode={shell.assistantMode}
        preferences={shell.productPreferences}
        onPageChange={shell.handlePageChange}
        onAssistantModeChange={shell.handleAssistantModeChange}
        onPreferencesChange={shell.handleProductPreferencesChange}
        shellStatus={shell.shellStatus}
        backgroundTasks={shell.backgroundTasks}
        onOpenBackgroundTask={(task) => shell.openBackgroundTasks(task)}
        sidebarHeader={shell.sidebarHeader}
        sidebarFooter={shell.sidebarFooter}
        platformActions={shell.platformActions}
        pageHeader={shell.pageHeader}
        assistantPanel={shell.assistantPanel}
        renderPage={() => (
          <>
            <RendererPerformanceProfiler id={`menu:${shell.activePage}`}>
              {shell.startupGate ?? <HomePageRoutes activePage={shell.activePage} />}
            </RendererPerformanceProfiler>
            <RendererPerformanceProfiler id="item-detail-overlay">
              <HomePageItemDetailHost {...shell.itemDetailHostProps} />
            </RendererPerformanceProfiler>
          </>
        )}
      />
    </DesktopMenuSessionProvider>
  );
}
