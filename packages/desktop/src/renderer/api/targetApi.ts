import type { LocalTargetRules } from "@d2-tools/core/analysis/targets";
import type {
  EquipmentTargetStore
} from "@d2-tools/core/targets/equipmentTargets";

export type {
  LocalArmorTargetCondition,
  LocalArmorTargetRule,
  LocalTargetActionPolicy,
  LocalTargetMatchResult,
  LocalTargetRules,
  LocalTargetSummary,
  LocalWeaponTargetCondition,
  LocalWeaponTargetRule
} from "@d2-tools/core/analysis/targets";
export type {
  ArmorAcquisitionTarget,
  EquipmentTarget,
  EquipmentTargetMatch,
  EquipmentTargetMatchResult,
  EquipmentTargetSource,
  EquipmentTargetSourceKind,
  EquipmentTargetStore,
  WeaponTarget,
  WeaponTargetCandidate,
  WeaponTargetPerkRequirement,
  WeaponTargetResolution
} from "@d2-tools/core/targets/equipmentTargets";

export type TargetApi = {
  getLocalTargetRules(): Promise<LocalTargetRules>;
  saveLocalTargetRules(rules: LocalTargetRules): Promise<LocalTargetRules>;
  clearLocalTargetRules(): Promise<LocalTargetRules>;
  getEquipmentTargetStore(): Promise<EquipmentTargetStore>;
  saveEquipmentTargetStore(store: EquipmentTargetStore): Promise<EquipmentTargetStore>;
  clearEquipmentTargetStore(): Promise<EquipmentTargetStore>;
};
