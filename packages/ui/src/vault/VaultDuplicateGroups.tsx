import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import {
  classifyWeaponSocketPlugs,
  isWeaponSystemPlug,
  weaponSocketColumnLabel,
  type WeaponPerkColumnRole
} from "@d2-tools/app/items";
import type {
  AccountItemPlugSummary,
  AccountItemReusablePlugSummary,
  AccountItemSummary
} from "@d2-tools/core/account/summary";
import type { DuplicateAnalysisResult, DuplicateItemGroup } from "@d2-tools/core/analysis/duplicates";
import { evaluateLocalTargets } from "@d2-tools/core/analysis/targets";
import type { LocalTargetRules } from "@d2-tools/core/analysis/targets";
import { evaluateEquipmentTargets, type EquipmentTargetStore } from "@d2-tools/core/targets/equipmentTargets";
import type {
  RecommendationRequirementSlot,
  RecommendationSourceMatch,
  RecommendationSourceSlotMatch,
  VaultItemInstanceMatchInfo
} from "@d2-tools/core/community-perks";
import type { SaveVaultTagInput } from "@d2-tools/core/vault/tags";
import type { LoadoutTemplateLookup } from "@d2-tools/app/loadouts";
import { getVaultItemKey, normalizeCoreItem } from "@d2-tools/app/vault";
import { GameAssetImage } from "../media/GameAssetImage.js";
import { getRovingFocusIndex } from "../interaction/rovingFocus.js";
import { useNavigationGuard } from "../navigation/NavigationGuard.js";
import { presentRecommendationSlotMatch } from "../recommendationMatchPresentation.js";
import { formatVaultItemMeta } from "./VaultListItem.js";
import {
  displayVaultRecommendationSourceLabel,
  getVaultCommunityInstanceKey,
  type VaultRecommendationSummaryIndex
} from "./vaultRecommendationMatch.js";

type DuplicateDisposition = "none" | "keep" | "review" | "junk";
type DuplicateTypeFilter = "all" | "weapons" | "armor";
type DuplicateProgressFilter = "all" | "pending" | "complete" | "protected";

type DuplicateEvidence = {
  protection: string[];
  matches: string[];
};

const emptyDuplicateEvidence: DuplicateEvidence = { protection: [], matches: [] };

type DuplicateRollOption = {
  key: string;
  text: string;
  icon?: string;
  selected: boolean;
  canSwitch: boolean;
};

type DuplicateComparisonValue = {
  kind: "scalar";
  key: string;
  text: string;
} | {
  kind: "roll";
  key: string;
  options: DuplicateRollOption[];
} | {
  kind: "source";
  key: string;
  state: RecommendationSourceSlotMatch["state"] | "not_covered";
  sourceCandidates: string[];
  instanceOwned: string[];
  currentEnabled: string[];
};

type DuplicateComparisonColumn = {
  key: string;
  label: string;
  kind: DuplicateComparisonValue["kind"];
  valueFor: (item: AccountItemSummary) => DuplicateComparisonValue;
};

type DuplicateRollSocket = {
  socketIndex: number;
  plugs: AccountItemPlugSummary[];
  options: DuplicateRollOption[];
};

type DuplicateSourceOption = {
  sourceId: string;
  sourceLabel: string;
};

const DUPLICATE_DETAIL_CONCURRENCY = 3;

const dispositionOptions: Array<{ key: DuplicateDisposition; label: string }> = [
  { key: "none", label: "未标记" },
  { key: "keep", label: "保留" },
  { key: "review", label: "待定" },
  { key: "junk", label: "清理" }
];

export function VaultDuplicateGroups(props: {
  duplicateSummary: DuplicateAnalysisResult;
  items: AccountItemSummary[];
  recommendationSummaryByInstance?: VaultRecommendationSummaryIndex;
  localTargetRules?: LocalTargetRules | null;
  equipmentTargetStore?: EquipmentTargetStore | null;
  highlightedItemKeys?: LoadoutTemplateLookup | null;
  cleanupProtectionByItemKey?: Map<string, string[]>;
  locateRequest?: { groupKey: string; requestId: number } | null;
  openingItemKey?: string;
  isBatchSaving: boolean;
  recommendationRevision?: string;
  onLoadItemDetail?: (item: AccountItemSummary) => Promise<AccountItemSummary>;
  onLoadRecommendationEvidence?: (items: AccountItemSummary[]) => Promise<VaultItemInstanceMatchInfo[]>;
  onOpenItem: (item: AccountItemSummary) => void;
  onApplyGroupTags: (groupName: string, inputs: SaveVaultTagInput[]) => void | Promise<void>;
  onPendingChange?: (hasPendingChanges: boolean) => void;
}) {
  const groups = props.duplicateSummary.groups;
  const itemByKey = useMemo(() => new Map(props.items.map((item) => [getVaultItemKey(item), item])), [props.items]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<DuplicateTypeFilter>("all");
  const [progressFilter, setProgressFilter] = useState<DuplicateProgressFilter>("all");
  const [activeGroupKey, setActiveGroupKey] = useState(groups[0]?.group_key ?? "");
  const [referenceByGroup, setReferenceByGroup] = useState<Record<string, string>>({});
  const [pendingDispositionByGroup, setPendingDispositionByGroup] = useState<Record<string, Record<string, DuplicateDisposition>>>({});
  const [detailByItemKey, setDetailByItemKey] = useState<Record<string, AccountItemSummary>>({});
  const [detailLoadStatusByItemKey, setDetailLoadStatusByItemKey] = useState<Record<string, "loading" | "ready" | "error">>({});
  const [requestedRollGroupKeys, setRequestedRollGroupKeys] = useState<Set<string>>(new Set());
  const [revisionResetMessage, setRevisionResetMessage] = useState("");
  const groupNavRef = useRef<HTMLElement>(null);
  const pendingFocusGroupKeyRef = useRef("");
  // 同一实例可能同时从仓库行、详情弹层或切换后的同名组触发读取。
  // 在菜单层保留请求表，既能避免重复 IPC，也能把批量读取限制在可控并发内。
  const detailRequestByItemKeyRef = useRef(new Map<string, Promise<AccountItemSummary>>());
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const pendingChangeCount = useMemo(() => groups.reduce((count, group) => (
    count + group.items.filter((entry) => (
      (pendingDispositionByGroup[group.group_key]?.[entry.item_key] ?? dispositionFromTag(entry.tag)) !== dispositionFromTag(entry.tag)
    )).length
  ), 0), [groups, pendingDispositionByGroup]);
  const recommendationRevisionRef = useRef(props.recommendationRevision ?? "");
  useEffect(() => {
    props.onPendingChange?.(pendingChangeCount > 0);
    return () => props.onPendingChange?.(false);
  }, [pendingChangeCount, props.onPendingChange]);
  useEffect(() => {
    const nextRevision = props.recommendationRevision ?? "";
    const previousRevision = recommendationRevisionRef.current;
    recommendationRevisionRef.current = nextRevision;
    if (previousRevision === nextRevision || pendingChangeCount === 0) return;
    setPendingDispositionByGroup({});
    setRevisionResetMessage("推荐数据已经更新，旧的同名整理预览已失效。请按新依据重新标记。");
  }, [pendingChangeCount, props.recommendationRevision]);
  const evidenceByItemKey = useMemo(() => {
    const index = new Map<string, DuplicateEvidence>();
    for (const group of groups) {
      for (const entry of group.items) {
        if (index.has(entry.item_key)) continue;
        const item = itemByKey.get(entry.item_key);
        if (item) index.set(entry.item_key, itemEvidence(item, props));
      }
    }
    return index;
  }, [groups, itemByKey, props.cleanupProtectionByItemKey, props.equipmentTargetStore, props.highlightedItemKeys, props.localTargetRules, props.recommendationSummaryByInstance]);
  const evidenceSummaryByGroup = useMemo(() => new Map(groups.map((group) => [
    group.group_key,
    summarizeGroupEvidence(group, evidenceByItemKey)
  ])), [evidenceByItemKey, groups]);

  useNavigationGuard(pendingChangeCount > 0 ? {
    title: "离开仓库并放弃待应用状态？",
    description: `当前有 ${pendingChangeCount} 件装备的整理状态尚未应用。离开仓库后这些临时选择会丢失，已应用的本地标签不会改变。`,
    confirmLabel: "放弃并离开",
    cancelLabel: "继续整理"
  } : null);

  const filteredGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return groups.filter((group) => {
      const firstItem = group.items[0] ? itemByKey.get(group.items[0].item_key) : undefined;
      if (typeFilter !== "all" && firstItem?.group_key !== typeFilter) return false;
      if (normalizedQuery && !group.name.toLocaleLowerCase().includes(normalizedQuery)) return false;

      const isComplete = isGroupPersistedComplete(group);
      const evidence = evidenceSummaryByGroup.get(group.group_key) ?? { protectedItems: 0, matchedItems: 0 };
      if (progressFilter === "pending" && isComplete) return false;
      if (progressFilter === "complete" && !isComplete) return false;
      if (progressFilter === "protected" && evidence.protectedItems === 0) return false;
      return true;
    });
  }, [evidenceSummaryByGroup, groups, itemByKey, progressFilter, query, typeFilter]);

  useEffect(() => {
    const groupKey = props.locateRequest?.groupKey;
    if (!groupKey || !groups.some((group) => group.group_key === groupKey)) return;
    setQuery("");
    setTypeFilter("weapons");
    setProgressFilter("all");
    setActiveGroupKey(groupKey);
    pendingFocusGroupKeyRef.current = groupKey;
  }, [groups, props.locateRequest?.groupKey, props.locateRequest?.requestId]);

  useEffect(() => {
    if (!filteredGroups.some((group) => group.group_key === activeGroupKey)) {
      setActiveGroupKey(filteredGroups[0]?.group_key ?? "");
    }
  }, [activeGroupKey, filteredGroups]);

  useEffect(() => {
    if (!pendingFocusGroupKeyRef.current || pendingFocusGroupKeyRef.current !== activeGroupKey) return;
    const target = [...(groupNavRef.current?.querySelectorAll<HTMLButtonElement>(".duplicate-group-link") ?? [])]
      .find((button) => button.dataset.groupKey === activeGroupKey);
    if (!target) return;
    target.focus();
    target.scrollIntoView({ block: "nearest", inline: "nearest" });
    pendingFocusGroupKeyRef.current = "";
  }, [activeGroupKey, filteredGroups]);

  const activeGroup = filteredGroups.find((group) => group.group_key === activeGroupKey) ?? filteredGroups[0];

  useEffect(() => {
    const loadItemDetail = props.onLoadItemDetail;
    if (!loadItemDetail || !activeGroup || !requestedRollGroupKeys.has(activeGroup.group_key)) return;
    const groupItems = activeGroup.items.flatMap((entry) => {
      const item = itemByKey.get(entry.item_key);
      return item?.group_key === "weapons"
        ? [{ key: entry.item_key, cacheKey: rollDetailCacheKey(entry.item_key, item), item }]
        : [];
    });
    const pendingItems = groupItems.filter(({ cacheKey, item }) => (
      item.instance_id
      && item.sockets === undefined
      && detailByItemKey[cacheKey]?.sockets === undefined
      && detailLoadStatusByItemKey[cacheKey] === undefined
    ));
    if (!pendingItems.length) return;

    setDetailLoadStatusByItemKey((current) => ({
      ...current,
      ...Object.fromEntries(pendingItems.map(({ cacheKey }) => [cacheKey, "loading" as const]))
    }));
    void runWithConcurrency(pendingItems, DUPLICATE_DETAIL_CONCURRENCY, async ({ cacheKey, item }) => {
      try {
        let request = detailRequestByItemKeyRef.current.get(cacheKey);
        if (!request) {
          request = loadItemDetail(item);
          detailRequestByItemKeyRef.current.set(cacheKey, request);
          void request.then(() => {
            if (detailRequestByItemKeyRef.current.get(cacheKey) === request) {
              detailRequestByItemKeyRef.current.delete(cacheKey);
            }
          }, () => {
            if (detailRequestByItemKeyRef.current.get(cacheKey) === request) {
              detailRequestByItemKeyRef.current.delete(cacheKey);
            }
          });
        }
        const detail = await request;
        if (detail.sockets === undefined) throw new Error("完整 Roll 数据未返回");
        if (!mountedRef.current) return;
        setDetailByItemKey((current) => ({ ...current, [cacheKey]: detail }));
        setDetailLoadStatusByItemKey((current) => ({ ...current, [cacheKey]: "ready" }));
      } catch {
        if (!mountedRef.current) return;
        setDetailLoadStatusByItemKey((current) => ({ ...current, [cacheKey]: "error" }));
      }
    });
  }, [activeGroup, detailByItemKey, detailLoadStatusByItemKey, itemByKey, props.onLoadItemDetail, requestedRollGroupKeys]);

  if (!groups.length) {
    return <p className="status-message status-neutral">当前仓库没有发现同名重复装备。</p>;
  }

  const storedReferenceKey = activeGroup ? referenceByGroup[activeGroup.group_key] : undefined;
  const explicitReferenceKey = activeGroup?.items.some((entry) => entry.item_key === storedReferenceKey) ? storedReferenceKey : undefined;
  const referenceKey = activeGroup ? explicitReferenceKey ?? defaultReferenceKey(activeGroup) : "";
  const activeRollDataStatus = getGroupRollDataStatus(
    activeGroup,
    itemByKey,
    detailByItemKey,
    detailLoadStatusByItemKey,
    Boolean(props.onLoadItemDetail),
    Boolean(activeGroup && requestedRollGroupKeys.has(activeGroup.group_key))
  );
  const activeRollProgress = getGroupRollDataProgress(activeGroup, itemByKey, detailByItemKey);
  const comparisonItemByKey = activeRollDataStatus === "ready"
    ? new Map<string, AccountItemSummary>([...itemByKey].map(([key, item]) => [
        key,
        detailByItemKey[rollDetailCacheKey(key, item)] ?? item
      ] as const))
    : itemByKey;

  function retryActiveGroupRollDetails() {
    if (!activeGroup) return;
    const groupKeys = new Set(activeGroup.items.flatMap((entry) => {
      const item = itemByKey.get(entry.item_key);
      return item ? [rollDetailCacheKey(entry.item_key, item)] : [];
    }));
    setDetailLoadStatusByItemKey((current) => Object.fromEntries(
      Object.entries(current).filter(([key, status]) => !groupKeys.has(key) || status !== "error")
    ));
    setRequestedRollGroupKeys((current) => new Set(current).add(activeGroup.group_key));
  }

  function requestActiveGroupRollDetails() {
    if (!activeGroup) return;
    setRequestedRollGroupKeys((current) => new Set(current).add(activeGroup.group_key));
  }

  function handleGroupKeyDown(event: KeyboardEvent<HTMLButtonElement>, groupKey: string) {
    const currentIndex = filteredGroups.findIndex((group) => group.group_key === groupKey);
    const nextIndex = getRovingFocusIndex({
      key: event.key,
      currentIndex,
      itemCount: filteredGroups.length,
      orientation: "both"
    });
    if (nextIndex === null) return;
    event.preventDefault();
    const nextGroup = filteredGroups[nextIndex];
    const nextButton = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(".duplicate-group-link")[nextIndex];
    if (!nextGroup || !nextButton) return;
    setActiveGroupKey(nextGroup.group_key);
    nextButton.focus();
    nextButton.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  return (
    <div className="duplicate-workspace">
      <aside className="duplicate-group-browser" aria-label="同名装备组">
        <div className="duplicate-browser-head"><strong>同名整理</strong><span>{groups.length} 组重复装备</span></div>
        <div className="duplicate-browser-tools">
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索装备名称" aria-label="搜索同名装备组" />
          <div className="duplicate-type-filter" role="group" aria-label="同名装备类型">
            {(["all", "weapons", "armor"] as DuplicateTypeFilter[]).map((value) => (
              <button type="button" key={value} aria-pressed={typeFilter === value} onClick={() => setTypeFilter(value)}>{value === "all" ? "全部" : value === "weapons" ? "武器" : "护甲"}</button>
            ))}
          </div>
          <select value={progressFilter} onChange={(event) => setProgressFilter(event.target.value as DuplicateProgressFilter)} aria-label="筛选同名组整理进度">
            <option value="all">全部整理进度</option>
            <option value="pending">仍有未标记</option>
            <option value="complete">已完成整理</option>
            <option value="protected">包含实例保护</option>
          </select>
        </div>
        <nav ref={groupNavRef} className="duplicate-group-nav">
          {filteredGroups.map((group) => {
            const pendingDisposition = pendingDispositionByGroup[group.group_key];
            const dispositionSummary = summarizeGroupDisposition(group, pendingDisposition);
            const evidence = evidenceSummaryByGroup.get(group.group_key) ?? { protectedItems: 0, matchedItems: 0 };
            const firstItem = group.items[0] ? itemByKey.get(group.items[0].item_key) : undefined;
            const hasPendingChanges = hasGroupPendingChanges(group, pendingDisposition);
            return (
              <button type="button" className="duplicate-group-link" data-group-key={group.group_key} key={group.group_key} aria-pressed={activeGroup?.group_key === group.group_key} tabIndex={activeGroup?.group_key === group.group_key ? 0 : -1} onClick={() => setActiveGroupKey(group.group_key)} onKeyDown={(event) => handleGroupKeyDown(event, group.group_key)}>
                <GameAssetImage src={firstItem?.icon} alt="" loading="eager" fallback={<span className="duplicate-thumb-fallback">{firstItem?.group_key === "armor" ? "甲" : "武"}</span>} />
                <span className="duplicate-group-copy">
                  <span className="duplicate-group-title-line"><strong>{group.name}</strong>{hasPendingChanges ? <em>待应用</em> : null}</span>
                  <span>{groupKindLabel(group)} · {group.count} 件 · 未标记 {dispositionSummary.none}</span>
                  <small>保护 {evidence.protectedItems} · 证据 {evidence.matchedItems} · 已决定 {group.count - dispositionSummary.none}</small>
                </span>
              </button>
            );
          })}
        </nav>
        {!filteredGroups.length ? <p className="duplicate-browser-empty">没有符合当前搜索和进度条件的同名组。</p> : null}
      </aside>

      {activeGroup ? (
        <div className="duplicate-compare-workspace">
          {revisionResetMessage ? <p className="status-message status-warning" role="status">{revisionResetMessage}</p> : null}
          <DuplicateComparePanel
            key={`${activeGroup.group_key}\u0000${props.recommendationRevision ?? ""}`}
            group={activeGroup}
            itemByKey={comparisonItemByKey}
            evidenceByItemKey={evidenceByItemKey}
            recommendationSummaryByInstance={props.recommendationSummaryByInstance}
            referenceKey={referenceKey}
            referenceIsAutomatic={!explicitReferenceKey}
            hasNextPendingGroup={filteredGroups.some((group) => group.group_key !== activeGroup.group_key && !isGroupPersistedComplete(group))}
            pendingDisposition={pendingDispositionByGroup[activeGroup.group_key]}
            openingItemKey={props.openingItemKey}
            isBatchSaving={props.isBatchSaving}
            rollDataStatus={activeRollDataStatus}
            rollDataProgress={activeRollProgress}
            onReferenceChange={(itemKey) => setReferenceByGroup((current) => ({ ...current, [activeGroup.group_key]: itemKey }))}
            onPendingDispositionChange={(nextDisposition) => { setRevisionResetMessage(""); setPendingDispositionByGroup((current) => ({ ...current, [activeGroup.group_key]: nextDisposition })); }}
            onOpenItem={props.onOpenItem}
            onRequestRollDetails={requestActiveGroupRollDetails}
            onRetryRollDetails={retryActiveGroupRollDetails}
            onLoadRecommendationEvidence={props.onLoadRecommendationEvidence}
            onApplyGroupTags={props.onApplyGroupTags}
            onNextGroup={() => {
              const currentIndex = filteredGroups.findIndex((group) => group.group_key === activeGroup.group_key);
              const followingGroups = [...filteredGroups.slice(currentIndex + 1), ...filteredGroups.slice(0, currentIndex)];
              const nextGroup = followingGroups.find((group) => !isGroupPersistedComplete(group));
              if (nextGroup) setActiveGroupKey(nextGroup.group_key);
            }}
          />
        </div>
      ) : <section className="duplicate-compare-panel"><p className="status-message status-neutral">选择左侧同名组开始整理。</p></section>}
    </div>
  );
}

function DuplicateComparePanel(props: {
  group: DuplicateItemGroup;
  itemByKey: Map<string, AccountItemSummary>;
  evidenceByItemKey: ReadonlyMap<string, DuplicateEvidence>;
  recommendationSummaryByInstance?: VaultRecommendationSummaryIndex;
  referenceKey: string;
  referenceIsAutomatic: boolean;
  hasNextPendingGroup: boolean;
  pendingDisposition?: Record<string, DuplicateDisposition>;
  openingItemKey?: string;
  isBatchSaving: boolean;
  rollDataStatus: "idle" | "ready" | "loading" | "error" | "unavailable";
  rollDataProgress: { ready: number; total: number };
  onReferenceChange: (itemKey: string) => void;
  onPendingDispositionChange: (disposition: Record<string, DuplicateDisposition>) => void;
  onOpenItem: (item: AccountItemSummary) => void;
  onRequestRollDetails: () => void;
  onRetryRollDetails: () => void;
  onLoadRecommendationEvidence?: (items: AccountItemSummary[]) => Promise<VaultItemInstanceMatchInfo[]>;
  onApplyGroupTags: (groupName: string, inputs: SaveVaultTagInput[]) => void | Promise<void>;
  onNextGroup: () => void;
}) {
  const rows = useMemo(() => props.group.items.flatMap((entry) => {
    const item = props.itemByKey.get(entry.item_key);
    return item ? [{ entry, item }] : [];
  }), [props.group.group_key, props.itemByKey]);
  const savedDisposition = Object.fromEntries(props.group.items.map((entry) => [entry.item_key, dispositionFromTag(entry.tag)]));
  const pendingDisposition = props.pendingDisposition ?? savedDisposition;
  // 首屏保持稳定的“当前启用”视图；完整 Roll 只在详情齐全后由用户主动开启。
  const [rollViewMode, setRollViewMode] = useState<"full" | "active">("active");
  const [comparisonView, setComparisonView] = useState("roll");
  const [protectionConflictCount, setProtectionConflictCount] = useState(0);
  const [recommendationEvidenceByInstance, setRecommendationEvidenceByInstance] = useState<Map<string, VaultItemInstanceMatchInfo>>(new Map());
  const [recommendationEvidenceStatus, setRecommendationEvidenceStatus] = useState<"idle" | "loading" | "ready" | "error" | "unavailable">("idle");
  const recommendationEvidenceMountedRef = useRef(true);
  useEffect(() => {
    recommendationEvidenceMountedRef.current = true;
    return () => {
      recommendationEvidenceMountedRef.current = false;
    };
  }, []);
  useEffect(() => {
    if (props.rollDataStatus !== "ready") setRollViewMode("active");
  }, [props.rollDataStatus]);
  const referenceRow = rows.find((row) => row.entry.item_key === props.referenceKey);
  const referenceIndex = Math.max(0, rows.findIndex((row) => row.entry.item_key === props.referenceKey));
  const sourceOptions = useMemo(() => buildDuplicateSourceOptions(
    rows.map((row) => row.item),
    props.recommendationSummaryByInstance
  ), [props.group.group_key, props.itemByKey, props.recommendationSummaryByInstance]);
  const selectedSourceId = comparisonView.startsWith("source:") ? comparisonView.slice("source:".length) : "";
  const selectedSource = sourceOptions.find((source) => source.sourceId === selectedSourceId);
  useEffect(() => {
    if (selectedSourceId && !selectedSource) setComparisonView("roll");
  }, [selectedSource, selectedSourceId]);
  useEffect(() => {
    if (!selectedSource || recommendationEvidenceStatus !== "idle") return;
    const loadEvidence = props.onLoadRecommendationEvidence;
    if (!loadEvidence) {
      setRecommendationEvidenceStatus("unavailable");
      return;
    }
    setRecommendationEvidenceStatus("loading");
    void loadEvidence(rows.map((row) => row.item)).then(
      (matches) => {
        if (!recommendationEvidenceMountedRef.current) return;
        setRecommendationEvidenceByInstance(new Map(matches.map((match) => [
          match.instance_id ?? `hash:${match.hash}`,
          match
        ])));
        setRecommendationEvidenceStatus("ready");
      },
      () => {
        if (recommendationEvidenceMountedRef.current) setRecommendationEvidenceStatus("error");
      }
    );
  }, [props.group.group_key, props.onLoadRecommendationEvidence, recommendationEvidenceStatus, rows, selectedSource]);
  const allRollColumns = useMemo(() => buildComparisonColumns(rows.map((row) => row.item)), [props.group.group_key, props.itemByKey]);
  const coreRollColumns = useMemo(() => {
    if (rows[0]?.item.group_key !== "weapons") return allRollColumns;
    const core = allRollColumns.filter((column) => column.label === "Perk 1" || column.label === "Perk 2");
    return core.length ? core : allRollColumns;
  }, [allRollColumns, rows]);
  const sourceColumns = useMemo(() => selectedSource
    ? buildSourceComparisonColumns(rows.map((row) => row.item), selectedSource.sourceId, recommendationEvidenceByInstance)
    : [], [props.group.group_key, props.itemByKey, recommendationEvidenceByInstance, selectedSource]);
  const hasRollColumns = allRollColumns.some((column) => column.kind === "roll");
  const effectiveRollViewMode = hasRollColumns && props.rollDataStatus === "ready" ? rollViewMode : "active";
  const rollColumns = effectiveRollViewMode === "full" ? allRollColumns : coreRollColumns;
  const isSourceComparisonReady = Boolean(selectedSource && recommendationEvidenceStatus === "ready");
  const columns = isSourceComparisonReady ? sourceColumns : rollColumns;
  const showsFullRoll = !selectedSource && hasRollColumns && effectiveRollViewMode === "full";
  const referenceValues = referenceRow ? columns.map((column) => column.valueFor(referenceRow.item)) : [];
  const summary = summarizeGroupDisposition(props.group, pendingDisposition);
  const changedCount = props.group.items.filter((entry) => (pendingDisposition[entry.item_key] ?? "none") !== dispositionFromTag(entry.tag)).length;
  const comparisonTracks = columns.map((column) => column.kind === "source" ? "minmax(220px, 1fr)" : column.kind === "roll" ? "minmax(188px, 1fr)" : "minmax(116px, 0.78fr)").join(" ");
  const comparisonMinWidth = columns.reduce((width, column) => width + (column.kind === "source" ? 220 : column.kind === "roll" ? 188 : 116), 0);
  const gridTemplateColumns = `52px minmax(190px, 1.15fr) ${comparisonTracks} minmax(190px, 1fr) minmax(250px, 1.2fr)`;
  const gridStyle: CSSProperties = {
    gridTemplateColumns,
    minWidth: 52 + 190 + comparisonMinWidth + 190 + 250
  };

  function updateDisposition(itemKey: string, disposition: DuplicateDisposition) {
    const evidence = props.evidenceByItemKey.get(itemKey) ?? emptyDuplicateEvidence;
    if (disposition === "junk" && hasProtectedDispositionEvidence(evidence)) {
      setProtectionConflictCount(1);
      return;
    }
    setProtectionConflictCount(0);
    props.onPendingDispositionChange({ ...pendingDisposition, [itemKey]: disposition });
  }

  function keepReferenceReviewRest() {
    if (!props.referenceKey) return;
    props.onPendingDispositionChange(Object.fromEntries(props.group.items.map((entry) => [entry.item_key, entry.item_key === props.referenceKey ? "keep" : "review"])));
  }

  function requestApplyPendingDisposition() {
    if (!changedCount) return;
    const conflicts = rows.filter(({ entry, item }) => {
      const evidence = props.evidenceByItemKey.get(getVaultItemKey(item)) ?? emptyDuplicateEvidence;
      return (pendingDisposition[entry.item_key] ?? "none") === "junk" && (evidence.protection.length > 0 || evidence.matches.length > 0);
    });
    if (conflicts.length) {
      props.onPendingDispositionChange(Object.fromEntries(props.group.items.map((entry) => {
        const item = props.itemByKey.get(entry.item_key);
        const evidence = item ? props.evidenceByItemKey.get(getVaultItemKey(item)) ?? emptyDuplicateEvidence : emptyDuplicateEvidence;
        const disposition = pendingDisposition[entry.item_key] ?? "none";
        return [
          entry.item_key,
          disposition === "junk" && hasProtectedDispositionEvidence(evidence)
            ? dispositionFromTag(entry.tag)
            : disposition
        ];
      })));
      setProtectionConflictCount(conflicts.length);
      return;
    }
    void persistPendingDisposition();
  }

  async function persistPendingDisposition() {
    await props.onApplyGroupTags(props.group.name, props.group.items.map((entry) => ({ item_key: entry.item_key, tag: pendingDisposition[entry.item_key] ?? "none" })));
  }

  return (
    <section className="duplicate-compare-panel">
      <header className="duplicate-compare-head">
        <div><h2>{props.group.name}</h2><p>{groupKindLabel(props.group)} · {props.group.count} 件 · 整理状态仅保存在本地</p></div>
        <div className="duplicate-compare-head-actions">
          <div className="duplicate-reference-status">
            <span>比较基准</span>
            <strong>实例 {referenceIndex + 1}{props.referenceIsAutomatic ? " · 默认" : ""}</strong>
          </div>
          {sourceOptions.length ? (
            <label className="duplicate-comparison-source-select">
              <span>比较内容</span>
              <select value={comparisonView} onChange={(event) => setComparisonView(event.target.value)}>
                <option value="roll">实例 Roll</option>
                {sourceOptions.map((source) => <option value={`source:${source.sourceId}`} key={source.sourceId}>{source.sourceLabel} 推荐要求</option>)}
              </select>
            </label>
          ) : null}
          {!selectedSource && hasRollColumns ? (
            <div className="duplicate-roll-view-mode" role="group" aria-label="Roll 比较范围">
              <button type="button" aria-pressed={rollViewMode === "active"} onClick={() => setRollViewMode("active")}>当前启用</button>
              <button
                type="button"
                aria-pressed={rollViewMode === "full"}
                disabled={props.rollDataStatus === "loading" || props.rollDataStatus === "unavailable"}
                onClick={() => {
                  if (props.rollDataStatus === "ready") setRollViewMode("full");
                  else props.onRequestRollDetails();
                }}
              >
                {props.rollDataStatus === "ready" ? "完整 Roll" : "读取完整 Roll"}
              </button>
            </div>
          ) : null}
          {!selectedSource && hasRollColumns ? (
            <div className="duplicate-roll-data-status" data-status={props.rollDataStatus} role={props.rollDataStatus === "error" ? "alert" : "status"}>
              <span>
                {props.rollDataStatus === "idle"
                  ? "默认只比较 Perk 1/2 · 完整 Roll 按需读取"
                  : props.rollDataStatus === "loading"
                  ? `正在读取完整 Roll · 已读取 ${props.rollDataProgress.ready}/${props.rollDataProgress.total} · 当前显示启用项`
                  : props.rollDataStatus === "error"
                    ? "完整 Roll 读取失败 · 当前显示启用项"
                    : props.rollDataStatus === "unavailable"
                      ? "完整 Roll 不可用 · 当前显示启用项"
                      : "完整 Roll 已就绪"}
              </span>
              {props.rollDataStatus === "error" ? <button type="button" onClick={props.onRetryRollDetails}>重试</button> : null}
            </div>
          ) : null}
          {selectedSource ? (
            <div className="duplicate-source-legend" aria-label={`${selectedSource.sourceLabel}推荐 Roll 匹配状态`}>
              <span data-source-state="match">符合</span>
              <span data-source-state="different">不符</span>
              <span data-source-state="uncheckable">无法判断</span>
            </div>
          ) : (
            <div className="duplicate-compare-legend" aria-label="差异标记">
              <span className="same">相同</span>
              {showsFullRoll ? <span className="partial">部分重合</span> : null}
              <span className="different">{showsFullRoll ? "完全不同" : "不同"}</span>
            </div>
          )}
          <button type="button" data-ui-kind="button" data-control-variant="secondary" disabled={!referenceRow} onClick={() => referenceRow && props.onOpenItem(referenceRow.item)}>查看基准详情</button>
        </div>
      </header>
      {selectedSource && recommendationEvidenceStatus === "loading" ? (
        <div className="duplicate-source-note" role="status">正在读取当前同名组的完整推荐依据，实例 Roll 比较仍可继续查看。</div>
      ) : null}
      {selectedSource && recommendationEvidenceStatus === "error" ? (
        <div className="duplicate-source-note" role="alert">完整推荐依据读取失败。<button type="button" onClick={() => setRecommendationEvidenceStatus("idle")}>重试</button></div>
      ) : null}
      {selectedSource && recommendationEvidenceStatus === "unavailable" ? (
        <div className="duplicate-source-note" role="status">当前环境不支持读取完整推荐依据。</div>
      ) : null}
      {selectedSource && !sourceColumns.length ? (
        recommendationEvidenceStatus === "ready"
          ? <div className="duplicate-source-note" role="status">{selectedSource.sourceLabel} 只推荐这把武器，没有指定需要比较的 Perk 项。</div>
          : null
      ) : null}
      <div className="duplicate-compare-table">
        <div className="duplicate-table-head" style={gridStyle}><span>基准</span><span>实例</span>{columns.map((column) => <span key={column.key}>{column.label}</span>)}<span>保护与证据</span><span>整理状态</span></div>
        {rows.map(({ entry, item }, index) => {
          const values = columns.map((column) => column.valueFor(item));
          const evidence = props.evidenceByItemKey.get(getVaultItemKey(item)) ?? emptyDuplicateEvidence;
          const disposition = pendingDisposition[entry.item_key] ?? "none";
          const persistedDisposition = dispositionFromTag(entry.tag);
          const isReference = props.referenceKey === entry.item_key;
          const isDirty = disposition !== persistedDisposition;
          const hasProtectionConflict = disposition === "junk" && hasProtectedDispositionEvidence(evidence);
          return (
            <article className={["duplicate-compare-row", isReference ? "reference" : "", isDirty ? "is-dirty" : "", hasProtectionConflict ? "has-protection-conflict" : "", props.openingItemKey === getVaultItemKey(item) ? "pending" : ""].filter(Boolean).join(" ")} style={gridStyle} key={entry.item_key}>
              <label className="duplicate-reference-choice" title={`将实例 ${index + 1} 设为比较基准`}>
                <input type="radio" name={`duplicate-reference-${props.group.group_key}`} checked={isReference} onChange={() => props.onReferenceChange(entry.item_key)} />
                <span>基准</span>
              </label>
              <button type="button" className="duplicate-identity" title={`打开详情：${formatVaultItemMeta(item)}`} onClick={() => props.onOpenItem(item)}>
                <GameAssetImage src={item.icon} alt="" loading="eager" fallback={<span className="duplicate-thumb-fallback">{item.group_key === "armor" ? "甲" : "武"}</span>} />
                <span><strong>实例 {index + 1}</strong><small>{formatInstanceMeta(item)}</small>{isDirty ? <em>状态待应用</em> : null}</span>
              </button>
              {values.map((value, valueIndex) => {
                return (
                  <DuplicateComparisonCell
                    key={`${entry.item_key}-${columns[valueIndex]?.key}`}
                    label={columns[valueIndex]?.label ?? "比较值"}
                    value={value}
                    referenceValue={referenceValues[valueIndex]}
                    isReference={isReference}
                    rollViewMode={selectedSource ? "active" : effectiveRollViewMode}
                  />
                );
              })}
              <div className="duplicate-signals">
                <EvidenceGroup label="实例保护" values={evidence.protection} kind="protection" />
                <EvidenceGroup label="推荐证据" values={evidence.matches} kind="match" />
              </div>
              <div className={["duplicate-decision", isDirty ? "is-dirty" : ""].filter(Boolean).join(" ")} role="group" aria-label={`实例 ${index + 1} 整理状态`}>
                {dispositionOptions.map((option) => <button type="button" key={option.key} data-decision-value={option.key} aria-pressed={disposition === option.key} disabled={option.key === "junk" && hasProtectedDispositionEvidence(evidence)} title={option.key === "junk" && hasProtectedDispositionEvidence(evidence) ? `不能标为清理：${[...evidence.protection, ...evidence.matches].join("、")}` : undefined} onClick={() => updateDisposition(entry.item_key, option.key)}>{option.label}</button>)}
              </div>
            </article>
          );
        })}
      </div>
      <footer className="duplicate-decision-footer">
        <div>
          <div className="duplicate-decision-summary">本组状态：<span>保留 <strong>{summary.keep}</strong></span><span>待定 <strong>{summary.review}</strong></span><span>清理 <strong>{summary.junk}</strong></span><span>未标记 <strong>{summary.none}</strong></span></div>
          <span className={changedCount ? "duplicate-decision-message is-dirty" : "duplicate-decision-message"}>{changedCount ? `${changedCount} 件状态待应用` : "当前显示已应用状态"}</span>
        </div>
        <div className="duplicate-decision-actions">
          <button type="button" data-ui-kind="button" data-control-variant="secondary" disabled={!props.referenceKey || props.isBatchSaving} onClick={keepReferenceReviewRest}>填充：基准保留，其余待定</button>
          <button type="button" data-ui-kind="button" data-control-variant="secondary" disabled={!changedCount || props.isBatchSaving} onClick={() => props.onPendingDispositionChange(savedDisposition)}>撤销待应用</button>
          <button type="button" data-ui-kind="button" data-control-variant="primary" aria-busy={props.isBatchSaving} disabled={!changedCount || props.isBatchSaving} onClick={requestApplyPendingDisposition}>应用本组状态</button>
          <button type="button" data-ui-kind="button" data-control-variant="secondary" disabled={changedCount > 0 || props.isBatchSaving || !props.hasNextPendingGroup} onClick={props.onNextGroup}>下一未整理组</button>
        </div>
      </footer>
      {protectionConflictCount > 0 ? (
        <p className="duplicate-protection-block" data-ui-kind="callout" data-status="warning" role="status">
          {protectionConflictCount} 件装备带实例保护或推荐证据，不能标为清理；已恢复为原状态。请确认后再次应用。
        </p>
      ) : null}
    </section>
  );
}

function hasProtectedDispositionEvidence(evidence: DuplicateEvidence): boolean {
  return evidence.protection.length > 0 || evidence.matches.length > 0;
}

function EvidenceGroup(props: { label: string; values: string[]; kind: "protection" | "match" }) {
  return (
    <div className="duplicate-evidence-group" data-evidence-kind={props.kind}>
      <small>{props.label}</small>
      <span>{props.values.length ? props.values.map((label) => <b className="ui-badge status-neutral" key={label}>{label}</b>) : <em>无</em>}</span>
    </div>
  );
}

function DuplicateComparisonCell(props: {
  label: string;
  value: DuplicateComparisonValue;
  referenceValue?: DuplicateComparisonValue;
  isReference: boolean;
  rollViewMode: "full" | "active";
}) {
  if (props.value.kind === "source") {
    const presentation = props.value.state === "not_covered"
      ? null
      : presentRecommendationSlotMatch(props.value.state, {
          hasInstanceOwned: props.value.instanceOwned.length > 0,
          hasCurrentEnabled: props.value.currentEnabled.length > 0
        });
    const stateLabel = presentation?.label ?? "该来源未收录";
    const sourceNames = props.value.sourceCandidates.join("、") || "来源未列出具体名称";
    const ownedNames = props.value.instanceOwned.join("、") || presentation?.instanceOwnedFallback || "本件未返回";
    const currentNames = props.value.currentEnabled.join("、") || presentation?.currentEnabledFallback || "当前启用项未返回";
    return (
      <div className={`duplicate-cell is-source source-${props.value.state}`} aria-label={`${props.label}：${stateLabel}。来源要求：${sourceNames}。本件拥有：${ownedNames}。当前启用：${currentNames}。`}>
        <small className="duplicate-source-state">{stateLabel}</small>
        <div className="duplicate-source-values">
          <span><small>来源要求</small><b>{sourceNames}</b></span>
          <span><small>本件拥有</small><b>{ownedNames}</b></span>
          <span><small>当前启用</small><b>{currentNames}</b></span>
        </div>
      </div>
    );
  }

  if (props.value.kind === "scalar") {
    const referenceKey = props.referenceValue?.kind === "scalar" ? props.referenceValue.key : undefined;
    const compareState = props.isReference ? "baseline" : referenceKey === props.value.key ? "same" : "different";
    const stateLabel = compareState === "baseline" ? "比较基准" : compareState === "same" ? "与基准相同" : "与基准不同";
    const shortStateLabel = comparisonStateShortLabel(compareState, props.rollViewMode);
    return (
      <div className={`duplicate-cell ${compareState}`} aria-label={`${props.label}：${props.value.text || "未返回"}，${stateLabel}`}>
        <span className="duplicate-cell-value">{props.value.text || "未返回"}</span>
        {shortStateLabel ? <small className="duplicate-compare-state">{shortStateLabel}</small> : null}
      </div>
    );
  }

  const options = visibleRollOptions(props.value.options, props.rollViewMode);
  const referenceOptions = props.referenceValue?.kind === "roll"
    ? visibleRollOptions(props.referenceValue.options, props.rollViewMode)
    : [];
  const optionKeys = new Set(options.map((option) => option.key));
  const referenceKeys = new Set(referenceOptions.map((option) => option.key));
  const sharedCount = options.filter((option) => referenceKeys.has(option.key)).length;
  const samePool = optionKeys.size === referenceKeys.size && [...optionKeys].every((key) => referenceKeys.has(key));
  const compareState = props.isReference ? "baseline" : samePool ? "same" : sharedCount > 0 ? "partial" : "different";
  const stateLabel = compareState === "baseline"
    ? "比较基准"
    : compareState === "same"
      ? "与基准相同"
      : compareState === "partial"
        ? "与基准部分重合"
        : "与基准完全不同";
  const optionNames = options.map((option) => option.text).join("、") || "未返回";
  const shortStateLabel = comparisonStateShortLabel(compareState, props.rollViewMode);

  return (
    <div className={`duplicate-cell is-roll ${compareState}`} aria-label={`${props.label}：${optionNames}，${stateLabel}`}>
      {shortStateLabel ? <small className="duplicate-compare-state">{shortStateLabel}</small> : null}
      <div className="duplicate-roll-options">
        {options.length ? options.map((option) => {
          const isExtra = !props.isReference && !referenceKeys.has(option.key);
          return (
            <span className={["duplicate-roll-option", option.selected ? "is-selected" : "", option.canSwitch ? "can-switch" : "", isExtra ? "is-extra" : ""].filter(Boolean).join(" ")} key={option.key}>
              {option.icon ? <GameAssetImage className="game-definition-icon duplicate-roll-option-icon" src={option.icon} alt="" loading="eager" /> : <i className="duplicate-roll-option-icon" aria-hidden="true" />}
              <span className="duplicate-roll-option-copy" title={option.text}>
                <b>{option.text}</b>
                {isExtra ? <small>仅此实例</small> : null}
              </span>
              <em>{option.selected ? "当前" : option.canSwitch ? "可切换" : "已拥有"}</em>
            </span>
          );
        }) : <span className="duplicate-roll-empty">未返回</span>}
      </div>
    </div>
  );
}

function comparisonStateShortLabel(
  state: "baseline" | "same" | "partial" | "different",
  rollViewMode: "full" | "active"
): string | undefined {
  if (state === "baseline") return undefined;
  if (state === "same") return "相同";
  if (state === "partial") return "部分重合";
  return rollViewMode === "full" ? "完全不同" : "不同";
}

function visibleRollOptions(options: DuplicateRollOption[], mode: "full" | "active"): DuplicateRollOption[] {
  if (mode === "full") return options;
  return options.filter((option) => option.selected);
}

function buildComparisonColumns(items: AccountItemSummary[]): DuplicateComparisonColumn[] {
  if (items[0]?.group_key === "armor") {
    const armorColumns: Array<{ key: "total" | "health" | "melee" | "grenade" | "super" | "class" | "weapon"; label: string }> = [
      { key: "total", label: "总值" },
      { key: "health", label: "生命" },
      { key: "melee", label: "近战" },
      { key: "grenade", label: "手雷" },
      { key: "super", label: "超能" },
      { key: "class", label: "职业" },
      { key: "weapon", label: "武器" }
    ];
    return armorColumns.map((column) => ({
      key: column.key,
      label: column.label,
      kind: "scalar" as const,
      valueFor: (item) => {
        const value = item.armor_stats?.[column.key];
        return { kind: "scalar" as const, key: value === undefined ? "missing" : String(value), text: value === undefined ? "" : String(value) };
      }
    }));
  }

  const socketsByItem = new Map<AccountItemSummary, Map<number, DuplicateRollSocket>>();
  const plugsBySocket = new Map<number, AccountItemPlugSummary[]>();
  for (const item of items) {
    const sockets = weaponRollSockets(item);
    socketsByItem.set(item, new Map(sockets.map((socket) => [socket.socketIndex, socket])));
    for (const socket of sockets) {
      plugsBySocket.set(socket.socketIndex, [...(plugsBySocket.get(socket.socketIndex) ?? []), ...socket.plugs]);
    }
  }

  const sortedSockets = [...plugsBySocket.entries()].sort(([left], [right]) => left - right);
  let traitIndex = 0;
  const columns = sortedSockets.map(([socketIndex, plugs]) => {
    const role: WeaponPerkColumnRole = classifyWeaponSocketPlugs(plugs) ?? "other";
    const label = role === "trait" ? `Perk ${++traitIndex}` : weaponSocketColumnLabel(plugs, role, socketIndex);
    return {
      key: `socket-${socketIndex}`,
      label,
      kind: "roll" as const,
      valueFor: (item: AccountItemSummary) => {
        const options = socketsByItem.get(item)?.get(socketIndex)?.options ?? [];
        return {
          kind: "roll" as const,
          key: options.map((option) => option.key).sort().join(",") || "missing",
          options
        };
      }
    };
  });

  return columns;
}

const recommendationSlotOrder: RecommendationRequirementSlot[] = [
  "perk1",
  "perk2",
  "barrel",
  "magazine",
  "masterwork",
  "origin"
];

function buildDuplicateSourceOptions(
  items: AccountItemSummary[],
  recommendationSummaryByInstance?: VaultRecommendationSummaryIndex
): DuplicateSourceOption[] {
  const options = new Map<string, DuplicateSourceOption>();
  for (const item of items) {
    const sourceSummaries = recommendationSummaryByInstance?.get(getVaultCommunityInstanceKey(item)) ?? [];
    for (const source of sourceSummaries) {
      if (source.sourceId === "dim_wishlist" || source.sourceId === "dim_voltron") continue;
      if (options.has(source.sourceId)) continue;
      options.set(source.sourceId, {
        sourceId: source.sourceId,
        sourceLabel: displayVaultRecommendationSourceLabel(source.sourceId, source.sourceLabel)
      });
    }
  }
  return [...options.values()].sort((left, right) => (
    duplicateSourceOrder(left.sourceId) - duplicateSourceOrder(right.sourceId)
    || left.sourceLabel.localeCompare(right.sourceLabel, "zh-Hans-CN")
  ));
}

function buildSourceComparisonColumns(
  items: AccountItemSummary[],
  sourceId: string,
  instanceMatchMap?: Map<string, VaultItemInstanceMatchInfo>
): DuplicateComparisonColumn[] {
  const sources = items.map((item) => sourceMatchForItem(item, sourceId, instanceMatchMap));
  return recommendationSlotOrder.flatMap((slot) => {
    const slotMatches = sources.flatMap((source) => source?.slots.find((entry) => entry.slot === slot) ?? []);
    const specified = slotMatches.find((entry) => entry.state !== "source_not_specified");
    if (!specified) return [];
    return [{
      key: `source-${sourceId}-${slot}`,
      label: specified.label,
      kind: "source" as const,
      valueFor: (item: AccountItemSummary): DuplicateComparisonValue => {
        const source = sourceMatchForItem(item, sourceId, instanceMatchMap);
        const slotMatch = source?.slots.find((entry) => entry.slot === slot);
        if (!source || !slotMatch) {
          return {
            kind: "source",
            key: "not_covered",
            state: "not_covered",
            sourceCandidates: uniqueText(slotMatches.flatMap(sourceCandidateNames)),
            instanceOwned: [],
            currentEnabled: []
          };
        }
        return {
          kind: "source",
          key: `${slotMatch.state}:${slotMatch.instance_owned.map((plug) => plug.hash).join(",")}`,
          state: slotMatch.state,
          sourceCandidates: sourceCandidateNames(slotMatch),
          instanceOwned: uniqueText(slotMatch.instance_owned.map((plug) => plug.name)),
          currentEnabled: uniqueText(slotMatch.current_enabled.map((plug) => plug.name))
        };
      }
    }];
  });
}

function sourceMatchForItem(
  item: AccountItemSummary,
  sourceId: string,
  instanceMatchMap?: Map<string, VaultItemInstanceMatchInfo>
): RecommendationSourceMatch | undefined {
  return instanceMatchMap
    ?.get(getVaultCommunityInstanceKey(item))
    ?.source_matches
    ?.find((source) => source.source_id === sourceId);
}

function sourceCandidateNames(slot: RecommendationSourceSlotMatch): string[] {
  return uniqueText([
    ...slot.source_candidate_names,
    ...slot.source_candidates.map((candidate) => candidate.name),
    ...slot.unresolved_source_candidate_names
  ]);
}

function uniqueText(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function duplicateSourceOrder(sourceId: string): number {
  if (sourceId === "aegis") return 0;
  if (sourceId === "lgpig") return 1;
  if (sourceId === "yxcrallxy") return 2;
  if (sourceId === "sayalarry") return 3;
  if (sourceId === "dim_voltron" || sourceId === "dim_wishlist") return 4;
  return 99;
}

function weaponRollSockets(item: AccountItemSummary): DuplicateRollSocket[] {
  if (item.sockets?.length) {
    return item.sockets.flatMap((socket) => {
      if (!socket.is_visible) return [];
      const optionsByHash = new Map<number, DuplicateRollOption>();
      const plugsByHash = new Map<number, AccountItemPlugSummary>();

      const addOption = (plug: AccountItemPlugSummary, selected: boolean, canSwitch: boolean) => {
        if (isWeaponSystemPlug(plug)) return;
        plugsByHash.set(plug.hash, plug);
        const existing = optionsByHash.get(plug.hash);
        if (existing) {
          existing.selected ||= selected;
          existing.canSwitch ||= canSwitch;
          return;
        }
        optionsByHash.set(plug.hash, {
          key: String(plug.hash),
          text: plug.name,
          icon: plug.icon,
          selected,
          canSwitch
        });
      };

      if (socket.selected_plug) addOption(socket.selected_plug, true, false);
      for (const plug of socket.reusable_plugs.filter(isInstanceReusablePlug)) {
        addOption(plug, plug.selected || plug.hash === socket.selected_plug?.hash, canSwitchReusablePlug(plug));
      }

      const options = [...optionsByHash.values()].sort((left, right) => (
        Number(right.selected) - Number(left.selected)
        || Number(right.canSwitch) - Number(left.canSwitch)
        || left.text.localeCompare(right.text)
      ));
      return options.length ? [{ socketIndex: socket.socket_index, plugs: [...plugsByHash.values()], options }] : [];
    });
  }

  return item.socket_plugs.flatMap((plug, socketIndex) => isWeaponSystemPlug(plug) ? [] : [{
    socketIndex,
    plugs: [plug],
    options: [{ key: String(plug.hash), text: plug.name, icon: plug.icon, selected: true, canSwitch: false }]
  }]);
}

function isInstanceReusablePlug(plug: AccountItemReusablePlugSummary): boolean {
  return plug.sources.includes("instance") && !isWeaponSystemPlug(plug);
}

function canSwitchReusablePlug(plug: AccountItemReusablePlugSummary): boolean {
  return plug.can_insert === true
    && plug.enabled !== false
    && plug.insert_fail_indexes.length === 0
    && plug.enable_fail_indexes.length === 0;
}

function getGroupRollDataStatus(
  group: DuplicateItemGroup | undefined,
  itemByKey: Map<string, AccountItemSummary>,
  detailByItemKey: Record<string, AccountItemSummary>,
  loadStatusByItemKey: Record<string, "loading" | "ready" | "error">,
  canLoadDetails: boolean,
  requested: boolean
): "idle" | "ready" | "loading" | "error" | "unavailable" {
  if (!group) return "unavailable";
  const items = group.items.flatMap((entry) => {
    const sourceItem = itemByKey.get(entry.item_key);
    if (!sourceItem) return [];
    const cacheKey = rollDetailCacheKey(entry.item_key, sourceItem);
    const item = detailByItemKey[cacheKey] ?? sourceItem;
    return item.group_key === "weapons" ? [{ key: cacheKey, item }] : [];
  });
  if (!items.length) return "ready";
  if (items.every(({ item }) => item.sockets !== undefined)) return "ready";
  if (items.some(({ key }) => loadStatusByItemKey[key] === "error")) return "error";
  if (!canLoadDetails || items.some(({ item }) => !item.instance_id)) return "unavailable";
  if (!requested) return "idle";
  return "loading";
}

function getGroupRollDataProgress(
  group: DuplicateItemGroup | undefined,
  itemByKey: Map<string, AccountItemSummary>,
  detailByItemKey: Record<string, AccountItemSummary>
): { ready: number; total: number } {
  if (!group) return { ready: 0, total: 0 };
  const items = group.items.flatMap((entry) => {
    const sourceItem = itemByKey.get(entry.item_key);
    if (!sourceItem) return [];
    const item = detailByItemKey[rollDetailCacheKey(entry.item_key, sourceItem)] ?? sourceItem;
    return item.group_key === "weapons" ? [item] : [];
  });
  return {
    ready: items.filter((item) => item.sockets !== undefined).length,
    total: items.length
  };
}

function rollDetailCacheKey(itemKey: string, item: AccountItemSummary): string {
  return `${itemKey}\u0000${item.weapon_roll?.fingerprint?.trim() || "unknown-roll"}`;
}

function itemEvidence(item: AccountItemSummary, props: {
  recommendationSummaryByInstance?: VaultRecommendationSummaryIndex;
  localTargetRules?: LocalTargetRules | null;
  equipmentTargetStore?: EquipmentTargetStore | null;
  highlightedItemKeys?: LoadoutTemplateLookup | null;
  cleanupProtectionByItemKey?: Map<string, string[]>;
}): DuplicateEvidence {
  const target = evaluateLocalTargets(normalizeCoreItem(item), props.localTargetRules ?? undefined);
  const equipmentTarget = evaluateEquipmentTargets(normalizeCoreItem(item), props.equipmentTargetStore ?? undefined);
  const sourceSummaries = item.group_key === "weapons"
    ? props.recommendationSummaryByInstance?.get(getVaultCommunityInstanceKey(item)) ?? []
    : [];
  const exactLoadoutMatch = Boolean(item.instance_id && props.highlightedItemKeys?.instanceIds.has(item.instance_id));
  const sameDefinitionLoadoutMatch = !exactLoadoutMatch && Boolean(
    props.highlightedItemKeys?.bucketHashKeys.has(`${item.bucket_name ?? ""}:${item.hash}`)
    || props.highlightedItemKeys?.hashKeys.has(item.hash)
  );
  return {
    protection: [...new Set([
      ...(props.cleanupProtectionByItemKey?.get(getVaultCommunityInstanceKey(item)) ?? []),
      item.locked ? "已锁定" : "",
      exactLoadoutMatch ? "配装实例" : ""
    ].filter(Boolean))],
    matches: [
      sameDefinitionLoadoutMatch ? "配装同款" : "",
      equipmentTarget.matched || target.matched ? "目标命中" : "",
      ...sourceSummaries
        .filter((summary) => summary.state === "full" || summary.state === "core")
        .map((summary) => summary.text)
    ].filter(Boolean)
  };
}

function summarizeGroupEvidence(
  group: DuplicateItemGroup,
  evidenceByItemKey: ReadonlyMap<string, DuplicateEvidence>
): { protectedItems: number; matchedItems: number } {
  return group.items.reduce((summary, entry) => {
    const evidence = evidenceByItemKey.get(entry.item_key);
    if (!evidence) return summary;
    if (evidence.protection.length) summary.protectedItems += 1;
    if (evidence.matches.length) summary.matchedItems += 1;
    return summary;
  }, { protectedItems: 0, matchedItems: 0 });
}

function formatInstanceMeta(item: AccountItemSummary): string {
  return [
    item.bucket_name,
    item.power !== undefined ? `光等 ${item.power}` : undefined,
    item.instance?.is_equipped ? "已装备" : undefined,
    item.locked ? "已锁定" : "未锁定",
    item.instance_id ? `#${item.instance_id.slice(-6)}` : undefined
  ].filter(Boolean).join(" · ") || "实例信息未返回";
}

function groupKindLabel(group: DuplicateItemGroup): string {
  return group.hash ? "同一版本" : "同名不同版本";
}

function defaultReferenceKey(group: DuplicateItemGroup): string {
  return group.items.find((entry) => dispositionFromTag(entry.tag) === "keep")?.item_key
    ?? group.items[0]?.item_key
    ?? "";
}

function dispositionFromTag(tag?: string): DuplicateDisposition {
  return tag === "keep" || tag === "review" || tag === "junk" ? tag : "none";
}

function summarizeGroupDisposition(group: DuplicateItemGroup, pendingDisposition?: Record<string, DuplicateDisposition>): Record<DuplicateDisposition, number> {
  return group.items.reduce<Record<DuplicateDisposition, number>>((summary, entry) => {
    summary[pendingDisposition?.[entry.item_key] ?? dispositionFromTag(entry.tag)] += 1;
    return summary;
  }, { none: 0, keep: 0, review: 0, junk: 0 });
}

function isGroupPersistedComplete(group: DuplicateItemGroup): boolean {
  return group.items.every((entry) => dispositionFromTag(entry.tag) !== "none");
}

function hasGroupPendingChanges(group: DuplicateItemGroup, pendingDisposition?: Record<string, DuplicateDisposition>): boolean {
  if (!pendingDisposition) return false;
  return group.items.some((entry) => (pendingDisposition[entry.item_key] ?? "none") !== dispositionFromTag(entry.tag));
}

/**
 * 以固定并发运行批量任务。任务按传入顺序排队，单个任务失败不会阻塞后续实例。
 * 返回 promise 仅用于让 effect 保持可追踪，不暴露内部请求结果。
 */
async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (!items.length) return;
  const limit = Math.max(1, Math.min(concurrency, items.length));
  let nextIndex = 0;
  const runWorker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      const item = items[index];
      if (item === undefined) return;
      try {
        await worker(item);
      } catch {
        // worker 自己负责更新实例状态；这里吞掉异常以继续读取队列。
      }
    }
  };
  await Promise.all(Array.from({ length: limit }, () => runWorker()));
}
