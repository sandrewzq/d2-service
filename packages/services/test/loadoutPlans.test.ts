import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createLocalLoadoutPlan,
  deleteLocalLoadoutPlan,
  listLocalLoadoutPlans,
  updateLocalLoadoutPlan
} from "../src/loadouts/plans.js";

describe("local loadout plan store", () => {
  it("persists the editable plan rather than a derived account match", () => {
    const directory = mkdtempSync(join(tmpdir(), "d2-tools-local-plans-"));
    const created = createLocalLoadoutPlan(directory, {
      name: "日落虚空",
      class_name: "Titan",
      target_character_id: "character",
      source: { kind: "dim-link", reference_url: "https://app.destinyitemmanager.com/loadouts?loadout=%7B%7D" },
      item_targets: [{
        slot: "Kinetic Weapons",
        item_hash: 100,
        plug_hashes: [10],
        candidate_conditions: { require_owned: true }
      }],
      armor_constraints: {
        stat_minimums: { health: 100 },
        priority_stats: ["health", "grenade"],
        fragment_stat_bonuses: { health: 10 },
        five_point_mod_budget: 2,
        ten_point_mod_budget: 3,
        locked_instance_ids: ["helmet"],
        excluded_instance_ids: [],
        allowed_locations: ["equipped", "inventory", "vault"]
      }
    }, new Date("2026-07-30T00:00:00.000Z"));

    const { id, created_at, updated_at, ...editablePlan } = created;
    const updated = updateLocalLoadoutPlan(directory, id, {
      ...editablePlan,
      name: "日落虚空（更新）"
    }, new Date("2026-07-30T01:00:00.000Z"));

    expect(updated.updated_at).toBe("2026-07-30T01:00:00.000Z");
    expect(listLocalLoadoutPlans(directory)).toEqual([updated]);
    expect(deleteLocalLoadoutPlan(directory, created.id)).toEqual([]);
  });
});
