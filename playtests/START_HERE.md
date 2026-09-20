# 新窗口从这里开始

当前不保存试玩记录：下文的批次编号仅用于 run ID，不创建批次目录、不复制模板、不写 brief、notes、feedback 或观察快照。任务、逐局停止原因与感受直接在对话中反馈。游戏运行所需的 `saves/` 存档保持现有管理方式。本条优先于下文旧记录流程。

适用于“自己玩几局，然后说感受”。先读本目录 `AGENTS.md`。

## 1. 建立独立批次

使用 `pt-YYYYMMDD-HHMMSS-短随机后缀` 作为批次编号，仅用于 run ID，不创建批次目录或复制模板。

采用用户要求的局数；未指定时默认 1 局。未指定停止条件时，默认每局完成前 24 季：观察进入第 25 季（`clock.absoluteTurn >= 25`）时停止，或在 `complete / ended` 时提前停止。另设每局 240 次已提交行动的保护上限。用户指定的目标优先。

开始前向用户简短说明局数、决策方式和停止条件即可。不要改成自动策略。

## 2. 准备一局

run ID 使用 `<批次编号>-g01`、`-g02` 等，只含字母、数字、短横线、下划线，总长不超过 80 字符。游戏运行所需存档由现有入口保存在 `saves/<run ID>/record.json`，不额外复制或提交。

先确认已有可用的 `dist/`。仅在开局准备阶段允许：

```powershell
npm run lab -- new --run pt-20260913-150000-a7c2-g01 --scenario river
```

默认场景按 `river / clay-valley / woodland / dry` 逐局轮换。默认不传种子。同名存档已存在时不要覆盖，改 run ID 或先 `lab -- delete`。

没有构建或开局失败时在对话中报告错误，不擅自重建或覆盖。

## 3. 模型逐步操作

```powershell
node playtests/player.mjs observe --run pt-20260913-150000-a7c2-g01
```

默认是精简观察。提交时用真实的 `revision` 和 `actionId`：

```text
node playtests/player.mjs act --run <run ID> --revision <最新 revision> --action <当前 actionId> --reason "当前观察下选择此行动的简短理由"
```

`act` 已返回最新精简观察，可以据此做下一次决策。科技树、产品、系统或全部不可用原因用 `--section branches|industry|systems|actions-disabled`。完整观察使用 `--format text`。

只根据公开观察决策。操作命令可以通过终端执行，但不能放入自动选行动的程序。

## 4. 收尾与感受

结合最后观察，在对话中反馈具体感受、逐局状态、实际停止原因与完成范围。结论关联 run ID 与 revision 或季数，区分观察、推测和建议；不写记录文件，不自动改规则。

当前规则 0.27.0：学科、产品、系统，外加人生、购粮、社会阶段与电气。观察 `game.economy.branchView`、`industryView`、`life.budget`、`socialFood`、`era`。
