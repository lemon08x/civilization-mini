# 试玩

AI 在这里读规则、开局笔记、逐步操作。结算仍在 `src/game`，存档不进本目录。

```text
playtests/
  AGENTS.md                 试玩约定
  START_HERE.md             新窗口从这里开始
  player.mjs                AI 受限入口（observe / act，默认精简观察）
  compact-observation.ts    精简观察
  templates/                批次模板
  batches/                  各批笔记与感受（不是游戏存档）
```

命令行游戏存档在项目根 `saves/<runId>/record.json`（gitignore）。网页存档在浏览器，开始界面打开或新开。
