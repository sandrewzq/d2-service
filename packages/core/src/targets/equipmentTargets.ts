import type { AccountItemSummary } from "../account/summary.js";
import type { LocalTargetRules } from "../analysis/targets.js";
import { resolveDimWishlistRuleMetadata, type DimWishlist } from "../analysis/wishlistImport.js";
import type { EvidenceRef } from "../evidence/reference.js";
import type { ArmorSlot } from "../armor/model.js";
import { createArmor30Ruleset } from "../armor/ruleset.js";
import type { ArmorStatKey } from "../loadouts/analysis.js";

export type EquipmentTargetActionPolicy = "notify_only";

export type EquipmentTargetSourceKind =
  | "dim_wishlist"
  | "user"
  | "guide_confirmation"
  | "armor_planner_gap"
  | "legacy_local_rules";

export type EquipmentTargetSource = {
  kind: EquipmentTargetSourceKind;
  label: string;
  source_id?: string;
  evidence_refs: EvidenceRef[];
};

export type WeaponTargetCandidate = {
  item_hash: number;
  item_name: string;
  release_label?: string;
};

export type WeaponTargetResolution =
  | {
      status: "verified";
      item_hash: number;
      item_name: string;
      manifest_version?: string;
    }
  | {
      status: "unresolved";
      query: string;
      requested_item_hash?: number;
      checked_manifest_version?: string;
      reason: string;
    }
  | {
      status: "ambiguous";
      query: string;
      candidates: WeaponTargetCandidate[];
      reason: string;
    };

export type WeaponTargetPerkRequirement = {
  perk_hash: number;
  perk_name: string;
};

type EquipmentTargetBase = {
  id: string;
  name: string;
  enabled: boolean;
  source: EquipmentTargetSource;
  created_at: string;
  updated_at: string;
};

export type WeaponTarget = EquipmentTargetBase & {
  kind: "weapon";
  mode: "pve" | "pvp" | "general";
  weapon: WeaponTargetResolution;
  perk_requirements: WeaponTargetPerkRequirement[];
  note?: string;
};

export type ArmorAcquisitionTarget = EquipmentTargetBase & {
  kind: "armor_acquisition";
  class_type?: number;
  bucket_hash?: number;
  bucket_name?: string;
  stat_basis: "current" | "base";
  stat_requirements: Partial<Record<ArmorStatKey, number>>;
  minimum_total?: number;
  planner_context?: {
    result_id: string;
    candidate_id: string;
    slot: ArmorSlot;
    archetype_id: string;
    archetype_name: string;
    tertiary_stat: ArmorStatKey;
    tuning_label: string;
    set_hash?: number;
    set_name?: string;
    exotic: boolean;
    exotic_class_item: boolean;
    target_masterwork_tier: number;
  };
  note?: string;
};

export type EquipmentTarget = WeaponTarget | ArmorAcquisitionTarget;

export type EquipmentTargetStore = {
  version: 1;
  action_policy: EquipmentTargetActionPolicy;
  created_at: string;
  updated_at: string;
  targets: EquipmentTarget[];
  migration?: {
    legacy_local_rules_imported_at?: string;
    dim_wishlist_imported_at?: string;
  };
};

export type WeaponTargetManifestRecord = {
  item_hash: number;
  item_name: string;
  group_key: AccountItemSummary["group_key"];
  perk_definitions: Array<{ perk_hash: number; perk_name: string }>;
  manifest_version?: string;
};

export type EquipmentTargetMatch = {
  target_id: string;
  target_name: string;
  target_kind: EquipmentTarget["kind"];
  source: EquipmentTargetSource;
  reason: string;
  evidence_refs: EvidenceRef[];
};

export type EquipmentTargetMatchResult = {
  matched: boolean;
  labels: string[];
  reasons: string[];
  matches: EquipmentTargetMatch[];
  evidence_refs: EvidenceRef[];
  disclaimer: string;
};

export type BuildMigratedEquipmentTargetsInput = {
  legacy_rules?: LocalTargetRules | null;
  wishlist?: DimWishlist | null;
  resolve_weapon?: (itemHash: number) => Promise<WeaponTargetManifestRecord | null>;
  now?: Date;
};

export type CreateUserWeaponTargetInput = {
  id?: string;
  name: string;
  item_hash: number;
  item_name: string;
  mode?: WeaponTarget["mode"];
  perk_requirements: WeaponTargetPerkRequirement[];
  note?: string;
  now?: Date;
};

export type CreateUserArmorAcquisitionTargetInput = {
  id?: string;
  name: string;
  class_type?: number;
  bucket_hash?: number;
  bucket_name?: string;
  stat_requirements: Partial<Record<ArmorStatKey, number>>;
  minimum_total?: number;
  note?: string;
  now?: Date;
};

export type CreateArmorPlannerGapTargetInput = {
  id: string;
  name: string;
  class_type?: number;
  bucket_hash?: number;
  bucket_name?: string;
  stat_requirements: Partial<Record<ArmorStatKey, number>>;
  minimum_total?: number;
  result_id: string;
  candidate_id: string;
  slot: ArmorSlot;
  archetype_id: string;
  archetype_name: string;
  tertiary_stat: ArmorStatKey;
  tuning_label: string;
  set_hash?: number;
  set_name?: string;
  exotic: boolean;
  exotic_class_item: boolean;
  target_masterwork_tier: number;
  note?: string;
  now?: Date;
};

const armorStatLabels: Record<ArmorStatKey, string> = {
  health: "生命值",
  melee: "近战",
  grenade: "手雷",
  super: "超能",
  class: "职业",
  weapon: "武器"
};

const armorStatKeys = Object.keys(armorStatLabels) as ArmorStatKey[];

export function createEmptyEquipmentTargetStore(now = new Date()): EquipmentTargetStore {
  const timestamp = now.toISOString();
  return {
    version: 1,
    action_policy: "notify_only",
    created_at: timestamp,
    updated_at: timestamp,
    targets: []
  };
}

export function createUserWeaponTarget(input: CreateUserWeaponTargetInput): WeaponTarget {
  const timestamp = (input.now ?? new Date()).toISOString();
  const id = input.id?.trim() || stableTargetId("user-weapon", `${input.item_hash}-${input.name}-${timestamp}`);
  return {
    id,
    kind: "weapon",
    name: input.name.trim() || input.item_name.trim() || `武器 ${input.item_hash}`,
    enabled: true,
    mode: input.mode ?? "general",
    weapon: {
      status: "unresolved",
      query: input.item_name.trim() || String(input.item_hash),
      requested_item_hash: input.item_hash,
      reason: "等待 Manifest 校验武器版本与 Perk 归属。"
    },
    perk_requirements: uniquePerkRequirements(input.perk_requirements),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    source: buildSource("user", "用户手动创建", id, id, timestamp),
    created_at: timestamp,
    updated_at: timestamp
  };
}

export function createUserArmorAcquisitionTarget(
  input: CreateUserArmorAcquisitionTargetInput
): ArmorAcquisitionTarget {
  const timestamp = (input.now ?? new Date()).toISOString();
  const id = input.id?.trim() || stableTargetId("user-armor", `${input.name}-${timestamp}`);
  return {
    id,
    kind: "armor_acquisition",
    name: input.name.trim() || "护甲待刷目标",
    enabled: true,
    ...(input.class_type !== undefined ? { class_type: input.class_type } : {}),
    ...(input.bucket_hash !== undefined ? { bucket_hash: input.bucket_hash } : {}),
    ...(input.bucket_name?.trim() ? { bucket_name: input.bucket_name.trim() } : {}),
    stat_basis: "current",
    stat_requirements: input.stat_requirements,
    ...(input.minimum_total !== undefined ? { minimum_total: input.minimum_total } : {}),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    source: buildSource("user", "用户手动创建", id, id, timestamp),
    created_at: timestamp,
    updated_at: timestamp
  };
}

export function createArmorPlannerGapTarget(
  input: CreateArmorPlannerGapTargetInput
): ArmorAcquisitionTarget {
  const timestamp = (input.now ?? new Date()).toISOString();
  const slotRule = createArmor30Ruleset().slots.find((rule) => rule.slot === input.slot);
  const bucketHash = input.bucket_hash ?? slotRule?.bucket_hashes[0];
  const bucketName = input.bucket_name?.trim() || slotRule?.aliases[0] || input.slot;
  return {
    id: input.id.trim(),
    kind: "armor_acquisition",
    name: input.name.trim() || `${bucketName}待刷目标`,
    enabled: true,
    ...(input.class_type !== undefined ? { class_type: input.class_type } : {}),
    ...(bucketHash !== undefined ? { bucket_hash: bucketHash } : {}),
    bucket_name: bucketName,
    stat_basis: "base",
    stat_requirements: input.stat_requirements,
    ...(input.minimum_total !== undefined ? { minimum_total: input.minimum_total } : {}),
    planner_context: {
      result_id: input.result_id,
      candidate_id: input.candidate_id,
      slot: input.slot,
      archetype_id: input.archetype_id,
      archetype_name: input.archetype_name,
      tertiary_stat: input.tertiary_stat,
      tuning_label: input.tuning_label,
      ...(input.set_hash !== undefined ? { set_hash: input.set_hash } : {}),
      ...(input.set_name?.trim() ? { set_name: input.set_name.trim() } : {}),
      exotic: input.exotic,
      exotic_class_item: input.exotic_class_item,
      target_masterwork_tier: input.target_masterwork_tier
    },
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    source: {
      kind: "armor_planner_gap",
      label: "Armor Planner 待刷缺口",
      source_id: `${input.result_id}:${input.candidate_id}:${input.slot}`,
      evidence_refs: [{
        evidence_id: `equipment-target:${input.id}:result`,
        kind: "domain_result",
        label: `${bucketName} / Armor Planner 候选缺口`,
        observed_at: timestamp,
        entity: { type: "armor_candidate", id: input.candidate_id },
        result_id: input.result_id,
        open_target: { kind: "result", id: input.result_id, secondary_id: input.candidate_id }
      }]
    },
    created_at: timestamp,
    updated_at: timestamp
  };
}

export function upsertEquipmentTarget(
  store: EquipmentTargetStore,
  target: EquipmentTarget,
  now = new Date()
): EquipmentTargetStore {
  return normalizeEquipmentTargetStore({
    ...store,
    updated_at: now.toISOString(),
    targets: [...store.targets.filter((entry) => entry.id !== target.id), target]
  }, now);
}

export function removeEquipmentTarget(
  store: EquipmentTargetStore,
  targetId: string,
  now = new Date()
): EquipmentTargetStore {
  return normalizeEquipmentTargetStore({
    ...store,
    updated_at: now.toISOString(),
    targets: store.targets.filter((target) => target.id !== targetId)
  }, now);
}

export async function buildMigratedEquipmentTargetStore(
  input: BuildMigratedEquipmentTargetsInput
): Promise<EquipmentTargetStore> {
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  const manifestRecords = await resolveManifestRecords(input);
  const targets: EquipmentTarget[] = [
    ...buildLegacyArmorTargets(input.legacy_rules, timestamp),
    ...buildLegacyWeaponTargets(input.legacy_rules, manifestRecords, timestamp),
    ...buildDimWeaponTargets(input.wishlist, manifestRecords, timestamp)
  ];

  return normalizeEquipmentTargetStore({
    version: 1,
    action_policy: "notify_only",
    created_at: timestamp,
    updated_at: timestamp,
    targets,
    migration: {
      ...(input.legacy_rules?.armor.length || input.legacy_rules?.weapons.length
        ? { legacy_local_rules_imported_at: timestamp }
        : {}),
      ...(input.wishlist?.rules.length ? { dim_wishlist_imported_at: timestamp } : {})
    }
  }, now);
}

export function normalizeEquipmentTargetStore(
  input: unknown,
  now = new Date()
): EquipmentTargetStore {
  const timestamp = now.toISOString();
  if (!isRecord(input)) return createEmptyEquipmentTargetStore(now);
  const targets = (Array.isArray(input.targets) ? input.targets : [])
    .map((target) => normalizeEquipmentTarget(target, timestamp))
    .filter((target): target is EquipmentTarget => Boolean(target));
  const createdAt = normalizeTimestamp(input.created_at, timestamp);
  const updatedAt = normalizeTimestamp(input.updated_at, createdAt);
  const migration = isRecord(input.migration)
    ? {
        ...(normalizeOptionalTimestamp(input.migration.legacy_local_rules_imported_at)
          ? { legacy_local_rules_imported_at: normalizeOptionalTimestamp(input.migration.legacy_local_rules_imported_at) }
          : {}),
        ...(normalizeOptionalTimestamp(input.migration.dim_wishlist_imported_at)
          ? { dim_wishlist_imported_at: normalizeOptionalTimestamp(input.migration.dim_wishlist_imported_at) }
          : {})
      }
    : undefined;

  return {
    version: 1,
    action_policy: "notify_only",
    created_at: createdAt,
    updated_at: updatedAt,
    targets: uniqueTargets(targets),
    ...(migration && Object.keys(migration).length ? { migration } : {})
  };
}

export function evaluateEquipmentTargets(
  item: AccountItemSummary,
  store: EquipmentTargetStore | null | undefined
): EquipmentTargetMatchResult {
  const matches = (store?.targets ?? [])
    .filter((target) => target.enabled)
    .flatMap((target) => {
      const reason = target.kind === "weapon"
        ? matchWeaponTarget(item, target)
        : matchArmorTarget(item, target);
      if (!reason) return [];
      return [{
        target_id: target.id,
        target_name: target.name,
        target_kind: target.kind,
        source: target.source,
        reason,
        evidence_refs: target.source.evidence_refs
      } satisfies EquipmentTargetMatch];
    });
  const evidenceRefs = uniqueEvidenceRefs(matches.flatMap((match) => match.evidence_refs));

  return {
    matched: matches.length > 0,
    labels: matches.map((match) => match.target_name),
    reasons: matches.map((match) => match.reason),
    matches,
    evidence_refs: evidenceRefs,
    disclaimer: "装备目标只提供命中证据，不会自动修改本地标记、锁定状态或整理决定。"
  };
}

export function mergeImportedEquipmentTargets(
  current: EquipmentTargetStore,
  imported: EquipmentTargetStore,
  sourceKinds: EquipmentTargetSourceKind[],
  now = new Date()
): EquipmentTargetStore {
  const replaceKinds = new Set(sourceKinds);
  return normalizeEquipmentTargetStore({
    ...current,
    updated_at: now.toISOString(),
    targets: [
      ...current.targets.filter((target) => !replaceKinds.has(target.source.kind)),
      ...imported.targets.filter((target) => replaceKinds.has(target.source.kind))
    ],
    migration: {
      ...current.migration,
      ...(replaceKinds.has("legacy_local_rules")
        ? { legacy_local_rules_imported_at: imported.migration?.legacy_local_rules_imported_at ?? now.toISOString() }
        : {}),
      ...(replaceKinds.has("dim_wishlist")
        ? { dim_wishlist_imported_at: imported.migration?.dim_wishlist_imported_at ?? now.toISOString() }
        : {})
    }
  }, now);
}

function buildLegacyArmorTargets(
  rules: LocalTargetRules | null | undefined,
  timestamp: string
): ArmorAcquisitionTarget[] {
  return (rules?.armor ?? []).map((rule) => {
    const statRequirements = Object.fromEntries(
      rule.conditions.map((condition) => [condition.stat, condition.min])
    ) as Partial<Record<ArmorStatKey, number>>;
    const id = stableTargetId("legacy-armor", rule.id || rule.name);
    return {
      id,
      kind: "armor_acquisition",
      name: rule.name,
      enabled: true,
      stat_basis: "current",
      stat_requirements: statRequirements,
      source: buildSource("legacy_local_rules", "旧本地目标规则", rule.id, id, timestamp),
      created_at: timestamp,
      updated_at: timestamp
    };
  });
}

function buildLegacyWeaponTargets(
  rules: LocalTargetRules | null | undefined,
  records: Map<number, WeaponTargetManifestRecord | null>,
  timestamp: string
): WeaponTarget[] {
  return (rules?.weapons ?? []).map((rule) => {
    const id = stableTargetId("legacy-weapon", rule.id || `${rule.item_hash}-${rule.name}`);
    const record = records.get(rule.item_hash) ?? null;
    const validated = validateManifestWeapon(record, rule.item_hash, rule.item_name, rule.conditions);
    return {
      id,
      kind: "weapon",
      name: rule.name,
      enabled: true,
      mode: "general",
      weapon: validated.resolution,
      perk_requirements: validated.perks,
      source: withManifestEvidence(
        buildSource("legacy_local_rules", "旧本地目标规则", rule.id, id, timestamp),
        validated.resolution,
        id,
        timestamp
      ),
      created_at: timestamp,
      updated_at: timestamp
    };
  });
}

function buildDimWeaponTargets(
  wishlist: DimWishlist | null | undefined,
  records: Map<number, WeaponTargetManifestRecord | null>,
  timestamp: string
): WeaponTarget[] {
  return (wishlist?.rules ?? []).map((rule, index) => {
    const metadata = wishlist ? resolveDimWishlistRuleMetadata(wishlist, rule) : { note: "" };
    const sourceId = `${wishlist?.title ?? "DIM Wishlist"}:${index}`;
    const id = stableTargetId("dim-weapon", `${rule.item_hash}-${rule.perk_hashes.join("-")}-${rule.mode}-${index}`);
    const record = records.get(rule.item_hash) ?? null;
    const validated = validateManifestWeapon(
      record,
      rule.item_hash,
      `Item ${rule.item_hash}`,
      rule.perk_hashes.map((perkHash) => ({ perk_hash: perkHash, perk_name: `Perk ${perkHash}` }))
    );
    const itemName = validated.resolution.status === "verified"
      ? validated.resolution.item_name
      : `武器 ${rule.item_hash}`;
    return {
      id,
      kind: "weapon",
      name: metadata.note.trim() || `${itemName} / ${rule.mode.toUpperCase()}`,
      enabled: true,
      mode: rule.mode,
      weapon: validated.resolution,
      perk_requirements: validated.perks,
      note: metadata.note.trim() || undefined,
      source: withManifestEvidence(
        buildSource("dim_wishlist", wishlist?.title?.trim() || "DIM Wishlist", sourceId, id, timestamp),
        validated.resolution,
        id,
        timestamp
      ),
      created_at: timestamp,
      updated_at: timestamp
    };
  });
}

async function resolveManifestRecords(
  input: BuildMigratedEquipmentTargetsInput
): Promise<Map<number, WeaponTargetManifestRecord | null>> {
  const hashes = [...new Set<number>([
    ...(input.legacy_rules?.weapons ?? []).map((rule) => rule.item_hash),
    ...(input.wishlist?.rules ?? []).map((rule) => rule.item_hash)
  ])];
  const resolved = await mapWithConcurrency(hashes, 8, async (hash) => {
    if (!input.resolve_weapon) return [hash, null] as const;
    try {
      return [hash, await input.resolve_weapon(hash)] as const;
    } catch {
      return [hash, null] as const;
    }
  });
  return new Map(resolved);
}

async function mapWithConcurrency<TInput, TOutput>(
  inputs: TInput[],
  concurrency: number,
  mapper: (input: TInput) => Promise<TOutput>
): Promise<TOutput[]> {
  const outputs = new Array<TOutput>(inputs.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < inputs.length) {
      const index = nextIndex;
      nextIndex += 1;
      outputs[index] = await mapper(inputs[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, inputs.length) }, () => worker()));
  return outputs;
}

function validateManifestWeapon(
  record: WeaponTargetManifestRecord | null,
  itemHash: number,
  fallbackName: string,
  conditions: Array<{ perk_hash: number; perk_name: string }>
): { resolution: WeaponTargetResolution; perks: WeaponTargetPerkRequirement[] } {
  if (!record || record.group_key !== "weapons") {
    return {
      resolution: {
        status: "unresolved",
        query: fallbackName || String(itemHash),
        requested_item_hash: itemHash,
        ...(record?.manifest_version ? { checked_manifest_version: record.manifest_version } : {}),
        reason: "当前 Manifest 无法确认这件武器，目标暂不参与命中。"
      },
      perks: uniquePerkRequirements(conditions)
    };
  }

  const manifestPerks = new Map(record.perk_definitions.map((perk) => [perk.perk_hash, perk.perk_name]));
  const missing = conditions.filter((condition) => !manifestPerks.has(condition.perk_hash));
  if (missing.length) {
    return {
      resolution: {
        status: "unresolved",
        query: record.item_name,
        requested_item_hash: record.item_hash,
        ...(record.manifest_version ? { checked_manifest_version: record.manifest_version } : {}),
        reason: `Manifest 无法确认 ${missing.length} 个 Perk 属于该武器，目标暂不参与命中。`
      },
      perks: uniquePerkRequirements(conditions)
    };
  }

  return {
    resolution: {
      status: "verified",
      item_hash: record.item_hash,
      item_name: record.item_name,
      manifest_version: record.manifest_version
    },
    perks: uniquePerkRequirements(conditions.map((condition) => ({
      perk_hash: condition.perk_hash,
      perk_name: manifestPerks.get(condition.perk_hash) || condition.perk_name
    })))
  };
}

function matchWeaponTarget(item: AccountItemSummary, target: WeaponTarget): string | null {
  if (item.group_key !== "weapons" || target.weapon.status !== "verified") return null;
  if (item.hash !== target.weapon.item_hash) return null;
  const perkHashes = new Set(item.socket_plugs.map((plug) => plug.hash));
  if (!target.perk_requirements.every((perk) => perkHashes.has(perk.perk_hash))) return null;
  return `${target.name}：${target.weapon.item_name} / ${target.perk_requirements.length
    ? target.perk_requirements.map((perk) => perk.perk_name).join(" + ")
    : "任意 Roll"}`;
}

function matchArmorTarget(item: AccountItemSummary, target: ArmorAcquisitionTarget): string | null {
  if (item.group_key !== "armor") return null;
  if (target.class_type !== undefined && item.class_type !== target.class_type) return null;
  if (target.bucket_hash !== undefined && item.bucket_hash !== target.bucket_hash) return null;
  if (target.bucket_hash === undefined && target.bucket_name && item.bucket_name !== target.bucket_name) return null;
  const stats = armorTargetStats(item, target.stat_basis);
  if (!stats) return null;
  if (target.minimum_total !== undefined && stats.total < target.minimum_total) return null;
  const requirements = armorStatKeys.flatMap((stat) => {
    const minimum = target.stat_requirements[stat];
    return minimum === undefined ? [] : [{ stat, minimum }];
  });
  if (!requirements.length && target.minimum_total === undefined) return null;
  if (!requirements.every(({ stat, minimum }) => stats[stat] >= minimum)) return null;
  const facts = [
    ...requirements.map(({ stat, minimum }) => `${armorStatLabels[stat]} >= ${minimum}`),
    target.minimum_total !== undefined ? `总值 >= ${target.minimum_total}` : ""
  ].filter(Boolean);
  const basisLabel = target.stat_basis === "base" ? "基础属性" : "当前属性";
  const plannerSuffix = target.planner_context
    ? "；属性门槛已命中，框架、调整和套装身份仍需回到 Armor Planner 复核"
    : "";
  return `${target.name}：${basisLabel} ${facts.join(" / ")}${plannerSuffix}`;
}

function armorTargetStats(
  item: AccountItemSummary,
  basis: ArmorAcquisitionTarget["stat_basis"]
): (Record<ArmorStatKey, number> & { total: number }) | null {
  if (basis !== "base") return item.armor_stats ?? null;
  if (!item.armor_stat_breakdown) return null;
  const values = Object.fromEntries(
    armorStatKeys.map((stat) => [stat, item.armor_stat_breakdown![stat].base])
  ) as Record<ArmorStatKey, number>;
  return {
    ...values,
    total: item.armor_stat_breakdown.total.base
  };
}

function normalizeEquipmentTarget(input: unknown, fallbackTimestamp: string): EquipmentTarget | null {
  if (!isRecord(input)) return null;
  const id = normalizeText(input.id);
  const name = normalizeText(input.name);
  const source = normalizeSource(input.source, id, fallbackTimestamp);
  if (!id || !name || !source) return null;
  const base = {
    id,
    name,
    enabled: input.enabled !== false,
    source,
    created_at: normalizeTimestamp(input.created_at, fallbackTimestamp),
    updated_at: normalizeTimestamp(input.updated_at, fallbackTimestamp)
  };

  if (input.kind === "weapon") {
    const weapon = normalizeWeaponResolution(input.weapon);
    const perks = (Array.isArray(input.perk_requirements) ? input.perk_requirements : [])
      .map(normalizePerkRequirement)
      .filter((perk): perk is WeaponTargetPerkRequirement => Boolean(perk));
    if (!weapon) return null;
    return {
      ...base,
      kind: "weapon",
      mode: input.mode === "pve" || input.mode === "pvp" ? input.mode : "general",
      weapon,
      perk_requirements: uniquePerkRequirements(perks),
      ...(normalizeText(input.note) ? { note: normalizeText(input.note) } : {})
    };
  }

  if (input.kind === "armor_acquisition") {
    const statRequirements = normalizeArmorStatRequirements(input.stat_requirements);
    const minimumTotal = normalizeOptionalNonNegativeNumber(input.minimum_total);
    const plannerContext = normalizePlannerContext(input.planner_context);
    if (!Object.keys(statRequirements).length && minimumTotal === undefined) return null;
    return {
      ...base,
      kind: "armor_acquisition",
      ...(normalizeOptionalInteger(input.class_type) !== undefined ? { class_type: normalizeOptionalInteger(input.class_type) } : {}),
      ...(normalizeOptionalPositiveNumber(input.bucket_hash) !== undefined ? { bucket_hash: normalizeOptionalPositiveNumber(input.bucket_hash) } : {}),
      ...(normalizeText(input.bucket_name) ? { bucket_name: normalizeText(input.bucket_name) } : {}),
      stat_basis: input.stat_basis === "base" ? "base" : "current",
      stat_requirements: statRequirements,
      ...(minimumTotal !== undefined ? { minimum_total: minimumTotal } : {}),
      ...(plannerContext ? { planner_context: plannerContext } : {}),
      ...(normalizeText(input.note) ? { note: normalizeText(input.note) } : {})
    };
  }

  return null;
}

function normalizePlannerContext(input: unknown): ArmorAcquisitionTarget["planner_context"] | undefined {
  if (!isRecord(input)) return undefined;
  const resultId = normalizeText(input.result_id);
  const candidateId = normalizeText(input.candidate_id);
  const archetypeId = normalizeText(input.archetype_id);
  const archetypeName = normalizeText(input.archetype_name);
  const tuningLabel = normalizeText(input.tuning_label);
  const targetMasterworkTier = normalizeOptionalNonNegativeNumber(input.target_masterwork_tier);
  if (!resultId || !candidateId || !isArmorSlot(input.slot) || !archetypeId || !archetypeName
    || !isArmorStatKey(input.tertiary_stat) || !tuningLabel || targetMasterworkTier === undefined) {
    return undefined;
  }
  return {
    result_id: resultId,
    candidate_id: candidateId,
    slot: input.slot,
    archetype_id: archetypeId,
    archetype_name: archetypeName,
    tertiary_stat: input.tertiary_stat,
    tuning_label: tuningLabel,
    ...(normalizeOptionalPositiveNumber(input.set_hash) !== undefined
      ? { set_hash: normalizeOptionalPositiveNumber(input.set_hash) }
      : {}),
    ...(normalizeText(input.set_name) ? { set_name: normalizeText(input.set_name) } : {}),
    exotic: input.exotic === true,
    exotic_class_item: input.exotic_class_item === true,
    target_masterwork_tier: targetMasterworkTier
  };
}

function normalizeWeaponResolution(input: unknown): WeaponTargetResolution | null {
  if (!isRecord(input)) return null;
  if (input.status === "verified") {
    const itemHash = normalizeOptionalPositiveNumber(input.item_hash);
    const itemName = normalizeText(input.item_name);
    if (itemHash === undefined || !itemName) return null;
    return {
      status: "verified",
      item_hash: itemHash,
      item_name: itemName,
      ...(normalizeText(input.manifest_version) ? { manifest_version: normalizeText(input.manifest_version) } : {})
    };
  }
  if (input.status === "unresolved") {
    const query = normalizeText(input.query);
    if (!query) return null;
    return {
      status: "unresolved",
      query,
      ...(normalizeOptionalPositiveNumber(input.requested_item_hash) !== undefined
        ? { requested_item_hash: normalizeOptionalPositiveNumber(input.requested_item_hash) }
        : {}),
      ...(normalizeText(input.checked_manifest_version)
        ? { checked_manifest_version: normalizeText(input.checked_manifest_version) }
        : {}),
      reason: normalizeText(input.reason) || "目标尚未通过 Manifest 校验。"
    };
  }
  if (input.status === "ambiguous") {
    const query = normalizeText(input.query);
    const candidates = (Array.isArray(input.candidates) ? input.candidates : [])
      .flatMap((candidate) => normalizeWeaponCandidate(candidate) ?? []);
    if (!query || candidates.length < 2) return null;
    return {
      status: "ambiguous",
      query,
      candidates,
      reason: normalizeText(input.reason) || "发现多个同名武器版本，需要人工选择。"
    };
  }
  return null;
}

function normalizeWeaponCandidate(input: unknown): WeaponTargetCandidate | null {
  if (!isRecord(input)) return null;
  const itemHash = normalizeOptionalPositiveNumber(input.item_hash);
  const itemName = normalizeText(input.item_name);
  if (itemHash === undefined || !itemName) return null;
  return {
    item_hash: itemHash,
    item_name: itemName,
    ...(normalizeText(input.release_label) ? { release_label: normalizeText(input.release_label) } : {})
  };
}

function normalizePerkRequirement(input: unknown): WeaponTargetPerkRequirement | null {
  if (!isRecord(input)) return null;
  const perkHash = normalizeOptionalPositiveNumber(input.perk_hash);
  if (perkHash === undefined) return null;
  return {
    perk_hash: perkHash,
    perk_name: normalizeText(input.perk_name) || `Perk ${perkHash}`
  };
}

function normalizeArmorStatRequirements(input: unknown): Partial<Record<ArmorStatKey, number>> {
  if (!isRecord(input)) return {};
  return Object.fromEntries(armorStatKeys.flatMap((stat) => {
    const minimum = normalizeOptionalNonNegativeNumber(input[stat]);
    return minimum === undefined ? [] : [[stat, minimum]];
  })) as Partial<Record<ArmorStatKey, number>>;
}

function normalizeSource(
  input: unknown,
  targetId: string,
  fallbackTimestamp: string
): EquipmentTargetSource | null {
  if (!isRecord(input) || !isSourceKind(input.kind)) return null;
  const label = normalizeText(input.label);
  if (!label) return null;
  const evidenceRefs = (Array.isArray(input.evidence_refs) ? input.evidence_refs : [])
    .map((evidence) => normalizeEvidenceRef(evidence, targetId, fallbackTimestamp))
    .filter((evidence): evidence is EvidenceRef => Boolean(evidence));
  return {
    kind: input.kind,
    label,
    ...(normalizeText(input.source_id) ? { source_id: normalizeText(input.source_id) } : {}),
    evidence_refs: uniqueEvidenceRefs(evidenceRefs.length ? evidenceRefs : [{
      evidence_id: `equipment-target:${targetId}:source`,
      kind: input.kind === "dim_wishlist" ? "dim_import" : "local_data",
      label,
      observed_at: fallbackTimestamp,
      entity: { type: "equipment_target", id: targetId }
    }])
  };
}

function normalizeEvidenceRef(input: unknown, targetId: string, fallbackTimestamp: string): EvidenceRef | null {
  if (!isRecord(input)) return null;
  const evidenceId = normalizeText(input.evidence_id) || `equipment-target:${targetId}:source`;
  const kind = isEvidenceRefKind(input.kind) ? input.kind : "local_data";
  const label = normalizeText(input.label);
  if (!label) return null;
  const entity = isRecord(input.entity) && normalizeText(input.entity.type) && normalizeText(input.entity.id)
    ? { type: normalizeText(input.entity.type), id: normalizeText(input.entity.id) }
    : { type: "equipment_target", id: targetId };
  const openTarget = isRecord(input.open_target)
    && isEvidenceOpenTargetKind(input.open_target.kind)
    && normalizeText(input.open_target.id)
    ? {
        kind: input.open_target.kind,
        id: normalizeText(input.open_target.id),
        ...(normalizeText(input.open_target.secondary_id)
          ? { secondary_id: normalizeText(input.open_target.secondary_id) }
          : {})
      }
    : undefined;
  return {
    evidence_id: evidenceId,
    kind,
    label,
    observed_at: normalizeTimestamp(input.observed_at, fallbackTimestamp),
    entity,
    ...(normalizeText(input.manifest_version) ? { manifest_version: normalizeText(input.manifest_version) } : {}),
    ...(normalizeText(input.result_id) ? { result_id: normalizeText(input.result_id) } : {}),
    ...(openTarget ? { open_target: openTarget } : {})
  };
}

function buildSource(
  kind: EquipmentTargetSourceKind,
  label: string,
  sourceId: string | undefined,
  targetId: string,
  timestamp: string
): EquipmentTargetSource {
  return {
    kind,
    label,
    source_id: sourceId,
    evidence_refs: [{
      evidence_id: `equipment-target:${targetId}:source`,
      kind: kind === "dim_wishlist" ? "dim_import" : "local_data",
      label,
      observed_at: timestamp,
      entity: { type: "equipment_target", id: targetId }
    }]
  };
}

function withManifestEvidence(
  source: EquipmentTargetSource,
  resolution: WeaponTargetResolution,
  targetId: string,
  timestamp: string
): EquipmentTargetSource {
  if (resolution.status !== "verified") return source;
  return {
    ...source,
    evidence_refs: uniqueEvidenceRefs([
      ...source.evidence_refs,
      {
        evidence_id: `equipment-target:${targetId}:manifest:${resolution.item_hash}`,
        kind: "manifest_definition",
        label: `${resolution.item_name} / Manifest 定义`,
        observed_at: timestamp,
        entity: { type: "inventory_item", id: String(resolution.item_hash) },
        manifest_version: resolution.manifest_version,
        open_target: { kind: "item", id: String(resolution.item_hash) }
      }
    ])
  };
}

function uniqueTargets(targets: EquipmentTarget[]): EquipmentTarget[] {
  const byId = new Map<string, EquipmentTarget>();
  for (const target of targets) byId.set(target.id, target);
  return [...byId.values()];
}

function uniquePerkRequirements(
  requirements: Array<{ perk_hash: number; perk_name: string }>
): WeaponTargetPerkRequirement[] {
  const byHash = new Map<number, WeaponTargetPerkRequirement>();
  for (const requirement of requirements) {
    byHash.set(requirement.perk_hash, {
      perk_hash: requirement.perk_hash,
      perk_name: requirement.perk_name || `Perk ${requirement.perk_hash}`
    });
  }
  return [...byHash.values()];
}

function uniqueEvidenceRefs(evidenceRefs: EvidenceRef[]): EvidenceRef[] {
  const byId = new Map<string, EvidenceRef>();
  for (const evidence of evidenceRefs) byId.set(evidence.evidence_id, evidence);
  return [...byId.values()];
}

function stableTargetId(prefix: string, value: string): string {
  const normalized = value.trim().toLocaleLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${prefix}:${normalized || "target"}`;
}

function isSourceKind(input: unknown): input is EquipmentTargetSourceKind {
  return input === "dim_wishlist"
    || input === "user"
    || input === "guide_confirmation"
    || input === "armor_planner_gap"
    || input === "legacy_local_rules";
}

function isArmorSlot(input: unknown): input is ArmorSlot {
  return input === "helmet" || input === "arms" || input === "chest" || input === "legs" || input === "class";
}

function isArmorStatKey(input: unknown): input is ArmorStatKey {
  return typeof input === "string" && armorStatKeys.includes(input as ArmorStatKey);
}

function isEvidenceOpenTargetKind(input: unknown): input is NonNullable<EvidenceRef["open_target"]>["kind"] {
  return input === "account"
    || input === "item"
    || input === "perk"
    || input === "vendor"
    || input === "loadout"
    || input === "guide"
    || input === "result";
}

function isEvidenceRefKind(input: unknown): input is EvidenceRef["kind"] {
  return input === "bungie_profile"
    || input === "bungie_vendor"
    || input === "bungie_milestone"
    || input === "manifest_definition"
    || input === "local_data"
    || input === "dim_import"
    || input === "domain_result";
}

function normalizeTimestamp(input: unknown, fallback: string): string {
  const timestamp = normalizeOptionalTimestamp(input);
  return timestamp ?? fallback;
}

function normalizeOptionalTimestamp(input: unknown): string | undefined {
  if (typeof input !== "string" || !input.trim()) return undefined;
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalizeOptionalPositiveNumber(input: unknown): number | undefined {
  const value = Number(input);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
}

function normalizeOptionalNonNegativeNumber(input: unknown): number | undefined {
  const value = Number(input);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : undefined;
}

function normalizeOptionalInteger(input: unknown): number | undefined {
  const value = Number(input);
  return Number.isInteger(value) ? value : undefined;
}

function normalizeText(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}
