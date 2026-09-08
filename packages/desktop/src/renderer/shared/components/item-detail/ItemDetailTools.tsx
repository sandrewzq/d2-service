import { evaluateWishlistRoll } from "@d2-tools/core/analysis/wishlist";
import { evaluateLocalTargets } from "@d2-tools/core/analysis/targets";
import { evaluateEquipmentTargets } from "@d2-tools/core/targets/equipmentTargets";
import type {
  AccountItemActionPatch,
  AccountItemDetail,
  AccountSummary,
  DimWishlist,
  EquipmentTargetStore,
  ItemActionPlanInput,
  ItemActionResult,
  ItemAiAdviceResult,
  LocalTargetRules,
  VaultTags,
  VaultTagValue,
  WeaponRecommendation
} from "../../../api/types";
import type {
  SameNameItemSummary,
  SelectedItemDetail,
  SelectedItemSource
} from "../../hooks/useItemDetail";
import { selectedItemToAccountItem } from "@d2-tools/app/items";
import type { buildDuplicateGroupBatchTagPlan } from "../../domain/vault/vaultCleanup";
import {
  formatVaultTagLabel,
  formatWishlistModeLabels,
  getItemSourceStatusTone
} from "./itemDetailFormatters";
import { ItemDetailActions } from "./ItemDetailActions";
import { ItemDetailAi } from "./ItemDetailAi";
import { ItemDetailCommunity } from "./ItemDetailCommunity";
import { ItemDetailPerks } from "./ItemDetailPerks";
import { ItemDetailSameName } from "./ItemDetailSameName";

export type ItemDetailToolsProps = {
  accountSummary: AccountSummary | null;
  communityRecommendations: WeaponRecommendation | null;
  communityRecommendationError: string;
  importedWishlist: DimWishlist | null;
  localTargetRules: LocalTargetRules;
  equipmentTargetStore: EquipmentTargetStore;
  isCommunityRecommendationsLoading: boolean;
  isGeneratingItemAi: boolean;
  isRunningItemAction: boolean;
  itemAiError: string;
  itemAiResult: ItemAiAdviceResult | null;
  itemNoteDraft: string;
  itemNoteMessage: string;
  itemShareMessage: string;
  sameNameItems: SameNameItemSummary[];
  selectedActionCharacterId: string;
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
  onCopyItemActionPlanText: (input: ItemActionPlanInput) => void;
  onCopySameNameLocator: (items: SameNameItemSummary[]) => void;
  onCopySelectedItemChatGuide: () => void;
  onCopySelectedItemSummary: () => void;
  onCopyWishlistInsight: () => void;
  onGenerateItemAiAdvice: () => void;
  onOpenBestSameNameItem: (items: SameNameItemSummary[]) => void;
  onOpenItemDetail: (item: SameNameItemSummary, source: SelectedItemSource) => void;
  onRunItemWriteAction: (
    label: string,
    action: () => Promise<ItemActionResult>,
    options?: {
      keepDetailOpen?: boolean;
      feedbackScope?: "global" | "detail";
      onProgress?: (phase: "submitting" | "refreshing", message: string) => void;
      verifyRefreshedItem?: (detail: AccountItemDetail) => boolean;
      refreshMismatchMessage?: string;
      expectedAccountPatch?: AccountItemActionPatch;
    }
  ) => Promise<{ ok: boolean; refreshed: boolean; message: string; cancelled?: boolean }>;
  onSaveSelectedItemNote: () => void;
  onSaveSelectedItemTag: (tag: VaultTagValue) => void;
  onSelectedActionCharacterIdChange: (id: string) => void;
  onSetItemNoteDraft: (value: string) => void;
};

export function ItemDetailTools(props: ItemDetailToolsProps) {
  const selectedItem = props.selectedItem;

  return (
    <section className="item-detail-tool-area item-tool-panel" aria-label="装备详情工具区">
      <div className="item-detail-tool-tabs" aria-hidden="true">
        <span className="ui-badge status-neutral">概览</span>
        <span className="ui-badge status-neutral">同名对比</span>
        <span className="ui-badge status-neutral">社区推荐</span>
        <span className="ui-badge status-neutral">操作</span>
      </div>
      <div className="item-detail-tool-grid">
        <section className="item-detail-tool-section item-detail-tool-overview">
          <h3>概览</h3>
          <ItemDetailOverview selectedItem={selectedItem} />
          <ItemDetailTargetMatch
            importedWishlist={props.importedWishlist}
            localTargetRules={props.localTargetRules}
            equipmentTargetStore={props.equipmentTargetStore}
            selectedItem={selectedItem}
            vaultTags={props.vaultTags}
            onCopyWishlistInsight={props.onCopyWishlistInsight}
            onSaveSelectedItemTag={props.onSaveSelectedItemTag}
          />
          <ItemDetailPerks selectedItem={selectedItem} />
        </section>
        <section className="item-detail-tool-section item-detail-tool-compare">
          <ItemDetailSameName
            sameNameItems={props.sameNameItems}
            selectedItem={selectedItem}
            vaultTags={props.vaultTags}
            onApplySameNameBatchTags={props.onApplySameNameBatchTags}
            onApplySameNameCurrentKeepTags={props.onApplySameNameCurrentKeepTags}
            onOpenBestSameNameItem={props.onOpenBestSameNameItem}
            onOpenItemDetail={props.onOpenItemDetail}
          />
        </section>
        <section className="item-detail-tool-section item-detail-tool-community">
          <ItemDetailCommunity
            communityRecommendations={props.communityRecommendations}
            communityRecommendationError={props.communityRecommendationError}
            importedWishlist={props.importedWishlist}
            isCommunityRecommendationsLoading={props.isCommunityRecommendationsLoading}
            sameNameItems={props.sameNameItems}
            selectedItem={selectedItem}
            vaultTags={props.vaultTags}
            onApplySameNameCurrentKeepTags={props.onApplySameNameCurrentKeepTags}
            onCopySameNameLocator={props.onCopySameNameLocator}
            onCopyWishlistInsight={props.onCopyWishlistInsight}
            onOpenBestSameNameItem={props.onOpenBestSameNameItem}
            onSaveSelectedItemTag={props.onSaveSelectedItemTag}
          />
        </section>
        <section className="item-detail-tool-section item-detail-tool-actions">
          <h3>操作</h3>
          <ItemLocalTagPanel
            selectedItem={selectedItem}
            vaultTags={props.vaultTags}
            onSaveSelectedItemTag={props.onSaveSelectedItemTag}
          />
          <ItemNotePanel
            itemNoteDraft={props.itemNoteDraft}
            itemNoteMessage={props.itemNoteMessage}
            onSaveSelectedItemNote={props.onSaveSelectedItemNote}
            onSetItemNoteDraft={props.onSetItemNoteDraft}
          />
          <ItemDetailActions
            accountSummary={props.accountSummary}
            isRunningItemAction={props.isRunningItemAction}
            selectedActionCharacterId={props.selectedActionCharacterId}
            selectedItem={selectedItem}
            onCopyItemActionPlanText={props.onCopyItemActionPlanText}
            onRunItemWriteAction={props.onRunItemWriteAction}
            onSelectedActionCharacterIdChange={props.onSelectedActionCharacterIdChange}
          />
          <ItemDetailAi
            isGeneratingItemAi={props.isGeneratingItemAi}
            itemAiError={props.itemAiError}
            itemAiResult={props.itemAiResult}
            itemShareMessage={props.itemShareMessage}
            onCopySelectedItemChatGuide={props.onCopySelectedItemChatGuide}
            onCopySelectedItemSummary={props.onCopySelectedItemSummary}
            onGenerateItemAiAdvice={props.onGenerateItemAiAdvice}
          />
        </section>
      </div>
    </section>
  );
}

function ItemDetailOverview(props: { selectedItem: SelectedItemDetail }) {
  const selectedItem = props.selectedItem;
  const sourceTone = getItemSourceStatusTone(selectedItem);

  return (
    <>
      {selectedItem.is_detail_loading ? (
        <section className="source-status-card source-status-pending item-detail-loading" aria-live="polite">
          <span className="source-status-badge source-status-pending">详情加载</span>
          <strong>正在打开详情...</strong>
          <span>先显示基础信息，来源、perk 和详细说明会继续加载。</span>
        </section>
      ) : null}
      {selectedItem.description ? <p className="item-detail-description">{selectedItem.description}</p> : null}
      <section className={`source-status-card source-status-${sourceTone} daily-source ${selectedItem.is_detail_loading ? "item-detail-loading" : "source-ready"}`}>
        <span className={`source-status-badge source-status-${sourceTone}`}>
          {selectedItem.is_detail_loading ? "来源读取中" : "来源"}
        </span>
        <strong>{selectedItem.source.label}</strong>
        <span>{selectedItem.source.description}</span>
      </section>
    </>
  );
}

function ItemDetailTargetMatch(props: {
  importedWishlist: DimWishlist | null;
  localTargetRules: LocalTargetRules;
  equipmentTargetStore: EquipmentTargetStore;
  selectedItem: SelectedItemDetail;
  vaultTags: VaultTags;
  onCopyWishlistInsight: () => void;
  onSaveSelectedItemTag: (tag: VaultTagValue) => void;
}) {
  const accountItem = selectedItemToAccountItem(props.selectedItem);
  if (!accountItem) {
    return null;
  }

  const wishlist = evaluateWishlistRoll({
    ...accountItem,
    socket_plugs: accountItem.socket_plugs ?? []
  }, props.importedWishlist ?? undefined);
  const localTarget = evaluateLocalTargets(accountItem, props.localTargetRules);
  const equipmentTarget = evaluateEquipmentTargets(accountItem, props.equipmentTargetStore);
  const hasImportedWishlist = Boolean(props.importedWishlist?.rules.length);

  if (!wishlist.matched && !localTarget.matched && !equipmentTarget.matched && !hasImportedWishlist) {
    return null;
  }

  const modeLabels = formatWishlistModeLabels(wishlist.labels);
  const tag = props.vaultTags.items[props.selectedItem.item_key]?.tag ?? "none";
  const matched = wishlist.matched || localTarget.matched || equipmentTarget.matched;
  const matchSources = formatTargetMatchSources({
    wishlistMatched: wishlist.matched,
    localTargetMatched: localTarget.matched,
    equipmentTargetMatched: equipmentTarget.matched,
    hasImportedWishlist
  });

  return (
    <section className={`target-match-panel ${matched ? "matched" : "empty"}`}>
      <div className="target-match-header">
        <span className="source-status-badge source-status-ready">目标命中</span>
        <strong>{matched
          ? equipmentTarget.matched ? "装备目标命中" : localTarget.matched ? "本地目标命中" : wishlist.labels.includes("DIM Wishlist") ? "DIM 愿望单命中" : "疑似好 roll"
          : "未命中已导入 DIM 愿望单"}</strong>
      </div>
      <div className="target-match-meta">
        <span>命中来源：{matchSources.join(" / ")}</span>
        <span>本地标记：{formatVaultTagLabel(tag)}</span>
        {wishlist.matched ? <span>{modeLabels.length ? modeLabels.join(" / ") : wishlist.labels.join(" / ")}</span> : null}
        {localTarget.matched ? <span>{localTarget.labels.join(" / ")}</span> : null}
        {equipmentTarget.matched ? <span>{equipmentTarget.labels.join(" / ")}</span> : null}
      </div>
      {matched ? (
        <ul>
          {localTarget.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          {equipmentTarget.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          {wishlist.reasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      ) : (
        <p>当前装备没有命中已导入的 DIM 愿望单规则。同名对比可继续复查同名装备，也可以结合社区推荐复查。</p>
      )}
      <div className="button-row">
        {matched ? (
          <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={props.onCopyWishlistInsight}>
            复制命中结论
          </button>
        ) : null}
        <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={() => props.onSaveSelectedItemTag("farm")}>标记待刷</button>
        <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={() => props.onSaveSelectedItemTag("loadout")}>标记配装用</button>
      </div>
      <small>{equipmentTarget.matched ? equipmentTarget.disclaimer : localTarget.matched ? localTarget.disclaimer : wishlist.disclaimer}</small>
      <small>命中后不会自动收藏、加标签或改动装备；你需要手动选择标记或写操作。</small>
    </section>
  );
}

function formatTargetMatchSources(input: {
  wishlistMatched: boolean;
  localTargetMatched: boolean;
  equipmentTargetMatched: boolean;
  hasImportedWishlist: boolean;
}): string[] {
  const sources = [];
  if (input.localTargetMatched) {
    sources.push("本地目标规则");
  }
  if (input.equipmentTargetMatched) {
    sources.push("装备目标库");
  }
  if (input.wishlistMatched || input.hasImportedWishlist) {
    sources.push("DIM 愿望单");
  }
  return sources.length ? sources : ["未命中"];
}

function ItemLocalTagPanel(props: {
  selectedItem: SelectedItemDetail;
  vaultTags: VaultTags;
  onSaveSelectedItemTag: (tag: VaultTagValue) => void;
}) {
  const currentTag = props.vaultTags.items[props.selectedItem.item_key]?.tag ?? "none";

  return (
    <section className="item-local-tag-panel">
      <div className="item-local-tag-header">
        <span>本地标记</span>
        <strong className={`vault-tag-current tag-${currentTag}`}>
          {formatVaultTagLabel(currentTag)}
        </strong>
      </div>
      <div className="button-row">
        <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={() => props.onSaveSelectedItemTag("keep")}>保留</button>
        <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={() => props.onSaveSelectedItemTag("review")}>待定</button>
        <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={() => props.onSaveSelectedItemTag("farm")}>待刷</button>
        <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={() => props.onSaveSelectedItemTag("loadout")}>配装用</button>
        <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={() => props.onSaveSelectedItemTag("junk")}>清理</button>
        <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={() => props.onSaveSelectedItemTag("none")}>清除</button>
      </div>
    </section>
  );
}

function ItemNotePanel(props: {
  itemNoteDraft: string;
  itemNoteMessage: string;
  onSaveSelectedItemNote: () => void;
  onSetItemNoteDraft: (value: string) => void;
}) {
  return (
    <section className="item-note-panel">
      <label htmlFor="item-note-draft">本地备注</label>
      <textarea
        id="item-note-draft"
        value={props.itemNoteDraft}
        onChange={(event) => props.onSetItemNoteDraft(event.target.value)}
        placeholder="例如：留给电猎清杂 / 等队友复查 PVP 手感 / 同名已有更好 roll"
        rows={3}
      />
      <div className="button-row">
        <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={props.onSaveSelectedItemNote}>
          保存备注
        </button>
        {props.itemNoteMessage ? <span className="muted-copy">{props.itemNoteMessage}</span> : null}
      </div>
    </section>
  );
}
