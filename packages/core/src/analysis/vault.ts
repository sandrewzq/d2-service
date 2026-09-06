import type { AccountItemSummary, EquipmentGroupKey } from "../account/summary.js";
import type { VaultTags } from "../vault/tags.js";

export type VaultAnalysisInput = {
  items: AccountItemSummary[];
  tags: VaultTags;
};

export type VaultAnalysisItem = {
  item_key: string;
  name: string;
  tier?: string;
  item_type?: string;
  power?: number;
  note?: string;
  plugs: string[];
};

export type VaultAnalysisResult = {
  facts: string[];
  analysis: string[];
  suggestions: string[];
  items: {
    keep: VaultAnalysisItem[];
    review: VaultAnalysisItem[];
    junk: VaultAnalysisItem[];
  };
};

type LocalAnalysisTag = "keep" | "review" | "junk" | "farm" | "loadout";

const groupLabels: Record<EquipmentGroupKey, string> = {
  weapons: "武器",
  armor: "护甲",
  equipment: "其他装备",
  other: "其他"
};

const groupOrder: EquipmentGroupKey[] = ["weapons", "armor", "equipment", "other"];

export function analyzeVault(input: VaultAnalysisInput): VaultAnalysisResult {
  const groupCounts = countGroups(input.items);
  const keep = taggedItems(input, "keep");
  const review = taggedItems(input, "review");
  const junk = taggedItems(input, "junk");
  const keepCount = countTaggedItems(input, "keep");
  const reviewCount = countTaggedItems(input, "review");
  const junkCount = countTaggedItems(input, "junk");
  const farmCount = countTaggedItems(input, "farm");
  const loadoutCount = countTaggedItems(input, "loadout");
  const taggedCount = keepCount + reviewCount + junkCount + farmCount + loadoutCount;
  const untaggedCount = input.items.length - taggedCount;
  const rollCount = input.items.filter((item) => item.socket_plugs?.length).length;

  return {
    facts: [
      `仓库共 ${input.items.length} 件物品，其中${formatGroupCounts(groupCounts)}。`,
      `本地标记：保留 ${keepCount} 件、待定 ${reviewCount} 件、清理 ${junkCount} 件、待刷 ${farmCount} 件、配装用 ${loadoutCount} 件、未标记 ${untaggedCount} 件。`,
      `已读取实际 roll 的物品 ${rollCount} 件。`
    ],
    analysis: buildAnalysis({ keep, review, junk, untaggedCount }),
    suggestions: buildSuggestions({ review, junk, untaggedCount }),
    items: {
      keep,
      review,
      junk
    }
  };
}

function countGroups(items: AccountItemSummary[]): Record<EquipmentGroupKey, number> {
  return groupOrder.reduce<Record<EquipmentGroupKey, number>>((counts, key) => {
    counts[key] = items.filter((item) => item.group_key === key).length;
    return counts;
  }, {
    weapons: 0,
    armor: 0,
    equipment: 0,
    other: 0
  });
}

function formatGroupCounts(counts: Record<EquipmentGroupKey, number>): string {
  return groupOrder.map((key) => `${groupLabels[key]} ${counts[key]} 件`).join("、");
}

function countTaggedItems(input: VaultAnalysisInput, tag: LocalAnalysisTag): number {
  return input.items.filter((item) => input.tags.items[itemKey(item)]?.tag === tag).length;
}

function taggedItems(input: VaultAnalysisInput, tag: LocalAnalysisTag): VaultAnalysisItem[] {
  return input.items
    .filter((item) => input.tags.items[itemKey(item)]?.tag === tag)
    .slice(0, 12)
    .map((item) => ({
      item_key: itemKey(item),
      name: item.name,
      tier: item.tier,
      item_type: item.item_type,
      power: item.power,
      note: input.tags.items[itemKey(item)]?.note,
      plugs: (item.socket_plugs ?? []).slice(0, 6).map((plug) => plug.name)
    }));
}

function buildAnalysis(input: {
  keep: VaultAnalysisItem[];
  review: VaultAnalysisItem[];
  junk: VaultAnalysisItem[];
  untaggedCount: number;
}): string[] {
  const lines: string[] = [];
  if (input.keep.length) {
    lines.push(`保留标记集中在 ${formatItemNames(input.keep)}。`);
  }
  if (input.review.length) {
    lines.push(`待定标记集中在 ${formatItemNames(input.review)}，适合后续人工确认。`);
  }
  if (input.junk.length) {
    lines.push(`清理标记已有 ${input.junk.length} 件，适合在正式删除前再次确认。`);
  }
  if (input.untaggedCount) {
    lines.push(`还有 ${input.untaggedCount} 件未标记，AI 深度分析前建议先补一轮人工判断。`);
  }

  return lines.length ? lines : ["当前仓库还没有足够的本地标记，建议先在仓库页标记几件装备。"];
}

function buildSuggestions(input: {
  review: VaultAnalysisItem[];
  junk: VaultAnalysisItem[];
  untaggedCount: number;
}): string[] {
  const lines: string[] = [];
  if (input.review.length) {
    lines.push(`优先查看“待定”标记的 ${input.review.length} 件装备，确认是否改为保留或清理。`);
  }
  if (input.junk.length) {
    lines.push(`清理前先复查“清理”标记，避免误删高光等或稀有 roll。`);
  }
  if (input.untaggedCount) {
    lines.push(`继续给未标记装备补标签，这会让后续 AI 建议更贴近你的习惯。`);
  }

  return lines.length ? lines : ["先读取账号数据并在仓库页添加本地标记。"];
}

function formatItemNames(items: VaultAnalysisItem[]): string {
  return items.slice(0, 4).map((item) => item.name).join("、");
}

function itemKey(item: AccountItemSummary): string {
  return item.instance_id ?? `hash:${item.hash}`;
}
