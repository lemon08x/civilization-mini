# AI 文本玩家入口

人类使用 `/play` 的聚落界面；AI 使用本文与 `playtests/player.mjs`。二者共用行动接口和结算规则，但使用独立存档。此入口不自动调用模型、不自动选择行动。

## 准备（宿主执行）

需要 Node.js 24+，在项目根目录执行 `npm ci`、`npm run build`。创建独立 run ID；已有同名目录不会覆盖。

```powershell
npm run lab -- new --run ai-demo --framework riverine
```

模型试玩先读 `playtests/AGENTS.md` 与 `playtests/START_HERE.md`。

## 读取与推进（玩家执行）

`playtests/player.mjs` 默认输出精简观察。成功 `act` 会返回最新摘要并更新 `saves/ai-demo/observation.md`。根据最新摘要选择一个可用行动：

```text
node playtests/player.mjs act --run ai-demo --revision <最新revision> --action <可用行动ID> --reason "本次选择的原因"
```

科技、产品、系统、全部不可用原因按需取分区：

```text
node playtests/player.mjs observe --run ai-demo --section branches
```

失败或怀疑观察过期时，重新获取：

```powershell
node playtests/player.mjs observe --run ai-demo
node playtests/player.mjs observe --run ai-demo --format text
```

`observe` 只读存档。未传 `--format` 时为 compact。

## 观察边界与存档

- 文本仅从 `observeSession()` 生成，包含现在可见的天气，不包含种子、随机状态或未来天气。
- `saves/<runId>/record.json` 是存档，不供玩家读取来辅助决策。
- 网页存档在浏览器，开始界面打开或新开；命令行存档在 `saves/`。没有自动跨端同步。
