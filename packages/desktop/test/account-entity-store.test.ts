// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { AccountItemSummary, AccountSummary } from "../src/renderer/api/types.js";
import {
  applyAccountEntityPatches,
  applyCommittedAccountEntityPatches,
  getAccountItemEntity,
  getAccountItemEntityCount,
  getAccountStoreRevision,
  getAccountSummarySnapshot,
  replaceAccountSummary,
  useHasAccountDataStore
} from "../src/renderer/shared/stores/accountEntityStore.js";

beforeEach(() => {
  replaceAccountSummary(null);
});

describe("account entity store", () => {
  it("按实例规范化，并保留完整列表中的权威实体", () => {
    const summary = accountSummary();
    summary.vault.sample_items = [{ ...summary.vault.items[0]!, name: "sample copy" }];

    replaceAccountSummary(summary);

    expect(getAccountItemEntityCount()).toBe(4);
    expect(getAccountItemEntity("vault-item")?.name).toBe("vault item");
    expect(getAccountSummarySnapshot()?.vault.sample_items[0]?.name).toBe("vault item");
  });

  it("局部更新锁定状态且保持未变化快照引用稳定", () => {
    replaceAccountSummary(accountSummary());
    const beforeRevision = getAccountStoreRevision();
    const before = getAccountSummarySnapshot();

    expect(getAccountSummarySnapshot()).toBe(before);
    applyAccountEntityPatches([{ kind: "lock", item_instance_id: "vault-item", locked: true }]);

    expect(getAccountStoreRevision()).toBe(beforeRevision + 1);
    expect(getAccountItemEntity("vault-item")?.locked).toBe(true);
    expect(getAccountSummarySnapshot()).not.toBe(before);
  });

  it("稳定 selector 不因无关实体字段变化触发组件重渲染", () => {
    replaceAccountSummary(accountSummary());
    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount += 1;
      return useHasAccountDataStore();
    });
    const initialRenderCount = renderCount;

    act(() => {
      applyAccountEntityPatches([{ kind: "lock", item_instance_id: "vault-item", locked: true }]);
    });

    expect(result.current).toBe(true);
    expect(renderCount).toBe(initialRenderCount);
  });

  it("在仓库、角色背包和邮局之间移动同一实体引用", () => {
    replaceAccountSummary(accountSummary());

    applyAccountEntityPatches([{
      kind: "transfer",
      item_instance_id: "vault-item",
      character_id: "character-1",
      target: "character-inventory"
    }]);
    let summary = getAccountSummarySnapshot()!;
    expect(summary.vault.items.map((item) => item.instance_id)).not.toContain("vault-item");
    expect(summary.vault.item_count).toBe(0);
    expect(summary.characters[0]?.inventory_items.map((item) => item.instance_id)).toContain("vault-item");
    expect(summary.characters[0]?.inventory_groups[0]?.count).toBe(2);

    applyAccountEntityPatches([{
      kind: "transfer",
      item_instance_id: "vault-item",
      character_id: "character-1",
      target: "vault"
    }, {
      kind: "postmaster-pull",
      item_instance_id: "postmaster-item",
      character_id: "character-1"
    }]);
    summary = getAccountSummarySnapshot()!;
    expect(summary.vault.items.map((item) => item.instance_id)).toContain("vault-item");
    expect(summary.vault.item_count).toBe(1);
    expect(summary.characters[0]?.postmaster_items).toHaveLength(0);
    expect(summary.characters[0]?.inventory_items.map((item) => item.instance_id)).toContain("postmaster-item");
    expect(summary.characters[0]?.inventory_groups[0]?.count).toBe(2);
  });

  it("装备新物品时把同 bucket 旧装备移入背包并同步分组", () => {
    replaceAccountSummary(accountSummary());

    applyAccountEntityPatches([{
      kind: "equip",
      item_instance_id: "inventory-item",
      character_id: "character-1"
    }]);

    const character = getAccountSummarySnapshot()!.characters[0]!;
    expect(character.equipped_items.map((item) => item.instance_id)).toEqual(["inventory-item"]);
    expect(character.inventory_items.map((item) => item.instance_id)).toContain("equipped-item");
    expect(getAccountItemEntity("inventory-item")?.instance?.is_equipped).toBe(true);
    expect(getAccountItemEntity("equipped-item")?.instance?.is_equipped).toBe(false);
    expect(character.equipment_groups[0]?.items.map((item) => item.instance_id)).toEqual(["inventory-item"]);
    expect(character.inventory_groups[0]?.items.map((item) => item.instance_id)).toEqual(["equipped-item"]);
  });

  it("权威刷新未反映装备时保留写后预计位置", () => {
    replaceAccountSummary(accountSummary());
    applyCommittedAccountEntityPatches([{
      kind: "equip",
      item_instance_id: "inventory-item",
      character_id: "character-1"
    }]);

    replaceAccountSummary(accountSummary());

    const character = getAccountSummarySnapshot()!.characters[0]!;
    expect(character.equipped_items.map((item) => item.instance_id)).toEqual(["inventory-item"]);
    expect(character.inventory_items.map((item) => item.instance_id)).toContain("equipped-item");
  });

  it("无实例物品在同一位置按出现次序保留独立实体", () => {
    const summary = accountSummary();
    summary.vault.items.push(item({ hash: 9000, instance_id: undefined, name: "material a" }));
    summary.vault.items.push(item({ hash: 9000, instance_id: undefined, name: "material b" }));

    replaceAccountSummary(summary);

    expect(getAccountSummarySnapshot()?.vault.items.slice(-2).map((entry) => entry.name)).toEqual([
      "material a",
      "material b"
    ]);
    expect(getAccountItemEntityCount()).toBe(6);
  });

  it("已提交写立即投影，并阻止更旧快照覆盖确认结果", () => {
    const initial = accountSummary();
    initial.profile_minted_at = "2026-09-05T00:00:00.000Z";
    replaceAccountSummary(initial);
    applyCommittedAccountEntityPatches([{
      kind: "lock",
      item_instance_id: "vault-item",
      locked: true
    }]);

    expect(getAccountItemEntity("vault-item")?.locked).toBe(true);

    const confirmed = accountSummary();
    confirmed.profile_minted_at = "2026-09-05T00:00:02.000Z";
    confirmed.vault.items[0]!.locked = true;
    replaceAccountSummary(confirmed);
    expect(getAccountItemEntity("vault-item")?.locked).toBe(true);

    const stale = accountSummary();
    stale.profile_minted_at = "2026-09-05T00:00:01.000Z";
    expect(replaceAccountSummary(stale)).toBe(false);
    expect(getAccountItemEntity("vault-item")?.locked).toBe(true);
  });
});

function accountSummary(): AccountSummary {
  const vaultItem = item({ hash: 1001, instance_id: "vault-item", name: "vault item" });
  const equippedItem = item({
    hash: 2001,
    instance_id: "equipped-item",
    name: "equipped item",
    bucket_hash: 1498876634,
    isEquipped: true
  });
  const inventoryItem = item({
    hash: 2002,
    instance_id: "inventory-item",
    name: "inventory item",
    bucket_hash: 1498876634
  });
  const postmasterItem = item({ hash: 3001, instance_id: "postmaster-item", name: "postmaster item" });
  return {
    account_name: "Guardian",
    destiny_membership_id: "destiny-1",
    membership_type: 3,
    characters: [{
      character_id: "character-1",
      class_name: "Hunter",
      equipped_items: [equippedItem],
      equipment_groups: [{ key: "weapons", label: "Weapons", count: 1, items: [equippedItem] }],
      inventory_items: [inventoryItem],
      inventory_groups: [{ key: "weapons", label: "Weapons", count: 1, items: [inventoryItem] }],
      postmaster_items: [postmasterItem],
      loadout_slots: []
    }],
    vault: { item_count: 1, items: [vaultItem], sample_items: [vaultItem] },
    materials: { item_count: 0, items: [] }
  };
}

function item(input: {
  hash: number;
  instance_id: string | undefined;
  name: string;
  bucket_hash?: number;
  isEquipped?: boolean;
}): AccountItemSummary {
  return {
    hash: input.hash,
    instance_id: input.instance_id,
    name: input.name,
    bucket_hash: input.bucket_hash,
    locked: false,
    group_key: "weapons",
    socket_plugs: [],
    instance: { is_equipped: input.isEquipped ?? false }
  };
}
