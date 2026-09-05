import type {
  AccountItemActionPatch,
  AccountItemSummary,
  AccountSummary
} from "../../../api/types";

export type AccountItemViewLocation =
  | { kind: "vault" }
  | { kind: "equipped" | "inventory" | "postmaster"; characterId: string };

export function resolveAccountItemViewLocation(
  account: AccountSummary | null,
  instanceId: string | undefined
): AccountItemViewLocation | null {
  if (!account || !instanceId) return null;
  if (account.vault.items.some((item) => item.instance_id === instanceId)) {
    return { kind: "vault" };
  }
  for (const character of account.characters) {
    if (character.equipped_items.some((item) => item.instance_id === instanceId)) {
      return { kind: "equipped", characterId: character.character_id };
    }
    if (character.inventory_items.some((item) => item.instance_id === instanceId)) {
      return { kind: "inventory", characterId: character.character_id };
    }
    if (character.postmaster_items.some((item) => item.instance_id === instanceId)) {
      return { kind: "postmaster", characterId: character.character_id };
    }
  }
  return null;
}

export function isAccountItemActionPatchReflected(
  account: AccountSummary,
  patch: AccountItemActionPatch
): boolean {
  if (patch.kind === "lock") {
    return findAccountItem(account, patch.item_instance_id)?.locked === patch.locked;
  }
  const location = resolveAccountItemViewLocation(account, patch.item_instance_id);
  if (!location) return false;
  if (patch.kind === "equip") {
    return location.kind === "equipped" && location.characterId === patch.character_id;
  }
  if (patch.kind === "postmaster-pull") {
    return (location.kind === "inventory" || location.kind === "equipped")
      && location.characterId === patch.character_id;
  }
  if (patch.target === "vault") return location.kind === "vault";
  return (location.kind === "inventory" || location.kind === "equipped")
    && location.characterId === patch.character_id;
}

function findAccountItem(
  account: AccountSummary,
  instanceId: string
): AccountItemSummary | undefined {
  const vaultItem = account.vault.items.find((item) => item.instance_id === instanceId);
  if (vaultItem) return vaultItem;
  for (const character of account.characters) {
    const item = character.equipped_items.find((candidate) => candidate.instance_id === instanceId)
      ?? character.inventory_items.find((candidate) => candidate.instance_id === instanceId)
      ?? character.postmaster_items.find((candidate) => candidate.instance_id === instanceId);
    if (item) return item;
  }
  return undefined;
}
