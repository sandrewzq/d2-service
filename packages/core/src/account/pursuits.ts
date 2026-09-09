import type { DefinitionComponentData, DefinitionRecord } from "../manifest/definitions.js";
import type { AccountItemSummary, AccountSummary, DestinyProfileResponse } from "./summary.js";

export type AccountPursuitCompletionState =
  | "in_progress"
  | "completed_pending_action"
  | "completed_confirmed"
  | "expired"
  | "unknown";

export type AccountPursuit = {
  id: string;
  kind: "quest" | "bounty" | "seasonal" | "milestone" | "unknown";
  name: string;
  icon?: string;
  character_id: string;
  class_name: string;
  type_label: string;
  tracked: boolean;
  completion_state: AccountPursuitCompletionState;
  progress_label?: string;
  progress_percent?: number;
  expiration_date?: string;
  reward_hashes: number[];
  quest_step?: { step: number; total: number };
  source: "inventory_item" | "character_milestone" | "record";
  source_hash?: number;
  item_hash?: number;
  observed_at?: string;
};

export type AccountPursuitSummary = {
  items: AccountPursuit[];
  total_count: number;
  pending_count: number;
  expiring_count: number;
  tracked_count: number;
  data_state: "confirmed" | "partial";
  observed_at?: string;
};

export function buildAccountPursuitSummary(
  account: Pick<AccountSummary, "characters" | "profile_minted_at"> | null,
  now = Date.now()
): AccountPursuitSummary {
  if (!account) {
    return {
      items: [],
      total_count: 0,
      pending_count: 0,
      expiring_count: 0,
      tracked_count: 0,
      data_state: "partial"
    };
  }

  const observedAt = account.profile_minted_at;
  const items = account.characters.flatMap((character) => (
    [...character.equipped_items, ...character.inventory_items, ...character.postmaster_items]
      .filter((item) => Boolean(item.pursuit))
      .map((item) => toPursuit(item, character.character_id, character.class_name, observedAt, now))
  ));
  const sorted = items.sort((left, right) => comparePursuits(left, right, now));
  return {
    items: sorted,
    total_count: sorted.length,
    pending_count: sorted.filter((item) => item.completion_state === "completed_pending_action").length,
    expiring_count: sorted.filter((item) => isExpiring(item, now)).length,
    tracked_count: sorted.filter(isActiveTracked).length,
    // This helper only sees task-like inventory items from the equipment
    // snapshot. Milestones and seasonal records are confirmed by the full
    // pursuit resource builder below.
    data_state: "partial",
    ...(observedAt ? { observed_at: observedAt } : {})
  };
}

/** 将 CharacterProgressions（202）中的角色里程碑任务合并到摘要。 */
export function buildAccountPursuitSummaryFromProfile(input: {
  account: Pick<AccountSummary, "characters" | "profile_minted_at">;
  profile: DestinyProfileResponse;
  itemDefinitions?: DefinitionComponentData;
  recordDefinitions?: DefinitionComponentData;
  presentationNodeDefinitions?: DefinitionComponentData;
  seasonalChallengesPresentationNodeHash?: number;
  now?: number;
}): AccountPursuitSummary {
  const now = input.now ?? Date.now();
  const profileObservedAt = normalizeTimestamp(input.profile.responseMintedTimestamp);
  const base = buildAccountPursuitSummary({
    ...input.account,
    profile_minted_at: profileObservedAt ?? input.account.profile_minted_at
  }, now);
  const inventoryQuestKeys = new Set(base.items.flatMap((item) => (
    item.item_hash ? [`${item.character_id}:${item.item_hash}`] : []
  )));
  const milestoneItems = Object.entries(input.profile.characterProgressions?.data ?? {}).flatMap(([characterId, progression]) => {
    const character = input.account.characters.find((entry) => entry.character_id === characterId);
    if (!character) return [];
    return Object.entries(progression.milestones ?? {}).flatMap(([milestoneHashValue, milestone]) => {
      const milestoneHash = Number(milestoneHashValue);
      return (milestone.availableQuests ?? []).flatMap((quest) => {
        if (typeof quest.questItemHash !== "number") return [];
        const id = `${characterId}:milestone:${milestoneHash}:${quest.questItemHash}`;
        if (inventoryQuestKeys.has(`${characterId}:${quest.questItemHash}`)) return [];
        const definition = input.itemDefinitions?.[String(quest.questItemHash)] as DefinitionRecord | undefined;
        const status = quest.status;
        const objectives = status?.stepObjectives ?? [];
        const expirationDate = milestone.endDate;
        const expired = Boolean(
          expirationDate
          && Date.parse(expirationDate) <= now
          && !(status?.completed && definition?.inventory?.suppressExpirationWhenObjectivesComplete)
        );
        const completionState: AccountPursuitCompletionState = expired
          ? "expired"
          : status?.redeemed
            ? "completed_confirmed"
            : status?.completed
              ? "completed_pending_action"
              : objectives.length || status?.started
                ? "in_progress"
                : "unknown";
        const progress = summarizeObjectiveProgress(objectives);
        return [{
          id,
          kind: "milestone" as const,
          name: definition?.displayProperties?.name?.trim() || `任务 ${quest.questItemHash}`,
          icon: normalizeAssetUrl(definition?.displayProperties?.icon),
          character_id: characterId,
          class_name: character.class_name,
          type_label: definition?.itemTypeDisplayName?.trim() || "角色目标",
          tracked: status?.tracked === true,
          completion_state: completionState,
          ...(progress ?? {}),
          ...(expirationDate ? { expiration_date: expirationDate } : {}),
          reward_hashes: [],
          source: "character_milestone" as const,
          source_hash: milestoneHash,
          item_hash: quest.questItemHash,
          ...(base.observed_at ? { observed_at: base.observed_at } : {})
        } satisfies AccountPursuit];
      });
    });
  });
  const items = [...base.items, ...milestoneItems]
    .sort((left, right) => comparePursuits(left, right, now));
  const seasonalRecords = collectPresentationNodeRecordHashes(
    input.seasonalChallengesPresentationNodeHash,
    input.presentationNodeDefinitions
  );
  const trackedRecordHash = input.profile.profileRecords?.data?.trackedRecordHash;
  const recordItems = [...seasonalRecords.hashes].flatMap((recordHash) => {
    const progress = input.profile.profileRecords?.data?.records?.[String(recordHash)];
    const definition = input.recordDefinitions?.[String(recordHash)] as DefinitionRecord | undefined;
    if (!progress || !definition || ((progress.state ?? 0) & 16) === 16) return [];
    const state = progress.state ?? 0;
    const redeemed = (state & 1) === 1;
    const objectivesIncomplete = (state & 4) === 4;
    const expirationDate = definition.expirationInfo?.expirationDate;
    const expired = Boolean(expirationDate && Date.parse(expirationDate) <= now && !redeemed);
    const completionState: AccountPursuitCompletionState = expired
      ? "expired"
      : redeemed
        ? "completed_confirmed"
        : !objectivesIncomplete
          ? "completed_pending_action"
          : (progress.objectives?.length ? "in_progress" : "unknown");
    const objectiveProgress = summarizeObjectiveProgress(progress.objectives ?? []);
    return [{
      id: `account:record:${recordHash}`,
      kind: "seasonal" as const,
      name: definition.displayProperties?.name?.trim() || `赛季挑战 ${recordHash}`,
      icon: normalizeAssetUrl(definition.displayProperties?.icon),
      character_id: "account",
      class_name: "账号",
      type_label: definition.recordTypeName?.trim() || "赛季挑战",
      tracked: trackedRecordHash === recordHash,
      completion_state: completionState,
      ...(objectiveProgress ?? {}),
      ...(expirationDate ? { expiration_date: expirationDate } : {}),
      reward_hashes: (definition.rewardItems ?? []).flatMap((reward) => (
        typeof reward.itemHash === "number" ? [reward.itemHash] : []
      )),
      source: "record" as const,
      source_hash: recordHash,
      ...(base.observed_at ? { observed_at: base.observed_at } : {})
    } satisfies AccountPursuit];
  });
  const allItems = [...items, ...recordItems]
    .sort((left, right) => comparePursuits(left, right, now));
  return {
    items: allItems,
    total_count: allItems.length,
    pending_count: allItems.filter((item) => item.completion_state === "completed_pending_action").length,
    expiring_count: allItems.filter((item) => isExpiring(item, now)).length,
    tracked_count: allItems.filter(isActiveTracked).length,
    data_state: input.profile.characterProgressions?.data
      && input.profile.profileRecords?.data?.records
      && input.seasonalChallengesPresentationNodeHash
      && seasonalRecords.complete
      ? "confirmed"
      : "partial",
    ...(base.observed_at ? { observed_at: base.observed_at } : {})
  };
}

function collectPresentationNodeRecordHashes(
  rootHash: number | undefined,
  definitions: DefinitionComponentData | undefined
): { hashes: Set<number>; complete: boolean } {
  const hashes = new Set<number>();
  if (!rootHash || !definitions) return { hashes, complete: false };
  const pending = [rootHash];
  const visited = new Set<number>();
  let complete = true;
  while (pending.length) {
    const hash = pending.pop()!;
    if (visited.has(hash)) continue;
    visited.add(hash);
    const definition = definitions[String(hash)] as DefinitionRecord | undefined;
    if (!definition) {
      complete = false;
      continue;
    }
    for (const child of definition.children?.presentationNodes ?? []) {
      if (typeof child.presentationNodeHash === "number") pending.push(child.presentationNodeHash);
    }
    for (const child of definition.children?.records ?? []) {
      if (typeof child.recordHash === "number") hashes.add(child.recordHash);
    }
  }
  return { hashes, complete };
}

function toPursuit(
  item: AccountItemSummary,
  characterId: string,
  className: string,
  observedAt: string | undefined,
  now: number
): AccountPursuit {
  const pursuit = item.pursuit!;
  const objectives = item.item_objectives?.filter((objective) => objective.visible !== false) ?? [];
  const progressPercent = objectives.length
    ? Math.round(objectives.reduce((sum, objective) => {
        if (objective.completion_value <= 0) return sum + Number(objective.complete);
        return sum + Math.min(1, Math.max(0, (objective.progress ?? 0) / objective.completion_value));
      }, 0) / objectives.length * 100)
    : undefined;
  const first = objectives[0];
  const expiration = pursuit.expiration_date;
  const expired = Boolean(
    expiration
    && Date.parse(expiration) <= now
    && !(pursuit.complete && pursuit.suppress_expiration_when_complete)
  );
  const completionState: AccountPursuitCompletionState = expired
    ? "expired"
    : pursuit.complete
      ? "completed_pending_action"
      : objectives.length || pursuit.quest_step
        ? "in_progress"
        : "unknown";
  return {
    id: `${characterId}:${item.instance_id ?? item.hash}`,
    kind: pursuit.kind,
    name: item.name,
    icon: item.icon,
    character_id: characterId,
    class_name: className,
    type_label: item.item_type ?? item.bucket_name ?? "任务",
    tracked: pursuit.tracked,
    completion_state: completionState,
    ...(first ? { progress_label: `${first.progress ?? 0}/${first.completion_value}` } : {}),
    ...(progressPercent !== undefined ? { progress_percent: progressPercent } : {}),
    ...(expiration ? { expiration_date: expiration } : {}),
    reward_hashes: pursuit.reward_hashes ?? [],
    ...(pursuit.quest_step ? { quest_step: pursuit.quest_step } : {}),
    source: "inventory_item",
    item_hash: item.hash,
    ...(observedAt ? { observed_at: observedAt } : {})
  };
}

function comparePursuits(left: AccountPursuit, right: AccountPursuit, now: number): number {
  const rank = (item: AccountPursuit): number => {
    if (item.completion_state === "completed_pending_action") return 0;
    if (isExpiring(item, now)) return 1;
    if (item.completion_state === "expired") return 4;
    if (item.completion_state === "completed_confirmed") return 5;
    if (item.tracked) return 2;
    if (item.completion_state === "in_progress") return 3;
    return 5;
  };
  return rank(left) - rank(right)
    || (Date.parse(left.expiration_date ?? "9999-12-31") - Date.parse(right.expiration_date ?? "9999-12-31"))
    || left.character_id.localeCompare(right.character_id)
    || left.id.localeCompare(right.id);
}

function isExpiring(item: AccountPursuit, now: number): boolean {
  if (!item.expiration_date) return false;
  const remaining = Date.parse(item.expiration_date) - now;
  return remaining >= 0 && remaining <= 24 * 60 * 60 * 1000;
}

function isActiveTracked(item: AccountPursuit): boolean {
  return item.tracked
    && item.completion_state !== "expired"
    && item.completion_state !== "completed_confirmed";
}

function summarizeObjectiveProgress(
  objectives: Array<{ progress?: number; completionValue: number; complete: boolean; visible: boolean }>
): Pick<AccountPursuit, "progress_label" | "progress_percent"> | undefined {
  const visible = objectives.filter((objective) => objective.visible !== false);
  if (!visible.length) return undefined;
  const percent = Math.round(visible.reduce((sum, objective) => {
    if (objective.completionValue <= 0) return sum + Number(objective.complete);
    return sum + Math.min(1, Math.max(0, (objective.progress ?? 0) / objective.completionValue));
  }, 0) / visible.length * 100);
  const first = visible[0]!;
  return { progress_label: `${first.progress ?? 0}/${first.completionValue}`, progress_percent: percent };
}

function normalizeAssetUrl(path: string | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `https://www.bungie.net${path}`;
}

function normalizeTimestamp(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}
