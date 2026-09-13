// v8（被动投资/科技胜利）策略对照：4 策略 × 4 场景 × 4 种子 = 64 局。
// 全部脚本基线，不调用大模型；同一行动接口（createSession/submitCommand/observeSession），结算交给引擎。
// 目标：检验"历代去重掌握 11/17 项科技 + 季末生存"的胜利路径是否可达，以及卡点在哪。
import { loadContext } from '../dist/apps/cli/context.js';
import { createSession, submitCommand, observeSession } from '../dist/src/runtime/session.js';
import { writeFile } from 'node:fs/promises';

const { implementation, investmentBase } = await loadContext();
const RULES = investmentBase;
const SEEDS = [7, 17, 42, 256];
const SCENARIOS = ['river', 'dry', 'woodland', 'clay-valley'];

const H = id => o => o.actions.find(a => a.id === id && a.enabled);
const first = o => ids => { for (const id of ids) if (H(id)(o)) return id; return null; };
const mastered = o => id => o.person.mastered.includes(id);
const lvl = o => dom => o.development.skills.find(s => s.domain === dom)?.level ?? 0;
const tech = o => id => o.technologies.find(t => t.id === id);

// 11 项科技胜利路径（按拓扑序：前置在前）
const TECH11 = ['observation', 'resource-observation', 'controlled-fire', 'storage', 'woodworking', 'pottery', 'agronomy', 'ceramic-engineering', 'mechanics', 'experimentation', 'precision-engineering'];
const DEV_RECIPES = {
  supplies: { wood: 1, clay: 0, inputs: {} },
  ceramicParts: { wood: 2, clay: 2, inputs: {} },
  mechanisms: { wood: 3, clay: 0, inputs: { ceramicParts: 1 } },
  labTools: { wood: 1, clay: 0, inputs: { ceramicParts: 1, mechanisms: 1 } },
  precisionParts: { wood: 1, clay: 0, inputs: { ceramicParts: 2, mechanisms: 1, supplies: 1 } },
};
const DEV_PRICES = { supplies: 3, ceramicParts: 5, mechanisms: 8, fieldTools: 10, labTools: 12, precisionParts: 18 };

function eat(o, floor) {
  if (o.family.food >= floor) return null;
  const p = o.production;
  if (o.harvest.food > 0 && H('cultivate')(o)) return 'cultivate';
  if (p.gathering.food > 0 && H('gather:food')(o)) return 'gather:food';
  if (H('buy-food')(o)) return 'buy-food';
  return H('work')(o) ? 'work' : null;
}
const craftWood = o => { const p = o.production; if (p.project) return null; if (H('craft:woodenware')(o)) return 'craft:woodenware'; if (p.inventory.wood < p.parameters.woodRecipeCost) return first(o)(['gather:wood']); return first(o)(['gather:wood', 'work']); };
const craftPot = o => { const p = o.production; if (p.project) return null; if (H('craft:pottery')(o)) return 'craft:pottery'; if (p.inventory.clay < p.parameters.potteryClayCost) return first(o)(['gather:clay']); if (p.inventory.wood < p.parameters.potteryFuelCost) return first(o)(['gather:wood']); return first(o)(['gather:clay', 'gather:wood', 'work']); };
const firePr = o => first(o)(['practice:controlled-fire:fire-tended', 'gather:wood']);
function devProject(o, rec) {
  const d = o.development, p = o.production, r = DEV_RECIPES[rec];
  if (d.project) return null; // 有在制项目，顶部统一 finish
  if (H(`develop:${rec}`)(o)) return `develop:${rec}`;
  for (const [g, n] of Object.entries(r.inputs)) {
    if (d.goods[g] < n) {
      if (o.family.money >= DEV_PRICES[g] && H(`procure:${g}`)(o)) return `procure:${g}`;
      const base = { ceramicParts: 'ceramicParts', mechanisms: 'mechanisms', supplies: 'supplies' }[g];
      if (base) { const sub = devProject(o, base); if (sub) return sub; }
      return first(o)(['gather:wood', 'gather:clay', 'work']);
    }
  }
  if (r.clay && p.inventory.clay < r.clay) return first(o)(['gather:clay', 'work']);
  if (r.wood && p.inventory.wood < r.wood) return first(o)(['gather:wood', 'work']);
  return first(o)(['work', 'end-turn']);
}
function practiceAction(o, id, tag) {
  switch (tag) {
    case 'cultivation': return first(o)(['cultivate']);
    case 'resource-survey': return first(o)(['practice:resource-observation:resource-survey']);
    case 'fire-tended': return firePr(o);
    case 'storage-fitted': return first(o)(['install-storage:woodenware', 'install-storage:pottery']) ?? craftWood(o) ?? first(o)(['gather:wood', 'work']);
    case 'wood-shaped': return craftWood(o) ?? first(o)(['gather:wood', 'work']);
    case 'pot-fired': return craftPot(o) ?? first(o)(['gather:clay', 'work']);
    case 'development-agronomy': return devProject(o, 'supplies');
    case 'development-ceramic-engineering': return devProject(o, 'ceramicParts');
    case 'development-mechanics': return devProject(o, 'mechanisms');
    case 'development-experimentation': return first(o)(['conduct-experiment']) || devProject(o, 'labTools');
    case 'development-precision-engineering': return devProject(o, 'precisionParts');
    default: return first(o)([`practice:${id}:${tag}`]);
  }
}
function nextTech(o) {
  const has = mastered(o);
  for (const id of TECH11) {
    if (has(id)) continue;
    const t = tech(o)(id);
    const missingPre = t.prerequisites.filter(p => !has(p));
    return missingPre.length ? missingPre[0] : id;
  }
  return null;
}
function workOnTech(o, id) {
  const t = tech(o)(id), has = mastered(o);
  if (has(id)) return null;
  if (!t.accessible) return first(o)([`buy-method:${id}`, 'work']);
  if ((t.studied ?? 0) < t.required) return first(o)([`study:${id}`]);
  const missing = t.practices.find(tag => !t.practicesDone.includes(tag));
  if (!missing) return null;
  return practiceAction(o, id, missing);
}

// 1) techRush：冲 11 项科技胜利，粮食保底线 2
function techRush(o) {
  if (H('handover')(o)) return 'handover';
  if (!o.actions.some(a => a.enabled)) return null;
  const e = eat(o, 2); if (e) return e;
  if (o.production.project && H('finish-craft')(o)) return 'finish-craft';
  if (o.development.project && H('finish-development')(o)) return 'finish-development';
  const target = nextTech(o);
  if (target) { const r = workOnTech(o, target); if (r) return r; }
  return first(o)(['gather:wood', 'gather:clay', 'sell-good:woodenware', 'sell-good:pottery', 'work', 'end-turn']);
}
// 2) craftEconomy：先攒手艺与钱，再可持续学科技；粮食保底线 3
function craftEconomy(o) {
  const has = mastered(o);
  if (H('handover')(o)) return 'handover';
  if (!o.actions.some(a => a.enabled)) return null;
  const e = eat(o, 3); if (e) return e;
  if (o.production.project && H('finish-craft')(o)) return 'finish-craft';
  if (o.development.project && H('finish-development')(o)) return 'finish-development';
  // 先掌握能卖钱的手艺
  for (const id of ['woodworking', 'storage', 'controlled-fire', 'pottery']) { if (!has(id)) { const r = workOnTech(o, id); if (r) return r; } }
  // 有货就卖，换钱买料
  const sale = first(o)(['sell-good:woodenware', 'sell-good:pottery']); if (sale) return sale;
  // 再冲工业/科研科技
  for (const id of ['observation', 'agronomy', 'ceramic-engineering', 'mechanics', 'experimentation', 'precision-engineering', 'resource-observation']) { if (!has(id)) { const r = workOnTech(o, id); if (r) return r; } }
  return first(o)(['gather:wood', 'gather:clay', 'work', 'end-turn']);
}
// 3) specialist（沿用 v7 工业链）：冲校准仪/泵
function specialist(o) {
  const p = o.production, d = o.development, pn = o.productNetwork, has = mastered(o);
  if (H('handover')(o)) return 'handover';
  if (!o.actions.some(a => a.enabled)) return null;
  const e = eat(o, 2); if (e) return e;
  if (p.project && H('finish-craft')(o)) return 'finish-craft';
  if (d.project && H('finish-development')(o)) return 'finish-development';
  if (pn.project && H('finish-product')(o)) return 'finish-product';
  if (pn.goods.calibrator > 0 && pn.installed.calibrator === 0 && H('install-product:calibrator')(o)) return 'install-product:calibrator';
  if (pn.goods.pump > 0 && pn.installed.pump === 0 && H('install-product:pump')(o)) return 'install-product:pump';
  if (H('fabricate:calibrator')(o)) return 'fabricate:calibrator';
  if (H('fabricate:pump')(o)) return 'fabricate:pump';
  for (const [id, pr] of [['woodworking', craftWood], ['controlled-fire', firePr], ['pottery', craftPot]]) { if (!has(id)) { const r = workOnTech(o, id); if (r) return r; } }
  for (const id of ['agronomy', 'ceramic-engineering', 'mechanics', 'experimentation', 'precision-engineering']) { if (!has(id)) { const r = workOnTech(o, id); if (r) return r; } }
  if (lvl(o)('pottery') < 2) { const r = craftPot(o); if (r) return r; }
  if (d.goods.ceramicParts < 3) { const r = devProject(o, 'ceramicParts'); if (r) return r; }
  if (d.goods.mechanisms < 2) { const r = devProject(o, 'mechanisms'); if (r) return r; }
  if (d.goods.supplies < 1) { const r = devProject(o, 'supplies'); if (r) return r; }
  if (d.goods.labTools < 1) { const r = devProject(o, 'labTools'); if (r) return r; }
  const r = devProject(o, 'precisionParts'); if (r) return r;
  return first(o)(['deliver:precisionParts', 'deliver:mechanisms', 'sell-good:pottery', 'sell-good:woodenware', 'work', 'end-turn']);
}
// 4) safe：做工+采粮，不学科技（基线）
function safe(o) {
  if (H('handover')(o)) return 'handover';
  if (!o.actions.some(a => a.enabled)) return null;
  const e = eat(o, 4); if (e) return e;
  if (o.harvest.food > 0 && o.family.food < 10 && H('cultivate')(o)) return 'cultivate';
  return first(o)(['work', 'end-turn']);
}
const STRATS = { techRush, craftEconomy, specialist, safe };

async function runGame(strategy, scenario, seed) {
  let session = await createSession({ runId: `v8-${strategy}-${scenario}-${seed}`, ruleset: RULES, implementation, seed, scenarioId: scenario, agent: { kind: 'scripted', name: strategy } });
  let obs = observeSession(session);
  const M = { minFood: 99, hardship: 0, milestones: {}, won: false, winTurn: null, maxTech: 0 };
  let actions = 0;
  const note = (k, v) => { if (M.milestones[k] === undefined) M.milestones[k] = v; };
  while ((obs.game.status === 'active' || obs.game.status === 'handover') && actions < 800) {
    const g = obs.game;
    M.minFood = Math.min(M.minFood, g.family.food);
    M.maxTech = Math.max(M.maxTech, g.victory?.mastered.length ?? 0);
    if (g.victory?.achieved && !M.won) { M.won = true; M.winTurn = g.clock.absoluteTurn; }
    for (const id of TECH11) if (g.person.mastered.includes(id)) note('tech:' + id, g.clock.absoluteTurn);
    for (const good of ['ceramicParts', 'mechanisms', 'supplies', 'labTools', 'precisionParts']) if (g.development?.goods[good] > 0) note('made:' + good, g.clock.absoluteTurn);
    for (const dev of ['calibrator', 'pump', 'kiln']) if (g.productNetwork?.goods[dev] > 0) note('built:' + dev, g.clock.absoluteTurn);
    if (g.family.channel) note('channel', g.clock.absoluteTurn);
    const a = STRATS[strategy](g) ?? 'end-turn';
    const r = await submitCommand(session, { commandId: `x:${obs.revision}`, expectedRevision: obs.revision, actionId: a, reason: strategy });
    session = r.session; obs = observeSession(session); actions++;
    for (const ev of r.session.record.entries.at(-1).events) {
      if (ev.type === 'season-settled' && ev.missing > 0) M.hardship++;
      if (ev.type === 'technology-victory') { M.won = true; M.winTurn = ev.mastered; }
    }
  }
  const g = obs.game;
  return { strategy, scenario, seed, status: g.status, won: M.won, winTurn: M.winTurn, gen: g.clock.generation, money: g.family.money, food: g.family.food,
    minFood: M.minFood, hardship: M.hardship, tech: g.victory?.mastered.length ?? 0, maxTech: M.maxTech, target: g.victory?.required ?? 11,
    mastered: g.person.mastered.length, milestones: M.milestones, actions };
}

const results = [];
for (const strategy of Object.keys(STRATS)) for (const scenario of SCENARIOS) for (const seed of SEEDS) {
  const r = await runGame(strategy, scenario, seed);
  results.push(r);
  process.stderr.write(`\r${results.length}/64 ${strategy}/${scenario} s${seed} -> ${r.status} tech=${r.tech}/${r.target} won=${r.won} minFood=${r.minFood} hard=${r.hardship}`);
}
process.stderr.write('\n');
await writeFile('experiments/exp-v8-results.json', JSON.stringify(results, null, 2));

// ---- 汇总 ----
function agg(key) {
  const groups = {};
  for (const r of results) { const k = key(r); (groups[k] ??= []).push(r); }
  return Object.entries(groups).map(([k, g]) => {
    const n = g.length;
    const avg = f => Math.round(g.reduce((s, r) => s + f(r), 0) / n * 10) / 10;
    const pct = f => Math.round(g.filter(f).length / n * 100);
    return { k, n, won: pct(r => r.won), complete: pct(r => r.status === 'complete'), ended: pct(r => r.status === 'ended'),
      avgTech: avg(r => r.tech), avgMaxTech: avg(r => r.maxTech), winTurn: avg(g.filter(r => r.won).map(r => r.winTurn) .length ? g.filter(r => r.won).map(r => r.winTurn) : [0]),
      avgMoney: avg(r => r.money), avgMinFood: avg(r => r.minFood), avgHardship: avg(r => r.hardship) };
  });
}
console.log('\n===== 按策略×场景 =====');
for (const row of agg(r => r.strategy + '/' + r.scenario)) {
  console.log(`${row.k.padEnd(30)} n=${row.n} 胜=${row.won}% 完=${row.complete}% 困顿=${row.ended}% | 科技=${row.avgTech} 峰值=${row.avgMaxTech} 胜利季=${row.winTurn} | 钱=${row.avgMoney} 最低粮=${row.avgMinFood} 苦难=${row.avgHardship}`);
}
console.log('\n===== 按策略（跨场景） =====');
for (const row of agg(r => r.strategy)) {
  console.log(`${row.k.padEnd(30)} n=${row.n} 胜=${row.won}% 完=${row.complete}% 困顿=${row.ended}% | 科技=${row.avgTech} 峰值=${row.avgMaxTech} 胜利季=${row.winTurn} | 钱=${row.avgMoney} 最低粮=${row.avgMinFood} 苦难=${row.avgHardship}`);
}
console.log('\n===== 按场景（跨策略） =====');
for (const row of agg(r => r.scenario)) {
  console.log(`${row.k.padEnd(30)} n=${row.n} 胜=${row.won}% | 科技=${row.avgTech} 峰值=${row.avgMaxTech} | 钱=${row.avgMoney} 最低粮=${row.avgMinFood} 苦难=${row.avgHardship}`);
}
// 科技达成明细
console.log('\n===== techRush 各项科技达成率（跨场景/种子） =====');
const tr = results.filter(r => r.strategy === 'techRush');
for (const id of TECH11) {
  const pct = Math.round(tr.filter(r => r.milestones['tech:' + id]).length / tr.length * 100);
  const avgTurn = tr.filter(r => r.milestones['tech:' + id]).map(r => r.milestones['tech:' + id]);
  const at = avgTurn.length ? Math.round(avgTurn.reduce((a, b) => a + b, 0) / avgTurn.length) : '-';
  console.log(`${id.padEnd(24)} 达成=${pct}% 平均季=${at}`);
}
console.log('\n===== 困顿终止局的科技峰值（差多少） =====');
for (const r of results.filter(r => r.status === 'ended')) {
  console.log(`${r.strategy}/${r.scenario} s${r.seed} 困顿终止 科技=${r.tech}/${r.target} 峰值=${r.maxTech} 最低粮=${r.minFood}`);
}
