import type { AssistantContextSnapshot } from "./contextSnapshot.js";
import type {
  AnyAssistantCapabilityResult,
  AccountFoundItem,
  ArmorPlanCandidate,
  ArmorPlanOutput,
  AssistantCapabilityResult,
  ManifestSearchItem
} from "./contracts.js";

export type AssistantGuideCaptureArtifact = {
  version: 1;
  artifact_id: string;
  kind: "guide_capture";
  status: "draft";
  title: string;
  raw_text: string;
  created_at: string;
  source_snapshot_id: string;
  result_ids: string[];
};

export type AssistantArmorSolutionComparisonArtifact = {
  version: 1;
  artifact_id: string;
  kind: "armor_solution_comparison";
  status: "draft";
  title: string;
  raw_text: string;
  created_at: string;
  source_snapshot_id: string;
  result_ids: string[];
  source_result_id: string;
  mode: ArmorPlanOutput["mode"];
  outcome: ArmorPlanOutput["outcome"];
  target: ArmorPlanOutput["target"];
  candidate_count: number;
  reachable_candidate_count: number;
  candidates: Array<Pick<
    ArmorPlanCandidate,
    | "candidate_id"
    | "kind"
    | "hard_constraints_met"
    | "final_stats"
    | "total_gap"
    | "maximum_gap"
    | "armor_set_satisfied"
    | "transfer_count"
    | "replacement_count"
    | "missing_piece_count"
  >>;
};

export type AssistantEquipmentTargetCandidate = {
  candidate_id: string;
  item_hash: number;
  instance_id?: string;
  name: string;
  item_type?: string;
  group_key: "weapons" | "armor" | "equipment";
  bucket_name?: string;
  status: "owned-instance" | "definition-only";
  location?: AccountFoundItem["location"];
  source_result_id: string;
};

export type AssistantEquipmentTargetCandidatesArtifact = {
  version: 1;
  artifact_id: string;
  kind: "equipment_target_candidates";
  status: "draft";
  title: string;
  raw_text: string;
  created_at: string;
  source_snapshot_id: string;
  result_ids: string[];
  candidate_count: number;
  candidates: AssistantEquipmentTargetCandidate[];
};

export type AssistantArtifact =
  | AssistantGuideCaptureArtifact
  | AssistantArmorSolutionComparisonArtifact
  | AssistantEquipmentTargetCandidatesArtifact;

export type AssistantLoadoutArtifact = AssistantArtifact;

export function createAssistantGuideCaptureArtifact(input: {
  question: string;
  reply: string;
  snapshot: AssistantContextSnapshot;
}): AssistantGuideCaptureArtifact | null {
  const question = input.question.trim();
  const reply = stripVisibleCapabilityTrace(input.reply).trim();
  if (!question
    || !reply
    || !isGuideCaptureIntent(question)
    || isGuideLookupIntent(question)
    || isEquipmentTargetIntent(question)) return null;
  return {
    version: 1,
    artifact_id: `assistant-artifact:${input.snapshot.snapshot_id}:guide-capture`,
    kind: "guide_capture",
    status: "draft",
    title: truncateTitle(question),
    raw_text: [
      "AI 工作台目标：",
      question,
      "",
      "AI 工作台整理：",
      reply
    ].join("\n"),
    created_at: input.snapshot.created_at,
    source_snapshot_id: input.snapshot.snapshot_id,
    result_ids: input.snapshot.capability_results.map((result) => result.result_id)
  };
}

export function normalizeAssistantGuideCaptureArtifact(value: unknown): AssistantGuideCaptureArtifact | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.version !== 1
    || record.kind !== "guide_capture"
    || record.status !== "draft"
    || typeof record.artifact_id !== "string"
    || typeof record.title !== "string"
    || typeof record.raw_text !== "string"
    || typeof record.created_at !== "string"
    || typeof record.source_snapshot_id !== "string"
    || !Array.isArray(record.result_ids)) {
    return null;
  }
  return {
    version: 1,
    artifact_id: record.artifact_id,
    kind: "guide_capture",
    status: "draft",
    title: record.title,
    raw_text: record.raw_text,
    created_at: record.created_at,
    source_snapshot_id: record.source_snapshot_id,
    result_ids: record.result_ids.filter((result): result is string => typeof result === "string")
  };
}

export function createAssistantArmorSolutionComparisonArtifact(input: {
  question: string;
  snapshot: AssistantContextSnapshot;
  capabilityResults: readonly AnyAssistantCapabilityResult[];
}): AssistantArmorSolutionComparisonArtifact | null {
  const result = input.capabilityResults.find((entry) => entry.kind === "armor.plan") as
    | AssistantCapabilityResult<"armor.plan">
    | undefined;
  if (!result || result.status === "failed" || !result.data.candidates.length) return null;
  const data = result.data;
  return {
    version: 1,
    artifact_id: `assistant-artifact:${input.snapshot.snapshot_id}:armor-solution-comparison`,
    kind: "armor_solution_comparison",
    status: "draft",
    title: truncateTitle(input.question.trim() || "Armor 3.0 护甲方案"),
    raw_text: formatArmorComparisonHandoff(result),
    created_at: input.snapshot.created_at,
    source_snapshot_id: input.snapshot.snapshot_id,
    result_ids: [result.result_id],
    source_result_id: data.source_result_id,
    mode: data.mode,
    outcome: data.outcome,
    target: data.target.map((target) => ({ ...target })),
    candidate_count: data.total,
    reachable_candidate_count: data.reachable_total,
    candidates: data.candidates.map((candidate) => ({
      candidate_id: candidate.candidate_id,
      kind: candidate.kind,
      hard_constraints_met: candidate.hard_constraints_met,
      final_stats: { ...candidate.final_stats },
      total_gap: candidate.total_gap,
      maximum_gap: candidate.maximum_gap,
      armor_set_satisfied: candidate.armor_set_satisfied,
      ...(candidate.transfer_count === undefined ? {} : { transfer_count: candidate.transfer_count }),
      ...(candidate.replacement_count === undefined ? {} : { replacement_count: candidate.replacement_count }),
      ...(candidate.missing_piece_count === undefined ? {} : { missing_piece_count: candidate.missing_piece_count })
    }))
  };
}

export function normalizeAssistantArmorSolutionComparisonArtifact(
  value: unknown
): AssistantArmorSolutionComparisonArtifact | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.version !== 1
    || record.kind !== "armor_solution_comparison"
    || record.status !== "draft"
    || typeof record.artifact_id !== "string"
    || typeof record.title !== "string"
    || typeof record.raw_text !== "string"
    || typeof record.created_at !== "string"
    || typeof record.source_snapshot_id !== "string"
    || typeof record.source_result_id !== "string"
    || !isArmorPlanMode(record.mode)
    || !isArmorPlanOutcome(record.outcome)
    || !Array.isArray(record.result_ids)
    || !Array.isArray(record.target)
    || !Array.isArray(record.candidates)) {
    return null;
  }
  return {
    version: 1,
    artifact_id: record.artifact_id,
    kind: "armor_solution_comparison",
    status: "draft",
    title: record.title,
    raw_text: record.raw_text,
    created_at: record.created_at,
    source_snapshot_id: record.source_snapshot_id,
    result_ids: stringArray(record.result_ids),
    source_result_id: record.source_result_id,
    mode: record.mode,
    outcome: record.outcome,
    target: normalizeArmorTargets(record.target),
    candidate_count: normalizeCount(record.candidate_count),
    reachable_candidate_count: normalizeCount(record.reachable_candidate_count),
    candidates: normalizeArmorCandidates(record.candidates)
  };
}

export function createAssistantEquipmentTargetCandidatesArtifact(input: {
  question: string;
  snapshot: AssistantContextSnapshot;
  capabilityResults: readonly AnyAssistantCapabilityResult[];
}): AssistantEquipmentTargetCandidatesArtifact | null {
  if (!isEquipmentTargetIntent(input.question)) return null;
  const accountResults = input.capabilityResults.filter((entry) => entry.kind === "account.find-items") as
    AssistantCapabilityResult<"account.find-items">[];
  const manifestResults = input.capabilityResults.filter((entry) => entry.kind === "manifest.search-items") as
    AssistantCapabilityResult<"manifest.search-items">[];
  const candidates = collectEquipmentTargetCandidates(accountResults, manifestResults).slice(0, 8);
  if (!candidates.length) return null;
  const resultIds = uniqueStrings(candidates.map((candidate) => candidate.source_result_id));
  return {
    version: 1,
    artifact_id: `assistant-artifact:${input.snapshot.snapshot_id}:equipment-target-candidates`,
    kind: "equipment_target_candidates",
    status: "draft",
    title: truncateTitle(input.question.trim() || "装备目标候选"),
    raw_text: [
      "AI 工作台装备目标候选：",
      ...candidates.map((candidate, index) => (
        `${index + 1}. ${candidate.name}（${candidate.status === "owned-instance" ? "账号实例" : "装备定义"}）`
      )),
      "",
      "请在配装页选择要保留的候选和目标角色；未拥有的定义只作为目标，不会伪造实例。"
    ].join("\n"),
    created_at: input.snapshot.created_at,
    source_snapshot_id: input.snapshot.snapshot_id,
    result_ids: resultIds,
    candidate_count: candidates.length,
    candidates
  };
}

export function normalizeAssistantEquipmentTargetCandidatesArtifact(
  value: unknown
): AssistantEquipmentTargetCandidatesArtifact | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.version !== 1
    || record.kind !== "equipment_target_candidates"
    || record.status !== "draft"
    || typeof record.artifact_id !== "string"
    || typeof record.title !== "string"
    || typeof record.raw_text !== "string"
    || typeof record.created_at !== "string"
    || typeof record.source_snapshot_id !== "string"
    || !Array.isArray(record.result_ids)
    || !Array.isArray(record.candidates)) {
    return null;
  }
  const candidates = normalizeEquipmentTargetCandidates(record.candidates);
  const resultIds = uniqueStrings([
    ...stringArray(record.result_ids),
    ...candidates.map((candidate) => candidate.source_result_id)
  ]);
  return {
    version: 1,
    artifact_id: record.artifact_id,
    kind: "equipment_target_candidates",
    status: "draft",
    title: record.title,
    raw_text: record.raw_text,
    created_at: record.created_at,
    source_snapshot_id: record.source_snapshot_id,
    result_ids: resultIds,
    candidate_count: candidates.length,
    candidates
  };
}

export function normalizeAssistantArtifact(value: unknown): AssistantArtifact | null {
  return normalizeAssistantGuideCaptureArtifact(value)
    ?? normalizeAssistantArmorSolutionComparisonArtifact(value)
    ?? normalizeAssistantEquipmentTargetCandidatesArtifact(value);
}

function isGuideCaptureIntent(question: string): boolean {
  return /攻略|配装|build|构筑|护甲方案|装备方案|整理计划|生成方案/i.test(question);
}

function isGuideLookupIntent(question: string): boolean {
  return /(?:搜索|查找|查询|列出|列表|打开).*(?:攻略|指南|笔记)|(?:攻略|指南|笔记)里|(?:攻略|指南|笔记).*(?:内容|写了什么|说了什么)|有哪些.*(?:攻略|指南|笔记)|what\s+(?:guides|notes)|(?:search|find|list|show).*(?:guides|notes)/i.test(question);
}

function isEquipmentTargetIntent(question: string): boolean {
  return /装备目标|武器目标|护甲目标|加入配装|放进配装|作为目标|候选|想刷|准备刷|想要|找一把|找一件|配装.*(?:使用|用)|方案.*(?:使用|用)|(?:使用|用).*配装/i.test(question);
}

function stripVisibleCapabilityTrace(reply: string): string {
  return reply.replace(/\n\n数据引用：[^\n]*\s*$/u, "");
}

function truncateTitle(question: string): string {
  return question.length <= 48 ? question : `${question.slice(0, 47)}…`;
}

function formatArmorComparisonHandoff(
  result: AssistantCapabilityResult<"armor.plan">
): string {
  const data = result.data;
  const armorClass = formatArmorClass(result.query.request.class);
  return [
    "AI 工作台护甲目标：",
    `职业：${armorClass}`,
    ...data.target.map(formatArmorTargetHandoff),
    `规划模式：${formatArmorMode(data.mode)}`,
    "",
    `确定性结果：${formatArmorOutcome(data.outcome)}，共 ${data.total} 个候选，其中 ${data.reachable_total} 个满足硬约束。`,
    ...data.candidates.map((candidate, index) => (
      `候选 ${index + 1}：${candidate.hard_constraints_met ? "满足硬约束" : "未满足硬约束"}；总缺口 ${candidate.total_gap}；候选 ID ${candidate.candidate_id}`
    )),
    "",
    `Armor 能力结果：${result.result_id}`,
    `底层规划结果：${data.source_result_id}`,
    "请在配装页重新核对职业、六维、模组预算、套装、位置范围和真实实例后再保存。"
  ].join("\n");
}

function normalizeArmorTargets(value: unknown[]): AssistantArmorSolutionComparisonArtifact["target"] {
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    if (!isArmorStatKey(record.key)) return [];
    const minimum = finiteNumber(record.minimum);
    const maximum = finiteNumber(record.maximum);
    const exact = finiteNumber(record.exact);
    return [{
      key: record.key,
      ...(minimum === undefined ? {} : { minimum }),
      ...(maximum === undefined ? {} : { maximum }),
      ...(exact === undefined ? {} : { exact })
    }];
  });
}

function normalizeArmorCandidates(
  value: unknown[]
): AssistantArmorSolutionComparisonArtifact["candidates"] {
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    if (typeof record.candidate_id !== "string"
      || !isArmorPlanMode(record.kind)
      || typeof record.hard_constraints_met !== "boolean"
      || !record.final_stats
      || typeof record.final_stats !== "object") {
      return [];
    }
    const transferCount = finiteNumber(record.transfer_count);
    const replacementCount = finiteNumber(record.replacement_count);
    const missingPieceCount = finiteNumber(record.missing_piece_count);
    return [{
      candidate_id: record.candidate_id,
      kind: record.kind,
      hard_constraints_met: record.hard_constraints_met,
      final_stats: normalizeArmorStatValues(record.final_stats),
      total_gap: normalizeCount(record.total_gap),
      maximum_gap: normalizeCount(record.maximum_gap),
      armor_set_satisfied: record.armor_set_satisfied === true,
      ...(transferCount === undefined ? {} : { transfer_count: normalizeCount(transferCount) }),
      ...(replacementCount === undefined ? {} : { replacement_count: normalizeCount(replacementCount) }),
      ...(missingPieceCount === undefined ? {} : { missing_piece_count: normalizeCount(missingPieceCount) })
    }];
  });
}

function normalizeArmorStatValues(value: object): ArmorPlanCandidate["final_stats"] {
  const record = value as Record<string, unknown>;
  return {
    health: normalizeCount(record.health),
    melee: normalizeCount(record.melee),
    grenade: normalizeCount(record.grenade),
    super: normalizeCount(record.super),
    class: normalizeCount(record.class),
    weapon: normalizeCount(record.weapon)
  };
}

function collectEquipmentTargetCandidates(
  accountResults: readonly AssistantCapabilityResult<"account.find-items">[],
  manifestResults: readonly AssistantCapabilityResult<"manifest.search-items">[]
): AssistantEquipmentTargetCandidate[] {
  const candidates: AssistantEquipmentTargetCandidate[] = [];
  const ownedHashes = new Set<number>();
  const seenIds = new Set<string>();

  for (const result of accountResults) {
    if (result.status === "failed") continue;
    for (const item of result.data.items) {
      if (!item.instance_id || !isEquipmentGroup(item.group_key)) continue;
      const candidateId = `equipment-target:${result.result_id}:instance:${item.instance_id}`;
      if (seenIds.has(candidateId)) continue;
      seenIds.add(candidateId);
      ownedHashes.add(item.hash);
      candidates.push({
        candidate_id: candidateId,
        item_hash: item.hash,
        instance_id: item.instance_id,
        name: item.name,
        item_type: item.item_type,
        group_key: item.group_key,
        bucket_name: item.bucket_name,
        status: "owned-instance",
        location: { ...item.location },
        source_result_id: result.result_id
      });
    }
  }

  for (const result of manifestResults) {
    if (result.status === "failed") continue;
    for (const item of result.data.items) {
      if (!isEquipmentGroup(item.group_key) || ownedHashes.has(item.hash)) continue;
      const candidateId = `equipment-target:${result.result_id}:definition:${item.hash}`;
      if (seenIds.has(candidateId)) continue;
      seenIds.add(candidateId);
      candidates.push(projectManifestTargetCandidate(item, result.result_id, candidateId));
    }
  }
  return candidates;
}

function projectManifestTargetCandidate(
  item: ManifestSearchItem,
  resultId: string,
  candidateId: string
): AssistantEquipmentTargetCandidate {
  return {
    candidate_id: candidateId,
    item_hash: item.hash,
    name: item.name,
    item_type: item.item_type,
    group_key: item.group_key as AssistantEquipmentTargetCandidate["group_key"],
    bucket_name: item.bucket_name,
    status: "definition-only",
    source_result_id: resultId
  };
}

function normalizeEquipmentTargetCandidates(
  value: unknown[]
): AssistantEquipmentTargetCandidate[] {
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    if (typeof record.candidate_id !== "string"
      || typeof record.item_hash !== "number"
      || !Number.isFinite(record.item_hash)
      || typeof record.name !== "string"
      || !isEquipmentGroup(record.group_key)
      || (record.status !== "owned-instance" && record.status !== "definition-only")
      || (record.status === "owned-instance" && typeof record.instance_id !== "string")
      || typeof record.source_result_id !== "string") {
      return [];
    }
    const location = normalizeAccountLocation(record.location);
    return [{
      candidate_id: record.candidate_id,
      item_hash: Math.trunc(record.item_hash),
      ...(typeof record.instance_id === "string" ? { instance_id: record.instance_id } : {}),
      name: record.name,
      ...(typeof record.item_type === "string" ? { item_type: record.item_type } : {}),
      group_key: record.group_key,
      ...(typeof record.bucket_name === "string" ? { bucket_name: record.bucket_name } : {}),
      status: record.status,
      ...(location ? { location } : {}),
      source_result_id: record.source_result_id
    }];
  });
}

function normalizeAccountLocation(value: unknown): AccountFoundItem["location"] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (record.kind !== "equipped" && record.kind !== "inventory"
    && record.kind !== "vault" && record.kind !== "postmaster") {
    return undefined;
  }
  return {
    kind: record.kind,
    ...(typeof record.character_id === "string" ? { character_id: record.character_id } : {}),
    ...(typeof record.character_name === "string" ? { character_name: record.character_name } : {})
  };
}

function isEquipmentGroup(value: unknown): value is AssistantEquipmentTargetCandidate["group_key"] {
  return value === "weapons" || value === "armor" || value === "equipment";
}

function isArmorPlanMode(value: unknown): value is ArmorPlanOutput["mode"] {
  return value === "theoretical" || value === "owned" || value === "acquisition" || value === "upgrade";
}

function isArmorPlanOutcome(value: unknown): value is ArmorPlanOutput["outcome"] {
  return value === "reachable" || value === "unreachable" || value === "indeterminate" || value === "invalid";
}

function isArmorStatKey(value: unknown): value is ArmorPlanOutput["target"][number]["key"] {
  return value === "health" || value === "melee" || value === "grenade"
    || value === "super" || value === "class" || value === "weapon";
}

function formatArmorClass(value: string): string {
  if (value === "titan") return "泰坦";
  if (value === "hunter") return "猎人";
  if (value === "warlock") return "术士";
  return value;
}

function formatArmorMode(value: ArmorPlanOutput["mode"]): string {
  if (value === "theoretical") return "理论上限";
  if (value === "acquisition") return "待刷目标";
  if (value === "upgrade") return "升级路径";
  return "库存成装";
}

function formatArmorOutcome(value: ArmorPlanOutput["outcome"]): string {
  if (value === "reachable") return "可达";
  if (value === "unreachable") return "不可达";
  if (value === "indeterminate") return "尚不能确定";
  return "输入无效";
}

function formatArmorStat(value: ArmorPlanOutput["target"][number]["key"]): string {
  return {
    health: "生命值",
    melee: "近战",
    grenade: "手雷",
    super: "超能",
    class: "职业",
    weapon: "武器"
  }[value];
}

function formatArmorTargetHandoff(target: ArmorPlanOutput["target"][number]): string {
  const label = formatArmorStat(target.key);
  if (target.exact !== undefined) return `精确目标（需手动确认）：${label}=${target.exact}`;
  if (target.maximum !== undefined && target.minimum === undefined) {
    return `上限目标（需手动确认）：${label}<=${target.maximum}`;
  }
  return `${label} ${target.minimum ?? 0}`;
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

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
