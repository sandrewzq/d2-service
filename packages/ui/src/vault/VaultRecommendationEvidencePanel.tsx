import type { AccountItemSummary } from "@d2-tools/core/account/summary";
import type { DimWishlist } from "@d2-tools/core/analysis/wishlistImport";
import type { VaultRecommendationScanState } from "@d2-tools/app/account";
import type {
  LocalCommunityRecommendationTable,
  RecommendationCardSummary
} from "@d2-tools/core/community-perks";
import type { VaultTags } from "@d2-tools/core/vault/tags";
import type { LoadoutTemplateLookup } from "@d2-tools/app/loadouts";
import { getAccountItemSlotLabel, getVaultItemLocationLabel, getVaultSelectionItemKey } from "@d2-tools/app/vault";
import { useEffect, useMemo, useState } from "react";
import { ControlButton } from "../control/ControlButton.js";
import {
  VaultWishlistManager,
  type VaultRecommendationManagedSource,
  type VaultWishlistActions
} from "./VaultWishlistManager.js";
import {
  canonicalVaultRecommendationSourceId,
  compareVaultRecommendationMetricKeys,
  getVaultRecommendationFilterFact,
  getVaultCommunityInstanceKey,
  inferVaultRecommendationResult,
  inferVaultRecommendationResultForSource,
  selectVaultRecommendationSourceSummaries,
  vaultRecommendationPrimaryFilterLabel,
  type VaultRecommendationCompleteFilter,
  type VaultRecommendationFilterFactIndex,
  type VaultRecommendationMetricKey,
  type VaultRecommendationPrimaryFilter,
  type VaultRecommendationSourceOption,
  type VaultRecommendationSourceSummary,
  type VaultRecommendationSummaryIndex,
  type VaultRecommendationResult
} from "./vaultRecommendationMatch.js";

export type VaultRecommendationSourceState = {
  recommendationScan: VaultRecommendationScanState;
  customRules: LocalCommunityRecommendationTable | null;
  customRulesLoadState: "loading" | "ready" | "error";
  customRulesLoadError?: string;
};

export function VaultRecommendationEvidencePanel(props: {
  items: AccountItemSummary[];
  tags: VaultTags;
  wishlist?: DimWishlist | null;
  recommendationCardSummary?: ReadonlyMap<string, RecommendationCardSummary>;
  recommendationSummaryByInstance?: VaultRecommendationSummaryIndex;
  highlightedItemKeys?: LoadoutTemplateLookup | null;
  sourceState?: VaultRecommendationSourceState;
  managedSources?: readonly VaultRecommendationManagedSource[];
  sourceOptions: readonly VaultRecommendationSourceOption[];
  filterFactByInstance: VaultRecommendationFilterFactIndex;
  activeSourceId: string;
  activePrimaryFilter: VaultRecommendationPrimaryFilter;
  activeCompleteFilter: VaultRecommendationCompleteFilter;
  wishlistActions?: VaultWishlistActions;
  managementLocked?: boolean;
  canOrganizeItem?: (item: AccountItemSummary) => boolean;
  onCopyAuditReport?: () => void | Promise<void>;
  onActiveSourceChange: (sourceId: string) => void;
  onActivePrimaryFilterChange: (filter: VaultRecommendationPrimaryFilter) => void;
  onActiveCompleteFilterChange: (filter: VaultRecommendationCompleteFilter) => void;
  onOpenItem: (item: AccountItemSummary) => void;
  onOrganizeItem?: (item: AccountItemSummary) => void;
}) {
  const [isWishlistManagerOpen, setIsWishlistManagerOpen] = useState(false);
  const [isCopyingAuditReport, setIsCopyingAuditReport] = useState(false);
  const [panelFeedback, setPanelFeedback] = useState<{ tone: "ready" | "error"; message: string } | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(200);
  const recommendationScan = props.sourceState?.recommendationScan;
  const rows = useMemo(() => buildInstanceWeaponRows(
    props.items,
    props.recommendationSummaryByInstance,
    props.recommendationCardSummary,
    recommendationScan?.phase === "complete",
    props.tags
  ), [props.items, props.recommendationCardSummary, props.recommendationSummaryByInstance, props.tags, recommendationScan?.phase]);
  const coveredRows = useMemo(() => rows.filter((row) => row.summaries.length > 0), [rows]);
  const sourceState = props.sourceState;
  const hasManagedSource = props.managedSources?.some((source) => source.configured && source.state === "active") ?? false;
  const hasInstanceScan = Boolean(props.recommendationCardSummary?.size) || recommendationScan?.phase === "complete";
  const hasConfiguredSource = Boolean(
    (recommendationScan && recommendationScan.phase !== "idle")
    || hasInstanceScan
    || hasManagedSource
    || props.wishlist
    || sourceState?.customRules
  );
  const emptyState = recommendationEvidenceEmptyState(recommendationScan, hasConfiguredSource);
  const recommendationUnavailable = recommendationScan?.blocking_reason === "recommendation_unavailable"
    || recommendationScan?.issues?.some((issue) => issue.code === "recommendation_unavailable");
  const sourceMissing = !coveredRows.length
    && !props.wishlist
    && !sourceState?.customRules
    && !hasManagedSource
    && (!hasConfiguredSource || recommendationUnavailable);
  const selectedSource = props.sourceOptions.find((option) => option.sourceId === props.activeSourceId);
  const sourceIsDim = canonicalVaultRecommendationSourceId(props.activeSourceId) === "dim_wishlist";
  const filterState = useMemo(() => buildRecommendationEvidenceFilterState({
    rows,
    factIndex: props.filterFactByInstance,
    sourceId: props.activeSourceId,
    primaryFilter: props.activePrimaryFilter,
    completeFilter: props.activeCompleteFilter,
    recommendationCardSummary: props.recommendationCardSummary,
    recommendationScanComplete: recommendationScan?.phase === "complete"
  }), [props.activeCompleteFilter, props.activePrimaryFilter, props.activeSourceId, props.filterFactByInstance, props.recommendationCardSummary, recommendationScan?.phase, rows]);
  const filteredRows = filterState.rows;
  const visibleRows = filteredRows.slice(0, visibleLimit);

  useEffect(() => {
    setVisibleLimit(200);
  }, [props.activeCompleteFilter, props.activePrimaryFilter, props.activeSourceId]);

  return (
    <section className="vault-evidence-panel" data-surface="section" aria-label="推荐 Roll 匹配">
      <div className="vault-column-head">
        <div><h3>武器推荐</h3><span>按每一件实际武器核对来源要求，结果只提供证据，不替你决定分解</span></div>
        {props.wishlistActions ? <ControlButton size="compact" variant="secondary" disabled={props.managementLocked} title={props.managementLocked ? "先应用或撤销同名整理中的待应用状态" : undefined} onClick={() => setIsWishlistManagerOpen(true)}>管理推荐数据</ControlButton> : null}
      </div>

      {panelFeedback ? <p className={`status-message status-${panelFeedback.tone}`} role={panelFeedback.tone === "error" ? "alert" : "status"}>{panelFeedback.message}</p> : null}

      {isWishlistManagerOpen && props.wishlistActions ? (
        <VaultWishlistManager
          wishlist={props.wishlist}
          actions={props.wishlistActions}
          managementLocked={props.managementLocked}
          onApplied={(message) => setPanelFeedback({ tone: "ready", message })}
          onClose={() => setIsWishlistManagerOpen(false)}
        />
      ) : null}

      {sourceMissing ? (
        <div className="vault-recommendation-setup" data-ui-kind="state-frame" data-surface="frame">
          <div>
            <span className="ui-badge" data-ui-kind="status-chip" data-status="warning">尚未准备推荐数据</span>
            <h3>先导入武器推荐数据，再核对仓库</h3>
            <p>选择正式的“武器推荐.csv”后，应用会自动核对账号中的每一件武器；DIM 社区推荐可以作为可选补充。</p>
          </div>
          {props.wishlistActions ? <ControlButton variant="primary" disabled={props.managementLocked} title={props.managementLocked ? "先应用或撤销同名整理中的待应用状态" : undefined} onClick={() => setIsWishlistManagerOpen(true)}>导入武器推荐数据</ControlButton> : null}
          <small>导入只更新本机推荐资料，不会修改、转移、解锁或分解游戏装备。</small>
        </div>
      ) : null}

      <div className="vault-recommendation-workflow" data-ui-kind="callout" data-status="neutral">
        <span><strong>1 选择来源</strong><small>每次只按一个推荐来源筛选</small></span>
        <span><strong>2 看命中数量</strong><small>人工来源先看核心 Perk，DIM 看最佳组合</small></span>
        <span><strong>3 查看依据并整理</strong><small>人工来源还可继续筛完整命中</small></span>
      </div>

      <div className="vault-recommendation-summary" data-ui-kind="callout" data-status="neutral">
        <span>{formatRecommendationScanDetail(recommendationScan)} · 当前有来源记录 {coveredRows.length} 件。</span>
        {props.onCopyAuditReport ? <ControlButton size="compact" variant="quiet" disabled={isCopyingAuditReport} aria-busy={isCopyingAuditReport} onClick={() => {
          setPanelFeedback(null);
          setIsCopyingAuditReport(true);
          void Promise.resolve(props.onCopyAuditReport?.()).then(
            () => setPanelFeedback({ tone: "ready", message: "只读验收报告已复制。" }),
            () => setPanelFeedback({ tone: "error", message: "复制失败，请稍后重试。" })
          ).finally(() => setIsCopyingAuditReport(false));
        }}>{isCopyingAuditReport ? "正在生成报告" : "复制验收报告"}</ControlButton> : null}
      </div>

      {rows.length ? (
        <>
          <div className="vault-evidence-filter-bar">
            <label className="vault-evidence-source-filter">
              <span>1 推荐来源</span>
              <select value={props.activeSourceId} onChange={(event) => {
                props.onActiveSourceChange(event.target.value);
              }}>
                <option value="">选择来源</option>
                {props.sourceOptions.map((option) => (
                  <option key={option.sourceId} value={option.sourceId}>{option.sourceLabel} · 覆盖 {option.count}</option>
                ))}
              </select>
            </label>
            {props.activeSourceId ? (
              <div className="vault-evidence-filters" role="group" aria-label={`${selectedSource?.sourceLabel ?? "当前来源"}${sourceIsDim ? "最佳组合" : "核心 Perk"}筛选`}>
                <span>2 {sourceIsDim ? "最佳组合" : "核心 Perk"}</span>
                <div>
                  {filterState.primaryOptions.map((option) => (
                    <button type="button" key={option.key} disabled={option.count === 0} aria-pressed={props.activePrimaryFilter === option.key} onClick={() => props.onActivePrimaryFilterChange(option.key)}>{option.label} <strong>{option.count}</strong></button>
                  ))}
                </div>
              </div>
            ) : <small>先选择来源，再按实际命中数量筛选。</small>}
            {props.activeSourceId && !sourceIsDim && filterState.completeOptions.length > 1 ? (
              <label className="vault-evidence-complete-filter">
                <span>3 完整命中</span>
                <select value={props.activeCompleteFilter} onChange={(event) => props.onActiveCompleteFilterChange(event.target.value as VaultRecommendationCompleteFilter)}>
                  {filterState.completeOptions.map((option) => (
                    <option key={option.key} value={option.key} disabled={option.count === 0}>{option.label} · {option.count}</option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          {props.activeSourceId ? (
            <>
              <div className="vault-evidence-results" data-surface="list">
                {visibleRows.map((row) => {
                  const primarySummary = row.displaySummaries.find((summary) => (
                    canonicalVaultRecommendationSourceId(summary.sourceId) === canonicalVaultRecommendationSourceId(props.activeSourceId)
                  ));
                  const recommendationState = primarySummary
                    ? inferVaultRecommendationResultForSource([primarySummary], props.activeSourceId)
                    : "uncovered";
                  const additionalSourceCount = Math.max(0, row.displaySummaries.length - (primarySummary ? 1 : 0));
                  const protectionFacts = [
                    row.item.locked ? "已锁定" : "",
                    row.item.instance_id && props.highlightedItemKeys?.instanceIds.has(row.item.instance_id) ? "配装引用" : ""
                  ].filter(Boolean);
                  return (
                    <article data-surface="row" key={row.key} className="vault-evidence-result-row">
                      <button type="button" className="vault-evidence-result-identity" onClick={() => props.onOpenItem(row.item)}>
                        <strong>{row.item.name}</strong>
                        <small>{formatWeaponInstanceMeta(row.item, protectionFacts)}</small>
                        {row.dispositionLabel ? <small>人工标记：{row.dispositionLabel}</small> : null}
                      </button>
                      <span className="vault-evidence-result-state" data-status={recommendationState}>
                        <small>{sourceIsDim ? "最佳组合" : "Perk / 完整命中"}</small>
                        <strong>{primarySummary?.resultText ?? "未收录"}</strong>
                      </span>
                      <span className="vault-evidence-result-sources" aria-label={`${row.item.name}的主要推荐依据`}>
                        {primarySummary
                          ? <span className="vault-evidence-source-match" data-match-state={primarySummary.state} title={primarySummary.detail}>{primarySummary.text}</span>
                          : <span className="vault-evidence-source-match" data-match-state="not-covered">{selectedSource ? `${selectedSource.sourceLabel}未收录` : "当前来源未收录"}</span>}
                        {additionalSourceCount > 0 ? <small>另有 {additionalSourceCount} 个来源，进入详情查看</small> : null}
                      </span>
                      <span className="vault-evidence-result-actions">
                        <ControlButton size="compact" variant="quiet" onClick={() => props.onOpenItem(row.item)}>查看依据</ControlButton>
                        {props.onOrganizeItem && props.canOrganizeItem?.(row.item) ? <ControlButton size="compact" variant="secondary" onClick={() => props.onOrganizeItem?.(row.item)}>整理同名</ControlButton> : null}
                      </span>
                    </article>
                  );
                })}
              </div>
              {!filteredRows.length ? <div className="vault-evidence-empty" data-surface="empty"><strong>当前命中条件没有武器</strong><span>请选择其他命中数量，或放宽完整命中条件。</span></div> : null}
              {visibleRows.length < filteredRows.length ? <div className="vault-evidence-load-more"><span>已显示 {visibleRows.length}/{filteredRows.length} 件</span><ControlButton size="compact" variant="secondary" onClick={() => setVisibleLimit((current) => current + 200)}>加载更多</ControlButton></div> : null}
            </>
          ) : (
            <div className="vault-evidence-empty vault-evidence-source-empty" data-surface="empty">
              <strong>先选择推荐来源</strong>
              <span>人工来源按核心 Perk 与完整命中数筛选；DIM 按最佳组合命中数筛选。</span>
            </div>
          )}
        </>
      ) : (
        <div className="vault-evidence-empty" data-surface="empty">
          <strong>{emptyState.title}</strong>
          <span>{emptyState.detail}</span>
        </div>
      )}
    </section>
  );
}

type InstanceWeaponRow = {
  key: string;
  item: AccountItemSummary;
  summaries: VaultRecommendationSourceSummary[];
  displaySummaries: VaultRecommendationSourceSummary[];
  recommendationState: VaultRecommendationResult;
  disposition?: "keep" | "review" | "junk" | "farm" | "loadout";
  dispositionLabel?: string;
};

function formatRecommendationScanDetail(scan?: VaultRecommendationScanState): string {
  if (!scan) return "尚未开始账号武器推荐来源核对。";
  if (scan.message) return scan.message;
  if (scan.phase === "complete") {
    return `已核对 ${scan.scanned_weapon_count}/${scan.total_weapon_count} 件账号武器，${scan.covered_weapon_count} 件有推荐来源覆盖。`;
  }
  if (scan.phase === "scanning") return `正在核对 ${scan.total_weapon_count} 件账号武器。`;
  if (scan.phase === "partial") return `当前保留 ${scan.retained_result_count} 件上次核对结果。`;
  if (scan.phase === "error") return "账号武器推荐来源核对失败。";
  return "尚未开始账号武器推荐来源核对。";
}

function recommendationEvidenceEmptyState(
  scan: VaultRecommendationScanState | undefined,
  hasConfiguredSource: boolean
): { title: string; detail: string } {
  if (scan?.phase === "scanning") {
    return {
      title: "正在核对账号武器",
      detail: scan.retained_result_count
        ? "正在重新核对每件武器的推荐 Roll；完成前继续保留上次可用结果。"
        : "核对完成后会在这里按武器实例显示各来源结果。"
    };
  }
  if (scan?.phase === "partial") {
    return {
      title: "部分核对已经完成",
      detail: scan.message ?? "本次核对没有完整完成，未显示的武器不能据此判断为没有推荐。"
    };
  }
  if (scan?.phase === "error") {
    return {
      title: "推荐来源核对失败",
      detail: scan.message ?? "当前没有可用的实例核对结果；已有推荐数据不会因此被删除。"
    };
  }
  if (scan?.phase === "complete") {
    return {
      title: "当前账号武器没有推荐来源记录",
      detail: "账号武器已完成核对；当前推荐数据没有收录这些武器，或来源没有形成可显示的要求。"
    };
  }
  return {
    title: hasConfiguredSource ? "尚未核对账号武器" : "尚未读取推荐数据",
    detail: hasConfiguredSource
      ? "进入仓库后会按武器实例核对现有推荐数据。"
      : "可在这里导入武器推荐知识库，或启用 DIM 社区愿望单。"
  };
}

function buildInstanceWeaponRows(
  items: AccountItemSummary[],
  recommendationSummaryByInstance?: VaultRecommendationSummaryIndex,
  recommendationCardSummary?: ReadonlyMap<string, RecommendationCardSummary>,
  includeUncovered = false,
  tags?: VaultTags
): InstanceWeaponRow[] {
  return items
    .filter((item) => item.group_key === "weapons")
    .flatMap((item, index) => {
      const instanceKey = getVaultCommunityInstanceKey(item);
      const summaries = recommendationSummaryByInstance?.get(instanceKey) ?? [];
      if (!summaries.length && !includeUncovered) return [];
      const recommendationState = inferVaultRecommendationResult(
        summaries,
        recommendationCardSummary?.get(instanceKey)?.recommendation_state
      );
      const disposition = tags?.items[instanceKey]?.tag;
      return [{
        key: item.instance_id ? `instance:${item.instance_id}` : `${instanceKey}:${index}`,
        item,
        summaries,
        displaySummaries: selectVaultRecommendationSourceSummaries(summaries),
        recommendationState,
        ...(disposition ? { disposition, dispositionLabel: dispositionLabel(disposition) } : {})
      }];
    })
    .sort((left, right) => {
      const stateOrder = { matched: 0, partial: 1, not_matched: 2, uncheckable: 3, uncovered: 4 } as const;
      return stateOrder[left.recommendationState] - stateOrder[right.recommendationState]
        || left.item.name.localeCompare(right.item.name, "zh-Hans-CN")
        || left.key.localeCompare(right.key);
    });
}

type RecommendationEvidenceFilterOption<T extends string> = {
  key: T;
  label: string;
  count: number;
};

function buildRecommendationEvidenceFilterState(input: {
  rows: InstanceWeaponRow[];
  factIndex: VaultRecommendationFilterFactIndex;
  sourceId: string;
  primaryFilter: VaultRecommendationPrimaryFilter;
  completeFilter: VaultRecommendationCompleteFilter;
  recommendationCardSummary?: ReadonlyMap<string, RecommendationCardSummary>;
  recommendationScanComplete: boolean;
}): {
  rows: InstanceWeaponRow[];
  primaryOptions: Array<RecommendationEvidenceFilterOption<VaultRecommendationPrimaryFilter>>;
  completeOptions: Array<RecommendationEvidenceFilterOption<VaultRecommendationCompleteFilter>>;
} {
  if (!input.sourceId) return { rows: [], primaryOptions: [], completeOptions: [] };
  const isDim = canonicalVaultRecommendationSourceId(input.sourceId) === "dim_wishlist";
  const availablePrimaryMetrics = new Set<VaultRecommendationMetricKey>();
  const availableCompleteMetrics = new Set<VaultRecommendationMetricKey>();
  const primaryCounts = new Map<Exclude<VaultRecommendationPrimaryFilter, "all">, number>();
  const completeCounts = new Map<VaultRecommendationMetricKey, number>();
  const rows: InstanceWeaponRow[] = [];
  let completeAllCount = 0;

  for (const row of input.rows) {
    const instanceKey = getVaultCommunityInstanceKey(row.item);
    const fact = getVaultRecommendationFilterFact(input.factIndex, instanceKey, input.sourceId);
    const primaryKey = fact?.primaryKey ?? (input.recommendationScanComplete || input.recommendationCardSummary?.has(instanceKey)
      ? "uncovered"
      : undefined);
    if (primaryKey) {
      primaryCounts.set(primaryKey, (primaryCounts.get(primaryKey) ?? 0) + 1);
      if (isEvidenceMetricKey(primaryKey)) availablePrimaryMetrics.add(primaryKey);
    }
    const primaryMatches = input.primaryFilter === "all" || primaryKey === input.primaryFilter;
    if (primaryMatches) {
      completeAllCount += 1;
      if (!isDim && fact?.completeKey) {
        availableCompleteMetrics.add(fact.completeKey);
        completeCounts.set(fact.completeKey, (completeCounts.get(fact.completeKey) ?? 0) + 1);
      }
    }
    if (primaryMatches && (input.completeFilter === "all" || fact?.completeKey === input.completeFilter)) {
      rows.push(row);
    }
  }

  const specialKeys: Array<Exclude<VaultRecommendationPrimaryFilter, "all" | VaultRecommendationMetricKey>> = [
    "unrequired",
    "uncheckable",
    "uncovered"
  ];
  return {
    rows,
    primaryOptions: [
      { key: "all", label: "全部", count: input.rows.length },
      ...[...availablePrimaryMetrics]
        .sort(compareVaultRecommendationMetricKeys)
        .map((key) => ({ key, label: key, count: primaryCounts.get(key) ?? 0 })),
      ...specialKeys.map((key) => ({
        key,
        label: vaultRecommendationPrimaryFilterLabel(key, isDim),
        count: primaryCounts.get(key) ?? 0
      }))
    ],
    completeOptions: [
      { key: "all", label: "不限", count: completeAllCount },
      ...[...availableCompleteMetrics]
        .sort(compareVaultRecommendationMetricKeys)
        .map((key) => ({ key, label: key, count: completeCounts.get(key) ?? 0 }))
    ]
  };
}

function isEvidenceMetricKey(
  value: Exclude<VaultRecommendationPrimaryFilter, "all">
): value is VaultRecommendationMetricKey {
  return value.includes("/");
}

function dispositionLabel(value: NonNullable<InstanceWeaponRow["disposition"]>): string {
  if (value === "keep") return "保留";
  if (value === "review") return "待定";
  if (value === "junk") return "清理";
  if (value === "farm") return "待刷";
  return "配装用";
}

function formatWeaponInstanceMeta(item: AccountItemSummary, protectionFacts: string[]): string {
  return [
    item.item_type || "武器",
    getAccountItemSlotLabel(item),
    getVaultItemLocationLabel(item),
    item.power !== undefined ? `光等 ${item.power}` : "",
    ...protectionFacts
  ].filter(Boolean).join(" · ");
}
