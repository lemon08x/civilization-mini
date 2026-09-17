# 现行项目结构

当前只支持规则 **0.27.0**。玩法见 [CURRENT_GAMEPLAY_V27.md](CURRENT_GAMEPLAY_V27.md)，改机制或改数值的流程见仓库根 [AGENTS.md](../AGENTS.md)，AI 入口见 [AI_PLAYER.md](AI_PLAYER.md)。

## 目录

```text
保留范围
  src/game/              规则结算（唯一权威：game.ts）
  rulesets/v27/          现行规则（拆开的 JSON）
  apps/                  人类网页 + 命令行入口
  playtests/             AI 试玩规则、精简观察、player.mjs

入口胶水（不扩张）
  src/runtime/           会话、命令校验、JSON 存档

开发与说明（不扩张）
  tests/                 机制用例，仅用户要求时运行
  docs/                  本目录
  AGENTS.md              协作与改规则流程
  package.json / tsconfig.json

运行产物（不入库）
  dist/  node_modules/  saves/
```

试玩笔记在 `playtests/batches/`。网页存档在浏览器（开始界面打开或新开）；命令行存档在 `saves/`。

## 一局怎么走

```text
网页 /play  或  lab new  或  player.mjs
        │
        ▼
  runtime 校验 commandId + expectedRevision
        │
        ▼
  game.ts  createInitialState / getAvailableActions / transition
        │
        ▼
  写档（浏览器存档槽 或 saves/<id>/record.json）
        │
        ▼
  observation.ts 公开观察
        ├─ 网页：完整观察
        └─ AI：present 收成 compact
```

`src/game` 不读盘、不认玩家、不选行动。`runtime` 不算产量、不改田地。策略只能读 `observeSession()` 的输出。

## `src/game` 怎么拆

| 位置 | 职责 |
| --- | --- |
| `game.ts` | 开局、列出行动、执行一步；季末调用 `systems/time.ts` |
| `ruleset.ts` | 校验 JSON、有界参数覆盖（`resolveRuleset`） |
| `model/` | 类型与目录常量（状态形状、学科节点、产品规格） |
| `systems/` | 世界过程（灌溉、加工、季末顺序、传承） |
| `actions/` | 玩家可点的行动报价与执行 |
| `observation.ts` | 从状态生成公开观察 |

机制（怎么抽水、怎么扣劳动、季末谁先结算）在 TypeScript。规则 JSON 里的数字和开关不实现公式。

## 现行局实际运行的机制

开局后走经济分支。玩家循环是：生活（粮、田、身体）→ 学科 → 产品/加工 → 工业系统与雇佣 → 商城/供能 → 社会阶段与购粮。

对应代码（改这些不必先确认“是否属于保留范围”）：

- 行动：`economy`、`branches`、`industry`、`life`、`eras`、`social-food`、`shop`、`operations`、`modern`
- 过程：`time`、`economy`、`economy-catalog`、`agriculture`、`processing`、`inventory`、`knowledge`、`labor`、`industry`、`industry-products`、`branches`、`life`、`eras`、`social-food`、`shop`、`operations`、`modern`、电气/现代目录、`inheritance`、`ancestry`
- `systems/crafts.ts` 仍负责当地库存回复（野粮、木材、岗位、市场粮），购粮和采集用这份 `production` 子状态

`apps/board` 现行页：聚落、社会、农业、生活、家人、仓库、学科、产品、生产、系统、商城、能源。副本/试炼/作坊页仍在仓库里，观察没有对应 view 时导航不会出现。

## 仍编译、现行局走不到

v27 JSON 仍带若干旧开关。`createInitialState` 会先建 `society` / `development` / `productNetwork` / `expeditions` / `workshops`，再删掉。`tower` 根本不建。

因此下面这些文件还在编译图里，对现行一局没有可观察效果：

- 行动：`livelihood`、`crafts`、`education`、`research`、`society`、`development`、`product-network`、`expedition`、`tower`、`workshop`
- 过程：远征、试炼、旧作坊、旧社会委托、成长经验、产品网、种源试炼
- 网页：`expedition-view.ts`、`tower-view.ts`、`workshop-view.ts`

清这些文件会碰到初始化、季末空转调用和规则校验，需单独确认后再做。

## 数字在哪

两处，改之前先定位：

| 位置 | 典型内容 | 怎么改 |
| --- | --- | --- |
| `rulesets/v27/parameters.json` | 开局粮钱、每季口粮 | 改 JSON，受 bounds 约束 |
| `rulesets/v27/systems.json` | 工资、人生、购粮、电气、阶段长度 | 改 JSON，受 bounds 约束 |
| `rulesets/v27/catalogs.json` | 物价、作物产量、产品投入、配方进出 | 改 JSON；校验时写回 TypeScript 目录对象 |
| `rulesets/v27/scenarios.json` | 地点旱涝、公共水 | 改 JSON |
| TypeScript 目录 | 名称、效果、学科节点结构 | 改机制时才动代码 |

JSON 里的 `true` 只表示“这局启用该子系统”，不实现该系统。改“泵抽多少水”动代码；改“雇员工资是 1 还是 2”动 `systems.json`；改作物产量动 `catalogs.json`。

## `apps` / 胶水

| 目录 | 作用 |
| --- | --- |
| `apps/board` | 人类浏览器对局。`server.ts` 提供本地静态服务 |
| `apps/cli` | `list` / `new` / `observe` / `act` / `delete` |
| `apps/host` | 组装 `rulesets/v27/` 并校验 |
| `src/runtime` | 命令幂等、revision、写 `saves/<id>/record.json` |
| `playtests/player.mjs` | AI 只允许 observe / act，默认 compact |

## 测试

只在用户明确要求时运行。`tests/v27.ts` 加载现行规则。现有用例覆盖学科分叉、工业与劳动预留、电气、社会阶段、购粮、饥饿与健康。不测旧版本。新增测试文件须先确认。
