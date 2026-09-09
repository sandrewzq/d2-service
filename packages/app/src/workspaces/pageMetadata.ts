export type HomePageKey = "home" | "account" | "vault" | "loadouts" | "library" | "vendors" | "settings";

export const homePageMetaMap: Record<HomePageKey, { title: string; subtitle: string }> = {
  home: { title: "本周情报", subtitle: "只展示 Bungie 公开接口与经过校验的公开机器数据，不猜测缺失内容。" },
  account: { title: "账号", subtitle: "读取 Bungie 账号、角色装备、背包和材料数量。" },
  vault: { title: "仓库", subtitle: "先筛出候选，再用证据决定保留、复查或清理。" },
  loadouts: { title: "配装", subtitle: "管理本地方案、补齐缺失装备并对比不同配装。" },
  library: { title: "资料库", subtitle: "搜索本地 Manifest 物品定义和 perk。" },
  vendors: { title: "商人", subtitle: "查看可确认商人库存、费用和账号拥有状态。" },
  settings: { title: "设置", subtitle: "集中管理配置、更新、诊断和安全操作。" }
};

export const homePageLabels: Record<HomePageKey, string> = {
  home: "首页",
  account: "账号",
  vault: "仓库",
  loadouts: "配装",
  library: "资料库",
  vendors: "商人",
  settings: "设置"
};

export const homePageFocus: Record<HomePageKey, string> = {
  home: "当前正在查看首页，应优先分析已确认的本周活动、限时事件、仄商人库存和数据缺口。",
  account: "当前正在查看账号页，应优先分析当前角色、背包装备、邮政官、材料和账号状态。",
  vault: "当前正在查看仓库页，应优先分析仓库筛选、标签、同名装备、保留和清理问题。",
  loadouts: "当前正在查看配装页，应优先分析当前配装方案、缺失装备、转移计划和替代方案。",
  library: "当前正在查看资料库页，应优先分析物品定义、perk、最近查看和收藏资料。",
  vendors: "当前正在查看商人页，应优先分析可确认库存、费用、账号拥有状态和购买条件。",
  settings: "当前正在查看设置页，应优先分析配置状态、AI 设置、更新和诊断信息。"
};
