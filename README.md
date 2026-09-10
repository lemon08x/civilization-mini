# Civilization Mini · 世代规则预研

独立的桌游规则实验项目。先验证普通人的生活、学习与代际传承，再开发正式游戏；不依赖 Cocos，不修改 ../remake。

现有规则保持 v0.1.0：两个环境、七个农业节点、两代经营窗口。工程版本为 v0.2.0，四个脚本策略不是大模型，尚未接入付费 API 或后台循环。

## 运行

需要 Node.js 24+。

```powershell
npm ci
npm run build
npm start
```

打开 http://127.0.0.1:4317。点选行动自动保存，反馈显示在页面顶部。浏览器 v1 存档首次读取后迁移到 v2 新键，保留旧原文；新建和导入会备份现存 v2。

```powershell
npm run lab -- new --run demo --seed 17 --scenario river
node scripts/player.mjs observe --run demo
node scripts/player.mjs act --run demo --revision 0 --action study:observation
npm run lab -- import --run imported --file runs/manual.json
npm test
npm run simulate -- --candidate experiments/cheaper-learning.json
```

代码修改后先重新 build。CLI 按 run ID 操作，拒绝原地覆盖已有实验。新运行保存至 artifacts/runs；对照报告、完整规则和轨迹保存至 artifacts/experiments。默认批次 16 局，带一个候选为 32 局，不会自动采纳候选。

## 项目职责

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

详见 [架构与演进约束](docs/ARCHITECTURE.md)、[桌游规则](docs/RULEBOOK.md)、[AI 协议](docs/AI_PROTOCOL.md)、[预研问题](docs/RESEARCH.md)。历史研究结论保留在 [首次发现](docs/INITIAL_FINDINGS.md)。

当前修改统一保存在 main，不保留额外备份分支、标签或 ZIP 文件。重构前源码仍可从 Git 历史提交 2f0ffbf 查阅；原 runs/ 与 reports/ 保留。不要用新实现直接解释不同指纹的 v2 存档，需对应版本或显式迁移。
