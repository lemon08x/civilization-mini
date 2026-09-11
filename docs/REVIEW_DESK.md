# 规则与实验审阅页

启动网页后访问 `/review`，或从游戏底部点击“查看规则、科技关系与实验提案”。页面只读，不触发模拟，不修改规则、存档或历史报告。本次界面改动不改变规则版本 0.4.0 和领域实现指纹。

## 可以看到什么

- 规则总览：现行因果流程、明确未实现部分，以及基础/增量规则原文。
- 科技关系：从现行配置生成必要、替代和有利经验连线，点选节点查看学习、实践和地区来源。横向位置是依赖层级，不是文明排名；这不是当前人物的学习进度。
- 参数与权限：现值、白名单范围、是否允许候选覆盖。社会传承和设施配置仍未开放通用参数候选。本页不会扩大代理权限。
- 实验与提案：现有实验、原始身份、条件、候选差异、摘要和原始文件；提案的旧值/建议值/当前配置实际值、证据、副作用、决定与生效版本分别显示。

通用 `manifest.json + metrics.json` 和专项 `plan.json + results.json` 都能读取；逐局 JSON 可直接查看。失败或损坏文件显示提示，不覆盖源文件。显示原始记录不等于已在当前引擎重放验证；不会将历史指纹刷新为当前指纹。

## 后续如何提交研究建议

模拟结束不会自动产生 AI 提案。研究者先读轨迹，再将独立 JSON 写入 `experiments/proposals/<id>.proposal.json`；刷新页面即可发现。提案没有关联实验时使用空数组并标记待验证，不能伪造实验依据。

必需字段：

| 字段 | 内容 |
| --- | --- |
| schemaVersion / id / title | 固定格式版本 1、唯一英文小写 ID、标题 |
| kind | parameter / mechanism / strategy / interface |
| status | pending_validation / pending_decision / accepted / rejected / deferred |
| origin | 谁提出、是否真实模型调用，或是否根据历史报告整理 |
| question / hypothesis / counterEvidence | 问题、假设、可能推翻它的结果 |
| baseVersion / targetVersion | 起点规则版本、目标版本；未定目标可为 null |
| experiments | 对应 artifacts/experiments 下目录名数组 |
| evidence | 允许读取的 docs/、rulesets/、experiments/ 或 artifacts/experiments/ 下 .md/.json 路径数组 |
| changes | 每项含 subject、before、after，可选 configPath 对应当前规则属性路径 |
| result / sideEffects / decision | 实际验证结论、副作用、接受/拒绝/待研究的理由；尚未验证要直说 |
| adoptedVersion | 实际生效版本；未采纳为 null。accepted 必须记录版本 |

示例模板见 `experiments/proposals/template.example.json`。示例扩展名不是 `.proposal.json`，不会作为真实提案显示。历史三条提案依据已有报告整理，来源明确标为辅助开发研究，不能称为模型模拟自动产物。

状态不由钱财增长或脚本成功自动决定。正式接受时，完成实际开发、版本和必要验证后再更新提案的决定及生效版本；页面不会提供会直接覆盖规则的“采纳”按钮。当前配置与已接受提案数值不一致时，页面提示核对后续版本，而不改写历史决定。

## 读取边界

服务仅监听本机。审阅文件仅允许指定研究目录的 .md/.json，检查路径段和真实路径，拒绝越界链接、玩家存档目录和源码；单文件限 8 MB。接口仅接受 GET/HEAD。原始文件以文本显示，HTML 不执行。

新增目录或提案后点“刷新记录”；新增规则版本或修改启动时载入的规则配置后，需要重启服务。没有额外常驻 AI 循环，没有新增模型/API 调用，也没有重跑历史实验。
