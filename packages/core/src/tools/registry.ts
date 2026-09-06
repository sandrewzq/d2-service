export type D2ToolName =
  | "d2.search_items"
  | "d2.search_perks"
  | "d2.get_account_summary"
  | "d2.analyze_vault"
  | "d2.get_daily_summary"
  | "d2.create_action_plan"
  | "d2.get_activity_summary"
  | "d2.export_diagnostics";

export type D2ToolCapability = "manifest" | "account" | "analysis" | "daily" | "planning" | "diagnostics";

export type D2ToolWriteMode = "read-only" | "plan-only";

export type D2ToolDefinition = {
  name: D2ToolName;
  title: string;
  description: string;
  capability: D2ToolCapability;
  ai_safe: boolean;
  requires_auth: boolean;
  write_mode: D2ToolWriteMode;
  input_schema: {
    type: "object";
    properties: Record<string, D2ToolInputProperty>;
    required?: string[];
    additionalProperties: boolean;
  };
  output_summary: string;
};

export type D2ToolInputProperty = {
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  enum?: string[];
  items?: D2ToolInputProperty;
};

const toolDefinitions: D2ToolDefinition[] = [
  {
    name: "d2.search_items",
    title: "搜索装备",
    description: "按名称或别名搜索 Bungie Manifest 装备，并返回来源、图标和 perk 摘要。",
    capability: "manifest",
    ai_safe: true,
    requires_auth: false,
    write_mode: "read-only",
    input_schema: objectSchema({
      query: { type: "string", description: "装备名称、中文别名或英文名。" },
      limit: { type: "number", description: "最多返回数量。" }
    }, ["query"]),
    output_summary: "装备列表、来源说明、基础属性和可用 perk 摘要。"
  },
  {
    name: "d2.search_perks",
    title: "搜索 Perk",
    description: "按名称搜索 perk/模组定义，方便 AI 解释 roll 和搭配。",
    capability: "manifest",
    ai_safe: true,
    requires_auth: false,
    write_mode: "read-only",
    input_schema: objectSchema({
      query: { type: "string", description: "perk 或模组名称。" },
      limit: { type: "number", description: "最多返回数量。" }
    }, ["query"]),
    output_summary: "perk 名称、描述、图标和 hash。"
  },
  {
    name: "d2.get_account_summary",
    title: "读取账号概览",
    description: "读取当前玩家角色、背包、仓库、材料数量和装备分组。",
    capability: "account",
    ai_safe: true,
    requires_auth: true,
    write_mode: "read-only",
    input_schema: objectSchema({
      include_vault: { type: "boolean", description: "是否包含仓库装备。" },
      include_characters: { type: "boolean", description: "是否包含角色背包和已装备物品。" }
    }),
    output_summary: "账号角色、仓库、背包、材料和装备分组摘要。"
  },
  {
    name: "d2.analyze_vault",
    title: "分析仓库",
    description: "基于仓库物品、本地标记、评分和愿望单生成整理建议。",
    capability: "analysis",
    ai_safe: true,
    requires_auth: true,
    write_mode: "read-only",
    input_schema: objectSchema({
      include_local_tags: { type: "boolean", description: "是否使用本地保留、待定、清理标记。" },
      mode: {
        type: "string",
        description: "分析侧重点。",
        enum: ["cleanup", "keep", "duplicates", "general"]
      }
    }),
    output_summary: "保留、复查、可清理候选，以及事实、分析和建议。"
  },
  {
    name: "d2.get_daily_summary",
    title: "今日信息",
    description: "返回每日/每周重置、公开里程碑、商人和可确认的今日信息。",
    capability: "daily",
    ai_safe: true,
    requires_auth: false,
    write_mode: "read-only",
    input_schema: objectSchema({
      time_zone: { type: "string", description: "显示用时区，例如 Asia/Shanghai。" }
    }),
    output_summary: "日期、重置时间、可确认的轮换数据和待确认来源提示。"
  },
  {
    name: "d2.create_action_plan",
    title: "生成装备操作计划",
    description: "只生成锁定、装备、转移等操作计划，不直接执行写操作。",
    capability: "planning",
    ai_safe: true,
    requires_auth: true,
    write_mode: "plan-only",
    input_schema: objectSchema({
      action: {
        type: "string",
        description: "计划的操作类型。",
        enum: ["set-lock", "equip", "transfer"]
      },
      item_instance_id: { type: "string", description: "装备实例 ID。" },
      character_id: { type: "string", description: "目标角色 ID。" },
      state: { type: "boolean", description: "锁定/解锁时使用。" }
    }, ["action", "item_instance_id"]),
    output_summary: "用户可确认的安全操作计划和风险说明。"
  },
  {
    name: "d2.get_activity_summary",
    title: "活动统计",
    description: "读取近期活动、Raid/Dungeon 摘要和可展示的战绩信息。",
    capability: "account",
    ai_safe: true,
    requires_auth: true,
    write_mode: "read-only",
    input_schema: objectSchema({
      mode: {
        type: "string",
        description: "活动类型。",
        enum: ["recent", "raid", "dungeon"]
      },
      limit: { type: "number", description: "最多返回数量。" }
    }),
    output_summary: "近期活动列表、完成次数和统计摘要。"
  },
  {
    name: "d2.export_diagnostics",
    title: "导出诊断",
    description: "生成脱敏诊断文本，用于排查登录、Manifest、工具调用和写操作问题。",
    capability: "diagnostics",
    ai_safe: true,
    requires_auth: false,
    write_mode: "read-only",
    input_schema: objectSchema({
      include_recent_actions: { type: "boolean", description: "是否包含最近写操作结果。" },
      include_recent_tools: { type: "boolean", description: "是否包含最近工具调用结果。" }
    }),
    output_summary: "不含敏感凭据的诊断文本。"
  }
];

export function listD2ToolDefinitions(): D2ToolDefinition[] {
  return structuredClone(toolDefinitions);
}

export function findD2ToolDefinition(name: string): D2ToolDefinition | undefined {
  return listD2ToolDefinitions().find((tool) => tool.name === name);
}

function objectSchema(
  properties: Record<string, D2ToolInputProperty>,
  required?: string[]
): D2ToolDefinition["input_schema"] {
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false
  };
}
