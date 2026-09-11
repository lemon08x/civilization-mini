# 给 Grok 的单轮参数研究提示词

适用于能读写本项目并运行终端的编程工具。先在工具中选择实际可用的 Grok 模型并打开项目根目录，再复制下面的提示词。模型名、版本与推理设置以工具真实记录为准；本项目没有将任何模型名硬编码为 Grok 4.6，不需要为了研究角色额外接入 xAI API。

Grok 是研究者，现有 npm run simulate 的行动控制器仍是脚本基线；模型分析脚本实验不等于 Grok 逐步扮演玩家。若要测 Grok 玩游戏，需另建只传观察的控制器，不在本任务内混入。

## 复制以下内容

```text
你是这个游戏项目的参数研究代理。请实际完成一轮有界研究：选题、先登记假设、执行小批量对照、读取轨迹、提出结论和结构化提案。不要停在计划，也不要直接修改默认游戏规则。

项目根目录：C:\Users\94202\Desktop\daily\civilizationMini
先确认工具能读取项目并执行终端。不能执行时明确说明，不虚构实验结果。

先阅读：
1. AGENTS.md
2. docs/AI_PROTOCOL.md、docs/KNOWLEDGE_RESEARCH.md
3. docs/POTTERY_FUEL_RESEARCH_20260911.md
4. experiments/frameworks/knowledge.v1.json
5. experiments/proposals/ 中已有真实提案（排除模板）
6. rulesets/social-inheritance.v4.json，以及你所选问题涉及的 src/game/ 和 src/agents/scripted/ 文件

已完成的参考轮次：陶作燃料 2→1，8局首批+4局种子29留出。河谷陶作采木5→3，钱财+4，完工、学会、继承不变；混合路线终点多未完成陶坯。候选暂不采纳。先核对已有证据，不为追齐指纹重复该研究。20个规划节点尚不能模拟；不要把未实现节点或脚本没尝试的行动当作参数失效。

权限与预算：
- 当前分支工作，保留所有用户修改、历史报告和存档。
- 研究文件只写 experiments/；模拟器自动产生 artifacts/experiments/。
- 本轮不改 src/、rulesets/、scripts/、测试、原报告和存档，不调用付费 API、不创建后台循环。
- 最多选择1个已有白名单参数和1个候选值。候选另存独立JSON；先核对参数边界与联动影响，不把更便宜/更赚钱等同于更好。
- 首批最多8局。运行前确定最多4局的留出场景、策略、种子及触发条件；本轮最多12局。不要无明确问题重跑，不并发多个实验。
- 每局最多60条命令。失败保留记录并停止调查原因，不能为完成批次偷偷提高预算或改策略。

执行流程：
1. 从现行机制找1个具体问题。说明该参数影响哪些行动，现有脚本是否会触发。若关键行为未被策略覆盖，记录策略/机制问题并结束，不能用不相关实验硬调参数。
2. 在 experiments/ 写运行前假设Markdown，包含问题、单项候选、预期变化、反证、成功条件、不能恶化的指标、预先指定的留出与停止条件。配置/报告名使用唯一ID，拒绝覆盖。
3. npm run build。查看 dist/implementation.json，记录实际规则与实现指纹；检查构建失败就停止。
4. 创建独立候选JSON和实验计划。计划格式参照 experiments/plans/pottery-fuel-20260911.json，选择相关场景与策略，variants只放baseline。调用：
   npm run simulate -- --rules society --spec experiments/plans/<唯一ID>.json --candidate experiments/<唯一候选>.json
   --candidate会追加候选组，不要在plan里再写candidate造成重复。
5. 保存命令返回的真实目录，检查manifest、metrics、report和失败记录。每个候选必须与同场景、种子、策略、实现和行动预算的基线配对；除该参数外保持一致。
6. 读取对应逐局JSON，检查行动、原料、实际完工、销售、学习、继承、公共库存和终点在制品。运行：
   npm run research:audit -- <基线逐局JSON> <候选逐局JSON>
   audit只是待调查信号，不是因果结论，也不是完整重放校验。
7. 对本轮引用的轨迹，使用 dist/src/runtime/replay.js 导出的 replayRecord(record, 当前implementation) 做完整校验。可在experiments/编写仅用于本轮的研究脚本，不改变执行器。指纹不匹配则保留原档并停止该记录的重放，不伪造或迁移指纹。保存源文件SHA-256、实际策略文件指纹、校验结论及关键revision/eventIndex。
8. 只有达到预先登记的触发条件才执行最多4局留出；没有改善或出现明显副作用则停止，不继续换参数。完成后不为追齐报告指纹重跑。
9. 写 experiments/<唯一ID>-analysis.md，以及 experiments/proposals/<唯一ID>.proposal.json，参照 template.example.json 但必须填写真实内容。报告你的实际模型身份/工具设置；未知就写未知。研究者为Grok，行动控制器为scripted，不称为Grok玩家测试。
10. 提案至少包括旧值、候选值、当前实际值、假设、实际实验目录、轨迹位置、副作用、反证和决定。正面但未正式采纳用pending_decision，证据不足或不值得采纳用deferred，明确被否定用rejected；adoptedVersion必须为null。本轮不得标accepted或改默认规则。

最终给我：
- 实际改变了什么候选（不是默认规则）和为什么选它；
- 跑了多少局，成功/失败数量，真实模型研究者与脚本控制器的区别；
- 配对结果表，至少含生活缺口、采料/制作行动、实际产品、钱财、学习、传承及未完成投入；
- 2—3处能支持因果解释的轨迹位置；
- 建议采纳、拒绝还是暂缓，以及未被本轮证据覆盖的部分；
- 报告、提案和原始实验路径。审阅页刷新后应能看到新增实验与提案。

禁止为了漂亮分数修改状态、未来天气、策略或多个参数；不要写虚构模型调用、结论或验证记录。没有必要不运行全套单元测试；本任务的验证是候选合法性、小批量对照和对应轨迹重放。
```

## 实验计划结构示例

下例只是格式，Grok 应根据新的具体研究问题选择范围，不能把示例当作必须再次运行的研究：

```json
{
  "schemaVersion": 1,
  "id": "replace-with-unique-research-id",
  "seeds": [17],
  "scenarios": ["woodland", "clay-valley"],
  "agents": ["potter", "mixed"],
  "variants": [{"id": "baseline", "parameters": {}}],
  "maxActions": 60,
  "decisionTimeoutMs": 30000
}
```

运行完成打开本地 `/review` 的「实验与提案」，点击刷新记录。现有服务若未运行，在终端 `npm start` 后打开 http://127.0.0.1:4317/review；端口被占用则选择空闲端口，不停止其他用户服务。
