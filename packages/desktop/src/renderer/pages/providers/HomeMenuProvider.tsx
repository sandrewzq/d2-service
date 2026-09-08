import { HomeDashboard } from "../../features/home/HomeDashboard";
import { createHomeWeeklyActivityRewardDetailTarget } from "@d2-tools/app/home";
import { useAccountSummaryStore, useHasAccountDataStore } from "../../shared/stores/accountEntityStore";
import { useDesktopMenuSession } from "./DesktopMenuProviderContext";

export function HomeMenuProvider() {
  const session = useDesktopMenuSession();
  const account = session.account;
  const daily = session.daily;
  const diagnostics = session.diagnostics;
  const hasAccountData = useHasAccountDataStore();
  const accountSummary = useAccountSummaryStore();
  const selectedCharacter = accountSummary?.characters.find((character) => character.character_id === account.selectedCharacterId)
    ?? accountSummary?.characters[0];

  return (
    <HomeDashboard
      state={session.state}
      selectedCharacterId={account.selectedCharacterId}
      selectedCharacterLabel={selectedCharacter?.class_name}
      briefingFetchedAt={daily.briefingFetchedAt}
      isLoggingIn={account.isLoggingIn}
      isInitializingManifest={account.isInitializingManifest}
      isRefreshingDiagnostics={diagnostics.isRefreshingDiagnostics}
      diagnosticRows={session.home.diagnosticRows}
      diagnosticError={diagnostics.diagnosticError}
      accountError={account.accountError}
      hasAccountData={hasAccountData}
      dailySummary={daily.dailySummary}
      weeklySummary={daily.weeklySummary}
      dailyMessage={daily.dailyMessage}
      dailyError={daily.dailyError}
      isLoadingAccount={account.isLoadingAccount}
      isLoadingDaily={daily.isLoadingDaily}
      dailyResourceStatus={daily.dailyResourceStatus}
      dailyResourceSource={daily.dailyResourceSource}
      onNavigate={session.setActivePage}
      onRefreshDaily={() => void daily.loadDailySummary(true)}
      onOpenWeeklyActivityReward={(reward) => {
        session.vendorDefinitionDetail.close();
        session.itemDetail.openItemDetail(
          createHomeWeeklyActivityRewardDetailTarget(reward)
        );
      }}
      onOpenXurOffer={(item, context) => {
        session.itemDetail.closeSelectedItemDetail();
        void session.vendorDefinitionDetail.open(item, context);
      }}
      interfaceLocale={diagnostics.languagePreferences.interfaceLocale}
    />
  );
}
