import type { VaultTagValue } from "../../../api/types";
import type { SameNameItemSummary, SelectedItemDetail } from "../../hooks/useItemDetail";

export function formatCommunityMode(mode: "pve" | "pvp" | "general"): string {
  switch (mode) {
    case "pve": return "PvE";
    case "pvp": return "PvP";
    case "general": return "通用";
    default: return mode;
  }
}

export function getItemSourceStatusTone(item: Pick<SelectedItemDetail, "is_detail_loading" | "source">): "ready" | "pending" | "warning" | "neutral" {
  if (item.is_detail_loading) {
    return "pending";
  }

  if (item.source.status === "ready") {
    return "ready";
  }

  if (item.source.status === "missing") {
    return "warning";
  }

  return "neutral";
}

export function formatAccountItemMeta(item: SameNameItemSummary): string {
  return [
    "source_label" in item ? `来源：${item.source_label}` : undefined,
    item.bucket_name,
    item.tier,
    item.power ? `光等 ${item.power}` : undefined,
    formatArmorStatsSummary(item),
    item.locked ? "已锁定" : undefined
  ].filter(Boolean).join(" / ");
}

export function formatArmorStatsSummary(item: Pick<SelectedItemDetail | SameNameItemSummary, "armor_stats">): string | undefined {
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

export function formatArmorEnergySummary(energy: SelectedItemDetail["armor_energy"]): string | undefined {
  if (!energy) {
    return undefined;
  }

  return `已用 ${energy.used} / ${energy.capacity}，剩余 ${energy.unused}`;
}

export function formatWishlistModeLabels(labels: string[]): string[] {
  return labels.filter((label) => label !== "DIM Wishlist");
}

export function formatVaultTagLabel(tag: VaultTagValue): string {
  if (tag === "keep") return "保留";
  if (tag === "review") return "待定";
  if (tag === "farm") return "待刷";
  if (tag === "loadout") return "配装用";
  if (tag === "junk") return "清理";
  return "未标记";
}
