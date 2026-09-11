# 更新日志

这个项目使用面向玩家的更新日志。这里优先记录”玩家能感知到什么变化”，而不是逐条展开内部实现细节。

## 0.0.25 - 2026-09-11

### 中文

#### 改进

- 仓库推荐来源支持人工来源与 DIM 同时选择，并按各来源条件叠加筛选；推荐来源区域在宽屏和窄屏下保持稳定布局。
- 仓库武器卡片保留锻造状态展示，普通武器不显示额外状态；强化状态暂不纳入本版本。
- 账号任务、光等提升路线和本周刷取页面继续使用真实账号数据，并补齐状态、来源和失败边界。

#### 修复

- 修复推荐筛选条件拥挤时的换行和右侧无效留白。
- 修复武器详情锻造图层使用非语义层级值的问题。

### English

#### Improved

- Vault recommendation filters now allow curated sources and DIM to be selected together, combining each source's conditions while keeping the source panel responsive.
- Vault weapon cards retain crafted-state display while ordinary weapons remain unmarked; enhanced-state display is deferred for a later release.
- Account pursuits, power progression, and weekly farming views continue to use real account data with clearer status, source, and failure boundaries.

#### Fixed

- Fixed cramped recommendation filter wrapping and unused space beside the source list.
- Fixed non-semantic layer values used by weapon detail crafting overlays.

## 0.0.24 - 2026-09-09

### 中文

#### 改进

- DIM 配装导入改为只接受包含配装数据的完整链接并在本地解析，不再访问 DIM 分享接口；`dim.gg` 短链接会提示改用完整链接。
- Windows 安装包新增项目许可证和桌面运行时第三方许可证清单，安装向导与应用设置页均可查看。
- AI 首次启用、旧配置升级、备份恢复或更换服务地址后需要明确确认数据发送范围；提示内容已移除账号、角色和装备实例等非必要标识。

### English

#### Improved

- DIM loadout import now accepts only self-contained links and parses them locally without calling the DIM share API; `dim.gg` short links now prompt users to provide a full link.
- Windows packages now include the project license and a desktop runtime third-party notice bundle, available from both the installer and the in-app Settings page.
- AI data sharing now requires explicit confirmation on first use, legacy migration, backup restore, or service endpoint changes, while prompts omit unnecessary account, character, and item identifiers.

## 0.0.23 - 2026-09-08

### 中文

#### 改进

- 移除 light.gg 专用实时分析、设置开关和运行缓存；单件装备仍可在用户主动允许时使用通用 AI 外部知识查询。
- 旧版本配置会自动转换为当前格式，并清理已停用的 light.gg 缓存，不要求玩家手动修改配置。

### English

#### Improved

- Removed the dedicated light.gg live-analysis source, settings, and runtime cache while retaining opt-in generic AI web research for individual items.
- Legacy configurations are migrated automatically and retired light.gg cache data is cleaned without manual user changes.

## 0.0.22 - 2026-09-07

### 中文

#### 改进

- 首页、账号、仓库、商人、设置和装备详情中的手动刷新、同步与失败重试统一为带图标的绿色刷新控件，和登录、保存、应用等蓝色主要操作明确区分。
- 输入框、下拉框、分段筛选和操作按钮使用不同的结构与表面；仓库搜索补充搜索图标，推荐来源与重置条件数量更容易辨认。
- 补齐亮色与暗色主题下的刷新、输入和下拉控件 token，使两种颜色模式保持一致的层级与交互反馈。

#### 修复

- 修复部分刷新按钮颜色与其他页面不一致，以及输入框、下拉框和按钮外观过于相似的问题。

### English

#### Improved

- Unified manual refresh, synchronization, and retry actions across Home, Account, Vault, Vendors, Settings, and item details with icon-led green refresh controls, clearly separating them from blue login, save, and apply actions.
- Gave text fields, selects, segmented filters, and action buttons distinct structures and surfaces, while adding a search icon and clearer source and reset counts to Vault filters.
- Added matching light- and dark-theme tokens for refresh controls, fields, and selects so both color modes retain consistent hierarchy and interaction feedback.

#### Fixed

- Fixed inconsistent refresh-button colors and controls that were difficult to distinguish because fields, selects, and buttons shared nearly identical styling.

## 0.0.21 - 2026-09-06

### 中文

#### 改进

- 仓库工作台收敛为“浏览装备、看推荐、整理同名”三步流程，简化普通玩家不常用或重复的筛选项，并统一推荐来源、匹配结果和数量展示。
- 武器卡片与详情统一显示推荐来源、Perk 1 / Perk 2 核心符合度和完整 Roll 符合度；推荐 Perk 同时保留图标和名称，命中项更加醒目。
- 移除独立攻略库和个人知识入口，攻略内容统一进入配装流程，武器详情减少重复信息与不必要的后台读取。
- 仓库宽屏布局固定页面标题与工作流区域，左侧筛选和右侧装备结果可独立滚动，并保留三个工作区各自的滚动位置。

#### 修复

- 修复约千件装备的仓库在切换推荐来源、连续滚动或后台同步时引发整个应用卡顿的问题。
- 写后确认成功时改为只提交对应装备的轻量结果；只有异常终态才合并执行完整账号刷新，位置或锁定变化不再重算全部推荐。
- 恢复前台定时同步与回到应用后的补同步，并区分普通快照过期和写操作确认延迟，避免状态栏过早显示“游戏数据延迟”。
- 修复武器详情中未选中、跨版本推荐和大师属性图标缺失，以及仓库卡片、推荐列表和详情状态描述不一致的问题。

### English

#### Improved

- Consolidated the Vault workbench into Browse, Recommendations, and Same-name Cleanup, removed low-value duplicate filters, and unified source, result, and count presentation.
- Unified weapon cards and details around recommendation sources, Perk 1 / Perk 2 core matches, and full-roll matches, while keeping both icons and names and emphasizing matched perks.
- Removed the standalone Guides library and personal-knowledge entry points, routed guide content through Loadouts, and reduced duplicate detail content and unnecessary background reads.
- Fixed the Vault title and workflow area on wide screens, gave filters and equipment results independent scrolling, and retained scroll positions for each workspace.

#### Fixed

- Fixed application-wide lag while switching recommendation sources, continuously scrolling inventories of roughly one thousand items, or synchronizing account data in the background.
- Changed successful post-write confirmation to commit only the affected item; full account refreshes are now coalesced for exceptional outcomes, and location or lock changes no longer recompute every recommendation.
- Restored periodic foreground synchronization and catch-up synchronization after returning to the app, while separating stale snapshots from delayed write confirmation states.
- Fixed missing icons for unselected, cross-version, and masterwork recommendations, and standardized recommendation wording across Vault cards, lists, and weapon details.

## 0.0.20 - 2026-09-06

### 中文

#### 改进

- 仓库推荐筛选改为先选推荐来源、再选该来源的匹配结果，数量会随其他筛选条件联动，并减少大型仓库切换筛选时的重复计算。
- 武器详情的推荐组合改为更紧凑的图标、Perk 名称和状态展示，同时保留本件拥有、跨版本候选、大师属性和完整推荐证据。

#### 修复

- 修复转移、装备和配装写入成功后，账号、仓库、配装与首页可能被相同或更旧的 Bungie Profile 回滚，导致装备一会出现、一会消失或与游戏不一致的问题。
- 写入成功后会立即显示预计位置并持续展示待确认进度；实例暂时缺失或游戏数据尚未更新时保留当前结果，只有更新后的 Profile 明确冲突才撤销。
- 修复后台已经确认单件装备，但完整同步尚未追上时又被旧快照覆盖的问题；逐实例确认现在会建立版本屏障，并在最终权威快照完成后统一收口。

### English

#### Improved

- Changed Vault recommendation filters to select a source first and then that source's match result, with condition-aware counts and less repeated work in large inventories.
- Made weapon-detail recommendation combinations more compact with perk icons, names, and states while preserving owned-roll, cross-version, masterwork, and full evidence details.

#### Fixed

- Fixed successful transfers, equips, and loadout writes being rolled back across Account, Vault, Loadouts, and Home by equal or older Bungie profiles, which could make items appear, disappear, or disagree with the game.
- Successful writes now show their projected locations immediately and keep visible confirmation progress; temporarily missing items or unchanged game data no longer erase the projected result, and only a newer explicit conflict reverts it.
- Fixed per-item confirmations being overwritten before the full account snapshot caught up by retaining a version barrier until the final authoritative refresh completes.

## 0.0.19 - 2026-09-05

### 中文

#### 新增

- 仓库武器卡新增推荐命中筛选、单件加锁和取出到当前角色，并在清理前保护推荐、收藏、配装和其他重要装备。
- 推荐数据管理支持查看来源状态、导入简化武器表、按来源管理规则，并为无法验证的旧推荐库提供明确隔离提示。

#### 改进

- 账号、仓库、配装、首页和设置统一使用“同步装备数据”，一次同步会从 Bungie 读取角色装备、背包、仓库和配装的同一份真实快照。
- 武器详情改为先显示账号快照中的真实实例信息，再按需读取完整定义、Roll 和推荐证据；同一实例的详情请求支持范围隔离、去重与写后强制刷新。
- 武器推荐统一使用官方栏位和严格匹配语义，补充来源、核心 Roll、逐栏命中状态、缓存版本和完整包导入诊断。
- 资料库更新可复用兼容的中英文 SQLite 与搜索索引，减少重复下载和切换期间的不可用时间。

#### 修复

- 修复应用内写操作已经成功、游戏与其他电脑已变化，但当前页面仍被旧 Profile、旧缓存或并发请求覆盖的问题。
- 修复批量装备与单件装备状态不一致、写后确认提示卡住，以及刷新成功但页面内容没有真正采用最新快照的问题。
- 修复仓库推荐缓存未随数据源变化失效、完整 Roll 被误判为未读取，以及不同页面使用不同推荐状态描述的问题。

### English

#### Added

- Added recommendation filtering, per-item locking, and transfer-to-current-character actions to Vault weapon cards, with cleanup protection for recommended, favorited, loadout, and other important items.
- Added recommendation-source status, simplified weapon-table imports, per-source rule management, and explicit isolation for unverifiable legacy recommendation databases.

#### Improved

- Unified Account, Vault, Loadouts, Home, and Settings around one “Sync equipment data” action that reads equipped items, character inventories, Vault, and loadouts from the same Bungie profile snapshot.
- Changed weapon details to render real snapshot data first and load full definitions, rolls, and recommendation evidence on demand, with scoped request deduplication and forced post-write refreshes.
- Standardized weapon recommendations around official slot names and strict matching semantics, with source evidence, core rolls, per-slot states, cache revisions, and full-package import diagnostics.
- Reused compatible Chinese and English Manifest databases and search indexes to reduce repeated downloads and downtime during activation.

#### Fixed

- Fixed successful game writes being hidden or overwritten by stale profiles, caches, or concurrent requests in the current application window.
- Fixed inconsistent batch-versus-single equip state, write-confirmation messages that never completed, and refreshes that reported success without accepting the latest snapshot.
- Fixed stale Vault recommendation caches, complete rolls being shown as unread, and inconsistent recommendation-state wording across pages.

## 0.0.18 - 2026-09-03

### 中文

#### 改进

- 旧版本配置升级时会自动转换为当前格式并保留迁移备份，减少更新后无法启动或配置丢失的问题。
- 设置页补充数据来源与鸣谢入口，侧栏支持展开 / 紧凑显示并统一亮色与暗色主题表现。

#### 修复

- 修复旧版本更新后应用进程已启动但窗口未显示的问题。

### English

#### Improved

- Migrated legacy configuration files to the current format with a migration backup, reducing startup failures and configuration loss after updates.
- Added a visible sources and credits section to Settings, and improved the sidebar's expanded / compact behavior across light and dark themes.

#### Fixed

- Fixed the application window not appearing after updating from an older version even though the process had started.

## 0.0.17 - 2026-09-03

### 中文

#### 工程

- 清理已完成且不再推进的外部能力草案，保留正式文档中的有效规则与工具参考。

### English

#### Engineering

- Removed completed, deferred external-capability notes while keeping the valid rules and tool references in the formal documentation.

## 0.0.16 - 2026-08-30

### 中文

#### 新增

- 应用更新链路支持未签名 Windows 安装包发布、自动下载和手动重启安装，并保留 GitHub Releases 与国内镜像回退入口。
- 配装工作台补充逐部位属性模组规则、自动配甲、迁移计划和穿戴前复核，减少玩家手动调整装备的步骤。
- 武器和护甲详情支持当前装备、资料库版本、商人售卖等不同对象的独立信息展示。

#### 改进

- 首页本周活动只展示 Bungie 明确确认的轮换突袭和轮换地牢，不再把固定周常奖励或常驻活动混入轮换结果。
- 首页轮换活动会合并所有角色的实时活动数据，避免因角色顺序漏掉守望者尖塔或其他有效挑战。
- 账号、仓库、配装、资料库、商人和设置继续统一使用共享产品界面与亮暗色主题。

#### 修复

- 修复首页活动缓存使用旧解析结果的问题；活动数据模型更新后会自动失效旧缓存并重新获取。
- 修复多角色突袭和地牢挑战只读取首个角色，导致轮换活动显示不完整的问题。

### English

#### Added

- Added unsigned Windows package publishing, automatic downloads, and manual restart installation, with GitHub Releases and domestic mirror fallback support.
- Expanded the Loadouts workbench with slot-aware armor mod rules, automatic armor selection, migration plans, and pre-equip review.
- Added independent context summaries for currently equipped, Library, and Vendor weapon and armor details.

#### Improved

- Home now shows only Bungie-confirmed rotating raids and dungeons, keeping fixed weekly rewards and persistent activities out of rotation cards.
- Rotating activity detection now merges live activity data from every character so valid challenges are not lost because of character order.
- Account, Vault, Loadouts, Library, Vendors, and Settings continue to share the same product UI and light/dark theme.

#### Fixed

- Invalidated stale Home activity caches whenever the activity parsing model changes.
- Fixed incomplete raid and dungeon rotation results caused by reading only the first character's activity state.

## 0.0.15 - 2026-08-04

### 中文

#### 新增

- 配装工作台新增本地方案编辑、DIM 链接导入、护甲组合求解与分步执行，可在角色和本地方案之间集中管理配装。
- 仓库新增护甲套装目录、持有数量筛选、同名装备整理矩阵与更完整的保护信号，支持更精细地筛选和暂存整理操作。

#### 改进

- 统一仓库、资料库、账号、配装和商人中的弹药、伤害属性与勇士克制图标，并优化大量装备图标跨页面复用时的加载体验。
- 装备详情改为分阶段加载并保留有界缓存，统一武器与护甲的入口、当前位置、发布版本和追溯信息，减少重复打开时的等待和重复字段。
- 资料库和商人来源信息现在更清楚地区分历史来源、当前获取入口、购买资格和发布版本；同图样复刻武器不再被错误合并。

#### 修复

- 修复装备后角色光等不刷新、详情锁定状态错误、特殊武器 Roll 列错位，以及仓库筛选切换卡顿等问题。
- 修复新增 Manifest 物品常量定义后测试契约与生命周期计数未同步、UI 静态合同漏登记共享表面、菜单样式未使用语义 token，以及武器详情可写插件缺少明确类型守卫，导致 CI 持续失败的问题。

#### 工程

- 移除独立 Prototype 产品页面和过期过程文档，Web 与 Desktop 继续复用同一套共享产品 UI、状态模型和视觉合同。

### English

#### Added

- Added local loadout plan editing, DIM link import, armor combination solving, and staged execution to the Loadouts workbench.
- Added the armor set catalog, owned-count filtering, same-name organization matrix, and richer protection signals to Vault workflows.

#### Improved

- Unified ammo, damage, and Champion counter icons across Vault, Library, Account, Loadouts, and Vendors, with better cross-page reuse for game asset images.
- Changed item details to staged loading with a bounded cache, while unifying entry context, location, release version, and trace information for weapons and armor.
- Clarified historical sources, current acquisition paths, purchase eligibility, and release versions in Library and Vendors; reissued weapons sharing a pattern are no longer merged incorrectly.

#### Fixed

- Fixed stale character power after equipping, incorrect lock state in item details, misplaced roll columns for special weapon layouts, and lag when switching Vault filters.
- Fixed CI failures caused by stale Manifest contracts, a missing shared surface in the UI checker, Vault styles bypassing semantic tokens, and missing type narrowing for writable weapon plugs.

#### Engineering

- Removed the standalone Prototype product pages and obsolete process documents so Web and Desktop continue to share one product UI, state model, and visual contract.

## 0.0.14 - 2026-07-24

### 中文

#### 新增

- 新增统一的武器与护甲详情工作区：可查看来源、Perk、属性、同名装备与可执行操作，并从仓库、资料库和商人入口直接打开。
- 首页仄商人模块支持展示完整八件异域轮换商品，并可直接打开对应装备详情。

#### 改进

- 首页、账号、仓库、配装、资料库、商人和设置页统一采用共享产品界面与响应式视觉规格，Prototype、Web 和 Desktop 保持同一页面结构。
- 商人页补齐地点、商品分类、时效和装备详情入口；仄按周六到访、周三离场的窗口过滤过期库存。
- 资料库运行时继续收口为 SQLite 查询与后台任务，减少大资料读取对桌面首屏和主进程的影响。

#### 修复

- 修复装备详情首次打开时的加载衔接、真实写入后的状态刷新，以及商人和首页之间的库存详情跳转。
- 修复跨角色库存、同名装备比较和轮换活动在共享页面中的信息缺失或重复展示。

#### 工程

- 清理未接入的旧 Desktop 页面、仓库桥接层和过期首页缓存，收口 Core 与 Services 的运行时边界。

### English

#### Added

- Added a unified weapon and armor detail workspace with sources, perks, stats, same-name items, and available actions, available directly from Vault, Library, and Vendors.
- Added the full eight-item Xur Exotic rotation to Home, with direct links to each item detail.

#### Improved

- Unified Home, Account, Vault, Loadouts, Library, Vendors, and Settings around the shared product UI and responsive visual specification across Prototype, Web, and Desktop.
- Expanded Vendors with location, offer grouping, availability windows, and item-detail entry points; Xur now filters expired inventory using the Saturday-arrival and Wednesday-departure window.
- Continued the Game Data runtime migration to SQLite queries and background tasks to reduce large data reads on the Desktop startup path and main process.

#### Fixed

- Fixed first-open detail loading, state refresh after real item writes, and inventory-detail navigation between Vendors and Home.
- Fixed missing or duplicated information for cross-character inventory, same-name comparison, and rotating activities in shared pages.

#### Engineering

- Removed unused legacy Desktop pages, Vault bridge layers, and the obsolete Home cache while tightening the Core and Services runtime boundary.

## 0.0.13 - 2026-07-10

### 中文

#### 新增

- 首页新增独立的每周活动简报，展示宗师先锋警戒、轮换突袭、轮换地牢和仄商人等重点信息，不再从每日摘要中猜测周常内容。
- 遗失区域简报补充目的地、勇士、护盾、威胁、专家单人奖励和大师单人奖励，并保留最多 9 个可读世界遗失区域。
- 资料库同名装备结果新增已核验版本、官方来源提示和当前公开渠道，帮助区分复刻、赛季及当前可获取状态。

#### 改进

- 桌面窗口默认尺寸调整为 1920×1080，首次打开即可获得更完整的工作区视野。
- 首页、账号、仓库、配装、资料库、商人和设置页统一通过共享 ViewModel 输出；Prototype 与 Web 的 mock 数据迁入 FixtureRuntime，减少多端页面分叉。
- 资料库装备定义详情重新整理信息密度，移除无法可靠帮助判断版本的重复提示、Perk 列数和实例级噪音。

#### 修复

- 修复 Prototype / Web 可能把 Node 本地模块打进浏览器包的问题，避免启动时报 `node:path`、`node:fs` externalized 相关错误。
- 修复 Bungie 公共里程碑只有一条遗失区域时覆盖完整世界遗失区域列表的问题。
- 修复需求变化后旧源码字符串断言误拦截 CI 和 Release 的问题；最高光等操作反馈改由真实共享 UI 渲染测试覆盖。
- 发布脚本现在会在 commit、push 和 tag 前运行与 GitHub 一致的本地门禁，失败时保留完整原因并等待确认，不再推送已知无法发布的代码。

#### 工程

- 测试拆分为行为、架构和遗留三层。行为与架构测试阻断发布，59 个旧源码字符串测试只报告；质量门禁禁止继续新增匹配变量名、class、HTML 或 CSS 的普通功能测试。
- `@d2-tools/services` 根入口恢复为浏览器安全入口；本地配置、OAuth callback、token store、Manifest cache 等 Node-only adapter 只能通过明确 subpath 在 Desktop 主进程或 worker 中使用。
- 新增跨端包边界、renderer 隔离、发布契约和测试质量护栏；本地发布脚本、GitHub CI 与 Release workflow 使用同一套测试和类型检查门禁。

### English

#### Added

- Added a dedicated weekly activity briefing for Grandmaster alerts, rotating raids, rotating dungeons, and Xur instead of inferring weekly data from the daily summary.
- Expanded Lost Sector briefings with destination, champions, shields, threat, solo Legend rewards, solo Master rewards, and up to nine readable world Lost Sectors.
- Added verified release information, official source hints, and current public availability to same-name Library results.

#### Improved

- Changed the default desktop window size to 1920×1080 for a fuller workspace on first launch.
- Routed Home, Account, Vault, Loadouts, Library, Vendors, and Settings through shared ViewModels, while moving Prototype and Web mock data into FixtureRuntime modules.
- Simplified Library definition details by removing duplicated version hints, unreliable perk-column metadata, and instance-only noise.

#### Fixed

- Fixed Prototype and Web builds accidentally pulling Node-only modules into browser bundles, preventing `node:path` and `node:fs` externalization errors at startup.
- Fixed a single Bungie milestone Lost Sector from replacing the complete world Lost Sector list.
- Fixed stale source-string assertions blocking CI and Release after requirements changed; highest-power action feedback is now covered by a real shared UI rendering test.
- Updated the release script to run the same local gate as GitHub before commit, push, or tag creation, preserving the full failure reason and waiting for confirmation when validation fails.

#### Engineering

- Split tests into behavior, architecture, and legacy layers. Behavior and architecture tests block releases, while 59 legacy source-string test files are reported separately; a quality gate prevents new tests from matching implementation names, classes, HTML, or CSS.
- Restored a browser-safe `@d2-tools/services` root entry and moved Node-only configuration, OAuth, token storage, and Manifest cache adapters behind explicit Desktop-only subpaths.
- Added cross-platform package, renderer isolation, release contract, and test-quality guards. Local release, GitHub CI, and the Release workflow now use the same test and typecheck gates.

## 0.0.12 - 2026-07-06

### 工程

- chore: sync local changes
- chore: sync local changes
- chore: sync local changes
- chore: sync local changes

## 0.0.11 - 2026-07-03

### 工程

- chore: sync local changes
- chore: sync local changes
- chore: sync local changes
- chore: sync local changes
- chore: sync local changes
- chore: sync local changes
- feat: localize prototype shell fallback views
- test: sync i18n wiring assertions
- chore: sync local changes
- feat: localize shared home fallback data
- feat: localize shared library and loadouts pages
- feat: localize shared account and settings pages

## 0.0.10 - 2026-07-01

### 改进

- 桌面首页和设置中心按新原型继续收口，状态、账号、资料库、更新、备份和诊断入口更集中。
- 新增可复用的首页视觉对比脚本，方便发布前检查亮色和暗色模式一致性。

### 修复

- 修复桌面端每次打开停留在“正在启动 d2-tools...”数秒的问题：启动状态不再解析大型 Manifest 定义文件，也不再在启动阶段刷新 Bungie token。
- 启动状态读取失败时会显示可重试错误，不再一直停留在启动页。

### 工程

- 补充启动状态轻量检查和 OAuth 启动状态测试，防止后续把大型资料库解析重新放回启动路径。

## 0.0.9 - 2026-06-30

### 新增

- 小日向与 d2-skill 产品级能力第一阶段：攻略解析、账号命中、perk 证据和配装草稿
- 桌面 UI 设计系统 v2：语义 token 统一、亮暗色收口、AI 抽屉滚动隔离
- 新增后台任务中心：资料库更新和账号读取迁到 worker，避免阻塞 Electron 主线程
- 新增窗口 IPC 和主题同步：亮暗色模式切换通过窗口 IPC 同步到标题栏和滚动条

### 改进

- 首页、账号页、仓库页、设置页完成 HTML 原型级一致性迁移
- 账号页背包槽位改为首屏限量渲染并 lazy-load 图标
- 仓库搜索结果不截断，默认渲染 200 件
- 亮色模式全局补齐：覆盖首页、账号装备、仓库筛选与卡片、配装比较、资料库等区域
- 按钮/Tab/选中态颜色语义统一：新增 action/selected token

### 修复

- Bungie 登录端口占用时增加中文处理建议
- 亮色模式标题栏控制区和滚动条同步
- 仓库选中态改为深色高对比

### 工程

- 新增桌面端产品级视觉回归测试
- 架构维护：page metadata 共享、详情缓存上限、Manifest 状态共享、services adapter 去重

## 0.0.8 - 2026-06-25

### 修复

- 修复桌面端开发环境黑屏问题：账号 workspace hook 恢复正确的 React 状态导入，窗口启动后可正常渲染页面
- 补齐 app/services 桌面桥接实现，恢复活动摘要与社区命中能力在新分层下的类型对齐
- 修复仓库页本地导入草稿状态与 loadout lookup 类型接线，避免重构收尾阶段的渲染/类型回退

### 工程

- 新增最小 GitHub Actions CI，自动执行安装、测试和类型检查
- 新增 `.editorconfig`、`.gitattributes` 和源码衍生产物忽略规则，减少换行与误提交噪音
- 补齐开源仓库外围文件：`CONTRIBUTING.md`、`LICENSE`、`SECURITY.md`、`SUPPORT.md` 与 Issue 模板

## 0.0.7 - 2026-06-25

### 新增

- 遗失区域改为 Manifest 静态数据 + 每日轮换推算，不再依赖公共里程碑 API（修复 Bug #5）
- 新增 Manifest perk 库查询，武器目标规则支持从全量沙盒 perk 库选择
- 新增活动复盘增强：按 8 种类型分组（突袭/地牢/打击/PvP/智谋/赛季/遗失区域/其他）、完成率统计、连续完成计数
- 新增多端架构基础包（`packages/app`、`packages/services`），第一阶段骨架落地
- 新增 UI 样式规范 v1 文档

### 改进

- 商人售卖解析增强：五大关键商人（老九/枪匠/艾达/圣人/拉乎尔）各自角色标签和出现时间说明
- 仓库类型系统修复：`VaultArmorStatRule.min` 改为 number 类型
- `collectAccountItems` 去重提取为共享工具函数
- Renderer 层 API/组件/features 重构
- 样式系统继续扩展

### 文档

- 新增 `.editorconfig`、`.gitattributes`、`CONTRIBUTING.md`、`LICENSE`、`SECURITY.md`、`SUPPORT.md`

## 0.0.6 - 2026-06-23

### 新增

- 新增护甲属性筛选面板，支持按 Mobility/Resilience/Recovery/Discipline/Intellect/Strength 筛选
- 装备详情新增工具操作区（ItemDetailTools）

### 改进

- AI 配置协议重构，支持多平台 API 格式
- 装备详情面板 UI 重构为游戏风格布局
- 仓库筛选工具栏优化，筛选逻辑简化
- AI 分析面板和 AI 设置面板交互优化
- 样式系统大幅扩展

### 修复

- 修复 release workflow action 版本问题
- 修复 CI 中 latest.yml 依赖问题

## 0.0.5 - 2026-06-22

### 移除

- 删除本地评分系统：装备不再显示分值，仓库整理仅依赖玩家手动标签和实际属性数据
- 移除仓库筛选中的"推荐"和"评分"下拉框
- 移除装备详情中的评分分解面板（加分项/扣分项/评分原因/风险提示）
- 移除 AI 提示中的本地评分数据

### 新增

- 社区 Perk 推荐支持本地导入（CSV/JSON 格式），可导入自定义推荐表
- 社区推荐增加来源标签区分：DIM 愿望单、AI light.gg、本地社区表
- 新增 AGENTS.md 定义 Agent 工作规则
- 新增文档策略自动检查脚本（`pnpm docs:check`）

### 改进

- README 参考方向大幅扩展：新增 D2ArmorPicker、Destiny Recipes、Bray.tech、Destiny Sets、D2 Gunsmith 5 个参考工具，每个工具均列出完整能力描述
- 仓库分类逻辑优化
- AI light.gg 查询失败时增加降级提示
- IPC 模块按功能域拆分（account/vault/manifest/ai/loadout/wishlist/daily）
- 桌面端代码按 features/shared 重构目录结构

### 文档

- 文档结构重组：superpowers 目录迁移至 work/ 归档

## 0.0.4 - 2026-06-20

- 账号页自动读取已登录账号，登录失效时提示重新登录
- 角色使用 tab 切换，当前装备和背包合并显示并按 Destiny 位置分组
- 一键装备最高光等，可从角色、背包和仓库里选出最高光等组合
- 仓库支持按主分类、位置、弹药、锁定状态、标签和评分筛选
- DIM 风格仓库整理：同名装备对比、重复组建议、清理清单、游戏内定位提示
- 清理模式支持批量解锁和批量转移到角色背包
- 本地 loadout 模板和转移计划
- 今日 / 本周摘要面板
- 活动摘要和基础 Raid / Dungeon 统计
- AI 聊天式助手，支持基于已载入账号数据做自定义分析
- AI 配置支持 OpenAI Responses、OpenAI Chat Completions 和 Anthropic Claude
- 诊断导出、工具审计日志和写操作日志
- GitHub Release 自动打包 Windows NSIS 安装器并上传自动更新元数据（`latest.yml` / `.blockmap`）

### 改进

- d2-skill 只作为功能和安全思路参考，不照抄 CLI 形态
- AI 输出继续保持“事实 / 分析 / 建议 / 操作提醒”分区
- 今日 / 本周面板只展示 Bungie API 或本地资料库能确认的内容，不猜测
- 仓库重复组交互继续向 DIM 靠近，增强了候选选择和行内保留操作
- 文档结构重组，入口更清楚、重复更少

### 安全

- 写操作默认关闭，需要 Bungie Scope、本地开关和确认流程
- AI 不读取、也不发送 token、Client Secret 或 API Key
- d2-tools 不直接分解装备，最终分解仍需进游戏手动完成
- 诊断导出会自动脱敏

## 0.0.3 - 2026-06-19

### 新增

- 初步公开测试版本
- 账号、仓库、资料库、AI 助手和设置页基础可用
- 仓库标签、备注、单件装备详情和基础 AI 分析
- GitHub Release 自动打包 Windows NSIS 安装器

### 修复

- 修复打包后空白窗口问题
- 修复 GitHub Actions 中 workspace 包解析和 release 附件问题

## 0.0.2 - 2026-06-19

### 新增

- Windows NSIS 安装器发布流程
- Bungie OAuth、Manifest 初始化和基础资料库搜索

## 0.0.1 - 2026-06-18

### 新增

- 项目初始版本
- Electron + React + TypeScript 桌面客户端骨架
- 本地配置、健康检查和基础启动状态
