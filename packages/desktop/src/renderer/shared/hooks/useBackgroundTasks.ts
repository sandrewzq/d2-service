import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import type { BackgroundTaskSnapshot, BackgroundTaskType } from "../../api/types";
import {
  getBackgroundTasksSnapshot,
  subscribeBackgroundTasks
} from "../stores/backgroundTasksStore";

type BackgroundTaskSelectionCache = {
  source: BackgroundTaskSnapshot[];
  selector: (tasks: BackgroundTaskSnapshot[]) => BackgroundTaskSnapshot[];
  value: BackgroundTaskSnapshot[];
};

export function useBackgroundTasks() {
  const backgroundTasks = useBackgroundTaskSelection(selectAllBackgroundTasks, areSameTaskSnapshots);
  return useBackgroundTaskState(backgroundTasks);
}

export function useBackgroundTasksByTypes(types: readonly BackgroundTaskType[]) {
  const typeKey = types.join("\u0000");
  const selectTasks = useMemo(() => createTaskTypeSelector(typeKey), [typeKey]);
  const backgroundTasks = useBackgroundTaskSelection(selectTasks, areSameTaskSnapshots);
  return useBackgroundTaskState(backgroundTasks);
}

export function useBackgroundTaskSummariesByTypes(types: readonly BackgroundTaskType[]) {
  const typeKey = types.join("\u0000");
  const selectTasks = useMemo(() => createTaskSummarySelector(typeKey), [typeKey]);
  const backgroundTasks = useBackgroundTaskSelection(selectTasks, areSameTaskSnapshots);
  return useBackgroundTaskState(backgroundTasks);
}

export function useBackgroundTasksByIds(taskIds: readonly string[]) {
  const taskIdKey = taskIds.join("\u0000");
  const selectTasks = useMemo(() => createTaskIdSelector(taskIdKey), [taskIdKey]);
  const backgroundTasks = useBackgroundTaskSelection(selectTasks, areSameAccountWriteTaskStates);
  return useBackgroundTaskState(backgroundTasks);
}

function useBackgroundTaskSelection(
  selector: (tasks: BackgroundTaskSnapshot[]) => BackgroundTaskSnapshot[],
  isEqual: (left: readonly BackgroundTaskSnapshot[], right: readonly BackgroundTaskSnapshot[]) => boolean
) {
  const selectorRef = useRef(selector);
  const isEqualRef = useRef(isEqual);
  const cacheRef = useRef<BackgroundTaskSelectionCache | null>(null);
  selectorRef.current = selector;
  isEqualRef.current = isEqual;

  const getSelectedSnapshot = useCallback(() => {
    const source = getBackgroundTasksSnapshot();
    const currentSelector = selectorRef.current;
    const cached = cacheRef.current;
    if (cached?.source === source && cached.selector === currentSelector) {
      return cached.value;
    }

    const selected = currentSelector(source);
    const value = cached && isEqualRef.current(cached.value, selected)
      ? cached.value
      : selected;
    cacheRef.current = { source, selector: currentSelector, value };
    return value;
  }, []);

  return useSyncExternalStore(
    subscribeBackgroundTasks,
    getSelectedSnapshot,
    getSelectedSnapshot
  );
}

function useBackgroundTaskState(backgroundTasks: BackgroundTaskSnapshot[]) {
  const activeBackgroundTasks = useMemo(() => (
    backgroundTasks.filter((task) => ["queued", "running", "retrying"].includes(task.status))
  ), [backgroundTasks]);
  const latestBackgroundTask = activeBackgroundTasks[0] ?? backgroundTasks[0] ?? null;

  return {
    backgroundTasks,
    activeBackgroundTasks,
    latestBackgroundTask
  };
}

function selectAllBackgroundTasks(tasks: BackgroundTaskSnapshot[]): BackgroundTaskSnapshot[] {
  return tasks;
}

function createTaskTypeSelector(typeKey: string) {
  const typeSet = new Set(typeKey.split("\u0000").filter(Boolean) as BackgroundTaskType[]);
  return (tasks: BackgroundTaskSnapshot[]) => tasks.filter((task) => typeSet.has(task.type));
}

function createTaskSummarySelector(typeKey: string) {
  const selectByType = createTaskTypeSelector(typeKey);
  return (tasks: BackgroundTaskSnapshot[]) => selectByType(tasks).map((task) => ({
    task_id: task.task_id,
    type: task.type,
    status: task.status,
    title: task.title,
    message: task.message,
    phase: task.phase,
    availability: task.availability,
    progress_percent: task.progress_percent === undefined
      ? undefined
      : Math.round(task.progress_percent),
    started_at: task.started_at,
    updated_at: task.started_at ?? task.updated_at,
    finished_at: task.finished_at,
    next_retry_at: task.next_retry_at,
    attempt: task.attempt,
    error: task.error,
    can_cancel: task.can_cancel,
    can_retry: task.can_retry
  }));
}

function createTaskIdSelector(taskIdKey: string) {
  const taskIds = taskIdKey.split("\u0000").filter(Boolean);
  return (tasks: BackgroundTaskSnapshot[]) => {
    const tasksById = new Map(tasks.map((task) => [task.task_id, task]));
    return taskIds.flatMap((taskId) => {
      const task = tasksById.get(taskId);
      return task ? [task] : [];
    });
  };
}

function areSameTaskSnapshots(
  left: readonly BackgroundTaskSnapshot[],
  right: readonly BackgroundTaskSnapshot[]
): boolean {
  if (left.length !== right.length) return false;
  return left.every((task, index) => JSON.stringify(task) === JSON.stringify(right[index]));
}

function areSameAccountWriteTaskStates(
  left: readonly BackgroundTaskSnapshot[],
  right: readonly BackgroundTaskSnapshot[]
): boolean {
  if (left.length !== right.length) return false;
  return left.every((task, index) => {
    const other = right[index];
    if (!other) return false;
    return task.task_id === other.task_id
      && task.status === other.status
      && task.phase === other.phase
      && task.profile_minted_at === other.profile_minted_at
      && task.error === other.error
      && areSameStrings(task.verified_item_instance_ids, other.verified_item_instance_ids)
      && areSameStrings(task.mismatched_item_instance_ids, other.mismatched_item_instance_ids);
  });
}

function areSameStrings(left?: readonly string[], right?: readonly string[]): boolean {
  if (left === right) return true;
  if (!left || !right || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}
