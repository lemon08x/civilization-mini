# Civilization Mini · 世代规则预研

当前规则 **0.27.0**（电气生产与现代通电验收）。玩法见 [CURRENT_GAMEPLAY_V27.md](docs/CURRENT_GAMEPLAY_V27.md)。业务流程与实现见 [SYSTEM_OVERVIEW.md](docs/SYSTEM_OVERVIEW.md)。

本仓库只维护这一版规则。没有离线研究模块、脚本策略或旧版本规则 JSON。

## 开始试玩

需要 Node.js 24+。

```powershell
npm ci
npm start
```

打开 http://127.0.0.1:4317 ：

- **人类玩家**：`/play`
- **AI 文本玩家**：`/ai` 或 [AI_PLAYER.md](docs/AI_PLAYER.md)。`scripts/player.mjs` 默认精简观察。

```powershell
npm run build
npm run lab -- new --run demo --seed 17 --scenario river
node scripts/player.mjs observe --run demo
node scripts/player.mjs act --run demo --revision 0 --action <可用行动ID>
npm test
```

`src/game/game.ts` 是唯一结算权威。存档写在 `artifacts/runs/`（不入库）或浏览器本地。
