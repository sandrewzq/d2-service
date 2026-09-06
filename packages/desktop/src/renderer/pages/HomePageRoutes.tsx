import type { ShellPageKey } from "@d2-tools/ui";
import { lazy, Suspense } from "react";

const HomeMenuProvider = lazy(async () => {
  const module = await import("./providers/HomeMenuProvider");
  return { default: module.HomeMenuProvider };
});
const AccountMenuProvider = lazy(async () => {
  const module = await import("./providers/AccountMenuProvider");
  return { default: module.AccountMenuProvider };
});
const LoadoutsMenuProvider = lazy(async () => {
  const module = await import("./providers/LoadoutsMenuProvider");
  return { default: module.LoadoutsMenuProvider };
});
const LibraryMenuProvider = lazy(async () => {
  const module = await import("./providers/LibraryMenuProvider");
  return { default: module.LibraryMenuProvider };
});
const VendorsMenuProvider = lazy(async () => {
  const module = await import("./providers/VendorsMenuProvider");
  return { default: module.VendorsMenuProvider };
});
const VaultMenuProvider = lazy(async () => {
  const module = await import("./providers/VaultMenuProvider");
  return { default: module.VaultMenuProvider };
});
const SettingsMenuProvider = lazy(async () => {
  const module = await import("./providers/SettingsMenuProvider");
  return { default: module.SettingsMenuProvider };
});

export function HomePageRoutes(props: {
  activePage: ShellPageKey;
}) {
  return (
    <Suspense fallback={<div className="page-loading">加载中...</div>}>
      {props.activePage === "home" ? <HomeMenuProvider /> : null}
      {props.activePage === "account" ? <AccountMenuProvider /> : null}
      {props.activePage === "loadouts" ? <LoadoutsMenuProvider /> : null}
      {props.activePage === "library" ? <LibraryMenuProvider /> : null}
      {props.activePage === "vendors" ? <VendorsMenuProvider /> : null}
      {props.activePage === "vault" ? <VaultMenuProvider /> : null}
      {props.activePage === "settings" ? <SettingsMenuProvider /> : null}
    </Suspense>
  );
}
