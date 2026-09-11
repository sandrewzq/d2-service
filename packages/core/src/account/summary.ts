import type { BungieJsonFetcher } from "../bungie/transport.js";
import { collectAccountDefinitionRequest as collectAccountDefinitionRequestImpl } from "./definitionRequest.js";
import {
  accountEquipmentBucketHashes,
  ammoTypeKey,
  bucketLabels,
  classifyBucket,
  isPostmasterBucketHash,
  postmasterBucketHash,
  pursuitBucketHash,
  pursuitCategoryHashes,
  vaultBucketHash,
  type AmmoTypeKey,
  type EquipmentGroupKey
} from "../items/classification.js";
import {
  summarizeSelectedWeaponFrame,
  summarizeWeaponFrame,
  type WeaponFrameSummary
} from "../items/weaponFrames.js";
import { summarizeEquipableItemSet } from "../items/equipableItemSet.js";
import type { ArmorStatKey } from "../loadouts/analysis.js";
import type { DefinitionComponentData, DefinitionRecord } from "../manifest/definitions.js";
import type { BungieOAuthToken } from "../oauth/login.js";
import {
  armorStatKeyByDefinitionHash as armorStatHashMap,
  armorStatKeys
} from "../armor/statDefinitions.js";
import { readArmorArchetypeStatPair } from "../armor/manifestRuleset.js";

export type { AmmoTypeKey, EquipmentGroupKey } from "../items/classification.js";
export type { WeaponFrameSummary } from "../items/weaponFrames.js";

export type AccountItemSummary = {
  hash: number;
  instance_id?: string;
  name: string;
  icon?: string;
  item_type?: string;
  class_type?: number;
  ammo_type?: AmmoTypeKey;
  tier?: string;
  bucket_hash?: number;
  bucket_name?: string;
  equipment_bucket_hash?: number;
  equipment_bucket_name?: string;
  group_key: EquipmentGroupKey;
  armor_set?: {
    hash: number;
    name: string;
  };
  weapon_frame?: WeaponFrameSummary;
  power?: number;
  locked?: boolean;
  armor_stats?: ArmorStatSummary;
  armor_stat_breakdown?: ArmorStatBreakdownSummary;
  armor_energy?: ArmorEnergySummary;
  weapon_stats?: WeaponStatSummary;
  crafting?: AccountWeaponCraftingSummary;
  instance?: AccountItemInstanceSummary;
  item_objectives?: AccountItemPlugObjectiveSummary[];
  sockets?: AccountItemSocketSummary[];
  socket_plugs: AccountItemPlugSummary[];
  weapon_roll?: AccountWeaponRollSummary;
  catalyst?: AccountItemCatalystSummary;
  pursuit?: AccountPursuitItemSummary;
};

export type AccountWeaponCraftingSummary = {
  kind: "crafted";
  overlay?: string;
  background?: string;
};

export type AccountPursuitItemSummary = {
  kind: "quest" | "bounty" | "seasonal" | "unknown";
  tracked: boolean;
  complete: boolean;
  suppress_expiration_when_complete?: boolean;
  expiration_date?: string;
  quest_step?: { step: number; total: number };
  reward_hashes?: number[];
};

export type AccountItemInstanceSummary = {
  damage_type?: number;
  damage_type_hash?: number;
  damage_type_name?: string;
  damage_type_icon?: string;
  breaker_type?: number;
  breaker_type_hash?: number;
  item_level?: number;
  quality?: number;
  is_equipped?: boolean;
  can_equip?: boolean;
  equip_required_level?: number;
  cannot_equip_reason?: number;
  gear_tier?: number;
  gear_tier_overlay?: string;
};

export type ArmorStatSummary = Record<ArmorStatKey, number> & {
  total: number;
};

export type ArmorStatBreakdownEntry = {
  base: number;
  mod: number;
  final: number;
};

export type ArmorStatBreakdownSummary = Record<ArmorStatKey, ArmorStatBreakdownEntry> & {
  total: ArmorStatBreakdownEntry;
};

export type ArmorEnergySummary = {
  type_hash?: number;
  type?: number;
  capacity: number;
  used: number;
  unused: number;
};

export type WeaponStatKey =
  | "impact"
  | "range"
  | "stability"
  | "handling"
  | "reload_speed"
  | "aim_assistance"
  | "airborne_effectiveness"
  | "ammo_generation"
  | "magazine"
  | "rounds_per_minute"
  | "charge_time"
  | "draw_time"
  | "recoil_direction";

export type WeaponStatSummary = Partial<Record<WeaponStatKey, number>>;

export type AccountMaterialSummary = {
  hash: number;
  name: string;
  icon?: string;
  item_type?: string;
  tier?: string;
  quantity: number;
};

export type AccountItemPlugSummary = {
  hash: number;
  socket_index?: number;
  name: string;
  icon?: string;
  description?: string;
  category_identifier?: string;
  energy_cost?: number;
  trait_ids?: string[];
  objectives?: AccountItemPlugObjectiveSummary[];
  stat_modifiers?: WeaponStatSummary;
  armor_stat_modifiers?: Partial<Record<ArmorStatKey, number>>;
  source_description?: string;
  item_type?: string;
};

export type AccountItemCatalystSummary = {
  plug_hash?: number;
  record_hash: number;
  name: string;
  description?: string;
  icon?: string;
  acquired: boolean;
  complete: boolean;
  progress: number;
  objectives: AccountItemPlugObjectiveSummary[];
};

export type AccountItemPlugObjectiveSummary = {
  objective_hash: number;
  progress?: number;
  completion_value: number;
  complete: boolean;
  visible: boolean;
  progress_description?: string;
};

export type AccountItemReusablePlugSource = "instance" | "character" | "profile" | "manifest";

export type AccountItemReusablePlugSummary = AccountItemPlugSummary & {
  selected: boolean;
  can_insert?: boolean;
  enabled?: boolean;
  insert_fail_indexes: number[];
  enable_fail_indexes: number[];
  sources: AccountItemReusablePlugSource[];
};

export type AccountItemSocketSummary = {
  socket_index: number;
  is_visible: boolean;
  is_enabled: boolean;
  enable_fail_indexes: number[];
  selected_plug?: AccountItemPlugSummary;
  reusable_plugs: AccountItemReusablePlugSummary[];
};

export type AccountWeaponRollSlot =
  | "barrel"
  | "magazine"
  | "masterwork"
  | "perk1"
  | "perk2"
  | "origin"
  | "other";

export type AccountWeaponRollIncompleteReason =
  | "missing_socket_data"
  | "missing_reusable_plug_data"
  | "missing_plug_definition"
  | "unclassified_socket";

export type AccountWeaponRollPlugSummary = {
  hash: number;
  name: string;
  icon?: string;
  description?: string;
  category_identifier?: string;
  item_type?: string;
  selected: boolean;
};

export type AccountWeaponRollSocketSummary = {
  socket_index: number;
  slot: AccountWeaponRollSlot;
  label: string;
  current_plug?: AccountWeaponRollPlugSummary;
  owned_plugs: AccountWeaponRollPlugSummary[];
  complete: boolean;
  incomplete_reasons: AccountWeaponRollIncompleteReason[];
};

export type AccountWeaponRollSummary = {
  fingerprint: string;
  complete: boolean;
  incomplete_reasons: AccountWeaponRollIncompleteReason[];
  sockets: AccountWeaponRollSocketSummary[];
};

export type CharacterEquipmentGroup = {
  key: EquipmentGroupKey;
  label: string;
  items: AccountItemSummary[];
};

export type CharacterInventoryCapacityLimit = {
  bucket_hash: number;
  bucket_name: string;
  group_key: "weapons" | "armor";
  capacity?: number;
};

export type CharacterCapacityLimits = {
  inventory_buckets: CharacterInventoryCapacityLimit[];
  postmaster_capacity?: number;
};

export type CharacterSummary = {
  character_id: string;
  class_name: string;
  light?: number;
  emblem_url?: string;
  equipped_items: AccountItemSummary[];
  equipment_groups: CharacterEquipmentGroup[];
  inventory_items: AccountItemSummary[];
  inventory_groups: CharacterEquipmentGroup[];
  postmaster_items: AccountItemSummary[];
  loadout_slots: CharacterLoadoutSlotSummary[];
  capacity_limits?: CharacterCapacityLimits;
  craftable_items?: AccountCraftableItemSummary[];
};

export type AccountCraftableItemSummary = {
  hash: number;
  name: string;
  icon?: string;
  visible: boolean;
  failed_requirement_indexes: number[];
  sockets: AccountCraftableSocketSummary[];
};

export type AccountCraftableSocketSummary = {
  socket_index: number;
  plug_set_hash: number;
  plugs: Array<{
    hash: number;
    name: string;
    icon?: string;
    category_identifier?: string;
    failed_requirement_indexes: number[];
  }>;
};

export type CharacterLoadoutSlotItemSummary = {
  instance_id?: string;
  item_hash?: number;
  name: string;
  icon?: string;
  bucket_name?: string;
  plug_hashes?: number[];
  plugs?: AccountItemPlugSummary[];
};

export type CharacterLoadoutSlotSummary = {
  index: number;
  name: string;
  name_hash?: number;
  icon_hash?: number;
  color_hash?: number;
  item_count: number;
  items: CharacterLoadoutSlotItemSummary[];
};

export type AccountSummary = {
  account_name: string;
  destiny_membership_id: string;
  membership_type: number;
  /** Bungie service revision used to build this account state. */
  profile_minted_at?: string;
  characters: CharacterSummary[];
  vault: {
    item_count: number;
    capacity?: number;
    items: AccountItemSummary[];
    sample_items: AccountItemSummary[];
  };
  materials: {
    item_count: number;
    items: AccountMaterialSummary[];
  };
};

export type AccountItemSnapshot = Omit<
  AccountItemSummary,
  "armor_energy" | "catalyst" | "sockets"
>;

export type AccountCharacterSnapshot = Omit<
  CharacterSummary,
  | "craftable_items"
  | "equipped_items"
  | "equipment_groups"
  | "inventory_items"
  | "inventory_groups"
  | "postmaster_items"
> & {
  equipped_items: AccountItemSnapshot[];
  equipment_groups: [];
  inventory_items: AccountItemSnapshot[];
  inventory_groups: [];
  postmaster_items: AccountItemSnapshot[];
};

export type AccountSnapshot = Omit<AccountSummary, "characters" | "vault"> & {
  characters: AccountCharacterSnapshot[];
  vault: {
    item_count: number;
    capacity?: number;
    items: AccountItemSnapshot[];
    sample_items: [];
  };
};

/**
 * Removes Bungie-owned empty socket placeholders from player-facing account data.
 *
 * The generic weapon masterwork plug is a real Manifest definition, but it has no
 * name, icon or effect. Older snapshots persisted the fallback `Plug <hash>` label,
 * so this normalization deliberately works on summaries as well as freshly built
 * definitions without hiding genuinely missing plug definitions.
 */
export function sanitizeAccountItemSummary<T extends AccountItemSummary>(item: T): T {
  const socketPlugs = item.socket_plugs.filter((plug) => !isEmptyWeaponMasterworkPlugSummary(plug));
  const sockets = item.sockets?.map((socket) => {
    const selectedPlug = socket.selected_plug && !isEmptyWeaponMasterworkPlugSummary(socket.selected_plug)
      ? socket.selected_plug
      : undefined;
    const reusablePlugs = socket.reusable_plugs.filter(
      (plug) => !isEmptyWeaponMasterworkPlugSummary(plug)
    );
    if (selectedPlug === socket.selected_plug && reusablePlugs.length === socket.reusable_plugs.length) {
      return socket;
    }
    return {
      ...socket,
      selected_plug: selectedPlug,
      reusable_plugs: reusablePlugs
    };
  });
  const weaponRoll = item.weapon_roll
    ? sanitizeWeaponRollSummary(item.weapon_roll)
    : undefined;
  const changed = socketPlugs.length !== item.socket_plugs.length
    || sockets?.some((socket, index) => socket !== item.sockets?.[index]) === true
    || weaponRoll !== item.weapon_roll;
  if (!changed) return item;
  return {
    ...item,
    socket_plugs: socketPlugs,
    ...(item.sockets !== undefined ? { sockets } : {}),
    ...(item.weapon_roll !== undefined ? { weapon_roll: weaponRoll } : {})
  } as T;
}

/** Normalizes durable account snapshots created by older application versions. */
export function sanitizeAccountSnapshot(snapshot: AccountSnapshot): AccountSnapshot {
  return {
    ...snapshot,
    characters: snapshot.characters.map((character) => ({
      ...character,
      equipped_items: character.equipped_items.map(sanitizeAccountItemSummary),
      inventory_items: character.inventory_items.map(sanitizeAccountItemSummary),
      postmaster_items: character.postmaster_items.map(sanitizeAccountItemSummary),
      loadout_slots: character.loadout_slots.map((slot) => ({
        ...slot,
        items: slot.items.map((item) => ({
          ...item,
          ...(item.plugs
            ? { plugs: item.plugs.filter((plug) => !isEmptyWeaponMasterworkPlugSummary(plug)) }
            : {})
        }))
      }))
    })),
    vault: {
      ...snapshot.vault,
      items: snapshot.vault.items.map(sanitizeAccountItemSummary),
      sample_items: []
    }
  };
}

export type AccountItemDetail = AccountItemSummary & {
  instance_id: string;
  sockets: AccountItemSocketSummary[];
};

export type AccountItemDetailQuery = {
  destiny_membership_id: string;
  membership_type: number;
  instance_id: string;
  item_hash: number;
  character_id?: string;
};

export type AccountDefinitionRequest = {
  itemHashes: number[];
  bucketHashes: number[];
  plugSetHashes: number[];
  objectiveHashes: number[];
  damageTypeHashes?: number[];
  recordHashes?: number[];
  presentationNodeHashes?: number[];
  loadoutNameHashes: number[];
  expandSocketPlugSets?: boolean;
};

export type AccountDefinitionData = {
  itemDefinitions?: DefinitionComponentData;
  inventoryItemConstantsDefinitions?: DefinitionComponentData;
  bucketDefinitions?: DefinitionComponentData;
  damageTypeDefinitions?: DefinitionComponentData;
  equipableItemSetDefinitions?: DefinitionComponentData;
  plugSetDefinitions?: DefinitionComponentData;
  objectiveDefinitions?: DefinitionComponentData;
  recordDefinitions?: DefinitionComponentData;
  presentationNodeDefinitions?: DefinitionComponentData;
  loadoutNameDefinitions?: DefinitionComponentData;
};

export type AccountDefinitionLoader = (
  request: AccountDefinitionRequest
) => AccountDefinitionData | Promise<AccountDefinitionData>;

export type FetchAccountSummaryOptions = {
  token: BungieOAuthToken;
  fetchJson: BungieJsonFetcher;
  itemDefinitions?: DefinitionComponentData;
  inventoryItemConstantsDefinitions?: DefinitionComponentData;
  bucketDefinitions?: DefinitionComponentData;
  damageTypeDefinitions?: DefinitionComponentData;
  equipableItemSetDefinitions?: DefinitionComponentData;
  plugSetDefinitions?: DefinitionComponentData;
  objectiveDefinitions?: DefinitionComponentData;
  recordDefinitions?: DefinitionComponentData;
  presentationNodeDefinitions?: DefinitionComponentData;
  loadoutNameDefinitions?: DefinitionComponentData;
  loadDefinitions?: AccountDefinitionLoader;
};

export type FetchAccountItemDetailOptions = FetchAccountSummaryOptions & {
  query: AccountItemDetailQuery;
};

export type UserMembershipData = {
  bungieNetUser?: {
    displayName?: string;
    uniqueName?: string;
  };
  destinyMemberships?: DestinyMembership[];
  primaryMembershipId?: string;
};

export type DestinyMembership = {
  membershipId: string;
  membershipType: number;
  displayName?: string;
  bungieGlobalDisplayName?: string;
  bungieGlobalDisplayNameCode?: number;
};

export type DestinyProfileResponse = {
  responseMintedTimestamp?: string;
  secondaryComponentsMintedTimestamp?: string;
  characters?: {
    data?: Record<string, DestinyCharacter>;
  };
  characterInventories?: {
    data?: Record<string, { items?: DestinyProfileItem[] }>;
  };
  characterEquipment?: {
    data?: Record<string, { items?: DestinyProfileItem[] }>;
  };
  characterLoadouts?: {
    data?: Record<string, { loadouts?: DestinyCharacterLoadout[] }>;
  };
  characterProgressions?: {
    data?: Record<string, {
      milestones?: Record<string, DestinyCharacterMilestone>;
    }>;
  };
  profileInventory?: {
    data?: { items?: DestinyProfileItem[] };
  };
  profilePlugSets?: {
    data?: DestinyPlugSetsComponent;
  };
  characterPlugSets?: {
    data?: Record<string, DestinyPlugSetsComponent>;
  };
  characterCraftables?: {
    data?: Record<string, DestinyCraftablesComponent>;
  };
  profileRecords?: {
    data?: {
      records?: Record<string, DestinyRecordProgress>;
      trackedRecordHash?: number;
    };
  };
  itemComponents?: {
    instances?: {
      data?: Record<string, DestinyItemInstanceComponent>;
    };
    objectives?: {
      data?: Record<string, DestinyItemObjectivesComponent>;
    };
    stats?: {
      data?: Record<string, DestinyItemStatsComponent>;
    };
    sockets?: {
      data?: Record<string, DestinyItemSocketsComponent>;
    };
    reusablePlugs?: {
      data?: Record<string, DestinyItemReusablePlugsComponent>;
    };
    plugObjectives?: {
      data?: Record<string, DestinyItemPlugObjectivesComponent>;
    };
  };
};

export type DestinyItemResponse = {
  item?: { data?: DestinyProfileItem };
  instance?: { data?: DestinyItemInstanceComponent };
  objectives?: { data?: DestinyItemObjectivesComponent };
  stats?: { data?: DestinyItemStatsComponent };
  sockets?: { data?: DestinyItemSocketsComponent };
  reusablePlugs?: { data?: DestinyItemReusablePlugsComponent };
  plugObjectives?: { data?: DestinyItemPlugObjectivesComponent };
  profileRecords?: DestinyProfileResponse["profileRecords"];
};

type DestinyCharacter = {
  characterId: string;
  classType?: number;
  light?: number;
  emblemPath?: string;
};

export type DestinyProfileItem = {
  itemHash: number;
  itemInstanceId?: string;
  bucketHash?: number;
  quantity?: number;
  state?: number;
  expirationDate?: string;
  itemValueVisibility?: boolean[];
};

type DestinyCharacterMilestone = {
  milestoneHash?: number;
  startDate?: string;
  endDate?: string;
  availableQuests?: Array<{
    questItemHash?: number;
    status?: {
      tracked?: boolean;
      completed?: boolean;
      redeemed?: boolean;
      started?: boolean;
      stepObjectives?: DestinyObjectiveProgress[];
    };
  }>;
  activities?: Array<{
    activityHash?: number;
    challenges?: Array<{ objective?: DestinyObjectiveProgress }>;
  }>;
};

type DestinyItemInstanceComponent = {
  damageType?: number;
  damageTypeHash?: number;
  primaryStat?: {
    value?: number;
  };
  energy?: {
    energyTypeHash?: number;
    energyType?: number;
    energyCapacity?: number;
    energyUsed?: number;
    energyUnused?: number;
  };
  itemLevel?: number;
  quality?: number;
  isEquipped?: boolean;
  canEquip?: boolean;
  equipRequiredLevel?: number;
  cannotEquipReason?: number;
  breakerType?: number;
  breakerTypeHash?: number;
  gearTier?: number;
};

type DestinyItemStatsComponent = {
  stats?: Record<string, DestinyItemStat>;
};

type DestinyItemStat = {
  statHash?: number;
  value?: number;
};

type DestinyItemSocketsComponent = {
  sockets?: DestinyItemSocket[];
};

type DestinyItemSocket = {
  plugHash?: number;
  isEnabled?: boolean;
  isVisible?: boolean;
  enableFailIndexes?: number[];
};

type DestinyObjectiveProgress = {
  objectiveHash: number;
  progress?: number;
  completionValue: number;
  complete: boolean;
  visible: boolean;
};

type DestinyRecordProgress = {
  state?: number;
  objectives?: DestinyObjectiveProgress[];
  intervalsRedeemedCount?: number;
};

type DestinyItemPlugState = {
  plugItemHash: number;
  canInsert?: boolean;
  enabled?: boolean;
  insertFailIndexes?: number[];
  enableFailIndexes?: number[];
  plugObjectives?: DestinyObjectiveProgress[];
};

type DestinyItemReusablePlugsComponent = {
  plugs?: Record<string, DestinyItemPlugState[]>;
};

type DestinyItemPlugObjectivesComponent = {
  objectivesPerPlug?: Record<string, DestinyObjectiveProgress[]>;
};

type DestinyItemObjectivesComponent = {
  objectives?: DestinyObjectiveProgress[];
};

type DestinyPlugSetsComponent = {
  plugs?: Record<string, DestinyItemPlugState[]>;
};

type DestinyCraftablesComponent = {
  craftables?: Record<string, {
    visible?: boolean;
    failedRequirementIndexes?: number[];
    sockets?: Array<{
      plugSetHash?: number;
      plugs?: Array<{
        plugItemHash?: number;
        failedRequirementIndexes?: number[];
      }>;
    }>;
  }>;
};

type DestinyCharacterLoadout = {
  nameHash?: number;
  iconHash?: number;
  colorHash?: number;
  items?: Array<{
    itemInstanceId?: string;
    plugItemHashes?: number[];
  }>;
};

const bungieStaticBaseUrl = "https://www.bungie.net";
// DestinyCharacterLoadout uses "0" for an item slot without a real instance.
// This is the same sentinel DIM excludes before resolving loadout items.
const unsetLoadoutPlugHash = 2166136261;
const fullProfileComponents = [
  100, // Profiles
  102, // ProfileInventories
  200, // Characters
  201, // CharacterInventories
  205, // CharacterEquipment
  206, // CharacterLoadouts
  300, // ItemInstances
  304, // ItemStats
  305, // ItemSockets
  301, // ItemObjectives
  309, // ItemPlugObjectives
  310, // ItemReusablePlugs
  1300 // Craftables
].join(",");

const snapshotProfileComponents = [
  100, // Profiles
  102, // ProfileInventories
  200, // Characters
  201, // CharacterInventories
  205, // CharacterEquipment
  206, // CharacterLoadouts
  300, // ItemInstances
  301, // ItemObjectives (pursuit progress)
  304, // ItemStats
  305, // ItemSockets
  310 // ItemReusablePlugs
].join(",");

const itemDetailComponents = [
  300, // ItemInstances
  301, // ItemObjectives
  304, // ItemStats
  305, // ItemSockets
  307, // ItemCommonData
  309, // ItemPlugObjectives
  310 // ItemReusablePlugs
].join(",");

export type AccountSummaryMode = "full" | "snapshot";

export type BuildAccountSummaryInput = AccountDefinitionData & {
  memberships: UserMembershipData;
  destinyMembership?: DestinyMembership;
  profile: DestinyProfileResponse;
};

export type BuildAccountItemDetailInput = AccountDefinitionData & {
  query: AccountItemDetailQuery;
  response: DestinyItemResponse;
};

const equipmentGroupLabels: Record<EquipmentGroupKey, string> = {
  weapons: "武器",
  armor: "护甲",
  equipment: "其他装备",
  other: "其他"
};

const equipmentGroupOrder: EquipmentGroupKey[] = ["weapons", "armor", "equipment", "other"];

const weaponStatHashMap: Record<number, WeaponStatKey> = {
  4043523819: "impact",
  1240592695: "range",
  155624089: "stability",
  943549884: "handling",
  4188031367: "reload_speed",
  1345609583: "aim_assistance",
  2715839340: "recoil_direction",
  2714457168: "airborne_effectiveness",
  1931675084: "ammo_generation",
  3871231066: "magazine",
  4284893193: "rounds_per_minute",
  2961396640: "charge_time",
  447667954: "draw_time"
};

export async function fetchAccountSummary(options: FetchAccountSummaryOptions): Promise<AccountSummary> {
  const { memberships, destinyMembership, profile } = await fetchAccountProfile(
    options,
    fullProfileComponents
  );
  const hydratedOptions = await hydrateAccountDefinitions(options, profile);
  return buildAccountSummaryFromResponses({
    ...hydratedOptions,
    memberships,
    destinyMembership,
    profile
  });
}

export async function fetchAccountSnapshot(options: FetchAccountSummaryOptions): Promise<AccountSnapshot> {
  const { memberships, destinyMembership, profile } = await fetchAccountProfile(
    options,
    snapshotProfileComponents
  );
  const hydratedOptions = await hydrateAccountDefinitions(options, profile);
  return buildAccountSnapshot({
    ...hydratedOptions,
    memberships,
    destinyMembership,
    profile
  });
}

export async function fetchAccountItemDetail(
  options: FetchAccountItemDetailOptions
): Promise<AccountItemDetail> {
  const accessToken = options.token.access_token;
  if (!accessToken) {
    throw new Error("Bungie access token is required");
  }

  const [itemResponse, recordsProfile] = await Promise.all([
    options.fetchJson<DestinyItemResponse>(
      `/Destiny2/${options.query.membership_type}/Profile/${options.query.destiny_membership_id}/Item/${options.query.instance_id}/?components=${itemDetailComponents}`,
      accessToken
    ),
    options.fetchJson<DestinyProfileResponse>(
      `/Destiny2/${options.query.membership_type}/Profile/${options.query.destiny_membership_id}/?components=900`,
      accessToken
    )
  ]);
  const response: DestinyItemResponse = {
    ...itemResponse,
    profileRecords: recordsProfile.profileRecords
  };
  const { item, profile } = normalizeAccountItemDetailResponse(options.query, response);
  const hydratedOptions = await hydrateAccountDefinitions(options, profile, [item]);
  return buildAccountItemDetailFromResponse({
    ...hydratedOptions,
    query: options.query,
    response
  });
}

export function buildAccountSummaryFromResponses(input: BuildAccountSummaryInput): AccountSummary {
  const destinyMembership = input.destinyMembership ?? selectDestinyMembership(input.memberships);
  return buildAccountSummary(input, input.memberships, destinyMembership, input.profile, "full");
}

export function buildAccountSnapshot(input: BuildAccountSummaryInput): AccountSnapshot {
  const destinyMembership = input.destinyMembership ?? selectDestinyMembership(input.memberships);
  return buildAccountSummary(input, input.memberships, destinyMembership, input.profile, "snapshot") as AccountSnapshot;
}

export function buildAccountItemDetailFromResponse(
  input: BuildAccountItemDetailInput
): AccountItemDetail {
  const { item, profile } = normalizeAccountItemDetailResponse(input.query, input.response);
  return summarizeItem(
    item,
    input.itemDefinitions ?? {},
    profile,
    input.bucketDefinitions ?? {},
    input.plugSetDefinitions ?? {},
    input.objectiveDefinitions ?? {},
    input.damageTypeDefinitions ?? {},
    input.inventoryItemConstantsDefinitions ?? {},
    input.equipableItemSetDefinitions ?? {},
    input.query.character_id,
    "full",
    input.recordDefinitions ?? {}
  ) as AccountItemDetail;
}

export function collectAccountItemDetailDefinitionRequest(
  query: AccountItemDetailQuery,
  response: DestinyItemResponse
): AccountDefinitionRequest {
  const { item, profile } = normalizeAccountItemDetailResponse(query, response);
  return collectAccountDefinitionRequestImpl(profile, [item]);
}

function normalizeAccountItemDetailResponse(
  query: AccountItemDetailQuery,
  response: DestinyItemResponse
): { item: DestinyProfileItem; profile: DestinyProfileResponse } {
  const item: DestinyProfileItem = {
    ...response.item?.data,
    itemHash: response.item?.data?.itemHash ?? query.item_hash,
    itemInstanceId: query.instance_id
  };
  return {
    item,
    profile: {
      profileRecords: response.profileRecords,
      itemComponents: {
        instances: { data: response.instance?.data ? { [query.instance_id]: response.instance.data } : {} },
        objectives: { data: response.objectives?.data ? { [query.instance_id]: response.objectives.data } : {} },
        stats: { data: response.stats?.data ? { [query.instance_id]: response.stats.data } : {} },
        sockets: { data: response.sockets?.data ? { [query.instance_id]: response.sockets.data } : {} },
        reusablePlugs: { data: response.reusablePlugs?.data ? { [query.instance_id]: response.reusablePlugs.data } : {} },
        plugObjectives: { data: response.plugObjectives?.data ? { [query.instance_id]: response.plugObjectives.data } : {} }
      }
    }
  };
}

async function hydrateAccountDefinitions(
  options: FetchAccountSummaryOptions,
  profile: DestinyProfileResponse,
  additionalItems: DestinyProfileItem[] = []
): Promise<FetchAccountSummaryOptions> {
  if (!options.loadDefinitions) {
    return options;
  }

  const loaded = await options.loadDefinitions(
    collectAccountDefinitionRequestImpl(profile, additionalItems)
  );
  return {
    ...options,
    itemDefinitions: mergeDefinitionData(options.itemDefinitions, loaded.itemDefinitions),
    inventoryItemConstantsDefinitions: mergeDefinitionData(
      options.inventoryItemConstantsDefinitions,
      loaded.inventoryItemConstantsDefinitions
    ),
    bucketDefinitions: mergeDefinitionData(options.bucketDefinitions, loaded.bucketDefinitions),
    damageTypeDefinitions: mergeDefinitionData(
      options.damageTypeDefinitions,
      loaded.damageTypeDefinitions
    ),
    equipableItemSetDefinitions: mergeDefinitionData(
      options.equipableItemSetDefinitions,
      loaded.equipableItemSetDefinitions
    ),
    plugSetDefinitions: mergeDefinitionData(options.plugSetDefinitions, loaded.plugSetDefinitions),
    objectiveDefinitions: mergeDefinitionData(options.objectiveDefinitions, loaded.objectiveDefinitions),
    recordDefinitions: mergeDefinitionData(options.recordDefinitions, loaded.recordDefinitions),
    presentationNodeDefinitions: mergeDefinitionData(
      options.presentationNodeDefinitions,
      loaded.presentationNodeDefinitions
    ),
    loadoutNameDefinitions: mergeDefinitionData(
      options.loadoutNameDefinitions,
      loaded.loadoutNameDefinitions
    )
  };
}

export { collectAccountDefinitionRequestImpl as collectAccountDefinitionRequest };

function mergeDefinitionData(
  existing: DefinitionComponentData | undefined,
  loaded: DefinitionComponentData | undefined
): DefinitionComponentData | undefined {
  if (!existing) return loaded;
  if (!loaded) return existing;
  return { ...existing, ...loaded };
}

async function fetchAccountProfile(
  options: FetchAccountSummaryOptions,
  components: string
): Promise<{
  memberships: UserMembershipData;
  destinyMembership: DestinyMembership;
  profile: DestinyProfileResponse;
}> {
  const accessToken = options.token.access_token;
  if (!accessToken) {
    throw new Error("Bungie access token is required");
  }

  const memberships = await options.fetchJson<UserMembershipData>(
    "/User/GetMembershipsForCurrentUser/",
    accessToken
  );
  const destinyMembership = selectDestinyMembership(memberships);
  const profile = await options.fetchJson<DestinyProfileResponse>(
    `/Destiny2/${destinyMembership.membershipType}/Profile/${destinyMembership.membershipId}/?components=${components}`,
    accessToken
  );
  return { memberships, destinyMembership, profile };
}

function buildAccountSummary(
  options: AccountDefinitionData,
  memberships: UserMembershipData,
  destinyMembership: DestinyMembership,
  profile: DestinyProfileResponse,
  mode: AccountSummaryMode
): AccountSummary {
  const profileInventory = summarizeProfileInventory(
    profile,
    options.itemDefinitions ?? {},
    options.bucketDefinitions ?? {},
    options.plugSetDefinitions ?? {},
    options.objectiveDefinitions ?? {},
    options.damageTypeDefinitions ?? {},
    options.inventoryItemConstantsDefinitions ?? {},
    options.equipableItemSetDefinitions ?? {},
    mode
  );
  return {
    account_name: memberships.bungieNetUser?.displayName
      ?? memberships.bungieNetUser?.uniqueName
      ?? destinyMembership.bungieGlobalDisplayName
      ?? destinyMembership.displayName
      ?? "Unknown Guardian",
    destiny_membership_id: destinyMembership.membershipId,
    membership_type: destinyMembership.membershipType,
    ...(normalizeProfileTimestamp(profile.responseMintedTimestamp)
      ? { profile_minted_at: normalizeProfileTimestamp(profile.responseMintedTimestamp) }
      : {}),
    characters: summarizeCharacters(
      profile,
      options.itemDefinitions ?? {},
      options.bucketDefinitions ?? {},
      options.loadoutNameDefinitions ?? {},
      options.plugSetDefinitions ?? {},
      options.objectiveDefinitions ?? {},
      options.damageTypeDefinitions ?? {},
      options.inventoryItemConstantsDefinitions ?? {},
      options.equipableItemSetDefinitions ?? {},
      profileInventory.vault.items,
      mode
    ),
    ...profileInventory
  };
}

function normalizeProfileTimestamp(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function selectDestinyMembership(data: UserMembershipData): DestinyMembership {
  const memberships = data.destinyMemberships ?? [];
  const selected = memberships.find((membership) => membership.membershipId === data.primaryMembershipId)
    ?? memberships[0];
  if (!selected) {
    throw new Error("No Destiny membership found for the logged-in Bungie account");
  }

  return selected;
}

function summarizeCharacters(
  profile: DestinyProfileResponse,
  definitions: DefinitionComponentData,
  bucketDefinitions: DefinitionComponentData,
  loadoutNameDefinitions: DefinitionComponentData,
  plugSetDefinitions: DefinitionComponentData,
  objectiveDefinitions: DefinitionComponentData,
  damageTypeDefinitions: DefinitionComponentData,
  inventoryItemConstantsDefinitions: DefinitionComponentData,
  equipableItemSetDefinitions: DefinitionComponentData,
  vaultItems: AccountItemSummary[],
  mode: AccountSummaryMode
): CharacterSummary[] {
  const characters = Object.values(profile.characters?.data ?? {});

  return characters.map((character) => {
    const equippedItems = (profile.characterEquipment?.data?.[character.characterId]?.items ?? [])
      .slice(0, 16)
      .map((item) => summarizeItem(
        item,
        definitions,
        profile,
        bucketDefinitions,
        plugSetDefinitions,
        objectiveDefinitions,
        damageTypeDefinitions,
        inventoryItemConstantsDefinitions,
        equipableItemSetDefinitions,
        character.characterId,
        mode
      ));
    const allCharacterItems = (profile.characterInventories?.data?.[character.characterId]?.items ?? [])
      .map((item) => summarizeItem(
        item,
        definitions,
        profile,
        bucketDefinitions,
        plugSetDefinitions,
        objectiveDefinitions,
        damageTypeDefinitions,
        inventoryItemConstantsDefinitions,
        equipableItemSetDefinitions,
        character.characterId,
        mode
      ));
    const inventoryItems = allCharacterItems.filter((item) => !isPostmasterItem(item, bucketDefinitions));
    const postmasterItems = allCharacterItems.filter((item) => isPostmasterItem(item, bucketDefinitions));
    const knownItems = [...equippedItems, ...inventoryItems, ...postmasterItems, ...vaultItems];

    return {
      character_id: character.characterId,
      class_name: className(character.classType),
      light: character.light,
      emblem_url: normalizeBungieAssetUrl(character.emblemPath),
      equipped_items: equippedItems,
      equipment_groups: mode === "full" ? groupEquipment(equippedItems) : [],
      inventory_items: inventoryItems,
      inventory_groups: mode === "full" ? groupEquipment(inventoryItems) : [],
      postmaster_items: postmasterItems,
      loadout_slots: summarizeCharacterLoadouts(
        profile.characterLoadouts?.data?.[character.characterId]?.loadouts ?? [],
        loadoutNameDefinitions,
        definitions,
        knownItems
      ),
      capacity_limits: summarizeCharacterCapacityLimits(bucketDefinitions),
      ...(mode === "full"
        ? {
            craftable_items: summarizeCraftables(
              profile.characterCraftables?.data?.[character.characterId],
              definitions
            )
          }
        : {})
    };
  });
}

function summarizeProfileInventory(
  profile: DestinyProfileResponse,
  definitions: DefinitionComponentData,
  bucketDefinitions: DefinitionComponentData,
  plugSetDefinitions: DefinitionComponentData,
  objectiveDefinitions: DefinitionComponentData,
  damageTypeDefinitions: DefinitionComponentData,
  inventoryItemConstantsDefinitions: DefinitionComponentData,
  equipableItemSetDefinitions: DefinitionComponentData,
  mode: AccountSummaryMode
): Pick<AccountSummary, "vault" | "materials"> {
  const profileItems = profile.profileInventory?.data?.items ?? [];
  const items = profileItems
    .filter((item) => Boolean(item.itemInstanceId))
    .map((item) => summarizeItem(
      item,
      definitions,
      profile,
      bucketDefinitions,
      plugSetDefinitions,
      objectiveDefinitions,
      damageTypeDefinitions,
      inventoryItemConstantsDefinitions,
      equipableItemSetDefinitions,
      undefined,
      mode
    ));
  const materials = profileItems
    .filter((item) => !item.itemInstanceId)
    .map((item) => summarizeMaterial(item, definitions));
  const capacity = resolveVaultCapacity(profileItems, bucketDefinitions);

  return {
    vault: {
      item_count: items.length,
      ...(capacity ? { capacity } : {}),
      items,
      sample_items: mode === "full" ? items.slice(0, 30) : []
    },
    materials: {
      item_count: materials.length,
      items: materials
    }
  };
}

function resolveVaultCapacity(
  profileItems: DestinyProfileItem[],
  bucketDefinitions: DefinitionComponentData
): number | undefined {
  const vaultDefinition = bucketDefinitions[String(vaultBucketHash)] as DefinitionRecord | undefined;
  if (typeof vaultDefinition?.itemCount === "number" && vaultDefinition.itemCount > 0) {
    return vaultDefinition.itemCount;
  }

  for (const item of profileItems) {
    if (!item.itemInstanceId || typeof item.bucketHash !== "number") continue;
    const bucketDefinition = bucketDefinitions[String(item.bucketHash)] as DefinitionRecord | undefined;
    if (typeof bucketDefinition?.itemCount === "number" && bucketDefinition.itemCount > 0) {
      return bucketDefinition.itemCount;
    }
  }
  return undefined;
}

function summarizeCharacterCapacityLimits(
  bucketDefinitions: DefinitionComponentData
): CharacterCapacityLimits {
  const inventoryBuckets = accountEquipmentBucketHashes.map((bucketHash) => {
    const classification = bucketLabels[bucketHash];
    const definition = bucketDefinitions[String(bucketHash)] as DefinitionRecord | undefined;
    const capacity = positiveCapacity(definition);
    return {
      bucket_hash: bucketHash,
      bucket_name: definition?.displayProperties?.name?.trim() || classification.name,
      group_key: classification.group as "weapons" | "armor",
      ...(capacity ? { capacity } : {})
    };
  });
  const postmasterCapacity = positiveCapacity(
    bucketDefinitions[String(postmasterBucketHash)] as DefinitionRecord | undefined
  );

  return {
    inventory_buckets: inventoryBuckets,
    ...(postmasterCapacity ? { postmaster_capacity: postmasterCapacity } : {})
  };
}

function positiveCapacity(definition: DefinitionRecord | undefined): number | undefined {
  return typeof definition?.itemCount === "number" && definition.itemCount > 0
    ? definition.itemCount
    : undefined;
}

function summarizeMaterial(
  item: DestinyProfileItem,
  definitions: DefinitionComponentData
): AccountMaterialSummary {
  const definition = definitions[String(item.itemHash)] as DefinitionRecord | undefined;
  return {
    hash: item.itemHash,
    name: definition?.displayProperties?.name?.trim() || `Item ${item.itemHash}`,
    icon: normalizeBungieAssetUrl(definition?.displayProperties?.icon),
    item_type: definition?.itemTypeDisplayName,
    tier: definition?.inventory?.tierTypeName,
    quantity: item.quantity ?? 1
  };
}

function summarizeItem(
  item: DestinyProfileItem,
  definitions: DefinitionComponentData,
  profile: DestinyProfileResponse,
  bucketDefinitions: DefinitionComponentData = {},
  plugSetDefinitions: DefinitionComponentData = {},
  objectiveDefinitions: DefinitionComponentData = {},
  damageTypeDefinitions: DefinitionComponentData = {},
  inventoryItemConstantsDefinitions: DefinitionComponentData = {},
  equipableItemSetDefinitions: DefinitionComponentData = {},
  characterId?: string,
  mode: AccountSummaryMode = "full",
  recordDefinitions: DefinitionComponentData = {}
): AccountItemSummary {
  const components = profile.itemComponents;
  const definition = definitions[String(item.itemHash)] as DefinitionRecord | undefined;
  const explicitBucketHash = item.bucketHash;
  const definitionBucketHash = definition?.inventory?.bucketTypeHash;
  // Exotic items can use a tier-specific inventory bucket (for example
  // 2422292810 for exotic leg armor) instead of the normal equipment bucket.
  // The inventory bucket is a storage container, while equipmentSlotTypeHash
  // is the authoritative slot used by EquipItem and by account power math.
  // Prefer the equipment slot whenever the definition bucket is not one of
  // our canonical account equipment buckets.
  const definitionEquipmentSlotHash = definition?.equippingBlock?.equipmentSlotTypeHash;
  const canonicalDefinitionBucketHash = (
    typeof definitionEquipmentSlotHash === "number"
    && definitionEquipmentSlotHash > 0
    && !classifyBucket(definitionBucketHash)
  )
    ? definitionEquipmentSlotHash
    : definitionBucketHash;
  const explicitBucketDefinition = explicitBucketHash
    ? bucketDefinitions[String(explicitBucketHash)] as DefinitionRecord | undefined
    : undefined;
  const isPostmaster = isPostmasterBucketHash(explicitBucketHash)
    || isPostmasterBucketDefinition(explicitBucketDefinition);
  const equipmentBucketHash = canonicalDefinitionBucketHash ?? explicitBucketHash;
  const bucketHash = isPostmaster ? explicitBucketHash : equipmentBucketHash;
  const bucket = classifyBucket(equipmentBucketHash);
  const groupKey = bucket?.group ?? "other";
  const bucketDefinition = bucketHash ? bucketDefinitions[String(bucketHash)] as DefinitionRecord | undefined : undefined;
  const equipmentBucketDefinition = equipmentBucketHash
    ? bucketDefinitions[String(equipmentBucketHash)] as DefinitionRecord | undefined
    : undefined;
  const instanceId = item.itemInstanceId;
  const instance = instanceId ? components?.instances?.data?.[instanceId] : undefined;
  const sockets = mode === "full"
    ? summarizeSockets({
        instanceId,
        itemDefinition: definition,
        components,
        definitions,
        plugSetDefinitions,
        objectiveDefinitions,
        profilePlugSets: profile.profilePlugSets?.data,
        characterPlugSets: characterId ? profile.characterPlugSets?.data?.[characterId] : undefined
      })
    : [];
  const selectedPlugs = mode === "full"
    ? sockets.flatMap((socket) => (
        socket.is_visible && socket.selected_plug ? [socket.selected_plug] : []
      ))
    : summarizeSelectedPlugPreviews(instanceId, components, definitions);
  const weaponRoll = groupKey === "weapons"
    ? summarizeWeaponRoll(instanceId, components, definitions)
    : undefined;
  const armorSet = groupKey === "armor" && definition
    ? summarizeEquipableItemSet(definition, equipableItemSetDefinitions, undefined)
    : undefined;
  const pursuit = summarizePursuitItem(item, definition, instanceId, components, objectiveDefinitions);
  const crafting = groupKey === "weapons"
    ? summarizeWeaponCrafting(item.state, definition, inventoryItemConstantsDefinitions)
    : undefined;
  const summary: AccountItemSummary = {
    hash: item.itemHash,
    instance_id: instanceId,
    name: definition?.displayProperties?.name?.trim() || `Item ${item.itemHash}`,
    icon: normalizeBungieAssetUrl(definition?.displayProperties?.icon),
    item_type: definition?.itemTypeDisplayName,
    class_type: definition?.classType,
    ammo_type: ammoTypeKey(definition?.equippingBlock?.ammoType),
    tier: definition?.inventory?.tierTypeName,
    bucket_hash: bucketHash,
    bucket_name: isPostmaster
      ? bucketDefinition?.displayProperties?.name?.trim()
      : bucket?.name ?? bucketDefinition?.displayProperties?.name?.trim(),
    equipment_bucket_hash: equipmentBucketHash,
    equipment_bucket_name: bucket?.name ?? equipmentBucketDefinition?.displayProperties?.name?.trim(),
    group_key: groupKey,
    ...(armorSet ? { armor_set: { hash: armorSet.hash, name: armorSet.name } } : {}),
    power: instance?.primaryStat?.value,
    locked: isLocked(item.state),
    ...(crafting ? { crafting } : {}),
    instance: summarizeItemInstance(
      instance,
      damageTypeDefinitions,
      inventoryItemConstantsDefinitions
    ),
    socket_plugs: selectedPlugs,
    ...(weaponRoll ? { weapon_roll: weaponRoll } : {}),
    ...(pursuit ? { pursuit } : {}),
    ...(mode === "full"
      ? {
          item_objectives: summarizeItemObjectives(instanceId, components, objectiveDefinitions),
          sockets
        }
      : pursuit
        ? { item_objectives: summarizeItemObjectives(instanceId, components, objectiveDefinitions) }
        : {})
  };
  const armorStats = groupKey === "armor" ? summarizeArmorStats(instanceId, components) : undefined;
  if (armorStats) {
    summary.armor_stats = armorStats;
    summary.armor_stat_breakdown = summarizeArmorStatBreakdown(
      armorStats,
      instanceId,
      components,
      definitions
    );
  }
  const armorEnergy = mode === "full" && groupKey === "armor" ? summarizeArmorEnergy(instance) : undefined;
  if (armorEnergy) {
    summary.armor_energy = armorEnergy;
  }
  const weaponStats = groupKey === "weapons" ? summarizeWeaponStats(instanceId, components) : undefined;
  if (weaponStats) {
    summary.weapon_stats = weaponStats;
  }
  const weaponFrame = mode === "snapshot"
    ? summarizeSelectedWeaponFrame(selectedPlugs)
    : definition
      ? summarizeWeaponFrame(definition, definitions, { plugSetDefinitions })
      : undefined;
  if (weaponFrame) {
    summary.weapon_frame = weaponFrame;
  }
  if (mode === "full" && groupKey === "weapons") {
    const catalyst = summarizeAccountItemCatalyst({
      itemName: summary.name,
      selectedPlugs,
      profileRecords: profile.profileRecords?.data?.records,
      recordDefinitions,
      objectiveDefinitions
    });
    if (catalyst) summary.catalyst = catalyst;
  }

  return sanitizeAccountItemSummary(summary);
}

function summarizeWeaponCrafting(
  itemState: number | undefined,
  definition: DefinitionRecord | undefined,
  inventoryItemConstantsDefinitions: DefinitionComponentData
): AccountWeaponCraftingSummary | undefined {
  // DestinyItemState.Crafted = 8. 强化掉落暂不纳入本轮仓库状态展示。
  if (typeof itemState !== "number" || (itemState & 8) !== 8) return undefined;
  if (typeof definition?.inventory?.recipeItemHash !== "number" || definition.inventory.recipeItemHash <= 0) {
    return undefined;
  }
  const constants = inventoryItemConstantsDefinitions["1"] as DefinitionRecord | undefined
    ?? Object.values(inventoryItemConstantsDefinitions)[0];
  const overlay = normalizeBungieAssetUrl(constants?.craftedOverlayPath);
  const background = normalizeBungieAssetUrl(constants?.craftedBackgroundPath);
  return {
    kind: "crafted",
    ...(overlay ? { overlay } : {}),
    ...(background ? { background } : {})
  };
}

function summarizeArmorEnergy(instance: DestinyItemInstanceComponent | undefined): ArmorEnergySummary | undefined {
  const energy = instance?.energy;
  if (!energy) {
    return undefined;
  }

  if (
    typeof energy.energyCapacity !== "number"
    || typeof energy.energyUsed !== "number"
    || typeof energy.energyUnused !== "number"
  ) {
    return undefined;
  }

  return {
    type_hash: energy.energyTypeHash,
    type: energy.energyType,
    capacity: energy.energyCapacity,
    used: energy.energyUsed,
    unused: energy.energyUnused
  };
}

function summarizeItemInstance(
  instance: DestinyItemInstanceComponent | undefined,
  damageTypeDefinitions: DefinitionComponentData,
  inventoryItemConstantsDefinitions: DefinitionComponentData
): AccountItemInstanceSummary | undefined {
  if (!instance) {
    return undefined;
  }

  const damageTypeDefinition = resolveDamageTypeDefinition(
    instance.damageTypeHash,
    instance.damageType,
    damageTypeDefinitions
  );
  const gearTierOverlay = resolveGearTierOverlay(
    instance.gearTier,
    inventoryItemConstantsDefinitions
  );

  const summary: AccountItemInstanceSummary = {
    damage_type: instance.damageType,
    damage_type_hash: instance.damageTypeHash,
    damage_type_name: damageTypeDefinition?.displayProperties?.name?.trim(),
    damage_type_icon: normalizeBungieAssetUrl(damageTypeDefinition?.displayProperties?.icon),
    breaker_type: instance.breakerType,
    breaker_type_hash: instance.breakerTypeHash,
    item_level: instance.itemLevel,
    quality: instance.quality,
    is_equipped: instance.isEquipped,
    can_equip: instance.canEquip,
    equip_required_level: instance.equipRequiredLevel,
    cannot_equip_reason: instance.cannotEquipReason,
    gear_tier: instance.gearTier,
    gear_tier_overlay: gearTierOverlay
  };

  return Object.values(summary).some((value) => value !== undefined) ? summary : undefined;
}

function resolveDamageTypeDefinition(
  hash: number | undefined,
  enumValue: number | undefined,
  definitions: DefinitionComponentData
): DefinitionRecord | undefined {
  if (typeof hash === "number") {
    const definition = definitions[String(hash >>> 0)] as DefinitionRecord | undefined;
    if (definition) return definition;
  }
  if (typeof enumValue !== "number") return undefined;
  return Object.values(definitions).find((definition) => definition.enumValue === enumValue);
}

function resolveGearTierOverlay(
  gearTier: number | undefined,
  definitions: DefinitionComponentData
): string | undefined {
  if (typeof gearTier !== "number" || gearTier <= 0) return undefined;
  const constants = definitions["1"] as DefinitionRecord | undefined
    ?? Object.values(definitions)[0];
  const path = constants?.gearTierOverlayImagePaths?.[Math.floor(gearTier) - 1];
  return normalizeBungieAssetUrl(path);
}

function summarizeWeaponStats(
  instanceId: string | undefined,
  components: DestinyProfileResponse["itemComponents"] | undefined
): WeaponStatSummary | undefined {
  if (!instanceId) {
    return undefined;
  }

  const stats = components?.stats?.data?.[instanceId]?.stats;
  if (!stats) {
    return undefined;
  }

  const summary: WeaponStatSummary = {};
  for (const stat of Object.values(stats)) {
    const key = weaponStatHashMap[Number(stat.statHash)];
    if (!key || stat.value === undefined) {
      continue;
    }
    summary[key] = stat.value;
  }

  return Object.keys(summary).length ? summary : undefined;
}

function summarizeArmorStats(
  instanceId: string | undefined,
  components: DestinyProfileResponse["itemComponents"] | undefined
): ArmorStatSummary | undefined {
  if (!instanceId) {
    return undefined;
  }

  const stats = components?.stats?.data?.[instanceId]?.stats;
  if (!stats) {
    return undefined;
  }

  const summary: ArmorStatSummary = {
    health: 0,
    melee: 0,
    grenade: 0,
    super: 0,
    class: 0,
    weapon: 0,
    total: 0
  };

  for (const stat of Object.values(stats)) {
    const key = armorStatHashMap[Number(stat.statHash)];
    if (!key) {
      continue;
    }
    summary[key] = stat.value ?? 0;
  }
  summary.total = summary.health
    + summary.melee
    + summary.grenade
    + summary.super
    + summary.class
    + summary.weapon;

  return summary;
}

function summarizeArmorStatBreakdown(
  armorStats: ArmorStatSummary,
  instanceId: string | undefined,
  components: DestinyProfileResponse["itemComponents"] | undefined,
  definitions: DefinitionComponentData
): ArmorStatBreakdownSummary {
  const mods = summarizeArmorStatMods(instanceId, components, definitions);
  const summary = {} as ArmorStatBreakdownSummary;

  for (const key of armorStatKeys) {
    const finalValue = armorStats[key] ?? 0;
    const modValue = mods[key] ?? 0;
    summary[key] = {
      base: finalValue - modValue,
      mod: modValue,
      final: finalValue
    };
  }

  const finalTotal = armorStats.total;
  const modTotal = armorStatKeys.reduce((total, key) => total + summary[key].mod, 0);
  summary.total = {
    base: finalTotal - modTotal,
    mod: modTotal,
    final: finalTotal
  };

  return summary;
}

function summarizeArmorStatMods(
  instanceId: string | undefined,
  components: DestinyProfileResponse["itemComponents"] | undefined,
  definitions: DefinitionComponentData
): Record<ArmorStatKey, number> {
  const summary = Object.fromEntries(armorStatKeys.map((key) => [key, 0])) as Record<ArmorStatKey, number>;
  if (!instanceId) {
    return summary;
  }

  const sockets = components?.sockets?.data?.[instanceId]?.sockets ?? [];
  for (const socket of sockets) {
    if (socket.isVisible === false || !socket.plugHash) {
      continue;
    }

    const definition = definitions[String(socket.plugHash)] as DefinitionRecord | undefined;
    if (definition && readArmorArchetypeStatPair(definition)) {
      continue;
    }
    for (const stat of definition?.investmentStats ?? []) {
      if (stat.isConditionallyActive) {
        continue;
      }

      const key = armorStatHashMap[Number(stat.statTypeHash)];
      if (!key || typeof stat.value !== "number") {
        continue;
      }

      summary[key] += stat.value;
    }
  }

  return summary;
}

function summarizeCharacterLoadouts(
  loadouts: DestinyCharacterLoadout[],
  loadoutNameDefinitions: DefinitionComponentData,
  itemDefinitions: DefinitionComponentData,
  knownItems: AccountItemSummary[]
): CharacterLoadoutSlotSummary[] {
  const itemsByInstanceId = new Map(
    knownItems
      .filter((item) => item.instance_id)
      .map((item) => [item.instance_id as string, item] as const)
  );

  return loadouts.map((loadout, index) => {
    const loadoutItems = (loadout.items ?? []).filter((item) => isValidLoadoutItemInstanceId(item.itemInstanceId));
    return {
      index,
      name: resolveLoadoutName(loadout.nameHash, index, loadoutNameDefinitions),
      ...(typeof loadout.nameHash === "number" ? { name_hash: loadout.nameHash } : {}),
      ...(typeof loadout.iconHash === "number" ? { icon_hash: loadout.iconHash } : {}),
      ...(typeof loadout.colorHash === "number" ? { color_hash: loadout.colorHash } : {}),
      item_count: loadoutItems.length,
      items: loadoutItems.map((item) => {
        const matched = itemsByInstanceId.get(item.itemInstanceId as string);
        const plugItemHashes = (item.plugItemHashes ?? []).filter(isValidLoadoutPlugHash);
        return {
          instance_id: item.itemInstanceId,
          ...(matched ? { item_hash: matched.hash } : {}),
          // CharacterLoadouts 不携带装备名称；反查不到账号实例时保持未知，
          // 由 UI 展示实例尾号和“未定位”，避免把实例 ID 冒充装备名称。
          name: matched?.name ?? "未定位实例",
          icon: matched?.icon,
          bucket_name: matched?.bucket_name,
          plug_hashes: plugItemHashes,
          plugs: (item.plugItemHashes ?? []).flatMap((hash, socketIndex) => {
            if (!isValidLoadoutPlugHash(hash)) return [];
            const definition = itemDefinitions[String(hash)] as DefinitionRecord | undefined;
            if (isEmptyWeaponMasterworkPlugDefinition(definition)) return [];
            return [{
              hash,
              socket_index: socketIndex,
              name: definition?.displayProperties?.name?.trim() || `Plug ${hash}`,
              icon: normalizeBungieAssetUrl(definition?.displayProperties?.icon),
              category_identifier: definition?.plug?.plugCategoryIdentifier
            }];
          })
        };
      })
    };
  });
}

function isValidLoadoutItemInstanceId(instanceId: string | undefined): boolean {
  if (typeof instanceId !== "string") return false;
  const normalized = instanceId.trim();
  return normalized.length > 0 && normalized !== "0";
}

function isValidLoadoutPlugHash(hash: number): hash is number {
  return Number.isInteger(hash)
    && hash > 0
    && hash <= 0xFFFFFFFF
    && hash !== unsetLoadoutPlugHash;
}

function resolveLoadoutName(
  nameHash: number | undefined,
  index: number,
  loadoutNameDefinitions: DefinitionComponentData
): string {
  const definition = nameHash ? loadoutNameDefinitions[String(nameHash)] as DefinitionRecord | undefined : undefined;
  const resolved = definition?.name?.trim() || definition?.displayProperties?.name?.trim();
  return resolved || `配装槽 ${index + 1}`;
}

function isPostmasterItem(item: AccountItemSummary, bucketDefinitions: DefinitionComponentData): boolean {
  if (!item.bucket_hash) {
    return false;
  }

  if (isPostmasterBucketHash(item.bucket_hash)) {
    return true;
  }

  const bucketDefinition = bucketDefinitions[String(item.bucket_hash)] as DefinitionRecord | undefined;
  const bucketName = bucketDefinition?.displayProperties?.name?.trim().toLowerCase() ?? "";
  return bucketName.includes("postmaster")
    || bucketName.includes("lost items")
    || bucketName.includes("邮政")
    || bucketName.includes("失物");
}

function isPostmasterBucketDefinition(bucketDefinition: DefinitionRecord | undefined): boolean {
  if (isPostmasterBucketHash(bucketDefinition?.hash)) {
    return true;
  }

  const bucketName = bucketDefinition?.displayProperties?.name?.trim().toLowerCase() ?? "";
  return bucketName.includes("postmaster")
    || bucketName.includes("lost items")
    || bucketName.includes("邮政")
    || bucketName.includes("失物");
}

function summarizeSelectedPlugPreviews(
  instanceId: string | undefined,
  components: DestinyProfileResponse["itemComponents"] | undefined,
  definitions: DefinitionComponentData
): AccountItemPlugSummary[] {
  if (!instanceId) {
    return [];
  }

  return (components?.sockets?.data?.[instanceId]?.sockets ?? [])
    .filter((socket) => socket.isVisible !== false && typeof socket.plugHash === "number")
    .map((socket) => {
      const hash = socket.plugHash as number;
      const definition = definitions[String(hash)] as DefinitionRecord | undefined;
      const modifiers = summarizePlugInvestmentStats(definition);
      return {
        hash,
        name: definition?.displayProperties?.name?.trim() || `Plug ${hash}`,
        icon: normalizeBungieAssetUrl(definition?.displayProperties?.icon),
        ...(definition?.plug?.plugCategoryIdentifier
          ? { category_identifier: definition.plug.plugCategoryIdentifier }
          : {}),
        ...(typeof definition?.plug?.energyCost?.energyCost === "number"
          ? { energy_cost: Math.max(0, definition.plug.energyCost.energyCost) }
          : {}),
        ...(definition?.traitIds?.length ? { trait_ids: definition.traitIds } : {}),
        ...(definition?.itemTypeDisplayName ? { item_type: definition.itemTypeDisplayName } : {}),
        ...(Object.keys(modifiers.weapon).length ? { stat_modifiers: modifiers.weapon } : {}),
        ...(Object.keys(modifiers.armor).length ? { armor_stat_modifiers: modifiers.armor } : {})
      };
    });
}

function summarizeSockets(input: {
  instanceId: string | undefined;
  itemDefinition: DefinitionRecord | undefined;
  components: DestinyProfileResponse["itemComponents"] | undefined;
  definitions: DefinitionComponentData;
  plugSetDefinitions: DefinitionComponentData;
  objectiveDefinitions: DefinitionComponentData;
  profilePlugSets: DestinyPlugSetsComponent | undefined;
  characterPlugSets: DestinyPlugSetsComponent | undefined;
}): AccountItemSocketSummary[] {
  if (!input.instanceId) {
    return [];
  }

  const socketStates = input.components?.sockets?.data?.[input.instanceId]?.sockets ?? [];
  const itemReusablePlugs = input.components?.reusablePlugs?.data?.[input.instanceId]?.plugs ?? {};
  const objectivesPerPlug = input.components?.plugObjectives?.data?.[input.instanceId]?.objectivesPerPlug ?? {};
  const socketEntries = input.itemDefinition?.sockets?.socketEntries ?? [];

  return socketStates.map((socket, socketIndex) => {
    const selectedHash = typeof socket.plugHash === "number" ? socket.plugHash : undefined;
    const selectedObjectives = selectedHash === undefined ? undefined : objectivesPerPlug[String(selectedHash)];
    const reusableByHash = new Map<number, AccountItemReusablePlugSummary>();
    const addCandidates = (
      candidates: DestinyItemPlugState[],
      source: AccountItemReusablePlugSource
    ): void => {
      for (const candidate of candidates) {
        if (typeof candidate.plugItemHash !== "number") {
          continue;
        }
        const existing = reusableByHash.get(candidate.plugItemHash);
        const objectives = candidate.plugObjectives ?? objectivesPerPlug[String(candidate.plugItemHash)];
        const next = buildReusablePlugSummary(
          candidate,
          source,
          selectedHash,
          objectives,
          input.definitions,
          input.objectiveDefinitions
        );
        if (!existing) {
          reusableByHash.set(candidate.plugItemHash, next);
          continue;
        }
        existing.selected ||= next.selected;
        existing.can_insert = existing.can_insert ?? next.can_insert;
        existing.enabled = existing.enabled ?? next.enabled;
        existing.insert_fail_indexes = existing.insert_fail_indexes.length
          ? existing.insert_fail_indexes
          : next.insert_fail_indexes;
        existing.enable_fail_indexes = existing.enable_fail_indexes.length
          ? existing.enable_fail_indexes
          : next.enable_fail_indexes;
        existing.objectives = existing.objectives ?? next.objectives;
        if (!existing.sources.includes(source)) {
          existing.sources.push(source);
        }
      }
    };

    addCandidates(itemReusablePlugs[String(socketIndex)] ?? [], "instance");
    const reusablePlugSetHash = socketEntries[socketIndex]?.reusablePlugSetHash;
    if (typeof reusablePlugSetHash === "number") {
      addCandidates(input.characterPlugSets?.plugs?.[String(reusablePlugSetHash)] ?? [], "character");
      addCandidates(input.profilePlugSets?.plugs?.[String(reusablePlugSetHash)] ?? [], "profile");
      const manifestPlugs = input.plugSetDefinitions[String(reusablePlugSetHash)]?.reusablePlugItems ?? [];
      addCandidates(
        manifestPlugs
          .filter((plug): plug is { plugItemHash: number } => typeof plug.plugItemHash === "number")
          .map((plug) => ({ plugItemHash: plug.plugItemHash })),
        "manifest"
      );
    }

    if (selectedHash !== undefined && !reusableByHash.has(selectedHash)) {
      addCandidates([{ plugItemHash: selectedHash }], "instance");
    }

    return {
      socket_index: socketIndex,
      is_visible: socket.isVisible !== false,
      is_enabled: socket.isEnabled !== false,
      enable_fail_indexes: socket.enableFailIndexes ?? [],
      selected_plug: selectedHash === undefined
        ? undefined
        : buildPlugSummary(
          selectedHash,
          selectedObjectives,
          input.definitions,
          input.objectiveDefinitions
        ),
      reusable_plugs: [...reusableByHash.values()]
    };
  });
}

export type AccountWeaponRollSemanticRole =
  | "barrel"
  | "magazine"
  | "masterwork"
  | "trait"
  | "origin"
  | "other";

function summarizeWeaponRoll(
  instanceId: string | undefined,
  components: DestinyProfileResponse["itemComponents"] | undefined,
  definitions: DefinitionComponentData
): AccountWeaponRollSummary | undefined {
  if (!instanceId) return undefined;

  const socketComponent = components?.sockets?.data?.[instanceId];
  const reusableData = components?.reusablePlugs?.data;
  const reusableBySocket = reusableData?.[instanceId]?.plugs ?? {};
  const summaryReasons = new Set<AccountWeaponRollIncompleteReason>();
  if (!socketComponent) summaryReasons.add("missing_socket_data");
  if (!reusableData) summaryReasons.add("missing_reusable_plug_data");

  const classified = (socketComponent?.sockets ?? []).flatMap((socket, socketIndex) => {
    const currentHash = typeof socket.plugHash === "number" ? socket.plugHash : undefined;
    const ownedByHash = new Map<number, AccountWeaponRollPlugSummary>();
    let missingDefinition = false;
    const addPlug = (hash: number, selected: boolean): void => {
      const definition = definitions[String(hash)] as DefinitionRecord | undefined;
      if (!definition) missingDefinition = true;
      const existing = ownedByHash.get(hash);
      if (existing) {
        existing.selected ||= selected;
        return;
      }
      ownedByHash.set(hash, {
        hash,
        name: definition?.displayProperties?.name?.trim() || `Plug ${hash}`,
        ...(definition?.displayProperties?.icon
          ? { icon: normalizeBungieAssetUrl(definition.displayProperties.icon) }
          : {}),
        ...(definition?.displayProperties?.description
          ? { description: definition.displayProperties.description }
          : {}),
        ...(definition?.plug?.plugCategoryIdentifier
          ? { category_identifier: definition.plug.plugCategoryIdentifier }
          : {}),
        ...(definition?.itemTypeDisplayName ? { item_type: definition.itemTypeDisplayName } : {}),
        selected
      });
    };

    for (const plug of reusableBySocket[String(socketIndex)] ?? []) {
      if (typeof plug.plugItemHash === "number") addPlug(plug.plugItemHash, plug.plugItemHash === currentHash);
    }
    if (currentHash !== undefined) addPlug(currentHash, true);

    const ownedPlugs = [...ownedByHash.values()];
    const role = classifyWeaponRollSocket(ownedPlugs);
    if (!role && (socket.isVisible === false || ownedPlugs.every(isIgnoredWeaponRollPlug))) return [];

    const incompleteReasons = new Set<AccountWeaponRollIncompleteReason>();
    if (missingDefinition) incompleteReasons.add("missing_plug_definition");
    if (!role) incompleteReasons.add("unclassified_socket");
    for (const reason of incompleteReasons) summaryReasons.add(reason);

    return [{
      socket_index: socketIndex,
      role: role ?? "other",
      current_plug: currentHash === undefined ? undefined : ownedByHash.get(currentHash),
      owned_plugs: ownedPlugs,
      incomplete_reasons: [...incompleteReasons]
    }];
  });

  let traitIndex = 0;
  const sockets: AccountWeaponRollSocketSummary[] = classified
    .sort((left, right) => left.socket_index - right.socket_index)
    .map((socket) => {
      const slot: AccountWeaponRollSlot = socket.role === "trait"
        ? (++traitIndex === 1 ? "perk1" : traitIndex === 2 ? "perk2" : "other")
        : socket.role;
      return {
        socket_index: socket.socket_index,
        slot,
        label: weaponRollSlotLabel(slot),
        current_plug: socket.current_plug,
        owned_plugs: socket.owned_plugs,
        complete: socket.incomplete_reasons.length === 0,
        incomplete_reasons: socket.incomplete_reasons
      };
    });

  const incompleteReasons = [...summaryReasons];
  return {
    fingerprint: weaponRollFingerprint(sockets),
    complete: incompleteReasons.length === 0,
    incomplete_reasons: incompleteReasons,
    sockets
  };
}

export function classifyWeaponRollSocket(
  plugs: readonly AccountWeaponRollPlugSummary[]
): AccountWeaponRollSemanticRole | undefined {
  const visible = plugs.filter((plug) => !isIgnoredWeaponRollPlug(plug));
  if (!visible.length) return undefined;
  const category = visible
    .map((plug) => plug.category_identifier?.toLocaleLowerCase() ?? "")
    .filter(Boolean)
    .join(" ");
  const itemType = visible
    .map((plug) => plug.item_type?.toLocaleLowerCase() ?? "")
    .filter(Boolean)
    .join(" ");

  if (includesAnyText(category, ["masterwork"]) || includesAnyText(itemType, ["masterwork", "大师杰作"])) {
    return "masterwork";
  }
  if (category.includes("origin") || includesAnyText(itemType, ["origin trait", "起源特性", "原始特性"])) {
    return "origin";
  }
  if (
    includesAnyText(category, ["barrel", "scope", "sight", "bowstring", "bow.string", "blade", "haft", "tube", "rail"])
    || includesAnyText(itemType, ["发射器枪管", "launcher barrel"])
  ) {
    return "barrel";
  }
  if (includesAnyText(category, ["magazine", "batter", "arrow", "guard", "stock", "grip", "bolt"])) {
    return "magazine";
  }
  if (includesAnyText(category, ["trait", "perk"]) || includesAnyText(itemType, ["trait", "perk", "特性", "特征"])) {
    return "trait";
  }
  return undefined;
}

function isIgnoredWeaponRollPlug(plug: AccountWeaponRollPlugSummary): boolean {
  const category = plug.category_identifier?.toLocaleLowerCase() ?? "";
  const itemType = plug.item_type?.toLocaleLowerCase() ?? "";
  return includesAnyText(category, [
    "shader", "ornament", "memento", "tracker", "catalyst", "weapon.mod", "modguns",
    "mods.weapon", "cosmetic", "skin", "killcounter", "intrinsic", "weapon_tiering",
    "kill_vfx", "perk_upgrades",
    "perk.upgrades", "perkupgrades"
  ]) || includesAnyText(itemType, [
    "着色器", "shader", "武器模组", "weapon mod", "催化剂", "catalyst", "记录器", "tracker",
    "装饰", "ornament", "皮肤", "skin", "固有", "intrinsic", "能量核心", "战斗特效"
  ]);
}

function sanitizeWeaponRollSummary(summary: AccountWeaponRollSummary): AccountWeaponRollSummary {
  const sockets = summary.sockets.map((socket) => {
    const currentPlug = socket.current_plug && !isEmptyWeaponMasterworkPlugSummary(socket.current_plug)
      ? socket.current_plug
      : undefined;
    const ownedPlugs = socket.owned_plugs.filter((plug) => !isEmptyWeaponMasterworkPlugSummary(plug));
    if (currentPlug === socket.current_plug && ownedPlugs.length === socket.owned_plugs.length) {
      return socket;
    }
    return {
      ...socket,
      current_plug: currentPlug,
      owned_plugs: ownedPlugs
    };
  });
  if (sockets.every((socket, index) => socket === summary.sockets[index])) return summary;
  return {
    ...summary,
    fingerprint: weaponRollFingerprint(sockets),
    sockets
  };
}

function isEmptyWeaponMasterworkPlugDefinition(definition: DefinitionRecord | undefined): boolean {
  if (definition?.plug?.plugCategoryIdentifier?.toLocaleLowerCase() !== "v400.plugs.weapons.masterworks") {
    return false;
  }
  return !definition.displayProperties?.name?.trim()
    && !definition.displayProperties?.description?.trim()
    && !definition.displayProperties?.icon?.trim()
    && !definition.originalDisplayProperties?.name?.trim()
    && !definition.originalDisplayProperties?.description?.trim()
    && !definition.originalDisplayProperties?.icon?.trim()
    && !definition.itemTypeDisplayName?.trim()
    && !(definition.investmentStats?.length)
    && !(definition.perks?.length)
    && !(definition.traitIds?.length);
}

function isEmptyWeaponMasterworkPlugSummary(
  plug: Pick<AccountItemPlugSummary, "hash" | "name" | "icon" | "description" | "category_identifier" | "item_type">
): boolean {
  return plug.category_identifier?.toLocaleLowerCase() === "v400.plugs.weapons.masterworks"
    && plug.name.trim() === `Plug ${plug.hash}`
    && !plug.icon?.trim()
    && !plug.description?.trim()
    && !plug.item_type?.trim();
}

function includesAnyText(value: string, candidates: readonly string[]): boolean {
  return candidates.some((candidate) => value.includes(candidate));
}

function weaponRollSlotLabel(slot: AccountWeaponRollSlot): string {
  if (slot === "barrel") return "枪管/瞄具";
  if (slot === "magazine") return "第二列";
  if (slot === "masterwork") return "大师";
  if (slot === "perk1") return "Perk 1";
  if (slot === "perk2") return "Perk 2";
  if (slot === "origin") return "起源特性";
  return "其他插槽";
}

function weaponRollFingerprint(sockets: readonly AccountWeaponRollSocketSummary[]): string {
  const canonical = sockets
    .map((socket) => `${socket.socket_index}:${socket.slot}:${socket.current_plug?.hash ?? 0}:${socket.owned_plugs
      .map((plug) => plug.hash)
      .sort((left, right) => left - right)
      .join(".")}`)
    .join("|");
  let hash = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index++) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `roll-v1-${(hash >>> 0).toString(16).padStart(8, "0")}:${canonical.length}`;
}

function buildReusablePlugSummary(
  plug: DestinyItemPlugState,
  source: AccountItemReusablePlugSource,
  selectedHash: number | undefined,
  objectives: DestinyObjectiveProgress[] | undefined,
  definitions: DefinitionComponentData,
  objectiveDefinitions: DefinitionComponentData
): AccountItemReusablePlugSummary {
  return {
    ...buildPlugSummary(plug.plugItemHash, objectives, definitions, objectiveDefinitions),
    selected: plug.plugItemHash === selectedHash,
    can_insert: plug.canInsert,
    enabled: plug.enabled,
    insert_fail_indexes: plug.insertFailIndexes ?? [],
    enable_fail_indexes: plug.enableFailIndexes ?? [],
    sources: [source]
  };
}

function buildPlugSummary(
  hash: number,
  objectives: DestinyObjectiveProgress[] | undefined,
  definitions: DefinitionComponentData,
  objectiveDefinitions: DefinitionComponentData
): AccountItemPlugSummary {
  const definition = definitions[String(hash)] as DefinitionRecord | undefined;
  const objectiveSummaries = summarizePlugObjectives(objectives, objectiveDefinitions);
  const modifiers = summarizePlugInvestmentStats(definition);
  return {
    hash,
    name: definition?.displayProperties?.name?.trim() || `Plug ${hash}`,
    icon: normalizeBungieAssetUrl(definition?.displayProperties?.icon),
    description: definition?.displayProperties?.description,
    ...(definition?.plug?.plugCategoryIdentifier
      ? { category_identifier: definition.plug.plugCategoryIdentifier }
      : {}),
    ...(typeof definition?.plug?.energyCost?.energyCost === "number"
      ? { energy_cost: Math.max(0, definition.plug.energyCost.energyCost) }
      : {}),
    ...(definition?.traitIds?.length ? { trait_ids: definition.traitIds } : {}),
    ...(objectiveSummaries.length ? { objectives: objectiveSummaries } : {}),
    ...(Object.keys(modifiers.weapon).length ? { stat_modifiers: modifiers.weapon } : {}),
    ...(Object.keys(modifiers.armor).length ? { armor_stat_modifiers: modifiers.armor } : {}),
    ...(definition?.sourceData?.sourceString
      ? { source_description: definition.sourceData.sourceString }
      : {}),
    ...(definition?.itemTypeDisplayName ? { item_type: definition.itemTypeDisplayName } : {})
  };
}

function summarizePlugInvestmentStats(definition: DefinitionRecord | undefined): {
  weapon: WeaponStatSummary;
  armor: Partial<Record<ArmorStatKey, number>>;
} {
  const statModifiers: WeaponStatSummary = {};
  const armorStatModifiers: Partial<Record<ArmorStatKey, number>> = {};
  for (const stat of definition?.investmentStats ?? []) {
    if (stat.isConditionallyActive || typeof stat.value !== "number") continue;
    const weaponKey = weaponStatHashMap[Number(stat.statTypeHash)];
    if (weaponKey) statModifiers[weaponKey] = (statModifiers[weaponKey] ?? 0) + stat.value;
    const armorKey = armorStatHashMap[Number(stat.statTypeHash)];
    if (armorKey) armorStatModifiers[armorKey] = (armorStatModifiers[armorKey] ?? 0) + stat.value;
  }
  return {
    weapon: statModifiers,
    armor: armorStatModifiers
  };
}

function summarizeAccountItemCatalyst(input: {
  itemName: string;
  selectedPlugs: AccountItemPlugSummary[];
  profileRecords: Record<string, DestinyRecordProgress> | undefined;
  recordDefinitions: DefinitionComponentData;
  objectiveDefinitions: DefinitionComponentData;
}): AccountItemCatalystSummary | undefined {
  const catalystPlug = input.selectedPlugs.find((plug) => (
    plug.trait_ids?.includes("item.exotic_catalyst")
  ));
  const recordEntries = Object.entries(input.recordDefinitions).filter(([, definition]) => (
    isExoticCatalystRecord(definition)
  ));
  const exactMatches = catalystPlug
    ? recordEntries.filter(([, definition]) => (
        normalizeCatalystIdentity(definition.displayProperties?.name) === normalizeCatalystIdentity(catalystPlug.name)
      ))
    : [];
  const baseMatches = recordEntries.filter(([, definition]) => (
    normalizeCatalystBaseName(definition.displayProperties?.name) === normalizeCatalystBaseName(input.itemName)
  ));
  const catalystRecord = [...exactMatches, ...baseMatches].find(([recordHash]) => (
    input.profileRecords?.[String(Number(recordHash) >>> 0)]?.objectives?.length
  ));
  if (!catalystRecord) return undefined;

  const [recordHashValue, recordDefinition] = catalystRecord;
  const recordHash = Number(recordHashValue) >>> 0;
  const recordProgress = input.profileRecords?.[String(recordHash)];
  if (!recordProgress?.objectives?.length) return undefined;

  const objectives = summarizePlugObjectives(recordProgress.objectives, input.objectiveDefinitions);
  if (!objectives.length) return undefined;
  const complete = objectives.every((objective) => objective.complete);
  const progress = Math.round(objectives.reduce((total, objective) => {
    if (objective.completion_value <= 0) return total + Number(objective.complete);
    return total + Math.min(1, Math.max(0, (objective.progress ?? 0) / objective.completion_value));
  }, 0) / objectives.length * 100);
  const name = catalystPlug?.name
    ?? recordDefinition.displayProperties?.name?.trim();
  if (!name) return undefined;

  return {
    ...(catalystPlug ? { plug_hash: catalystPlug.hash } : {}),
    record_hash: recordHash,
    name,
    description: recordDefinition.displayProperties?.description ?? catalystPlug?.description,
    icon: catalystPlug?.icon ?? normalizeBungieAssetUrl(recordDefinition.displayProperties?.icon),
    acquired: Boolean(catalystPlug || objectives.some((objective) => objective.complete || (objective.progress ?? 0) > 0)),
    complete,
    progress,
    objectives
  };
}

function isExoticCatalystRecord(definition: DefinitionRecord): boolean {
  const type = definition.recordTypeName?.trim().toLocaleLowerCase() ?? "";
  return type.includes("异域催化")
    || type.includes("exotic catalyst");
}

function normalizeCatalystIdentity(value: string | undefined): string {
  return value?.normalize("NFKC").trim().toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "") ?? "";
}

function normalizeCatalystBaseName(value: string | undefined): string {
  return normalizeCatalystIdentity(value)
    .replace(/exoticcatalyst|catalyst|异域催化剂?|催化剂?|催化/gu, "");
}

function summarizePlugObjectives(
  objectives: DestinyObjectiveProgress[] | undefined,
  objectiveDefinitions: DefinitionComponentData
): AccountItemPlugObjectiveSummary[] {
  return (objectives ?? []).map((objective) => {
    const definition = objectiveDefinitions[String(objective.objectiveHash)] as DefinitionRecord | undefined;
    return {
      objective_hash: objective.objectiveHash,
      progress: objective.progress,
      completion_value: objective.completionValue,
      complete: objective.complete,
      visible: objective.visible,
      progress_description: typeof definition?.progressDescription === "string"
        ? definition.progressDescription
        : undefined
    };
  });
}

function summarizePursuitItem(
  item: DestinyProfileItem,
  definition: DefinitionRecord | undefined,
  instanceId: string | undefined,
  components: DestinyProfileResponse["itemComponents"] | undefined,
  objectiveDefinitions: DefinitionComponentData
): AccountPursuitItemSummary | undefined {
  const bucketHash = definition?.inventory?.bucketTypeHash ?? item.bucketHash;
  const categories = new Set(definition?.itemCategoryHashes ?? []);
  const isQuestBucket = bucketHash === pursuitBucketHash;
  const isPursuit = isQuestBucket
    || categories.has(pursuitCategoryHashes.quest)
    || categories.has(pursuitCategoryHashes.questStep)
    || categories.has(pursuitCategoryHashes.bounties)
    || categories.has(pursuitCategoryHashes.repeatableBounties)
    || categories.has(pursuitCategoryHashes.seasonalArtifact)
    || Boolean(definition?.objectives?.questlineItemHash);
  if (!isPursuit) return undefined;

  const kind = categories.has(pursuitCategoryHashes.bounties)
    || categories.has(pursuitCategoryHashes.repeatableBounties)
    ? "bounty"
    : categories.has(pursuitCategoryHashes.seasonalArtifact)
      ? "seasonal"
      : categories.has(pursuitCategoryHashes.quest)
        || categories.has(pursuitCategoryHashes.questStep)
        || Boolean(definition?.objectives?.questlineItemHash)
        || isQuestBucket
        ? "quest"
        : "unknown";
  const objectives = instanceId
    ? components?.objectives?.data?.[instanceId]?.objectives ?? []
    : [];
  const visibleObjectives = objectives.filter((objective) => objective.visible !== false);
  const complete = visibleObjectives.length > 0 && visibleObjectives.every((objective) => objective.complete);
  // DestinyItemState.Tracked = 2. 64 is not a tracked-item flag and caused
  // real tracked pursuits to be omitted from the attention summary.
  const tracked = typeof item.state === "number" && (item.state & 2) === 2;
  const questItems = definition?.setData?.itemList ?? [];
  const questStep = questItems.length
    ? (() => {
        const index = questItems.findIndex((entry) => entry.itemHash === item.itemHash);
        return index >= 0 ? { step: index + 1, total: questItems.length } : undefined;
      })()
    : undefined;
  const rewards = definition?.value?.itemValue
    ?.filter((reward, index) => reward.itemHash && (item.itemValueVisibility?.[index] ?? true))
    .map((reward) => reward.itemHash as number);
  return {
    kind,
    tracked,
    complete,
    ...(definition?.inventory?.suppressExpirationWhenObjectivesComplete !== undefined
      ? { suppress_expiration_when_complete: definition.inventory.suppressExpirationWhenObjectivesComplete }
      : {}),
    ...(item.expirationDate ? { expiration_date: normalizeProfileTimestamp(item.expirationDate) } : {}),
    ...(questStep ? { quest_step: questStep } : {}),
    ...(rewards?.length ? { reward_hashes: rewards } : {}),
  };
}

function summarizeItemObjectives(
  instanceId: string | undefined,
  components: DestinyProfileResponse["itemComponents"] | undefined,
  objectiveDefinitions: DefinitionComponentData
): AccountItemPlugObjectiveSummary[] | undefined {
  if (!instanceId) {
    return undefined;
  }
  const objectives = components?.objectives?.data?.[instanceId]?.objectives;
  const summaries = summarizePlugObjectives(objectives, objectiveDefinitions);
  return summaries.length ? summaries : undefined;
}

function summarizeCraftables(
  component: DestinyCraftablesComponent | undefined,
  definitions: DefinitionComponentData
): AccountCraftableItemSummary[] {
  return Object.entries(component?.craftables ?? {}).map(([hashValue, craftable]) => {
    const hash = Number(hashValue);
    const definition = definitions[hashValue] as DefinitionRecord | undefined;
    return {
      hash,
      name: definition?.displayProperties?.name?.trim() || `Item ${hash}`,
      icon: normalizeBungieAssetUrl(definition?.displayProperties?.icon),
      visible: craftable.visible !== false,
      failed_requirement_indexes: craftable.failedRequirementIndexes ?? [],
      sockets: (craftable.sockets ?? []).map((socket, socketIndex) => ({
        socket_index: socketIndex,
        plug_set_hash: socket.plugSetHash ?? 0,
        plugs: (socket.plugs ?? [])
          .filter((plug): plug is { plugItemHash: number; failedRequirementIndexes?: number[] } => (
            typeof plug.plugItemHash === "number"
          ))
          .map((plug) => {
            const plugDefinition = definitions[String(plug.plugItemHash)] as DefinitionRecord | undefined;
            return {
              hash: plug.plugItemHash,
              name: plugDefinition?.displayProperties?.name?.trim() || `Plug ${plug.plugItemHash}`,
              icon: normalizeBungieAssetUrl(plugDefinition?.displayProperties?.icon),
              category_identifier: plugDefinition?.plug?.plugCategoryIdentifier,
              failed_requirement_indexes: plug.failedRequirementIndexes ?? []
            };
          })
      }))
    };
  });
}

function isLocked(state: number | undefined): boolean | undefined {
  if (state === undefined) {
    return undefined;
  }

  return (state & 1) === 1;
}

function groupEquipment(items: AccountItemSummary[]): CharacterEquipmentGroup[] {
  return equipmentGroupOrder
    .map((key) => ({
      key,
      label: equipmentGroupLabels[key],
      items: items.filter((item) => item.group_key === key)
    }))
    .filter((group) => group.items.length > 0);
}

function className(classType: number | undefined): string {
  switch (classType) {
    case 0:
      return "泰坦";
    case 1:
      return "猎人";
    case 2:
      return "术士";
    default:
      return "未知职业";
  }
}

function normalizeBungieAssetUrl(path: string | undefined): string | undefined {
  if (!path) {
    return undefined;
  }

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return new URL(path, bungieStaticBaseUrl).toString();
}
