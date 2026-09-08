import type { ProfilerOnRenderCallback } from "react";

type RendererPerformanceMetadataValue = string | number | boolean | null | undefined;

export type RendererPerformanceMetadata = Record<string, RendererPerformanceMetadataValue>;

export type RendererPerformanceEvent = {
  id: number;
  kind: "span" | "commit" | "long-task";
  name: string;
  recordedAt: number;
  startTime: number;
  duration: number;
  metadata?: RendererPerformanceMetadata;
};

type ActiveInteraction = {
  startedAt: number;
  metadata?: RendererPerformanceMetadata;
};

type RecentCause = {
  name: string;
  expiresAt: number;
};

export type RendererPerformanceController = {
  enable: () => string;
  disable: () => string;
  clear: () => void;
  snapshot: () => readonly RendererPerformanceEvent[];
  summary: () => {
    enabled: boolean;
    eventCount: number;
    spanCount: number;
    commitCount: number;
    longTaskCount: number;
    longestEvents: readonly RendererPerformanceEvent[];
  };
};

declare global {
  interface Window {
    __d2Performance?: RendererPerformanceController;
  }
}

const STORAGE_KEY = "d2-tools:renderer-performance-enabled";
const EVENT_LIMIT = 240;
const RECENT_CAUSE_WINDOW_MS = 1_500;

let enabled = readEnabledFlag();
let nextEventId = 1;
let longTaskObserver: PerformanceObserver | null = null;
const events: RendererPerformanceEvent[] = [];
const activeInteractions = new Map<string, ActiveInteraction>();
const recentCauses: RecentCause[] = [];

export function isRendererPerformanceDiagnosticsEnabled(): boolean {
  return enabled;
}

export function startRendererPerformanceInteraction(
  name: string,
  key: string,
  metadata?: RendererPerformanceMetadata
): void {
  if (!enabled) return;
  activeInteractions.set(interactionKey(name, key), {
    startedAt: performance.now(),
    metadata
  });
}

export function completeRendererPerformanceInteraction(
  name: string,
  key: string,
  milestone: string,
  metadata?: RendererPerformanceMetadata
): void {
  if (!enabled) return;
  const mapKey = interactionKey(name, key);
  const active = activeInteractions.get(mapKey);
  if (!active) return;
  activeInteractions.delete(mapKey);
  const completedAt = performance.now();
  recordEvent({
    kind: "span",
    name: `${name}.${milestone}`,
    startTime: active.startedAt,
    duration: completedAt - active.startedAt,
    metadata: mergeMetadata(active.metadata, metadata, { interactionKey: key })
  });
  addRecentCause(`${name}.${milestone}`, completedAt);
}

export function startRendererPerformanceSpan(
  name: string,
  metadata?: RendererPerformanceMetadata
): { end: (metadata?: RendererPerformanceMetadata) => void } {
  if (!enabled) return NOOP_SPAN;
  const startedAt = performance.now();
  let ended = false;
  return {
    end(endMetadata) {
      if (ended) return;
      ended = true;
      const completedAt = performance.now();
      recordEvent({
        kind: "span",
        name,
        startTime: startedAt,
        duration: completedAt - startedAt,
        metadata: mergeMetadata(metadata, endMetadata)
      });
      addRecentCause(name, completedAt);
    }
  };
}

export const recordRendererPerformanceCommit: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime
) => {
  if (!enabled) return;
  const causes = collectCurrentCauses(commitTime);
  recordEvent({
    kind: "commit",
    name: id,
    startTime,
    duration: actualDuration,
    metadata: {
      phase,
      baseDuration: roundDuration(baseDuration),
      commitTime: roundDuration(commitTime),
      causes: causes.length ? causes.join(", ") : undefined
    }
  });
};

const controller: RendererPerformanceController = {
  enable() {
    enabled = true;
    writeEnabledFlag(true);
    startLongTaskObserver();
    return "Renderer 性能记录已开启。请重载页面后复现问题，再调用 window.__d2Performance.snapshot()。";
  },
  disable() {
    enabled = false;
    writeEnabledFlag(false);
    activeInteractions.clear();
    recentCauses.length = 0;
    stopLongTaskObserver();
    return "Renderer 性能记录已关闭。";
  },
  clear() {
    events.length = 0;
    activeInteractions.clear();
    recentCauses.length = 0;
  },
  snapshot() {
    return events.map((event) => ({
      ...event,
      metadata: event.metadata ? { ...event.metadata } : undefined
    }));
  },
  summary() {
    const longestEvents = [...events]
      .sort((left, right) => right.duration - left.duration)
      .slice(0, 12)
      .map((event) => ({
        ...event,
        metadata: event.metadata ? { ...event.metadata } : undefined
      }));
    return {
      enabled,
      eventCount: events.length,
      spanCount: events.filter((event) => event.kind === "span").length,
      commitCount: events.filter((event) => event.kind === "commit").length,
      longTaskCount: events.filter((event) => event.kind === "long-task").length,
      longestEvents
    };
  }
};

if (typeof window !== "undefined") {
  window.__d2Performance = controller;
  if (enabled) startLongTaskObserver();
}

const NOOP_SPAN = Object.freeze({ end: () => undefined });

function interactionKey(name: string, key: string): string {
  return `${name}\u0000${key}`;
}

function mergeMetadata(
  ...parts: Array<RendererPerformanceMetadata | undefined>
): RendererPerformanceMetadata | undefined {
  const merged = Object.assign({}, ...parts.filter(Boolean));
  return Object.keys(merged).length ? merged : undefined;
}

function collectCurrentCauses(now: number): string[] {
  const causes = [...activeInteractions.keys()].map((key) => key.split("\u0000", 1)[0]);
  for (let index = recentCauses.length - 1; index >= 0; index -= 1) {
    const cause = recentCauses[index];
    if (cause.expiresAt < now) {
      recentCauses.splice(index, 1);
    } else {
      causes.push(cause.name);
    }
  }
  return [...new Set(causes)].slice(0, 8);
}

function addRecentCause(name: string, completedAt: number): void {
  recentCauses.push({ name, expiresAt: completedAt + RECENT_CAUSE_WINDOW_MS });
  if (recentCauses.length > 24) recentCauses.splice(0, recentCauses.length - 24);
}

function recordEvent(input: Omit<RendererPerformanceEvent, "id" | "recordedAt">): void {
  events.push({
    ...input,
    id: nextEventId++,
    recordedAt: Date.now(),
    duration: roundDuration(input.duration)
  });
  if (events.length > EVENT_LIMIT) events.splice(0, events.length - EVENT_LIMIT);
}

function startLongTaskObserver(): void {
  if (longTaskObserver || typeof PerformanceObserver === "undefined") return;
  if (!PerformanceObserver.supportedEntryTypes?.includes("longtask")) return;
  longTaskObserver = new PerformanceObserver((list) => {
    if (!enabled) return;
    for (const entry of list.getEntries()) {
      recordEvent({
        kind: "long-task",
        name: entry.name || "renderer-main-thread",
        startTime: entry.startTime,
        duration: entry.duration,
        metadata: {
          causes: collectCurrentCauses(entry.startTime + entry.duration).join(", ") || undefined
        }
      });
    }
  });
  longTaskObserver.observe({ type: "longtask", buffered: true });
}

function stopLongTaskObserver(): void {
  longTaskObserver?.disconnect();
  longTaskObserver = null;
}

function readEnabledFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeEnabledFlag(nextEnabled: boolean): void {
  try {
    if (nextEnabled) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Diagnostics must never affect the product when storage is unavailable.
  }
}

function roundDuration(value: number): number {
  return Math.round(value * 100) / 100;
}

