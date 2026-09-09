import type { AccountItemSummary, AccountMaterialSummary, AccountSummary } from "@d2-tools/core/account/summary";
import type { ActivityHistorySummary } from "@d2-tools/core/activities/history";
import { accountEquipmentBucketHashes, bucketLabels } from "@d2-tools/core/items/classification";
import { buildCharacterPowerView, type CharacterPowerView } from "./accountPower.js";

export type AccountOpenItemPayload = {
  item: AccountItemSummary;
  source_character_id: string;
  source_kind?: "equipped" | "inventory" | "postmaster";
  is_postmaster_item?: boolean;
};

export type AccountItemView = {
  key: string;
  name: string;
  icon?: string;
  primaryFacts: string[];
  stateFacts: string[];
  canOpenDetail: boolean;
  isPending: boolean;
  isSyncing: boolean;
  isLoadoutMatch: boolean;
  openPayload: AccountOpenItemPayload;
};

export type AccountReadonlyItemView = {
  key: string;
  name: string;
  icon?: string;
  typeLabel: string;
  sourceLabel: string;
  progressLabel?: string;
  progressPercent?: number;
  isComplete?: boolean;
};

export type AccountReadonlyGroupView = {
  key: string;
  label: string;
  description: string;
  items: AccountReadonlyItemView[];
  status: "neutral" | "warning";
};

export type AccountCharacterTabView = {
  key: string;
  className: string;
  lightLabel: string;
  power: CharacterPowerView;
  emblemUrl?: string;
  isSelected: boolean;
};

export type AccountSlotComparisonViewRow = {
  key: string;
  label: string;
  category: AccountSlotCategoryKey;
  equippedItems: AccountItemView[];
  inventoryItems: AccountItemView[];
};

export type AccountConnectionView = {
  hasAccount: boolean;
  isBungieConfigured: boolean;
  isAccountLoggedIn: boolean;
  canLoadAccount: boolean;
  isLoadingAccount: boolean;
  dataState: "synced" | "cached" | "refreshing";
  accountStatusLabel?: string;
};

export type AccountOperationFeedbackView = {
  tone: "neutral" | "pending" | "success" | "warning" | "error";
  message: string;
  phase?: "submitting" | "syncing" | "confirmed" | "partial" | "partial-confirmed" | "failed" | "delayed" | "paused" | "superseded";
  itemInstanceIds?: string[];
};

export type AccountFeedbackView = {
  accountError: string;
  accountWarning: string;
  itemDetailError: string;
  loadoutMessage: string;
  itemActionMessage: string;
  activityMessage: string;
  activityError: string;
  operation?: AccountOperationFeedbackView;
};

export type AccountProfileView = {
  accountName: string;
  profileLine: string;
  inventoryLine: string;
  snapshotAt?: string | number | Date | null;
};

export type AccountPageNavItem = {
  key: "gear" | "configuration" | "tasks" | "items" | "postmaster" | "activity";
  href: string;
  labelKey: "gear" | "configuration" | "tasks" | "items" | "postmaster" | "activity";
};

export type AccountCharacterDetailView = {
  characterId: string;
  className: string;
  lightLabel: string;
  power: CharacterPowerView;
  emblemUrl?: string;
  summary: string;
};

export type AccountLoadoutSectionView = {
  equippedCount: number;
  inventoryCount: number;
  activeTemplateName?: string;
  selectedCharacterLoadoutMatchCount: number;
  isRunningItemAction: boolean;
  slotComparisonRows: AccountSlotComparisonViewRow[];
};

export type AccountActivitySectionView = {
  summary: ActivityHistorySummary | null;
  message: string;
  error: string;
};

export type AccountConfigurationSectionView = {
  primaryItems: AccountReadonlyItemView[];
  extraItems: AccountReadonlyItemView[];
};

export type AccountTasksSectionView = {
  itemCount: number;
  questCount: number;
  orderCount: number;
  seasonalCount: number;
  groups: AccountReadonlyGroupView[];
};

export type AccountItemsSectionView = {
  itemCount: number;
  carriedCount: number;
  materialCount: number;
  collectionCount: number;
  unknownCount: number;
  groups: AccountReadonlyGroupView[];
};

export type AccountMaterialsSectionView = {
  rows: AccountMaterialRow[];
};

export type AccountPostmasterSectionView = {
  items: AccountItemView[];
  totalCount: number;
};

export type AccountCapacityRiskLevel = "safe" | "warning" | "danger" | "unknown";

export type AccountCapacityMetricView = {
  key: string;
  label: string;
  itemCount: number;
  capacity?: number;
  remaining?: number;
  usagePercent?: number;
  risk: AccountCapacityRiskLevel;
  statusLabel: string;
};

export type AccountCharacterCapacityView = {
  characterId: string;
  className: string;
  overallRisk: AccountCapacityRiskLevel;
  inventoryRisk: AccountCapacityRiskLevel;
  summaryLabel: string;
  postmaster: AccountCapacityMetricView;
  inventoryBuckets: AccountCapacityMetricView[];
  fullBucketCount: number;
  warningBucketCount: number;
};

export type AccountCapacitySectionView = {
  vault: AccountCapacityMetricView;
  selectedCharacter: AccountCharacterCapacityView | null;
  characters: AccountCharacterCapacityView[];
  overallRisk: AccountCapacityRiskLevel;
};

export type AccountPageViewModel = {
  connection: AccountConnectionView;
  feedback: AccountFeedbackView;
  profile: AccountProfileView | null;
  navigation: AccountPageNavItem[];
  characterTabs: AccountCharacterTabView[];
  selectedCharacter: AccountCharacterDetailView | null;
  loadout: AccountLoadoutSectionView;
  configuration: AccountConfigurationSectionView;
  tasks: AccountTasksSectionView;
  items: AccountItemsSectionView;
  activity: AccountActivitySectionView;
  materials: AccountMaterialsSectionView;
  postmaster: AccountPostmasterSectionView;
  capacity: AccountCapacitySectionView;
};

export type SharedDomainCache = {
  accountSummary: AccountSummary | null;
  activitySummary: ActivityHistorySummary | null;
};

export type AccountPageState = {
  selectedCharacterId: string;
  lastAccountLoadedAt?: string | number | Date | null;
  openingItemKey?: string;
  isLoadoutMatch?: (item: AccountItemSummary) => boolean;
  isBungieConfigured: boolean;
  isAccountLoggedIn: boolean;
  isLoadingAccount: boolean;
  isShowingCachedAccount?: boolean;
  accountStatusLabel?: string;
  accountError: string;
  accountWarning?: string;
  itemDetailError: string;
  activityMessage: string;
  activityError: string;
  loadoutMessage: string;
  itemActionMessage: string;
  operationFeedback?: AccountOperationFeedbackView;
  isRunningItemAction: boolean;
  activeLoadoutTemplateName?: string;
};

export type AccountPageModelInput = {
  cache: SharedDomainCache;
  pageState: AccountPageState;
};

export type AccountPageWorkspace = {
  accountProfileLine: string;
  accountInventoryLine: string;
  characterTabs: AccountCharacterTab[];
  materialRows: AccountMaterialRow[];
  loadoutSlotRows: AccountLoadoutSlotRow[];
  selectedCharacter: AccountSummary["characters"][number] | null;
  selectedCharacterItems: AccountItemSummary[];
  equippedSlotCategories: AccountSlotCategory[];
  inventorySlotCategories: AccountSlotCategory[];
  slotComparisonRows: AccountSlotComparisonRow[];
  selectedCharacterLoadoutMatchCount: number;
  postmasterPreviewItems: AccountPostmasterPreviewItem[];
  selectedCharacterSummary: string;
};

export type AccountCharacterTab = {
  key: string;
  character: AccountSummary["characters"][number];
  className: string;
  lightLabel: string;
  power: CharacterPowerView;
  emblemUrl?: string;
  isSelected: boolean;
};

export type AccountMaterialRow = {
  key: string;
  material: AccountMaterialSummary;
  meta: string;
};

export type AccountPostmasterPreviewItem = {
  key: string;
  item: AccountItemSummary;
  meta: string;
  isPending: boolean;
  isLoadoutMatch: boolean;
};

export type AccountLoadoutSlotRow = {
  key: string;
  slot: AccountSummary["characters"][number]["loadout_slots"][number];
  title: string;
  subtitle: string;
  preview: string;
};

export type AccountSlotCategoryKey = "weapons" | "armor" | "equipment" | "other";

export type AccountSlotGroup = {
  key: string;
  label: string;
  category: AccountSlotCategoryKey;
  items: AccountItemSummary[];
};

export type AccountSlotCategory = {
  key: AccountSlotCategoryKey;
  label: string;
  groups: AccountSlotGroup[];
  count: number;
};

export type AccountSlotComparisonRow = {
  key: string;
  label: string;
  category: AccountSlotCategoryKey;
  equippedItems: AccountItemSummary[];
  inventoryItems: AccountItemSummary[];
};

const categoryLabels: Record<AccountSlotCategoryKey, string> = {
  weapons: "武器",
  armor: "护甲",
  equipment: "装备",
  other: "其他"
};

const categoryOrder: AccountSlotCategoryKey[] = ["weapons", "armor", "equipment", "other"];

const configurationBuckets = new Set([
  "职业分支",
  "机灵",
  "飞船",
  "载具",
  "徽标",
  "公会战旗",
  "终结技",
  "动作"
]);

const primaryConfigurationBuckets = new Set(["职业分支", "机灵", "飞船", "载具", "徽标"]);

const bucketOrder = [
  "动能武器",
  "能量武器",
  "威能武器",
  "头盔",
  "臂铠",
  "胸甲",
  "腿甲",
  "职业物品",
  "职业分支",
  "机灵",
  "飞船",
  "载具",
  "徽标",
  "公会战旗",
  "终结技",
  "动作"
];

const otherGroupOrder = [
  "记忆水晶",
  "任务与追踪",
  "材料与货币",
  "消耗品",
  "模组与外观",
  "收藏与纪念",
  "未识别物品"
];

export function createAccountPageWorkspace(input: {
  account: AccountSummary | null;
  selectedCharacterId: string;
  openingItemKey?: string;
  isLoadoutMatch?: (item: AccountItemSummary) => boolean;
}): AccountPageWorkspace {
  const account = input.account;
  const selectedCharacter = account?.characters.find((character) => character.character_id === input.selectedCharacterId)
    ?? account?.characters[0]
    ?? null;
  const selectedCharacterItems = selectedCharacter ? getCharacterCombinedItems(selectedCharacter) : [];
  const combatEquippedItems = selectedCharacter?.equipped_items.filter(isCombatItem) ?? [];
  const combatInventoryItems = selectedCharacter?.inventory_items.filter(isCombatItem) ?? [];

  return {
    accountProfileLine: account ? `Membership ${account.membership_type} / ${account.destiny_membership_id}` : "",
    accountInventoryLine: account
      ? account.vault.capacity
        ? `仓库 ${account.vault.item_count}/${account.vault.capacity}`
        : `仓库 ${account.vault.item_count} 件`
      : "",
    characterTabs: account ? buildAccountCharacterTabs(account, selectedCharacter?.character_id ?? "") : [],
    materialRows: account ? buildAccountMaterialRows(account.materials.items) : [],
    loadoutSlotRows: selectedCharacter ? buildAccountLoadoutSlotRows(selectedCharacter) : [],
    selectedCharacter,
    selectedCharacterItems,
    equippedSlotCategories: selectedCharacter ? groupAccountItemsBySlot(selectedCharacter.equipped_items) : [],
    inventorySlotCategories: selectedCharacter ? groupAccountItemsBySlot(selectedCharacter.inventory_items) : [],
    slotComparisonRows: selectedCharacter
      ? buildAccountSlotComparisonRows(combatEquippedItems, combatInventoryItems)
      : [],
    selectedCharacterLoadoutMatchCount: input.isLoadoutMatch
      ? selectedCharacterItems.filter(input.isLoadoutMatch).length
      : 0,
    postmasterPreviewItems: selectedCharacter
      ? buildPostmasterPreviewItems({
        items: selectedCharacter.postmaster_items,
        openingItemKey: input.openingItemKey ?? "",
        isLoadoutMatch: input.isLoadoutMatch
      })
      : [],
    selectedCharacterSummary: selectedCharacter
      ? `光等 ${selectedCharacter.light ?? "-"} / 已装备 ${selectedCharacter.equipped_items.length} 件 / 背包 ${selectedCharacter.inventory_items.length} 件`
      : ""
  };
}

export function selectAccountPageModel(input: AccountPageModelInput): AccountPageViewModel {
  const { cache, pageState } = input;
  const workspace = createAccountPageWorkspace({
    account: cache.accountSummary,
    selectedCharacterId: pageState.selectedCharacterId,
    openingItemKey: pageState.openingItemKey,
    isLoadoutMatch: pageState.isLoadoutMatch
  });
  const selectedCharacter = workspace.selectedCharacter;
  const selectedCharacterId = selectedCharacter?.character_id ?? "";
  const selectedCharacterPower = workspace.characterTabs.find((tab) => tab.key === selectedCharacterId)?.power;
  const openingItemKey = pageState.openingItemKey ?? "";
  const isLoadoutMatch = pageState.isLoadoutMatch ?? (() => false);
  const syncingItemIds = new Set(
    pageState.operationFeedback
    && ["syncing", "delayed", "partial"].includes(pageState.operationFeedback.phase ?? "")
      ? pageState.operationFeedback.itemInstanceIds ?? []
      : []
  );
  const configuration = buildAccountConfigurationSection(selectedCharacter);
  const tasks = buildAccountTasksSection(selectedCharacter);
  const items = buildAccountItemsSection(selectedCharacter, workspace.materialRows.length);
  const capacity = buildAccountCapacitySection(cache.accountSummary, selectedCharacterId);

  return {
    connection: {
      hasAccount: Boolean(cache.accountSummary),
      isBungieConfigured: pageState.isBungieConfigured,
      isAccountLoggedIn: pageState.isAccountLoggedIn,
      canLoadAccount: pageState.isBungieConfigured && pageState.isAccountLoggedIn,
      isLoadingAccount: pageState.isLoadingAccount,
      dataState: pageState.isLoadingAccount
        ? "refreshing"
        : pageState.isShowingCachedAccount
          ? "cached"
          : "synced",
      accountStatusLabel: pageState.accountStatusLabel
    },
    feedback: {
      accountError: pageState.accountError,
      accountWarning: pageState.accountWarning ?? "",
      itemDetailError: pageState.itemDetailError,
      loadoutMessage: pageState.loadoutMessage,
      itemActionMessage: pageState.itemActionMessage,
      activityMessage: pageState.activityMessage,
      activityError: pageState.activityError,
      operation: pageState.operationFeedback
    },
    profile: cache.accountSummary
      ? {
        accountName: cache.accountSummary.account_name,
        profileLine: workspace.accountProfileLine,
        inventoryLine: workspace.accountInventoryLine,
        snapshotAt: pageState.lastAccountLoadedAt
      }
      : null,
    navigation: accountPageNavigation(),
    characterTabs: workspace.characterTabs.map((tab) => ({
      key: tab.key,
      className: tab.className,
      lightLabel: tab.lightLabel,
      power: tab.power,
      emblemUrl: tab.emblemUrl,
      isSelected: tab.isSelected
    })),
    selectedCharacter: selectedCharacter
      ? {
        characterId: selectedCharacter.character_id,
        className: selectedCharacter.class_name,
        lightLabel: `光等 ${selectedCharacter.light ?? "-"}`,
        power: selectedCharacterPower ?? buildCharacterPowerView(cache.accountSummary!, selectedCharacter),
        emblemUrl: selectedCharacter.emblem_url,
        summary: workspace.selectedCharacterSummary
      }
      : null,
    loadout: {
      equippedCount: workspace.slotComparisonRows.reduce((count, row) => count + row.equippedItems.length, 0),
      inventoryCount: workspace.slotComparisonRows.reduce((count, row) => count + row.inventoryItems.length, 0),
      activeTemplateName: pageState.activeLoadoutTemplateName,
      selectedCharacterLoadoutMatchCount: workspace.selectedCharacterLoadoutMatchCount,
      isRunningItemAction: pageState.isRunningItemAction,
      slotComparisonRows: workspace.slotComparisonRows.map((row) => ({
        key: row.key,
        label: row.label,
        category: row.category,
        equippedItems: row.equippedItems.map((item) => toAccountItemView({
          item,
          sourceCharacterId: selectedCharacterId,
          sourceKind: "equipped",
          openingItemKey,
          isLoadoutMatch,
          syncingItemIds
        })),
        inventoryItems: row.inventoryItems.map((item) => toAccountItemView({
          item,
          sourceCharacterId: selectedCharacterId,
          sourceKind: "inventory",
          openingItemKey,
          isLoadoutMatch,
          syncingItemIds
        }))
      }))
    },
    configuration,
    tasks,
    items,
    activity: {
      summary: cache.activitySummary,
      message: pageState.activityMessage,
      error: pageState.activityError
    },
    materials: {
      rows: workspace.materialRows
    },
    postmaster: {
      items: selectedCharacter
        ? selectedCharacter.postmaster_items.map((item) => toAccountItemView({
          item,
          sourceCharacterId: selectedCharacter.character_id,
          sourceKind: "postmaster",
          openingItemKey,
          isLoadoutMatch,
          syncingItemIds,
          isPostmasterItem: true
        }))
        : [],
      totalCount: selectedCharacter?.postmaster_items.length ?? 0
    },
    capacity
  };
}

function buildAccountCapacitySection(
  account: AccountSummary | null,
  selectedCharacterId: string
): AccountCapacitySectionView {
  const vault = buildCapacityMetric({
    key: "vault",
    label: "仓库",
    itemCount: account?.vault.items.length ?? 0,
    capacity: account?.vault.capacity,
    kind: "vault"
  });
  const characters = account?.characters.map(buildCharacterCapacityView) ?? [];

  return {
    vault,
    selectedCharacter: characters.find((character) => character.characterId === selectedCharacterId) ?? characters[0] ?? null,
    characters,
    overallRisk: highestCapacityRisk([vault.risk, ...characters.map((character) => character.overallRisk)])
  };
}

function buildCharacterCapacityView(
  character: AccountSummary["characters"][number]
): AccountCharacterCapacityView {
  const limitsByBucket = new Map(
    character.capacity_limits?.inventory_buckets.map((bucket) => [bucket.bucket_hash, bucket]) ?? []
  );
  const carriedItems = [...character.equipped_items, ...character.inventory_items];
  const inventoryBuckets = accountEquipmentBucketHashes.map((bucketHash) => {
    const limit = limitsByBucket.get(bucketHash);
    return buildCapacityMetric({
      key: `inventory-${bucketHash}`,
      label: limit?.bucket_name || bucketLabels[bucketHash]?.name || `位置 ${bucketHash}`,
      itemCount: carriedItems.filter((item) => item.equipment_bucket_hash === bucketHash).length,
      capacity: limit?.capacity,
      kind: "inventory"
    });
  });
  const postmaster = buildCapacityMetric({
    key: `postmaster-${character.character_id}`,
    label: "邮政官",
    itemCount: character.postmaster_items.length,
    capacity: character.capacity_limits?.postmaster_capacity,
    kind: "postmaster"
  });
  const fullBucketCount = inventoryBuckets.filter((bucket) => bucket.risk === "danger").length;
  const warningBucketCount = inventoryBuckets.filter((bucket) => bucket.risk === "warning").length;
  const inventoryRisk = highestCapacityRisk(inventoryBuckets.map((bucket) => bucket.risk));
  const overallRisk = highestCapacityRisk([postmaster.risk, inventoryRisk]);

  return {
    characterId: character.character_id,
    className: character.class_name,
    overallRisk,
    inventoryRisk,
    summaryLabel: characterCapacitySummary({ postmaster, fullBucketCount, warningBucketCount, overallRisk }),
    postmaster,
    inventoryBuckets,
    fullBucketCount,
    warningBucketCount
  };
}

function buildCapacityMetric(input: {
  key: string;
  label: string;
  itemCount: number;
  capacity?: number;
  kind: "inventory" | "postmaster" | "vault";
}): AccountCapacityMetricView {
  const capacity = typeof input.capacity === "number" && input.capacity > 0 ? input.capacity : undefined;
  if (!capacity) {
    return {
      key: input.key,
      label: input.label,
      itemCount: input.itemCount,
      risk: "unknown",
      statusLabel: "容量上限待确认"
    };
  }

  const remaining = Math.max(0, capacity - input.itemCount);
  const warningThreshold = input.kind === "postmaster"
    ? 5
    : input.kind === "vault"
      ? Math.max(10, Math.ceil(capacity * 0.02))
      : 1;
  const risk: AccountCapacityRiskLevel = remaining === 0
    ? "danger"
    : remaining <= warningThreshold
      ? "warning"
      : "safe";
  const statusLabel = risk === "danger"
    ? input.kind === "postmaster" ? "已满，掉落存在覆盖风险" : "已满"
    : risk === "warning"
      ? `接近上限，剩余 ${remaining} 格`
      : `剩余 ${remaining} 格`;

  return {
    key: input.key,
    label: input.label,
    itemCount: input.itemCount,
    capacity,
    remaining,
    usagePercent: Math.min(100, Math.round((input.itemCount / capacity) * 100)),
    risk,
    statusLabel
  };
}

function characterCapacitySummary(input: {
  postmaster: AccountCapacityMetricView;
  fullBucketCount: number;
  warningBucketCount: number;
  overallRisk: AccountCapacityRiskLevel;
}): string {
  if (input.postmaster.risk === "danger") return "邮政官已满，有覆盖风险";
  if (input.fullBucketCount > 0) return `${input.fullBucketCount} 个携带槽位已满`;
  if (input.postmaster.risk === "warning") return input.postmaster.statusLabel;
  if (input.warningBucketCount > 0) return `${input.warningBucketCount} 个携带槽位接近上限`;
  if (input.overallRisk === "unknown") return "部分容量上限待确认";
  return "容量正常";
}

function highestCapacityRisk(risks: AccountCapacityRiskLevel[]): AccountCapacityRiskLevel {
  if (risks.includes("danger")) return "danger";
  if (risks.includes("warning")) return "warning";
  if (risks.includes("unknown")) return "unknown";
  return "safe";
}

function accountPageNavigation(): AccountPageNavItem[] {
  return [
    { key: "gear", href: "#account-gear", labelKey: "gear" },
    { key: "configuration", href: "#account-configuration", labelKey: "configuration" },
    { key: "tasks", href: "#account-tasks", labelKey: "tasks" },
    { key: "postmaster", href: "#account-postmaster", labelKey: "postmaster" },
    { key: "items", href: "#account-items", labelKey: "items" },
    { key: "activity", href: "#account-activity", labelKey: "activity" }
  ];
}

function buildAccountConfigurationSection(
  character: AccountSummary["characters"][number] | null
): AccountConfigurationSectionView {
  const items = character?.equipped_items.filter((item) => configurationBuckets.has(item.bucket_name?.trim() ?? "")) ?? [];
  return {
    primaryItems: toReadonlyItems(
      items.filter((item) => primaryConfigurationBuckets.has(item.bucket_name?.trim() ?? "")),
      "当前配置"
    ),
    extraItems: toReadonlyItems(
      items.filter((item) => !primaryConfigurationBuckets.has(item.bucket_name?.trim() ?? "")),
      "当前配置"
    )
  };
}

function buildAccountTasksSection(
  character: AccountSummary["characters"][number] | null
): AccountTasksSectionView {
  const groups: Record<AccountTaskKind, AccountItemSummary[]> = {
    quests: [],
    orders: [],
    seasonal: []
  };

  for (const item of character ? getCharacterCombinedItems(character) : []) {
    const kind = getAccountTaskKind(item);
    if (kind) groups[kind].push(item);
  }

  return {
    itemCount: groups.quests.length + groups.orders.length + groups.seasonal.length,
    questCount: groups.quests.length,
    orderCount: groups.orders.length,
    seasonalCount: groups.seasonal.length,
    groups: [
      toReadonlyGroup("quests", "任务与步骤", "主线、任务步骤和追踪记录", groups.quests, "角色任务"),
      toReadonlyGroup("orders", "命令与赏金", "枪匠命令、铸造厂命令与赏金", groups.orders, "角色任务"),
      toReadonlyGroup("seasonal", "神器与赛季进度", "神器和赛季加成记录", groups.seasonal, "角色进度")
    ]
  };
}

function buildAccountItemsSection(
  character: AccountSummary["characters"][number] | null,
  materialCount: number
): AccountItemsSectionView {
  const inventoryItems = character?.inventory_items ?? [];
  const carried = inventoryItems.filter((item) => Boolean(getAccountCarryKind(item)));
  const collection = inventoryItems.filter((item) => (
    !getAccountTaskKind(item)
    && !getAccountCarryKind(item)
    && isAccountCollectionItem(item)
  ));
  const unknown = inventoryItems.filter((item) => (
    !isCombatItem(item)
    && !getAccountTaskKind(item)
    && !getAccountCarryKind(item)
    && !isAccountCollectionItem(item)
  ));

  return {
    itemCount: carried.length + materialCount,
    carriedCount: carried.length,
    materialCount,
    collectionCount: collection.length,
    unknownCount: unknown.length,
    groups: [
      toReadonlyGroup("carried", "角色携带物品", "记忆水晶、消耗品和钥匙等角色物品", carried, "当前角色背包"),
      toReadonlyGroup("collection", "外观与可选配置", "未装备的职业分支、飞船、载具、徽标和外观", collection, "当前角色背包"),
      toReadonlyGroup(
        "unknown",
        "未分类数据",
        "暂未识别的角色物品，保留原始数据供查看",
        unknown,
        "当前角色背包",
        unknown.length ? "warning" : "neutral"
      )
    ]
  };
}

type AccountTaskKind = "quests" | "orders" | "seasonal";

function getAccountTaskKind(item: AccountItemSummary): AccountTaskKind | "" {
  const text = accountItemSearchText(item);
  if (includesAny(text, ["命令", "赏金", "bounty", "order"])) return "orders";
  if (includesAny(text, ["神器", "赛季加成", "artifact"])) return "seasonal";
  if (includesAny(text, ["任务", "任务步骤", "周常", "传承", "信条", "召唤", "证章", "回归者", "quest"])) return "quests";
  return "";
}

function getAccountCarryKind(item: AccountItemSummary): "engrams" | "consumables" | "" {
  const text = accountItemSearchText(item);
  if (includesAny(text, ["记忆水晶", "engram"])) return "engrams";
  if (includesAny(text, ["消耗品", "钥匙", "礼物", "加成", "consumable", "boost", "gift", "key"])) return "consumables";
  return "";
}

function isAccountCollectionItem(item: AccountItemSummary): boolean {
  const bucketName = item.bucket_name?.trim() ?? "";
  const text = `${bucketName} ${item.item_type ?? ""}`.toLowerCase();
  return configurationBuckets.has(bucketName)
    || includesAny(text, ["着色器", "配件", "外观", "投影", "shader", "ornament", "projection"]);
}

function isCombatItem(item: AccountItemSummary): boolean {
  return item.group_key === "weapons" || item.group_key === "armor";
}

function accountItemSearchText(item: AccountItemSummary): string {
  return `${item.bucket_name ?? ""} ${item.item_type ?? ""} ${item.name}`.toLowerCase();
}

function toReadonlyGroup(
  key: string,
  label: string,
  description: string,
  items: AccountItemSummary[],
  sourceLabel: string,
  status: AccountReadonlyGroupView["status"] = "neutral"
): AccountReadonlyGroupView {
  return {
    key,
    label,
    description,
    items: toReadonlyItems(items, sourceLabel),
    status
  };
}

function toReadonlyItems(items: AccountItemSummary[], sourceLabel: string): AccountReadonlyItemView[] {
  return items.map((item, index) => {
    const progress = buildReadonlyItemProgress(item);
    return {
      key: `${sourceLabel}:${getAccountPageItemKey(item)}:${index}`,
      name: item.name,
      icon: item.icon,
      typeLabel: item.item_type?.trim() || item.bucket_name?.trim() || "类型未识别",
      sourceLabel,
      ...progress
    };
  });
}

function buildReadonlyItemProgress(item: AccountItemSummary): Pick<AccountReadonlyItemView, "progressLabel" | "progressPercent" | "isComplete"> {
  const objectives = item.item_objectives?.filter((objective) => objective.visible) ?? [];
  if (!objectives.length) return {};

  const isComplete = objectives.every((objective) => objective.complete);
  const progressPercent = Math.round(objectives.reduce((total, objective) => {
    if (objective.completion_value <= 0) return total + Number(objective.complete);
    return total + Math.min(1, Math.max(0, (objective.progress ?? 0) / objective.completion_value));
  }, 0) / objectives.length * 100);
  const firstObjective = objectives[0];
  const progressLabel = objectives.length === 1
    ? [
        firstObjective.progress_description,
        `${firstObjective.progress ?? 0}/${firstObjective.completion_value}`
      ].filter(Boolean).join(" · ")
    : `${objectives.filter((objective) => objective.complete).length}/${objectives.length} 项目标`;

  return { progressLabel, progressPercent, isComplete };
}

function toAccountItemView(input: {
  item: AccountItemSummary;
  sourceCharacterId: string;
  sourceKind?: "equipped" | "inventory" | "postmaster";
  openingItemKey: string;
  isLoadoutMatch: (item: AccountItemSummary) => boolean;
  syncingItemIds: ReadonlySet<string>;
  isPostmasterItem?: boolean;
}): AccountItemView {
  const key = getAccountPageItemKey(input.item);
  const canOpenDetail = input.item.group_key === "weapons" || input.item.group_key === "armor";
  const facts = formatAccountItemFacts(input.item);
  return {
    key,
    name: input.item.name,
    icon: input.item.icon,
    primaryFacts: facts.primary,
    stateFacts: facts.state,
    canOpenDetail,
    isPending: canOpenDetail && key === input.openingItemKey,
    isSyncing: Boolean(input.item.instance_id && input.syncingItemIds.has(input.item.instance_id)),
    isLoadoutMatch: input.isLoadoutMatch(input.item),
    openPayload: {
      item: input.item,
      source_character_id: input.sourceCharacterId,
      source_kind: input.sourceKind,
      is_postmaster_item: input.isPostmasterItem
    }
  };
}

export function buildAccountCharacterTabs(account: AccountSummary, selectedCharacterId: string): AccountCharacterTab[] {
  return account.characters.map((character) => ({
    key: character.character_id,
    character,
    className: character.class_name,
    lightLabel: `光等 ${character.light ?? "-"}`,
    power: buildCharacterPowerView(account, character),
    emblemUrl: character.emblem_url,
    isSelected: character.character_id === selectedCharacterId
  }));
}

export function getCharacterCombinedItems(character: AccountSummary["characters"][number]): AccountItemSummary[] {
  return [
    ...character.equipped_items,
    ...character.inventory_items
  ];
}

export function getAccountPageItemKey(item: AccountItemSummary): string {
  return item.instance_id ? item.instance_id : `hash:${item.hash}`;
}

export function formatAccountItemMeta(item: AccountItemSummary): string {
  return [
    item.equipment_bucket_name ?? item.bucket_name,
    item.tier,
    item.power ? `光等 ${item.power}` : undefined,
    formatArmorStatsSummary(item),
    item.locked ? "已锁定" : undefined
  ].filter(Boolean).join(" / ");
}

export function formatAccountItemFacts(item: AccountItemSummary): {
  primary: string[];
  state: string[];
} {
  return {
    primary: [
      item.group_key === "weapons" ? item.item_type : undefined,
      item.tier,
      typeof item.power === "number" ? `光等 ${item.power}` : undefined
    ].filter((value): value is string => Boolean(value)),
    state: [
      item.group_key === "armor" && item.armor_stats ? `总值 ${item.armor_stats.total}` : undefined,
      item.locked ? "锁定" : undefined
    ].filter((value): value is string => Boolean(value))
  };
}

export function buildAccountMaterialRows(materials: AccountMaterialSummary[]): AccountMaterialRow[] {
  return materials.map((material) => ({
    key: `material:${material.hash}`,
    material,
    meta: formatAccountMaterialMeta(material)
  }));
}

export function formatAccountMaterialMeta(material: AccountMaterialSummary): string {
  return [material.tier, material.item_type].filter(Boolean).join(" / ") || "材料";
}

export function buildPostmasterPreviewItems(input: {
  items: AccountItemSummary[];
  openingItemKey: string;
  isLoadoutMatch?: (item: AccountItemSummary) => boolean;
}): AccountPostmasterPreviewItem[] {
  return input.items.slice(0, 12).map((item) => {
    const key = getAccountPageItemKey(item);
    return {
      key,
      item,
      meta: formatAccountItemMeta(item),
      isPending: key === input.openingItemKey,
      isLoadoutMatch: input.isLoadoutMatch ? input.isLoadoutMatch(item) : false
    };
  });
}

export function buildAccountLoadoutSlotRows(
  character: AccountSummary["characters"][number]
): AccountLoadoutSlotRow[] {
  return character.loadout_slots.map((slot) => ({
    key: `${character.character_id}-loadout-${slot.index}`,
    slot,
    title: slot.name || `配装栏 ${slot.index + 1}`,
    subtitle: `槽位 ${slot.index + 1} / ${slot.item_count} 件装备`,
    preview: slot.items.slice(0, 4).map((item) => item.name).join(" / ") || "当前槽位为空"
  }));
}

export function formatArmorStatsSummary(item: Pick<AccountItemSummary, "armor_stats">): string | undefined {
  if (!item.armor_stats) {
    return undefined;
  }

  return [
    `总值 ${item.armor_stats.total}`,
    `生命值 ${item.armor_stats.health}`,
    `职业 ${item.armor_stats.class}`,
    `手雷 ${item.armor_stats.grenade}`
  ].join(" / ");
}

export function groupAccountItemsBySlot(items: AccountItemSummary[]): AccountSlotCategory[] {
  const groups = new Map<string, AccountSlotGroup>();

  for (const item of items) {
    const label = getAccountSlotLabel(item);
    const category = categoryForItem(item);
    const key = `${category}:${label}`;
    const group = groups.get(key) ?? {
      key,
      label,
      category,
      items: []
    };
    group.items.push(item);
    groups.set(key, group);
  }

  const sortedGroups = [...groups.values()].sort(compareSlotGroups);
  return categoryOrder
    .map((key) => {
      const categoryGroups = sortedGroups.filter((group) => group.category === key);
      return {
        key,
        label: categoryLabels[key],
        groups: categoryGroups,
        count: categoryGroups.reduce((sum, group) => sum + group.items.length, 0)
      };
    })
    .filter((category) => category.groups.length > 0);
}

export function buildAccountSlotComparisonRows(
  equippedItems: AccountItemSummary[],
  inventoryItems: AccountItemSummary[]
): AccountSlotComparisonRow[] {
  const rows = new Map<string, AccountSlotComparisonRow>();

  for (const item of equippedItems) {
    const row = getOrCreateSlotComparisonRow(rows, item);
    row.equippedItems.push(item);
  }

  for (const item of inventoryItems) {
    const row = getOrCreateSlotComparisonRow(rows, item);
    row.inventoryItems.push(item);
  }

  return [...rows.values()].sort(compareSlotComparisonRows);
}

function getOrCreateSlotComparisonRow(
  rows: Map<string, AccountSlotComparisonRow>,
  item: AccountItemSummary
): AccountSlotComparisonRow {
  const label = getAccountSlotLabel(item);
  const category = categoryForItem(item);
  const key = `${category}:${label}`;
  const existing = rows.get(key);
  if (existing) {
    return existing;
  }

  const row = {
    key,
    label,
    category,
    equippedItems: [],
    inventoryItems: []
  };
  rows.set(key, row);
  return row;
}

function compareSlotComparisonRows(left: AccountSlotComparisonRow, right: AccountSlotComparisonRow): number {
  return slotRank(left.label) - slotRank(right.label)
    || categoryOrder.indexOf(left.category) - categoryOrder.indexOf(right.category)
    || left.label.localeCompare(right.label, "zh-Hans-CN");
}

export function getAccountSlotLabel(item: AccountItemSummary): string {
  return item.bucket_name?.trim() || inferOtherSlotName(item);
}

function categoryForItem(item: AccountItemSummary): AccountSlotCategoryKey {
  if (item.group_key === "weapons" || item.group_key === "armor" || item.group_key === "equipment") {
    return item.group_key;
  }
  return "other";
}

function compareSlotGroups(left: AccountSlotGroup, right: AccountSlotGroup): number {
  return slotRank(left.label) - slotRank(right.label)
    || categoryOrder.indexOf(left.category) - categoryOrder.indexOf(right.category)
    || left.label.localeCompare(right.label, "zh-Hans-CN");
}

function slotRank(label: string): number {
  const index = bucketOrder.indexOf(label);
  if (index !== -1) return index;

  const otherIndex = otherGroupOrder.indexOf(label);
  return otherIndex === -1 ? 999 : 100 + otherIndex;
}

function inferOtherSlotName(item: AccountItemSummary): string {
  const type = item.item_type?.trim() ?? "";
  const name = item.name.trim();
  const text = `${type} ${name}`.toLowerCase();

  if (name.includes("记忆水晶") || text.includes("engram")) {
    return "记忆水晶";
  }
  if (includesAny(text, ["任务", "悬赏", "追踪", "证章", "行动", "召唤", "quest", "bounty"])) {
    return "任务与追踪";
  }
  if (includesAny(text, ["货币", "材料", "核心", "硬币", "水晶", "碎片", "currency", "material"])) {
    return "材料与货币";
  }
  if (includesAny(text, ["消耗品", "加成", "礼物", "钥匙", "consumable", "boost", "gift", "key"])) {
    return "消耗品";
  }
  if (includesAny(text, ["模组", "着色器", "皮肤", "投影", "mod", "shader", "ornament", "projection"])) {
    return "模组与外观";
  }
  if (includesAny(text, ["传承", "信条", "纪念", "收藏", "legacy", "collectible", "memento"])) {
    return "收藏与纪念";
  }
  return "未识别物品";
}

function includesAny(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => value.includes(pattern));
}
