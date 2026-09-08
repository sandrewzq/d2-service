import type {
  WeaponIdentityRelation,
  WeaponVariantKind
} from "@d2-tools/core/community-perks";
import type { DefinitionRecord } from "@d2-tools/core/manifest/definitions";

const officialVariantSuffixPattern = /\s*[（(]\s*(adept|专家|timelost|失时|harrowed|痛苦)\s*[）)]\s*$/iu;
const anyTrailingParentheticalPattern = /\s*[（(][^（）()]+[）)]\s*$/u;

export function buildWeaponIdentityRelations(
  definitions: Iterable<DefinitionRecord>
): WeaponIdentityRelation[] {
  const candidates = [...definitions].flatMap((definition) => {
    const itemHash = unsignedHash(definition.hash);
    if (itemHash === null || !isWeaponDefinition(definition)) return [];
    const name = definition.displayProperties?.name?.trim() ?? "";
    if (!name) return [];
    const familyKey = weaponFamilyKey(definition, name);
    const releaseTraits = weaponReleaseTraits(definition);
    const releaseGroupKey = releaseTraits.length
      ? `${familyKey}|${releaseTraits.join(",")}`
      : `${familyKey}|hash:${itemHash}`;
    const variantTags = weaponVariantTags(definition, name);
    return [{
      definition,
      itemHash,
      familyKey,
      releaseGroupKey,
      releaseTraits,
      variantTags
    }];
  });
  const canonicalByRelease = new Map<string, typeof candidates[number]>();
  for (const candidate of candidates) {
    const current = canonicalByRelease.get(candidate.releaseGroupKey);
    if (!current || weaponIdentityRank(candidate) > weaponIdentityRank(current)) {
      canonicalByRelease.set(candidate.releaseGroupKey, candidate);
    }
  }
  return candidates
    .map((candidate): WeaponIdentityRelation => ({
      item_hash: candidate.itemHash,
      family_key: candidate.familyKey,
      release_group_key: candidate.releaseGroupKey,
      variant_kind: primaryVariantKind(candidate.variantTags),
      variant_tags: candidate.variantTags,
      canonical_item_hash: canonicalByRelease.get(candidate.releaseGroupKey)?.itemHash ?? candidate.itemHash,
      ...(candidate.releaseTraits.length
        ? { release_label: candidate.releaseTraits.join(" / ") }
        : {}),
      relation_evidence: candidate.releaseTraits.length ? "release_trait" : "isolated"
    }))
    .sort((left, right) => left.item_hash - right.item_hash);
}

export function relatedWeaponIdentityRelations(
  relations: readonly WeaponIdentityRelation[],
  itemHashes: Iterable<number>
): WeaponIdentityRelation[] {
  const requested = new Set([...itemHashes].map((hash) => hash >>> 0));
  const releaseGroups = new Set(
    relations
      .filter((relation) => requested.has(relation.item_hash >>> 0))
      .map((relation) => relation.release_group_key)
  );
  return relations.filter((relation) => (
    requested.has(relation.item_hash >>> 0)
    || releaseGroups.has(relation.release_group_key)
  ));
}

function weaponFamilyKey(definition: DefinitionRecord, name: string): string {
  const baseName = normalizeIdentityText(stripOfficialVariantSuffix(name));
  const weaponTrait = (definition.traitIds ?? [])
    .find((traitId) => traitId.startsWith("item.weapon.")) ?? "";
  const itemType = typeof definition.itemType === "number" ? definition.itemType : "";
  const bucketHash = typeof definition.inventory?.bucketTypeHash === "number"
    ? definition.inventory.bucketTypeHash >>> 0
    : "";
  return [baseName, weaponTrait, itemType, bucketHash].join("|");
}

function weaponReleaseTraits(definition: DefinitionRecord): string[] {
  return [...new Set((definition.traitIds ?? [])
    .filter((traitId) => traitId.startsWith("releases.")))]
    .sort();
}

function weaponVariantTags(definition: DefinitionRecord, name: string): WeaponVariantKind[] {
  const tags = new Set<WeaponVariantKind>();
  const suffix = name.match(officialVariantSuffixPattern)?.[1]?.toLocaleLowerCase() ?? "";
  if (suffix === "timelost" || suffix === "失时") tags.add("timelost");
  else if (suffix === "harrowed" || suffix === "痛苦") tags.add("harrowed");
  else if (suffix === "adept" || suffix === "专家") tags.add("adept");
  if (definition.isAdept === true) tags.add("adept");
  if (definition.isHolofoil === true) tags.add("holofoil");
  if (tags.size === 0 && anyTrailingParentheticalPattern.test(name)) tags.add("named_variant");
  if (tags.size === 0) tags.add("standard");
  return [...tags];
}

function primaryVariantKind(tags: readonly WeaponVariantKind[]): WeaponVariantKind {
  for (const kind of ["timelost", "harrowed", "holofoil", "adept", "named_variant"] as const) {
    if (tags.includes(kind)) return kind;
  }
  return "standard";
}

function weaponIdentityRank(candidate: {
  definition: DefinitionRecord;
  itemHash: number;
  variantTags: WeaponVariantKind[];
}): number {
  const standardBonus = candidate.variantTags.length === 1 && candidate.variantTags[0] === "standard"
    ? 10_000_000
    : 0;
  return standardBonus
    + (candidate.definition.collectibleHash ? 1_000_000 : 0)
    + Number(candidate.definition.index ?? 0)
    + candidate.itemHash / 0x1_0000_0000;
}

function isWeaponDefinition(definition: DefinitionRecord): boolean {
  // DestinyItemType.Weapon。带 item.weapon.* trait 的记录还包括图鉴、铸造模板等
  // 非实例定义，不能把它们混进玩家可拥有武器的版本关系。
  return definition.itemType === 3;
}

function stripOfficialVariantSuffix(value: string): string {
  return value.replace(officialVariantSuffixPattern, "").trim();
}

function normalizeIdentityText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{Z}\s]+/gu, "");
}

function unsignedHash(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value >>> 0;
}
