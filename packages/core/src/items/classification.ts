export type EquipmentGroupKey = "weapons" | "armor" | "equipment" | "other";
export type AmmoTypeKey = "primary" | "special" | "heavy";

export type BucketClassification = {
  name: string;
  group: EquipmentGroupKey;
};

export const bucketLabels: Record<number, BucketClassification> = {
  1498876634: { name: "动能武器", group: "weapons" },
  2465295065: { name: "能量武器", group: "weapons" },
  953998645: { name: "威能武器", group: "weapons" },
  3448274439: { name: "头盔", group: "armor" },
  3551918588: { name: "臂铠", group: "armor" },
  14239492: { name: "胸甲", group: "armor" },
  20886954: { name: "腿甲", group: "armor" },
  1585787867: { name: "职业物品", group: "armor" },
  3284755031: { name: "职业分支", group: "equipment" },
  4023194814: { name: "机灵", group: "equipment" },
  2025709351: { name: "载具", group: "equipment" },
  284967655: { name: "飞船", group: "equipment" },
  4274335291: { name: "徽标", group: "equipment" },
  4292445962: { name: "公会战旗", group: "equipment" },
  3683254069: { name: "终结技", group: "equipment" },
  1107761855: { name: "动作", group: "equipment" }
};

export const accountEquipmentBucketHashes = [
  1498876634,
  2465295065,
  953998645,
  3448274439,
  3551918588,
  14239492,
  20886954,
  1585787867
] as const;

export const vaultBucketHash = 138197802;

export const postmasterBucketHash = 215593132;

/** Stable Destiny item/category identifiers used by the pursuit center. */
export const pursuitBucketHash = 1345459588;
export const pursuitCategoryHashes = {
  quest: 53,
  questStep: 16,
  bounties: 1784235469,
  repeatableBounties: 713159888,
  seasonalArtifact: 1378222069
} as const;

export const accountCapacityDefinitionBucketHashes = [
  ...accountEquipmentBucketHashes,
  vaultBucketHash,
  postmasterBucketHash
] as const;

export function isPostmasterBucketHash(bucketHash: number | undefined): boolean {
  return typeof bucketHash === "number" && (bucketHash >>> 0) === postmasterBucketHash;
}

export function classifyBucket(bucketHash: number | undefined): BucketClassification | undefined {
  return bucketHash ? bucketLabels[bucketHash] : undefined;
}

export function ammoTypeKey(ammoType: number | undefined): AmmoTypeKey | undefined {
  switch (ammoType) {
    case 1:
      return "primary";
    case 2:
      return "special";
    case 3:
      return "heavy";
    default:
      return undefined;
  }
}
