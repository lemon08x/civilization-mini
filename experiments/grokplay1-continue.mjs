// 本局玩家：Grok 4.6。只读 observeSession，经 FileRunStore.submit 提交。不是内置 scripted 七条之一。
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadContext, projectRoot } from '../dist/apps/cli/context.js';
import { FileRunStore } from '../dist/src/runtime/file-store.js';
import { observeSession } from '../dist/src/runtime/session.js';
import { metrics } from '../dist/src/research/metrics.js';

const { implementation } = await loadContext();
const store = new FileRunStore(join(projectRoot, 'artifacts/runs'), implementation);
let session = await store.load('grokplay1');
const log = [];

function legal(o, id) { return o.actions.some(a => a.id === id && a.enabled); }
function first(o, ids) { return ids.find(id => legal(o, id)) ?? null; }
function tech(o, id) { return o.technologies.find(t => t.id === id); }
function mastered(o, id) { return o.person.mastered.includes(id); }

function decide(observation) {
  const o = observation.game, p = o.production, d = o.development;
  if (legal(o, 'handover')) return { actionId: 'handover', reason: '本代窗口结束，交接家产与在制品，不复制个人技能。' };
  if (!o.actions.some(a => a.enabled)) return null;
  if (legal(o, 'finish-craft')) return { actionId: 'finish-craft', reason: '先完成已开工的木作，实践和产品都在完工时才结算。' };
  if (legal(o, 'finish-development')) return { actionId: 'finish-development', reason: '先完成已布置的工业工序。' };
  if (legal(o, 'finish-product')) return { actionId: 'finish-product', reason: '先完成已开工的设备装配。' };

  const hungry = o.family.food < o.parameters.foodPerTurn;
  if (hungry) {
    const id = first(o, [
      ...(p.gathering.food > 0 ? ['gather:food'] : []),
      ...(o.harvest.food > 0 ? ['cultivate'] : []),
      'buy-food', 'work', 'sell-good:woodenware',
    ]);
    if (id) return { actionId: id, reason: `口粮 ${o.family.food} 低于季耗 ${o.parameters.foodPerTurn}，先保生活：${id}` };
  }

  // 干旱且耕作预览为 0 时不耕；有可见收成且余粮不多时才耕。
  if (legal(o, 'cultivate') && o.harvest.food >= 2 && o.family.food <= o.parameters.foodPerTurn + 4) {
    return { actionId: 'cultivate', reason: `本季耕作预览 ${o.harvest.food} 粮，天气 ${o.world.weatherName}，补生活。` };
  }

  const ww = tech(o, 'woodworking');
  if (ww && !mastered(o, 'woodworking')) {
    if (ww.studied < ww.required && legal(o, 'study:woodworking')) {
      return { actionId: 'study:woodworking', reason: `当地有木作老师，理论 ${ww.studied}/${ww.required}；学一次后才能开工实践。` };
    }
    if (p.inventory.wood < p.parameters.woodRecipeCost) {
      const id = first(o, ['gather:wood', 'work']);
      if (id) return { actionId: id, reason: `木作实践需要 ${p.parameters.woodRecipeCost} 木材，现有 ${p.inventory.wood}。` };
    }
    if (legal(o, 'craft:woodenware')) return { actionId: 'craft:woodenware', reason: '理论已够，开工木容器作为木作实践。' };
  }

  if (mastered(o, 'woodworking') && !p.storage.woodenware) {
    if (legal(o, 'study:storage')) return { actionId: 'study:storage', reason: '已会木作，先学储存，用自制容器保护余粮。' };
    if (p.inventory.woodenware < 1) {
      if (p.inventory.wood < p.parameters.woodRecipeCost) {
        const id = first(o, ['gather:wood']);
        if (id) return { actionId: id, reason: '还没有容器，先采木做第一件用来配置储存。' };
      }
      if (legal(o, 'craft:woodenware')) return { actionId: 'craft:woodenware', reason: '做第一件木容器，留给储存配置，不卖掉。' };
    }
    if (legal(o, 'install-storage:woodenware')) return { actionId: 'install-storage:woodenware', reason: '配置木容器储存，降低季末损耗。' };
  }

  // 第一代后半：把木作传给后辈，避免交接空技能。
  if (o.clock.generation < o.clock.generations && mastered(o, 'woodworking') && legal(o, 'teach:woodworking')) {
    return { actionId: 'teach:woodworking', reason: '窗口未结束，先完成木作教导，再考虑多生产。' };
  }

  // 有余力再做容器换口粮，始终留出储存用的那一件。
  if (mastered(o, 'woodworking') && !p.project) {
    const keep = p.storage.woodenware ? 0 : 1;
    if (p.inventory.woodenware > keep && legal(o, 'sell-good:woodenware')) {
      return { actionId: 'sell-good:woodenware', reason: '卖掉多余木容器换钱，不把第一件储存容器卖掉。' };
    }
    if (p.inventory.wood < p.parameters.woodRecipeCost && p.gathering.wood > 0 && legal(o, 'gather:wood')) {
      return { actionId: 'gather:wood', reason: '木材不够下一件容器，林地有可采木材。' };
    }
    if (legal(o, 'craft:woodenware') && (p.market.woodenware > 0 || !p.storage.woodenware)) {
      return { actionId: 'craft:woodenware', reason: '继续做容器：有订单或尚未配置储存。' };
    }
  }

  if (o.family.food < 5 && p.gathering.food > 0 && legal(o, 'gather:food')) {
    return { actionId: 'gather:food', reason: `余粮 ${o.family.food} 偏紧，野食仍可采，先垫一口。` };
  }
  if (legal(o, 'work') && o.family.money < 4) return { actionId: 'work', reason: '钱偏少，做工换一点应急买粮的钱。' };
  if (legal(o, 'end-turn')) return { actionId: 'end-turn', reason: '本季没有更合适的可见行动，结束以免空耗。' };
  return null;
}

while (!['complete', 'ended'].includes(session.state.status)) {
  const observation = observeSession(session);
  const decision = decide(observation);
  if (!decision) throw new Error(`revision ${observation.revision} 无行动可选但未结束`);
  if (session.record.entries.length >= 200) throw new Error('本局达到 200 条命令，停止以免空转');
  const result = await store.submit('grokplay1', {
    commandId: `grokplay1:${observation.revision}`,
    expectedRevision: observation.revision,
    actionId: decision.actionId,
    reason: decision.reason,
  });
  session = result.session;
  const g = observeSession(session).game;
  const row = {
    revision: observation.revision,
    actionId: decision.actionId,
    reason: decision.reason,
    after: {
      status: g.status,
      generation: g.clock.generation,
      turn: g.clock.turn,
      ap: g.ap,
      food: g.family.food,
      money: g.family.money,
      weather: g.world.weatherName,
      mastered: g.person.mastered,
      heir: g.heir.mastered,
      wood: g.production.inventory.wood,
      woodenware: g.production.inventory.woodenware,
      storage: g.production.storage.woodenware,
      project: g.production.project?.recipe ?? null,
    },
  };
  log.push(row);
  console.log(`${row.revision}\t${row.actionId}\tG${row.after.generation}T${row.after.turn} food=${row.after.food} money=${row.after.money} | ${row.reason}`);
}

const final = metrics(session.record, session.state);
await writeFile(join(projectRoot, 'experiments/grokplay1-decisions.json'), JSON.stringify({
  researcher: 'Grok 4.6',
  controller: 'human/manual via observe+act',
  note: '遵守协议的代理实验：决策只依据观察；不是内置 scripted，也不是付费 API。',
  runId: 'grokplay1',
  commands: log.length,
  metrics: final,
  log,
}, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ done: true, status: session.state.status, commands: log.length, food: final.food, money: final.money, foodShortfall: final.foodShortfall, learned: final.learnedNodes, inherited: final.inheritedNodes }, null, 2));
