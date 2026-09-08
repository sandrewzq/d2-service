# T50：移除 DIM 分享接口依赖

> 状态：🟡 代码完成，待验收

## 目标

- 配装导入不再请求 `api.destinyitemmanager.com/loadout_share`。
- 只接受包含 `loadout` JSON 的 DIM 完整配装链接，并在本地解析。
- 对 `dim.gg` 短链接给出明确说明，引导玩家复制完整链接。
- 保留本地生成 DIM 完整链接和 DIM Wishlist 能力。

## 验收

- 完整的 `https://app.destinyitemmanager.com/loadouts?loadout=...` 链接可以生成导入预览。
- `https://dim.gg/...` 不发起网络请求，并提示改用完整链接。
- 配装导出和 DIM Wishlist 不受影响。
