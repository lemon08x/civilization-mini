import { lifeChronicle } from '../../src/research/life-chronicle.js';
import { NETWORK_NAMES } from '../../src/game/model/product-network.js';
import { PRODUCT_NAMES } from '../../src/game/systems/product-network.js';
import type { GameEvent } from '../../src/game/model/events.js';
import type { GameAction } from '../../src/game/model/action.js';
import type { Ruleset } from '../../src/game/ruleset.js';
import type { Session } from '../../src/runtime/records.js';
import { observeSession } from '../../src/runtime/session.js';
import { collectStatistics, metrics } from '../../src/research/metrics.js';
import { MATERIAL_NAMES, RECIPE_NAMES, WORKSHOP_NAMES } from '../../src/game/model/production.js';
import type { Material } from '../../src/game/model/production.js';

import { DISCIPLINE_NAMES, GOOD_NAMES } from '../../src/game/model/development.js';
import { DEVELOPMENT_RECIPES } from '../../src/game/systems/development.js';

function actionLabel(action: GameAction, rules: Ruleset): string {
  if(action.type==='fabricate'||action.type==='install-product')return (action.type==='fabricate'?'制造':'安装')+NETWORK_NAMES[action.device];
  if(action.type==='finish-product')return '完成高级设备';
  if(action.type==='calibrate')return '仪器校准';
  if(action.type==='pump-water')return '提取并储存公共水';
  if(action.type==='recycle-ceramics')return '回收烧结陶料';
  if (action.type === 'develop') return DEVELOPMENT_RECIPES.find(r => r.id === action.recipe)?.name ?? action.recipe;
  if (action.type === 'refine' || action.type === 'mentor') return (action.type === 'refine' ? '改良工艺：' : '带后辈实习：') + DISCIPLINE_NAMES[action.domain];
  if (action.type === 'procure' || action.type === 'deliver' || action.type === 'deliver-food') return (action.type === 'procure' ? '外购' : '交付') + GOOD_NAMES[action.good];
  if (action.type === 'equip') return action.kind === 'field' ? '装备农业设备' : '装备实验设备';
  if (action.type === 'finish-development') return '完成工业项目';
  if (action.type === 'conduct-experiment') return '开展材料对照实验';
  if (action.type === 'procure-clay') return '外购黏土';
  if (action.type === 'share') return `向邻里传授：${rules.technologies.find(t => t.id === action.nodeId)?.name ?? action.nodeId}`;
  if (action.type === 'entrust' || action.type === 'pause-contract') return `${action.type === 'entrust' ? '委托' : '暂停'}${WORKSHOP_NAMES[action.material]}`;
  if (action.type === 'buy-good') return `购买${MATERIAL_NAMES[action.material]}`;
  if (action.type === 'build-workshop') return `建造${WORKSHOP_NAMES[action.material]}`;
  if (action.type === 'craft-batch') return `批量制作${MATERIAL_NAMES[action.material]}`;
  if (action.type === 'gather') return `采集${action.resource === 'food' ? '食物' : MATERIAL_NAMES[action.resource]}`;
  if (action.type === 'craft') return `开始制作${RECIPE_NAMES[action.recipe]}`;
  if (action.type === 'finish-craft') return '完成制作项目';
  if (action.type === 'sell-good' || action.type === 'install-storage') return `${action.type === 'sell-good' ? '出售' : '配置储存'}：${MATERIAL_NAMES[action.material]}`;
  if (action.type === 'buy-method') return `取得外来方法：${rules.technologies.find(t => t.id === action.nodeId)?.name ?? action.nodeId}`;
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
      case 'technology-victory': text.push(`科技胜利：家族历代已掌握 ${event.mastered}/${event.total} 项科技，达到 ${event.required} 项门槛，并通过本季生存结算。`); break;
      case 'calibration-sold': text.push(`出售1校准报告，收入${event.money}钱，消耗1专业订单。`); break;
      case 'food-purchased': text.push(`从市场购入${event.amount}粮，扣减市场供给${event.money!==undefined?`，另从货款与现钱支付${event.money}钱`:""}。`); break;
      case 'product-started': text.push(NETWORK_NAMES[event.device]+'开工，已消耗：'+Object.entries(event.inputs).map(([id,n])=>n+' '+PRODUCT_NAMES[id as keyof typeof PRODUCT_NAMES]).join('、')+'。'); break;
      case 'product-completed': text.push(NETWORK_NAMES[event.device]+(rules.passiveInvestment?'装配完成；安装后自动运行。':'装配完成；安装后开启专用操作。')); break;
      case 'product-installed': text.push(NETWORK_NAMES[event.device]+'已安装，可用'+event.durability+'次。'); break;
      case 'product-operated': text.push(NETWORK_NAMES[event.device]+(rules.passiveInvestment?'自动运行完成（不花行动），':'操作完成，')+({calibrator:'消耗1记录和1补给，产出1校准报告',pump:'公共水减少1，家用蓄水增加1',kiln:'消耗2用后陶料，重制1陶质构件'}[event.device])+'；设备剩余'+event.remaining+'次。'); break;
      case 'ceramic-residue': text.push('实验留下'+event.amount+'用后陶料，可由控温窑回收。'); break;
      case 'stored-water-used': text.push('耕作使用'+event.amount+'家用蓄水，扣减储备。'); break;
      case 'experience-gained': text.push(DISCIPLINE_NAMES[event.domain] + '实践经验 +' + event.amount + '，该成员累计 ' + event.total + '。'); break;
      case 'development-started': text.push('工业项目已开工，原料已支付；投入部件：' + (Object.entries(event.inputs).map(([g,n]) => n + ' ' + GOOD_NAMES[g as keyof typeof GOOD_NAMES]).join('、') || '无') + '。'); break;
      case 'development-completed': text.push('完成 ' + event.amount + ' 件' + GOOD_NAMES[event.good] + '，获得实际制作经验。'); break;
      case 'experiment-conducted': text.push('消耗 1 补给与 1 陶质构件，获得 ' + event.amount + ' 份研究记录。' + (event.equipped ? '实验设备耐用度减少 1。' : '')); break;
      case 'design-refined': text.push(DISCIPLINE_NAMES[event.domain] + '家族工艺达到第 ' + event.rank + ' 阶，消耗 ' + event.rank + ' 研究记录与 1 补给，成果跨代保留。'); break;
      case 'development-traded': text.push((event.operation === 'buy' ? '购入' : '交付') + event.amount + ' 件' + GOOD_NAMES[event.good] + '，' + (event.operation === 'buy' ? '支付' : '收入') + event.money + ' 钱。'); break;
      case 'industrial-clay-bought': text.push('外部商人提供 ' + event.amount + ' 黏土，不改变当地矿藏。'); break;
      case 'development-equipped': text.push((event.kind === 'field' ? '农业' : '实验') + '设备已配置，可用 ' + event.durability + ' 次。'); break;
      case 'field-equipment-used': text.push('农业设备增加 1 收成，剩余耐用度 ' + event.remaining + '。'); break;
      case 'social-taught': text.push(`「${rules.technologies.find(t => t.id === event.nodeId)?.name}」${event.completed ? '邻里传授完成：成为当地教学来源；工艺可由学成匠人接续。' : '已向邻里讲授；还需一次指导实践。'}`); break;
      case 'contract-changed': text.push(`${WORKSHOP_NAMES[event.material]}委托${event.active ? '生效，合作关系跨代保留。' : '暂停，在制品保留。'}`); break;
      case 'contract-started': text.push(`受托匠人开工：支付 ${event.wage} 钱工资，从当地取得 ${event.wood} 木材、${event.clay} 黏土；之后季末完工，未发放货款。`); break;
      case 'contract-sold': text.push(`受托匠人完成并售出 ${event.amount} 件${MATERIAL_NAMES[event.material]}，家族收入 ${event.earnings} 钱，商品进入公共库存；不增加本人的制造技能。`); break;
      case 'contract-waiting': text.push(`${WORKSHOP_NAMES[event.material]}暂停生产：${event.reason}。`); break;
      case 'public-used': text.push(`邻里使用 ${event.amount} 件${MATERIAL_NAMES[event.material]}，扣减公共库存。`); break;
      case 'public-purchased': text.push(`花 ${event.price} 钱取得一件${MATERIAL_NAMES[event.material]}；使用与制造是不同能力。`); break;
      case 'workshop-built': text.push(`${WORKSHOP_NAMES[event.material]}建成！开放批量制作；相同原料下，两批产品的制作行动由 4 次减为 2 次。设施可留给后辈，使用仍需掌握手艺。`); break;
      case 'action-paid': text.push(`${actionLabel(event.action, rules)}：消耗 ${event.cost.ap} 行动、${event.cost.money} 钱财、${event.cost.food} 口粮${Object.entries(event.cost.materials ?? {}).map(([id, amount]) => `、${amount} ${MATERIAL_NAMES[id as Material]}`).join('')}。`); break;
      case 'resource-gathered': text.push(`取得 ${event.amount} ${event.resource === 'food' ? '口粮' : MATERIAL_NAMES[event.resource]}，当地可采剩余 ${event.remaining}。${event.toolUsed ? '工具耐用度减少 1。' : ''}`); break;
      case 'craft-started': text.push(`${event.batch ? '批量' : ''}${RECIPE_NAMES[event.recipe]}已成形，原料已支付。${event.recipe === 'pottery' ? '需跨季干燥后烧制。' : '还需一次装配行动。'}项目可以跨代接续。`); break;
      case 'craft-completed': text.push(`完成 ${event.amount} 件${RECIPE_NAMES[event.recipe]}，留下实际制作经验。${event.batch ? '本批比同产出的普通制作少用 2 制作行动（建设、采料、销售另计）。' : ''}`); break;
      case 'storage-installed': text.push(`已配置${MATERIAL_NAMES[event.material]}，现可保护 ${event.capacity} 余粮。`); break;
      case 'food-spoiled': text.push(`吃粮后保存结算：保护容量 ${event.protected}，未保护余粮损失 ${event.amount}。`); break;
      case 'goods-sold': text.push(`出售${MATERIAL_NAMES[event.material]}获得 ${event.earnings} 钱财，消耗当地需求。`); break;
      case 'method-acquired': text.push('外来方法已保存到家庭，可据此学习；尚未获得个人技能。'); break;
      case 'local-supply': text.push(`地区补给：可采食物 ${event.stocks.wildFood}、木材 ${event.stocks.timber}、黏土 ${event.stocks.clay}；岗位 ${event.market.jobs}、可售粮 ${event.market.food}。`); break;
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
  return { ...observation.game, chronicle:lifeChronicle(session.record), revision: observation.revision, stats, history, results: metrics(session.record, session.state), feedback: session.record.entries.length ? formatEvents(session.record.entries.at(-1)!.events, rules) : ['观察天气与家庭储备，再安排本季的三点行动。'], recentLog: session.record.entries.slice(-6).map(entry => ({ revision: entry.revision, actionId: entry.command.actionId, feedback: formatEvents(entry.events, rules) })) };
}
export type BoardView = ReturnType<typeof boardView>;
