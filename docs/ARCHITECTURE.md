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
| `rulesets/v27/scenarios.json` | 固定默认环境的旱涝与公共水（开局不再选环境；发展框架定义在 src/game/model/eras.ts） | 改 JSON |
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


## 独立剧情模块与扩展约定

剧情目录位于 `src/game/narrative/`；唯一游戏适配层是 `src/game/systems/narrative-adapter.ts`。当前内容包 `landscapes-1` 接入桑下旧界、四类景观、首次使用、改建和师徒接续。旧人物经历与节气物理事件保留原结算，后续逐类迁入，不能将其当成已经全部迁移。

### 文件与依赖

- `narrative/contracts.ts`：序列化协议，定义事件、事实、条件、节点、实例和记录；不导入游戏状态。
- `narrative/engine.ts`：纯函数 `advanceStory`，只克隆与推进剧情状态，不执行世界行动、不访问随机数或系统时间。
- `narrative/conditions.ts`：显式的 event/fact 条件；目前支持 eq/gte。正文插值只读取输入字段，不执行脚本。
- `narrative/validation.ts`：检查目录 ID、节点引用、前置环、能力绑定、事件接入和存档形状。
- `narrative/content/places/old-boundary.ts`：完整地方故事范例；`discoveries.ts` 集中现有探索正文。
- `narrative/content/people/apprenticeship.ts`：初来、首次学成、实际接班的故事。
- `narrative/content/index.ts`：目录汇总与内容版本；`narrative/index.ts` 是模块唯一公开出口。
- `systems/narrative-adapter.ts`：转换公开世界事实、已发生事件、人物姓名和选择能力；不写剧情正文。这里声明可接入的 TOPICS 和 BINDINGS。
- `systems/landscapes.ts`：结算景观效果与学习、农事、教学中的使用次数，发出结构化使用事实；放松使用由日历结算。剧情适配层只更新剧情状态，不改景观或其他世界状态。
- `systems/landscapes.ts` 与 `actions/landscapes.ts`：实际景观能力、建设投入与报价，独立于故事是否读过。
- `apps/board/story-view.ts`：共用故事卡、可执行选择与往事记录；不改世界、不推进故事。

`narrative/` 内禁止导入 `model/state`、`systems`、`actions`、`runtime`、`apps`，也不使用 Math.random、Date、网络和文件系统。外部只经公开 index 使用剧情模块。数值不写入故事处理器：时间与效果在 systems.json，材料和品茶投入在 catalogs.json.landscapes。

### 一次行动如何流转

`game.ts transition` 校验正式行动 → 付费/准备 → 行动与日历结算 → 延后建设完成 → `settleNarrative` 转换事实 → `advanceStory` 更新进度与文字快照 → 冻结状态。免费计划、土地用途和实践的提前返回也经过同一剧情提交入口。观察和网页重绘只读。

选择能力先绑定到现有合法行动 ID；正式行动再核验地块、时间和材料。剧情只在成功行动发出事实后记下选择，不存在客户端直接领取奖励的第二条通道。原始 GameEvent 的 detail 是展示日志，禁止解析中文日志来判断剧情。需要新结果时增加结构化 story-fact 或在适配层转换既有结构化事件。

剧情事实只含公开数据，不传入完整 GameState、种子、随机状态或未来天气。当前文本没有随机抽取；以后新增随机文案必须使用独立可复现来源，不消费世界 RNG。

### 进度与保存

`GameState.story` 保存 version、catalogVersion、sequence、instances 和 records。实例 ID 为 `故事 ID@所属实体 ID`，同类故事的不同地块互不干扰。节点 repeat 为 once（实例一次）、person（实例内每人一次）或 event（每次成功事件）。已完成节点和参与者属于进度，正文快照属于往事；不要从历史文本反推状态。

sequence 每次成功提交递增；同序号重放不重复写入，跳号拒绝。正文在发生时插入人物姓名并保存，后续改名、接班或正文修订不会改写旧记录。首版只记录重要节点，普通劳动不逐日写日志。新增日常片段时须另设保留上限，不能删除用来去重的进度。

实际景观在 FarmPlot.landscape 中，含 kind、level、builtBy、uses；不在剧情里镜像库存、压力、课程或景观等级。改建更新现实功能、保留历史。所有变化仍由 transition 负责；内容版本与结构不兼容时拒绝旧档，不自动迁移，保持规则 0.27.0。

### 如何新增内容

1. 在相应 content 文件定义 StoryDefinition，使用稳定的英文 story/node ID，给出 scope 和 revision。
2. 选择适配层已提供的 topic，写 after、有限条件、展示 surface、正文和 repeat；按 `old-boundary.ts` 组织建设与首次使用。
3. 在 content/index.ts 注册。需要新机制时先实现正式行动，再为其接入事实 topic 和选择能力；不要在内容里塞回调或任意字段赋值。
4. choices 中的 capability 必须存在于适配层 BINDINGS。页面通过 observation 的 choices 渲染正式按钮，按钮条件与其他入口一致。
5. 修改既有节点含义或保存结构时更新内容版本，明确拒绝不兼容存档；不要复用旧 ID 表示另一件事。
6. 静态编译与内容启动校验检查引用，按仓库约定短时查看相关桌面页；未经用户要求不运行测试，也不新增测试文件。

新增普通故事通常只修改内容目录；新游戏能力修改机制和适配层；只有新的剧情表达能力才修改核心协议与处理器。
