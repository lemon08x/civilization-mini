# AI 文本玩家入口

人类使用 `/play` 的聚落界面；AI 使用本文与 `scripts/player.mjs`。二者共用行动接口和结算规则，但使用独立存档。此入口不自动调用模型、不自动选择行动。

## 准备（宿主执行）

需要 Node.js 24+，在项目根目录执行 `npm ci`、`npm run build`。创建独立 run ID；已有同名目录不会覆盖。

```powershell
npm run lab -- new --run ai-demo --scenario river --format text
```

模型试玩先读 `playtests/AGENTS.md` 与 `playtests/START_HERE.md`，按其中规定命名、记录批次和停止条件。

## 读取与推进（玩家执行）

直接读取 UTF-8 文件 `artifacts/runs/ai-demo/observation.md`。文件包含当前 revision、可用行动及报价、不可用原因、完整可见状态和最近事件。建档、导入和成功行动后自动更新；它只是观察副本，编辑它不改变游戏。

根据最新观察选择一个可用行动，替换下面的占位符：

```text
node scripts/player.mjs act --run ai-demo --revision <最新revision> --action <可用行动ID> --reason "本次选择的原因" --format text
```

执行后读取新观察，再决定下一步。不要预排动作串或直接改存档。失败、冲突、文件更新警告或怀疑观察过期时，重新获取权威观察：

```powershell
node scripts/player.mjs observe --run ai-demo --format text
```

该命令只读存档，不写观察文件；可将成功输出另存为文本。不要用失败输出覆盖已有观察。没有 `--format text` 时仍输出原有 JSON 格式。`metrics` 仍输出 JSON。

## 观察边界与存档

- 文本仅从 `observeSession()` 生成，包含现在可见的天气，不包含种子、随机状态或未来天气。
- `record.json` 和 `history/` 属于存档与重放资料，不供玩家读取。不要用隐藏状态辅助决策。
- 观察副本可能因文件权限、并发或进程中断未及时更新；revision 校验会拒绝过期行动。以 `observe` 的成功输出为准。
- 原始存档与历史报告保留。网页存档保存在浏览器；命令行存档在 `artifacts/runs/`。没有自动跨端同步。
- 本次只改变入口与呈现，不改变规则版本与存档迁移要求。
