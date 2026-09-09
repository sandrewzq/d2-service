# 当前待办

> 更新时间：2026-09-09
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
| T23 | P2 | ⏸️ 等待官方书面授权 | D2Checkpoint 进度机器人集成 | [执行 backlog](work/backlog/T23-d2checkpoint-integration.md) | 用户已于 2026-09-08 向 `support@d2checkpoint.com` 发送授权申请；收到回复前不进入开发。 |
| T35 | P1 | 🟡 代码完成，待验收 | 移除 light.gg 专用实时分析 | [任务说明](work/backlog/T35-remove-lightgg-runtime.md) | 验收设置页、单件装备 AI 分析和旧配置升级；确认无 light.gg 专用入口后关闭任务。 |
| T41 | P0 | 📝 候选方案，待排期 | 邮政官安全处理 | [任务说明](work/backlog/T41-postmaster-safe-actions.md) | T40 容量与风险基线已经验收通过；下一步细化批量取回计划、保护规则和逐项确认。 |
| T42 | P0 | 📝 候选方案，待排期 | 光等成长分析 | [任务说明](work/backlog/T42-power-growth-analysis.md) | 冻结当前装备、最高可装备、掉落基准和逐槽差值的真实计算规则。 |
| T43 | P1 | 📝 候选方案，待排期 | 任务待处理中心 | [任务说明](work/backlog/T43-pursuit-attention-center.md) | 核对 Objective、到期、追踪和完成字段，替换名称关键词分类。 |
| T44 | P2 | 📝 候选方案，待排期 | 角色进度中心 | [任务说明](work/backlog/T44-character-progression-center.md) | 先设计独立 Progression 异步资源，确保强力、巅峰、赛季和声望不阻塞装备首屏。 |
| T45 | P0 | 📝 候选方案，待细化与排期 | 商人真实推荐 | [任务说明](work/backlog/T45-vendor-real-recommendations.md) | 冻结推荐状态、卡片短文案和“只看推荐”筛选语义，再复用现有推荐 Worker 接入商人 Offer。 |
| T46 | P1 | 📝 候选方案，待细化与排期 | 商人账号上下文 | [任务说明](work/backlog/T46-vendor-account-context.md) | 确认中央账号身份索引与 Collectibles 数据边界，区分实际拥有、收藏解锁和购买限制。 |
| T47 | P1 | 📝 候选方案，待细化与排期 | 商人刷新差异与事件 | [任务说明](work/backlog/T47-vendor-refresh-diff-events.md) | 冻结 Offer 稳定身份、刷新事件和变化保留规则，不增加固定间隔轮询并保留 Xur 边界定时器。 |
| T48 | P2 | 📝 候选方案，等待 T46 | 商人护甲规划接入 | [任务说明](work/backlog/T48-vendor-armor-planner-integration.md) | 等待购买 Offer 身份与账号实例边界稳定后，设计 Armor Planner 的待购买候选类型。 |
| T49 | P2 | 📝 候选方案，等待 T45～T47 | 商人关注与提醒 | [任务说明](work/backlog/T49-vendor-watch-alerts.md) | 复用明确刷新事件与派生摘要，设计本地关注规则、去重和应用内提醒。 |
| T50 | P1 | 🟡 代码完成，待验收 | 移除 DIM 分享接口依赖 | [任务说明](work/backlog/T50-remove-dim-share-api.md) | 使用完整 DIM 配装链接验收本地导入，并确认 dim.gg 短链接只显示说明、不发起请求。 |
| T51 | P0 | 🟡 代码完成，待验收 | 发布许可证与 AI 隐私边界 | [任务说明](work/backlog/T51-release-licenses-ai-privacy.md) | 验收安装包许可证、设置页许可证入口、旧 AI 配置待确认、确认后调用与服务地址变化后的重新确认。 |

## 已完成基线

| 编号 | 发布版本 | 结果 | 记录 |
|---|---|---|---|
| T14 | v0.0.22 | ✅ 应用配装与逐部位护甲规划已完成并验收 | [完成摘要](work/backlog/T14-armor-planner-slot-aware-mods.md) |
| T20 | v0.0.22 | ✅ 武器推荐与仓库整理已完成并验收 | [完成摘要](work/backlog/T20-weapon-recommendation-vault-cleanup.md) |
| T22 | 待下一版本 | ✅ Renderer 事件驱动性能收敛、T21 发布身份成果与 Bug #79 已完成，真实账号验收和本地 CI 通过 | [正式架构结论](development.md) |
| T40 | 待发布 | ✅ 账号容量与风险摘要已完成并通过真实账号验收 | [完成摘要](work/backlog/T40-account-capacity-risk.md) |

## 说明

- `T数字` 和 `Bug #数字` 创建后保持全局唯一且不再改号；需求拆分时使用新的未占用编号。当前任务表按任务编号升序排列，优先级和状态以对应列为准，不通过表格位置表达。
- 已移除独立本地攻略库；攻略链接、正文和 AI 整理结果统一进入配装页生成未保存草稿，旧攻略 JSON 只作为遗留备份数据保留。
- UI 只维护 `packages/ui` 的共享产品实现；Markdown 合同记录稳定约束，Web 用于快速预览，Desktop 用于真实功能验收。
- UI 合同静态门禁覆盖稳定标记、表面枚举、排版、层级、菜单主题色和选中态方向线，避免菜单实现重新取得共享视觉职责。
- 已完成任务不再追加功能；新需求建立独立小任务，明确回归才登记独立 Bug。
