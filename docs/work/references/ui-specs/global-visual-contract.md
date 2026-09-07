# 全局视觉合同

> 适用范围：`packages/ui` 共享产品 UI，以及 Web、Desktop 的最终渲染结果。

## 真相与所有权

- `packages/ui` 的共享页面决定视觉结构和最终表现；产品 ViewModel、actions、adapter、IPC 和状态决定真实功能。
- `packages/ui/src/styles/` 的 foundation、shell、workspace 和 components 分片负责公共 token、文字、控件、共享表面、状态、焦点、滚动条和层级。
- 菜单样式只负责对应领域布局、结构和响应式差异，不重复公共配方。
- 产品视觉只在 `packages/ui` 实现。Web 和 Desktop 不维护第二套页面或平台专属视觉修补。
- 一个视觉职责只能有一个所有者。发现父子重复边框、页面 CSS 覆盖公共配方或同一 token 多处定义时，先删除冲突来源。

## 稳定语义

共享产品组件使用以下稳定标记：

| 标记 | 用途 |
|---|---|
| `data-contract-root="product-workspace|detail-dossier"` | 产品合同根与页面级状态 |
| `data-surface="page|section|frame|workspace-frame|object-card|list|row|split|content-stack|empty|menu|dialog|drawer"` | 表面和布局职责 |
| `data-ui-kind` | 共享组件类型，如 Shell、导航、按钮、字段、对象卡、状态矩阵和弹层 |
| `data-callout-tone="info|ai"` | 非业务状态 Callout 的信息或 AI 色条语义 |
| `data-contract-id` | 跨规格与产品页面稳定定位，不参与业务判断 |
| `data-ui-part="label|value|detail|state|source|action"` | 组件内部信息槽位 |
| `data-text-tone="primary|body|meta|action|countdown|status"` | 文字颜色语义 |
| `data-info-priority="display|metric|decision|context|reading|support|trace"` | 信息权重与排版 |
| `data-value-kind="fact|countdown|status"` | 区分事实值、动态倒计时与状态词 |
| `data-status="neutral|pending|success|warning|error"` | 业务状态 |

按钮额外使用：

- `data-control-variant="primary|secondary|danger|ai|quiet"`
- `data-control-size="compact|standard|prominent"`
- `data-control-width="content|uniform"`
- `data-control-shape="text|icon"`

当前、展开、忙碌和禁用分别使用原生 `aria-current`、`aria-expanded`、`aria-busy`、`disabled` 或 `aria-disabled`，不得只靠 class 或颜色表达。

## 表面配方

| 配方 | 典型对象 | 边框与圆角 | 禁止事项 |
|---|---|---|---|
| `ShellChrome` | 顶部栏、侧栏、页头 | 连续结构线，直角 | 包成浮动卡片 |
| `PrimaryNavigation` | 一级菜单、嵌入目录 | 连续行与单线分隔；当前项使用导航背景和定位指示 | 每项独立卡片或业务色条 |
| `ContextSwitcher` | 角色、账号、当前对象 | 控件外框，当前项使用选择背景和 `1px` 内描边 | 当成页面导航、使用方向指示线或拆成独立按钮卡 |
| `SegmentedControl` | 同层模式切换 | 整体一圈控件边框，内部单线分隔 | 每项完整外框、文件夹 Tab |
| `PageSection` | 页面章节 | 只画必要章节分隔，直角 | 页面 section 卡片化 |
| `WorkspaceFrame` | 状态条与两栏、三栏工作区的页面级宿主 | 使用 `border-control` 绘制唯一一圈直角外边界 | 缺少左右边界、使用对象卡圆角或让子分栏重复外框 |
| `WorkspaceSplit` | `WorkspaceFrame` 内部的两栏、三栏工作区 | 自身无完整框并继承宿主边界；相邻栏位只有一条分隔线 | 外框和栏位双重边线 |
| `SurfaceList` | 目录、台账、连续结果 | 父级拥有一次外边界或继承栏位边界；行只画底部分隔 | 每行圆角卡片 |
| `SurfaceFrame` | 状态矩阵、摘要、独立空态 | `4px` 轻圆角和唯一外框，内部单元直角 | 嵌套首层卡片或使用对象卡圆角 |
| `ObjectCard` | 装备、Offer、Perk、能力 | `6px` 圆角和唯一对象边框 | 用于页面、目录或普通数据行 |
| `Callout` | 信息、警告、失败、AI 提示 | 使用 `data-ui-kind="callout"` 获得中性对象边框和左侧语义色条 | 导航、Tab、对象卡复用色条；菜单或普通组件自行声明粗左边线 |

页面级可见边界只分为 `ShellLine`、`WorkspaceOutline`、`SplitLine`、`RowLine` 和 `ObjectOutline`。`WorkspaceOutline` 由 `WorkspaceFrame` 使用 `border-control` 绘制；同一条边只能由一个 DOM 层绘制。

页面级未配置、未登录、未初始化和空结果状态使用共享 `ProductWorkspaceEmptyState` 的 `product-workspace-empty--page` 标记：内容垂直居中，状态徽标、标题、说明和唯一主操作居中排列，按钮按内容宽度显示。局部列表或分栏内空态不得套用页面级高度，避免撑开目录、工具栏或详情头。


粗左侧或 `inline-start` 语义色条只由 foundation 中的共享 `Callout` 配方持有。业务状态使用 `data-status="pending|success|warning|error"`，普通信息与 AI 提示使用 `data-callout-tone="info|ai"`；菜单和普通组件 CSS 不得直接声明宽度大于 `1px` 的 `border-left` 或 `border-inline-start`。

## 尺寸与响应式

- 页面布局与结构间距使用 `4 / 8 / 12 / 16 / 20 / 24 / 32px`；紧凑控件内部允许使用 `6 / 10px`，不得把这两个数值扩散为页面 section、栏位或卡片间距。
- 结构面直角；状态矩阵、摘要和状态框 `4px`；按钮、字段、分段控件、缩略图和图标容器 `4px`；对象卡 `6px`；短标签、计数和进度使用胶囊。
- 控件高度：紧凑 `30px`、标准 `34px`、主要入口 `40px`。文本命令默认 `34px`，图标按钮默认 `34px × 34px`。
- 角色上下文切换器有两种密度：工具栏中的紧凑模式使用 `34px`；需要同时承载职业、光等或快照说明的丰富模式可使用 `54px` 复合行。两种密度必须共享同一选中态，不得因高度不同分别发明边线方向。
- 设置和诊断等重复操作列使用 `144px` 文本按钮；普通命令栏按内容自适应。
- 全局验收宽度为 `1280 / 980 / 760px`。装备详情在 `1360px` 增加实例栏转 Drawer 的领域断点。
- 菜单内容响应式由 `.product-workspace-page` 提供的命名容器 `product-workspace` 决定，不直接依赖整窗宽度；上述三档窗口在标准侧栏下约对应 `1120 / 920 / 700px` 内容宽度。AI 助手宽屏停靠后，菜单必须按剩余内容宽度提前重排。全屏 Dialog、Drawer 和视口安全区仍使用视口媒体查询。
- Shell 顶栏默认 `52px`；`760px` 及以下可重排为两行，但总高度仍由共享 Shell token 决定。侧栏、品牌轨道、页面 gutter 和页头高度只由共享 Shell token 决定。
- 页面宽度类型：账号装备和仓库为 `fluid-workspace`；设置阅读区为 `constrained-content`；首页、资料库和商人为 `hybrid-workspace`。
- 响应式优先重排网格、换行操作区和转为单列，不缩小关键文字，不建立水平滚动轨道。

## 颜色、边框与当前状态

- 蓝色表达导航、当前对象、通用主要操作、可跳转操作以及仍在等待完整数据的状态；绿色表达成功、可用、明确符合，以及带刷新图标的手动刷新或失败恢复操作；黄色表达警告、部分符合或接近目标；红色表达真实危险、失败或明确不符合。共享 `Primary` 默认使用操作蓝，刷新与重新读取使用独立绿色 `control-refresh-*` 配方，不能仅靠文案碰巧继承 Primary；成功徽标和符合结果不得伪装成按钮。推荐 Roll 等只读对照中的红色只能用于低强度状态点、结果文字和淡色底板，不能复用危险按钮表面，也不能暗示系统要求分解。紫色只用于 AI；珊瑚红时间强调色只表达动态倒计时，并与错误红使用不同 token 和色值。
- Shell、章节、对象和控件分别使用对应语义边界 token，不使用弱边界代替强边界。
- 导航当前状态、对象选择、角色上下文和分段控件必须使用正确的结构与 ARIA 语义，但允许共享 `state-selected-*` token。组件差异优先由布局、图标和交互语义表达，不为每一类状态自行发明新的边线方向。
- `hover`、`current`、`focus-visible`、`disabled` 和 `loading` 必须可同时区分。焦点环至少 `2px`，相对相邻表面达到 `3:1`。
- 容器的 `data-status` 可以影响边框、图标或背景，但不得把日期、版本、数量、名称等事实值一起染成状态色。
- 推荐、目标和事实对照必须同时保留结论文字；颜色只能强化“明确符合 / 部分符合 / 明确不符 / 中性未要求 / 数据未完整读取”，不得独立承担判断。批量列表使用小状态点和结果文字，详情可以增加淡色状态底板，但不得给整张装备卡涂满状态色。
- 浅色与深色必须使用同一套语义 selector，仅替换 token；菜单不得新增主题专属硬编码颜色。
- 输入框、下拉框、分段筛选和操作按钮必须具备不同的结构识别：输入框使用内凹底色、弱边框和输入提示；单选下拉使用更明确的边框、独立箭头区和右侧分隔线；分段筛选整组只绘制一个外框与内部单线；操作按钮使用居中的动词文字、较高字重和对应操作表面。不得再用相同底色、相同完整边框和无箭头矩形同时表达四种控件。
- 伤害属性、弹药类型和反勇士属于游戏事实色，不复用导航或业务状态含义。全应用使用共享战斗图标容器：伤害属性和反勇士使用 Manifest 官方图标，弹药类型固定使用集中维护的一格、两格、三格符号，不读取武器详情中的非标准图片；图标置于对应属性的实色底座上，标签使用同源的边框、文字与低饱和背景。筛选未选中时保留弱语义色，选中时增强边框和底色。颜色不能单独承担识别，必须同时保留图标与文字。

选中态使用以下稳定映射：

| 状态类型 | 交互语义 | 视觉规则 |
|---|---|---|
| Shell 导航当前项 | `aria-current` 或产品导航 active state | `nav-current-bg / fg` 加左侧 `3px nav-current-indicator`；方向线只属于纵向导航。 |
| 连续列表对象 | `aria-pressed` 或 selected object | 使用 `state-selected-bg`；需要强化边界时使用 `1px state-selected-border` 内描边，不增加左、右、上或下方向线。 |
| 角色上下文 | `role="group"` 加单选按钮 `aria-pressed` | 使用 `state-selected-bg` 加 `1px state-selected-border` 内描边；紧凑与丰富模式保持一致，不使用底部指示线。 |
| 分段控件 / Tab | 单选筛选的 `aria-pressed`，或完整 `tablist / tab / tabpanel` | 使用 `state-selected-bg / fg`，不增加方向线；外框与内部间隔线由控件组统一绘制。 |

- 内描边使用 `box-shadow: inset 0 0 0 1px var(--state-selected-border)`，避免改变控件尺寸和相邻分隔线位置。
- `focus-visible` 是独立状态，不能用选中描边代替；选中且聚焦时两者必须同时可辨认。
- 菜单私有 CSS 不得直接使用 `blue`、`accent-primary` 或导航 indicator 代替 `state-selected-border`。

## 文字与信息权重

`Tone` 决定颜色，`Priority` 决定字号、字重和行高，两者不得混用。

| Priority | 排版 | 用途 |
|---|---|---|
| `display` | 页面 `24px/700`，章节 `18px/700` | 页面名、章节名、装备身份 |
| `metric` | `20px/700` | 单独呈现的关键数值 |
| `decision` | `16px/600` | 时间、奖励、成本、可用性、缺失和操作结果 |
| `context` | `15px/600` | 账号、角色、对象、活动、商人和方案名称 |
| `reading` | `14px/400` | 说明、属性、字段值和错误恢复 |
| `support` | `13px/400-600` | 标签、影响范围和辅助状态 |
| `trace` | `12px/400` | 来源、快照、版本和技术追溯 |

- 最小可见字号为 `12px`，字重只使用 `400 / 600 / 700`，字距为 `0`。
- 页面说明、错误原因和恢复路径至少使用 `reading + body`，不得降为 `trace + meta`。
- 日期、版本、数量、名称和 ID 是事实值；只有明确状态词使用 `status` tone。
- 截断只用于不可避免的单行对象名，并提供完整 tooltip、详情入口或可换行布局。
- 普通正文相对实际背景至少达到 `4.5:1`；交互边界和焦点相对相邻表面至少达到 `3:1`。

## 时间合同

| 类型 | 数据 | 显示 |
|---|---|---|
| 绝对时间点 | UTC ISO 8601 | 渲染时转换到当前系统时区 |
| 日期值 | `YYYY-MM-DD` 或结构化日期 | `YYYY/MM/DD`，不做时区转换 |
| 周期边界 | UTC 规则与下一个时间点 | 动态生成当地日期、星期和时间 |
| 时长 | 目标时间减当前时间 | 动态计算，不保存会过期文案 |

完整时间使用 `YYYY/MM/DD HH:mm:ss`，普通列表使用 `YYYY/MM/DD HH:mm`，Shell 紧凑时间今天使用 `HH:mm`、非今天使用 `MM/DD HH:mm`。动态倒计时统一使用 `countdown` tone 和 `--time-accent`，绝对更新时间仍使用普通事实值颜色。不得写死 `Asia/Shanghai`、地域时区名或预格式化相对时间。

## 导航与控件

- 页面或章节定位使用链接/按钮和 `aria-current`，不使用 Tab role。
- 互斥内容使用完整 `tablist / tab / tabpanel`，提供 `aria-controls`、`aria-labelledby`、方向键、Home 和 End。
- 单选筛选使用按钮组和 `aria-pressed`，不伪装为导航或 Tab。
- Primary、Secondary、Danger、AI 和 Quiet 只改变颜色语义，不改变按钮盒模型。Primary 使用蓝色实底并表达操作组唯一核心动作；Secondary 使用中性底和明确操作边框；Quiet 使用透明或弱底色且不与普通字段争夺注意力。输入框和下拉框使用 `field-border`，其静止边框必须弱于 Secondary 的操作边框，聚焦后再使用共享焦点环。
- Primary 表达当前页面或局部状态中高频且承担核心职责的唯一主操作，不按动作名称全局固定；自动机制已覆盖的常规刷新使用 Secondary，读取失败且恢复动作成为唯一出口时可在所属 Callout 内临时升为 Primary。重复对象卡中的常规快捷操作不得批量铺设 Primary：推荐动作使用 Secondary，辅助动作使用 Quiet。
- 同一操作组最多一个 Primary。低频维护动作不得与高频核心动作并列同权；主要动作位于操作组末端。内容空态或错误区已提供同一主恢复入口时，页头不重复该操作；进行中保持原标签与尺寸并使用 `aria-busy`。
- 后台自动同步与用户手动操作必须使用独立忙碌状态。后台请求可以显示邻近状态，但不得借用手动按钮的 `disabled` 或 `aria-busy`；只有防止重复提交同一手动操作时才临时禁用按钮。
- 禁用控件保留可读标签和紧邻原因；加载控件保留目标与进行中反馈，不提前显示成功。
- 图标按钮必须有 tooltip 和可访问名称。产品使用同一套 Lucide 线性图标语言。

## 状态矩阵

产品页面与对应 Markdown 合同都必须覆盖：正常、加载、空、失败、部分可用、禁用和进行中。

| 状态 | 展示要求 |
|---|---|
| 正常 | 展示当前确认数据和可用操作 |
| 加载 | 保留稳定尺寸和主要导航，不以过期数据冒充当前结果 |
| 空 | 保留查询、切换、刷新或创建入口 |
| 失败 | 标明失败范围、原因和恢复入口 |
| 部分可用 | 展示已确认内容，并单独标记缺失范围 |
| 禁用 | 保留只读内容，并在控件附近说明原因 |
| 进行中 | 保留当前事实，展示目标和进度，成功后再更新结果 |

页面级状态写在产品合同根 `data-state`；业务状态写在具体组件或槽位的 `data-status`。页面必须绑定真实 ViewModel 状态，不使用静态演示状态冒充运行结果。

## Overlay、Drawer 与层级

- Dialog 必须具有 `role="dialog"`、`aria-modal="true"`、标题关联、焦点限制、`Escape`、统一关闭路径和焦点恢复。
- Drawer 必须有标题、关闭按钮、遮罩、`Escape` 和焦点恢复；打开时背景不可操作。
- AI 助手在宽度大于 `980px` 时是停靠辅助栏；`980px` 及以下才是覆盖式 Drawer。
- Popover 在失焦、`Escape` 或触发器再次点击时关闭；Toast 不抢焦点，普通结果使用 `role="status"`。
- 页面级层级只使用语义 token：base、sticky、popover、drawer-scrim、drawer、modal、toast。孤立组件内部为处理前后覆盖允许使用 `0 / 1`，不得用其他数字建立新的全局层级。

## 滚动与溢出

- 产品页面只允许纵向滚动，不允许水平滚动条；不得用 `overflow-x: hidden` 掩盖超宽布局。
- 同一列最多只有一个纵向滚动容器。普通菜单由主内容区滚动，长目录可拥有独立纵向滚动，弹层内容使用 `overscroll-behavior: contain`。
- 小屏分栏改为纵向堆叠，不改成水平轨道。
- 滚动容器使用 `data-scroll-region="page|pane|overlay"` 标记所有权。

## 实施与验收

1. 先确认当前共享页面结构、最终计算样式和对应 Markdown 合同，再修改产品 UI。
2. 建立页面区域到真实字段、actions 和状态的绑定，不复制 mock 业务逻辑。
3. 删除冲突旧 DOM、旧 CSS 和兼容分支，再实现共享语义；不得追加高优先级覆盖。
4. Web 用于快速预览共享 React UI 和浏览器平台接线，Desktop 实窗作为真实功能的最终验收对象。
5. 在 `light / dark × 1280 / 980 / 760` 下检查边框所有权、布局、文字、图标、控件状态、焦点、滚动和零横向溢出。
6. 未完成 Desktop 对照前，任务状态只能是“待视觉验收”。
7. `pnpm ui:contract:check` 负责拦截废弃根标记、未登记表面、非法字号和字重、页面级数字层级、菜单主题硬编码颜色、选中态方向线及私有粗左侧边线。
