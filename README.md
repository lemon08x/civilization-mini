# Civilization Mini · 世代规则预研

独立的桌游规则实验项目。先验证普通人的生活、学习与代际传承，再开发正式游戏；不依赖 Cocos，不修改 ../remake。

默认规则 v0.4.0、工程 v0.5.0：无地图、回合制、普通人视角的文明发展预研。在工作台、陶窑与批量制作上增加家族方法学习减免、邻里传授、跨代作坊委托和公共商品流转；后人换行业仍能利用前代成果。12 个知识节点保留，尚未实现国家/全球扩散与时代推进。七个脚本策略不是大模型，尚未接入本地模型、付费 API 或后台循环。

设计方向见 [定位与科技正反馈](docs/DESIGN_DIRECTION.md)，当前增量规则及迁移见 [社会传承规则](docs/SOCIAL_INHERITANCE_V4.md)，首轮小样本结论见 [跨行业传承验证](docs/SOCIAL_INHERITANCE_VALIDATION.md)。木作接续已验证转行后收益，仍需工资、原料和订单；尚未证明平衡。

旧农业规则 v0.1.0 和冻结轨迹保留，使用 `--rules legacy` 新建旧规则局。旧存档需要显式导入复制，不能当作新生产世界继续。

## 运行

需要 Node.js 24+。

```powershell
npm ci
npm run build
npm start
```

打开 http://127.0.0.1:4317。点选行动自动保存，反馈显示在页面顶部。浏览器使用 v5 新存储键，原 v1—v4 键保留；新建和导入会备份现存 v5。旧档必须通过实现指纹和完整重放验证，不自动转为新规则。历史工程 0.3.0/0.4.0 的生产或科技反馈存档暂不支持迁移，请用对应版本读取，原档保留。

CLI 默认新局为社会传承规则；`--rules feedback` 为冻结的 0.3.0 科技反馈规则，`--rules production` 为 0.2.0 生产规则，`--rules legacy` 为 0.1.0 农业规则。用当前工程新建旧规则局不等于迁移历史实现的旧存档。

打开 http://127.0.0.1:4317/review 或点击游戏页底部「规则与实验审阅」，可查看现行机制、科技关系、参数权限，以及历史实验和提案的修改前后、证据与采纳状态。点击「刷新记录」读取新增记录；这是只读入口，不启动模拟或采纳修改。提案文件格式见 [审阅台说明](docs/REVIEW_DESK.md)。

```powershell
npm run lab -- new --run demo --seed 17 --scenario woodland
node scripts/player.mjs observe --run demo
node scripts/player.mjs act --run demo --revision 0 --action study:woodworking
npm run lab -- import --run imported --file runs/manual.json
npm test
npm run simulate -- --candidate experiments/storage-capacity.json
npm run simulate -- --rules legacy --spec experiments/plans/agriculture-v1.json
```

代码修改后先重新 build。CLI 按 run ID 操作，拒绝原地覆盖已有实验。新运行保存至 artifacts/runs；对照报告、完整规则和轨迹保存至 artifacts/experiments。默认批次 8 局，带一个候选为 16 局，不会自动采纳候选。

## 项目职责

跨领域框架与研究诊断见 [知识研究框架](docs/KNOWLEDGE_RESEARCH.md)。审阅页新增 7 领域、32 节点的框架与研究队列，区分 12 个现行节点和 20 个待实现候选。构建后 `npm run research:audit -- <逐局 JSON>` 可生成带事件位置的诊断记录，不重跑模拟、不自动调参。

| 目录 | 职责 |
| --- | --- |
| src/game | 状态、行动、生产/学习/项目/时间/传承系统、玩家观察；唯一规则结算 |
| src/runtime | 命令执行、完整记录、指纹、重放、旧存档迁移与文件保存 |
| src/agents | 代理协议、脚本基线、可注入模型调用的 JSON 适配器 |
| src/research | 有界实验调度、事件指标、同条件比较 |
| apps/cli、apps/board | 命令行与浏览器入口 |
| rulesets | 冻结规则、科技节点、场景、参数边界 |
| experiments | 候选参数与实验计划 |
| tests | 重构前独立基准及运行保护验证 |
| artifacts | 生成记录和报告，不作为规则来源 |

详见 [当前规则与迁移](docs/SOCIAL_INHERITANCE_V4.md)、[生产基础规则](docs/RULEBOOK_V2.md)、[架构与演进约束](docs/ARCHITECTURE.md)、[AI 协议](docs/AI_PROTOCOL.md)、[预研问题](docs/RESEARCH.md)。历史农业结论保留在 [首次发现](docs/INITIAL_FINDINGS.md)，历史生产结果见 [通用生产验证](docs/PRODUCTION_VALIDATION.md)，历史科技反馈见 [科技反馈验证](docs/TECHNOLOGY_FEEDBACK_VALIDATION.md)，本轮结果见 [跨行业传承验证](docs/SOCIAL_INHERITANCE_VALIDATION.md)。

默认在当前分支工作，只有用户明确要求时才创建或切换分支。重构前源码仍可从 Git 历史提交 2f0ffbf 查阅；原 runs/ 与 reports/ 保留。不要用新实现直接解释不同指纹的存档，需对应版本或显式迁移。当前支持冻结工程 0.2.0 的原始农业基线 v2 存档完整校验后复制导入，其他历史指纹继续拒绝猜测迁移。
