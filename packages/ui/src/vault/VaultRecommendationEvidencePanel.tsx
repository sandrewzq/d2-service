import type { AccountItemSummary } from "@d2-tools/core/account/summary";
import type { DimWishlist } from "@d2-tools/core/analysis/wishlistImport";
import type { VaultRecommendationScanState } from "@d2-tools/app/account";
import type {
  LocalCommunityRecommendationTable,
  VaultItemInstanceMatchInfo
} from "@d2-tools/core/community-perks";
import type { VaultTags } from "@d2-tools/core/vault/tags";
import type { LoadoutTemplateLookup } from "@d2-tools/app/loadouts";
import { getAccountItemSlotLabel, getVaultItemLocationLabel } from "@d2-tools/app/vault";
import { useEffect, useMemo, useState } from "react";
import { ControlButton } from "../control/ControlButton.js";
import {
  VaultWishlistManager,
  type VaultRecommendationManagedSource,
  type VaultWishlistActions
} from "./VaultWishlistManager.js";
import {
  buildVaultRecommendationSourceOptions,
  canonicalVaultRecommendationSourceId,
  getVaultCommunityInstanceKey,
  hasPositiveRecommendationSummary,
  inferVaultRecommendationResult,
  inferVaultRecommendationResultForSource,
  vaultSourceRecommendationResultLabel,
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
  communityInstanceMatch?: Map<string, VaultItemInstanceMatchInfo>;
  recommendationSummaryByInstance?: VaultRecommendationSummaryIndex;
  highlightedItemKeys?: LoadoutTemplateLookup | null;
  sourceState?: VaultRecommendationSourceState;
  managedSources?: readonly VaultRecommendationManagedSource[];
  wishlistActions?: VaultWishlistActions;
  managementLocked?: boolean;
  canOrganizeItem?: (item: AccountItemSummary) => boolean;
  onCopyAuditReport?: () => void | Promise<void>;
  onOpenItem: (item: AccountItemSummary) => void;
  onOrganizeItem?: (item: AccountItemSummary) => void;
}) {
  const [isWishlistManagerOpen, setIsWishlistManagerOpen] = useState(false);
  const [panelFeedback, setPanelFeedback] = useState<{ tone: "ready" | "error"; message: string } | null>(null);
  const [activeSourceId, setActiveSourceId] = useState("");
  const [activeFilter, setActiveFilter] = useState<RecommendationEvidenceFilter>("all");
  const [visibleLimit, setVisibleLimit] = useState(200);
  const recommendationScan = props.sourceState?.recommendationScan;
  const rows = useMemo(() => buildInstanceWeaponRows(
    props.items,
    props.recommendationSummaryByInstance,
    props.communityInstanceMatch,
    recommendationScan?.phase === "complete",
    props.tags
  ), [props.communityInstanceMatch, props.items, props.recommendationSummaryByInstance, props.tags, recommendationScan?.phase]);
  const rowMetrics = useMemo(() => summarizeRecommendationRows(rows), [rows]);
  const { coveredRows } = rowMetrics;
  const sourceState = props.sourceState;
  const hasManagedSource = props.managedSources?.some((source) => source.configured && source.state === "active") ?? false;
  const hasInstanceScan = Boolean(props.communityInstanceMatch?.size) || recommendationScan?.phase === "complete";
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
  const sourceOptions = useMemo(() => buildVaultRecommendationSourceOptions(
    rows.map((row) => row.summaries),
    props.managedSources
  ), [props.managedSources, rows]);
  const selectedSource = sourceOptions.find((option) => option.sourceId === activeSourceId);
  const filterOptions = useMemo(
    () => recommendationFilterOptions(rows, activeSourceId),
    [activeSourceId, rows]
  );
  const filteredRows = useMemo(
    () => activeSourceId
      ? rows.filter((row) => matchesRecommendationFilter(row, activeFilter, activeSourceId))
      : [],
    [activeFilter, activeSourceId, rows]
  );
  const visibleRows = filteredRows.slice(0, visibleLimit);

  useEffect(() => {
    setVisibleLimit(200);
  }, [activeFilter, activeSourceId]);

  useEffect(() => {
    if (!activeSourceId) return;
    if (sourceOptions.some((option) => option.sourceId === activeSourceId)) return;
    setActiveSourceId("");
    setActiveFilter("all");
  }, [activeSourceId, sourceOptions]);

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
        <span><strong>2 选择结果</strong><small>符合、未符合和未收录互不混淆</small></span>
        <span><strong>3 查看依据并整理</strong><small>核心只看 Perk 1 / Perk 2</small></span>
      </div>

      <div className="vault-recommendation-summary" data-ui-kind="callout" data-status="neutral">
        <span>{formatRecommendationScanDetail(recommendationScan)} · 当前有来源记录 {coveredRows.length} 件。</span>
        {props.onCopyAuditReport ? <ControlButton size="compact" variant="quiet" onClick={() => {
          setPanelFeedback(null);
          void Promise.resolve(props.onCopyAuditReport?.()).then(
            () => setPanelFeedback({ tone: "ready", message: "只读验收报告已复制。" }),
            () => setPanelFeedback({ tone: "error", message: "复制失败，请稍后重试。" })
          );
        }}>复制验收报告</ControlButton> : null}
      </div>

      {rows.length ? (
        <>
          <div className="vault-evidence-filter-bar">
            <label className="vault-evidence-source-filter">
              <span>1 推荐来源</span>
              <select value={activeSourceId} onChange={(event) => {
                setActiveSourceId(event.target.value);
                setActiveFilter("all");
              }}>
                <option value="">选择来源</option>
                {sourceOptions.map((option) => (
                  <option key={option.sourceId} value={option.sourceId}>{option.sourceLabel} · 覆盖 {option.count}</option>
                ))}
              </select>
            </label>
            {activeSourceId ? (
              <div className="vault-evidence-filters" role="group" aria-label={`${selectedSource?.sourceLabel ?? "当前来源"}结果筛选`}>
                <span>2 该来源结果</span>
                <div>
                  {filterOptions.map((option) => (
                    <button type="button" key={option.key} aria-pressed={activeFilter === option.key} onClick={() => setActiveFilter(option.key)}>{option.label} <strong>{option.count}</strong></button>
                  ))}
                </div>
              </div>
            ) : <small>先选择来源，再按该来源的符合情况筛选。</small>}
          </div>
          {activeSourceId ? (
            <>
              <div className="vault-evidence-results" data-surface="list">
                {visibleRows.map((row) => {
                  const recommendationState = inferVaultRecommendationResultForSource(row.summaries, activeSourceId);
                  const primarySummary = row.summaries.find((summary) => (
                    canonicalVaultRecommendationSourceId(summary.sourceId) === activeSourceId
                  ));
                  const additionalSourceCount = Math.max(0, row.summaries.length - (primarySummary ? 1 : 0));
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
                        <small>该来源结果</small><strong>{vaultSourceRecommendationResultLabel(recommendationState)}</strong>
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
              {!filteredRows.length ? <div className="vault-evidence-empty" data-surface="empty"><strong>当前分类没有武器</strong><span>请选择其他推荐结果分类。</span></div> : null}
              {visibleRows.length < filteredRows.length ? <div className="vault-evidence-load-more"><span>已显示 {visibleRows.length}/{filteredRows.length} 件</span><ControlButton size="compact" variant="secondary" onClick={() => setVisibleLimit((current) => current + 200)}>加载更多</ControlButton></div> : null}
            </>
          ) : (
            <div className="vault-evidence-empty vault-evidence-source-empty" data-surface="empty">
              <strong>先选择推荐来源</strong>
              <span>选择后再查看该来源的符合、部分符合、未符合、无法判断和未收录武器。</span>
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
  purposes: Array<"pve" | "pvp" | "general">;
  recommendationState: VaultRecommendationResult;
  disposition?: "keep" | "review" | "junk" | "farm" | "loadout";
  dispositionLabel?: string;
};

type RecommendationEvidenceFilter = InstanceWeaponRow["recommendationState"] | "all";

function summarizeRecommendationRows(rows: InstanceWeaponRow[]) {
  const coveredRows = rows.filter((row) => row.summaries.length > 0);
  const positiveInstanceCount = coveredRows.filter((row) => row.summaries.some(hasPositiveRecommendationSummary)).length;
  const conflictInstanceCount = coveredRows.filter(hasRecommendationConflict).length;
  const uncheckableInstanceCount = coveredRows.filter((row) => (
    row.summaries.some((summary) => summary.state === "uncheckable")
  )).length;
  const reviewInstanceCount = coveredRows.filter((row) => (
    hasRecommendationConflict(row)
    || row.summaries.some((summary) => summary.state === "uncheckable")
  )).length;
  const sourceLabels = [...new Set(coveredRows.flatMap((row) => (
    row.summaries.map((summary) => summary.sourceLabel)
  )))];
  return {
    coveredRows,
    positiveInstanceCount,
    conflictInstanceCount,
    uncheckableInstanceCount,
    reviewInstanceCount,
    sourceLabels
  };
}

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
  communityInstanceMatch?: Map<string, VaultItemInstanceMatchInfo>,
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
        communityInstanceMatch?.get(instanceKey)?.recommendation_state
      );
      const disposition = tags?.items[instanceKey]?.tag;
      return [{
        key: item.instance_id ? `instance:${item.instance_id}` : `${instanceKey}:${index}`,
        item,
        summaries,
        purposes: [...new Set(summaries.flatMap((summary) => summary.purposes))],
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

function recommendationFilterOptions(
  rows: InstanceWeaponRow[],
  sourceId: string
): Array<{ key: RecommendationEvidenceFilter; label: string; count: number }> {
  const options: Array<{ key: RecommendationEvidenceFilter; label: string }> = [
    { key: "all", label: "全部" },
    { key: "matched", label: "符合推荐" },
    { key: "partial", label: "部分符合" },
    { key: "not_matched", label: "未符合" },
    { key: "uncheckable", label: "无法判断" },
    { key: "uncovered", label: "未收录" }
  ];
  return options.map((option) => ({
    ...option,
    count: rows.filter((row) => matchesRecommendationFilter(row, option.key, sourceId)).length
  }));
}

function matchesRecommendationFilter(
  row: InstanceWeaponRow,
  filter: RecommendationEvidenceFilter,
  sourceId: string
): boolean {
  if (filter === "all") return true;
  if (!sourceId) return false;
  return inferVaultRecommendationResultForSource(row.summaries, sourceId) === filter;
}

function hasRecommendationConflict(row: InstanceWeaponRow): boolean {
  return row.summaries.some(hasPositiveRecommendationSummary)
    && row.summaries.some((summary) => (
      summary.state === "key_missing" || summary.state === "not_matched"
    ));
}

function dispositionLabel(value: NonNullable<InstanceWeaponRow["disposition"]>): string {
  if (value === "keep") return "保留";
  if (value === "review") return "待复查";
  if (value === "junk") return "待处理";
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
