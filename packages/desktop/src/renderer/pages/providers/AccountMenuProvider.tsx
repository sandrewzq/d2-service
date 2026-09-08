import { AccountPage } from "../../features/account/AccountPage";
import { useAccountSummaryStore } from "../../shared/stores/accountEntityStore";
import { useDesktopMenuSession } from "./DesktopMenuProviderContext";

export function AccountMenuProvider() {
  const session = useDesktopMenuSession();
  const account = session.account;
  const accountSummary = useAccountSummaryStore();
  const writeActions = session.writeActions;

  return (
    <AccountPage
      interfaceLocale={session.diagnostics.languagePreferences.interfaceLocale}
      accountSummary={accountSummary}
      startupState={session.state}
      selectedCharacterId={account.selectedCharacterId}
      lastAccountLoadedAt={session.lastAccountLoadedAt}
      isLoadingAccount={account.isLoadingAccount}
      isShowingCachedAccount={account.isShowingCachedAccount}
      accountError={account.accountError}
      accountWarning={account.accountWarning}
      itemDetailError=""
      itemDetailLoadingKey=""
      activitySummary={account.activitySummary}
      activityMessage={account.activityMessage}
      activityError={account.activityError}
      loadoutMessage={writeActions.loadoutMessage}
      itemActionMessage={writeActions.itemActionMessage}
      operationFeedback={writeActions.accountOperationFeedback}
      isRunningItemAction={writeActions.isRunningItemAction}
      activeLoadoutLookup={session.home.activeLoadoutLookup}
      activeLoadoutTemplate={session.loadouts.activeTemplate}
      wishlist={account.importedWishlist}
      recommendationCardSummary={account.vaultRecommendationCardSummary}
      onConfigureBungie={session.onConfigure}
      onLoginBungie={() => void account.loginBungie()}
      onLoadAccount={session.refreshAccountManually}
      onRefreshActivity={() => void account.refreshAccountDerivedData()}
      onSelectCharacter={account.setSelectedCharacterId}
      onEquipHighestPowerItems={(character) => void writeActions.loadoutWriteActions.equipHighestPowerItems(character)}
      onOpenItem={(item, options) => session.itemDetail.openItemDetail(item, options)}
    />
  );
}
