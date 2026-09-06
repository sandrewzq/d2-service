# 开发说明

这份文档面向仓库维护者和贡献者，集中说明开发、测试、打包、发布和文档结构。

## 1. 技术栈

- Node.js 24 LTS
- pnpm 9
- TypeScript
- Electron
- React
- Vitest

本地需要复现 GitHub CI 时执行 `pnpm ci:local`。该入口会按 CI 顺序运行冻结依赖安装、完整测试、Playwright Chromium、共享 Shell 视觉契约和构建后的全量类型检查；不要只用 Desktop 启动结果判断 CI 是否可通过。

## 2. 仓库结构

```text
packages/
  core/      领域模型、业务规则、分析逻辑、schema、纯函数
  services/  跨端服务接口和平台 adapter
  app/       跨端前端查询层、状态模型、页面 workspace 编排
  ui/        共享 React UI、产品 Host、设计系统和 i18n copy
  web/       Web 平台壳、共享 UI 浏览器预览和 HTTP/API adapter
  http/      本地 HTTP / 工具接口层
  desktop/   Electron 桌面壳
docs/        正式文档
```

### 2.1 核心边界

- `packages/core`
  - 负责领域模型、schema 和跨端类型
  - 负责确定性分析、评分、愿望单、目标规则等纯业务规则
  - 负责 Bungie / Manifest 数据到领域模型的转换逻辑
  - 攻略链接、正文和 AI 整理文本只作为配装页的临时导入来源；解析并按当前账号核对后生成未保存应用配装草稿，不维护独立本地攻略库、正文快照、提取确认或派生关系
  - 旧版本的 `guide-library.json`、`guide-extractions.json` 和 `guide-derived-relations.json` 不参与应用运行，也不主动删除；便携备份暂时保留这些遗留文件，避免升级时静默丢失历史内容
  - 保留 `config/defaults`、`config/env`、`manifest/metadata`、`manifest/definitions` 等纯 helper；不承接本地文件、HTTP、OAuth callback server 或 Manifest cache 读写 adapter

- `packages/services`
  - 负责 Profile / Manifest / LocalData / AI 等服务接口
  - 负责桌面、本地、Web、移动端或远端 API 的 adapter
  - 负责把网络、存储、鉴权等平台能力收口到服务边界
  - OAuth callback server、OAuth token store / HTTP client、config store、Manifest metadata cache 和 definition component cache 的运行时实现统一放在这里；Desktop 主进程和 worker 通过 services subpath 调用，不从 core 直接取运行环境 adapter
  - action log 等本地 JSON store 的文件读写实现放在 services；core 只持有对应领域类型、筛选和格式化规则
  - 社区推荐的本地表、个人知识、light.gg 缓存和 AI source 运行时统一放在 `services/community`；core 只保留 DTO、规范化、注入式 source、匹配和响应解析

- `packages/app`
  - 负责跨端前端查询层、状态模型和页面 workspace 编排
  - 复用 services，不直接依赖 Electron、Node runtime 或桌面 UI
  - 首页、账号页、仓库页、配装页和装备详情等平台无关 ViewModel / workspace 优先沉到这里，Desktop / Web 只传入真实数据和写操作 callback

- `packages/ui`
  - 负责共享 React UI、产品级 UI Host、设计系统 token 和 i18n copy
  - 不直接依赖 Electron、Web 部署、移动原生能力或 `window.d2`
  - 页面组件只接收 ViewModel、props 和 callback，真实数据由平台 adapter 提供
  - `src/styles.css` 是 Web、Desktop 共用的唯一产品级样式入口，只按稳定级联顺序导入 `src/styles/` 下的 foundation、shell、workspace、components 和菜单分片；颜色、间距、页面布局、暗色模式和通用状态样式不得再落到平台壳私有 CSS
  - Web 预览使用的 typed fixture foundation 通过 `@d2-tools/ui/fixtures` 暴露，平台壳只保留场景差异和 adapter

- `packages/web`
  - 负责 Web 平台壳、浏览器启动、Web 登录态和 HTTP/API adapter
  - 与 Desktop 挂同一个产品 UI Host，不复制页面实现；后续移动 App 也按同一壳模式接入
  - 首页数据可以通过 Web snapshot provider / adapter 从 `/api/home-snapshot` 读取，无服务时显示 `unavailableHomeSnapshot` 明确不可用状态；其他页面当前明确使用 fixture runtime，不保留未消费的通用 page snapshot 契约

- `packages/http`
  - 暴露本地 HTTP / 工具接口
  - 复用 core / services，不单独维护业务真相

- `packages/desktop`
  - 负责 Electron 主进程、preload、IPC、窗口、本地文件和安装更新等系统能力
  - Electron channel 的共享 transport 契约放在 `src/contracts/<domain>.ts`；main、preload 和 renderer API 共同引用该目录，preload / main 不得反向依赖 renderer
  - Renderer 中仍未迁出的页面逻辑继续按 feature 边界维护，平台无关 UI 逐步迁入 `packages/ui`
  - Renderer 入口必须导入 `@d2-tools/ui/styles.css`；`packages/desktop/src/renderer/styles.css` 只允许保留 Electron 平台级调整，不承载产品页面样式
  - main 使用 `tsconfig.main.json` 编译，renderer 使用 Vite 源码 alias 与 `tsconfig.renderer.json` 对齐；preload 使用独立 `vite.preload.config.ts` 直接产出 `dist/preload/preload.cjs`，不得再通过字符串替换转换 TypeScript 输出

### 2.2 Renderer feature 边界

- `@d2-tools/app` 业务能力必须从 `./account`、`./assistant`、`./home`、`./items`、`./library`、`./loadouts`、`./settings`、`./vault`、`./vendors` 分域入口导入；根入口只保留通用查询状态，不重新聚合页面业务接口。
- `packages/desktop/src/renderer/pages/HomePage.tsx` 是桌面端菜单 composition root，只做菜单接线和跨 feature 状态组装。
- Desktop 菜单公共 Context 只传递 `DesktopMenuSession` 这类跨菜单运行时能力，不保存页面组件的完整 Props；每个菜单 Provider 负责组装本菜单 ViewModel、加载状态和操作回调。
- `packages/desktop/src/renderer/features/<menu>/` 是菜单私有实现。feature 可以 import `shared/`、`components/`、`utils/` 和 `api/`，但不能 import 其他 feature。
- `packages/desktop/src/renderer/shared/` 只能放跨菜单复用能力，不能反向 import `features/`。
- 跨账号、仓库、资料库复用的装备详情、配装定位、状态卡片等能力应先进入 `shared/`，再由各 feature 引用。
- `packages/desktop/src/contracts/<domain>.ts` 是 Electron channel 的单一 transport 契约；领域 DTO 继续由 core 持有，session/cache patch 由 services 持有，contracts 只组合 channel 输入输出。已经迁入 contracts 的领域由 renderer 直接引用该契约，preload / main 不得从 renderer API 导入类型。
- `packages/desktop/src/renderer/api/types.ts` 是 renderer 侧 `AppApi` 聚合入口；大型 DTO 不得重新塞回该文件或 `api/client.ts`。后续 Mac / 移动端适配优先复用 core/services 的领域和服务接口，不直接复用 Electron transport 契约。
- `packages/desktop/src/renderer/api/client.ts` 只做 Electron renderer 运行时绑定：声明 `window.d2` 并导出 `api`；renderer / test 类型应从 `api/types.ts`、分域 API 文件或对应 transport contract 导入。
- 新增用户可见文案优先进入 `packages/ui/src/i18n/` 或对应领域 copy，并遵循 [玩家文案字典](player-facing-language.md)；界面语言使用 `zh-CN` / `en-US`，Bungie 资料库语言使用 `zh-chs` / `en`，不要在组件里分散写 `locale === ... ? ... : ...`。共享 UI 的 Web 预览数据也必须接收 `interfaceLocale`，不能只给 Desktop 正式内容页做 i18n。
- 默认数据目录由 `packages/services/src/config/dataDir.ts` 的平台 adapter 统一计算：Windows 使用 `%APPDATA%\d2-tools`，macOS 使用 `~/Library/Application Support/d2-tools`，Linux / 其他平台使用 `$XDG_DATA_HOME/d2-tools` 或 `~/.local/share/d2-tools`；Core 的默认配置函数只接收明确的数据目录。
- `packages/desktop/test/renderer-boundaries.test.ts` 会拦截 feature 互相 import 和 shared 反向依赖 feature。
- `packages/desktop/test/renderer-api-boundaries.test.ts` 会拦截把大型 DTO 类型重新塞回 `api/client.ts`、renderer / test 从 `api/client.ts` 导类型，或重新塞回一个巨型 `api/types.ts`。
- 源码目录下的 `packages/*/src/**/*.js` 和 `packages/*/src/**/*.d.ts` 默认视为构建或迁移过程产生的衍生文件，不作为正式源码提交目标；常规开发应以 `.ts` / `.tsx` 为准，构建产物优先落到 `dist/`。

### 2.3 并行开发规则

- 普通功能按菜单并行：账号页改 `features/account/`，仓库页改 `features/vault/`，资料库改 `features/library/`，配装改 `features/loadouts/`，AI 改 `features/ai/`，设置改 `features/settings/`，每日 / 每周改 `features/daily/`。
- 跨菜单能力先抽到 `shared/`，再由各 feature 引用；不要让一个 feature 直接 import 另一个 feature。
- 共享详情、配装来源、仓库清理等跨菜单逻辑应放到 `shared/components/`、`shared/hooks/` 或 `shared/domain/`。
- Electron transport 契约按领域维护在 `src/contracts/`；Renderer API 在 `api/*Api.ts` 重导出所需契约，`types.ts` 只聚合，`client.ts` 只绑定 Electron runtime。
- 主进程 IPC 按领域维护在 `src/main/ipc/` 子模块，`ipc.ts` 只聚合。
- 新增可见文案优先进入 copy 体系；跨端 UI 文案优先进入 `packages/ui/src/i18n/`，设置页和旧 renderer feature 迁移前可保留局部中文，但不得新增分散的语言判断。
- `HomePage.tsx`、`ItemDetailModal.tsx`、`useItemDetailWorkspace.ts`、`api/types.ts`、`api/client.ts`、`ipc.ts` 等公共接线文件是并行开发高冲突区，修改前要确认是否真的需要，并说明影响范围。

### 2.4 跨端 UI 与视觉规格开发流程

后续 UI 开发按“共享 UI 优先，平台壳只接能力”的方式推进：

1. 视觉、布局、组件结构、状态样式、通用交互和跨端文案默认进入 `packages/ui`。
2. 不再维护独立 HTML 原型。`packages/ui` 的共享页面是唯一产品实现，稳定视觉、结构和交互约束记录在 `docs/work/references/ui-specs/`。
3. Web 和 Desktop 只负责平台 adapter。Web 处理浏览器登录态、HTTP/API、部署配置；Desktop 处理 Electron IPC、本地文件、窗口、更新和打包。
4. UI 探索直接在共享页面实现，通过 Web 快速预览并由 Desktop 结合真实数据验收；确认后的跨菜单约束同步更新 Markdown 合同。
5. `ProductShellHost` 是产品外壳统一入口；Web / Desktop 都应挂同一个 Host。不得重新引入平台专用 shell wrapper 来复制页面结构。主菜单真实入口的页面根、页面标题和页面级 gap 归 `ProductShellHost` 统一管理，页面内容组件只返回内容层。
6. 顶部状态条等跨端状态对象必须使用稳定 key 做样式和逻辑判断，例如 `account`、`library`、`app-version`；本地化后的 `label` 只用于显示，不能参与逻辑判断。
7. 全局 AI 抽屉等产品级辅助面板也属于共享 UI：`assistantPanel` 不允许各端长期自建标题、对话结构或占位页面，必须复用 `packages/ui` 的 AI Assistant View；Desktop / Web 只提供真实服务 adapter 或预览数据。
8. 窗口控制按钮由 `packages/ui` 的共享 `AppShell` 自绘，Desktop 只通过 `platformActions.windowControls` 注入最小化、最大化/还原和关闭动作；不要重新启用 Electron 原生 `titleBarOverlay`。
9. 改 `packages/ui` 后默认不新增测试，也不自动运行 UI 测试、消费者类型检查和视觉脚本；需要快速体验时启动 Web，需要真实功能验收时启动 Desktop。用户要求本地测试时正常运行现有检查，否则普通 push 后交给 CI。
10. 产品样式不得再复制到 Desktop 私有样式文件；需要新增 class、token、暗色规则或页面布局时，修改 `packages/ui/src/styles/` 下对应分片，并保持 `packages/ui/src/styles.css` 只作为稳定顺序的聚合入口。Desktop 私有 CSS 只能放窗口、拖拽区或 Electron 特有平台差异。

共享 UI 实施规则：

1. `packages/ui` 的共享页面决定实际布局、组件层级、响应式行为和视觉表现；`docs/work/references/ui-specs/` 记录需要跨实现稳定保持的合同。
2. 当前应用的旧 DOM、旧 CSS、旧 token、旧组件 chrome 和 `archive` 实现不作为保留目标；冲突旧样式应随页面修改删除。
3. 当前 ViewModel、props、actions、adapter、IPC、真实数据规则、错误恢复和已有工作流是功能真相。UI 修改不得减少字段、入口、状态或写操作，也不得用 mock 冒充真实能力。
4. 每个菜单开工前确认功能清单、页面结构、真实字段/action 绑定，以及加载、空、失败、部分失败、禁用、进行中的状态矩阵。
5. 现有合同没有容纳某项功能时，先更新合同并确认位置；当前没有真实能力的控件不得使用假回调、固定成功 toast 或静态状态冒充实现。
6. 每个菜单只允许一棵产品 JSX。不得新增或保留 `presentation="archive"`、`Archive*Content` 或以 `visualVariant` 切换页面结构；菜单还原完成时必须同步删除该菜单的 archive 分支、专用组件和专用 CSS。
7. Web 和 Desktop 必须共同消费 `packages/ui` 的同一页面，只负责各自的平台 adapter、预览数据和真实能力。
8. 验收同时检查视觉完整度和功能完整度。任何未获确认的视觉偏差、旧样式兼容层、mock 数据进入产品组件或原功能丢失，都表示该菜单尚未完成。

常见改动归属：

- 首页、设置页、账号页的布局和样式：`packages/ui`
- 设置页、账号页、资料库页和配装页的内部复杂块已迁入 `packages/ui`；账号页和设置页主入口文案已进入 `packages/ui/src/i18n/`；Desktop feature 只保留真实数据 adapter、写操作 callback 和少量派生 ViewModel 接线。
- 浏览器预览中的场景数据和状态 adapter：`packages/web`
- Web 的真实数据读取、snapshot provider、HTTP fallback 和浏览器外链打开：`packages/web/src/webAdapter.ts`
- 真实账号读取、资料库检查、导入导出、窗口颜色和应用更新：`packages/desktop` 或对应 service / adapter
- Web 登录态、浏览器存储和 HTTP adapter：`packages/web`
- 跨端状态模型、页面 workspace 和 ViewModel：`packages/app`，其中配装页状态汇总 / 迁移计划 / 比较行和装备详情同名对比 / 选中项合并等纯逻辑不应留在 Desktop renderer

### 2.4.1 多 agent 菜单 UI 并行规则

当多个 agent 同时推进不同菜单时，默认按“菜单内容层并行、共享骨架串行”的规则执行。用户不需要额外指定这些边界；agent 开工前必须先按本节判断自己的改动范围。

推荐分工：

| 菜单 | 默认修改范围 | 可改内容 |
|---|---|---|
| 首页 | `packages/ui/src/home/`、必要时 `home-*` 内容样式 | 今日 / 本周信息架构、首页内容卡片、周商人摘要、首页内部列表密度 |
| 账号 | `packages/ui/src/account/`、必要时 `account-*` 内容样式 | 角色、装备、背包、账号操作、账号页内部布局 |
| 仓库 | `packages/ui/src/vault/`、必要时 `vault-*` 内容样式 | 筛选、装备卡、标签、同名对比、清理工作台、仓库内部工具栏 |
| 配装 | `packages/ui/src/loadouts/`、必要时 `loadout-*` 内容样式 | 配装列表、方案详情、迁移计划、比较行、执行状态 |
| 资料库 | `packages/ui/src/library/`、必要时 `library-*` 内容样式 | 搜索、结果列表、来源矩阵、版本状态页内展示 |
| 商人 | `packages/ui/src/vendors/`、必要时 `vendor-*` 内容样式 | 商人目录、库存卡、推荐判断、商人详情 |
| 设置 | `packages/ui/src/settings/`、必要时 `settings-*` 内容样式 | 设置分区、表单、诊断、备份迁移、低频工具区 |

菜单 agent 可以改：

- 对应菜单目录下的 `*ContentView.tsx`、菜单专属组件、菜单专属 copy 和菜单专属 ViewModel props。
- `packages/ui/src/styles/menus/<menu>/` 中对应菜单前缀的内容层规则，例如 `.vault-*`、`.loadout-*`、`.library-*`。
- Web / Desktop 的 adapter 或预览数据，仅限把该菜单需要的数据接入共享 View。

菜单 agent 不得改：

- `ProductShellHost`、`ProductWorkspacePage`、`ProductWorkspaceHeader`、`ProductWorkspacePanel`、`ProductWorkspaceSplit`、`ProductWorkspaceSideRail`、`ProductWorkspaceCommandBar` 的结构或 chrome，除非本次任务明确是共享骨架改造。
- `.product-workspace-*`、`.product-side-rail`、`.product-command-bar`、`.shell-*`、全局 token、暗色模式 token、页面级 gap、页面背景、首层面板 `padding / border / radius / background / shadow`。
- Desktop 私有 CSS 中的产品样式。`packages/desktop/src/renderer/styles.css` 只允许保留 Electron 平台调整。
- `app-panel`、`product-card`、`tool-panel` 作为主菜单首层页面壳或叠加到 `ProductWorkspacePanel` 上。
- 其他菜单目录下的实现，除非先把复用能力抽到共享层。

需要升级为共享改动的情况：

1. 两个以上菜单都需要同一种布局、按钮、卡片、空态、状态条或工具栏。
2. 需要修改页面标题区、页面级左右分栏、首层侧栏、首层 panel chrome、顶部状态条、AI 抽屉或后台任务 Dock。
3. 需要改 `packages/ui/src/styles/` 中 foundation、shell、workspace 或无菜单前缀的共享规则。
4. 需要动 `ProductShellHost.tsx`、`ProductWorkspace.tsx`、`AppShell.tsx`、foundation token 或跨端入口。

升级为共享改动时，agent 必须先说明影响范围。不能把共享骨架问题伪装成某个菜单的私有样式补丁。

菜单开发、收尾、检查、验收、交接和普通提交默认不自动运行测试、类型检查、构建、`verify:*` 或视觉脚本。用户要求本地测试或打包时正常执行现有检查；否则普通 push 后由 GitHub CI 异步验证，agent 不等待 CI。Release 通过对应平台的 Git Release 入口执行并等待完整门禁。

提交或交接前，如果工作区已有多个菜单或共享层改动，Windows 运行：

```powershell
tools\win-git-preflight.cmd
```

macOS 双击 `tools/mac-git-preflight.command`。

如果 preflight 显示多条 lane，agent 不得使用全量提交脚本或 `git add -A`，除非明确确认这些改动都属于同一交付范围。

### 2.5 Renderer UI 样式系统

Renderer UI 的长期边界只在本节保留，具体视觉数值与菜单合同集中在：

- `docs/work/references/ui-specs/global-visual-contract.md`
- `docs/work/references/ui-specs/application-workspaces.md`
- `docs/work/references/ui-specs/equipment-details.md`

实现规则：

1. 实际共享页面是视觉验收对象，当前 ViewModel、actions、adapter、IPC 和状态是功能真相；不得用 mock 或旧产品 DOM 替代真实产品行为。
2. 页面结构和视觉只在 `packages/ui` 实现。Web 和 Desktop 只提供预览数据、平台 adapter 和真实能力接线，共同消费 `ProductShellHost`。
3. 全局 token 和共享 chrome 由 foundation、shell、workspace 与共享组件持有；菜单样式只负责对应领域内容，不覆盖 `.shell-*`、首层工作区、页面 gutter、全局滚动或主题 token。
4. `ProductWorkspace*`、`ControlButton` 等共享组件输出稳定 `data-surface`、`data-ui-kind` 和 Control 语义；菜单不得用 class 重新决定全局颜色、按钮 variant、边框、圆角、文字、阴影或层级。
5. 与当前共享结构冲突的旧 DOM、旧 CSS、archive 分支和平台私有视觉规则直接删除，不使用更高 specificity、`!important` 或后置样式维持兼容。
6. 明暗主题必须使用同一套语义 selector，只替换 token；颜色模式由 `config.json` 的 `features.color_mode` 持久化。
7. UI 视觉变化直接修改共享 UI，并在需要改变稳定约束时同步更新 Markdown 合同。Web 用于中间预览，Desktop 实窗在 `light / dark × 1280 / 980 / 760` 下通过后才能标记完成。
8. 不新增读取生产源码后匹配文案、HTML、class 或 CSS 片段的普通功能测试；废弃入口由 `scripts/check-ui-contract.mjs` 的静态质量门禁维护。

配装页明确区分 Bungie 官方 `游戏内配装` 与本应用保存的 `应用配装`：两者保持独立一级视图，通过“复制到应用配装”和“保存到游戏内槽位”显式转换。应用配装承载方案库、对比、槽位式创建/编辑与安全穿戴；逐部位护甲求解只作为编辑器护甲区的“按属性目标自动配甲”能力。旧 `LoadoutTemplate` 兼容页不再保留。

### 2.6 桌面外壳、更新和后台任务

- 桌面外壳必须稳定展示应用版本和资料库状态；后台任务不进入顶部状态条，也不在每个页面渲染大横幅，只通过共享右下角任务 Dock 在运行、重试或失败时轻量提示，设置页保留完整任务详情。
- 应用更新和资料库更新统一使用 `packages/ui/src/update/SystemUpdateProgress.tsx`：顶部状态保持短文本，任务 Dock 使用紧凑模式，设置页与资料库页使用详细或行内模式；百分比、字节量、速度和重试状态来自后台事件，不在 Renderer 伪造进度。正常运行使用 pending 信息态，warning 只表达重试或可用性受限，error 表达失败或阻断。
- 应用更新由主进程 `updates` IPC 和后台任务中心持有生命周期；renderer 只发起检查、下载、安装确认和订阅状态。
- 应用更新检查失败后进入后台重试，重试策略允许最后一个有限间隔持续复用；不要在网络失败后只提示一次就停止。
- 应用更新默认使用 GitHub Releases；设置 `D2_TOOLS_UPDATE_FEED_URL` 后，官方源失败会自动切换到该国内镜像 Feed，可同时用 `D2_TOOLS_UPDATE_DOWNLOAD_URL` 指定镜像手动下载页。
- 应用更新状态只持久化版本、来源、操作 ID、错误和待安装标记，不写入 Token、Cookie、密钥或完整诊断；启动时只恢复稳定状态，不恢复检查中或下载中的瞬时状态。
- 资料库版本检查由主进程 `manifest` IPC 和后台任务中心持有生命周期；每次启动应用会检查最新 Bungie Manifest。
- 本地 Manifest 未初始化、必要 definition component 缺失或版本落后时，必须提示并允许后台更新；未初始化或组件缺失时，资料库依赖功能应阻断搜索或详情入口。
- 面向用户的普通 UI 统一使用“资料库”命名，不展示 `Manifest`、`本地 Manifest`、`最新 Manifest`、`必要组件`、`资料包` 等开发者概念；内部 API、类型和诊断技术字段可以继续保留 Manifest 命名。
- 顶部状态栏只展示短状态：资料库日期版本、可用、可更新、未准备、需修复、读取中或检查失败等；完整 Bungie Manifest 版本号只放在设置页或诊断导出。
- 资料库日期版本从 Bungie 原始版本号中的 `YY.MM.DD` 片段解析为 `YYYY/MM/DD`；解析失败时普通 UI 显示“资料库 可用”，不要把长版本号泄漏到顶部。
- 设置页“资料库”区域负责展示完整状态：资料库版本、当前版本、最新版本、上次更新、上次检查、更新方式和资料完整性；按钮使用“检查更新”“立即更新”“修复资料库”等用户可理解文案。
- 自动资料库检查应按本地日期做每日节流；本地资料库未初始化、资料库不完整、手动检查、立即更新和修复资料库不受每日节流限制。
- 检查失败但本地资料库可用时，继续允许依赖资料库的功能使用旧数据；更新失败时保留旧资料库，不把旧数据删除或标记为不可用。
- 资料库后台任务必须传递稳定阶段、可用性和下载字节进度：当前语言下载、解压、校验、当前语言索引、英文辅助下载、英文辅助索引、激活和重试分别表达；界面必须明确旧库仍可用、正在短暂切换或当前没有兼容旧库。
- 客户端升级时先验证现有 SQLite 和搜索索引的实际兼容性，不得只因外层 catalog schema 版本变化就判定整库不可用；确需重建索引且主 SQLite 完整、版本匹配时，应复用主库而不是重复下载，最终激活前继续保留可恢复的旧目录。
- Desktop 的 Bungie Definition 主数据源是 Bungie SQLite。`packages/services/src/gameData/` 通过 `GameDataCatalog` 和内部 `DefinitionReader` 隐藏表名、SQL、signed / unsigned hash、缓存和关联查询；Renderer、IPC 和 `packages/core` 不得直接执行 SQL 或读取完整 Definition 表。
- SQLite 查询由 Desktop 长生命周期查询 worker 持有；资料库更新进入激活阶段前，`RuntimeCoordinator` 必须先 quiesce 账号 Session 和查询 worker，确认连接关闭后再切换，完成或回滚后恢复查询。
- GameData worker 的 search/detail 请求必须有有限超时和单请求 pending 清理；definition 批量读取可使用更长超时，worker error/exit/close 时必须统一拒绝并清空剩余请求。
- 资料库更新使用当前语言 SQLite 作为主库，构建装备、Perk、关系和 canonical identity sidecar；非英文界面可离线下载英文 SQLite 构建轻量英文 sidecar，但不得长期保留第二份完整英文主库。
- JSON Adapter 只用于 SQLite 当前未覆盖的 supplement；不得作为旧主缓存兼容层，也不得重新把大型 JSON 主缓存接回普通请求。
- 武器推荐遵循“四人工来源严格 CSV + DIM 原生 Wishlist → SQLite 查询 → DTO 传输”的边界。31 列 CSV 只允许 Aegis、LGpig、YXCRALLXY、Sayalarry；DIM `.txt / .wishlist` 由主进程独立解析，不转换为普通六栏 CSV。人工来源的武器与推荐项只接受官方 Hash 或规范化后的 Bungie 官方全名完全相同，禁止 `contains`、唯一包含、简称、同义词和大师属性词干归类。导入由 Desktop 完成预览、Manifest 语义校验、内容指纹复核和单事务替换；缺少当前语义校验版本的旧人工来源库为 `unverified`，可保留但不得参与留拆判断。DIM 在线更新固定到准确 commit SHA，网络或激活失败时继续使用上一版。Renderer 不直接读取 CSV 或 SQLite；第三方再分发许可未确认前公开安装包不得内置人工来源 CSV。完整规则和当前整改状态见 [T20 backlog](work/backlog/T20-weapon-recommendation-vault-cleanup.md)。
- 仓库推荐运行时只维护 `Map<instanceId, VaultItemInstanceMatchInfo>`，同名版本共享推荐但每个实例使用自身实际 Roll 独立计算。人工来源六项优先级为 `Perk 1 / Perk 2 > 第一列 / 第二列 > 大师 / 起源特性`，内部固定保留“全部符合 / 核心符合 / 接近推荐 / 关键缺失 / 未符合 / 仅推荐这把武器 / 数据不完整”七种状态；玩家摘要先显示实际要求的核心 `Perk x/y`，再显示全部明确要求栏位的 `完整 x/y`，无法核对项单独标记待核对。同栏候选为任选其一、不同栏分别核对。多个来源不得累计分数，同一用途下正反结论冲突或存在无法核对时首层归入“需要比较”；`general` 与 PVE、PVP 均重叠。DIM 保持无序且全部必需的原生 Hash 组合，在仓库卡与装备详情中固定排在人工来源和个人推荐之后，并使用“符合 n 套 · 最佳组合 x/y”的独立组合摘要。匹配结果按 Roll 指纹、Manifest 版本、人工知识库 revision、DIM revision、玩家来源覆盖 revision 和算法版本缓存；位置、光等、锁定和玩家标签不使 Roll 分析失效。卡片、推荐筛选、账号摘要和同名整理复用轻量实例摘要，禁止在单卡渲染中遍历完整 Wishlist；完整可掉落池只在详情中由玩家展开后按 Manifest 版本加载，实例完整 Roll 只在玩家展开后按 `instanceId + rollFingerprint` 读取和复用。批量操作必须跳过锁定、精确配装引用、手动保留、独特 Roll、来源冲突、数据不完整和未覆盖武器，应用永不自动锁定、解锁或分解。
- `AccountItemSummary.bucket_hash / bucket_name` 表示物品当前所在 Bungie 容器，邮政官取回等写操作继续使用它们；`equipment_bucket_hash / equipment_bucket_name` 表示 Manifest 规范装备槽位，物品分类、武器槽位、Roll 解析和装备比较优先使用后者。仓库武器模式可聚合仓库、所有角色已装备、角色背包和邮政官实例，但护甲与其他装备仍只取仓库。聚合后的本地标签可作用于所有实例，仓库批量转移只允许 `source_kind=vault`，邮政官只通过统一详情页取回。
- 账号读取统一通过 `AccountSession`：列表使用紧凑 `AccountSnapshot`，实例详情按需加载。转移、锁定、装备、邮政官取回和配装等 Bungie 写操作在接口明确成功后，Renderer 立即更新共享 Store 的预计位置并登记逐实例 Pending；最后确认快照与写后投影分离保存。后续 Profile 必须严格按 `responseMintedTimestamp` 前进，相同或更旧版本不能重建页面；新版本先更新确认快照，再重放尚未反映的 Pending，实例暂时缺失也不得静默消失。标签、备注和整理状态等本地写入在持久化成功后可直接更新本地 Store。账号页、仓库页和配装页只消费 renderer 的同一份共享账号状态，不得各自发起只更新状态、不写回共享 Store 的资源请求。启动 / 登录后执行一次可见初始同步；应用可见期间每 10 分钟静默同步一次，重新回到前台、恢复网络且上次同步超过 2 分钟时补同步，不因切换菜单触发请求。自动同步复用 in-flight 请求且不占用手动按钮，失败继续显示旧数据；用户手动同步使用 `authoritative` 绕过账号读取缓存。普通快照超过自动同步窗口时显示“待同步”，只有写操作确认超过 90 秒时显示“游戏数据延迟”。Profile 对账必须按实例 ID 确认真实位置和状态：反映目标时结束 Pending；Profile 明确前进且仍冲突时撤销预计状态；超时、网络不可用或 Profile 未前进时保留预计位置并显示“等待游戏状态”。账号快照缓存和 Manifest / sidecar 都属于运行缓存，不进入便携备份。
- 最高光等候选不得把 Bungie `canEquip=false` 一律解释为永久不可装备：仓库或其他角色位置限制必须进入转移计划，当前异域唯一装备冲突必须交给组合求解；只有等级、未解锁、物品本身不可装备等无法由当前执行计划恢复的原因才排除。写请求受理后保持 `syncing`，轻量账号组件确认目标实例后再显示成功。
- 账号刷新诊断统一进入脱敏诊断导出，至少分开记录 OAuth、Membership、Profile、定义水合、快照构建、持久化和 IPC 总耗时，并统计 Session / Repository 的缓存命中、in-flight 复用、排队与持久化合并；诊断回调不得改变账号读取结果。
- 真实账号验收中，最近一次账号刷新 IPC 总耗时约 `580ms`，其中 Bungie Profile 约 `515ms`；定义水合、快照构建和持久化合计约 `100ms`，Repository in-flight 复用已实际命中。账号刷新性能判断应优先区分 Bungie 网络耗时与本地处理耗时，不再用前台重复完整 Profile 查询换取写后确认。
- 首页、资料库实时来源和账号 Session 共享 Bungie 请求 Broker；每日与每周通过同一次 `home:briefing` 获取，避免重复 membership、Profile 和里程碑请求。
- 首页简报使用运行缓存保存已解析数据，按每日重置、每周重置和仄商人出现/离开窗口分别判断是否需要访问 Bungie；应用重启后优先复用缓存，倒计时只在 renderer 本地重算，手动刷新可强制绕过周期缓存。
- 商人基础库存不再依赖商人菜单挂载。账号摘要准备后由顶层 workspace 后台预热当前角色库存；仄处于开放窗口时同时预热默认仄详情。主进程按账号、角色、详情范围和资料库版本合并并缓存请求，缓存到商人 `nextRefreshAt` 后失效，手动刷新强制重新读取。
- 脱敏诊断必须保留 Catalog、账号快照、首页简报的耗时、p95、payload 和进程内存信息；绝对性能预算只在专项本地诊断和 Release 环境判断，不写成依赖机器速度的普通 CI 断言。
- 切换菜单、卸载页面或重新进入页面不得中断资料库更新、应用更新下载等长任务；页面只订阅 `useBackgroundTasks` 和 `useManifestStatus` 等共享状态。
- 设置页负责详细管理入口：应用更新、资料库状态、后台任务、AI、备份迁移、诊断导出和操作日志；写操作由对应业务页面在用户确认后执行。
- 新增长任务优先进入 `packages/desktop/src/shared/backgroundTasks.ts`、`packages/desktop/src/main/backgroundTasks.ts` 和对应领域 IPC，不要把长任务生命周期藏在 renderer feature hook 中。

## 3. 本地开发

安装依赖：

```powershell
npx pnpm@9.15.0 install
```

Windows 日常开发桌面端时，直接双击：

```text
tools\win-dev-desktop.cmd
```

macOS 使用 Finder 双击：

```text
tools/mac-dev-desktop.command
```

也可以在终端直接使用根目录脚本：

```bash
pnpm dev:desktop
```

该命令实际调用根目录的 `scripts/dev-desktop.mjs`；Windows / macOS 双击入口也统一复用这个脚本。

它只在产物缺失或源码、配置、上游产物发生变化时构建过期层；Renderer、共享 App、UI 和 CSS 由 Vite 直接读取最新源码，不执行预构建。默认使用 `53172`，如果端口被其他程序占用，会在附近端口启动并把实际地址传给 Electron，不会杀掉无关进程。

需要强制重新构建时，可使用：

```bash
pnpm dev:desktop --force
pnpm dev:desktop --clean
pnpm dev:desktop --data-dir .local-data/dev-desktop
```

无法等待真实发布版本时，可用开发环境模拟更新状态验证顶部提示和设置页更新区。模拟只在 Vite 开发模式生效，不调用真实下载或安装流程：

```powershell
tools\win-dev-desktop.cmd -UpdateStatus idle
tools\win-dev-desktop.cmd -UpdateStatus checking
tools\win-dev-desktop.cmd -UpdateStatus available
tools\win-dev-desktop.cmd -UpdateStatus downloading
tools\win-dev-desktop.cmd -UpdateStatus downloaded
tools\win-dev-desktop.cmd -UpdateStatus error
tools\win-dev-desktop.cmd -UpdateStatus not_available
```

每次切换状态需要关闭当前桌面窗口并重新启动；默认不传 `-UpdateStatus` 时使用真实更新 IPC。

Windows 和 macOS 双击入口现在使用同一个 Node 启动器，避免两套增量判断逻辑漂移。

完整启动链路会：

1. 构建 `@d2-tools/core`、`@d2-tools/http`、`@d2-tools/services` 和 `@d2-tools/app`
2. 编译 Electron 主进程，并通过独立 Vite CJS 入口构建 preload
3. 启动 Vite 前端开发服务器，默认使用 `http://127.0.0.1:53172`；发生端口冲突时自动选择附近可用端口
4. 打开 Electron 开发版桌面应用

这不是打包流程，不会生成或解压 `release/win-unpacked`。渲染层改动支持热更新；主进程、preload、core、http 或 services 改动后，关闭桌面窗口并重新启动开发入口，脚本只重建受影响层。发布版不依赖开发端口；打包后的 Electron 会直接加载安装包内的 `dist/renderer/index.html`。

如果只想单独启动前端页面，Windows 可以双击 `tools/win-dev-web.cmd`，macOS 可以双击 `tools/mac-dev-web.command`。

需要确认视觉结构和规格交互时，查看 `docs/work/references/ui-specs/`，并直接预览共享 React UI。Web 默认端口为 `http://127.0.0.1:53171`；需要核对真实数据、IPC 和平台能力时使用 Desktop。通过对应平台的开发入口启动时，脚本会先清理对应固定端口上的残留监听进程，再重新启动当前 dev 服务。

正式 Web 入口使用：

```powershell
npx pnpm@9.15.0 dev:web
```

Web 是浏览器平台壳，也是共享 UI 的快速预览入口，不维护第二套页面。日常视觉与交互预览使用 Web，真实功能和最终验收使用 Desktop。

如果你已经手动启动了 Vite，并且只想单独启动 Electron 主进程：

```powershell
npx pnpm@9.15.0 dev:electron
```

### 3.1 维护者脚本

`tools/` 保存可提交、可跨设备复用的维护者脚本，不是普通玩家入口，也不保存 token、Cookie、浏览器 profile、缓存数据库或用户本地数据。详细清单见 [开发者工具说明](../tools/README.md)。

常用脚本：

- `tools/win-dev-desktop.cmd`：Windows 双击 Desktop 开发入口；调用统一 Node 增量启动器。
- `tools/win-dev-web.cmd`：Windows 双击 Web 开发入口，清理 `53171` 残留监听进程后启动 Web。
- `tools/mac-dev-desktop.command`：macOS Finder 双击 Desktop 开发入口，失败时保留终端窗口便于查看错误。
- `tools/mac-dev-web.command`：macOS Finder 双击 Web 开发入口，失败时保留终端窗口便于查看错误。
- `tools/mac-git-preflight.command`：macOS Finder 双击运行 Git 预检，不修改工作区。
- `tools/mac-git-commit-and-push.command`：macOS Finder 双击提交并 push 当前分支，不创建 release tag。
- `tools/mac-git-auto-release.command`：macOS Finder 双击执行完整 Release 门禁、提交、推送、tag 和 GitHub Release workflow。
- `tools/win-git-preflight.cmd`：Windows 双击运行 Git 预检，不修改工作区。
- `tools/win-git-commit-and-push.cmd`：Windows 双击提交并 push 当前分支，不创建 release tag。
- `tools/win-git-auto-release.cmd`：Windows 双击执行完整 Release 门禁、提交、推送、tag 和 GitHub Release workflow。

命名规则：平台入口使用 `mac-` / `win-` 前缀，macOS 可双击入口统一使用 `.command`，Windows 入口统一使用 `.cmd`；后续批量维护脚本优先使用 `maintenance-` 前缀。

## 4. 测试与检查

测试是 CI 和 Release 门禁，不是本地 vibecoding 循环的一部分。开发者只需描述业务目标，agent 自行定位菜单、领域和改动范围，不要求用户提供测试模板、命令或文件清单。

### 4.0 默认执行策略

| 用户意图 | 默认动作 | 自动化验证 |
|---|---|---|
| 开发 / 修改 / 优化 / 继续 | 直接实现当前功能切片 | 禁止自动运行测试、类型检查、构建、`verify:*` 和视觉脚本 |
| 完成 / 检查 / 验收 / 交接 | 只读复核改动，说明风险和未验证项 | 禁止自动运行本地验证 |
| 普通提交 | 按本次范围提交 | 禁止自动运行本地验证 |
| 普通 push | push 后结束，不等待 GitHub CI | GitHub CI 异步验证 |
| 发布 / release / 发版 | 使用对应平台的 Git Release 入口 | 必须等待本地门禁和 GitHub Release 全部成功 |
| 用户要求本地测试 / 检查 / 打包 | 运行现有测试或用户点名的命令 | 不自行新增测试用例或追加其他检查 |

允许为了人工体验启动 Web 或 Desktop；启动应用不等于通过测试，也不得在启动前机械追加 build、typecheck 或测试命令。Git 预检入口只负责只读识别改动 lane、高冲突文件和提交风险，不再推荐本地验证命令。

默认禁止新增测试。只有以下高风险场景允许增加最小行为测试：

- 严重且可复现的生产 Bug，需要证明回归能够被捕获。
- OAuth、认证和授权流程。
- IPC、preload 与主进程边界。
- 数据写入、迁移、删除和不可逆操作。
- 发布、版本、安装包和自动更新流程。
- 关键架构边界，且无法通过类型系统或模块结构直接约束。

允许新增的测试必须调用真实生产模块或渲染真实组件，断言稳定行为、导出、role / label 或 ViewModel 输出。禁止读取生产源码后匹配中文文案、变量名、import 顺序、HTML、class 或 CSS 片段。混合测试文件只保留真实行为部分，不保留源码字符串护栏。

### 4.1 CI 与 Release 门禁

普通 push 后，GitHub Actions 在 Windows runner 上异步执行：

1. `pnpm install --frozen-lockfile`
2. `pnpm test`
3. `pnpm typecheck:ci`

`pnpm test` 包含文档检查、全仓 build、行为测试、测试质量检查和架构测试。遗留源码测试层及其命令入口已经删除。

Release 必须从以下入口执行：

```powershell
tools\win-git-auto-release.cmd
```

脚本会在修改版本、commit、push 或 tag 之前执行 frozen install、`pnpm test` 和 `pnpm typecheck`，随后执行 Release 专属校验。任一步失败都要显示失败阶段和原始原因并等待确认，不得继续发布；本地门禁通过后还必须等待 GitHub Release workflow 成功。

底层 `test:*`、`typecheck:*`、`visual:*`、`check` 和 `verify:release` 命令保留给用户主动本地测试、本地打包、GitHub CI、Release 脚本和专项排查。agent 在日常开发中不自动调用，但用户要求测试、检查或打包时必须正常执行现有测试。仓库不再提供开发期 `verify:*` 别名，唯一保留的是 Release 专用 `verify:release`。

## 5. 打包

一键本地打包（安装依赖 + 测试 + 类型检查 + 打包，完成后自动打开产物目录）：

```powershell
powershell -File scripts/local-package.ps1
```

该脚本内部执行：

1. `pnpm install`
2. `pnpm test`
3. `pnpm typecheck`
4. `pnpm package:win`

本地打包会运行现有测试和类型检查，但 Agent 在普通开发过程中默认不新增测试用例，也不自动触发这条重链路。日常开发优先使用 `npx pnpm@9.15.0 dev:desktop`，不要为了看一次本地改动反复打包安装。

仅构建 Windows NSIS 安装器（跳过测试和类型检查）：

```powershell
npx pnpm@9.15.0 package:win
```

当前产物一般会落在：

```text
packages/desktop/release/
```

常见目录：

- `win-unpacked/`
- `d2-tools-setup-<version>.exe`
- `latest.yml`
- `d2-tools-setup-<version>.exe.blockmap`

## 6. 发布

当前发布主路径是 GitHub Release 自动打包 Windows NSIS 安装器，并上传自动更新元数据。

### 6.1 发版流程

使用对应平台的 Git Release 入口时，脚本按以下顺序执行：

1. 检查 Git、GitHub CLI、当前 Release 和目标 tag 状态。
2. 在修改发布文件之前执行本地 CI：`pnpm install --frozen-lockfile`、`pnpm test`、`pnpm typecheck`。
3. 任一 CI 步骤失败时停止流程，显示失败阶段和原始命令输出，并等待按键确认；此时不会 commit、push、打 tag 或触发 GitHub Release。
4. 发布前先在 `CHANGELOG.md` 写好双语 `## Unreleased` 段。CI 通过后脚本才提升该段并更新所有 `package.json` 版本号；重试当前失败版本时复用已有版本。
5. 运行 `pnpm verify:release` 和 Release Body 预览：
   ```powershell
   npx pnpm@9.15.0 release:preview --version x.y.z
   ```
6. 提交改动：
   ```powershell
   git add .
   git commit -m "release: prepare vX.Y.Z"
   ```
7. push 分支、创建或更新 tag，并推送 tag：
   ```powershell
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```
8. GitHub Release workflow 自动构建安装包、校验 CHANGELOG、生成 Release Body 并发布 GitHub Release。

### 6.2 注意事项

- 新版本 Release 必须有包含 `### 中文` 与 `### English` 且两种语言都有实际条目的 `## Unreleased` 段；脚本提升后，缺少双语正式版本章节会导致 Release 失败
- 只有 tag 名包含 `-beta` 或 `-rc` 时，GitHub Release 才会自动标记为 Pre-release，例如 `v0.0.8-beta.1`、`v1.0.0-rc.1`
- Release workflow 接受两类 tag：正式版 `vX.Y.Z`，或与当前包版本一致的预发布 tag（例如 `vX.Y.Z-beta.1`、`vX.Y.Z-rc.1`）
- Release Assets 当前包含 `d2-tools-setup-<version>.exe`、`latest.yml` 和安装器 blockmap
- Windows 代码签名不是发布前置条件；没有证书时仍可发布、自动下载并在下载完成后提示用户手动重启安装。若未来配置签名证书，electron-builder 可通过 `CSC_LINK` / `CSC_KEY_PASSWORD` 自动签名；workflow 始终校验 `latest.yml` 版本、安装器文件名和 blockmap 对应关系。

### 6.3 发布前检查

1. `pnpm install --frozen-lockfile` 通过
2. `test` 通过
3. `typecheck` 通过
4. `pnpm release:preview --version x.y.z` 输出符合预期
5. README 和核心文档没有明显失真
6. 版本号和 tag 一致

### 6.4 备份与恢复

桌面端使用本地数据目录保存配置、Manifest 缓存、愿望单、本地标签、旧目标规则、独立装备目标库和操作日志。配置采用独立的 `config_version`；升级时会先备份旧 `config.json`，将历史字段转换为当前格式并原子写回，随后按当前版本严格校验，不长期保留读取时兼容分支。迁移兼容旧 OAuth 回调地址、`ai.provider` 和历史缺失字段，不因配置字段演进阻断窗口启动。日常换机或重装优先使用设置页的便携备份：

1. 选择“创建便携备份”，指定一个可信的保存位置。
2. 便携备份包含脱敏偏好、愿望单、旧目标规则、独立装备目标库、本地标签、本地方案和本地社区推荐，不包含 OAuth token、Bungie/AI 密钥、Manifest、缓存或日志。旧版本攻略 JSON 仅作为遗留数据一并保留，不再参与应用运行。
3. 在目标电脑安装并首次启动 d2-tools，然后选择“恢复便携备份”。
4. 恢复前会校验备份格式、要求确认并创建本机回滚备份；写入失败时自动恢复原有数据。
5. 重启应用，重新登录 Bungie，并填写目标电脑需要的 Bungie/AI 密钥。

如果必须保留账号令牌，可以在完全关闭 d2-tools 后手动复制整个数据目录。Windows 默认目录来自 `%APPDATA%\d2-tools`，实际路径以设置页“本地数据目录”为准。完整数据目录包含账号令牌和密钥，只能保存在可信位置。

设置页同时提供“复制备份/迁移说明”和“复制脱敏诊断”。诊断导出不包含 token、client secret 或 API Key，可用于排查更新、配置、Manifest 和写操作问题。

## 7. 文档结构

当前只保留这些文档入口：

```text
README.md
CHANGELOG.md
docs/
  user-guide.md
  bungie-setup.md
  faq.md
  security.md
  todo.md
  development.md
  work/
    backlog/
    references/
```

不要把一次性设计稿、执行计划、阶段进度或临时分析文档放在 `docs/` 根目录。确实需要记录当前短期待办、验收状态、需求或 bug 时，统一更新 `docs/todo.md`；确实需要保留未完成设计或调研材料时，放进 `docs/work/backlog/` 或 `docs/work/references/`。仍作为实现依据的视觉与功能合同放在 `docs/work/references/`。外部流程如果要求写入 `docs/superpowers/`，本仓库统一改写到 `docs/work/backlog/` 或 `docs/work/references/`。确实需要记录长期规则或少量长期方向结论时，更新 `docs/development.md`；已发布变化写入 `CHANGELOG.md`。

本仓库不设 `docs/work/archive/`。已完成且仍有效的规则、架构边界或长期结论应合并进正式文档；只剩历史追溯价值或已经过时的过程材料直接删除，需要追溯时使用 git 历史。

`docs/work/` 不维护 README 索引，也不为每次讨论新建平行计划。当前任务入口只看 `docs/todo.md`，长期开发规则只看 `docs/development.md`；`docs/work/backlog/` 中只保留仍未完成或暂不推进的计划，`docs/work/references/` 中只保留仍能作为实现依据的外部资料、数据源调研或视觉基准。

当前仍有效的 reference 文件：

- `docs/work/references/destiny-tool-reference.md`：竞品能力和信息组织参考。
- `docs/work/references/equipment-detail-and-knowledge-analysis.md`：装备详情的功能规则与数据语义参考。
- `docs/work/references/desktop-framework-comparison.md`：桌面技术方案对比参考。
- `docs/work/references/2026-06-21-destiny2-weapon-sheet-analysis.md`：社区武器表和数据分析参考。

## 7.1 长期方向（简版）

这里只保留不适合写进 `todo.md` 的长期演进方向，不单独维护路线图文档：

- 多端架构：按 `core -> services -> app -> ui/product host -> 平台壳` 收口业务、服务、前端查询层、产品 UI 和端能力。Desktop、Web 和后续移动 App 都只提供平台 adapter，页面实现共享。
- 国际化：界面语言和 Bungie 资料库语言分开建模；默认资料库语言跟随界面语言，用户后续可在设置中独立调整。
- 仓库整理体验：继续增强同名对比、批量处理、护甲属性价值判断和评分解释。
- 今日 / 本周信息：优先补齐可确认的商人、遗失区域和轮换线索，保持“只展示可确认数据”。
- AI 助手：围绕真实账号数据问答、仓库建议、结果结构化和安全边界继续打磨。
- 活动与桌面体验：逐步补齐基础复盘、安装更新、备份恢复和诊断导出体验。

## 8. 文档维护原则

- 对用户的回答、可见思路摘要、计划、状态更新和仓库文档默认使用中文
- 任何用户可见内容都必须使用中文，包括 thinking/analysis 面板中展示的推理摘要、工具调用前后的状态说明、阶段性解释和最终回答；不要把用户可见的 thinking 内容视为隐藏推理
- 代码标识符、API 名称、文件路径、命令、包名和上游原文引用可保留原语言
- 读取或编辑中文文档时使用 UTF-8，避免 PowerShell 或本地默认编码导致乱码
- Windows PowerShell 查看中文文件时，先执行：
  ```powershell
  $OutputEncoding=[System.Text.Encoding]::UTF8
  [Console]::OutputEncoding=[System.Text.Encoding]::UTF8
  Get-Content -Encoding UTF8 path\to\file
  ```
- 不要把未指定 UTF-8 的 PowerShell 输出复制回源码或文档；中文文案改动优先使用 `apply_patch`，批量脚本必须显式指定 UTF-8。
- `pnpm docs:check` 会同时执行文档结构检查和编码检查，拦截非法 UTF-8、典型 mojibake、Unicode replacement character 和连续问号造成的信息丢失。
- README 只做入口，不塞太多细节
- 同一件事只保留一个权威文档
- 玩家文档优先讲“怎么做”
- `todo.md` 是唯一当前待办、短期进度、需求和 bug 来源
- 长期方向如确实需要保留，合并到 `docs/development.md`，不要再单独维护 `roadmap.md`
- `work/backlog/` 保存未完成但暂不推进的设计和计划
- `work/references/` 保存外部资料分析、数据源调研和作为实现依据的视觉与功能合同
- 不设 `work/archive/`；已完成且仍有效的内容合并进正式文档，过时或仅剩过程价值的材料直接删除
- 完成、取消或改变方向且影响当前短期待办、验收状态或优先级时，必须在同一次开发收尾时更新 `todo.md`
- 修复、确认无效或转为长期需求的 bug，必须在同一次开发收尾时更新 `todo.md` 对应条目
- `todo.md` 中的 `Bug #数字` 必须全局唯一；需要按领域区分时，在标题中加领域前缀，不要复用编号
- 设计/计划文档默认不作为正式入口；需要长期保留的结论应合并进正式文档
- `docs/work/` 只保留仍对当前工作有直接帮助的材料，不再额外维护索引文档
- 已完成或仅作历史追溯的过程材料直接删除，不再放入 archive 目录
- 本地临时日志、调试输出、pid / port / token 等运行态文件统一写到 `.local-data/tmp/`；不要把 `tmp-*`、`.tmp-*`、`*.err.log` 直接写到仓库根目录
