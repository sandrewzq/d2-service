import type { AccountItemSummary } from "@d2-tools/core/account/summary";
import {
  getAccountItemSlotLabel,
  getVaultItemKey,
  type VaultAmmoFilter,
  type VaultArmorSetFilter,
  type VaultClassFilter,
  type VaultDamageFilter,
  type VaultGearTierFilter,
  type VaultGroupFilter,
  type VaultLocationFilter,
  type VaultLockFilter,
  type VaultRarityFilter,
  type VaultSlotFilter
} from "@d2-tools/app/vault";

export type VaultIndexedQuery = {
  group: VaultGroupFilter;
  lock: VaultLockFilter;
  slot: VaultSlotFilter;
  location: VaultLocationFilter;
  ammo: VaultAmmoFilter;
  itemType: string;
  rarity: VaultRarityFilter;
  gearTier: VaultGearTierFilter;
  classType: VaultClassFilter;
  damageType: VaultDamageFilter;
  armorSet: VaultArmorSetFilter;
  frames: string[];
};

export type VaultIndexedFacet = keyof VaultIndexedQuery;

type IndexedRecord = {
  item: AccountItemSummary;
  signature: string;
  facets: Array<readonly [VaultIndexedFacet, string]>;
};

export class VaultQueryIndex {
  private records = new Map<string, IndexedRecord>();
  private orderedKeys: string[] = [];
  private facetSets = new Map<VaultIndexedFacet, Map<string, Set<string>>>();
  private currentCharacterId = "";
  private revision = 0;

  replaceItems(items: readonly AccountItemSummary[], currentCharacterId?: string): number {
    const characterId = currentCharacterId ?? "";
    const nextKeys = items.map((item, index) => internalItemKey(item, index));
    const nextKeySet = new Set(nextKeys);
    let changed = characterId !== this.currentCharacterId
      || !sameKeyOrder(this.orderedKeys, nextKeys);
    for (const key of this.orderedKeys) {
      if (!nextKeySet.has(key)) {
        this.removeRecord(key);
        changed = true;
      }
    }

    items.forEach((item, index) => {
      const key = nextKeys[index]!;
      const signature = indexedItemSignature(item, characterId);
      const current = this.records.get(key);
      if (current?.signature === signature) {
        if (current.item !== item) {
          current.item = item;
          changed = true;
        }
        return;
      }
      if (current) this.removeRecord(key);
      const facets = buildItemFacets(item, characterId);
      this.records.set(key, { item, signature, facets });
      for (const [facet, value] of facets) this.addToFacet(facet, value, key);
      changed = true;
    });
    this.orderedKeys = nextKeys;
    this.currentCharacterId = characterId;
    if (changed) this.revision += 1;
    return this.revision;
  }

  query(
    filter: VaultIndexedQuery,
    options: {
      omit?: ReadonlySet<VaultIndexedFacet>;
      allowedItemKeys?: ReadonlySet<string>;
    } = {}
  ): AccountItemSummary[] {
    const sets: ReadonlySet<string>[] = [];
    const omit = options.omit;
    const addFacet = (facet: VaultIndexedFacet, value: string) => {
      if (omit?.has(facet) || value === "all") return;
      sets.push(this.facetSets.get(facet)?.get(value) ?? emptyKeySet);
    };

    addFacet("group", filter.group);
    addFacet("lock", filter.lock);
    addFacet("slot", filter.slot);
    addFacet("location", filter.location);
    addFacet("ammo", filter.ammo);
    addFacet("itemType", filter.itemType);
    addFacet("rarity", filter.rarity);
    addFacet("gearTier", filter.gearTier);
    addFacet("classType", filter.classType);
    addFacet("damageType", filter.damageType);
    addFacet("armorSet", filter.armorSet);
    if (!omit?.has("frames") && filter.frames.length) {
      sets.push(unionFacetSets(this.facetSets.get("frames"), filter.frames));
    }

    const smallest = sets.length
      ? sets.reduce((current, candidate) => candidate.size < current.size ? candidate : current)
      : null;
    const result: AccountItemSummary[] = [];
    for (const key of this.orderedKeys) {
      if (smallest && !smallest.has(key)) continue;
      if (sets.some((set) => set !== smallest && !set.has(key))) continue;
      const record = this.records.get(key);
      if (!record) continue;
      if (options.allowedItemKeys && !options.allowedItemKeys.has(getVaultItemKey(record.item))) continue;
      result.push(record.item);
    }
    return result;
  }

  private addToFacet(facet: VaultIndexedFacet, value: string, key: string): void {
    const values = this.facetSets.get(facet) ?? new Map<string, Set<string>>();
    const keys = values.get(value) ?? new Set<string>();
    keys.add(key);
    values.set(value, keys);
    this.facetSets.set(facet, values);
  }

  private removeRecord(key: string): void {
    const current = this.records.get(key);
    if (!current) return;
    for (const [facet, value] of current.facets) {
      const values = this.facetSets.get(facet);
      const keys = values?.get(value);
      keys?.delete(key);
      if (keys && !keys.size) values?.delete(value);
      if (values && !values.size) this.facetSets.delete(facet);
    }
    this.records.delete(key);
  }
}

const emptyKeySet = new Set<string>();

function internalItemKey(item: AccountItemSummary, index: number): string {
  return item.instance_id ? `instance:${item.instance_id}` : `entry:${item.hash}:${index}`;
}

function indexedItemSignature(item: AccountItemSummary, currentCharacterId: string): string {
  return [
    item.hash,
    item.group_key,
    item.locked ? 1 : 0,
    getAccountItemSlotLabel(item),
    item.ammo_type ?? "",
    item.item_type ?? "",
    item.tier ?? "",
    item.instance?.gear_tier ?? 0,
    item.class_type ?? "",
    item.instance?.damage_type ?? "",
    item.armor_set?.hash ?? "",
    item.weapon_frame?.key ?? "",
    "source_kind" in item ? item.source_kind ?? "" : "vault",
    "source_character_id" in item ? item.source_character_id ?? "" : "",
    currentCharacterId
  ].join("\u0000");
}

function buildItemFacets(
  item: AccountItemSummary,
  currentCharacterId: string
): Array<readonly [VaultIndexedFacet, string]> {
  return [
    ["group", item.group_key],
    ["lock", item.locked ? "locked" : "unlocked"],
    ["slot", getAccountItemSlotLabel(item)],
    ["location", locationForItem(item, currentCharacterId)],
    ["ammo", item.ammo_type ?? ""],
    ["itemType", item.item_type ?? ""],
    ["rarity", rarityForItem(item)],
    ["gearTier", String(item.instance?.gear_tier ?? 0)],
    ["classType", classForItem(item)],
    ["damageType", damageForItem(item)],
    ["armorSet", String(item.armor_set?.hash ?? "")],
    ["frames", item.weapon_frame?.key ?? ""]
  ];
}

function locationForItem(item: AccountItemSummary, currentCharacterId: string): string {
  const sourceKind = "source_kind" in item ? item.source_kind : "vault";
  const sourceCharacterId = "source_character_id" in item ? item.source_character_id : undefined;
  if (sourceKind === "vault") return "vault";
  if (sourceCharacterId !== currentCharacterId) return sourceCharacterId ? "other_characters" : "";
  if (sourceKind === "equipped") return "current_equipped";
  if (sourceKind === "postmaster") return "current_postmaster";
  return sourceKind === "inventory" ? "current_inventory" : "";
}

function rarityForItem(item: AccountItemSummary): string {
  const tier = item.tier?.trim().toLocaleLowerCase();
  if (tier === "legendary" || tier === "传说") return "legendary";
  if (tier === "exotic" || tier === "异域") return "exotic";
  return "";
}

function classForItem(item: AccountItemSummary): string {
  if (item.class_type === 0) return "titan";
  if (item.class_type === 1) return "hunter";
  if (item.class_type === 2) return "warlock";
  return "";
}

function damageForItem(item: AccountItemSummary): string {
  if (item.instance?.damage_type === 1) return "kinetic";
  if (item.instance?.damage_type === 2) return "arc";
  if (item.instance?.damage_type === 3) return "solar";
  if (item.instance?.damage_type === 4) return "void";
  if (item.instance?.damage_type === 6) return "stasis";
  if (item.instance?.damage_type === 7) return "strand";
  return "";
}

function unionFacetSets(
  values: ReadonlyMap<string, Set<string>> | undefined,
  selectedValues: readonly string[]
): Set<string> {
  const union = new Set<string>();
  for (const value of selectedValues) {
    for (const key of values?.get(value) ?? []) union.add(key);
  }
  return union;
}

function sameKeyOrder(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((key, index) => key === right[index]);
}
