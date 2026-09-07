import { api } from "../../api/client";
import type { BackgroundTaskSnapshot } from "../../api/types";

type Listener = () => void;

let tasks: BackgroundTaskSnapshot[] = [];
let started = false;
let revision = 0;
const listeners = new Set<Listener>();

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
    publish(nextTasks);
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
