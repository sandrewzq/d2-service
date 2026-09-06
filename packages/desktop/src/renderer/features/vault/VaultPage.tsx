import { buildVaultRecommendationAuditReport, selectVaultPageModel } from "@d2-tools/app/vault";
import type { VaultRecommendationScanState } from "@d2-tools/app/account";
import { ControlButton, ProductWorkspaceEmptyState, VaultPageContentView, type VaultWishlistActions } from "@d2-tools/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LoadoutTemplateLookup } from "../../shared/domain/loadouts/loadoutLookup";
import type {
  AccountItemSummary,
  AccountSummary,
  ArmorSetCatalogItem,
  BatchItemActionResult,
  DimWishlist,
  EquipmentTargetStore,
  LocalTargetRules,
  LocalCommunityRecommendationTable,
  SaveVaultTagInput,
  VaultItemInstanceMatchInfo,
  VaultTags,
  VaultTagValue
} from "../../api/types";
import { api } from "../../api/client";
import { services } from "../../api/services";
import { loadAccountItemDetailCached } from "../../shared/hooks/useItemDetail";

export function VaultPage(props: {
  account: AccountSummary | null;
  isBungieConfigured: boolean;
  isAccountLoggedIn: boolean;
  isLoadingAccount: boolean;
  isShowingCachedAccount: boolean;
  accountError: string;
  accountSyncMessage: string;
  detailCacheScopeKey?: string;
  activeLoadoutLookup: LoadoutTemplateLookup | null;
  cleanupProtectedItemKeys?: LoadoutTemplateLookup | null;
  activeLoadoutName?: string;
  selectedCharacterId: string;
  tags: VaultTags;
  openingItemKey: string;
  locateRequest?: { hash: number; name: string; requestId: number } | null;
  targetLocateRequest?: { targetId: string; requestId: number } | null;
  wishlist: DimWishlist | null;
  localTargetRules: LocalTargetRules;
  equipmentTargetStore: EquipmentTargetStore;
  communityInstanceMatch: Map<string, VaultItemInstanceMatchInfo>;
  recommendationScan: VaultRecommendationScanState;
  onContextFactsChange?: (facts: string[]) => void;
  onLocalTargetRulesChanged: (rules: LocalTargetRules) => void;
  onEquipmentTargetStoreChanged: (store: EquipmentTargetStore) => void;
  onWishlistChanged: (wishlist: DimWishlist | null) => void;
  onCommunityRecommendationsChanged: (weaponHashes?: readonly number[]) => Promise<void> | void;
  onOpenArmorResult: (reference: { resultId: string; candidateId: string }) => void;
  onLoadAccount: () => void;
  onConfigureBungie: () => void;
  onLoginBungie: () => void;
  onSaveTagBatch: (inputs: SaveVaultTagInput[]) => void | Promise<void>;
  onLockItem: (item: AccountItemSummary, targetCharacterId: string) => Promise<string>;
  onBatchUnlock: (items: AccountItemSummary[], targetCharacterId: string) => Promise<string>;
  onBatchTransferToCharacter: (items: AccountItemSummary[], targetCharacterId: string) => Promise<BatchItemActionResult>;
  onOpenItem: (item: AccountItemSummary) => void;
  onSaveTag: (item: AccountItemSummary, tag: VaultTagValue) => void | Promise<void>;
}) {
  const [localCommunityTable, setLocalCommunityTable] = useState<LocalCommunityRecommendationTable | null>(null);
  const [localCommunityLoadState, setLocalCommunityLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [localCommunityLoadError, setLocalCommunityLoadError] = useState("");
  const [armorSetCatalog, setArmorSetCatalog] = useState<ArmorSetCatalogItem[]>([]);
  const [armorSetCatalogStatus, setArmorSetCatalogStatus] = useState<"loading" | "ready" | "error">("loading");
  const detailScopeKey = props.detailCacheScopeKey ?? (props.account
    ? `${props.account.membership_type}:${props.account.destiny_membership_id}`
    : "vault");
  const loadItemDetail = useCallback((item: AccountItemSummary) => (
    item.instance_id
      ? loadAccountItemDetailCached(item.instance_id, {
          scopeKey: detailScopeKey,
          rollFingerprint: item.weapon_roll?.fingerprint
        })
      : Promise.resolve(item)
  ), [detailScopeKey]);
  const wishlistActions = useMemo<VaultWishlistActions>(() => ({
    save: async (wishlist) => {
      const affectedWeaponHashes = collectWishlistWeaponHashes(props.wishlist, wishlist);
      const saved = await api.saveDimWishlist(wishlist);
      props.onWishlistChanged(await api.getDimWishlist());
      props.onEquipmentTargetStoreChanged(await api.getEquipmentTargetStore());
      await props.onCommunityRecommendationsChanged(affectedWeaponHashes);
      return saved;
    },
    clear: async () => {
      const affectedWeaponHashes = collectWishlistWeaponHashes(props.wishlist);
      await api.clearDimWishlist();
      props.onWishlistChanged(null);
      props.onEquipmentTargetStoreChanged(await api.getEquipmentTargetStore());
      await props.onCommunityRecommendationsChanged(affectedWeaponHashes);
    },
    selectDimFile: () => api.selectDimWishlistFile(),
    confirmDimImport: async (token) => {
      const saved = await api.confirmDimWishlistImport(token);
      const affectedWeaponHashes = collectWishlistWeaponHashes(props.wishlist, saved);
      props.onWishlistChanged(await api.getDimWishlist());
      props.onEquipmentTargetStoreChanged(await api.getEquipmentTargetStore());
      await props.onCommunityRecommendationsChanged(affectedWeaponHashes);
      return saved;
    },
    getDimOnlineStatus: () => api.getDimWishlistOnlineStatus(),
    checkDimOnlineUpdate: () => api.checkDimWishlistOnlineUpdate(),
    confirmDimOnlineUpdate: async (token) => {
      const result = await api.confirmDimWishlistOnlineUpdate(token);
      const affectedWeaponHashes = collectWishlistWeaponHashes(props.wishlist, result.wishlist);
      props.onWishlistChanged(await api.getDimWishlist());
      props.onEquipmentTargetStoreChanged(await api.getEquipmentTargetStore());
      await props.onCommunityRecommendationsChanged(affectedWeaponHashes);
      return result;
    },
    exportKnowledgeTemplate: () => api.exportWeaponKnowledgeCsvTemplate(),
    exportKnowledgeCsv: () => api.exportWeaponKnowledgePlayerCsv(),
    selectKnowledgeCsv: () => api.selectWeaponKnowledgeCsv(),
    confirmKnowledgeImport: async (token) => {
      const imported = await api.confirmWeaponKnowledgeCsvImport(token);
      await props.onCommunityRecommendationsChanged();
      return imported;
    },
    getRecommendationManagement: () => api.getRecommendationManagement(),
    listRecommendationRules: (sourceKey, query) => api.listRecommendationRules(sourceKey, query),
    setRecommendationSourceState: async (sourceKey, state) => {
      const snapshot = await api.setRecommendationSourceState(sourceKey, state);
      if (sourceKey === "dim_wishlist") {
        props.onWishlistChanged(await api.getDimWishlist());
        if (state === "removed") {
          props.onEquipmentTargetStoreChanged(await api.getEquipmentTargetStore());
        }
      }
      await Promise.resolve(props.onCommunityRecommendationsChanged(snapshot.affected_weapon_hashes)).catch(() => undefined);
      return snapshot;
    },
    setRecommendationRuleState: async (input) => {
      const snapshot = await api.setRecommendationRuleState(input);
      await Promise.resolve(props.onCommunityRecommendationsChanged(snapshot.affected_weapon_hashes)).catch(() => undefined);
      return snapshot;
    },
    clearCuratedRecommendationDataset: async () => {
      const snapshot = await api.clearCuratedRecommendationDataset();
      await Promise.resolve(props.onCommunityRecommendationsChanged(snapshot.affected_weapon_hashes)).catch(() => undefined);
      return snapshot;
    }
  }), [props.onCommunityRecommendationsChanged, props.onEquipmentTargetStoreChanged, props.onWishlistChanged, props.wishlist]);
  const loadLocalCommunityTable = useCallback(async () => {
    setLocalCommunityLoadState("loading");
    setLocalCommunityLoadError("");
    try {
      const table = await services.localData.getLocalCommunityRecommendations();
      setLocalCommunityTable(table);
      setLocalCommunityLoadState("ready");
      return table;
    } catch (error) {
      const message = error instanceof Error ? error.message : "遗留自定义规则读取失败";
      setLocalCommunityLoadState("error");
      setLocalCommunityLoadError(message);
      throw error;
    }
  }, []);
  useEffect(() => {
    void loadLocalCommunityTable().catch(() => undefined);
  }, [loadLocalCommunityTable]);
  useEffect(() => {
    let active = true;
    setArmorSetCatalogStatus("loading");
    void api.getArmorSetCatalog().then(
      (catalog) => {
        if (!active) return;
        setArmorSetCatalog(catalog);
        setArmorSetCatalogStatus("ready");
      },
      () => {
        if (!active) return;
        setArmorSetCatalog([]);
        setArmorSetCatalogStatus("error");
      }
    );
    return () => {
      active = false;
    };
  }, []);
  const model = useMemo(() => props.account ? selectVaultPageModel({
    account: props.account,
    selectedCharacterId: props.selectedCharacterId,
    activeLoadoutLookup: props.activeLoadoutLookup,
    activeLoadoutName: props.activeLoadoutName,
    tags: props.tags,
    targetRules: props.localTargetRules,
    wishlist: props.wishlist,
    communityInstanceMatch: props.communityInstanceMatch
  }) : null, [
    props.account,
    props.selectedCharacterId,
    props.activeLoadoutLookup,
    props.activeLoadoutName,
    props.tags,
    props.localTargetRules,
    props.wishlist,
    props.communityInstanceMatch
  ]);

  if (!props.isBungieConfigured || !props.isAccountLoggedIn || !props.account) {
    if (!props.isBungieConfigured || !props.isAccountLoggedIn) {
      const isConfigured = props.isBungieConfigured;
      return (
        <ProductWorkspaceEmptyState className="account-unavailable product-workspace-empty--page" uiKind="state-frame">
          <span className="ui-badge status-warning">未连接 Bungie</span>
          <h2>{isConfigured ? "账号还没有登录" : "还没有配置 Bungie 应用"}</h2>
          <p>{isConfigured ? "先登录 Bungie；登录后会自动同步装备数据，随后即可查看仓库、装备和清理候选。" : "先在设置里完成 Bungie 应用配置，再登录账号同步装备数据。"}</p>
          <div className="button-row">
            {isConfigured ? (
              <button type="button" data-ui-kind="button" data-control-variant="primary" onClick={props.onLoginBungie}>登录 Bungie</button>
            ) : (
              <button type="button" data-ui-kind="button" data-control-variant="primary" onClick={props.onConfigureBungie}>去设置 Bungie</button>
            )}
          </div>
        </ProductWorkspaceEmptyState>
      );
    }

    return (
      <ProductWorkspaceEmptyState className="vault-empty-state product-workspace-empty--page">
        <strong>{props.accountError ? "仓库读取失败" : props.isLoadingAccount ? "正在读取账号" : "还没有账号数据"}</strong>
        <span>{props.accountError || "先同步装备数据，然后查看当前角色、背包和仓库中的真实装备。"}</span>
        <ControlButton variant="primary" aria-busy={props.isLoadingAccount} disabled={props.isLoadingAccount} onClick={props.onLoadAccount}>同步装备数据</ControlButton>
      </ProductWorkspaceEmptyState>
    );
  }

  const account = props.account;
  if (!model) return null;

  return (
    <VaultPageContentView
      items={model.vaultItems}
      currentCharacterId={model.currentCharacterId}
      armorSetCatalog={armorSetCatalog}
      armorSetCatalogStatus={armorSetCatalogStatus}
      accountResourceStatus={props.isLoadingAccount
        ? "refreshing"
        : props.accountError
          ? "stale"
          : props.isShowingCachedAccount
            ? "cached"
            : "ready"}
      accountResourceMessage={props.accountSyncMessage}
      accountResourceError={props.accountError}
      vaultItemCount={model.vaultItemCount}
      highlightedItemKeys={model.activeLoadoutLookup}
      cleanupProtectedItemKeys={props.cleanupProtectedItemKeys}
      highlightedLabel={model.activeLoadoutName}
      tags={model.tags}
      openingItemKey={props.openingItemKey}
      locateRequest={props.locateRequest}
      targetLocateRequest={props.targetLocateRequest}
      onSaveTagBatch={props.onSaveTagBatch}
      cleanupActions={{
        characters: props.account.characters,
        currentCharacterId: model.currentCharacterId,
        currentCharacterLabel: model.currentCharacterLabel,
        onLockItem: props.onLockItem,
        onBatchUnlock: props.onBatchUnlock,
        onBatchTransferToCharacter: props.onBatchTransferToCharacter
      }}
      wishlist={model.wishlist}
      localTargetRules={model.targetRules}
      equipmentTargetStore={props.equipmentTargetStore}
      communityInstanceMatch={model.communityInstanceMatch}
      recommendationSourceState={{
        recommendationScan: props.recommendationScan,
        customRules: localCommunityTable,
        customRulesLoadState: localCommunityLoadState,
        customRulesLoadError: localCommunityLoadError
      }}
      wishlistActions={wishlistActions}
      onCopyRecommendationAudit={async () => {
        await navigator.clipboard.writeText(buildVaultRecommendationAuditReport({
          items: [
            ...account.characters.flatMap((character) => [
              ...character.equipped_items,
              ...character.inventory_items,
              ...character.postmaster_items
            ]),
            ...account.vault.items
          ],
          instanceMatches: model.communityInstanceMatch,
          scan: props.recommendationScan
        }));
      }}
      targetRulesActions={{
        onSaveRules: async (rules) => {
          const saved = await services.localData.saveLocalTargetRules(rules);
          props.onLocalTargetRulesChanged(saved);
          props.onEquipmentTargetStoreChanged(await services.localData.getEquipmentTargetStore());
          return saved;
        },
        onClearRules: async () => {
          const cleared = await services.localData.clearLocalTargetRules();
          props.onLocalTargetRulesChanged(cleared);
          props.onEquipmentTargetStoreChanged(await services.localData.getEquipmentTargetStore());
          return cleared;
        },
        onSearchPerks: (query) => api.searchPerks(query),
        onSaveEquipmentTargetStore: async (store) => {
          const saved = await services.localData.saveEquipmentTargetStore(store);
          props.onEquipmentTargetStoreChanged(saved);
          return saved;
        },
        onClearEquipmentTargetStore: async () => {
          const cleared = await services.localData.clearEquipmentTargetStore();
          props.onEquipmentTargetStoreChanged(cleared);
          return cleared;
        },
        onOpenArmorResult: props.onOpenArmorResult
      }}
      onContextFactsChange={props.onContextFactsChange}
      onLoadItemDetail={loadItemDetail}
      onOpenItem={props.onOpenItem}
      onSaveTag={props.onSaveTag}
    />
  );
}

function collectWishlistWeaponHashes(...wishlists: Array<DimWishlist | null | undefined>): number[] {
  return [...new Set(wishlists.flatMap((wishlist) => (
    wishlist?.rules.map((rule) => rule.item_hash) ?? []
  )))];
}
