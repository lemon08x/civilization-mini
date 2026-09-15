# 试玩任务

- 批次编号：pt-20260914-162722-E40D
- 创建时间：2026-09-14 16:27（本地）
- 用户原始要求：按 playtests 中的规则玩十局这个游戏，然后说感受
- 体验目标：自由探索（默认），亲自逐步决策 10 局，观察 0.22.0 era 系统的实际体验
- 实际决策方式：当前模型逐步决策（通过 scripts/player.mjs observe / act / metrics）
- 模型名称/版本：未知（不猜测）
- 已知攻略或预先信息：无（自由探索，不读历史攻略）；入口文档已知 0.22.0 有 era 系统、学科/产品/系统三棵树、life.budget、socialFood 采购策略
- 计划局数：10
- 场景安排：按 river / clay-valley / woodland / dry 逐局轮换，g01=river, g02=clay-valley, g03=woodland, g04=dry, g05=river, g06=clay-valley, g07=woodland, g08=dry, g09=river, g10=clay-valley；不传种子，沿用入口默认
- 每局停止条件：`game.clock.absoluteTurn >= 25`（完成 24 季，即进入第 25 季）或 complete/ended 提前停止
- 每局行动保护上限：240 次已提交行动
- 规则/实现身份：各原档 manifest 为权威；本批未单独提取
- 批次状态：进行中

## 逐局登记

路径从项目根目录起算。结束时状态填实际观察值。停止原因使用：观察窗口、约定目标、终局、行动上限、中断、错误；一局只填主要原因。

| 局号 | run ID | 场景 | 原始记录路径 | 最新 revision / 季数 | 游戏状态 | 停止原因 | 实际决策方式 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| g01 | pt-20260914-162722-E40D-g01 | river | artifacts/runs/pt-20260914-162722-E40D-g01/record.json | rev 86 / 绝对季25（完成24季） | active | 观察窗口 | 当前模型逐步决策 |
| g02 | pt-20260914-162722-E40D-g02 | clay-valley | artifacts/runs/pt-20260914-162722-E40D-g02/record.json | rev 81 / 绝对季25（完成24季） | active | 观察窗口 | 当前模型逐步决策 |
| g02 | pt-20260914-162722-E40D-g02 | clay-valley | artifacts/runs/pt-20260914-162722-E40D-g02/record.json |  |  |  | 当前模型逐步决策 |
| g03 | pt-20260914-162722-E40D-g03 | woodland | artifacts/runs/pt-20260914-162722-E40D-g03/record.json |  |  |  | 当前模型逐步决策 |
| g04 | pt-20260914-162722-E40D-g04 | dry | artifacts/runs/pt-20260914-162722-E40D-g04/record.json |  |  |  | 当前模型逐步决策 |
| g05 | pt-20260914-162722-E40D-g05 | river | artifacts/runs/pt-20260914-162722-E40D-g05/record.json |  |  |  | 当前模型逐步决策 |
| g06 | pt-20260914-162722-E40D-g06 | clay-valley | artifacts/runs/pt-20260914-162722-E40D-g06/record.json |  |  |  | 当前模型逐步决策 |
| g07 | pt-20260914-162722-E40D-g07 | woodland | artifacts/runs/pt-20260914-162722-E40D-g07/record.json |  |  |  | 当前模型逐步决策 |
| g08 | pt-20260914-162722-E40D-g08 | dry | artifacts/runs/pt-20260914-162722-E40D-g08/record.json |  |  |  | 当前模型逐步决策 |
| g09 | pt-20260914-162722-E40D-g09 | river | artifacts/runs/pt-20260914-162722-E40D-g09/record.json |  |  |  | 当前模型逐步决策 |
| g10 | pt-20260914-162722-E40D-g10 | clay-valley | artifacts/runs/pt-20260914-162722-E40D-g10/record.json |  |  |  | 当前模型逐步决策 |

## 续接位置

- 当前目标与下一步待判断的问题：开始 g01（river 场景）开局
- 已遇到的错误或阻碍：无
- 剩余局数：10