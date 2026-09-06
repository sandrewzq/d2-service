import type { AccountItemSummary, AccountSummary } from "@d2-tools/core/account/summary";
import type { EvidenceRef } from "@d2-tools/core/evidence/reference";
import type { ItemSearchResult } from "@d2-tools/core/items/search";
import type { PerkSearchResult } from "@d2-tools/core/items/perkSearch";
import {
  matchLocalLoadoutPlan,
  type LocalLoadoutPlan
} from "@d2-tools/core/loadouts/plans";
import { createDomainResult, type DomainWarning } from "@d2-tools/core/results/domainResult";
import type { VendorInventorySnapshot, VendorOffer } from "@d2-tools/core/vendors/inventory";
import type { GameDataCatalog, ProfileService } from "@d2-tools/services";
import {
  buildArmorPlannerViewModel,
  type ArmorPlannerCandidateView,
  type ArmorPlannerClientRunResult,
  type ArmorPlannerWorkspaceJob
} from "../armor.js";
import type {
  AccountFindItemsInput,
  AccountFindItemsOutput,
  AccountFoundItem,
  AccountItemLocation,
  AssistantCapabilityAdapter,
  AssistantCapabilityAdapterContext,
  AssistantCapabilityInput,
  AssistantCapabilityName,
  AssistantCapabilityOutput,
  AssistantCapabilityResult,
  ArmorPlanCandidate,
  ArmorPlanOutput,
  InspectedLoadout,
  LoadoutsInspectOutput,
  ManifestSearchItem,
  ManifestSearchItemsOutput,
  ManifestSearchPerk,
  ManifestSearchPerksOutput,
  VendorFoundOffer,
  VendorsFindOffersInput,
  VendorsFindOffersOutput
} from "./contracts.js";

export type AssistantReadOnlyCapabilityDependencies = {
  gameData: Pick<GameDataCatalog, "searchItems" | "searchPerks">;
  profile: Pick<ProfileService, "getAccountSummary">;
  vendors: {
    getInventorySnapshot(): Promise<VendorInventorySnapshot | null>;
  };
  loadouts: {
    listLocalLoadoutPlans(): Promise<LocalLoadoutPlan[]>;
  };
  armor: {
    plan(job: ArmorPlannerWorkspaceJob): Promise<ArmorPlannerClientRunResult<ArmorPlannerWorkspaceJob>>;
  };
};

export type AssistantReadOnlyCapabilityAdapters = readonly [
  AssistantCapabilityAdapter<"manifest.search-items">,
  AssistantCapabilityAdapter<"manifest.search-perks">,
  AssistantCapabilityAdapter<"account.find-items">,
  AssistantCapabilityAdapter<"vendors.find-offers">,
  AssistantCapabilityAdapter<"loadouts.inspect">,
  AssistantCapabilityAdapter<"armor.plan">
];

export function createAssistantReadOnlyCapabilityAdapters(
  dependencies: AssistantReadOnlyCapabilityDependencies
): AssistantReadOnlyCapabilityAdapters {
  return [
    createManifestSearchItemsAdapter(dependencies.gameData),
    createManifestSearchPerksAdapter(dependencies.gameData),
    createAccountFindItemsAdapter(dependencies.profile),
    createVendorsFindOffersAdapter(dependencies.vendors),
    createLoadoutsInspectAdapter(dependencies.profile, dependencies.loadouts),
    createArmorPlanAdapter(dependencies.armor)
  ];
}

export function createManifestSearchItemsAdapter(
  gameData: Pick<GameDataCatalog, "searchItems">
): AssistantCapabilityAdapter<"manifest.search-items"> {
  return {
    descriptor: {
      name: "manifest.search-items",
      title: "搜索装备定义",
      description: "搜索当前 Manifest 中的装备版本、来源、框架和 Perk 摘要。",
      requires_auth: false,
      write_mode: "read-only"
    },
    async invoke(input, context) {
      const invalid = validateQuery("manifest.search-items", input, context, emptyManifestItems());
      if (invalid) return invalid;

      try {
        const items = await gameData.searchItems({
          query: input.query.trim(),
          limit: normalizeLimit(input.limit)
        });
        const projected = items.map(projectManifestItem);
        return completeResult("manifest.search-items", input, {
          items: projected,
          total: projected.length
        }, context, [manifestEvidence(context, "item-search", input.query)]);
      } catch {
        return failedResult("manifest.search-items", input, emptyManifestItems(), context, "manifest_search_failed", "装备资料读取失败，请稍后重试。");
      }
    }
  };
}

export function createManifestSearchPerksAdapter(
  gameData: Pick<GameDataCatalog, "searchPerks">
): AssistantCapabilityAdapter<"manifest.search-perks"> {
  return {
    descriptor: {
      name: "manifest.search-perks",
      title: "搜索 Perk",
      description: "搜索当前 Manifest 中的 Perk 家族、变体和关联装备数量。",
      requires_auth: false,
      write_mode: "read-only"
    },
    async invoke(input, context) {
      const invalid = validateQuery("manifest.search-perks", input, context, emptyManifestPerks());
      if (invalid) return invalid;

      try {
        const perks = await gameData.searchPerks({
          query: input.query.trim(),
          limit: normalizeLimit(input.limit)
        });
        const projected = perks.map(projectManifestPerk);
        return completeResult("manifest.search-perks", input, {
          perks: projected,
          total: projected.length
        }, context, [manifestEvidence(context, "perk-search", input.query)]);
      } catch {
        return failedResult("manifest.search-perks", input, emptyManifestPerks(), context, "manifest_perk_search_failed", "Perk 资料读取失败，请稍后重试。");
      }
    }
  };
}

export function createAccountFindItemsAdapter(
  profile: Pick<ProfileService, "getAccountSummary">
): AssistantCapabilityAdapter<"account.find-items"> {
  return {
    descriptor: {
      name: "account.find-items",
      title: "搜索已拥有装备",
      description: "在当前账号角色、仓库和邮政官中搜索真实装备实例。",
      requires_auth: true,
      write_mode: "read-only"
    },
    async invoke(input, context) {
      const invalid = validateQuery("account.find-items", input, context, emptyAccountItems());
      if (invalid) return invalid;

      try {
        const account = await profile.getAccountSummary();
        const matches = findAccountItems(account, input);
        return completeResult("account.find-items", input, {
          account_name: account.account_name,
          items: matches.items,
          total: matches.total
        }, context, [accountEvidence(context, account)]);
      } catch {
        return failedResult("account.find-items", input, emptyAccountItems(), context, "account_items_failed", "账号装备读取失败，请检查登录状态后重试。");
      }
    }
  };
}

export function createVendorsFindOffersAdapter(
  vendors: AssistantReadOnlyCapabilityDependencies["vendors"]
): AssistantCapabilityAdapter<"vendors.find-offers"> {
  return {
    descriptor: {
      name: "vendors.find-offers",
      title: "搜索当前商人库存",
      description: "搜索当前商人 Offer、价格、购买条件和刷新时间。",
      requires_auth: true,
      write_mode: "read-only"
    },
    async invoke(input, context) {
      const invalid = validateQuery("vendors.find-offers", input, context, emptyVendorOffers());
      if (invalid) return invalid;

      try {
        const snapshot = await vendors.getInventorySnapshot();
        if (!snapshot) {
          return completeResult("vendors.find-offers", input, emptyVendorOffers(), context, [], [{
            code: "vendor_snapshot_unavailable",
            message: "当前还没有可用的商人库存快照。",
            retryable: true
          }]);
        }

        const projected = findVendorOffers(snapshot, input);
        const warning = vendorSnapshotWarning(snapshot);
        const status = snapshot.status === "ready"
          ? "complete"
          : snapshot.status === "stale" || projected.offers.length > 0
            ? "partial"
            : "failed";
        return createDomainResult({
          result_id: context.result_id,
          kind: "vendors.find-offers",
          version: 1,
          status,
          checked_at: context.checked_at,
          expires_at: nextVendorRefresh(snapshot),
          query: input,
          data: projected,
          evidence: [vendorEvidence(context, snapshot)],
          warnings: warning ? [warning] : []
        });
      } catch {
        return failedResult("vendors.find-offers", input, emptyVendorOffers(), context, "vendor_offers_failed", "商人库存读取失败，请稍后重试。");
      }
    }
  };
}

export function createLoadoutsInspectAdapter(
  profile: Pick<ProfileService, "getAccountSummary">,
  loadouts: AssistantReadOnlyCapabilityDependencies["loadouts"]
): AssistantCapabilityAdapter<"loadouts.inspect"> {
  return {
    descriptor: {
      name: "loadouts.inspect",
      title: "检查本地配装",
      description: "检查本地配装目标与当前账号实例的匹配和缺口。",
      requires_auth: true,
      write_mode: "read-only"
    },
    async invoke(input, context) {
      try {
        const plans = await loadouts.listLocalLoadoutPlans();
        const selectedPlans = input.plan_id
          ? plans.filter((plan) => plan.id === input.plan_id)
          : plans;
        const warnings: DomainWarning[] = input.plan_id && selectedPlans.length === 0
          ? [{ code: "loadout_not_found", message: "没有找到指定的本地配装。" }]
          : [];
        if (selectedPlans.length === 0) {
          return completeResult("loadouts.inspect", input, emptyLoadouts(), context, [localLoadoutsEvidence(context)], warnings);
        }

        const account = await profile.getAccountSummary();
        const inspected = selectedPlans.map((plan) => inspectLoadout(plan, account));
        return completeResult("loadouts.inspect", input, {
          loadouts: inspected,
          total: inspected.length
        }, context, [localLoadoutsEvidence(context), accountEvidence(context, account)], warnings);
      } catch {
        return failedResult("loadouts.inspect", input, emptyLoadouts(), context, "loadout_inspection_failed", "配装或账号数据读取失败，请稍后重试。");
      }
    }
  };
}

export function createArmorPlanAdapter(
  armor: AssistantReadOnlyCapabilityDependencies["armor"]
): AssistantCapabilityAdapter<"armor.plan"> {
  return {
    descriptor: {
      name: "armor.plan",
      title: "规划 Armor 3.0 护甲",
      description: "使用当前 Manifest 规则集和账号护甲计算理论、库存或待刷方案。",
      requires_auth: true,
      write_mode: "read-only"
    },
    async invoke(input, context) {
      try {
        const response = await armor.plan(input);
        const view = buildArmorPlannerViewModel(input, response.ruleset, response.result);
        const warnings = armorPlanWarnings(
          view.outcome,
          view.warnings,
          view.search?.truncated ?? false,
          response.status === "stale"
        );
        return createDomainResult({
          result_id: context.result_id,
          kind: "armor.plan",
          version: 1,
          status: view.outcome === "invalid"
            ? "failed"
            : view.outcome === "indeterminate" || warnings.length
              ? "partial"
              : "complete",
          checked_at: response.checkedAt,
          expires_at: response.expiresAt,
          query: input,
          data: projectArmorPlan(response, view),
          evidence: [armorPlanEvidence(context, response)],
          warnings
        });
      } catch {
        return failedResult(
          "armor.plan",
          input,
          emptyArmorPlan(input.mode),
          context,
          "armor_plan_failed",
          "Armor 3.0 护甲规划失败，请确认账号、Manifest 和目标后重试。"
        );
      }
    }
  };
}

function projectManifestItem(item: ItemSearchResult): ManifestSearchItem {
  return {
    hash: item.hash,
    name: item.name,
    description: item.description,
    icon: item.icon,
    item_type: item.item_type,
    tier: item.tier,
    group_key: item.group_key,
    bucket_name: item.bucket_name,
    ammo_type: item.ammo_type,
    weapon_frame: item.weapon_frame?.name,
    damage_type: item.damage_type,
    source_status: item.source.status,
    source_description: item.source.description,
    release_description: item.release?.description,
    perk_names: uniqueStrings((item.perks ?? []).flatMap((group) => group.plugs.map((plug) => plug.name)))
  };
}

function projectManifestPerk(perk: PerkSearchResult): ManifestSearchPerk {
  return {
    key: perk.key,
    hash: perk.hash,
    hashes: [...perk.hashes],
    name: perk.name,
    description: perk.description,
    icon: perk.icon,
    variants: perk.variants.map((variant) => ({
      kind: variant.kind,
      description: variant.description,
      related_count: variant.related_count
    })),
    related_count: perk.related_count,
    related_groups: [...perk.related_groups]
  };
}

function findAccountItems(
  account: AccountSummary,
  input: AccountFindItemsInput
): { items: AccountFoundItem[]; total: number } {
  const query = normalizeSearch(input.query);
  const candidates: Array<{ item: AccountItemSummary; location: AccountItemLocation }> = [];

  for (const character of account.characters) {
    const characterLocation = { character_id: character.character_id, character_name: character.class_name };
    candidates.push(
      ...character.equipped_items.map((item) => ({ item, location: { kind: "equipped" as const, ...characterLocation } })),
      ...character.inventory_items.map((item) => ({ item, location: { kind: "inventory" as const, ...characterLocation } })),
      ...character.postmaster_items.map((item) => ({ item, location: { kind: "postmaster" as const, ...characterLocation } }))
    );
  }
  candidates.push(...account.vault.items.map((item) => ({ item, location: { kind: "vault" as const } })));

  const matches = candidates
    .filter(({ item }) => !input.group || item.group_key === input.group)
    .filter(({ item }) => accountItemSearchText(item).includes(query));
  const total = matches.length;
  const items = matches
    .slice(0, normalizeLimit(input.limit))
    .map(({ item, location }) => projectAccountItem(item, location));
  return { items, total };
}

function accountItemSearchText(item: AccountItemSummary): string {
  return normalizeSearch([
    item.name,
    item.item_type,
    item.bucket_name,
    item.weapon_frame?.name,
    item.armor_set?.name,
    ...item.socket_plugs.map((plug) => plug.name)
  ].filter(Boolean).join(" "));
}

function projectAccountItem(item: AccountItemSummary, location: AccountItemLocation): AccountFoundItem {
  return {
    hash: item.hash,
    instance_id: item.instance_id,
    name: item.name,
    item_type: item.item_type,
    group_key: item.group_key,
    bucket_name: item.bucket_name,
    power: item.power,
    locked: item.locked,
    armor_set: item.armor_set?.name,
    weapon_frame: item.weapon_frame?.name,
    perk_names: uniqueStrings(item.socket_plugs.map((plug) => plug.name)),
    location
  };
}

function findVendorOffers(
  snapshot: VendorInventorySnapshot,
  input: VendorsFindOffersInput
): VendorsFindOffersOutput {
  const query = normalizeSearch(input.query);
  const matchesAll = query === "*";
  const queryTerms = query.split(/\s+/).filter(Boolean);
  const matches: VendorFoundOffer[] = [];

  for (const vendor of snapshot.vendors) {
    for (const offer of vendor.offers) {
      const searchText = vendorOfferSearchText(vendor.name, vendor.location, offer);
      if (!matchesAll && !queryTerms.every((term) => searchText.includes(term))) continue;
      matches.push(projectVendorOffer(vendor, offer));
    }
  }

  return {
    snapshot_status: snapshot.status,
    fetched_at: snapshot.fetchedAt,
    offers: matches.slice(0, normalizeLimit(input.limit)),
    total: matches.length
  };
}

function vendorOfferSearchText(vendorName: string, location: string | undefined, offer: VendorOffer): string {
  return normalizeSearch([
    vendorName,
    location,
    offer.name,
    offer.itemType,
    offer.tierType,
    offer.categoryName
  ].filter(Boolean).join(" "));
}

function projectVendorOffer(
  vendor: VendorInventorySnapshot["vendors"][number],
  offer: VendorOffer
): VendorFoundOffer {
  return {
    offer_id: offer.id,
    vendor_hash: vendor.vendorHash,
    vendor_name: vendor.name,
    vendor_location: vendor.location,
    next_refresh_at: vendor.nextRefreshAt,
    item_hash: offer.itemHash,
    item_name: offer.name,
    item_type: offer.itemType,
    tier_type: offer.tierType,
    category_name: offer.categoryName,
    quantity: offer.quantity,
    can_purchase: offer.canPurchase,
    api_purchasable: offer.apiPurchasable,
    failure_messages: [...offer.failureMessages],
    costs: offer.costs.map((cost) => ({
      item_hash: cost.itemHash,
      name: cost.name,
      quantity: cost.quantity
    }))
  };
}

function inspectLoadout(plan: LocalLoadoutPlan, account: AccountSummary): InspectedLoadout {
  const match = matchLocalLoadoutPlan(plan, account);
  return {
    id: plan.id,
    name: plan.name,
    class_name: plan.class_name,
    target_character_id: plan.target_character_id,
    source_kind: plan.source.kind,
    item_target_count: plan.item_targets.length,
    configured_item_count: plan.item_targets.filter((target) => target.item_hash || target.selected_instance_id).length,
    match: {
      selected_count: match.selected_count,
      available_count: match.available_count,
      needs_selection_count: match.needs_selection_count,
      missing_count: match.missing_count,
      plug_unavailable_count: match.plug_unavailable_count,
      unconfigured_count: match.unconfigured_count
    }
  };
}

function projectArmorPlan(
  response: ArmorPlannerClientRunResult<ArmorPlannerWorkspaceJob>,
  view: ReturnType<typeof buildArmorPlannerViewModel>
): ArmorPlanOutput {
  return {
    source_result_id: response.resultId,
    mode: view.mode,
    outcome: view.outcome,
    ruleset: { ...response.ruleset },
    target: view.target.map((target) => ({ ...target })),
    candidates: view.candidates.slice(0, 3).map(projectArmorCandidate),
    total: view.candidateCount,
    reachable_total: view.reachableCandidateCount,
    warnings: [...view.warnings],
    issues: view.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      ...(issue.pieceId ? { piece_id: issue.pieceId } : {})
    })),
    ...(view.search ? {
      search: {
        truncated: view.search.truncated,
        states_examined: view.search.statesExamined,
        states_retained: view.search.statesRetained,
        piece_option_counts: { ...view.search.pieceOptionCounts }
      }
    } : {}),
    from_cache: response.fromCache,
    source_revisions: { ...response.sources }
  };
}

function projectArmorCandidate(candidate: ArmorPlannerCandidateView): ArmorPlanCandidate {
  const base: Omit<ArmorPlanCandidate, "pieces"> = {
    candidate_id: candidate.summary.candidateId,
    kind: candidate.kind,
    hard_constraints_met: candidate.summary.hardConstraintsMet,
    final_stats: { ...candidate.summary.finalStats },
    total_gap: candidate.summary.totalGap,
    maximum_gap: candidate.summary.maximumGap,
    stat_waste: candidate.summary.statWaste,
    armor_mod_usage: { ...candidate.summary.armorModUsage },
    armor_set_satisfied: candidate.summary.armorSetCoverage.satisfied
  };
  if (candidate.kind === "owned") {
    return {
      ...base,
      equipped_count: candidate.equippedCount,
      transfer_count: candidate.transferCount,
      replacement_count: candidate.replacementCount,
      pieces: candidate.pieces.map((piece) => ({
        slot: piece.slot,
        name: piece.name,
        item_hash: piece.itemHash,
        instance_id: piece.instanceId,
        location: piece.location
      }))
    };
  }
  if (candidate.kind === "upgrade") {
    return {
      ...base,
      replacement_count: candidate.replacementCount,
      pieces: candidate.pieces.map((piece) => ({
        slot: piece.slot,
        name: piece.name,
        item_hash: piece.itemHash,
        instance_id: piece.instanceId,
        location: piece.location
      }))
    };
  }
  if (candidate.kind === "acquisition") {
    return {
      ...base,
      missing_piece_count: candidate.missingPieceCount,
      upgrade_piece_count: candidate.upgradePieceCount,
      verification_piece_count: candidate.verificationPieceCount,
      pieces: candidate.pieces.map((piece) => ({
        slot: piece.slot,
        name: piece.identity.itemName,
        ...(piece.identity.itemHash === undefined ? {} : { item_hash: piece.identity.itemHash }),
        acquisition_required: piece.acquisitionRequired,
        archetype_name: piece.identity.archetypeName,
        tertiary_stat: piece.identity.tertiaryStat
      }))
    };
  }
  return {
    ...base,
    pieces: candidate.pieces.map((piece) => ({
      slot: piece.slot,
      name: piece.name,
      ...(piece.itemHash === undefined ? {} : { item_hash: piece.itemHash }),
      archetype_name: piece.archetype.name,
      tertiary_stat: piece.archetype.tertiaryStat
    }))
  };
}

function armorPlanWarnings(
  outcome: ReturnType<typeof buildArmorPlannerViewModel>["outcome"],
  warnings: readonly string[],
  truncated: boolean,
  stale: boolean
): DomainWarning[] {
  const result: DomainWarning[] = warnings.map((message, index) => ({
    code: `armor_plan_warning_${index + 1}`,
    message
  }));
  if (outcome === "indeterminate" && !truncated) {
    result.push({
      code: "armor_plan_indeterminate",
      message: "当前护甲规划无法确认完整可达性。"
    });
  }
  if (truncated) {
    result.push({
      code: "armor_plan_search_truncated",
      message: "护甲搜索达到状态上限，候选不能视为唯一最优。"
    });
  }
  if (stale) {
    result.push({
      code: "armor_plan_result_stale",
      message: "护甲规划完成时已有更新请求，当前结果仅作为历史参考。",
      retryable: true
    });
  }
  return result;
}

function completeResult<Name extends AssistantCapabilityName>(
  kind: Name,
  query: AssistantCapabilityInput<Name>,
  data: AssistantCapabilityOutput<Name>,
  context: AssistantCapabilityAdapterContext,
  evidence: EvidenceRef[],
  warnings: DomainWarning[] = []
): AssistantCapabilityResult<Name> {
  return createDomainResult({
    result_id: context.result_id,
    kind,
    version: 1,
    status: warnings.length ? "partial" : "complete",
    checked_at: context.checked_at,
    query,
    data,
    evidence,
    warnings
  });
}

function failedResult<Name extends AssistantCapabilityName>(
  kind: Name,
  query: AssistantCapabilityInput<Name>,
  data: AssistantCapabilityOutput<Name>,
  context: AssistantCapabilityAdapterContext,
  code: string,
  message: string
): AssistantCapabilityResult<Name> {
  return createDomainResult({
    result_id: context.result_id,
    kind,
    version: 1,
    status: "failed",
    checked_at: context.checked_at,
    query,
    data,
    warnings: [{ code, message, retryable: true }]
  });
}

function validateQuery<Name extends "manifest.search-items" | "manifest.search-perks" | "account.find-items" | "vendors.find-offers">(
  kind: Name,
  input: AssistantCapabilityInput<Name>,
  context: AssistantCapabilityAdapterContext,
  emptyData: AssistantCapabilityOutput<Name>
): AssistantCapabilityResult<Name> | null {
  if (input.query.trim()) return null;
  return failedResult(kind, input, emptyData, context, "invalid_query", "查询内容不能为空。");
}

function manifestEvidence(
  context: AssistantCapabilityAdapterContext,
  entityType: string,
  query: string
): EvidenceRef {
  return {
    evidence_id: `${context.result_id}:manifest`,
    kind: "manifest_definition",
    label: "当前 Bungie Manifest",
    observed_at: context.checked_at,
    entity: { type: entityType, id: query.trim() },
    manifest_version: context.manifest_version
  };
}

function accountEvidence(context: AssistantCapabilityAdapterContext, account: AccountSummary): EvidenceRef {
  return {
    evidence_id: `${context.result_id}:account`,
    kind: "bungie_profile",
    label: "当前账号快照",
    observed_at: context.checked_at,
    entity: { type: "destiny_membership", id: account.destiny_membership_id },
    open_target: { kind: "account", id: account.destiny_membership_id }
  };
}

function vendorEvidence(
  context: AssistantCapabilityAdapterContext,
  snapshot: VendorInventorySnapshot
): EvidenceRef {
  return {
    evidence_id: `${context.result_id}:vendors`,
    kind: "bungie_vendor",
    label: "当前商人库存快照",
    observed_at: snapshot.fetchedAt || context.checked_at,
    expires_at: nextVendorRefresh(snapshot),
    entity: { type: "vendor_snapshot", id: snapshot.fetchedAt || context.result_id }
  };
}

function localLoadoutsEvidence(context: AssistantCapabilityAdapterContext): EvidenceRef {
  return {
    evidence_id: `${context.result_id}:loadouts`,
    kind: "local_data",
    label: "本地配装方案",
    observed_at: context.checked_at,
    entity: { type: "local_loadout_plans", id: "current" },
    open_target: { kind: "loadout", id: "local" }
  };
}

function armorPlanEvidence(
  context: AssistantCapabilityAdapterContext,
  response: ArmorPlannerClientRunResult<ArmorPlannerWorkspaceJob>
): EvidenceRef {
  return {
    evidence_id: `${context.result_id}:armor-plan`,
    kind: "domain_result",
    label: "Armor 3.0 护甲规划结果",
    observed_at: response.checkedAt,
    expires_at: response.expiresAt,
    entity: { type: "armor_plan_result", id: response.resultId },
    manifest_version: response.ruleset.manifestVersion,
    result_id: response.resultId,
    open_target: { kind: "result", id: response.resultId }
  };
}

function vendorSnapshotWarning(snapshot: VendorInventorySnapshot): DomainWarning | null {
  if (snapshot.status === "ready") return null;
  if (snapshot.status === "stale") {
    return {
      code: "vendor_snapshot_stale",
      message: "商人库存来自缓存，部分 Offer 可能已经过期。",
      retryable: true
    };
  }
  return {
    code: "vendor_snapshot_error",
    message: snapshot.vendors.length
      ? "商人刷新失败，当前结果包含可用的缓存数据。"
      : "商人刷新失败，当前没有可用库存。",
    retryable: true
  };
}

function nextVendorRefresh(snapshot: VendorInventorySnapshot): string | undefined {
  return snapshot.vendors
    .map((vendor) => vendor.nextRefreshAt)
    .filter((value): value is string => Boolean(value))
    .sort()[0];
}

function normalizeLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return 20;
  return Math.min(50, Math.max(1, Math.trunc(limit!)));
}

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function emptyManifestItems(): ManifestSearchItemsOutput {
  return { items: [], total: 0 };
}

function emptyManifestPerks(): ManifestSearchPerksOutput {
  return { perks: [], total: 0 };
}

function emptyAccountItems(): AccountFindItemsOutput {
  return { items: [], total: 0 };
}

function emptyVendorOffers(): VendorsFindOffersOutput {
  return { snapshot_status: "unavailable", offers: [], total: 0 };
}

function emptyLoadouts(): LoadoutsInspectOutput {
  return { loadouts: [], total: 0 };
}

function emptyArmorPlan(mode: ArmorPlannerWorkspaceJob["mode"]): ArmorPlanOutput {
  return {
    source_result_id: "",
    mode,
    outcome: "invalid",
    ruleset: {
      id: "armor-3.0",
      version: 1,
      sourceReference: "unavailable"
    },
    target: [],
    candidates: [],
    total: 0,
    reachable_total: 0,
    warnings: [],
    issues: [],
    from_cache: false,
    source_revisions: {
      manifest: "unavailable",
      ruleset: "unavailable"
    }
  };
}
