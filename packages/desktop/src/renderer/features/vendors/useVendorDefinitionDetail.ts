import {
  getVendorEquipmentKind,
  type VendorInventoryItemView,
  type VendorOfferContextView
} from "@d2-tools/ui";
import type { WeaponRecommendation } from "@d2-tools/core/community-perks";
import type { ItemAiAdviceResult, VaultTags } from "../../api/types";
import {
  buildLibraryVendorLiveEntry,
  mergeLibraryVendorSourcePaths,
  type LiveItemAvailabilityEntry,
  type VaultItemMatchInfo
} from "@d2-tools/app/library";
import { useRef, useState } from "react";
import { api } from "../../api/client";
import type { ItemSearchResult } from "../../api/types";
import { buildWeaponAiConfigurationContext } from "../../shared/components/item-detail/buildWeaponDetailView";

export type VendorDefinitionDetailState = {
  item: ItemSearchResult;
  offerItem: VendorInventoryItemView;
  context: VendorOfferContextView;
  liveEntry?: LiveItemAvailabilityEntry;
  communityMatch?: VaultItemMatchInfo;
  recommendations?: WeaponRecommendation | null;
  aiResult: ItemAiAdviceResult | null;
  aiError: string;
  isGeneratingAi: boolean;
  isBusy: boolean;
  error: string;
} | null;

export function useVendorDefinitionDetail(input: { vendorSourcePaths?: Map<number, string[]>; vaultTags?: VaultTags } = {}) {
  const [state, setState] = useState<VendorDefinitionDetailState>(null);
  const requestSequenceRef = useRef(0);

  async function open(item: VendorInventoryItemView, context: VendorOfferContextView) {
    if (item.itemHash === undefined) return;
    const itemHash = item.itemHash;
    const equipmentKind = getVendorEquipmentKind(item);
    const requestSequence = ++requestSequenceRef.current;
    const sourcePaths = input.vendorSourcePaths?.get(itemHash)
      ?? (item.sourcePath ? [item.sourcePath] : [context.vendorName]);
    const fallbackLiveEntry = buildLibraryVendorLiveEntry(sourcePaths, item.characterIds?.[0]);
    setState({
      item: {
        hash: itemHash,
        name: item.name,
        description: item.summary,
        icon: item.iconUrl,
        item_type: item.itemType,
        tier: item.tone === "exotic" ? "异域" : undefined,
        group_key: equipmentKind === "weapon" ? "weapons" : equipmentKind === "armor" ? "armor" : "other",
        source: {
          status: "ready",
          label: "商人售卖",
          description: context.vendorName
        }
      },
      offerItem: item,
      context,
      liveEntry: fallbackLiveEntry,
      aiResult: null,
      aiError: "",
      isGeneratingAi: false,
      isBusy: true,
      error: ""
    });

    const detailPromise = api.getItemDetail(itemHash);
    const resolvedItemHashPromise = detailPromise
      .then((detail) => detail.hash)
      .catch(() => itemHash);
    const [detailResult, availabilityResult, communityResult, recommendationsResult] = await Promise.allSettled([
      detailPromise,
      api.getLiveItemAvailability([itemHash]),
      resolvedItemHashPromise.then((resolvedItemHash) => (
        api.matchCommunityVaultItems([{ hash: resolvedItemHash, socket_plugs: item.socketPlugs }])
      )),
      resolvedItemHashPromise.then((resolvedItemHash) => (
        api.getCommunityPerkRecommendations(resolvedItemHash, { item_name: item.name })
      ))
    ]);
    if (requestSequence !== requestSequenceRef.current) return;

    const liveEntry = availabilityResult.status === "fulfilled"
      ? mergeLibraryVendorSourcePaths(availabilityResult.value, new Map([[itemHash, sourcePaths]]))
        .items[String(itemHash)] ?? fallbackLiveEntry
      : fallbackLiveEntry;
    const resolvedItemHash = detailResult.status === "fulfilled" ? detailResult.value.hash : itemHash;
    const communityMatch = communityResult.status === "fulfilled"
      ? communityResult.value.matches.find((candidate) => candidate.hash === resolvedItemHash)
      : undefined;

    setState((current) => current ? {
      ...current,
      item: detailResult.status === "fulfilled" ? detailResult.value : current.item,
      liveEntry,
      communityMatch,
      recommendations: recommendationsResult.status === "fulfilled" ? recommendationsResult.value : null,
      isBusy: false,
      error: detailResult.status === "rejected"
        ? detailResult.reason instanceof Error
          ? detailResult.reason.message
          : "资料库定义读取失败"
        : ""
    } : null);
  }

  function close() {
    requestSequenceRef.current += 1;
    setState(null);
  }

  async function generateAi(userKnowledge = "", allowExternalSearch = false): Promise<void> {
    if (!state) return;
    const current = state;
    const offerSocketPlugs = (current.offerItem.socketPlugs ?? []).map((plug) => ({
      hash: plug.hash,
      name: plug.name,
      icon: plug.iconUrl,
      description: plug.description,
      category_identifier: plug.categoryIdentifier,
      stat_modifiers: plug.statModifiers,
      item_type: plug.itemType
    }));
    setState((value) => value ? { ...value, isGeneratingAi: true, aiError: "" } : value);
    try {
      const result = await api.generateItemAiAdvice({
        item: {
          hash: current.item.hash,
          name: current.item.name,
          icon: current.item.icon,
          item_type: current.item.item_type,
          tier: current.item.tier,
          bucket_name: current.item.bucket_name,
          group_key: current.item.group_key ?? "weapons",
          weapon_frame: current.item.weapon_frame,
          socket_plugs: offerSocketPlugs,
          description: current.item.description
        },
        tags: input.vaultTags ?? { items: {} },
        user_knowledge: userKnowledge.trim() || undefined,
        builtin_knowledge: current.item.group_key === "weapons" ? current.recommendations ?? null : null,
        allow_external_search: allowExternalSearch,
        weapon_context: current.item.group_key === "weapons" ? {
          object_kind: "vendor_offer",
          official_sources: current.liveEntry?.sources.map((source) => source.label) ?? [current.context.vendorName],
          definition_stats: Object.fromEntries((current.item.definition_stats ?? []).map((stat) => [stat.name, stat.value])),
          current_stats: current.context.stats,
          ...buildWeaponAiConfigurationContext({
            tier: current.item.tier,
            perks: current.item.perks,
            socket_plugs: offerSocketPlugs
          }),
          offer: {
            vendor_name: current.context.vendorName,
            cost: current.context.costLabel,
            affordability: current.context.affordabilityLabel,
            refresh: current.context.refreshLabel
          }
        } : undefined
      });
      setState((value) => value ? { ...value, aiResult: result, isGeneratingAi: false } : value);
    } catch (error) {
      setState((value) => value ? {
        ...value,
        aiError: error instanceof Error
          ? error.message
          : current.item.group_key === "armor"
            ? "AI 护甲分析失败"
            : "AI 武器分析失败",
        isGeneratingAi: false
      } : value);
    }
  }

  return { state, open, close, generateAi };
}
