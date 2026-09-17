# Civilization Mini · 世代规则预研

当前规则 **0.27.0**（电气生产与现代通电验收）。玩法见 [CURRENT_GAMEPLAY_V27.md](docs/CURRENT_GAMEPLAY_V27.md)。目录与分层见 [ARCHITECTURE.md](docs/ARCHITECTURE.md)。改机制或改数值见 [AGENTS.md](AGENTS.md)。文档目录见 [docs/README.md](docs/README.md)。

本仓库只维护这一版规则。没有离线研究模块、脚本策略或旧版本规则 JSON。

## 开始试玩

需要 Node.js 24+。

```powershell
npm ci
npm start
```

打开 http://127.0.0.1:4317 ：

- **人类玩家**：`/play`
- **AI 文本玩家**：`/ai` 或 [AI_PLAYER.md](docs/AI_PLAYER.md)。`playtests/player.mjs` 默认精简观察。

```powershell
npm run build
npm run lab -- new --run demo --seed 17 --scenario river
node playtests/player.mjs observe --run demo
node playtests/player.mjs act --run demo --revision 0 --action <可用行动ID>
```

`src/game/game.ts` 是唯一结算权威。网页从开始界面打开存档或新开；命令行存档在 `saves/`（不入库）。
