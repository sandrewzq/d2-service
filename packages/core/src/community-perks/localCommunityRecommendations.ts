import { summarizeItemPerks, type ItemPlugSummary } from "../items/perks.js";
import type { LocalCommunityRecommendationTable } from "./localCommunityImport.js";
import type {
  CommunityPerkSource,
  PerkCombo,
  PerkRef,
  SourceOptions,
  WeaponRecommendation
} from "./types.js";

export type LocalCommunityRecommendationLoader = () => LocalCommunityRecommendationTable | null;

export function createLocalCommunitySource(loadTable: LocalCommunityRecommendationLoader): CommunityPerkSource {
  return {
    name: "自定义推荐规则",
    isAvailable: () => {
      try {
        return loadTable() !== null;
      } catch {
        return false;
      }
    },
    async getRecommendations(item_hash: number, options: SourceOptions): Promise<WeaponRecommendation | null> {
      const table = loadTable();
      if (!table) return null;

      const matchingRules = table.rules.filter((rule) => rule.item_hash === item_hash);
      if (matchingRules.length === 0) return null;

      const perkHashToRef = buildPerkRefMap(item_hash, options, matchingRules);
      const combos: PerkCombo[] = matchingRules.map((rule) => ({
        perks: rule.perk_hashes.map((hash) => perkHashToRef.get(hash) ?? { hash, name: String(hash) }),
        source: "local_community",
        mode: rule.mode,
        note: rule.note || undefined
      }));

      const modes = Array.from(new Set(combos.map((combo) => combo.mode)));
      const sourceLabel = Array.from(new Set(
        matchingRules.map((rule) => rule.source_label?.trim()).filter(Boolean)
      )).join(" / ") || "自定义推荐规则";

      return {
        item_hash,
        item_name: options.item_name ?? String(item_hash),
        combos,
        matched_modes: modes,
        individual_perks: uniquePerks(combos),
        sample_size: matchingRules.length,
        source_label: sourceLabel,
        disclaimer: `来自本机启用的 ${table.title}，仅反映规则作者的偏好。`
      };
    }
  };
}

function uniquePerks(combos: PerkCombo[]): PerkRef[] {
  const perks = new Map<number, PerkRef>();
  for (const combo of combos) {
    for (const perk of combo.perks) {
      if (!perks.has(perk.hash)) {
        perks.set(perk.hash, perk);
      }
    }
  }
  return [...perks.values()];
}

function buildPerkRefMap(
  item_hash: number,
  options: SourceOptions,
  rules: Array<{ perk_hashes: number[] }>
): Map<number, PerkRef> {
  const map = new Map<number, PerkRef>();
  const allHashes = new Set(rules.flatMap((rule) => rule.perk_hashes));

  if (options.itemDefinitions && allHashes.size > 0) {
    const weaponDef = options.itemDefinitions[String(item_hash)];
    if (weaponDef) {
      const perkGroups = summarizeItemPerks(weaponDef, options.itemDefinitions, {
        plugSetDefinitions: options.plugSetDefinitions,
        maxPlugsPerSocket: 24
      });
      const allPlugs: ItemPlugSummary[] = perkGroups.flatMap((group) => group.plugs);
      for (const plug of allPlugs) {
        if (allHashes.has(plug.hash)) {
          map.set(plug.hash, {
            hash: plug.hash,
            name: plug.name,
            description: plug.description,
            icon: plug.icon
          });
        }
      }
    }
  }

  if (options.englishItemDefinitions && allHashes.size > 0) {
    for (const hash of allHashes) {
      const englishDef = options.englishItemDefinitions[String(hash)];
      const englishName = englishDef?.displayProperties?.name?.trim();
      if (englishName) {
        const ref = map.get(hash) ?? { hash, name: String(hash) };
        ref.englishName = englishName;
        map.set(hash, ref);
      }
    }
  }

  for (const hash of allHashes) {
    if (!map.has(hash)) {
      map.set(hash, { hash, name: String(hash) });
    }
  }

  return map;
}
