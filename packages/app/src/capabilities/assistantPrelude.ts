import type {
  AnyAssistantCapabilityResult,
  AssistantCapabilityCatalog,
  AssistantCapabilityInput,
  AssistantCapabilityName
} from "./contracts.js";

export type PlannedAssistantCapabilityInvocation = {
  name: AssistantCapabilityName;
  input: Record<string, unknown>;
};

export type AssistantCapabilityPrelude = {
  invocations: PlannedAssistantCapabilityInvocation[];
  results: AnyAssistantCapabilityResult[];
  errors: Array<{
    capability: AssistantCapabilityName;
    message: string;
  }>;
  prompt_context: string;
  trace_summary: string;
};

export function planAssistantCapabilityInvocations(
  question: string,
  maxInvocations = 3
): PlannedAssistantCapabilityInvocation[] {
  const normalized = question.trim();
  if (!normalized) return [];
  const invocations: PlannedAssistantCapabilityInvocation[] = [];
  const entityQuery = extractEntityQuery(normalized);
  const armorInvocation = planArmorInvocation(normalized);
  const equipmentTargetIntent = isEquipmentTargetIntent(normalized);

  if (armorInvocation) {
    invocations.push(armorInvocation);
  }

  if (!armorInvocation && !equipmentTargetIntent && /配装|方案|缺口|loadout/i.test(normalized)) {
    invocations.push({ name: "loadouts.inspect", input: {} });
  }
  if (/商人|库存|出售|售卖|卖什么|仄|xur|xûr|班西|banshee|艾达|ada|萨瓦拉|zavala|沙克斯|shaxx|浪客|drifter|拉乎尔|rahool/i.test(normalized)) {
    invocations.push({
      name: "vendors.find-offers",
      input: { query: vendorQuery(normalized, entityQuery), limit: 8 }
    });
  }
  if (/perk|特性|强化特性|词条|技能效果|是什么/i.test(normalized) && entityQuery) {
    invocations.push({ name: "manifest.search-perks", input: { query: entityQuery, limit: 8 } });
  }
  if (!armorInvocation
    && (equipmentTargetIntent || /我有|有没有|是否拥有|账号|仓库|背包|邮政官|在哪|在哪里/i.test(normalized))
    && entityQuery) {
    invocations.push({ name: "account.find-items", input: { query: entityQuery, limit: 8 } });
  }
  if (!armorInvocation && (equipmentTargetIntent || /来源|获取|怎么刷|哪里刷|哪里获取|是什么|装备|武器|护甲|异域/i.test(normalized)) && entityQuery) {
    invocations.push({ name: "manifest.search-items", input: { query: entityQuery, limit: 8 } });
  }

  return dedupeInvocations(invocations).slice(0, normalizeInvocationLimit(maxInvocations));
}

export async function runAssistantCapabilityPrelude(input: {
  catalog: AssistantCapabilityCatalog;
  question: string;
  manifestVersion?: string;
  maxInvocations?: number;
}): Promise<AssistantCapabilityPrelude> {
  const invocations = planAssistantCapabilityInvocations(input.question, input.maxInvocations);
  const results: AnyAssistantCapabilityResult[] = [];
  const errors: AssistantCapabilityPrelude["errors"] = [];

  for (const invocation of invocations) {
    try {
      results.push(await invokePlannedCapability(input.catalog, invocation, input.manifestVersion));
    } catch (error) {
      errors.push({
        capability: invocation.name,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return {
    invocations,
    results,
    errors,
    prompt_context: formatCapabilityPromptContext(results, errors),
    trace_summary: formatCapabilityTraceSummary(results, errors)
  };
}

async function invokePlannedCapability(
  catalog: AssistantCapabilityCatalog,
  invocation: PlannedAssistantCapabilityInvocation,
  manifestVersion: string | undefined
): Promise<AnyAssistantCapabilityResult> {
  const context = { caller: "ai" as const, manifest_version: manifestVersion };
  switch (invocation.name) {
    case "manifest.search-items":
      return catalog.invoke(invocation.name, invocation.input as AssistantCapabilityInput<"manifest.search-items">, context);
    case "manifest.search-perks":
      return catalog.invoke(invocation.name, invocation.input as AssistantCapabilityInput<"manifest.search-perks">, context);
    case "account.find-items":
      return catalog.invoke(invocation.name, invocation.input as AssistantCapabilityInput<"account.find-items">, context);
    case "vendors.find-offers":
      return catalog.invoke(invocation.name, invocation.input as AssistantCapabilityInput<"vendors.find-offers">, context);
    case "loadouts.inspect":
      return catalog.invoke(invocation.name, invocation.input as AssistantCapabilityInput<"loadouts.inspect">, context);
    case "armor.plan":
      return catalog.invoke(invocation.name, invocation.input as AssistantCapabilityInput<"armor.plan">, context);
  }
}

function planArmorInvocation(question: string): PlannedAssistantCapabilityInvocation | null {
  if (/敏捷|韧性|恢复|纪律|智慧|力量|mobility|resilience|recovery|discipline|intellect|strength/i.test(question)) {
    return null;
  }
  const armorClass = extractArmorClass(question);
  const target = extractArmorTarget(question);
  const targetKeys = Object.keys(target);
  const hasArmorIntent = /护甲|護甲|armor\s*3(?:\.0)?|护甲属性|護甲屬性/i.test(question)
    || targetKeys.length >= 2;
  if (!hasArmorIntent || !armorClass || targetKeys.length === 0 || /升级|升級|替换|替換/i.test(question)) {
    return null;
  }

  const mode = /待刷|刷取|还要刷|還要刷|缺几件|缺幾件|获取目标|獲取目標/i.test(question)
    ? "acquisition"
    : /理论|理論|理论上|理論上|不看库存|不看庫存/i.test(question)
      ? "theoretical"
      : "owned";
  const sharedRequest = {
    class: armorClass,
    target,
    priority_stats: targetKeys,
    limit: 3
  };
  if (mode === "theoretical") {
    return { name: "armor.plan", input: { mode, request: sharedRequest } };
  }
  if (mode === "acquisition") {
    return {
      name: "armor.plan",
      input: {
        mode,
        request: {
          ...sharedRequest,
          owned_allowed_locations: ["equipped", "inventory", "vault", "postmaster"],
          nearest_owned_limit: 2
        }
      }
    };
  }
  return {
    name: "armor.plan",
    input: {
      mode,
      request: {
        ...sharedRequest,
        allowed_locations: ["equipped", "inventory", "vault", "postmaster"],
        mode: "conservative"
      }
    }
  };
}

function extractArmorClass(question: string): "titan" | "hunter" | "warlock" | null {
  if (/泰坦|titan/i.test(question)) return "titan";
  if (/猎人|獵人|hunter/i.test(question)) return "hunter";
  if (/术士|術士|warlock/i.test(question)) return "warlock";
  return null;
}

function extractArmorTarget(question: string): Record<string, { minimum: number }> {
  const definitions = [
    { key: "health", labels: ["生命值", "health"] },
    { key: "melee", labels: ["近战", "近戰", "melee"] },
    { key: "grenade", labels: ["手雷", "grenade"] },
    { key: "super", labels: ["超能", "super"] },
    { key: "class", labels: ["职业属性", "職業屬性", "职业", "職業", "class stat", "class"] },
    { key: "weapon", labels: ["武器属性", "武器屬性", "武器", "weapon stat", "weapon"] }
  ] as const;
  const target: Record<string, { minimum: number }> = {};
  for (const definition of definitions) {
    const labelPattern = definition.labels.map(escapeRegExp).join("|");
    const match = question.match(new RegExp(`(?:${labelPattern})\\s*(?:至少|最低|达到|達到|到|>=|≥)?\\s*(\\d{1,3})`, "i"));
    if (!match?.[1]) continue;
    const minimum = Number(match[1]);
    if (Number.isFinite(minimum)) {
      target[definition.key] = { minimum };
    }
  }
  return target;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatCapabilityPromptContext(
  results: AnyAssistantCapabilityResult[],
  errors: AssistantCapabilityPrelude["errors"]
): string {
  if (!results.length && !errors.length) return "";
  return JSON.stringify({
    assistant_capability_results: results.map((result) => ({
      result_id: result.result_id,
      kind: result.kind,
      status: result.status,
      checked_at: result.checked_at,
      expires_at: result.expires_at,
      query: result.query,
      data: result.data,
      warnings: result.warnings,
      evidence: result.evidence.map((evidence) => ({
        evidence_id: evidence.evidence_id,
        kind: evidence.kind,
        label: evidence.label,
        observed_at: evidence.observed_at,
        expires_at: evidence.expires_at,
        entity: evidence.entity,
        manifest_version: evidence.manifest_version,
        result_id: evidence.result_id,
        open_target: evidence.open_target
      }))
    })),
    capability_errors: errors
  }, null, 2);
}

function formatCapabilityTraceSummary(
  results: AnyAssistantCapabilityResult[],
  errors: AssistantCapabilityPrelude["errors"]
): string {
  const references = results.map((result) => `${result.kind} ${shortResultId(result.result_id)}（${result.status}）`);
  const failures = errors.map((error) => `${error.capability} 调用失败`);
  return [...references, ...failures].join("；");
}

function extractEntityQuery(question: string): string {
  const quoted = question.match(/[“「『\"']([^”」』\"']{2,80})[”」』\"']/)?.[1]?.trim();
  if (quoted) return quoted;
  const cleaned = question
    .replace(/[，。！？?!；;：:]/g, " ")
    .replace(/帮我|请问|请|能不能|可以|当前|现在|今天|这周|本周|根据|我的|我在|我有|有没有|是否拥有|账号里|仓库里|背包里|邮政官里|账号|仓库|背包|邮政官|查询|搜索|查找|看看|分析|告诉我|哪里|在哪|怎么|如何|获取|来源|出售|售卖|卖什么|卖|库存|商人|加入|放进|作为目标|作为装备目标|装备目标|武器目标|护甲目标|候选|想刷|准备刷|想要|找一把|找一件|配装|方案|缺口|攻略里|指南里|笔记里|攻略|指南|笔记|打法|本地|里面|写了|说了|提到|关于|总结|收藏|全部|所有|列表|内容|摘要|guides|guide|notes|note|装备|武器|护甲|异域|perk|特性|强化特性|词条|是什么|有哪些|有什么|什么|是否|这个|这件|那个|那件|仄|xur|xûr|班西|banshee|艾达|ada|萨瓦拉|zavala|沙克斯|shaxx|浪客|drifter|拉乎尔|rahool|吗/gi, " ")
    .replace(/\b(?:my|local|for|about|search|find|show|tell|me|favorite|favorites|all|content|summary)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^我\s*/, "")
    .replace(/^的\s*/, "")
    .replace(/^(?:想把|把|将|用|使用)\s*/, "")
    .trim();
  if (
    cleaned.length < 2
    || /应该|哪些|什么|清理|整理|保留|推荐|优先|值得|计划/i.test(cleaned)
    || /^(pve|pvp|what|which|list)$/i.test(cleaned)
  ) {
    return "";
  }
  return cleaned.slice(0, 80);
}

function isEquipmentTargetIntent(question: string): boolean {
  return /装备目标|武器目标|护甲目标|加入配装|放进配装|作为目标|想刷|准备刷|想要|找一把|找一件|配装.*(?:使用|用)|方案.*(?:使用|用)|(?:使用|用).*配装/i.test(question);
}

function vendorQuery(question: string, entityQuery: string): string {
  const vendor = question.match(/仄|xur|xûr|班西|banshee|艾达|ada|萨瓦拉|zavala|沙克斯|shaxx|浪客|drifter|拉乎尔|rahool/i)?.[0];
  const normalizedVendor = vendor ? normalizeVendorName(vendor) : "";
  return [normalizedVendor, entityQuery].filter(Boolean).join(" ") || "*";
}

function normalizeVendorName(vendor: string): string {
  if (/^(xur|xûr)$/i.test(vendor)) return "仄";
  if (/^banshee$/i.test(vendor)) return "班西";
  if (/^ada$/i.test(vendor)) return "艾达";
  if (/^zavala$/i.test(vendor)) return "萨瓦拉";
  if (/^shaxx$/i.test(vendor)) return "沙克斯";
  if (/^drifter$/i.test(vendor)) return "浪客";
  if (/^rahool$/i.test(vendor)) return "拉乎尔";
  return vendor;
}

function dedupeInvocations(
  invocations: PlannedAssistantCapabilityInvocation[]
): PlannedAssistantCapabilityInvocation[] {
  const seen = new Set<string>();
  return invocations.filter((invocation) => {
    const key = `${invocation.name}:${JSON.stringify(invocation.input)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeInvocationLimit(value: number): number {
  if (!Number.isFinite(value)) return 3;
  return Math.min(3, Math.max(0, Math.trunc(value)));
}

function shortResultId(resultId: string): string {
  const segments = resultId.split(":");
  const suffix = segments.length > 1 ? segments.slice(-2).join(":") : resultId;
  return suffix.slice(-18);
}
