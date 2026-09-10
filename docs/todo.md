# 当前待办

> 更新时间：2026-09-10
> 本文件只保留当前任务、状态和下一步。详细范围与验收标准由对应 backlog 维护，阶段过程使用 Git 历史追溯。

## 健康度

| 检查项 | 状态 | 备注 |
|---|---|---|
| 本地 CI | ✅ 2026-09-09 通过 | 已通过文档、编码、全部 workspace 构建、488 项行为测试、质量门禁、62 项架构测试、UI 合同、共享 Shell 视觉合同和全量类型检查 |
| GitHub CI | ⏳ push 后异步执行 | 执行 frozen install、`pnpm test`、共享 Shell 视觉契约、UI 合同静态门禁和构建后的 `pnpm typecheck:ci`；普通 push 不等待结果 |
| Release 门禁 | ✅ 0.0.22 已发布 | 已通过 macOS 发布入口完成本地门禁、GitHub Actions、Windows NSIS 安装包和 GitHub Release |
| Agent 自动验证 | ⛔ 默认禁用 | 只有用户明确要求本地测试、构建或打包时才执行 |

## 当前任务

| 编号 | 优先级 | 状态 | 任务 | Backlog | 下一步 |
|---|---|---|---|---|---|
| Bug #81 | P0 | 🟠 代码完成，待验收 | 仓库快捷取出后保持结果列表滚动位置 | — | 在仓库结果列表中连续取出多件装备，确认卡片移除后焦点落到相邻卡片，右侧滚动位置不再因旧焦点请求重复执行而跳动。 |
| T1 | P1 | 📝 候选方案，待排期 | 全应用英文国际化补齐 | [任务说明](work/backlog/T1-english-internationalization.md) | 先补齐页面标题、顶部状态和共享弹窗，再按仓库、装备详情、配装、AI 助手顺序迁移；完成核心工作流前不宣称完整英文支持。 |
| T23 | P2 | ⏸️ 等待官方书面授权 | D2Checkpoint 进度机器人集成 | [执行 backlog](work/backlog/T23-d2checkpoint-integration.md) | 用户已于 2026-09-08 向 `support@d2checkpoint.com` 发送授权申请；收到回复前不进入开发。 |
| T43 | P1 | 🟠 开发完成，待真实账号验收 | 任务待处理中心 | [任务说明](work/backlog/T43-pursuit-attention-center.md) | 使用真实账号在“账号 → 任务与赏金”核对三角色任务、赏金、角色目标和赛季挑战的数量、进度、追踪、到期与完成待处理状态；首页任务卡已取消。 |
| T44 | P1 | 🟠 已修正奖励来源，待真实账号验收 | 光等提升路线 | [任务说明](work/backlog/T44-character-progression-center.md) | 周挑战奖励按 Objective 读取 Manifest `displayRewards` 并兼容 `dummyRewards`，普通活动掉落不再参与推荐；需核对三角色“本周可做 / 当前无可领取挑战”与游戏内一致。 |
| T45 | P1 | 🟠 首版开发完成，待真实账号验收 | 本周刷取清单 | [任务说明](work/backlog/T45-weekly-farming-checklist.md) | 在“资料库 → 本周刷取”核对当前轮换活动、活动级装备来源、T20 推荐、账号持有与游戏内图样进度；重点确认已完成、进行中、不可制作和未返回四类图样状态。 |
| T52 | P1 | 🟠 代码完成，待真实账号验收 | 仓库武器区分锻造与强化状态 | [任务说明](work/backlog/T52-vault-crafted-weapon-status.md) | 同步装备数据后，在仓库武器卡片核对普通武器无额外标记、锻造武器显示“锻造”、可强化掉落武器显示“强化”，并确认官方图层不遮挡装备阶级。 |

## 已完成基线

| 编号 | 发布版本 | 结果 | 记录 |
|---|---|---|---|
| T14 | v0.0.22 | ✅ 应用配装与逐部位护甲规划已完成并验收 | [完成摘要](work/backlog/T14-armor-planner-slot-aware-mods.md) |
| T20 | v0.0.22 | ✅ 武器推荐与仓库整理已完成并验收 | [完成摘要](work/backlog/T20-weapon-recommendation-vault-cleanup.md) |
| T22 | 待下一版本 | ✅ Renderer 事件驱动性能收敛、T21 发布身份成果与 Bug #79 已完成，真实账号验收和本地 CI 通过 | [正式架构结论](development.md) |
| T40 | 待发布 | ✅ 账号容量与风险摘要已完成并通过真实账号验收 | [完成摘要](work/backlog/T40-account-capacity-risk.md) |
| T42 | 待发布 | ✅ 光等状态与缺口已完成并通过真实账号验收 | [完成摘要](work/backlog/T42-power-growth-analysis.md) |
| T46 | 待发布 | ✅ 商人账号上下文首批范围已完成并通过真实账号验收 | [完成摘要](work/backlog/T46-vendor-account-context.md) |

## 说明

- `T数字` 和 `Bug #数字` 创建后保持全局唯一且不再改号；需求拆分时使用新的未占用编号。当前任务表按任务编号升序排列，优先级和状态以对应列为准，不通过表格位置表达。
- T41“邮政官安全处理”已取消，需求文档已删除；该编号冻结且不再复用。
- 已移除独立本地攻略库；攻略链接、正文和 AI 整理结果统一进入配装页生成未保存草稿，旧攻略 JSON 只作为遗留备份数据保留。
- UI 只维护 `packages/ui` 的共享产品实现；Markdown 合同记录稳定约束，Web 用于快速预览，Desktop 用于真实功能验收。
- UI 合同静态门禁覆盖稳定标记、表面枚举、排版、层级、菜单主题色和选中态方向线，避免菜单实现重新取得共享视觉职责。
- 已完成任务不再追加功能；新需求建立独立小任务，明确回归才登记独立 Bug。
