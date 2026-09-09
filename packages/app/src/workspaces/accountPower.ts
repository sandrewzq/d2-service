import {
  accountPowerSlotLabels,
  accountPowerSlotOrder,
  calculateAccountPowerFraction,
  selectAccountDropBaselinePowerCandidates,
  selectMaxEquippablePowerCandidates,
  type AccountPowerCandidate,
  type AccountPowerFraction,
  type AccountPowerSlotKey
} from "@d2-tools/core/account/power";
import type { AccountItemSummary, AccountSummary, CharacterSummary } from "@d2-tools/core/account/summary";

export type CharacterPowerSourceKind =
  | "equipped"
  | "inventory"
  | "vault"
  | "other-character-equipped"
  | "other-character-inventory";

export type CharacterPowerAvailability = "current" | "transferable" | "different-class";

type CharacterPowerSource = {
  kind: CharacterPowerSourceKind;
  character_name?: string;
};

export type CharacterPowerRowView = {
  key: AccountPowerSlotKey;
  label: string;
  itemName?: string;
  itemIcon?: string;
  power?: number;
  delta?: number;
  sourceKind?: CharacterPowerSourceKind;
  sourceCharacterName?: string;
  availability?: CharacterPowerAvailability;
  isExotic: boolean;
};

export type CharacterPowerValueView = {
  complete: boolean;
  whole?: number;
  remainder?: number;
  denominator: 8;
  label: string;
  rows: CharacterPowerRowView[];
};

export type CharacterPowerView = {
  currentLabel: string;
  maxEquippable: CharacterPowerValueView;
  executablePower: CharacterPowerValueView;
  dropBaseline: CharacterPowerValueView;
  hasExternalSources: boolean;
  executableMatchesAccountMaximum: boolean;
};

type Candidate = AccountPowerCandidate<CharacterPowerSource>;

export function buildCharacterPowerView(
  account: AccountSummary,
  character: CharacterSummary
): CharacterPowerView {
  const accountCandidates = collectAccountPowerCandidates(account, character);
  const executableCandidates = accountCandidates.filter((candidate) => (
    candidate.source.kind === "equipped"
    || candidate.source.kind === "inventory"
    || candidate.source.kind === "vault"
  ));
  const equippedSelection = selectMaxEquippablePowerCandidates({
    candidates: accountCandidates.filter((candidate) => candidate.source.kind === "equipped"),
    characterClassName: character.class_name
  });
  const maxEquippableSelection = selectMaxEquippablePowerCandidates({
    candidates: accountCandidates,
    characterClassName: character.class_name
  });
  const executableSelection = selectMaxEquippablePowerCandidates({
    candidates: executableCandidates,
    characterClassName: character.class_name
  });
  const dropBaselineSelection = selectAccountDropBaselinePowerCandidates({ candidates: accountCandidates });
  const maxEquippable = toPowerValueView(maxEquippableSelection, character.class_name);
  const executablePower = toPowerValueView(executableSelection, character.class_name);
  const dropBaseline = toPowerValueView(dropBaselineSelection, character.class_name);
  const equippedPower = toPowerValueView(equippedSelection, character.class_name);

  return {
    currentLabel: equippedPower.complete
      ? equippedPower.label
      : typeof character.light === "number"
        ? String(character.light)
        : "-",
    maxEquippable,
    executablePower,
    dropBaseline,
    hasExternalSources: [...maxEquippableSelection.values()].some((candidate) => (
      candidate.source.kind === "other-character-equipped"
      || candidate.source.kind === "other-character-inventory"
    )),
    executableMatchesAccountMaximum: maxEquippable.complete
      && executablePower.complete
      && maxEquippable.whole === executablePower.whole
      && maxEquippable.remainder === executablePower.remainder
  };
}

function collectAccountPowerCandidates(
  account: AccountSummary,
  selectedCharacter: CharacterSummary
): Candidate[] {
  const candidates: Candidate[] = [];
  const addItems = (
    items: AccountItemSummary[],
    source: CharacterPowerSource,
    sourceRank: number
  ) => {
    for (const item of items) candidates.push({ item, source, source_rank: sourceRank });
  };

  addItems(selectedCharacter.equipped_items, { kind: "equipped" }, 0);
  addItems(selectedCharacter.inventory_items, { kind: "inventory" }, 1);
  addItems(account.vault.items, { kind: "vault" }, 2);

  for (const character of account.characters) {
    if (character.character_id === selectedCharacter.character_id) continue;
    addItems(character.equipped_items, {
      kind: "other-character-equipped",
      character_name: character.class_name
    }, 3);
    addItems(character.inventory_items, {
      kind: "other-character-inventory",
      character_name: character.class_name
    }, 3);
  }

  return candidates;
}

function toPowerValueView(
  selection: ReadonlyMap<AccountPowerSlotKey, Candidate>,
  characterClassName: string
): CharacterPowerValueView {
  const fraction = calculateAccountPowerFraction(selection);
  return {
    complete: fraction.complete,
    whole: fraction.whole,
    remainder: fraction.remainder,
    denominator: 8,
    label: formatPowerFraction(fraction),
    rows: accountPowerSlotOrder.map((slot) => {
      const candidate = selection.get(slot);
      const power = candidate?.item.power;
      if (!candidate || typeof power !== "number") {
        return {
          key: slot,
          label: accountPowerSlotLabels[slot],
          isExotic: false
        };
      }
      return {
        key: slot,
        label: accountPowerSlotLabels[slot],
        itemName: candidate.item.name,
        itemIcon: candidate.item.icon,
        power,
        delta: fraction.complete && typeof fraction.whole === "number"
          ? power - fraction.whole
          : undefined,
        sourceKind: candidate.source.kind,
        sourceCharacterName: candidate.source.character_name,
        availability: getAvailability(candidate, characterClassName),
        isExotic: /^(?:异域|exotic)$/i.test(candidate.item.tier?.trim() ?? "")
      };
    })
  };
}

function getAvailability(candidate: Candidate, characterClassName: string): CharacterPowerAvailability {
  const compatible = selectMaxEquippablePowerCandidates({
    candidates: [candidate],
    characterClassName
  }).size > 0;
  if (!compatible) return "different-class";
  if (candidate.source.kind === "equipped" || candidate.source.kind === "inventory") return "current";
  return "transferable";
}

function formatPowerFraction(fraction: AccountPowerFraction): string {
  if (!fraction.complete || typeof fraction.whole !== "number") return "数据不完整";
  return fraction.remainder
    ? `${fraction.whole} ${fraction.remainder}/8`
    : String(fraction.whole);
}
