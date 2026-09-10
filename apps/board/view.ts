import type { GameEvent } from '../../src/game/model/events.js';
import type { GameAction } from '../../src/game/model/action.js';
import type { Ruleset } from '../../src/game/ruleset.js';
import type { Session } from '../../src/runtime/records.js';
import { observeSession } from '../../src/runtime/session.js';
import { collectStatistics, metrics } from '../../src/research/metrics.js';

function actionLabel(action: GameAction, rules: Ruleset): string {
  const names: Record<string, string> = { cultivate: '耕作并记录', work: '为邻里做工', 'buy-food': '买入 2 口粮', 'sell-food': '卖出 2 口粮', 'build-channel': '建设家用引水渠', 'repair-channel': '维修引水渠', 'prepare-seed': '准备候选种源', 'start-trial': '启动比较试种', 'end-turn': '结束本季', handover: '交接给后辈' };
  if ('nodeId' in action) {
    const name = rules.technologies.find(t => t.id === action.nodeId)?.name ?? action.nodeId;
    return `${{ study: '学习', practice: '实践', archive: '留存方法', teach: '教导后辈' }[action.type]}：${name}`;
  }
  if (action.type === 'release') return action.decision === 'keep' ? '定选：保留原种源' : '定选：采用候选种源';
  return names[action.type] ?? action.type;
}
export function formatEvents(events: GameEvent[], rules: Ruleset): string[] {
  const text: string[] = [];
  for (const event of events) {
    switch (event.type) {
      case 'action-paid': text.push(`${actionLabel(event.action, rules)}：消耗 ${event.cost.ap} 行动、${event.cost.money} 钱财、${event.cost.food} 口粮。`); break;
      case 'harvest': text.push(`收获 ${event.food} 口粮；水分缺口 ${event.deficit}，引水 ${event.drawn}。${event.channelExhausted ? '渠道需要维修。' : ''}`); break;
      case 'mastered': { const tech = rules.technologies.find(t => t.id === event.nodeId)!; text.push(`${event.role === 'active' ? '本代经营者' : '已成年的后辈'}掌握「${tech.name}」：${tech.benefit}`); break; }
      case 'trial-sampled': text.push(`试种记录 ${event.count}/${event.target}：原种源 ${event.sample.control}，候选 ${event.sample.candidate}（标准样地产量单位）。`); break;
      case 'trial-completed': text.push('比较试种完成。记录可以跨代保存；是否采用候选种源由你决定。'); break;
      case 'stock-selected': text.push(event.decision === 'adopt' ? '采用候选种源：旱地表现可能改善，丰水潜力较低。' : '保留原种源，研究信息仍存入家庭记录。'); break;
      case 'season-settled': text.push(`季末消耗 ${event.consumed} 口粮${event.missing ? `，缺口 ${event.missing}；连续困顿 ${event.hardship} 季` : '，基本生活得到满足'}。`); break;
      case 'season-started': text.push(`进入第 ${event.clock.generation} 代第 ${event.clock.turn} 季，天气：${{ dry: '干旱', normal: '平水', wet: '丰水' }[event.weather]}。`); break;
      case 'generation-ended': text.push(event.final ? '已到达实验观察终点；不代表家族死亡或游戏胜利。' : '本代经营窗口结束，请查看后辈实际学会什么，再交接。'); break;
      case 'experiment-ended': text.push('连续生活缺口达到实验终止条件；保留记录供分析。'); break;
      case 'handed-over': text.push('前代个人能力退出；后辈自己的学习记录、家学、实物与项目保留。年龄过程暂不模拟。'); break;
    }
  }
  return text;
}
export function boardView(session: Session) {
  const observation = observeSession(session), rules = session.record.manifest.ruleset;
  const { stats, history } = collectStatistics(session.record);
  return { ...observation.game, revision: observation.revision, stats, history, results: metrics(session.record, session.state), feedback: session.record.entries.length ? formatEvents(session.record.entries.at(-1)!.events, rules) : ['观察天气与家庭储备，再安排本季的三点行动。'], recentLog: session.record.entries.slice(-6).map(entry => ({ revision: entry.revision, actionId: entry.command.actionId, feedback: formatEvents(entry.events, rules) })) };
}
export type BoardView = ReturnType<typeof boardView>;
