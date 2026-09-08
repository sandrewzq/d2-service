import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { app, BrowserWindow, ipcMain, shell } from "electron";

export type WindowColorMode = "light" | "dark";
export type LegalDocument = "project-license" | "third-party-notices";

export function getWindowBackgroundColor(colorMode: WindowColorMode): string {
  return colorMode === "light" ? "#edf1f6" : "#0d1118";
}

export function applyWindowColorMode(window: BrowserWindow, colorMode: WindowColorMode): void {
  window.setBackgroundColor(getWindowBackgroundColor(colorMode));
}

export function registerWindowIpcHandlers(): void {
  ipcMain.handle("window:set-color-mode", (event, colorMode: WindowColorMode) => {
    if (colorMode !== "light" && colorMode !== "dark") return;
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window || window.isDestroyed()) return;
    applyWindowColorMode(window, colorMode);
  });

  ipcMain.handle("window:minimize", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window || window.isDestroyed()) return;
    window.minimize();
  });

  ipcMain.handle("window:toggle-maximize", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window || window.isDestroyed()) return;
    if (window.isMaximized()) {
      window.unmaximize();
      return;
    }
    window.maximize();
  });

  ipcMain.handle("window:close", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window || window.isDestroyed()) return;
    window.close();
  });

  ipcMain.handle("shell:open-external", (_event, url: string) => {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return;
    return shell.openExternal(url);
  });

  ipcMain.handle("shell:open-legal-document", async (_event, document: LegalDocument) => {
    const path = resolveLegalDocumentPath(document);
    if (!path) throw new Error("许可证文件不存在，请重新安装当前版本。");
    const error = await shell.openPath(path);
    if (error) throw new Error(`许可证文件打开失败：${error}`);
  });
}

export function resolveLegalDocumentPath(document: LegalDocument): string | null {
  const fileName = document === "project-license"
    ? "LICENSE.txt"
    : document === "third-party-notices"
      ? "THIRD_PARTY_NOTICES.txt"
      : "";
  if (!fileName) return null;

  const candidates = app.isPackaged
    ? [join(process.resourcesPath, fileName)]
    : [
        join(app.getAppPath(), "build", fileName),
        resolve(app.getAppPath(), "..", "..", document === "project-license" ? "LICENSE" : join("packages", "desktop", "build", fileName)),
        resolve(process.cwd(), document === "project-license" ? "LICENSE" : join("packages", "desktop", "build", fileName))
      ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}
