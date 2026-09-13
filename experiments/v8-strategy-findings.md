# v8 多策略对照实验记录（脚本基线，未调用大模型）

- 规则：`passive-investment.v8`（0.8.0），实现指纹 `5e4ac800ac6667ba…`（工程 0.9.0）。
- 行动接口：`createSession / submitCommand / observeSession`，结算全部交给引擎；策略只读 `observeSession()` 输出。
- 本会话新局共 **96 局**（≤100 上限）：
  - `exp-v8-strategies.mjs`：techRush / craftEconomy / specialist / safe × 4 场景 × 4 种子 = 64 局（阈值 11）。
  - `exp-v8-winpath.mjs`：winPath（最便宜 11 项路径）× 4 场景 × 4 种子 = 16 局（阈值 11）。
  - `exp-v8-threshold.mjs`：craftEconomy / specialist × 4 场景 × 2 种子 = 16 局（阈值候选 53%→10 项）。
- 另聚合了上一会话的 v7（pacing 0.7.0）96 局 `exp-100-results.json` 作对照，未重跑。
- 结果文件：`exp-v8-results.json`、`exp-v8-winpath.json`、`exp-v8-threshold9.json`。

## 关键数据

| 策略 | n | 胜率(阈值11) | 平均科技 | 科技封顶 | 平均钱 | 最低粮 | 困顿终止 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| winPath（灌溉/选种链） | 16 | **100%** | 11.0 | 11+ | 13 | 0 | 0 |
| craftEconomy（手艺+工业） | 16 | 0% | 8.5 | **9** | 37 | 0.4 | 0 |
| specialist（深工业链） | 16 | 0% | 6.5 | 7 | 19 | 0 | 0 |
| techRush（工业11项，顺序欠佳） | 16 | 0% | 3.0 | 3 | 64 | 0 | 0 |
| safe（纯做工+吃饭） | 16 | 0% | 0 | 0 | **101** | 2 | 0 |

- winPath 平均**第 30 季**触发科技胜利（48 季观察期内）。
- 阈值实验（53%→10 项）：craftEconomy 8 局科技 = 9,9,8,5,9,9,9,9（封顶 9，到不了 10）；specialist = 7,7,6,6,6,6,7,7。
- 便宜链达成（winPath）：observation/资源观察/控火/木作/储存/测量/选种/渠道/配水/陶作 均 100%（第 1–14 季）；试种 38%（第 31 季，跨代去重后计入胜利）。
- 工业链（craftEconomy/specialist）：agronomy/ceramic-engineering/mechanics/experimentation 可达，**precision-engineering 0–50% 且最早第 39 季**。
- v7 对照：safe 同样囤 ~100 钱；校准仪造出（clay-valley 63%）却**从未使用**（calibrated=0%）。

## 结论（待检验假设，非定论）

1. **胜利可达，但路径"隐藏"**：只有瞄准便宜灌溉/选种链（survey→ditch→allocation、selection→trial）的策略能凑满 11；玩家直觉会走"有趣"的手艺/工业链，该链封顶 6–9 项，到不了 11。可发现性/目标引导是主要问题，不是数值不可达。
2. **金钱无 sink**：safe 纯做工 48 季囤 ~101 钱、0 科技、0 困顿。`workIncome=2` 相对成本偏高，且没有把"安全但停滞"变成劣势的机制。
3. **高光玩法与胜利脱节**：校准仪/泵/窑/精密器件是玩法亮点，但对"11 项科技"胜利贡献小且贵（precision-engineering 最晚）。
4. **生存不是主挑战**：活跃策略 minFood=0 常见但都在季末前恢复，困顿终止为 0；真正的瓶颈是科技积累速度。

## 建议的下一步小批量对照（未执行，供决策）

- **A. 阈值/路径**：`victoryPercent` 60→52（11→9 项）看 craftEconomy 胜率；或保留 11 但把工业链变便宜（precisionParts 材料减半、pottery 等级 2→1）让手艺玩家也能凑满。
- **B. 金钱 sink**：`workIncome` 2→1，或加每季 1 钱家庭维护，看 safe 的钱分布与科技数是否被推向投入。
- **C. 可发现性（非规则）**：胜利进度面板列出"还差 N 项 + 最便宜的待学科技"，或在引导中点明灌溉/选种链是快速凑科技路径。
- **D. 高光挂钩胜利**：设备首次运行授予专属科技或计入进度，让工业玩家也有胜利贡献。
