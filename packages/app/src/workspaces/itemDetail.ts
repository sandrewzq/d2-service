import { evaluateLocalTargets, type LocalTargetRules } from "@d2-tools/core/analysis/targets";
import { evaluateWishlistRoll } from "@d2-tools/core/analysis/wishlist";
import type { DimWishlist } from "@d2-tools/core/analysis/wishlistImport";
import type {
  AccountItemPlugSummary,
  AccountItemSummary,
  AccountSummary,
  AmmoTypeKey,
  WeaponFrameSummary
} from "@d2-tools/core/account/summary";
import type { ItemSourceSummary } from "@d2-tools/core/items/source";
import type { ItemPerkGroup } from "@d2-tools/core/items/perks";
import type { ItemReleaseSummary } from "@d2-tools/core/items/release";
import type { ItemDefinitionVersionSummary } from "@d2-tools/core/items/release";
import type { EquipableItemSetSummary } from "@d2-tools/core/items/equipableItemSet";
import type { ItemDefinitionStat, ItemOriginTrait } from "@d2-tools/core/items/search";
import type { WeaponBreakerTypeSummary } from "@d2-tools/core/items/breakerTypes";
import type { DamageTypeSummary } from "@d2-tools/core/items/damageTypes";
import type { VaultTags, VaultTagValue } from "@d2-tools/core/vault/tags";
import { getAllKnownAccountItemsWithSource, type LoadoutSourceItem } from "./loadoutSources.js";

export type SelectedItemSourceKind = "equipped" | "inventory" | "vault" | "postmaster";

export type SelectedItemSource = {
  source_character_id?: string;
  source_kind?: SelectedItemSourceKind;
  is_vault_item?: boolean;
  is_postmaster_item?: boolean;
};

export type ItemDefinitionDetailLike = {
  hash: number;
  name: string;
  description: string;
  icon?: string;
  item_type?: string;
  tier?: string;
  class_type?: number;
  class_name?: string;
  damage_type?: string;
  damage_type_summary?: DamageTypeSummary;
  is_adept?: boolean;
  origin_traits?: ItemOriginTrait[];
  intrinsic_traits?: Array<{
    hash: number;
    name: string;
    description: string;
    icon?: string;
  }>;
  ammo_type?: AmmoTypeKey;
  bucket_hash?: number;
  bucket_name?: string;
  equipment_bucket_hash?: number;
  equipment_bucket_name?: string;
  group_key?: AccountItemSummary["group_key"];
  weapon_frame?: WeaponFrameSummary;
  breaker_type?: WeaponBreakerTypeSummary;
  definition_stats?: ItemDefinitionStat[];
  release?: ItemReleaseSummary;
  definition_version?: ItemDefinitionVersionSummary;
  armor_set?: EquipableItemSetSummary;
  source: ItemSourceSummary;
  perks?: ItemPerkGroup[];
};

export type ItemSearchResultLike = {
  hash: number;
  name: string;
  description: string;
  icon?: string;
  item_type?: string;
  tier?: string;
  class_type?: number;
  class_name?: string;
  damage_type?: string;
  damage_type_summary?: DamageTypeSummary;
  is_adept?: boolean;
  origin_traits?: ItemOriginTrait[];
  intrinsic_traits?: ItemDefinitionDetailLike["intrinsic_traits"];
  ammo_type?: AmmoTypeKey;
  bucket_hash?: number;
  group_key?: AccountItemSummary["group_key"];
  bucket_name?: string;
  weapon_frame?: WeaponFrameSummary;
  breaker_type?: WeaponBreakerTypeSummary;
  definition_stats?: ItemDefinitionStat[];
  release?: ItemReleaseSummary;
  definition_version?: ItemDefinitionVersionSummary;
  armor_set?: EquipableItemSetSummary;
  source: ItemSourceSummary;
  perks?: ItemPerkGroup[];
};

export type SelectedItemDetail = ItemDefinitionDetailLike & {
  item_key: string;
  instance_id?: string;
  power?: number;
  locked?: boolean;
  socket_plugs?: AccountItemPlugSummary[];
  armor_stats?: AccountItemSummary["armor_stats"];
  armor_stat_breakdown?: AccountItemSummary["armor_stat_breakdown"];
  armor_energy?: AccountItemSummary["armor_energy"];
  weapon_stats?: AccountItemSummary["weapon_stats"];
  instance?: AccountItemSummary["instance"];
  item_objectives?: AccountItemSummary["item_objectives"];
  catalyst?: AccountItemSummary["catalyst"];
  sockets?: AccountItemSummary["sockets"];
  weapon_roll?: AccountItemSummary["weapon_roll"];
  group_key?: AccountItemSummary["group_key"];
  bucket_name?: string;
  source_character_id?: string;
  source_kind?: SelectedItemSourceKind;
  is_vault_item?: boolean;
  is_postmaster_item?: boolean;
  is_detail_loading?: boolean;
  detail_loading?: {
    definition: boolean;
    instance: boolean;
  };
  detail_loaded?: {
    definition: boolean;
    instance: boolean;
  };
};

export type SameNameItemSummary = AccountItemSummary & SelectedItemSource & {
  source_kind: SelectedItemSourceKind;
  source_label?: string;
};

export function getItemKey(item: Pick<AccountItemSummary, "hash" | "instance_id">): string {
  return item.instance_id ? item.instance_id : `hash:${item.hash}`;
}

export function selectedItemToAccountItem(item: SelectedItemDetail): AccountItemSummary | null {
  if (!item.group_key) return null;
  return {
    hash: item.hash,
    instance_id: item.instance_id,
    name: item.name,
    icon: item.icon,
    item_type: item.item_type,
    tier: item.tier,
    class_type: item.class_type,
    ammo_type: item.ammo_type,
    bucket_hash: item.bucket_hash,
    bucket_name: item.bucket_name,
    equipment_bucket_hash: item.equipment_bucket_hash,
    equipment_bucket_name: item.equipment_bucket_name,
    group_key: item.group_key,
    weapon_frame: item.weapon_frame,
    power: item.power,
    locked: item.locked,
    armor_stats: item.armor_stats,
    armor_stat_breakdown: item.armor_stat_breakdown,
    armor_energy: item.armor_energy,
    weapon_stats: item.weapon_stats,
    instance: item.instance,
    item_objectives: item.item_objectives,
    catalyst: item.catalyst,
    sockets: item.sockets,
    weapon_roll: item.weapon_roll,
    socket_plugs: item.socket_plugs ?? []
  };
}

export function createSelectedItemPreview(
  item: AccountItemSummary | ItemSearchResultLike,
  source: SelectedItemSource
): SelectedItemDetail {
  const weaponRoll = "weapon_roll" in item ? item.weapon_roll : undefined;
  const sockets = "sockets" in item && item.sockets?.length
    ? item.sockets
    : buildPreviewSocketsFromWeaponRoll(item, weaponRoll);
  return {
    hash: item.hash,
    name: item.name,
    description: "description" in item ? item.description : "",
    icon: item.icon,
    item_type: item.item_type,
    tier: item.tier,
    class_type: "class_type" in item ? item.class_type : undefined,
    class_name: "class_name" in item ? item.class_name : undefined,
    damage_type: "damage_type" in item ? item.damage_type : undefined,
    damage_type_summary: "damage_type_summary" in item ? item.damage_type_summary : undefined,
    is_adept: "is_adept" in item ? item.is_adept : undefined,
    origin_traits: "origin_traits" in item ? item.origin_traits : undefined,
    intrinsic_traits: "intrinsic_traits" in item ? item.intrinsic_traits : undefined,
    ammo_type: "ammo_type" in item ? item.ammo_type : undefined,
    bucket_hash: "bucket_hash" in item ? item.bucket_hash : undefined,
    equipment_bucket_hash: "equipment_bucket_hash" in item ? item.equipment_bucket_hash : undefined,
    weapon_frame: "weapon_frame" in item ? item.weapon_frame : undefined,
    breaker_type: "breaker_type" in item ? item.breaker_type : undefined,
    definition_stats: "definition_stats" in item ? item.definition_stats : undefined,
    release: "release" in item ? item.release : undefined,
    definition_version: "definition_version" in item ? item.definition_version : undefined,
    armor_set: "armor_set" in item ? item.armor_set : undefined,
    source: "source" in item ? item.source : itemDetailLoadingSource,
    perks: "perks" in item ? item.perks : undefined,
    item_key: getItemKey(item),
    instance_id: "instance_id" in item ? item.instance_id : undefined,
    power: "power" in item ? item.power : undefined,
    locked: "locked" in item ? item.locked : undefined,
    armor_stats: "armor_stats" in item ? item.armor_stats : undefined,
    armor_stat_breakdown: "armor_stat_breakdown" in item ? item.armor_stat_breakdown : undefined,
    armor_energy: "armor_energy" in item ? item.armor_energy : undefined,
    weapon_stats: "weapon_stats" in item ? item.weapon_stats : undefined,
    instance: "instance" in item ? item.instance : undefined,
    item_objectives: "item_objectives" in item ? item.item_objectives : undefined,
    catalyst: "catalyst" in item ? item.catalyst : undefined,
    sockets,
    weapon_roll: weaponRoll,
    socket_plugs: "socket_plugs" in item ? item.socket_plugs : undefined,
    group_key: "group_key" in item ? item.group_key : undefined,
    bucket_name: "bucket_name" in item ? item.bucket_name : undefined,
    equipment_bucket_name: "equipment_bucket_name" in item ? item.equipment_bucket_name : undefined,
    source_character_id: source.source_character_id,
    source_kind: source.source_kind,
    is_vault_item: source.is_vault_item,
    is_postmaster_item: source.is_postmaster_item,
    is_detail_loading: false,
    detail_loading: {
      definition: false,
      instance: false
    },
    detail_loaded: {
      definition: "description" in item && Boolean(item.description),
      instance: "sockets" in item && Boolean(item.sockets?.length)
    }
  };
}

function buildPreviewSocketsFromWeaponRoll(
  item: AccountItemSummary | ItemSearchResultLike,
  weaponRoll: AccountItemSummary["weapon_roll"]
): AccountItemSummary["sockets"] {
  if (!weaponRoll?.sockets.length) return undefined;
  const knownPlugs = new Map(
    ("socket_plugs" in item ? item.socket_plugs ?? [] : []).map((plug) => [plug.hash, plug])
  );

  return weaponRoll.sockets.map((socket) => {
    const currentHash = socket.current_plug?.hash;
    const plugByHash = new Map(socket.owned_plugs.map((plug) => [plug.hash, plug]));
    if (socket.current_plug) plugByHash.set(socket.current_plug.hash, socket.current_plug);
    const toPlug = (plug: (typeof socket.owned_plugs)[number]) => ({
      ...plug,
      ...knownPlugs.get(plug.hash),
      socket_index: socket.socket_index
    });
    const selectedPlug = socket.current_plug ? toPlug(socket.current_plug) : undefined;
    return {
      socket_index: socket.socket_index,
      is_visible: true,
      is_enabled: false,
      enable_fail_indexes: [],
      selected_plug: selectedPlug,
      reusable_plugs: [...plugByHash.values()].map((plug) => ({
        ...toPlug(plug),
        selected: plug.hash === currentHash || plug.selected,
        can_insert: false,
        enabled: false,
        insert_fail_indexes: [],
        enable_fail_indexes: [],
        sources: ["instance" as const]
      }))
    };
  });
}

export function mergeSelectedItemDetail(
  current: SelectedItemDetail,
  detail: ItemDefinitionDetailLike
): SelectedItemDetail {
  return {
    ...current,
    ...detail,
    is_detail_loading: false,
    detail_loaded: {
      definition: true,
      instance: current.detail_loaded?.instance ?? false
    }
  };
}

export function collectSelectedSameNameItems(
  accountSummary: AccountSummary | null,
  selectedItem: SelectedItemDetail | null
): SameNameItemSummary[] {
  const selectedAsAccountItem = selectedItem ? selectedItemToAccountItem(selectedItem) : null;
  if (!selectedAsAccountItem || !accountSummary) {
    return [];
  }

  return getAllKnownAccountItemsWithSource(accountSummary)
    .filter((item) => item.name.trim() === selectedAsAccountItem.name.trim())
    .map(toSameNameItemSummary);
}

export function sortSameNameItems(items: SameNameItemSummary[], currentItemKey: string): SameNameItemSummary[] {
  return [...items].sort((left, right) => {
    const leftKey = getItemKey(left);
    const rightKey = getItemKey(right);

    if (leftKey === currentItemKey && rightKey !== currentItemKey) return -1;
    if (rightKey === currentItemKey && leftKey !== currentItemKey) return 1;

    return Number(Boolean(right.locked)) - Number(Boolean(left.locked))
      || left.name.localeCompare(right.name, "zh-Hans-CN");
  });
}

export function selectBestSameNameItem(items: SameNameItemSummary[]): SameNameItemSummary | null {
  return [...items].sort((left, right) =>
    Number(Boolean(right.locked)) - Number(Boolean(left.locked))
  )[0] ?? null;
}

export function buildWishlistInsightText(input: {
  selectedItem: SelectedItemDetail;
  vaultTags: VaultTags;
  importedWishlist: DimWishlist | null;
  localTargetRules: LocalTargetRules;
}): string | null {
  const accountItem = selectedItemToAccountItem(input.selectedItem);
  if (!accountItem) return null;

  const wishlist = evaluateWishlistRoll({
    ...accountItem,
    socket_plugs: accountItem.socket_plugs ?? []
  }, input.importedWishlist ?? undefined);
  const localTarget = evaluateLocalTargets(accountItem, input.localTargetRules);
  if (!wishlist.matched && !localTarget.matched) return null;

  const localTag = input.vaultTags.items[input.selectedItem.item_key]?.tag ?? "none";
  return [
    `${input.selectedItem.name} / 目标命中`,
    wishlist.matched ? `DIM 标签：${wishlist.labels.join(" / ")}` : "",
    localTarget.matched ? `本地目标：${localTarget.labels.join(" / ")}` : "",
    `本地标记：${formatVaultTagLabel(localTag)}`,
    "",
    "命中原因",
    ...[...wishlist.reasons, ...localTarget.reasons].map((reason, index) => `${index + 1}. ${reason}`),
    "",
    `说明：${localTarget.matched ? localTarget.disclaimer : wishlist.disclaimer}`
  ].filter(Boolean).join("\n");
}

export function formatVaultTagLabel(tag: VaultTagValue): string {
  if (tag === "keep") return "保留";
  if (tag === "review") return "待定";
  if (tag === "farm") return "待刷";
  if (tag === "loadout") return "配装用";
  if (tag === "junk") return "清理";
  return "未标记";
}

const itemDetailLoadingSource: ItemSourceSummary = {
  status: "missing",
  label: "详情",
  description: "正在读取来源、perk 和物品说明..."
};

function toSameNameItemSummary(item: LoadoutSourceItem): SameNameItemSummary {
  return item;
}
