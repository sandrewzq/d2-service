import { api } from "../../api/client";
import type { BackgroundTaskSnapshot } from "../../api/types";

type Listener = () => void;

let tasks: BackgroundTaskSnapshot[] = [];
let started = false;
let revision = 0;
const listeners = new Set<Listener>();
let pendingTasks: BackgroundTaskSnapshot[] | null = null;
let publishFrame: number | null = null;

export function getBackgroundTasksSnapshot(): BackgroundTaskSnapshot[] {
  return tasks;
}

export function subscribeBackgroundTasks(listener: Listener): () => void {
  ensureBackgroundTasksStoreStarted();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function ensureBackgroundTasksStoreStarted(): void {
  if (started) return;
  started = true;

  const requestRevision = revision;
  void api.getBackgroundTasks()
    .then((nextTasks) => {
      if (revision === requestRevision) {
        publish(nextTasks);
      }
    })
    .catch(() => undefined);

  api.onBackgroundTasksChanged((nextTasks) => {
    schedulePublish(nextTasks);
  });
}

function schedulePublish(nextTasks: BackgroundTaskSnapshot[]): void {
  pendingTasks = nextTasks;
  if (publishFrame !== null) return;
  const schedule = typeof requestAnimationFrame === "function"
    ? requestAnimationFrame
    : (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16);
  publishFrame = schedule(() => {
    publishFrame = null;
    const next = pendingTasks;
    pendingTasks = null;
    if (next) publish(next);
  });
}

function publish(nextTasks: BackgroundTaskSnapshot[]): void {
  if (hasSameTaskSnapshots(tasks, nextTasks)) return;
  tasks = nextTasks;
  revision += 1;
  for (const listener of listeners) {
    listener();
  }
}

function hasSameTaskSnapshots(
  current: readonly BackgroundTaskSnapshot[],
  next: readonly BackgroundTaskSnapshot[]
): boolean {
  if (current.length !== next.length) return false;
  return current.every((task, index) => JSON.stringify(task) === JSON.stringify(next[index]));
}
