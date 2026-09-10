import { describe, expect, it } from "vitest";
import {
  createVendorCacheContextKey,
  fetchVendorInventorySnapshot
} from "../src/vendors/liveInventory.js";

describe("live vendor inventory service", () => {
  it("discovers active vendors and loads item components for each character", async () => {
    const requests: string[] = [];
    const snapshot = await fetchVendorInventorySnapshot(createOptions(requests));

    expect(requests.filter((url) => /\/Vendors\/\?/.test(url))).toHaveLength(2);
    expect(requests.filter((url) => url.includes("/Vendors/2190858386/"))).toHaveLength(2);
    expect(requests.filter((url) => url.includes("/Vendors/672118013/"))).toHaveLength(2);
    expect(requests.filter((url) => url.includes("/Vendors/3442679730/"))).toHaveLength(2);
    expect(requests.find((url) => /\/Vendors\/\?/.test(url))).toContain("components=400,401,402,600");
    expect(requests.find((url) => url.includes("/Vendors/2190858386/"))).toContain("components=304,305");
    expect(snapshot.characterContexts.hunter).toMatchObject({
      armorerModHash: 555,
      armorerModName: "手雷护甲师"
    });
    expect(snapshot.currencyBalances["9001"]).toBe(97);
    const xur = snapshot.vendors.find((vendor) => vendor.vendorHash === 2190858386)!;
    const banshee = snapshot.vendors.find((vendor) => vendor.vendorHash === 672118013)!;
    const eternityXur = snapshot.vendors.find((vendor) => vendor.vendorHash === 3442679730)!;
    expect(eternityXur).toMatchObject({
      name: "仄",
      vendorGroupName: "30 周年纪念"
    });
    expect(eternityXur.offers[0]?.name).toBe("历史物品");
    expect(xur.iconUrl).toBe("/common/destiny2_content/icons/xur.png");
    expect(xur.offers[0]).toMatchObject({
      name: "鹰月",
      stats: { "2996146975": 18 },
      socketPlugHashes: [7001]
    });
    expect(banshee.offers[0]).toMatchObject({
      name: "差分方程",
      stats: { "2996146975": 12 },
      socketPlugHashes: [7101]
    });
  });

  it("keeps successful vendor data when one character vendor detail fails", async () => {
    const snapshot = await fetchVendorInventorySnapshot(createOptions([], 555, 18, "warlock"));

    expect(snapshot.failedVendorDetails).toEqual([{
      characterId: "warlock",
      vendorHash: 672118013,
      message: "枪匠详情失败"
    }]);
    expect(snapshot.vendors.some((vendor) => vendor.vendorHash === 2190858386)).toBe(true);
    expect(snapshot.vendors.some((vendor) => vendor.vendorHash === 672118013)).toBe(true);
  });

  it("limits concurrent vendor-detail requests", async () => {
    const tracker = { active: 0, maxActive: 0 };

    await fetchVendorInventorySnapshot(createManyVendorOptions(tracker));

    expect(tracker.maxActive).toBeGreaterThan(1);
    expect(tracker.maxActive).toBeLessThanOrEqual(4);
  });

  it("returns base inventory without requesting vendor details", async () => {
    const requests: string[] = [];
    const options = createOptions(requests);
    const snapshot = await fetchVendorInventorySnapshot({ ...options, detailVendorHashes: [] });

    expect(requests.some((url) => /\/Vendors\/\d+\//.test(url))).toBe(false);
    expect(snapshot.vendors.length).toBeGreaterThan(0);
    expect(snapshot.detailVendorHashes).toEqual([]);
  });

  it("changes the cache context and roll fingerprint when the equipped Armorer mod changes", async () => {
    const first = await fetchVendorInventorySnapshot(createOptions([], 555, 18));
    const second = await fetchVendorInventorySnapshot(createOptions([], 556, 19));

    expect(createVendorCacheContextKey(first.characterContexts.hunter)).not.toBe(
      createVendorCacheContextKey(second.characterContexts.hunter)
    );
    expect(first.vendors.find((vendor) => vendor.vendorHash === 2190858386)!.offers[0].rollFingerprint).not.toBe(
      second.vendors.find((vendor) => vendor.vendorHash === 2190858386)!.offers[0].rollFingerprint
    );
  });
});

function createOptions(
  requests: string[],
  armorerModHash = 555,
  statValue = 18,
  failedBansheeCharacterId = ""
) {
  return {
    accessToken: "token",
    apiKey: "key",
    membershipType: 3,
    membershipId: "membership",
    characterIds: ["hunter", "warlock"],
    now: () => new Date("2026-07-12T12:00:00.000Z"),
    definitions: {
      vendors: {
        "2190858386": {
          vendorIdentifier: "TOWER_NINE",
          displayProperties: {
            name: "仄",
            description: "九之代理人",
            icon: "/common/destiny2_content/icons/xur.png"
          },
          failureStrings: ["无法购买"],
          itemList: [{ itemHash: 1001, displayCategoryIndex: 0 }],
          displayCategories: [{ displayProperties: { name: "奇异装备" } }]
        },
        "672118013": {
          displayProperties: {
            name: "枪匠",
            description: "高塔武器商人",
            icon: "/common/destiny2_content/icons/banshee.png"
          },
          failureStrings: [],
          itemList: [{ itemHash: 1002, displayCategoryIndex: 0 }],
          displayCategories: [{ displayProperties: { name: "武器" } }]
        },
        "3442679730": {
          vendorIdentifier: "30TH_ANNIVERSARY_XUR",
          displayProperties: { name: "仄" },
          groups: [{ vendorGroupHash: 4179305295 }],
          itemList: [{ itemHash: 1003, displayCategoryIndex: 0 }],
          displayCategories: [{ displayProperties: { name: "30 周年库存" } }]
        }
      },
      items: {
        "1001": {
          displayProperties: { name: "鹰月" },
          itemTypeDisplayName: "手炮",
          inventory: { tierTypeName: "异域" }
        },
        "1002": {
          displayProperties: { name: "差分方程" },
          itemTypeDisplayName: "脉冲步枪",
          inventory: { tierTypeName: "传说" }
        },
        "1003": {
          displayProperties: { name: "历史物品" },
          itemTypeDisplayName: "材料",
          inventory: { tierTypeName: "普通" }
        },
        "5001": {
          displayProperties: { name: "机灵外壳" },
          inventory: { bucketTypeHash: 4023194814 }
        },
        "555": {
          displayProperties: { name: "手雷护甲师" },
          plug: { plugCategoryIdentifier: "ghost.mods.armorer" }
        },
        "556": {
          displayProperties: { name: "近战护甲师" },
          plug: { plugCategoryIdentifier: "ghost.mods.armorer" }
        },
        "9001": { displayProperties: { name: "奇异硬币" } }
      },
      vendorGroups: {
        "4179305295": { categoryName: "30 周年纪念", order: 9 }
      }
    },
    fetchJson: async <T>(path: string): Promise<T> => {
      requests.push(path);
      if (path.includes("?components=205,305")) {
        return {
          characterEquipment: {
            data: {
              hunter: { items: [{ itemHash: 5001, itemInstanceId: "ghost-hunter" }] },
              warlock: { items: [{ itemHash: 5001, itemInstanceId: "ghost-warlock" }] }
            }
          },
          itemComponents: {
            sockets: {
              data: {
                "ghost-hunter": { sockets: [{ plugHash: armorerModHash }] },
                "ghost-warlock": { sockets: [{ plugHash: armorerModHash }] }
              }
            }
          }
        } as T;
      }

      if (/\/Vendors\/\?/.test(path)) {
        return createVendorListResponse() as T;
      }

      if (path.includes("/Vendors/2190858386/")) {
        return {
          itemComponents: {
            stats: {
              data: {
                "0": { stats: { "2996146975": { value: statValue } } }
              }
            },
            sockets: {
              data: {
                "0": { sockets: [{ plugHash: 7001 }] }
              }
            }
          }
        } as T;
      }

      if (path.includes("/Vendors/672118013/")) {
        if (failedBansheeCharacterId && path.includes(`/Character/${failedBansheeCharacterId}/`)) {
          throw new Error("枪匠详情失败");
        }
        return {
          itemComponents: {
            stats: {
              data: {
                "0": { stats: { "2996146975": { value: 12 } } }
              }
            },
            sockets: {
              data: {
                "0": { sockets: [{ plugHash: 7101 }] }
              }
            }
          }
        } as T;
      }

      if (path.includes("/Vendors/3442679730/")) {
        return { itemComponents: {} } as T;
      }

      throw new Error(`Unexpected request: ${path}`);
    }
  };
}

function createVendorListResponse() {
  return {
    vendors: {
      data: {
        "2190858386": {
          vendorHash: 2190858386,
          canPurchase: false,
          nextRefreshDate: "2026-07-17T17:00:00.000Z"
        },
        "672118013": {
          vendorHash: 672118013,
          canPurchase: true,
          nextRefreshDate: "2026-07-13T17:00:00.000Z"
        },
        "3442679730": {
          vendorHash: 3442679730,
          canPurchase: false,
          nextRefreshDate: "2020-01-01T00:00:00.000Z"
        }
      }
    },
    vendorGroups: {
      data: {
        groups: [{ vendorGroupHash: 4179305295, vendorHashes: [3442679730] }]
      }
    },
    categories: {
      data: {
        "2190858386": {
          categories: [{ displayCategoryIndex: 0, itemIndexes: [0] }]
        },
        "672118013": {
          categories: [{ displayCategoryIndex: 0, itemIndexes: [0] }]
        },
        "3442679730": {
          categories: [{ displayCategoryIndex: 0, itemIndexes: [0] }]
        }
      }
    },
    sales: {
      data: {
        "2190858386": {
          saleItems: {
            "0": {
              vendorItemIndex: 0,
              itemHash: 1001,
              costs: [{ itemHash: 9001, quantity: 41 }],
              failureIndexes: [],
              saleStatus: 0,
              apiPurchasable: false
            }
          }
        },
        "672118013": {
          saleItems: {
            "0": {
              vendorItemIndex: 0,
              itemHash: 1002,
              costs: [{ itemHash: 9001, quantity: 17 }],
              failureIndexes: [],
              saleStatus: 0,
              apiPurchasable: false
            }
          }
        },
        "3442679730": {
          saleItems: {
            "0": {
              vendorItemIndex: 0,
              itemHash: 1003,
              costs: [],
              failureIndexes: [],
              saleStatus: 0,
              apiPurchasable: false
            }
          }
        }
      }
    },
    currencyLookups: {
      data: {
        itemQuantities: { "9001": 97 }
      }
    }
  };
}

function createManyVendorOptions(tracker: { active: number; maxActive: number }) {
  const vendorHashes = [101, 102, 103, 104, 105, 106];
  const vendors = Object.fromEntries(vendorHashes.map((vendorHash) => [String(vendorHash), {
    displayProperties: { name: `商人 ${vendorHash}` },
    itemList: [{ itemHash: vendorHash + 1000, displayCategoryIndex: 0 }],
    displayCategories: [{ displayProperties: { name: "库存" } }]
  }]));
  const items = Object.fromEntries(vendorHashes.map((vendorHash) => [String(vendorHash + 1000), {
    displayProperties: { name: `物品 ${vendorHash}` },
    itemTypeDisplayName: "武器",
    inventory: { tierTypeName: "传说" }
  }]));
  const list = {
    vendors: { data: Object.fromEntries(vendorHashes.map((vendorHash) => [String(vendorHash), { vendorHash, canPurchase: true }])) },
    categories: { data: Object.fromEntries(vendorHashes.map((vendorHash) => [String(vendorHash), {
      categories: [{ displayCategoryIndex: 0, itemIndexes: [0] }]
    }])) },
    sales: { data: Object.fromEntries(vendorHashes.map((vendorHash) => [String(vendorHash), {
      saleItems: {
        "0": {
          vendorItemIndex: 0,
          itemHash: vendorHash + 1000,
          costs: [],
          failureIndexes: [],
          saleStatus: 0,
          apiPurchasable: false
        }
      }
    }])) }
  };

  return {
    accessToken: "token",
    apiKey: "key",
    membershipType: 3,
    membershipId: "membership",
    characterIds: ["hunter"],
    definitions: { vendors, items },
    fetchJson: async <T>(path: string): Promise<T> => {
      if (path.includes("?components=205,305")) return {} as T;
      if (/\/Vendors\/\?/.test(path)) return list as T;
      tracker.active += 1;
      tracker.maxActive = Math.max(tracker.maxActive, tracker.active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      tracker.active -= 1;
      return { itemComponents: {} } as T;
    }
  };
}
