import { VendorsPage } from "../../features/vendors/VendorsPage";
import { useDesktopMenuSession } from "./DesktopMenuProviderContext";

export function VendorsMenuProvider() {
  const session = useDesktopMenuSession();

  return (
    <VendorsPage
      model={session.vendors.model}
      availability={{
        isBungieConfigured: session.state.cards.bungieConfig.status === "ready",
        isAccountLoggedIn: session.state.cards.account.status === "ready",
        onConfigureBungie: session.onConfigure,
        onLoginBungie: () => void session.account.loginBungie()
      }}
      actions={{
        selectVendor: session.vendors.selectVendor,
        refreshVendors: () => void session.vendors.refresh(),
        onOpenItem: (item, context) => {
          session.itemDetail.closeSelectedItemDetail();
          void session.vendorDefinitionDetail.open(item, context);
        }
      }}
      interfaceLocale={session.diagnostics.languagePreferences.interfaceLocale}
    />
  );
}
