// 验证实验：把科技胜利阈值从 11（60%）降到 9（53%），看"自然"策略能否稳定获胜。
// craftEconomy + specialist × 4 场景 × 2 种子 = 16 局。脚本基线，结算交给引擎。
import { loadContext } from '../dist/apps/cli/context.js';
import { createSession, submitCommand, observeSession } from '../dist/src/runtime/session.js';
import { writeFile } from 'node:fs/promises';

const { implementation, investmentBase } = await loadContext();
// 候选规则：仅改胜利阈值（60% → 53%，即 11 → 9 项），其余不变
const RULES = structuredClone(investmentBase);
RULES.passiveInvestment.victoryPercent = 53;

const SEEDS = [7, 17];
const SCENARIOS = ['river', 'dry', 'woodland', 'clay-valley'];

const H = id => o => o.actions.find(a => a.id === id && a.enabled);
const first = o => ids => { for (const id of ids) if (H(id)(o)) return id; return null; };
const mastered = o => id => o.person.mastered.includes(id);
const lvl = o => dom => o.development.skills.find(s => s.domain === dom)?.level ?? 0;
const tech = o => id => o.technologies.find(t => t.id === id);
const TECH11 = ['observation', 'resource-observation', 'controlled-fire', 'storage', 'woodworking', 'pottery', 'agronomy', 'ceramic-engineering', 'mechanics', 'experimentation', 'precision-engineering'];
const DEV_RECIPES = {
  supplies: { wood: 1, clay: 0, inputs: {} }, ceramicParts: { wood: 2, clay: 2, inputs: {} },
  mechanisms: { wood: 3, clay: 0, inputs: { ceramicParts: 1 } }, labTools: { wood: 1, clay: 0, inputs: { ceramicParts: 1, mechanisms: 1 } },
  precisionParts: { wood: 1, clay: 0, inputs: { ceramicParts: 2, mechanisms: 1, supplies: 1 } },
};
const DEV_PRICES = { supplies: 3, ceramicParts: 5, mechanisms: 8, labTools: 12, precisionParts: 18 };
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
  if (d.project) return null;
  if (H(`develop:${rec}`)(o)) return `develop:${rec}`;
  for (const [g, n] of Object.entries(r.inputs)) if (d.goods[g] < n) {
    if (o.family.money >= DEV_PRICES[g] && H(`procure:${g}`)(o)) return `procure:${g}`;
    const base = { ceramicParts: 'ceramicParts', mechanisms: 'mechanisms', supplies: 'supplies' }[g];
    if (base) { const sub = devProject(o, base); if (sub) return sub; }
    return first(o)(['gather:wood', 'gather:clay', 'work']);
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
  for (const id of TECH11) { if (has(id)) continue; const t = tech(o)(id); const mp = t.prerequisites.filter(p => !has(p)); return mp.length ? mp[0] : id; }
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
function craftEconomy(o) {
  const has = mastered(o);
  if (H('handover')(o)) return 'handover';
  if (!o.actions.some(a => a.enabled)) return null;
  const e = eat(o, 3); if (e) return e;
  if (o.production.project && H('finish-craft')(o)) return 'finish-craft';
  if (o.development.project && H('finish-development')(o)) return 'finish-development';
  for (const id of ['woodworking', 'storage', 'controlled-fire', 'pottery']) { if (!has(id)) { const r = workOnTech(o, id); if (r) return r; } }
  const sale = first(o)(['sell-good:woodenware', 'sell-good:pottery']); if (sale) return sale;
  for (const id of ['observation', 'agronomy', 'ceramic-engineering', 'mechanics', 'experimentation', 'precision-engineering', 'resource-observation']) { if (!has(id)) { const r = workOnTech(o, id); if (r) return r; } }
  return first(o)(['gather:wood', 'gather:clay', 'work', 'end-turn']);
}
function specialist(o) {
  const p = o.production, d = o.development, pn = o.productNetwork, has = mastered(o);
  if (H('handover')(o)) return 'handover';
  if (!o.actions.some(a => a.enabled)) return null;
  const e = eat(o, 2); if (e) return e;
  if (p.project && H('finish-craft')(o)) return 'finish-craft';
  if (d.project && H('finish-development')(o)) return 'finish-development';
  if (pn.project && H('finish-product')(o)) return 'finish-product';
  if (pn.goods.calibrator > 0 && pn.installed.calibrator === 0 && H('install-product:calibrator')(o)) return 'install-product:calibrator';
  if (H('fabricate:calibrator')(o)) return 'fabricate:calibrator';
  for (const [id] of [['woodworking'], ['controlled-fire'], ['pottery']]) { if (!has(id)) { const r = workOnTech(o, id); if (r) return r; } }
  for (const id of ['agronomy', 'ceramic-engineering', 'mechanics', 'experimentation', 'precision-engineering']) { if (!has(id)) { const r = workOnTech(o, id); if (r) return r; } }
  if (lvl(o)('pottery') < 2) { const r = craftPot(o); if (r) return r; }
  if (d.goods.ceramicParts < 3) { const r = devProject(o, 'ceramicParts'); if (r) return r; }
  if (d.goods.mechanisms < 2) { const r = devProject(o, 'mechanisms'); if (r) return r; }
  if (d.goods.supplies < 1) { const r = devProject(o, 'supplies'); if (r) return r; }
  const r = devProject(o, 'precisionParts'); if (r) return r;
  return first(o)(['deliver:precisionParts', 'deliver:mechanisms', 'sell-good:pottery', 'sell-good:woodenware', 'work', 'end-turn']);
}
const STRATS = { craftEconomy, specialist };

async function runGame(strategy, scenario, seed) {
  let session = await createSession({ runId: `v8t9-${strategy}-${scenario}-${seed}`, ruleset: RULES, implementation, seed, scenarioId: scenario, agent: { kind: 'scripted', name: strategy } });
  let obs = observeSession(session);
  const M = { minFood: 99, hardship: 0, won: false, winTurn: null, maxTech: 0 };
  let actions = 0;
  while ((obs.game.status === 'active' || obs.game.status === 'handover') && actions < 800) {
    const g = obs.game;
    M.minFood = Math.min(M.minFood, g.family.food);
    M.maxTech = Math.max(M.maxTech, g.victory?.mastered.length ?? 0);
    if (g.victory?.achieved && !M.won) { M.won = true; M.winTurn = g.clock.absoluteTurn; }
    const a = STRATS[strategy](g) ?? 'end-turn';
    const r = await submitCommand(session, { commandId: `x:${obs.revision}`, expectedRevision: obs.revision, actionId: a, reason: strategy });
    session = r.session; obs = observeSession(session); actions++;
    for (const ev of r.session.record.entries.at(-1).events) {
      if (ev.type === 'season-settled' && ev.missing > 0) M.hardship++;
      if (ev.type === 'technology-victory') { M.won = true; M.winTurn = g.clock.absoluteTurn; }
    }
  }
  const g = obs.game;
  return { strategy, scenario, seed, status: g.status, won: M.won, winTurn: M.winTurn, tech: g.victory?.mastered.length ?? 0, maxTech: M.maxTech, target: g.victory?.required ?? 9, minFood: M.minFood, hardship: M.hardship, money: g.family.money, actions };
}

const results = [];
for (const strategy of Object.keys(STRATS)) for (const scenario of SCENARIOS) for (const seed of SEEDS) {
  const r = await runGame(strategy, scenario, seed);
  results.push(r);
  process.stderr.write(`\r${results.length}/16 ${strategy}/${scenario} s${seed} -> ${r.status} tech=${r.tech}/${r.target} won=${r.won}@${r.winTurn}`);
}
process.stderr.write('\n');
await writeFile('experiments/exp-v8-threshold9.json', JSON.stringify(results, null, 2));
console.log('\n===== 阈值 9（53%）结果 =====');
for (const r of results) console.log(`${r.strategy.padEnd(14)} ${r.scenario.padEnd(12)} s${String(r.seed).padEnd(4)} ${r.status.padEnd(9)} 胜=${r.won}@${r.winTurn ?? '-'} 科技=${r.tech}/${r.target} 钱=${r.money} 最低粮=${r.minFood}`);
for (const s of Object.keys(STRATS)) {
  const v = results.filter(r => r.strategy === s);
  const won = v.filter(r => r.won);
  console.log(`\n${s}: 胜率=${Math.round(won.length / v.length * 100)}%  平均科技=${(v.reduce((a, r) => a + r.tech, 0) / v.length).toFixed(1)}  平均胜利季=${won.length ? Math.round(won.reduce((a, r) => a + r.winTurn, 0) / won.length) : '-'}`);
}
