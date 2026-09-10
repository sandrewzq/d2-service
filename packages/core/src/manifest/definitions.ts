import type { DestinyManifestMetadata } from "./metadata.js";

export type DefinitionComponentName =
  | "DestinyInventoryItemDefinition"
  | "DestinyInventoryItemConstantsDefinition"
  | "DestinyBreakerTypeDefinition"
  | "DestinyDamageTypeDefinition"
  | "DestinyPlugSetDefinition"
  | "DestinySandboxPerkDefinition"
  | "DestinyCollectibleDefinition"
  | "DestinySeasonDefinition"
  | "DestinyEquipableItemSetDefinition"
  | "DestinyActivityDefinition"
  | "DestinyMilestoneDefinition"
  | "DestinyVendorDefinition"
  | "DestinyVendorGroupDefinition"
  | "DestinyInventoryBucketDefinition"
  | "DestinyLoadoutNameDefinition"
  | "DestinyStatDefinition"
  | "DestinyActivityModifierDefinition"
  | "DestinyDestinationDefinition"
  | "DestinyPlaceDefinition"
  | "DestinyObjectiveDefinition"
  | "DestinyPresentationNodeDefinition"
  | "DestinyRecordDefinition";

export type DefinitionRecord = {
  hash?: number;
  name?: string;
  gearTierOverlayImagePaths?: string[];
  craftedOverlayPath?: string;
  enhancedItemOverlayPath?: string;
  craftedBackgroundPath?: string;
  displayProperties?: {
    name?: string;
    description?: string;
    icon?: string;
    iconHash?: number;
  };
  vendorIdentifier?: string;
  locations?: Array<{
    destinationHash?: number;
  }>;
  itemList?: Array<{
    itemHash?: number;
    displayCategoryIndex?: number;
    redirectToSaleIndexes?: number[];
  }>;
  displayCategories?: Array<{
    identifier?: string;
    displayProperties?: {
      name?: string;
    };
  }>;
  preview?: {
    previewVendorHash?: number;
  };
  categoryName?: string;
  order?: number;
  groups?: Array<{
    vendorGroupHash?: number;
  }>;
  originalDisplayProperties?: {
    name?: string;
    description?: string;
    icon?: string;
  };
  directActivityModeType?: number;
  activityModeTypes?: number[];
  matchmaking?: {
    isMatchmade?: boolean;
  };
  modifiers?: Array<{
    activityModifierHash?: number;
  }>;
  iconWatermark?: string;
  itemTypeDisplayName?: string;
  itemType?: number;
  classType?: number;
  inventory?: {
    tierType?: number;
    tierTypeName?: string;
    bucketTypeHash?: number;
    recipeItemHash?: number;
    suppressExpirationWhenObjectivesComplete?: boolean;
    expiredInActivityMessage?: string;
  };
  itemCategoryHashes?: number[];
  equippingBlock?: {
    ammoType?: number;
    damageType?: number;
    equipmentSlotTypeHash?: number;
    equipableItemSetHash?: number;
  };
  setItems?: number[];
  setPerks?: Array<{
    requiredSetCount?: number;
    sandboxPerkHash?: number;
  }>;
  seasonHash?: number;
  seasonNumber?: number;
  startDate?: string;
  endDate?: string;
  quality?: {
    currentVersion?: number;
    displayVersionWatermarkIcons?: string[];
    versions?: Array<{
      powerCapHash?: number;
    }>;
  };
  defaultDamageType?: number;
  defaultDamageTypeHash?: number;
  damageTypeHashes?: number[];
  breakerType?: number;
  breakerTypeHash?: number;
  enumValue?: number;
  isAdept?: boolean;
  isHolofoil?: boolean;
  sourceData?: {
    sourceString?: string;
  };
  collectibleHash?: number;
  displaySource?: string;
  sourceString?: string;
  value?: {
    itemValue?: Array<{
      itemHash?: number;
      quantity?: number;
    }>;
  };
  objectives?: {
    questlineItemHash?: number;
  };
  setData?: {
    questLineName?: string;
    itemList?: Array<{ itemHash?: number }>;
  };
  sourceHash?: number;
  progressDescription?: string;
  completionValue?: number;
  objectiveHashes?: number[];
  recordTypeName?: string;
  children?: {
    presentationNodes?: Array<{ presentationNodeHash?: number }>;
    records?: Array<{ recordHash?: number }>;
  };
  expirationInfo?: {
    hasExpiration?: boolean;
    expirationDate?: string;
  };
  rewardItems?: Array<{
    itemHash?: number;
    quantity?: number;
  }>;
  translationBlock?: {
    artArrangementHash?: number;
    weaponPatternHash?: number;
    arrangements?: Array<{
      artArrangementHash?: number;
      classHash?: number;
    }>;
  };
  traitIds?: string[];
  stats?: {
    stats?: Record<string, {
      statHash?: number;
      value?: number;
      displayMaximum?: number;
      maximum?: number;
    }>;
  };
  investmentStats?: Array<{
    statTypeHash?: number;
    value?: number;
    isConditionallyActive?: boolean;
  }>;
  perks?: Array<{
    requirementDisplayString?: string;
    perkHash?: number;
    perkVisibility?: number;
  }>;
  reusablePlugItems?: Array<{
    plugItemHash?: number;
  }>;
  itemCount?: number;
  fifo?: boolean;
  scope?: number;
  index?: number;
  sockets?: {
    socketEntries?: Array<{
      reusablePlugItems?: Array<{ plugItemHash?: number }>;
      reusablePlugSetHash?: number;
      randomizedPlugSetHash?: number;
      singleInitialItemHash?: number;
      hidePerksInItemTooltip?: boolean;
    }>;
  };
  plug?: {
    plugCategoryHash?: number;
    plugCategoryIdentifier?: string;
    energyCost?: {
      energyCost?: number;
    };
  };
  [key: string]: unknown;
};

export type DefinitionComponentData = Record<string, DefinitionRecord>;

export type DefinitionComponentStatus = {
  initialized: boolean;
  component?: DefinitionComponentName;
  language?: string;
  cached_at?: string;
  count?: number;
};

export const requiredDefinitionComponents: DefinitionComponentName[] = [
  "DestinyInventoryItemDefinition",
  "DestinyInventoryItemConstantsDefinition",
  "DestinyBreakerTypeDefinition",
  "DestinyDamageTypeDefinition",
  "DestinyPlugSetDefinition",
  "DestinySandboxPerkDefinition",
  "DestinyCollectibleDefinition",
  "DestinySeasonDefinition",
  "DestinyEquipableItemSetDefinition",
  "DestinyActivityDefinition",
  "DestinyMilestoneDefinition",
  "DestinyVendorDefinition",
  "DestinyInventoryBucketDefinition",
  "DestinyLoadoutNameDefinition",
  "DestinyStatDefinition",
  "DestinyActivityModifierDefinition",
  "DestinyDestinationDefinition",
  "DestinyPlaceDefinition",
  "DestinyObjectiveDefinition"
];

export function selectDefinitionComponentPath(
  metadata: DestinyManifestMetadata,
  language: string,
  component: DefinitionComponentName
): string {
  const paths = metadata.jsonWorldComponentContentPaths;
  if (!paths) {
    throw new Error("Manifest metadata does not include JSON component paths");
  }

  const normalizedLanguage = language.trim().toLowerCase();
  const languagePaths = paths[normalizedLanguage] ?? paths.en ?? Object.values(paths)[0];
  const componentPath = languagePaths?.[component];

  if (!componentPath) {
    throw new Error(`Manifest metadata does not include ${component}`);
  }

  return componentPath;
}
