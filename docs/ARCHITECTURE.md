# 现行代码结构

当前只支持规则 **0.27.0**。玩法见 [CURRENT_GAMEPLAY_V27.md](CURRENT_GAMEPLAY_V27.md)，AI 入口见 [AI_PLAYER.md](AI_PLAYER.md)。

## 为什么拆 `game` 和 `runtime`

二者回答不同问题，避免结算和存档缠在一起。

| | `src/game` | `src/runtime` |
| --- | --- | --- |
| 职责 | 规则：这一步在世界里发生了什么 | 对局：命令、会话、读写文件 |
| 输入 | 状态 + 行动 + 规则 | 玩家命令（runId、revision、actionId） |
| 输出 | 新状态 + 事件 | 保存后的会话、公开观察 |
| 不做什么 | 不读盘、不认玩家、不选行动 | 不计算产量、不改田地 |

网页、命令行、测试都调用同一套 `transition`。改存档方式不必改农事公式；改灌溉规则不必改 `record.json` 形状。

一次行动：入口 → runtime 校验 `commandId` / `revision` → `game.ts` 结算 → 写档 → 返回观察。

## `present` 是干什么的

**不是**把 runtime 的存档 JSON 变简单。存档里仍是完整 `GameState`。

公开观察 `observeSession()` 已经比存档干净（没有种子、随机状态），但对 AI 仍然太大：一次完整 JSON 约 26 万字符，还带着全部不可用行动。`src/present` 只把这份**已经公开的观察**收成精简摘要和 `--section` 分区，供 `player.mjs` 默认阅读。它不参与结算，也不读 `GameState`。

人类网页继续用完整观察，不走 compact。

## `apps` 是不是游戏 UI

主要是入口，不全是画面。

| 目录 | 作用 |
| --- | --- |
| `apps/board` | 人类浏览器对局：开局、点按钮、看田地/学堂/系统。本地静态服务。 |
| `apps/cli` | 命令行：`new` / `observe` / `act` |
| `apps/host` | 加载当前 `social-eras.v27.json`，给 board 和 CLI 共用 |

真正的规则不在 `apps` 里。`scripts/player.mjs` 是给 AI 的窄入口，再转去 CLI。

## `rulesets` 里是什么

现在只有 `rulesets/social-eras.v27.json`。里面主要是：

- **开关**：这局开哪些机制（`economy`、`life`、`eras`、`electric`…）
- **数字**：工资、仓储、每季时间、阶段长度、电灯加时等
- **场景**：河渠等地点的旱涝、公共水
- **旧科技节点表**：仍在 JSON 里；现行三条树的节点、作物和配方在 TypeScript 目录（`economy-catalog.ts`、`model/branches.ts` 等）

**机制本身（怎么灌溉、怎么扣劳动、季末顺序）在 `src/game`，不在 JSON。** 改“泵抽多少水”动代码；改“雇员工资是 1 还是 2”动 JSON。JSON 里的 `true` 只表示“这局启用该子系统”，不实现该系统。

## 测试现在测什么

全部用当前 v27 开局。`tests/v27.ts` 是共用规则加载。

| 文件 | 测什么 |
| --- | --- |
| `branch-mesh` | 学科分叉前置、持续耕作 |
| `industry` | 产品验证、系统建设/派工、劳动预留、传承不复制个人知识 |
| `electric` | 发电、负载、电报到货、现代结算与副本用电 |
| `eras` | 社会阶段计时、主动结算、公井/公地、观察不含随机 |
| `social-food` | 购粮策略、额度、与劳动预留交叉 |
| `renewal` | 饥饿/健康、祖先知识、农事预留报价 |
| `compact-observation` / `player-text` | 摘要与完整文本不泄漏隐藏状态，报价还在 |
| `refactor` | 命令幂等与过期拒绝、存档不覆盖、分层与循环依赖 |

不测旧规则版本、不测研究分数、不测脚本代玩。

## 文档

| 文件 | 用途 |
| --- | --- |
| [CURRENT_GAMEPLAY_V27.md](CURRENT_GAMEPLAY_V27.md) | 现行玩法 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 本页，代码怎么分层 |
| [AI_PLAYER.md](AI_PLAYER.md) | AI 怎么用命令行玩 |
| 仓库根 [README.md](../README.md) | 怎么启动 |
| [playtests/START_HERE.md](../playtests/START_HERE.md) | 模型试玩约定 |

## 除此之外还有什么

```text
src/game/          规则结算（model 类型、actions 行动、systems 过程）
src/runtime/       会话与 JSON 存档
src/present/       AI 精简观察
apps/              网页、CLI、规则加载
scripts/player.mjs  AI 受限命令
rulesets/          当前规则 JSON
tests/             上表
playtests/         试玩批次笔记（不是结算）
docs/              本目录
package.json / tsconfig.json / AGENTS.md
dist/              编译产物（gitignore）
node_modules/      依赖
artifacts/runs/    当前局存档（gitignore，不入库）
```

根目录若还有 `v26-各阶段能力对照.pdf`，属于旧对照表，不是运行所需。`scripts/` 里除 `player.mjs` 外的 ps1/mjs 是试玩辅助，不是结算。`src/game` 里仍有远征、试炼、旧工艺等文件，因为 v27 的初始化还按开关组装；现行局主要走经济/分支/工业/人生/时代。
