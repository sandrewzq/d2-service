import { ipcMain } from "electron";
import type { LocalTargetRules } from "@d2-tools/core/analysis/targets";
import {
  normalizeEquipmentTargetStore,
  buildMigratedEquipmentTargetStore,
  mergeImportedEquipmentTargets,
  type EquipmentTargetStore,
  type WeaponTarget,
  type WeaponTargetManifestRecord,
  type WeaponTargetPerkRequirement,
  type WeaponTargetResolution
} from "@d2-tools/core/targets/equipmentTargets";
import {
  clearLocalTargetRules,
  loadLocalTargetRules,
  saveLocalTargetRules
} from "@d2-tools/services/analysis/targetRulesStore";
import { loadDimWishlist } from "@d2-tools/services/analysis/wishlistStore";
import {
  clearEquipmentTargetStore,
  loadOrMigrateEquipmentTargetStore,
  loadEquipmentTargetStore,
  saveEquipmentTargetStore as persistEquipmentTargetStore
} from "@d2-tools/services/targets/equipmentTargetStore";
import { emptyLocalTargetRules } from "@d2-tools/core/analysis/targets";
import { loadConfig } from "@d2-tools/services/config/store";
import { getGameDataCatalog } from "../runtime/gameDataRuntime.js";
import { getDesktopManifestStatus } from "./manifest.js";

export function registerTargetRulesIpcHandlers(): void {
  ipcMain.handle("targets:get", () => {
    const config = loadConfig();
    return loadLocalTargetRules(config.data.data_dir);
  });

  ipcMain.handle("targets:save", async (_event, rules: LocalTargetRules) => {
    const config = loadConfig();
    const saved = saveLocalTargetRules(config.data.data_dir, rules);
    await syncEquipmentTargetImports(config.data.data_dir, ["legacy_local_rules"]);
    return saved;
  });

  ipcMain.handle("targets:clear", async () => {
    const config = loadConfig();
    clearLocalTargetRules(config.data.data_dir);
    await syncEquipmentTargetImports(config.data.data_dir, ["legacy_local_rules"]);
    return emptyLocalTargetRules satisfies LocalTargetRules;
  });

  ipcMain.handle("equipment-targets:get", async () => {
    const config = loadConfig();
    const store = await loadOrMigrateEquipmentTargetStore(config.data.data_dir, {
      legacy_rules: loadLocalTargetRules(config.data.data_dir),
      wishlist: loadDimWishlist(config.data.data_dir),
      resolve_weapon: resolveWeaponByHash
    });
    const validated = await validateEquipmentTargetStore(store);
    const saved = equipmentTargetsChanged(store, validated)
      ? persistEquipmentTargetStore(config.data.data_dir, validated)
      : store;
    return saved;
  });

  ipcMain.handle("equipment-targets:save", async (_event, store: EquipmentTargetStore) => {
    const config = loadConfig();
    const validated = await validateEquipmentTargetStore(store);
    return persistEquipmentTargetStore(config.data.data_dir, validated);
  });

  ipcMain.handle("equipment-targets:clear", () => {
    const config = loadConfig();
    return clearEquipmentTargetStore(config.data.data_dir);
  });
}

export async function syncEquipmentTargetImports(
  dataDir: string,
  sourceKinds: Array<"legacy_local_rules" | "dim_wishlist">
): Promise<EquipmentTargetStore> {
  const current = loadEquipmentTargetStore(dataDir);
  if (!current) {
    return loadOrMigrateEquipmentTargetStore(dataDir, {
      legacy_rules: loadLocalTargetRules(dataDir),
      wishlist: loadDimWishlist(dataDir),
      resolve_weapon: resolveWeaponByHash
    });
  }
  const imported = await buildMigratedEquipmentTargetStore({
    legacy_rules: loadLocalTargetRules(dataDir),
    wishlist: loadDimWishlist(dataDir),
    resolve_weapon: resolveWeaponByHash
  });
  return persistEquipmentTargetStore(dataDir, mergeImportedEquipmentTargets(current, imported, sourceKinds));
}

/** DIM Wishlist is a community match source, not a personal equipment-target generator. */
export async function removeDimWishlistEquipmentTargets(dataDir: string): Promise<EquipmentTargetStore> {
  const current = loadEquipmentTargetStore(dataDir) ?? await loadOrMigrateEquipmentTargetStore(dataDir, {
    legacy_rules: loadLocalTargetRules(dataDir),
    wishlist: null,
    resolve_weapon: resolveWeaponByHash
  });
  const migration = { ...(current.migration ?? {}) };
  delete migration.dim_wishlist_imported_at;
  return persistEquipmentTargetStore(dataDir, normalizeEquipmentTargetStore({
    ...current,
    targets: current.targets.filter((target) => target.source.kind !== "dim_wishlist"),
    migration
  }));
}

async function validateEquipmentTargetStore(store: EquipmentTargetStore): Promise<EquipmentTargetStore> {
  const normalized = normalizeEquipmentTargetStore(store);
  const manifestVersion = currentManifestVersion();
  const targets = await mapWithConcurrency(normalized.targets, 8, async (target) => {
    if (target.kind !== "weapon") return target;
    return validateWeaponTarget(target, manifestVersion);
  });
  return normalizeEquipmentTargetStore({ ...normalized, targets });
}

async function loadValidatedEquipmentTargetStore(dataDir: string): Promise<EquipmentTargetStore> {
  const store = await loadOrMigrateEquipmentTargetStore(dataDir, {
    legacy_rules: loadLocalTargetRules(dataDir),
    wishlist: loadDimWishlist(dataDir),
    resolve_weapon: resolveWeaponByHash
  });
  const validated = await validateEquipmentTargetStore(store);
  return equipmentTargetsChanged(store, validated)
    ? persistEquipmentTargetStore(dataDir, validated)
    : store;
}

async function validateWeaponTarget(target: WeaponTarget, manifestVersion?: string): Promise<WeaponTarget> {
  if (target.weapon.status === "verified") {
    if (!manifestVersion || target.weapon.manifest_version === manifestVersion) return target;
    return applyManifestRecord(target, await resolveWeaponByHash(target.weapon.item_hash));
  }
  if (target.weapon.status === "unresolved" && target.weapon.requested_item_hash) {
    if (manifestVersion && target.weapon.checked_manifest_version === manifestVersion) return target;
    return applyManifestRecord(target, await resolveWeaponByHash(target.weapon.requested_item_hash));
  }
  if (target.weapon.status === "unresolved"
    && manifestVersion
    && target.weapon.checked_manifest_version === manifestVersion) return target;
  if (target.weapon.status === "ambiguous") return target;

  try {
    const query = target.weapon.query.trim();
    const matches = (await getGameDataCatalog().searchItems({ query, limit: 20 }))
      .filter((item) => item.group_key === "weapons" && item.name.trim().toLocaleLowerCase() === query.toLocaleLowerCase());
    const uniqueMatches = [...new Map(matches.map((item) => [item.hash, item])).values()];
    const uniqueMatch = uniqueMatches[0];
    if (uniqueMatches.length === 1 && uniqueMatch) {
      return applyManifestRecord(target, await resolveWeaponByHash(uniqueMatch.hash));
    }
    if (uniqueMatches.length > 1) {
      return {
        ...target,
        weapon: {
          status: "ambiguous",
          query,
          candidates: uniqueMatches.map((item) => ({
            item_hash: item.hash,
            item_name: item.name,
            release_label: item.release?.description
          })),
          reason: `找到 ${uniqueMatches.length} 个同名武器版本，需要人工选择后才能参与命中。`
        }
      };
    }
  } catch {
    return target;
  }
  return {
    ...target,
    weapon: {
      status: "unresolved",
      query: target.weapon.query,
      ...(manifestVersion ? { checked_manifest_version: manifestVersion } : {}),
      reason: "当前 Manifest 没有找到可确认的武器版本，目标暂不参与命中。"
    }
  };
}

async function resolveWeaponByHash(itemHash: number): Promise<WeaponTargetManifestRecord | null> {
  try {
    const item = await getGameDataCatalog().getItemDetail({ hash: itemHash });
    if (!item) return null;
    return {
      item_hash: item.hash,
      item_name: item.name,
      group_key: item.group_key,
      perk_definitions: (item.perks ?? []).flatMap((group) => group.plugs.map((plug) => ({
        perk_hash: plug.hash,
        perk_name: plug.name
      }))),
      manifest_version: currentManifestVersion()
    };
  } catch {
    return null;
  }
}

function currentManifestVersion(): string | undefined {
  try {
    return getDesktopManifestStatus().version;
  } catch {
    return undefined;
  }
}

function applyManifestRecord(target: WeaponTarget, record: WeaponTargetManifestRecord | null): WeaponTarget {
  if (!record || record.group_key !== "weapons") {
    return {
      ...target,
      source: withoutManifestEvidence(target),
      weapon: unresolvedWeapon(
        target.weapon,
        "当前 Manifest 无法确认这件武器，目标暂不参与命中。",
        currentManifestVersion()
      )
    };
  }
  const manifestPerks = new Map(record.perk_definitions.map((perk) => [perk.perk_hash, perk.perk_name]));
  const missingPerks = target.perk_requirements.filter((perk) => !manifestPerks.has(perk.perk_hash));
  if (missingPerks.length) {
    return {
      ...target,
      source: withoutManifestEvidence(target),
      weapon: {
        status: "unresolved",
        query: record.item_name,
        requested_item_hash: record.item_hash,
        ...(record.manifest_version ? { checked_manifest_version: record.manifest_version } : {}),
        reason: `Manifest 无法确认 ${missingPerks.length} 个 Perk 属于该武器，目标暂不参与命中。`
      }
    };
  }
  return {
    ...target,
    source: {
      ...target.source,
      evidence_refs: [
        ...target.source.evidence_refs.filter((evidence) => evidence.kind !== "manifest_definition"),
        {
          evidence_id: `equipment-target:${target.id}:manifest:${record.item_hash}`,
          kind: "manifest_definition",
          label: `${record.item_name} / Manifest 定义`,
          observed_at: new Date().toISOString(),
          entity: { type: "inventory_item", id: String(record.item_hash) },
          manifest_version: record.manifest_version,
          open_target: { kind: "item", id: String(record.item_hash) }
        }
      ]
    },
    weapon: {
      status: "verified",
      item_hash: record.item_hash,
      item_name: record.item_name,
      manifest_version: record.manifest_version
    },
    perk_requirements: normalizePerkNames(target.perk_requirements, manifestPerks)
  };
}

function unresolvedWeapon(
  current: WeaponTargetResolution,
  reason: string,
  manifestVersion?: string
): Extract<WeaponTargetResolution, { status: "unresolved" }> {
  if (current.status === "verified") {
    return {
      status: "unresolved",
      query: current.item_name,
      requested_item_hash: current.item_hash,
      ...(manifestVersion ? { checked_manifest_version: manifestVersion } : {}),
      reason
    };
  }
  if (current.status === "ambiguous") {
    return {
      status: "unresolved",
      query: current.query,
      ...(manifestVersion ? { checked_manifest_version: manifestVersion } : {}),
      reason
    };
  }
  return {
    ...current,
    ...(manifestVersion ? { checked_manifest_version: manifestVersion } : {}),
    reason
  };
}

function normalizePerkNames(
  requirements: WeaponTargetPerkRequirement[],
  manifestPerks: Map<number, string>
): WeaponTargetPerkRequirement[] {
  return requirements.map((requirement) => ({
    perk_hash: requirement.perk_hash,
    perk_name: manifestPerks.get(requirement.perk_hash) || requirement.perk_name
  }));
}

function withoutManifestEvidence(target: WeaponTarget): WeaponTarget["source"] {
  return {
    ...target.source,
    evidence_refs: target.source.evidence_refs.filter((evidence) => evidence.kind !== "manifest_definition")
  };
}

function equipmentTargetsChanged(left: EquipmentTargetStore, right: EquipmentTargetStore): boolean {
  return JSON.stringify(left.targets) !== JSON.stringify(right.targets);
}

async function mapWithConcurrency<TInput, TOutput>(
  inputs: TInput[],
  concurrency: number,
  mapper: (input: TInput) => Promise<TOutput>
): Promise<TOutput[]> {
  const outputs = new Array<TOutput>(inputs.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < inputs.length) {
      const index = nextIndex;
      nextIndex += 1;
      outputs[index] = await mapper(inputs[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, inputs.length) }, () => worker()));
  return outputs;
}
