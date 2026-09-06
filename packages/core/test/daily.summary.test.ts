import { describe, expect, it } from "vitest";
import { buildDailySummary } from "../src/daily/summary.js";

describe("daily summary", () => {
  it("builds deterministic reset information without fake rotation data", () => {
    const summary = buildDailySummary(new Date("2026-06-19T10:30:00.000Z"), {}, {
      timeZone: "Asia/Shanghai"
    });

    expect(summary.date_label).toBe("2026-06-19");
    expect(summary.daily_reset.label).toContain("每日重置");
    expect(summary.daily_reset.label).toContain("2026-06-20 01:00");
    expect(summary.daily_reset.label).toContain("Asia/Shanghai");
    expect(summary.daily_reset.time_remaining_label).toBe("距离每日重置还有 6 小时 30 分钟");
    expect(summary.weekly_reset.label).toContain("每周重置");
    expect(summary.sources.lost_sector.status).toBe("pending");
    expect(summary.sources.vendors.status).toBe("pending");
    expect(summary.sources.weekly_report.status).toBe("pending");
    expect(summary.checklist).toContain("先同步账号，确认角色、仓库和材料数量。");
    expect(summary.recommendations).toContain("今日面板只展示可读真实数据；看不到名字的 Bungie hash 会被隐藏。");
  });

  it("uses the selected local timezone for the visible current date", () => {
    const summary = buildDailySummary(new Date("2026-06-19T18:30:00.000Z"), {}, {
      timeZone: "Asia/Shanghai"
    });

    expect(summary.date_label).toBe("2026-06-20");
    expect(summary.daily_reset.label).toContain("2026-06-21 01:00");
    expect(summary.daily_reset.time_remaining_label).toBe("距离每日重置还有 22 小时 30 分钟");
  });

  it("publishes only the four selected Konata-style daily sections when live data is available", () => {
    const summary = buildDailySummary(new Date("2026-06-19T10:30:00.000Z"), {
      rotations: [
        { title: "日落：玻璃小径", subtitle: "专家/大师轮换" }
      ],
      vendors: [
        { title: "枪匠：风险管理者", subtitle: "公共商人库存" }
      ],
      lost_sector: [
        { title: "今日遗失区域：天启", subtitle: "胸甲掉落" }
      ],
      weekly_report: [
        { title: "本周突袭：救赎花园", subtitle: "里程碑/掉落轮换" }
      ]
    });

    expect(Object.keys(summary.sources)).toEqual([
      "rotations",
      "vendors",
      "lost_sector",
      "weekly_report"
    ]);
    expect(summary.sources.rotations.status).toBe("ready");
    expect(summary.sources.rotations.items?.[0].title).toBe("日落：玻璃小径");
    expect(summary.sources.vendors.status).toBe("ready");
    expect(summary.sources.lost_sector.status).toBe("ready");
    expect(summary.sources.weekly_report.status).toBe("ready");
    expect(summary.checklist).toContain("查看今日轮换、遗失区域和商人库存。");
    expect(summary.checklist).toContain("检查仓库清理装备和疑似好 roll。");
  });

  it("keeps a fuller vendor source list while still limiting other daily sources", () => {
    const summary = buildDailySummary(new Date("2026-07-06T10:30:00.000Z"), {
      rotations: Array.from({ length: 6 }, (_, index) => ({
        title: `轮换 ${index + 1}`
      })),
      vendors: Array.from({ length: 9 }, (_, index) => ({
        title: `商人 ${index + 1}`
      }))
    });

    expect(summary.sources.rotations.items?.map((item) => item.title)).toEqual([
      "轮换 1",
      "轮换 2",
      "轮换 3",
      "轮换 4"
    ]);
    expect(summary.sources.vendors.items?.map((item) => item.title)).toEqual([
      "商人 1",
      "商人 2",
      "商人 3",
      "商人 4",
      "商人 5",
      "商人 6",
      "商人 7",
      "商人 8",
      "商人 9"
    ]);
    expect(summary.sources.vendors.message).toBe("已找到 9 条可读信息。");
  });

  it("keeps all nine readable world lost sectors for the home daily panel", () => {
    const summary = buildDailySummary(new Date("2026-07-06T10:30:00.000Z"), {
      lost_sector: Array.from({ length: 9 }, (_, index) => ({
        title: `遗失区域：Sector ${index + 1}`,
        subtitle: "世界遗失区域"
      }))
    });

    expect(summary.sources.lost_sector.items?.map((item) => item.title)).toEqual([
      "遗失区域：Sector 1",
      "遗失区域：Sector 2",
      "遗失区域：Sector 3",
      "遗失区域：Sector 4",
      "遗失区域：Sector 5",
      "遗失区域：Sector 6",
      "遗失区域：Sector 7",
      "遗失区域：Sector 8",
      "遗失区域：Sector 9"
    ]);
    expect(summary.sources.lost_sector.message).toBe("已找到 9 条可读信息。");
  });
});
