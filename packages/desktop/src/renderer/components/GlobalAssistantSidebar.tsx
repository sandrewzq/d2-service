import type {
  AccountSummary,
  ActivityHistorySummary,
  DailySummary,
  VaultTags
} from "../api/types";
import { AiPage } from "../features/ai/AiPage";
import type { AssistantPageContext } from "../shared/domain/assistant/assistantContext";
import type { ShellAssistantMode } from "@d2-tools/ui";
import type { AssistantArtifact } from "@d2-tools/app/capabilities";

export function GlobalAssistantSidebar(props: {
  assistantMode: ShellAssistantMode;
  isConfigured: boolean;
  account: AccountSummary | null;
  daily: DailySummary | null;
  activity: ActivityHistorySummary | null;
  pageContext: AssistantPageContext;
  getPageContext?: () => AssistantPageContext;
  tags: VaultTags;
  isLoadingAccount: boolean;
  onLoadAccount: () => void;
  onConfigureAi: () => void;
  onOpenArtifact: (artifact: AssistantArtifact) => void;
  onClose: () => void;
}) {
  if (props.assistantMode !== "ai") return null;
  return (
    <AiPage
      isConfigured={props.isConfigured}
      account={props.account}
      daily={props.daily}
      activity={props.activity}
      pageContext={props.pageContext}
      getPageContext={props.getPageContext}
      tags={props.tags}
      isLoadingAccount={props.isLoadingAccount}
      onLoadAccount={props.onLoadAccount}
      onConfigureAi={props.onConfigureAi}
      onOpenArtifact={props.onOpenArtifact}
      onClose={props.onClose}
    />
  );
}
