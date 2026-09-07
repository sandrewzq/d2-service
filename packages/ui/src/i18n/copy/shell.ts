import type { InterfaceLocale, LocaleCopy } from "../types.js";

export const shellCopy: Record<InterfaceLocale, LocaleCopy["shell"]> = {
    "zh-CN": {
      brandSubtitle: "Destiny 2 本地助手",
      statusAriaLabel: "全局状态",
      statusMenuLabel: "状态",
      update: {
        versionLabel: "版本",
        updateLabel: "更新",
        reading: "读取中",
        checking: "检查中…",
        available: (version) => version ? `新版本 ${version}` : "发现新版本",
        downloading: (version, progress) => `${version ? `${version} · ` : ""}${progress === undefined ? "下载中" : `下载 ${Math.round(progress)}%`}`,
        downloaded: (version) => version ? `待重启安装 ${version}` : "待重启安装",
        error: "检查失败",
        open: "查看应用更新"
      },
      toolstripAriaLabel: "全局工具",
      navigationAriaLabel: "主导航",
      sidebar: {
        collapse: "收起侧栏",
        expand: "展开侧栏"
      },
      assistantPanelAriaLabel: "AI 助手抽屉",
      windowControlsAriaLabel: "窗口控制",
      windowControls: {
        minimize: "最小化",
        toggleMaximize: "最大化或还原",
        close: "关闭窗口"
      },
      assistant: {
        title: "AI 助手",
        currentPage: (page) => `当前页面：${page}`,
        close: "关闭助手"
      },
      backgroundTasks: {
        ariaLabel: "后台任务",
        title: "后台任务",
        itemCount: (count) => `${count} 个后台任务`,
        activeSummary: (count) => `${count} 个正在后台执行`,
        failedSummary: (count) => `${count} 个需要处理`,
        recentSummary: "最近后台任务",
        openAll: "查看全部",
        openDetails: "查看任务详情",
        dismiss: "收起通知",
        fallbackTitle: "后台任务",
        status: {
          idle: "空闲",
          queued: "排队中",
          running: "运行中",
          runningProgress: (progress) => `运行中 · ${progress}%`,
          retrying: "等待重试",
          retryingAt: (time) => `等待重试 · ${time}`,
          success: "已完成",
          failed: "失败",
          blocked: "已阻断"
        }
      },
      navigation: {
        home: "首页",
        account: "账号",
        vault: "仓库",
        loadouts: "配装",
        library: "资料库",
        vendors: "商人",
        settings: "设置"
      },
      tools: {
        switchToDark: "切换为暗色",
        switchToLight: "切换为亮色",
        switchToChinese: "切换为中文",
        switchToEnglish: "切换为英文",
        github: "GitHub",
        settings: "设置",
        openAiAssistant: "打开 AI 助手抽屉",
        aiAssistant: "AI 助手",
        languageBadge: "中"
      }
    },
    "en-US": {
      brandSubtitle: "Destiny 2 local companion",
      statusAriaLabel: "Global status",
      statusMenuLabel: "Status",
      update: {
        versionLabel: "Version",
        updateLabel: "Update",
        reading: "Reading",
        checking: "Checking…",
        available: (version) => version ? `New version ${version}` : "New version available",
        downloading: (version, progress) => `${version ? `${version} · ` : ""}${progress === undefined ? "Downloading" : `Download ${Math.round(progress)}%`}`,
        downloaded: (version) => version ? `Restart to install ${version}` : "Restart to install",
        error: "Check failed",
        open: "View app update"
      },
      toolstripAriaLabel: "Global tools",
      navigationAriaLabel: "Primary navigation",
      sidebar: {
        collapse: "Collapse sidebar",
        expand: "Expand sidebar"
      },
      assistantPanelAriaLabel: "AI assistant drawer",
      windowControlsAriaLabel: "Window controls",
      windowControls: {
        minimize: "Minimize",
        toggleMaximize: "Maximize or restore",
        close: "Close window"
      },
      assistant: {
        title: "AI Assistant",
        currentPage: (page) => `Current page: ${page}`,
        close: "Close assistant"
      },
      backgroundTasks: {
        ariaLabel: "Background tasks",
        title: "Background tasks",
        itemCount: (count) => `${count} background task${count === 1 ? "" : "s"}`,
        activeSummary: (count) => `${count} running in the background`,
        failedSummary: (count) => `${count} needs attention`,
        recentSummary: "Recent background tasks",
        openAll: "View all",
        openDetails: "View task details",
        dismiss: "Dismiss notification",
        fallbackTitle: "Background task",
        status: {
          idle: "Idle",
          queued: "Queued",
          running: "Running",
          runningProgress: (progress) => `Running · ${progress}%`,
          retrying: "Waiting to retry",
          retryingAt: (time) => `Retrying · ${time}`,
          success: "Completed",
          failed: "Failed",
          blocked: "Blocked"
        }
      },
      navigation: {
        home: "Home",
        account: "Account",
        vault: "Vault",
        loadouts: "Loadouts",
        library: "Library",
        vendors: "Vendors",
        settings: "Settings"
      },
      tools: {
        switchToDark: "Switch to dark mode",
        switchToLight: "Switch to light mode",
        switchToChinese: "Switch to Chinese",
        switchToEnglish: "Switch to English",
        github: "GitHub",
        settings: "Settings",
        openAiAssistant: "Open AI assistant drawer",
        aiAssistant: "AI Assistant",
        languageBadge: "EN"
      }
    }
};
