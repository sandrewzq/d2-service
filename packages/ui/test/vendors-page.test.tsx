import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VendorsPageContentView } from "../src/vendors/VendorsPageContentView.js";

describe("shared vendors page", () => {
  it("renders the vendor rail, refresh status, and active Ghost Armorer context", () => {
    render(<VendorsPageContentView model={createModel()} actions={{}} />);

    expect(screen.getByRole("navigation", { name: "商人列表" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /仄.*2 件/ })).toBeTruthy();
    expect(screen.getByText("当前机灵：手雷护甲师")).toBeTruthy();
    expect(screen.getByRole("status", { name: "商人刷新状态" })).toHaveAttribute("aria-live", "polite");
  });

  it("keeps direct and service inventory in the vertical flow", () => {
    render(<VendorsPageContentView model={createModel()} actions={{ onOpenItem: vi.fn() }} />);

    expect(screen.getByRole("heading", { name: "奇异装备优惠" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "打开装备详情：蒙特卡洛" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "打开装备详情：鹰月" })).toBeTruthy();
  });

  it("opens a vendor item through the shared item action", async () => {
    const user = userEvent.setup();
    const onOpenItem = vi.fn();
    render(<VendorsPageContentView model={createModel()} actions={{ onOpenItem }} />);

    await user.click(screen.getByRole("button", { name: "打开装备详情：鹰月" }));
    expect(onOpenItem).toHaveBeenCalledWith(
      expect.objectContaining({ itemHash: 1001 }),
      expect.objectContaining({
        vendorName: "仄",
        ownershipLabel: "账号有 2 件同身份装备",
        ownershipLocationLabel: "猎人 · 已装备 1 件 · 仓库 1 件"
      })
    );
  });

  it("filters equipment by missing account identity without treating it as a recommendation", async () => {
    const user = userEvent.setup();
    render(<VendorsPageContentView model={createModel()} actions={{ onOpenItem: vi.fn() }} />);

    await user.click(screen.getByRole("button", { name: "账号无同身份实例" }));

    expect(screen.queryByRole("button", { name: "打开装备详情：鹰月" })).toBeNull();
    expect(screen.getByRole("button", { name: "打开装备详情：蒙特卡洛" })).toBeTruthy();
  });

  it("keeps inventory visible while showing a partial vendor-detail failure", async () => {
    const user = userEvent.setup();
    render(<VendorsPageContentView model={createModel({ detailFailure: true })} actions={{ onOpenItem: vi.fn() }} />);

    expect(screen.getByRole("button", { name: /仄.*部分详情失败.*2 件/ })).toBeTruthy();
    expect(screen.getByRole("status", { name: "商人详情状态" })).toHaveTextContent(
      "1 个角色的属性与插槽详情读取失败"
    );
    expect(screen.getByRole("button", { name: "打开装备详情：鹰月" })).toBeTruthy();

  });

  it("shows the real refresh error when the first inventory load fails", () => {
    render(<VendorsPageContentView
      model={{
        ...createModel(),
        vendors: [],
        railSections: [],
        defaultVendorId: null,
        selectedVendor: undefined,
        statusBanner: {
          tone: "error",
          message: "无法读取任何角色的商人库存",
          live: "polite",
          busy: false
        }
      }}
      actions={{}}
    />);

    expect(screen.getByRole("status", { name: "商人刷新状态" })).toHaveTextContent(
      "无法读取任何角色的商人库存"
    );
    expect(screen.queryByText("真实数据接入前，这里只展示 mock 或可确认的库存样本。")).toBeNull();
  });
});

function createModel(options: { detailFailure?: boolean } = {}) {
  const eagle = {
    id: "eagle",
    itemHash: 1001,
    vendorItemIndex: 0,
    characterIds: ["hunter"],
    name: "鹰月",
    itemType: "手炮，异域",
    summary: "Bungie 当前角色商人库存",
    cost: "41 奇异硬币",
    costs: [{ label: "奇异硬币", required: 41, owned: 97, affordable: true }],
    iconLabel: "鹰月",
    tone: "exotic" as const,
    status: "owned" as const,
    equipmentKind: "weapon" as const,
    ownership: {
      state: "owned" as const,
      count: 2,
      label: "账号有 2 件同身份装备",
      locationLabels: ["猎人 · 已装备 1 件", "仓库 1 件"],
      asOf: "2026-07-12T11:30:00.000Z"
    },
    stats: { "2996146975": 18 },
    sourcePath: "仄"
  };
  const vendor = {
    id: "vendor-2190858386",
    vendorHash: 2190858386,
    name: "仄",
    description: "九之代理人",
    badge: "周末",
    source: "Bungie 角色商人",
    resetLabel: "距离刷新 10 小时",
    location: "高塔",
    taskCategory: "重点库存",
    displayStatusLabel: options.detailFailure ? "部分详情失败" : "已确认",
    inventoryState: "loaded" as const,
    inventoryStateLabel: "库存已读取",
    railStatusLabel: options.detailFailure ? "部分详情失败 · 2 件" : "已确认 · 2 件",
    detailState: options.detailFailure ? "partial" as const : "ready" as const,
    detailFailureMessage: options.detailFailure ? "1 个角色的属性与插槽详情读取失败" : undefined,
    detailToolbar: {
      taskCategory: "重点库存",
      inventoryStateLabel: "库存已读取",
      statusLabel: "已确认",
      itemCountLabel: "2 件"
    },
    featured: true,
    items: [eagle],
    services: [{
      id: "service",
      name: "奇异装备优惠",
      description: "每周优惠",
      items: [{
        ...eagle,
        id: "monte",
        itemHash: 1004,
        name: "蒙特卡洛",
        status: "not_owned" as const,
        ownership: {
          state: "not_owned" as const,
          count: 0,
          label: "账号无同身份实例",
          locationLabels: [],
          asOf: "2026-07-12T11:30:00.000Z"
        },
        sourcePath: "仄 → 奇异装备优惠"
      }]
    }]
  };
  return {
    vendors: [vendor],
    railSections: [{ id: "location-tower", title: "高塔", vendors: [vendor] }],
    defaultVendorId: vendor.id,
    selectedVendor: vendor,
    updatedLabel: "更新：现在",
    sourceLabel: "Bungie 角色商人",
    nextResetLabel: "距离刷新 10 小时",
    verifiedItemCount: 2,
    selectedCharacterContext: {
      characterId: "hunter",
      armorerModHash: 111,
      armorerModName: "手雷护甲师",
      label: "当前机灵：手雷护甲师"
    },
    scopeOptions: [],
    search: { query: "", resultCount: 0 },
    filters: { affordableOnly: false, unownedOnly: false },
    statusBanner: options.detailFailure ? {
      tone: "error" as const,
      message: "1 个商人详情读取失败",
      live: "polite" as const,
      busy: false
    } : null
  };
}
