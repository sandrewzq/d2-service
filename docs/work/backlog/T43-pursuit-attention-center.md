# T43：任务待处理中心

> 状态：📝 需求已细化，待排期
> 优先级：P1
> 类型：账号任务资源 + 只读待处理摘要
> 账号菜单合同：[应用工作区账号章节](../references/ui-specs/application-workspaces.md#账号)
> 关联需求：T42 提供光等事实；T44 可以消费 T43 的任务状态，但不反向改变 T43 的分类和状态

## 1. 一句话说明

让玩家打开应用就能知道：当前三个角色有哪些任务、赏金或赛季目标正在进行，哪些已经完成但还没处理，哪些快过期，以及它们在哪个角色。

T43 回答“现在有哪些事情要处理”，不回答“做哪个最能提高光等”。

## 2. 当前实现为什么不满足需求

账号页目前已经有“任务与赏金”目录和分组外壳，但它不能作为 T43 的实现基线：

- `packages/app/src/workspaces/accountPage.ts` 的 `getAccountTaskKind` 通过中文/英文名称关键词分类；改名、翻译、缺少名称或同名物品都会造成误分类。
- 任务区只遍历当前角色的 `equipped_items`、`inventory_items` 和 `postmaster_items`，没有读取其他角色的角色进度和里程碑。
- 现有 `item_objectives` 主要是装备详情和催化剂的 Objective 摘要，不等于完整的任务/赏金/赛季任务模型。
- 现有 Profile 类型没有完整承载任务需要的 `expirationDate`、`itemValueVisibility`、角色里程碑和任务链定义字段。
- 当前快照组件没有 `CharacterProgressions`（202）等任务资源所需组件；把任务组件直接塞进装备首屏会放大刷新 payload 和延迟。

因此本需求包含“真实数据链 + 派生状态 + 页面呈现”，不是只改文案或 CSS。

## 3. 玩家价值与可感知结果

玩家能直接感知到以下变化：

1. 不需要逐个进入游戏角色检查任务，账号页能看到三个角色的待处理总览。
2. 已完成但尚未领取/确认的项目会排在最前面，避免漏奖励。
3. 快过期赏金会显示明确的剩余时间和所属角色。
4. 追踪中的任务会有稳定的“已追踪”标识；同一个任务从一个角色切换到另一个角色时不会混淆。
5. 刷新时玩家能看到“任务数据同步中 / 已确认时间 / 部分不可用”，不会把旧列表误认为新事实。

空账号或没有可展示任务时，页面显示“没有读取到可处理任务”，并说明是“确认没有任务”还是“任务数据尚未返回”，不能用示例任务填充。

## 4. 数据事实与来源

### 4.1 角色任务物品（主来源）

从中央 `AccountSession` 的独立任务资源读取每个角色的 `characterInventories`，重点保留：

- `itemHash`、`itemInstanceId`、`bucketHash`、`state`、`quantity`。
- `ItemObjectives`（Profile component 301）中的 `objectiveHash`、`progress`、`completionValue`、`complete`、`visible`。
- 任务物品返回的 `expirationDate` 和奖励可见性（`itemValueVisibility`，若 Bungie 返回）。
- Manifest `DestinyInventoryItemDefinition` 中的稳定关系：
  - 任务容器：`bucketTypeHash = 1345459588`（Quests）。
  - 分类依据：`itemCategoryHashes`（Quest、QuestStep、Bounties、RepeatableBounties、SeasonalArtifacts 等）。
  - 任务链：`objectives.questlineItemHash`、`setData.questLineName`、`setData.itemList`。
  - 奖励：`value.itemValue`，并按 `itemValueVisibility` 过滤。
  - 到期语义：`inventory.suppressExpirationWhenObjectivesComplete`、`inventory.expiredInActivityMessage`。

分类必须先使用稳定 Hash/definition 关系，再使用名称作为展示文本。名称关键词只能用于人工显示或诊断，不能决定业务类别。

### 4.2 角色进度与活动里程碑（补充来源）

需要独立请求 `CharacterProgressions`（202），必要时组合 `CharacterActivities`（204），读取：

- 每个角色的 `milestones`、`availableQuests`、活动 challenges 和 Objective。
- 里程碑的 `startDate`、`endDate`、`order`、活动/任务 Hash。
- 任务当前是否 `tracked`、是否 `completed`、是否 `redeemed`、是否 `started`。

这类数据用于展示没有真实背包物品、但玩家仍有待完成/待领取状态的任务、周常和角色活动目标。它不能被伪装成角色背包物品，也不能重复计入物品任务。

### 4.3 记录与赛季挑战（受控补充）

需要复用已有 `ProfileRecords`（900）结构，仅在能通过 Manifest Record 定义明确识别为赛季挑战或任务记录时纳入 T43。首期不把全部成就树、收藏品和催化剂记录搬入任务中心。

如果当前 Profile 没有足够字段区分“已完成待领取”和“仅历史完成”，状态必须标为“已完成状态已知，领取状态无法确认”，不得推断为可领取。

## 5. 统一领域模型（建议）

建立独立的 `AccountPursuitResource`，不要把完整任务数据扩展进 `AccountSnapshot` 首屏 DTO。每条任务统一成：

- `id`：稳定身份，优先 `characterId + itemInstanceId`；里程碑/记录使用 `characterId + milestoneHash` 或 `recordHash`。
- `kind`：`quest`、`bounty`、`seasonal`、`milestone`、`unknown`。
- `characterId` / `className`。
- `name`、`icon`、`typeLabel`。
- `source`：活动、商人、赛季或任务链的 Hash/显示名称；无法确认时显示“来源未确认”。
- `objectives[]`：原始进度、完成值、完成标记、可见标记和 Manifest 进度说明。
- `completionState`：`in_progress`、`completed_pending_action`、`completed_confirmed`、`expired`、`unknown`。
- `trackedState`：`tracked`、`untracked`、`not_supported`、`unknown`。
- `expiration`：服务器时间、是否已过期、剩余秒数；没有服务器字段就为 `unknown`。
- `rewardRefs[]`：只保存可确认的奖励 Hash/数量，不把奖励价值直接算成光等提升。
- `sourceKind`：`inventory_item`、`character_milestone`、`record`。
- `observedAt`、`profileMintedAt`、`dataState`。

任务资源必须保留原始来源和状态证据，方便后续 T44 使用，也方便解释“为什么这样显示”。

## 6. 状态与优先级规则

### 6.1 状态判定

- `completed_pending_action`：Bungie 明确返回完成，且存在可领取/可兑换/可继续处理语义；如果只知道完成、不知道领取状态，使用“完成状态已知，领取状态待确认”。
- `in_progress`：至少有一个可见 Objective 未完成，且任务未过期。
- `expired`：服务器 `expirationDate/endDate` 已过当前时间，且定义没有“完成后抑制过期”规则；完成后抑制规则必须按 Manifest 字段计算。
- `completed_confirmed`：已完成且服务器明确返回已兑换/已领取/已结束；默认折叠到历史，不作为待处理数量。
- `unknown`：必要字段缺失、隐私限制、组件失败或定义未准备好。

任何字段缺失都进入 `unknown` 或“部分数据”，不能用名称、固定百分比、本地时间猜测补齐。

### 6.2 展示顺序

完整清单固定按以下顺序排序，排序必须确定性一致：

1. 已完成待处理 / 完成状态待确认。
2. 即将过期（默认剩余不超过 24 小时；阈值作为产品常量记录，不依据名称变化）。
3. 当前追踪。
4. 其他进行中。
5. 已过期和已确认完成（默认折叠，可展开查看原因）。

同一组内按服务器到期时间、角色顺序、来源 Hash、实例 ID 排序，不按本地化名称排序。

“待处理数量”只统计前两组和明确的完成状态待确认项目；不能用任务总数冒充待处理数量。

## 7. 刷新、缓存和失败边界

- 任务资源复用中央账号 Session、Profile Request Broker、账号刷新事件和账号身份，不建立账号页私有缓存、私有轮询或第二套刷新按钮。
- 任务资源独立缓存、独立 `loading / stale / partial / error / synced` 状态；不阻塞装备、容量、仓库和邮政官首屏。
- 初始进入账号页可先显示账号快照，再异步加载任务资源；进入任务分区时若尚未准备好，显示明确的任务同步阶段。
- 手动账号刷新完成前，任务区保留上一份已确认列表并显示“任务数据同步中”；只有新任务资源确认后才替换旧列表。
- 装备/转移写操作成功后，不做整页重载；若写操作影响任务位置或完成状态，仅触发任务资源的受控重读，并等待新的 Profile 时间戳或明确状态前进。
- 任务资源失败时，账号页其他分区保持可用；任务区显示失败原因、上次确认时间和“重试任务同步”入口。
- 组件缺失、Manifest 未初始化或定义未命中时，显示“任务分类/进度暂不可确认”，不能退回名称关键词分类。
- 持久化只保存最后确认的任务资源和数据时间，不保存 Token、Cookie、完整 Profile 或未确认的乐观任务状态。

## 8. 页面设计与玩家感知

### 8.1 账号页

沿用现有账号目录的“任务与赏金”Tab，不在目录上新增动态数字徽章，避免把普通任务总量制造成虚假优先级。页面内容分三层：

1. 顶部待处理摘要：
   - `2 项已完成待处理`
   - `1 项 24 小时内过期`
   - `3 项正在追踪`
   - 右侧显示“数据时间 / 同步中 / 部分可用”等状态。
2. 固定分组列表：已完成待处理、即将过期、正在追踪、其他进行中、已过期/已确认完成。
3. 每行显示图标、名称、角色、来源、进度、状态、剩余时间和数据来源；任务/非装备保持紧凑只读行，不做装备卡，不提供假“领取”按钮。

点击任务只打开只读详情或定位到对应角色/来源；首期不做自动领取、自动删除、自动转移和任务攻略百科。

### 8.2 首页

首页只消费压缩摘要，不复制完整清单：

- 无待处理：显示“任务状态已确认，无待处理项目”。
- 有待处理：显示数量和最多 3 条最高优先级事项，点击进入账号页任务分区。
- 任务资源加载中或失败：显示真实状态，不显示 0，也不隐藏整个首页。

### 8.3 响应式与可访问性

- 使用现有账号工作区的锚点和容器，不用固定像素定位；宽屏连续列表，窄屏单列。
- 状态同时使用文字、图标/边界和 `aria-label`，不能只靠颜色区分完成、过期和未知。
- 列表采用稳定键盘焦点顺序；任务只读行不进入装备卡专用左右网格导航。
- 加载、部分失败和旧数据状态保留页面骨架，不能用整页遮罩清空旧内容。

## 9. 实现拆分

建议按以下切片排期：

1. **数据契约**：扩展 Bungie Profile 类型和 Definition 字段，确认 201/301/202/204/900 的最小组件集合。
2. **领域转换**：在 `packages/core` 新增任务分类、Objective 汇总、到期计算、任务链和去重纯函数；禁止名称关键词作为分类真相。
3. **独立资源**：在 `packages/services` 接入中央 Session、请求合并、缓存和失败状态；任务资源不进入装备快照阻塞链。
4. **跨端 ViewModel**：在 `packages/app` 输出任务摘要、分组、状态矩阵和首页压缩摘要。
5. **账号 UI**：在 `packages/ui/src/account/` 替换现有关键词任务分组，补齐加载/空/部分/失败/过期/待处理状态。
6. **Desktop/Web 接线**：仅接真实 adapter 和预览 fixture；不在平台壳复制任务页面。
7. **真实账号验收**：至少覆盖三个角色、任务物品、赏金、里程碑、追踪切换、到期、完成待处理、组件失败和两台设备结果一致。

## 10. 非目标

- 不负责 T42 的光等计算，也不在 T43 推荐“刷什么提高光等”。
- 不把所有声望、成就、收藏品、催化剂、赛季等级做成任务中心。
- 不复制 DIM 的完整 Progress、Milestones、Ranks 或 Pathfinder 页面。
- 不使用中文/英文名称关键词、固定完成百分比、固定周期或示例数据充当事实。
- 不自动领取、删除、转移、装备或执行任何 Bungie 写操作。
- 不承诺奖励一定掉落某个装备槽；这属于 T44 的奖励价值分析。

## 11. 验收标准

### 数据正确性

- 同一账号、同一服务器 Profile 在两台设备上分类、状态、数量和排序一致。
- Quest/Bounty/Seasonal 的分类来自稳定 Hash/definition 关系；名称变化和语言变化不改变结果。
- 任务物品、角色里程碑和记录项目能区分来源，不重复计数。
- Objective 进度、完成值、可见性、追踪和到期时间均来自 Bungie 字段；缺失时明确显示未知/部分。
- “待处理数量”不把普通进行中任务总数当成已完成待处理数量。

### 页面感知

- 玩家能在账号页一眼看到已完成待处理、快过期和追踪数量，并能定位到角色。
- 任务同步期间旧列表不消失，页面明确显示同步中和数据时间；失败不清空其他账号页面。
- 任务资源尚未加载、部分失败、无任务和已确认无待处理分别有可理解的状态文案。
- 首页摘要与账号页使用同一份标准化任务状态，不出现一个页面显示有任务、另一个页面显示没有任务。

### 性能与架构

- 任务资源不让装备、容量、仓库和邮政官首屏进入等待任务数据的阻塞链。
- 不新增页面私有轮询或第二套账号缓存；刷新和写操作遵守中央 Session 的确认语义。
- 任务数据失败不会污染或覆盖最后确认的账号装备快照。

## 12. 后续依赖

- T44 只消费 T43 输出的标准化状态和奖励引用，不重新解析任务分类。
- 若 Bungie 当前接口无法可靠区分“完成但待领取”和“已完成已领取”，先交付“完成状态待确认”这一保守状态，不以推测替代事实。
