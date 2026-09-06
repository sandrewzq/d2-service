import type { ShellNavItem } from "./types.js";
import { getLocaleCopy } from "../i18n/copy.js";
import type { InterfaceLocale } from "../i18n/types.js";

const navItemKeys = [
  "home",
  "account",
  "vault",
  "loadouts",
  "library",
  "vendors",
  "settings"
] as const;

export function getLocalizedNavItems(locale: InterfaceLocale): ShellNavItem[] {
  const navigationCopy = getLocaleCopy(locale).shell.navigation;
  return navItemKeys.map((key) => ({
    key,
    label: navigationCopy[key]
  }));
}

export const navItems: ShellNavItem[] = getLocalizedNavItems("zh-CN");
