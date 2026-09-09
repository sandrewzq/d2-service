import type { AccountItemSummary, AccountSummary } from "../account/summary.js";

export type VendorCharacterScope =
  | { kind: "character"; characterId: string }
  | { kind: "account" };

export type VendorCharacterContext = {
  characterId: string;
  armorerModHash: number | null;
  armorerModName: string | null;
};

export type VendorDetailFailure = {
  characterId: string;
  vendorHash: number;
  message: string;
};

export type VendorCost = {
  itemHash: number;
  name: string;
  quantity: number;
  iconUrl?: string;
};

export type VendorOffer = {
  id: string;
  vendorHash: number;
  vendorItemIndex: number;
  itemHash: number;
  quantity?: number;
  name: string;
  itemType: string;
  tierType: string;
  iconUrl?: string;
  characterIds: string[];
  costs: VendorCost[];
  failureIndexes: number[];
  failureMessages: string[];
  saleStatus: number;
  canPurchase: boolean;
  apiPurchasable: boolean | null;
  categoryIndex: number;
  categoryName: string;
  categoryIdentifier?: string;
  previewVendorHash?: number;
  serviceId?: string;
  rollFingerprint: string;
  stats: Record<string, number>;
  socketPlugHashes: number[];
  socketPlugs?: Array<{
    hash: number;
    name: string;
    iconUrl?: string;
    description?: string;
    categoryIdentifier?: string;
    statModifiers?: Record<string, number>;
    itemType?: string;
  }>;
};

export type VendorProgression = {
  progressionHash: number;
  currentProgress: number;
  level: number;
  levelCap: number;
  stepIndex: number;
  progressToNextLevel: number;
  nextLevelAt: number;
};

export type VendorService = {
  id: string;
  name: string;
  description: string;
  categoryIndex: number;
  offers: VendorOffer[];
};

export type VendorInventory = {
  id: string;
  vendorHash: number;
  vendorIdentifier?: string;
  name: string;
  description: string;
  iconUrl?: string;
  location?: string;
  vendorGroupHash?: number;
  vendorGroupName?: string;
  vendorGroupOrder?: number;
  nextRefreshAt?: string;
  progression?: VendorProgression;
  characterIds: string[];
  offers: VendorOffer[];
  services: VendorService[];
};

export type VendorInventorySnapshot = {
  status: "ready" | "stale" | "error";
  fetchedAt: string;
  cachedAt?: string;
  errorMessage?: string;
  failedCharacterIds: string[];
  failedVendorDetails: VendorDetailFailure[];
  currencyBalances: Record<string, number>;
  characterContexts: Record<string, VendorCharacterContext>;
  detailVendorHashes?: number[];
  vendors: VendorInventory[];
};

export type VendorOwnedLocationKind = "vault" | "equipped" | "inventory" | "postmaster";

export type VendorOwnedLocation = {
  kind: VendorOwnedLocationKind;
  characterId?: string;
  characterLabel?: string;
  count: number;
};

export type VendorOwnedIdentitySummary = {
  itemHash: number;
  count: number;
  instanceIds: string[];
  locations: VendorOwnedLocation[];
  dataState: "ready" | "partial";
};

export type VendorAccountIdentityIndex = {
  byItemHash: ReadonlyMap<number, VendorOwnedIdentitySummary>;
  materialBalances: ReadonlyMap<number, number>;
  sourceProfileMintedAt?: string;
};

export type VendorInventoryDefinitions = {
  vendors: Readonly<Record<string, VendorDefinitionInput>>;
  items: Readonly<Record<string, VendorItemDefinitionInput>>;
};

export type VendorDefinitionInput = {
  name: string;
  vendorIdentifier?: string;
  description?: string;
  iconUrl?: string;
  failureStrings?: readonly string[];
  itemList: Readonly<Record<string, VendorDefinitionItemInput>>;
};

export type VendorDefinitionItemInput = {
  displayCategoryIndex: number;
  redirectToSaleIndexes?: readonly number[];
};

export type VendorItemDefinitionInput = {
  name: string;
  itemType?: string;
  tierType?: string;
  iconUrl?: string;
  previewVendorHash?: number;
  description?: string;
  categoryIdentifier?: string;
  investmentStats?: Array<{ statTypeHash?: number; value?: number; isConditionallyActive?: boolean }>;
};

export type VendorCharacterResponseInput = {
  characterId: string;
  vendors: Readonly<Record<string, VendorResponseInput>>;
};

export type VendorResponseInput = {
  vendorHash: number;
  canPurchase: boolean;
  location?: string;
  vendorGroupHash?: number;
  vendorGroupName?: string;
  vendorGroupOrder?: number;
  nextRefreshAt?: string;
  progression?: VendorProgression;
  categories: readonly VendorCategoryInput[];
  saleItems: Readonly<Record<string, VendorSaleItemInput>>;
  stats?: Readonly<Record<string, Readonly<Record<string, number>>>>;
  sockets?: Readonly<Record<string, readonly number[]>>;
};

export type VendorCategoryInput = {
  categoryIndex: number;
  name: string;
  identifier?: string;
  itemIndexes: readonly number[];
};

export type VendorSaleItemInput = {
  vendorItemIndex: number;
  itemHash: number;
  quantity?: number;
  costs: readonly { itemHash: number; quantity: number }[];
  failureIndexes: readonly number[];
  saleStatus: number;
  apiPurchasable?: boolean | null;
};

export type BuildVendorInventorySnapshotInput = {
  fetchedAt: string;
  cachedAt?: string;
  errorMessage?: string;
  characterContexts: Readonly<Record<string, VendorCharacterContext>>;
  characterResponses: readonly VendorCharacterResponseInput[];
  failedCharacterIds: readonly string[];
  failedVendorDetails: readonly VendorDetailFailure[];
  currencyBalances: Readonly<Record<string, number>>;
  detailVendorHashes?: readonly number[];
  definitions: VendorInventoryDefinitions;
};

export function createVendorOfferFingerprint(input: {
  itemHash: number;
  costs: readonly VendorCost[];
  failureIndexes: readonly number[];
  saleStatus: number;
  canPurchase: boolean;
  socketPlugHashes: readonly number[];
  statSummary: readonly (readonly [number, number])[];
}): string {
  return JSON.stringify({
    itemHash: input.itemHash,
    costs: input.costs
      .map((cost) => [cost.itemHash, cost.quantity] as const)
      .sort(([left], [right]) => left - right),
    failureIndexes: [...input.failureIndexes].sort((left, right) => left - right),
    saleStatus: input.saleStatus,
    canPurchase: input.canPurchase,
    socketPlugHashes: [...input.socketPlugHashes],
    statSummary: input.statSummary
      .map(([statHash, value]) => [statHash, value] as const)
      .sort(([left], [right]) => left - right)
  });
}

export function buildVendorAccountIdentityIndex(account: AccountSummary | null): VendorAccountIdentityIndex | null {
  if (!account) return null;

  const byItemHash = new Map<number, VendorOwnedIdentitySummary>();
  const seenInstanceIds = new Set<string>();
  const characterLabels = buildVendorCharacterLabels(account);

  for (const character of account.characters) {
    const characterLabel = characterLabels.get(character.character_id) ?? character.class_name;
    addVendorOwnedItems(byItemHash, seenInstanceIds, character.equipped_items ?? [], {
      kind: "equipped",
      characterId: character.character_id,
      characterLabel
    });
    addVendorOwnedItems(byItemHash, seenInstanceIds, character.inventory_items ?? [], {
      kind: "inventory",
      characterId: character.character_id,
      characterLabel
    });
    addVendorOwnedItems(byItemHash, seenInstanceIds, character.postmaster_items ?? [], {
      kind: "postmaster",
      characterId: character.character_id,
      characterLabel
    });
  }

  addVendorOwnedItems(byItemHash, seenInstanceIds, account.vault?.items ?? [], { kind: "vault" });

  return {
    byItemHash,
    materialBalances: new Map((account.materials?.items ?? []).map((item) => [item.hash, item.quantity])),
    sourceProfileMintedAt: account.profile_minted_at
  };
}

function addVendorOwnedItems(
  index: Map<number, VendorOwnedIdentitySummary>,
  seenInstanceIds: Set<string>,
  items: readonly AccountItemSummary[],
  location: Omit<VendorOwnedLocation, "count">
): void {
  for (const item of items) {
    const entry = index.get(item.hash) ?? {
      itemHash: item.hash,
      count: 0,
      instanceIds: [],
      locations: [],
      dataState: "ready" as const
    };
    if (!index.has(item.hash)) index.set(item.hash, entry);

    if (!item.instance_id) {
      entry.dataState = "partial";
      continue;
    }
    if (seenInstanceIds.has(item.instance_id)) continue;
    seenInstanceIds.add(item.instance_id);
    entry.count += 1;
    entry.instanceIds.push(item.instance_id);

    const existingLocation = entry.locations.find((candidate) => (
      candidate.kind === location.kind
      && candidate.characterId === location.characterId
    ));
    if (existingLocation) {
      existingLocation.count += 1;
    } else {
      entry.locations.push({ ...location, count: 1 });
    }
  }
}

function buildVendorCharacterLabels(account: AccountSummary): Map<string, string> {
  const classCounts = new Map<string, number>();
  const classIndexes = new Map<string, number>();
  for (const character of account.characters) {
    classCounts.set(character.class_name, (classCounts.get(character.class_name) ?? 0) + 1);
  }
  return new Map(account.characters.map((character) => {
    const duplicateIndex = (classIndexes.get(character.class_name) ?? 0) + 1;
    classIndexes.set(character.class_name, duplicateIndex);
    const label = (classCounts.get(character.class_name) ?? 0) > 1
      ? `${character.class_name} ${duplicateIndex}`
      : character.class_name;
    return [character.character_id, label];
  }));
}

export function createVendorCacheContextKey(context: VendorCharacterContext): string {
  return `${context.characterId}:${context.armorerModHash ?? "none"}`;
}

export function buildVendorInventorySnapshot(input: BuildVendorInventorySnapshotInput): VendorInventorySnapshot {
  const vendors = new Map<number, VendorInventory>();

  for (const characterResponse of input.characterResponses) {
    for (const vendorResponse of Object.values(characterResponse.vendors)) {
      const mapped = mapCharacterVendor(characterResponse.characterId, vendorResponse, input.definitions);
      const existing = vendors.get(mapped.vendorHash);
      if (!existing) {
        vendors.set(mapped.vendorHash, mapped);
        continue;
      }
      mergeVendor(existing, mapped);
    }
  }

  return {
    status: input.errorMessage && vendors.size === 0 ? "error" : input.errorMessage ? "stale" : "ready",
    fetchedAt: input.fetchedAt,
    cachedAt: input.cachedAt,
    errorMessage: input.errorMessage,
    failedCharacterIds: [...input.failedCharacterIds],
    failedVendorDetails: [...input.failedVendorDetails],
    currencyBalances: { ...input.currencyBalances },
    characterContexts: { ...input.characterContexts },
    detailVendorHashes: input.detailVendorHashes ? [...input.detailVendorHashes] : undefined,
    vendors: [...vendors.values()]
  };
}

function mapCharacterVendor(
  characterId: string,
  response: VendorResponseInput,
  definitions: VendorInventoryDefinitions
): VendorInventory {
  const vendorDefinition = definitions.vendors[String(response.vendorHash)];
  const serviceRoots = new Map<number, { id: string; targetIndexes: Set<number> }>();
  const serviceByTarget = new Map<number, string>();

  for (const [indexKey, definitionItem] of Object.entries(vendorDefinition?.itemList ?? {})) {
    if (!definitionItem.redirectToSaleIndexes?.length) continue;
    const rootIndex = Number(indexKey);
    const id = `${response.vendorHash}:service:${rootIndex}`;
    const targetIndexes = new Set(definitionItem.redirectToSaleIndexes);
    serviceRoots.set(rootIndex, { id, targetIndexes });
    for (const targetIndex of targetIndexes) serviceByTarget.set(targetIndex, id);
  }

  const offers: VendorOffer[] = [];
  const services = new Map<string, VendorService>();
  const seenIndexes = new Set<number>();
  const orderedIndexes = response.categories.flatMap((category) => category.itemIndexes);
  const remainingIndexes = Object.values(response.saleItems)
    .map((sale) => sale.vendorItemIndex)
    .filter((index) => !orderedIndexes.includes(index));

  for (const vendorItemIndex of [...orderedIndexes, ...remainingIndexes]) {
    if (seenIndexes.has(vendorItemIndex)) continue;
    seenIndexes.add(vendorItemIndex);
    const sale = response.saleItems[String(vendorItemIndex)];
    if (!sale) continue;

    const root = serviceRoots.get(vendorItemIndex);
    if (root) {
      const rootItem = definitions.items[String(sale.itemHash)];
      const category = findCategory(response.categories, vendorItemIndex);
      services.set(root.id, {
        id: root.id,
        name: rootItem?.name ?? `服务 ${vendorItemIndex}`,
        description: rootItem?.itemType ?? "",
        categoryIndex: category?.categoryIndex ?? -1,
        offers: []
      });
      continue;
    }

    const serviceId = serviceByTarget.get(vendorItemIndex);
    const offer = mapOffer(characterId, response, sale, serviceId, vendorDefinition, definitions);
    if (serviceId) {
      const service = services.get(serviceId);
      if (service) service.offers.push(offer);
      continue;
    }
    offers.push(offer);
  }

  return {
    id: `vendor-${response.vendorHash}`,
    vendorHash: response.vendorHash,
    vendorIdentifier: vendorDefinition?.vendorIdentifier,
    name: vendorDefinition?.name ?? `商人 ${response.vendorHash}`,
    description: vendorDefinition?.description ?? "",
    iconUrl: vendorDefinition?.iconUrl,
    location: response.location,
    vendorGroupHash: response.vendorGroupHash,
    vendorGroupName: response.vendorGroupName,
    vendorGroupOrder: response.vendorGroupOrder,
    nextRefreshAt: response.nextRefreshAt,
    progression: response.progression,
    characterIds: [characterId],
    offers,
    services: [...services.values()]
  };
}

function mapOffer(
  characterId: string,
  response: VendorResponseInput,
  sale: VendorSaleItemInput,
  serviceId: string | undefined,
  vendorDefinition: VendorDefinitionInput | undefined,
  definitions: VendorInventoryDefinitions
): VendorOffer {
  const item = definitions.items[String(sale.itemHash)];
  const category = findCategory(response.categories, sale.vendorItemIndex);
  const costs = sale.costs.map((cost) => {
    const costDefinition = definitions.items[String(cost.itemHash)];
    return {
      itemHash: cost.itemHash,
      name: costDefinition?.name ?? String(cost.itemHash),
      quantity: cost.quantity,
      iconUrl: costDefinition?.iconUrl
    };
  });
  const stats = { ...(response.stats?.[String(sale.vendorItemIndex)] ?? {}) };
  const socketPlugHashes = [...(response.sockets?.[String(sale.vendorItemIndex)] ?? [])];
  const socketPlugs = socketPlugHashes.map((hash) => {
    const plug = definitions.items[String(hash)];
    const statModifiers = summarizeVendorPlugStats(plug?.investmentStats);
    return {
      hash,
      name: plug?.name ?? String(hash),
      iconUrl: plug?.iconUrl,
      ...(plug?.description ? { description: plug.description } : {}),
      ...(plug?.categoryIdentifier ? { categoryIdentifier: plug.categoryIdentifier } : {}),
      ...(statModifiers ? { statModifiers } : {}),
      ...(plug?.itemType ? { itemType: plug.itemType } : {})
    };
  });
  const canPurchase = response.canPurchase && sale.saleStatus === 0 && sale.failureIndexes.length === 0;
  const rollFingerprint = createVendorOfferFingerprint({
    itemHash: sale.itemHash,
    costs,
    failureIndexes: sale.failureIndexes,
    saleStatus: sale.saleStatus,
    canPurchase,
    socketPlugHashes,
    statSummary: Object.entries(stats).map(([hash, value]) => [Number(hash), value] as const)
  });

  return {
    id: `${response.vendorHash}:${sale.vendorItemIndex}:${characterId}`,
    vendorHash: response.vendorHash,
    vendorItemIndex: sale.vendorItemIndex,
    itemHash: sale.itemHash,
    quantity: sale.quantity ?? 1,
    name: item?.name ?? String(sale.itemHash),
    itemType: item?.itemType ?? "",
    tierType: item?.tierType ?? "",
    iconUrl: item?.iconUrl,
    characterIds: [characterId],
    costs,
    failureIndexes: [...sale.failureIndexes],
    failureMessages: sale.failureIndexes.map(
      (index) => vendorDefinition?.failureStrings?.[index] ?? "无法购买"
    ),
    saleStatus: sale.saleStatus,
    canPurchase,
    apiPurchasable: sale.apiPurchasable ?? null,
    categoryIndex: category?.categoryIndex ?? -1,
    categoryName: category?.name ?? "其他",
    categoryIdentifier: category?.identifier,
    previewVendorHash: item?.previewVendorHash,
    serviceId,
    rollFingerprint,
    stats,
    socketPlugHashes,
    socketPlugs
  };
}

function summarizeVendorPlugStats(
  stats: VendorItemDefinitionInput["investmentStats"]
): Record<string, number> | undefined {
  const summary: Record<string, number> = {};
  for (const stat of stats ?? []) {
    const key = vendorWeaponStatKeys[Number(stat.statTypeHash)];
    if (!key || stat.isConditionallyActive || typeof stat.value !== "number") continue;
    summary[key] = (summary[key] ?? 0) + stat.value;
  }
  return Object.keys(summary).length ? summary : undefined;
}

const vendorWeaponStatKeys: Record<number, string> = {
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

function findCategory(categories: readonly VendorCategoryInput[], vendorItemIndex: number) {
  return categories.find((category) => category.itemIndexes.includes(vendorItemIndex));
}

function mergeVendor(target: VendorInventory, source: VendorInventory): void {
  target.progression ??= source.progression;
  for (const characterId of source.characterIds) {
    if (!target.characterIds.includes(characterId)) target.characterIds.push(characterId);
  }
  mergeOffers(target.offers, source.offers);
  for (const sourceService of source.services) {
    const targetService = target.services.find((service) => service.id === sourceService.id);
    if (!targetService) {
      target.services.push(sourceService);
      continue;
    }
    mergeOffers(targetService.offers, sourceService.offers);
  }
}

function mergeOffers(target: VendorOffer[], source: VendorOffer[]): void {
  for (const sourceOffer of source) {
    const existing = target.find(
      (offer) =>
        offer.vendorItemIndex === sourceOffer.vendorItemIndex &&
        offer.serviceId === sourceOffer.serviceId &&
        offer.rollFingerprint === sourceOffer.rollFingerprint
    );
    if (!existing) {
      target.push(sourceOffer);
      continue;
    }
    for (const characterId of sourceOffer.characterIds) {
      if (!existing.characterIds.includes(characterId)) existing.characterIds.push(characterId);
    }
    existing.id = `${existing.vendorHash}:${existing.vendorItemIndex}:account:${hashFingerprint(existing.rollFingerprint)}`;
  }
}

function hashFingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
