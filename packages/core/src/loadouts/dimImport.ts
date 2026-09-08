import type { AccountItemSummary, AccountSummary } from "../account/summary.js";
import {
  createDefaultArmorStatModSlotRules,
  type CreateLocalLoadoutPlanInput,
  type LoadoutPlanArmorConstraints,
  type LoadoutPlanArmorStatKey,
  type LocalLoadoutPlan
} from "./plans.js";

export type DimLoadoutImportPreview = {
  source_url: string;
  name: string;
  class_name: string;
  item_count: number;
  warnings: string[];
  draft: CreateLocalLoadoutPlanInput;
};

export type DimLoadoutLink = {
  kind: "url-loadout";
  source_url: string;
  inline_loadout: unknown;
};

export type DimLoadoutExportBlockerCode =
  | "empty-plan"
  | "unsupported-armor-mode"
  | "unknown-class"
  | "missing-instance"
  | "instance-not-found"
  | "hash-mismatch"
  | "plug-unavailable"
  | "duplicate-instance";

export type DimLoadoutExportBlocker = {
  code: DimLoadoutExportBlockerCode;
  message: string;
  target_index?: number;
  instance_id?: string;
};

export type DimLoadoutExportResult = {
  status: "ready";
  url: string;
  item_count: number;
  warnings: string[];
} | {
  status: "blocked";
  blockers: DimLoadoutExportBlocker[];
};

type DimApiLoadoutItem = {
  hash: number;
  id?: string;
  bucketName?: string;
  socketOverrides?: Record<string, number>;
};

type DimApiLoadout = {
  name: string;
  classType: 0 | 1 | 2;
  equipped: DimApiLoadoutItem[];
  unequipped: DimApiLoadoutItem[];
  parameters?: {
    mods?: number[];
  };
  notes?: string;
};

/** Accept only self-contained DIM loadout URLs so importing never calls a DIM service. */
export function parseDimLoadoutLink(value: string): DimLoadoutLink {
  const raw = value.trim();
  if (!raw) throw new Error("请输入 DIM 完整配装链接。");

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("这不是有效的 DIM 完整配装链接。请从 DIM 复制包含 /loadouts?loadout=... 的链接。");
  }
  if (/(^|\.)dim\.gg$/i.test(url.hostname)) {
    throw new Error("不支持 dim.gg 短链接，因为解析短链接需要访问 DIM 接口。请从 DIM 复制包含 /loadouts?loadout=... 的完整链接。");
  }
  if (url.protocol !== "https:" || !/(^|\.)destinyitemmanager\.com$/i.test(url.hostname) || !url.pathname.endsWith("/loadouts")) {
    throw new Error("仅支持 DIM 的 /loadouts?loadout=... 完整配装链接。");
  }
  const serialized = url.searchParams.get("loadout");
  if (!serialized) throw new Error("DIM 链接中没有可本地读取的 loadout 数据，请复制完整配装链接。");
  try {
    return { kind: "url-loadout", source_url: url.toString(), inline_loadout: JSON.parse(serialized) as unknown };
  } catch {
    throw new Error("DIM 链接中的 loadout 数据不是有效 JSON。");
  }
}

export function createDimLoadoutImportPreview(input: {
  source_url: string;
  payload: unknown;
}): DimLoadoutImportPreview {
  const loadout = unwrapLoadout(input.payload);
  const allItems = collectLoadoutItems(loadout);
  const subclassItem = allItems.find(isExplicitSubclassItem);
  const items = allItems.filter((item) => item !== subclassItem);
  if (!items.length) throw new Error("DIM 配装没有可导入的装备条目。");

  const warnings: string[] = [];
  const itemTargets = items.flatMap((entry, index) => {
    const record = object(entry);
    const itemHash = finiteNumber(record.hash ?? record.itemHash);
    if (itemHash === undefined) {
      warnings.push(`第 ${index + 1} 项缺少装备定义，已跳过。`);
      return [];
    }
    const instanceId = string(record.id ?? record.itemInstanceId ?? record.instanceId);
    const plugHashes = extractPlugHashes(record.socketOverrides ?? record.plugs ?? record.plugItemHashes);
    return [{
      slot: string(record.bucketName ?? record.bucket_name) ?? `DIM 装备 ${index + 1}`,
      item_hash: itemHash >>> 0,
      ...(instanceId ? { selected_instance_id: instanceId } : {}),
      plug_hashes: plugHashes
    }];
  });
  if (!itemTargets.length) throw new Error("DIM 配装的装备条目缺少可用的定义 Hash。");

  const parameters = object(loadout.parameters);
  const className = classNameFromDim(loadout.classType ?? loadout.class_type);
  const name = string(loadout.name) ?? "DIM 导入方案";
  const notes = [string(loadout.notes), string(loadout.description)].filter(Boolean).join("\n") || undefined;
  const armorConstraints = extractArmorConstraints(parameters, warnings);
  const subclass = extractSubclass(parameters, warnings, subclassItem);

  return {
    source_url: input.source_url,
    name,
    class_name: className,
    item_count: itemTargets.length,
    warnings,
    draft: {
      name,
      class_name: className,
      source: { kind: "dim-link", reference_url: input.source_url, label: "DIM 完整链接" },
      item_targets: itemTargets,
      ...(subclass ? { subclass_target: subclass } : {}),
      ...(armorConstraints ? { armor_constraints: armorConstraints } : {}),
      ...(notes ? { notes } : {}),
      guidance: {
        warnings,
        evidence: [`DIM 完整配装链接：${input.source_url}`]
      }
    }
  };
}

/** Build a self-contained DIM loadout URL only from account-verified item instances. */
export function createDimLoadoutExport(input: {
  plan: Pick<LocalLoadoutPlan, "name" | "class_name" | "item_targets" | "subclass_target" | "armor_constraints" | "notes">;
  account: AccountSummary | null;
}): DimLoadoutExportResult {
  const blockers: DimLoadoutExportBlocker[] = [];
  if (!input.plan.item_targets.length) {
    blockers.push({ code: "empty-plan", message: "方案没有可导出的装备目标。" });
  }
  const plannerMode = input.plan.armor_constraints?.planner_mode;
  if (plannerMode === "theoretical" || plannerMode === "acquisition") {
    blockers.push({
      code: "unsupported-armor-mode",
      message: plannerMode === "theoretical"
        ? "理论上限只描述属性可达性，不包含真实装备实例。"
        : "待刷目标仍包含未持有装备，不能生成真实实例链接。"
    });
  }
  const classType = classTypeFromName(input.plan.class_name);
  if (classType === undefined) {
    blockers.push({ code: "unknown-class", message: "目标职业无法映射为 DIM 支持的泰坦、猎人或术士。" });
  }
  if (!input.account) {
    blockers.push({ code: "instance-not-found", message: "当前没有可用于核对真实实例的账号快照。" });
  }
  if (blockers.length || !input.account || classType === undefined) {
    return { status: "blocked", blockers };
  }

  const accountItems = collectAccountItemsByInstanceId(input.account);
  const equipped: DimApiLoadoutItem[] = [];
  const seenInstanceIds = new Set<string>();
  input.plan.item_targets.forEach((target, targetIndex) => {
    const index = targetIndex + 1;
    const instanceId = target.selected_instance_id;
    if (!instanceId) {
      blockers.push({
        code: "missing-instance",
        message: `第 ${index} 个装备目标“${target.slot}”尚未绑定真实实例。`,
        target_index: targetIndex
      });
      return;
    }
    if (seenInstanceIds.has(instanceId)) {
      blockers.push({
        code: "duplicate-instance",
        message: `实例 ${instanceId} 在方案中被重复使用。`,
        target_index: targetIndex,
        instance_id: instanceId
      });
      return;
    }
    seenInstanceIds.add(instanceId);
    const item = accountItems.get(instanceId);
    if (!item) {
      blockers.push({
        code: "instance-not-found",
        message: `第 ${index} 个装备目标“${target.slot}”已不在当前账号快照中。`,
        target_index: targetIndex,
        instance_id: instanceId
      });
      return;
    }
    if (target.item_hash !== undefined && target.item_hash !== item.hash) {
      blockers.push({
        code: "hash-mismatch",
        message: `第 ${index} 个装备目标“${target.slot}”的定义 Hash 与实例不一致。`,
        target_index: targetIndex,
        instance_id: instanceId
      });
      return;
    }
    const socketOverrides = resolveSocketOverrides(item, [
      ...target.plug_hashes,
      ...(target.candidate_conditions?.required_plug_hashes ?? [])
    ]);
    if (socketOverrides === null) {
      blockers.push({
        code: "plug-unavailable",
        message: `第 ${index} 个装备目标“${target.slot}”有 Plug 无法映射到该实例的具体插槽。`,
        target_index: targetIndex,
        instance_id: instanceId
      });
      return;
    }
    equipped.push({
      hash: item.hash >>> 0,
      id: instanceId,
      bucketName: target.slot,
      ...(Object.keys(socketOverrides).length ? { socketOverrides } : {})
    });
  });
  if (blockers.length) return { status: "blocked", blockers };

  const warnings: string[] = [];
  const subclass = input.plan.subclass_target;
  if (subclass?.subclass_hash) {
    equipped.push({ hash: subclass.subclass_hash >>> 0, bucketName: "子职业" });
  }
  if (subclass && (subclass.ability_hashes.length || subclass.aspect_hashes.length || subclass.fragment_hashes.length)) {
    warnings.push("子职业技能、星相和碎片缺少原始插槽索引，本次只导出可确认的子职业定义与模组。");
  }
  const payload: DimApiLoadout = {
    name: input.plan.name.trim() || "d2-tools 配装",
    classType,
    equipped,
    unequipped: [],
    ...(subclass?.mod_hashes.length
      ? { parameters: { mods: uniqueNumbers(subclass.mod_hashes) } }
      : {}),
    ...(input.plan.notes?.trim() ? { notes: input.plan.notes.trim() } : {})
  };
  const url = new URL("https://app.destinyitemmanager.com/loadouts");
  url.searchParams.set("loadout", JSON.stringify(payload));
  return {
    status: "ready",
    url: url.toString(),
    item_count: input.plan.item_targets.length,
    warnings
  };
}

function unwrapLoadout(value: unknown): Record<string, unknown> {
  const root = object(value);
  const nested = object(root.loadout);
  const loadout = Object.keys(nested).length ? nested : root;
  if (!Array.isArray(loadout.items) && !Array.isArray(loadout.equipped) && !Array.isArray(loadout.unequipped)) {
    throw new Error("DIM 返回的数据不包含 items 或 equipped / unequipped，格式可能已经变化。");
  }
  return loadout;
}

function collectLoadoutItems(loadout: Record<string, unknown>): unknown[] {
  const legacyItems = array(loadout.items);
  if (legacyItems.length) return legacyItems;
  return [...array(loadout.equipped), ...array(loadout.unequipped)];
}

function isExplicitSubclassItem(value: unknown): boolean {
  const bucketName = string(object(value).bucketName ?? object(value).bucket_name)?.toLocaleLowerCase();
  return bucketName === "子职业" || bucketName === "subclass";
}

function collectAccountItemsByInstanceId(account: AccountSummary): Map<string, AccountItemSummary> {
  const items = [
    ...account.characters.flatMap((character) => [
      ...character.equipped_items,
      ...character.inventory_items,
      ...character.postmaster_items
    ]),
    ...account.vault.items
  ];
  return new Map(items.flatMap((item) => item.instance_id ? [[item.instance_id, item] as const] : []));
}

function resolveSocketOverrides(item: AccountItemSummary, plugHashes: number[]): Record<string, number> | null {
  const overrides: Record<string, number> = {};
  for (const plugHash of uniqueNumbers(plugHashes)) {
    const sockets = item.sockets ?? [];
    const socket = sockets.find((candidate) => candidate.selected_plug?.hash === plugHash)
      ?? sockets.find((candidate) => candidate.reusable_plugs.some((plug) => (
        plug.hash === plugHash && plug.can_insert !== false && plug.enabled !== false
      )));
    if (!socket) return null;
    const key = String(socket.socket_index);
    if (overrides[key] !== undefined && overrides[key] !== plugHash) return null;
    overrides[key] = plugHash >>> 0;
  }
  return overrides;
}

function extractPlugHashes(value: unknown): number[] {
  const hashes: number[] = [];
  const add = (candidate: unknown) => {
    const hash = finiteNumber(candidate);
    if (hash !== undefined) hashes.push(hash >>> 0);
  };
  if (Array.isArray(value)) value.forEach(add);
  else if (value && typeof value === "object") Object.values(value as Record<string, unknown>).forEach(add);
  else add(value);
  return [...new Set(hashes)];
}

function extractArmorConstraints(
  parameters: Record<string, unknown>,
  warnings: string[]
): LoadoutPlanArmorConstraints | undefined {
  const constraints = array(parameters.statConstraints ?? parameters.stat_constraints);
  if (!constraints.length) return undefined;
  const statMinimums: Partial<Record<LoadoutPlanArmorStatKey, number>> = {};
  for (const value of constraints) {
    const record = object(value);
    const stat = dimStatKey(record.stat ?? record.statName ?? record.statHash);
    const minimum = finiteNumber(record.minStat ?? record.minimum ?? record.minTier);
    if (!stat || minimum === undefined) {
      warnings.push("DIM 中有无法映射到当前六维模型的属性约束，已保留为预览警告。");
      continue;
    }
    statMinimums[stat] = Math.max(minimum > 10 && "minTier" in record ? minimum * 10 : minimum, 0);
  }
  if (!Object.keys(statMinimums).length) return undefined;
  return {
    stat_minimums: statMinimums,
    priority_stats: [],
    fragment_stat_bonuses: {},
    five_point_mod_budget: 0,
    ten_point_mod_budget: 0,
    armor_stat_mod_slot_rules: createDefaultArmorStatModSlotRules(),
    locked_instance_ids: [],
    excluded_instance_ids: [],
    allowed_locations: ["equipped", "inventory", "vault", "postmaster"]
  };
}

function extractSubclass(parameters: Record<string, unknown>, warnings: string[], subclassItem?: unknown) {
  const subclass = object(parameters.subclass ?? parameters.subclassConfig);
  const subclassHash = finiteNumber(subclass.hash ?? subclass.subclassHash ?? object(subclassItem).hash);
  const abilityHashes = numberArray(subclass.abilities ?? subclass.abilityHashes);
  const aspectHashes = numberArray(subclass.aspects ?? subclass.aspectHashes);
  const fragmentHashes = numberArray(subclass.fragments ?? subclass.fragmentHashes);
  const modHashes = numberArray(parameters.mods ?? subclass.mods);
  if (!subclassHash && !abilityHashes.length && !aspectHashes.length && !fragmentHashes.length && !modHashes.length) return undefined;
  if (!subclassHash) warnings.push("DIM 子职业配置未提供稳定子职业 Hash，仅保留可确认的技能和模组 Hash。");
  return {
    ...(subclassHash ? { subclass_hash: subclassHash >>> 0 } : {}),
    ability_hashes: abilityHashes,
    aspect_hashes: aspectHashes,
    fragment_hashes: fragmentHashes,
    mod_hashes: modHashes
  };
}

function dimStatKey(value: unknown): LoadoutPlanArmorStatKey | undefined {
  const normalized = String(value ?? "").toLowerCase();
  if (["resilience", "health", "4244567218"].includes(normalized)) return "health";
  if (["strength", "melee", "392767087"].includes(normalized)) return "melee";
  if (["discipline", "grenade", "1735777505"].includes(normalized)) return "grenade";
  if (["intellect", "super", "144602215"].includes(normalized)) return "super";
  if (["mobility", "class", "1943323491"].includes(normalized)) return "class";
  if (["recovery", "weapon", "2996146975"].includes(normalized)) return "weapon";
  return undefined;
}

function classNameFromDim(value: unknown): string {
  const classType = finiteNumber(value);
  if (classType === 0) return "泰坦";
  if (classType === 1) return "猎人";
  if (classType === 2) return "术士";
  return "未限定职业";
}

function classTypeFromName(value: string): 0 | 1 | 2 | undefined {
  const normalized = value.trim().toLocaleLowerCase();
  if (normalized === "泰坦" || normalized === "titan") return 0;
  if (normalized === "猎人" || normalized === "hunter") return 1;
  if (normalized === "术士" || normalized === "warlock") return 2;
  return undefined;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function string(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function numberArray(value: unknown): number[] {
  return array(value)
    .map((item) => typeof item === "object" && item ? finiteNumber(object(item).hash ?? object(item).plugItemHash) : finiteNumber(item))
    .filter((item): item is number => item !== undefined)
    .map((item) => item >>> 0);
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values.filter((value) => Number.isFinite(value)).map((value) => value >>> 0))];
}
