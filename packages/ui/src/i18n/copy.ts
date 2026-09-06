import type { InterfaceLocale, LocaleCopy } from "./types.js";
import { shellCopy } from "./copy/shell.js";
import { homeCopy } from "./copy/home.js";
import { vaultCopy } from "./copy/vault.js";
import { loadoutsCopy } from "./copy/loadouts.js";
import { libraryCopy } from "./copy/library.js";
import { vendorsCopy } from "./copy/vendors.js";
import { accountCopy } from "./copy/account.js";
import { settingsCopy } from "./copy/settings.js";

export const localeCopy: Record<InterfaceLocale, LocaleCopy> = {
  "zh-CN": {
    shell: shellCopy["zh-CN"],
    home: homeCopy["zh-CN"],
    vault: vaultCopy["zh-CN"],
    loadouts: loadoutsCopy["zh-CN"],
    library: libraryCopy["zh-CN"],
    vendors: vendorsCopy["zh-CN"],
    account: accountCopy["zh-CN"],
    settings: settingsCopy["zh-CN"],
  },
  "en-US": {
    shell: shellCopy["en-US"],
    home: homeCopy["en-US"],
    vault: vaultCopy["en-US"],
    loadouts: loadoutsCopy["en-US"],
    library: libraryCopy["en-US"],
    vendors: vendorsCopy["en-US"],
    account: accountCopy["en-US"],
    settings: settingsCopy["en-US"],
  }
};

export function getLocaleCopy(locale: InterfaceLocale): LocaleCopy {
  return localeCopy[locale];
}
