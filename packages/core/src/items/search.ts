import type { DefinitionComponentData, DefinitionRecord } from "../manifest/definitions.js";
import { expandAliasQuery, type ItemAliases } from "./aliases.js";
import { ammoTypeKey, classifyBucket, type AmmoTypeKey, type EquipmentGroupKey } from "./classification.js";
import {
  summarizeItemArmorAbilityGroups,
  summarizeItemIntrinsicTraits,
  type ItemArmorAbilityGroupSummary,
  type ItemIntrinsicTraitSummary
} from "./intrinsics.js";
import { summarizeItemPerks, type ItemPerkGroup } from "./perks.js";
import { summarizeItemSource, type ItemSourceSummary } from "./source.js";
import {
  summarizeItemDefinitionVersion,
  summarizeItemRelease,
  type ItemDefinitionVersionSummary,
  type ItemReleaseSummary
} from "./release.js";
import { summarizeEquipableItemSet, type EquipableItemSetSummary } from "./equipableItemSet.js";
import { summarizeWeaponFrame, type WeaponFrameSummary } from "./weaponFrames.js";
import { summarizeWeaponBreakerType, type WeaponBreakerTypeSummary } from "./breakerTypes.js";
import { summarizeItemDamageType, type DamageTypeSummary } from "./damageTypes.js";

export type ItemSearchOptions = {
  limit?: number;
  plugSetDefinitions?: DefinitionComponentData;
  statDefinitions?: DefinitionComponentData;
  collectibleDefinitions?: DefinitionComponentData;
  breakerTypeDefinitions?: DefinitionComponentData;
  damageTypeDefinitions?: DefinitionComponentData;
  seasonDefinitions?: DefinitionComponentData;
  equipableItemSetDefinitions?: DefinitionComponentData;
  sandboxPerkDefinitions?: DefinitionComponentData;
  aliases?: ItemAliases;
  includeAllPerks?: boolean;
};

export type ItemDefinitionStat = {
  hash: number;
  name: string;
  value: number;
  display_maximum: number;
};

export type ItemOriginTrait = {
  hash: number;
  name: string;
};

export type ItemSearchResult = {
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
  intrinsic_traits?: ItemIntrinsicTraitSummary[];
  armor_ability_groups?: ItemArmorAbilityGroupSummary[];
  ammo_type?: AmmoTypeKey;
  bucket_hash?: number;
  bucket_name?: string;
  group_key: EquipmentGroupKey;
  weapon_frame?: WeaponFrameSummary;
  breaker_type?: WeaponBreakerTypeSummary;
  source: ItemSourceSummary;
  release?: ItemReleaseSummary;
  definition_version?: ItemDefinitionVersionSummary;
  armor_set?: EquipableItemSetSummary;
  definition_stats?: ItemDefinitionStat[];
  perks?: ItemPerkGroup[];
};

const bungieStaticBaseUrl = "https://www.bungie.net";
const nonEquipmentItemTypes = new Set([
  0, // None / engram-like inventory entry
  19, // Mod
  20, // Dummy
  30 // Pattern
]);

export function searchItemDefinitions(
  definitions: DefinitionComponentData,
  query: string,
  options: ItemSearchOptions = {}
): ItemSearchResult[] {
  const terms = options.aliases ? expandAliasQuery(query, options.aliases) : [query.trim()];
  const normalizedTerms = terms.map((term) => term.toLocaleLowerCase()).filter(Boolean);
  if (!normalizedTerms.length) {
    return [];
  }

  const limit = options.limit ?? 20;
  const matches: DefinitionRecord[] = [];

  for (const definition of Object.values(definitions)) {
    const name = definition.displayProperties?.name?.trim();
    if (!name || !normalizedTerms.some((term) => name.toLocaleLowerCase().includes(term))) {
      continue;
    }
    if (!isSearchableEquipmentDefinition(definition)) {
      continue;
    }

    matches.push(definition);
  }

  return selectCanonicalEquipmentDefinitions(matches)
    .slice(0, limit)
    .map((definition) => toItemSearchResult(definition, definitions, options));
}

export function getItemSearchResultByHash(
  definitions: DefinitionComponentData,
  hash: number,
  options: ItemSearchOptions = {}
): ItemSearchResult | null {
  const definition = definitions[String(hash)];
  if (!definition) {
    return null;
  }

  return toItemSearchResult(definition, definitions, options);
}

function isSearchableEquipmentDefinition(definition: DefinitionRecord): boolean {
  return typeof definition.itemType !== "number" || !nonEquipmentItemTypes.has(definition.itemType);
}

export function selectCanonicalEquipmentDefinitions(definitions: DefinitionRecord[]): DefinitionRecord[] {
  const selected = new Map<string, DefinitionRecord>();

  for (const definition of definitions) {
    const key = equipmentDefinitionIdentity(definition);
    const current = selected.get(key);
    if (!current || equipmentDefinitionScore(definition) > equipmentDefinitionScore(current)) {
      selected.set(key, definition);
    }
  }

  return [...selected.values()];
}

function equipmentDefinitionIdentity(definition: DefinitionRecord): string {
  const weaponPatternHash = Number(definition.translationBlock?.weaponPatternHash ?? 0);
  const releaseTraits = (definition.traitIds ?? [])
    .filter((traitId) => traitId.startsWith("releases."))
    .sort()
    .join(",");
  if (weaponPatternHash > 0) {
    return [
      "weapon-pattern",
      weaponPatternHash,
      definition.isAdept ? "adept" : "standard",
      definition.classType ?? "unknown",
      definition.inventory?.bucketTypeHash ?? "unknown",
      releaseTraits
    ].join("|");
  }

  const name = definition.displayProperties?.name?.trim().toLocaleLowerCase() ?? "";
  const icon = definition.displayProperties?.icon?.trim() ?? "";
  if (!name || !icon) {
    return `hash:${definition.hash ?? "unknown"}`;
  }

  return [
    name,
    icon,
    definition.itemType ?? "unknown",
    definition.classType ?? "unknown",
    definition.inventory?.bucketTypeHash ?? "unknown",
    releaseTraits
  ].join("|");
}

function equipmentDefinitionScore(definition: DefinitionRecord): number {
  return (definition.collectibleHash ? 1000 : 0)
    + (definition.sourceData?.sourceString?.trim() ? 100 : 0)
    + (definition.index ?? 0) / 1_000_000;
}

function toItemSearchResult(
  definition: DefinitionRecord,
  definitions: DefinitionComponentData,
  options: ItemSearchOptions
): ItemSearchResult {
  const inventoryBucketHash = definition.inventory?.bucketTypeHash;
  const equipmentSlotHash = definition.equippingBlock?.equipmentSlotTypeHash;
  const bucketHash = classifyBucket(inventoryBucketHash)
    ? inventoryBucketHash
    : equipmentSlotHash ?? inventoryBucketHash;
  const bucket = classifyBucket(bucketHash);
  const result: ItemSearchResult = {
    hash: Number(definition.hash),
    name: definition.displayProperties?.name ?? "",
    description: definition.displayProperties?.description ?? "",
    icon: normalizeBungieAssetUrl(definition.displayProperties?.icon),
    item_type: definition.itemTypeDisplayName,
    group_key: bucket?.group ?? "other",
    tier: definition.inventory?.tierTypeName,
    source: summarizeItemSource(definition, {
      itemDefinitions: definitions,
      collectibleDefinitions: options.collectibleDefinitions
    })
  };
  if (typeof definition.classType === "number") {
    result.class_type = definition.classType;
  }
  const className = classTypeLabel(definition.classType);
  if (className) {
    result.class_name = className;
  }
  const ammoType = ammoTypeKey(definition.equippingBlock?.ammoType);
  if (ammoType) {
    result.ammo_type = ammoType;
  }
  const damageType = damageTypeLabel(definition.equippingBlock?.damageType ?? definition.defaultDamageType);
  if (damageType) {
    result.damage_type = damageType;
  }
  const damageTypeSummary = summarizeItemDamageType(definition, options.damageTypeDefinitions);
  if (damageTypeSummary) {
    result.damage_type_summary = damageTypeSummary;
  }
  if (definition.isAdept) {
    result.is_adept = true;
  }
  const originTraits = summarizeOriginTraits(definition, definitions);
  if (originTraits.length > 0) {
    result.origin_traits = originTraits;
  }
  if (bucketHash) {
    result.bucket_hash = bucketHash;
  }
  if (bucket?.name) {
    result.bucket_name = bucket.name;
  }
  const weaponFrame = summarizeWeaponFrame(definition, definitions, {
    plugSetDefinitions: options.plugSetDefinitions
  });
  if (weaponFrame) {
    result.weapon_frame = weaponFrame;
  }
  const breakerType = summarizeWeaponBreakerType(definition, definitions, {
    plugSetDefinitions: options.plugSetDefinitions,
    breakerTypeDefinitions: options.breakerTypeDefinitions
  });
  if (breakerType) {
    result.breaker_type = breakerType;
  }
  const release = summarizeItemRelease(definition, options.seasonDefinitions);
  if (release) {
    result.release = release;
  }
  const definitionVersion = summarizeItemDefinitionVersion(definition);
  if (definitionVersion) {
    result.definition_version = definitionVersion;
  }

  const definitionStats = summarizeDefinitionStats(definition, options.statDefinitions);
  if (definitionStats.length > 0) {
    result.definition_stats = definitionStats;
  }

  if (bucket?.group === "armor") {
    const armorSet = summarizeEquipableItemSet(
      definition,
      options.equipableItemSetDefinitions,
      options.sandboxPerkDefinitions
    );
    if (armorSet) {
      result.armor_set = armorSet;
    }
    const intrinsicTraits = summarizeItemIntrinsicTraits(definition, definitions);
    if (intrinsicTraits.length > 0) {
      result.intrinsic_traits = intrinsicTraits;
    }
    const armorAbilityGroups = summarizeItemArmorAbilityGroups(
      definition,
      definitions,
      options.plugSetDefinitions
    );
    if (armorAbilityGroups.length > 0) {
      result.armor_ability_groups = armorAbilityGroups;
    }
  }

  if (bucket?.group === "weapons") {
    const perks = summarizeItemPerks(definition, definitions, {
      plugSetDefinitions: options.plugSetDefinitions,
      maxPlugsPerSocket: options.includeAllPerks ? null : 6
    });
    if (perks.length > 0) {
      result.perks = perks;
    }
  }

  return result;
}

function summarizeDefinitionStats(
  definition: DefinitionRecord,
  statDefinitions: DefinitionComponentData | undefined
): ItemDefinitionStat[] {
  if (!statDefinitions) {
    return [];
  }

  return Object.entries(definition.stats?.stats ?? {})
    .map(([statKey, stat]) => {
      const hash = Number(stat.statHash ?? statKey);
      const value = Number(stat.value ?? 0);
      const statDefinition = statDefinitions[String(hash)];
      const name = statDefinition?.displayProperties?.name?.trim();
      if (!Number.isFinite(hash) || !Number.isFinite(value) || value <= 0 || !name) {
        return null;
      }

      const displayMaximum = Number(stat.displayMaximum ?? stat.maximum ?? 100);
      return {
        hash,
        name,
        value,
        display_maximum: Number.isFinite(displayMaximum) && displayMaximum > 0 ? displayMaximum : 100,
        order: statDefinition?.index ?? Number.MAX_SAFE_INTEGER
      };
    })
    .filter((stat): stat is ItemDefinitionStat & { order: number } => Boolean(stat))
    .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name, "zh-Hans-CN"))
    .map(({ order: _order, ...stat }) => stat);
}

function summarizeOriginTraits(
  definition: DefinitionRecord,
  itemDefinitions: DefinitionComponentData
): ItemOriginTrait[] {
  const originTraits = (definition.sockets?.socketEntries ?? [])
    .flatMap((entry) => typeof entry.singleInitialItemHash === "number" ? [entry.singleInitialItemHash] : [])
    .map((hash) => ({ hash, definition: itemDefinitions[String(hash)] }))
    .filter((entry) => entry.definition?.plug?.plugCategoryIdentifier === "origins")
    .map(({ hash, definition }) => ({ hash, name: definition?.displayProperties?.name?.trim() ?? "" }))
    .filter((trait): trait is ItemOriginTrait => Boolean(trait.name));

  return [...new Map(originTraits.map((trait) => [trait.hash, trait])).values()];
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

function damageTypeLabel(damageType: number | undefined): string | undefined {
  const labels: Record<number, string> = {
    1: "动能伤害",
    2: "电弧伤害",
    3: "烈日伤害",
    4: "虚空伤害",
    6: "冰影伤害",
    7: "缚丝伤害"
  };
  return damageType ? labels[damageType] : undefined;
}

function classTypeLabel(classType: number | undefined): string | undefined {
  const labels: Record<number, string> = {
    0: "泰坦",
    1: "猎人",
    2: "术士"
  };
  return typeof classType === "number" ? labels[classType] : undefined;
}
