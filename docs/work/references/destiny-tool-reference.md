# Destiny 2 工具收集

> 本文是 Destiny 2 社区工具、资料站和开源项目的地址索引，方便玩家按用途查找工具，也方便 d2-tools 做能力边界和交互参考。
>
> 地址说明：每个条目都直接显示完整 URL，点击即可访问。`GitHub` 用于查看源码、Issue 和版本；`在线访问` 用于直接打开网页或服务。未提供或暂未确认的地址不会用本机目录代替。

## 导航

- [DIM 官方生态仓库](#一dim-官方生态仓库)
- [装备、仓库与配装](#二装备仓库与配装)
- [账号查询、公开数据与统计](#三账号查询公开数据与统计)
- [活动、轮换、Raid 与 Dungeon](#四活动轮换raid-与-dungeon)
- [百科、资料与官方接口](#五百科资料与官方接口)
- [工具导航与补充发现](#六工具导航与补充发现)
- [暂未确认地址](#七暂未确认地址)

## 一、DIM 官方生态仓库

DIM 的官方组织仓库总览：<https://github.com/orgs/DestinyItemManager/repositories>

这些仓库不是都适合普通玩家直接使用。下面按“对玩家的直接价值”和“对 d2-tools 的参考价值”分层，避免把维护脚本、依赖 fork 和归档客户端混进工具导航。

| 仓库 | 地址 | 价值判断 |
| --- | --- | --- |
| DIM | <https://github.com/DestinyItemManager/DIM> | 高：完整的仓库管理、配装、愿望单和写操作产品参考。 |
| dim-api（DIM Sync） | <https://github.com/DestinyItemManager/dim-api> | 高：同步标签、备注和配装等 DIM 自有数据；不读取库存，也不代替 Bungie 写操作。 |
| bungie-api-ts | <https://github.com/DestinyItemManager/bungie-api-ts> | 高：TypeScript API 类型、请求辅助和 Manifest 辅助，适合 d2-tools 开发参考。 |
| d2-additional-info | <https://github.com/DestinyItemManager/d2-additional-info> | 高：从 Manifest 生成赛季、活动、来源、催化剂和模组等补充数据。 |
| csv-wishlists-parser | <https://github.com/DestinyItemManager/csv-wishlists-parser> | 中：愿望单 CSV 解析器，适合参考导入和转换，不是独立玩家页面。 |
| d2-manifest-bot | <https://github.com/DestinyItemManager/d2-manifest-bot> | 中：Manifest 更新检查的 GitHub 自动化，主要面向维护者。 |
| dim-bungie-platform | <https://github.com/DestinyItemManager/dim-bungie-platform> | 低：已归档的旧 REST Endpoint 代码，只适合历史兼容排查。 |
| dim-extension | <https://github.com/DestinyItemManager/dim-extension> | 低：浏览器快捷入口，不提供独立的装备管理能力。 |
| dim-mobile / dim-mobile-client | <https://github.com/DestinyItemManager/dim-mobile>、<https://github.com/DestinyItemManager/dim-mobile-client> | 低：移动端项目已归档，不作为当前实现依据。 |
| d2ai-module | <https://github.com/DestinyItemManager/d2ai-module> | 低：DIM 构建过程相关的数据模块，不是独立玩家工具。 |
| dim-custom-symbols | <https://github.com/DestinyItemManager/dim-custom-symbols> | 低：DIM 自定义字体资源，和玩家工具功能无关。 |

其他如 `dim-release-bot`、`destiny-item-csp`、`license`、`apikey`、依赖库 fork 以及 Android/iOS 平台仓库，主要是组织维护或基础设施，不纳入玩家导航。

### dim-api（DIM Sync）

- 用途：同步标签、备注、保存的配装和其他不属于 Bungie API 的用户数据。
- GitHub：<https://github.com/DestinyItemManager/dim-api>
- 在线访问：<https://api.destinyitemmanager.com/>
- 参考价值：如果 d2-tools 将来需要跨设备同步本地标签、备注或配装，这是比普通 UI 参考更直接的后端协议参考；它不能读取库存，也不能代替 Bungie API 执行装备操作。

### bungie-api-ts

- 用途：Bungie.net API 的 TypeScript 类型定义、接口辅助函数和 Manifest 下载辅助。
- GitHub：<https://github.com/DestinyItemManager/bungie-api-ts>
- 在线访问：未提供
- 参考价值：对 TypeScript 项目很有价值，可用于核对 API 请求参数、响应类型和 Manifest 辅助方法；它本身不是玩家网页工具。

### d2-additional-info

- 用途：从 Destiny 2 Manifest 生成 DIM 使用的补充 JSON/TypeScript 数据，例如赛季、活动、来源、催化剂和模组映射。
- GitHub：<https://github.com/DestinyItemManager/d2-additional-info>
- 在线访问：未提供
- 参考价值：适合参考“官方 Manifest 没有直接给出、但产品需要补充维护”的数据生成流程。

### csv-wishlists-parser

- 用途：把社区愿望单 CSV 解析成 DIM 可使用的结构。
- GitHub：<https://github.com/DestinyItemManager/csv-wishlists-parser>
- 在线访问：未提供
- 参考价值：如果 d2-tools 扩展愿望单导入或转换功能，这个仓库比直接复制 DIM 页面实现更值得参考。

### d2-manifest-bot

- 用途：通过 GitHub Actions 检查新的 Destiny 2 Manifest 版本。
- GitHub：<https://github.com/DestinyItemManager/d2-manifest-bot>
- 在线访问：未提供
- 参考价值：主要用于维护者自动化，不属于玩家日常使用工具。

## 二、装备、仓库与配装

### Destiny Item Manager（DIM）

- 用途：账号、仓库和装备管理；配装、愿望单、清理建议、装备转移和装备对比。
- GitHub：<https://github.com/DestinyItemManager/DIM>
- 在线访问：<https://app.destinyitemmanager.com/>
- 参考重点：成熟的仓库筛选、同名 Roll 对比、Loadout 工作流和写操作确认。

### DIM Wish List Sources

- 用途：为 DIM 提供社区维护和生成的武器愿望单来源文件，帮助标记推荐 Roll。
- GitHub：<https://github.com/48klocs/dim-wish-list-sources>
- 在线访问：默认 `voltron.txt` 愿望单：<https://raw.githubusercontent.com/48klocs/dim-wish-list-sources/master/voltron.txt>
- 参考重点：社区愿望单的数据组织、默认列表与偏好列表的区分；这是数据来源仓库，不是独立的玩家网页工具。
- 相关生成工具：<https://48klocs.github.io/wish-list-magic-wand/fingerwave.html>

### T20 武器推荐数据源结论

本节保存 T20“武器推荐汇总与仓库精确清理”的外部数据源调研。v0.0.22 已发布能力见 [T20 完成摘要](../backlog/T20-weapon-recommendation-vault-cleanup.md)，这里不重复维护完成状态。

#### 五个一级推荐来源

| 来源 | 原始链接 | 已确认能力 | 使用边界 |
|---|---|---|---|
| `Aegis推荐` | <https://docs.google.com/spreadsheets/d/1JM-0SlxVDAi-C6rGVlLxa-J1WGewEeL8Qvq4htWZHhY/edit?gid=346832350#gid=346832350> | Tier、推荐栏位、获取来源和终局说明；本地使用 Starside 校对 CSV | 不是 Bungie 官方文本，不能直接决定玩家实例分解 |
| `LGpig推荐` | <https://starside.work/pve-farming/index.html> | 传奇与异域武器评级、Perk、DPS/总伤和中文评语 | 两张 CSV 合并为一个一级来源；页面未声明再分发许可 |
| `YXCRALLXY推荐表` | <https://docs.qq.com/sheet/DYkR5enNIdUt1VFhK?tab=000001&_t=1788087335795&nlc=1> | 广覆盖的 PVE/PVP 第三、第四栏推荐和中文评价 | 自由文本不能自动转换成统一强度分数 |
| `Sayalarry推荐表` | <https://sa7vp10ytxr.feishu.cn/wiki/W3ySwdahTiNRUJklJNBc0CMPnkb> | 枪管、弹匣、第三四栏、起源特性、大师属性和获取优先级 | 获取优先级不等同于 aegis Tier |
| `DIM社区愿望单` | <https://github.com/48klocs/dim-wish-list-sources> | 精确武器/Perk Hash、作者来源块、用途标签和 DIM 交换格式 | 非 Bungie 官方，也不是展开行投票数 |

本地输入的只读统计基线：

- `Aegis推荐`：Starside 校对 CSV 共 748 条传奇武器记录；生成时通过当前 Manifest 的官方中英文名称与版本标记验证关联 `itemHash`，最终按官方武器名称汇总。
- `LGpig推荐`：200 条传奇武器记录和 83 条异域武器记录；两张表作为同一个来源导入。
- `YXCRALLXY推荐表`：461 个武器位置、454 个名称；453 个带 PVE 推荐，309 个带 PVP 推荐。
- `Sayalarry推荐表`：72 条实际武器记录、70 个名称、116 条模式配置。
- 五来源统一生成结果为 2,382 条唯一“官方武器身份 + 推荐来源”记录，覆盖 952 个官方武器身份和 1,627 个关联官方武器 ID；来源行分布为 Aegis 729、LGpig 279、YXCRALLXY 455、Sayalarry 70、DIM 849。生成器按 Manifest 发布标记从新到旧检查同一英文武器身份的版本，各版本只用于证明官方 Perk 与插槽，最终按身份合并推荐池；不同武器即使官方中文同名也保持独立。LGpig 异域表额外要求候选为官方异域品质，避免把 `Dragon's Breath` 的来源内容映射到同名微型冲锋枪 `Breath of the Dragon`。任一同身份版本能证明的附加推荐会保留并标注“部分版本具备”；例如“光明前景”的“加速突击”。名称修正仍只使用来源位置、武器类型和官方 Perk 池可唯一证明的映射。

这些数量只表达覆盖和交集，不能当作推荐票数，也不能据此自动生成跨来源组合。

#### DIM社区愿望单身份与时效性

- 来源身份：社区维护的 DIM Wishlist 聚合。仓库 README 将其描述为 DIM 默认加载列表，但仓库不属于 Bungie 官方数据源。
- 许可：仓库声明 MIT；使用时仍需保留仓库、作者来源块和许可信息。
- T20 固定候选 revision：`ce2cbcc3b3b3d4b7ebc62f2ddf0502b00f4dadfd`。
- 该 revision 提交时间：2026-08-03；提交说明：`PvE episode 173 + bonus`；核对时间：2026-09-01。
- 文件约 26.7 MB，包含约 255,373 条展开后的正向组合和 1,234 个唯一武器 Hash。
- 与其他四个来源存在大量武器重合，但重合数量不能解释为推荐票数。
- 展开行主要来自枪管、弹匣和 Perk 候选排列，不能把每行解释成独立投票。
- 文件级更新时间不代表每把旧武器都在最近提交中重新审核；单条推荐没有统一更新时间或更新 SLA。
- 正确解析必须保留标题、作者、`//notes:...|tags:...`、用途和完整 Hash 组合。
- DIM 官方实现将一条规则中的 Perk 解析为无序 `Set<number>`，匹配条件是该实例拥有规则中的全部 Hash；格式本身不保存“第三栏/第四栏”的显式位置，也不会把同栏多个 Hash解释成任选其一。
- T20 提取标准两栏组合时只能使用 Manifest 插槽证明：旧 Plug Hash 可按官方名称精确映射；同时属于第三、第四栏的 Hash 只有在另一栏已经唯一确定时才能落位；同栏多个必需 Perk、缺栏和特殊异域插槽必须保留为提示，不能弱化成普通组合。
- Trash List 默认禁用；负向 Wishlist 不作为第一版待处理依据。

#### 其他数据源分级

| 级别 | 来源 | T20 定位 |
|---|---|---|
| 官方事实 | Bungie API、Destiny Manifest | 武器、Perk、插槽、版本、账号实例和完整 Roll 的唯一权威 |
| 批量推荐 | 五个一级推荐来源 | 生成中文知识库和实例匹配证据 |
| 本地派生保护 | Roll Report 思路、D2Foundry 计算 | 本地计算独特组合、射程和属性；不等于专家推荐 |
| 条件扩展 | D2Clarity | 确认 Partnership / 授权后补充倍率、触发和持续时间 |
| 官方资料补充 | d2-additional-info | 固定 revision 补充赛季、来源、任务武器和催化剂关系 |
| 开发核对 | Destiny2 Checkinfo、D2 Arsenal | 人工核对名称、Perk 池或站点响应，不作为运行时依赖 |
| 外部导航 | light.gg | 供玩家手动查看武器资料和社区观点，不作为应用运行时数据源 |

具体结论：

- Roll Report 源码为 MIT，可参考其独特组合算法并使用当前 Manifest 在本地重写；线上部署接口不是稳定公开协议。
- D2Clarity 数据适合机制解释，但公开数据库要求核对 Partnership 条件；未确认前不打包、不镜像。
- D2Foundry 适合射程、换弹和属性派生；历史 Felicity 推荐数据最后更新时间为 2023-08-21，不参与当前推荐共识。
- d2-additional-info 为 MIT，可固定 revision 使用，但只补充官方资料关系，不替代 Manifest 或推荐来源。
- Checkinfo 与 D2 Arsenal 存在站点内部 JSON 响应；没有第三方 SLA，D2 Arsenal 对部分当前样本 Hash 返回 404，因此仅用于开发核对。

#### light.gg 使用边界

- 当前环境直接读取 light.gg 武器页、`robots.txt` 和条款页会遇到 Cloudflare 403，不能依赖批量实时抓取。
- light.gg 的社区流行度不能解释成专家共识，也不能覆盖五个一级来源已经确认的事实。
- 应用不读取、抓取或缓存 light.gg 页面，也不把它注册为社区推荐来源。
- 仅保留完整在线地址作为工具导航；玩家离开应用后自行查看，页面内容不回写推荐库或实例匹配结果。

#### 安全边界

- 账号 OAuth Token、Cookie 和私有库存不得发送给任何第三方推荐工具。
- 账号事实只通过本应用直接调用 Bungie 官方接口读取。
- 外部推荐来源只接收公开 `itemHash / perkHash`，或不包含账号身份的查询。

### D2ArmorPicker

- 用途：根据属性目标、碎片、模组和异域限制计算护甲组合。
- GitHub：<https://github.com/Mijago/D2ArmorPicker>
- 在线访问：<https://d2armorpicker.com/>
- 参考重点：属性目标输入、方案排序、异域锁定和多方案比较。

### d2-armor-solver

- 用途：面向 Armor 3.0 的六维属性配装和可达性计算。
- GitHub：<https://github.com/MIGO-OvO/d2-armor-solver>
- 在线访问：<https://migo-ovo.github.io/d2-armor-solver/>
- 参考重点：六维目标、`+5 / +10` 模组、可行组合、目标缺口和理论极限展示。

### D2 Arsenal

- 用途：武器数据库、Perk 组合、Roll 分享和部分伤害衰减计算。
- GitHub：<https://github.com/D2Arsenal/d2arsenal.com>
- 在线访问：<https://www.d2arsenal.com/>
- 参考重点：D2 Gunsmith 的开源替代方向、Roll 分享图片和武器配置预览。

### Roll Report

- 用途：发现同一武器上的独特 Perk 组合和 Roll 差异。
- GitHub：<https://github.com/cecilbowen/roll-report>
- 在线访问：<https://roll.report/>
- 参考重点：按武器识别稀有组合，适合作为愿望单和 Roll 分析的补充入口。

### D2 Gun Locker

- 用途：无需登录即可浏览武器和护甲、查看 Perk、属性、催化剂并比较 Roll。
- GitHub：未确认
- 在线访问：<https://d2gunlocker.com/>
- 参考重点：免登录的资料库浏览和轻量详情页；涉及账号操作时仍应回到 Bungie 授权工具。

### Ada's Armory

- 用途：武器搜索、Perk 池、属性、伤害、射程和 Crucible TTK 资料浏览。
- GitHub：未确认
- 在线访问：<https://adasarmory.com/>
- 参考重点：武器详情的信息分组和 PvE/PvP 对比；部分 TTK、射程数据仍在完善。

### Destiny2ools

- 用途：连接 Bungie 账号后分析库存、武器和护甲，并按 PvE/PvP、属性和 Perk 条件筛选。
- GitHub：未确认
- 在线访问：<https://destiny2ools.cloud/>
- 参考重点：深度库存分析和“先选择目标、再准备方案”的流程；授权前应确认隐私和服务可信度。

### Little Light

- 用途：移动端库存管理、快速转移、配装、收藏品、胜利和任务追踪。
- GitHub：<https://github.com/LittleLightForDestiny/littlelight>
- 在线访问：未提供网页端；Android：<https://play.google.com/store/apps/details?id=me.markezine.luzinha>；iOS：<https://apps.apple.com/us/app/little-light-for-destiny/id1373037254>
- 参考重点：移动端快速转移和跨角色配装工作流。它是移动应用，不是 d2-tools 的桌面发布替代品。

### Starside · Destiny 2 中文资料台

- 用途：中文 Destiny 2 资料台，集中整理武器 Perk、武器框架、护甲模组、护甲套装、异域装备、职业分支、技能冷却、首领生命值、DPS、伤害机制和 Raid 攻略。
- GitHub：未提供
- 在线访问：<https://starside.work/>
- 重要页面：
  - 轮换速查表：<https://starside.work/rotation/index.html>
  - 武器 Perk：<https://starside.work/weapon-perks/index.html>
  - 护甲模组：<https://starside.work/armor-mods/index.html>
  - Raid 攻略：<https://starside.work/raid-guides/index.html>
  - 数据源与鸣谢：<https://starside.work/sources/index.html>
- 参考价值：资料页的数值、机制解释和攻略组织方式很有参考价值；轮换速查表把突袭与地牢按固定顺序并列展示，适合参考导航结构和周期表表达。
- 数据边界：轮换页是静态周期表（页面标注基准时间和更新日期），不是 Bungie 实时接口，也不要求登录账号；d2-tools 不能据此直接判定“当前轮换”，当前轮换仍只使用 Bungie 登录后的角色活动数据。
- 维护状态：首页和多个页面标注 2026.8.30 更新；站点声明为非官方资料站，具体数据来源和更新责任以其“数据源与鸣谢”页面为准。

### Destiny Recipes

- 用途：赛季挑战、周常内容、光等提升、战利品保留和仓库清理辅助。
- GitHub：未提供
- 在线访问：<https://destinyrecipes.com/>
- 参考重点：把多个日常/周常任务聚合成可执行的玩家清单。

### Destiny Sets

- 用途：按赛季、活动和职业追踪护甲套装、武器、催化剂和收集进度。
- GitHub：未提供
- 在线访问：<https://destinysets.com/>
- 参考重点：装备收集目录、活动来源和套装完成度展示。

### Light.gg

- 用途：武器资料库、Perk 池、社区 God Roll 推荐、装备评分和账号库存查看。
- GitHub：未提供
- 在线访问：<https://www.light.gg/>
- 参考重点：Perk 解释、社区推荐和武器版本信息组织方式。

### D2-Morgeth-Kick

- 用途：与 Morgeth 相关的 Destiny 2 社区辅助项目。
- GitHub：<https://github.com/MIGO-OvO/D2-Morgeth-Kick/>
- 在线访问：<https://migo-ovo.github.io/D2-Morgeth-Kick/>
- 备注：仓库 metadata 提供了对应 GitHub Pages 地址。

## 三、账号查询、公开数据与统计

### d2-skill

- 用途：中文 Destiny 2 工具项目，覆盖 OAuth、Manifest、物品搜索、Perk、AI 分析和愿望单等能力。
- GitHub：<https://github.com/Lin-Guanguo/d2-skill>
- 在线访问：未提供
- 参考重点：Bungie 登录、Manifest 生命周期、跨领域服务拆分和工具接口设计。

### Destiny2 Checkinfo

- 用途：玩家公开资料查询、装备与 Perk 搜索、生涯统计、组队信息和攻略入口。
- GitHub：<https://github.com/hub380/Destiny2-Checkinfo>
- 在线访问：<https://destiny2.check-info.org/>
- 参考重点：公开查询不依赖本人 OAuth、后端聚合 DTO 和玩家生涯页面组织。

### Destiny Tracker

- 用途：玩家档案、PvP/PvE 统计、比赛历史和排行榜。
- GitHub：未提供
- 在线访问：<https://destinytracker.com/>
- 参考重点：按玩家、模式、赛季和排行榜维度组织统计信息。

### Bray.tech

- 用途：收藏品、地图、里程碑、赛季进度和活动记录查询。
- GitHub：未提供
- 在线访问：<https://bray.tech/>
- 参考重点：收藏进度、目的地地图和账号全貌的分层浏览。

### Destiny 2 Solo Enabler

- 用途：通过本地辅助方式限制匹配，让玩家进行单人活动测试或探索。
- GitHub：<https://github.com/DrNoLife/Destiny-2-Solo-Enabler>
- 在线访问：未提供
- 注意：这是本地辅助工具，不属于账号查询服务；使用前应确认其与游戏规则和当前客户端版本的兼容性。

## 四、活动、轮换、Raid 与 Dungeon

### Today In Destiny

- 用途：每日/每周轮换、遗失区域、突袭、地牢、夜fall、试炼和商人库存。
- GitHub：未提供
- 在线访问：<https://www.todayindestiny.com/>
- 参考重点：活动轮换、商人库存和起止时间的玩家友好展示。

### 命运之小日向 Bot

- 用途：通过 QQ 群机器人提供每日/每周摘要、轮换、商人库存、掉落来源和玩家查询。
- GitHub：未提供
- 在线访问：<https://qun.qq.com/qunpro/robot/share?robot_appid=102076550>
- 参考重点：把日常信息推送到玩家常用聊天工具，降低主动查询成本。

### destiny.report

- 用途：武器数据库、Perk 反向搜索、来源筛选和赛季反制属性提示。
- GitHub：未提供
- 在线访问：<https://destiny.report/>
- 参考重点：从 Perk 反查武器和按来源聚合结果的检索方式。

### Raid Report

- 用途：Raid 和 Dungeon 完成记录、Solo/Flawless 标记、队友记录和排行榜。
- GitHub：未提供
- 在线访问：<https://raid.report/>
- 参考重点：活动历史、通关效率、队伍成员和挑战成就的组合展示。

### D2Checkpoint

- 用途：查找和分享 Raid/Dungeon checkpoint，并复制加入队伍所需的游戏指令。
- GitHub：未提供
- 在线访问：<https://d2checkpoint.com/>
- 参考重点：按活动、Boss 和 checkpoint 状态快速定位可用进度。

### D2 Gunsmith

- 用途：武器 Perk 配置、打造和数值预览工具。
- GitHub：未确认
- 在线访问：<https://d2gunsmith.com/>
- 备注：已确认在线地址可访问；目前没有确认到对应的官方 GitHub 仓库。

## 五、百科、资料与官方接口

### Destinypedia：Engram

- 用途：Destiny 世界观、物品、活动和术语百科资料。
- GitHub：未提供
- 在线访问：<https://www.destinypedia.com/Engram>
- 参考重点：面向玩家的术语解释、背景资料和交叉链接。

### Bungie.Net API

- 用途：官方 REST API 文档，涵盖 OAuth、账号、角色、物品、活动历史、商人和写操作接口。
- GitHub：<https://github.com/Bungie-net/api>
- 在线访问：<https://bungie-net.github.io/multi/index.html>
- 参考重点：d2-tools 的官方数据和授权边界；真实账号数据、写操作和接口字段以 Bungie 文档为准。

## 六、工具导航与补充发现

### Destiny 2 Tools

- 用途：第三方工具聚合导航，按库存、统计、进度、资料和分析等用途收集社区站点。
- GitHub：未确认
- 在线访问：<https://destiny2.tools/>
- 参考重点：按用途分组、搜索和快速跳转的导航结构，可作为 d2-tools 外链入口设计参考；站内条目的新鲜度仍需逐个核对。

### Bungie Companion Apps

- 用途：Bungie 官方登记的第三方 Companion App 列表。
- GitHub：未提供
- 在线访问：<https://www.bungie.net/7/en/registration/apps>
- 参考重点：作为“官方认可的第三方应用入口”或安全提示链接；不等于 Bungie 对每个应用的功能和隐私做全面担保。

## 七、暂未确认地址

以下地址可以访问，但暂不作为主导航条目，原因是信息重复、维护状态不清晰或没有确认对应源码：

- Destiny Tools 聚合站：<https://www.destinytools.net/>。内容以旧式链接目录为主，部分条目可能过期。
- D2 Armor Calc：<https://d2-armor-calc-lac.vercel.app/>。在线入口可访问，但尚未确认稳定维护的源码仓库和数据更新策略。

其余没有确认在线入口或对应 GitHub 仓库的条目，继续保留“未提供 / 未确认”标记，不用本机路径或未经核实的搜索结果代替。

## 导航化排版建议

后续做成 d2-tools 的工具导航时，每个工具建议转换成一张统一的信息卡，而不是把 GitHub 和在线地址混在一段描述里。卡片至少保留以下字段：

- 工具名称与一句话用途。
- 分类：仓库/配装、武器/Perk、账号/统计、活动/轮换、资料/百科、开发参考。
- 使用方式：在线网页、桌面应用、移动应用、GitHub 项目。
- 是否需要 Bungie 登录：无需登录、可选登录、必须登录、仅开发者使用。
- GitHub：完整 URL；没有就写“未提供”或“未确认”。
- 在线访问：完整 URL；移动应用则分别列出 Android / iOS。
- 推荐级别：推荐、可选、仅参考、已归档。
- 注意事项：数据新鲜度、授权范围、平台限制或维护状态。

推荐的首层导航只展示“推荐”与“可选”工具，并提供分类筛选和关键词搜索；“仅参考”和“已归档”放在折叠的开发者/历史区域。卡片的主要操作应是“打开在线工具”，GitHub 作为次级操作，避免玩家误把源码仓库当成可直接使用的产品。

## 使用边界

- 本文只收集公开地址和能力摘要，不复制第三方源码、账号数据、Cookie、Token 或本地缓存。
- 第三方工具的能力、数据新鲜度和服务稳定性由其维护者负责；涉及账号授权时应先查看其隐私和安全说明。
- d2-tools 的产品实现仍以 Bungie 官方接口、Destiny Manifest 和用户自己的授权数据为准；这里的工具只用于能力参考、交互参考和玩家导航。
