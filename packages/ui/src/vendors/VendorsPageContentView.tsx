import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { getLocaleCopy } from "../i18n/copy.js";
import { getRovingFocusIndex } from "../interaction/rovingFocus.js";
import type { InterfaceLocale } from "../i18n/types.js";
import { GameAssetImage } from "../media/GameAssetImage.js";
import { formatFullDateTime, formatScheduleDateTime } from "../time/formatTime.js";
import {
  ProductWorkspaceEmptyState,
  ProductWorkspaceSideRail,
  ProductWorkspaceSplit
} from "../workspace/ProductWorkspace.js";
import { getVendorEquipmentKind } from "./vendorEquipment.js";

export type VendorCostView = {
  label: string;
  required: number;
  owned: number | null;
  affordable: boolean | null;
  iconUrl?: string;
};

export type VendorInventoryItemView = {
  id: string;
  itemHash?: number;
  quantity?: number;
  vendorItemIndex?: number;
  vendorHash?: number;
  categoryIndex?: number;
  categoryName?: string;
  characterIds?: string[];
  name: string;
  itemType: string;
  summary: string;
  cost?: string;
  costs?: VendorCostView[];
  iconLabel: string;
  iconUrl?: string;
  costIconLabel?: string;
  costIconUrl?: string;
  tone: "exotic" | "weapon" | "armor" | "material";
  status: "owned" | "not_owned" | "partial" | "unknown";
  equipmentKind?: "weapon" | "armor";
  ownership?: {
    state: "owned" | "not_owned" | "partial" | "unknown";
    count: number | null;
    label: string;
    locationLabels: string[];
    asOf?: string;
  };
  canPurchase?: boolean;
  failureMessages?: string[];
  stats?: Record<string, number>;
  socketPlugs?: Array<{
    hash: number;
    name: string;
    iconUrl?: string;
    description?: string;
    categoryIdentifier?: string;
    statModifiers?: Record<string, number>;
    itemType?: string;
  }>;
  sourcePath?: string;
};

export type VendorInventorySectionView = {
  id: string;
  name: string;
  description?: string;
  presentation?: "standard" | "featured";
  items: VendorInventoryItemView[];
};

export type VendorProgressionView = {
  currentProgress: number;
  level: number;
  levelCap: number;
  progressToNextLevel: number;
  nextLevelAt: number;
};

export type VendorContentSectionView = {
  id: string;
  kind: "reputation" | "inventory" | "subinventory" | "tasks";
  scope?: "character" | "account" | "clan";
  action?: "purchase" | "exchange" | "focus" | "decode" | "claim" | "acquire" | "inspect";
  condition?: string;
  name: string;
  description?: string;
  layout: "featured" | "columns" | "list" | "rank";
  groups: VendorInventorySectionView[];
  progression?: VendorProgressionView;
};

export type VendorServiceView = {
  id: string;
  name: string;
  description: string;
  items: VendorInventoryItemView[];
  sections?: VendorInventorySectionView[];
};

export type VendorInventoryGroupView = {
  id: string;
  vendorHash?: number;
  name: string;
  description: string;
  badge: string;
  source: string;
  resetLabel: string;
  resetAt?: string;
  location?: string;
  category?: string;
  iconLabel?: string;
  iconUrl?: string;
  statusLabel?: string;
  taskCategory?: string;
  displayStatusLabel?: string;
  inventoryState?: "loaded" | "empty" | "unavailable";
  inventoryStateLabel?: string;
  railStatusLabel?: string;
  detailToolbar?: VendorDetailToolbarView;
  detailState?: "pending" | "ready" | "partial" | "failed";
  detailFailureMessage?: string;
  featured?: boolean;
  items: VendorInventoryItemView[];
  services?: VendorServiceView[];
  rankRewards?: VendorInventoryItemView[];
  taskItems?: VendorInventoryItemView[];
  progression?: VendorProgressionView;
  contentSections?: VendorContentSectionView[];
};

export type VendorRailSectionView = {
  id: string;
  title: string;
  vendors: VendorInventoryGroupView[];
};

export type VendorDetailToolbarView = {
  taskCategory: string;
  inventoryStateLabel: string;
  statusLabel: string;
  itemCountLabel: string;
};

export type VendorCharacterContextView = {
  characterId?: string;
  armorerModHash: number | null;
  armorerModName: string | null;
  label: string;
};

export type VendorScopeOptionView = {
  kind: "character" | "account";
  characterId?: string;
  label: string;
  description: string;
};

export type VendorStatusBannerView = {
  tone: "neutral" | "error";
  message: string;
  live: "polite";
  busy: boolean;
} | null;

export type VendorsPageModelView = {
  vendors: VendorInventoryGroupView[];
  railSections: VendorRailSectionView[];
  defaultVendorId?: string | null;
  selectedVendor?: VendorInventoryGroupView;
  updatedLabel: string;
  updatedAt?: string;
  sourceLabel: string;
  nextResetLabel: string;
  nextResetAt?: string;
  verifiedItemCount: number;
  scopeOptions?: VendorScopeOptionView[];
  selectedScope?: VendorScopeOptionView;
  selectedCharacterContext?: VendorCharacterContextView | null;
  statusBanner?: VendorStatusBannerView;
  resourceStatus?: "unavailable" | "loading" | "refreshing" | "ready" | "stale" | "error";
  resourceSource?: "local" | "remote" | "merged";
};

export type VendorOfferContextView = {
  vendorName: string;
  inventoryPath?: string;
  costLabel: string;
  affordabilityLabel: string;
  characterLabel: string;
  refreshLabel: string;
  purchaseRequirements?: string[];
  rollLabels?: string[];
  stats?: Record<string, number>;
  ownershipLabel?: string;
  ownershipLocationLabel?: string;
  ownershipAsOfLabel?: string;
};

export type VendorsPageActions = {
  selectVendor?: (vendorId: string) => void;
  refreshVendors?: () => void;
  onOpenItem?: (item: VendorInventoryItemView, context: VendorOfferContextView) => void;
};

export type VendorsPageContentViewProps = {
  interfaceLocale?: InterfaceLocale;
  model: VendorsPageModelView;
  actions: VendorsPageActions;
  availability?: {
    isBungieConfigured: boolean;
    isAccountLoggedIn: boolean;
    onConfigureBungie: () => void;
    onLoginBungie: () => void;
  };
};

export function VendorsPageContentView(props: VendorsPageContentViewProps) {
  const locale = props.interfaceLocale ?? "zh-CN";
  const copy = getLocaleCopy(locale).vendors;
  const initialVendorId = props.model.defaultVendorId
    ?? props.model.vendors.find((vendor) => vendor.featured)?.id
    ?? props.model.vendors[0]?.id
    ?? "";
  const [selectedVendorId, setSelectedVendorId] = useState(initialVendorId);
  const selectedVendor = props.model.vendors.find((vendor) => vendor.id === selectedVendorId)
    ?? props.model.selectedVendor
    ?? props.model.vendors[0]
    ?? null;
  const refreshStatus = props.model.statusBanner;
  const [vendorSearchQuery, setVendorSearchQuery] = useState("");
  const [vendorFilters, setVendorFilters] = useState({ affordableOnly: false, unownedOnly: false });
  const accountOwnershipFilterAvailable = selectedVendor
    ? getVendorContentSections(selectedVendor).some((section) => section.groups.some((group) => group.items.some((item) => (
        Boolean(getVendorEquipmentKind(item))
        && item.ownership?.state !== undefined
        && item.ownership.state !== "unknown"
      ))))
    : false;

  if (props.availability && (!props.availability.isBungieConfigured || !props.availability.isAccountLoggedIn)) {
    const isConfigured = props.availability.isBungieConfigured;
    const text = (key: string) => copy.inline[key] ?? key;
    return (
      <ProductWorkspaceEmptyState className="account-unavailable vendor-page-empty product-workspace-empty--page" ariaLabel="商人访问状态" role="status">
        <span className="ui-badge status-warning">{text("未连接 Bungie")}</span>
        <h2>{text(isConfigured ? "账号还没有登录" : "还没有配置 Bungie 应用")}</h2>
        <p>{text(isConfigured ? "先登录 Bungie；登录后会自动同步装备数据并加载角色商人库存。" : "先在设置里完成 Bungie 应用配置，再登录账号加载商人库存。")}</p>
        <div className="button-row">
          {isConfigured ? (
            <button type="button" data-ui-kind="button" data-control-variant="primary" onClick={props.availability.onLoginBungie}>{text("登录 Bungie")}</button>
          ) : (
            <button type="button" data-ui-kind="button" data-control-variant="primary" onClick={props.availability.onConfigureBungie}>{text("去设置 Bungie")}</button>
          )}
        </div>
      </ProductWorkspaceEmptyState>
    );
  }

  if (!selectedVendor) {
    return (
      <ProductWorkspaceEmptyState
        className="vendor-page-empty product-workspace-empty--page"
        ariaLabel="商人刷新状态"
        role="status"
        ariaLive={refreshStatus?.live ?? "polite"}
        ariaBusy={refreshStatus?.busy ?? false}
      >
        <strong>{refreshStatus?.busy ? copy.loadingTitle : copy.emptyTitle}</strong>
        <span>{refreshStatus?.message ?? copy.emptyBody}</span>
        {!refreshStatus?.busy && props.actions.refreshVendors ? <button type="button" data-ui-kind="button" data-control-variant="primary" onClick={props.actions.refreshVendors}>{copy.inline["重新加载商人库存"] ?? "重新加载商人库存"}</button> : null}
      </ProductWorkspaceEmptyState>
    );
  }

  const normalizedVendorSearchQuery = vendorSearchQuery.trim().toLocaleLowerCase(locale);
  const allContentSections = prioritizeVendorSections(getVendorContentSections(selectedVendor));
  const normalizedContentSearchQuery = vendorHasItemMatch(selectedVendor, normalizedVendorSearchQuery)
    ? normalizedVendorSearchQuery
    : "";
  const activeVendorFilters = {
    ...vendorFilters,
    unownedOnly: vendorFilters.unownedOnly && accountOwnershipFilterAvailable
  };
  const contentSections = filterVendorSections(allContentSections, activeVendorFilters, normalizedContentSearchQuery);
  const allItemCount = countSectionItemsFromSections(allContentSections);
  const visibleItemCount = countSectionItemsFromSections(contentSections);
  const hasContentFilter = Boolean(normalizedContentSearchQuery || activeVendorFilters.affordableOnly || activeVendorFilters.unownedOnly);
  const vendorStatus = getVendorStatus(selectedVendor);
  const selectedVendorResetLabel = formatVendorReset(selectedVendor, locale);
  const updatedLabel = formatFullDateTime(props.model.updatedAt, props.model.updatedLabel);
  const visibleRailSections = props.model.railSections.flatMap((section) => {
    const vendors = section.vendors.filter((vendor) => vendorMatchesSearch(vendor, normalizedVendorSearchQuery));
    return vendors.length ? [{ ...section, vendors }] : [];
  });
  const visibleVendorIds = new Set(visibleRailSections.flatMap((section) => section.vendors.map((vendor) => vendor.id)));
  const firstVisibleVendorId = visibleRailSections[0]?.vendors[0]?.id;
  const railTabStopId = visibleVendorIds.has(selectedVendor.id) ? selectedVendor.id : firstVisibleVendorId;
  const toolbarMessage = refreshStatus?.message
    ?? (selectedVendor.detailState === "pending"
      ? "商人详情正在读取；不会回退到旧库存。"
      : selectedVendor.detailState === "partial"
        ? "商人详情部分可用；缺失范围已在下方标注。"
        : updatedLabel);

  function selectVendor(vendorId: string) {
    setSelectedVendorId(vendorId);
    props.actions.selectVendor?.(vendorId);
  }

  function handleVendorKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    const navigation = event.currentTarget.closest("nav");
    const isHorizontalRail = navigation && window.getComputedStyle(navigation).display === "flex";
    if (event.key === "ArrowRight" && !isHorizontalRail) {
      const contentTarget = event.currentTarget.closest<HTMLElement>(".vendor-workbench")
        ?.querySelector<HTMLElement>(".vendor-section-nav button, .vendor-offer-card");
      if (contentTarget instanceof HTMLElement) {
        event.preventDefault();
        contentTarget.focus();
        contentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
        return;
      }
    }
    const buttons = [...(navigation?.querySelectorAll<HTMLButtonElement>("button[data-vendor-id]") ?? [])];
    const currentIndex = buttons.indexOf(event.currentTarget);
    const nextIndex = getRovingFocusIndex({
      key: event.key,
      currentIndex,
      itemCount: buttons.length,
      orientation: isHorizontalRail ? "horizontal" : "vertical"
    });
    if (nextIndex === null) return;
    event.preventDefault();
    const nextButton = buttons[nextIndex];
    const vendorId = nextButton?.dataset.vendorId;
    if (!nextButton || !vendorId) return;
    selectVendor(vendorId);
    nextButton.focus();
  }

  function focusFirstVisibleVendor(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowRight") return;
    const firstButton = event.currentTarget.closest(".vendor-rail")
      ?.querySelector<HTMLButtonElement>("button[data-vendor-id]");
    if (!firstButton) return;
    event.preventDefault();
    firstButton.focus();
  }

  return (
    <ProductWorkspaceSplit className="vendor-workbench-layout vendor-workbench">
      <ProductWorkspaceSideRail className="vendor-rail" ariaLabel="商人地点目录" scrollRegion="pane">
        <div className="vendor-column-head"><strong>地点目录</strong><span>{normalizedVendorSearchQuery ? `${visibleVendorIds.size} / ${props.model.vendors.length}` : props.model.vendors.length} 个商人</span></div>
        <label className="vendor-rail-search">
          <span>搜索商人或库存</span>
          <input
            type="search"
            value={vendorSearchQuery}
            placeholder="搜索商人、物品或分类"
            onChange={(event) => setVendorSearchQuery(event.currentTarget.value)}
            onKeyDown={focusFirstVisibleVendor}
          />
        </label>
        <nav aria-label="商人列表" className="vendor-rail-nav">
          {visibleRailSections.map((section) => (
            <section className="vendor-location-group" key={section.id} aria-label={section.title}>
              <strong className="vendor-location-title">{section.title}</strong>
              {section.vendors.map((vendor) => {
                const active = vendor.id === selectedVendor.id;
                return (
                  <button
                    type="button"
                    className={active ? "vendor-rail-item is-active" : "vendor-rail-item"}
                    key={vendor.id}
                    aria-current={active ? "page" : undefined}
                    data-vendor-id={vendor.id}
                    data-status={getVendorStatus(vendor)}
                    tabIndex={vendor.id === railTabStopId ? 0 : -1}
                    onClick={() => selectVendor(vendor.id)}
                    onKeyDown={handleVendorKeyDown}
                  >
                    <span><strong>{vendor.name}</strong><small>{getVendorRailSummary(vendor)}</small></span>
                  </button>
                );
              })}
            </section>
          ))}
          {!visibleRailSections.length ? (
            <div className="vendor-rail-empty" role="status">
              <strong>没有匹配的商人或库存</strong>
              <span>换一个名称、物品或分类关键词试试。</span>
            </div>
          ) : null}
        </nav>
      </ProductWorkspaceSideRail>

      <section className="vendor-detail-main">
        <header className="vendor-hero">
          <div>
            <span className="vendor-eyebrow">{selectedVendor.location || "地点待确认"}</span>
            <div className="vendor-heading-line"><h2>{selectedVendor.name}</h2><VendorResourceStatus status={props.model.resourceStatus ?? "ready"} source={props.model.resourceSource ?? "merged"} /></div>
            <p>{selectedVendor.description || "当前商人没有额外说明"}</p>
            <div className="vendor-hero-meta">
              <span>{selectedVendor.source}</span>
              <span>{selectedVendorResetLabel}</span>
              <span>{visibleItemCount}{visibleItemCount === allItemCount ? "" : ` / ${allItemCount}`} 个可见条目</span>
              <span>{updatedLabel}</span>
            </div>
          </div>
          <span className="vendor-status-chip" data-status={vendorStatus}>{getVendorDisplayStatusLabel(selectedVendor)}</span>
        </header>

        <div className="vendor-toolbar" role="status" aria-label="商人刷新状态" aria-live={refreshStatus?.live ?? "polite"} aria-busy={refreshStatus?.busy ?? false}>
          <span className="vendor-character-context"><strong>{props.model.selectedScope?.kind === "character" ? props.model.selectedScope.label : "当前角色"}</strong><small>{props.model.selectedCharacterContext?.label ?? "当前机灵：未检测到护甲师模组"}</small></span>
          <span data-status={refreshStatus?.tone === "error" ? "error" : vendorStatus}>{toolbarMessage}</span>
          <span className="vendor-toolbar-actions" aria-label="库存筛选">
            <button
              type="button"
              data-ui-kind="button"
              data-control-variant="quiet"
              data-control-size="compact"
              aria-pressed={vendorFilters.affordableOnly}
              onClick={() => setVendorFilters((current) => ({ ...current, affordableOnly: !current.affordableOnly }))}
            >只看可负担</button>
            <button
              type="button"
              data-ui-kind="button"
              data-control-variant="quiet"
              data-control-size="compact"
              aria-pressed={activeVendorFilters.unownedOnly}
              disabled={!accountOwnershipFilterAvailable}
              title={accountOwnershipFilterAvailable ? undefined : "账号拥有状态读取完成后可用"}
              onClick={() => setVendorFilters((current) => ({ ...current, unownedOnly: !current.unownedOnly }))}
            >账号无同身份实例</button>
          </span>
        </div>

        <VendorSectionNavigation sections={contentSections} vendor={selectedVendor} />

        <div className="vendor-detail-flow">
          {selectedVendor.detailFailureMessage ? (
            <div className="vendor-detail-warning" data-ui-kind="callout" data-status="warning" role="status" aria-label="商人详情状态">
              <strong>{getVendorDisplayStatusLabel(selectedVendor)}</strong>
              <span>{selectedVendor.detailFailureMessage}。当前仍显示基础销售数据，属性与插槽可能不完整。</span>
            </div>
          ) : null}
          <VendorContentSections sections={contentSections} vendor={selectedVendor} actions={props.actions} locale={locale} hasActiveFilters={hasContentFilter} hasSearchQuery={Boolean(normalizedContentSearchQuery)} onClearFilters={() => { setVendorFilters({ affordableOnly: false, unownedOnly: false }); setVendorSearchQuery(""); }} />
        </div>
      </section>

    </ProductWorkspaceSplit>
  );
}

function VendorResourceStatus(props: { status: NonNullable<VendorsPageModelView["resourceStatus"]>; source: NonNullable<VendorsPageModelView["resourceSource"]> }) {
  const labels: Record<typeof props.status, string> = { unavailable: "暂无库存", loading: "首次读取", refreshing: "后台同步中", ready: "已同步", stale: "缓存已过期", error: "读取失败" };
  const sourceLabels: Record<typeof props.source, string> = { local: "本地", remote: "远端", merged: "本地优先" };
  return <span className="app-chip vendor-resource-status" data-ui-kind="status-chip" data-status={props.status} title={`来源：${sourceLabels[props.source]}`}>{labels[props.status]}</span>;
}

function VendorContentSections(props: {
  sections: VendorContentSectionView[];
  vendor: VendorInventoryGroupView;
  actions: VendorsPageActions;
  locale: InterfaceLocale;
  hasActiveFilters?: boolean;
  hasSearchQuery?: boolean;
  onClearFilters?: () => void;
}) {
  if (!props.sections.length) {
    return (
      <ProductWorkspaceEmptyState className="vendor-empty-section">
        <strong>{props.hasActiveFilters ? "没有符合筛选条件的库存" : "当前没有可显示的库存"}</strong>
        <span>{props.hasActiveFilters
          ? props.hasSearchQuery
            ? "尝试修改搜索词，或关闭“只看可负担 / 账号无同身份实例”。"
            : "尝试关闭“只看可负担”或“账号无同身份实例”。"
          : getVendorDisplayStatusLabel(props.vendor)}</span>
        {props.hasActiveFilters && props.onClearFilters ? <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={props.onClearFilters}>清除筛选</button> : null}
      </ProductWorkspaceEmptyState>
    );
  }

  let subinventoryIndex = 0;
  return (
    <div className="vendor-content-sections">
      {props.sections.map((section) => {
        const isSubinventory = section.kind === "subinventory";
        const currentSubinventoryIndex = isSubinventory ? ++subinventoryIndex : 0;
        const itemCount = countSectionItems(section);
        const sectionAnchorId = getVendorSectionAnchorId(section);
        const headingId = `${sectionAnchorId}-heading`;
        const sectionTitle = getVendorSectionTitle(section);
        return (
          <section
            className="vendor-content-section"
            id={sectionAnchorId}
            key={section.id}
            aria-labelledby={headingId}
            data-vendor-section-id={section.id}
            data-section-kind={section.kind}
          >
            <header className="vendor-section-heading">
              <div>
                {isSubinventory ? <small>{props.vendor.name} · 子库存 {String(currentSubinventoryIndex).padStart(2, "0")}</small> : null}
                <h3 id={headingId}>{sectionTitle}{getVendorSectionContextLabel(section) ? <small className="vendor-section-context">{getVendorSectionContextLabel(section)}</small> : null}</h3>
              </div>
              <span>{getVendorSectionMeta(section, itemCount)}</span>
            </header>
            {isSubinventory && section.description ? <p className="vendor-section-description">{section.description}</p> : null}
            {section.kind === "reputation" ? (
              <VendorRankSummary section={section} vendor={props.vendor} />
            ) : null}
            {section.groups.map((group) => {
              const compact = shouldUseCompactVendorRows(section, group);
              return (
                <section className="vendor-offer-group" key={group.id} aria-label={group.name || sectionTitle}>
                  {section.groups.length > 1 ? <div className="vendor-offer-group-head"><strong>{group.name || sectionTitle}</strong><span>{group.items.length} 件</span></div> : null}
                  <div className={compact ? "vendor-service-list" : "vendor-offer-grid"} onKeyDown={compact ? undefined : handleOfferGridKeyDown}>
                    {group.items.map((item) => compact
                      ? <VendorServiceRow key={item.id} item={item} section={section} />
                      : <VendorOfferButton key={item.id} item={item} vendor={props.vendor} actions={props.actions} locale={props.locale} />)}
                  </div>
                </section>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

function handleOfferGridKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement) || !target.classList.contains("vendor-offer-card")) return;
  const grid = event.currentTarget;
  const buttons = [...grid.querySelectorAll<HTMLButtonElement>("button.vendor-offer-card")];
  const currentIndex = buttons.indexOf(target);
  if (currentIndex < 0) return;
  if (event.key === "ArrowLeft" && currentIndex === 0) {
    const sectionTarget = grid.closest<HTMLElement>(".vendor-content-section")
      ?.closest<HTMLElement>(".vendor-workbench")
      ?.querySelector<HTMLButtonElement>(".vendor-section-nav button[aria-current='location']");
    if (sectionTarget) {
      event.preventDefault();
      sectionTarget.focus();
      sectionTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
      return;
    }
  }
  const columnCount = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length);
  let nextIndex: number | null = null;
  if (event.key === "Home") nextIndex = 0;
  if (event.key === "End") nextIndex = buttons.length - 1;
  if (event.key === "ArrowLeft") nextIndex = Math.max(0, currentIndex - 1);
  if (event.key === "ArrowRight") nextIndex = Math.min(buttons.length - 1, currentIndex + 1);
  if (event.key === "ArrowUp") nextIndex = Math.max(0, currentIndex - columnCount);
  if (event.key === "ArrowDown") nextIndex = Math.min(buttons.length - 1, currentIndex + columnCount);
  if (nextIndex === null || nextIndex === currentIndex) return;
  event.preventDefault();
  const nextButton = buttons[nextIndex];
  nextButton?.focus();
  nextButton?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function VendorSectionNavigation(props: {
  sections: VendorContentSectionView[];
  vendor: VendorInventoryGroupView;
}) {
  const navRef = useRef<HTMLElement>(null);
  const sectionKey = props.sections.map((section) => section.id).join("|");
  const firstSectionId = props.sections[0]?.id ?? "";
  const [activeSectionId, setActiveSectionId] = useState(firstSectionId);

  useLayoutEffect(() => {
    const workbench = navRef.current?.closest<HTMLElement>(".vendor-workbench");
    const page = navRef.current?.closest<HTMLElement>(".product-workspace-page");
    const pageHeader = page?.querySelector<HTMLElement>(":scope > [data-shell-role='page-header']");
    if (!workbench || !pageHeader) return undefined;

    const updateStickyOffset = () => {
      workbench.style.setProperty("--vendor-sticky-offset", `${Math.ceil(pageHeader.getBoundingClientRect().height)}px`);
    };
    updateStickyOffset();

    if (typeof ResizeObserver === "undefined") {
      return () => workbench.style.removeProperty("--vendor-sticky-offset");
    }
    const observer = new ResizeObserver(updateStickyOffset);
    observer.observe(pageHeader);
    return () => {
      observer.disconnect();
      workbench.style.removeProperty("--vendor-sticky-offset");
    };
  }, [props.vendor.id, sectionKey]);

  useEffect(() => {
    setActiveSectionId(firstSectionId);
    const elements = props.sections
      .map((section) => document.getElementById(getVendorSectionAnchorId(section)))
      .filter((element): element is HTMLElement => Boolean(element));
    if (!elements.length || typeof IntersectionObserver === "undefined") return undefined;

    const observer = new IntersectionObserver((entries) => {
      const visibleEntry = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
      const sectionId = visibleEntry?.target.getAttribute("data-vendor-section-id");
      if (sectionId) setActiveSectionId(sectionId);
    }, { rootMargin: "-104px 0px -62% 0px", threshold: [0, 0.1] });

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [firstSectionId, props.vendor.id, sectionKey]);

  function activateSection(section: VendorContentSectionView) {
    setActiveSectionId(section.id);
    document.getElementById(getVendorSectionAnchorId(section))?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start"
    });
  }

  function handleSectionKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    if (event.key === "ArrowLeft" && currentIndex === 0) {
      const vendorTarget = event.currentTarget.closest<HTMLElement>(".vendor-workbench")
        ?.querySelector<HTMLButtonElement>("button[data-vendor-id][aria-current='page']");
      if (vendorTarget) {
        event.preventDefault();
        vendorTarget.focus();
        vendorTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
        return;
      }
    }
    const nextIndex = getRovingFocusIndex({
      key: event.key,
      currentIndex,
      itemCount: props.sections.length,
      orientation: "horizontal"
    });
    if (nextIndex === null) return;
    event.preventDefault();
    const nextSection = props.sections[nextIndex];
    if (!nextSection) return;
    activateSection(nextSection);
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>("button")[nextIndex]
      ?.focus();
  }

  if (!props.sections.length) return null;

  return (
    <nav ref={navRef} className="vendor-section-nav" aria-label={`${props.vendor.name}内容导航`}>
      {props.sections.map((section, index) => {
        const itemCount = countSectionItems(section);
        const active = activeSectionId === section.id;
        return (
          <button
            type="button"
            key={section.id}
            aria-current={active ? "location" : undefined}
            tabIndex={active ? 0 : -1}
            onClick={() => activateSection(section)}
            onKeyDown={(event) => handleSectionKeyDown(event, index)}
          >
            <span>{getVendorSectionTitle(section)}</span>
            <small>{section.kind === "reputation" && section.progression ? `等级 ${section.progression.level}` : itemCount}</small>
          </button>
        );
      })}
    </nav>
  );
}

function VendorRankSummary(props: { section: VendorContentSectionView; vendor: VendorInventoryGroupView }) {
  const progression = props.section.progression;
  if (!progression) return null;
  const rewards = props.section.groups.flatMap((group) => group.items);
  const currentStepProgress = Math.max(0, progression.nextLevelAt - progression.progressToNextLevel);
  const progressPercent = progression.nextLevelAt
    ? Math.min(100, Math.max(0, currentStepProgress / progression.nextLevelAt * 100))
    : 0;
  const atLevelCap = progression.levelCap > 0 && progression.level >= progression.levelCap;
  const claimReady = !atLevelCap && progression.progressToNextLevel <= 0;
  const rankState = atLevelCap
    ? { label: "已达等级上限", status: "neutral" }
    : claimReady
      ? { label: "可领取下一等级奖励", status: "success" }
      : { label: `还需 ${progression.progressToNextLevel} 点声望`, status: "pending" };

  return (
    <div className="vendor-rank-panel" data-rank-state={rankState.status}>
      <div className="vendor-rank-number"><span>当前等级</span><strong>{progression.level}</strong><small>{props.vendor.name}声望</small></div>
      <dl className="vendor-rank-ledger">
        <div><dt>本级进度</dt><dd><strong>{currentStepProgress} / {progression.nextLevelAt}</strong><span className="vendor-rank-progress" role="progressbar" aria-label={`${props.vendor.name}本级声望进度`} aria-valuemin={0} aria-valuemax={progression.nextLevelAt} aria-valuenow={currentStepProgress}><span style={{ width: `${progressPercent}%` }} /></span><small>累计进度 {progression.currentProgress}</small></dd><span>{Math.round(progressPercent)}%</span></div>
        <div><dt>下一等级奖励</dt><dd><strong data-status={rankState.status}>{rankState.label}</strong><small>{atLevelCap ? "当前声望已完成" : `达到等级 ${progression.level + 1} 后可领取`}</small></dd><span>{rewards.length} 个奖励节点</span></div>
      </dl>
    </div>
  );
}

function VendorServiceRow(props: {
  item: VendorInventoryItemView;
  section: VendorContentSectionView;
}) {
  const status = getVendorServiceStatus(props.item, props.section);
  const hasCost = Boolean(props.item.costs?.length || props.item.cost);
  return (
    <article className="vendor-service-row" data-status={status.status}>
      <VendorItemArt item={props.item} />
      <span className="vendor-service-copy">
        <strong>{props.item.name}</strong>
        <span>{props.item.itemType || (props.section.kind === "tasks" ? "任务" : "商人服务")}</span>
        {props.item.summary ? <small>{props.item.summary}</small> : null}
      </span>
      <span className="vendor-service-facts">
        {hasCost ? <VendorCosts item={props.item} fallback={getVendorCostLabel(props.item)} /> : <small>{props.section.kind === "tasks" ? "任务条目" : "服务入口"}</small>}
        {props.item.ownership ? (
          <span className="vendor-offer-account" data-status={props.item.ownership.state}>
            {props.item.ownership.label}
          </span>
        ) : null}
        <strong data-status={status.status}>{status.label}</strong>
      </span>
    </article>
  );
}

function VendorOfferButton(props: {
  item: VendorInventoryItemView;
  vendor: VendorInventoryGroupView;
  actions: VendorsPageActions;
  locale: InterfaceLocale;
}) {
  const availability = getVendorOfferAvailability(props.item);
  const costLabel = getVendorCostLabel(props.item);
  const equipmentKind = getVendorEquipmentKind(props.item);
  const isInteractive = Boolean(equipmentKind && props.actions.onOpenItem && props.item.itemHash !== undefined);
  const rollLabel = props.item.socketPlugs?.map((plug) => plug.name).filter(Boolean).slice(0, 2).join(" · ");
  const content = <>
    <span className="vendor-offer-header">
      <VendorItemArt item={props.item} />
        <span className="vendor-offer-copy">
          <span className="vendor-offer-title"><strong>{props.item.name}</strong>{props.item.quantity && props.item.quantity > 1 ? <em>× {props.item.quantity.toLocaleString("zh-CN")}</em> : null}</span>
          <span className="vendor-offer-summary">{props.item.itemType || "类型待确认"}{props.item.summary ? ` · ${props.item.summary}` : ""}</span>
          {props.item.ownership ? (
            <span className="vendor-offer-account" data-status={props.item.ownership.state}>
              {props.item.ownership.label}
            </span>
          ) : null}
          {rollLabel ? <span className="vendor-offer-roll">{rollLabel}</span> : null}
        </span>
    </span>
    <span className="vendor-offer-footer">
      <VendorCosts item={props.item} fallback={costLabel} />
      <span className="vendor-offer-state">
        <span className="vendor-offer-status" data-status={availability.status}>{availability.label}</span>
        {isInteractive ? <small>查看详情</small> : null}
      </span>
    </span>
  </>;

  if (!isInteractive) {
    return <article className="vendor-offer-card is-readonly" data-tone={props.item.tone} data-status={availability.status}>{content}</article>;
  }

  return (
    <button
      type="button"
      className="vendor-offer-card"
      data-tone={props.item.tone}
      data-status={availability.status}
      aria-label={`打开装备详情：${props.item.name}`}
      onClick={() => props.actions.onOpenItem?.(props.item, {
        vendorName: props.vendor.name,
        inventoryPath: props.item.sourcePath ?? [props.vendor.name, props.item.categoryName].filter(Boolean).join(" / "),
        costLabel,
        affordabilityLabel: availability.label,
        characterLabel: formatVendorCharacterScope(props.item.characterIds),
        refreshLabel: formatVendorReset(props.vendor, props.locale),
        purchaseRequirements: props.item.failureMessages ?? [],
        rollLabels: props.item.socketPlugs?.map((plug) => plug.name).filter(Boolean),
        stats: props.item.stats,
        ownershipLabel: props.item.ownership?.label,
        ownershipLocationLabel: props.item.ownership?.locationLabels.join(" · ") || undefined,
        ownershipAsOfLabel: props.item.ownership?.asOf
          ? formatFullDateTime(props.item.ownership.asOf, "账号数据时间未读取")
          : undefined
      })}
    >
      {content}
    </button>
  );
}

function VendorCosts(props: { item: VendorInventoryItemView; fallback: string }) {
  if (!props.item.costs?.length) return <span className="vendor-offer-cost">{props.fallback}</span>;
  return (
    <span className="vendor-offer-costs">
      {props.item.costs.map((cost, index) => (
        <span key={`${cost.label}-${index}`} data-status={cost.affordable === false ? "warning" : "neutral"}>
          <GameAssetImage src={cost.iconUrl} alt="" />
          <span>{cost.label}</span>
          <small>{cost.owned === null
            ? `需要 ${cost.required.toLocaleString("zh-CN")}`
            : `持有 ${cost.owned.toLocaleString("zh-CN")} · 需要 ${cost.required.toLocaleString("zh-CN")}`}</small>
        </span>
      ))}
    </span>
  );
}

function VendorItemArt(props: { item: VendorInventoryItemView }) {
  return (
    <span className={props.item.iconUrl ? "vendor-item-art" : "vendor-item-art vendor-item-art-missing"} role={props.item.iconUrl ? undefined : "img"} aria-label={props.item.iconUrl ? undefined : `${props.item.name}图标未读取`}>
      <span className="vendor-item-art-fallback" aria-hidden="true">{props.item.iconLabel.slice(0, 1)}</span>
      <GameAssetImage src={props.item.iconUrl} alt="" />
    </span>
  );
}

function getVendorContentSections(vendor: VendorInventoryGroupView): VendorContentSectionView[] {
  if (vendor.contentSections?.length) return vendor.contentSections;
  const sections: VendorContentSectionView[] = [];
  if (vendor.rankRewards?.length || vendor.progression) sections.push({ id: `${vendor.id}-rank`, kind: "reputation", name: "声望与等级", layout: "rank", progression: vendor.progression, groups: [{ id: `${vendor.id}-rank-items`, name: "等级奖励", items: vendor.rankRewards ?? [] }] });
  if (vendor.items.length) sections.push({ id: `${vendor.id}-inventory`, kind: "inventory", name: "库存", layout: "featured", groups: [{ id: `${vendor.id}-inventory-items`, name: "", items: vendor.items }] });
  for (const service of vendor.services ?? []) {
    if (!service.items.length) continue;
    sections.push({ id: service.id, kind: "subinventory", name: service.name, description: service.description || `${service.items.length} 件`, layout: (service.sections?.length ?? 0) > 1 ? "columns" : "list", groups: service.sections?.length ? service.sections : [{ id: `${service.id}-items`, name: "", items: service.items }] });
  }
  if (vendor.taskItems?.length) sections.push({ id: `${vendor.id}-tasks`, kind: "tasks", name: "任务", layout: "featured", groups: [{ id: `${vendor.id}-task-items`, name: "", items: vendor.taskItems }] });
  return sections;
}

function prioritizeVendorSections(sections: VendorContentSectionView[]): VendorContentSectionView[] {
  return [
    ...sections.filter((section) => section.kind === "reputation"),
    ...sections.filter((section) => section.kind !== "reputation")
  ];
}

function getVendorSectionAnchorId(section: VendorContentSectionView): string {
  return `vendor-section-${section.id.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}

function getVendorSectionTitle(section: VendorContentSectionView): string {
  if (section.name.trim() === "库存" && isVendorAuxiliaryInventory(section)) return "基础服务";
  if (section.kind === "tasks" && section.name.trim() === "任务") return "任务与悬赏";
  return section.name;
}

function getVendorSectionMeta(section: VendorContentSectionView, itemCount: number): string {
  if (section.kind === "reputation") return section.description ?? `${itemCount} 个等级奖励`;
  if (section.kind === "subinventory") return `${itemCount} 件 · ${section.groups.length} 个分类`;
  if (section.kind === "tasks") return `${itemCount} 项 · 游戏内领取`;
  if (isVendorAuxiliaryInventory(section)) return `${itemCount} 项 · 游戏内操作`;
  return section.description ?? `${itemCount} 件`;
}

function getVendorSectionContextLabel(section: VendorContentSectionView): string {
  const scopeLabel = section.scope === "account" ? "账号" : section.scope === "clan" ? "公会" : section.scope === "character" ? "当前角色" : "";
  const actionLabel = section.action === "purchase" ? "游戏内购买" : section.action === "focus" ? "聚焦" : section.action === "decode" ? "解码" : section.action === "claim" ? "领取" : section.action === "acquire" ? "获取" : section.action === "exchange" ? "兑换" : section.action === "inspect" ? "查看" : "";
  return [scopeLabel, actionLabel].filter(Boolean).join(" · ");
}

function shouldUseCompactVendorRows(section: VendorContentSectionView, group: VendorInventorySectionView): boolean {
  return section.kind === "tasks"
    || (section.kind === "inventory" && group.items.every((item) => !getVendorEquipmentKind(item)));
}

function isVendorAuxiliaryInventory(section: VendorContentSectionView): boolean {
  return section.kind === "inventory"
    && section.groups.every((group) => group.items.every((item) => !getVendorEquipmentKind(item)));
}

function countSectionItems(section: VendorContentSectionView): number {
  return section.groups.reduce((count, group) => count + group.items.length, 0);
}

function countVendorItems(vendor: VendorInventoryGroupView): number {
  return getVendorContentSections(vendor).reduce((count, section) => count + countSectionItems(section), 0);
}

function countSectionItemsFromSections(sections: VendorContentSectionView[]): number {
  return sections.reduce((count, section) => count + countSectionItems(section), 0);
}

function filterVendorSections(
  sections: VendorContentSectionView[],
  filters: { affordableOnly: boolean; unownedOnly: boolean },
  query = ""
): VendorContentSectionView[] {
  if (!filters.affordableOnly && !filters.unownedOnly && !query) return sections;
  return sections.flatMap((section) => {
    const groups = section.groups.flatMap((group) => {
      const items = group.items.filter((item) => {
        if (query && !vendorItemMatchesQuery(item, query)) return false;
        if (filters.unownedOnly && (!getVendorEquipmentKind(item) || item.ownership?.state !== "not_owned")) return false;
        if (filters.affordableOnly && !isVendorItemAffordable(item)) return false;
        return true;
      });
      return items.length ? [{ ...group, items }] : [];
    });
    if (!groups.length && section.kind !== "reputation") return [];
    return [{ ...section, groups }];
  });
}

function isVendorItemAffordable(item: VendorInventoryItemView): boolean {
  if (item.canPurchase === true) return true;
  if (item.canPurchase === false) return false;
  const costs = item.costs ?? [];
  return costs.length > 0 && costs.every((cost) => cost.affordable === true);
}

function vendorHasItemMatch(vendor: VendorInventoryGroupView, query: string): boolean {
  if (!query) return false;
  return getVendorContentSections(vendor).some((section) => section.groups.some((group) => group.items.some((item) => vendorItemMatchesQuery(item, query))));
}

function vendorItemMatchesQuery(item: VendorInventoryItemView, query: string): boolean {
  return [item.name, item.itemType, item.categoryName, item.summary, item.ownership?.label]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLocaleLowerCase()
    .includes(query);
}

function getVendorDisplayStatusLabel(vendor: VendorInventoryGroupView): string {
  return vendor.displayStatusLabel ?? vendor.statusLabel ?? vendor.badge;
}

function getVendorRailSummary(vendor: VendorInventoryGroupView): string {
  if (vendor.railStatusLabel) return vendor.railStatusLabel;
  const itemCount = countVendorItems(vendor);
  if (vendor.detailState === "failed" || vendor.inventoryState === "unavailable") return `${itemCount} 件 · 读取失败`;
  if (vendor.detailState === "partial") return `${itemCount} 件 · 部分可用`;
  if (vendor.featured) return `${itemCount} 件 · 限时`;
  return `${itemCount} 件`;
}

function vendorMatchesSearch(vendor: VendorInventoryGroupView, query: string): boolean {
  if (!query) return true;
  const searchableText = [
    vendor.name,
    vendor.location,
    vendor.description,
    ...getVendorContentSections(vendor).flatMap((section) => [
      section.name,
      section.description,
      ...section.groups.flatMap((group) => [
        group.name,
        group.description,
        ...group.items.flatMap((item) => [
          item.name,
          item.itemType,
          item.categoryName,
          item.summary,
          item.ownership?.label
        ])
      ])
    ])
  ].filter((value): value is string => Boolean(value)).join(" ").toLocaleLowerCase();
  return searchableText.includes(query);
}

function getVendorStatus(vendor: VendorInventoryGroupView): "neutral" | "pending" | "success" | "warning" | "error" {
  if (vendor.detailState === "ready" || vendor.inventoryState === "loaded") return "success";
  if (vendor.detailState === "pending") return "pending";
  if (vendor.detailState === "partial") return "warning";
  if (vendor.detailState === "failed" || vendor.inventoryState === "unavailable") return "error";
  return "neutral";
}

function getVendorOfferAvailability(item: VendorInventoryItemView): { label: string; status: "success" | "warning" | "neutral" } {
  if (item.canPurchase === true) return { label: "游戏内可购买", status: "success" };
  if (item.canPurchase === false) return { label: item.failureMessages?.[0] || "当前不可购买", status: "warning" };
  return { label: item.failureMessages?.[0] || "游戏内条件待确认", status: "neutral" };
}

function getVendorServiceStatus(
  item: VendorInventoryItemView,
  section: VendorContentSectionView
): { label: string; status: "success" | "warning" | "neutral" } {
  if (item.canPurchase === false) return { label: item.failureMessages?.[0] || "条件未满足", status: "warning" };
  if (item.canPurchase === true) {
    return { label: section.kind === "tasks" ? "可在游戏内领取" : "可在游戏内使用", status: "success" };
  }
  return { label: item.failureMessages?.[0] || "游戏内状态待确认", status: "neutral" };
}

function getVendorCostLabel(item: VendorInventoryItemView): string {
  return item.costs?.map((cost) => `${cost.required} ${cost.label}`).join(" · ") ?? item.cost ?? "无费用信息";
}

function formatVendorCharacterScope(characterIds: string[] | undefined): string {
  const characterCount = new Set(characterIds ?? []).size;
  if (characterCount > 1) return `${characterCount} 个角色库存`;
  return characterCount === 1 ? "当前角色库存" : "角色范围待确认";
}

function formatVendorReset(vendor: VendorInventoryGroupView, locale: InterfaceLocale): string {
  return formatScheduleDateTime(vendor.resetAt, locale, vendor.resetLabel);
}
