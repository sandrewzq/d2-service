export type EvidenceSourceKind =
  | "account"
  | "user_tag"
  | "dim_wishlist"
  | "local_target"
  | "community"
  | "heuristic";

export type EvidenceConfidence = "confirmed" | "partial" | "unknown";

export type ItemDecisionKind = "keep" | "review" | "cleanup_candidate" | "unknown";

export type EvidenceSource = {
  kind: EvidenceSourceKind;
  label: string;
  detail?: string;
};

export type ItemDecisionReason = {
  source: EvidenceSource;
  message: string;
};

export type ItemDecisionInput = {
  itemKey: string;
  itemName: string;
  locked?: boolean;
  localTag?: "keep" | "review" | "farm" | "loadout" | "junk" | "none";
  wishlistMatched?: boolean;
  localTargetMatched?: boolean;
  communityMatched?: boolean;
  duplicateCount?: number;
};

export type ItemDecision = {
  itemKey: string;
  itemName: string;
  decision: ItemDecisionKind;
  confidence: EvidenceConfidence;
  protected: boolean;
  reasons: ItemDecisionReason[];
};

export function buildItemDecision(input: ItemDecisionInput): ItemDecision {
  const reasons: ItemDecisionReason[] = [];
  const protectedByEvidence = Boolean(input.locked || input.wishlistMatched || input.localTargetMatched || input.localTag === "keep" || input.localTag === "loadout");

  if (input.locked) {
    reasons.push({
      source: { kind: "account", label: "账号状态", detail: "已锁定" },
      message: "装备已锁定，默认保护。"
    });
  }

  if (input.localTag && input.localTag !== "none") {
    reasons.push({
      source: { kind: "user_tag", label: "本地标签", detail: formatLocalTag(input.localTag) },
      message: `用户标记为${formatLocalTag(input.localTag)}。`
    });
  }

  if (input.wishlistMatched) {
    reasons.push({
      source: { kind: "dim_wishlist", label: "DIM 愿望单" },
      message: "命中用户导入的 DIM 愿望单。"
    });
  }

  if (input.localTargetMatched) {
    reasons.push({
      source: { kind: "local_target", label: "本地目标" },
      message: "命中本地目标规则。"
    });
  }

  if (input.communityMatched) {
    reasons.push({
      source: { kind: "community", label: "社区推荐" },
      message: "命中已导入的社区推荐规则。"
    });
  }

  if ((input.duplicateCount ?? 0) >= 3) {
    reasons.push({
      source: { kind: "heuristic", label: "同名重复", detail: `${input.duplicateCount} 件` },
      message: `同名或同类装备数量较多，适合进入同名对比。`
    });
  }

  if (protectedByEvidence) {
    return {
      itemKey: input.itemKey,
      itemName: input.itemName,
      decision: "keep",
      confidence: "confirmed",
      protected: true,
      reasons
    };
  }

  if (input.localTag === "review" || input.localTag === "farm" || input.communityMatched) {
    return {
      itemKey: input.itemKey,
      itemName: input.itemName,
      decision: "review",
      confidence: input.communityMatched ? "partial" : "confirmed",
      protected: false,
      reasons
    };
  }

  if (input.localTag === "junk" || (input.duplicateCount ?? 0) >= 3) {
    return {
      itemKey: input.itemKey,
      itemName: input.itemName,
      decision: "cleanup_candidate",
      confidence: input.localTag === "junk" ? "confirmed" : "partial",
      protected: false,
      reasons
    };
  }

  return {
    itemKey: input.itemKey,
    itemName: input.itemName,
    decision: "unknown",
    confidence: "unknown",
    protected: false,
    reasons
  };
}

export function summarizeItemDecision(decision: ItemDecision): string {
  const label = formatItemDecision(decision.decision);
  const sourceLabels = decision.reasons.map((reason) => reason.source.label);
  return sourceLabels.length ? `${label}：${sourceLabels.join(" / ")}` : label;
}

export function formatItemDecision(decision: ItemDecisionKind): string {
  if (decision === "keep") return "必留";
  if (decision === "review") return "复查";
  if (decision === "cleanup_candidate") return "可清理候选";
  return "未知";
}

function formatLocalTag(tag: NonNullable<ItemDecisionInput["localTag"]>): string {
  if (tag === "keep") return "保留";
  if (tag === "review") return "待定";
  if (tag === "farm") return "待刷";
  if (tag === "loadout") return "配装用";
  if (tag === "junk") return "清理";
  return "未标记";
}
