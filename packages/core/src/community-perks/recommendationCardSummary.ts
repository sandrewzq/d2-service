import type {
  RecommendationCardSummary,
  RecommendationCardSourceSummary,
  RecommendationSourceMatch,
  VaultItemInstanceMatchInfo
} from "./types.js";

export function createRecommendationCardSummary(
  match: VaultItemInstanceMatchInfo
): RecommendationCardSummary {
  return {
    hash: match.hash,
    ...(match.instance_id ? { instance_id: match.instance_id } : {}),
    canonical_weapon_name: match.canonical_weapon_name,
    coverage: match.coverage,
    match_status: match.match_status,
    recommendation_state: match.recommendation_state,
    matched: match.matched,
    partial: match.partial,
    available: match.available,
    modes: match.modes,
    sources: (match.source_matches ?? []).map(createRecommendationCardSourceSummary),
    ...(match.dim_wishlist ? {
      dim: {
        state: match.dim_wishlist.state,
        matched_combo_count: match.dim_wishlist.matched_combo_count,
        partial_combo_count: match.dim_wishlist.partial_combo_count,
        uncheckable_combo_count: match.dim_wishlist.uncheckable_combo_count,
        combo_count: match.dim_wishlist.combo_count,
        best_matched_requirement_count: match.dim_wishlist.best_matched_requirement_count,
        best_requirement_count: match.dim_wishlist.best_requirement_count,
        modes: match.dim_wishlist.modes,
        matched_modes: [...new Set(match.dim_wishlist.rules
          .filter((rule) => rule.state === "match")
          .map((rule) => rule.mode))]
      }
    } : {})
  };
}

function createRecommendationCardSourceSummary(
  source: RecommendationSourceMatch
): RecommendationCardSourceSummary {
  const specifiedSlots = source.slots.filter((slot) => slot.state !== "source_not_specified");
  const perkSlots = specifiedSlots.filter((slot) => slot.slot === "perk1" || slot.slot === "perk2");
  return {
    source_id: source.source_id,
    source_label: source.source_label,
    state: source.state,
    purposes: source.purposes,
    matched_requirement_count: specifiedSlots.length
      ? specifiedSlots.filter((slot) => slot.state === "match").length
      : source.matched_requirement_count,
    requirement_count: specifiedSlots.length || source.requirement_count,
    uncheckable_requirement_count: specifiedSlots.length
      ? specifiedSlots.filter((slot) => slot.state === "uncheckable").length
      : source.uncheckable_requirement_count,
    matched_perk_count: perkSlots.filter((slot) => slot.state === "match").length,
    perk_requirement_count: perkSlots.length,
    uncheckable_perk_count: perkSlots.filter((slot) => slot.state === "uncheckable").length
  };
}
