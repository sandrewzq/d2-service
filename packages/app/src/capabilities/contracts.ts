import type { DomainResult } from "@d2-tools/core/results/domainResult";
import type { ArmorSlot, ArmorStatValues } from "@d2-tools/core/armor";
import type { ArmorStatKey } from "@d2-tools/core/loadouts/analysis";
import type {
  ArmorPlannerMode,
  ArmorPlannerOutcome,
  ArmorPlannerRulesetContext,
  ArmorPlannerWorkspaceJob
} from "../armor.js";

export type AssistantCapabilityName =
  | "manifest.search-items"
  | "manifest.search-perks"
  | "account.find-items"
  | "vendors.find-offers"
  | "loadouts.inspect"
  | "armor.plan";

export type AssistantCapabilityCaller = "ai" | "diagnostics";

export type AssistantCapabilityInvokeContext = {
  caller: AssistantCapabilityCaller;
  manifest_version?: string;
};

export type AssistantCapabilityAdapterContext = AssistantCapabilityInvokeContext & {
  result_id: string;
  checked_at: string;
};

export type ManifestSearchItemsInput = {
  query: string;
  limit?: number;
};

export type ManifestSearchItem = {
  hash: number;
  name: string;
  description: string;
  icon?: string;
  item_type?: string;
  tier?: string;
  group_key: "weapons" | "armor" | "equipment" | "other";
  bucket_name?: string;
  ammo_type?: "primary" | "special" | "heavy";
  weapon_frame?: string;
  damage_type?: string;
  source_status: "ready" | "missing";
  source_description: string;
  release_description?: string;
  perk_names: string[];
};

export type ManifestSearchItemsOutput = {
  items: ManifestSearchItem[];
  total: number;
};

export type ManifestSearchPerksInput = {
  query: string;
  limit?: number;
};

export type ManifestSearchPerk = {
  key: string;
  hash: number;
  hashes: number[];
  name: string;
  description: string;
  icon?: string;
  variants: Array<{
    kind: "standard" | "enhanced" | "other";
    description: string;
    related_count: number;
  }>;
  related_count: number;
  related_groups: Array<"weapons" | "armor" | "equipment" | "other">;
};

export type ManifestSearchPerksOutput = {
  perks: ManifestSearchPerk[];
  total: number;
};

export type AccountFindItemsInput = {
  query: string;
  group?: "weapons" | "armor" | "equipment" | "other";
  limit?: number;
};

export type AccountItemLocation = {
  kind: "equipped" | "inventory" | "vault" | "postmaster";
  character_id?: string;
  character_name?: string;
};

export type AccountFoundItem = {
  hash: number;
  instance_id?: string;
  name: string;
  item_type?: string;
  group_key: "weapons" | "armor" | "equipment" | "other";
  bucket_name?: string;
  power?: number;
  locked?: boolean;
  armor_set?: string;
  weapon_frame?: string;
  perk_names: string[];
  location: AccountItemLocation;
};

export type AccountFindItemsOutput = {
  account_name?: string;
  items: AccountFoundItem[];
  total: number;
};

export type VendorsFindOffersInput = {
  query: string;
  limit?: number;
};

export type VendorFoundOffer = {
  offer_id: string;
  vendor_hash: number;
  vendor_name: string;
  vendor_location?: string;
  next_refresh_at?: string;
  item_hash: number;
  item_name: string;
  item_type: string;
  tier_type: string;
  category_name: string;
  quantity?: number;
  can_purchase: boolean;
  api_purchasable: boolean | null;
  failure_messages: string[];
  costs: Array<{
    item_hash: number;
    name: string;
    quantity: number;
  }>;
};

export type VendorsFindOffersOutput = {
  snapshot_status: "ready" | "stale" | "error" | "unavailable";
  fetched_at?: string;
  offers: VendorFoundOffer[];
  total: number;
};

export type LoadoutsInspectInput = {
  plan_id?: string;
};

export type InspectedLoadout = {
  id: string;
  name: string;
  class_name: string;
  target_character_id?: string;
  source_kind: "manual" | "current-equipment" | "bungie-loadout" | "dim-link" | "guide" | "armor-plan" | "assistant-targets";
  item_target_count: number;
  configured_item_count: number;
  match: {
    selected_count: number;
    available_count: number;
    needs_selection_count: number;
    missing_count: number;
    plug_unavailable_count: number;
    unconfigured_count: number;
  };
};

export type LoadoutsInspectOutput = {
  loadouts: InspectedLoadout[];
  total: number;
};

export type ArmorPlanInput = ArmorPlannerWorkspaceJob;

export type ArmorPlanCandidatePiece = {
  slot: ArmorSlot;
  name?: string;
  item_hash?: number;
  instance_id?: string;
  location?: "equipped" | "inventory" | "vault" | "postmaster";
  acquisition_required?: boolean;
  archetype_name?: string;
  tertiary_stat?: ArmorStatKey;
};

export type ArmorPlanCandidate = {
  candidate_id: string;
  kind: ArmorPlannerMode;
  hard_constraints_met: boolean;
  final_stats: ArmorStatValues;
  total_gap: number;
  maximum_gap: number;
  stat_waste: number;
  armor_mod_usage: { plus5: number; plus10: number };
  armor_set_satisfied: boolean;
  equipped_count?: number;
  transfer_count?: number;
  replacement_count?: number;
  missing_piece_count?: number;
  upgrade_piece_count?: number;
  verification_piece_count?: number;
  pieces: ArmorPlanCandidatePiece[];
};

export type ArmorPlanOutput = {
  source_result_id: string;
  mode: ArmorPlannerMode;
  outcome: ArmorPlannerOutcome;
  ruleset: ArmorPlannerRulesetContext;
  target: Array<{
    key: ArmorStatKey;
    minimum?: number;
    maximum?: number;
    exact?: number;
  }>;
  candidates: ArmorPlanCandidate[];
  total: number;
  reachable_total: number;
  warnings: string[];
  issues: Array<{ code: string; message: string; piece_id?: string }>;
  search?: {
    truncated: boolean;
    states_examined: number;
    states_retained: number;
    piece_option_counts: Record<ArmorSlot, number>;
  };
  from_cache: boolean;
  source_revisions: {
    manifest?: string;
    ruleset: string;
    account?: string;
  };
};

export type AssistantCapabilityContractMap = {
  "manifest.search-items": {
    input: ManifestSearchItemsInput;
    output: ManifestSearchItemsOutput;
  };
  "manifest.search-perks": {
    input: ManifestSearchPerksInput;
    output: ManifestSearchPerksOutput;
  };
  "account.find-items": {
    input: AccountFindItemsInput;
    output: AccountFindItemsOutput;
  };
  "vendors.find-offers": {
    input: VendorsFindOffersInput;
    output: VendorsFindOffersOutput;
  };
  "loadouts.inspect": {
    input: LoadoutsInspectInput;
    output: LoadoutsInspectOutput;
  };
  "armor.plan": {
    input: ArmorPlanInput;
    output: ArmorPlanOutput;
  };
};

export type AssistantCapabilityInput<Name extends AssistantCapabilityName> =
  AssistantCapabilityContractMap[Name]["input"];

export type AssistantCapabilityOutput<Name extends AssistantCapabilityName> =
  AssistantCapabilityContractMap[Name]["output"];

export type AssistantCapabilityResult<Name extends AssistantCapabilityName> = DomainResult<
  AssistantCapabilityOutput<Name>,
  AssistantCapabilityInput<Name>
>;

export type AnyAssistantCapabilityResult = AssistantCapabilityResult<AssistantCapabilityName>;

export type AssistantCapabilityDescriptor<Name extends AssistantCapabilityName = AssistantCapabilityName> = {
  name: Name;
  title: string;
  description: string;
  requires_auth: boolean;
  write_mode: "read-only";
};

export type AssistantCapabilityAdapter<Name extends AssistantCapabilityName = AssistantCapabilityName> = {
  descriptor: AssistantCapabilityDescriptor<Name>;
  invoke(
    input: AssistantCapabilityInput<Name>,
    context: AssistantCapabilityAdapterContext
  ): Promise<AssistantCapabilityResult<Name>>;
};

export type AnyAssistantCapabilityAdapter = {
  [Name in AssistantCapabilityName]: AssistantCapabilityAdapter<Name>;
}[AssistantCapabilityName];

export type AssistantCapabilityInvocationAudit = {
  result_id: string;
  capability: AssistantCapabilityName;
  caller: AssistantCapabilityCaller;
  started_at: string;
  duration_ms: number;
  status: "complete" | "partial" | "failed" | "error";
  warning_codes: string[];
  input_summary: Record<string, string | number | boolean>;
  result_summary?: {
    total?: number;
    evidence_ids: string[];
  };
  error_code?: string;
};

export type AssistantCapabilityCatalog = {
  list(): AssistantCapabilityDescriptor[];
  invoke<Name extends AssistantCapabilityName>(
    name: Name,
    input: AssistantCapabilityInput<Name>,
    context: AssistantCapabilityInvokeContext
  ): Promise<AssistantCapabilityResult<Name>>;
};
