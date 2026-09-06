# d2-tools

d2-tools 是一个给普通玩家使用的、面向 Windows 的 Destiny 2 中文桌面工具。

它把账号查看、仓库整理、资料库搜索、今日 / 本周信息和 AI 辅助整合到一个本地运行的桌面客户端里，尽量减少你在多个网站、网页工具和零散信息源之间来回切换的成本。

- 中文界面，优先面向普通玩家而不是开发者
- Windows 本地运行，不需要自己部署服务
- 账号、仓库、资料库、今日 / 本周、AI 一体化
- 配置、OAuth token、标签和本地数据保存在本机
- 基于 Bungie 官方授权流程，不走第三方账号中转

## 下载与运行

当前公开测试版本和下载入口请查看 [GitHub Releases](https://github.com/sandrewzq/d2-tools/releases)。

系统要求：Windows x64；首次使用需要按 [Bungie 配置指南](docs/bungie-setup.md) 创建并填写自己的 Bungie Application。

Windows x64 安装器：

```text
d2-tools-setup-<version>.exe
```

你不需要安装 Node.js、Python、Docker，也不需要手动部署服务。下载安装器并运行，按向导完成安装后即可开始使用。

程序的本地数据默认保存在：

```text
%APPDATA%\d2-tools
```

这里会保存你的本地配置、Bungie OAuth token、资料库缓存、仓库标签、备注和操作日志。安装或更新程序时，这些数据不会被自动删除。

## 适合谁

- 想用中文界面查看 Destiny 2 账号、仓库、装备和材料的玩家
- 想整理仓库、标记清理装备、做同名 roll 对比的玩家
- 想在一个工具里同时处理账号、资料库、今日 / 本周和 AI 分析的玩家
- 愿意自己创建 Bungie Application 并填写到本机配置里的玩家

## 三分钟快速开始

1. 下载安装器并运行。
2. 按 [Bungie 配置指南](docs/bungie-setup.md) 创建你自己的 Bungie Application。
3. 打开 d2-tools，在首次引导或设置页填写 `API Key`、`Client ID`、`Client Secret`。
4. 点击“保存配置”，d2-tools 会自动准备资料库；如果准备失败，按页面提示重试。
5. 资料库准备完成后，点击“登录 Bungie”，在浏览器里完成授权。
6. 回到软件开始查看账号、仓库、资料库、今日 / 本周和 AI 助手。

## 核心功能

- 账号：读取角色、光等、当前装备、背包、邮政官和材料摘要
- 仓库：按武器、护甲、装备、位置、子弹、评分、锁定状态和本地标签筛选
- DIM 风格整理：同名装备对比、重复组建议、批量候选选择、清理清单、游戏内定位提示
- 写操作：锁定、解锁、装备、仓库转移、一键装备最高光等
- 资料库：按中文、英文、perk、别名搜索装备、perk 和来源信息
- 今日 / 本周：只展示 Bungie API 或本地资料库能确认的内容
- AI 助手：支持 OpenAI Responses、OpenAI Chat Completions 和 Anthropic Messages 三种协议配置
- 本地优先：配置、token、标签、备注和日志保存在本机

## 数据来源、参考项目与鸣谢

### 官方数据来源

- Bungie API：账号、角色、装备、活动、商人和实时轮换状态
  - <https://bungie-net.github.io/>
- Destiny 2 Manifest：装备、Perk、活动、来源和版本定义
  - <https://www.bungie.net/7/en/Manifest>

### 社区资料来源

- DIM Wish List Sources：社区武器推荐 Roll 和 Wishlist 规则
  - GitHub：<https://github.com/48klocs/dim-wish-list-sources>
  - 默认愿望单：<https://raw.githubusercontent.com/48klocs/dim-wish-list-sources/master/voltron.txt>

### 参考项目与功能

- DIM：仓库、配装、愿望单和写操作流程参考
  - GitHub：<https://github.com/DestinyItemManager/DIM>
  - 在线访问：<https://app.destinyitemmanager.com/>
- D2ArmorPicker：护甲目标和方案比较参考
  - GitHub：<https://github.com/Mijago/D2ArmorPicker>
  - 在线访问：<https://d2armorpicker.com/>
- d2-armor-solver：Armor 3.0 属性求解表达参考
  - GitHub：<https://github.com/MIGO-OvO/d2-armor-solver>
  - 在线访问：<https://migo-ovo.github.io/d2-armor-solver/>
- Roll Report：Roll 差异和独特组合识别思路参考
  - GitHub：<https://github.com/cecilbowen/roll-report>
  - 在线访问：<https://roll.report/>
- d2-additional-info：Manifest 补充数据流程参考
  - GitHub：<https://github.com/DestinyItemManager/d2-additional-info>
- Starside · Destiny 2 中文资料台：中文资料和信息组织参考
  - 在线访问：<https://destiny2-starside-dea-mods-d1g0j2rile2323f73.webapps.tcloudbase.com/>
  - 数据源与鸣谢：<https://destiny2-starside-dea-mods-d1g0j2rile2323f73.webapps.tcloudbase.com/sources/index.html>

这些项目中的“数据来源”“功能参考”“算法参考”和“运行时依赖”是不同概念。除明确注明外，d2-tools 不复制其代码、账号数据或私有接口。本地用户导入内容暂不列入公开来源清单。

鸣谢 Bungie、DIM、DIM Wish List Sources、D2ArmorPicker、d2-armor-solver、Roll Report、d2-additional-info、Starside 以及 Destiny 2 社区资料维护者。

完整的来源、使用范围、许可和维护边界见 [数据来源、参考项目与鸣谢](docs/work/references/data-sources.md)。
更多社区工具、资料站和开源项目导航见 [Destiny 2 工具收集](docs/work/references/destiny-tool-reference.md)。

## 文档导航

玩家常用：

- [玩家使用指南](docs/user-guide.md)
- [Bungie 配置指南](docs/bungie-setup.md)
- [常见问题](docs/faq.md)
- [安全说明](docs/security.md)
- [支持与反馈](SUPPORT.md)

如果你遇到使用问题，建议先看 FAQ、Bungie 配置指南和支持文档；如果涉及敏感信息、凭据或安全边界，请改看 [安全策略](SECURITY.md)。

项目状态：

- [当前待办](docs/todo.md)
- [更新日志](CHANGELOG.md)

开发者：

- [开发说明](docs/development.md)
- [玩家文案字典](docs/player-facing-language.md)
- [贡献指南](CONTRIBUTING.md)
- [安全策略](SECURITY.md)

## 安全边界

- 公开分发包不内置任何人的 Bungie `API Key`、`Client ID` 或 `Client Secret`
- 每个玩家都使用自己的 Bungie Application
- OAuth token 只保存在本机数据目录
- AI 不读取、也不发送 token、`Client Secret` 或 Bungie `API Key`
- 写操作需要 Bungie Scope、操作确认和结果刷新；应用不再提供额外的本地总开关
- d2-tools 不会直接分解装备，最终分解仍需进入游戏手动完成

更完整的边界说明见 [安全说明](docs/security.md)。

## 开发

项目开发基线为 Node.js 24 LTS 和 pnpm 9.15.0。Windows 发布仍由 `package:win` 和 GitHub Windows runner 生成 NSIS `.exe`；macOS 只用于开发、运行和验收。

macOS 启动开发链：

```bash
corepack enable pnpm
pnpm install --frozen-lockfile
```

Finder 双击：

```text
tools/mac-dev-web.command       # Web 预览
tools/mac-dev-desktop.command   # Electron Desktop
```

一键本地打包（install + 测试 + 类型检查 + 打包）：

```powershell
powershell -File scripts/local-package.ps1
```

如需分步执行：

```powershell
npx pnpm@9.15.0 install      # 安装依赖
npx pnpm@9.15.0 test         # 运行现有测试
npx pnpm@9.15.0 typecheck    # 类型检查
npx pnpm@9.15.0 package:win  # 仅打包
```

Agent 在普通开发过程中默认不新增测试用例，也不自动运行重型验证；用户主动本地测试或打包时仍运行现有测试。

更多开发和发布细节见 [开发说明](docs/development.md)。

## License

本项目基于 [MIT License](LICENSE) 开源。

## Star History

<a href="https://www.star-history.com/?repos=sandrewzq%2Fd2-tools&type=date&legend=top-left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=sandrewzq/d2-tools&type=date&theme=dark&legend=top-left" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=sandrewzq/d2-tools&type=date&legend=top-left" />
    <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=sandrewzq/d2-tools&type=date&legend=top-left" />
  </picture>
</a>
