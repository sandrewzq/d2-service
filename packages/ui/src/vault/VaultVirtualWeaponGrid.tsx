import {
  startTransition,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode
} from "react";
import type { AccountItemSummary } from "@d2-tools/core/account/summary";

const NATIVE_GRID_LIMIT = 200;
const INITIAL_RENDER_LIMIT = 40;
const OVERSCAN_ROWS = 8;
const WINDOW_BLOCK_ROWS = 4;

type GridProps = {
  items: AccountItemSummary[];
  className: string;
  focusRequest?: { itemKey: string; requestId: number } | null;
  getItemKey: (item: AccountItemSummary) => string;
  renderItem: (item: AccountItemSummary, index: number) => ReactNode;
};

type VirtualWindow = {
  columns: number;
  startIndex: number;
  endIndex: number;
  topSpacer: number;
  bottomSpacer: number;
};

type GridMetrics = {
  columns: number;
  rowGap: number;
  rowStride: number;
  gridTop: number;
  viewportHeight: number;
};

export function VaultVirtualWeaponGrid(props: GridProps) {
  return props.items.length <= NATIVE_GRID_LIMIT
    ? <NativeWeaponGrid {...props} />
    : <WindowedWeaponGrid {...props} />;
}

function NativeWeaponGrid(props: GridProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!props.focusRequest) return;
    const index = findRequestedIndex(props);
    if (index >= 0) focusItem(gridRef.current, index, true);
  }, [props.focusRequest, props.getItemKey, props.items]);

  return (
    <div
      ref={gridRef}
      className={`vault-card-grid vault-native-weapon-grid ${props.className}`}
      onKeyDown={(event) => handleGridKeyDown(event, gridRef.current, props.items.length)}
    >
      {renderCells(props, 0, props.items)}
    </div>
  );
}

function WindowedWeaponGrid(props: GridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const metricsRef = useRef<GridMetrics>({
    columns: 1,
    rowGap: 0,
    rowStride: 251,
    gridTop: 0,
    viewportHeight: 720
  });
  const pendingFocusIndexRef = useRef<number | null>(null);
  const updateFrameRef = useRef<number | null>(null);
  const measureFrameRef = useRef<number | null>(null);
  const [windowState, setWindowState] = useState<VirtualWindow>(() => ({
    columns: 1,
    startIndex: 0,
    endIndex: Math.min(INITIAL_RENDER_LIMIT, props.items.length),
    topSpacer: 0,
    bottomSpacer: 0
  }));

  const updateWindow = useCallback(() => {
    const grid = gridRef.current;
    const scrollRoot = grid?.closest<HTMLElement>(".shell-content");
    if (!grid || !scrollRoot) return;

    const metrics = metricsRef.current;
    const visibleTop = Math.max(0, scrollRoot.scrollTop - metrics.gridTop);
    const visibleBottom = visibleTop + metrics.viewportHeight;
    const totalRows = Math.ceil(props.items.length / metrics.columns);
    const firstVisibleRow = Math.floor(visibleTop / metrics.rowStride);
    const lastVisibleRow = Math.ceil(visibleBottom / metrics.rowStride);
    const startRow = Math.max(
      0,
      Math.floor(Math.max(0, firstVisibleRow - OVERSCAN_ROWS) / WINDOW_BLOCK_ROWS) * WINDOW_BLOCK_ROWS
    );
    const endRow = Math.min(
      totalRows,
      Math.ceil((lastVisibleRow + OVERSCAN_ROWS) / WINDOW_BLOCK_ROWS) * WINDOW_BLOCK_ROWS
    );
    const startIndex = Math.min(props.items.length, startRow * metrics.columns);
    const endIndex = Math.min(props.items.length, Math.max(startIndex, endRow * metrics.columns));
    const remainingRows = Math.max(0, totalRows - endRow);
    const next: VirtualWindow = {
      columns: metrics.columns,
      startIndex,
      endIndex,
      topSpacer: spacerHeight(startRow, metrics.rowStride, metrics.rowGap),
      bottomSpacer: spacerHeight(remainingRows, metrics.rowStride, metrics.rowGap)
    };
    startTransition(() => {
      setWindowState((current) => sameVirtualWindow(current, next) ? current : next);
    });
  }, [props.items.length]);

  const scheduleWindowUpdate = useCallback(() => {
    if (updateFrameRef.current !== null) return;
    updateFrameRef.current = requestAnimationFrame(() => {
      updateFrameRef.current = null;
      updateWindow();
    });
  }, [updateWindow]);

  const measureGrid = useCallback(() => {
    const grid = gridRef.current;
    const scrollRoot = grid?.closest<HTMLElement>(".shell-content");
    if (!grid || !scrollRoot) return;

    const computedStyle = getComputedStyle(grid);
    const columns = readGridColumnCount(computedStyle.gridTemplateColumns);
    const rowGap = Number.parseFloat(computedStyle.rowGap) || 0;
    const firstCell = grid.querySelector<HTMLElement>("[data-vault-virtual-index]");
    const measuredHeight = firstCell?.getBoundingClientRect().height ?? 0;
    const rootRect = scrollRoot.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();
    metricsRef.current = {
      columns,
      rowGap,
      rowStride: measuredHeight > 0 ? measuredHeight + rowGap : metricsRef.current.rowStride,
      gridTop: gridRect.top - rootRect.top + scrollRoot.scrollTop,
      viewportHeight: scrollRoot.clientHeight
    };
    updateWindow();
  }, [updateWindow]);

  const scheduleMeasure = useCallback(() => {
    if (measureFrameRef.current !== null) return;
    measureFrameRef.current = requestAnimationFrame(() => {
      measureFrameRef.current = null;
      measureGrid();
    });
  }, [measureGrid]);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    const scrollRoot = grid?.closest<HTMLElement>(".shell-content");
    if (!grid || !scrollRoot) return;
    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(scrollRoot);
    scrollRoot.addEventListener("scroll", scheduleWindowUpdate, { passive: true });
    scheduleMeasure();
    return () => {
      resizeObserver.disconnect();
      scrollRoot.removeEventListener("scroll", scheduleWindowUpdate);
      if (updateFrameRef.current !== null) cancelAnimationFrame(updateFrameRef.current);
      if (measureFrameRef.current !== null) cancelAnimationFrame(measureFrameRef.current);
      updateFrameRef.current = null;
      measureFrameRef.current = null;
    };
  }, [scheduleMeasure, scheduleWindowUpdate]);

  useLayoutEffect(() => {
    scheduleMeasure();
  }, [props.items, scheduleMeasure]);

  useLayoutEffect(() => {
    const index = pendingFocusIndexRef.current;
    if (index === null || index < windowState.startIndex || index >= windowState.endIndex) return;
    pendingFocusIndexRef.current = null;
    focusItem(gridRef.current, index, true);
  }, [windowState.endIndex, windowState.startIndex]);

  useLayoutEffect(() => {
    if (!props.focusRequest) return;
    const index = findRequestedIndex(props);
    if (index < 0) return;
    focusVirtualItem(index);
  }, [props.focusRequest, props.getItemKey, props.items]);

  function focusVirtualItem(index: number) {
    const renderedTarget = findItemTarget(gridRef.current, index);
    if (renderedTarget) {
      renderedTarget.focus();
      return;
    }
    const grid = gridRef.current;
    const scrollRoot = grid?.closest<HTMLElement>(".shell-content");
    if (!grid || !scrollRoot) return;
    const metrics = metricsRef.current;
    const row = Math.floor(index / metrics.columns);
    pendingFocusIndexRef.current = index;
    scrollRoot.scrollTo({ top: Math.max(0, metrics.gridTop + row * metrics.rowStride - 12) });
    scheduleWindowUpdate();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const currentIndex = readFocusedIndex(event);
    if (currentIndex === null) return;
    const nextIndex = getNextIndex(event, currentIndex, props.items.length, windowState.columns);
    if (nextIndex === null || nextIndex === currentIndex) return;
    event.preventDefault();
    focusVirtualItem(nextIndex);
  }

  const visibleItems = props.items.slice(windowState.startIndex, windowState.endIndex);

  return (
    <div ref={gridRef} className={`vault-card-grid ${props.className}`} onKeyDown={handleKeyDown}>
      {windowState.topSpacer > 0 ? (
        <div className="vault-virtual-spacer" style={{ height: windowState.topSpacer }} aria-hidden="true" />
      ) : null}
      {renderCells(props, windowState.startIndex, visibleItems)}
      {windowState.bottomSpacer > 0 ? (
        <div className="vault-virtual-spacer" style={{ height: windowState.bottomSpacer }} aria-hidden="true" />
      ) : null}
    </div>
  );
}

function renderCells(props: GridProps, startIndex: number, items: AccountItemSummary[]) {
  return items.map((item, offset) => {
    const index = startIndex + offset;
    return (
      <div
        className="vault-virtual-cell"
        data-vault-virtual-index={index}
        key={item.instance_id ?? `${item.hash}:${index}`}
      >
        {props.renderItem(item, index)}
      </div>
    );
  });
}

function handleGridKeyDown(event: KeyboardEvent<HTMLDivElement>, grid: HTMLDivElement | null, itemCount: number) {
  const currentIndex = readFocusedIndex(event);
  if (currentIndex === null) return;
  const columns = getGridColumnCount(grid);
  const nextIndex = getNextIndex(event, currentIndex, itemCount, columns);
  if (nextIndex === null || nextIndex === currentIndex) return;
  event.preventDefault();
  focusItem(grid, nextIndex, false);
}

function readFocusedIndex(event: KeyboardEvent<HTMLDivElement>): number | null {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  const target = event.target as HTMLElement;
  if (!target.classList.contains("vault-card-main")) return null;
  const cell = target.closest<HTMLElement>("[data-vault-virtual-index]");
  const index = Number(cell?.dataset.vaultVirtualIndex);
  return Number.isInteger(index) ? index : null;
}

function getNextIndex(
  event: KeyboardEvent<HTMLDivElement>,
  currentIndex: number,
  itemCount: number,
  columns: number
): number | null {
  if (event.key === "ArrowLeft") return Math.max(0, currentIndex - 1);
  if (event.key === "ArrowRight") return Math.min(itemCount - 1, currentIndex + 1);
  if (event.key === "ArrowUp") return Math.max(0, currentIndex - columns);
  if (event.key === "ArrowDown") return Math.min(itemCount - 1, currentIndex + columns);
  if (event.key === "Home") return 0;
  if (event.key === "End") return itemCount - 1;
  return null;
}

function findRequestedIndex(props: GridProps): number {
  return props.items.findIndex((item) => props.getItemKey(item) === props.focusRequest?.itemKey);
}

function getGridColumnCount(grid: HTMLDivElement | null): number {
  return grid ? readGridColumnCount(getComputedStyle(grid).gridTemplateColumns) : 1;
}

function readGridColumnCount(templateColumns: string): number {
  return Math.max(1, templateColumns.trim().split(/\s+/u).filter(Boolean).length);
}

function findItemTarget(grid: HTMLDivElement | null, index: number) {
  return grid?.querySelector<HTMLElement>(`[data-vault-virtual-index="${index}"] .vault-card-main`);
}

function focusItem(grid: HTMLDivElement | null, index: number, preventScroll: boolean) {
  findItemTarget(grid, index)?.focus({ preventScroll });
}

function spacerHeight(rows: number, rowStride: number, rowGap: number): number {
  return rows > 0 ? Math.max(0, rows * rowStride - rowGap) : 0;
}

function sameVirtualWindow(left: VirtualWindow, right: VirtualWindow): boolean {
  return left.columns === right.columns
    && left.startIndex === right.startIndex
    && left.endIndex === right.endIndex
    && Math.abs(left.topSpacer - right.topSpacer) < 1
    && Math.abs(left.bottomSpacer - right.bottomSpacer) < 1;
}
