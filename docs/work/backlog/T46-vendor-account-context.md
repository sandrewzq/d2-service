# T46：商人账号上下文

> 状态：✅ 首批范围已完成并通过真实账号验收
> 优先级：P1
> 类型：账号事实与购买判断
> 数据边界：复用中央账号 Store；Collectibles 作为独立可选资源

## 1. 需求结论

游戏内商人界面已经展示当前 Offer 的 Perk / Roll，因此 T46 不重复做商人 Roll 推荐，也不判断“这把武器是不是必买”。

T46 只补充游戏内缺少的账号上下文：

1. 账号是否已经有同身份物品，以及有几件。
2. 收藏是否已解锁，且与实际拥有分开表达。
3. 当前 Offer 与账号实例的只读比较入口。
4. 当前 Offer 的购买限制、材料缺口和账号角色上下文。

玩家最终得到的不是“推荐分数”，而是一个可核对的购买事实摘要：

> 账号已有几件、收藏状态是什么、当前是否可买、是否值得打开已有实例比较。

### 1.1 玩家体验提升

T46 的核心提升是减少“看到商人物品后，再去仓库、账号页或游戏收藏中逐项查找”的上下文切换：

| 物品类型 | 玩家当前问题 | T46 的可感知提升 |
|---|---|---|
| 模组、着色器、收藏类物品 | 不确定是否已经解锁，容易漏买或重复检查 | 卡片直接显示“尚未解锁 / 已解锁”，并可只看收藏缺口 |
| 异域和固定获取物品 | 不确定账号当前是否保留实例 | 显示账号实际数量和位置，区分“收藏有记录”和“账号有实例” |
| 随机 Roll 武器与护甲 | 已有同名装备，但不确定有几件、在哪里 | 中性显示“账号有 N 件同身份装备”，打开详情再比较，不暗示已有就不用买 |
| 材料或条件型 Offer | 不确定缺什么、为什么不能买 | 同时显示持有量、缺口和 Bungie 返回的购买限制 |

玩家必须通过三个连续层级感知到能力：

1. **一眼看到**：卡片出现与物品类型匹配的账号状态，而不是统一的“已拥有”勾选。
2. **一键筛选**：可以只看尚未解锁的收藏缺口，或账号没有同身份实例的 Offer。
3. **点开核对**：详情能看到已有实例的位置和差异，不需要再切到仓库搜索。

如果只增加账号数量标签，却没有筛选和详情定位，T46 的体验提升不足，不视为完整交付。

### 1.2 首批交付范围

首批只交付一条完整、可感知的拥有状态链路：

- 卡片按物品类型显示“账号已有 N 件”或“账号有 N 件同身份装备”。
- 提供“账号无同身份实例”筛选，但不把筛选结果解释为推荐购买。
- 详情展示已有实例的位置摘要，玩家不需要切到仓库再次搜索。
- 同时删除旧的异域自动推荐标签和“只看推荐”筛选。

Collectibles、“只看未解锁”和完整 Perk / 属性对比后置到独立阶段；现有材料展示只做状态语义收敛，不作为首批开发阻塞项。

首批代码已于 2026-09-09 落地：账号身份索引、卡片拥有状态、装备缺失筛选和详情位置摘要已接入，旧异域自动推荐路径已移除。固定自动验收已通过（Core / App / UI / Desktop 共 4 个测试文件、28 项测试）；真实账号验收期间补齐了详情弹窗上下文传递，并将带商人上下文的武器与护甲详情调整为“标题 / 商人信息 / 可滚动正文”三行布局。2026-09-09 用户确认真实账号验收通过，T46 首批范围完成。

## 2. 当前基线与缺口

### 2.1 已有真实数据

当前代码已经具备以下数据：

- `AccountSummary.characters[*].equipped_items`：角色已装备实例。
- `AccountSummary.characters[*].inventory_items`：角色背包实例。
- `AccountSummary.characters[*].postmaster_items`：邮政官实例。
- `AccountSummary.vault.items`：仓库实例。
- `AccountSummary.materials.items`：账号材料与货币。
- `VendorOffer.itemHash`：Offer 对应的 Manifest 物品身份。
- `VendorOffer.vendorHash`、`vendorItemIndex`：商人销售位置。
- `VendorOffer.costs`、`failureMessages`、`canPurchase`、`apiPurchasable`：购买事实。
- `VendorOffer.stats`、`socketPlugHashes`、`rollFingerprint`：本次 API 返回的 Offer 配置，不代表购买时随机生成的实例。
- 统一装备详情已有同名实例展示和实例位置解析能力，可作为比较入口的复用基础。

### 2.2 当前缺口

- 商人 Offer 没有根据账号实例建立“已有数量 / 未拥有”摘要。
- `VendorInventoryItemWorkspace.status` 仍是旧的 `owned / recommended / unknown` 粗粒度状态，无法同时表达实际拥有、收藏解锁和购买限制。
- 商人页没有稳定的账号身份索引，列表渲染可能需要重复扫描完整账号物品。
- Collectibles 状态尚未作为独立资源接入商人页。
- Offer 详情没有明确的“查看账号同身份实例”上下文。
- 当前材料数量已有展示，但需要与购买状态和数据时间建立清晰边界。

## 3. 产品范围

### 3.1 完整目标范围

#### OWN-01：实际拥有数量

- 将仓库、所有角色已装备、角色背包和邮政官中的实例建立账号级索引。
- 以精确 `itemHash` 为默认身份键；只有 Manifest 明确声明同一 canonical identity 时才允许归并。
- 严禁按中文名称、模糊包含、稀有度或装备类型合并。
- 收藏或一次性获取语义明确的物品可以显示：`账号已有 N 件` / `账号未拥有`。
- 随机 Roll 武器和护甲使用中性文案：`账号有 N 件同身份装备` / `账号无同身份实例`，不得暗示已有就不值得购买。
- 数量只能代表中央账号快照中确认存在的真实实例，不根据商人 `Owned` 状态反推。

#### OWN-02：拥有位置摘要

- 详情上下文显示实例所在位置：仓库、角色已装备、角色背包、邮政官。
- 角色名称来自账号快照，不显示角色长 ID。
- 列表卡片只显示数量和是否已有，位置列表放在详情，避免卡片信息过载。
- 位置摘要为只读，不提供转移、锁定、装备或拆解操作。

#### OWN-03：收藏解锁状态

- 使用 Bungie 官方 Collectibles 数据表达：已解锁、未解锁、未知、读取失败。
- Collectibles 未读取或失败时必须显示未知，不根据实际库存推断解锁状态。
- 收藏状态作为独立异步资源，不阻塞商人基础库存和拥有数量首屏。
- “只看未解锁”只有在当前商人的相关 Collectibles 数据全部达到可判断状态后才启用；否则保持禁用或显示数据未就绪。

#### OWN-04：购买事实分层

以下状态必须分别保留：

- `ownedCount`：账号真实实例数量。
- `collectibleState`：收藏解锁状态。
- `vendorPurchaseState`：Bungie 当前 Offer 的可购买、已领取、达到上限或失败原因。
- `accountDataState`：账号快照是否可用、部分可用、过期或失败。

不能用一个“已拥有”勾选覆盖以上四类事实。

#### OWN-05：只读比较入口

- 武器和护甲详情提供“查看账号同身份实例”入口。
- 比较页显示实例数量、位置、属性和已确认的 Perk / Roll 数据。
- 商人 Offer 作为只读候选参加比较，不生成 `instanceId`。
- 没有充分规则时只显示事实差异，不显示“绝对升级”“必买”等结论。

#### OWN-06：购买条件与材料上下文

- 继续使用 `VendorOffer.costs`、中央账号材料和 `failureMessages`。
- 显示持有数量、所需数量、缺口和当前 API 购买限制。
- 材料未知时显示“持有量未读取”，不能显示 `0`。
- 不根据余额推断可购买次数；购买上限、声望和已领取状态可能独立存在。
- 材料余额变化只更新购买上下文，不改变 `ownedCount` 或收藏状态。

### 3.2 暂不纳入

- 不做商人专用推荐算法、推荐分数或“只看推荐”。
- 不根据账号装备自动判断绝对升级。
- 不实现跨角色商人库存合并；角色上下文仍由账号页决定。
- 不实现收藏树、成就、催化剂或完整资料库收藏管理。
- 不提供应用内购买和任何实例写操作。
- 不为比较预加载账号所有完整装备详情；列表只消费轻量摘要。

## 4. 账号身份与索引设计

### 4.1 身份键规则

```text
默认键：itemHash
扩展键：canonicalIdentityKey（仅 Manifest 明确提供时）
实例键：instance_id（仅账号真实实例）
```

- `itemHash` 是第一层严格匹配键。
- 不同发布身份、不同物品定义或仅名称相同的物品不得合并。
- `canonicalIdentityKey` 的来源必须可追溯到现有 Manifest / 领域身份规则；没有明确关系时保持分开。
- 商人 Offer 使用 `offer.id` 或 `vendorHash + vendorItemIndex + characterId` 作为 Offer 身份，不能冒充实例。

### 4.2 账号索引

建议在领域层提供纯函数索引：

```ts
type VendorAccountIdentityIndex = {
  byItemHash: ReadonlyMap<number, VendorOwnedIdentitySummary>;
  byCanonicalIdentity: ReadonlyMap<string, VendorOwnedIdentitySummary>;
  materialBalances: ReadonlyMap<number, number>;
  sourceProfileMintedAt?: string;
};

type VendorOwnedIdentitySummary = {
  itemHash: number;
  canonicalIdentityKey?: string;
  count: number;
  locations: readonly VendorOwnedLocation[];
  instanceIds: readonly string[];
  dataState: "ready" | "partial" | "unknown";
};

type VendorOwnedLocation = {
  kind: "vault" | "equipped" | "inventory" | "postmaster";
  characterId?: string;
  characterLabel?: string;
  count: number;
};
```

首批实现只启用 `byItemHash`：当前没有稳定的 canonical identity 规则，因此代码不会创建或猜测 `byCanonicalIdentity`；待身份规则冻结后再扩展索引。

索引构建要求：

- 账号快照变化时按 Patch 更新受影响身份，不重新扫描无关 Offer。
- 同一个实例只能计数一次；优先使用稳定 `instance_id` 去重。
- 缺少 `instance_id` 的快照条目只能进入不完整状态，不能无条件累加。
- 账号快照部分失败时，摘要必须标记 `partial`，不能把未知位置当成不存在。

### 4.3 Offer 派生上下文

每个 Offer 由索引派生轻量上下文：

```ts
type VendorOfferAccountContext = {
  owned: {
    count: number | null;
    state: "owned" | "not_owned" | "unknown" | "partial";
    locationSummary?: string;
  };
  collectible: {
    state: "unlocked" | "locked" | "unknown" | "unavailable";
  };
  purchase: {
    state: "available" | "unavailable" | "unknown";
    reasons: readonly string[];
  };
  comparison: {
    available: boolean;
    sameIdentityCount: number | null;
  };
  asOf?: string;
};
```

派生规则：

- 账号未登录或账号快照不存在：`owned.count = null`、状态为 `unknown`，商人库存仍可用。
- 账号快照加载中：显示加载态，不短暂显示“未拥有”。
- 账号快照部分失败：已确认容器计数可显示，但状态为 `partial`，不能宣称总数完整。
- Collectibles 失败不影响实际拥有数量和购买条件。
- Offer 购买失败不改变账号拥有或收藏事实。

## 5. UI 设计方案

### 5.1 卡片层级

遵循商人页现有“Offer 卡片 → 统一详情”的层级，不新增平行页面：

1. 第一层：物品名称、类型、游戏内已有的 Offer 配置摘要和成本。
2. 第二层：账号上下文短标签，最多显示两个：`账号已有 2 件`、`未拥有`、`收藏已解锁`、`收藏状态未知`。
3. 第三层：购买状态和缺口，继续放在现有成本 / 状态区域。
4. 详情层：完整位置、收藏状态、同名实例比较入口和数据时间。

卡片不显示长位置列表、完整比较表或“推荐分数”。

### 5.2 筛选

新增或调整商人页局部筛选：

- `账号无同身份实例`：`owned.state === "not_owned"`，适用于装备，但不表示推荐购买。
- `只看未解锁`：仅当 Collectibles 资源可判断时启用。
- 不保留已取消的 `recommendedOnly` 作为 T46 能力；现有旧字段需要在实现时移除或改为明确的兼容占位，不能继续把异域当推荐。

筛选要求：

- 使用 `aria-pressed`，可用键盘操作。
- 筛选结果变化时将焦点移动到相邻 Offer 或筛选入口。
- 过滤只改变当前商人视图，不修改快照和目录总量。
- 数据未知的 Offer 不得被错误归入“未拥有”或“未解锁”。

### 5.3 详情层

复用现有统一装备详情 Overlay：

- 在成本和购买限制附近增加“账号上下文”章节。
- 默认展示拥有数量、收藏状态、数据时间和比较入口。
- 玩家展开后再读取完整同名实例列表；列表按位置分组，默认按当前角色、仓库、其他角色、邮政官排序。
- Offer 详情中不出现实例写操作按钮。
- 关闭后恢复到原 Offer 卡片焦点。

### 5.4 响应式与可访问性

- 卡片上下文标签使用容器流式布局，窄屏自动换行，不使用固定坐标。
- 状态同时提供文字和可访问名称，不能只依赖颜色或图标。
- 动态账号 / Collectibles 状态更新使用一次礼貌级 live region 摘要，不逐卡播报。
- 鼠标、键盘和手柄继续共用现有 Offer 网格焦点顺序。

## 6. 数据加载与失败模型

### 6.1 资源划分

| 资源 | 首屏 | 失败影响 | 来源 |
|---|---|---|---|
| 商人基础库存 | 必须 | 商人页不可用 | Vendor API / 缓存 |
| 账号拥有索引 | 尽快 | 只隐藏拥有上下文，库存仍可用 | 中央 Account Store |
| 材料余额 | 尽快 | 成本显示“持有量未读取” | Account Store / Vendor 快照 |
| Collectibles | 可选异步 | 只显示未知 | Bungie Collectibles |
| 同名实例详情 | 按需 | 详情比较不可用 | Account Store / Item Detail |

### 6.2 时间与新旧数据

- 账号上下文显示账号快照的 `profile_minted_at` 或等价数据时间。
- 新的商人 Offer 不得被旧账号快照误报为最新拥有状态；数据时间不一致时显示“账号数据可能过期”。
- 相同或更旧的账号版本不能覆盖共享 Store。
- 角色切换后，旧角色的商人上下文立即退出可见状态；新角色加载期间显示加载或等待状态。

### 6.3 资源状态矩阵

| 账号状态 | 拥有数量 | 收藏 | 卡片表达 | 可用筛选 |
|---|---|---|---|---|
| 未登录 / 无快照 | 未知 | 未知 | 账号状态未读取 | 禁用 |
| 读取中 | 加载中 | 加载中或未知 | 正在读取账号状态 | 禁用 |
| 完整成功 | 确定 | 确定或不适用 | 正常显示 | 开放可判断筛选 |
| 账号部分失败 | 已确认部分 | 可能未知 | 部分账号数据 | 未拥有筛选谨慎开放 |
| Collectibles 失败 | 确定 | 未知 | 收藏状态未知 | 未解锁禁用 |
| 账号数据过期 | 旧值 | 旧值或未知 | 标记可能过期 | 不做肯定判断 |

## 7. 实施方案

### 阶段 0：契约与身份规则冻结

目标：不改 UI，先确认数据真相。

- 盘点 `AccountSummary` 的所有容器和实例 ID 完整性。
- 确认 `itemHash`、canonical identity 和发布身份的现有规则。
- 确定 Collectibles 官方组件、请求时机和失败语义。
- 定义 `VendorAccountIdentityIndex`、`VendorOwnedIdentitySummary` 和 `VendorOfferAccountContext` 的领域类型。
- 删除旧推荐状态对 T46 的隐式依赖，明确旧 `recommended` 字段迁移策略。

交付物：身份规则说明、领域 DTO 草案、状态矩阵评审结果。

### 阶段 1：账号拥有索引与卡片摘要（首个可交付切片）

目标：先让玩家看到“账号已有几件 / 未拥有”。

- 在 `packages/core` 增加账号物品身份索引纯函数，覆盖仓库、已装备、背包和邮政官。
- 在 `packages/app` 的商人 workspace 派生 Offer 账号上下文。
- 扩展商人 ViewModel 的上下文字段，移除用 `decisionLabel` 表示推荐的旧路径。
- 在 `packages/ui/src/vendors/` 卡片中增加按物品类型区分的短拥有状态和“账号无同身份实例”筛选。
- 在统一详情中先展示已有实例的位置摘要；完整 Perk / 属性比较留到阶段 3。
- 保持现有成本、购买条件、加载、空、失败和 Xur 定时器行为不变。

交付物：拥有数量卡片、无同身份实例筛选、详情位置摘要、部分账号数据状态。

### 阶段 2：Collectibles 独立资源

目标：补齐“已拥有”和“已解锁”的区分。

- 在 `packages/services` / Desktop 对应商人或账号 API 边界接入官方 Collectibles 数据。
- 复用中央请求 Broker、缓存和账号版本语义，不在商人组件内直接发 Bungie 请求。
- 只请求当前商人涉及的物品或经过账号级缓存的相关集合，避免每次切换商人重复拉取。
- 在 UI 增加收藏已解锁、未解锁、未知和失败状态。
- 仅在数据可判断时开放“只看未解锁”。

交付物：收藏状态标签、独立失败状态、未解锁筛选。

### 阶段 3：详情同名比较

目标：把 Offer 与账号实例安全地放在一起比较。

- 复用现有统一装备详情和同名实例解析能力。
- 增加商人 Offer 的只读上下文入口和实例位置摘要。
- 完善精确身份匹配、实例去重和不同发布身份隔离。
- 完整实例列表按详情展开或接近视口时加载，不进入列表常驻数据。
- 明确禁止转移、锁定、装备、拆解等写操作。

交付物：账号同名比较章节、位置分组、Offer 只读标识。

### 阶段 4：材料与购买状态收敛

目标：将已有材料显示变成可解释的购买上下文。

- 统一 `VendorOffer.costs` 与中央材料索引的优先级。
- 区分材料缺口、购买上限、已领取和 API 失败原因。
- 补齐未知、过期和部分失败状态，避免 `0 / 0` 或伪造可购买次数。
- 在商人头部提供当前库存实际使用材料的摘要，详情保留完整成本。

交付物：稳定的购买状态分层和材料缺口摘要。

### 阶段 5：验收与合同同步

目标：确认所有状态可理解且不破坏现有商人页。

- 验收账号无实例、已有多件、收藏已解锁但无实例、Collectibles 失败、账号部分失败、Offer 不可购买和数据过期。
- 验收当前角色切换后不残留旧上下文。
- 验收列表和详情键盘 / 手柄焦点、窄屏换行和 live region 噪声。
- 将稳定的卡片状态和详情层级同步到 `docs/work/references/ui-specs/application-workspaces.md`。
- 完成后再更新 T46 状态，不顺手扩展商人提醒需求。

## 8. 预计改动边界

### 领域与应用层

- `packages/core/src/vendors/`：账号身份索引、Offer 上下文派生和纯函数规则。
- `packages/app/src/workspaces/vendorsPage.ts`：把中央账号 Store 派生为商人 ViewModel 字段，清理旧推荐状态路径。
- 如 Collectibles 需要新 DTO，放在对应领域 / API 文件，不塞入大型聚合类型。

### Desktop 与服务层

- `packages/desktop/src/renderer/features/vendors/useVendorsWorkspace.ts`：消费共享账号状态和独立 Collectibles 资源，不建立商人私有账号快照。
- `packages/desktop/src/renderer/api/*Api.ts`、`packages/desktop/src/main/ipc/<domain>.ts`：仅在官方 Collectibles 尚无现有 transport 时增加分域契约。
- `packages/services`：负责 Bungie Collectibles 请求、缓存和版本校验；不让 UI 直接访问网络。

### 共享 UI

- `packages/ui/src/vendors/VendorsPageContentView.tsx`：卡片短状态、局部筛选和详情入口。
- `packages/ui/src/i18n/copy/vendors.ts`：新增中文状态文案及英文兼容文案。
- `packages/ui/src/styles.css` 中只增加 `.vendor-*` 内容层规则，不改全局 Shell、token 或共享 workspace chrome。

不应修改：

- `api/client.ts`、`api/types.ts`、`ipc.ts` 等高冲突聚合文件，除非分域契约无法落位。
- 其他菜单的页面结构和平台壳页面。

## 9. 验收标准

### 9.1 拥有与收藏

- 账号中存在三个同身份实例时显示“账号已有 3 件”。
- 账号中没有实例时，收藏类显示“账号未拥有”，随机 Roll 装备显示“账号无同身份实例”；数据未加载时不能显示任一确定文案。
- 收藏已解锁但账号无实例时，两个状态分别显示。
- Collectibles 请求失败时，实际拥有数量和购买条件仍然可用。
- 账号部分容器失败时，不把未确认位置误报为不存在。

### 9.2 身份与比较

- 同名但不同发布身份的物品不会错误合并。
- Offer 可以打开账号同名比较，且不会生成 `instanceId`。
- 比较页显示真实位置和数据时间。
- Offer 不出现转移、锁定、装备、拆解等实例操作。

### 9.3 购买条件

- 材料持有量、所需量和缺口来自真实数据。
- 材料未知时不显示 `0`，也不计算虚假的购买次数。
- 已领取、购买上限和其他失败原因独立表达，不覆盖拥有状态。

### 9.4 交互与性能

- 商人基础库存在拥有或 Collectibles 资源失败时仍可用。
- 列表只消费轻量上下文，不遍历完整账号实例详情。
- 快速切换商人不会重复发起相同账号上下文请求。
- 角色切换后旧上下文立即退出可见状态。
- 键盘 / 手柄焦点、窄屏布局和动态状态播报符合商人页现有合同。

## 10. 待确认决策

1. Collectibles 是按账号级缓存一次读取，还是按当前商人涉及物品按需读取；优先选择账号级缓存 + 按需索引。
2. `canonicalIdentityKey` 是否已有稳定领域规则；没有则 MVP 只使用精确 `itemHash`。
3. 同名比较默认排序：建议当前角色 → 仓库 → 其他角色 → 邮政官，再按光等或最近获得时间补充。
4. 卡片最多显示两个账号上下文标签，避免与成本、购买状态和新增变化争夺层级。
5. 账号数据过期阈值与“可能过期”文案，需要与共享账号同步合同统一。
