import { VaultPage } from "../../features/vault/VaultPage";
import { useVaultAccountStore } from "../../shared/stores/accountEntityStore";
import { useDesktopMenuSession } from "./DesktopMenuProviderContext";
import { useCallback, useMemo } from "react";

export function VaultMenuProvider() {
  const session = useDesktopMenuSession();
  const account = session.account;
  const accountSummary = useVaultAccountStore();
  const writeActions = session.writeActions;
  const cleanupProtectedItemKeys = useMemo(() => ({
    instanceIds: new Set([
      ...session.loadouts.templates.flatMap((template) => (
        template.items.flatMap((item) => item.instance_id ? [item.instance_id] : [])
      )),
      ...(accountSummary?.characters.flatMap((character) => (
        character.loadout_slots.flatMap((slot) => (
          slot.items.flatMap((item) => item.instance_id ? [item.instance_id] : [])
        ))
      )) ?? [])
    ]),
    bucketHashKeys: new Set<string>(),
    hashKeys: new Set<number>()
  }), [accountSummary?.characters, session.loadouts.templates]);
  const handleCommunityRecommendationsChanged = useCallback((weaponHashes?: readonly number[]) => (
    account.loadVaultCommunityMatch(undefined, {
      force: true,
      ...(weaponHashes ? { weaponHashes } : {})
    })
  ), [account.loadVaultCommunityMatch]);

  return (
    <VaultPage
      account={accountSummary}
      isBungieConfigured={session.state.cards.bungieConfig.status === "ready"}
      isAccountLoggedIn={session.state.cards.account.status === "ready"}
      isLoadingAccount={account.isLoadingAccount}
      isShowingCachedAccount={account.isShowingCachedAccount}
      accountError={account.accountError}
      accountSyncMessage={account.accountSyncMessage}
      detailCacheScopeKey={[
        accountSummary
          ? `${accountSummary.membership_type}:${accountSummary.destiny_membership_id}`
          : "signed-out",
        session.diagnostics.manifestStatus?.version ?? "manifest-unavailable",
        session.diagnostics.manifestStatus?.language ?? ""
      ].join("\u0000")}
      activeLoadoutLookup={session.home.activeLoadoutLookup}
      cleanupProtectedItemKeys={cleanupProtectedItemKeys}
      activeLoadoutName={session.loadouts.activeTemplate?.name}
      selectedCharacterId={account.selectedCharacterId}
      tags={account.vaultTags}
      openingItemKey=""
      locateRequest={session.vaultLocateRequest}
      targetLocateRequest={session.vaultTargetLocateRequest}
      wishlist={account.importedWishlist}
      localTargetRules={account.localTargetRules}
      equipmentTargetStore={account.equipmentTargetStore}
      recommendationCardSummary={account.vaultRecommendationCardSummary}
      recommendationScan={account.vaultRecommendationScan}
      onContextFactsChange={session.setVaultFacts}
      onLocalTargetRulesChanged={account.setLocalTargetRules}
      onEquipmentTargetStoreChanged={account.setEquipmentTargetStore}
      onWishlistChanged={account.setImportedWishlist}
      onCommunityRecommendationsChanged={handleCommunityRecommendationsChanged}
      onOpenArmorResult={session.locateArmorResultReference}
      onLoadAccount={session.refreshAccountManually}
      onConfigureBungie={session.onConfigure}
      onLoginBungie={() => void account.loginBungie()}
      onSaveTagBatch={(inputs) => writeActions.vaultWriteActions.saveVaultTagsBatch(inputs)}
      onLockItem={writeActions.vaultWriteActions.handleVaultItemLock}
      onBatchUnlock={writeActions.vaultWriteActions.handleVaultCleanupUnlock}
      onBatchTransferToCharacter={writeActions.vaultWriteActions.handleVaultCleanupTransfer}
      onOpenItem={(item) => {
        const located = item as typeof item & {
          source_character_id?: string;
          source_kind?: "equipped" | "inventory" | "vault" | "postmaster";
          is_vault_item?: boolean;
          is_postmaster_item?: boolean;
        };
        session.itemDetail.openItemDetail(item, {
          source_character_id: located.source_character_id,
          source_kind: located.source_kind,
          is_vault_item: located.is_vault_item,
          is_postmaster_item: located.is_postmaster_item
        });
      }}
      onSaveTag={(item, tag) => writeActions.vaultWriteActions.saveVaultTag(item, tag)}
    />
  );
}
