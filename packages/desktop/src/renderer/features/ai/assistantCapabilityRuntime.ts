import {
  createAssistantCapabilityResultCache,
  createReadOnlyAssistantCapabilityCatalog,
  runAssistantCapabilityPrelude,
  type AssistantCapabilityPrelude,
  type AssistantReadOnlyCapabilityDependencies
} from "@d2-tools/app/capabilities";
import { api } from "../../api/client";
import { appendAssistantCapabilityAudit } from "../../shared/domain/assistant/assistantCapabilityAudit";
import { getManifestStatusSnapshot } from "../../shared/stores/manifestStatusStore";
import { getAccountSummarySnapshot } from "../../shared/stores/accountEntityStore";

const resultCache = createAssistantCapabilityResultCache({ maxEntries: 60 });
let armorPlannerRevision = 0;

const dependencies: AssistantReadOnlyCapabilityDependencies = {
  gameData: {
    async searchItems(input) {
      const items = await api.searchItems(input.query);
      return items
        .slice(0, normalizeLimit(input.limit))
        .map((item) => ({
          ...item,
          group_key: item.group_key ?? "other"
        }));
    },
    async searchPerks(input) {
      const perks = await api.searchPerks(input.query);
      return perks.slice(0, normalizeLimit(input.limit));
    }
  },
  profile: {
    async getAccountSummary() {
      const account = getAccountSummarySnapshot();
      if (!account) throw new Error("当前还没有已同步的账号数据。");
      return account;
    }
  },
  vendors: {
    async getInventorySnapshot() {
      try {
        const account = getAccountSummarySnapshot();
        if (!account) return null;
        return api.getCachedVendorInventory({
          membership_type: account.membership_type,
          membership_id: account.destiny_membership_id,
          character_ids: account.characters.map((character) => character.character_id)
        });
      } catch {
        return null;
      }
    }
  },
  loadouts: {
    listLocalLoadoutPlans: () => api.listLocalLoadoutPlans()
  },
  armor: {
    plan(job) {
      armorPlannerRevision += 1;
      return api.planArmor({
        scopeId: "assistant-capability",
        revision: armorPlannerRevision,
        job
      });
    }
  }
};

const catalog = createReadOnlyAssistantCapabilityCatalog(dependencies, {
  resultCache,
  onAudit: appendAssistantCapabilityAudit
});

export function runDesktopAssistantCapabilityPrelude(
  question: string
): Promise<AssistantCapabilityPrelude & { manifest_version?: string }> {
  const manifestVersion = getDesktopAssistantManifestVersion();
  return runAssistantCapabilityPrelude({
    catalog,
    question,
    manifestVersion,
    maxInvocations: 3
  }).then((prelude) => ({
    ...prelude,
    ...(manifestVersion ? { manifest_version: manifestVersion } : {})
  }));
}

export function getDesktopAssistantManifestVersion(): string | undefined {
  return getManifestStatusSnapshot().manifestStatus?.version;
}

function normalizeLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return 20;
  return Math.min(50, Math.max(1, Math.trunc(limit!)));
}
