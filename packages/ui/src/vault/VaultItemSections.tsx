import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { AccountItemSummary } from "@d2-tools/core/account/summary";
import type { VaultTags, VaultTagValue } from "@d2-tools/core/vault/tags";
import { matchesLoadoutTemplateItem, type LoadoutTemplateLookup } from "@d2-tools/app/loadouts";
import type { VaultSection } from "@d2-tools/app/vault";
import { MemoizedVaultListItem as VaultListItem } from "./VaultListItem.js";
import { getVaultItemKey } from "@d2-tools/app/vault";
import {
  canonicalVaultRecommendationSourceId,
  selectVaultRecommendationSourceSummaries,
  type VaultRecommendationSummaryIndex
} from "./vaultRecommendationMatch.js";
import { VaultVirtualWeaponGrid } from "./VaultVirtualWeaponGrid.js";

export const INITIAL_VAULT_RENDER_LIMIT = 200;
const VAULT_RENDER_INCREMENT = 200;

export function VaultItemSections(props: {
  sections: VaultSection[];
  highlightedItemKeys?: LoadoutTemplateLookup | null;
  tags: VaultTags;
  recommendationSummaryByInstance?: VaultRecommendationSummaryIndex;
  preferredRecommendationSourceId?: string;
  isOrganizing: boolean;
  isSearchActive: boolean;
  selectedKeys: Set<string>;
  openingItemKey?: string;
  currentCharacterId?: string;
  currentCharacterLabel?: string;
  activeQuickAction?: { itemKey: string; action: "lock" | "transfer" } | null;
  quickActionsDisabled?: boolean;
  focusRequest?: { itemKey: string; requestId: number } | null;
  emptyMessage?: string;
  onSelectItem: (item: AccountItemSummary) => void;
  onToggleSelected: (item: AccountItemSummary) => void;
  onQuickAction?: (item: AccountItemSummary, action: "lock" | "transfer") => void | Promise<void>;
}) {
  const sectionListRef = useRef<HTMLDivElement>(null);
  const totalItemCount = useMemo(
    () => props.sections.reduce((total, section) => total + section.items.length, 0),
    [props.sections]
  );
  const [visibleItemLimit, setVisibleItemLimit] = useState(INITIAL_VAULT_RENDER_LIMIT);
  useEffect(() => {
    setVisibleItemLimit(INITIAL_VAULT_RENDER_LIMIT);
  }, [props.sections]);
  const effectiveVisibleItemLimit = visibleItemLimit;
  const renderedSections = useMemo(() => {
    let remaining = effectiveVisibleItemLimit;
    return props.sections.flatMap((section) => {
      if (remaining <= 0) {
        return [];
      }
      const items = section.items.slice(0, remaining);
      remaining -= items.length;
      return items.length ? [{ ...section, items }] : [];
    });
  }, [props.sections, effectiveVisibleItemLimit]);
  const renderedItemCount = Math.min(effectiveVisibleItemLimit, totalItemCount);
  const allItems = useMemo(
    () => props.sections.flatMap((section) => section.items),
    [props.sections]
  );
  const isWeaponOnly = allItems.length > 0 && allItems.every((item) => item.group_key === "weapons");
  const renderedItems = useMemo(
    () => renderedSections.flatMap((section) => section.items),
    [renderedSections]
  );
  const buildCardItem = useCallback((item: AccountItemSummary) => {
    const sourceRuleSummaries = item.group_key === "weapons"
      ? props.recommendationSummaryByInstance?.get(item.instance_id ?? `hash:${item.hash}`) ?? []
      : [];
    const allSourceSummaries = selectVaultRecommendationSourceSummaries(sourceRuleSummaries);
    const orderedSourceSummaries = props.preferredRecommendationSourceId
      ? [...allSourceSummaries].sort((left, right) => (
          Number(canonicalVaultRecommendationSourceId(right.sourceId) === canonicalVaultRecommendationSourceId(props.preferredRecommendationSourceId ?? ""))
          - Number(canonicalVaultRecommendationSourceId(left.sourceId) === canonicalVaultRecommendationSourceId(props.preferredRecommendationSourceId ?? ""))
        ))
      : allSourceSummaries;
    const tagValue: VaultTagValue = props.tags.items[getVaultItemKey(item)]?.tag ?? "none";
    return {
      item,
      tagValue,
      isLoadoutMatch: matchesLoadoutTemplateItem(item, props.highlightedItemKeys),
      sourceSummaries: orderedSourceSummaries.slice(0, 3),
      additionalSourceCount: Math.max(0, allSourceSummaries.length - 3)
    };
  }, [props.highlightedItemKeys, props.preferredRecommendationSourceId, props.recommendationSummaryByInstance, props.tags]);
  const onSelectItemRef = useRef(props.onSelectItem);
  const onToggleSelectedRef = useRef(props.onToggleSelected);
  const onQuickActionRef = useRef(props.onQuickAction);
  onSelectItemRef.current = props.onSelectItem;
  onToggleSelectedRef.current = props.onToggleSelected;
  onQuickActionRef.current = props.onQuickAction;
  const handleSelectItem = useCallback((item: AccountItemSummary) => onSelectItemRef.current(item), []);
  const handleToggleSelected = useCallback((item: AccountItemSummary) => onToggleSelectedRef.current(item), []);
  const handleQuickAction = useCallback((item: AccountItemSummary, action: "lock" | "transfer") => onQuickActionRef.current?.(item, action), []);
  const renderCard = useCallback((item: AccountItemSummary, index: number) => {
    const { tagValue, isLoadoutMatch, sourceSummaries, additionalSourceCount } = buildCardItem(item);
    return (
      <VaultListItem
        item={item}
        key={`${item.hash}-${item.instance_id ?? ""}`}
        imagePriority={index < 40}
        tagValue={tagValue}
        isLoadoutMatch={isLoadoutMatch}
        sourceSummaries={sourceSummaries}
        additionalSourceCount={additionalSourceCount}
        isOrganizing={props.isOrganizing}
        isSelected={props.selectedKeys.has(getVaultItemKey(item))}
        isOpening={props.openingItemKey === getVaultItemKey(item)}
        currentCharacterId={props.currentCharacterId}
        currentCharacterLabel={props.currentCharacterLabel}
        activeQuickAction={props.activeQuickAction}
        quickActionsDisabled={props.quickActionsDisabled}
        onSelectItem={handleSelectItem}
        onToggleSelected={handleToggleSelected}
        onQuickAction={handleQuickAction}
      />
    );
  }, [buildCardItem, handleQuickAction, handleSelectItem, handleToggleSelected, props.activeQuickAction, props.currentCharacterId, props.currentCharacterLabel, props.isOrganizing, props.openingItemKey, props.quickActionsDisabled, props.selectedKeys]);

  useLayoutEffect(() => {
    if (isWeaponOnly || !props.focusRequest) return;
    const cards = [...(sectionListRef.current?.querySelectorAll<HTMLElement>("[data-vault-item-key]") ?? [])];
    const card = cards.find((candidate) => candidate.dataset.vaultItemKey === props.focusRequest?.itemKey)
      ?? cards[cards.length - 1];
    card?.querySelector<HTMLElement>(".vault-card-main")?.focus({ preventScroll: true });
  }, [isWeaponOnly, props.focusRequest]);

  if (!props.sections.length) {
    return <p className="status-message status-neutral">{props.emptyMessage ?? "没有匹配的仓库物品。"}</p>;
  }

  return (
    <div ref={sectionListRef} className="vault-section-list">
      {!isWeaponOnly && totalItemCount > INITIAL_VAULT_RENDER_LIMIT ? (
        <div className="vault-render-limit-message">
          <span>{props.isSearchActive ? "搜索结果" : "当前范围"}先显示 {renderedItemCount} / {totalItemCount} 件，避免一次挂载全部装备。</span>
          {renderedItemCount < totalItemCount ? (
            <button
              data-ui-kind="button" data-control-variant="secondary"
              type="button"
              onClick={() => setVisibleItemLimit((current) => current + VAULT_RENDER_INCREMENT)}
            >
              加载更多
            </button>
          ) : null}
        </div>
      ) : null}
      {isWeaponOnly ? (
        <VaultVirtualWeaponGrid
          items={allItems}
          className="vault-card-grid-weapons"
          focusRequest={props.focusRequest}
          getItemKey={getVaultItemKey}
          renderItem={renderCard}
        />
      ) : (
        <div className={`vault-card-grid ${vaultGridClass(renderedItems)}`}>
          {renderedItems.map(renderCard)}
        </div>
      )}
    </div>
  );
}

function vaultGridClass(items: AccountItemSummary[]): string {
  if (items.length && items.every((item) => item.group_key === "weapons")) return "vault-card-grid-weapons";
  if (items.length && items.every((item) => item.group_key === "armor")) return "vault-card-grid-armor";
  return "vault-card-grid-mixed";
}
