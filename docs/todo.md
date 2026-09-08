# 当前待办

> 更新时间：2026-09-08
> 本文件只保留当前任务、状态和下一步。详细范围与验收标准由对应 backlog 维护，阶段过程使用 Git 历史追溯。

## 健康度

| 检查项 | 状态 | 备注 |
|---|---|---|
| 本地 CI | ✅ 2026-09-08 通过 | 已通过文档、编码、全部 workspace 构建、492 项行为测试、质量门禁、62 项架构测试、UI 合同、共享 Shell 视觉合同和全量类型检查 |
| GitHub CI | ⏳ push 后异步执行 | 执行 frozen install、`pnpm test`、共享 Shell 视觉契约、UI 合同静态门禁和构建后的 `pnpm typecheck:ci`；普通 push 不等待结果 |
| Release 门禁 | ✅ 0.0.22 已发布 | 已通过 macOS 发布入口完成本地门禁、GitHub Actions、Windows NSIS 安装包和 GitHub Release |
| Agent 自动验证 | ⛔ 默认禁用 | 只有用户明确要求本地测试、构建或打包时才执行 |

## 当前任务

| 编号 | 优先级 | 状态 | 任务 | Backlog | 下一步 |
|---|---|---|---|---|---|
| T22 | P0 | 🟢 S1–S5 及 Bug #79 整体验收通过，本地 CI 通过，待发布 | 下一版本交付与 Renderer 事件驱动性能收敛 | [唯一执行 backlog](work/backlog/T22-renderer-event-driven-performance.md) | 暂不发版；等用户明确要求“发布”后，使用 macOS Release 入口执行完整门禁、tag 和 GitHub Release。 |

## 已完成基线

| 编号 | 发布版本 | 结果 | 记录 |
|---|---|---|---|
| T14 | v0.0.22 | ✅ 应用配装与逐部位护甲规划已完成并验收 | [完成摘要](work/backlog/T14-armor-planner-slot-aware-mods.md) |
| T20 | v0.0.22 | ✅ 武器推荐与仓库整理已完成并验收 | [完成摘要](work/backlog/T20-weapon-recommendation-vault-cleanup.md) |

## 说明

- 已移除独立本地攻略库；攻略链接、正文和 AI 整理结果统一进入配装页生成未保存草稿，旧攻略 JSON 只作为遗留备份数据保留。
- UI 只维护 `packages/ui` 的共享产品实现；Markdown 合同记录稳定约束，Web 用于快速预览，Desktop 用于真实功能验收。
- UI 合同静态门禁覆盖稳定标记、表面枚举、排版、层级、菜单主题色和选中态方向线，避免菜单实现重新取得共享视觉职责。
- 已完成任务不再追加功能；新需求建立独立小任务，明确回归才登记独立 Bug。
