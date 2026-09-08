import { summarizeItemPerks, type ItemPlugSummary } from "@d2-tools/core/items/perks";
import { classifyWeaponRollSocket } from "@d2-tools/core/account/summary";
import { resolveDimWishlistRuleMetadata, type DimWishlist } from "@d2-tools/core/analysis/wishlistImport";
import type {
  CommunityPerkSource,
  DimWishlistDiagnosticSlot,
  DimWishlistPerkDiagnostic,
  DimWishlistRuleDiagnostic,
  PerkCombo,
  PerkRef,
  RecommendationRequirementSlot,
  SourceOptions,
  WeaponRecommendation
} from "@d2-tools/core/community-perks";
import { loadDimWishlist } from "../analysis/wishlistStore.js";
import {
  listRecommendationRuleOverrides,
  listRecommendationSourceOverrides
} from "./recommendationOverrides.js";

export function createDimWishlistSource(dataDir: string): CommunityPerkSource {
  const sourceState = listRecommendationSourceOverrides(dataDir)
    .find((entry) => entry.source_key === "dim_wishlist")?.state ?? "active";
  const removedRuleIds = new Set(listRecommendationRuleOverrides(dataDir, "dim_wishlist")
    .filter((entry) => entry.state === "removed" && !entry.review_required)
    .map((entry) => entry.rule_stable_id));
  const loadedWishlist = sourceState === "active" ? safelyLoadDimWishlist(dataDir) : null;
  const wishlist = loadedWishlist
    ? { ...loadedWishlist, rules: loadedWishlist.rules.filter((rule) => !rule.rule_stable_id || !removedRuleIds.has(rule.rule_stable_id)) }
    : null;
  const rulesByItemHash = new Map<number, NonNullable<typeof wishlist>["rules"]>();
  wishlist?.rules.forEach((rule) => {
    const existing = rulesByItemHash.get(rule.item_hash);
    if (existing) existing.push(rule);
    else rulesByItemHash.set(rule.item_hash, [rule]);
  });
  return {
    name: "DIM Wishlist",
    isAvailable: () => wishlist !== null,
    async getRecommendations(itemHash: number, options: SourceOptions): Promise<WeaponRecommendation | null> {
      if (!wishlist) return null;
      const matchingRules = rulesByItemHash.get(itemHash) ?? [];
      if (!matchingRules.length) return null;
      const perkHashToRef = buildPerkRefMap(itemHash, options, matchingRules);
      const slotCatalog = buildWeaponSlotCatalog(itemHash, options);
      const combos: PerkCombo[] = matchingRules
        .filter((rule) => rule.perk_hashes.length > 0)
        .map((rule) => {
          const metadata = resolveDimWishlistRuleMetadata(wishlist, rule);
          const diagnostic = diagnoseDimWishlistRule(rule.perk_hashes, perkHashToRef, slotCatalog);
          return {
            ...(rule.rule_stable_id ? { rule_stable_id: rule.rule_stable_id } : {}),
            perks: rule.perk_hashes.map((hash) => perkHashToRef.get(hash) ?? { hash, name: String(hash) }),
            source: "dim_wishlist" as const,
            mode: rule.mode,
            note: metadata.note || metadata.source_title || undefined,
            dim_diagnostic: diagnostic
          };
        });
      if (!combos.length) return null;
      const modeOrder = { pve: 0, pvp: 1, general: 2 } as const;
      combos.sort((a, b) => modeOrder[a.mode] - modeOrder[b.mode]);
      return {
        item_hash: itemHash,
        item_name: options.item_name ?? String(itemHash),
        combos,
        matched_modes: Array.from(new Set(combos.map((combo) => combo.mode))),
        individual_perks: uniquePerks(combos),
        sample_size: matchingRules.length,
        source_label: "DIM Wishlist",
        disclaimer: wishlist.title ? `来自 ${wishlist.title}，仅反映愿望单作者的偏好。` : "来自本地导入的 DIM Wishlist，仅反映愿望单作者的偏好。"
      };
    }
  };
}

function safelyLoadDimWishlist(dataDir: string): DimWishlist | null {
  try {
    return loadDimWishlist(dataDir);
  } catch {
    return null;
  }
}

type SlotCatalogEntry = {
  hash: number;
  name: string;
  slot: DimWishlistDiagnosticSlot;
};

function buildWeaponSlotCatalog(itemHash: number, options: SourceOptions): SlotCatalogEntry[] {
  const weaponDefinition = options.itemDefinitions?.[String(itemHash)];
  if (!weaponDefinition || !options.itemDefinitions) return [];
  const groups = summarizeItemPerks(weaponDefinition, options.itemDefinitions, {
    plugSetDefinitions: options.plugSetDefinitions,
    maxPlugsPerSocket: null
  }).sort((left, right) => left.socket_index - right.socket_index);
  let traitIndex = 0;
  return groups.flatMap((group) => {
    const role = classifyWeaponRollSocket(group.plugs.map((plug) => ({
      hash: plug.hash,
      name: plug.name,
      ...(plug.category_identifier ? { category_identifier: plug.category_identifier } : {}),
      ...(plug.item_type ? { item_type: plug.item_type } : {}),
      selected: false
    })));
    const slot: DimWishlistDiagnosticSlot = role === "trait"
      ? (++traitIndex === 1 ? "perk1" : traitIndex === 2 ? "perk2" : "special")
      : role === "other"
        ? "special"
        : role ?? "special";
    return group.plugs.map((plug) => ({ hash: plug.hash, name: plug.name, slot }));
  });
}

function diagnoseDimWishlistRule(
  perkHashes: number[],
  perkRefs: Map<number, PerkRef>,
  catalog: SlotCatalogEntry[]
): DimWishlistRuleDiagnostic {
  const perks = perkHashes.map((hash): DimWishlistPerkDiagnostic => {
    const sourceName = perkRefs.get(hash)?.name ?? String(hash);
    const exactHashMatches = catalog.filter((entry) => entry.hash === hash);
    const nameMatches = exactHashMatches.length
      ? exactHashMatches
      : catalog.filter((entry) => normalizeComparableName(entry.name) === normalizeComparableName(sourceName));
    const slots = [...new Set(nameMatches.map((entry) => entry.slot))];
    const resolvedHashes = [...new Set(nameMatches.map((entry) => entry.hash))];
    if (!slots.length) {
      return {
        original_hash: hash,
        name: sourceName,
        slot_candidates: ["unknown"],
        status: "unknown_slot"
      };
    }
    if (slots.length > 1) {
      return {
        original_hash: hash,
        name: sourceName,
        slot_candidates: slots,
        status: "cross_slot_ambiguous"
      };
    }
    if (slots[0] === "special") {
      return {
        original_hash: hash,
        resolved_hash: resolvedHashes[0],
        resolved_hashes: resolvedHashes,
        name: sourceName,
        slot_candidates: slots,
        status: "special_socket"
      };
    }
    return {
      original_hash: hash,
      resolved_hash: resolvedHashes[0],
      resolved_hashes: resolvedHashes,
      name: sourceName,
      slot_candidates: slots,
      status: "exact"
    };
  });
  if (perks.some((perk) => perk.status === "cross_slot_ambiguous")) {
    return { status: "cross_slot_ambiguous", message: "规则中的 Perk 无法唯一归属到一个武器栏位，保留 DIM 原始组合核对。", perks };
  }
  if (perks.some((perk) => perk.status === "unknown_slot")) {
    return { status: "unknown_slot", message: "规则中有 Perk 无法在当前资料库中定位栏位，保留 DIM 原始组合核对。", perks };
  }
  if (perks.some((perk) => perk.status === "special_socket")) {
    return { status: "special_socket", message: "规则涉及特殊或异域插槽，不能按普通六栏逐项核对。", perks };
  }
  const slotCounts = new Map<RecommendationRequirementSlot, number>();
  for (const perk of perks) {
    const slot = perk.slot_candidates[0] as RecommendationRequirementSlot;
    slotCounts.set(slot, (slotCounts.get(slot) ?? 0) + 1);
  }
  if ([...slotCounts.values()].some((count) => count > 1)) {
    return { status: "same_slot_multiple_required", message: "规则要求同一栏同时包含多个 Perk，不能弱化为该栏任选一个。", perks };
  }
  return { status: "exact", message: "规则中的每个 Perk 都已唯一映射到当前武器官方栏位。", perks };
}

function normalizeComparableName(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[\p{P}\p{Z}\s]+/gu, "");
}

function uniquePerks(combos: PerkCombo[]): PerkRef[] {
  const perks = new Map<number, PerkRef>();
  for (const combo of combos) for (const perk of combo.perks) if (!perks.has(perk.hash)) perks.set(perk.hash, perk);
  return [...perks.values()];
}

function buildPerkRefMap(itemHash: number, options: SourceOptions, rules: Array<{ perk_hashes: number[] }>): Map<number, PerkRef> {
  const map = new Map<number, PerkRef>();
  const allHashes = new Set(rules.flatMap((rule) => rule.perk_hashes));
  if (options.itemDefinitions && allHashes.size > 0) {
    const weaponDef = options.itemDefinitions[String(itemHash)];
    if (weaponDef) {
      const perkGroups = summarizeItemPerks(weaponDef, options.itemDefinitions, { plugSetDefinitions: options.plugSetDefinitions, maxPlugsPerSocket: 24 });
      for (const plug of perkGroups.flatMap((group) => group.plugs) as ItemPlugSummary[]) {
        if (allHashes.has(plug.hash)) map.set(plug.hash, { hash: plug.hash, name: plug.name, description: plug.description, icon: plug.icon });
      }
    }
    for (const hash of allHashes) {
      if (map.has(hash)) continue;
      const definition = options.itemDefinitions[String(hash)];
      const name = definition?.displayProperties?.name?.trim();
      if (!name) continue;
      map.set(hash, {
        hash,
        name,
        ...(definition.displayProperties?.description ? { description: definition.displayProperties.description } : {}),
        ...(definition.displayProperties?.icon ? { icon: definition.displayProperties.icon } : {})
      });
    }
  }
  if (options.englishItemDefinitions && allHashes.size > 0) {
    for (const hash of allHashes) {
      const englishName = options.englishItemDefinitions[String(hash)]?.displayProperties?.name?.trim();
      if (englishName) map.set(hash, { ...(map.get(hash) ?? { hash, name: String(hash) }), englishName });
    }
  }
  for (const hash of allHashes) if (!map.has(hash)) map.set(hash, { hash, name: String(hash) });
  return map;
}
