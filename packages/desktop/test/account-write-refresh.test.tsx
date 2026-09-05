// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AccountSummary,
  ItemActionResult,
  LoadoutTemplate
} from "../src/renderer/api/types.js";
import { useVaultWriteActions } from "../src/renderer/features/vault/useVaultWriteActions.js";
import { useLoadoutWriteActions } from "../src/renderer/features/loadouts/useLoadoutWriteActions.js";

const apiMock = vi.hoisted(() => ({
  setItemLockState: vi.fn(),
  equipItem: vi.fn(),
  batchEquipItems: vi.fn()
}));

vi.mock("../src/renderer/api/client.js", () => ({ api: apiMock }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("account write refresh strategy", () => {
  it("Vault 写操作有 patch 时立即更新并启动后台对账", async () => {
    apiMock.setItemLockState.mockResolvedValue(lockResult(true));
    const applyCommittedAccountActionPatches = vi.fn();
    const loadAccountSummary = vi.fn().mockResolvedValue(undefined);
    const startAccountWriteVerification = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useVaultWriteActions(vaultInput({
      loadAccountSummary,
      applyCommittedAccountActionPatches,
      startAccountWriteVerification
    })));

    await act(async () => {
      await result.current.handleVaultCleanupUnlock([vaultItem()], "character-1");
    });

    expect(applyCommittedAccountActionPatches).toHaveBeenCalledWith([lockResult(true).account_patch]);
    expect(startAccountWriteVerification).toHaveBeenCalledTimes(1);
    expect(loadAccountSummary).not.toHaveBeenCalled();
  });

  it("Vault 写操作成功但缺 patch 时完整刷新兜底", async () => {
    apiMock.setItemLockState.mockResolvedValue(lockResult(false));
    const loadAccountSummary = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useVaultWriteActions(vaultInput({
      loadAccountSummary,
      applyCommittedAccountActionPatches: vi.fn()
    })));

    await act(async () => {
      await result.current.handleVaultCleanupUnlock([vaultItem()], "character-1");
    });

    await waitFor(() => expect(loadAccountSummary).toHaveBeenCalledTimes(1));
  });

  it("Loadouts 单件装备立即投影并启动后台确认", async () => {
    apiMock.equipItem.mockResolvedValue(equipResult(true));
    const applyCommittedAccountActionPatches = vi.fn();
    const loadAccountSummary = vi.fn().mockResolvedValue(undefined);
    const startHighestPowerVerification = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useLoadoutWriteActions(loadoutInput({
      loadAccountSummary,
      applyCommittedAccountActionPatches,
      startHighestPowerVerification
    })));

    await act(async () => {
      await result.current.equipSingleLoadoutItem(loadoutTemplate(), loadoutTemplate().items[0]!);
    });

    expect(applyCommittedAccountActionPatches).toHaveBeenCalledWith([
      equipResult(true).account_patch
    ]);
    expect(startHighestPowerVerification).toHaveBeenCalledTimes(1);
    expect(loadAccountSummary).not.toHaveBeenCalled();
  });

  it("Loadouts 最高光等装备写入后启动后台轻量确认", async () => {
    const summary = highestPowerAccountSummary();
    const highestPowerResult: ItemActionResult = {
      ok: true,
      message: "ok",
      account_patch: {
        kind: "equip",
        item_instance_id: "better-item",
        character_id: "character-1"
      }
    };
    apiMock.equipItem.mockResolvedValue(highestPowerResult);
    const loadAccountSummary = vi.fn().mockResolvedValue(undefined);
    const applyCommittedAccountActionPatches = vi.fn();
    const startHighestPowerVerification = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useLoadoutWriteActions(loadoutInput({
      accountSummary: summary,
      loadAccountSummary,
      applyCommittedAccountActionPatches,
      startHighestPowerVerification
    })));

    await act(async () => {
      await result.current.equipHighestPowerItems(summary.characters[0]!);
    });

    expect(applyCommittedAccountActionPatches).toHaveBeenCalledWith([
      highestPowerResult.account_patch
    ]);
    expect(startHighestPowerVerification).toHaveBeenCalledWith(
      expect.objectContaining({
        expected_patches: [highestPowerResult.account_patch]
      }),
      { surfaceFeedback: true }
    );
    expect(loadAccountSummary).not.toHaveBeenCalled();
  });

  it("Loadouts 单件装备缺 patch 时完整刷新兜底", async () => {
    apiMock.equipItem.mockResolvedValue(equipResult(false));
    const loadAccountSummary = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useLoadoutWriteActions(loadoutInput({
      loadAccountSummary,
      applyCommittedAccountActionPatches: vi.fn()
    })));

    await act(async () => {
      await result.current.equipSingleLoadoutItem(loadoutTemplate(), loadoutTemplate().items[0]!);
    });

    await waitFor(() => expect(loadAccountSummary).toHaveBeenCalledTimes(1));
  });
});

function vaultInput(input: {
  loadAccountSummary: ReturnType<typeof vi.fn>;
  applyCommittedAccountActionPatches: ReturnType<typeof vi.fn>;
  startAccountWriteVerification?: ReturnType<typeof vi.fn>;
}) {
  return {
    accountSummary: accountSummary(),
    diagnostics: {
      loadActionLog: vi.fn().mockResolvedValue(undefined)
    },
    setVaultTags: vi.fn(),
    setAccountError: vi.fn(),
    setIsRunningItemAction: vi.fn(),
    setItemActionMessage: vi.fn(),
    loadAccountSummary: input.loadAccountSummary,
    applyCommittedAccountActionPatches: input.applyCommittedAccountActionPatches,
    startAccountWriteVerification: input.startAccountWriteVerification ?? vi.fn().mockResolvedValue(undefined)
  };
}

function loadoutInput(input: {
  accountSummary?: AccountSummary;
  loadAccountSummary: ReturnType<typeof vi.fn>;
  applyCommittedAccountActionPatches: ReturnType<typeof vi.fn>;
  startHighestPowerVerification?: ReturnType<typeof vi.fn>;
}) {
  return {
    accountSummary: input.accountSummary ?? accountSummary(),
    loadoutLibrary: {
      reloadTemplates: vi.fn().mockResolvedValue(undefined),
      renameTemplate: vi.fn(),
      deleteTemplate: vi.fn()
    },
    diagnostics: {
      loadActionLog: vi.fn().mockResolvedValue(undefined)
    },
    loadoutActionFeedback: { setSingleActionFeedback: vi.fn() },
    setLoadoutMessage: vi.fn(),
    setItemActionMessage: vi.fn(),
    setAccountOperationFeedback: vi.fn(),
    setIsRunningItemAction: vi.fn(),
    applyCommittedAccountActionPatches: input.applyCommittedAccountActionPatches,
    startHighestPowerVerification: input.startHighestPowerVerification ?? vi.fn().mockResolvedValue(undefined),
    loadAccountSummary: input.loadAccountSummary,
    openItemDetail: vi.fn()
  };
}

function lockResult(withPatch: boolean): ItemActionResult {
  return {
    ok: true,
    message: "ok",
    ...(withPatch ? {
      account_patch: {
        kind: "lock" as const,
        item_instance_id: "item-1",
        locked: false
      }
    } : {})
  };
}

function equipResult(withPatch: boolean): ItemActionResult {
  return {
    ok: true,
    message: "ok",
    ...(withPatch ? {
      account_patch: {
        kind: "equip" as const,
        item_instance_id: "item-1",
        character_id: "character-1"
      }
    } : {})
  };
}

function vaultItem() {
  return accountSummary().vault.items[0]!;
}

function loadoutTemplate(): LoadoutTemplate {
  return {
    id: "loadout-1",
    name: "Test",
    character_id: "character-1",
    class_name: "猎人",
    created_at: "2026-01-01T00:00:00.000Z",
    items: [{ hash: 1001, instance_id: "item-1", name: "Test Item" }]
  };
}

function accountSummary(): AccountSummary {
  const item = {
    hash: 1001,
    instance_id: "item-1",
    name: "Test Item",
    locked: true,
    group_key: "weapons" as const,
    socket_plugs: []
  };
  return {
    account_name: "Guardian",
    destiny_membership_id: "destiny-1",
    membership_type: 3,
    characters: [{
      character_id: "character-1",
      class_name: "猎人",
      equipped_items: [],
      equipment_groups: [],
      inventory_items: [item],
      inventory_groups: [],
      postmaster_items: [],
      loadout_slots: []
    }],
    vault: { item_count: 1, items: [item], sample_items: [] },
    materials: { item_count: 0, items: [] }
  };
}

function highestPowerAccountSummary(): AccountSummary {
  const equippedItem = {
    hash: 1001,
    instance_id: "old-item",
    name: "Old Item",
    bucket_name: "动能武器",
    power: 431,
    group_key: "weapons" as const,
    socket_plugs: []
  };
  const betterItem = {
    hash: 1002,
    instance_id: "better-item",
    name: "Better Item",
    bucket_name: "动能武器",
    power: 450,
    group_key: "weapons" as const,
    socket_plugs: []
  };
  return {
    account_name: "Guardian",
    destiny_membership_id: "destiny-1",
    membership_type: 3,
    characters: [{
      character_id: "character-1",
      class_name: "猎人",
      light: 431,
      equipped_items: [equippedItem],
      equipment_groups: [],
      inventory_items: [betterItem],
      inventory_groups: [],
      postmaster_items: [],
      loadout_slots: []
    }],
    vault: { item_count: 0, items: [], sample_items: [] },
    materials: { item_count: 0, items: [] }
  };
}
