import type { VaultTags } from "../../../api/types";
import {
  buildVaultDuplicateSummary,
  type buildDuplicateGroupBatchTagPlan
} from "../../domain/vault/vaultCleanup";
import {
  getItemKey,
  sortSameNameItems,
  type SameNameItemSummary,
  type SelectedItemDetail,
  type SelectedItemSource
} from "@d2-tools/app/items";
import { formatAccountItemMeta, formatArmorStatsSummary } from "./itemDetailFormatters";
import { formatVaultTagLabel } from "./itemDetailFormatters";

export type ItemDetailSameNameProps = {
  sameNameItems: SameNameItemSummary[];
  selectedItem: SelectedItemDetail;
  vaultTags: VaultTags;
  onApplySameNameBatchTags: (
    items: SameNameItemSummary[],
    mode: Parameters<typeof buildDuplicateGroupBatchTagPlan>[1]
  ) => void;
  onApplySameNameCurrentKeepTags: (
    items: SameNameItemSummary[],
    currentItemKey: string,
    mode: "keep-current-review-rest" | "keep-current-junk-rest"
  ) => void;
  onOpenBestSameNameItem: (items: SameNameItemSummary[]) => void;
  onOpenItemDetail: (item: SameNameItemSummary, source: SelectedItemSource) => void;
};

export function ItemDetailSameName(props: ItemDetailSameNameProps) {
  if (props.sameNameItems.length <= 1) {
    return null;
  }

  const sameNameDuplicateGroup = buildVaultDuplicateSummary(props.sameNameItems, props.vaultTags).groups[0];
  const sortedSameNameItems = sortSameNameItems(props.sameNameItems, props.selectedItem.item_key);

  return (
    <section className="modal-perk-group">
      <h3>同名对比</h3>
      <div className="same-roll-summary" aria-label="同名装备摘要">
        <span className="same-roll-chip">同名共 {props.sameNameItems.length} 件</span>
        <span className="same-roll-chip">当前装备优先展示</span>
        <span className="same-roll-chip">标记：{formatVaultTagLabel(props.vaultTags.items[props.selectedItem.item_key]?.tag ?? "none")}</span>
      </div>
      {sameNameDuplicateGroup ? (
        <div className="button-row">
          <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={() => props.onOpenBestSameNameItem(sortedSameNameItems)}>
            打开推荐同名
          </button>
          <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={() => props.onApplySameNameCurrentKeepTags(props.sameNameItems, props.selectedItem.item_key, "keep-current-review-rest")}>
            保留当前，其余待定
          </button>
          <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={() => props.onApplySameNameCurrentKeepTags(props.sameNameItems, props.selectedItem.item_key, "keep-current-junk-rest")}>
            保留当前，其余清理
          </button>
          <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={() => props.onApplySameNameBatchTags(props.sameNameItems, "keep-best-review-rest")}>
            其余标记待定
          </button>
          <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={() => props.onApplySameNameBatchTags(props.sameNameItems, "keep-best-junk-rest")}>
            其余标记为清理
          </button>
          <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={() => props.onApplySameNameBatchTags(props.sameNameItems, "clear-group-tags")}>
            清除本组标记
          </button>
        </div>
      ) : null}
      <div className="same-roll-list">
        {sortedSameNameItems.map((item) => {
          const isCurrent = getItemKey(item) === props.selectedItem.item_key;
          const tag = props.vaultTags.items[getItemKey(item)]?.tag ?? "none";
          return (
            <button
              type="button"
              className={isCurrent ? "same-roll-row current" : "same-roll-row"}
              key={getItemKey(item)}
              onClick={() => props.onOpenItemDetail(item, {
                source_character_id: item.source_character_id,
                is_vault_item: item.is_vault_item,
                is_postmaster_item: item.is_postmaster_item
              })}
            >
              <div className="same-roll-row-heading">
                <strong>{item.name}</strong>
                <span className="same-roll-chip">{isCurrent ? "当前装备" : "同名装备"}</span>
                <span className="same-roll-chip">标记：{formatVaultTagLabel(tag)}</span>
              </div>
              <span>{formatArmorStatsSummary(item) ?? (item.socket_plugs?.slice(0, 5).map((plug) => plug.name).join(" / ") || "暂无实际 roll")}</span>
              <small>{formatAccountItemMeta(item)}</small>
              <small>{item.locked === undefined ? "锁定状态未知" : item.locked ? "已锁定" : "未锁定"} / 标记：{formatVaultTagLabel(tag)}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}
