// 十局试玩（观察驱动脚本基线，非大模型）：
// 目标是把农业起步打进窑场之后的水利/输电，并记录换代知识跌落与卡点。
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateRuleset } from '../dist/src/game/ruleset.js';
import { createSession, observeSession, submitCommand } from '../dist/src/runtime/session.js';
import { replayRecord } from '../dist/src/runtime/replay.js';
import { metrics } from '../dist/src/research/metrics.js';

const rules = validateRuleset(JSON.parse(await readFile('rulesets/agriculture-civilization.v15.json', 'utf8')));
const implementation = JSON.parse(await readFile('dist/implementation.json', 'utf8'));
const policyFingerprint = createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');
const output = `artifacts/experiments/play-ten-eval-${Date.now()}`;
await mkdir(output, { recursive: true });

const NEED = ['harvest', 'kiln', 'waterworks', 'grid', 'electronics', 'smart'];
const KEY_SUBJECTS = ['agronomy', 'mechanics', 'materials', 'heat', 'chemistry', 'organization'];

function can(o, id) { return o.game.actions.find(a => a.id === id)?.enabled ?? false; }
function amt(o, id) { return o.game.economy.goods[id] ?? 0; }
function lvl(o, subject) { return o.game.economy.disciplines.find(d => d.subject === subject)?.level ?? 0; }
function heirLvl(o, subject) { return o.game.economy.disciplines.find(d => d.subject === subject)?.heirLevel ?? 0; }
function notes(o, subject) { return o.game.economy.disciplines.find(d => d.subject === subject)?.notes ?? 0; }
function first(o, ids) { for (const id of ids) if (can(o, id)) return id; return null; }
function cartQty(o, id) { return o.game.economy.marketView?.quote.lines.find(l => l.item.id === id)?.quantity ?? 0; }
function knowledgeOf(o, personId) { return structuredClone(o.game.economy.knowledge[personId] ?? {}); }
function catalog(o, id) { return o.game.economy.expeditionView.catalog.find(c => c.id === id); }
function attempt(o, id) { return o.game.economy.expeditionView.attempts[id]; }

function nextExpedition(o) {
  for (const id of NEED) {
    const a = attempt(o, id);
    if (!a?.completed) return id;
  }
  return null;
}

function topicReady(o, subject) {
  const d = o.game.economy.disciplines.find(x => x.subject === subject);
  if (!d || d.level >= 10) return null;
  return d.topics.find(t => t.level === d.level + 1) ?? null;
}

function hasStudySource(o, topic, subject) {
  if (!topic) return false;
  if (topic.level === 1 || topic.evidence) return true;
  if ((o.game.economy.notes[subject] ?? 0) >= topic.level) return true;
  if ((o.game.economy.regional.teaching[subject] ?? 0) >= topic.level) return true;
  if (o.game.economy.shop.books.includes(topic.id)) return true;
  return false;
}

function buy(o, itemId, want) {
  const have = amt(o, itemId.replace(/^good-/, '')) + cartQty(o, itemId);
  if (have >= want && cartQty(o, itemId) > 0 && can(o, 'economy:checkout:cart')) return 'economy:checkout:cart';
  if (have >= want) return null;
  if (can(o, `economy:cartadd:${itemId}`)) return `economy:cartadd:${itemId}`;
  if (cartQty(o, itemId) > 0 && can(o, 'economy:checkout:cart')) return 'economy:checkout:cart';
  return null;
}

function farmLoop(o, crop = 'wheat') {
  const f = o.game.economy.field;
  if (f.crop && f.growth >= f.duration && can(o, `economy:farm:${f.crop}`)) return `economy:farm:${f.crop}`;
  if (!f.crop && amt(o, crop === 'wheat' ? 'seedWheat' : crop === 'soy' ? 'seedSoy' : 'seedFlax') > 0 && can(o, `economy:farm:${crop}`)) return `economy:farm:${crop}`;
  if (f.crop && f.growth < f.duration && can(o, `economy:farm:${f.crop}`)) return `economy:farm:${f.crop}`;
  return null;
}

function choose(o) {
  const g = o.game, e = g.economy, x = e.expeditionView, f = e.field;
  if (g.status === 'handover') return { id: 'handover', why: '换代交接' };
  if (g.status !== 'active') return { id: null, why: '局已结束' };
  if (e.operationsView?.paused && can(o, 'economy:resumeplans:family')) return { id: 'economy:resumeplans:family', why: '换代后接续经营' };
  if (can(o, 'economy:finish:project')) return { id: 'economy:finish:project', why: '完成本人在制' };

  const food = e.foodTotal;
  const goal = nextExpedition(o);
  const nearHandover = g.clock.turn >= 13;

  if (food < 3) {
    const farm = farmLoop(o, 'wheat'); if (farm) return { id: farm, why: '口粮危急，先种/收麦' };
    const id = first(o, ['economy:gather:food', 'economy:work:local']);
    if (id) return { id, why: '口粮危急，采集或做工' };
    const cart = buy(o, 'good-food', 2); if (cart) return { id: cart, why: '口粮危急，买粮' };
  }

  const farm = farmLoop(o, goal === 'waterworks' && (amt(o, 'flax') + amt(o, 'fiber')) < 4 && food >= 5 ? 'flax' : 'wheat');
  if (farm && (food < 8 || !f.crop || (f.crop && f.growth >= f.duration))) return { id: farm, why: '田间主线' };

  if (nearHandover) {
    for (const s of KEY_SUBJECTS) {
      if (lvl(o, s) > notes(o, s) && can(o, `economy:archive:${s}`)) return { id: `economy:archive:${s}`, why: `换代前留存${s}` };
    }
    for (const s of ['mechanics', 'materials', 'agronomy', 'heat', 'chemistry', 'organization']) {
      if (lvl(o, s) > heirLvl(o, s) && can(o, `economy:teach:${s}`)) return { id: `economy:teach:${s}`, why: `换代前教导${s}` };
    }
  }

  if (lvl(o, 'organization') >= 1 && !e.operations?.food && can(o, 'economy:foodplan:on')) return { id: 'economy:foodplan:on', why: '签供粮协议稳住生活' };
  if (lvl(o, 'organization') >= 3 && !e.operations?.charter && g.family.money >= 8 && can(o, 'economy:charter:family')) return { id: 'economy:charter:family', why: '订家族契约，减少换代停摆' };

  if (goal && x.selected !== goal && can(o, `economy:expeditionstart:${goal}`)) {
    if (x.selected && x.attempts[x.selected]?.active && can(o, 'economy:expeditionpause:current')) return { id: 'economy:expeditionpause:current', why: '暂停当前副本以换更高阶' };
    return { id: `economy:expeditionstart:${goal}`, why: `启动${goal}` };
  }
  if (goal && x.selected === goal) {
    const spec = catalog(o, goal), a = attempt(o, goal);
    if (spec && a && !a.completed && a.active) {
      const missing = Object.entries(spec.kit).some(([gid, n]) => (a.stock[gid] ?? 0) < n);
      const kitFood = Object.entries(spec.kit).reduce((s, [gid, n]) => s + ((gid === 'wheat' || gid === 'soy' || gid === 'flour') ? n : 0), 0);
      if (missing && food - kitFood >= 2 && can(o, 'economy:expeditionship:current')) return { id: 'economy:expeditionship:current', why: `装运${goal}` };
    }
  }

  const needed = {
    harvest: ['agronomy'],
    kiln: ['materials', 'heat'],
    waterworks: ['mechanics', 'materials', 'agronomy', 'chemistry'],
    grid: ['mechanics', 'materials', 'heat', 'chemistry'],
    electronics: ['mechanics', 'materials', 'organization'],
    smart: ['mechanics', 'materials', 'organization'],
  }[goal] ?? KEY_SUBJECTS;
  const targets = { harvest: { agronomy: 1 }, kiln: { materials: 2, heat: 1 }, waterworks: { mechanics: 3, materials: 3, agronomy: 2, chemistry: 1 }, grid: { mechanics: 8, materials: 8, heat: 7, chemistry: 8 }, electronics: { mechanics: 9, materials: 9, organization: 8 }, smart: { mechanics: 10, materials: 10, organization: 10 } }[goal] ?? {};

  for (const s of needed) {
    const topic = topicReady(o, s);
    if (!topic || (targets[s] && lvl(o, s) >= targets[s] && !nearHandover)) continue;
    if (hasStudySource(o, topic, s) && can(o, `economy:study:${topic.id}`)) return { id: `economy:study:${topic.id}`, why: `学习${topic.id}` };
    if (can(o, `economy:tuition:${topic.id}`)) return { id: `economy:tuition:${topic.id}`, why: `授课${topic.id}` };
  }
  for (const s of needed) {
    const topic = topicReady(o, s);
    if (!topic || (targets[s] && lvl(o, s) >= targets[s])) continue;
    if (hasStudySource(o, topic, s)) continue;
    if (can(o, `economy:research:${topic.id}`)) return { id: `economy:research:${topic.id}`, why: `实验${topic.id}` };
  }

  if (goal === 'kiln' || (goal === 'waterworks' && amt(o, 'ceramics') < 1 && !e.equipment.F02)) {
    if (can(o, 'economy:process:ceramics') && amt(o, 'ceramics') < 6) return { id: 'economy:process:ceramics', why: '烧陶取窑场证据/构件' };
    if (can(o, 'economy:build:F02')) return { id: 'economy:build:F02', why: '建陶窑' };
    if (amt(o, 'clay') < 4 && can(o, 'economy:gather:clay')) return { id: 'economy:gather:clay', why: '采黏土建窑' };
    if (amt(o, 'wood') < 2 && can(o, 'economy:gather:wood')) return { id: 'economy:gather:wood', why: '采木烧窑' };
  }

  if (goal === 'waterworks') {
    if (can(o, 'economy:build:T03')) return { id: 'economy:build:T03', why: '锻打工具，才能出轴' };
    if (can(o, 'economy:process:shaft') && amt(o, 'shaft') < 2) return { id: 'economy:process:shaft', why: '加工传动轴（水利证据）' };
    if (can(o, 'economy:process:seal') && amt(o, 'seal') < 2) return { id: 'economy:process:seal', why: '做密封件' };
    if (can(o, 'economy:process:rope') && amt(o, 'rope') < 1) return { id: 'economy:process:rope', why: '搓绳' };
    if (can(o, 'economy:process:fiber') && amt(o, 'fiber') < 3) return { id: 'economy:process:fiber', why: '打纤维' };
    if (can(o, 'economy:process:oil') && amt(o, 'oil') < 1) return { id: 'economy:process:oil', why: '榨油做密封件' };
    const soyFarm = farmLoop(o, 'soy');
    if (amt(o, 'soy') < 3 && soyFarm && food >= 6) return { id: soyFarm, why: '种大豆榨油' };
    for (const [item, n] of [['good-shaft', 2], ['good-seal', 2], ['good-rope', 1], ['good-fiber', 3], ['good-oil', 1], ['good-flax', 4], ['good-iron', 2]]) {
      const b = buy(o, item, n); if (b && g.family.money >= 6) return { id: b, why: `商城补${item}` };
    }
    if (can(o, 'economy:build:S01') && !e.equipment.S01) return { id: 'economy:build:S01', why: '基础容器，减少坏粮' };
  }

  if (goal === 'grid' || goal === 'electronics' || goal === 'smart') {
    if (can(o, 'economy:build:P01')) return { id: 'economy:build:P01', why: '手摇传动' };
    if (can(o, 'economy:build:P03')) return { id: 'economy:build:P03', why: '水轮，发电机前置' };
    if (can(o, 'economy:build:E01')) return { id: 'economy:build:E01', why: '水力发电机' };
    if (can(o, 'economy:build:F07')) return { id: 'economy:build:F07', why: '化工设备出聚合物' };
    if (can(o, 'economy:process:polymer')) return { id: 'economy:process:polymer', why: '聚合物' };
    if (can(o, 'economy:process:wire')) return { id: 'economy:process:wire', why: '铜线' };
    if (can(o, 'economy:process:coil')) return { id: 'economy:process:coil', why: '线圈（输电证据）' };
    if (can(o, 'economy:process:cable')) return { id: 'economy:process:cable', why: '电缆' };
    for (const [item, n] of [['good-copper', 3], ['good-feedstock', 4], ['good-polymer', 2], ['good-wire', 4], ['good-coil', 1], ['good-cable', 1], ['good-iron', 2]]) {
      const b = buy(o, item, n); if (b && g.family.money >= 10) return { id: b, why: `商城补${item}` };
    }
  }

  if (can(o, 'economy:publish:mechanics') && lvl(o, 'mechanics') >= 3) return { id: 'economy:publish:mechanics', why: '传播力学，后辈可走地区教学' };
  if (can(o, 'economy:publish:materials') && lvl(o, 'materials') >= 3) return { id: 'economy:publish:materials', why: '传播材料学' };

  if (!nearHandover) {
    for (const s of KEY_SUBJECTS) {
      if (lvl(o, s) > notes(o, s) && can(o, `economy:archive:${s}`)) return { id: `economy:archive:${s}`, why: `平时留存${s}` };
    }
  }

  if (amt(o, 'wood') < 4 && can(o, 'economy:gather:wood')) return { id: 'economy:gather:wood', why: '备木材' };
  if (amt(o, 'clay') < 2 && can(o, 'economy:gather:clay')) return { id: 'economy:gather:clay', why: '备黏土' };
  if (g.family.money < 12 && can(o, 'economy:work:local')) return { id: 'economy:work:local', why: '攒钱' };
  if (food < 6) {
    const more = farmLoop(o, 'wheat'); if (more) return { id: more, why: '补粮缓冲' };
    const gath = first(o, ['economy:gather:food']); if (gath) return { id: gath, why: '采集食物' };
  }
  if (can(o, 'economy:end:season')) return { id: 'economy:end:season', why: '本季无更高优先级行动' };
  return { id: null, why: '无可用行动' };
}

function snapshot(o, extra = {}) {
  const x = o.game.economy.expeditionView;
  return {
    generation: o.game.clock.generation,
    turn: o.game.clock.turn,
    season: o.game.clock.absoluteTurn,
    status: o.game.status,
    food: o.game.economy.foodTotal,
    money: o.game.family.money,
    supply: x.supplyLevel,
    completed: Object.fromEntries(NEED.map(id => [id, !!attempt(o, id)?.completed])),
    knowledge: Object.fromEntries(KEY_SUBJECTS.map(s => [s, lvl(o, s)])),
    heir: Object.fromEntries(KEY_SUBJECTS.map(s => [s, heirLvl(o, s)])),
    notes: Object.fromEntries(KEY_SUBJECTS.map(s => [s, notes(o, s)])),
    books: [...o.game.economy.shop.books],
    equipment: { ...o.game.economy.equipment },
    goods: structuredClone(o.game.economy.goods),
    ...extra,
  };
}

const games = [
  { runId: 'e01', seed: 17, scenario: 'river' },
  { runId: 'e02', seed: 17, scenario: 'clay-valley' },
  { runId: 'e03', seed: 17, scenario: 'woodland' },
  { runId: 'e04', seed: 17, scenario: 'dry' },
  { runId: 'e05', seed: 23, scenario: 'river' },
  { runId: 'e06', seed: 23, scenario: 'clay-valley' },
  { runId: 'e07', seed: 23, scenario: 'woodland' },
  { runId: 'e08', seed: 23, scenario: 'dry' },
  { runId: 'e09', seed: 42, scenario: 'river' },
  { runId: 'e10', seed: 42, scenario: 'woodland' },
];

const results = [];
for (const game of games) {
  let session = await createSession({
    runId: game.runId, ruleset: rules, implementation, seed: game.seed, scenarioId: game.scenario,
    agent: { kind: 'scripted', id: 'play-ten-eval', policyFingerprint },
  });
  const handovers = [];
  const expeditionHits = {};
  const walls = [];
  const counts = {};
  let actions = 0, idle = 0, lastGoal = null, lastGoalSeason = 0;
  const maxActions = 360;
  while (!['complete', 'ended'].includes(session.state.status) && actions < maxActions) {
    const o = observeSession(session);
    const pick = choose(o);
    if (!pick.id) break;
    const goal = nextExpedition(o);
    if (goal !== lastGoal) { lastGoal = goal; lastGoalSeason = o.game.clock.absoluteTurn; }
    else if (goal && o.game.clock.absoluteTurn - lastGoalSeason >= 24 && !walls.some(w => w.goal === goal && w.season === lastGoalSeason)) {
      const spec = catalog(o, goal);
      walls.push({ goal, season: o.game.clock.absoluteTurn, generation: o.game.clock.generation, blockers: spec?.entryBlockers ?? [], kitBlockers: spec?.blockers ?? [], knowledge: snapshot(o).knowledge, money: o.game.family.money, food: o.game.economy.foodTotal });
    }
    const beforeStatus = o.game.status;
    const result = await submitCommand(session, { actionId: pick.id, commandId: `p${o.revision}`, expectedRevision: o.revision, reason: pick.why });
    session = result.session; actions++;
    counts[pick.id.split(':').slice(0, 2).join(':')] = (counts[pick.id.split(':').slice(0, 2).join(':')] ?? 0) + 1;
    idle = pick.id === 'economy:end:season' ? idle + 1 : 0;
    if (idle >= 10) break;
    const after = observeSession(session);
    for (const id of NEED) {
      if (!expeditionHits[id] && attempt(after, id)?.completed) {
        expeditionHits[id] = { season: after.game.clock.absoluteTurn, generation: after.game.clock.generation, action: actions };
      }
    }
    if (beforeStatus === 'handover' && after.game.status === 'active') {
      handovers.push(snapshot(after, { afterHandover: true, previous: snapshot(o) }));
    }
  }
  const replayed = await replayRecord(session.record, implementation);
  const o = observeSession(replayed);
  const m = metrics(replayed.record, replayed.state);
  const ev = replayed.record.entries.flatMap(e => e.events);
  const learned = ev.filter(e => e.type === 'economy-learned');
  const row = {
    runId: game.runId, scenario: game.scenario, seed: game.seed,
    end: snapshot(o),
    commands: m.commands,
    shortfall: ev.filter(e => e.type === 'season-settled').reduce((n, e) => n + e.missing, 0),
    hardshipFails: ev.filter(e => e.type === 'experiment-ended').length,
    expeditionHits,
    handovers: handovers.map(h => ({
      generation: h.generation, season: h.season, food: h.food, money: h.money,
      knowledge: h.knowledge, heirWas: h.previous?.heir, notes: h.notes, books: h.books,
    })),
    walls,
    counts,
    studyEvents: learned.length,
    teachEvents: learned.filter(e => e.source === 'teach').length,
    replayOk: true,
  };
  results.push(row);
  const line = `${game.runId} ${game.scenario} seed${game.seed} gen${row.end.generation}s${row.end.season} ${row.end.status} food${row.end.food} money${row.end.money} supply${row.end.supply} done=${NEED.filter(id => row.end.completed[id]).join(',') || 'none'} walls=${walls.map(w => w.goal).join(',') || 'none'}`;
  console.log(line);
}

const report = {
  question: '十局试玩：农业起步后中后期难度跳跃、换代重学成本是否过大',
  rulesVersion: rules.rulesVersion,
  implementation,
  policyFingerprint,
  method: '观察驱动脚本基线（非大模型）。每局上限360行动。优先口粮、副本、换代前留存/教导、再推进水利/输电生产链。',
  results,
};
await writeFile(output + '/report.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log('wrote', output + '/report.json');
