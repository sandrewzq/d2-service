import {
  buildVendorInventorySnapshot,
  createVendorCacheContextKey,
  type VendorCharacterContext,
  type VendorCharacterResponseInput,
  type VendorInventoryDefinitions,
  type VendorInventorySnapshot,
  type VendorProgression,
  type VendorResponseInput
} from "@d2-tools/core/vendors/inventory";

export { createVendorCacheContextKey } from "@d2-tools/core/vendors/inventory";

const ghostBucketHash = 4023194814;
const profileComponents = "205,305";
const vendorListComponents = "400,401,402,600";
const vendorDetailComponents = "304,305";
const vendorDetailConcurrency = 4;

type DefinitionRecord = {
  vendorIdentifier?: string;
  displayProperties?: { name?: string; description?: string; icon?: string };
  locations?: Array<{ destinationHash?: number }>;
  itemTypeDisplayName?: string;
  inventory?: { tierTypeName?: string; bucketTypeHash?: number };
  plug?: { plugCategoryIdentifier?: string };
  traitIds?: string[];
  failureStrings?: string[];
  returnWithVendorRequest?: boolean;
  itemList?: Array<{
    vendorItemIndex?: number;
    itemHash?: number;
    quantity?: number;
    failureIndexes?: number[];
    currencies?: Array<{ itemHash?: number; quantity?: number }>;
    displayCategoryIndex?: number;
    categoryIndex?: number;
    redirectToSaleIndexes?: number[];
  }>;
  displayCategories?: Array<{
    identifier?: string;
    displayProperties?: { name?: string };
  }>;
  preview?: { previewVendorHash?: number };
  groups?: Array<{ vendorGroupHash?: number }>;
  categoryName?: string;
  order?: number;
  investmentStats?: Array<{
    statTypeHash?: number;
    value?: number;
    isConditionallyActive?: boolean;
  }>;
};

export type FetchVendorInventorySnapshotOptions = {
  apiKey: string;
  accessToken: string;
  membershipType: number;
  membershipId: string;
  characterIds: string[];
  detailVendorHashes?: number[];
  definitions: {
    vendors: Record<string, DefinitionRecord>;
    vendorGroups?: Record<string, DefinitionRecord>;
    items: Record<string, DefinitionRecord>;
    destinations?: Record<string, DefinitionRecord>;
  };
  fetchJson?: <T>(path: string, accessToken?: string) => Promise<T>;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  now?: () => Date;
};

type ProfileResponse = {
  characterEquipment?: {
    data?: Record<string, { items?: Array<{ itemHash?: number; itemInstanceId?: string }> }>;
  };
  itemComponents?: {
    sockets?: {
      data?: Record<string, { sockets?: Array<{ plugHash?: number }> }>;
    };
  };
};

type VendorListResponse = {
  vendors?: { data?: Record<string, RawVendorComponent> };
  vendorGroups?: { data?: { groups?: RawVendorGroup[] } };
  categories?: { data?: Record<string, { categories?: RawVendorCategory[] }> };
  sales?: { data?: Record<string, { saleItems?: Record<string, RawSaleItem> }> };
  currencyLookups?: { data?: CurrencyLookupData };
};

type RawVendorGroup = {
  vendorGroupHash?: number;
  vendorHashes?: number[];
};

type CurrencyLookupData = {
  itemQuantities?: Record<string, number> | Array<{ itemHash?: number; quantity?: number }>;
  items?: Record<string, { quantity?: number }>;
};

type VendorDetailResponse = {
  itemComponents?: {
    stats?: {
      data?: Record<string, { stats?: Record<string, { value?: number }> }>;
    };
    sockets?: {
      data?: Record<string, { sockets?: Array<{ plugHash?: number }> }>;
    };
  };
};

type RawVendorComponent = {
  vendorHash?: number;
  canPurchase?: boolean;
  nextRefreshDate?: string;
  vendorLocationIndex?: number;
  progression?: VendorProgression;
};

type RawVendorCategory = {
  displayCategoryIndex?: number;
  itemIndexes?: number[];
};

type RawSaleItem = {
  vendorItemIndex?: number;
  itemHash?: number;
  quantity?: number;
  costs?: Array<{ itemHash?: number; quantity?: number }>;
  failureIndexes?: number[];
  saleStatus?: number;
  apiPurchasable?: boolean | null;
};

export async function fetchVendorInventorySnapshot(
  options: FetchVendorInventorySnapshotOptions
): Promise<VendorInventorySnapshot> {
  const fetchJson = options.fetchJson ?? createFetchJson(options);
  const now = options.now ?? (() => new Date());
  const profileRequest = fetchJson<ProfileResponse>(
    `/Destiny2/${options.membershipType}/Profile/${options.membershipId}/?components=${profileComponents}`,
    options.accessToken
  );
  const listRequest = Promise.allSettled(options.characterIds.map(async (characterId) => ({
    characterId,
    response: await fetchJson<VendorListResponse>(
      `/Destiny2/${options.membershipType}/Profile/${options.membershipId}/Character/${characterId}/Vendors/?components=${vendorListComponents}`,
      options.accessToken
    )
  })));
  const [profile, listResults] = await Promise.all([profileRequest, listRequest]);
  const characterContexts = buildCharacterContexts(
    profile,
    options.characterIds,
    options.definitions.items
  );
  const failedCharacterIds: string[] = [];
  const failedVendorDetails: Array<{ characterId: string; vendorHash: number; message: string }> = [];
  const characterResponses: VendorCharacterResponseInput[] = [];
  const currencyBalances: Record<string, number> = {};
  const requestedDetailVendorHashes = new Set<number>();

  for (let index = 0; index < listResults.length; index += 1) {
    const result = listResults[index];
    const characterId = options.characterIds[index];
    if (result.status === "rejected") {
      failedCharacterIds.push(characterId);
      continue;
    }

    mergeCurrencyBalances(currencyBalances, result.value.response.currencyLookups?.data);
    const details = new Map<number, VendorDetailResponse>();
    const requestedVendorHashes = options.detailVendorHashes
      ?? discoverVendorHashes(
        result.value.response,
        options.definitions.vendors,
        options.definitions.items
      );
    requestedVendorHashes.forEach((vendorHash) => requestedDetailVendorHashes.add(vendorHash));
    const detailVendorHashes = requestedVendorHashes.filter((vendorHash) =>
      Boolean(result.value.response.sales?.data?.[String(vendorHash)])
    );
    const detailResults = await mapSettledWithConcurrency(
      detailVendorHashes,
      vendorDetailConcurrency,
      async (vendorHash) => ({
        vendorHash,
        response: await fetchJson<VendorDetailResponse>(
          `/Destiny2/${options.membershipType}/Profile/${options.membershipId}/Character/${characterId}/Vendors/${vendorHash}/?components=${vendorDetailComponents}`,
          options.accessToken
        )
      })
    );

    for (let detailIndex = 0; detailIndex < detailResults.length; detailIndex += 1) {
      const detailResult = detailResults[detailIndex];
      const vendorHash = detailVendorHashes[detailIndex];
      if (detailResult.status === "fulfilled") {
        details.set(vendorHash, detailResult.value.response);
      } else {
        failedVendorDetails.push({
          characterId,
          vendorHash,
          message: errorMessage(detailResult.reason)
        });
      }
    }

    characterResponses.push({
      characterId,
      vendors: mapVendorResponses(result.value.response, details, options.definitions)
    });
  }

  if (!characterResponses.length) {
    throw new Error("无法读取任何角色的商人库存");
  }

  return buildVendorInventorySnapshot({
    fetchedAt: now().toISOString(),
    characterContexts,
    characterResponses,
    failedCharacterIds,
    failedVendorDetails,
    currencyBalances,
    detailVendorHashes: [...requestedDetailVendorHashes],
    definitions: mapDefinitions(options.definitions, characterResponses)
  });
}

function discoverVendorHashes(
  response: VendorListResponse,
  vendorDefinitions: Record<string, DefinitionRecord>,
  itemDefinitions: Record<string, DefinitionRecord>
): number[] {
  const previewVendorHashes = collectPreviewVendorHashes(response, itemDefinitions);
  const activeVendorGroups = collectActiveVendorGroups(response);
  return Object.keys(response.sales?.data ?? {})
    .filter((vendorHash) => shouldIncludeTopLevelVendor(
      response.vendors?.data?.[vendorHash],
      vendorDefinitions[vendorHash],
      previewVendorHashes.has(Number(vendorHash)),
      activeVendorGroups.has(Number(vendorHash))
    ))
    .map(Number)
    .filter((vendorHash) => Number.isInteger(vendorHash) && vendorHash > 0);
}

function shouldIncludeTopLevelVendor(
  vendor: RawVendorComponent | undefined,
  definition: DefinitionRecord | undefined,
  referencedByPreview = false,
  referencedByActiveGroup = false
): boolean {
  if (
    definition?.vendorIdentifier === "TOWER_NINE"
    || definition?.vendorIdentifier === "TOWER_NINE_OFFERS"
    || definition?.vendorIdentifier === "TOWER_NINE_GEAR"
  ) return true;
  return referencedByActiveGroup || referencedByPreview || vendor?.canPurchase === true;
}

async function mapSettledWithConcurrency<T, TResult>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<TResult>
): Promise<Array<PromiseSettledResult<TResult>>> {
  const results = new Array<PromiseSettledResult<TResult>>(items.length);
  let nextIndex = 0;

  async function run(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = { status: "fulfilled", value: await worker(items[index]) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, () => run())
  );
  return results;
}

function buildCharacterContexts(
  profile: ProfileResponse,
  characterIds: string[],
  itemDefinitions: Record<string, DefinitionRecord>
): Record<string, VendorCharacterContext> {
  return Object.fromEntries(characterIds.map((characterId) => {
    const equipment = profile.characterEquipment?.data?.[characterId]?.items ?? [];
    const ghost = equipment.find((item) =>
      itemDefinitions[String(item.itemHash)]?.inventory?.bucketTypeHash === ghostBucketHash
    );
    const sockets = ghost?.itemInstanceId
      ? profile.itemComponents?.sockets?.data?.[ghost.itemInstanceId]?.sockets ?? []
      : [];
    const armorerMod = sockets
      .map((socket) => socket.plugHash)
      .find((plugHash): plugHash is number =>
        plugHash !== undefined && isArmorerDefinition(itemDefinitions[String(plugHash)])
      );
    const armorerDefinition = armorerMod === undefined ? undefined : itemDefinitions[String(armorerMod)];
    return [characterId, {
      characterId,
      armorerModHash: armorerMod ?? null,
      armorerModName: cleanManifestDisplayText(armorerDefinition?.displayProperties?.name) || null
    }];
  }));
}

function isArmorerDefinition(definition: DefinitionRecord | undefined): boolean {
  const category = definition?.plug?.plugCategoryIdentifier?.toLowerCase() ?? "";
  const traits = definition?.traitIds?.map((trait) => trait.toLowerCase()) ?? [];
  return category.includes("armorer") || traits.some((trait) => trait.includes("armorer"));
}

function mapVendorResponses(
  list: VendorListResponse,
  details: Map<number, VendorDetailResponse>,
  definitions: FetchVendorInventorySnapshotOptions["definitions"]
): Record<string, VendorResponseInput> {
  const mapped: Record<string, VendorResponseInput> = {};
  const previewVendorHashes = collectPreviewVendorHashes(list, definitions.items);
  const activeVendorGroups = collectActiveVendorGroups(list);
  const queue = Object.keys(list.sales?.data ?? {})
    .map(Number)
    .filter((vendorHash) => Number.isInteger(vendorHash) && vendorHash > 0)
    .filter((vendorHash) => shouldIncludeTopLevelVendor(
      list.vendors?.data?.[String(vendorHash)],
      definitions.vendors[String(vendorHash)],
      previewVendorHashes.has(vendorHash),
      activeVendorGroups.has(vendorHash)
    ));
  const visited = new Set<number>();

  for (let index = 0; index < queue.length; index += 1) {
    const vendorHash = queue[index];
    if (visited.has(vendorHash)) continue;
    visited.add(vendorHash);
    const vendorKey = String(vendorHash);
    const vendor = list.vendors?.data?.[vendorKey] ?? {};
    const vendorDefinition = definitions.vendors[vendorKey];
    const salesComponent = list.sales?.data?.[vendorKey];
    const vendorGroup = selectVendorGroup(
      vendorHash,
      vendorDefinition,
      definitions.vendorGroups ?? {},
      activeVendorGroups
    );
    const response = salesComponent
      ? mapLiveVendorResponse(
        vendorHash,
        vendor,
        vendorDefinition,
        vendorGroup,
        salesComponent.saleItems ?? {},
        list.categories?.data?.[vendorKey]?.categories ?? [],
        details.get(vendorHash),
        definitions.destinations ?? {}
      )
      : mapDefinitionVendorResponse(
        vendorHash,
        vendorDefinition,
        vendorGroup,
        definitions.destinations ?? {}
      );
    if (!response) continue;
    mapped[vendorKey] = response;
    for (const previewVendorHash of collectMappedPreviewVendorHashes(response, definitions.items)) {
      if (!visited.has(previewVendorHash)) queue.push(previewVendorHash);
    }
  }
  return mapped;
}

function mapLiveVendorResponse(
  vendorHash: number,
  vendor: RawVendorComponent,
  vendorDefinition: DefinitionRecord | undefined,
  vendorGroup: { hash: number; name: string; order: number } | undefined,
  saleItems: Record<string, RawSaleItem>,
  categories: RawVendorCategory[],
  detail: VendorDetailResponse | undefined,
  destinations: Record<string, DefinitionRecord>
): VendorResponseInput {
  return {
    vendorHash: vendor.vendorHash ?? vendorHash,
    canPurchase: vendor.canPurchase ?? false,
    location: resolveVendorLocation(vendor, vendorDefinition, destinations),
    vendorGroupHash: vendorGroup?.hash,
    vendorGroupName: vendorGroup?.name,
    vendorGroupOrder: vendorGroup?.order,
    nextRefreshAt: vendor.nextRefreshDate,
    progression: vendor.progression,
    categories: categories.map((category) => mapVendorCategory(category, vendorDefinition)),
    saleItems: Object.fromEntries(Object.entries(saleItems).map(([itemKey, sale]) => [
      itemKey,
      {
        vendorItemIndex: sale.vendorItemIndex ?? Number(itemKey),
        itemHash: sale.itemHash ?? 0,
        quantity: sale.quantity ?? 1,
        costs: (sale.costs ?? []).map((cost) => ({
          itemHash: cost.itemHash ?? 0,
          quantity: cost.quantity ?? 0
        })),
        failureIndexes: sale.failureIndexes ?? [],
        saleStatus: sale.saleStatus ?? 0,
        apiPurchasable: sale.apiPurchasable ?? null
      }
    ])),
    stats: mapStats(detail),
    sockets: mapSockets(detail)
  };
}

function mapDefinitionVendorResponse(
  vendorHash: number,
  vendorDefinition: DefinitionRecord | undefined,
  vendorGroup: { hash: number; name: string; order: number } | undefined,
  destinations: Record<string, DefinitionRecord>
): VendorResponseInput | undefined {
  if (!vendorDefinition || vendorDefinition.returnWithVendorRequest === true) return undefined;
  const saleItems = mapDefinitionSaleItems(vendorDefinition);
  if (!Object.keys(saleItems).length) return undefined;
  return {
    vendorHash,
    canPurchase: false,
    location: resolveVendorLocation({}, vendorDefinition, destinations),
    vendorGroupHash: vendorGroup?.hash,
    vendorGroupName: vendorGroup?.name,
    vendorGroupOrder: vendorGroup?.order,
    categories: mapDefinitionVendorCategories(vendorDefinition),
    saleItems
  };
}

function mapVendorCategory(
  category: RawVendorCategory,
  vendorDefinition: DefinitionRecord | undefined
): VendorResponseInput["categories"][number] {
  const categoryIndex = category.displayCategoryIndex ?? -1;
  return {
    categoryIndex,
    name: cleanManifestDisplayText(
      vendorDefinition?.displayCategories?.[categoryIndex]?.displayProperties?.name
    ) || "其他",
    identifier: vendorDefinition?.displayCategories?.[categoryIndex]?.identifier?.trim() || undefined,
    itemIndexes: category.itemIndexes ?? []
  };
}

function mapDefinitionVendorCategories(
  vendorDefinition: DefinitionRecord
): VendorResponseInput["categories"] {
  const indexes = new Map<number, number[]>();
  for (let index = 0; index < (vendorDefinition.itemList ?? []).length; index += 1) {
    const item = vendorDefinition.itemList?.[index];
    const vendorItemIndex = item?.vendorItemIndex ?? index;
    const categoryIndex = item?.displayCategoryIndex ?? item?.categoryIndex ?? -1;
    const items = indexes.get(categoryIndex) ?? [];
    items.push(vendorItemIndex);
    indexes.set(categoryIndex, items);
  }
  return [...indexes.entries()].map(([categoryIndex, itemIndexes]) => mapVendorCategory({
    displayCategoryIndex: categoryIndex,
    itemIndexes
  }, vendorDefinition));
}

function mapDefinitionSaleItems(
  vendorDefinition: DefinitionRecord
): Record<string, VendorResponseInput["saleItems"][string]> {
  const result: Record<string, VendorResponseInput["saleItems"][string]> = {};
  for (let index = 0; index < (vendorDefinition.itemList ?? []).length; index += 1) {
    const item = vendorDefinition.itemList?.[index];
    if (!item || typeof item.itemHash !== "number" || !Number.isInteger(item.itemHash) || item.itemHash <= 0) {
      continue;
    }
    const vendorItemIndex = item.vendorItemIndex ?? index;
    result[String(vendorItemIndex)] = {
      vendorItemIndex,
      itemHash: item.itemHash,
      quantity: item.quantity ?? 1,
      costs: (item.currencies ?? []).flatMap((cost) => (
        typeof cost.itemHash === "number" && Number.isInteger(cost.itemHash) && cost.itemHash > 0
          ? [{ itemHash: cost.itemHash, quantity: cost.quantity ?? 0 }]
          : []
      )),
      failureIndexes: item.failureIndexes ?? [],
      saleStatus: 0,
      apiPurchasable: false
    };
  }
  return result;
}

function resolveVendorLocation(
  vendor: RawVendorComponent,
  vendorDefinition: DefinitionRecord | undefined,
  destinations: Record<string, DefinitionRecord>
): string | undefined {
  if (vendor.vendorLocationIndex === undefined) return undefined;
  const destinationHash = vendorDefinition?.locations?.[vendor.vendorLocationIndex]?.destinationHash;
  if (destinationHash === undefined) return undefined;
  return destinations[String(destinationHash)]?.displayProperties?.name?.trim() || undefined;
}

function selectVendorGroup(
  vendorHash: number,
  vendorDefinition: DefinitionRecord | undefined,
  vendorGroups: Record<string, DefinitionRecord>,
  activeVendorGroups: Map<number, number[]>
): { hash: number; name: string; order: number } | undefined {
  const activeHashes = activeVendorGroups.get(vendorHash) ?? [];
  const manifestHashes = (vendorDefinition?.groups ?? []).flatMap((group) =>
    typeof group.vendorGroupHash === "number" ? [group.vendorGroupHash] : []
  );
  return (activeHashes.length ? activeHashes : manifestHashes)
    .flatMap((hash) => {
      const definition = vendorGroups[String(hash)];
      const name = cleanManifestDisplayText(definition?.categoryName);
      if (!name) return [];
      return [{
        hash,
        name,
        order: typeof definition.order === "number" ? definition.order : Number.MAX_SAFE_INTEGER
      }];
    })
    .sort((left, right) => left.order - right.order)[0];
}

function collectActiveVendorGroups(response: VendorListResponse): Map<number, number[]> {
  const result = new Map<number, number[]>();
  for (const group of response.vendorGroups?.data?.groups ?? []) {
    const groupHash = group.vendorGroupHash;
    if (typeof groupHash !== "number" || !Number.isInteger(groupHash) || groupHash <= 0) continue;
    for (const vendorHash of group.vendorHashes ?? []) {
      if (!Number.isInteger(vendorHash) || vendorHash <= 0) continue;
      const groups = result.get(vendorHash) ?? [];
      groups.push(groupHash);
      result.set(vendorHash, groups);
    }
  }
  return result;
}

function collectPreviewVendorHashes(
  response: VendorListResponse,
  itemDefinitions: Record<string, DefinitionRecord>
): Set<number> {
  return new Set(Object.values(response.sales?.data ?? {}).flatMap((sales) =>
    Object.values(sales.saleItems ?? {}).flatMap((sale) => {
      const previewVendorHash = itemDefinitions[String(sale.itemHash)]?.preview?.previewVendorHash;
      return typeof previewVendorHash === "number" && previewVendorHash > 0 ? [previewVendorHash] : [];
    })
  ));
}

function collectMappedPreviewVendorHashes(
  response: VendorResponseInput,
  itemDefinitions: Record<string, DefinitionRecord>
): number[] {
  return [...new Set(Object.values(response.saleItems).flatMap((sale) => {
    const previewVendorHash = itemDefinitions[String(sale.itemHash)]?.preview?.previewVendorHash;
    return typeof previewVendorHash === "number" && previewVendorHash > 0 ? [previewVendorHash] : [];
  }))];
}

function mapStats(detail: VendorDetailResponse | undefined): Record<string, Record<string, number>> {
  return Object.fromEntries(Object.entries(detail?.itemComponents?.stats?.data ?? {}).map(([index, component]) => [
    index,
    Object.fromEntries(Object.entries(component.stats ?? {}).map(([hash, stat]) => [hash, stat.value ?? 0]))
  ]));
}

function mapSockets(detail: VendorDetailResponse | undefined): Record<string, number[]> {
  return Object.fromEntries(Object.entries(detail?.itemComponents?.sockets?.data ?? {}).map(([index, component]) => [
    index,
    (component.sockets ?? []).map((socket) => socket.plugHash).filter((hash): hash is number => hash !== undefined)
  ]));
}

function mapDefinitions(
  definitions: FetchVendorInventorySnapshotOptions["definitions"],
  characterResponses: VendorCharacterResponseInput[]
): VendorInventoryDefinitions {
  const vendorHashes = new Set(characterResponses.flatMap((character) =>
    Object.values(character.vendors).map((vendor) => vendor.vendorHash)
  ));
  const itemHashes = new Set(characterResponses.flatMap((character) =>
    Object.values(character.vendors).flatMap((vendor) => Object.values(vendor.saleItems).flatMap((sale) => [
      sale.itemHash,
      ...sale.costs.map((cost) => cost.itemHash)
    ]).concat(Object.values(vendor.sockets ?? {}).flat()))
  ));

  return {
    vendors: Object.fromEntries([...vendorHashes].map((vendorHash) => {
      const definition = definitions.vendors[String(vendorHash)];
      return [String(vendorHash), {
        name: cleanManifestDisplayText(definition?.displayProperties?.name) || `商人 ${vendorHash}`,
        vendorIdentifier: definition?.vendorIdentifier,
        description: cleanManifestDisplayText(definition?.displayProperties?.description),
        iconUrl: definition?.displayProperties?.icon,
        failureStrings: (definition?.failureStrings ?? [])
          .map(cleanManifestDisplayText)
          .filter(Boolean),
        itemList: Object.fromEntries((definition?.itemList ?? []).map((item, index) => [String(item.vendorItemIndex ?? index), {
          displayCategoryIndex: item.displayCategoryIndex ?? -1,
          redirectToSaleIndexes: item.redirectToSaleIndexes ?? []
        }]))
      }];
    })),
    items: Object.fromEntries([...itemHashes].map((itemHash) => {
      const definition = definitions.items[String(itemHash)];
      return [String(itemHash), {
        name: cleanManifestDisplayText(definition?.displayProperties?.name) || String(itemHash),
        itemType: cleanManifestDisplayText(definition?.itemTypeDisplayName),
        tierType: cleanManifestDisplayText(definition?.inventory?.tierTypeName),
        iconUrl: definition?.displayProperties?.icon,
        previewVendorHash: definition?.preview?.previewVendorHash,
        ...(cleanManifestDisplayText(definition?.displayProperties?.description)
          ? { description: cleanManifestDisplayText(definition?.displayProperties?.description) }
          : {}),
        ...(definition?.plug?.plugCategoryIdentifier
          ? { categoryIdentifier: definition.plug.plugCategoryIdentifier }
          : {}),
        ...(definition?.investmentStats?.length ? { investmentStats: definition.investmentStats } : {})
      }];
    }))
  };
}

function cleanManifestDisplayText(value: string | undefined): string {
  return (value ?? "")
    .replace(/[\(（]\s*\{var:\d+\}(?:\s*\/\s*\{var:\d+\})*\s*[\)）]/gi, "")
    .replace(/\{var:\d+\}/gi, "")
    .replace(/\s*\/\s*(?=$|[\)）])/g, "")
    .replace(/[\(（]\s*[\)）]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function mergeCurrencyBalances(
  target: Record<string, number>,
  data: CurrencyLookupData | undefined
): void {
  const itemQuantities = data?.itemQuantities;
  if (Array.isArray(itemQuantities)) {
    for (const item of itemQuantities) {
      if (item.itemHash !== undefined) target[String(item.itemHash)] = item.quantity ?? 0;
    }
  } else {
    for (const [itemHash, quantity] of Object.entries(itemQuantities ?? {})) {
      target[itemHash] = quantity;
    }
  }
  for (const [itemHash, item] of Object.entries(data?.items ?? {})) {
    target[itemHash] = item.quantity ?? 0;
  }
}

function createFetchJson(options: FetchVendorInventorySnapshotOptions) {
  return async function fetchJson<T>(path: string, accessToken?: string): Promise<T> {
    const url = new URL(path.replace(/^\//, ""), "https://www.bungie.net/Platform/");
    const response = await (options.fetchImpl ?? fetch)(url, {
      signal: options.signal,
      headers: {
        "X-API-Key": options.apiKey,
        "Authorization": `Bearer ${accessToken ?? options.accessToken}`,
        "Accept": "application/json"
      }
    });
    if (!response.ok) throw new Error(`Bungie request failed: HTTP ${response.status}`);
    const body = await response.json() as { ErrorCode?: number; Message?: string; Response?: T };
    if (body.ErrorCode !== undefined && body.ErrorCode !== 1) {
      throw new Error(`Bungie API error ${body.ErrorCode}: ${body.Message ?? "Unknown error"}`);
    }
    return (body.Response ?? body) as T;
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
