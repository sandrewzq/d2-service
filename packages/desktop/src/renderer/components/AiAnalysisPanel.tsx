import { useEffect, useMemo, useState } from "react";
import { buildAiChatContext } from "@d2-tools/core/ai/chat";
import { sendAssistantMessage } from "@d2-tools/app/assistant";
import {
  createAssistantArmorSolutionComparisonArtifact,
  createAssistantEquipmentTargetCandidatesArtifact,
  createAssistantGuideCaptureArtifact,
  createAssistantContextSnapshot,
  formatAssistantConversationHistory,
  isAssistantContextSnapshotCurrent,
  type AssistantArtifact,
  type AssistantContextSnapshot
} from "@d2-tools/app/capabilities";
import {
  AiAssistantPanelView,
  type AiAssistantHistoryEntryView,
  type AiAssistantMessageView
} from "@d2-tools/ui";
import type { AccountItemSummary, AccountSummary, ActivityHistorySummary, DailySummary, VaultTags } from "../api/types";
import { services } from "../api/services";
import type { AssistantPageContext } from "../shared/domain/assistant/assistantContext";
import {
  getDesktopAssistantManifestVersion,
  runDesktopAssistantCapabilityPrelude
} from "../features/ai/assistantCapabilityRuntime";
import {
  clearAssistantHistory,
  loadAssistantHistory,
  removeAssistantHistoryEntry,
  saveAssistantSession,
  type AssistantHistoryEntry
} from "../utils/assistantHistory";

const quickPrompts = [
  "我现在最应该清理哪些装备？",
  "帮我分析仓库里值得保留的 PVE 武器。",
  "这周我应该优先刷什么？",
  "根据当前账号数据，给我一个配装整理计划。"
];

export function AiAnalysisPanel(props: {
  account: AccountSummary | null;
  daily: DailySummary | null;
  activity: ActivityHistorySummary | null;
  pageContext: AssistantPageContext;
  getPageContext?: () => AssistantPageContext;
  items: AccountItemSummary[];
  tags: VaultTags;
  onLoadAccount: () => void;
  onConfigureAi: () => void;
  onOpenArtifact: (artifact: AssistantArtifact) => void;
  onClose: () => void;
  isLoadingAccount: boolean;
}) {
  const [messages, setMessages] = useState<AiAssistantMessageView[]>([]);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [history, setHistory] = useState<AssistantHistoryEntry[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isSessionDrawerOpen, setIsSessionDrawerOpen] = useState(false);
  const [isContextDrawerOpen, setIsContextDrawerOpen] = useState(false);
  const pageContext = props.getPageContext?.() ?? props.pageContext;
  const contextFacts = useMemo(() => pageContext.facts.slice(0, 4), [pageContext]);
  const safeTags = props.tags ?? { items: {} };
  const currentBaseContext = useMemo(() => buildAiChatContext({
    account: props.account,
    tags: safeTags,
    daily: props.daily,
    activity: props.activity,
    pageContext
  }), [props.account, props.tags, props.daily, props.activity, pageContext]);
  const activeSession = activeSessionId ? history.find((entry) => entry.id === activeSessionId) : undefined;
  const latestContextSnapshot = activeSession?.context_snapshots.at(-1);
  const currentManifestVersion = getDesktopAssistantManifestVersion();
  const snapshotState = !latestContextSnapshot
    ? "unsaved"
    : isAssistantContextSnapshotCurrent(latestContextSnapshot, {
        baseContext: currentBaseContext,
        manifestVersion: currentManifestVersion
      })
      ? "current"
      : "historical";
  const snapshotLabel = snapshotState === "historical"
    ? `历史快照：${formatSnapshotTime(latestContextSnapshot?.created_at)}`
    : snapshotState === "current"
      ? `当前快照：${formatSnapshotTime(latestContextSnapshot?.created_at)}`
      : "尚未创建上下文快照";
  const sessionTitle = activeSession?.title ?? (messages.length ? "当前会话" : "新会话");
  const contextChip = [
    `当前页面：${pageContext.page_label}`,
    `仓库 ${props.items.length} 件`,
    props.account ? `角色 ${props.account.characters.length} 个` : "账号未读取",
    props.daily ? "今日信息已载入" : "今日信息未载入",
    snapshotLabel
  ].join(" · ");

  useEffect(() => {
    setHistory(loadAssistantHistory());
  }, []);

  async function sendChat(nextQuestion = question) {
    const trimmedQuestion = nextQuestion.trim();
    if (!trimmedQuestion) return;
    const previousMessages = messages;
    const userMessage: AiAssistantMessageView = { role: "user", text: trimmedQuestion };

    setIsSendingChat(true);
    setError("");
    setQuestion("");
    setMessages([...previousMessages, userMessage]);

    try {
      const capabilityPrelude = await runDesktopAssistantCapabilityPrelude(trimmedQuestion);
      const conversationContext = formatAssistantConversationHistory(previousMessages);
      const latestPageContext = props.getPageContext?.() ?? props.pageContext;
      const latestBaseContext = buildAiChatContext({
        account: props.account,
        tags: safeTags,
        daily: props.daily,
        activity: props.activity,
        pageContext: latestPageContext
      });
      const context = appendAssistantContext(
        latestBaseContext,
        capabilityPrelude.prompt_context,
        conversationContext
      );
      const contextSnapshot = createAssistantContextSnapshot({
        baseContext: latestBaseContext,
        promptContext: context,
        page: {
          key: latestPageContext.page_key,
          label: latestPageContext.page_label
        },
        account: props.account,
        manifestVersion: capabilityPrelude.manifest_version,
        capabilityResults: capabilityPrelude.results,
        failedCapabilities: capabilityPrelude.errors.map((error) => error.capability),
        conversationMessageCount: previousMessages.length
      });
      const chatState = await sendAssistantMessage(services, {
        question: trimmedQuestion,
        context
      });
      if (chatState.status === "error") {
        throw new Error(chatState.error.message);
      }
      if (chatState.status !== "success") {
        throw new Error("AI 聊天失败");
      }
      const reply = chatState.data.reply;
      const artifact = createAssistantArmorSolutionComparisonArtifact({
        question: trimmedQuestion,
        snapshot: contextSnapshot,
        capabilityResults: capabilityPrelude.results
      }) ?? createAssistantEquipmentTargetCandidatesArtifact({
        question: trimmedQuestion,
        snapshot: contextSnapshot,
        capabilityResults: capabilityPrelude.results
      }) ?? createAssistantGuideCaptureArtifact({
        question: trimmedQuestion,
        reply: reply.text,
        snapshot: contextSnapshot
      });
      const contextualUserMessage: AiAssistantMessageView = {
        ...userMessage,
        context_snapshot_id: contextSnapshot.snapshot_id
      };
      const assistantMessage: AiAssistantMessageView = {
        role: "assistant",
        text: appendCapabilityTrace(reply.text, capabilityPrelude.trace_summary),
        context_snapshot_id: contextSnapshot.snapshot_id,
        ...(artifact ? { artifact } : {})
      };
      const nextMessages = [...previousMessages, contextualUserMessage, assistantMessage];
      setMessages(nextMessages);
      saveSession(trimmedQuestion, nextMessages, contextSnapshot, latestPageContext.page_label);
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "AI 聊天失败");
      setQuestion(trimmedQuestion);
      setMessages(previousMessages);
    } finally {
      setIsSendingChat(false);
    }
  }

  function saveSession(
    title: string,
    nextMessages: AiAssistantMessageView[],
    contextSnapshot: AssistantContextSnapshot,
    pageLabel: string
  ) {
    const existingSession = activeSessionId ? history.find((entry) => entry.id === activeSessionId) : undefined;
    const id = activeSessionId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (!activeSessionId) {
      setActiveSessionId(id);
    }
    setHistory(saveAssistantSession(window.localStorage, {
      id,
      title: existingSession?.title ?? title,
      page_label: pageLabel,
      messages: nextMessages,
      context_snapshots: appendContextSnapshot(existingSession?.context_snapshots ?? [], contextSnapshot)
    }));
  }

  function startNewSession() {
    setMessages([]);
    setQuestion("");
    setError("");
    setActiveSessionId(null);
    setIsSessionDrawerOpen(false);
    setIsContextDrawerOpen(false);
  }

  function switchSession(entry: AiAssistantHistoryEntryView) {
    setMessages(entry.messages);
    setQuestion("");
    setError("");
    setActiveSessionId(entry.id);
    setIsSessionDrawerOpen(false);
  }

  function clearHistory() {
    setHistory(clearAssistantHistory());
    setMessages([]);
    setQuestion("");
    setError("");
    setActiveSessionId(null);
  }

  function deleteSession(entryId: string) {
    if (entryId === activeSessionId) {
      return;
    }
    setHistory(removeAssistantHistoryEntry(window.localStorage, entryId));
  }

  return (
    <AiAssistantPanelView
      isConfigured
      sessionTitle={sessionTitle}
      messages={messages}
      question={question}
      error={error}
      isSending={isSendingChat}
      isLoadingAccount={props.isLoadingAccount}
      hasAccountItems={props.items.length > 0}
      history={history}
      activeSessionId={activeSessionId}
      isSessionDrawerOpen={isSessionDrawerOpen}
      isContextDrawerOpen={isContextDrawerOpen}
      contextChip={contextChip}
      context={{
        pageLabel: pageContext.page_label,
        focus: pageContext.focus,
        facts: contextFacts,
        itemCount: props.items.length,
        characterCount: props.account?.characters.length ?? 0,
        materialCount: props.account?.materials.item_count ?? 0,
        dailyLoaded: Boolean(props.daily),
        snapshotState,
        snapshotLabel
      }}
      quickPrompts={quickPrompts}
      onQuestionChange={setQuestion}
      onSubmit={() => void sendChat()}
      onQuickPrompt={(prompt) => void sendChat(prompt)}
      onLoadAccount={props.onLoadAccount}
      onConfigureAi={props.onConfigureAi}
      onClose={props.onClose}
      onStartNewSession={startNewSession}
      onToggleSessionDrawer={() => {
        setIsSessionDrawerOpen((current) => !current);
        setIsContextDrawerOpen(false);
      }}
      onToggleContextDrawer={() => {
        setIsContextDrawerOpen((current) => !current);
        setIsSessionDrawerOpen(false);
      }}
      onOpenContextDrawer={() => setIsContextDrawerOpen(true)}
      onCloseContextDrawer={() => setIsContextDrawerOpen(false)}
      onClearHistory={clearHistory}
      onSwitchSession={switchSession}
      onDeleteSession={deleteSession}
      onOpenArtifact={props.onOpenArtifact}
    />
  );
}

function appendAssistantContext(
  baseContext: string,
  capabilityContext: string,
  conversationContext: string
): string {
  const sections = [
    "application_context:",
    baseContext
  ];
  if (capabilityContext) {
    sections.push("", "controlled_read_only_capability_context:", capabilityContext);
  }
  if (conversationContext) {
    sections.push("", "conversation_context:", conversationContext);
  }
  return sections.join("\n");
}

function appendCapabilityTrace(reply: string, traceSummary: string): string {
  if (!traceSummary) return reply;
  return `${reply.trimEnd()}\n\n数据引用：${traceSummary}`;
}

function appendContextSnapshot(
  snapshots: readonly AssistantContextSnapshot[],
  snapshot: AssistantContextSnapshot
): AssistantContextSnapshot[] {
  return [
    ...snapshots.filter((entry) => entry.snapshot_id !== snapshot.snapshot_id),
    snapshot
  ].slice(-30);
}

function formatSnapshotTime(value: string | undefined): string {
  if (!value) return "待创建";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("zh-CN", { hour12: false }) : value;
}
