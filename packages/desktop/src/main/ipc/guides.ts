import { ipcMain } from "electron";
import { readGuideSourceUrl } from "@d2-tools/services/guides/sourceReader";
import {
  isXiaoheiheGuideUrl,
  readXiaoheiheGuideSource
} from "../guides/dynamicSourceReader.js";

export function registerGuideIpcHandlers(): void {
  ipcMain.handle("guides:source:read", (_event, url: string) => (
    isXiaoheiheGuideUrl(url)
      ? readXiaoheiheGuideSource(url)
      : readGuideSourceUrl(url)
  ));
}
