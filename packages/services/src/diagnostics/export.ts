import type { ActionLogEntry } from "@d2-tools/core/actions/log";
import type { D2Config } from "@d2-tools/core/config/schema";
import type { ManifestStatus } from "@d2-tools/core/manifest/cache";
import { buildToolAuditDiagnosticText, type ToolAuditEntry } from "../tools/audit.js";

export type DiagnosticsExportInput = {
  app_version: string;
  config: D2Config;
  manifest: Partial<ManifestStatus>;
  action_log: ActionLogEntry[];
  tool_audit_log?: ToolAuditEntry[];
};

const redacted = "[已脱敏]";

export function buildDiagnosticsExport(input: DiagnosticsExportInput): string {
  return [
    "d2-tools 诊断导出",
    `版本：${input.app_version}`,
    `Manifest：${input.manifest.initialized ? "已初始化" : "未初始化"} / ${input.manifest.version ?? "-"} / ${input.manifest.language ?? input.config.data.manifest_language}`,
    `数据目录：${input.config.data.data_dir}`,
    `Bungie API Key：${redactedValue(input.config.bungie.api_key)}`,
    `Bungie Client ID：${input.config.bungie.client_id ? redacted : "-"}`,
    `Bungie Client Secret：${redactedValue(input.config.bungie.client_secret)}`,
    `Bungie Redirect URI：${input.config.bungie.redirect_uri}`,
    `AI Protocol：${input.config.ai.protocol || "-"}`,
    `AI Model：${input.config.ai.model || "-"}`,
    `AI 数据发送确认：${input.config.ai.data_sharing_consent ? "已确认" : "未确认"}`,
    `AI API Key：${redactedValue(input.config.ai.api_key)}`,
    "",
    "最近写操作：",
    ...input.action_log.slice(0, 10).map((entry) => `- ${entry.created_at} / ${entry.action} / ${entry.ok ? "成功" : "失败"} / ${entry.item_name ?? "-"} / ${entry.message ?? "-"}`),
    "",
    "最近工具调用：",
    ...(input.tool_audit_log ?? []).slice(0, 10).map((entry) => `- ${entry.created_at} / ${entry.tool} / ${entry.caller} / ${entry.ok ? "成功" : "失败"} / ${toolAuditSummary(entry)}`)
  ].join("\n");
}

function redactedValue(value: string): string {
  return value ? redacted : "-";
}

function toolAuditSummary(entry: ToolAuditEntry): string {
  const text = buildToolAuditDiagnosticText(entry);
  const inputLine = text.split(/\r?\n/).find((line) => line.startsWith("input: "));
  return inputLine?.replace(/^input: /, "") ?? "-";
}
