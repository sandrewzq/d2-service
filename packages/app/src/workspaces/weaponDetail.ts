import type {
  AccountItemPlugSummary,
  AccountItemSummary,
  AccountWeaponCraftingSummary,
  AmmoTypeKey,
  WeaponFrameSummary,
  WeaponStatKey,
  WeaponStatSummary
} from "@d2-tools/core/account/summary";
import type { ItemPerkGroup, ItemPlugSourceKind, ItemPlugSummary } from "@d2-tools/core/items/perks";
import type {
  ItemDefinitionVersionSummary,
  ItemReleaseSummary
} from "@d2-tools/core/items/release";
import type { ItemSourceSummary } from "@d2-tools/core/items/source";
import type { VaultTagValue } from "@d2-tools/core/vault/tags";
import type { SelectedItemSourceKind } from "./itemDetail.js";

export type WeaponDetailObjectKind = "definition" | "vendor_offer" | "account_instance";

export type WeaponDetailEntryKind = "library" | "vendor" | "vault" | "account" | "loadout";

export type WeaponDetailObjectContext = {
  kind: WeaponDetailObjectKind;
  entry: WeaponDetailEntryKind;
  entry_label: string;
  object_label: string;
  object_id?: string;
  location_label?: string;
  read_only: boolean;
};

export type WeaponDetailIdentity = {
  hash: number;
  name: string;
  description: string;
  icon?: string;
  item_type?: string;
  tier?: string;
  is_exotic: boolean;
  slot?: string;
  ammo?: WeaponDetailAmmo;
  damage?: WeaponDetailDamage;
  frame?: WeaponFrameSummary;
  champion?: WeaponDetailChampionEffect;
  release?: ItemReleaseSummary;
  definition_version?: ItemDefinitionVersionSummary;
  /** 锻造标识：账号实例为 crafted，资料库定义为 craftable；只做锻造，不标强化。 */
  crafting?: {
    kind: "crafted" | "craftable";
    label: string;
    overlay?: string;
    background?: string;
  };
};

export type WeaponDetailAmmo = {
  key: AmmoTypeKey;
  label: string;
  icon?: string;
};

export type WeaponDetailDamage = {
  hash?: number;
  key: string;
  label: string;
  description?: string;
  icon?: string;
};

export type WeaponDetailChampionEffect = {
  key: "barrier" | "overload" | "unstoppable";
  label: string;
  effect_label: "贯穿护盾" | "干扰" | "眩晕";
  description?: string;
  icon?: string;
  source: "weapon" | "plug" | "frame_perk";
};

export type WeaponDetailVersion = {
  hash: number;
  label: string;
  release_label?: string;
  is_current: boolean;
};

export type WeaponStatDirection = "higher" | "lower" | "neutral";

export type WeaponStatAvailability = "definition_only" | "ready" | "current_unavailable";

export type WeaponStatModifier = {
  source: string;
  amount: number;
};

export type WeaponStatTrack = {
  key: WeaponStatKey;
  label: string;
  direction: WeaponStatDirection;
  availability: WeaponStatAvailability;
  standard_value?: number;
  current_value?: number;
  current_delta?: number;
  current_modifiers: WeaponStatModifier[];
  pending_value?: number;
  pending_delta?: number;
  pending_modifiers: WeaponStatModifier[];
};

export type WeaponPerkColumnRole =
  | "intrinsic"
  | "barrel"
  | "magazine"
  | "trait"
  | "origin"
  | "other";

export type WeaponSocketPlugLike = {
  name: string;
  description?: string;
  category_identifier?: string;
  item_type?: string;
};

export type WeaponPerkCandidate = {
  hash: number;
  name: string;
  description: string;
  icon?: string;
  enhanced_of_hash?: number;
};

export type WeaponOwnedPerkCandidate = WeaponPerkCandidate & {
  selected: boolean;
  can_apply: boolean;
  pending: boolean;
  unresolved_in_definition_pool: boolean;
};

export type WeaponPerkPoolColumn = {
  key: string;
  socket_index: number;
  label: string;
  role: WeaponPerkColumnRole;
  candidates: WeaponPerkCandidate[];
  source_kinds?: ItemPlugSourceKind[];
};

export type WeaponPerkSelectionColumn = {
  key: string;
  socket_index: number;
  label: string;
  role: WeaponPerkColumnRole;
  candidates: WeaponOwnedPerkCandidate[];
};

export type WeaponConfigurationKind = "random_roll" | "fixed" | "variable_exotic";
export type WeaponPerkPoolKind = "none" | "randomized" | "selectable";

export type WeaponDetailConfiguration = {
  kind: WeaponConfigurationKind;
  pool_kind: WeaponPerkPoolKind;
  intrinsic?: WeaponPerkCandidate;
  selection_columns: WeaponPerkSelectionColumn[];
  pool_columns: WeaponPerkPoolColumn[];
  has_pending_changes: boolean;
  can_apply_changes: boolean;
};

export type WeaponConfigurationClassification = Pick<WeaponDetailConfiguration, "kind" | "pool_kind">;

export type WeaponSourceKind = "vendor_offer" | "activity_reward" | "live_status" | "manifest_hint";

export type WeaponSourceEntry = {
  id: string;
  kind: WeaponSourceKind;
  label: string;
  description: string;
  icon?: string;
  available_now?: boolean;
  updated_at?: string;
  offer?: WeaponVendorOfferSummary;
};

export type WeaponVendorOfferSummary = {
  offer_id: string;
  vendor_hash?: number;
  vendor_name: string;
  inventory_path?: string;
  price_labels: string[];
  refresh_at?: string;
  can_purchase?: boolean;
  purchase_requirements: string[];
  failure_messages: string[];
};

export type WeaponDetailSources = {
  status: "ready" | "partial" | "unknown";
  updated_at?: string;
  entries: WeaponSourceEntry[];
};

export type WeaponMasterworkSummary = {
  name: string;
  level?: number;
  complete?: boolean;
  stat_key?: WeaponStatKey;
  stat_amount?: number;
};

export type WeaponCatalystSummary = {
  name: string;
  icon?: string;
  acquired?: boolean;
  complete: boolean;
  progress?: number;
  objective?: string;
  acquisition?: string;
  effects: string[];
};

export type WeaponEnhancementSummary = {
  name: string;
  level?: number;
};

export type WeaponDetailUpgrades = {
  masterwork?: WeaponMasterworkSummary;
  mod?: WeaponPerkCandidate;
  catalyst?: WeaponCatalystSummary;
  enhancement?: WeaponEnhancementSummary;
  crafting_level?: number;
  enhanced: boolean;
};

export type WeaponDetailLoadoutReference = {
  id: string;
  name: string;
  kind: "in_game" | "template";
  character_id?: string;
  loadout_index?: number;
};

export type WeaponDetailInstanceMetadata = {
  local_tag?: Exclude<VaultTagValue, "none">;
  note?: string;
  upgrade_status?: WeaponDetailUpgrades;
  loadout_references?: WeaponDetailLoadoutReference[];
};

export type WeaponRecommendationMode = "pve" | "pvp" | "general";

export type WeaponRecommendationMatch = "full" | "partial" | "none" | "not_applicable";

export type WeaponRecommendationSource = "user" | "builtin" | "external" | "dim";

export type WeaponRecommendationPerkCandidate = {
  hash?: number;
  hashes?: number[];
  name: string;
  englishName?: string;
  description?: string;
  icon?: string;
  unresolved?: boolean;
};

export type WeaponRecommendation = {
  id: string;
  mode: WeaponRecommendationMode;
  purposes?: WeaponRecommendationMode[];
  presentation: "combo" | "perk_pool";
  title: string;
  reason: string;
  source: WeaponRecommendationSource;
  source_label: string;
  updated_at?: string;
  external_url?: string;
  perk_options: Array<{
    column_key: string;
    names: string[];
    candidates?: WeaponRecommendationPerkCandidate[];
  }>;
  masterwork_names: string[];
  mod_names: string[];
  match: WeaponRecommendationMatch;
  match_notes: string[];
};

export type WeaponDetailInstance = {
  item_key: string;
  instance_id: string;
  hash: number;
  name: string;
  icon?: string;
  power?: number;
  location: string;
  source_kind: SelectedItemSourceKind;
  source_character_id?: string;
  locked?: boolean;
  equipped?: boolean;
  local_tag?: Exclude<VaultTagValue, "none">;
  note?: string;
  upgrade_status?: WeaponDetailUpgrades;
  loadout_references?: WeaponDetailLoadoutReference[];
  current: boolean;
  plugs: Array<{
    hash: number;
    name: string;
    icon?: string;
  }>;
  plug_names: string[];
};

export type WeaponDetailViewModel = {
  identity: WeaponDetailIdentity;
  context: WeaponDetailObjectContext;
  versions: WeaponDetailVersion[];
  stats: WeaponStatTrack[];
  configuration: WeaponDetailConfiguration;
  sources: WeaponDetailSources;
  upgrades: WeaponDetailUpgrades;
  recommendations: WeaponRecommendation[];
  personal_targets: WeaponRecommendation[];
  same_hash_instances: WeaponDetailInstance[];
  loading: boolean;
  loading_state: {
    definition: boolean;
    instance: boolean;
    versions: boolean;
  };
};

export type WeaponDetailSelectedItemLike = {
  hash: number;
  name: string;
  description?: string;
  icon?: string;
  item_type?: string;
  tier?: string;
  item_key?: string;
  instance_id?: string;
  power?: number;
  locked?: boolean;
  bucket_name?: string;
  ammo_type?: AmmoTypeKey;
  weapon_frame?: WeaponFrameSummary;
  weapon_stats?: WeaponStatSummary;
  release?: ItemReleaseSummary;
  definition_version?: ItemDefinitionVersionSummary;
  socket_plugs?: AccountItemPlugSummary[];
  perks?: ItemPerkGroup[];
  source: ItemSourceSummary;
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
  crafting?: AccountWeaponCraftingSummary;
  craftable?: boolean;
};

export type WeaponDetailInstanceLike = Pick<
  AccountItemSummary,
  "hash" | "instance_id" | "name" | "icon" | "power" | "locked" | "socket_plugs"
> & {
  item_key?: string;
  source_kind: SelectedItemSourceKind;
  source_label?: string;
  source_character_id?: string;
  equipped?: boolean;
  local_tag?: Exclude<VaultTagValue, "none">;
  note?: string;
  upgrade_status?: WeaponDetailUpgrades;
  loadout_references?: WeaponDetailLoadoutReference[];
};

export type BuildWeaponDetailViewModelInput = {
  item: WeaponDetailSelectedItemLike;
  context?: Partial<WeaponDetailObjectContext>;
  slot?: string;
  ammo?: WeaponDetailAmmo;
  damage?: WeaponDetailDamage;
  champion?: WeaponDetailChampionEffect;
  is_exotic?: boolean;
  versions?: WeaponDetailVersion[];
  definition_stats?: WeaponStatSummary;
  current_stats?: WeaponStatSummary;
  pending_stats?: WeaponStatSummary;
  stat_modifiers?: Partial<Record<WeaponStatKey, WeaponStatModifier[]>>;
  pending_stat_modifiers?: Partial<Record<WeaponStatKey, WeaponStatModifier[]>>;
  configuration?: Partial<WeaponDetailConfiguration>;
  selection_columns?: WeaponPerkSelectionColumn[];
  pool_columns?: WeaponPerkPoolColumn[];
  sources?: WeaponDetailSources;
  upgrades?: WeaponDetailUpgrades;
  recommendations?: WeaponRecommendation[];
  personal_targets?: WeaponRecommendation[];
  same_hash_instances?: WeaponDetailInstanceLike[];
  instance_metadata?: Record<string, WeaponDetailInstanceMetadata>;
  versions_loading?: boolean;
};

const weaponStatOrder: readonly WeaponStatKey[] = [
  "impact",
  "range",
  "stability",
  "handling",
  "reload_speed",
  "aim_assistance",
  "recoil_direction",
  "airborne_effectiveness",
  "charge_time",
  "draw_time",
  "magazine",
  "ammo_generation",
  "rounds_per_minute"
];

const weaponStatMetadata: Record<WeaponStatKey, {
  label: string;
  direction: WeaponStatDirection;
}> = {
  impact: { label: "伤害", direction: "higher" },
  range: { label: "射程", direction: "higher" },
  stability: { label: "稳定性", direction: "higher" },
  handling: { label: "操控性", direction: "higher" },
  reload_speed: { label: "装填速度", direction: "higher" },
  aim_assistance: { label: "辅助瞄准", direction: "higher" },
  recoil_direction: { label: "后坐方向", direction: "higher" },
  airborne_effectiveness: { label: "空中效率", direction: "higher" },
  ammo_generation: { label: "弹药生成", direction: "higher" },
  magazine: { label: "弹匣", direction: "higher" },
  rounds_per_minute: { label: "射速", direction: "neutral" },
  charge_time: { label: "蓄力时间", direction: "lower" },
  draw_time: { label: "拉弓时间", direction: "lower" }
};

export function buildWeaponDetailViewModel(input: BuildWeaponDetailViewModelInput): WeaponDetailViewModel {
  const { item } = input;
  const context = buildObjectContext(item, input.context);
  const definitionStats = input.definition_stats
    ?? (context.kind === "definition" ? item.weapon_stats : undefined);
  const currentStats = input.current_stats
    ?? (context.kind !== "definition" ? item.weapon_stats : undefined);
  const poolColumns = input.pool_columns ?? perkGroupsToPoolColumns(item.perks ?? []);
  const selectionColumns = input.selection_columns ?? [];
  const isExotic = input.is_exotic ?? /异域|exotic/i.test(item.tier ?? "");
  const configurationClassification = classifyWeaponConfiguration(poolColumns, isExotic);

  return {
    identity: {
      hash: item.hash,
      name: item.name,
      description: item.description ?? "",
      icon: item.icon,
      item_type: item.item_type,
      tier: item.tier,
      is_exotic: isExotic,
      slot: input.slot ?? item.bucket_name,
      ammo: input.ammo ?? ammoFromKey(item.ammo_type),
      damage: input.damage,
      frame: item.weapon_frame,
      champion: input.champion,
      release: item.release,
      definition_version: item.definition_version,
      crafting: item.crafting?.kind === "crafted"
        ? {
            kind: "crafted",
            label: "锻造",
            overlay: item.crafting.overlay,
            background: item.crafting.background
          }
        : item.craftable
          ? { kind: "craftable", label: "可锻造" }
          : undefined
    },
    context,
    versions: input.versions?.length
      ? input.versions.map((version) => ({ ...version, is_current: version.hash === item.hash }))
      : [{ hash: item.hash, label: item.name, is_current: true }],
    stats: buildWeaponStatTracks({
      definition_stats: definitionStats,
      current_stats: currentStats,
      pending_stats: input.pending_stats,
      stat_modifiers: input.stat_modifiers,
      pending_stat_modifiers: input.pending_stat_modifiers
    }),
    configuration: {
      kind: input.configuration?.kind ?? configurationClassification.kind,
      pool_kind: input.configuration?.pool_kind ?? configurationClassification.pool_kind,
      intrinsic: input.configuration?.intrinsic,
      selection_columns: selectionColumns,
      pool_columns: poolColumns,
      has_pending_changes: input.configuration?.has_pending_changes
        ?? selectionColumns.some((column) => column.candidates.some((candidate) => candidate.pending)),
      can_apply_changes: input.configuration?.can_apply_changes
        ?? (context.kind === "account_instance" && selectionColumns.some(
          (column) => column.candidates.some((candidate) => candidate.pending && candidate.can_apply)
        ))
    },
    sources: input.sources ?? sourceSummaryToSources(item.source),
    upgrades: input.upgrades ?? { enhanced: false },
    recommendations: input.recommendations ?? [],
    personal_targets: input.personal_targets ?? [],
    same_hash_instances: (input.same_hash_instances ?? [])
      .filter((instance): instance is WeaponDetailInstanceLike & { instance_id: string } => (
        instance.hash === item.hash && Boolean(instance.instance_id)
      ))
      .map((instance) => toWeaponDetailInstance(
        instance,
        item.instance_id,
        input.instance_metadata?.[instance.instance_id]
      )),
    loading: Boolean(item.is_detail_loading),
    loading_state: {
      definition: item.detail_loading?.definition ?? Boolean(item.is_detail_loading),
      instance: item.detail_loading?.instance ?? false,
      versions: Boolean(input.versions_loading)
    }
  };
}

export function buildWeaponStatTracks(input: {
  definition_stats?: WeaponStatSummary;
  current_stats?: WeaponStatSummary;
  pending_stats?: WeaponStatSummary;
  stat_modifiers?: Partial<Record<WeaponStatKey, WeaponStatModifier[]>>;
  pending_stat_modifiers?: Partial<Record<WeaponStatKey, WeaponStatModifier[]>>;
}): WeaponStatTrack[] {
  return weaponStatOrder
    .filter((key) => (
      input.definition_stats?.[key] !== undefined
      || input.current_stats?.[key] !== undefined
      || input.pending_stats?.[key] !== undefined
    ))
    .map((key) => {
      const { label, direction } = weaponStatMetadata[key];
      const standardValue = input.definition_stats?.[key];
      const currentValue = input.current_stats?.[key];
      const pendingValue = input.pending_stats?.[key];
      return {
        key,
        label,
        direction,
        availability: currentValue !== undefined
          ? "ready"
          : standardValue !== undefined
            ? "definition_only"
            : "current_unavailable",
        standard_value: standardValue,
        current_value: currentValue,
        current_delta: difference(currentValue, standardValue),
        current_modifiers: input.stat_modifiers?.[key] ?? [],
        pending_value: pendingValue,
        pending_delta: difference(pendingValue, currentValue),
        pending_modifiers: input.pending_stat_modifiers?.[key] ?? []
      };
    });
}

export function perkGroupsToPoolColumns(groups: readonly ItemPerkGroup[]): WeaponPerkPoolColumn[] {
  const columns = groups.flatMap((group) => {
    const visiblePlugs = collapseEnhancedWeaponPlugs(
      group.plugs.filter((plug) => !plug.is_socket_placeholder && !isWeaponSystemPlug(plug))
    );
    const role = classifyWeaponSocketPlugs(visiblePlugs);
    if (!role) return [];
    return [{
      key: `socket-${group.socket_index}`,
      socket_index: group.socket_index,
      label: weaponSocketColumnLabel(visiblePlugs, role, group.socket_index),
      role,
      candidates: visiblePlugs.map(toWeaponPerkCandidate),
      source_kinds: group.source_kinds
    }];
  });
  let traitIndex = 0;
  return [...columns]
    .sort((left, right) => left.socket_index - right.socket_index)
    .map((column) => column.role === "trait"
      ? { ...column, label: `Perk ${++traitIndex}` }
      : column);
}

export function classifyWeaponSocketPlugs(
  plugs: readonly WeaponSocketPlugLike[]
): WeaponPerkColumnRole | undefined {
  const visiblePlugs = plugs.filter((plug) => !isWeaponSystemPlug(plug));
  if (!visiblePlugs.length) return undefined;
  const categories = visiblePlugs
    .map((plug) => plug.category_identifier?.toLocaleLowerCase() ?? "")
    .filter(Boolean);
  const category = categories.join(" ");
  const itemTypes = visiblePlugs
    .map((plug) => plug.item_type?.toLocaleLowerCase() ?? "")
    .filter(Boolean)
    .join(" ");

  if (isWeaponCoreUpgradeCategory(category) || itemTypes.includes("能量核心")) return "other";
  if (category.includes("origin") || includesAny(itemTypes, ["起源特性", "原始特性", "origin trait"])) return "origin";
  if (category.includes("intrinsic") || includesAny(itemTypes, ["固有", "intrinsic"])) return "intrinsic";
  if (includesAny(category, ["barrel", "scope", "sight", "bowstring", "bow.string", "blade", "haft"])) return "barrel";
  if (includesAny(category, ["magazine", "batter", "arrow", "guard", "stock", "grip"])) return "magazine";
  if (includesAny(category, ["trait", "perk"])
    || includesAny(itemTypes, ["特性", "特征", "trait", "perk"])) return "trait";
  if (category.includes("frame")) return "intrinsic";

  return undefined;
}

export function weaponSocketColumnLabel(
  plugs: readonly WeaponSocketPlugLike[],
  role: WeaponPerkColumnRole,
  socketIndex: number
): string {
  const category = plugs
    .map((plug) => plug.category_identifier?.toLocaleLowerCase() ?? "")
    .filter(Boolean)
    .join(" ");
  const itemTypes = plugs
    .map((plug) => plug.item_type?.toLocaleLowerCase() ?? "")
    .filter(Boolean)
    .join(" ");

  if (isWeaponCoreUpgradeCategory(category) || itemTypes.includes("能量核心")) return "核心升级";
  if (includesAny(category, ["sword0.blade", "sword0_blade"]) || itemTypes.includes("柄芯")) return "柄芯";
  if (includesAny(category, ["sword0.guard", "sword0_guard"])) return "握把";
  if (category.includes("origin") || includesAny(itemTypes, ["起源特性", "原始特性", "origin trait"])) return "起源特性";
  if (includesAny(category, ["bowstring", "bow.string"]) || itemTypes.includes("弓弦")) return "弓弦";
  if (category.includes("arrow") || itemTypes.includes("箭杆")) return "箭杆";
  if (category.includes("haft") || itemTypes.includes("偃月杆")) return "偃月杆";
  if (includesAny(category, ["scope", "sight"]) || itemTypes.includes("瞄具")) return "瞄具";
  if (category.includes("barrel") || itemTypes.includes("枪管")) return "枪管";
  if (category.includes("blade") || itemTypes.includes("剑刃")) return "剑刃";
  if (category.includes("guard") || itemTypes.includes("护手")) return "护手";
  if (category.includes("batter") || itemTypes.includes("电池")) return "电池";
  if (category.includes("magazine") || itemTypes.includes("弹匣")) return "弹匣";
  if (category.includes("stock") || itemTypes.includes("枪托")) return "枪托";
  if (category.includes("grip") || itemTypes.includes("握把")) return "握把";
  if (role === "intrinsic") return "固有能力";
  if (role === "barrel") return "枪管";
  if (role === "magazine") return "弹匣";
  if (role === "origin") return "起源特性";
  if (role === "trait") return "武器特性";
  return `插槽 ${socketIndex + 1}`;
}

export function isWeaponSystemPlug(plug: WeaponSocketPlugLike): boolean {
  const category = plug.category_identifier?.toLocaleLowerCase() ?? "";
  const itemType = plug.item_type?.toLocaleLowerCase() ?? "";
  const text = `${plug.name} ${plug.description ?? ""}`.toLocaleLowerCase();
  if (isWeaponCoreUpgradeCategory(category)) return false;
  if (includesAny(category, [
    "shader", "ornament", "memento", "tracker", "masterwork", "catalyst",
    "weapon.mod", "modguns", "mods.weapon", "cosmetic", "skin", "killcounter"
  ])) return true;
  if (includesAny(itemType, [
    "着色器", "shader", "武器模组", "weapon mod", "大师杰作", "masterwork",
    "催化剂", "catalyst", "记录器", "tracker", "装饰", "ornament", "皮肤", "skin"
  ])) return true;
  return includesAny(text, [
    "使用此着色器", "更改装备配色", "默认皮肤", "默认外观", "战斗特效",
    "击杀记录器", "kill tracker", "kill counter", "装备阶级升级", "阶升级",
    "将其铸造为大师杰作", "memento", "纪念物"
  ]);
}

export function isEnhancedWeaponPerk(plug: WeaponSocketPlugLike): boolean {
  const category = plug.category_identifier?.toLocaleLowerCase() ?? "";
  const itemType = plug.item_type?.toLocaleLowerCase() ?? "";
  return category.includes("enhanced") || includesAny(itemType, ["强化", "enhanced"]);
}

function collapseEnhancedWeaponPlugs(plugs: readonly ItemPlugSummary[]): ItemPlugSummary[] {
  const baseNames = new Set(
    plugs
      .filter((plug) => !isEnhancedWeaponPerk(plug))
      .map(normalizedPlugName)
  );

  return plugs.filter((plug) => (
    !isEnhancedWeaponPerk(plug) || !baseNames.has(normalizedPlugName(plug))
  ));
}

function normalizedPlugName(plug: WeaponSocketPlugLike): string {
  return plug.name.trim().toLocaleLowerCase();
}

function buildObjectContext(
  item: WeaponDetailSelectedItemLike,
  override: Partial<WeaponDetailObjectContext> | undefined
): WeaponDetailObjectContext {
  const kind = override?.kind ?? (item.instance_id ? "account_instance" : "definition");
  const entry = override?.entry ?? inferEntry(item, kind);
  return {
    kind,
    entry,
    entry_label: override?.entry_label ?? entryLabel(entry),
    object_label: override?.object_label ?? objectLabel(kind),
    object_id: override?.object_id ?? item.instance_id,
    location_label: override?.location_label,
    read_only: override?.read_only ?? kind !== "account_instance"
  };
}

function inferEntry(
  item: WeaponDetailSelectedItemLike,
  kind: WeaponDetailObjectKind
): WeaponDetailEntryKind {
  if (kind === "vendor_offer") return "vendor";
  if (item.source_kind === "vault") return "vault";
  if (item.instance_id) return "account";
  return "library";
}

function entryLabel(entry: WeaponDetailEntryKind): string {
  if (entry === "vendor") return "商人";
  if (entry === "vault") return "仓库";
  if (entry === "account") return "账号";
  if (entry === "loadout") return "配装";
  return "资料库";
}

function objectLabel(kind: WeaponDetailObjectKind): string {
  if (kind === "vendor_offer") return "商人售卖";
  if (kind === "account_instance") return "账号实例";
  return "资料库定义";
}

function ammoFromKey(key: AmmoTypeKey | undefined): WeaponDetailAmmo | undefined {
  if (!key) return undefined;
  const labels: Record<AmmoTypeKey, string> = {
    primary: "主要弹药",
    special: "特殊弹药",
    heavy: "重型弹药"
  };
  return { key, label: labels[key] };
}

function sourceSummaryToSources(source: ItemSourceSummary): WeaponDetailSources {
  if (source.status !== "ready") {
    return {
      status: "unknown",
      entries: [{
        id: "manifest:missing",
        kind: "manifest_hint",
        label: "历史获取途径",
        description: source.description || "Bungie 官方资料没有标注这件武器的历史获取途径。"
      }]
    };
  }
  return {
    status: "partial",
    entries: [{
      id: `manifest:${source.source_kind ?? "item"}:${source.source_hash ?? source.linked_definition_hash ?? "hint"}`,
      kind: "manifest_hint",
      label: source.label,
      description: source.description
    }]
  };
}

export function classifyWeaponConfiguration(
  columns: readonly WeaponPerkPoolColumn[],
  isExotic: boolean
): WeaponConfigurationClassification {
  const variableColumns = columns.filter((column) => column.candidates.length > 1);
  if (!variableColumns.length) return { kind: "fixed", pool_kind: "none" };
  const hasRandomizedPool = variableColumns.some((column) => column.source_kinds?.includes("randomized_set"));
  const hasSelectablePool = variableColumns.some((column) => (
    column.source_kinds?.some((kind) => kind === "reusable_item" || kind === "reusable_set")
  ));
  return {
    kind: isExotic ? "variable_exotic" : "random_roll",
    pool_kind: hasRandomizedPool
      ? "randomized"
      : hasSelectablePool || isExotic
        ? "selectable"
        : "randomized"
  };
}

function toWeaponPerkCandidate(plug: ItemPlugSummary): WeaponPerkCandidate {
  return {
    hash: plug.hash,
    name: plug.name,
    description: plug.description,
    icon: plug.icon
  };
}

function includesAny(value: string, segments: readonly string[]): boolean {
  return segments.some((segment) => value.includes(segment));
}

function isWeaponCoreUpgradeCategory(category: string): boolean {
  return includesAny(category, ["perk_upgrades", "perk.upgrades", "perkupgrades"]);
}

function toWeaponDetailInstance(
  item: WeaponDetailInstanceLike & { instance_id: string },
  currentInstanceId: string | undefined,
  metadata: WeaponDetailInstanceMetadata | undefined
): WeaponDetailInstance {
  const configurationPlugs = item.socket_plugs.filter((plug) => {
    const role = classifyWeaponSocketPlugs([plug]);
    return role !== undefined && role !== "intrinsic";
  }).slice(0, 5);
  return {
    item_key: item.item_key ?? item.instance_id,
    instance_id: item.instance_id,
    hash: item.hash,
    name: item.name,
    icon: item.icon,
    power: item.power,
    location: item.source_label ?? selectedItemSourceLabel(item.source_kind),
    source_kind: item.source_kind,
    source_character_id: item.source_character_id,
    locked: item.locked,
    equipped: item.equipped ?? item.source_kind === "equipped",
    local_tag: item.local_tag ?? metadata?.local_tag,
    note: item.note ?? metadata?.note,
    upgrade_status: item.upgrade_status ?? metadata?.upgrade_status,
    loadout_references: item.loadout_references ?? metadata?.loadout_references,
    current: item.instance_id === currentInstanceId,
    plugs: configurationPlugs.map((plug) => ({
      hash: plug.hash,
      name: plug.name,
      icon: plug.icon
    })),
    plug_names: configurationPlugs.map((plug) => plug.name)
  };
}

function selectedItemSourceLabel(kind: SelectedItemSourceKind): string {
  if (kind === "equipped") return "已装备";
  if (kind === "inventory") return "角色背包";
  if (kind === "postmaster") return "邮政官";
  return "仓库";
}

function difference(value: number | undefined, baseline: number | undefined): number | undefined {
  return value !== undefined && baseline !== undefined ? value - baseline : undefined;
}
