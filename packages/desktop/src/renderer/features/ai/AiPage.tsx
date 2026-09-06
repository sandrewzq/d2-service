import type {
  AccountSummary,
  ActivityHistorySummary,
  DailySummary,
  VaultTags
} from "../../api/types";
import { AiAssistantPanelView } from "@d2-tools/ui";
import type { AssistantArtifact } from "@d2-tools/app/capabilities";
import { AiAnalysisPanel } from "../../components/AiAnalysisPanel";
import type { AssistantPageContext } from "../../shared/domain/assistant/assistantContext";

export function AiPage(props: {
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
  onClose?: () => void;
}) {
  const pageContext = props.getPageContext?.() ?? props.pageContext;
  if (!props.isConfigured) {
    return (
      <AiAssistantPanelView
        isConfigured={false}
        sessionTitle="新会话"
        messages={[]}
        question=""
        isSending={false}
        isLoadingAccount={props.isLoadingAccount}
        hasAccountItems={false}
        history={[]}
        activeSessionId={null}
        isSessionDrawerOpen={false}
        isContextDrawerOpen={false}
        contextChip="AI 未配置"
        context={{
          pageLabel: pageContext.page_label,
          focus: pageContext.focus,
          facts: pageContext.facts.slice(0, 4),
          itemCount: 0,
          characterCount: props.account?.characters.length ?? 0,
          materialCount: props.account?.materials.item_count ?? 0,
          dailyLoaded: Boolean(props.daily),
          snapshotState: "unsaved",
          snapshotLabel: "尚未创建上下文快照"
        }}
        quickPrompts={[]}
        onQuestionChange={() => undefined}
        onSubmit={() => undefined}
        onQuickPrompt={() => undefined}
        onLoadAccount={props.onLoadAccount}
        onConfigureAi={props.onConfigureAi}
        onClose={props.onClose ?? (() => undefined)}
        onStartNewSession={() => undefined}
        onToggleSessionDrawer={() => undefined}
        onToggleContextDrawer={() => undefined}
        onOpenContextDrawer={() => undefined}
        onCloseContextDrawer={() => undefined}
        onClearHistory={() => undefined}
        onSwitchSession={() => undefined}
        onDeleteSession={() => undefined}
        onOpenArtifact={() => undefined}
      />
    );
  }

  return (
    <AiAnalysisPanel
      account={props.account}
      daily={props.daily}
      activity={props.activity}
      pageContext={pageContext}
      getPageContext={props.getPageContext}
      items={props.account?.vault.items ?? []}
      tags={props.tags}
      isLoadingAccount={props.isLoadingAccount}
      onLoadAccount={props.onLoadAccount}
      onConfigureAi={props.onConfigureAi}
      onOpenArtifact={props.onOpenArtifact}
      onClose={props.onClose ?? (() => undefined)}
    />
  );
}
