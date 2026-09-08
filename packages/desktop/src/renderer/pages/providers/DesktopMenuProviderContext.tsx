import { createContext, useContext, type Dispatch, type SetStateAction } from "react";
import type { ShellPageKey } from "@d2-tools/ui";
import type { StartupState } from "../../api/types";
import type { useAccountWorkspace } from "../../features/account/useAccountWorkspace";
import type { useDailySummary } from "../../features/daily/useDailySummary";
import type { useHomePageDerivedState } from "../../features/home/useHomePageDerivedState";
import type { useLibraryWorkspace } from "../../features/library/useLibraryWorkspace";
import type { useLoadoutTemplates } from "../../features/loadouts/useLoadoutTemplates";
import type { useLocalLoadoutPlans } from "../../features/loadouts/useLocalLoadoutPlans";
import type { useDiagnosticsSettings } from "../../features/settings/useDiagnosticsSettings";
import type { useVendorDefinitionDetail } from "../../features/vendors/useVendorDefinitionDetail";
import type { useVendorsWorkspace } from "../../features/vendors/useVendorsWorkspace";
import type { useDesktopProductWriteActions } from "../useDesktopProductWriteActions";
import type { ItemDetailOverlayCommands } from "../../shared/stores/itemDetailOverlayStore";

export type DesktopMenuSession = {
  state: StartupState;
  onConfigure: () => void;
  onConfigChanged: () => void;
  setActivePage: Dispatch<SetStateAction<ShellPageKey>>;
  settingsInitialSection: "overview" | "account" | "library" | "bungie";
  setSettingsInitialSection: Dispatch<SetStateAction<"overview" | "account" | "library" | "bungie">>;
  setVaultFacts: (facts: string[]) => void;
  vaultLocateRequest: { hash: number; name: string; requestId: number } | null;
  locateVaultItem: (item: { hash: number; name: string }) => void;
  vaultTargetLocateRequest: { targetId: string; requestId: number } | null;
  locateVaultTarget: (targetId: string) => void;
  armorResultTraceRequest: { resultId: string; candidateId: string; requestId: number } | null;
  locateArmorResultReference: (reference: { resultId: string; candidateId: string }) => void;
  dismissArmorResultTrace: () => void;
  lastAccountLoadedAt: Date | null;
  refreshAccountManually: () => void;
  account: ReturnType<typeof useAccountWorkspace>;
  daily: ReturnType<typeof useDailySummary>;
  diagnostics: ReturnType<typeof useDiagnosticsSettings>;
  home: ReturnType<typeof useHomePageDerivedState>;
  library: ReturnType<typeof useLibraryWorkspace>;
  loadouts: ReturnType<typeof useLoadoutTemplates>;
  localLoadoutPlans: ReturnType<typeof useLocalLoadoutPlans>;
  vendors: ReturnType<typeof useVendorsWorkspace>;
  vendorDefinitionDetail: ReturnType<typeof useVendorDefinitionDetail>;
  itemDetail: ItemDetailOverlayCommands;
  writeActions: ReturnType<typeof useDesktopProductWriteActions>;
};

const DesktopMenuSessionContext = createContext<DesktopMenuSession | null>(null);

export const DesktopMenuSessionProvider = DesktopMenuSessionContext.Provider;

export function useDesktopMenuSession(): DesktopMenuSession {
  const value = useContext(DesktopMenuSessionContext);
  if (!value) {
    throw new Error("Desktop menu providers must be rendered inside DesktopMenuSessionProvider.");
  }

  return value;
}
