export type BackgroundTaskType =
  | "asset-cache"
  | "app-update-check"
  | "app-update-download"
  | "manifest-version-check"
  | "manifest-update"
  | "manifest-repair"
  | "account-sync"
  | "account-write-sync"
  | "account-activity"
  | "vendor-refresh"
  | "daily-refresh"
  | "community-analysis";

export type AssetCacheTaskInput = {
  src: string;
  cache_name: string;
};

export type AssetCacheTaskCompletion = AssetCacheTaskInput & {
  ok: boolean;
  error?: string;
};

export type BackgroundTaskStatus =
  | "idle"
  | "queued"
  | "running"
  | "retrying"
  | "success"
  | "failed"
  | "blocked"
  | "superseded";

export type BackgroundTaskSnapshot = {
  task_id: string;
  type: BackgroundTaskType;
  status: BackgroundTaskStatus;
  title: string;
  message?: string;
  phase?: string;
  profile_minted_at?: string;
  verified_item_instance_ids?: string[];
  mismatched_item_instance_ids?: string[];
  availability?: "usable" | "limited" | "blocked";
  progress_percent?: number;
  progress_current_bytes?: number;
  progress_total_bytes?: number;
  progress_bytes_per_second?: number;
  started_at?: string;
  updated_at: string;
  finished_at?: string;
  next_retry_at?: string;
  attempt: number;
  retry_delays_ms?: number[];
  error?: string;
  technical_error?: string;
  can_cancel: boolean;
  can_retry: boolean;
};

export type BackgroundTaskRunContext = {
  update: (patch: Partial<BackgroundTaskSnapshot>) => BackgroundTaskSnapshot;
};

export type StartBackgroundTaskInput = {
  type: BackgroundTaskType;
  /** Optional resource key used to deduplicate independent tasks of one type. */
  dedupeKey?: string;
  title: string;
  message?: string;
  retryDelaysMs?: number[];
  restartIfRetrying?: boolean;
  canCancel?: boolean;
  run: (context: BackgroundTaskRunContext) => Promise<void>;
};

type BackgroundTaskStoreOptions = {
  now?: () => Date;
  schedule?: (callback: () => void, delayMs: number) => unknown;
  onSnapshotChanged?: (snapshots: BackgroundTaskSnapshot[]) => void;
};

export type BackgroundTaskStore = {
  startTask(input: StartBackgroundTaskInput): BackgroundTaskSnapshot;
  getTask(taskId: string): BackgroundTaskSnapshot | null;
  listTasks(): BackgroundTaskSnapshot[];
};

export function createBackgroundTaskStore(options: BackgroundTaskStoreOptions = {}): BackgroundTaskStore {
  const now = options.now ?? (() => new Date());
  const schedule = options.schedule ?? ((callback, delayMs) => setTimeout(callback, delayMs));
  const tasks = new Map<string, BackgroundTaskSnapshot>();
  const activeTaskByType = new Map<string, string>();
  const retryGenerationByTask = new Map<string, number>();

  function listTasks(): BackgroundTaskSnapshot[] {
    return [...tasks.values()].sort((left, right) => right.updated_at.localeCompare(left.updated_at));
  }

  function emit(): void {
    options.onSnapshotChanged?.(listTasks());
  }

  function setTask(taskId: string, patch: Partial<BackgroundTaskSnapshot>): BackgroundTaskSnapshot {
    const current = tasks.get(taskId);
    if (!current) {
      throw new Error(`Unknown background task: ${taskId}`);
    }
    const next = {
      ...current,
      ...patch,
      updated_at: now().toISOString()
    };
    tasks.set(taskId, next);
    emit();
    return next;
  }

  function runExistingTask(taskId: string, input: StartBackgroundTaskInput): void {
    const current = tasks.get(taskId);
    if (!current) return;

    setTask(taskId, {
      status: "running",
      message: input.message,
      next_retry_at: undefined,
      error: undefined,
      technical_error: undefined,
      started_at: current.started_at ?? now().toISOString()
    });

    void input.run({
      update: (patch) => setTask(taskId, patch)
    }).then(() => {
      const completed = tasks.get(taskId);
      if (completed?.status === "superseded") {
        setTask(taskId, {
          finished_at: now().toISOString(),
          can_retry: false
        });
        activeTaskByType.delete(taskKey(input));
        return;
      }
      setTask(taskId, {
        status: "success",
        finished_at: now().toISOString(),
        message: completed?.phase === "complete" ? completed.message : "任务已完成",
        can_retry: false
      });
      activeTaskByType.delete(taskKey(input));
    }).catch((error) => {
      const failed = tasks.get(taskId);
      if (!failed) return;

      const attempt = failed.attempt + 1;
      const delayMs = getRetryDelayMs(input.retryDelaysMs, attempt);
      const message = error instanceof Error ? error.message : "后台任务失败";

      if (delayMs !== undefined) {
        const retryGeneration = (retryGenerationByTask.get(taskId) ?? 0) + 1;
        retryGenerationByTask.set(taskId, retryGeneration);
        setTask(taskId, {
          status: "retrying",
          attempt,
          error: message,
          technical_error: message,
          next_retry_at: new Date(now().getTime() + delayMs).toISOString(),
          can_retry: true
        });
        schedule(() => {
          if (retryGenerationByTask.get(taskId) !== retryGeneration) return;
          runExistingTask(taskId, input);
        }, delayMs);
        return;
      }

      setTask(taskId, {
        status: "failed",
        attempt,
        error: message,
        technical_error: message,
        finished_at: now().toISOString(),
        can_retry: true
      });
      activeTaskByType.delete(taskKey(input));
    });
  }

  function startTask(input: StartBackgroundTaskInput): BackgroundTaskSnapshot {
    const activeTaskId = activeTaskByType.get(taskKey(input));
    const activeTask = activeTaskId ? tasks.get(activeTaskId) : null;
    if (activeTask && ["queued", "running", "retrying"].includes(activeTask.status)) {
      if (activeTask.status === "retrying" && input.restartIfRetrying) {
        retryGenerationByTask.set(activeTask.task_id, (retryGenerationByTask.get(activeTask.task_id) ?? 0) + 1);
        runExistingTask(activeTask.task_id, input);
      }
      return activeTask;
    }

    const createdAt = now().toISOString();
    const taskId = `${input.type}:${now().getTime()}:${Math.random().toString(16).slice(2)}`;
    const snapshot: BackgroundTaskSnapshot = {
      task_id: taskId,
      type: input.type,
      status: "queued",
      title: input.title,
      message: input.message,
      started_at: createdAt,
      updated_at: createdAt,
      attempt: 0,
      retry_delays_ms: input.retryDelaysMs,
      can_cancel: input.canCancel ?? false,
      can_retry: Boolean(input.retryDelaysMs?.length)
    };

    tasks.set(taskId, snapshot);
    activeTaskByType.set(taskKey(input), taskId);
    emit();
    runExistingTask(taskId, input);
    return tasks.get(taskId) ?? snapshot;
  }

  return {
    startTask,
    getTask: (taskId) => tasks.get(taskId) ?? null,
    listTasks
  };
}

function taskKey(input: Pick<StartBackgroundTaskInput, "type" | "dedupeKey">): string {
  return input.dedupeKey ? `${input.type}:${input.dedupeKey}` : input.type;
}

function getRetryDelayMs(retryDelaysMs: number[] | undefined, attempt: number): number | undefined {
  if (!retryDelaysMs?.length) {
    return undefined;
  }

  const configuredDelay = retryDelaysMs[attempt - 1];
  if (configuredDelay === Number.POSITIVE_INFINITY) {
    return findLastFiniteRetryDelay(retryDelaysMs);
  }
  if (configuredDelay !== undefined) {
    return configuredDelay;
  }

  return retryDelaysMs.includes(Number.POSITIVE_INFINITY)
    ? findLastFiniteRetryDelay(retryDelaysMs)
    : undefined;
}

function findLastFiniteRetryDelay(retryDelaysMs: number[]): number | undefined {
  return [...retryDelaysMs].reverse().find((delayMs) => Number.isFinite(delayMs));
}
