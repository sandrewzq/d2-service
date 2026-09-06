import {
  buildWeaponDetailViewModel,
  classifyWeaponConfiguration as classifyWeaponConfigurationColumns,
  classifyWeaponSocketPlugs,
  isEnhancedWeaponPerk,
  isWeaponSystemPlug,
  perkGroupsToPoolColumns,
  weaponSocketColumnLabel,
  type WeaponDetailViewModel,
  type WeaponDetailInstanceMetadata,
  type WeaponPerkSelectionColumn,
  type WeaponPerkColumnRole,
  type WeaponDetailObjectContext,
  type WeaponDetailSources
} from "@d2-tools/app/items";
import type {
  AccountItemPlugSummary,
  AccountItemReusablePlugSummary,
  AccountSummary,
  WeaponStatKey,
  WeaponStatSummary
} from "@d2-tools/core/account/summary";
import type { WeaponRecommendation as CommunityWeaponRecommendation } from "@d2-tools/core/community-perks";
import type { ItemReleaseSummary } from "@d2-tools/core/items/release";
import type { VaultTags } from "@d2-tools/core/vault/tags";
import type { EquipmentTargetStore } from "@d2-tools/core/targets/equipmentTargets";
import type { SameNameItemSummary, SelectedItemDetail } from "../../hooks/useItemDetail";

export type BuildDesktopWeaponDetailInput = {
  selectedItem: SelectedItemDetail;
  accountSummary?: AccountSummary | null;
  sameNameItems?: SameNameItemSummary[];
  recommendations?: WeaponDetailViewModel["recommendations"];
  personalTargets?: WeaponDetailViewModel["personal_targets"];
  context?: Partial<WeaponDetailObjectContext>;
  sources?: WeaponDetailSources;
  selectionNames?: string[];
  currentStats?: WeaponStatSummary;
  pendingPerks?: Record<number, number>;
  vaultTags?: VaultTags;
  instanceMetadata?: Record<string, WeaponDetailInstanceMetadata>;
  versions?: Array<{
    hash: number;
    name: string;
    tier?: string;
    is_adept?: boolean;
    release?: ItemReleaseSummary;
  }>;
  versionsLoading?: boolean;
};

export type WeaponAiConfigurationContext = {
  configuration_kind: "fixed_exotic" | "variable_exotic" | "random_roll" | "fixed";
  fixed_perks?: Array<{ socket_index: number; names: string[] }>;
  configuration_options?: Array<{ socket_index: number; names: string[] }>;
  perk_pool?: Array<{ socket_index: number; names: string[] }>;
  catalyst?: {
    name: string;
    acquired?: boolean;
    complete: boolean;
    progress?: number;
    objective?: string;
    acquisition?: string;
    effects: string[];
  };
};

type WeaponConfigurationClassification = {
  allColumns: WeaponDetailViewModel["configuration"]["pool_columns"];
  poolColumns: WeaponDetailViewModel["configuration"]["pool_columns"];
  isExotic: boolean;
  kind: WeaponDetailViewModel["configuration"]["kind"];
  poolKind: WeaponDetailViewModel["configuration"]["pool_kind"];
};

export function buildWeaponDetailView(
  input: BuildDesktopWeaponDetailInput
): WeaponDetailViewModel | null {
  const item = input.selectedItem;
  if (item.group_key !== "weapons") return null;

  const classification = classifyWeaponConfiguration(item);
  const intrinsic = classification.allColumns.find((column) => column.role === "intrinsic")?.candidates[0];
  const { isExotic, poolColumns } = classification;
  const currentStats = input.currentStats ?? (item.instance_id ? item.weapon_stats : undefined);
  const definitionStats = definitionStatsToSummary(item.definition_stats);
  const upgrades = buildWeaponUpgrades(item);
  const instanceDamage = damageFromInstance(item.instance);
  const versions = [...(input.versions ?? [])].sort((left, right) =>
    Number(right.hash === item.hash) - Number(left.hash === item.hash));

  return buildWeaponDetailViewModel({
    item,
    context: {
      kind: input.context?.kind ?? (item.instance_id ? "account_instance" : "definition"),
      entry: input.context?.entry ?? (item.is_vault_item ? "vault" : item.instance_id ? "account" : "library"),
      ...input.context
    },
    slot: item.equipment_bucket_name ?? item.bucket_name,
    damage: item.damage_type_summary
      ? {
          hash: item.damage_type_summary.hash,
          key: item.damage_type_summary.key,
          label: item.damage_type_summary.name,
          description: item.damage_type_summary.description,
          icon: item.damage_type_summary.icon
        }
      : instanceDamage
      ? instanceDamage
      : item.damage_type
      ? {
          key: damageKey(item.damage_type),
          label: item.damage_type
        }
      : undefined,
    champion: item.breaker_type
      ? {
          key: item.breaker_type.champion_type,
          label: championLabels[item.breaker_type.champion_type],
          effect_label: championEffectLabels[item.breaker_type.champion_type],
          description: item.breaker_type.description,
          icon: item.breaker_type.icon,
          source: item.breaker_type.source === "item"
            ? "weapon"
            : item.breaker_type.source === "intrinsic-perk"
              ? "frame_perk"
              : "plug"
        }
      : championFromInstance(item.instance?.breaker_type),
    is_exotic: isExotic,
    versions: versions.length
      ? versions.map((version, index) => {
          const releaseLabel = version.release?.description
            ?? (version.hash === item.hash ? item.release?.description : undefined);
          return {
            hash: version.hash,
            label: [releaseLabel ?? version.tier ?? `版本 ${index + 1}`, version.is_adept ? "专家" : undefined]
              .filter(Boolean)
              .join(" · "),
            release_label: releaseLabel,
            is_current: version.hash === item.hash
          };
        })
      : [{
          hash: item.hash,
          label: item.release?.description ?? "当前版本",
          release_label: item.release?.description,
          is_current: true
        }],
    versions_loading: input.versionsLoading,
    definition_stats: classification.kind === "fixed"
      ? buildFixedConfigurationStandardStats(item, definitionStats)
      : definitionStats,
    current_stats: currentStats,
    pending_stats: buildPendingWeaponStats(item, input.pendingPerks),
    stat_modifiers: buildCurrentWeaponStatModifiers(item),
    pending_stat_modifiers: buildPendingWeaponStatModifiers(item, input.pendingPerks),
    configuration: {
      intrinsic,
      kind: classification.kind,
      pool_kind: classification.poolKind
    },
    pool_columns: poolColumns,
    selection_columns: buildSelectionColumns(item, poolColumns, input.selectionNames, input.pendingPerks),
    sources: withManifestSourceStatus(input.sources, item),
    upgrades,
    recommendations: input.recommendations,
    personal_targets: input.personalTargets,
    same_hash_instances: input.sameNameItems,
    instance_metadata: buildInstanceMetadata(input, upgrades)
  });
}

export function buildWeaponAiConfigurationContext(item: Pick<
  SelectedItemDetail,
  "tier" | "perks" | "socket_plugs" | "sockets" | "item_objectives" | "catalyst" | "instance_id"
>): WeaponAiConfigurationContext {
  const classification = classifyWeaponConfiguration(item);
  const configurationKind: WeaponAiConfigurationContext["configuration_kind"] = classification.isExotic
    ? classification.kind === "fixed" ? "fixed_exotic" : "variable_exotic"
    : classification.kind;
  const summarizedColumns = classification.allColumns.map((column) => ({
    socket_index: column.socket_index,
    names: column.candidates.map((candidate) => candidate.name)
  }));
  const catalyst = buildWeaponUpgrades(item).catalyst;
  return {
    configuration_kind: configurationKind,
    ...(configurationKind === "fixed_exotic" || configurationKind === "fixed"
      ? { fixed_perks: summarizedColumns }
      : configurationKind === "random_roll"
        ? { perk_pool: summarizedColumns }
        : { configuration_options: summarizedColumns }),
    ...(catalyst
      ? {
          catalyst: {
            name: catalyst.name,
            acquired: catalyst.acquired,
            complete: catalyst.complete,
            progress: catalyst.progress,
            objective: catalyst.objective,
            acquisition: catalyst.acquisition,
            effects: catalyst.effects
          }
        }
      : {})
  };
}

function withManifestSourceStatus(
  sources: WeaponDetailSources | undefined,
  item: SelectedItemDetail
): WeaponDetailSources | undefined {
  if (!sources || item.source.status === "ready" || sources.entries.some((entry) => entry.kind === "manifest_hint")) {
    return sources;
  }
  return {
    ...sources,
    entries: [
      ...sources.entries,
      {
        id: `manifest:${item.hash}:missing`,
        kind: "manifest_hint",
        label: "历史获取途径",
        description: item.source.description || "Bungie 官方资料没有标注这件武器的历史获取途径。"
      }
    ]
  };
}

function buildInstanceMetadata(
  input: BuildDesktopWeaponDetailInput,
  currentUpgrades: WeaponDetailViewModel["upgrades"]
): Record<string, WeaponDetailInstanceMetadata> | undefined {
  const metadata: Record<string, WeaponDetailInstanceMetadata> = { ...input.instanceMetadata };
  for (const item of input.sameNameItems ?? []) {
    if (!item.instance_id) continue;
    const itemKey = "item_key" in item && typeof item.item_key === "string"
      ? item.item_key
      : item.instance_id;
    const localEntry = input.vaultTags?.items[itemKey] ?? input.vaultTags?.items[item.instance_id];
    const upgrades = item.instance_id === input.selectedItem.instance_id
      ? currentUpgrades
      : buildWeaponUpgrades(item);
    const upgradeStatus = hasWeaponUpgradeData(upgrades) ? upgrades : undefined;
    const explicit = metadata[item.instance_id];
    const loadoutReferences = buildInGameLoadoutReferences(input.accountSummary, item.instance_id);
    const next: WeaponDetailInstanceMetadata = {
      ...explicit,
      local_tag: explicit?.local_tag ?? localEntry?.tag,
      note: explicit?.note ?? localEntry?.note,
      upgrade_status: explicit?.upgrade_status ?? upgradeStatus,
      loadout_references: mergeLoadoutReferences(explicit?.loadout_references, loadoutReferences)
    };
    if (Object.values(next).some((value) => value !== undefined)) {
      metadata[item.instance_id] = next;
    }
  }
  return Object.keys(metadata).length ? metadata : undefined;
}

function buildInGameLoadoutReferences(
  accountSummary: AccountSummary | null | undefined,
  instanceId: string
): NonNullable<WeaponDetailInstanceMetadata["loadout_references"]> | undefined {
  const references = (accountSummary?.characters ?? []).flatMap((character) => (
    character.loadout_slots.flatMap((loadout) => (
      loadout.items.some((item) => item.instance_id === instanceId)
        ? [{
            id: `in-game:${character.character_id}:${loadout.index}`,
            name: loadout.name,
            kind: "in_game" as const,
            character_id: character.character_id,
            loadout_index: loadout.index
          }]
        : []
    ))
  ));
  return references.length ? references : undefined;
}

function mergeLoadoutReferences(
  explicit: WeaponDetailInstanceMetadata["loadout_references"],
  derived: WeaponDetailInstanceMetadata["loadout_references"]
): WeaponDetailInstanceMetadata["loadout_references"] {
  const merged = [...(explicit ?? []), ...(derived ?? [])];
  if (!merged.length) return undefined;
  return [...new Map(merged.map((reference) => [reference.id, reference])).values()];
}

function hasWeaponUpgradeData(upgrades: WeaponDetailViewModel["upgrades"]): boolean {
  return Boolean(
    upgrades.masterwork
    || upgrades.mod
    || upgrades.catalyst
    || upgrades.enhancement
    || upgrades.crafting_level !== undefined
    || upgrades.enhanced
  );
}

export function buildWeaponRecommendationViews(
  recommendation: CommunityWeaponRecommendation | null,
  item: SelectedItemDetail
): WeaponDetailViewModel["recommendations"] {
  const classification = classifyWeaponConfiguration(item);
  const isFixedExotic = classification.isExotic && classification.kind === "fixed";
  const availableHashes = new Set([
    ...(item.socket_plugs ?? []).map((plug) => plug.hash),
    ...(item.sockets ?? []).flatMap((socket) => socket.reusable_plugs.map((plug) => plug.hash))
  ]);
  const builtin = (classification.kind === "fixed" && !isFixedExotic ? [] : recommendation?.combos ?? [])
    .filter((combo) => combo.source === "local_community")
    .map((combo, index) => {
      const matched = combo.perks.filter((perk) => availableHashes.has(perk.hash)).length;
      return {
        id: `${combo.source}:${combo.mode}:${index}`,
        mode: combo.mode,
        title: combo.note || (isFixedExotic ? `${combo.mode.toUpperCase()} 异域使用说明` : `${combo.mode.toUpperCase()} 推荐 Roll`),
        reason: isFixedExotic
          ? "该社区来源仅作为固定配置异域的使用说明，不参与随机 Roll 匹配。"
          : recommendation?.disclaimer || "依据本地知识与愿望单比较当前配置。",
        source: "builtin" as const,
        source_label: "社区推荐",
        perk_options: isFixedExotic ? [] : combo.perks.map((perk, perkIndex) => ({
          column_key: `Perk ${perkIndex + 1}`,
          names: [perk.name]
        })),
        masterwork_names: [],
        mod_names: [],
        match: isFixedExotic ? "not_applicable" as const : matchRecommendation(item, matched, combo.perks.length),
        match_notes: isFixedExotic
          ? ["固定异域不执行社区随机 Roll 匹配；保留此条来源记录作为使用说明。"]
          : recommendationMatchNotes(item, matched, combo.perks.length)
      };
    });
  return builtin;
}

export function buildWeaponPersonalTargetViews(
  recommendation: CommunityWeaponRecommendation | null,
  item: SelectedItemDetail
): WeaponDetailViewModel["personal_targets"] {
  const classification = classifyWeaponConfiguration(item);
  const isFixedExotic = classification.isExotic && classification.kind === "fixed";
  const availableHashes = new Set([
    ...(item.socket_plugs ?? []).map((plug) => plug.hash),
    ...(item.sockets ?? []).flatMap((socket) => socket.reusable_plugs.map((plug) => plug.hash))
  ]);
  const dimCombos = (recommendation?.combos ?? [])
    .filter((combo) => combo.source === "dim_wishlist")
    .map((combo, index) => {
      const diagnosticPerks = combo.dim_diagnostic?.perks;
      const requirements = diagnosticPerks?.map((perk) => (
        perk.resolved_hashes?.length ? perk.resolved_hashes : [perk.resolved_hash ?? perk.original_hash]
      )) ?? combo.perks.map((perk) => [perk.hash]);
      const matched = requirements.filter((hashes) => hashes.some((hash) => availableHashes.has(hash))).length;
      return { combo, index, diagnosticPerks, requirements, matched };
    });
  const matchedComboCount = dimCombos.filter(({ matched, requirements }) => (
    requirements.length > 0 && matched === requirements.length
  )).length;
  const visibleCombos = dimCombos
    .filter(({ matched, requirements }) => (
      matchedComboCount === 0 || (requirements.length > 0 && matched === requirements.length)
    ))
    .sort((left, right) => compareDimDetailComboProgress(left, right))
    .slice(0, 3);
  return visibleCombos.map(({ combo, index, diagnosticPerks, requirements, matched }, visibleIndex) => {
    const visibleSummary = matchedComboCount > 0
      ? `当前 Roll 符合 DIM 的 ${matchedComboCount} 套推荐，下面显示其中 ${visibleCombos.length} 套。`
      : `当前 Roll 未完全符合 DIM 推荐，下面显示最接近的 ${visibleCombos.length} 套。`;
    return {
      id: `dim:${combo.mode}:${index}`,
      mode: combo.mode,
      title: combo.note || (isFixedExotic ? "固定配置收藏记录" : `${combo.mode.toUpperCase()} DIM 目标`),
      reason: isFixedExotic
        ? "该 DIM 条目只作为固定配置异域的收藏与来源记录，不执行随机 Roll 匹配。"
        : visibleIndex === 0
          ? `${visibleSummary} 这是用户导入的 DIM 愿望单目标，不属于应用默认推荐。`
          : "这是用户导入的 DIM 愿望单目标，不属于应用默认推荐。",
      source: "dim" as const,
      source_label: "DIM 愿望单",
      perk_options: isFixedExotic ? [] : combo.perks.map((perk, perkIndex) => ({
        column_key: dimDiagnosticSlotLabel(diagnosticPerks?.[perkIndex]?.slot_candidates[0]) ?? `项目 ${perkIndex + 1}`,
        names: [perk.name]
      })),
      masterwork_names: [],
      mod_names: [],
      match: isFixedExotic ? "not_applicable" as const : matchRecommendation(item, matched, requirements.length),
      match_notes: isFixedExotic
        ? ["固定异域不执行 DIM 随机 Roll 匹配；保留此条愿望单作为收藏与来源记录。"]
        : [
            ...recommendationMatchNotes(item, matched, requirements.length),
            ...(combo.dim_diagnostic ? [combo.dim_diagnostic.message] : [])
          ]
    };
  });
}

function compareDimDetailComboProgress(
  left: { matched: number; requirements: number[][]; index: number },
  right: { matched: number; requirements: number[][]; index: number }
): number {
  const leftTotal = left.requirements.length;
  const rightTotal = right.requirements.length;
  const ratioDifference = right.matched * leftTotal - left.matched * rightTotal;
  if (ratioDifference) return ratioDifference;
  if (left.matched !== right.matched) return right.matched - left.matched;
  if (leftTotal !== rightTotal) return rightTotal - leftTotal;
  return left.index - right.index;
}

function dimDiagnosticSlotLabel(slot: string | undefined): string | undefined {
  if (slot === "barrel") return "枪管/瞄具";
  if (slot === "magazine") return "第二列";
  if (slot === "masterwork") return "大师";
  if (slot === "perk1") return "Perk 1";
  if (slot === "perk2") return "Perk 2";
  if (slot === "origin") return "起源特性";
  if (slot === "special") return "特殊插槽";
  if (slot === "unknown") return "推荐项位置未知";
  return undefined;
}

export function buildEquipmentTargetWeaponViews(
  store: EquipmentTargetStore,
  item: SelectedItemDetail
): WeaponDetailViewModel["recommendations"] {
  if (item.group_key !== "weapons") return [];
  const availableHashes = new Set([
    ...(item.socket_plugs ?? []).map((plug) => plug.hash),
    ...(item.sockets ?? []).flatMap((socket) => socket.reusable_plugs.map((plug) => plug.hash))
  ]);
  return store.targets.flatMap((target) => {
    if (!target.enabled
      || target.kind !== "weapon"
      || target.source.kind === "dim_wishlist"
      || target.weapon.status !== "verified") return [];
    if (target.weapon.item_hash !== item.hash) return [];
    const matched = target.perk_requirements.filter((perk) => availableHashes.has(perk.perk_hash)).length;
    return [{
      id: target.id,
      mode: target.mode,
      title: target.name,
      reason: `${target.source.label}；只作为目标证据，不会自动修改装备。`,
      source: "user" as const,
      source_label: target.source.label,
      updated_at: target.updated_at,
      perk_options: target.perk_requirements.map((perk, index) => ({
        column_key: `Perk ${index + 1}`,
        names: [perk.perk_name]
      })),
      masterwork_names: [],
      mod_names: [],
      match: target.perk_requirements.length
        ? matchRecommendation(item, matched, target.perk_requirements.length)
        : "full" as const,
      match_notes: target.perk_requirements.length
        ? recommendationMatchNotes(item, matched, target.perk_requirements.length)
        : ["目标只指定武器版本，不限制 Roll。"]
    }];
  });
}

function classifyWeaponConfiguration(item: Pick<SelectedItemDetail, "tier" | "perks">): WeaponConfigurationClassification {
  const allColumns = perkGroupsToPoolColumns(item.perks ?? []);
  const poolColumns = sortConfigurationColumns(allColumns.filter((column) => column.role !== "intrinsic"));
  const isExotic = /异域|exotic/i.test(item.tier ?? "");
  const classification = classifyWeaponConfigurationColumns(poolColumns, isExotic);
  return {
    allColumns,
    poolColumns,
    isExotic,
    kind: classification.kind,
    poolKind: classification.pool_kind
  };
}

function matchRecommendation(
  item: SelectedItemDetail,
  matched: number,
  total: number
): WeaponDetailViewModel["recommendations"][number]["match"] {
  if (!item.instance_id && !item.socket_plugs?.length) return "not_applicable";
  if (matched === total && matched > 0) return "full";
  return matched > 0 ? "partial" : "none";
}

function recommendationMatchNotes(item: SelectedItemDetail, matched: number, total: number): string[] {
  return item.instance_id || item.socket_plugs?.length
    ? [`当前 Roll 符合 ${matched}/${total} 项推荐。`]
    : ["当前对象没有账号实例 Roll，暂时无法核对推荐项。"];
}

function isReusablePlugSummary(
  plug: AccountItemPlugSummary | AccountItemReusablePlugSummary
): plug is AccountItemReusablePlugSummary {
  return "selected" in plug
    && typeof plug.selected === "boolean"
    && Array.isArray(plug.insert_fail_indexes)
    && Array.isArray(plug.enable_fail_indexes);
}

function buildSelectionColumns(
  item: SelectedItemDetail,
  poolColumns: WeaponDetailViewModel["configuration"]["pool_columns"],
  selectionNames: string[] | undefined,
  pendingPerks: Record<number, number> | undefined
): WeaponPerkSelectionColumn[] {
  if (item.sockets?.length) {
    const poolBySocket = new Map(poolColumns.map((column) => [column.socket_index, column]));
    const selectedSocketHashes = new Set(item.sockets.flatMap((socket) => (
      socket.selected_plug ? [socket.selected_plug.hash] : []
    )));
    const occupiedSocketIndexes = new Set(item.sockets.flatMap((socket) => (
      socket.selected_plug && !isWeaponSystemPlug(socket.selected_plug) ? [socket.socket_index] : []
    )));
    const fallbackBySocket = new Map<number, NonNullable<SelectedItemDetail["socket_plugs"]>[number]>();
    for (const plug of item.socket_plugs ?? []) {
      if (selectedSocketHashes.has(plug.hash) || isWeaponSystemPlug(plug)) continue;
      const normalizedName = normalizePerkVariantName(plug.name);
      const pool = poolColumns.find((column) => (
        !fallbackBySocket.has(column.socket_index)
        && !occupiedSocketIndexes.has(column.socket_index)
        && column.candidates.some((candidate) => (
          candidate.hash === plug.hash || normalizePerkVariantName(candidate.name) === normalizedName
        ))
      ));
      if (pool) fallbackBySocket.set(pool.socket_index, plug);
    }

    const socketsByIndex = new Map(item.sockets.map((socket) => [socket.socket_index, socket]));
    const socketIndexes = new Set([...socketsByIndex.keys(), ...fallbackBySocket.keys()]);
    return labelTraitColumns(sortConfigurationColumns([...socketIndexes].flatMap((socketIndex) => {
      const socket = socketsByIndex.get(socketIndex);
      const fallbackPlug = fallbackBySocket.get(socketIndex);
      const pool = poolBySocket.get(socketIndex);
      const socketPlugs = [
        ...(socket?.selected_plug ? [socket.selected_plug] : fallbackPlug ? [fallbackPlug] : []),
        ...(socket?.reusable_plugs ?? [])
      ];
      const role = pool?.role ?? classifyWeaponSocketPlugs(socketPlugs);
      if (!role || role === "intrinsic") return [];
      const reusablePlugs = (socket?.reusable_plugs ?? []).filter((plug) => !isWeaponSystemPlug(plug));
      const selectedPlug = socket?.selected_plug && !isWeaponSystemPlug(socket.selected_plug)
        ? socket.selected_plug
        : fallbackPlug && !isWeaponSystemPlug(fallbackPlug)
          ? fallbackPlug
          : undefined;
      if (!reusablePlugs.length && !selectedPlug) return [];
      const poolHashes = new Set(pool?.candidates.map((candidate) => candidate.hash) ?? []);
      const poolNames = new Set(pool?.candidates.map((candidate) => normalizePerkVariantName(candidate.name)) ?? []);
      const reusableHashes = new Set(reusablePlugs.map((plug) => plug.hash));
      const selectedFallback = selectedPlug && !reusableHashes.has(selectedPlug.hash)
        ? [selectedPlug]
        : [];
      return [{
        key: pool?.key ?? `socket-${socketIndex}`,
        socket_index: socketIndex,
        label: pool?.label ?? weaponSocketColumnLabel(socketPlugs, role, socketIndex),
        role,
        candidates: [...reusablePlugs, ...selectedFallback].map((plug) => {
          const reusablePlug = isReusablePlugSummary(plug) ? plug : undefined;
          return {
            hash: plug.hash,
            name: plug.name,
            description: plug.description ?? "",
            icon: plug.icon,
            enhanced_of_hash: isEnhancedWeaponPerk(plug) ? findBasePerkHash(plug.name, pool?.candidates) : undefined,
            selected: reusablePlug?.selected === true || selectedPlug?.hash === plug.hash,
            can_apply: socket?.is_enabled === true
              && reusablePlug?.can_insert === true
              && reusablePlug.enabled !== false
              && reusablePlug.insert_fail_indexes.length === 0
              && reusablePlug.enable_fail_indexes.length === 0,
            pending: pendingPerks?.[socketIndex] === plug.hash,
            unresolved_in_definition_pool: !poolHashes.has(plug.hash)
              && !poolNames.has(normalizePerkVariantName(plug.name))
          };
        })
      }];
    })));
  }

  if (!poolColumns.length && item.socket_plugs?.length) {
    const selectedBySocket = new Map<number, AccountItemPlugSummary[]>();
    for (const plug of item.socket_plugs) {
      if (plug.socket_index === undefined || isWeaponSystemPlug(plug)) continue;
      const plugs = selectedBySocket.get(plug.socket_index) ?? [];
      plugs.push(plug);
      selectedBySocket.set(plug.socket_index, plugs);
    }
    return labelTraitColumns(sortConfigurationColumns([...selectedBySocket].flatMap(([socketIndex, plugs]) => {
      const role = classifyWeaponSocketPlugs(plugs);
      if (!role || role === "intrinsic") return [];
      return [{
        key: `socket-${socketIndex}`,
        socket_index: socketIndex,
        label: weaponSocketColumnLabel(plugs, role, socketIndex),
        role,
        candidates: plugs.map((plug) => ({
          hash: plug.hash,
          name: plug.name,
          description: plug.description ?? "",
          icon: plug.icon,
          selected: true,
          can_apply: false,
          pending: false,
          unresolved_in_definition_pool: true
        }))
      }];
    })));
  }

  const selectedHashes = new Set(item.socket_plugs?.map((plug) => plug.hash) ?? []);
  const normalizedNames = new Set((selectionNames ?? []).map((name) => name.trim()).filter(Boolean));
  if (!selectedHashes.size && !normalizedNames.size) return [];

  return poolColumns
    .map((column) => ({
      key: column.key,
      socket_index: column.socket_index,
      label: column.label,
      role: column.role,
      candidates: column.candidates
        .filter((candidate) => selectedHashes.has(candidate.hash) || normalizedNames.has(candidate.name))
        .map((candidate) => ({
          ...candidate,
          selected: true,
          can_apply: false,
          pending: false,
          unresolved_in_definition_pool: false
        }))
    }))
    .filter((column) => column.candidates.length > 0);
}

function definitionStatsToSummary(
  stats: SelectedItemDetail["definition_stats"]
): WeaponStatSummary | undefined {
  if (!stats?.length) return undefined;

  const summary: WeaponStatSummary = {};
  for (const stat of stats) {
    const key = weaponStatKeyByHash[stat.hash];
    if (key) summary[key] = stat.value;
  }
  return Object.keys(summary).length ? summary : undefined;
}

function buildFixedConfigurationStandardStats(
  item: SelectedItemDetail,
  definitionStats: WeaponStatSummary | undefined
): WeaponStatSummary | undefined {
  if (!definitionStats) return undefined;
  const result: WeaponStatSummary = { ...definitionStats };
  const modifiers: Partial<Record<WeaponStatKey, number>> = {};
  const selectedPlugs = item.sockets?.length
    ? item.sockets.flatMap((socket) => socket.selected_plug ? [socket.selected_plug] : [])
    : item.socket_plugs?.length
      ? item.socket_plugs
      : (item.perks ?? []).flatMap((group) => group.plugs.length === 1 ? group.plugs : []);
  for (const plug of selectedPlugs) {
    if (isWeaponSystemPlug(plug)) continue;
    for (const key of weaponStatKeys) {
      const amount = ("stat_modifiers" in plug ? plug.stat_modifiers : undefined)?.[key];
      if (!amount) continue;
      modifiers[key] = (modifiers[key] ?? 0) + amount;
    }
  }
  for (const key of weaponStatKeys) {
    const base = definitionStats[key];
    const modifier = modifiers[key] ?? 0;
    if (base === undefined || modifier === 0) continue;
    result[key] = base + modifier;
  }
  return result;
}

function buildPendingWeaponStats(
  item: SelectedItemDetail,
  pendingPerks: Record<number, number> | undefined
): WeaponStatSummary | undefined {
  if (!item.weapon_stats || !item.sockets?.length || !pendingPerks || !Object.keys(pendingPerks).length) return undefined;
  const result: WeaponStatSummary = { ...item.weapon_stats };
  for (const [socketValue, pendingHash] of Object.entries(pendingPerks)) {
    const socket = item.sockets.find((candidate) => candidate.socket_index === Number(socketValue));
    const pending = socket?.reusable_plugs.find((plug) => plug.hash === pendingHash);
    if (!socket || !pending || pending.selected) continue;
    for (const key of weaponStatKeys) {
      const delta = (pending.stat_modifiers?.[key] ?? 0) - (socket.selected_plug?.stat_modifiers?.[key] ?? 0);
      if (delta !== 0) result[key] = (result[key] ?? 0) + delta;
    }
  }
  return result;
}

function buildCurrentWeaponStatModifiers(
  item: SelectedItemDetail
): Partial<Record<WeaponStatKey, Array<{ source: string; amount: number }>>> | undefined {
  const selectedPlugs = item.sockets?.length
    ? item.sockets.flatMap((socket) => socket.selected_plug ? [socket.selected_plug] : [])
    : item.socket_plugs ?? [];
  const result: Partial<Record<WeaponStatKey, Array<{ source: string; amount: number }>>> = {};
  for (const plug of selectedPlugs) {
    for (const key of weaponStatKeys) {
      const amount = plug.stat_modifiers?.[key];
      if (!amount) continue;
      (result[key] ??= []).push({ source: plug.name, amount });
    }
  }
  return Object.keys(result).length ? result : undefined;
}

function buildPendingWeaponStatModifiers(
  item: SelectedItemDetail,
  pendingPerks: Record<number, number> | undefined
): Partial<Record<WeaponStatKey, Array<{ source: string; amount: number }>>> | undefined {
  if (!item.sockets?.length || !pendingPerks || !Object.keys(pendingPerks).length) return undefined;
  const result: Partial<Record<WeaponStatKey, Array<{ source: string; amount: number }>>> = {};
  for (const [socketValue, pendingHash] of Object.entries(pendingPerks)) {
    const socket = item.sockets.find((candidate) => candidate.socket_index === Number(socketValue));
    const pending = socket?.reusable_plugs.find((plug) => plug.hash === pendingHash);
    if (!socket || !pending || pending.selected) continue;
    for (const key of weaponStatKeys) {
      const amount = (pending.stat_modifiers?.[key] ?? 0) - (socket.selected_plug?.stat_modifiers?.[key] ?? 0);
      if (!amount) continue;
      (result[key] ??= []).push({
        source: `${socket.selected_plug?.name ?? "当前配置"} → ${pending.name}`,
        amount
      });
    }
  }
  return Object.keys(result).length ? result : undefined;
}

function damageKey(label: string): string {
  if (label.includes("电弧")) return "arc";
  if (label.includes("烈日")) return "solar";
  if (label.includes("虚空")) return "void";
  if (label.includes("冰影")) return "stasis";
  if (label.includes("缚丝")) return "strand";
  return "kinetic";
}

function damageFromInstance(
  instance: SelectedItemDetail["instance"]
): WeaponDetailViewModel["identity"]["damage"] {
  if (!instance) return undefined;
  if (instance.damage_type_name) {
    return {
      key: damageKey(instance.damage_type_name),
      label: instance.damage_type_name,
      icon: instance.damage_type_icon
    };
  }
  const fallback = instance.damage_type === 1
    ? { key: "kinetic", label: "动能" }
    : instance.damage_type === 2
      ? { key: "arc", label: "电弧" }
      : instance.damage_type === 3
        ? { key: "solar", label: "烈日" }
        : instance.damage_type === 4
          ? { key: "void", label: "虚空" }
          : instance.damage_type === 6
            ? { key: "stasis", label: "冰影" }
            : instance.damage_type === 7
              ? { key: "strand", label: "缚丝" }
              : undefined;
  return fallback ? { ...fallback, icon: instance.damage_type_icon } : undefined;
}

function buildWeaponUpgrades(item: Pick<
  SelectedItemDetail,
  "socket_plugs" | "sockets" | "item_objectives" | "perks" | "catalyst" | "instance_id"
>): WeaponDetailViewModel["upgrades"] {
  const socketSelectedPlugs = (item.sockets ?? []).flatMap((socket) => socket.selected_plug ? [socket.selected_plug] : []);
  const selectedPlugs = socketSelectedPlugs.length ? socketSelectedPlugs : item.socket_plugs ?? [];
  const masterwork = selectedPlugs.find((plug) => plugHasSemanticType(plug, "masterwork"));
  const catalyst = selectedPlugs.find((plug) => plugHasSemanticType(plug, "catalyst"));
  const definitionCatalyst = item.perks
    ?.flatMap((group) => group.plugs)
    .find((plug) => plugHasSemanticType(plug, "catalyst"));
  const definitionOnlyCatalyst = catalyst ?? definitionCatalyst;
  const mod = selectedPlugs.find((plug) => {
    return plugHasSemanticType(plug, "mod");
  });
  const enhancement = selectedPlugs.find((plug) => plugHasSemanticType(plug, "enhancement"));
  const craftingLevel = extractCraftingLevel([
    ...(item.item_objectives ?? []),
    ...selectedPlugs.flatMap((plug) => plug.objectives ?? [])
  ]);
  const catalystSummary = item.catalyst
    ? {
        name: item.catalyst.name,
        icon: item.catalyst.icon,
        acquired: item.catalyst.acquired,
        complete: item.catalyst.complete,
        progress: item.catalyst.progress,
        objective: item.catalyst.objectives
          .map((objective) => {
            const label = objective.progress_description?.trim();
            const progress = objective.progress === undefined
              ? undefined
              : `${Math.min(objective.progress, objective.completion_value)}/${objective.completion_value}`;
            return [label, progress].filter(Boolean).join(" ");
          })
          .filter(Boolean)
          .join(" / "),
        effects: item.catalyst.description ? [item.catalyst.description] : []
      }
    : !item.instance_id
      ? definitionOnlyCatalyst
        ? {
            name: definitionOnlyCatalyst.name,
            icon: definitionOnlyCatalyst.icon,
            acquired: undefined,
            complete: false,
            acquisition: definitionOnlyCatalyst.source_description,
            effects: definitionOnlyCatalyst.description
              ? [definitionOnlyCatalyst.description]
              : []
          }
        : undefined
      : undefined;

  return {
    masterwork: masterwork
      ? {
          name: masterwork.name,
          level: extractDisplayedLevel(`${masterwork.name} ${masterwork.item_type ?? ""}`),
          complete: masterwork.objectives?.length
            ? masterwork.objectives.every((objective) => objective.complete)
            : extractDisplayedLevel(`${masterwork.name} ${masterwork.item_type ?? ""}`) === 10,
          stat_key: firstStatModifier(masterwork.stat_modifiers)?.[0],
          stat_amount: firstStatModifier(masterwork.stat_modifiers)?.[1]
        }
      : undefined,
    mod: mod
      ? { hash: mod.hash, name: mod.name, description: mod.description ?? "", icon: mod.icon }
      : undefined,
    catalyst: catalystSummary,
    enhancement: enhancement
      ? {
          name: /空的|empty/i.test(enhancement.name) ? "未强化" : enhancement.name,
          level: extractDisplayedLevel(enhancement.name)
        }
      : undefined,
    crafting_level: craftingLevel,
    enhanced: selectedPlugs.some((plug) => {
      const category = plug.category_identifier?.toLocaleLowerCase() ?? "";
      const itemType = plug.item_type?.toLocaleLowerCase() ?? "";
      return !plugHasSemanticType(plug, "enhancement")
        && (category.includes("enhanced") || itemType.includes("enhanced") || itemType.includes("强化"));
    })
  };
}

function includesCategory(category: string | undefined, segment: string): boolean {
  return category?.toLocaleLowerCase().includes(segment) ?? false;
}

function plugHasSemanticType(
  plug: { name?: string; description?: string; category_identifier?: string; trait_ids?: string[]; item_type?: string },
  kind: "masterwork" | "catalyst" | "mod" | "enhancement"
): boolean {
  const category = plug.category_identifier?.toLocaleLowerCase() ?? "";
  const itemType = plug.item_type?.toLocaleLowerCase() ?? "";
  const text = `${plug.name ?? ""} ${plug.description ?? ""}`.toLocaleLowerCase();
  const isCatalyst = plug.trait_ids?.includes("item.exotic_catalyst")
    || category.includes("catalyst")
    || itemType.includes("catalyst")
    || itemType.includes("催化剂");
  if (kind === "masterwork") return !isCatalyst && (category.includes("masterwork") || itemType.includes("masterwork") || itemType.includes("大师杰作"));
  if (kind === "catalyst") return isCatalyst;
  if (kind === "enhancement") return text.includes("装备阶级升级") || /(?:^|\s)\d+阶升级/.test(text) || text.includes("empty enhancement tier");
  return (category.includes("weapon.mod") || category.includes("modguns") || category.includes("mods.weapon") || itemType.includes("weapon mod") || itemType.includes("武器模组"))
    && !category.includes("shader")
    && !category.includes("memento");
}

function sortConfigurationColumns<T extends { role: WeaponPerkColumnRole; socket_index: number }>(columns: T[]): T[] {
  return [...columns].sort((left, right) => left.socket_index - right.socket_index);
}

function labelTraitColumns(columns: WeaponPerkSelectionColumn[]): WeaponPerkSelectionColumn[] {
  let traitIndex = 0;
  return columns.map((column) => column.role === "trait"
    ? { ...column, label: `Perk ${++traitIndex}` }
    : column);
}

function findBasePerkHash(
  enhancedName: string,
  candidates: WeaponDetailViewModel["configuration"]["pool_columns"][number]["candidates"] | undefined
): number | undefined {
  const normalized = normalizePerkVariantName(enhancedName);
  return candidates?.find((candidate) => normalizePerkVariantName(candidate.name) === normalized)?.hash;
}

function normalizePerkVariantName(value: string): string {
  return value.toLocaleLowerCase()
    .replace(/enhanced/gi, "")
    .replace(/强化(?:版|型|特性)?/g, "")
    .replace(/[\s·:：()（）_-]+/g, "")
    .trim();
}

function extractCraftingLevel(
  objectives: NonNullable<SelectedItemDetail["item_objectives"]>
): number | undefined {
  for (const objective of objectives) {
    const description = objective.progress_description ?? "";
    const match = description.match(/(?:等级|level)\s*[:：]?\s*(\d+)/i);
    if (match) return Number(match[1]);
  }
  return undefined;
}

function extractDisplayedLevel(value: string): number | undefined {
  const match = value.match(/(?:等级|tier|level)\s*[:：]?\s*(\d+)|(\d+)\s*阶/i);
  return match ? Number(match[1] ?? match[2]) : undefined;
}

function firstStatModifier(
  modifiers: NonNullable<SelectedItemDetail["weapon_stats"]> | undefined
): [WeaponStatKey, number] | undefined {
  return Object.entries(modifiers ?? {}).find((entry): entry is [WeaponStatKey, number] => (
    typeof entry[1] === "number" && entry[1] !== 0
  ));
}

const weaponStatKeyByHash: Partial<Record<number, WeaponStatKey>> = {
  4043523819: "impact",
  1240592695: "range",
  155624089: "stability",
  943549884: "handling",
  4188031367: "reload_speed",
  1345609583: "aim_assistance",
  2715839340: "recoil_direction",
  2714457168: "airborne_effectiveness",
  1931675084: "ammo_generation",
  3871231066: "magazine",
  4284893193: "rounds_per_minute",
  2961396640: "charge_time",
  447667954: "draw_time"
};

const weaponStatKeys: WeaponStatKey[] = [
  "impact",
  "range",
  "stability",
  "handling",
  "reload_speed",
  "aim_assistance",
  "recoil_direction",
  "airborne_effectiveness",
  "ammo_generation",
  "magazine",
  "rounds_per_minute",
  "charge_time",
  "draw_time"
];

const championLabels = {
  barrier: "反屏障",
  overload: "反过载",
  unstoppable: "反势不可挡"
} as const;

const championEffectLabels = {
  barrier: "贯穿护盾",
  overload: "干扰",
  unstoppable: "眩晕"
} as const;

function championFromInstance(
  breakerType: number | undefined
): WeaponDetailViewModel["identity"]["champion"] {
  const championType = breakerType === 1
    ? "barrier"
    : breakerType === 2
      ? "overload"
      : breakerType === 3
        ? "unstoppable"
        : undefined;
  if (!championType) return undefined;
  return {
    key: championType,
    label: championLabels[championType],
    effect_label: championEffectLabels[championType],
    source: "weapon"
  };
}
