import type { AccountItemPlugSummary, VaultItemScore, VaultTagValue } from "../api/types";

export type ShareableItem = {
  name: string;
  tier?: string;
  item_type?: string;
  bucket_name?: string;
  power?: number;
  locked?: boolean;
  socket_plugs?: AccountItemPlugSummary[];
};

export type ItemShareTextInput = {
  item: ShareableItem;
  score?: VaultItemScore | null;
  tag?: VaultTagValue;
  note?: string;
  aiText?: string;
};

const tagLabels: Record<VaultTagValue, string> = {
  none: "未标记",
  keep: "保留",
  review: "待定",
  junk: "清理",
  farm: "待刷",
  loadout: "配装用"
};

export function buildItemShareText(input: ItemShareTextInput): string {
  const lines = [`【${input.item.name}】`];
  const meta = [
    input.item.tier,
    input.item.item_type,
    input.item.bucket_name,
    input.item.power ? `光等 ${input.item.power}` : undefined,
    input.item.locked === undefined ? undefined : input.item.locked ? "已锁定" : "未锁定"
  ].filter(Boolean);

  if (meta.length) {
    lines.push(meta.join(" / "));
  }

  if (input.score) {
    lines.push(`本地评分：${input.score.score} / ${input.score.grade} / 标记：${tagLabels[input.tag ?? "none"]}`);
  } else {
    lines.push(`标记：${tagLabels[input.tag ?? "none"]}`);
  }

  const plugs = input.item.socket_plugs?.map((plug) => plug.name).filter(Boolean) ?? [];
  if (plugs.length) {
    lines.push(`实际 Roll：${plugs.join(" / ")}`);
  }

  const note = input.note?.trim();
  if (note) {
    lines.push(`本地备注：${note}`);
  }

  if (input.score?.reasons.length) {
    lines.push(`评分原因：${input.score.reasons.join("；")}`);
  }

  if (input.score?.warnings.length) {
    lines.push(`风险提示：${input.score.warnings.join("；")}`);
  }

  const aiText = input.aiText?.trim();
  if (aiText) {
    lines.push("AI 解读：");
    lines.push(aiText);
  }

  return lines.join("\n");
}

export function buildItemChatGuideText(input: ItemShareTextInput): string {
  const lines = [`群聊说明：${input.item.name}`];
  const meta = [
    input.item.tier,
    input.item.item_type,
    input.item.bucket_name
  ].filter(Boolean);

  if (meta.length) {
    lines.push(`定位：${meta.join(" / ")}`);
  }

  if (input.score) {
    lines.push(`建议：${tagLabels[input.tag ?? "none"]}（${input.score.score}分）`);
    if (input.score.reasons.length) {
      lines.push(`理由：${input.score.reasons.slice(0, 3).join("；")}`);
    }
    if (input.score.warnings.length) {
      lines.push(`提醒：${input.score.warnings.slice(0, 2).join("；")}`);
    }
  } else {
    lines.push(`建议：${tagLabels[input.tag ?? "none"]}`);
  }

  const plugs = input.item.socket_plugs?.map((plug) => plug.name).filter(Boolean) ?? [];
  if (plugs.length) {
    lines.push(`Roll：${plugs.join(" / ")}`);
  }

  const note = input.note?.trim();
  if (note) {
    lines.push(`备注：${note}`);
  }

  const aiText = input.aiText?.trim();
  if (aiText) {
    lines.push(`AI：${aiText}`);
  }

  return lines.join("\n");
}
