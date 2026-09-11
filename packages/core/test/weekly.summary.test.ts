import { describe, expect, it } from "vitest";
import { buildWeeklyLiveDataFromBungie, fetchWeeklyLiveData } from "../src/weekly/liveData";
import { buildWeeklySummary } from "../src/weekly/summary";

describe("weekly summary", () => {
  it("does not treat persistent Iron Banner focusing vendors as an active event", () => {
    const liveData = buildWeeklyLiveDataFromBungie({
      now: new Date("2026-08-06T03:00:00.000Z"),
      profile: {
        characters: { data: { "character-1": { characterId: "character-1" } } },
        characterActivities: { data: { "character-1": { availableActivities: [] } } }
      },
      characterVendors: [{
        characterId: "character-1",
        vendors: {
          data: {
            "2472648659": {
              vendorHash: 2472648659,
              enabled: true,
              canPurchase: false,
              nextRefreshDate: "9999-12-31T23:59:59.999Z"
            }
          }
        },
        sales: {
          data: {
            "2472648659": {
              saleItems: {
                "0": { vendorItemIndex: 0, itemHash: 100 }
              }
            }
          }
        }
      }],
      definitions: {
        vendors: {
          "2472648659": {
            vendorIdentifier: "IRON_BANNER_ATTUNEMENT",
            displayProperties: { name: "铁旗同调" }
          }
        },
        items: {
          "100": { displayProperties: { name: "测试装备" } }
        }
      }
    });

    expect(liveData.iron_banner).toMatchObject({
      status: "inactive",
      title: "铁旗当前未开放",
      characters: { available_count: 0, total_count: 1 },
      loot_pool: { status: "ready" }
    });
    expect(liveData.iron_banner?.ends_at).toBeUndefined();
  });

  it("uses an Iron Banner public milestone as the confirmed activity window", () => {
    const liveData = buildWeeklyLiveDataFromBungie({
      now: new Date("2026-08-06T03:00:00.000Z"),
      milestones: {
        "42": {
          startDate: "2026-08-04T17:00:00Z",
          endDate: "2026-08-11T17:00:00Z",
          activities: [{ activityHash: 19 }]
        }
      },
      definitions: {
        milestones: {
          "42": { displayProperties: { name: "铁旗" } }
        },
        activities: {
          "19": {
            displayProperties: { name: "铁旗：控制" },
            directActivityModeType: 19,
            activityModeTypes: [19]
          }
        }
      }
    });

    expect(liveData.iron_banner).toMatchObject({
      status: "active",
      starts_at: "2026-08-04T17:00:00.000Z",
      ends_at: "2026-08-11T17:00:00.000Z",
      timing_source: "Bungie Public Milestones",
      related_hashes: [42]
    });
  });

  it("keeps public raid milestones as clues instead of confirmed rotating raids", () => {
    const liveData = buildWeeklyLiveDataFromBungie({
      milestones: {
        "1": {
          displayProperties: { name: "Raid portal", description: "Public milestone only" },
          activities: [{ activityHash: 100 }, { activityHash: 101 }]
        }
      },
      definitions: {
        activities: {
          "100": { displayProperties: { name: "King's Fall: Standard" } },
          "101": { displayProperties: { name: "Last Wish: Standard" } }
        }
      }
    });

    expect(liveData.items?.map((item) => item.weeklyActivityKind)).not.toContain("rotating_raid");
    expect(liveData.public_clues?.map((item) => item.weeklyActivityKind)).toEqual(["public_clue"]);
    expect(liveData.public_clues?.[0]?.subtitle).toContain("King's Fall: Standard");
  });

  it("classifies Bungie milestone definitions into weekly priority data", () => {
    const liveData = buildWeeklyLiveDataFromBungie({
      milestones: {
        "1": {
          activities: [{ activityHash: 100 }]
        },
        "2": {
          displayProperties: { name: "日落", description: "奖励武器：热头" },
          activities: [{ activityHash: 200 }]
        }
      },
      definitions: {
        milestones: {
          "1": { displayProperties: { name: "国王的陨落", description: "国王万岁" } }
        },
        activities: {
          "100": { displayProperties: { name: "国王的陨落: 标准" } },
          "200": { displayProperties: { name: "玻璃小径：大师" } }
        }
      }
    });

    expect(liveData.items?.map((item) => item.weeklyActivityKind)).toEqual(["nightfall"]);
    expect(liveData.public_clues?.map((item) => item.weeklyActivityKind)).toEqual(["public_clue"]);
    expect(liveData.public_clues?.[0]?.title).toBe("Bungie 公共里程碑：国王的陨落");
  });

  it("keeps unconfirmed public weekly activity items out of confirmed priorities", () => {
    const summary = buildWeeklySummary(new Date("2026-07-09T09:00:00.000Z"), {
      items: [
        {
          title: "Bungie 公共里程碑：国王的陨落",
          subtitle: "非完整掉落地图；国王的陨落: 标准",
          description: "国王万岁",
          source: "Bungie",
          weeklyActivityKind: "rotating_raid"
        }
      ]
    }, { timeZone: "Asia/Shanghai" });

    expect(summary.priorities.rotating_raid).toMatchObject({
      status: "pending",
      title: "轮换突袭待确认"
    });
    expect(summary.priorities.nightfall).toMatchObject({
      status: "pending",
      title: "宗师先锋警戒待确认"
    });
    expect(summary.weekly_reset.time_remaining_label).toContain("距离每周重置还有");
  });

  it("extracts confirmed weekly portal activities from character activities", () => {
    const liveData = buildWeeklyLiveDataFromBungie({
      profile: {
        characterActivities: {
          data: {
            "character-1": {
              availableActivities: [
                {
                  activityHash: 461602663,
                  challenges: [{ objective: { objectiveHash: 3511848321 } }]
                },
                {
                  activityHash: 1441982566,
                  challenges: [{ objective: { objectiveHash: 1863972407 } }]
                },
                {
                  activityHash: 3889634515,
                  challenges: [{ objective: { objectiveHash: 1863972407 } }]
                },
                {
                  activityHash: 1541433876,
                  challenges: [{ objective: { objectiveHash: 2243638599 } }]
                },
                {
                  activityHash: 300092127,
                  challenges: [{ objective: { objectiveHash: 2367956143 } }]
                },
                {
                  activityHash: 4293676253,
                  challenges: [{ objective: { objectiveHash: 2367956143 } }]
                },
                {
                  activityHash: 2823159265,
                  challenges: [{ objective: { objectiveHash: 3039545165 } }]
                },
                {
                  activityHash: 2727361621,
                  challenges: [{ objective: { objectiveHash: 897179824 } }],
                  visibleRewards: [{ rewardItems: [{ itemQuantity: { itemHash: 3649567221 } }] }]
                }
              ]
            }
          }
        }
      },
      definitions: {
        activities: {
          "461602663": {
            displayProperties: { name: "移民号的坠毁: 自定义" },
            originalDisplayProperties: { name: "移民号的坠毁" },
            challenges: [{ objectiveHash: 3511848321, displayRewards: [{ itemQuantity: { itemHash: 891765152 } }] }]
          },
          "1441982566": { displayProperties: { name: "门徒誓约: 标准" }, originalDisplayProperties: { name: "门徒誓约" }, activityTypeHash: 2043403989, directActivityModeType: 4, activityModeTypes: [4, 7] },
          "3889634515": { displayProperties: { name: "门徒誓约: 大师" }, originalDisplayProperties: { name: "门徒誓约" }, activityTypeHash: 2043403989, directActivityModeType: 4, activityModeTypes: [4, 7] },
          "1541433876": { displayProperties: { name: "救赎的边缘: 标准" }, originalDisplayProperties: { name: "救赎的边缘" }, activityTypeHash: 2043403989, directActivityModeType: 4, activityModeTypes: [4, 7] },
          "300092127": { displayProperties: { name: "晚星之主: 普通" }, originalDisplayProperties: { name: "晚星之主" }, activityTypeHash: 608898761, activityModeTypes: [82, 7] },
          "4293676253": { displayProperties: { name: "晚星之主: 大师" }, originalDisplayProperties: { name: "晚星之主" }, activityTypeHash: 608898761, activityModeTypes: [82, 7] },
          "2823159265": { displayProperties: { name: "二象性: 标准" }, originalDisplayProperties: { name: "二象性" }, activityTypeHash: 608898761, activityModeTypes: [82, 7] },
          "2727361621": { displayProperties: { name: "平衡: 标准" }, originalDisplayProperties: { name: "平衡" }, activityTypeHash: 608898761, activityModeTypes: [82, 7] }
        },
        objectives: {
          "3511848321": { displayProperties: { description: "完成宗师先锋警戒并获得B级或以上。" } },
          "1863972407": { displayProperties: { name: "周常突袭挑战", description: "完成此次突袭。" } },
          "2243638599": { displayProperties: { name: "周常突袭挑战", description: "完成此次突袭。" } },
          "2367956143": { displayProperties: { name: "周常地牢挑战", description: "完成此次地牢。" } },
          "3039545165": { displayProperties: { name: "周常地牢挑战", description: "完成此次地牢。" } },
          "897179824": { displayProperties: { description: "完成“平衡”地牢。" } }
        },
        items: {
          "891765152": { displayProperties: { name: "崇拜" }, itemTypeDisplayName: "狙击步枪" },
          "3649567221": { displayProperties: { name: "周常奖励" } }
        }
      }
    });
    const summary = buildWeeklySummary(new Date("2026-07-09T09:00:00.000Z"), liveData, { timeZone: "Asia/Shanghai" });

    expect(summary.priorities.nightfall.title).toBe("移民号的坠毁");
    expect(summary.priorities.nightfall.detail).toBe("先锋行动 · 宗师先锋警戒");
    expect(summary.priorities.nightfall.entries?.[0]?.loot_pool?.map((reward) => reward.name)).toEqual(["崇拜"]);
    expect(summary.priorities.rotating_raid.entries?.map((entry) => entry.title)).toEqual(["门徒誓约", "救赎的边缘"]);
    expect(summary.priorities.rotating_dungeon.entries?.map((entry) => entry.title)).toEqual(["晚星之主", "二象性"]);
    expect(summary.priorities.rotating_dungeon.entries?.map((entry) => entry.title)).not.toContain("平衡");
  });

  it("merges character activity challenges before de-duplicating a dungeon", () => {
    const liveData = buildWeeklyLiveDataFromBungie({
      profile: {
        characterActivities: {
          data: {
            "character-1": {
              availableActivities: [{ activityHash: 1262462921 }]
            },
            "character-2": {
              availableActivities: [{
                activityHash: 1262462921,
                challenges: [{ objective: { objectiveHash: 3211393925 } }]
              }]
            }
          }
        }
      },
      definitions: {
        activities: {
          "1262462921": {
            displayProperties: { name: "守望者尖塔: 标准" },
            originalDisplayProperties: { name: "守望者尖塔" },
            activityTypeHash: 608898761,
            activityModeTypes: [82, 7]
          }
        },
        objectives: {
          "3211393925": { displayProperties: { name: "周常地牢挑战", description: "完成此次地牢。" } }
        }
      }
    });

    expect(liveData.items).toEqual([
      expect.objectContaining({
        title: "守望者尖塔",
        subtitle: "周常地牢挑战",
        weeklyActivityKind: "rotating_dungeon"
      })
    ]);
  });

  it("fetches logged-in character activities for confirmed weekly portal activities", async () => {
    const requested: Array<{ path: string; accessToken?: string }> = [];
    const liveData = await fetchWeeklyLiveData({
      token: {
        access_token: "access-token",
        token_type: "Bearer",
        expires_in: 3600,
        membership_id: "bungie-membership",
        created_at: "2026-07-09T00:00:00.000Z"
      },
      definitions: {
        activities: {
          "461602663": { displayProperties: { name: "移民号的坠毁: 自定义" }, originalDisplayProperties: { name: "移民号的坠毁" } }
        },
        objectives: {
          "3511848321": { displayProperties: { description: "Grandmaster Vanguard Alerts" } }
        }
      },
      fetchJson: async <T>(path: string, accessToken?: string): Promise<T> => {
        requested.push({ path, accessToken });
        if (path === "/Destiny2/Milestones/") {
          return {} as T;
        }
        if (path === "/User/GetMembershipsForCurrentUser/") {
          return {
            destinyMemberships: [{ membershipId: "destiny-membership", membershipType: 3 }],
            primaryMembershipId: "destiny-membership"
          } as T;
        }
        if (path === "/Destiny2/3/Profile/destiny-membership/?components=200,204") {
          return {
            characterActivities: {
              data: {
                "character-1": {
                  availableActivities: [
                    {
                      activityHash: 461602663,
                      challenges: [{ objective: { objectiveHash: 3511848321 } }]
                    }
                  ]
                }
              }
            }
          } as T;
        }
        throw new Error(`Unexpected request: ${path}`);
      }
    });

    expect(requested).toContainEqual({
      path: "/User/GetMembershipsForCurrentUser/",
      accessToken: "access-token"
    });
    expect(requested).toContainEqual({
      path: "/Destiny2/3/Profile/destiny-membership/?components=200,204",
      accessToken: "access-token"
    });
    expect(liveData.items?.map((item) => item.title)).toEqual(["移民号的坠毁"]);
  });
});
