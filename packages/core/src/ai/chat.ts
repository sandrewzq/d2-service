import { analyzeVault, type VaultAnalysisResult } from "../analysis/vault.js";
import type { AccountItemSummary } from "../account/summary.js";
import type { AccountSummary } from "../account/summary.js";
import type { ActivityHistorySummary } from "../activities/history.js";
import type { D2Config } from "../config/schema.js";
import type { DailySummary } from "../daily/summary.js";
import type { VaultTags } from "../vault/tags.js";
import type { WeaponRecommendation } from "../community-perks/types.js";
import type { PersonalWeaponKnowledgeEntry } from "../community-perks/personalWeaponKnowledge.js";
import {
  aiProtocolBaseUrls,
  normalizeAiSettings,
  type AiProtocol,
  type NormalizedAiSettings
} from "./settings.js";

export type VaultAiAdviceInput = {
  config: D2Config;
  items: AccountItemSummary[];
  tags: VaultTags;
  fetcher?: typeof fetch;
};

export type VaultAiAdviceResult = {
  local: VaultAnalysisResult;
  ai: {
    provider: string;
    model: string;
    text: string;
    sections: AiAdviceSections;
  } | null;
  skipped_reason?: string;
};

export type ItemAiAdviceInput = {
  config: D2Config;
  item: AccountItemSummary & {
    bucket_name?: string;
    item_type?: string;
    description?: string;
    note?: string;
  };
  tags: VaultTags;
  user_knowledge?: string;
  personal_knowledge?: PersonalWeaponKnowledgeEntry[];
  builtin_knowledge?: WeaponRecommendation | null;
  allow_external_search?: boolean;
  weapon_context?: {
    object_kind: "definition" | "vendor_offer" | "account_instance";
    official_sources: string[];
    definition_stats?: Record<string, number>;
    current_stats?: Record<string, number>;
    configuration_kind?: "fixed_exotic" | "variable_exotic" | "random_roll" | "fixed";
    fixed_perks?: Array<{ socket_index: number; names: string[] }>;
    configuration_options?: Array<{ socket_index: number; names: string[] }>;
    perk_pool?: Array<{ socket_index: number; names: string[] }>;
    catalyst?: {
      name: string;
      acquired?: boolean;
      complete: boolean;
      progress?: number;
      objective?: string;
      acquisition?: string;
      effects: string[];
    };
    same_hash_instances?: Array<{ location: string; power?: number; plugs: string[] }>;
    offer?: { vendor_name: string; cost: string; affordability: string; refresh: string };
  };
  fetcher?: typeof fetch;
};

export type ItemAiAdviceResult = {
  ai: {
    provider: string;
    model: string;
    text: string;
    sections: AiAdviceSections;
    external_search?: {
      requested: boolean;
      used: boolean;
      message: string;
      sources: AiExternalSource[];
    };
  } | null;
  skipped_reason?: string;
};

export type AiChatContextInput = {
  account: AccountSummary | null;
  tags: VaultTags;
  daily: DailySummary | null;
  activity: ActivityHistorySummary | null;
  pageContext?: AiChatPageContext | null;
};

export type AiChatPageContext = {
  page_key: string;
  page_label: string;
  focus: string;
  facts: string[];
};

export type AiChatReplyInput = {
  config: D2Config;
  question: string;
  context: string;
  fetcher?: typeof fetch;
};

export type AiChatReplyResult = {
  provider: string;
  model: string;
  text: string;
};

export type AiConnectionTestResult = {
  ok: true;
  protocol: string;
  model: string;
  message: string;
};

export type AiModelListResult = {
  protocol: string;
  models: string[];
  source: "remote" | "fallback";
  message: string;
};

type ChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      text?: string;
      annotations?: Array<{
        type?: string;
        url?: string;
        title?: string;
      }>;
    }>;
  }>;
  content?: Array<{
    type?: string;
    text?: string;
  }>;
  error?: {
    message?: string;
  };
};

type AiPromptMessage = {
  role: "system" | "user";
  content: string;
};

export type AiAdviceSections = {
  facts: string[];
  analysis: string[];
  suggestions: string[];
  action_reminders: string[];
  raw: string;
};

const fallbackModels: Record<AiProtocol, string[]> = {
  openai_responses: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini"],
  openai_chat_completions: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini", "deepseek-chat"],
  anthropic_messages: ["claude-sonnet-4-5", "claude-opus-4-1", "claude-3-5-haiku-latest"]
};

export async function generateVaultAiAdvice(input: VaultAiAdviceInput): Promise<VaultAiAdviceResult> {
  const local = analyzeVault({
    items: input.items,
    tags: input.tags
  });
  const settings = normalizeAiSettings(input.config.ai);

  if (!settings.protocol) {
    return {
      local,
      ai: null,
      skipped_reason: "AI 未启用。"
    };
  }

  if (!settings.api_key) {
    throw new Error("请先填写 AI API Key。");
  }
  if (!settings.model) {
    throw new Error("请先填写 AI 模型名称。");
  }
  assertAiDataSharingConsent(settings);

  const text = await callAiText({
    settings,
    messages: [
      {
        role: "system",
        content: [
          "你是一个命运2装备分析助手。",
          "只根据用户提供的仓库事实、实际 roll 和本地标记给建议。",
          "不要编造未提供的 perk 或外部数据库结论。",
          "输出中文，固定分为：事实、分析、建议、操作提醒。"
        ].join("\n")
      },
      {
        role: "user",
        content: buildVaultPrompt(local)
      }
    ],
    temperature: 0.2,
    fetcher: input.fetcher
  });

  return {
    local,
    ai: {
      provider: settings.protocol,
      model: settings.model,
      text,
      sections: extractAiSections(text)
    }
  };
}

export async function generateItemAiAdvice(input: ItemAiAdviceInput): Promise<ItemAiAdviceResult> {
  const settings = normalizeAiSettings(input.config.ai);

  if (!settings.protocol) {
    return {
      ai: null,
      skipped_reason: "AI 未启用。"
    };
  }

  if (!settings.api_key) {
    throw new Error("请先填写 AI API Key。");
  }
  if (!settings.model) {
    throw new Error("请先填写 AI 模型名称。");
  }
  assertAiDataSharingConsent(settings);

  let externalSearch: AiWebSearchResult | undefined;
  let externalSearchMessage = "未请求外部知识。";
  if (input.allow_external_search) {
    if (supportsAiWebSearch(input.config.ai)) {
      try {
        externalSearch = await callAiWithWebSearch({
          config: input.config,
          query: buildExternalWeaponSearchQuery(input),
          fetcher: input.fetcher
        });
        externalSearchMessage = externalSearch.sources.length
          ? `已查询 ${externalSearch.sources.length} 个外部来源。`
          : "已查询外部知识，但服务没有返回可追溯链接；结果仅作为 AI 推测。";
      } catch (error) {
        externalSearchMessage = error instanceof Error ? error.message : "外部知识查询失败。";
      }
    } else {
      externalSearchMessage = "当前 AI 配置不支持可追溯的外部知识查询，已继续使用用户知识和内置知识库。";
    }
  }

  const text = await callAiText({
    settings,
    messages: [
      {
        role: "system",
        content: [
          "你是一个命运2单件装备分析助手。",
          "用户指定知识的优先级最高，其次是输入中提供的本地知识和官方数据。",
          "已保存的个人推荐优先于应用推荐；不同来源冲突时必须明确指出。",
          "外部搜索内容优先级最低，只能补充用户知识和内置知识库缺失的字段。",
          "外部搜索不得修改或推断 Bungie 官方获取来源；没有可追溯链接时必须标记为 AI 推测。",
          "用户本次输入只对当前分析生效，除非界面另行获得明确确认，否则不得声称已经保存。",
          "只根据用户提供的装备信息、实际 roll、本地标签给建议。",
          "不要编造未提供的 perk、来源或外部数据库结论。",
          "输出中文，固定分为：事实、分析、建议、操作提醒。"
        ].join("\n")
      },
      {
        role: "user",
        content: [
          buildItemPrompt(input.item),
          input.user_knowledge?.trim()
            ? `\n用户指定知识（最高优先级）：\n${input.user_knowledge.trim()}`
            : "",
          formatPersonalWeaponKnowledge(input.personal_knowledge),
          formatBuiltinWeaponKnowledge(input.builtin_knowledge),
          externalSearch?.text ? `\nAI 外部搜索补充（最低优先级）：\n${externalSearch.text}` : "",
          input.weapon_context ? `\n武器详情上下文：\n${JSON.stringify(sanitizeAiContextValue(input.weapon_context), null, 2)}` : ""
        ].filter(Boolean).join("\n")
      }
    ],
    temperature: 0.2,
    fetcher: input.fetcher
  });

  return {
    ai: {
      provider: settings.protocol,
      model: settings.model,
      text,
      sections: extractAiSections(text),
      external_search: {
        requested: Boolean(input.allow_external_search),
        used: Boolean(externalSearch),
        message: externalSearchMessage,
        sources: externalSearch?.sources ?? []
      }
    }
  };
}

function buildExternalWeaponSearchQuery(input: ItemAiAdviceInput): string {
  return [
    `查询 Destiny 2 武器“${input.item.name}”的当前玩法建议。`,
    "只补充推荐 Roll、武器模组、大师杰作和使用方式，不判断或修改官方获取来源。",
    "优先引用 Bungie 官方资料；其他网页必须给出可追溯链接并区分事实与作者观点。",
    input.user_knowledge?.trim() ? `用户当前问题：${input.user_knowledge.trim()}` : "",
    "用中文总结，并明确网页标题和链接。"
  ].filter(Boolean).join("\n");
}

function formatPersonalWeaponKnowledge(entries: PersonalWeaponKnowledgeEntry[] | undefined): string {
  const enabled = (entries ?? []).filter((entry) => entry.enabled);
  if (!enabled.length) return "";
  return `\n已保存的我的推荐（高于应用推荐）：\n${JSON.stringify(enabled.map((entry) => ({
    mode: entry.mode,
    title: entry.title,
    perk_options: entry.perk_options,
    masterwork_names: entry.masterwork_names,
    mod_names: entry.mod_names,
    reason: entry.reason,
    origin: entry.origin,
    external_url: entry.external_url
  })), null, 2)}`;
}

function formatBuiltinWeaponKnowledge(recommendation: WeaponRecommendation | null | undefined): string {
  if (!recommendation) return "";
  return `\n应用推荐（仅在用户知识未覆盖时使用）：\n${JSON.stringify({
    source_label: recommendation.source_label,
    combos: recommendation.combos
      .filter((combo) => combo.source === "local_community")
      .map((combo) => ({
        mode: combo.mode,
        perks: combo.perks.map((perk) => perk.name),
        note: combo.note,
        source: combo.source
      })),
    disclaimer: recommendation.disclaimer
  }, null, 2)}`;
}

export function buildAiChatContext(input: AiChatContextInput): string {
  const account = input.account;
  const itemNamesByLocalKey = buildItemNamesByLocalKey(account);
  const context = {
    safety: {
      note: "AI 只能建议，不能直接执行锁定、转移、装备或分解。所有写操作都必须由用户在 GUI 中确认。",
      credential_policy: "上下文只包含游戏数据摘要，不包含账号名称、Membership ID、角色 ID、装备实例 ID、物品 Hash、本地密钥、授权票据或应用密钥。"
    },
    current_page: input.pageContext ?? null,
    account: account ? {
      characters: account.characters.map((character) => ({
        class_name: character.class_name,
        light: character.light,
        equipped_items: summarizeChatItems(character.equipped_items),
        inventory_items: summarizeChatItems(character.inventory_items),
        postmaster_items: summarizeChatItems(character.postmaster_items),
        loadout_slots: character.loadout_slots.map((slot) => ({
          index: slot.index,
          name: slot.name,
          item_count: slot.item_count,
          items: slot.items.map((item) => ({
            name: item.name,
            bucket: item.bucket_name,
            plugs: item.plugs?.map((plug) => plug.name).filter(Boolean) ?? []
          }))
        }))
      })),
      vault: {
        item_count: account.vault.item_count,
        items: summarizeChatItems(account.vault.items)
      },
      materials: account.materials.items.map((material) => ({
        name: material.name,
        quantity: material.quantity,
        tier: material.tier,
        type: material.item_type
      }))
    } : null,
    tags: Object.entries(input.tags.items).map(([itemKey, value]) => ({
      item: itemNamesByLocalKey.get(itemKey) ?? "未关联装备",
      tag: value.tag,
      note: value.note
    })),
    daily: input.daily ? {
      date_label: input.daily.date_label,
      daily_reset: input.daily.daily_reset,
      weekly_reset: input.daily.weekly_reset,
      sources: input.daily.sources,
      checklist: input.daily.checklist,
      recommendations: input.daily.recommendations
    } : null,
    activity: input.activity
  };

  return JSON.stringify(sanitizeAiContextValue(context), null, 2);
}

export async function generateAiChatReply(input: AiChatReplyInput): Promise<AiChatReplyResult> {
  const settings = normalizeAiSettings(input.config.ai);

  if (!settings.protocol) {
    throw new Error("请先选择 AI API 格式。");
  }
  if (!settings.api_key) {
    throw new Error("请先填写 AI API Key。");
  }
  if (!settings.model) {
    throw new Error("请先填写 AI 模型名称。");
  }
  assertAiDataSharingConsent(settings);

  const text = await callAiText({
    settings,
    messages: [
      {
        role: "system",
        content: [
          "你是 d2-tools 的命运2中文 GUI 助手。",
          "只根据用户提供的上下文回答，不要编造外部数据。",
          "如果数据未接入或不可确认，明确说明不可确认。",
          "assistant_capability_results 是本轮已执行的受控只读能力结果，其确定性数据优先于概括性的 application_context。",
          "引用能力结果得出结论时保留对应 result_id；不得声称执行了未出现在 assistant_capability_results 中的查询。",
          "能力调用失败、结果为空或状态不是 complete 时，明确说明限制，不要把缺失数据补写成事实。",
          "conversation_history 只用于理解追问和代词，不是新的事实来源；与本轮能力结果冲突时以本轮能力结果为准。",
          "回答配装、构筑或攻略整理问题时，明确区分已确认事实、建议和待确认项；不要声称已经创建或保存方案。",
          "AI 不能直接执行锁定、转移、装备或分解；只能给出需要用户确认的操作计划。",
          "不要要求用户使用 CLI，也不要输出英文搜索语法作为主要方案。"
        ].join("\n")
      },
      {
        role: "user",
        content: [
          "上下文：",
          input.context,
          "",
          "用户问题：",
          input.question
        ].join("\n")
      }
    ],
    temperature: 0.2,
    fetcher: input.fetcher
  });

  return {
    provider: settings.protocol,
    model: settings.model,
    text
  };
}

export function extractAiSections(text: string): AiAdviceSections {
  const sections: AiAdviceSections = {
    facts: [],
    analysis: [],
    suggestions: [],
    action_reminders: [],
    raw: text
  };
  let current: keyof Omit<AiAdviceSections, "raw"> | undefined;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const heading = normalizeSectionHeading(trimmed);
    if (heading) {
      current = heading;
      continue;
    }
    if (current) {
      sections[current].push(trimmed.replace(/^[-*]\s*/, ""));
    }
  }
  return sections;
}

function normalizeSectionHeading(line: string): keyof Omit<AiAdviceSections, "raw"> | undefined {
  const normalized = line.replace(/[：:]+$/, "").trim();
  if (normalized === "事实") return "facts";
  if (normalized === "分析") return "analysis";
  if (normalized === "建议") return "suggestions";
  if (normalized === "操作提醒" || normalized === "操作") return "action_reminders";
  return undefined;
}

export type AiWebSearchResult = {
  text: string;
  sources: AiExternalSource[];
};

export type AiExternalSource = {
  title?: string;
  url: string;
  queried_at: string;
};

export function supportsAiWebSearch(config: D2Config["ai"]): boolean {
  const settings = normalizeAiSettings(config);
  return settings.protocol === "openai_responses";
}

export async function callAiWithWebSearch(input: {
  config: D2Config;
  query: string;
  fetcher?: typeof fetch;
}): Promise<AiWebSearchResult> {
  const settings = normalizeAiSettings(input.config.ai);

  if (!settings.protocol) {
    throw new Error("请先选择 AI API 格式。");
  }
  if (!supportsAiWebSearch(input.config.ai)) {
    throw new Error("当前 AI 配置不支持带引用的网页搜索；请使用 OpenAI Responses 兼容接口。");
  }
  if (!settings.api_key) {
    throw new Error("请先填写 AI API Key。");
  }
  if (!settings.model) {
    throw new Error("请先填写 AI 模型名称。");
  }
  assertAiDataSharingConsent(settings);

  const request = buildAiWebSearchRequest(settings, input.query);
  const response = await (input.fetcher ?? fetch)(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(request.body)
  });

  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(`AI 接口调用失败：${body.error?.message ?? response.statusText}`);
  }

  const text = extractAiWebSearchText(body);
  if (!text) {
    throw new Error("AI 接口没有返回可读取的网页搜索结果。");
  }

  return { text, sources: extractAiWebSearchSources(body) };
}

function buildAiWebSearchRequest(settings: NormalizedAiSettings, query: string): {
  url: string;
  headers: Record<string, string>;
  body: unknown;
} {
  return {
    url: openAiResponsesEndpoint(settings.base_url),
    headers: openAiHeaders(settings.api_key),
    body: {
      model: settings.model,
      tools: [{ type: "web_search_preview" }],
      input: [
        {
          role: "user",
          content: query
        }
      ]
    }
  };
}

function extractAiWebSearchText(body: ChatResponse): string {
  if (body.output_text) return body.output_text;
  const messageOutput = body.output?.find((item) => item.type === "message" || item.content);
  if (messageOutput?.content) {
    return messageOutput.content.map((content) => content.text).filter(Boolean).join("\n");
  }
  return extractAiText(body);
}

function extractAiWebSearchSources(body: ChatResponse): AiExternalSource[] {
  const queriedAt = new Date().toISOString();
  const citations = (body.output ?? []).flatMap((item) => item.content ?? [])
    .flatMap((content) => content.annotations ?? [])
    .filter((annotation) => annotation.type === "url_citation" && Boolean(annotation.url))
    .map((annotation) => ({
      title: annotation.title,
      url: annotation.url ?? "",
      queried_at: queriedAt
    }));
  return [...new Map(citations.map((source) => [source.url, source])).values()];
}

export async function testAiConnection(input: {
  config: D2Config;
  fetcher?: typeof fetch;
}): Promise<AiConnectionTestResult> {
  const settings = normalizeAiSettings(input.config.ai);

  if (!settings.protocol) {
    throw new Error("请先选择 AI API 格式。");
  }
  if (!settings.api_key) {
    throw new Error("请先填写 AI API Key。");
  }
  if (!settings.model) {
    throw new Error("请先填写 AI 模型名称。");
  }

  await callAiText({
    settings,
    messages: [
      {
        role: "system",
        content: "你是 d2-tools 的连接测试助手。"
      },
      {
        role: "user",
        content: "请只回复 OK，用于确认接口可用。"
      }
    ],
    temperature: 0,
    fetcher: input.fetcher
  });

  return {
    ok: true,
    protocol: settings.protocol,
    model: settings.model,
    message: "AI 连接测试成功。"
  };
}

export async function listAiModels(input: {
  ai: D2Config["ai"];
  fetcher?: typeof fetch;
}): Promise<AiModelListResult> {
  const settings = normalizeAiSettings(input.ai);

  if (!settings.protocol) {
    throw new Error("请先选择 API 格式。");
  }
  if (!settings.api_key) {
    throw new Error("请先填写 AI API Key。");
  }

  try {
    const request = buildAiModelListRequest(settings);
    const response = await (input.fetcher ?? fetch)(request.url, {
      method: "GET",
      headers: request.headers
    });
    const body = await readJson(response);
    if (!response.ok) {
      throw new Error(body.error?.message ?? response.statusText);
    }

    const models = extractModelIds(body);
    if (!models.length) {
      throw new Error("目标服务没有返回可识别的模型列表。");
    }

    return {
      protocol: settings.protocol,
      models,
      source: "remote",
      message: "已读取目标服务返回的模型列表。"
    };
  } catch {
    return {
      protocol: settings.protocol,
      models: fallbackModels[settings.protocol],
      source: "fallback",
      message: "远端模型列表读取失败，已回退到常见模型建议。仍然可以手动输入模型名称。"
    };
  }
}

async function callAiText(input: {
  settings: NormalizedAiSettings;
  messages: AiPromptMessage[];
  temperature: number;
  fetcher?: typeof fetch;
}): Promise<string> {
  const request = buildAiRequest(input.settings, input.messages, input.temperature);
  const response = await (input.fetcher ?? fetch)(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(request.body)
  });

  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(`AI 接口调用失败：${body.error?.message ?? response.statusText}`);
  }

  const text = extractAiText(body);
  if (!text) {
    throw new Error("AI 接口没有返回可读取的分析内容。");
  }

  return text;
}

function buildAiRequest(settings: NormalizedAiSettings, messages: AiPromptMessage[], temperature: number): {
  url: string;
  headers: Record<string, string>;
  body: unknown;
} {
  if (!settings.protocol) {
    throw new Error("请先选择 AI API 格式。");
  }

  if (settings.protocol === "anthropic_messages") {
    const system = messages.find((message) => message.role === "system")?.content ?? "";
    const userMessages = messages.filter((message) => message.role !== "system");
    return {
      url: anthropicMessagesEndpoint(settings.base_url),
      headers: {
        "x-api-key": settings.api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
      },
      body: {
        model: settings.model,
        max_tokens: 1200,
        temperature,
        system,
        messages: userMessages.map((message) => ({
          role: "user",
          content: message.content
        }))
      }
    };
  }

  if (settings.protocol === "openai_responses") {
    return {
      url: openAiResponsesEndpoint(settings.base_url),
      headers: openAiHeaders(settings.api_key),
      body: {
        model: settings.model,
        temperature,
        input: messages.map((message) => ({
          role: message.role,
          content: message.content
        }))
      }
    };
  }

  return {
    url: chatCompletionsEndpoint(settings.base_url),
    headers: openAiHeaders(settings.api_key),
    body: {
      model: settings.model,
      temperature,
      messages
    }
  };
}

function openAiHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };
}

function extractAiText(body: ChatResponse): string {
  return (
    body.output_text
    ?? body.output?.flatMap((item) => item.content ?? []).map((content) => content.text).find(Boolean)
    ?? body.choices?.[0]?.message?.content
    ?? body.content?.find((content) => content.type === "text" || content.text)?.text
    ?? ""
  ).trim();
}

function openAiResponsesEndpoint(baseUrl: string): string {
  const normalized = openAiRoot(baseUrl || aiProtocolBaseUrls.openai_responses);
  return normalized.endsWith("/responses") ? normalized : `${normalized}/responses`;
}

function anthropicMessagesEndpoint(baseUrl: string): string {
  return `${anthropicRoot(baseUrl || aiProtocolBaseUrls.anthropic_messages)}/messages`;
}

function chatCompletionsEndpoint(baseUrl: string): string {
  const normalized = openAiRoot(baseUrl || aiProtocolBaseUrls.openai_chat_completions);
  return normalized.endsWith("/chat/completions")
    ? normalized
    : `${normalized}/chat/completions`;
}

function openAiModelsEndpoint(baseUrl: string): string {
  return `${openAiRoot(baseUrl || aiProtocolBaseUrls.openai_chat_completions)}/models`;
}

function anthropicModelsEndpoint(baseUrl: string): string {
  return `${anthropicRoot(baseUrl || aiProtocolBaseUrls.anthropic_messages)}/models`;
}

function openAiRoot(baseUrl: string): string {
  return normalizeBaseUrl(baseUrl)
    .replace(/\/chat\/completions$/i, "")
    .replace(/\/responses$/i, "")
    .replace(/\/models$/i, "");
}

function anthropicRoot(baseUrl: string): string {
  const normalized = normalizeBaseUrl(baseUrl)
    .replace(/\/messages$/i, "")
    .replace(/\/models$/i, "");
  return normalized.endsWith("/v1") ? normalized : `${normalized}/v1`;
}

function normalizeBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, "");
  if (!normalized) {
    throw new Error("请填写 AI 接口地址。");
  }
  return normalized;
}

function buildAiModelListRequest(settings: NormalizedAiSettings): {
  url: string;
  headers: Record<string, string>;
} {
  if (settings.protocol === "anthropic_messages") {
    return {
      url: anthropicModelsEndpoint(settings.base_url),
      headers: {
        "x-api-key": settings.api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
      }
    };
  }

  return {
    url: openAiModelsEndpoint(settings.base_url),
    headers: openAiHeaders(settings.api_key)
  };
}

function extractModelIds(body: ChatResponse & { data?: Array<{ id?: string; name?: string }>; models?: Array<{ id?: string; name?: string }> }): string[] {
  const rawModels = [
    ...(body.data ?? []),
    ...(body.models ?? [])
  ];
  return Array.from(new Set(rawModels.map((item) => item.id ?? item.name ?? "").filter(Boolean))).sort((left, right) =>
    left.localeCompare(right)
  );
}

function buildVaultPrompt(local: VaultAnalysisResult): string {
  return JSON.stringify({
    facts: local.facts,
    local_analysis: local.analysis,
    local_suggestions: local.suggestions,
    tagged_items: Object.fromEntries(Object.entries(local.items).map(([group, items]) => [
      group,
      items.map((item) => ({
        name: item.name,
        tier: item.tier,
        item_type: item.item_type,
        power: item.power,
        note: item.note,
        plugs: item.plugs
      }))
    ]))
  }, null, 2);
}

function buildItemPrompt(item: ItemAiAdviceInput["item"]): string {
  return JSON.stringify({
    item: {
      name: item.name,
      tier: item.tier,
      type: item.item_type,
      bucket: item.bucket_name,
      group: item.group_key,
      locked: item.locked,
      description: item.description,
      local_note: item.note,
      plugs: (item.socket_plugs ?? []).map((plug) => typeof plug === "object" && plug && "name" in plug
        ? (plug as { name?: string }).name
        : undefined).filter(Boolean)
    }
  }, null, 2);
}

function summarizeChatItems(items: AccountItemSummary[]) {
  return items.map((item) => ({
    name: item.name,
    tier: item.tier,
    type: item.item_type,
    bucket: item.bucket_name,
    group: item.group_key,
    ammo: item.ammo_type,
    power: item.power,
    locked: item.locked,
    plugs: (item.socket_plugs ?? []).map((plug) => plug.name).filter(Boolean)
  }));
}

function buildItemNamesByLocalKey(account: AccountSummary | null): Map<string, string> {
  const names = new Map<string, string>();
  if (!account) return names;
  const items = [
    ...account.vault.items,
    ...account.characters.flatMap((character) => [
      ...character.equipped_items,
      ...character.inventory_items,
      ...character.postmaster_items
    ])
  ];
  for (const item of items) {
    if (item.instance_id) names.set(item.instance_id, item.name);
    names.set(String(item.hash), item.name);
  }
  return names;
}

function sanitizeAiContextValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeAiContextValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !shouldOmitAiContextKey(key))
    .map(([key, nested]) => [key, sanitizeAiContextValue(nested)]));
}

function shouldOmitAiContextKey(key: string): boolean {
  const normalized = key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
  return normalized === "account_name"
    || normalized === "membership_type"
    || normalized === "open_target"
    || normalized === "id"
    || normalized === "hash"
    || normalized === "hashes"
    || /_(?:id|ids|hash|hashes)$/.test(normalized);
}

function assertAiDataSharingConsent(settings: NormalizedAiSettings): void {
  if (!settings.data_sharing_consent) {
    throw new Error("请先到设置页确认 AI 数据发送范围，再使用 AI 分析。");
  }
}

async function readJson(response: Response): Promise<ChatResponse> {
  try {
    return await response.json() as ChatResponse;
  } catch {
    return {};
  }
}
