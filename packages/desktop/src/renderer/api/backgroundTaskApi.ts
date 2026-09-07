import type {
  AssetCacheTaskCompletion,
  AssetCacheTaskInput,
  BackgroundTaskSnapshot as SharedBackgroundTaskSnapshot,
  BackgroundTaskType as SharedBackgroundTaskType
} from "../../shared/backgroundTasks";

export type BackgroundTaskSnapshot = SharedBackgroundTaskSnapshot;
export type BackgroundTaskType = SharedBackgroundTaskType;

export type BackgroundTaskApi = {
  getBackgroundTasks(): Promise<BackgroundTaskSnapshot[]>;
  onBackgroundTasksChanged(callback: (tasks: BackgroundTaskSnapshot[]) => void): () => void;
  queueAssetCacheTask(input: AssetCacheTaskInput): Promise<BackgroundTaskSnapshot>;
  completeAssetCacheTask(input: AssetCacheTaskCompletion): Promise<{ ok: boolean }>;
};
