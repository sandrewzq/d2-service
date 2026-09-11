import { evaluateLocalTargets, summarizeLocalTargetMatches, type LocalTargetRules } from "@d2-tools/core/analysis/targets";
import { evaluateWishlistRoll } from "@d2-tools/core/analysis/wishlist";
import type { DimWishlist } from "@d2-tools/core/analysis/wishlistImport";
import type { AccountItemSummary, AmmoTypeKey, EquipmentGroupKey } from "@d2-tools/core/account/summary";
import type { ArmorSetCatalogItem } from "@d2-tools/core/items/equipableItemSet";
import type { ArmorStatKey } from "@d2-tools/core/loadouts/analysis";
import type { VaultTags, VaultTagValue } from "@d2-tools/core/vault/tags";

export type VaultGroupFilter = EquipmentGroupKey | "all";
export type VaultSlotFilter = string | "all";
export type VaultLocationFilter = "vault" | "all" | "current_inventory" | "current_equipped" | "current_postmaster" | "other_characters";
export type VaultItemSourceKind = "equipped" | "inventory" | "vault" | "postmaster";
export type VaultLocatedItem = AccountItemSummary & {
  source_character_id?: string;
  source_kind: VaultItemSourceKind;
  source_label: string;
  is_vault_item?: boolean;
  is_postmaster_item?: boolean;
};
export type VaultAmmoFilter = AmmoTypeKey | "all";
export type VaultCraftingFilter = "all" | "crafted" | "uncrafted";
export type VaultArmorStatFilter = ArmorStatKey | "total" | "all";
export type VaultSortKey = "name" | "group" | "tier" | "power" | "armor-total" | ArmorStatKey;
export type VaultTagFilter = Exclude<VaultTagValue, "none"> | "all" | "untagged" | "noted" | "wishlist" | "target";
export type VaultLockFilter = "all" | "locked" | "unlocked";
export type VaultRarityFilter = "all" | "legendary" | "exotic";
export type VaultGearTierFilter = "all" | "0" | "1" | "2" | "3" | "4" | "5";
export type VaultClassFilter = "all" | "titan" | "hunter" | "warlock";
export type VaultDamageFilter = "all" | "kinetic" | "arc" | "solar" | "void" | "stasis" | "strand";
export type VaultArmorSetFilter = string | "all";
export type VaultViewMode = "list" | "duplicates";

export type VaultArmorStatRule = {
  stat: ArmorStatKey | "";
  min: number;
};

export type VaultFilter = {
  group: VaultGroupFilter;
  query: string;
  tag?: VaultTagFilter;
  lock?: VaultLockFilter;
  slot?: VaultSlotFilter;
  location?: VaultLocationFilter;
  currentCharacterId?: string;
  ammo?: VaultAmmoFilter;
  crafting?: VaultCraftingFilter;
  itemType?: string;
  rarity?: VaultRarityFilter;
  gearTier?: VaultGearTierFilter;
  classType?: VaultClassFilter;
  damageType?: VaultDamageFilter;
  armorSet?: VaultArmorSetFilter;
  armorStatRules?: VaultArmorStatRule[];
  frames?: string[];
  tags?: VaultTags;
  wishlist?: DimWishlist | null;
  localTargetRules?: LocalTargetRules | null;
};

type ParsedVaultQuery = {
  text: string;
  tag?: VaultTagFilter;
  locked?: boolean;
  type?: VaultGroupFilter;
};

export type VaultGroupSummary = {
  key: VaultGroupFilter;
  label: string;
  count: number;
};

export type VaultSlotSummary = {
  key: VaultSlotFilter;
  label: string;
  count: number;
};

export type VaultLocationSummary = {
  key: VaultLocationFilter;
  label: string;
  count: number;
};

export type VaultSection = {
  key: string;
  label: string;
  count: number;
  items: AccountItemSummary[];
};

export type VaultFrameFilter = string[];

export type VaultFrameOption = {
  key: string;
  label: string;
  count: number;
};

export type VaultArmorSetOption = {
  key: string;
  label: string;
  count: number;
};

export type VaultListWorkspace = {
  armorSetFilters: VaultArmorSetOption[];
  availableFrameFilters: VaultFrameOption[];
  contextFacts: string[];
  filteredItems: AccountItemSummary[];
  groups: VaultGroupSummary[];
  localTargetMatchCount: number;
  sections: VaultSection[];
  slotFilters: VaultSlotSummary[];
  wishlistMatchCount: number;
};

export const vaultGroupLabels: Record<VaultGroupFilter, string> = {
  all: "全部",
  weapons: "武器",
  armor: "护甲",
  equipment: "装备",
  other: "其他"
};

export const vaultGroupOrder: VaultGroupFilter[] = ["all", "weapons", "armor", "equipment", "other"];
export const defaultVaultGroupTab: VaultGroupFilter = "weapons";

export const locationFilterLabels: Record<VaultLocationFilter, string> = {
  vault: "仓库整理",
  all: "定位结果",
  current_inventory: "当前背包",
  current_equipped: "当前已装备",
  current_postmaster: "当前邮政官",
  other_characters: "其他角色"
};

const visibleVaultLocationFilters: Array<Exclude<VaultLocationFilter, "all">> = [
  "vault",
  "current_inventory",
  "current_equipped",
  "current_postmaster",
  "other_characters"
];

export const tagLabels: Record<VaultTagFilter, string> = {
  all: "全部标记",
  keep: "保留",
  review: "待定",
  junk: "清理",
  farm: "待刷",
  loadout: "配装用",
  untagged: "未标记",
  noted: "有备注",
  wishlist: "DIM 愿望单",
  target: "目标命中"
};

export const sortLabels: Record<VaultSortKey, string> = {
  name: "按名称",
  group: "按分组",
  tier: "按品质",
  power: "按光等",
  "armor-total": "按护甲总值",
  health: "按生命值",
  melee: "按近战",
  grenade: "按手雷",
  super: "按超能",
  class: "按职业",
  weapon: "按武器"
};

export const lockFilterLabels: Record<VaultLockFilter, string> = {
  all: "全部锁定状态",
  locked: "已锁定",
  unlocked: "未锁定"
};

export const ammoFilterLabels: Record<VaultAmmoFilter, string> = {
  all: "全部弹药",
  primary: "主弹",
  special: "特殊",
  heavy: "重弹"
};

export const rarityFilterLabels: Record<VaultRarityFilter, string> = {
  all: "全部",
  legendary: "传说",
  exotic: "异域"
};

export const gearTierFilterLabels: Record<VaultGearTierFilter, string> = {
  all: "全部",
  "0": "T0",
  "1": "T1",
  "2": "T2",
  "3": "T3",
  "4": "T4",
  "5": "T5"
};

export const classFilterLabels: Record<VaultClassFilter, string> = {
  all: "全部",
  titan: "泰坦",
  hunter: "猎人",
  warlock: "术士"
};

export const damageFilterLabels: Record<VaultDamageFilter, string> = {
  all: "全部",
  kinetic: "动能",
  arc: "电弧",
  solar: "烈日",
  void: "虚空",
  stasis: "冰影",
  strand: "缚丝"
};

export const craftingFilterLabels: Record<VaultCraftingFilter, string> = {
  all: "全部",
  crafted: "可锻造",
  uncrafted: "非锻造"
};

export const armorStatLabels: Record<ArmorStatKey, string> = {
  health: "生命值",
  melee: "近战",
  grenade: "手雷",
  super: "超能",
  class: "职业",
  weapon: "武器"
};

export const groupSortOrder: Record<EquipmentGroupKey, number> = {
  weapons: 0,
  armor: 1,
  equipment: 2,
  other: 3
};

export function createVaultListWorkspace(input: {
  items: AccountItemSummary[];
  armorSetCatalog?: ArmorSetCatalogItem[];
  filter: VaultFilter;
  sortKey: VaultSortKey;
  tags: VaultTags;
  wishlist?: DimWishlist | null;
  localTargetRules?: LocalTargetRules | null;
}): VaultListWorkspace {
  const baseFilter = {
    ...input.filter,
    tags: input.tags,
    wishlist: input.wishlist,
    localTargetRules: input.localTargetRules
  };
  const availableFrameFilters = buildVaultFrameFilters(filterVaultItems(input.items, {
    ...baseFilter,
    query: "",
    frames: undefined
  }));
  const slotFilters = buildVaultSlotFilters(filterVaultItems(input.items, {
    ...baseFilter,
    query: "",
    slot: "all"
  }));
  const filteredItems = sortVaultItems(filterVaultItems(input.items, baseFilter), input.sortKey, input.tags);
  const filter = input.filter;
  const armorSetFilters = buildVaultArmorSetFilters(input.armorSetCatalog ?? [], input.items);

  return {
    armorSetFilters,
    availableFrameFilters,
    contextFacts: buildVaultContextFacts({
      group: filter.group,
      query: filter.query,
      tagFilter: filter.tag ?? "all",
      lockFilter: filter.lock ?? "all",
      slotFilter: filter.slot ?? "all",
      locationFilter: filter.location ?? "all",
      ammoFilter: filter.ammo ?? "all",
      craftingFilter: filter.crafting ?? "all",
      itemTypeFilter: filter.itemType ?? "all",
      rarityFilter: filter.rarity ?? "all",
      gearTierFilter: filter.gearTier ?? "all",
      classFilter: filter.classType ?? "all",
      damageFilter: filter.damageType ?? "all",
      armorSetFilter: filter.armorSet ?? "all",
      armorSetLabel: armorSetFilters.find((option) => option.key === filter.armorSet)?.label,
      frameFilters: filter.frames ?? [],
      armorStatRules: filter.armorStatRules ?? [],
      filteredCount: filteredItems.length,
      totalCount: input.items.length
    }),
    filteredItems,
    groups: buildVaultGroups(input.items),
    localTargetMatchCount: countLocalTargetMatches(input.items, input.localTargetRules),
    sections: buildVaultSections(filteredItems),
    slotFilters,
    wishlistMatchCount: countWishlistMatches(input.items, input.wishlist)
  };
}

export function filterVaultItems(items: AccountItemSummary[], filter: VaultFilter): AccountItemSummary[] {
  const parsedQuery = parseVaultQuery(filter.query);
  const query = parsedQuery.text.toLocaleLowerCase();
  return items.filter((item) => {
    const entry = (filter.tags ?? { items: {} }).items[getVaultItemKey(item)];
    const matchesGroup = filter.group === "all" || item.group_key === filter.group;
    if (!matchesGroup) return false;
    if (!matchesTag(item, filter.tag ?? "all", filter.tags ?? { items: {} }, filter.wishlist, filter.localTargetRules)) return false;
    if (parsedQuery.tag && !matchesTag(item, parsedQuery.tag, filter.tags ?? { items: {} }, filter.wishlist, filter.localTargetRules)) return false;
    if (!matchesArmorStatRules(item, filter.armorStatRules ?? [])) return false;
    if (!matchesLock(item, filter.lock ?? "all")) return false;
    if (!matchesSlot(item, filter.slot ?? "all")) return false;
    if (!matchesLocation(item, filter.location ?? "all", filter.currentCharacterId)) return false;
    if (!matchesAmmo(item, filter.ammo ?? "all")) return false;
    if (!matchesItemType(item, filter.itemType ?? "all")) return false;
    if (!matchesRarity(item, filter.rarity ?? "all")) return false;
    if (!matchesGearTier(item, filter.gearTier ?? "all")) return false;
    if (!matchesClass(item, filter.classType ?? "all")) return false;
    if (!matchesDamage(item, filter.damageType ?? "all")) return false;
    if (!matchesCrafting(item, filter.crafting ?? "all")) return false;
    if (!matchesArmorSet(item, filter.armorSet ?? "all")) return false;
    if (filter.frames?.length && !filter.frames.includes(item.weapon_frame?.key ?? "")) return false;
    if (parsedQuery.locked !== undefined && item.locked !== parsedQuery.locked) return false;
    if (parsedQuery.type && parsedQuery.type !== "all" && item.group_key !== parsedQuery.type) return false;
    if (!query) return true;

    return [
      String(item.hash),
      item.name,
      item.item_type,
      item.tier,
      item.bucket_name,
      item.equipment_bucket_name,
      getVaultItemLocationLabel(item),
      item.armor_set?.name,
      item.weapon_frame?.name,
      formatArmorStatsInline(item),
      tierAlias(item.tier),
      entry?.note
    ]
      .filter(Boolean)
      .some((value) => value?.toLocaleLowerCase().includes(query));
  });
}

export function parseVaultQuery(query: string): ParsedVaultQuery {
  const textParts: string[] = [];
  const parsed: ParsedVaultQuery = { text: "" };
  for (const token of query.trim().split(/\s+/).filter(Boolean)) {
    const lower = token.toLocaleLowerCase();
    if (lower.startsWith("tag:")) {
      const tag = lower.slice("tag:".length);
      if (isVaultTagFilter(tag)) {
        parsed.tag = tag;
        continue;
      }
    }
    if (lower.startsWith("locked:")) {
      const value = lower.slice("locked:".length);
      if (value === "true" || value === "yes" || value === "已锁定") {
        parsed.locked = true;
        continue;
      }
      if (value === "false" || value === "no" || value === "未锁定") {
        parsed.locked = false;
        continue;
      }
    }
    if (lower.startsWith("type:")) {
      const type = typeFilterFor(lower.slice("type:".length));
      if (type) {
        parsed.type = type;
        continue;
      }
    }
    textParts.push(token);
  }
  parsed.text = textParts.join(" ").trim();
  return parsed;
}

export function buildVaultGroups(items: AccountItemSummary[]): VaultGroupSummary[] {
  return vaultGroupOrder.map((key) => ({
    key,
    label: vaultGroupLabels[key],
    count: key === "all" ? items.length : items.filter((item) => item.group_key === key).length
  }));
}

export function buildVaultSlotFilters(items: AccountItemSummary[]): VaultSlotSummary[] {
  const sections = buildVaultSections(items);
  return [
    { key: "all", label: "全部位置", count: items.length },
    ...sections.map((section) => ({
      key: section.key,
      label: section.label,
      count: section.count
    }))
  ];
}

export function buildVaultLocationFilters(
  items: readonly AccountItemSummary[],
  currentCharacterId?: string
): VaultLocationSummary[] {
  const counts = new Map<Exclude<VaultLocationFilter, "all">, number>(
    visibleVaultLocationFilters.map((key) => [key, 0])
  );
  for (const item of items) {
    if (item.group_key !== "weapons") continue;
    const location = visibleVaultLocationForItem(item, currentCharacterId);
    if (!location) continue;
    counts.set(location, (counts.get(location) ?? 0) + 1);
  }
  return visibleVaultLocationFilters.map((key) => ({
    key,
    label: locationFilterLabels[key],
    count: counts.get(key) ?? 0
  }));
}

export function buildVaultFrameFilters(items: AccountItemSummary[]): VaultFrameOption[] {
  const frameCounts = new Map<string, VaultFrameOption>();

  for (const item of items) {
    if (!item.weapon_frame) continue;
    const current = frameCounts.get(item.weapon_frame.key) ?? {
      key: item.weapon_frame.key,
      label: item.weapon_frame.name,
      count: 0
    };
    current.count += 1;
    frameCounts.set(item.weapon_frame.key, current);
  }

  return [...frameCounts.values()].sort((left, right) => right.count - left.count || compareText(left.label, right.label));
}

export function buildVaultArmorSetFilters(
  catalog: ArmorSetCatalogItem[],
  items: AccountItemSummary[]
): VaultArmorSetOption[] {
  const heldCounts = new Map<string, number>();

  for (const item of items) {
    if (item.group_key !== "armor" || !item.armor_set) continue;
    const key = String(item.armor_set.hash);
    heldCounts.set(key, (heldCounts.get(key) ?? 0) + 1);
  }

  const options = new Map<string, VaultArmorSetOption>();
  for (const item of catalog) {
    const hash = Number(item.hash);
    const label = item.name.trim();
    if (!Number.isFinite(hash) || !label) continue;
    const key = String(hash >>> 0);
    if (!options.has(key)) {
      options.set(key, { key, label, count: heldCounts.get(key) ?? 0 });
    }
  }

  return [...options.values()].sort((left, right) => compareText(left.label, right.label) || left.key.localeCompare(right.key));
}

export function buildVaultSections(items: AccountItemSummary[]): VaultSection[] {
  const sectionMap = new Map<string, VaultSection>();
  for (const item of items) {
    const label = getAccountItemSlotLabel(item);
    const key = label;
    const section = sectionMap.get(key) ?? {
      key,
      label,
      count: 0,
      items: []
    };
    section.items.push(item);
    section.count = section.items.length;
    sectionMap.set(key, section);
  }

  return [...sectionMap.values()].sort(compareVaultSections);
}

export function sortVaultItems(
  items: AccountItemSummary[],
  sortKey: VaultSortKey,
  tags: VaultTags = { items: {} }
): AccountItemSummary[] {
  void tags;
  return [...items].sort((left, right) => {
    if (sortKey === "power") {
      return (right.power ?? 0) - (left.power ?? 0)
        || compareVaultItemIdentity(left, right);
    }

    if (isArmorStatSortKey(sortKey)) {
      return armorStatValue(right, sortKey) - armorStatValue(left, sortKey)
        || compareVaultItemIdentity(left, right);
    }

    if (sortKey === "group") {
      return groupSortOrder[left.group_key] - groupSortOrder[right.group_key]
        || compareVaultItemIdentity(left, right);
    }

    if (sortKey === "tier") {
      return tierRank(left.tier) - tierRank(right.tier)
        || compareVaultItemIdentity(left, right);
    }

    return compareVaultItemIdentity(left, right);
  });
}

/**
 * 名称相同（同一把武器的多个实例）时按实例 ID 固定次序，
 * 保证取出等账号操作后同名卡片不互换位置。
 */
function compareVaultItemIdentity(left: AccountItemSummary, right: AccountItemSummary): number {
  return compareText(left.name, right.name)
    || compareText(left.instance_id, right.instance_id);
}

export function countLocalTargetMatches(items: AccountItemSummary[], rules?: LocalTargetRules | null): number {
  return summarizeLocalTargetMatches(items.map(normalizeCoreItem), rules ?? undefined).matched_count;
}

export function countWishlistMatches(items: AccountItemSummary[], wishlist?: DimWishlist | null): number {
  return items.filter((item) => evaluateWishlistRoll(normalizeCoreItem(item), wishlist ?? undefined).matched).length;
}

export function buildVaultContextFacts(input: {
  group: VaultGroupFilter;
  query: string;
  tagFilter: VaultTagFilter;
  lockFilter: VaultLockFilter;
  slotFilter: VaultSlotFilter;
  locationFilter?: VaultLocationFilter;
  ammoFilter: VaultAmmoFilter;
  craftingFilter?: VaultCraftingFilter;
  itemTypeFilter?: string;
  rarityFilter?: VaultRarityFilter;
  gearTierFilter?: VaultGearTierFilter;
  classFilter?: VaultClassFilter;
  damageFilter?: VaultDamageFilter;
  armorSetFilter?: VaultArmorSetFilter;
  armorSetLabel?: string;
  frameFilters: VaultFrameFilter;
  armorStatRules: VaultArmorStatRule[];
  filteredCount: number;
  totalCount: number;
}): string[] {
  const parsedQuery = parseVaultQuery(input.query);
  const filters = [
    vaultGroupLabels[input.group],
    parsedQuery.tag ? `查询标签：${vaultTagFilterLabel(parsedQuery.tag, input.group)}` : "",
    parsedQuery.locked !== undefined ? `查询锁定：${parsedQuery.locked ? lockFilterLabels.locked : lockFilterLabels.unlocked}` : "",
    parsedQuery.type ? `查询类型：${vaultGroupLabels[parsedQuery.type]}` : "",
    parsedQuery.text.trim() ? `搜索：${parsedQuery.text.trim()}` : "",
    input.tagFilter !== "all" ? vaultTagFilterLabel(input.tagFilter, input.group) : "",
    input.lockFilter !== "all" ? lockFilterLabels[input.lockFilter] : "",
    input.slotFilter !== "all" ? `位置：${input.slotFilter}` : "",
    input.locationFilter && input.locationFilter !== "all" ? `所在位置：${locationFilterLabels[input.locationFilter]}` : "",
    input.ammoFilter !== "all" ? ammoFilterLabels[input.ammoFilter] : "",
    input.craftingFilter && input.craftingFilter !== "all" ? `锻造状态：${craftingFilterLabels[input.craftingFilter]}` : "",
    input.itemTypeFilter && input.itemTypeFilter !== "all" ? `类型：${input.itemTypeFilter}` : "",
    input.rarityFilter && input.rarityFilter !== "all" ? `稀有度：${rarityFilterLabels[input.rarityFilter]}` : "",
    input.gearTierFilter && input.gearTierFilter !== "all" ? `装备阶级：${gearTierFilterLabels[input.gearTierFilter]}` : "",
    input.classFilter && input.classFilter !== "all" ? `职业：${classFilterLabels[input.classFilter]}` : "",
    input.damageFilter && input.damageFilter !== "all" ? `伤害属性：${damageFilterLabels[input.damageFilter]}` : "",
    input.armorSetFilter && input.armorSetFilter !== "all" ? `护甲套装：${input.armorSetLabel ?? input.armorSetFilter}` : "",
    input.frameFilters.length ? `框架：${input.frameFilters.length} 个` : "",
    input.armorStatRules.length ? `护甲属性条件：${input.armorStatRules.length} 条` : ""
  ].filter(Boolean);

  return [
    `仓库筛选：${filters.join(" / ") || "默认筛选"}，命中 ${input.filteredCount} / ${input.totalCount} 件。`
  ];
}

function vaultTagFilterLabel(tag: VaultTagFilter, group: VaultGroupFilter): string {
  return tag === "untagged" && group === "weapons" ? "未整理" : tagLabels[tag];
}

export function getVaultItemKey(item: AccountItemSummary): string {
  return item.instance_id ?? `hash:${item.hash}`;
}

export function getAccountItemSlotLabel(item: AccountItemSummary): string {
  return item.equipment_bucket_name?.trim() || item.bucket_name?.trim() || inferOtherSlotName(item);
}

export function getVaultItemLocationLabel(item: AccountItemSummary): string {
  return isVaultLocatedItem(item) ? item.source_label : "仓库";
}

export function formatArmorStatsInline(item: AccountItemSummary): string | undefined {
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

export function normalizeCoreItem(item: AccountItemSummary): AccountItemSummary & { socket_plugs: NonNullable<AccountItemSummary["socket_plugs"]> } {
  return {
    ...item,
    socket_plugs: item.socket_plugs ?? []
  };
}

function matchesTag(
  item: AccountItemSummary,
  tag: VaultTagFilter,
  tags: VaultTags,
  wishlist?: DimWishlist | null,
  localTargetRules?: LocalTargetRules | null
): boolean {
  if (tag === "all") {
    return true;
  }

  const itemTag = tags.items[getVaultItemKey(item)]?.tag;
  if (tag === "wishlist") {
    return evaluateWishlistRoll(normalizeCoreItem(item), wishlist ?? undefined).matched;
  }
  if (tag === "target") {
    return evaluateLocalTargets(normalizeCoreItem(item), localTargetRules ?? undefined).matched;
  }
  if (tag === "untagged") {
    return !itemTag;
  }
  if (tag === "noted") {
    return Boolean(tags.items[getVaultItemKey(item)]?.note);
  }

  return itemTag === tag;
}

function matchesArmorStatRules(item: AccountItemSummary, rules: VaultArmorStatRule[]): boolean {
  const activeRules = rules
    .map((rule) => ({
      stat: rule.stat,
      min: Number(rule.min)
    }))
    .filter((rule): rule is { stat: ArmorStatKey; min: number } =>
      isArmorStatKey(rule.stat) && Number.isFinite(rule.min)
    );

  if (!activeRules.length) {
    return true;
  }
  if (!item.armor_stats) {
    return false;
  }

  const stats = item.armor_stats;
  return activeRules.every((rule) => stats[rule.stat] >= rule.min);
}

function armorStatValue(item: AccountItemSummary, key: Exclude<VaultArmorStatFilter, "all"> | VaultSortKey): number {
  if (!item.armor_stats) {
    return 0;
  }
  if (key === "armor-total" || key === "total") {
    return item.armor_stats.total;
  }
  if (isArmorStatKey(key)) {
    return item.armor_stats[key];
  }
  return 0;
}

function isArmorStatSortKey(key: VaultSortKey): key is "armor-total" | ArmorStatKey {
  return key === "armor-total" || isArmorStatKey(key);
}

function isArmorStatKey(value: string): value is ArmorStatKey {
  return value === "health"
    || value === "melee"
    || value === "grenade"
    || value === "super"
    || value === "class"
    || value === "weapon";
}

function isVaultTagFilter(value: string): value is VaultTagFilter {
  return value === "all" || value === "keep" || value === "review" || value === "junk"
    || value === "farm" || value === "loadout"
    || value === "untagged" || value === "noted" || value === "wishlist" || value === "target";
}

function typeFilterFor(value: string): VaultGroupFilter | undefined {
  if (value === "weapon" || value === "weapons" || value === "武器") return "weapons";
  if (value === "armor" || value === "护甲") return "armor";
  if (value === "equipment" || value === "装备") return "equipment";
  if (value === "other" || value === "其他") return "other";
  if (value === "all" || value === "全部") return "all";
  return undefined;
}

function matchesLock(item: AccountItemSummary, lock: VaultLockFilter): boolean {
  if (lock === "all") {
    return true;
  }
  if (lock === "locked") {
    return item.locked === true;
  }

  return item.locked === false;
}

function matchesSlot(item: AccountItemSummary, slot: VaultSlotFilter): boolean {
  return slot === "all" || getAccountItemSlotLabel(item) === slot;
}

function matchesLocation(
  item: AccountItemSummary,
  location: VaultLocationFilter,
  currentCharacterId?: string
): boolean {
  if (location === "all") return true;
  const sourceKind = isVaultLocatedItem(item) ? item.source_kind : "vault";
  const sourceCharacterId = isVaultLocatedItem(item) ? item.source_character_id : undefined;
  if (location === "vault") return sourceKind === "vault";
  if (location === "current_inventory") {
    return sourceKind === "inventory" && sourceCharacterId === currentCharacterId;
  }
  if (location === "current_equipped") {
    return sourceKind === "equipped" && sourceCharacterId === currentCharacterId;
  }
  if (location === "current_postmaster") {
    return sourceKind === "postmaster" && sourceCharacterId === currentCharacterId;
  }
  return sourceKind !== "vault" && Boolean(sourceCharacterId) && sourceCharacterId !== currentCharacterId;
}

function visibleVaultLocationForItem(
  item: AccountItemSummary,
  currentCharacterId?: string
): Exclude<VaultLocationFilter, "all"> | undefined {
  const sourceKind = isVaultLocatedItem(item) ? item.source_kind : "vault";
  const sourceCharacterId = isVaultLocatedItem(item) ? item.source_character_id : undefined;
  if (sourceKind === "vault") return "vault";
  if (sourceCharacterId !== currentCharacterId) {
    return sourceCharacterId ? "other_characters" : undefined;
  }
  if (sourceKind === "equipped") return "current_equipped";
  if (sourceKind === "postmaster") return "current_postmaster";
  return sourceKind === "inventory" ? "current_inventory" : undefined;
}

function isVaultLocatedItem(item: AccountItemSummary): item is VaultLocatedItem {
  return "source_kind" in item && typeof item.source_kind === "string" && "source_label" in item;
}

function matchesAmmo(item: AccountItemSummary, ammo: VaultAmmoFilter): boolean {
  return ammo === "all" || item.ammo_type === ammo;
}

function matchesItemType(item: AccountItemSummary, itemType: string): boolean {
  return itemType === "all" || item.item_type === itemType;
}

function matchesRarity(item: AccountItemSummary, rarity: VaultRarityFilter): boolean {
  if (rarity === "all") return true;
  const tier = item.tier?.trim().toLocaleLowerCase();
  if (rarity === "legendary") return tier === "legendary" || tier === "传说";
  return tier === "exotic" || tier === "异域";
}

function matchesGearTier(item: AccountItemSummary, gearTier: VaultGearTierFilter): boolean {
  return gearTier === "all" || String(item.instance?.gear_tier ?? 0) === gearTier;
}

function matchesClass(item: AccountItemSummary, classType: VaultClassFilter): boolean {
  if (classType === "all") return true;
  const expectedClassType = classType === "titan" ? 0 : classType === "hunter" ? 1 : 2;
  return item.class_type === expectedClassType;
}

function matchesDamage(item: AccountItemSummary, damageType: VaultDamageFilter): boolean {
  if (damageType === "all") return true;
  return damageTypeForItem(item) === damageType;
}

function matchesCrafting(item: AccountItemSummary, crafting: VaultCraftingFilter): boolean {
  if (crafting === "all") return true;
  const isCrafted = item.crafting?.kind === "crafted";
  return crafting === "crafted" ? isCrafted : !isCrafted;
}

function matchesArmorSet(item: AccountItemSummary, armorSet: VaultArmorSetFilter): boolean {
  return armorSet === "all" || String(item.armor_set?.hash ?? "") === armorSet;
}

function damageTypeForItem(item: AccountItemSummary): Exclude<VaultDamageFilter, "all"> | undefined {
  switch (item.instance?.damage_type) {
    case 1: return "kinetic";
    case 2: return "arc";
    case 3: return "solar";
    case 4: return "void";
    case 6: return "stasis";
    case 7: return "strand";
    default: return undefined;
  }
}

function compareVaultSections(left: VaultSection, right: VaultSection): number {
  return slotRank(left.label) - slotRank(right.label)
    || left.label.localeCompare(right.label, "zh-Hans-CN");
}

function slotRank(label: string): number {
  const order = [
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
    "动作",
    "记忆水晶",
    "任务与追踪",
    "材料与货币",
    "消耗品",
    "模组与外观",
    "收藏与纪念",
    "未识别物品"
  ];
  const index = order.indexOf(label);
  return index === -1 ? 999 : index;
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

function tierAlias(tier: string | undefined): string | undefined {
  if (!tier) return undefined;
  if (tier.toLocaleLowerCase() === "exotic") return "异域";
  if (tier.toLocaleLowerCase() === "legendary") return "传说";
  return undefined;
}

function tierRank(tier: string | undefined): number {
  const normalized = tier?.toLocaleLowerCase();
  if (normalized === "exotic") return 0;
  if (normalized === "legendary") return 1;
  if (normalized === "rare") return 2;
  return 3;
}

function compareText(left: string | undefined, right: string | undefined): number {
  return (left ?? "").localeCompare(right ?? "", "zh-Hans-CN");
}
