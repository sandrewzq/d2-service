import type { DefinitionComponentData, DefinitionRecord } from "../manifest/definitions.js";

export type ItemPlugSummary = {
  hash: number;
  name: string;
  description: string;
  icon?: string;
  category_identifier?: string;
  trait_ids?: string[];
  source_description?: string;
  item_type?: string;
  /** Bungie placeholder for an unselected/unlocked socket, not a real perk candidate. */
  is_socket_placeholder?: boolean;
};

export type ItemPlugSourceKind = "initial" | "reusable_item" | "reusable_set" | "randomized_set";

export type ItemPerkGroup = {
  socket_index: number;
  plugs: ItemPlugSummary[];
  source_kinds?: ItemPlugSourceKind[];
};

export type SummarizeItemPerksOptions = {
  plugSetDefinitions?: DefinitionComponentData;
  maxPlugsPerSocket?: number | null;
};

const bungieStaticBaseUrl = "https://www.bungie.net";

export function summarizeItemPerks(
  item: DefinitionRecord,
  itemDefinitions: DefinitionComponentData,
  options: SummarizeItemPerksOptions
): ItemPerkGroup[] {
  const entries = item.sockets?.socketEntries ?? [];
  const groups: ItemPerkGroup[] = [];

  entries.forEach((entry, index) => {
    if (entry.hidePerksInItemTooltip) {
      return;
    }

    const sources: Array<{ kind: ItemPlugSourceKind; hashes: number[] }> = [
      { kind: "initial", hashes: typeof entry.singleInitialItemHash === "number" ? [entry.singleInitialItemHash] : [] },
      { kind: "reusable_item", hashes: hashesFromReusablePlugItems(entry.reusablePlugItems) },
      { kind: "reusable_set", hashes: hashesFromPlugSet(options.plugSetDefinitions, entry.reusablePlugSetHash) },
      { kind: "randomized_set", hashes: hashesFromPlugSet(options.plugSetDefinitions, entry.randomizedPlugSetHash) }
    ];
    const hashes = sources.flatMap((source) => source.hashes);
    const plugs = uniqueNumbers(hashes)
      .map((hash) => toPlugSummary(hash, itemDefinitions[String(hash)]))
      .filter((plug): plug is ItemPlugSummary => Boolean(plug));
    const visiblePlugs = options.maxPlugsPerSocket === null
      ? plugs
      : plugs.slice(0, options.maxPlugsPerSocket ?? 8);

    if (visiblePlugs.length > 0) {
      groups.push({
        socket_index: index,
        plugs: visiblePlugs,
        source_kinds: sources.filter((source) => source.hashes.length > 0).map((source) => source.kind)
      });
    }
  });

  return groups;
}

function hashesFromReusablePlugItems(
  reusablePlugItems: Array<{ plugItemHash?: number }> | undefined
): number[] {
  return (reusablePlugItems ?? [])
    .map((item) => item.plugItemHash)
    .filter((hash): hash is number => typeof hash === "number");
}

function hashesFromPlugSet(
  plugSetDefinitions: DefinitionComponentData | undefined,
  plugSetHash: number | undefined
): number[] {
  if (!plugSetDefinitions || typeof plugSetHash !== "number") {
    return [];
  }

  return hashesFromReusablePlugItems(plugSetDefinitions[String(plugSetHash)]?.reusablePlugItems);
}

function toPlugSummary(
  hash: number,
  definition: DefinitionRecord | undefined
): ItemPlugSummary | null {
  if (!definition) {
    return null;
  }

  const name = definition.displayProperties?.name?.trim();
  if (!name) {
    return null;
  }

  const description = definition.displayProperties?.description ?? "";
  const socketPlaceholder = isSocketPlaceholder(name, description, definition);
  return {
    hash,
    name,
    description,
    icon: normalizeBungieAssetUrl(definition.displayProperties?.icon),
    ...(definition.plug?.plugCategoryIdentifier
      ? { category_identifier: definition.plug.plugCategoryIdentifier }
      : {}),
    ...(definition.traitIds?.length ? { trait_ids: definition.traitIds } : {}),
    ...(definition.sourceData?.sourceString
      ? { source_description: definition.sourceData.sourceString }
      : {}),
    ...(definition.itemTypeDisplayName ? { item_type: definition.itemTypeDisplayName } : {}),
    ...(socketPlaceholder ? { is_socket_placeholder: true } : {})
  };
}

function isSocketPlaceholder(name: string, description: string, definition: DefinitionRecord): boolean {
  const text = `${name} ${description} ${definition.itemTypeDisplayName ?? ""} ${definition.plug?.plugCategoryIdentifier ?? ""}`;
  return /empty\s+(?:trait\s+)?socket|空(?:的)?(?:特征|原始)?插槽|未选择特性|未选择插槽/i.test(text);
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values)];
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
