import { analyzeDuplicateItems, type DuplicateAnalysisResult, type DuplicateItemGroup } from "@d2-tools/core/analysis/duplicates";
import type { AccountItemSummary } from "@d2-tools/core/account/summary";
import type { SaveVaultTagInput, VaultTags, VaultTagValue } from "@d2-tools/core/vault/tags";

type BatchItemActionResultLike = {
  success_count: number;
  failed_count: number;
};

type VaultAmmoFilter = "all" | "primary" | "special" | "heavy";

const ammoFilterLabels: Record<VaultAmmoFilter, string> = {
  all: "全部弹药",
  primary: "主弹",
  special: "特殊",
  heavy: "重弹"
};

const tagLabelsForCleanup = {
  keep: "保留",
  review: "待定",
  junk: "清理",
  farm: "待刷",
  loadout: "配装用"
} as const;

export type DuplicateGroupBatchTagMode =
  | "keep-best-review-rest"
  | "keep-best-junk-rest"
  | "clear-group-tags";

export type DuplicateGroupSelectionMode =
  | "rest"
  | "junk";

export function buildVaultBulkMoveResultMessage(
  targetCharacterLabel: string,
  result: BatchItemActionResultLike
): string {
  const targetLabel = targetCharacterLabel || "目标角色";
  if (!result.failed_count) {
    return `已转移到${targetLabel}：共 ${result.success_count} 件，页面已更新。`;
  }

  return `部分转移到${targetLabel}：成功 ${result.success_count} 件，失败 ${result.failed_count} 件。可到设置 -> 操作日志查看失败详情。`;
}

export function buildVaultBatchTagCopy(tag: VaultTagValue): { action: string; loading: string } {
  switch (tag) {
    case "review":
      return { action: "批量待定", loading: "正在批量标记为待定..." };
    case "junk":
      return { action: "批量清理", loading: "正在批量标记为清理..." };
    case "farm":
      return { action: "批量待刷", loading: "正在批量标记为待刷..." };
    case "loadout":
      return { action: "批量配装用", loading: "正在批量标记为配装用..." };
    case "none":
    case "keep":
    default:
      return {
        action: tag === "keep" ? "批量保留" : "批量清除",
        loading: tag === "keep" ? "正在批量标记为保留..." : "正在批量清除本地标记..."
      };
  }
}

export function buildVaultBatchTagResultMessage(itemCount: number): string {
  return `已处理 ${itemCount} 件装备。`;
}

export function buildVaultCandidateSelectionMessage(input: {
  addedCount: number;
  totalCount: number;
}): string {
  return input.addedCount
    ? `已加入 ${input.addedCount} 件候选，当前共 ${input.totalCount} 件。`
    : "这一组没有可加入的候选。";
}

export function buildVaultSelectedBulkMovePrepareMessage(itemCount: number): string {
  return `正在准备移动 ${itemCount} 件装备...`;
}

export function buildVaultSelectedBulkMoveNoSelectionMessage(): string {
  return "请先选择要移动的装备。";
}

export function buildVaultCleanupNoTargetMessage(): string {
  return "请先选择目标角色。";
}

export function buildVaultCleanupClipboardUnavailableMessage(): string {
  return "剪贴板不可用，请稍后重试。";
}

export function buildVaultCleanupActionLabel(action: "unlock" | "transfer"): string {
  return action === "unlock" ? "批量解锁" : "转移到角色背包";
}

export function buildVaultCleanupActionProgressMessage(action: "unlock" | "transfer"): string {
  return action === "unlock" ? "正在批量解锁..." : "正在转移到角色背包...";
}

export function buildVaultCleanupClipboardText(items: AccountItemSummary[], tags: VaultTags): string {
  return `${buildVaultCleanupText(items, tags)}\n\n${buildVaultCleanupLocatorText(items, tags)}`;
}

export function buildVaultCleanupCopiedMessage(itemCount: number): string {
  return `已复制 ${itemCount} 件装备的清理清单。`;
}

export function buildVaultCleanupText(items: AccountItemSummary[], tags: VaultTags): string {
  const lines = [
    "d2-tools 仓库清理清单",
    `生成时间：${new Date().toLocaleString("zh-CN")}`,
    `物品数量：${items.length}`,
    ""
  ];

  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.name}`);
    lines.push(`   类型：${[item.bucket_name, item.item_type, item.tier].filter(Boolean).join(" / ") || "未知"}`);
    const note = tags.items[getVaultActionItemKey(item)]?.note;
    if (note) {
      lines.push(`   备注：${note}`);
    }
    lines.push("");
  });

  return lines.join("\n").trimEnd();
}

export function buildVaultCleanupLocatorText(items: AccountItemSummary[], tags: VaultTags): string {
  const duplicateNameCounts = items.reduce<Map<string, number>>((counts, item) => {
    counts.set(item.name, (counts.get(item.name) ?? 0) + 1);
    return counts;
  }, new Map());
  const lines = [
    "游戏内定位提示",
    "d2-tools 的标记只保存在本机，游戏里不会显示。建议先把候选装备转移到同一个角色背包，再按下面信息逐件核对。",
    ""
  ];

  items.forEach((item, index) => {
    const key = getVaultActionItemKey(item);
    const tag = tags.items[key]?.tag;
    const note = tags.items[key]?.note;
    const plugs = item.socket_plugs?.map((plug) => plug.name).filter(Boolean).slice(0, 5).join(" / ");
    const duplicateCount = duplicateNameCounts.get(item.name) ?? 0;
    lines.push(`${index + 1}. ${item.name}`);
    lines.push(`   定位：${formatVaultItemMeta(item) || "未知位置 / 未知类型"}`);
    if (item.power) lines.push(`   光等 ${item.power}`);
    lines.push(`   ${item.locked ? "已锁定" : "未锁定"}`);
    if (plugs) lines.push(`   Perk：${plugs}`);
    if (tag) lines.push(`   本地标记：${tagLabelsForCleanup[tag]}`);
    if (note) lines.push(`   备注：${note}`);
    if (duplicateCount > 1) lines.push(`   同名装备有 ${duplicateCount} 件，请按光等、锁定状态和 Perk 区分。`);
    lines.push("");
  });

  return lines.join("\n").trimEnd();
}

export function buildVaultDuplicateSummary(items: AccountItemSummary[], tags: VaultTags): DuplicateAnalysisResult {
  return analyzeDuplicateItems(items.map(normalizeCoreItem), tags);
}

export function buildDuplicateGroupBatchTagPlan(
  group: DuplicateItemGroup,
  mode: DuplicateGroupBatchTagMode,
  keepItemKey = group.items[0]?.item_key ?? ""
): SaveVaultTagInput[] {
  if (mode === "clear-group-tags") {
    return group.items.map((item) => ({
      item_key: item.item_key,
      tag: "none"
    }));
  }

  return group.items.map((item, index) => ({
    item_key: item.item_key,
    tag: item.item_key === keepItemKey || (!keepItemKey && index === 0)
      ? "keep"
      : mode === "keep-best-review-rest"
        ? "review"
        : "junk"
  }));
}

export function protectVaultCleanupTagPlan(
  inputs: readonly SaveVaultTagInput[],
  protectionByItemKey: ReadonlyMap<string, readonly string[]> | undefined,
  currentTags: VaultTags
): { inputs: SaveVaultTagInput[]; protectedCount: number } {
  let protectedCount = 0;
  return {
    inputs: inputs.map((entry) => {
      if (entry.tag !== "junk" || !(protectionByItemKey?.get(entry.item_key)?.length)) {
        return entry;
      }
      protectedCount += 1;
      return {
        ...entry,
        tag: currentTags.items[entry.item_key]?.tag ?? "none"
      };
    }),
    protectedCount
  };
}

export function buildDuplicateGroupBatchActionCopy(
  groupName: string,
  mode: DuplicateGroupBatchTagMode
): { action: string; loading: string; success: string } {
  if (mode === "keep-best-review-rest") {
    return {
      action: "重复组标记为待定",
      loading: `正在处理 ${groupName}，保留选中件，其余标记为待定...`,
      success: `已处理 ${groupName}，保留选中件，其余标记为待定`
    };
  }
  if (mode === "keep-best-junk-rest") {
    return {
      action: "重复组标记为清理",
      loading: `正在处理 ${groupName}，保留选中件，其余标记为清理...`,
      success: `已处理 ${groupName}，保留选中件，其余标记为清理`
    };
  }
  return {
    action: "清除重复组标记",
    loading: `正在清除 ${groupName} 这组装备的本地标记...`,
    success: `已清除 ${groupName} 这组装备的本地标记`
  };
}

export function selectDuplicateGroupItems(
  group: DuplicateItemGroup,
  mode: DuplicateGroupSelectionMode,
  keepItemKey = group.items[0]?.item_key ?? ""
): string[] {
  if (mode === "junk") {
    return group.items
      .filter((item) => item.item_key !== keepItemKey && item.tag === "junk")
      .map((item) => item.item_key);
  }

  return group.items
    .filter((item) => item.item_key !== keepItemKey)
    .map((item) => item.item_key);
}

export function selectVaultActionableItems(
  items: AccountItemSummary[],
  filterItem: (item: AccountItemSummary) => boolean = () => true
): AccountItemSummary[] {
  return items.filter((item) => item.instance_id && filterItem(item));
}

export function buildVaultCleanupWriteConfirmText(label: string, itemCount: number): string {
  return `确认要${label} ${itemCount} 件清理装备吗？这个操作不会分解装备。`;
}

export function buildVaultCleanupWriteResultMessage(input: {
  label: string;
  successCount: number;
  failedCount: number;
}): string {
  return input.failedCount
    ? `${input.label}部分完成：成功 ${input.successCount} 件，失败 ${input.failedCount} 件。`
    : `${input.label}完成：成功 ${input.successCount} 件。`;
}

export function buildVaultBatchTransferConfirmText(itemCount: number): string {
  return `确认要批量转移 ${itemCount} 件仓库装备到目标角色吗？`;
}

export function buildVaultBatchTransferProgressMessage(itemCount: number): string {
  return `正在批量转移 ${itemCount} 件装备...`;
}

export function getVaultActionItemKey(item: AccountItemSummary): string {
  return item.instance_id ?? `hash:${item.hash}`;
}

function normalizeCoreItem(item: AccountItemSummary): AccountItemSummary & { socket_plugs: NonNullable<AccountItemSummary["socket_plugs"]> } {
  return {
    ...item,
    socket_plugs: item.socket_plugs ?? []
  };
}

function formatArmorStatsInline(item: AccountItemSummary): string | undefined {
  if (!item.armor_stats) {
    return undefined;
  }

  return [
    `总值 ${item.armor_stats.total}`,
    `生命值 ${item.armor_stats.health}`,
    `职业 ${item.armor_stats.class}`,
    `手雷 ${item.armor_stats.grenade}`
  ].join(" / ");
}

function formatVaultItemMeta(item: AccountItemSummary): string {
  return [
    item.bucket_name,
    item.item_type,
    item.ammo_type ? ammoFilterLabels[item.ammo_type] : undefined,
    item.tier,
    item.power ? `光等 ${item.power}` : undefined,
    formatArmorStatsInline(item),
    item.locked ? "已锁定" : undefined
  ].filter(Boolean).join(" / ");
}
