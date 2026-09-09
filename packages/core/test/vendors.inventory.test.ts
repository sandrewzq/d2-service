import { describe, expect, it } from "vitest";
import type { AccountSummary } from "../src/account/summary.js";
import {
  buildVendorAccountIdentityIndex,
  buildVendorInventorySnapshot
} from "../src/vendors/inventory.js";

describe("vendor inventory domain", () => {
  it("separates direct offers from redirect-backed services", () => {
    const snapshot = buildVendorInventorySnapshot(createFixture());
    const xur = snapshot.vendors[0];

    expect(xur.iconUrl).toBe("/common/destiny2_content/icons/xur.png");
    expect(xur.offers.map((offer) => offer.name)).toEqual(["鹰月", "炎阳护腕"]);
    expect(xur.services).toEqual([
      expect.objectContaining({
        name: "奇异装备优惠",
        offers: [expect.objectContaining({ name: "蒙特卡洛" })]
      })
    ]);
  });

  it("merges only offers with identical roll, cost, and eligibility", () => {
    const snapshot = buildVendorInventorySnapshot(createFixture({ includeTitanVariant: true }));
    const offers = snapshot.vendors[0].offers.filter((offer) => offer.itemHash === 1001);

    expect(offers).toHaveLength(2);
    expect(offers.map((offer) => offer.characterIds)).toEqual([["hunter", "warlock"], ["titan"]]);
    expect(new Set(offers.map((offer) => offer.id)).size).toBe(2);
  });

  it("keeps Ghost Armorer context and changed vendor rolls", () => {
    const snapshot = buildVendorInventorySnapshot(createFixture({ includeTitanVariant: true }));
    const offers = snapshot.vendors[0].offers.filter((offer) => offer.itemHash === 1001);

    expect(snapshot.characterContexts.hunter.armorerModName).toBe("手雷护甲师");
    expect(snapshot.characterContexts.titan.armorerModName).toBe("近战护甲师");
    expect(new Set(offers.map((offer) => offer.rollFingerprint)).size).toBe(2);
    expect(offers.find((offer) => offer.characterIds.includes("titan"))?.stats).toEqual({ "2996146975": 19 });
  });

  it("indexes owned vendor identities across account locations without double-counting instances", () => {
    const account = createAccountFixture();
    const index = buildVendorAccountIdentityIndex(account);

    expect(index?.byItemHash.get(1001)).toEqual({
      itemHash: 1001,
      count: 2,
      instanceIds: ["hawkmoon-equipped", "hawkmoon-vault"],
      locations: [
        { kind: "equipped", characterId: "hunter", characterLabel: "猎人", count: 1 },
        { kind: "vault", count: 1 }
      ],
      dataState: "ready"
    });
    expect(index?.byItemHash.get(1002)).toEqual(expect.objectContaining({ count: 0, dataState: "partial" }));
    expect(index?.materialBalances.get(9001)).toBe(97);
    expect(index?.sourceProfileMintedAt).toBe("2026-07-12T11:30:00.000Z");
  });
});

function createAccountFixture(): AccountSummary {
  const hawkmoon = {
    hash: 1001,
    instance_id: "hawkmoon-equipped",
    name: "鹰月",
    item_type: "手炮",
    group_key: "weapons" as const,
    socket_plugs: []
  };
  return {
    account_name: "tester",
    destiny_membership_id: "membership-1",
    membership_type: 1,
    profile_minted_at: "2026-07-12T11:30:00.000Z",
    characters: [{
      character_id: "hunter",
      class_name: "猎人",
      equipped_items: [hawkmoon],
      equipment_groups: [],
      inventory_items: [{ ...hawkmoon }],
      inventory_groups: [],
      postmaster_items: [{
        hash: 1002,
        name: "炎阳护腕",
        item_type: "臂铠",
        group_key: "armor",
        socket_plugs: []
      }],
      loadout_slots: []
    }],
    vault: {
      item_count: 1,
      items: [{ ...hawkmoon, instance_id: "hawkmoon-vault" }],
      sample_items: []
    },
    materials: {
      item_count: 1,
      items: [{ hash: 9001, name: "奇异硬币", quantity: 97 }]
    }
  };
}

function createFixture(options: { includeTitanVariant?: boolean } = {}) {
  const characters = [
    createCharacter("hunter", 18),
    createCharacter("warlock", 18),
    ...(options.includeTitanVariant ? [createCharacter("titan", 19)] : [])
  ];

  return {
    fetchedAt: "2026-07-12T12:00:00.000Z",
    characterContexts: Object.fromEntries(
      characters.map((character) => [
        character.characterId,
        {
          characterId: character.characterId,
          armorerModHash: character.characterId === "titan" ? 222 : 111,
          armorerModName: character.characterId === "titan" ? "近战护甲师" : "手雷护甲师"
        }
      ])
    ),
    characterResponses: characters,
    failedCharacterIds: [],
    failedVendorDetails: [],
    currencyBalances: { "9001": 97 },
    definitions: {
      vendors: {
        "2190858386": {
          name: "仄",
          description: "九之代理人",
          iconUrl: "/common/destiny2_content/icons/xur.png",
          failureStrings: ["无法购买"],
          itemList: {
            "0": { displayCategoryIndex: 0 },
            "1": { displayCategoryIndex: 0 },
            "2": { displayCategoryIndex: 1, redirectToSaleIndexes: [3] },
            "3": { displayCategoryIndex: 1 }
          }
        }
      },
      items: {
        "1001": { name: "鹰月", itemType: "手炮", tierType: "异域" },
        "1002": { name: "炎阳护腕", itemType: "臂铠", tierType: "异域" },
        "1003": { name: "奇异装备优惠", itemType: "服务", tierType: "" },
        "1004": { name: "蒙特卡洛", itemType: "自动步枪", tierType: "异域" },
        "9001": { name: "奇异硬币", itemType: "货币", tierType: "" }
      }
    }
  } as const;
}

function createCharacter(characterId: string, hawkmoonStat: number) {
  return {
    characterId,
    vendors: {
      "2190858386": {
        vendorHash: 2190858386,
        canPurchase: true,
        nextRefreshAt: "2026-07-17T17:00:00.000Z",
        categories: [
          { categoryIndex: 0, name: "奇异装备", itemIndexes: [0, 1] },
          { categoryIndex: 1, name: "服务", itemIndexes: [2, 3] }
        ],
        saleItems: {
          "0": createSale(0, 1001),
          "1": createSale(1, 1002),
          "2": createSale(2, 1003),
          "3": createSale(3, 1004)
        },
        stats: {
          "0": { "2996146975": hawkmoonStat },
          "1": { "2996146975": 16 },
          "3": { "2996146975": 20 }
        },
        sockets: {
          "0": [7001, hawkmoonStat],
          "1": [7002],
          "3": [7003]
        }
      }
    }
  } as const;
}

function createSale(vendorItemIndex: number, itemHash: number) {
  return {
    vendorItemIndex,
    itemHash,
    costs: [{ itemHash: 9001, quantity: 41 }],
    failureIndexes: [],
    saleStatus: 0,
    apiPurchasable: false
  } as const;
}
