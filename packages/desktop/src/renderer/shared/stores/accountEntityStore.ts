import { useCallback, useRef, useSyncExternalStore } from "react";
import type {
  AccountItemActionPatch,
  AccountItemSummary,
  AccountSummary,
  CharacterEquipmentGroup
} from "../../api/types";
import { isAccountItemActionPatchReflected } from "../domain/account/itemActionState";

export type AccountItemEntityKey = string;
export type AccountCharacterContainer = "equipped" | "inventory" | "postmaster";

type NormalizedEquipmentGroup = Omit<CharacterEquipmentGroup, "items">;

type NormalizedCharacter = Omit<
  AccountSummary["characters"][number],
  | "equipped_items"
  | "equipment_groups"
  | "inventory_items"
  | "inventory_groups"
  | "postmaster_items"
> & {
  equippedItemKeys: AccountItemEntityKey[];
  equipmentGroups: NormalizedEquipmentGroup[];
  inventoryItemKeys: AccountItemEntityKey[];
  inventoryGroups: NormalizedEquipmentGroup[];
  postmasterItemKeys: AccountItemEntityKey[];
};

type NormalizedAccountState = {
  account: Omit<AccountSummary, "characters" | "vault"> | null;
  characterIds: string[];
  charactersById: Record<string, NormalizedCharacter>;
  itemsByKey: Record<AccountItemEntityKey, AccountItemSummary>;
  itemKeyByInstanceId: Record<string, AccountItemEntityKey>;
  vault: {
    capacity?: number;
    itemKeys: AccountItemEntityKey[];
    sampleItemKeys: AccountItemEntityKey[];
  };
  revision: number;
};

export type VaultAccountStoreSnapshot = Pick<
  AccountSummary,
  "account_name" | "destiny_membership_id" | "membership_type" | "profile_minted_at"
> & {
  characters: Array<Pick<
    AccountSummary["characters"][number],
    "character_id" | "class_name" | "light" | "loadout_slots"
  > & {
    equipped_items: AccountItemSummary[];
    inventory_items: AccountItemSummary[];
    postmaster_items: AccountItemSummary[];
  }>;
  vault: Pick<AccountSummary["vault"], "item_count" | "capacity" | "items">;
};

const emptyState: NormalizedAccountState = {
  account: null,
  characterIds: [],
  charactersById: {},
  itemsByKey: {},
  itemKeyByInstanceId: {},
  vault: { capacity: undefined, itemKeys: [], sampleItemKeys: [] },
  revision: 0
};
const emptyItemKeys: readonly AccountItemEntityKey[] = [];

let confirmedState = emptyState;
let state = emptyState;
let cachedSummaryState: NormalizedAccountState | null = null;
let cachedSummary: AccountSummary | null = null;
let cachedVaultAccountState: NormalizedAccountState | null = null;
let cachedVaultAccount: VaultAccountStoreSnapshot | null = null;
let accountSnapshotGeneration = 0;
let cachedWorkspaceGeneration = -1;
let cachedWorkspaceSummary: AccountSummary | null = null;
const listeners = new Set<() => void>();
const committedPatchesByInstanceId = new Map<string, AccountItemActionPatch>();
const verifiedPatchesByInstanceId = new Map<string, {
  patch: AccountItemActionPatch;
  profileVersion: number;
}>();

export function replaceAccountSummary(
  summary: AccountSummary | null,
  options: { requestStartedRevision?: number; authoritative?: boolean } = {}
): boolean {
  const startedBeforeCurrentState = options.requestStartedRevision !== undefined
    && options.requestStartedRevision < state.revision;
  if (summary
    && state.account
    && startedBeforeCurrentState
    && !options.authoritative
    && accountProfileVersion(summary) === 0) {
    return false;
  }
  if (!summary) {
    committedPatchesByInstanceId.clear();
    verifiedPatchesByInstanceId.clear();
    confirmedState = {
      ...emptyState,
      revision: state.revision + 1
    };
    state = confirmedState;
    accountSnapshotGeneration += 1;
    emitChange();
    return true;
  }

  const incomingProfileVersion = accountProfileVersion(summary);
  const currentProfileVersion = accountProfileVersion(confirmedState.account);
  if (confirmedState.account && currentProfileVersion > 0) {
    if (incomingProfileVersion === 0 || incomingProfileVersion < currentProfileVersion) {
      return false;
    }
  }

  const reflectedPatches: AccountItemActionPatch[] = [];
  for (const [instanceId, patch] of committedPatchesByInstanceId) {
    if (isAccountItemActionPatchReflected(summary, patch)) {
      committedPatchesByInstanceId.delete(instanceId);
      reflectedPatches.push(patch);
    }
  }
  for (const [instanceId, verified] of verifiedPatchesByInstanceId) {
    if (isAccountItemActionPatchReflected(summary, verified.patch)) {
      verifiedPatchesByInstanceId.delete(instanceId);
      reflectedPatches.push(verified.patch);
    } else if (incomingProfileVersion > verified.profileVersion) {
      // 完整 Profile 已越过轻量核对版本，之后以这个更新版本为准。
      verifiedPatchesByInstanceId.delete(instanceId);
    }
  }

  // Bungie 可能在相同 minted timestamp 下返回不同内容。与 DIM 一样，
  // 相同版本不能重建当前页面，否则延迟响应会把刚完成的本地写入覆盖掉；
  // 但仍允许它确认已经反映出来的逐实例 Pending。
  if (
    confirmedState.account
    && incomingProfileVersion > 0
    && incomingProfileVersion === currentProfileVersion
  ) {
    if (reflectedPatches.length) {
      // 相同版本只吸收已经由逐实例事实确认的写入，不让整份响应覆盖
      // 其他页面状态。这样既能结束 Pending，也保留严格单调的快照边界。
      let nextConfirmed = confirmedState;
      for (const patch of reflectedPatches) {
        nextConfirmed = ensureCommittedPatchItem(nextConfirmed, state, patch);
        nextConfirmed = applyPatch(nextConfirmed, patch);
      }
      confirmedState = { ...nextConfirmed, revision: state.revision + 1 };
      state = projectCommittedAccountState(confirmedState, state, state.revision + 1);
      emitChange();
    }
    return true;
  }

  accountSnapshotGeneration += 1;
  confirmedState = normalizeAccountSummary(summary, state.revision + 1);
  state = projectCommittedAccountState(confirmedState, state, state.revision + 1);
  emitChange();
  return true;
}

export function applyAccountEntityPatches(patches: readonly AccountItemActionPatch[]): void {
  if (!state.account || !patches.length) return;
  let nextConfirmed = confirmedState;
  let next = state;
  for (const patch of patches) {
    nextConfirmed = applyPatch(nextConfirmed, patch);
    next = applyPatch(next, patch);
  }
  if (next === state) return;
  confirmedState = { ...nextConfirmed, revision: state.revision + 1 };
  state = { ...next, revision: state.revision + 1 };
  emitChange();
}

export function applyCommittedAccountEntityPatches(patches: readonly AccountItemActionPatch[]): void {
  if (!state.account || !patches.length) return;
  for (const patch of patches) clearConflictingCommittedPatches(patch);
  for (const patch of patches) {
    committedPatchesByInstanceId.delete(patch.item_instance_id);
    verifiedPatchesByInstanceId.delete(patch.item_instance_id);
    committedPatchesByInstanceId.set(patch.item_instance_id, patch);
  }
  state = projectCommittedAccountState(confirmedState, state, state.revision + 1);
  emitChange();
}

export function discardCommittedAccountEntityPatches(patches: readonly AccountItemActionPatch[]): void {
  let changed = false;
  for (const patch of patches) {
    const committedPatch = committedPatchesByInstanceId.get(patch.item_instance_id);
    if (isSameAccountItemActionPatch(committedPatch, patch)) {
      committedPatchesByInstanceId.delete(patch.item_instance_id);
      changed = true;
    }
  }
  if (changed) {
    state = projectCommittedAccountState(confirmedState, state, state.revision + 1);
    emitChange();
  }
}

export function confirmCommittedAccountEntityPatches(
  patches: readonly AccountItemActionPatch[],
  profileMintedAt?: string
): void {
  let changed = false;
  let nextConfirmed = confirmedState;
  const verifiedProfileVersion = accountProfileVersion({ profile_minted_at: profileMintedAt })
    || accountProfileVersion(confirmedState.account);
  for (const patch of patches) {
    const committedPatch = committedPatchesByInstanceId.get(patch.item_instance_id);
    if (!isSameAccountItemActionPatch(committedPatch, patch)) continue;
    nextConfirmed = ensureCommittedPatchItem(nextConfirmed, state, patch);
    nextConfirmed = applyPatch(nextConfirmed, patch);
    committedPatchesByInstanceId.delete(patch.item_instance_id);
    verifiedPatchesByInstanceId.set(patch.item_instance_id, {
      patch,
      profileVersion: verifiedProfileVersion
    });
    changed = true;
  }
  if (changed) {
    const nextAccount = nextConfirmed.account
      && profileMintedAt
      && verifiedProfileVersion > accountProfileVersion(nextConfirmed.account)
      ? { ...nextConfirmed.account, profile_minted_at: profileMintedAt }
      : nextConfirmed.account;
    confirmedState = { ...nextConfirmed, account: nextAccount, revision: state.revision + 1 };
    state = projectCommittedAccountState(confirmedState, state, state.revision + 1);
    emitChange();
  }
}

export function getPendingCommittedAccountPatchCount(): number {
  return committedPatchesByInstanceId.size;
}

export function getAccountSummarySnapshot(): AccountSummary | null {
  if (cachedSummaryState === state) return cachedSummary;
  cachedSummaryState = state;
  cachedSummary = denormalizeAccountSummary(state);
  return cachedSummary;
}

export function getVaultAccountStoreSnapshot(): VaultAccountStoreSnapshot | null {
  if (cachedVaultAccountState === state) return cachedVaultAccount;
  cachedVaultAccountState = state;
  cachedVaultAccount = denormalizeVaultAccountSnapshot(state);
  return cachedVaultAccount;
}

export function getAccountWorkspaceSummarySnapshot(): AccountSummary | null {
  if (cachedWorkspaceGeneration === accountSnapshotGeneration) return cachedWorkspaceSummary;
  cachedWorkspaceGeneration = accountSnapshotGeneration;
  cachedWorkspaceSummary = denormalizeAccountSummary(state);
  return cachedWorkspaceSummary;
}

function getLiveAccountWorkspaceSummarySnapshot(): AccountSummary | null {
  const summary = getAccountSummarySnapshot();
  // 非仓库菜单消费完整实体时，同时推进下一次仓库隔离的起始快照。
  cachedWorkspaceGeneration = accountSnapshotGeneration;
  cachedWorkspaceSummary = summary;
  return summary;
}

export function getAccountStoreRevision(): number {
  return state.revision;
}

export function getAccountItemEntity(instanceId: string): AccountItemSummary | undefined {
  const key = state.itemKeyByInstanceId[instanceId];
  return key ? state.itemsByKey[key] : undefined;
}

export function getVaultItemEntityKeys(): readonly AccountItemEntityKey[] {
  return state.vault.itemKeys;
}

export function getCharacterContainerItemEntityKeys(
  characterId: string,
  container: AccountCharacterContainer
): readonly AccountItemEntityKey[] {
  const character = state.charactersById[characterId];
  if (!character) return emptyItemKeys;
  if (container === "equipped") return character.equippedItemKeys;
  if (container === "inventory") return character.inventoryItemKeys;
  return character.postmasterItemKeys;
}

export function getAccountItemEntityCount(): number {
  return Object.keys(state.itemsByKey).length;
}

export function useAccountSummaryStore(): AccountSummary | null {
  return useAccountStoreSelector(selectAccountSummary);
}

export function useAccountItemEntityStore(instanceId: string): AccountItemSummary | undefined {
  const getSnapshot = useCallback(() => getAccountItemEntity(instanceId), [instanceId]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useVaultItemEntityKeysStore(): readonly AccountItemEntityKey[] {
  return useSyncExternalStore(subscribe, getVaultItemEntityKeys, getVaultItemEntityKeys);
}

export function useCharacterContainerItemEntityKeysStore(
  characterId: string,
  container: AccountCharacterContainer
): readonly AccountItemEntityKey[] {
  const getSnapshot = useCallback(
    () => getCharacterContainerItemEntityKeys(characterId, container),
    [characterId, container]
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useVaultAccountStore(): VaultAccountStoreSnapshot | null {
  return useSyncExternalStore(
    subscribe,
    getVaultAccountStoreSnapshot,
    getVaultAccountStoreSnapshot
  );
}

export function useAccountWorkspaceSummaryStore(
  includeEntityPatches = false
): AccountSummary | null {
  const getSnapshot = useCallback(
    () => includeEntityPatches
      ? getLiveAccountWorkspaceSummarySnapshot()
      : getAccountWorkspaceSummarySnapshot(),
    [includeEntityPatches]
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useHasAccountDataStore(): boolean {
  return useAccountStoreSelector(selectHasAccountData);
}

export function usePendingCommittedAccountPatchCount(): number {
  return useSyncExternalStore(
    subscribe,
    getPendingCommittedAccountPatchCount,
    getPendingCommittedAccountPatchCount
  );
}

export function useAccountStoreSelector<T>(
  selector: (summary: AccountSummary | null) => T,
  isEqual: (left: T, right: T) => boolean = Object.is
): T {
  const selectorRef = useRef(selector);
  const isEqualRef = useRef(isEqual);
  const cacheRef = useRef<{
    revision: number;
    selector: typeof selector;
    value: T;
  } | null>(null);
  selectorRef.current = selector;
  isEqualRef.current = isEqual;

  const getSelectedSnapshot = useCallback(() => {
    const currentSelector = selectorRef.current;
    const cached = cacheRef.current;
    if (cached?.revision === state.revision && cached.selector === currentSelector) {
      return cached.value;
    }

    const selected = currentSelector(getAccountSummarySnapshot());
    const value = cached && isEqualRef.current(cached.value, selected)
      ? cached.value
      : selected;
    cacheRef.current = {
      revision: state.revision,
      selector: currentSelector,
      value
    };
    return value;
  }, []);

  return useSyncExternalStore(subscribe, getSelectedSnapshot, getSelectedSnapshot);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function selectAccountSummary(summary: AccountSummary | null): AccountSummary | null {
  return summary;
}

function clearConflictingCommittedPatches(patch: AccountItemActionPatch): void {
  if (patch.kind !== "equip") return;
  const incomingKey = state.itemKeyByInstanceId[patch.item_instance_id];
  const incomingItem = incomingKey ? state.itemsByKey[incomingKey] : undefined;
  if (!incomingItem) return;
  for (const [instanceId, committedPatch] of committedPatchesByInstanceId) {
    if (committedPatch.kind !== "equip" || committedPatch.character_id !== patch.character_id) continue;
    const existingKey = state.itemKeyByInstanceId[instanceId];
    const existingItem = existingKey ? state.itemsByKey[existingKey] : undefined;
    if (!existingItem) continue;
    const sameSlot = incomingItem.bucket_hash !== undefined
      ? existingItem.bucket_hash === incomingItem.bucket_hash
      : incomingItem.group_key !== "other"
        && existingItem.group_key === incomingItem.group_key;
    if (sameSlot) {
      committedPatchesByInstanceId.delete(instanceId);
    }
  }
  for (const [instanceId, verified] of verifiedPatchesByInstanceId) {
    const verifiedPatch = verified.patch;
    if (verifiedPatch.kind !== "equip" || verifiedPatch.character_id !== patch.character_id) continue;
    const existingKey = state.itemKeyByInstanceId[instanceId];
    const existingItem = existingKey ? state.itemsByKey[existingKey] : undefined;
    if (!existingItem) continue;
    const sameSlot = incomingItem.bucket_hash !== undefined
      ? existingItem.bucket_hash === incomingItem.bucket_hash
      : incomingItem.group_key !== "other"
        && existingItem.group_key === incomingItem.group_key;
    if (sameSlot) {
      verifiedPatchesByInstanceId.delete(instanceId);
    }
  }
}

function accountProfileVersion(
  account: Pick<AccountSummary, "profile_minted_at"> | null
): number {
  if (!account?.profile_minted_at) return 0;
  const timestamp = Date.parse(account.profile_minted_at);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isSameAccountItemActionPatch(
  left: AccountItemActionPatch | undefined,
  right: AccountItemActionPatch
): boolean {
  if (!left || left.kind !== right.kind || left.item_instance_id !== right.item_instance_id) return false;
  if (left.kind === "lock" && right.kind === "lock") return left.locked === right.locked;
  if (left.kind === "equip" && right.kind === "equip") return left.character_id === right.character_id;
  if (left.kind === "postmaster-pull" && right.kind === "postmaster-pull") {
    return left.character_id === right.character_id
      && left.source_bucket_hash === right.source_bucket_hash;
  }
  return left.kind === "transfer" && right.kind === "transfer"
    && left.character_id === right.character_id
    && left.target === right.target;
}

function selectHasAccountData(summary: AccountSummary | null): boolean {
  return summary !== null;
}

function emitChange(): void {
  cachedSummaryState = null;
  cachedVaultAccountState = null;
  for (const listener of listeners) listener();
}

function normalizeAccountSummary(summary: AccountSummary, revision: number): NormalizedAccountState {
  const itemsByKey: Record<AccountItemEntityKey, AccountItemSummary> = {};
  const itemKeyByInstanceId: Record<string, AccountItemEntityKey> = {};
  const registerItems = (items: AccountItemSummary[], location: string): AccountItemEntityKey[] => {
    const occurrences = new Map<number, number>();
    return items.map((item) => {
      const occurrence = occurrences.get(item.hash) ?? 0;
      occurrences.set(item.hash, occurrence + 1);
      const key = createAccountItemEntityKey(item, location, occurrence);
      // The vault sample can contain the same instance as the full list. Keep the
      // first, authoritative entity instead of replacing it with a smaller copy.
      itemsByKey[key] ??= item;
      if (item.instance_id) itemKeyByInstanceId[item.instance_id] = key;
      return key;
    });
  };

  const vaultItemKeys = registerItems(summary.vault.items, "vault");
  const sampleItemKeys = registerItems(summary.vault.sample_items, "vault-sample");
  const charactersById: Record<string, NormalizedCharacter> = {};
  for (const character of summary.characters) {
    const equippedItemKeys = registerItems(character.equipped_items, `${character.character_id}:equipped`);
    const inventoryItemKeys = registerItems(character.inventory_items, `${character.character_id}:inventory`);
    const postmasterItemKeys = registerItems(character.postmaster_items, `${character.character_id}:postmaster`);
    const {
      equipped_items: _equippedItems,
      equipment_groups: equipmentGroups,
      inventory_items: _inventoryItems,
      inventory_groups: inventoryGroups,
      postmaster_items: _postmasterItems,
      ...characterData
    } = character;
    charactersById[character.character_id] = {
      ...characterData,
      equippedItemKeys,
      equipmentGroups: normalizeGroups(equipmentGroups),
      inventoryItemKeys,
      inventoryGroups: normalizeGroups(inventoryGroups),
      postmasterItemKeys
    };
  }

  const { characters: _characters, vault: _vault, ...account } = summary;
  return {
    account,
    characterIds: summary.characters.map((character) => character.character_id),
    charactersById,
    itemsByKey,
    itemKeyByInstanceId,
    vault: { capacity: summary.vault.capacity, itemKeys: vaultItemKeys, sampleItemKeys },
    revision
  };
}

function createAccountItemEntityKey(
  item: AccountItemSummary,
  location: string,
  occurrence: number
): AccountItemEntityKey {
  return item.instance_id
    ? `instance:${item.instance_id}`
    : `definition:${item.hash}:${location}:${occurrence}`;
}

function normalizeGroups(
  groups: CharacterEquipmentGroup[]
): NormalizedEquipmentGroup[] {
  return groups.map(({ items: _items, ...group }) => group);
}

function denormalizeAccountSummary(input: NormalizedAccountState): AccountSummary | null {
  if (!input.account) return null;
  const items = (keys: AccountItemEntityKey[]) => keys
    .map((key) => input.itemsByKey[key])
    .filter((item): item is AccountItemSummary => Boolean(item));
  return {
    ...input.account,
    characters: input.characterIds.flatMap((characterId) => {
      const character = input.charactersById[characterId];
      if (!character) return [];
      const {
        equippedItemKeys,
        equipmentGroups,
        inventoryItemKeys,
        inventoryGroups,
        postmasterItemKeys,
        ...characterData
      } = character;
      return [{
        ...characterData,
        equipped_items: items(equippedItemKeys),
        equipment_groups: denormalizeGroups(equipmentGroups, equippedItemKeys, input.itemsByKey),
        inventory_items: items(inventoryItemKeys),
        inventory_groups: denormalizeGroups(inventoryGroups, inventoryItemKeys, input.itemsByKey),
        postmaster_items: items(postmasterItemKeys)
      }];
    }),
    vault: {
      item_count: input.vault.itemKeys.length,
      capacity: input.vault.capacity,
      items: items(input.vault.itemKeys),
      sample_items: items(input.vault.sampleItemKeys)
    }
  };
}

function denormalizeVaultAccountSnapshot(
  input: NormalizedAccountState
): VaultAccountStoreSnapshot | null {
  if (!input.account) return null;
  const items = (keys: AccountItemEntityKey[]) => keys
    .map((key) => input.itemsByKey[key])
    .filter((item): item is AccountItemSummary => Boolean(item));
  return {
    account_name: input.account.account_name,
    destiny_membership_id: input.account.destiny_membership_id,
    membership_type: input.account.membership_type,
    profile_minted_at: input.account.profile_minted_at,
    characters: input.characterIds.flatMap((characterId) => {
      const character = input.charactersById[characterId];
      if (!character) return [];
      return [{
        character_id: character.character_id,
        class_name: character.class_name,
        light: character.light,
        loadout_slots: character.loadout_slots,
        equipped_items: items(character.equippedItemKeys),
        inventory_items: items(character.inventoryItemKeys),
        postmaster_items: items(character.postmasterItemKeys)
      }];
    }),
    vault: {
      item_count: input.vault.itemKeys.length,
      capacity: input.vault.capacity,
      items: items(input.vault.itemKeys)
    }
  };
}

function denormalizeGroups(
  groups: NormalizedEquipmentGroup[],
  itemKeys: AccountItemEntityKey[],
  itemsByKey: Record<AccountItemEntityKey, AccountItemSummary>
): CharacterEquipmentGroup[] {
  return groups.map((group) => {
    const items = itemKeys
      .map((key) => itemsByKey[key])
      .filter((item) => item?.group_key === group.key)
      .filter((item): item is AccountItemSummary => Boolean(item));
    return {
      ...group,
      count: items.length,
      items
    };
  });
}

function applyPatch(
  input: NormalizedAccountState,
  patch: AccountItemActionPatch
): NormalizedAccountState {
  const itemKey = input.itemKeyByInstanceId[patch.item_instance_id];
  const item = itemKey ? input.itemsByKey[itemKey] : undefined;
  if (!itemKey || !item) return input;

  if (patch.kind === "lock") {
    if (item.locked === patch.locked) return input;
    return {
      ...input,
      itemsByKey: {
        ...input.itemsByKey,
        [itemKey]: { ...item, locked: patch.locked }
      }
    };
  }

  const targetCharacter = input.charactersById[patch.character_id];
  if (patch.kind !== "transfer" || patch.target !== "vault") {
    if (!targetCharacter) return input;
  }
  if (patch.kind === "equip" && item.bucket_hash === undefined) return input;

  const detached = detachItemKey(input, itemKey);
  const itemsByKey = { ...detached.itemsByKey };
  const movedItem = withEquippedState(item, patch.kind === "equip");
  itemsByKey[itemKey] = movedItem;

  if (patch.kind === "transfer" && patch.target === "vault") {
    return {
      ...detached,
      itemsByKey,
      vault: { ...detached.vault, itemKeys: [itemKey, ...detached.vault.itemKeys] }
    };
  }

  const charactersById = { ...detached.charactersById };
  const character = charactersById[patch.character_id];
  if (!character) return input;
  if (patch.kind === "transfer" || patch.kind === "postmaster-pull") {
    charactersById[patch.character_id] = {
      ...character,
      inventoryItemKeys: [itemKey, ...character.inventoryItemKeys]
    };
    return { ...detached, itemsByKey, charactersById };
  }

  const displacedKey = character.equippedItemKeys.find((key) => (
    detached.itemsByKey[key]?.bucket_hash === item.bucket_hash
  ));
  const equippedItemKeys = [
    itemKey,
    ...character.equippedItemKeys.filter((key) => key !== displacedKey)
  ];
  const inventoryItemKeys = displacedKey
    ? [displacedKey, ...character.inventoryItemKeys]
    : character.inventoryItemKeys;
  if (displacedKey && itemsByKey[displacedKey]) {
    itemsByKey[displacedKey] = withEquippedState(itemsByKey[displacedKey], false);
  }
  charactersById[patch.character_id] = {
    ...character,
    equippedItemKeys,
    inventoryItemKeys
  };
  return { ...detached, itemsByKey, charactersById };
}

function ensureCommittedPatchItem(
  input: NormalizedAccountState,
  previous: NormalizedAccountState,
  patch: AccountItemActionPatch
): NormalizedAccountState {
  if (input.itemKeyByInstanceId[patch.item_instance_id]) return input;
  const previousKey = previous.itemKeyByInstanceId[patch.item_instance_id];
  const previousItem = previousKey ? previous.itemsByKey[previousKey] : undefined;
  if (!previousKey || !previousItem) return input;
  const charactersById = { ...input.charactersById };
  for (const [characterId, previousCharacter] of Object.entries(previous.charactersById)) {
    const character = charactersById[characterId];
    if (!character) continue;
    const restoreEquipped = previousCharacter.equippedItemKeys.includes(previousKey);
    const restoreInventory = previousCharacter.inventoryItemKeys.includes(previousKey);
    const restorePostmaster = previousCharacter.postmasterItemKeys.includes(previousKey);
    if (!restoreEquipped && !restoreInventory && !restorePostmaster) continue;
    charactersById[characterId] = {
      ...character,
      equippedItemKeys: restoreEquipped
        ? [previousKey, ...character.equippedItemKeys.filter((key) => key !== previousKey)]
        : character.equippedItemKeys,
      inventoryItemKeys: restoreInventory
        ? [previousKey, ...character.inventoryItemKeys.filter((key) => key !== previousKey)]
        : character.inventoryItemKeys,
      postmasterItemKeys: restorePostmaster
        ? [previousKey, ...character.postmasterItemKeys.filter((key) => key !== previousKey)]
        : character.postmasterItemKeys
    };
  }
  return {
    ...input,
    charactersById,
    itemsByKey: {
      ...input.itemsByKey,
      [previousKey]: previousItem
    },
    itemKeyByInstanceId: {
      ...input.itemKeyByInstanceId,
      [patch.item_instance_id]: previousKey
    },
    vault: {
      capacity: input.vault.capacity,
      itemKeys: previous.vault.itemKeys.includes(previousKey)
        ? [previousKey, ...input.vault.itemKeys.filter((key) => key !== previousKey)]
        : input.vault.itemKeys,
      sampleItemKeys: previous.vault.sampleItemKeys.includes(previousKey)
        ? [previousKey, ...input.vault.sampleItemKeys.filter((key) => key !== previousKey)]
        : input.vault.sampleItemKeys
    }
  };
}

function projectCommittedAccountState(
  base: NormalizedAccountState,
  previous: NormalizedAccountState,
  revision: number
): NormalizedAccountState {
  let next = { ...base, revision };
  for (const verified of verifiedPatchesByInstanceId.values()) {
    next = ensureCommittedPatchItem(next, previous, verified.patch);
    next = applyPatch(next, verified.patch);
  }
  for (const patch of committedPatchesByInstanceId.values()) {
    next = ensureCommittedPatchItem(next, previous, patch);
    next = applyPatch(next, patch);
  }
  return { ...next, revision };
}

function detachItemKey(
  input: NormalizedAccountState,
  itemKey: AccountItemEntityKey
): NormalizedAccountState {
  let charactersById = input.charactersById;
  for (const [characterId, character] of Object.entries(input.charactersById)) {
    const equippedItemKeys = removeItemKey(character.equippedItemKeys, itemKey);
    const inventoryItemKeys = removeItemKey(character.inventoryItemKeys, itemKey);
    const postmasterItemKeys = removeItemKey(character.postmasterItemKeys, itemKey);
    if (
      equippedItemKeys === character.equippedItemKeys
      && inventoryItemKeys === character.inventoryItemKeys
      && postmasterItemKeys === character.postmasterItemKeys
    ) continue;
    if (charactersById === input.charactersById) charactersById = { ...input.charactersById };
    charactersById[characterId] = {
      ...character,
      equippedItemKeys,
      inventoryItemKeys,
      postmasterItemKeys
    };
  }
  return {
    ...input,
    charactersById,
    vault: {
      capacity: input.vault.capacity,
      itemKeys: removeItemKey(input.vault.itemKeys, itemKey),
      sampleItemKeys: removeItemKey(input.vault.sampleItemKeys, itemKey)
    }
  };
}

function removeItemKey(
  itemKeys: AccountItemEntityKey[],
  itemKey: AccountItemEntityKey
): AccountItemEntityKey[] {
  return itemKeys.includes(itemKey)
    ? itemKeys.filter((key) => key !== itemKey)
    : itemKeys;
}

function withEquippedState(item: AccountItemSummary, isEquipped: boolean): AccountItemSummary {
  return {
    ...item,
    instance: item.instance ? { ...item.instance, is_equipped: isEquipped } : item.instance
  };
}
