import { useMemo } from "react";
import type { ArmorSetCatalogItem } from "@d2-tools/core/items/equipableItemSet";
import { buildLoadoutTemplateLookup, matchesLoadoutTemplateItem, selectLoadoutsPageModel, type LoadoutTemplate, type LoadoutTemplateItem } from "@d2-tools/app/loadouts";
import { selectAccountPageModel } from "@d2-tools/app/account";
import { selectHomePageModel } from "@d2-tools/app/home";
import { selectLibraryPageModel } from "@d2-tools/app/library";
import type {
  ItemSearchResult,
  LibraryHistory,
  LiveItemAvailability,
  PerkSearchResult,
  VaultItemMatchInfo
} from "@d2-tools/app/library";
import { selectSettingsPageModel, type SettingsSectionKey } from "@d2-tools/app/settings";
import { selectVaultPageModel } from "@d2-tools/app/vault";
import { selectVendorsPageModel } from "@d2-tools/app/vendors";
import type {
  AiAssistantContextView,
  AiAssistantMessageView,
  LibraryEquipmentFilter,
  LibraryPerkFilter,
  ShellBackgroundTaskItem,
  ShellPageKey
} from "@d2-tools/ui";
import type { AccountItemSummary, AccountSummary } from "@d2-tools/core/account/summary";
import type { LocalLoadoutPlan } from "@d2-tools/core/loadouts/plans";
import {
  createFixtureActivitySummary,
  createFixtureAccountItem,
  createFixtureAccountSummary,
  createFixtureLibraryFilters
} from "@d2-tools/ui/fixtures";
import { webAppVersion } from "../buildInfo";
import type { WebHomeSnapshot } from "../webAdapter";
export const webAccountSummary = createFixtureAccountSummary({
  account_name: "Web Guardian",
  destiny_membership_id: "4611686018429100000",
  membership_type: 3,
  characters: [
    {
      character_id: "web-hunter",
      class_name: "猎人",
      light: 2022,
      equipped_items: [
        webWeaponAccountItem("web-pulse-equipped", 3001, "快速命中脉冲", "动能武器", "轻质框架", "已装备"),
        webWeaponAccountItem("web-rocket-equipped", 3004, "边缘迁移火箭筒", "威能武器", "自适应框架", "已装备"),
        webArmorAccountItem("web-helmet-equipped", 7101, "铁血意志头盔", "头盔", "已装备", 2021),
        webArmorAccountItem("web-chest-equipped", 7103, "铁血意志胸甲", "胸甲", "已装备", 2019),
        webArmorAccountItem("web-class-equipped", 7105, "铁血意志披风", "职业物品", "已装备", 2022)
      ],
      equipment_groups: [],
      inventory_items: [
        webWeaponAccountItem("web-shotgun-inventory", 3003, "终局霰弹枪", "能量武器", "精确框架", "背包"),
        webArmorAccountItem("web-gauntlets-inventory", 7102, "铁血意志臂铠", "臂铠", "背包", 2023),
        webArmorAccountItem("web-legs-inventory", 7104, "铁血意志腿甲", "腿甲", "背包", 2020)
      ],
      inventory_groups: [],
      postmaster_items: [],
      loadout_slots: [
        {
          index: 0,
          name: "夜幕控场",
          item_count: 8,
          items: [
            { instance_id: "web-pulse-equipped", item_hash: 3001, name: "快速命中脉冲", bucket_name: "动能武器", plug_hashes: [4001, 4002] },
            { instance_id: "web-handcannon-vault", item_hash: 3002, name: "精准手炮", bucket_name: "能量武器", plug_hashes: [4001, 4002] },
            { instance_id: "web-rocket-equipped", item_hash: 3004, name: "边缘迁移火箭筒", bucket_name: "威能武器", plug_hashes: [4001, 4002] },
            { instance_id: "web-helmet-equipped", item_hash: 7101, name: "铁血意志头盔", bucket_name: "头盔", plug_hashes: [] },
            { instance_id: "web-gauntlets-inventory", item_hash: 7102, name: "铁血意志臂铠", bucket_name: "臂铠", plug_hashes: [] },
            { instance_id: "web-chest-equipped", item_hash: 7103, name: "铁血意志胸甲", bucket_name: "胸甲", plug_hashes: [] },
            { instance_id: "web-legs-inventory", item_hash: 7104, name: "铁血意志腿甲", bucket_name: "腿甲", plug_hashes: [] },
            { instance_id: "web-class-equipped", item_hash: 7105, name: "铁血意志披风", bucket_name: "职业物品", plug_hashes: [] }
          ]
        },
        {
          index: 1,
          name: "突袭输出",
          item_count: 3,
          items: [
            { instance_id: "web-pulse-equipped", item_hash: 3001, name: "快速命中脉冲", bucket_name: "动能武器", plug_hashes: [4001, 4002] },
            { instance_id: "web-shotgun-inventory", item_hash: 3003, name: "终局霰弹枪", bucket_name: "能量武器", plug_hashes: [4001, 4002] },
            { instance_id: "web-rocket-equipped", item_hash: 3004, name: "边缘迁移火箭筒", bucket_name: "威能武器", plug_hashes: [4001, 4002] }
          ]
        }
      ]
    },
    {
      character_id: "web-warlock",
      class_name: "术士",
      light: 2018,
      equipped_items: [],
      equipment_groups: [],
      inventory_items: [webWeaponAccountItem("web-fusion-warlock", 3005, "适配融合步枪", "能量武器", "适配框架", "术士背包")],
      inventory_groups: [],
      postmaster_items: [],
      loadout_slots: []
    }
  ],
  vault: {
    item_count: 485,
    capacity: 1000,
    items: [
      webWeaponAccountItem("web-handcannon-vault", 3002, "精准手炮", "能量武器", "精确框架", "仓库"),
      webWeaponAccountItem("web-handcannon-vault-duplicate", 3002, "精准手炮", "能量武器", "精确框架", "仓库", {
        power: 2024,
        locked: true,
        socketPlugs: [{ hash: 4003, name: "永动不歇" }, { hash: 4004, name: "狂暴" }]
      }),
      webWeaponAccountItem("web-sword-vault", 3006, "连锁反应刀剑", "威能武器", "旋风框架", "仓库"),
      webWeaponAccountItem("web-scout-vault", 3007, "旧赛季斥候", "动能武器", "适配框架", "仓库")
    ],
    sample_items: []
  },
  materials: { item_count: 0, items: [] }
});

export const webActivitySummary = createFixtureActivitySummary({
  latestPeriod: "2026-07-03T14:18:00+08:00",
  pve: { total: 7, completed: 6 },
  pvp: { total: 3, completed: 2 },
  review: { completion_rate: 80, completions_in_a_row: 3 }
});

export const webLoadoutTemplates: LoadoutTemplate[] = [
  {
    id: "web-nightfall",
    name: "Web 夜幕模板",
    character_id: "web-hunter",
    class_name: "猎人",
    created_at: "2026-07-01T10:00:00.000Z",
    updated_at: "2026-07-03T14:18:00.000Z",
    items: [
      { hash: 3001, instance_id: "web-pulse-equipped", name: "快速命中脉冲", bucket_name: "动能武器", weapon_frame_name: "轻质框架", perk_names: ["快速命中", "动能震颤"] },
      { hash: 3002, instance_id: "web-handcannon-vault", name: "精准手炮", bucket_name: "能量武器", weapon_frame_name: "精确框架", perk_names: ["丰盈满溢", "爆炸载荷"] }
    ]
  },
  {
    id: "web-raid",
    name: "Web 突袭模板",
    character_id: "web-warlock",
    class_name: "术士",
    created_at: "2026-07-01T10:00:00.000Z",
    updated_at: "2026-07-03T14:18:00.000Z",
    items: [
      { hash: 3005, instance_id: "web-fusion-warlock", name: "适配融合步枪", bucket_name: "能量武器", weapon_frame_name: "适配框架", perk_names: ["自填", "控制爆破"] }
    ]
  }
];

export const webApplicationLoadoutPlans: LocalLoadoutPlan[] = [
  {
    id: "web-app-nightfall",
    name: "宗师夜幕 · 生存控场",
    class_name: "猎人",
    target_character_id: "web-hunter",
    source: { kind: "manual", label: "应用内创建" },
    item_targets: [
      { slot: "动能武器", item_hash: 3001, selected_instance_id: "web-pulse-equipped", plug_hashes: [4001, 4002] },
      { slot: "能量武器", item_hash: 3002, selected_instance_id: "web-handcannon-vault", plug_hashes: [4001, 4002] },
      { slot: "威能武器", item_hash: 3004, selected_instance_id: "web-rocket-equipped", plug_hashes: [] },
      { slot: "头盔", item_hash: 7101, selected_instance_id: "web-helmet-equipped", plug_hashes: [] },
      { slot: "臂铠", item_hash: 7102, selected_instance_id: "web-gauntlets-inventory", plug_hashes: [] },
      { slot: "胸甲", item_hash: 7103, selected_instance_id: "web-chest-equipped", plug_hashes: [] },
      { slot: "腿甲", item_hash: 7104, selected_instance_id: "web-legs-inventory", plug_hashes: [] },
      { slot: "职业物品", item_hash: 7105, selected_instance_id: "web-class-equipped", plug_hashes: [] }
    ],
    notes: "Web 预览中的完整应用配装，用于查看只读详情、比较和显式编辑流程。",
    created_at: "2026-07-01T09:30:00.000Z",
    updated_at: "2026-07-03T14:18:00.000Z"
  },
  {
    id: "web-app-raid",
    name: "突袭输出 · 火箭轮换",
    class_name: "猎人",
    target_character_id: "web-hunter",
    source: { kind: "current-equipment", label: "从当前装备创建" },
    item_targets: [
      { slot: "动能武器", item_hash: 3001, selected_instance_id: "web-pulse-equipped", plug_hashes: [4001, 4002] },
      { slot: "能量武器", item_hash: 3003, selected_instance_id: "web-shotgun-inventory", plug_hashes: [] },
      { slot: "威能武器", item_hash: 3004, selected_instance_id: "web-rocket-equipped", plug_hashes: [] },
      { slot: "头盔", item_hash: 7101, selected_instance_id: "web-helmet-equipped", plug_hashes: [] },
      { slot: "臂铠", item_hash: 7102, selected_instance_id: "web-gauntlets-inventory", plug_hashes: [] },
      { slot: "胸甲", item_hash: 7103, selected_instance_id: "web-chest-equipped", plug_hashes: [] },
      { slot: "腿甲", item_hash: 7104, selected_instance_id: "web-legs-inventory", plug_hashes: [] },
      { slot: "职业物品", item_hash: 7105, selected_instance_id: "web-class-equipped", plug_hashes: [] }
    ],
    notes: "保留近距离副武器的输出方案，可与夜幕方案逐槽位比较。",
    created_at: "2026-07-02T11:00:00.000Z"
  },
  {
    id: "web-app-pvp",
    name: "熔炉竞技 · 手炮霰弹",
    class_name: "猎人",
    target_character_id: "web-hunter",
    source: { kind: "guide", label: "攻略创建" },
    item_targets: [
      { slot: "动能武器", item_hash: 3001, selected_instance_id: "web-pulse-equipped", plug_hashes: [4001, 4002] },
      { slot: "能量武器", item_hash: 3003, selected_instance_id: "web-shotgun-inventory", plug_hashes: [] },
      { slot: "威能武器", item_hash: 3006, selected_instance_id: "web-sword-vault", plug_hashes: [] }
    ],
    notes: "第三个对比候选，用于验证最多三个应用配装的选择上限。",
    created_at: "2026-07-03T08:00:00.000Z"
  }
];

export const webAccountDataResource = {
  status: "cached" as const,
  source: "local" as const,
  fetchedAt: "2026-07-03T14:18:00+08:00",
  error: undefined as { code: string; message: string } | undefined
};

export const webSelectedAnalysis = { equipped: [webLoadoutTemplates[0].items[0]], missing: [webLoadoutTemplates[0].items[1]] };
export const webTransferPlan = { steps: [], blocked: [] };
export const webLoadoutStatusSummary = [
  { key: "equipped", label: "已装备", count: 1 },
  { key: "vault", label: "仓库", count: 1 }
];
export const webCompareRows = [
  {
    slot: "能量武器",
    changed: true,
    left: { name: "精准手炮", frame: "精确框架", perks: ["丰盈满溢", "爆炸载荷"] },
    right: { name: "适配融合步枪", frame: "适配框架", perks: ["自填", "控制爆破"] }
  }
];

const webLibraryFilters = createFixtureLibraryFilters();
export const webEquipmentFilters: LibraryEquipmentFilter = webLibraryFilters.equipment;
export const webPerkFilters: LibraryPerkFilter = webLibraryFilters.perks;

function createWebDefinitionIcon(label: string, accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#101b24"/><path d="M8 8h48v48H8z" fill="none" stroke="${accent}" stroke-width="3"/><circle cx="32" cy="32" r="19" fill="${accent}" opacity=".35"/><text x="32" y="39" text-anchor="middle" font-family="system-ui,sans-serif" font-size="22" font-weight="700" fill="#eef6fb">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const webLibraryIcons = {
  pulse: createWebDefinitionIcon("P", "#375a75"),
  handCannon: createWebDefinitionIcon("H", "#67533a"),
  armor: createWebDefinitionIcon("A", "#4f6248"),
  ghost: createWebDefinitionIcon("G", "#5d4f69"),
  perk: createWebDefinitionIcon("◆", "#3d5f58")
};

export const webLibraryItems: ItemSearchResult[] = [
  {
    hash: 3001,
    name: "快速命中脉冲",
    description: "当前版本的轻质脉冲步枪定义，用于检查来源、持有状态和多结果键盘导航。",
    icon: webLibraryIcons.pulse,
    item_type: "脉冲步枪",
    tier: "传说",
    group_key: "weapons",
    bucket_name: "动能武器",
    ammo_type: "primary",
    damage_type: "缚丝",
    weapon_frame: { key: "lightweight", name: "轻质框架" },
    release: {
      status: "ready",
      label: "发布版本",
      kind: "season",
      description: "第6年 · 第21赛季 · 深渊赛季",
      season_number: 21,
      year_number: 6,
      name: "深渊赛季"
    },
    source: { status: "ready", label: "历史来源", description: "深渊赛季活动奖励记录。" },
    origin_traits: [{ hash: 5101, name: "集体行动" }],
    definition_stats: [
      { hash: 4284893193, name: "射速", value: 450, display_maximum: 1000 },
      { hash: 4043523819, name: "伤害", value: 27, display_maximum: 100 },
      { hash: 1240592695, name: "射程", value: 62, display_maximum: 100 },
      { hash: 155624089, name: "稳定性", value: 72, display_maximum: 100 },
      { hash: 943549884, name: "操控性", value: 48, display_maximum: 100 },
      { hash: 4188031367, name: "装填速度", value: 41, display_maximum: 100 }
    ],
    perks: [
      { socket_index: 3, plugs: [{ hash: 4001, name: "动能震颤", description: "连续命中后产生冲击波。", icon: webLibraryIcons.perk }] },
      { socket_index: 4, plugs: [{ hash: 4002, name: "快速命中", description: "精准命中提高稳定性与装填速度。", icon: webLibraryIcons.perk }] }
    ]
  },
  {
    hash: 3011,
    name: "快速命中脉冲",
    description: "同名武器的旧发布版本，用于检查版本相邻排列和独立来源状态。",
    icon: webLibraryIcons.pulse,
    item_type: "脉冲步枪",
    tier: "传说",
    group_key: "weapons",
    bucket_name: "动能武器",
    ammo_type: "primary",
    damage_type: "动能",
    weapon_frame: { key: "lightweight", name: "轻质框架" },
    release: {
      status: "ready",
      label: "发布版本",
      kind: "season",
      description: "第4年 · 第13赛季 · 天选赛季",
      season_number: 13,
      year_number: 4,
      name: "天选赛季"
    },
    source: { status: "ready", label: "历史来源", description: "天选赛季活动奖励记录。" },
    perks: [
      { socket_index: 3, plugs: [{ hash: 4011, name: "禅意时刻", description: "持续造成伤害时降低后坐。", icon: webLibraryIcons.perk }] },
      { socket_index: 4, plugs: [{ hash: 4012, name: "杀戮弹匣", description: "击杀后装填提高伤害。", icon: webLibraryIcons.perk }] }
    ]
  },
  {
    hash: 3002,
    name: "精准手炮",
    description: "仓库中已有的能量手炮，用于检查定位、收藏和当前商人来源。",
    icon: webLibraryIcons.handCannon,
    item_type: "手炮",
    tier: "传说",
    group_key: "weapons",
    bucket_name: "能量武器",
    ammo_type: "primary",
    damage_type: "烈日",
    weapon_frame: { key: "precision", name: "精确框架" },
    release: {
      status: "ready",
      label: "发布版本",
      kind: "season",
      description: "第7年 · 第24赛季 · 篇章：回响",
      season_number: 24,
      year_number: 7,
      name: "篇章：回响"
    },
    source: { status: "ready", label: "来源可确认", description: "高塔商人聚焦与活动奖励。" },
    perks: [
      { socket_index: 3, plugs: [{ hash: 4021, name: "丰盈满溢", description: "拾取弹药时过量装填。", icon: webLibraryIcons.perk }] },
      { socket_index: 4, plugs: [{ hash: 4022, name: "爆炸载荷", description: "投射物在命中时产生爆炸。", icon: webLibraryIcons.perk }] }
    ]
  },
  {
    hash: 7101,
    name: "铁血意志头盔",
    description: "猎人护甲定义，用于检查护甲筛选、账号持有和统一护甲详情。",
    icon: webLibraryIcons.armor,
    item_type: "头盔",
    tier: "传说",
    class_name: "猎人",
    group_key: "armor",
    bucket_name: "头盔",
    armor_set: { hash: 7001, name: "铁血意志套装" },
    release: {
      status: "ready",
      label: "发布版本",
      kind: "annual",
      description: "第7年 · 终焉之形",
      year_number: 7,
      name: "终焉之形"
    },
    source: { status: "ready", label: "来源可确认", description: "铁旗活动期间可获得。" },
    definition_stats: [
      { hash: 2996146975, name: "机动", value: 12, display_maximum: 30 },
      { hash: 392767087, name: "韧性", value: 18, display_maximum: 30 },
      { hash: 1943323491, name: "恢复", value: 8, display_maximum: 30 }
    ]
  },
  {
    hash: 9001,
    name: "远征机灵外壳",
    description: "资料库中的其他只读定义，用于确认非武器和护甲对象不显示实例操作。",
    icon: webLibraryIcons.ghost,
    item_type: "机灵外壳",
    tier: "传说",
    group_key: "other",
    bucket_name: "机灵",
    source: { status: "missing", label: "来源待补", description: "当前资料库尚未返回稳定来源。" },
    perks: []
  }
];
export const webLibraryPerks: PerkSearchResult[] = [
  {
    key: "perk:4001",
    hash: 4001,
    hashes: [4001, 4101],
    name: "动能震颤",
    description: "连续命中目标后产生动能冲击波。",
    icon: webLibraryIcons.perk,
    variants: [
      { sandbox_perk_hash: 4001, plug_hashes: [4001], kind: "standard", description: "连续命中目标后产生动能冲击波。", related_count: 2 },
      { sandbox_perk_hash: 4101, plug_hashes: [4101], kind: "enhanced", description: "更少命中次数即可产生冲击波。", related_count: 1 }
    ],
    related_count: 3,
    related_groups: ["weapons"]
  },
  {
    key: "perk:4022",
    hash: 4022,
    hashes: [4022],
    name: "爆炸载荷",
    description: "投射物在命中时产生范围爆炸。",
    icon: webLibraryIcons.perk,
    variants: [{ sandbox_perk_hash: 4022, plug_hashes: [4022], kind: "standard", description: "投射物在命中时产生范围爆炸。", related_count: 1 }],
    related_count: 1,
    related_groups: ["weapons"]
  },
  {
    key: "perk:4999",
    hash: 4999,
    hashes: [4999],
    name: "未建立关联的测试特性",
    description: "用于检查没有关联装备时的明确空状态。",
    icon: webLibraryIcons.perk,
    variants: [{ sandbox_perk_hash: 4999, plug_hashes: [4999], kind: "standard", description: "当前没有可确认的关联装备。", related_count: 0 }],
    related_count: 0,
    related_groups: []
  }
];
export const webPerkRelatedEquipment = {
  "perk:4001": {
    items: webLibraryItems.filter((item) => item.hash === 3001 || item.hash === 3011 || item.hash === 3002),
    total: 3,
    hasMore: false,
    isLoading: false,
    isLoaded: true,
    error: ""
  },
  "perk:4022": {
    items: webLibraryItems.filter((item) => item.hash === 3002),
    total: 1,
    hasMore: false,
    isLoading: false,
    isLoaded: true,
    error: ""
  },
  "perk:4999": {
    items: [],
    total: 0,
    hasMore: false,
    isLoading: false,
    isLoaded: true,
    error: ""
  }
};
export const webLibraryHistory: LibraryHistory = {
  recent: [
    { hash: 3001, name: "快速命中脉冲", icon: webLibraryIcons.pulse, viewed_at: "2026-07-03T14:18:00+08:00" },
    { hash: 7101, name: "铁血意志头盔", icon: webLibraryIcons.armor, viewed_at: "2026-07-02T20:35:00+08:00" },
    { hash: 3002, name: "精准手炮", icon: webLibraryIcons.handCannon, viewed_at: "2026-07-01T09:12:00+08:00" }
  ],
  favorites: [{ hash: 3002, name: "精准手炮", icon: webLibraryIcons.handCannon, viewed_at: "2026-07-01T09:12:00+08:00" }]
};
export const webLibraryCommunityMatch = new Map<number, VaultItemMatchInfo>([
  [3001, { matched: 1, available: 2, modes: ["pve"], sample_perks: [{ name: "动能震颤" }, { name: "快速命中" }] }],
  [3002, { matched: 1, available: 1, modes: ["pve", "pvp"], sample_perks: [{ name: "爆炸载荷" }] }]
]);
export const webLiveAvailability: LiveItemAvailability = {
  account_scope: "character",
  items: {
    "3001": {
      status: "public_activity",
      label: "当前公共活动",
      description: "本周轮换活动奖励中发现该武器。",
      sources: [{ kind: "public_activity", label: "本周轮换活动" }]
    },
    "3002": {
      status: "character_vendor",
      label: "当前商人售卖",
      description: "当前角色可在高塔商人聚焦页查看。",
      sources: [{ kind: "character_vendor", label: "高塔 / 聚焦解码", character_id: "web-hunter" }]
    }
  }
};

export const webManifestStatus = {
  initialized: true,
  version: "DestinyInventoryItemDefinition.26.06.16.0000",
  latest_version: "DestinyInventoryItemDefinition.26.06.16.0000",
  needs_update: false,
  cached_at: "2026-06-16T17:00:00.000Z",
  checked_at: "2026-07-03T14:18:00+08:00",
  language: "zh-chs",
  item_count: 14406,
  perk_count: 3871,
  relation_count: 451375,
  missing_required_components: []
};

export const webUpdateSnapshot = {
  status: "idle",
  operation_id: undefined,
  current_version: webAppVersion,
  available_version: null,
  downloaded_version: null,
  progress_percent: undefined,
  last_checked_at: undefined,
  update_source_label: "GitHub Release",
  user_message: "尚未检查软件版本。",
  error: "",
  retrying: false,
  next_retry_at: undefined,
  restart_required: false
};

export const webVaultTags = { items: { "web-handcannon-vault": { tag: "review", note: "Web mock 同名复查。" }, "web-scout-vault": { tag: "junk" } } } as const;
export const webLocalTargetRules = { action_policy: "notify_only" as const, armor: [], weapons: [] };
export const webWishlist = { title: "Web DIM Wishlist", rules: [{ item_hash: 3002, perk_hashes: [4001], mode: "pve" as const, note: "Web 推荐" }] };
export const webArmorSetCatalog: ArmorSetCatalogItem[] = [
  { hash: 7001, name: "铁血意志套装" },
  { hash: 7002, name: "流放者套装" },
  { hash: 7003, name: "遗产誓言套装" },
  { hash: 7004, name: "远古福音套装" }
];
export const webBackgroundTasks: ShellBackgroundTaskItem[] = [{ id: "web-task", title: "Web snapshot", status: "succeeded", message: "Web mock 已载入。", created_at: "2026-07-03T14:18:00+08:00", updated_at: "2026-07-03T14:18:00+08:00" }];
export const webActionLog = [{ id: "web-action", created_at: "2026-07-03T14:18:00+08:00", action: "mock", item_name: "Web mock", ok: true, message: "共享设置页操作日志 mock。" }];
export const webBungieConfig = { bungie: { api_key: "web-api-key", client_id: "web-client-id", client_secret: "web-client-secret", redirect_uri: "https://127.0.0.1:28780/oauth/callback" } };

function webWeaponAccountItem(
  instanceId: string,
  hash: number,
  name: string,
  bucketName: string,
  frameName: string,
  location: string,
  options: { power?: number; locked?: boolean; socketPlugs?: AccountItemSummary["socket_plugs"] } = {}
) {
  const sourceKind = location === "仓库" ? "vault" : location.includes("背包") ? "inventory" : "equipped";

  return createFixtureAccountItem({
    instanceId,
    hash,
    name,
    icon: createWebDefinitionIcon(name.slice(0, 1), "#67533a"),
    bucketName,
    groupKey: "weapons",
    frameName,
    itemType: "武器",
    power: options.power ?? 2018 + (hash % 7),
    locked: options.locked,
    socketPlugs: options.socketPlugs ?? [{ hash: 4001, name: "快速命中" }, { hash: 4002, name: "爆炸载荷" }],
    sourceKind,
    sourceCharacterId: location === "术士背包" ? "web-warlock" : "web-hunter"
  });
}

function webArmorAccountItem(instanceId: string, hash: number, name: string, bucketName: string, location: string, power: number) {
  return createFixtureAccountItem({
    instanceId,
    hash,
    name,
    icon: createWebDefinitionIcon(name.slice(0, 1), "#4f6248"),
    bucketName,
    groupKey: "armor",
    frameName: "",
    itemType: bucketName,
    power,
    classType: 1,
    armorStats: { total: 66, health: 14, melee: 10, grenade: 12, super: 8, class: 12, weapon: 10 },
    socketPlugs: [],
    sourceKind: location === "仓库" ? "vault" : location.includes("背包") ? "inventory" : "equipped",
    sourceCharacterId: "web-hunter"
  });
}

export function getWebLoadoutItemStatus(item: LoadoutTemplateItem) {
  if (item.instance_id === "web-pulse-equipped") {
    return { key: "equipped", badge_label: "已装备", badge_tone: "ready", location_label: "当前角色已装备" };
  }
  return { key: "vault", badge_label: "仓库待取", badge_tone: "info", location_label: "仓库", guidance_label: "可自动补齐", guidance_hint: "Web mock 暂不执行写操作。" };
}

export function getWebSourceItem(item: LoadoutTemplateItem) {
  return item.instance_id ? { instance_id: item.instance_id, source_kind: item.instance_id.includes("vault") ? "vault" : "inventory", source_character_id: "web-hunter" } : null;
}

function findWebLoadoutTemplate(templateId: string) {
  return webLoadoutTemplates.find((template) => template.id === templateId)
    ?? webLoadoutTemplates[0]
    ?? null;
}

function createWebActiveLoadout(templateId: string) {
  const selectedTemplate = findWebLoadoutTemplate(templateId);
  const activeLoadoutLookup = selectedTemplate ? buildLoadoutTemplateLookup(selectedTemplate) : null;

  return { selectedTemplate, activeLoadoutLookup };
}

export function createWebHomePageModel(snapshot: WebHomeSnapshot) {
  return selectHomePageModel({
    state: snapshot.homeState,
    accountError: "",
    hasAccountData: true,
    briefingFetchedAt: new Date().toISOString(),
    diagnosticRows: [{ tone: "warning" }],
    dailySummary: snapshot.homeDailySummary,
    weeklySummary: snapshot.homeWeeklySummary
  });
}

export function createWebAccountPageModel(input: {
  selectedCharacterId: string;
  selectedTemplateId: string;
}) {
  const { selectedTemplate, activeLoadoutLookup } = createWebActiveLoadout(input.selectedTemplateId);

  return selectAccountPageModel({
    cache: {
      accountSummary: webAccountSummary,
      activitySummary: webActivitySummary
    },
    pageState: {
      selectedCharacterId: input.selectedCharacterId,
      lastAccountLoadedAt: new Date("2026-07-23T09:47:39+08:00"),
      openingItemKey: "",
      isLoadoutMatch: (item) => matchesLoadoutTemplateItem(item, activeLoadoutLookup),
      isBungieConfigured: true,
      isAccountLoggedIn: true,
      isLoadingAccount: false,
      accountStatusLabel: "账号已读取",
      accountError: "",
      accountWarning: "",
      itemDetailError: "",
      activityMessage: "",
      activityError: "",
      loadoutMessage: "",
      itemActionMessage: "",
      isRunningItemAction: false,
      activeLoadoutTemplateName: selectedTemplate?.name
    }
  });
}

export function createWebVaultPageModel(input: {
  selectedCharacterId: string;
  selectedTemplateId: string;
}) {
  const { selectedTemplate, activeLoadoutLookup } = createWebActiveLoadout(input.selectedTemplateId);

  return selectVaultPageModel({
    account: webAccountSummary,
    selectedCharacterId: input.selectedCharacterId,
    activeLoadoutLookup,
    activeLoadoutName: selectedTemplate?.name,
    tags: webVaultTags,
    targetRules: webLocalTargetRules,
    wishlist: webWishlist
  });
}

export function createWebLoadoutsPageModel(input: {
  selectedTemplateId: string;
  selectedEntryId: string;
  compareTemplateId: string;
  showDiffOnly: boolean;
}) {
  return selectLoadoutsPageModel({
    accountSummary: webAccountSummary,
    templates: webLoadoutTemplates,
    selectedTemplateId: input.selectedTemplateId,
    selectedEntryId: input.selectedEntryId,
    compareTemplateId: input.compareTemplateId,
    showDiffOnly: input.showDiffOnly
  });
}

export function createWebLibraryPageModel(input: {
  libraryViewMode: "equipment" | "perks";
  equipmentFilters: LibraryEquipmentFilter;
  perkFilters: LibraryPerkFilter;
  libraryHistory?: LibraryHistory;
  aliasDraft: string;
  aliasTargetDraft: string;
  aliasKind: "item" | "perk";
}) {
  return selectLibraryPageModel({
    items: webLibraryItems,
    perks: webLibraryPerks,
    perkRelatedEquipment: webPerkRelatedEquipment,
    libraryHistory: input.libraryHistory ?? webLibraryHistory,
    libraryCommunityMatch: webLibraryCommunityMatch,
    liveAvailability: webLiveAvailability,
    liveAvailabilityError: "",
    manifestStatus: webManifestStatus,
    manifestStatusError: "",
    accountSummary: webAccountSummary
  }, {
    libraryViewMode: input.libraryViewMode,
    equipmentFilters: input.equipmentFilters,
    perkFilters: input.perkFilters,
    equipmentSearchTouched: true,
    perkSearchTouched: true,
    isSearching: false,
    searchError: "",
    aliasDraft: input.aliasDraft,
    aliasTargetDraft: input.aliasTargetDraft,
    aliasKind: input.aliasKind,
    aliasMessage: "Web mock：别名保存待接 provider。",
    aliasError: "",
    favoriteError: "",
    isLoadingLiveAvailability: false,
    isLoadingManifestStatus: false,
    isInitializingManifest: false,
    manifestTask: null,
    itemDetailLoadingKey: ""
  });
}

export function createWebSettingsPageModel(input: {
  interfaceLocale: "zh-CN" | "en-US";
  bungieLocale: "zh-chs" | "en";
  followInterfaceLocaleForBungie: boolean;
  initialSection?: SettingsSectionKey;
}) {
  return selectSettingsPageModel({
    interfaceLocale: input.interfaceLocale,
    initialSection: input.initialSection ?? "overview",
    message: "",
    error: "",
    diagnosticDataDir: "Web mock storage",
    appUpdateSnapshot: webUpdateSnapshot,
    manifestStatus: webManifestStatus,
    manifestStatusError: "",
    isLoadingManifestStatus: false,
    isInitializingManifest: false,
    accountSummary: webAccountSummary,
    accountError: "",
    accountWarning: "",
    isLoadingAccount: false,
    lastAccountLoadedAt: new Date("2026-07-03T14:18:00+08:00"),
    isAiConfigured: true,
    backgroundTasks: webBackgroundTasks,
    actionLog: webActionLog,
    actionLogResultFilter: "all",
    actionLogTypeFilter: "all",
    languagePreferences: {
      interfaceLocale: input.interfaceLocale,
      bungieLocale: input.bungieLocale,
      followInterfaceLocaleForBungie: input.followInterfaceLocaleForBungie
    }
  });
}

export const webAssistantInitialMessages: AiAssistantMessageView[] = [
  {
    role: "assistant",
    text: "Web 入口已接入共享 AI 助手界面。当前会根据所在页面使用账号与首页情报作为上下文，后续由 Web provider 提供真实账号和 AI 服务。"
  }
];

export const webAssistantQuickPrompts = [
  "今天先刷什么",
  "仓库清理建议",
  "资料库状态怎么处理",
  "首页哪些状态需要优先看"
];

export function createWebAssistantContext(snapshot: WebHomeSnapshot, account: AccountSummary = webAccountSummary, activePage: ShellPageKey = "home"): AiAssistantContextView {
  const pageLabels: Record<ShellPageKey, string> = {
    home: "首页工作台",
    account: "账号页",
    vault: "仓库页",
    loadouts: "配装页",
    library: "资料库",
    vendors: "商人页",
    settings: "设置页"
  };
  const pageLabel = pageLabels[activePage];

  return {
    pageLabel,
    focus: activePage === "account" ? "核对当前角色装备、账号物品、光等和活动记录。" : "只看官方可确认的本周活动、限时事件和商人库存。",
    facts: [
      ...snapshot.shellStatus.filter((item) => item.key !== "account").map((item) => `${item.label}：${item.value}`),
      `账号：${account.account_name}（预览数据）`,
      `角色：${account.characters.length} 个`,
      `仓库：${account.vault.item_count} 件`,
      `材料：${account.materials.item_count} 种`
    ],
    itemCount: account.vault.item_count,
    characterCount: account.characters.length,
    materialCount: account.materials.item_count,
    dailyLoaded: true,
    snapshotState: "unsaved",
    snapshotLabel: "Web 预览未创建上下文快照"
  };
}

export function createWebAssistantContextChip(context: AiAssistantContextView) {
  return [
    `当前页面：${context.pageLabel}`,
    `仓库 ${context.itemCount} 件`,
    `角色 ${context.characterCount} 个`,
    context.dailyLoaded ? "今日信息已载入" : "今日信息未载入",
    context.snapshotLabel
  ].join(" · ");
}

export function createWebAssistantReply() {
  return "这是 Web adapter 的 mock 回复：当前页面使用共享 AI 助手 View，真实回答会在 Web provider 接入账号和 AI 服务后替换。";
}

export function useWebFixtureRuntime() {
  return useMemo(() => ({
    accountSummary: webAccountSummary,
    accountDataResource: webAccountDataResource,
    activitySummary: webActivitySummary,
    loadoutTemplates: webLoadoutTemplates,
    applicationLoadoutPlans: webApplicationLoadoutPlans,
    equipmentFilters: webEquipmentFilters,
    perkFilters: webPerkFilters,
    libraryItems: webLibraryItems,
    libraryPerks: webLibraryPerks,
    libraryHistory: webLibraryHistory,
    libraryCommunityMatch: webLibraryCommunityMatch,
    liveAvailability: webLiveAvailability,
    manifestStatus: webManifestStatus,
    appUpdateSnapshot: webUpdateSnapshot,
    vaultTags: webVaultTags,
    localTargetRules: webLocalTargetRules,
    wishlist: webWishlist,
    armorSetCatalog: webArmorSetCatalog,
    backgroundTasks: webBackgroundTasks,
    actionLog: webActionLog,
    bungieConfig: webBungieConfig,
    vendorsModel: selectVendorsPageModel({
      snapshot: null,
      account: webAccountSummary,
      scope: { kind: "account" },
      refreshState: "idle"
    }),
    assistantInitialMessages: webAssistantInitialMessages,
    assistantQuickPrompts: webAssistantQuickPrompts,
    findLoadoutTemplate: findWebLoadoutTemplate,
    createHomePageModel: createWebHomePageModel,
    createAccountPageModel: createWebAccountPageModel,
    createVaultPageModel: createWebVaultPageModel,
    createLoadoutsPageModel: createWebLoadoutsPageModel,
    createLibraryPageModel: createWebLibraryPageModel,
    createSettingsPageModel: createWebSettingsPageModel,
    createAssistantContext: createWebAssistantContext,
    createAssistantContextChip: createWebAssistantContextChip,
    createAssistantReply: createWebAssistantReply
  }), []);
}
