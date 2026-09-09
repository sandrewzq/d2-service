import { useEffect, useId, useMemo, useRef, type KeyboardEvent, type ReactNode } from "react";
import type {
  ItemSearchResult,
  LibraryDropAccessKey,
  LibraryEquipmentFilter,
  LibraryEquipmentResultView,
  LibraryManifestAlertModel,
  LibraryOwnershipEntry,
  LibraryPageModel,
  LibraryPerkFilter,
  LibraryViewMode,
  LiveItemAvailabilityEntry,
  PerkSearchResult,
  VaultItemMatchInfo
} from "@d2-tools/app/library";
import { formatLibraryVersion } from "@d2-tools/app/library";
import {
  classifyWeaponSocketPlugs,
  isWeaponSystemPlug,
  weaponSocketColumnLabel
} from "@d2-tools/app/items";
import { getLocaleCopy } from "../i18n/copy.js";
import type { InterfaceLocale, LibraryCopy } from "../i18n/types.js";
import type { VendorOfferContext } from "../item-detail/SharedItemDetailDialog.js";
import { GameAssetImage } from "../media/GameAssetImage.js";
import { GameCombatIcon, type GameDamageTypeKey } from "../media/GameCombatIcon.js";
import { formatStandardDateTime } from "../time/formatTime.js";
import { SystemUpdateProgress, systemUpdateToneForStatus, type SystemUpdateTone } from "../update/SystemUpdateProgress.js";
import {
  ProductWorkspaceContentStack,
  ProductWorkspaceEmptyState,
  ProductWorkspaceSideRail,
  ProductWorkspaceSplit
} from "../workspace/ProductWorkspace.js";

type LiveEntry = LiveItemAvailabilityEntry;
type LibraryPerkGroup = NonNullable<ItemSearchResult["perks"]>[number];
type LibraryDefinitionStat = NonNullable<ItemSearchResult["definition_stats"]>[number];
type LibraryWeaponPerkColumn = {
  key: string;
  label: string;
  plugs: LibraryPerkGroup["plugs"];
};
type LibraryEquipmentTag = {
  label: string;
  className?: string;
  icon?: ReactNode;
};

export type LibraryPageActions = {
  onViewModeChange: (mode: LibraryViewMode) => void;
  onEquipmentFiltersChange: (patch: Partial<LibraryEquipmentFilter>) => void;
  onPerkFiltersChange: (patch: Partial<LibraryPerkFilter>) => void;
  onSearch: () => void;
  onSelectRecentQuery: (name: string) => void;
  onClearFilters: () => void;
  onRefreshManifestStatus: () => void;
  onInitializeManifest: () => void;
  onRepairManifest: () => void;
  onAliasDraftChange: (value: string) => void;
  onAliasTargetDraftChange: (value: string) => void;
  onAliasKindChange: (kind: "item" | "perk") => void;
  onSaveAlias: () => void;
  onOpenItemDetail: (item: ItemSearchResult) => void;
  onLoadPerkRelatedEquipment: (perk: PerkSearchResult, loadMore?: boolean) => void;
  onOpenRelatedItem: (item: ItemSearchResult) => void;
  onAddFavorite: (item: ItemSearchResult | PerkSearchResult) => void;
  onRemoveFavorite: (hash: number) => void;
  onLocateOwnedItem?: (item: ItemSearchResult) => void;
};

export type LibraryPageContentViewProps = {
  interfaceLocale?: InterfaceLocale;
  model: LibraryPageModel;
  actions: LibraryPageActions;
};

function libraryText(copy: LibraryCopy, key: string): string {
  return copy.inline[key] ?? key;
}

export function LibraryPageContentView(props: LibraryPageContentViewProps) {
  const copy = getLocaleCopy(props.interfaceLocale ?? "zh-CN").library;
  const { model, actions } = props;
  const libraryEquipmentFilter = model.queryPanel.equipmentFilters;
  const equipmentFilterOptions = model.queryPanel.equipmentFilterOptions;
  const perkGroupOptions = model.queryPanel.perkGroupOptions;
  const hitCount = model.results.hitCount;
  const isManifestBlocked = model.queryPanel.isManifestBlocked;
  const interfaceLocale = props.interfaceLocale ?? "zh-CN";
  const manifestAlert = buildManifestAlert(model.manifestAlert, copy);
  const manifestSummary = buildManifestSummary(model, copy, interfaceLocale);
  const equipmentRows = useMemo(
    () => model.results.equipmentGroups.flatMap((group) => group.items),
    [model.results.equipmentGroups]
  );
  const favoriteHashes = useMemo(
    () => new Set(model.aliasPanel.history.favorites.map((item) => item.hash)),
    [model.aliasPanel.history.favorites]
  );
  const tabPanelId = useId();
  const equipmentTabId = `${tabPanelId}-equipment-tab`;
  const perkTabId = `${tabPanelId}-perks-tab`;
  const isEquipmentMode = model.queryPanel.viewMode === "equipment";
  const activeTabId = isEquipmentMode ? equipmentTabId : perkTabId;
  const recentItems = model.aliasPanel.history.recent.slice(0, 5);
  const visibleResultCount = isEquipmentMode ? equipmentRows.length : model.results.perks.length;
  const hasVisibleResults = visibleResultCount > 0;
  const searchInputRef = useRef<HTMLInputElement>(null);

  function selectMode(mode: LibraryViewMode) {
    actions.onViewModeChange(mode);
  }

  function handleModeKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const modes: LibraryViewMode[] = ["equipment", "perks"];
    const currentIndex = modes.indexOf(model.queryPanel.viewMode);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? modes.length - 1
        : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + modes.length) % modes.length;
    const nextMode = modes[nextIndex] ?? "equipment";
    selectMode(nextMode);
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[nextIndex]?.focus();
  }

  function fillRecentQuery(name: string) {
    actions.onSelectRecentQuery(name);
    searchInputRef.current?.focus();
  }

  const manifestAlertElement = manifestAlert ? (
    <section className={`library-manifest-alert status-message ${manifestAlert.className}`} role="status">
      <SystemUpdateProgress
        variant="inline"
        interfaceLocale={interfaceLocale}
        tone={manifestAlert.tone}
        title={manifestAlert.title}
        statusLabel={manifestAlert.statusLabel}
        message={manifestAlert.message}
        detail={manifestAlert.detail}
        progressPercent={manifestAlert.progress}
        indeterminate={manifestAlert.indeterminate}
        progressCurrentBytes={manifestAlert.task?.progress_current_bytes}
        progressTotalBytes={manifestAlert.task?.progress_total_bytes}
        progressBytesPerSecond={manifestAlert.task?.progress_bytes_per_second}
      />
      {manifestAlert.primaryAction ? <div className="library-manifest-actions">
        <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={actions.onRefreshManifestStatus}>
          {libraryText(copy, "重新检查")}
        </button>
        <button
          type="button"
          data-ui-kind="button" data-control-variant="primary"
          disabled={model.status.isInitializingManifest}
          onClick={manifestAlert.primaryAction === "repair" ? actions.onRepairManifest : actions.onInitializeManifest}
        >
          {manifestAlert.primaryAction === "repair" ? libraryText(copy, "修复资料库") : libraryText(copy, "立即更新")}
        </button>
      </div> : null}
    </section>
  ) : null;

  return (
    <>
      <section className="library-manifest-summary" aria-label={libraryText(copy, "资料库摘要")}>
        {manifestSummary.map((cell) => (
          <div className="library-manifest-cell" key={cell.label}>
            <span>{cell.label}</span>
            <strong className={cell.className}>{cell.value}</strong>
            <small>{cell.detail}</small>
          </div>
        ))}
      </section>
      {manifestAlertElement}
      <ProductWorkspaceSplit className="library-workbench">
        <ProductWorkspaceSideRail element="aside" className="library-query" ariaLabel={libraryText(copy, "资料库查询")} scrollRegion="pane">
          <div className="library-search-head">
            <div className="library-mode-tabs" data-ui-kind="segmented-control" role="tablist" aria-label={libraryText(copy, "资料库查询类型")}>
              <button type="button" role="tab" id={equipmentTabId} aria-controls={tabPanelId} aria-selected={isEquipmentMode} tabIndex={isEquipmentMode ? 0 : -1} className={isEquipmentMode ? "active" : ""} onClick={() => selectMode("equipment")} onKeyDown={handleModeKeyDown}>{libraryText(copy, "装备")}</button>
              <button type="button" role="tab" id={perkTabId} aria-controls={tabPanelId} aria-selected={!isEquipmentMode} tabIndex={!isEquipmentMode ? 0 : -1} className={!isEquipmentMode ? "active" : ""} onClick={() => selectMode("perks")} onKeyDown={handleModeKeyDown}>{libraryText(copy, "Perk 与框架")}</button>
            </div>
            <form className="library-search-actions" role="search" onSubmit={(event) => { event.preventDefault(); actions.onSearch(); }}>
              <input ref={searchInputRef} autoFocus aria-label={libraryText(copy, "资料库主搜索")} value={model.queryPanel.primaryQuery} disabled={isManifestBlocked} onChange={(event) => isEquipmentMode ? actions.onEquipmentFiltersChange({ query: event.target.value }) : actions.onPerkFiltersChange({ query: event.target.value })} placeholder={isEquipmentMode ? libraryText(copy, "输入装备名称，例如加时交锋") : libraryText(copy, "输入特性或框架名称")} />
              <button type="submit" data-ui-kind="button" data-control-variant="primary" disabled={model.status.isSearching || isManifestBlocked}>{model.status.isSearching ? libraryText(copy, "搜索中...") : libraryText(copy, "搜索")}</button>
            </form>
            <button type="button" className="library-clear-button" data-ui-kind="button" data-control-variant="quiet" onClick={actions.onClearFilters}>{libraryText(copy, "清空查询与筛选")}</button>
          </div>

          <div className="library-filter-stack">
            {isEquipmentMode ? (
              <>
                <label>{libraryText(copy, "分类")}<select disabled={isManifestBlocked} value={libraryEquipmentFilter.group} onChange={(event) => actions.onEquipmentFiltersChange({ group: event.target.value as LibraryEquipmentFilter["group"] })}>{equipmentFilterOptions.groups.map((option) => <option key={option.value} value={option.value}>{libraryText(copy, option.label)}</option>)}</select></label>
                <label>{libraryText(copy, "账号持有")}<select disabled={isManifestBlocked} value={libraryEquipmentFilter.ownership ?? "all"} onChange={(event) => actions.onEquipmentFiltersChange({ ownership: event.target.value as LibraryEquipmentFilter["ownership"] })}><option value="all">{libraryText(copy, "全部")}</option><option value="owned">{libraryText(copy, "当前账号持有")}</option><option value="definition">{libraryText(copy, "仅资料库定义")}</option></select></label>
                <details className="library-advanced-filters">
                  <summary>{libraryText(copy, "高级筛选")}</summary>
                  <div className="library-filter-stack library-nested-filter-stack">
                    <label>{libraryText(copy, "稀有度")}<select disabled={isManifestBlocked} value={libraryEquipmentFilter.tier} onChange={(event) => actions.onEquipmentFiltersChange({ tier: event.target.value })}>{equipmentFilterOptions.tiers.map((option) => <option key={option.value} value={option.value}>{libraryText(copy, option.label)}</option>)}</select></label>
                    <label>{libraryText(copy, "位置")}<select disabled={isManifestBlocked} value={libraryEquipmentFilter.bucket} onChange={(event) => actions.onEquipmentFiltersChange({ bucket: event.target.value })}>{equipmentFilterOptions.buckets.map((option) => <option key={option.value} value={option.value}>{libraryText(copy, option.label)}</option>)}</select></label>
                    <label>{libraryText(copy, "弹药")}<select disabled={isManifestBlocked} value={libraryEquipmentFilter.ammo} onChange={(event) => actions.onEquipmentFiltersChange({ ammo: event.target.value as LibraryEquipmentFilter["ammo"] })}>{equipmentFilterOptions.ammo.map((option) => <option key={option.value} value={option.value}>{libraryText(copy, option.label)}</option>)}</select></label>
                    <label>{libraryText(copy, "获取状态")}<select disabled={isManifestBlocked} value={libraryEquipmentFilter.dropAccess} onChange={(event) => actions.onEquipmentFiltersChange({ dropAccess: event.target.value as LibraryEquipmentFilter["dropAccess"] })}><option value="all">{libraryText(copy, "全部状态")}</option><option value="available">{libraryText(copy, "来源可确认")}</option><option value="rotation">{libraryText(copy, "轮换或限时")}</option><option value="archived">{libraryText(copy, "历史来源")}</option><option value="unknown">{libraryText(copy, "来源未确认")}</option></select></label>
                    <label>{libraryText(copy, "Perk 池")}<input disabled={isManifestBlocked} value={libraryEquipmentFilter.perkQuery} onChange={(event) => actions.onEquipmentFiltersChange({ perkQuery: event.target.value })} placeholder={libraryText(copy, "在当前结果中筛选 Perk")} /></label>
                    <label>{libraryText(copy, "框架")}<select disabled={isManifestBlocked} value={libraryEquipmentFilter.frame[0] ?? "all"} onChange={(event) => actions.onEquipmentFiltersChange({ frame: event.target.value === "all" ? [] : [event.target.value] })}>{equipmentFilterOptions.frames.map((option) => <option key={option.value} value={option.value}>{libraryText(copy, option.label)}</option>)}</select></label>
                    <label>{libraryText(copy, "来源状态")}<select disabled={isManifestBlocked} value={libraryEquipmentFilter.sourceStatus} onChange={(event) => actions.onEquipmentFiltersChange({ sourceStatus: event.target.value as LibraryEquipmentFilter["sourceStatus"] })}><option value="all">{libraryText(copy, "全部来源状态")}</option><option value="ready">{libraryText(copy, "可确认")}</option><option value="missing">{libraryText(copy, "待补充")}</option></select></label>
                    <label>{libraryText(copy, "Perk 池状态")}<select disabled={isManifestBlocked} value={libraryEquipmentFilter.perkPool} onChange={(event) => actions.onEquipmentFiltersChange({ perkPool: event.target.value as LibraryEquipmentFilter["perkPool"] })}><option value="all">{libraryText(copy, "全部")}</option><option value="yes">{libraryText(copy, "有 Perk 池")}</option><option value="no">{libraryText(copy, "无 Perk 池")}</option></select></label>
                  </div>
                </details>
              </>
            ) : (
              <>
                <label>{libraryText(copy, "关联分类")}<select disabled={isManifestBlocked} value={model.queryPanel.perkFilters.relatedGroup} onChange={(event) => actions.onPerkFiltersChange({ relatedGroup: event.target.value as LibraryPerkFilter["relatedGroup"] })}>{perkGroupOptions.map((option) => <option key={option.value} value={option.value}>{libraryText(copy, option.label)}</option>)}</select></label>
                <label>{libraryText(copy, "关联装备")}<select disabled={isManifestBlocked} value={model.queryPanel.perkFilters.hasRelatedItems} onChange={(event) => actions.onPerkFiltersChange({ hasRelatedItems: event.target.value as LibraryPerkFilter["hasRelatedItems"] })}><option value="all">{libraryText(copy, "全部")}</option><option value="yes">{libraryText(copy, "有")}</option><option value="no">{libraryText(copy, "无")}</option></select></label>
              </>
            )}
          </div>

          <details className="library-search-support">
            <summary><strong>{libraryText(copy, "搜索辅助")}</strong><span>{recentItems.length} {libraryText(copy, "条最近查询")} · {model.aliasPanel.history.favorites.length} {libraryText(copy, "个收藏")}</span></summary>
            <div className="library-search-support-body">
              <section aria-label={libraryText(copy, "最近查询")}>
                <div className="library-column-head"><h3>{libraryText(copy, "最近查询")}</h3><span>{libraryText(copy, "真实本地历史")}</span></div>
                <div className="library-history">
                  {recentItems.length ? recentItems.map((item) => (
                    <button type="button" className="library-history-row" key={item.hash} onClick={() => fillRecentQuery(item.name)}>
                      <strong>{item.name}</strong>
                      <span>{libraryText(copy, "装备定义")}</span>
                      <small>{item.viewed_at ? formatStandardDateTime(item.viewed_at) : libraryText(copy, "查看时间未记录")}</small>
                    </button>
                  )) : <div className="library-history-empty"><strong>{libraryText(copy, "没有最近查询")}</strong><span>{libraryText(copy, "本地资料库历史为空。")}</span></div>}
                </div>
              </section>
              <section className="library-alias-editor" aria-label={libraryText(copy, "别名与收藏")}>
                <div className="library-column-head"><h3>{libraryText(copy, "别名与收藏")}</h3><span>{model.aliasPanel.history.favorites.length} {libraryText(copy, "个收藏")}</span></div>
                <div className="library-filter-stack library-nested-filter-stack">
                  <label>{libraryText(copy, "别名类型")}<select value={model.aliasPanel.kind} onChange={(event) => actions.onAliasKindChange(event.target.value as "item" | "perk")}><option value="item">{libraryText(copy, "装备")}</option><option value="perk">Perk</option></select></label>
                  <label>{libraryText(copy, "常用别名")}<input value={model.aliasPanel.draft} onChange={(event) => actions.onAliasDraftChange(event.target.value)} placeholder={libraryText(copy, "例如 ff")} /></label>
                  <label>{libraryText(copy, "实际名称")}<input value={model.aliasPanel.targetDraft} onChange={(event) => actions.onAliasTargetDraftChange(event.target.value)} /></label>
                  <button type="button" data-ui-kind="button" data-control-variant="primary" onClick={actions.onSaveAlias}>{libraryText(copy, "保存别名")}</button>
                  {model.aliasPanel.message ? <small className="library-alias-message" role="status">{model.aliasPanel.message}</small> : null}
                  {model.aliasPanel.error ? <small className="library-alias-message status-error" role="alert">{model.aliasPanel.error}</small> : null}
                </div>
              </section>
            </div>
          </details>
        </ProductWorkspaceSideRail>

        <ProductWorkspaceContentStack element="section" className="library-results" ariaLabel={libraryText(copy, "搜索结果")}>
          <div id={tabPanelId} role="tabpanel" aria-labelledby={activeTabId} aria-busy={model.status.isSearching}>
            <div className="library-results-head"><div><h3>{model.results.searchTouched ? (isEquipmentMode ? libraryText(copy, "装备搜索结果") : libraryText(copy, "Perk 与框架搜索结果")) : libraryText(copy, "等待查询")}</h3><span>{isEquipmentMode ? libraryText(copy, "当前资料库 + 实时来源 + 账号快照") : libraryText(copy, "当前资料库")}</span></div><span className="app-chip status-pending" role="status" aria-live="polite">{model.status.isSearching ? libraryText(copy, "更新中") : `${model.results.searchTouched ? hitCount : 0} ${libraryText(copy, "条")}`}</span></div>
            <p className="library-result-note">{libraryText(copy, "筛选只作用于当前搜索结果；缺失的来源、分类和关联项保持缺失状态。")}</p>
            {model.status.isSearching && hasVisibleResults ? <p className="status-message status-pending" role="status">{libraryText(copy, "正在更新结果，以下暂时保留上一次可见内容。")}</p> : null}
            {model.status.isLoadingLiveAvailability && isEquipmentMode ? <p className="status-message status-pending" role="status">{libraryText(copy, "正在复查实时商人和公共活动来源。")}</p> : null}
            {model.status.liveAvailabilityError && isEquipmentMode ? <p className="status-message status-warning" role="status">{libraryText(copy, "实时来源读取失败：")}{model.status.liveAvailabilityError}{libraryText(copy, "。资料库搜索结果仍可使用。")}</p> : null}
            {model.status.searchError ? <p className="status-message status-error" role="alert">{model.status.searchError}</p> : null}
            {model.status.favoriteError ? <p className="status-message status-error" role="alert">{libraryText(copy, "收藏操作失败：")}{model.status.favoriteError}</p> : null}
            {model.results.searchTouched && isEquipmentMode ? (
              <div className="library-result-list library-equipment-list" role="list" aria-busy={model.status.isSearching}>
                {equipmentRows.map((item) => renderEquipmentResult(
                  item,
                  item.item.group_key === "weapons" || item.item.group_key === "armor"
                    ? () => actions.onOpenItemDetail(item.item)
                    : undefined,
                  actions.onAddFavorite,
                  actions.onRemoveFavorite,
                  actions.onLocateOwnedItem,
                  copy
                ))}
              </div>
            ) : null}
            {model.results.searchTouched && !isEquipmentMode ? (
              <div className="library-result-list" role="list" aria-busy={model.status.isSearching}>
                {model.results.perks.map((perk) => renderPerkResult(
                  perk,
                  favoriteHashes.has(perk.perk.hash),
                  actions.onLoadPerkRelatedEquipment,
                  actions.onOpenRelatedItem,
                  actions.onAddFavorite,
                  actions.onRemoveFavorite,
                  copy
                ))}
              </div>
            ) : null}
            {model.status.isSearching && !hasVisibleResults ? <ProductWorkspaceEmptyState className="library-searching-state"><strong>{libraryText(copy, "正在搜索资料库")}</strong><span>{libraryText(copy, "当前筛选和查询条件正在处理。")}</span></ProductWorkspaceEmptyState> : null}
            {model.emptyState && !model.status.isSearching ? <ProductWorkspaceEmptyState className="library-empty-state"><strong>{model.emptyState.kind === "not_searched" ? libraryText(copy, "输入装备名、Perk 或框架后开始搜索。") : libraryText(copy, "未找到匹配结果。")}</strong><span>{model.emptyState.kind === "not_searched" ? libraryText(copy, "结果区会展示来源、实时状态、账号持有和详情入口。") : libraryText(copy, "可以更换中文名、英文名，或先保存一个本地别名。")}</span></ProductWorkspaceEmptyState> : null}
          </div>
        </ProductWorkspaceContentStack>
      </ProductWorkspaceSplit>
    </>
  );
}

function handleResultActionKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
  const currentRow = event.currentTarget.closest<HTMLElement>(".library-result-row");
  const resultList = currentRow?.closest<HTMLElement>(".library-result-list");
  if (!currentRow || !resultList) return;

  const currentActions = [...currentRow.querySelectorAll<HTMLButtonElement>(".library-result-actions button:not(:disabled)")];
  const currentActionIndex = currentActions.indexOf(event.currentTarget);
  if (currentActionIndex < 0) return;

  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextAction = currentActions[currentActionIndex + direction];
    if (!nextAction) return;
    event.preventDefault();
    nextAction.focus();
    return;
  }

  const rows = [...resultList.querySelectorAll<HTMLElement>(".library-result-row")];
  const currentRowIndex = rows.indexOf(currentRow);
  const nextRow = rows[currentRowIndex + (event.key === "ArrowDown" ? 1 : -1)];
  const nextActions = nextRow
    ? [...nextRow.querySelectorAll<HTMLButtonElement>(".library-result-actions button:not(:disabled)")]
    : [];
  const nextAction = nextActions[Math.min(currentActionIndex, Math.max(0, nextActions.length - 1))];
  if (!nextAction) return;
  event.preventDefault();
  nextAction.focus();
}

function handleRelatedItemKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
  const list = event.currentTarget.parentElement;
  if (!list) return;
  const items = [...list.querySelectorAll<HTMLButtonElement>(":scope > button:not(:disabled)")];
  const currentIndex = items.indexOf(event.currentTarget);
  const nextItem = items[currentIndex + (event.key === "ArrowDown" ? 1 : -1)];
  if (!nextItem) return;
  event.preventDefault();
  nextItem.focus();
}

function buildManifestAlert(
  alert: LibraryManifestAlertModel | null,
  copy: LibraryCopy
): {
  title: string;
  message: string;
  detail?: string;
  progress?: number;
  indeterminate?: boolean;
  statusLabel?: string;
  tone: SystemUpdateTone;
  task?: NonNullable<LibraryManifestAlertModel["task"]>;
  primaryAction?: "update" | "repair";
  className: string;
} | null {
  if (!alert) {
    return null;
  }
  if (alert.kind === "error") {
    return {
      title: alert.hasUsableManifest
        ? libraryText(copy, "资料库后台更新失败")
        : libraryText(copy, "资料库状态读取失败"),
      message: alert.hasUsableManifest
        ? `${alert.error ?? libraryText(copy, "未知错误")} ${libraryText(copy, "旧资料库仍可继续使用。")}`
        : alert.error ?? libraryText(copy, "未知错误"),
      primaryAction: alert.hasUsableManifest ? "update" : "repair",
      statusLabel: libraryText(copy, "失败"),
      tone: "error",
      className: alert.className
    };
  }
  if (alert.kind === "loading") {
    return {
      title: libraryText(copy, "正在检查资料库版本"),
      message: libraryText(copy, "资料库版本检查会在后台运行，切换菜单不会中断。"),
      statusLabel: libraryText(copy, "检查中"),
      indeterminate: true,
      tone: "pending",
      className: alert.className
    };
  }
  if (alert.kind === "not_initialized") {
    return {
      title: libraryText(copy, "资料库尚未初始化"),
      message: libraryText(copy, "账号页、搜索和详情需要资料库。可以现在启动后台更新，完成后再继续查询。"),
      primaryAction: "update",
      statusLabel: libraryText(copy, "未准备"),
      tone: "warning",
      className: alert.className
    };
  }
  if (alert.kind === "missing_components") {
    return {
      title: libraryText(copy, "资料库内容不完整"),
      message: `${libraryText(copy, "缺少")} ${alert.missingComponentCount ?? 0} ${libraryText(copy, "项资料内容，搜索和详情可能不完整；建议立即后台更新资料库。")}`,
      primaryAction: "repair",
      statusLabel: libraryText(copy, "需修复"),
      tone: "warning",
      className: alert.className
    };
  }
  if (alert.kind === "needs_update") {
    const currentVersion = formatLibraryVersion(alert.version) ?? libraryText(copy, "未知版本");
    const latestVersion = formatLibraryVersion(alert.latestVersion) ?? libraryText(copy, "未知版本");
    const sameDateDifferentBuild = Boolean(
      alert.version
      && alert.latestVersion
      && alert.version !== alert.latestVersion
      && currentVersion === latestVersion
    );
    return {
      title: libraryText(copy, "资料库不是最新版本"),
      message: sameDateDifferentBuild
        ? `${currentVersion}${libraryText(copy, " 发布了新的同日构建；旧资料库仍可使用，更新完成后会自动切换。")}`
        : `${libraryText(copy, "当前")} ${currentVersion}，${libraryText(copy, "最新")} ${latestVersion}${libraryText(copy, "；旧资料库可能导致来源、Perk 或详情判断错误。")}`,
      primaryAction: "update",
      statusLabel: libraryText(copy, "可更新"),
      tone: "warning",
      className: alert.className
    };
  }
  if (alert.kind === "updating" || alert.kind === "retrying") {
    const task = alert.task;
    const availability = task?.availability === "usable"
      ? libraryText(copy, "旧资料库仍可使用，更新完成后会自动切换。")
      : task?.availability === "limited"
        ? libraryText(copy, "正在切换资料库，当前查询会等待切换完成后自动继续。")
        : libraryText(copy, "当前没有兼容的旧资料库，搜索和详情将在准备完成后恢复。");
    const retryAt = task?.next_retry_at
      ? `${libraryText(copy, "下次重试：")}${formatStandardDateTime(task.next_retry_at)}`
      : libraryText(copy, "应用会在后台自动重试。");
    return {
      title: alert.kind === "retrying" ? libraryText(copy, "资料库更新等待重试") : libraryText(copy, "资料库正在后台更新"),
      message: alert.kind === "retrying"
        ? task?.error ?? task?.message ?? libraryText(copy, "资料库更新暂时失败。")
        : task?.message ?? libraryText(copy, "正在准备新的资料库。"),
      detail: `${availability}${alert.kind === "retrying" ? ` ${retryAt}` : ""}`,
      statusLabel: alert.kind === "retrying" ? libraryText(copy, "等待重试") : libraryText(copy, "更新中"),
      tone: systemUpdateToneForStatus(task?.status ?? (alert.kind === "retrying" ? "retrying" : "running")),
      progress: task?.progress_percent === undefined
        ? undefined
        : Math.max(0, Math.min(100, Math.round(task.progress_percent))),
      indeterminate: alert.kind === "updating" && task?.progress_percent === undefined,
      task,
      className: alert.className
    };
  }
  return null;
}

function buildManifestSummary(
  model: LibraryPageModel,
  copy: LibraryCopy,
  locale: InterfaceLocale
): Array<{ label: string; value: string; detail: string; className?: string }> {
  const summary = model.manifestSummary;
  const activeVersion = summary.version
    ? formatLibraryVersion(summary.version) ?? libraryText(copy, "可用")
    : summary.initialized === false
      ? libraryText(copy, "未初始化")
      : libraryText(copy, "未读取");
  const latestVersion = summary.latestVersion
    ? formatLibraryVersion(summary.latestVersion) ?? libraryText(copy, "可用")
    : libraryText(copy, "等待检查");
  const hasMissingComponents = summary.missingComponentCount > 0;
  const activatedAt = formatStandardDateTime(summary.activatedAt, libraryText(copy, "未读取"));
  const checkedAt = formatStandardDateTime(summary.checkedAt, libraryText(copy, "未读取"));
  const language = summary.language ?? libraryText(copy, "未记录");
  const definitionCounts = formatManifestDefinitionCounts(summary, locale, copy);
  const status = summary.statusError
    ? { value: libraryText(copy, "读取失败"), className: "status-error", detail: libraryText(copy, "状态读取失败，使用页面操作重新检查") }
    : summary.initialized === null
      ? { value: libraryText(copy, "正在读取"), className: "status-pending", detail: libraryText(copy, "资料库状态尚未返回") }
      : summary.initialized === false
        ? { value: libraryText(copy, "未初始化"), className: "status-warning", detail: libraryText(copy, "搜索和详情暂不可用") }
        : hasMissingComponents
          ? { value: libraryText(copy, "需要修复"), className: "status-warning", detail: libraryText(copy, "搜索和详情可能不完整") }
          : summary.needsUpdate
            ? { value: libraryText(copy, "需要更新"), className: "status-warning", detail: libraryText(copy, "旧资料库仍保留为当前激活版本") }
            : { value: libraryText(copy, "完整"), className: "status-ready", detail: `${libraryText(copy, "语言：")}${language}` };
  const integrity = summary.initialized === null
    ? { value: libraryText(copy, "正在检查"), detail: libraryText(copy, "等待资料内容状态") }
    : summary.initialized === false
      ? { value: libraryText(copy, "尚未建立"), detail: libraryText(copy, "资料内容尚未建立") }
      : hasMissingComponents
        ? { value: `${libraryText(copy, "缺失")} ${summary.missingComponentCount} ${libraryText(copy, "项")}`, detail: definitionCounts }
        : { value: libraryText(copy, "定义完整"), detail: definitionCounts };

  return [
    { label: libraryText(copy, "当前版本"), value: activeVersion, detail: `${libraryText(copy, "启用于")} ${activatedAt}` },
    { label: libraryText(copy, "最新版本"), value: latestVersion, detail: `${libraryText(copy, "检查于")} ${checkedAt}` },
    { label: libraryText(copy, "资料库状态"), ...status },
    { label: libraryText(copy, "完整性"), ...integrity }
  ];
}

function formatManifestDefinitionCounts(
  summary: LibraryPageModel["manifestSummary"],
  locale: InterfaceLocale,
  copy: LibraryCopy
): string {
  if (summary.itemCount === undefined || summary.perkCount === undefined || summary.relationCount === undefined) {
    return libraryText(copy, "定义数量未读取");
  }
  const numberLocale = locale === "en-US" ? "en-US" : "zh-CN";
  return `${libraryText(copy, "装备")} ${summary.itemCount.toLocaleString(numberLocale)} · Perk ${summary.perkCount.toLocaleString(numberLocale)} · ${libraryText(copy, "关系")} ${summary.relationCount.toLocaleString(numberLocale)}`;
}

function renderEquipmentResult(
  row: LibraryEquipmentResultView,
  onOpenDefinition: (() => void) | undefined,
  onAddFavorite: (item: ItemSearchResult | PerkSearchResult) => void,
  onRemoveFavorite: (hash: number) => void,
  onLocateOwnedItem: ((item: ItemSearchResult) => void) | undefined,
  copy: LibraryCopy
) {
  const item = row.item;
  const equipmentTags = [
    toLibraryEquipmentTag(item.tier),
    toLibraryEquipmentTag(item.item_type),
    toLibraryEquipmentTag(item.bucket_name),
    toLibraryElementTag(item.damage_type),
    toLibraryChampionTag(item.breaker_type),
    item.is_adept ? toLibraryEquipmentTag(libraryText(copy, "专家")) : undefined,
    toLibraryAmmoTag(item.ammo_type, copy),
    toLibraryEquipmentTag(item.weapon_frame?.name)
  ].filter((tag): tag is LibraryEquipmentTag => Boolean(tag));
  const visibleVersion = item.release?.description ?? item.definition_version?.label;
  const versionDescription = item.release?.description ?? libraryText(copy, "暂无已验证版本");
  const sourceDescription = item.source.status === "ready"
    ? item.source.description
    : libraryText(copy, "暂无已验证来源");
  const liveChannelDescription = formatLibraryLiveChannel(row.liveEntry, copy);

  return (
    <article className="library-result-row" key={item.hash} role="listitem">
      <GameAssetImage alt="" loading="eager" src={item.icon} fallback={<span className="library-result-icon-placeholder" aria-hidden="true" />} />
      <div className="library-result-body">
        <div className="library-result-title-line">
          <h3>{item.name}</h3>
          {visibleVersion ? (
            <span className="library-result-version" title={visibleVersion}>
              <span>{libraryText(copy, "版本")}</span>
              <strong>{visibleVersion}</strong>
            </span>
          ) : null}
        </div>
        {equipmentTags.length ? (
          <div className="library-equipment-tags" aria-label={libraryText(copy, "装备信息")}>
            {equipmentTags.map((tag, index) => <span className={tag.className} key={`${tag.label}-${tag.className ?? "default"}-${index}`}>{tag.icon}{tag.label}</span>)}
          </div>
        ) : null}
        <div className="library-result-facts">
          <span className="app-chip">{formatAcquisitionStatus(row.acquisitionStatus, copy)}</span>
          <span className="app-chip">{formatOwnership(row.ownership, copy)}</span>
          <span className={`app-chip ${getDropAccessBadgeClass(row.dropAccess)}`}>{formatDropAccessLabel(row.dropAccess, copy)}</span>
        </div>
        <details className="library-source-details">
          <summary><strong>{libraryText(copy, "版本、来源与账号持有")}</strong><span>{sourceDescription}</span></summary>
          <dl className="library-version-source">
            <div><dt>{libraryText(copy, "版本")}</dt><dd>{versionDescription}</dd></div>
            <div><dt>{item.source.label}</dt><dd>{sourceDescription}</dd></div>
            <div><dt>{libraryText(copy, "当前公开渠道")}</dt><dd>{liveChannelDescription}</dd></div>
            <div><dt>{libraryText(copy, "获取状态")}</dt><dd>{formatAcquisitionStatus(row.acquisitionStatus, copy)}</dd></div>
            <div><dt>{libraryText(copy, "账号拥有")}</dt><dd>{formatOwnership(row.ownership, copy)}</dd></div>
            {item.description ? <div><dt>{libraryText(copy, "定义说明")}</dt><dd>{item.description}</dd></div> : null}
            {item.origin_traits?.length ? <div><dt>{libraryText(copy, "起源特性")}</dt><dd>{item.origin_traits.map((trait) => trait.name).join("、")}</dd></div> : null}
          </dl>
        </details>
      </div>
      <div className="library-result-actions">
        {onOpenDefinition ? <button type="button" data-ui-kind="button" data-control-variant="primary" disabled={row.isDetailLoading} onClick={onOpenDefinition} onKeyDown={handleResultActionKeyDown}>
          {row.isDetailLoading ? libraryText(copy, "打开中...") : libraryText(copy, "查看详情")}
        </button> : null}
        {row.isFavorite ? (
          <button type="button" data-ui-kind="button" data-control-variant="quiet" onClick={() => onRemoveFavorite(item.hash)} onKeyDown={handleResultActionKeyDown}>
            {libraryText(copy, "取消收藏")}
          </button>
        ) : (
          <button type="button" data-ui-kind="button" data-control-variant="quiet" onClick={() => onAddFavorite(item)} onKeyDown={handleResultActionKeyDown}>
            {libraryText(copy, "收藏")}
          </button>
        )}
        {row.ownership.vaultCount > 0 && onLocateOwnedItem ? (
          <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={() => onLocateOwnedItem(item)} onKeyDown={handleResultActionKeyDown}>
            {libraryText(copy, "在仓库定位")}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function renderPerkResult(
  row: LibraryPageModel["results"]["perks"][number],
  isFavorite: boolean,
  onLoadPerkRelatedEquipment: LibraryPageActions["onLoadPerkRelatedEquipment"],
  onOpenRelatedItem: LibraryPageActions["onOpenRelatedItem"],
  onAddFavorite: (item: ItemSearchResult | PerkSearchResult) => void,
  onRemoveFavorite: (hash: number) => void,
  copy: LibraryCopy
) {
  const perk = row.perk;
  const standardVariant = perk.variants.find((variant) => variant.kind === "standard");
  const enhancedVariant = perk.variants.find((variant) => variant.kind === "enhanced");
  const enhancedDescription = enhancedVariant
    ? formatEnhancedPerkDescription(perk.description, enhancedVariant.description)
    : "";
  const relatedCountLabel = row.isRelatedCountExact
    ? `${row.relatedCount} ${libraryText(copy, "件关联装备")}`
    : libraryText(copy, "关联数量需重启确认");
  return (
    <article className="library-result-row library-perk-result-row" key={perk.key} role="listitem">
      <GameAssetImage className="game-definition-icon" alt="" loading="eager" src={perk.icon} fallback={<span className="library-result-icon-placeholder" aria-hidden="true" />} />
      <div className="library-result-body">
        <h3>{perk.name}</h3>
        {perk.description ? <p>{perk.description}</p> : null}
        {enhancedDescription ? (
          <p className="library-perk-enhanced-description">
            <strong>{libraryText(copy, "强化：")}</strong>{enhancedDescription}
          </p>
        ) : null}
        <div className="library-result-facts">
          {standardVariant ? (
            <span className="app-chip">
              {libraryText(copy, "普通")} {standardVariant.related_count} {libraryText(copy, "件")}
            </span>
          ) : null}
          {enhancedVariant ? (
            <span className="app-chip status-ready">
              {libraryText(copy, "强化")} {enhancedVariant.related_count} {libraryText(copy, "件")}
            </span>
          ) : null}
          {!perk.variants.some((variant) => variant.kind !== "other") && perk.variants.length > 1 ? (
            <span className="app-chip">{perk.variants.length} {libraryText(copy, "个官方变体")}</span>
          ) : null}
          {row.relatedGroupKeys.map((group) => <span className="app-chip status-pending" key={group}>{formatLibraryGroupLabel(group, copy)}</span>)}
          <span className="app-chip">{relatedCountLabel}</span>
        </div>
        {row.hasRelatedItems ? (
          <details
            className="library-perk-related-items"
            onToggle={(event) => {
              if (event.currentTarget.open && !row.areRelatedItemsLoaded && !row.isRelatedItemsLoading) {
                onLoadPerkRelatedEquipment(perk);
              }
            }}
          >
            <summary>
              <strong>{libraryText(copy, "关联装备")}</strong>
              <span>{row.isRelatedCountExact ? `${row.relatedCount} ${libraryText(copy, "件关联装备，可按版本查看详情")}` : relatedCountLabel}</span>
            </summary>
            {row.isRelatedItemsLoading && !row.relatedItems.length ? (
              <p className="library-perk-related-status" aria-live="polite">{libraryText(copy, "正在读取关联装备...")}</p>
            ) : null}
            {row.relatedItemsError ? (
              <div className="library-perk-related-status status-error">
                <span>{row.relatedItemsError}</span>
                {!row.isRelatedItemsBlocked ? (
                  <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={() => onLoadPerkRelatedEquipment(perk)}>
                    {libraryText(copy, "重试")}
                  </button>
                ) : null}
              </div>
            ) : null}
            {row.areRelatedItemsLoaded && !row.relatedItems.length && !row.relatedItemsError ? (
              <p className="library-perk-related-status">{libraryText(copy, "资料库关系存在，但当前版本没有可展示的装备定义。")}</p>
            ) : null}
            {row.relatedItems.length ? (
              <div className="library-perk-related-list">
                {row.relatedItems.map((item) => renderPerkRelatedEquipment(item, onOpenRelatedItem, copy))}
              </div>
            ) : null}
            {row.hasMoreRelatedItems ? (
              <div className="library-perk-related-more">
                <button
                  type="button"
                  data-ui-kind="button"
                  data-control-variant="secondary"
                  disabled={row.isRelatedItemsLoading}
                  aria-busy={row.isRelatedItemsLoading}
                  onClick={() => onLoadPerkRelatedEquipment(perk, true)}
                >
                  {row.isRelatedItemsLoading ? libraryText(copy, "加载中...") : libraryText(copy, "加载更多")}
                </button>
                <span>{libraryText(copy, "已显示")} {row.relatedItems.length} / {row.relatedCount}</span>
              </div>
            ) : null}
          </details>
        ) : <p className="library-related-items">{libraryText(copy, "资料库里还没有查到关联装备。")}</p>}
      </div>
      <div className="library-result-actions">
        {isFavorite ? (
          <button type="button" data-ui-kind="button" data-control-variant="quiet" onClick={() => onRemoveFavorite(perk.hash)} onKeyDown={handleResultActionKeyDown}>{libraryText(copy, "取消收藏")}</button>
        ) : (
          <button type="button" data-ui-kind="button" data-control-variant="quiet" onClick={() => onAddFavorite(perk)} onKeyDown={handleResultActionKeyDown}>{libraryText(copy, "收藏")}</button>
        )}
      </div>
    </article>
  );
}

function renderPerkRelatedEquipment(
  item: LibraryPageModel["results"]["perks"][number]["relatedItems"][number],
  onOpenRelatedItem: LibraryPageActions["onOpenRelatedItem"],
  copy: LibraryCopy
): ReactNode {
  const tags = [
    toLibraryEquipmentTag(item.tier),
    toLibraryEquipmentTag(item.item_type),
    toLibraryEquipmentTag(item.weapon_frame?.name),
    toLibraryAmmoTag(item.ammo_type, copy),
    toLibraryElementTag(item.damage_type),
    item.is_adept ? toLibraryEquipmentTag(libraryText(copy, "专家")) : undefined,
    ...(item.matchedPerkVariants ?? []).map((variant) => toLibraryEquipmentTag(
      variant === "standard"
        ? libraryText(copy, "普通")
        : variant === "enhanced"
          ? libraryText(copy, "可强化")
          : libraryText(copy, "其他变体")
    ))
  ].filter((tag): tag is LibraryEquipmentTag => Boolean(tag));
  const version = item.release?.description ?? libraryText(copy, "版本待确认");
  const source = item.source.status === "ready"
    ? `${libraryText(copy, "历史来源：")}${item.source.description}`
    : libraryText(copy, "当前获取状态待确认");

  return (
    <button
      type="button"
      key={item.hash}
      disabled={item.isDetailLoading}
      aria-busy={item.isDetailLoading}
      onClick={() => onOpenRelatedItem(item)}
      onKeyDown={handleRelatedItemKeyDown}
    >
      <span className="library-perk-related-icon">
        <GameAssetImage
          alt=""
          loading="lazy"
          src={item.icon}
          fallback={<span className="library-perk-related-icon-placeholder" aria-hidden="true" />}
        />
        {item.definition_version?.current_watermark_icon ? (
          <GameAssetImage className="library-perk-related-watermark" alt="" loading="lazy" src={item.definition_version.current_watermark_icon} />
        ) : null}
      </span>
      <span className="library-perk-related-copy">
        <span className="library-perk-related-title">
          <strong>{item.name}</strong>
          <span className="library-result-version" title={version}><span>{libraryText(copy, "版本")}</span><strong>{version}</strong></span>
        </span>
        {tags.length ? (
          <span className="library-perk-related-tags" aria-label={libraryText(copy, "装备信息")}>
            {tags.map((tag, index) => <span className={tag.className} key={`${tag.label}-${index}`}>{tag.icon}{tag.label}</span>)}
          </span>
        ) : null}
        <span className="library-perk-related-source">{source}</span>
      </span>
      <span className="library-perk-related-action">
        {item.isDetailLoading ? libraryText(copy, "打开中...") : libraryText(copy, "查看详情")}
      </span>
    </button>
  );
}

function formatEnhancedPerkDescription(baseDescription: string, enhancedDescription: string): string {
  const base = baseDescription.trim();
  const enhanced = enhancedDescription.trim();
  if (!enhanced || enhanced === base) return "";
  if (base && enhanced.startsWith(base)) {
    return enhanced.slice(base.length).trim();
  }
  return enhanced;
}

export function LibraryDefinitionDialog(props: {
  item: ItemSearchResult;
  dropAccess: LibraryDropAccessKey;
  liveEntry?: LiveItemAvailabilityEntry;
  acquisitionStatus: "current" | "historical" | "unknown";
  ownership: LibraryOwnershipEntry;
  communityMatch?: VaultItemMatchInfo;
  vendorContext?: VendorOfferContext;
  isBusy?: boolean;
  error?: string;
  copy: LibraryCopy;
  onClose: () => void;
  onLocateOwnedItem?: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const initialFocusRef = useRef<HTMLElement | null>(
    typeof document === "undefined" ? null : document.activeElement as HTMLElement | null
  );
  const item = props.item;
  const copy = props.copy;
  const sourceStatus = item.source.status;
  const dropAccess = props.dropAccess;
  const liveEntry = props.liveEntry;
  const communityMatch = props.communityMatch;
  const weaponPerkColumns = item.group_key === "weapons"
    ? getLibraryWeaponPerkColumns(item.perks ?? [])
    : [];
  const vendorArmorStats = item.group_key === "armor"
    ? getVendorArmorStats(props.vendorContext?.stats)
    : [];
  const vendorArmorStatTotal = vendorArmorStats.reduce((total, stat) => total + stat.value, 0);
  const meta = [...new Set([
    item.tier,
    item.class_name,
    item.item_type,
    item.bucket_name,
    item.weapon_frame?.name
  ].filter((value): value is string => Boolean(value)))];

  useEffect(() => {
    closeButtonRef.current?.focus();

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        props.onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      )];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      initialFocusRef.current?.focus();
    };
  }, [props.onClose]);

  return (
    <div className="library-definition-modal">
      <button type="button" className="library-definition-backdrop" tabIndex={-1} aria-label={libraryText(copy, "关闭定义详情")} onClick={props.onClose} />
      <section
        ref={dialogRef}
        className="library-definition-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={props.isBusy ? "true" : "false"}
      >
        <div className="library-definition-toolbar">
          <div>
            <strong id={titleId}>{libraryText(copy, "定义详情")}</strong>
            <span>{libraryText(copy, "资料库定义，不是当前装备实例。")}</span>
          </div>
          <button ref={closeButtonRef} type="button" data-ui-kind="button" data-control-variant="secondary" onClick={props.onClose}>
            {libraryText(copy, "关闭")}
          </button>
        </div>
        <div className="library-definition-head">
          <GameAssetImage alt="" loading="eager" src={item.icon} />
          <div className="library-definition-identity">
            <span className={"ui-badge " + getDropAccessBadgeClass(dropAccess)}>{formatDropAccessLabel(dropAccess, copy)}</span>
            <h3>{item.name}</h3>
            <p>{meta.join(" / ") || libraryText(copy, "装备定义")}</p>
          </div>
          {props.vendorContext ? (
            <section className="shared-item-detail-vendor" role="region" aria-label="商人售卖信息">
              <strong>{props.vendorContext.vendorName}</strong>
              <span>{props.vendorContext.costLabel}</span>
              <span>{props.vendorContext.affordabilityLabel}</span>
              <span>{props.vendorContext.characterLabel}</span>
              <span>{props.vendorContext.refreshLabel}</span>
              {props.vendorContext.ownershipLabel ? (
                <span>账号状态：{props.vendorContext.ownershipLabel}</span>
              ) : null}
              {props.vendorContext.ownershipLocationLabel ? (
                <span>实例位置：{props.vendorContext.ownershipLocationLabel}</span>
              ) : null}
              {props.vendorContext.ownershipAsOfLabel ? (
                <span>账号数据：{props.vendorContext.ownershipAsOfLabel}</span>
              ) : null}
              {item.group_key === "weapons" && props.vendorContext.rollLabels?.length ? (
                <span>当前售卖 Perk：{props.vendorContext.rollLabels.join(" / ")}</span>
              ) : null}
              {item.group_key === "armor" && vendorArmorStats.length ? (
                <span>当前售卖属性：总计 {vendorArmorStatTotal}</span>
              ) : null}
            </section>
          ) : null}
        </div>
        <div className="library-definition-body">
          <section className="library-definition-primary">
            {item.group_key === "weapons" && weaponPerkColumns.length ? (
              <section className="library-definition-perk-pool" aria-label={libraryText(copy, "武器 Perk 池")}>
                <div className="library-definition-section-heading">
                  <strong>{libraryText(copy, "武器 Perk 池")}</strong>
                  <span>{libraryText(copy, "按玩家可读的武器列展示，不显示大师杰作、模组、专家模组或已有装备实例状态。")}</span>
                </div>
                <div className="library-definition-perk-columns">
                  {weaponPerkColumns.map((column) => (
                    <div className="library-definition-perk-column" key={column.key}>
                      <h4>{libraryText(copy, column.label)}</h4>
                      <div className="library-definition-perk-list">
                        {column.plugs.map((plug) => (
                          <article className="library-definition-perk-card" key={plug.hash}>
                            <GameAssetImage className="game-definition-icon" alt="" loading="eager" src={plug.icon} fallback={<span aria-hidden="true" />} />
                            <div>
                              <strong>{plug.name}</strong>
                              {plug.description ? <p>{plug.description}</p> : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : item.group_key === "armor" ? (
              <div className="library-definition-armor-primary">
                <section className="library-definition-intrinsics" aria-label={libraryText(copy, "异域固有特性")}>
                  <div className="library-definition-section-heading">
                    <strong>{libraryText(copy, "异域固有特性")}</strong>
                    <span>{libraryText(copy, "来自 Bungie 资料库的固定特性，不包含护甲模组、能量或实际属性 Roll。")}</span>
                  </div>
                  {item.intrinsic_traits?.length ? (
                    <div className="library-definition-intrinsic-list">
                      {item.intrinsic_traits.map((trait) => (
                        <article className="library-definition-intrinsic-card" key={trait.hash}>
                          <GameAssetImage className="game-definition-icon" alt="" loading="eager" src={trait.icon} fallback={<span aria-hidden="true" />} />
                          <div>
                            <strong>{trait.name}</strong>
                            {trait.description ? <p>{trait.description}</p> : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="muted-copy">{libraryText(copy, "资料库暂未提供可确认的护甲固有特性。")}</p>
                  )}
                </section>
                {vendorArmorStats.length ? (
                  <section className="library-definition-vendor-armor-stats" aria-label="当前售卖属性">
                    <div className="library-definition-section-heading">
                      <strong>当前售卖属性</strong>
                      <span>总计 {vendorArmorStatTotal}</span>
                    </div>
                    <div className="library-definition-vendor-armor-stat-list">
                      {vendorArmorStats.map((stat) => (
                        <div className="library-definition-vendor-armor-stat" key={stat.hash}>
                          <span>{stat.label}</span>
                          <b>{stat.value}</b>
                          <i style={{ width: `${Math.max(4, Math.min(100, stat.value / 30 * 100))}%` }} aria-hidden="true" />
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            ) : (
              <section className="library-definition-generic-primary" aria-label={libraryText(copy, "装备定义")}>
                <div className="library-definition-section-heading">
                  <strong>{libraryText(copy, "装备定义")}</strong>
                </div>
                <p>{item.description || libraryText(copy, "资料库暂未提供该装备的专属定义结构。")}</p>
              </section>
            )}
          </section>
          <aside className="library-definition-overview">
            {props.error ? <div className="status-message is-error" role="status">{props.error}</div> : null}
            <div className="library-definition-meta" aria-label={libraryText(copy, "定义字段")}>
              {meta.map((value) => <span key={value}>{value}</span>)}
              <span>{libraryText(copy, "Hash")} {item.hash}</span>
            </div>
            {item.description && (item.group_key === "weapons" || item.group_key === "armor") ? (
              <p className="library-definition-description">{item.description}</p>
            ) : null}
            {item.definition_stats?.length ? (
              <section className="library-definition-stats" aria-label={libraryText(copy, "定义属性")}>
                <div className="library-definition-section-heading">
                  <strong>{libraryText(copy, "定义属性")}</strong>
                  <span>{libraryText(copy, "来自资料库定义数值，不包含已有装备 Roll。")}</span>
                </div>
                <div className="library-definition-stat-list">
                  {item.definition_stats.map((stat) => (
                    <DefinitionStatRow key={stat.hash} stat={stat} />
                  ))}
                </div>
              </section>
            ) : null}
            <div className="library-definition-source-grid">
              <div className="library-definition-source">
                <strong>{libraryText(copy, "获取状态")}</strong>
                <span>{formatAcquisitionStatus(props.acquisitionStatus, copy)}</span>
              </div>
              <div className="library-definition-source">
                <strong>{libraryText(copy, "账号拥有")}</strong>
                <span>{formatOwnership(props.ownership, copy)}</span>
                {(props.ownership?.vaultCount ?? 0) > 0 && props.onLocateOwnedItem ? (
                  <button type="button" className="inline-action" onClick={props.onLocateOwnedItem}>
                    {libraryText(copy, "在仓库定位")}
                  </button>
                ) : null}
              </div>
              <div className="library-definition-source">
                <div className="item-source-heading">
                  <strong>{libraryText(copy, "实时状态")}</strong>
                  <span className={"source-status-badge " + getLiveStatusClass(liveEntry)}>
                    {liveEntry?.label ?? libraryText(copy, "等待实时查询")}
                  </span>
                </div>
                <span>{liveEntry?.description ?? libraryText(copy, "正在结合 Bungie 当前公开数据和登录角色商人数据复查。")}</span>
                {liveEntry?.sources.length ? <small>{liveEntry.sources.map((source) => formatLiveSource(source, copy)).join(" / ")}</small> : null}
              </div>
              <div className="library-definition-source">
                <div className="item-source-heading">
                  <strong>{item.source.label}</strong>
                  <span className={"source-status-badge " + getLibrarySourceStatusClass(sourceStatus)}>
                    {formatLibrarySourceStatus(sourceStatus, copy)}
                  </span>
                </div>
                <span>{item.source.description}</span>
              </div>
              <div className="library-definition-source">
                <strong>{libraryText(copy, "刷取判断")}</strong>
                <span>{formatDropActionHint(dropAccess, communityMatch, liveEntry, copy)}</span>
              </div>
              {communityMatch && (communityMatch.available ?? 0) > 0 ? (
                <div className="library-definition-source">
                  <strong>{libraryText(copy, "社区推荐")}</strong>
                  <span>{`${formatCommunityRecommendationCount(communityMatch, copy)}${
                    formatCommunityPerkPreview(communityMatch?.sample_perks)
                      ? ` · ${formatCommunityPerkPreview(communityMatch?.sample_perks)}`
                      : ""
                  }`}</span>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function formatCommunityRecommendationCount(
  match: VaultItemMatchInfo,
  copy: LibraryCopy
): string {
  const parts = [
    match.perk_pool_count ? `${match.perk_pool_count} ${libraryText(copy, "个 Perk 池")}` : undefined,
    match.combo_count ? `${match.combo_count} ${libraryText(copy, "个组合")}` : undefined
  ].filter((part): part is string => Boolean(part));
  return parts.join(" · ") || `${match.available} ${libraryText(copy, "条推荐")}`;
}

const vendorArmorStatDefinitions = [
  { hash: "2996146975", label: "机动" },
  { hash: "392767087", label: "韧性" },
  { hash: "1943323491", label: "恢复" },
  { hash: "1735777505", label: "纪律" },
  { hash: "144602215", label: "智慧" },
  { hash: "4244567218", label: "力量" }
] as const;

function getVendorArmorStats(stats: Record<string, number> | undefined): Array<{
  hash: string;
  label: string;
  value: number;
}> {
  if (!stats) return [];
  return vendorArmorStatDefinitions.flatMap((definition) => {
    const value = stats[definition.hash];
    return typeof value === "number" ? [{ ...definition, value }] : [];
  });
}

function DefinitionStatRow(props: { stat: LibraryDefinitionStat }) {
  const stat = props.stat;
  const fillPercent = Math.max(3, Math.min(100, (stat.value / stat.display_maximum) * 100));

  return (
    <div className="library-definition-stat-row">
      <span>{stat.name}</span>
      <b>{stat.value}</b>
      <i style={{ width: `${fillPercent}%` }} aria-hidden="true" />
    </div>
  );
}

export function getLibraryRandomPerkGroups(groups: LibraryPerkGroup[]): LibraryPerkGroup[] {
  return normalizeLibraryWeaponPerkGroups(groups);
}

export function getLibraryWeaponPerkColumns(groups: LibraryPerkGroup[]): LibraryWeaponPerkColumn[] {
  const columns = normalizeLibraryWeaponPerkGroups(groups)
    .flatMap((group) => {
      const role = classifyWeaponSocketPlugs(group.plugs);
      if (!role) return [];

      return [{
        key: `socket-${group.socket_index}`,
        socket_index: group.socket_index,
        label: weaponSocketColumnLabel(group.plugs, role, group.socket_index),
        role,
        plugs: group.plugs
      }];
    })
    .sort((left, right) => left.socket_index - right.socket_index);
  let traitIndex = 0;
  return columns.map((column) => ({
    key: column.key,
    label: column.role === "trait" ? `Perk ${++traitIndex}` : column.label,
    plugs: column.plugs
  }));
}

function normalizeLibraryWeaponPerkGroups(groups: LibraryPerkGroup[]): LibraryPerkGroup[] {
  return groups
    .filter((group) => group.socket_index >= 0)
    .map((group) => ({
      ...group,
      plugs: group.plugs.filter((plug) => !isWeaponSystemPlug(plug))
    }))
    .filter((group) => group.plugs.length > 0);
}

function formatLiveSource(source: LiveEntry["sources"][number], copy: LibraryCopy): string {
  if (source.kind === "character_vendor") {
    return source.character_id ? `${source.label}（${libraryText(copy, "角色")} ${source.character_id}）` : source.label;
  }
  return source.label;
}

function formatCommunityPerkPreview(perks: VaultItemMatchInfo["sample_perks"]): string {
  if (!perks?.length) {
    return "";
  }

  return perks
    .slice(0, 2)
    .map((perk) => (perk.englishName ? `${perk.name} / ${perk.englishName}` : perk.name))
    .join(" · ");
}

function formatLibraryAmmo(ammoType: ItemSearchResult["ammo_type"], copy: LibraryCopy): string | undefined {
  if (ammoType === "primary") return libraryText(copy, "主弹药");
  if (ammoType === "special") return libraryText(copy, "特殊弹药");
  if (ammoType === "heavy") return libraryText(copy, "重型弹药");
  return undefined;
}

function toLibraryAmmoTag(ammoType: ItemSearchResult["ammo_type"], copy: LibraryCopy): LibraryEquipmentTag | undefined {
  const label = formatLibraryAmmo(ammoType, copy);
  if (!ammoType || !label) return undefined;
  return {
    label,
    className: `library-ammo-tag library-ammo-${ammoType}`,
    icon: <GameCombatIcon kind="ammo" type={ammoType} size="compact" />
  };
}

function toLibraryEquipmentTag(label: string | undefined): LibraryEquipmentTag | undefined {
  return label ? { label } : undefined;
}

function toLibraryElementTag(damageType: string | undefined): LibraryEquipmentTag | undefined {
  const keyByDamageType: Record<string, GameDamageTypeKey> = {
    "动能伤害": "kinetic",
    "电弧伤害": "arc",
    "烈日伤害": "solar",
    "虚空伤害": "void",
    "冰影伤害": "stasis",
    "缚丝伤害": "strand"
  };
  const key = damageType ? keyByDamageType[damageType] : undefined;
  return key && damageType ? {
    label: damageType,
    className: `library-element-tag library-element-${key}`,
    icon: <GameCombatIcon kind="damage" type={key} size="compact" />
  } : toLibraryEquipmentTag(damageType);
}

function toLibraryChampionTag(breakerType: ItemSearchResult["breaker_type"]): LibraryEquipmentTag | undefined {
  if (!breakerType) return undefined;
  const labels = {
    barrier: "反屏障",
    overload: "反过载",
    unstoppable: "反势不可挡"
  } as const;
  return {
    label: labels[breakerType.champion_type],
    className: `library-champion-tag library-champion-${breakerType.champion_type}`,
    icon: <GameCombatIcon kind="champion" type={breakerType.champion_type} src={breakerType.icon} size="compact" />
  };
}

function formatLibraryLiveChannel(liveEntry: LiveEntry | undefined, copy: LibraryCopy): string {
  if (!liveEntry) return libraryText(copy, "正在查询商人和公共活动。");
  if (liveEntry.status === "manifest_only") {
    return libraryText(copy, "当前商人和公共活动未直接命中。")
  }
  return liveEntry.label;
}

function formatLibraryGroupLabel(
  group: ItemSearchResult["group_key"],
  copy: LibraryCopy
) {
  if (group === "weapons") return libraryText(copy, "武器");
  if (group === "armor") return libraryText(copy, "护甲");
  if (group === "equipment") return libraryText(copy, "装备");
  if (group === "other") return libraryText(copy, "其他");
  return "";
}

function formatLibrarySourceStatus(status: ItemSearchResult["source"]["status"], copy: LibraryCopy): string {
  return status === "ready" ? libraryText(copy, "可确认") : libraryText(copy, "待补充");
}

function formatAcquisitionStatus(
  status: "current" | "historical" | "unknown",
  copy: LibraryCopy
): string {
  if (status === "current") return libraryText(copy, "当前可获取");
  if (status === "historical") return libraryText(copy, "历史来源线索");
  return libraryText(copy, "来源未知");
}

function formatOwnership(ownership: LibraryOwnershipEntry | undefined, copy: LibraryCopy): string {
  if (!ownership || ownership.status === "unavailable") return libraryText(copy, "账号数据未读取");
  if (ownership.status === "not_owned") return libraryText(copy, "未拥有");
  const locations = ownership.locations.map((location) => `${location.label} ${location.count} 件`).join(" / ");
  return `${libraryText(copy, "已拥有")} ${ownership.totalCount} 件${locations ? ` · ${locations}` : ""}`;
}

function getLibrarySourceStatusClass(status: ItemSearchResult["source"]["status"]): string {
  return status === "ready" ? "source-status-ready" : "source-status-pending";
}

function getLiveStatusClass(entry: LiveEntry | undefined): string {
  if (!entry) return "source-status-pending";
  if (entry.status === "character_vendor" || entry.status === "public_vendor") return "source-status-ready";
  if (entry.status === "public_activity") return "source-status-warning";
  return "source-status-neutral";
}

function formatDropAccessLabel(access: LibraryDropAccessKey, copy: LibraryCopy): string {
  if (access === "available") return libraryText(copy, "来源可确认");
  if (access === "rotation") return libraryText(copy, "等轮换");
  if (access === "archived") return libraryText(copy, "已下架或待确认");
  return libraryText(copy, "来源待补");
}

function formatDropAccessDescription(access: LibraryDropAccessKey, copy: LibraryCopy): string {
  if (access === "available") {
    return libraryText(copy, "来源字段可确认，但不等同于当前在线可刷；实时活动或商人轮换接入前只作为刷取线索。");
  }
  if (access === "rotation") {
    return libraryText(copy, "来源说明包含铁旗、试炼、夜幕、每周或轮换类线索，需要结合当前轮换复查。");
  }
  if (access === "archived") {
    return libraryText(copy, "来源说明显示不可获取、传承或下架状态。");
  }
  return libraryText(copy, "资料库暂未提供可确认来源。");
}

function formatDropActionHint(
  access: LibraryDropAccessKey,
  communityMatch: VaultItemMatchInfo | undefined,
  liveEntry: LiveEntry | undefined,
  copy: LibraryCopy
): string {
  if (liveEntry?.status === "character_vendor") {
    return libraryText(copy, "优先复查：当前登录角色商人库存已命中，可以进游戏确认购买资格和价格。");
  }
  if (liveEntry?.status === "public_vendor") {
    return libraryText(copy, "优先复查：当前公开商人库存已命中，可以进游戏确认购买资格和价格。");
  }
  if (liveEntry?.status === "public_activity") {
    return libraryText(copy, "当前公共活动有直接奖励线索，但仍需要进游戏确认活动入口和掉落规则。");
  }

  const hasCommunityRolls = (communityMatch?.available ?? 0) > 0;

  if (access === "available") {
    return hasCommunityRolls
      ? libraryText(copy, "优先复查：来源字段可确认，且已有社区推荐资料；仍需以当前游戏内入口为准。")
      : libraryText(copy, "来源字段可确认；建议先核对当前游戏内入口，再决定是否刷取。");
  }
  if (access === "rotation") {
    return libraryText(copy, "等待轮换：来源字段提示周期活动或周常内容，先关注本周轮换再投入时间。");
  }
  if (access === "archived") {
    return libraryText(copy, "谨慎投入：来源线索显示下架、传承或不可获取，除非游戏内有新入口恢复。");
  }
  return libraryText(copy, "先补来源：当前资料库没有足够来源信息，不把它列为可刷目标。");
}

function getDropAccessBadgeClass(access: LibraryDropAccessKey): string {
  if (access === "available") return "status-ready";
  if (access === "rotation") return "status-warning";
  if (access === "archived") return "status-neutral";
  return "status-neutral";
}
