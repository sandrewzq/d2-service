import type {
  AccountDefinitionRequest,
  DestinyProfileItem,
  DestinyProfileResponse
} from "./summary.js";
import { accountCapacityDefinitionBucketHashes } from "../items/classification.js";

type PlugState = {
  plugItemHash: number;
  plugObjectives?: Array<{ objectiveHash: number }>;
};

export function collectAccountDefinitionRequest(
  profile: DestinyProfileResponse,
  additionalItems: DestinyProfileItem[] = []
): AccountDefinitionRequest {
  const itemHashes = new Set<number>();
  const bucketHashes = new Set<number>(accountCapacityDefinitionBucketHashes);
  const plugSetHashes = new Set<number>();
  const damageTypeHashes = new Set<number>();
  const objectiveHashes = new Set<number>();
  const recordHashes = new Set<number>();
  const loadoutNameHashes = new Set<number>();
  const addItem = (item: DestinyProfileItem): void => {
    addHash(itemHashes, item.itemHash);
    addHash(bucketHashes, item.bucketHash);
  };
  const addPlugState = (plug: PlugState): void => {
    addHash(itemHashes, plug.plugItemHash);
    for (const objective of plug.plugObjectives ?? []) addHash(objectiveHashes, objective.objectiveHash);
  };

  for (const item of additionalItems) addItem(item);
  for (const item of profile.profileInventory?.data?.items ?? []) addItem(item);
  for (const inventory of Object.values(profile.characterInventories?.data ?? {})) {
    for (const item of inventory.items ?? []) addItem(item);
  }
  for (const equipment of Object.values(profile.characterEquipment?.data ?? {})) {
    for (const item of equipment.items ?? []) addItem(item);
  }
  for (const sockets of Object.values(profile.itemComponents?.sockets?.data ?? {})) {
    for (const socket of sockets.sockets ?? []) addHash(itemHashes, socket.plugHash);
  }
  for (const instance of Object.values(profile.itemComponents?.instances?.data ?? {})) {
    addHash(damageTypeHashes, instance.damageTypeHash);
  }
  for (const reusablePlugs of Object.values(profile.itemComponents?.reusablePlugs?.data ?? {})) {
    for (const plugs of Object.values(reusablePlugs.plugs ?? {})) {
      for (const plug of plugs) addPlugState(plug);
    }
  }
  for (const objectives of Object.values(profile.itemComponents?.objectives?.data ?? {})) {
    for (const objective of objectives.objectives ?? []) addHash(objectiveHashes, objective.objectiveHash);
  }
  for (const recordHash of Object.keys(profile.profileRecords?.data?.records ?? {})) {
    addHash(recordHashes, Number(recordHash));
  }
  for (const plugObjectives of Object.values(profile.itemComponents?.plugObjectives?.data ?? {})) {
    for (const [plugHash, objectives] of Object.entries(plugObjectives.objectivesPerPlug ?? {})) {
      addHash(itemHashes, Number(plugHash));
      for (const objective of objectives) addHash(objectiveHashes, objective.objectiveHash);
    }
  }
  for (const plugSet of [profile.profilePlugSets?.data, ...Object.values(profile.characterPlugSets?.data ?? {})]) {
    for (const plugs of Object.values(plugSet?.plugs ?? {})) {
      for (const plug of plugs) addPlugState(plug);
    }
  }
  for (const loadoutComponent of Object.values(profile.characterLoadouts?.data ?? {})) {
    for (const loadout of loadoutComponent.loadouts ?? []) {
      addHash(loadoutNameHashes, loadout.nameHash);
      for (const item of loadout.items ?? []) {
        for (const plugHash of item.plugItemHashes ?? []) addHash(itemHashes, plugHash);
      }
    }
  }
  for (const progression of Object.values(profile.characterProgressions?.data ?? {})) {
    for (const milestone of Object.values(progression.milestones ?? {})) {
      for (const quest of milestone.availableQuests ?? []) {
        addHash(itemHashes, quest.questItemHash);
        for (const objective of quest.status?.stepObjectives ?? []) {
          addHash(objectiveHashes, objective.objectiveHash);
        }
      }
      for (const activity of milestone.activities ?? []) {
        for (const challenge of activity.challenges ?? []) {
          addHash(objectiveHashes, challenge.objective?.objectiveHash);
        }
      }
    }
  }
  for (const craftableComponent of Object.values(profile.characterCraftables?.data ?? {})) {
    for (const [itemHash, craftable] of Object.entries(craftableComponent.craftables ?? {})) {
      addHash(itemHashes, Number(itemHash));
      for (const socket of craftable.sockets ?? []) {
        addHash(plugSetHashes, socket.plugSetHash);
        for (const plug of socket.plugs ?? []) addHash(itemHashes, plug.plugItemHash);
      }
    }
  }

  return {
    itemHashes: [...itemHashes],
    bucketHashes: [...bucketHashes],
    plugSetHashes: [...plugSetHashes],
    objectiveHashes: [...objectiveHashes],
    damageTypeHashes: [...damageTypeHashes],
    recordHashes: [...recordHashes],
    loadoutNameHashes: [...loadoutNameHashes],
    expandSocketPlugSets: true
  };
}

function addHash(target: Set<number>, hash: number | undefined): void {
  if (typeof hash === "number" && Number.isFinite(hash)) target.add(hash >>> 0);
}
