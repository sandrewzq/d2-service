import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import type { VaultQuickActionStore } from "./vaultQuickActionStore.js";
import {
  useVaultItemCollectionItem,
  type VaultItemCollectionStore
} from "./vaultItemCollectionStore.js";

export const INITIAL_VAULT_RENDER_LIMIT = 200;
const VAULT_RENDER_INCREMENT = 200;

export function VaultItemSections(props: {
  sections: VaultSection[];
  itemCollectionStore: VaultItemCollectionStore;
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
  quickActionStore: VaultQuickActionStore;
  quickActionsDisabled?: boolean;
  focusRequest?: { itemKey: string; requestId: number } | null;
  emptyMessage?: string;
  onSelectItem: (item: AccountItemSummary) => void;
  onToggleSelected: (item: AccountItemSummary) => void;
  onQuickAction?: (item: AccountItemSummary, action: "lock" | "unlock" | "transfer") => void | Promise<void>;
}) {
  const sectionListRef = useRef<HTMLDivElement>(null);
  const handledFocusRequestIdRef = useRef<number | null>(null);
  const totalItemCount = useMemo(
    () => props.sections.reduce((total, section) => total + section.items.length, 0),
    [props.sections]
  );
  const [visibleItemLimit, setVisibleItemLimit] = useState(INITIAL_VAULT_RENDER_LIMIT);
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
  const canUseKeyedWeaponGrid = isWeaponOnly && allItems.every((item) => Boolean(item.instance_id));
  const renderedItems = useMemo(
    () => renderedSections.flatMap((section) => section.items),
    [renderedSections]
  );
  const allItemKeys = useStableItemKeys(allItems);
  const renderedItemKeys = useStableItemKeys(renderedItems);
  useEffect(() => {
    setVisibleItemLimit(INITIAL_VAULT_RENDER_LIMIT);
  }, [allItemKeys]);
  const onSelectItemRef = useRef(props.onSelectItem);
  const onToggleSelectedRef = useRef(props.onToggleSelected);
  const onQuickActionRef = useRef(props.onQuickAction);
  onSelectItemRef.current = props.onSelectItem;
  onToggleSelectedRef.current = props.onToggleSelected;
  onQuickActionRef.current = props.onQuickAction;
  const handleSelectItem = useCallback((item: AccountItemSummary) => onSelectItemRef.current(item), []);
  const handleToggleSelected = useCallback((item: AccountItemSummary) => onToggleSelectedRef.current(item), []);
  const handleQuickAction = useCallback((item: AccountItemSummary, action: "lock" | "unlock" | "transfer") => onQuickActionRef.current?.(item, action), []);
  const renderCard = useCallback((itemKey: string, index: number, fallbackItem?: AccountItemSummary) => {
    return (
      <VaultItemCard
        itemKey={itemKey}
        itemCollectionStore={props.itemCollectionStore}
        fallbackItem={fallbackItem}
        key={fallbackItem ? `${itemKey}:${index}` : itemKey}
        imagePriority={index < 40}
        highlightedItemKeys={props.highlightedItemKeys}
        tags={props.tags}
        recommendationSummaryByInstance={props.recommendationSummaryByInstance}
        preferredRecommendationSourceId={props.preferredRecommendationSourceId}
        isOrganizing={props.isOrganizing}
        isSelected={props.selectedKeys.has(itemKey)}
        isOpening={props.openingItemKey === itemKey}
        currentCharacterId={props.currentCharacterId}
        currentCharacterLabel={props.currentCharacterLabel}
        quickActionStore={props.quickActionStore}
        quickActionsDisabled={props.quickActionsDisabled}
        onSelectItem={handleSelectItem}
        onToggleSelected={handleToggleSelected}
        onQuickAction={handleQuickAction}
      />
    );
  }, [handleQuickAction, handleSelectItem, handleToggleSelected, props.currentCharacterId, props.currentCharacterLabel, props.highlightedItemKeys, props.isOrganizing, props.itemCollectionStore, props.openingItemKey, props.preferredRecommendationSourceId, props.quickActionStore, props.quickActionsDisabled, props.recommendationSummaryByInstance, props.selectedKeys, props.tags]);
  const renderStoredCard = useCallback(
    (itemKey: string, index: number) => renderCard(itemKey, index),
    [renderCard]
  );

  useLayoutEffect(() => {
    if (canUseKeyedWeaponGrid || !props.focusRequest) return;
    if (handledFocusRequestIdRef.current === props.focusRequest.requestId) return;
    handledFocusRequestIdRef.current = props.focusRequest.requestId;
    const cards = [...(sectionListRef.current?.querySelectorAll<HTMLElement>("[data-vault-item-key]") ?? [])];
    const card = cards.find((candidate) => candidate.dataset.vaultItemKey === props.focusRequest?.itemKey)
      ?? cards[cards.length - 1];
    card?.querySelector<HTMLElement>(".vault-card-main")?.focus({ preventScroll: true });
  }, [canUseKeyedWeaponGrid, props.focusRequest]);

  if (!props.sections.length) {
    return <p className="status-message status-neutral">{props.emptyMessage ?? "没有匹配的仓库物品。"}</p>;
  }

  return (
    <div ref={sectionListRef} className="vault-section-list">
      {!canUseKeyedWeaponGrid && totalItemCount > INITIAL_VAULT_RENDER_LIMIT ? (
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
      {canUseKeyedWeaponGrid ? (
        <VaultVirtualWeaponGrid
          itemKeys={allItemKeys}
          className="vault-card-grid-weapons"
          focusRequest={props.focusRequest}
          renderItem={renderStoredCard}
        />
      ) : (
        <div className={`vault-card-grid ${vaultGridClass(renderedItems)}`}>
          {renderedItems.map((item, index) => renderCard(
            renderedItemKeys[index] ?? getVaultItemKey(item),
            index,
            item.instance_id ? undefined : item
          ))}
        </div>
      )}
    </div>
  );
}

const VaultItemCard = memo(function VaultItemCard(props: {
  itemKey: string;
  itemCollectionStore: VaultItemCollectionStore;
  fallbackItem?: AccountItemSummary;
  highlightedItemKeys?: LoadoutTemplateLookup | null;
  tags: VaultTags;
  recommendationSummaryByInstance?: VaultRecommendationSummaryIndex;
  preferredRecommendationSourceId?: string;
  imagePriority?: boolean;
  isOrganizing: boolean;
  isSelected: boolean;
  isOpening?: boolean;
  currentCharacterId?: string;
  currentCharacterLabel?: string;
  quickActionStore: VaultQuickActionStore;
  quickActionsDisabled?: boolean;
  onSelectItem: (item: AccountItemSummary) => void;
  onToggleSelected: (item: AccountItemSummary) => void;
  onQuickAction?: (item: AccountItemSummary, action: "lock" | "unlock" | "transfer") => void | Promise<void>;
}) {
  const storedItem = useVaultItemCollectionItem(props.itemCollectionStore, props.itemKey);
  const item = props.fallbackItem ?? storedItem;
  if (!item) return null;
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
  const tagValue: VaultTagValue = props.tags.items[props.itemKey]?.tag ?? "none";
  return (
    <VaultListItem
      item={item}
      imagePriority={props.imagePriority}
      tagValue={tagValue}
      isLoadoutMatch={matchesLoadoutTemplateItem(item, props.highlightedItemKeys)}
      sourceSummaries={orderedSourceSummaries.slice(0, 3)}
      additionalSourceCount={Math.max(0, allSourceSummaries.length - 3)}
      isOrganizing={props.isOrganizing}
      isSelected={props.isSelected}
      isOpening={props.isOpening}
      currentCharacterId={props.currentCharacterId}
      currentCharacterLabel={props.currentCharacterLabel}
      quickActionStore={props.quickActionStore}
      quickActionsDisabled={props.quickActionsDisabled}
      onSelectItem={props.onSelectItem}
      onToggleSelected={props.onToggleSelected}
      onQuickAction={props.onQuickAction}
    />
  );
});

function useStableItemKeys(items: readonly AccountItemSummary[]): string[] {
  const previousKeysRef = useRef<string[]>([]);
  return useMemo(() => {
    const nextKeys = items.map(getVaultItemKey);
    if (sameItemKeys(previousKeysRef.current, nextKeys)) return previousKeysRef.current;
    previousKeysRef.current = nextKeys;
    return nextKeys;
  }, [items]);
}

function sameItemKeys(previous: readonly string[], next: readonly string[]): boolean {
  return previous.length === next.length
    && previous.every((itemKey, index) => itemKey === next[index]);
}

function vaultGridClass(items: AccountItemSummary[]): string {
  if (items.length && items.every((item) => item.group_key === "weapons")) return "vault-card-grid-weapons";
  if (items.length && items.every((item) => item.group_key === "armor")) return "vault-card-grid-armor";
  return "vault-card-grid-mixed";
}
