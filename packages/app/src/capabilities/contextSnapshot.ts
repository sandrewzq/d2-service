import type { AccountSummary } from "@d2-tools/core/account/summary";
import type {
  AnyAssistantCapabilityResult,
  AssistantCapabilityName
} from "./contracts.js";

export type AssistantContextSnapshot = {
  version: 1;
  snapshot_id: string;
  created_at: string;
  base_context_fingerprint: string;
  prompt_context_fingerprint: string;
  page: {
    key: string;
    label: string;
  };
  account_scope?: {
    membership_type: number;
    destiny_membership_id: string;
    character_ids: string[];
    vault_item_count: number;
  };
  manifest_version?: string;
  capability_results: Array<{
    result_id: string;
    kind: string;
    status: "complete" | "partial" | "failed";
    checked_at: string;
    expires_at?: string;
    warning_codes: string[];
    evidence_ids: string[];
  }>;
  failed_capabilities: AssistantCapabilityName[];
  conversation_message_count: number;
};

export type AssistantConversationMessage = {
  role: "user" | "assistant";
  text: string;
};

export function createAssistantContextSnapshot(input: {
  baseContext: string;
  promptContext: string;
  page: { key: string; label: string };
  account: AccountSummary | null;
  manifestVersion?: string;
  capabilityResults: AnyAssistantCapabilityResult[];
  failedCapabilities: AssistantCapabilityName[];
  conversationMessageCount: number;
  now?: () => string;
}): AssistantContextSnapshot {
  const createdAt = (input.now ?? (() => new Date().toISOString()))();
  const baseContextFingerprint = fingerprintAssistantBaseContext(input.baseContext);
  const promptContextFingerprint = fingerprintText(input.promptContext);
  return {
    version: 1,
    snapshot_id: `assistant-context:${createdAt}:${promptContextFingerprint}`,
    created_at: createdAt,
    base_context_fingerprint: baseContextFingerprint,
    prompt_context_fingerprint: promptContextFingerprint,
    page: {
      key: input.page.key,
      label: input.page.label
    },
    ...(input.account ? {
      account_scope: {
        membership_type: input.account.membership_type,
        destiny_membership_id: input.account.destiny_membership_id,
        character_ids: input.account.characters.map((character) => character.character_id),
        vault_item_count: input.account.vault.item_count
      }
    } : {}),
    ...(input.manifestVersion ? { manifest_version: input.manifestVersion } : {}),
    capability_results: input.capabilityResults.map((result) => ({
      result_id: result.result_id,
      kind: result.kind,
      status: result.status,
      checked_at: result.checked_at,
      expires_at: result.expires_at,
      warning_codes: result.warnings.map((warning) => warning.code),
      evidence_ids: result.evidence.map((evidence) => evidence.evidence_id)
    })),
    failed_capabilities: [...new Set(input.failedCapabilities)],
    conversation_message_count: normalizeCount(input.conversationMessageCount)
  };
}

export function fingerprintAssistantBaseContext(baseContext: string): string {
  return fingerprintText(baseContext);
}

export function isAssistantContextSnapshotCurrent(
  snapshot: AssistantContextSnapshot,
  input: { baseContext: string; manifestVersion?: string }
): boolean {
  return snapshot.base_context_fingerprint === fingerprintAssistantBaseContext(input.baseContext)
    && (snapshot.manifest_version ?? "") === (input.manifestVersion ?? "");
}

export function formatAssistantConversationHistory(
  messages: readonly AssistantConversationMessage[],
  options: { maxMessages?: number; maxCharacters?: number } = {}
): string {
  const maxMessages = normalizeBound(options.maxMessages, 12, 1, 30);
  const maxCharacters = normalizeBound(options.maxCharacters, 12_000, 1_000, 30_000);
  const selected = messages.slice(-maxMessages).map((message) => ({
    role: message.role,
    text: message.text.slice(0, 2_000)
  }));
  if (!selected.length) return "";
  while (selected.length > 1 && serializeConversationHistory(selected).length > maxCharacters) {
    selected.shift();
  }
  let serialized = serializeConversationHistory(selected);
  if (serialized.length <= maxCharacters) return serialized;
  selected[0]!.text = selected[0]!.text.slice(0, Math.max(0, maxCharacters - 500));
  serialized = serializeConversationHistory(selected);
  return serialized.length <= maxCharacters
    ? serialized
    : serializeConversationHistory([]);
}

export function normalizeAssistantContextSnapshot(value: unknown): AssistantContextSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.version !== 1
    || typeof record.snapshot_id !== "string"
    || typeof record.created_at !== "string"
    || typeof record.base_context_fingerprint !== "string"
    || typeof record.prompt_context_fingerprint !== "string"
    || !record.page
    || typeof record.page !== "object"
    || !Array.isArray(record.capability_results)
    || !Array.isArray(record.failed_capabilities)) {
    return null;
  }
  const page = record.page as Record<string, unknown>;
  if (typeof page.key !== "string" || typeof page.label !== "string") return null;

  const capabilityResults = record.capability_results.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const result = entry as Record<string, unknown>;
    if (typeof result.result_id !== "string"
      || typeof result.kind !== "string"
      || !isResultStatus(result.status)
      || typeof result.checked_at !== "string") {
      return [];
    }
    return [{
      result_id: result.result_id,
      kind: result.kind,
      status: result.status,
      checked_at: result.checked_at,
      expires_at: typeof result.expires_at === "string" ? result.expires_at : undefined,
      warning_codes: stringArray(result.warning_codes),
      evidence_ids: stringArray(result.evidence_ids)
    }];
  });

  const accountScope = normalizeAccountScope(record.account_scope);
  return {
    version: 1,
    snapshot_id: record.snapshot_id,
    created_at: record.created_at,
    base_context_fingerprint: record.base_context_fingerprint,
    prompt_context_fingerprint: record.prompt_context_fingerprint,
    page: { key: page.key, label: page.label },
    ...(accountScope ? { account_scope: accountScope } : {}),
    ...(typeof record.manifest_version === "string" ? { manifest_version: record.manifest_version } : {}),
    capability_results: capabilityResults,
    failed_capabilities: stringArray(record.failed_capabilities).filter(isCapabilityName),
    conversation_message_count: normalizeCount(record.conversation_message_count)
  };
}

function normalizeAccountScope(value: unknown): AssistantContextSnapshot["account_scope"] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.membership_type !== "number"
    || typeof record.destiny_membership_id !== "string"
    || !Array.isArray(record.character_ids)) {
    return undefined;
  }
  return {
    membership_type: record.membership_type,
    destiny_membership_id: record.destiny_membership_id,
    character_ids: stringArray(record.character_ids),
    vault_item_count: normalizeCount(record.vault_item_count)
  };
}

function serializeConversationHistory(messages: readonly AssistantConversationMessage[]): string {
  return JSON.stringify({
    conversation_history: messages,
    note: "历史对话仅用于理解追问，不覆盖本轮确定性能力结果和当前页面事实。"
  }, null, 2);
}

function isResultStatus(value: unknown): value is "complete" | "partial" | "failed" {
  return value === "complete" || value === "partial" || value === "failed";
}

function isCapabilityName(value: string): value is AssistantCapabilityName {
  return value === "manifest.search-items"
    || value === "manifest.search-perks"
    || value === "account.find-items"
    || value === "vendors.find-offers"
    || value === "loadouts.inspect"
    || value === "armor.plan";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function normalizeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}

function normalizeBound(value: number | undefined, fallback: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(value!)));
}

function fingerprintText(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
