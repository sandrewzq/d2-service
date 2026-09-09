import { BrowserWindow, ipcMain } from "electron";
import type {
  AccountItemDetailRequestOptions,
  AccountResourceRequestOptions,
  AccountSummary,
  AccountSummaryRequestOptions
} from "../../contracts/account.js";
import { accountSnapshotChangedChannel } from "../../contracts/account.js";
import {
  classifyAccountIpcError,
  encodeDesktopIpcFailure
} from "../../contracts/errors.js";
import { loadConfig } from "@d2-tools/services/config/store";
import {
  loadCachedAccountSnapshot
} from "@d2-tools/services/account/snapshotStore";
import { loadOAuthToken } from "@d2-tools/services/oauth/tokenStore";
import {
  getAccountItemDetailByInstanceId,
  getAccountSnapshot,
  getAccountItemDetailResource,
  getAccountPursuitResource,
  getAccountSnapshotResource,
  subscribeAccountSnapshotChanged
} from "../runtime/accountSession.js";
import { measureRuntime } from "../runtime/runtimeMetrics.js";

let activeAccountSummaryRequests = 0;
let isBroadcastingAccountSnapshots = false;

export function registerAccountIpcHandlers(): void {
  if (!isBroadcastingAccountSnapshots) {
    isBroadcastingAccountSnapshots = true;
    subscribeAccountSnapshotChanged((snapshot) => {
      // account:summary already returns this snapshot to its caller. Suppressing
      // the parallel event avoids sending the same multi-megabyte payload twice.
      if (activeAccountSummaryRequests > 0) return;
      for (const window of BrowserWindow.getAllWindows()) {
        if (window.isDestroyed()) continue;
        window.webContents.send(accountSnapshotChangedChannel, snapshot);
      }
    });
  }

  ipcMain.handle("account:snapshot:cached", async () => {
    const config = loadConfig();
    const accountId = loadOAuthToken(config.data.data_dir)?.membership_id;
    return accountId
      ? loadCachedAccountSnapshot(config.data.data_dir, { accountId })
      : null;
  });

  ipcMain.handle("account:summary", (_event, options?: AccountSummaryRequestOptions) => encodeDesktopIpcFailure(async () => {
    const summaryRequest = measureRuntime(
      "account.refresh.ipc-total",
      () => loadAccountSummary(options),
      { measurePayload: true }
    );
    return summaryRequest;
  }, classifyAccountIpcError));

  ipcMain.handle("account:item-detail", (_event, instanceId: string, options?: AccountItemDetailRequestOptions) => encodeDesktopIpcFailure(async () => {
    if (!instanceId || typeof instanceId !== "string") {
      throw new Error("装备实例 ID 无效");
    }

    return getAccountItemDetailByInstanceId(instanceId, options?.force ? "refresh" : "cached");
  }, classifyAccountIpcError));

  ipcMain.handle("account:resource:snapshot", (_event, options?: AccountResourceRequestOptions) => encodeDesktopIpcFailure(
    () => getAccountSnapshotResource(options?.force ? "refresh" : "cached"),
    classifyAccountIpcError
  ));

  ipcMain.handle("account:resource:item-detail", (_event, instanceId: string, options?: AccountResourceRequestOptions) => encodeDesktopIpcFailure(
    () => {
      if (!instanceId || typeof instanceId !== "string") throw new Error("装备实例 ID 无效");
      return getAccountItemDetailResource(instanceId, options?.force ? "refresh" : "cached");
    },
    classifyAccountIpcError
  ));

  ipcMain.handle("account:resource:pursuits", (_event, options?: AccountResourceRequestOptions) => encodeDesktopIpcFailure(
    () => getAccountPursuitResource(options?.force ? "refresh" : "cached"),
    classifyAccountIpcError
  ));
}

async function loadAccountSummary(options?: AccountSummaryRequestOptions): Promise<AccountSummary> {
  activeAccountSummaryRequests += 1;
  try {
    return await getAccountSnapshot(
      options?.force ? "refresh" : "cached",
      options?.authoritative ? { authoritative: true } : {}
    );
  } finally {
    activeAccountSummaryRequests = Math.max(0, activeAccountSummaryRequests - 1);
  }
}
