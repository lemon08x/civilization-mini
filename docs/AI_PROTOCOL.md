# AI 操作与改进协议

## 两种不同角色

**玩家代理**只能读观察、选行动、说明理由。**研究代理**在一批实验结束后查看轨迹、提出规则或参数修改。不能让同一个代理在行动过程中修改世界来证明自己的策略有效。

当前已经提供固定规则执行器、脚本基线和文件接口；尚未接入商业 LLM API，也没有自动后台运行。任何具备本地命令工具的 AI 都可以按下面协议逐步试玩。

## 逐步控制一局

在项目根目录执行：

```powershell
node scripts/cli.mjs new --file runs/agent-a.json --seed 17 --scenario river
node scripts/cli.mjs observe --file runs/agent-a.json
node scripts/cli.mjs act --file runs/agent-a.json --revision 0 --action study:observation
node scripts/cli.mjs metrics --file runs/agent-a.json
```

`new`、`observe`、`act` 输出完整可见观察 JSON；`metrics` 输出结果指标。直接用 node 调用没有 npm 的额外日志头。`new` 拒绝覆盖已有文件。先拿到 observe 的新 revision，再发下一条 act。不要根据过时观察猜测连续动作。

### 观察字段

| 字段 | 内容 |
| --- | --- |
| `rulesVersion / revision / status` | 当前规则、命令版本、是否待交接或结束 |
| `clock / ap` | 当前代、季、观察窗口和剩余行动 |
| `world / scenario` | 当前天气、水源、技术与当地教师；不含未来事件 |
| `person / heir` | 已掌握、在学、实践和领悟 |
| `family` | 资源、渠道、种源、材料、项目、试验记录 |
| `technologies` | 节点前置、当前进度与实际用途 |
| `actions` | 行动 ID、费用、enabled、不能执行的原因、结果说明 |
| `harvest` | 依据当前已知条件计算的收成信息 |
| `feedback / recentLog / history / stats` | 已发生的结果与累计记录 |

观察不包含初始种子、RNG 或完整存档配置。玩家代理不读取 replay 文件、模拟器私有状态或实验调度器的种子。模型评估若无法隔离文件权限，应明确记录其为“遵守协议的代理实验”，而非安全隔离沙箱。

### 玩家代理返回格式

```json
{
  "revision": 0,
  "actionId": "study:observation",
  "reason": "先取得观察方法，下一步通过耕作完成实践；目前库存允许投入学习。"
}
```

适配器把 revision 与 actionId 传给 act；reason 由实验组织者另存决策记录，不参与规则结算。原生引擎接口为 `applyAction(state, actionId, expectedRevision)`。

非法行动应记录为控制器错误，并返回最新观察，不能自动补钱、修改前置或跳过该步。每局最多 1500 条控制命令，单批默认只有少量种子，不启动无期限循环。

## 可直接交给玩家代理的任务说明

> 你是一个家庭的当前经营者。目标是在维持基本生活的同时，按本局偏好安排学习、设施、研究和后辈培养。你只能使用观察中的信息，从 enabled=true 的 actions 中选择一个 ID，返回 revision、actionId 与简短理由。不要读取存档的种子或未来随机状态，不要修改规则、参数或存档。没有行动可用且 status 为 complete/ended 时结束；handover 时根据观察执行交接。你的行为由固定规则执行器结算，不能用文字声明自己已经获得资源或能力。

偏好分别设置为：生活保障、当前收入、水利专精、种源研究、后代起点。不要把所有代理都设置成“最大化钱财”。模型名称、版本、提示词、推理设置和无效动作数必须跟实验一起记录。

## 参数提议格式

每个提议至少记录以下内容，可以写入一个独立 Markdown 文件：

- 问题：出现在哪个节点、场景或代际阶段。
- 证据：具体 replay/trace 文件和 revision。
- 分类：世界过程缺失、节点依赖不合理、数值问题、控制策略问题、界面理解问题。
- 假设：为什么会出现，修改后预计哪些指标发生什么变化。
- 候选：参数覆盖 JSON；结构变更另写规则版本提案。
- 反证：什么结果会说明这个提议不成立。
- 副作用：是否削弱其他路线，是否让传承或生活选择消失。
- 结论：接受、拒绝或待研究，并保留原基线。

示例 `experiments/cheaper-learning.json` 只把 `trainingCost` 从 1 调为 0。它是用于检验“实践费用是不是阻碍学习的主因”的候选，不是建议直接采纳免费实践。

```powershell
npm run simulate -- --candidate experiments/cheaper-learning.json --seeds 7,17
```

调度器产生 32 个脚本实验：两个参数组，各自运行相同的两种场景、两种种子、四种策略。要检验真实大模型，应由外部代理按同一配置分别走局，再用相同指标比较；脚本跑出的结果不能写成大模型评估结果。

## 接受修改的标准

先核对具体轨迹，确认改善来自目标机制。然后看不同策略与环境，不只看某一局收入。用未参与调参的少量种子检查是否过拟合，最后短时手动试玩。历史正确性和技术前置是否真实，另外做资料核对，不能靠模拟多数票决定。

如需接入付费模型或持续自动运行，后续再确定提供方、调用预算、次数上限和终止条件；当前项目不猜测账号与费用，也不主动发送数据。
