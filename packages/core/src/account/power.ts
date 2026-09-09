import type { AccountItemSummary } from "./summary.js";

export type AccountPowerSlotKey =
  | "kinetic"
  | "energy"
  | "power"
  | "helmet"
  | "gauntlets"
  | "chest"
  | "legs"
  | "class-item";

export type AccountPowerCandidate<Source> = {
  item: AccountItemSummary;
  source: Source;
  source_rank: number;
};

export type AccountPowerFraction = {
  complete: boolean;
  item_count: number;
  total: number;
  whole?: number;
  remainder?: number;
  exact?: number;
};

export const accountPowerSlotOrder: readonly AccountPowerSlotKey[] = [
  "kinetic",
  "energy",
  "power",
  "helmet",
  "gauntlets",
  "chest",
  "legs",
  "class-item"
];

export const accountPowerSlotLabels: Record<AccountPowerSlotKey, string> = {
  kinetic: "动能武器",
  energy: "能量武器",
  power: "威能武器",
  helmet: "头盔",
  gauntlets: "臂铠",
  chest: "胸甲",
  legs: "腿甲",
  "class-item": "职业物品"
};

const bucketHashToSlot = new Map<number, AccountPowerSlotKey>([
  [1498876634, "kinetic"],
  [2465295065, "energy"],
  [953998645, "power"],
  [3448274439, "helmet"],
  [3551918588, "gauntlets"],
  [14239492, "chest"],
  [20886954, "legs"],
  [1585787867, "class-item"]
]);

const bucketNameToSlot = new Map<string, AccountPowerSlotKey>([
  ["动能武器", "kinetic"],
  ["能量武器", "energy"],
  ["威能武器", "power"],
  ["头盔", "helmet"],
  ["臂铠", "gauntlets"],
  ["胸甲", "chest"],
  ["腿甲", "legs"],
  ["职业物品", "class-item"],
  ["Kinetic Weapons", "kinetic"],
  ["Energy Weapons", "energy"],
  ["Power Weapons", "power"],
  ["Helmet", "helmet"],
  ["Gauntlets", "gauntlets"],
  ["Chest Armor", "chest"],
  ["Leg Armor", "legs"],
  ["Class Armor", "class-item"]
]);

// Bungie 的 canEquip 描述物品在“当前状态”下能否直接装备，而不是物品经过
// 合法准备步骤后是否永远不可装备。最高光等规划会自行处理以下可恢复限制：
// 2 = 当前异域唯一装备冲突；16 = 物品当前不在目标角色身上。
// 其他限制（等级、未解锁、物品本身不可装备等）仍然是硬阻断；
// can_equip=false 但原因码为 0 也按硬阻断处理，不能猜测其可恢复性。
const recoverablePowerEquipFailureMask = 2 | 16;

export function getAccountPowerSlot(item: AccountItemSummary): AccountPowerSlotKey | undefined {
  if (item.bucket_hash && bucketHashToSlot.has(item.bucket_hash)) {
    return bucketHashToSlot.get(item.bucket_hash);
  }
  const bucketName = item.bucket_name?.trim();
  if (bucketName) {
    const slot = bucketNameToSlot.get(bucketName);
    if (slot) return slot;
  }

  // Cached summaries created before the bucket normalization fix may still
  // contain a tier-specific exotic bucket (or group_key=other). Recover the
  // power slot from stable item metadata so one-click planning works before a
  // full account refresh replaces that stale summary.
  if (item.ammo_type === "primary") return "kinetic";
  if (item.ammo_type === "special") return "energy";
  if (item.ammo_type === "heavy") return "power";
  const itemType = item.item_type?.trim() ?? "";
  if (/头盔|helmet/i.test(itemType)) return "helmet";
  if (/职业物品|术士臂环|泰坦标记|猎人披风|class armor|warlock bond|titan mark|hunter cloak|bond/i.test(itemType)) return "class-item";
  if (/臂铠|臂环|臂甲|gauntlet|arm/i.test(itemType)) return "gauntlets";
  if (/胸甲|胸部护甲|chest/i.test(itemType)) return "chest";
  if (/腿甲|腿部护甲|leg armor|boots/i.test(itemType)) return "legs";
  return undefined;
}

export function selectMaxEquippablePowerCandidates<Source>(input: {
  candidates: Array<AccountPowerCandidate<Source>>;
  characterClassName: string;
}): Map<AccountPowerSlotKey, AccountPowerCandidate<Source>> {
  const compatibleCandidates = input.candidates.filter((candidate) => (
    candidate.item.instance_id
    && typeof candidate.item.power === "number"
    && canBecomeEquippableForPowerPlan(candidate.item)
    && canEquipOnCharacter(candidate.item, input.characterClassName)
  ));
  const candidatesBySlot = groupCandidatesBySlot(compatibleCandidates);
  return new Map([
    ...selectBestCompatibleGroup(["kinetic", "energy", "power"], candidatesBySlot),
    ...selectBestCompatibleGroup(["helmet", "gauntlets", "chest", "legs", "class-item"], candidatesBySlot)
  ]);
}

export function selectHighestSlotPowerCandidates<Source>(input: {
  candidates: Array<AccountPowerCandidate<Source>>;
  characterClassName: string;
}): Map<AccountPowerSlotKey, AccountPowerCandidate<Source>> {
  const candidatesBySlot = groupCandidatesBySlot(input.candidates.filter((candidate) => (
    candidate.item.instance_id
    && typeof candidate.item.power === "number"
    && canBecomeEquippableForPowerPlan(candidate.item)
    && canEquipOnCharacter(candidate.item, input.characterClassName)
  )));
  const selected = new Map<AccountPowerSlotKey, AccountPowerCandidate<Source>>();
  for (const slot of accountPowerSlotOrder) {
    const candidate = [...(candidatesBySlot.get(slot) ?? [])].sort(compareCandidates)[0];
    if (candidate) selected.set(slot, candidate);
  }
  return selected;
}

/**
 * Selects the account-wide item used as the reward drop baseline for each
 * Power slot. This is intentionally different from an equippable plan:
 * class restrictions and the one-exotic-at-a-time rule do not apply here.
 */
export function selectAccountDropBaselinePowerCandidates<Source>(input: {
  candidates: Array<AccountPowerCandidate<Source>>;
}): Map<AccountPowerSlotKey, AccountPowerCandidate<Source>> {
  const candidatesBySlot = groupCandidatesBySlot(input.candidates.filter((candidate) => (
    Boolean(candidate.item.instance_id)
    && typeof candidate.item.power === "number"
    && Number.isFinite(candidate.item.power)
  )));
  const selected = new Map<AccountPowerSlotKey, AccountPowerCandidate<Source>>();
  for (const slot of accountPowerSlotOrder) {
    const candidate = [...(candidatesBySlot.get(slot) ?? [])].sort(compareCandidates)[0];
    if (candidate) selected.set(slot, candidate);
  }
  return selected;
}

export function calculateAccountPowerFraction<Source>(
  selection: ReadonlyMap<AccountPowerSlotKey, AccountPowerCandidate<Source>>
): AccountPowerFraction {
  const selected = accountPowerSlotOrder.flatMap((slot) => {
    const candidate = selection.get(slot);
    return candidate ? [candidate] : [];
  });
  const total = selected.reduce((sum, candidate) => sum + (candidate.item.power ?? 0), 0);
  if (selected.length !== accountPowerSlotOrder.length) {
    return { complete: false, item_count: selected.length, total };
  }
  return {
    complete: true,
    item_count: selected.length,
    total,
    whole: Math.floor(total / accountPowerSlotOrder.length),
    remainder: total % accountPowerSlotOrder.length,
    exact: total / accountPowerSlotOrder.length
  };
}

function groupCandidatesBySlot<Source>(
  candidates: Array<AccountPowerCandidate<Source>>
): Map<AccountPowerSlotKey, Array<AccountPowerCandidate<Source>>> {
  const grouped = new Map<AccountPowerSlotKey, Array<AccountPowerCandidate<Source>>>();
  for (const candidate of candidates) {
    const slot = getAccountPowerSlot(candidate.item);
    if (!slot) continue;
    const entries = grouped.get(slot) ?? [];
    entries.push(candidate);
    grouped.set(slot, entries);
  }
  return grouped;
}

function selectBestCompatibleGroup<Source>(
  slots: readonly AccountPowerSlotKey[],
  candidatesBySlot: ReadonlyMap<AccountPowerSlotKey, Array<AccountPowerCandidate<Source>>>
): Map<AccountPowerSlotKey, AccountPowerCandidate<Source>> {
  const optionsBySlot = slots.map((slot) => {
    const sorted = [...(candidatesBySlot.get(slot) ?? [])].sort(compareCandidates);
    return {
      slot,
      options: [
        sorted.find((candidate) => !isExotic(candidate.item)),
        sorted.find((candidate) => isExotic(candidate.item))
      ].filter((candidate): candidate is AccountPowerCandidate<Source> => Boolean(candidate))
    };
  });
  let bestSelection: Array<AccountPowerCandidate<Source> | undefined> | undefined;

  function visit(index: number, selection: Array<AccountPowerCandidate<Source> | undefined>, exoticCount: number) {
    if (index >= optionsBySlot.length) {
      if (!bestSelection || isBetterSelection(selection, bestSelection)) bestSelection = [...selection];
      return;
    }
    const options = optionsBySlot[index].options;
    let visited = false;
    for (const candidate of options) {
      const nextExoticCount = exoticCount + (isExotic(candidate.item) ? 1 : 0);
      if (nextExoticCount > 1) continue;
      visited = true;
      selection.push(candidate);
      visit(index + 1, selection, nextExoticCount);
      selection.pop();
    }
    if (!visited) {
      selection.push(undefined);
      visit(index + 1, selection, exoticCount);
      selection.pop();
    }
  }

  visit(0, [], 0);
  const selected = new Map<AccountPowerSlotKey, AccountPowerCandidate<Source>>();
  bestSelection?.forEach((candidate, index) => {
    if (candidate) selected.set(optionsBySlot[index].slot, candidate);
  });
  return selected;
}

function isBetterSelection<Source>(
  candidate: Array<AccountPowerCandidate<Source> | undefined>,
  current: Array<AccountPowerCandidate<Source> | undefined>
): boolean {
  const candidatePower = totalSelectionPower(candidate);
  const currentPower = totalSelectionPower(current);
  if (candidatePower !== currentPower) return candidatePower > currentPower;
  const candidateCount = candidate.filter(Boolean).length;
  const currentCount = current.filter(Boolean).length;
  if (candidateCount !== currentCount) return candidateCount > currentCount;
  const candidateExotics = candidate.filter((entry) => entry && isExotic(entry.item)).length;
  const currentExotics = current.filter((entry) => entry && isExotic(entry.item)).length;
  if (candidateExotics !== currentExotics) return candidateExotics < currentExotics;
  const candidateRank = candidate.reduce((sum, entry) => sum + (entry?.source_rank ?? 0), 0);
  const currentRank = current.reduce((sum, entry) => sum + (entry?.source_rank ?? 0), 0);
  return candidateRank < currentRank;
}

function totalSelectionPower<Source>(selection: Array<AccountPowerCandidate<Source> | undefined>): number {
  return selection.reduce((sum, candidate) => sum + (candidate?.item.power ?? 0), 0);
}

function compareCandidates<Source>(
  left: AccountPowerCandidate<Source>,
  right: AccountPowerCandidate<Source>
): number {
  return (right.item.power ?? 0) - (left.item.power ?? 0)
    || left.source_rank - right.source_rank
    || left.item.name.localeCompare(right.item.name, "zh-Hans-CN")
    || (left.item.instance_id ?? "").localeCompare(right.item.instance_id ?? "");
}

function canEquipOnCharacter(item: AccountItemSummary, characterClassName: string): boolean {
  if (item.group_key !== "armor" || item.class_type === undefined || item.class_type === 3) return true;
  return item.class_type === classTypeForCharacter(characterClassName);
}

function canBecomeEquippableForPowerPlan(item: AccountItemSummary): boolean {
  const instance = item.instance;
  if (!instance || instance.can_equip !== false) return true;
  const reason = instance.cannot_equip_reason;
  if (typeof reason !== "number" || reason === 0) return false;
  return (reason & ~recoverablePowerEquipFailureMask) === 0;
}

function classTypeForCharacter(className: string): number | undefined {
  if (className === "泰坦" || /^titan$/i.test(className)) return 0;
  if (className === "猎人" || /^hunter$/i.test(className)) return 1;
  if (className === "术士" || /^warlock$/i.test(className)) return 2;
  return undefined;
}

function isExotic(item: AccountItemSummary): boolean {
  return /^(?:异域|exotic)$/i.test(item.tier?.trim() ?? "");
}
