export type SettingsSourceCategory = "official" | "community" | "reference";

export type SettingsSourceEntry = {
  category: SettingsSourceCategory;
  name: string;
  role: string;
  content: string;
  usedIn: string;
  relationship: string;
  githubUrl?: string;
  onlineUrl?: string;
  license: string;
  note: string;
};

export const settingsSourceEntries: SettingsSourceEntry[] = [
  {
    category: "official",
    name: "Bungie API",
    role: "官方实时数据",
    content: "账号、角色、装备、活动、商人和轮换状态",
    usedIn: "首页、账号、仓库、资料库、商人",
    relationship: "事实来源",
    onlineUrl: "https://bungie-net.github.io/",
    license: "遵循 Bungie API 使用条款",
    note: "应用不把账号令牌发送给第三方推荐工具。"
  },
  {
    category: "official",
    name: "Destiny 2 Manifest",
    role: "官方游戏定义",
    content: "装备、Perk、活动、来源和版本定义",
    usedIn: "资料库、仓库、配装、首页",
    relationship: "事实来源",
    onlineUrl: "https://www.bungie.net/7/en/Manifest",
    license: "遵循 Bungie 相关条款",
    note: "本地资料库会按 Bungie 返回的版本后台更新。"
  },
  {
    category: "community",
    name: "DIM Wish List Sources",
    role: "社区愿望单数据",
    content: "武器推荐 Roll、作者块、标签和规则格式",
    usedIn: "仓库推荐、武器详情",
    relationship: "社区数据来源",
    githubUrl: "https://github.com/48klocs/dim-wish-list-sources",
    onlineUrl: "https://raw.githubusercontent.com/48klocs/dim-wish-list-sources/master/voltron.txt",
    license: "MIT（以仓库当前声明为准）",
    note: "只反映愿望单作者偏好，不等于 Bungie 官方结论。"
  },
  {
    category: "reference",
    name: "Starside · Destiny 2 中文资料台",
    role: "社区中文资料",
    content: "武器、护甲、机制、伤害和攻略资料的组织方式",
    usedIn: "中文文案和资料导航参考",
    relationship: "内容与信息组织参考",
    onlineUrl: "https://starside.work/",
    license: "以原站声明为准；不复制未授权内容",
    note: "静态资料页不能证明实时轮换，当前轮换仍以 Bungie 登录数据为准。"
  },
  {
    category: "reference",
    name: "Destiny Item Manager（DIM）",
    role: "产品与交互参考",
    content: "仓库筛选、配装、愿望单、清理建议和写操作确认",
    usedIn: "仓库、配装、装备详情",
    relationship: "功能与交互参考，不是运行时依赖",
    githubUrl: "https://github.com/DestinyItemManager/DIM",
    onlineUrl: "https://app.destinyitemmanager.com/",
    license: "以仓库许可为准；未复制其页面代码",
    note: "d2-tools 直接调用 Bungie API，不通过 DIM 读取账号。"
  },
  {
    category: "reference",
    name: "D2ArmorPicker",
    role: "护甲配装参考",
    content: "属性目标、异域限制、多方案比较和求解流程",
    usedIn: "配装工作台",
    relationship: "功能流程参考，不是运行时依赖",
    githubUrl: "https://github.com/Mijago/D2ArmorPicker",
    onlineUrl: "https://d2armorpicker.com/",
    license: "以仓库许可为准；未复制其页面代码",
    note: "护甲结果由 d2-tools 自己的账号快照和规则计算。"
  },
  {
    category: "reference",
    name: "d2-armor-solver",
    role: "Armor 3.0 求解表达参考",
    content: "+5 / +10 模组目标、可达性、缺口和方案表达",
    usedIn: "护甲规划",
    relationship: "算法表达参考，不是运行时依赖",
    githubUrl: "https://github.com/MIGO-OvO/d2-armor-solver",
    onlineUrl: "https://migo-ovo.github.io/d2-armor-solver/",
    license: "以仓库许可为准；未复制其实现",
    note: "只借鉴问题表达和交互思路，具体规则以 d2-tools 实现为准。"
  },
  {
    category: "reference",
    name: "Roll Report",
    role: "Roll 分析参考",
    content: "武器 Roll 差异和独特组合的识别思路",
    usedIn: "仓库同名整理、武器详情",
    relationship: "算法思路参考，不是运行时依赖",
    githubUrl: "https://github.com/cecilbowen/roll-report",
    onlineUrl: "https://roll.report/",
    license: "MIT（以仓库当前声明为准）",
    note: "d2-tools 不直接调用其线上接口。"
  },
  {
    category: "reference",
    name: "d2-additional-info",
    role: "Manifest 补充数据参考",
    content: "赛季、活动、来源、催化剂和模组关系的补充流程",
    usedIn: "资料库和来源解析",
    relationship: "数据生成流程参考，不是玩家账号来源",
    githubUrl: "https://github.com/DestinyItemManager/d2-additional-info",
    license: "MIT（以仓库当前声明为准）",
    note: "不能替代 Bungie Manifest，也不能覆盖实时账号事实。"
  }
];

export const settingsSourceCategoryLabels: Record<SettingsSourceCategory, string> = {
  official: "官方数据来源",
  community: "社区资料来源",
  reference: "参考项目与功能"
};
