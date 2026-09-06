import type { AssistantCapabilityInvocationAudit } from "@d2-tools/app/capabilities";

const auditStorageKey = "d2-tools.assistant.capability-audit";
const maxAuditEntries = 100;

export function appendAssistantCapabilityAudit(
  entry: AssistantCapabilityInvocationAudit,
  storage = getDefaultStorage()
): void {
  if (!storage) return;
  const next = [normalizeAuditEntry(entry), ...loadAssistantCapabilityAudit(storage)]
    .filter((value): value is AssistantCapabilityInvocationAudit => Boolean(value))
    .slice(0, maxAuditEntries);
  try {
    storage.setItem(auditStorageKey, JSON.stringify(next));
  } catch {
    // Audit persistence must not affect the capability result returned to the user.
  }
}

export function loadAssistantCapabilityAudit(
  storage = getDefaultStorage()
): AssistantCapabilityInvocationAudit[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(auditStorageKey) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeAuditEntry)
      .filter((entry): entry is AssistantCapabilityInvocationAudit => Boolean(entry))
      .slice(0, maxAuditEntries);
  } catch {
    return [];
  }
}

export function formatAssistantCapabilityAuditDiagnostics(
  entries = loadAssistantCapabilityAudit(),
  limit = 30
): string {
  const selected = entries.slice(0, normalizeLimit(limit));
  return [
    "d2-tools AI 只读能力审计",
    `记录数量：${entries.length}`,
    "说明：仅包含能力名、脱敏查询摘要、结果引用、状态、耗时、警告码和证据 ID，不包含完整提示、账号装备正文或密钥。",
    "",
    ...(selected.length ? selected.map(formatAuditEntry) : ["暂无能力调用记录。"])
  ].join("\n");
}

function formatAuditEntry(entry: AssistantCapabilityInvocationAudit): string {
  const query = typeof entry.input_summary.query === "string"
    ? entry.input_summary.query
    : typeof entry.input_summary.plan_id === "string"
      ? `plan_id=${entry.input_summary.plan_id}`
      : formatStructuredInputSummary(entry.input_summary);
  return [
    `[${entry.started_at}] ${entry.capability}`,
    `result_id=${entry.result_id}`,
    `status=${entry.status}`,
    `duration_ms=${entry.duration_ms}`,
    `query=${query}`,
    `total=${entry.result_summary?.total ?? "-"}`,
    `warnings=${entry.warning_codes.join(",") || "-"}`,
    `evidence=${entry.result_summary?.evidence_ids.join(",") || "-"}`,
    `error=${entry.error_code ?? "-"}`
  ].join(" | ");
}

function formatStructuredInputSummary(
  summary: AssistantCapabilityInvocationAudit["input_summary"]
): string {
  const values = [
    typeof summary.mode === "string" ? `mode=${summary.mode}` : "",
    typeof summary.class === "string" ? `class=${summary.class}` : "",
    typeof summary.target_count === "number" ? `target_count=${summary.target_count}` : ""
  ].filter(Boolean);
  return values.join(",") || "-";
}

function normalizeAuditEntry(value: unknown): AssistantCapabilityInvocationAudit | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.result_id !== "string"
    || !isCapabilityName(record.capability)
    || !isCaller(record.caller)
    || typeof record.started_at !== "string"
    || typeof record.duration_ms !== "number"
    || !isAuditStatus(record.status)
    || !Array.isArray(record.warning_codes)
    || !record.input_summary
    || typeof record.input_summary !== "object") {
    return null;
  }
  const resultSummary = normalizeResultSummary(record.result_summary);
  return {
    result_id: record.result_id,
    capability: record.capability,
    caller: record.caller,
    started_at: record.started_at,
    duration_ms: Math.max(0, Math.trunc(record.duration_ms)),
    status: record.status,
    warning_codes: stringArray(record.warning_codes),
    input_summary: primitiveRecord(record.input_summary),
    ...(resultSummary ? { result_summary: resultSummary } : {}),
    ...(typeof record.error_code === "string" ? { error_code: record.error_code } : {})
  };
}

function normalizeResultSummary(value: unknown): AssistantCapabilityInvocationAudit["result_summary"] {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  return {
    ...(typeof record.total === "number" && Number.isFinite(record.total)
      ? { total: Math.max(0, Math.trunc(record.total)) }
      : {}),
    evidence_ids: stringArray(record.evidence_ids)
  };
}

function primitiveRecord(value: unknown): Record<string, string | number | boolean> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(
    (entry): entry is [string, string | number | boolean] => (
      typeof entry[1] === "string" || typeof entry[1] === "number" || typeof entry[1] === "boolean"
    )
  ));
}

function isCapabilityName(value: unknown): value is AssistantCapabilityInvocationAudit["capability"] {
  return value === "manifest.search-items"
    || value === "manifest.search-perks"
    || value === "account.find-items"
    || value === "vendors.find-offers"
    || value === "loadouts.inspect"
    || value === "armor.plan";
}

function isCaller(value: unknown): value is AssistantCapabilityInvocationAudit["caller"] {
  return value === "ai" || value === "diagnostics";
}

function isAuditStatus(value: unknown): value is AssistantCapabilityInvocationAudit["status"] {
  return value === "complete" || value === "partial" || value === "failed" || value === "error";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function normalizeLimit(value: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.trunc(value))) : 30;
}

function getDefaultStorage(): Pick<Storage, "getItem" | "setItem"> | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}
