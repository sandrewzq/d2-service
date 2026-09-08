import { BrowserWindow } from "electron";
import {
  createBackgroundTaskStore,
  type BackgroundTaskSnapshot,
  type StartBackgroundTaskInput
} from "../shared/backgroundTasks.js";

export const backgroundTasksChannel = "background-tasks:changed";

const backgroundTaskStore = createBackgroundTaskStore({
  onSnapshotChanged: scheduleBackgroundTaskBroadcast
});

const backgroundTaskBroadcastIntervalMs = 80;
let pendingBroadcastSnapshots: BackgroundTaskSnapshot[] | null = null;
let broadcastTimer: ReturnType<typeof setTimeout> | null = null;
let lastBroadcastAt = 0;

export function startBackgroundTask(input: StartBackgroundTaskInput): BackgroundTaskSnapshot {
  return backgroundTaskStore.startTask(input);
}

export function listBackgroundTasks(): BackgroundTaskSnapshot[] {
  return backgroundTaskStore.listTasks();
}

function broadcastBackgroundTasks(snapshots: BackgroundTaskSnapshot[]): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) {
      continue;
    }
    window.webContents.send(backgroundTasksChannel, snapshots);
  }
}

function scheduleBackgroundTaskBroadcast(snapshots: BackgroundTaskSnapshot[]): void {
  pendingBroadcastSnapshots = snapshots;
  if (broadcastTimer) return;
  const delay = Math.max(0, backgroundTaskBroadcastIntervalMs - (Date.now() - lastBroadcastAt));
  broadcastTimer = setTimeout(() => {
    broadcastTimer = null;
    const pending = pendingBroadcastSnapshots;
    pendingBroadcastSnapshots = null;
    if (!pending) return;
    lastBroadcastAt = Date.now();
    broadcastBackgroundTasks(pending);
  }, delay);
}
