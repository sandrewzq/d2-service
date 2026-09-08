import type { DefinitionComponentData, DefinitionRecord } from "../manifest/definitions.js";

export type ItemIntrinsicTraitSummary = {
  hash: number;
  name: string;
  description: string;
  icon?: string;
};

export type ItemArmorAbilityGroupSummary = {
  key: string;
  name: string;
  category_identifier: string;
  options: ItemIntrinsicTraitSummary[];
};

const bungieStaticBaseUrl = "https://www.bungie.net";
const armorAbilityGroupLabels: Record<string, string> = {
  "enhancements.exotic.aeon_cult": "永劫教派能力"
};

export function summarizeItemIntrinsicTraits(
  item: DefinitionRecord,
  itemDefinitions: DefinitionComponentData
): ItemIntrinsicTraitSummary[] {
  const traits = (item.sockets?.socketEntries ?? [])
    .flatMap((entry) => typeof entry.singleInitialItemHash === "number" ? [entry.singleInitialItemHash] : [])
    .map((hash) => ({ hash, definition: itemDefinitions[String(hash)] }))
    .filter((entry) => entry.definition?.plug?.plugCategoryIdentifier === "intrinsics")
    .map(({ hash, definition }): ItemIntrinsicTraitSummary | null => {
      const name = definition?.displayProperties?.name?.trim();
      if (!name) {
        return null;
      }

      const trait: ItemIntrinsicTraitSummary = {
        hash,
        name,
        description: definition?.displayProperties?.description?.trim() ?? ""
      };
      const icon = normalizeBungieAssetUrl(definition?.displayProperties?.icon);
      if (icon) {
        trait.icon = icon;
      }
      return trait;
    })
    .filter((trait): trait is ItemIntrinsicTraitSummary => trait !== null);

  return [...new Map(traits.map((trait) => [trait.hash, trait])).values()];
}

export function summarizeItemArmorAbilityGroups(
  item: DefinitionRecord,
  itemDefinitions: DefinitionComponentData,
  plugSetDefinitions: DefinitionComponentData | undefined
): ItemArmorAbilityGroupSummary[] {
  const groups = new Map<string, ItemArmorAbilityGroupSummary>();

  for (const entry of item.sockets?.socketEntries ?? []) {
    const initialHash = normalizedHash(entry.singleInitialItemHash);
    const initialDefinition = initialHash === undefined
      ? undefined
      : itemDefinitions[String(initialHash)];
    const categoryIdentifier = initialDefinition?.plug?.plugCategoryIdentifier;
    const groupName = categoryIdentifier ? armorAbilityGroupLabels[categoryIdentifier] : undefined;
    if (!categoryIdentifier || !groupName) continue;

    const optionHashes = uniqueHashes([
      initialHash,
      ...(entry.reusablePlugItems ?? []).map((plug) => normalizedHash(plug.plugItemHash)),
      ...plugSetHashes(plugSetDefinitions, entry.reusablePlugSetHash),
      ...plugSetHashes(plugSetDefinitions, entry.randomizedPlugSetHash)
    ]);
    const options = optionHashes.flatMap((hash) => {
      const definition = itemDefinitions[String(hash)];
      if (definition?.plug?.plugCategoryIdentifier !== categoryIdentifier) return [];
      const option = summarizeAbilityOption(hash, definition);
      return option ? [option] : [];
    });
    if (!options.length) continue;

    const current = groups.get(categoryIdentifier);
    const mergedOptions = [...(current?.options ?? []), ...options];
    groups.set(categoryIdentifier, {
      key: `armor-ability:${categoryIdentifier}`,
      name: groupName,
      category_identifier: categoryIdentifier,
      options: [...new Map(mergedOptions.map((option) => [option.hash, option])).values()]
    });
  }

  return [...groups.values()];
}

function summarizeAbilityOption(
  hash: number,
  definition: DefinitionRecord
): ItemIntrinsicTraitSummary | null {
  const name = definition.displayProperties?.name?.trim();
  if (!name) return null;
  const option: ItemIntrinsicTraitSummary = {
    hash,
    name,
    description: definition.displayProperties?.description?.trim() ?? ""
  };
  const icon = normalizeBungieAssetUrl(definition.displayProperties?.icon);
  if (icon) option.icon = icon;
  return option;
}

function plugSetHashes(
  plugSetDefinitions: DefinitionComponentData | undefined,
  plugSetHash: number | undefined
): Array<number | undefined> {
  const normalizedPlugSetHash = normalizedHash(plugSetHash);
  if (normalizedPlugSetHash === undefined) return [];
  return (plugSetDefinitions?.[String(normalizedPlugSetHash)]?.reusablePlugItems ?? [])
    .map((plug) => normalizedHash(plug.plugItemHash));
}

function uniqueHashes(hashes: Array<number | undefined>): number[] {
  return [...new Set(hashes.filter((hash): hash is number => hash !== undefined))];
}

function normalizedHash(hash: number | undefined): number | undefined {
  return typeof hash === "number" && hash > 0 ? hash >>> 0 : undefined;
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
