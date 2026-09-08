import type { AccountSummary } from "@d2-tools/core/account/summary";
import type { ActivityHistorySummary } from "@d2-tools/core/activities/history";
import {
  createRecommendationCardSummary,
  type RecommendationCardSummary,
  type VaultRecommendationDependencyIssue
} from "@d2-tools/core/community-perks";
import type { D2Services } from "@d2-tools/services";
import { runQuery, type QueryState } from "../queryState.js";
import { loadAccountWorkspace, type AccountWorkspace } from "./account.js";

export type AccountDerivedWorkspace = {
  activitySummary: ActivityHistorySummary | null;
  vaultRecommendationCardSummary: Map<string, RecommendationCardSummary>;
  vaultRecommendationChangedInstanceIds: string[];
  vaultRecommendationIssues: VaultRecommendationDependencyIssue[];
  vaultRecommendationManifestVersion?: string;
  vaultRecommendationRevision?: string;
  vaultRecommendationSchemaVersion?: number;
};

export type VaultRecommendationScanState = {
  phase: "idle" | "scanning" | "partial" | "complete" | "error";
  total_weapon_count: number;
  scanned_weapon_count: number;
  covered_weapon_count: number;
  retained_result_count: number;
  started_at?: string;
  completed_at?: string;
  message?: string;
  blocking_reason?: VaultRecommendationDependencyIssue["code"];
  issues?: VaultRecommendationDependencyIssue[];
  manifest_version?: string;
  recommendation_revision?: string;
  recommendation_schema_version?: number;
};

export type FullAccountWorkspace = AccountWorkspace & AccountDerivedWorkspace;

export type LoadAccountDerivedWorkspaceOptions = {
  includeActivity?: boolean;
  includeCommunityMatch?: boolean;
  communityMatchWeaponHashes?: readonly number[];
};

export async function loadFullAccountWorkspace(
  services: Pick<D2Services, "profile" | "localData">
): Promise<QueryState<FullAccountWorkspace>> {
  const base = await loadAccountWorkspace(services);
  if (base.status !== "success") {
    return base as QueryState<FullAccountWorkspace>;
  }

  const derived = await loadAccountDerivedWorkspace(services, base.data.account);
  if (derived.status !== "success") {
    return derived as QueryState<FullAccountWorkspace>;
  }

  return {
    status: "success",
    data: {
      ...base.data,
      ...derived.data
    },
    error: null
  };
}

export async function loadAccountDerivedWorkspace(
  services: Pick<D2Services, "profile">,
  account: AccountSummary,
  options: LoadAccountDerivedWorkspaceOptions = {}
): Promise<QueryState<AccountDerivedWorkspace>> {
  return runQuery(async () => {
    const includeActivity = options.includeActivity ?? true;
    const includeCommunityMatch = options.includeCommunityMatch ?? true;
    const activitySummary = includeActivity
      ? await services.profile.getActivitySummary({
          membership_type: account.membership_type,
          membership_id: account.destiny_membership_id,
          character_ids: account.characters.map((character) => character.character_id)
        })
      : null;

    const allItems = [
      ...account.characters.flatMap((character) => [
        ...character.equipped_items,
        ...character.inventory_items,
        ...character.postmaster_items
      ]),
      ...account.vault.items
    ];

    const scopedWeaponHashes = options.communityMatchWeaponHashes?.length
      ? new Set(options.communityMatchWeaponHashes)
      : null;
    const weaponItems = allItems.filter((item) => (
      item.group_key === "weapons"
      && (!scopedWeaponHashes || scopedWeaponHashes.has(item.hash))
    ));
    const matchCommunityVaultItems = services.profile.matchCommunityVaultItems;
    const vaultRecommendationCardSummary = new Map<string, RecommendationCardSummary>();
    let vaultRecommendationIssues: VaultRecommendationDependencyIssue[] = [];
    let vaultRecommendationChangedInstanceIds: string[] = [];
    let vaultRecommendationManifestVersion = "";
    let vaultRecommendationRevision = "";
    let vaultRecommendationSchemaVersion: number | undefined;
    if (includeCommunityMatch && matchCommunityVaultItems) {
      const result = await matchCommunityVaultItems(
        weaponItems.map((item) => ({
          hash: item.hash,
          instance_id: item.instance_id,
          item_name: item.name,
          weapon_roll: item.weapon_roll,
          socket_plugs: item.socket_plugs?.map((plug) => ({
            hash: plug.hash,
            socket_index: plug.socket_index
          }))
        })),
        { include_evidence: false }
      );
      vaultRecommendationIssues = result.issues;
      vaultRecommendationChangedInstanceIds = result.changed_instance_ids ?? [];
      vaultRecommendationManifestVersion = result.manifest_version ?? "";
      vaultRecommendationRevision = result.recommendation_revision ?? "";
      vaultRecommendationSchemaVersion = result.recommendation_schema_version;
      for (const summary of result.card_summaries ?? result.matches.map(createRecommendationCardSummary)) {
        vaultRecommendationCardSummary.set(summary.instance_id ?? `hash:${summary.hash}`, summary);
      }
    }

    return {
      activitySummary,
      vaultRecommendationCardSummary,
      vaultRecommendationChangedInstanceIds,
      vaultRecommendationIssues,
      ...(vaultRecommendationManifestVersion
        ? { vaultRecommendationManifestVersion }
        : {}),
      ...(vaultRecommendationRevision
        ? { vaultRecommendationRevision }
        : {}),
      ...(vaultRecommendationSchemaVersion !== undefined
        ? { vaultRecommendationSchemaVersion }
        : {})
    };
  });
}
