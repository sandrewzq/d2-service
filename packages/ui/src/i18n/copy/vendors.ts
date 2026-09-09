import type { InterfaceLocale, LocaleCopy } from "../types.js";

export const vendorsCopy: Record<InterfaceLocale, LocaleCopy["vendors"]> = {
    "zh-CN": {
      inline: {
        "Bungie / Manifest / 账号状态": "Bungie / Manifest / 账号状态",
        "每日或周末重置": "每日或周末重置",
        "商人列表": "商人列表",
        "商人": "商人",
        "个商人": "个商人",
        "个来源": "个来源",
        "重新加载商人库存": "重新加载商人库存",
        "未连接 Bungie": "未连接 Bungie",
        "账号还没有登录": "账号还没有登录",
        "还没有配置 Bungie 应用": "还没有配置 Bungie 应用",
        "先登录 Bungie；登录后会自动同步装备数据并加载角色商人库存。": "先登录 Bungie；登录后会自动同步装备数据并加载角色商人库存。",
        "先在设置里完成 Bungie 应用配置，再登录账号加载商人库存。": "先在设置里完成 Bungie 应用配置，再登录账号加载商人库存。",
        "登录 Bungie": "登录 Bungie",
        "去设置 Bungie": "去设置 Bungie"
      },
      title: "商人库存",
      subtitle: "按商人分组查看可确认库存、费用和账号拥有状态。",
      inventoryTitle: "可确认库存",
      inventorySubtitle: "只展示已有来源证据的商人库存，待接入数据单独标记。",
      updatedLabel: "刷新状态",
      resetLabel: "重置窗口",
      sourceLabel: "数据来源",
      accountContextLabel: "账号状态",
      verifiedInventory: "已确认库存",
      loadingTitle: "正在读取实时商人库存",
      emptyTitle: "暂未读取到商人库存",
      emptyBody: "真实数据接入前，这里只展示 mock 或可确认的库存样本。",
      labels: {
        items: "件",
        cost: "费用",
        evidence: "证据",
        owned: "已拥有",
        unowned: "未拥有",
        unknown: "未确认"
      }
    },
    "en-US": {
      inline: {
        "Bungie / Manifest / 账号状态": "Bungie / Manifest / account status",
        "每日或周末重置": "Daily or weekend reset",
        "商人列表": "Vendor list",
        "商人": "Vendors",
        "个商人": "vendors",
        "个来源": "sources",
        "属性读取中": "Loading details",
        "部分详情失败": "Some details failed",
        "详情失败": "Details failed",
        "重新加载商人库存": "Reload vendor inventory",
        "未连接 Bungie": "Bungie disconnected",
        "账号还没有登录": "Bungie account is not signed in",
        "还没有配置 Bungie 应用": "Bungie app is not configured",
        "先登录 Bungie；登录后会自动同步装备数据并加载角色商人库存。": "Sign in to Bungie; gear data and character vendor inventory will load automatically afterward.",
        "先在设置里完成 Bungie 应用配置，再登录账号加载商人库存。": "Configure the Bungie app in Settings, then sign in to load vendor inventory.",
        "登录 Bungie": "Sign in to Bungie",
        "去设置 Bungie": "Configure Bungie"
      },
      title: "Vendors",
      subtitle: "Review verified vendor inventory, costs, and account ownership context.",
      inventoryTitle: "Verified inventory",
      inventorySubtitle: "Grouped by vendor with unverified data kept clearly marked.",
      updatedLabel: "Refresh status",
      resetLabel: "Reset window",
      sourceLabel: "Data source",
      accountContextLabel: "Account status",
      verifiedInventory: "Verified inventory",
      loadingTitle: "Reading live vendor inventory",
      emptyTitle: "No vendor inventory loaded",
      emptyBody: "Before live data is connected, this page only shows mock or verified inventory samples.",
      labels: {
        items: "items",
        cost: "Cost",
        evidence: "Evidence",
        owned: "Owned",
        unowned: "Not owned",
        unknown: "Unknown"
      }
    }
};
