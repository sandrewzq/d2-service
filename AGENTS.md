# Agent 工作规则

这些规则适用于整个仓库。若本文件与 README、其他文档或本地习惯冲突，优先遵守本文件。

## 开始修改前

- 先阅读本文件，再检查 `docs/todo.md` 和 `docs/development.md`。
- 弱模型或上下文不足时，先运行当前平台的 Git 预检入口判断改动范围、当前验证策略和高冲突文件，再按下方“快速执行矩阵”行动。
- 不要删除用户已有工作或无关改动。
- 修改应小而聚焦，遵循当前 package 边界。

## 快速执行矩阵

后续 agent 默认按这个矩阵行动；拿不准时先只读检查，不要扩大改动范围。

| 改动类型 | 优先修改位置 | 自动验证策略 | 避免事项 |
|---|---|---|---|
| 文档、待办、README | `README.md`、`docs/`、`AGENTS.md` | Agent 默认不自动运行；用户要求时可本地检查 | 不重建 archive / superpowers 目录；不把阶段计划塞进 README |
| 维护者脚本、Git 辅助 | `tools/*.cmd`、必要时 `scripts/` | Agent 默认不自动运行；用户要求时可本地检查 | 不提交 token、Cookie、profile、缓存库；不把用户本地数据放进仓库 |
| 跨端 UI / Web | `packages/ui` 优先，`packages/web` 只做浏览器壳和 adapter | Agent 默认不自动运行；用户要求时可本地测试 | 不在 Web 或 Desktop 复制页面；不维护平行 HTML 原型 |
| Desktop 接线、IPC、preload | `packages/desktop/src/main/ipc/*`、`api/*Api.ts`、对应 feature | Agent 默认不自动运行；用户要求时可本地测试 | 尽量不碰 `api/client.ts`、`api/types.ts`、`ipc.ts` 等高冲突聚合文件 |
| 领域、服务、workspace | `packages/core`、`packages/services`、`packages/app` | Agent 默认不自动运行；用户要求时可本地测试 | 不跨层直接依赖平台能力；不要把业务真相写进平台壳 |
| 发布、版本、CHANGELOG | `CHANGELOG.md`、各 package 版本、release 脚本 | 只通过 `tools\win-git-auto-release.cmd` 或 `tools/mac-git-auto-release.command` 执行完整门禁 | 不手写不一致版本号；不在未确认 tag 时推 release |

Vibecoding 快路径：

- 用户只说“开发、修改、优化、继续做、完成、做完、检查、验收、交接、提交”时，agent 默认不自动运行测试、类型检查、构建、`verify:*` 或视觉脚本；用户明确说“本地测试”“运行测试”“本地打包”时正常执行。
- 本地可以启动应用人工体验，也可以按用户明确要求运行现有测试、类型检查、构建或打包；agent 不得自行追加未要求的验证。
- 普通 push 后由 GitHub CI 异步执行文档、构建、行为测试、架构测试、质量检查和类型检查；agent 报告 CI 链接后继续工作，不等待结果。
- 用户说“发布、release、发版”时，使用对应平台的 `win-git-auto-release.cmd` 或 `mac-git-auto-release.command`。脚本运行完整本地门禁，push tag 后必须等待 GitHub Release workflow 和安装包发布成功。
- 默认禁止新增测试文件。只有严重 Bug 回归、OAuth、IPC、数据写入、发布流程和关键架构边界允许新增测试；普通 UI、文案、CSS、按钮接线和简单页面功能不新增测试。
- 不执行本地 TDD 循环。需要新增高风险测试时只写入测试资产，首次执行交给 CI 或 Release；用户明确要求本地运行时例外。
- 测试断言优先检查稳定行为、导出、role / label 或 ViewModel 输出；禁止新增读取生产源码后匹配中文文案、变量名、import 顺序、HTML、class 或 CSS 片段的普通功能测试，`pnpm test:quality` 会直接拦截。
- `pnpm test` 可由用户主动本地测试、本地打包、CI 和 Release 调用，包含行为测试、测试质量检查和明确列入白名单的架构测试。仓库不再保留遗留源码测试层。
- 用户只需要描述业务目标，例如“开发商人菜单内的功能”“优化商人菜单的交互”。agent 必须自行识别菜单、改动类型和默认修改范围，不要求用户提供 Red / Green / Tidy 模板或精确文件清单。
- agent 生成计划时默认拆成短任务：`实现: <功能切片>`、`整理: <功能切片>`。不要默认创建测试或验证任务；CI 和 Release 验证不属于本地编码循环。

小参数模型工作约束：

- 先确认自己要改的文件属于上表哪一行；一次只处理一类改动。
- 优先使用已有脚本别名，不自行拼复杂命令。
- 发现无关脏文件时只记录，不回退、不格式化、不顺手修。
- 需要跨越两个以上 package 或触碰高冲突文件时，先说明影响范围再动手。
- 未运行本地自动化验证时，最终回答必须明确写“未运行本地自动化验证，由后续本地测试、CI 或 Release 负责”。只有拿到用户要求的本地测试、CI 或 Release 成功结果后才能声称对应检查通过。

## 并行开发边界

- 普通功能开发优先只改对应 `packages/desktop/src/renderer/features/<menu>/` 目录，避免一个菜单的改动影响其他菜单。
- 单个菜单私有目录改动默认不要求 worktree；例如一个 agent 只改 `features/account/`，另一个只改 `features/vault/`，且都不碰共享层时，可以在当前工作区轻量并行。
- 菜单私有目录和共享层改动默认不自动运行本地验证；用户要求本地测试时运行现有测试，否则 push 后由 CI 判断。
- worktree 是隔离复杂并行现场的工具，不是所有任务的默认要求。触碰 `packages/ui`、`packages/app`、`packages/desktop/src/renderer/shared/`、renderer API、主进程 IPC、release / 版本号 / CHANGELOG，或当前工作区已有多条无关脏改动时，才优先考虑 worktree 或暂停其他 agent。
- 多 agent 共用同一工作区时，提交前必须先运行对应平台的 Git 预检入口；如果输出多条 lane 或高冲突文件，不要使用全量 `git add -A` 提交脚本，除非确认这些改动都属于本次提交。
- 跨菜单复用能力必须先进入 `packages/desktop/src/renderer/shared/`，不要让 feature 之间直接 import。
- `shared/` 不能 import `features/`；跨菜单复用能力必须放在 `shared/` 或 `packages/ui`，不得通过菜单桥接文件间接依赖 feature。
- 新增 renderer API 契约时放到对应 `packages/desktop/src/renderer/api/*Api.ts`；跨领域 DTO 放到 `sharedTypes.ts`；不要把大型 DTO 塞回 `api/types.ts` 或 `api/client.ts`。
- `api/client.ts` 只做 Electron renderer 运行时绑定：声明 `window.d2` 并导出 `api`；类型从 `api/types.ts`、分域 API 或对应 transport contract 导入。
- 新增主进程 IPC handler 时放到对应 `packages/desktop/src/main/ipc/<domain>.ts`；`ipc.ts` 只做聚合注册。
- 新增用户可见文案时，优先沉淀到 `packages/ui/src/i18n/` 或对应领域 copy 文件；当前默认中文，不做语言切换 UI。
- 多人或多 agent 并行时，尽量避免同时修改 `HomePage.tsx`、`ItemDetailModal.tsx`、`useItemDetailWorkspace.ts`、`api/types.ts`、`api/client.ts`、`ipc.ts` 等公共接线文件；确需修改时先说明影响范围。

## 跨端 UI / Web 工作流

- UI 需求默认改 `packages/ui`，包括页面布局、组件结构、颜色、间距、状态样式、通用交互和跨端文案；不要只在 Desktop 或 Web 里重做一份页面。
- 全应用 UI 不再维护独立 HTML 原型。`packages/ui` 的共享实现是唯一产品页面，结构和交互约束记录在 `docs/work/references/ui-specs/` 的 Markdown 合同中。
- 全应用采用轻圆角合同：Shell、页面分栏、章节、目录、连续列表和表格保持直角；`status-matrix`、`summary-frame`、`state-frame` 使用 `4px`；独立装备、Offer、Perk 等 `object-card` 使用 `6px`；按钮、字段、分段控件和缩略图使用 `4px`；短标签、计数和进度使用胶囊。不得把所有 `frame` 统一映射为对象卡圆角，也不得由菜单 CSS 自行决定圆角。
- 现有 ViewModel、props、actions、adapter、IPC、真实数据、加载/空/失败状态和错误恢复是功能真相，必须完整保留；不得用 mock 数组、固定数量、示例状态、假 toast 或演示按钮替代真实能力。
- 不允许保留旧 DOM 后只替换颜色或补局部 CSS，也不允许使用 `presentation="archive"`、`Archive*Content`、`visualVariant` 等方式维护第二棵产品页面。每个菜单只能有唯一 `*ContentView`。
- UI 需求开始前先检查现有功能、真实字段/action、状态矩阵和对应 Markdown 合同；合同没有承载现有功能时，先更新合同并确认位置，不得自行隐藏或删除功能。
- UI 探索直接在 `packages/ui` 实现，由 Web 快速预览并由 Desktop 结合真实数据验收。确认后的结构、状态或跨菜单约束同步写入 Markdown 合同，不再维护平行 HTML 页面。
- `packages/web` 和 `packages/desktop` 是平台壳：只处理 Web / Electron 特有 adapter、登录态、IPC、本地文件、窗口、更新、端口和打包能力；页面实现应通过 `ProductShellHost` 和 `packages/ui` 共享。
- 新增或调整产品级外壳时，Web / Desktop 都应继续挂同一个 `ProductShellHost`。不得重新引入平台专用 shell wrapper，除非先更新本文件和 `docs/development.md` 说明新的边界。
- 改 `packages/ui` 后默认不新增测试，也不自动运行 UI 测试、消费者类型检查和视觉脚本；用户要求本地测试时正常运行现有检查，否则 push 后交给 CI。
- UI 验收以实际共享页面为对象，同时检查视觉完整度和功能零丢失。Web 用于快速预览共享 UI，Desktop 负责真实功能与最终实窗验收；用 mock 替代真实数据、隐藏旧功能或保留两套页面均不算完成。

### 多 agent 菜单 UI 默认边界

这些规则是仓库默认工作流，不需要用户每次在 prompt 里重复。任何 agent 接到“改某个菜单 UI / 页面”的任务时，必须先按这里判断改动范围。

- 菜单 agent 默认只改菜单内容层，不改共享 workspace chrome，不改 `.product-*` / `.shell-*` / token / Desktop 私有 CSS。
- 默认菜单范围：
  - 首页：`packages/ui/src/home/` + `.home-*`
  - 账号：`packages/ui/src/account/` + `.account-*`
  - 仓库：`packages/ui/src/vault/` + `.vault-*`
  - 配装：`packages/ui/src/loadouts/` + `.loadout-*`
  - 资料库：`packages/ui/src/library/` + `.library-*`
  - 商人：`packages/ui/src/vendors/` + `.vendor-*`
  - 设置：`packages/ui/src/settings/` + `.settings-*`
- 菜单 agent 可以改对应菜单目录下的 `*ContentView.tsx`、菜单专属组件、菜单专属 copy、菜单专属 ViewModel props，以及 `packages/ui/src/styles.css` 中对应菜单前缀的内容层规则。
- Web / Desktop 只允许为该菜单接 adapter、预览数据或真实数据回调；不得在平台壳复制页面结构。
- 遇到共享问题时，菜单 agent 不得私自改全局规则；必须先说明“需要共享改动”，由共享 / 集成 agent 修改 `ProductWorkspace`、token、全局样式或 shell。
- 需要升级为共享改动的情况包括：两个以上菜单需要同一种布局或组件；需要改页面标题区、页面级分栏、首层侧栏、首层 panel chrome、顶部状态条、AI 抽屉、后台任务 Dock；需要改 `ProductShellHost.tsx`、`ProductWorkspace.tsx`、`AppShell.tsx`、无菜单前缀的 CSS 规则或 token。
- 多 agent 并行时，首页菜单尽量最后集成；首页依赖账号、资料库、仓库、商人和配装摘要，其他菜单未稳定前不要让首页 agent 私自固化跨菜单数据结构。
- 菜单完成和多菜单合并后都不自动运行测试、类型检查或视觉脚本；需要体验时只启动应用人工检查，push 后交给 CI。

## 语言规则

- 对用户的回答、可见思路摘要、计划、状态更新和仓库文档使用中文。
- 任何用户可见内容都必须使用中文，包括 thinking/analysis 面板中展示的推理摘要、工具调用前后的状态说明、阶段性解释和最终回答；不要把用户可见的 thinking 内容视为隐藏推理。
- 代码标识符、API 名称、文件路径、命令、包名和上游原文引用，在保留原语言更清楚时可以不翻译。
- 读取或编辑中文文档时使用 UTF-8，避免 PowerShell 或本地默认编码导致乱码。
- 在 PowerShell 中查看中文文件前，先设置 `$OutputEncoding=[System.Text.Encoding]::UTF8; [Console]::OutputEncoding=[System.Text.Encoding]::UTF8`，并使用 `Get-Content -Encoding UTF8`。
- 不要把未指定 UTF-8 的 PowerShell 输出复制回文件；中文文案改动优先使用 `apply_patch`，批量脚本必须显式指定 UTF-8。
- 不输出隐藏推理链；需要解释时，用中文给出简洁的推理摘要。

## 文档规则

- `docs/todo.md` 是唯一当前短期待办、进度、需求和 bug 来源。
- `README.md` 只保留使用入口和正式文档导航，不承载阶段性进度或独立路线图。
- 如需保留少量长期方向结论，合并到 `docs/development.md`，不要再单独维护 `docs/roadmap.md`。
- `docs/work/backlog/` 保存未完成但暂不推进的设计或计划。
- `docs/work/references/` 保存外部资料分析、数据源调研和作为实现依据的视觉基准。
- 不设 `docs/work/archive/`。已完成且仍有效的结论合并进正式文档；只剩历史追溯价值或已过时的过程材料直接删除，需要追溯时使用 git 历史。
- 不要把日期命名、设计、计划、进度或分析文档直接放在 `docs/` 根目录。
- 不要重建 `docs/superpowers/`；如果外部流程要求写入该目录，统一改写到 `docs/work/backlog/` 或 `docs/work/references/`。
- `docs/work/` 不是正式入口目录；只保留仍对当前工作有直接参考价值的材料，历史已完成或已失效的内容可以删除。
- 删除任何文档前，必须确认它已经合并进正式文档，或明确没有剩余参考价值。
- 任务完成、取消或方向变化且影响当前短期待办、验收状态或优先级时，必须在同一次改动里更新 `docs/todo.md`。
- bug 修复、确认无效或转为长期需求时，必须在同一次改动里更新 `docs/todo.md` 对应条目。
- `docs/todo.md` 与 backlog 中的 `T数字`、`Bug #数字` 必须全局唯一；编号创建后冻结，不得因排序、拆分、合并或并行开发重新编号。需求拆分时使用新的未占用编号；当前任务表按任务编号升序排列，需要按领域区分时在标题中加领域前缀。
- 本地临时日志、调试输出、pid / port / token 等运行态文件统一写到 `.local-data/tmp/`；不要把 `tmp-*`、`.tmp-*`、`*.err.log` 直接写到仓库根目录。

## 验证规则

- 本地开发、完成、检查、验收、交接和普通提交阶段，agent 默认不自动运行验证；用户明确要求本地测试或执行具体命令时照常运行。
- 普通 push 触发 GitHub CI；agent 不等待 CI，除非用户明确要求查看结果。
- Release 必须使用对应平台的 `win-git-auto-release.cmd` 或 `mac-git-auto-release.command`，并等待本地门禁、GitHub Actions、安装包和 GitHub Release 全部成功。
- 用户明确要求运行某条本地验证命令时可以执行，但不得自行扩大到其他命令。
- 未获得用户要求的本地命令、CI 或 Release 成功证据时，最终回答只能说明代码改动状态，不得声称测试、构建或类型检查通过。
