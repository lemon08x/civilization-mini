# AI 操作与改进协议

## 两种不同角色

**玩家代理**只能读观察、选行动、说明理由。**研究代理**在一批实验结束后查看轨迹、提出规则或参数修改。不能让同一个代理在行动过程中修改世界来证明自己的策略有效。

当前默认社会传承规则 0.4.0，提供固定规则执行器、七种脚本基线和文件接口；尚未接入本地或商业模型调用，也没有自动后台运行。JsonAgent 只提供严格 JSON 适配，不能把脚本模拟报告当作大模型测试。

## 逐步控制一局

在项目根目录执行：

```powershell
node dist/apps/cli/main.js new --run agent-a --seed 17 --scenario woodland
node scripts/player.mjs observe --run agent-a
node scripts/player.mjs act --run agent-a --revision 0 --action study:woodworking
node scripts/player.mjs metrics --run agent-a
```

`new`、`observe`、`act` 输出完整可见观察 JSON；`metrics` 输出结果指标。直接用 node 调用没有 npm 的额外日志头。`new` 拒绝覆盖已有文件。先拿到 observe 的新 revision，再发下一条 act。不要根据过时观察猜测连续动作。

观察外层为 `{ runId, revision, game, recentEvents }`；下表的游戏字段位于 `game`，`revision` 在外层。

### 观察字段

| 字段 | 内容 |
| --- | --- |
| `rulesVersion / status` | 当前规则、命令版本、是否待交接或结束 |
| `clock / ap` | 当前代、季、观察窗口和剩余行动 |
| `world / scenario` | 当前天气、水源、技术与当地教师；不含未来事件 |
| `person / heir` | 已掌握、在学、实践和领悟 |
| `family` | 资源、渠道、种源、材料、项目、试验记录 |
| `technologies` | 节点前置、当前进度与实际用途 |
| `actions` | 行动 ID、费用、enabled、不能执行的原因、结果说明 |
| `harvest` | 依据当前已知条件计算的收成信息 |
| `production`（仅新规则） | 当地可采库存与补给规则、有限市场、家庭原料/商品、工具、容器、在制品、当前采集预览与季末损耗预览 |
| 外层 `recentEvents` | 最近已发生的结构化事件；累计指标由独立 metrics 命令提供 |

观察不包含初始种子、RNG 或完整存档配置。玩家代理不读取 replay 文件、模拟器私有状态或实验调度器的种子。模型评估若无法隔离文件权限，应明确记录其为“遵守协议的代理实验”，而非安全隔离沙箱。

### 玩家代理返回格式

```json
{
  "revision": 0,
  "actionId": "study:observation",
  "reason": "先取得观察方法，下一步通过耕作完成实践；目前库存允许投入学习。"
}
```

适配器把 revision 与 actionId 传给 act；reason 保存在命令记录，不参与规则结算。运行接口为 `submitCommand(session, { commandId, expectedRevision, actionId, reason })`；重复命令幂等、过期版本拒绝。

非法行动应记录为控制器错误，并返回最新观察，不能自动补钱、修改前置或跳过该步。每局最多 1500 条控制命令，单批默认只有少量种子，不启动无期限循环。

## 可直接交给玩家代理的任务说明

> 你是一个家庭的当前经营者。目标是在维持基本生活的同时，按本局偏好安排学习、设施、研究和后辈培养。你只能使用观察中的信息，从 enabled=true 的 actions 中选择一个 ID，返回 revision、actionId 与简短理由。不要读取存档的种子或未来随机状态，不要修改规则、参数或存档。没有行动可用且 status 为 complete/ended 时结束；handover 时根据观察执行交接。你的行为由固定规则执行器结算，不能用文字声明自己已经获得资源或能力。

偏好可设置为：生活保障、木作/陶作谋生、混合经营、水利、种源或后代起点。不要把所有代理都设置成“最大化钱财”。模型名称、版本、提示词、推理设置和无效动作数必须跟实验一起记录。

## 参数提议格式

每个提议至少记录以下内容，可以写入一个独立 Markdown 文件。需要在 `/review` 审阅台展示时，另存为 `experiments/proposals/<id>.proposal.json`，格式与状态见 [审阅台说明](REVIEW_DESK.md)。模拟结果不会自动生成提案或改变采纳状态，证据继续引用原实验的版本与指纹。

- 问题：出现在哪个节点、场景或代际阶段。
- 证据：具体 record 文件和 revision。
- 分类：世界过程缺失、节点依赖不合理、数值问题、控制策略问题、界面理解问题。
- 假设：为什么会出现，修改后预计哪些指标发生什么变化。
- 候选：参数覆盖 JSON；结构变更另写规则版本提案。
- 反证：什么结果会说明这个提议不成立。
- 副作用：是否削弱其他路线，是否让传承或生活选择消失。
- 结论：接受、拒绝或待研究，并保留原基线。

示例 `experiments/cheaper-learning.json` 只把 `trainingCost` 从 1 调为 0。它是用于检验“实践费用是不是阻碍学习的主因”的候选，不是建议直接采纳免费实践。

```powershell
npm run simulate -- --candidate experiments/storage-capacity.json
```

默认带候选产生 16 个脚本实验：两个参数组，各自运行两场景、一个固定种子、四种策略。不带候选为 8 局。新生产候选使用如 `production.baseStorage` 的白名单参数，不能通过候选改前置或注入代码。旧免费实践对照须显式传 `--rules legacy --spec experiments/plans/agriculture-v1.json --candidate experiments/cheaper-learning.json`，为 32 局。要检验真实模型，须另接模型调用并记录实际控制器。

实验调度生成中性 run ID，不在玩家可见标识中编码种子、场景或候选标签；研究清单另外保存配对信息。调用方自行创建 run 时也应遵守此约定。

## 接受修改的标准

先核对具体轨迹，确认改善来自目标机制。然后看不同策略与环境，不只看某一局收入。用未参与调参的少量种子检查是否过拟合，最后短时手动试玩。历史正确性和技术前置是否真实，另外做资料核对，不能靠模拟多数票决定。

如需接入付费模型或持续自动运行，后续再确定提供方、调用预算、次数上限和终止条件；当前项目不猜测账号与费用，也不主动发送数据。

## 权限限制的实际边界

先由组织者构建并创建 run，再向玩家提供受限入口。scripts/player.mjs 启动 Node 权限受限子进程：只能读取构建、规则和实验目录，act 只能写指定 run；不授权网络、子进程或原生扩展。为兼容路径校验，目前允许读取整个 artifacts/runs，故它不是隐藏种子的安全隔离。真正评估时应由宿主仅传观察、接收 JSON 决策，不向模型开放 shell 或文件读取。代理仍持有任意 shell 时，脚本、AGENTS.md 与哈希都不能阻止它绕过限制。
