import { evaluateWishlistRoll } from "@d2-tools/core/analysis/wishlist";
import type { DimWishlist, VaultTags, VaultTagValue, WeaponRecommendation } from "../../../api/types";
import { buildSameNameSourceStats } from "../../../utils/sameName";
import {
  selectedItemToAccountItem,
  sortSameNameItems,
  type SameNameItemSummary,
  type SelectedItemDetail
} from "@d2-tools/app/items";
import {
  formatCommunityMode,
  formatVaultTagLabel,
  formatWishlistModeLabels
} from "./itemDetailFormatters";

export type ItemDetailCommunityProps = {
  communityRecommendations: WeaponRecommendation | null;
  communityRecommendationError: string;
  importedWishlist: DimWishlist | null;
  isCommunityRecommendationsLoading: boolean;
  sameNameItems: SameNameItemSummary[];
  selectedItem: SelectedItemDetail;
  vaultTags: VaultTags;
  onApplySameNameCurrentKeepTags: (
    items: SameNameItemSummary[],
    currentItemKey: string,
    mode: "keep-current-review-rest" | "keep-current-junk-rest"
  ) => void;
  onCopySameNameLocator: (items: SameNameItemSummary[]) => void;
  onCopyWishlistInsight: () => void;
  onOpenBestSameNameItem: (items: SameNameItemSummary[]) => void;
  onSaveSelectedItemTag: (tag: VaultTagValue) => void;
};

export function ItemDetailCommunity(props: ItemDetailCommunityProps) {
  const selectedAsAccountItem = selectedItemToAccountItem(props.selectedItem);
  const wishlist = selectedAsAccountItem ? evaluateWishlistRoll({
    ...selectedAsAccountItem,
    socket_plugs: selectedAsAccountItem.socket_plugs ?? []
  }, props.importedWishlist ?? undefined) : null;
  const wishlistModeLabels = wishlist ? formatWishlistModeLabels(wishlist.labels) : [];
  const sameNameSourceStats = buildSameNameSourceStats(props.sameNameItems);
  const sortedSameNameItems = sortSameNameItems(props.sameNameItems, props.selectedItem.item_key);

  return (
    <>
      {wishlist?.matched ? (
        <section className="wishlist-panel">
          <div className="wishlist-detail-header">
            <div>
              <h3>{wishlist.labels.includes("DIM Wishlist") ? "DIM 愿望单命中" : "疑似好 roll"}</h3>
              <p>{wishlistModeLabels.length ? wishlistModeLabels.join(" / ") : wishlist.labels.join(" / ")}</p>
            </div>
            <div className="wishlist-mode-badges">
              {wishlist.labels.includes("DIM Wishlist") ? <span className="wishlist-detail-badge">DIM 愿望单</span> : null}
              {wishlistModeLabels.map((label) => (
                <span className="wishlist-detail-badge secondary" key={label}>{label}</span>
              ))}
            </div>
          </div>
          <div className="wishlist-local-tag">
            <strong>当前本地标记</strong>
            <span>{formatVaultTagLabel(props.vaultTags.items[props.selectedItem.item_key]?.tag ?? "none")}</span>
          </div>
          {props.sameNameItems.length > 1 ? (
            <div className="wishlist-same-name-summary">
              <strong>{"同名共 " + sameNameSourceStats.total + " 件"}</strong>
              <div className="wishlist-same-name-chips">
                <span className="wishlist-same-name-chip">{"已装备 " + sameNameSourceStats.equipped}</span>
                <span className="wishlist-same-name-chip">{"背包 " + sameNameSourceStats.inventory}</span>
                <span className="wishlist-same-name-chip">{"仓库 " + sameNameSourceStats.vault}</span>
                <span className="wishlist-same-name-chip">{"邮政官 " + sameNameSourceStats.postmaster}</span>
              </div>
            </div>
          ) : null}
          <ul>
            {wishlist.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
          <div className="button-row wishlist-quick-actions">
            <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={() => props.onSaveSelectedItemTag("keep")}>标记保留</button>
            <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={() => props.onSaveSelectedItemTag("review")}>标记待定</button>
            <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={() => props.onSaveSelectedItemTag("none")}>清除标记</button>
            <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={props.onCopyWishlistInsight}>复制命中结论</button>
            {props.sameNameItems.length > 1 ? (
              <>
                <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={() => props.onOpenBestSameNameItem(sortedSameNameItems)}>打开推荐同名</button>
                <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={() => props.onCopySameNameLocator(props.sameNameItems)}>复制同名定位</button>
                <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={() => props.onApplySameNameCurrentKeepTags(props.sameNameItems, props.selectedItem.item_key, "keep-current-review-rest")}>当前保留，其余待定</button>
                <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={() => props.onApplySameNameCurrentKeepTags(props.sameNameItems, props.selectedItem.item_key, "keep-current-junk-rest")}>当前保留，其余清理</button>
              </>
            ) : null}
          </div>
          <small>{wishlist.disclaimer}</small>
        </section>
      ) : null}

      <RecommendationPanel
        communityRecommendations={props.communityRecommendations}
        communityRecommendationError={props.communityRecommendationError}
        isCommunityRecommendationsLoading={props.isCommunityRecommendationsLoading}
      />
    </>
  );
}

function RecommendationPanel(props: Pick<ItemDetailCommunityProps, "communityRecommendations" | "communityRecommendationError" | "isCommunityRecommendationsLoading">) {
  if (props.communityRecommendations) {
    return (
      <section className="community-recommendations-panel">
        <div className="community-recommendations-header">
          <div>
            <h3>社区推荐 Perk 组合</h3>
            <p>{props.communityRecommendations.matched_modes.map(formatCommunityMode).join(" / ") || "未标注模式"}</p>
          </div>
          <div className="community-source-badges">
            {props.communityRecommendations.source_label ? <span className="community-source-badge">{props.communityRecommendations.source_label}</span> : null}
            {props.communityRecommendations.combos[0]?.source === "dim_wishlist" ? <span className="community-source-badge">DIM Wishlist</span> : null}
          </div>
        </div>
        {props.communityRecommendations.source_warnings?.length ? (
          <ul className="source-status-list source-status-warning">
            {props.communityRecommendations.source_warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        ) : null}
        <ul className="community-combos">
          {props.communityRecommendations.combos.map((combo, index) => (
            <li key={index} className={`community-combo mode-${combo.mode}`}>
              <div className="community-combo-mode">
                <strong>{formatCommunityMode(combo.mode)}</strong>
              </div>
              <div className="community-combo-perks">
                {combo.perks.map((perk) => (
                  <div className="community-perk" key={perk.hash}>
                    {perk.icon ? <img alt="" src={perk.icon} /> : null}
                    <div>
                      <strong>{perk.englishName ? `${perk.name} / ${perk.englishName}` : perk.name}</strong>
                      {perk.description ? <p>{perk.description}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
              {combo.note ? <small className="community-combo-note">{combo.note}</small> : null}
            </li>
          ))}
        </ul>
        {props.communityRecommendations.disclaimer ? <small>{props.communityRecommendations.disclaimer}</small> : null}
      </section>
    );
  }

  if (props.isCommunityRecommendationsLoading) {
    return (
      <section className="source-status-card source-status-pending community-recommendations-panel loading">
        <span className="source-status-badge source-status-pending">社区推荐</span>
        <p>正在读取社区推荐...</p>
      </section>
    );
  }

  if (props.communityRecommendationError) {
    return (
      <section className="source-status-card source-status-warning community-recommendations-panel empty">
        <span className="source-status-badge source-status-warning">社区推荐降级</span>
        <h3>社区推荐降级</h3>
        <p>{props.communityRecommendationError}</p>
        <small>已保留 DIM 愿望单和本地目标判断。</small>
        <small>部分社区推荐服务暂不可用时，仍可继续查看 DIM 愿望单、本地目标命中和同名对比。</small>
      </section>
    );
  }

  return (
    <section className="source-status-card source-status-neutral community-recommendations-panel empty">
      <span className="source-status-badge source-status-neutral">社区推荐</span>
      <h3>社区推荐</h3>
      <p>暂无社区推荐。可以检查 DIM Wishlist 更新或导入本地推荐数据。</p>
    </section>
  );
}
