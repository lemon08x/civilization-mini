// 96 局实验：7 策略 × 场景 × 8 种子。内存跑（快），采集指标，输出汇总。
// 同一行动接口（createSession/submitCommand/observeSession），结算交给引擎。
import { loadContext } from '../dist/apps/cli/context.js';
import { createSession, submitCommand, observeSession } from '../dist/src/runtime/session.js';
import { writeFile } from 'node:fs/promises';
const { implementation, pacingBase } = await loadContext();
const RULES = pacingBase;
const SEEDS = [7, 17, 23, 42, 55, 99, 123, 256];

const H = id => o => o.actions.find(a => a.id === id && a.enabled);
const first = o => ids => { for (const id of ids) if (H(id)(o)) return id; return null; };
const mastered = o => id => o.person.mastered.includes(id);
const lvl = o => dom => o.development.skills.find(s => s.domain === dom)?.level ?? 0;
const tech = o => id => o.technologies.find(t => t.id === id);

function eat(o, floor) {
  if (o.family.food >= floor) return null;
  const p = o.production;
  if (o.harvest.food > 0 && H('cultivate')(o)) return 'cultivate';
  if (p.gathering.food > 0 && H('gather:food')(o)) return 'gather:food';
  if ((p.storage.woodenware || p.storage.pottery) && H('buy-food-bulk')(o)) return 'buy-food-bulk';
  if (H('buy-food')(o)) return 'buy-food';
  return H('work')(o) ? 'work' : null;
}
function learn(o, id, doPractice) {
  const t = tech(o)(id), has = mastered(o);
  if (has(id)) return null;
  for (const p of t.prerequisites) if (!has(p)) { const r = learn(o, p, doPractice); if (r) return r; }
  if (!t.accessible) { const b = first(o)([`buy-method:${id}`, 'work']); if (b) return b; }
  if ((t.studied ?? 0) < t.required) { const s = first(o)([`study:${id}`]); if (s) return s; }
  return doPractice ? doPractice(o, id) : null;
}
const craftWood = o => { const p = o.production; if (!p.project) { const w = first(o)(['gather:wood']); if (w) return w; if (H('craft:woodenware')(o)) return 'craft:woodenware'; } return null; };
const craftPot = o => { const p = o.production; if (!p.project) { const c = first(o)(['gather:clay', 'gather:wood']); if (c) return c; if (H('craft:pottery')(o)) return 'craft:pottery'; } return null; };
const firePr = o => first(o)(['practice:controlled-fire:fire-tended', 'gather:wood']);
const devPr = (o, id) => { const map = { agronomy: 'supplies', mechanics: 'mechanisms', 'ceramic-engineering': 'ceramicParts', experimentation: 'labTools', 'precision-engineering': 'precisionParts' }; const rec = map[id]; if (H(`develop:${rec}`)(o)) return `develop:${rec}`; return first(o)(['gather:wood', 'gather:clay']); };

// 1) 专精：自制+外购，冲校准仪
function specialist(o) {
  const p = o.production, d = o.development, pn = o.productNetwork, has = mastered(o), L = lvl(o);
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
  for (const [id, pr] of [['woodworking', craftWood], ['controlled-fire', firePr], ['pottery', craftPot]]) { const r = learn(o, id, pr); if (r) return r; }
  for (const id of ['agronomy', 'ceramic-engineering', 'mechanics', 'experimentation', 'precision-engineering']) { const r = learn(o, id, devPr); if (r) return r; }
  if (L('pottery') < 2) { const r = craftPot(o); if (r) return r; }
  if (d.goods.ceramicParts < 3) { if (H('develop:ceramicParts')(o)) return 'develop:ceramicParts'; const m = first(o)(['gather:clay', 'gather:wood', 'procure:ceramicParts']); if (m) return m; }
  if (d.goods.mechanisms < 2) { if (o.family.money >= 8 && H('procure:mechanisms')(o)) return 'procure:mechanisms'; if (H('develop:mechanisms')(o)) return 'develop:mechanisms'; const m = first(o)(['gather:wood', 'procure:mechanisms']); if (m) return m; }
  if (d.goods.supplies < 1) { if (o.family.money >= 3 && H('procure:supplies')(o)) return 'procure:supplies'; if (H('develop:supplies')(o)) return 'develop:supplies'; const m = first(o)(['gather:wood', 'procure:supplies']); if (m) return m; }
  if (d.goods.labTools < 1) { if (o.family.money >= 12 && H('procure:labTools')(o)) return 'procure:labTools'; if (H('develop:labTools')(o)) return 'develop:labTools'; const m = first(o)(['gather:wood', 'procure:labTools']); if (m) return m; }
  if (H('develop:precisionParts')(o)) return 'develop:precisionParts';
  const pp = first(o)(['gather:clay', 'gather:wood', 'procure:precisionParts']); if (pp) return pp;
  return first(o)(['deliver:precisionParts', 'deliver:mechanisms', 'sell-good:pottery', 'sell-good:woodenware', 'work', 'end-turn']);
}
// 2) 工业+用设备：造出后校准/蓄水/回收
function industrialUse(o) {
  const d = o.development, pn = o.productNetwork;
  if (pn.installed.calibrator > 0 && H('calibrate')(o)) return 'calibrate';
  if (pn.installed.pump > 0 && pn.storedWater < 2 && H('pump-water')(o)) return 'pump-water';
  if (pn.installed.kiln > 0 && pn.goods.spentCeramics >= 2 && H('recycle-ceramics')(o)) return 'recycle-ceramics';
  if (pn.goods.kiln > 0 && pn.installed.kiln === 0 && H('install-product:kiln')(o)) return 'install-product:kiln';
  if (H('fabricate:kiln')(o)) return 'fabricate:kiln';
  if (d.goods.supplies > 0 && d.goods.ceramicParts > 0 && H('conduct-experiment')(o)) return 'conduct-experiment';
  return specialist(o);
}
// 3) 纯自制（不外购）：想外购时改走自制/采料
function aggressiveDev(o) {
  const r = specialist(o);
  if (r && r.startsWith('procure:')) {
    const devMap = { ceramicParts: 'develop:ceramicParts', mechanisms: 'develop:mechanisms', supplies: 'develop:supplies', labTools: 'develop:labTools', precisionParts: 'develop:precisionParts' };
    const good = r.slice(8);
    if (H(devMap[good])(o)) return devMap[good];
    return first(o)(['gather:wood', 'gather:clay']);
  }
  return r;
}
// 4) 手作生活：稳定手艺 + 卖货 + 传承
function craftLife(o) {
  const p = o.production, has = mastered(o);
  if (H('handover')(o)) return 'handover';
  if (!o.actions.some(a => a.enabled)) return null;
  const e = eat(o, 3); if (e) return e;
  if (p.project && H('finish-craft')(o)) return 'finish-craft';
  for (const [id, pr] of [['woodworking', craftWood], ['storage', o => first(o)(['install-storage:woodenware', 'install-storage:pottery'])], ['controlled-fire', firePr], ['pottery', craftPot]]) { const r = learn(o, id, pr); if (r) return r; }
  if (o.clock.generation < o.clock.generations) for (const id of ['woodworking', 'storage', 'controlled-fire', 'pottery']) if (has(id) && !o.heir.mastered.includes(id) && H(`teach:${id}`)(o)) return `teach:${id}`;
  return first(o)(['sell-good:woodenware', 'sell-good:pottery', 'work', 'end-turn']);
}
// 5) 水利灌溉
function water(o) {
  const p = o.production, has = mastered(o), pn = o.productNetwork;
  if (H('handover')(o)) return 'handover';
  if (!o.actions.some(a => a.enabled)) return null;
  const e = eat(o, 3); if (e) return e;
  if (p.project && H('finish-craft')(o)) return 'finish-craft';
  const target = ['observation', 'survey', 'ditch', 'allocation'].find(id => !has(id));
  if (target) {
    const t = tech(o)(target);
    if ((t.studied ?? 0) < t.required && t.accessible) { const s = first(o)([`study:${target}`]); if (s) return s; }
    if (target === 'ditch' && !o.family.channel) { const b = first(o)(['build-channel']); if (b) return b; }
    if (target === 'observation') { const c = first(o)(['cultivate']); if (c) return c; }
    if (target === 'survey') { const c = first(o)(['practice:survey:survey']); if (c) return c; }
    if (target === 'allocation') { const c = first(o)(['practice:allocation:water-plan', 'cultivate']); if (c) return c; }
    return null;
  }
  if (o.family.channel?.durability === 0) { const r = first(o)(['repair-channel']); if (r) return r; }
  if (pn.goods.pump > 0 && pn.installed.pump === 0 && H('install-product:pump')(o)) return 'install-product:pump';
  if (pn.installed.pump > 0 && pn.storedWater < 2 && H('pump-water')(o)) return 'pump-water';
  if (o.harvest.food > 0 && H('cultivate')(o)) return 'cultivate';
  return first(o)(['work', 'end-turn']);
}
// 6) 保守：做工+采粮，少折腾
function safe(o) {
  if (H('handover')(o)) return 'handover';
  if (!o.actions.some(a => a.enabled)) return null;
  const e = eat(o, 4); if (e) return e;
  if (o.harvest.food > 0 && o.family.food < 10 && H('cultivate')(o)) return 'cultivate';
  return first(o)(['work', 'end-turn']);
}
// 7) 传承专注：掌握+归档+家学合授
function inheritance(o) {
  const p = o.production, has = mastered(o);
  if (H('handover')(o)) return 'handover';
  if (!o.actions.some(a => a.enabled)) return null;
  const e = eat(o, 2); if (e) return e;
  if (p.project && H('finish-craft')(o)) return 'finish-craft';
  const plan = ['woodworking', 'storage', 'controlled-fire', 'pottery'];
  const pr = { woodworking: craftWood, storage: o => first(o)(['install-storage:woodenware', 'install-storage:pottery']), 'controlled-fire': firePr, pottery: craftPot };
  for (const id of plan) { const r = learn(o, id, pr[id]); if (r) return r; }
  for (const id of plan) if (has(id) && !o.family.archives.includes(id) && H(`archive:${id}`)(o)) return `archive:${id}`;
  if (o.clock.generation < o.clock.generations) for (const id of plan) if (has(id) && !o.heir.mastered.includes(id) && H(`teach:${id}`)(o)) return `teach:${id}`;
  return first(o)(['sell-good:woodenware', 'sell-good:pottery', 'work', 'end-turn']);
}
const STRATS = { specialist, industrialUse, aggressiveDev, craftLife, water, safe, inheritance };

async function runGame(strategy, scenario, seed) {
  let session = await createSession({ runId: `exp-${strategy}-${scenario}-${seed}`, ruleset: RULES, implementation, seed, scenarioId: scenario, agent: { kind: 'scripted', name: strategy } });
  let obs = observeSession(session);
  const M = { minFood: 99, hardship: 0, milestones: {}, maxCalibrations: 0, maxStoredWater: 0, recycled: 0, maxFindings: 0, handovers: [] };
  let actions = 0;
  const note = (k, v) => { if (M.milestones[k] === undefined) M.milestones[k] = v; };
  while ((obs.game.status === 'active' || obs.game.status === 'handover') && actions < 800) {
    const g = obs.game;
    M.minFood = Math.min(M.minFood, g.family.food);
    M.maxCalibrations = Math.max(M.maxCalibrations, g.productNetwork?.goods.calibrations ?? 0);
    M.maxStoredWater = Math.max(M.maxStoredWater, g.productNetwork?.storedWater ?? 0);
    M.maxFindings = Math.max(M.maxFindings, g.development?.goods.findings ?? 0);
    for (const good of ['ceramicParts', 'mechanisms', 'supplies', 'labTools', 'precisionParts']) if (g.development?.goods[good] > 0) note('made:' + good, g.clock.absoluteTurn);
    for (const dev of ['calibrator', 'pump', 'kiln']) { if (g.productNetwork?.goods[dev] > 0) note('built:' + dev, g.clock.absoluteTurn); if (g.productNetwork?.installed[dev] > 0) note('installed:' + dev, g.clock.absoluteTurn); }
    if (g.family.channel) note('channel', g.clock.absoluteTurn);
    const a = STRATS[strategy](g) ?? 'end-turn';
    const r = await submitCommand(session, { commandId: `x:${obs.revision}`, expectedRevision: obs.revision, actionId: a, reason: strategy });
    session = r.session; obs = observeSession(session); actions++;
    for (const ev of r.session.record.entries.at(-1).events) {
      if (ev.type === 'season-settled' && ev.missing > 0) M.hardship++;
      if (ev.type === 'recycle-ceramics' || (ev.type === 'development-completed' && ev.recipe === 'recycle')) M.recycled++;
      if (ev.type === 'generation-ended') M.handovers.push({ gen: ev.facts.generation, heir: ev.facts.heir.length, active: ev.facts.mastered.length });
    }
  }
  const g = obs.game;
  return { strategy, scenario, seed, status: g.status, gen: g.clock.generation, money: g.family.money, food: g.family.food,
    minFood: M.minFood, hardship: M.hardship, mastered: g.person.mastered.length, milestones: M.milestones,
    calibrations: M.maxCalibrations, storedWater: M.maxStoredWater, recycled: M.recycled, findings: M.maxFindings, handovers: M.handovers, actions };
}

const MATRIX = [
  ['specialist', 'clay-valley'], ['specialist', 'woodland'],
  ['industrialUse', 'clay-valley'], ['aggressiveDev', 'clay-valley'],
  ['craftLife', 'woodland'], ['water', 'river'], ['water', 'dry'],
  ['safe', 'clay-valley'], ['safe', 'river'], ['safe', 'woodland'], ['safe', 'dry'],
  ['inheritance', 'clay-valley'],
];
const results = [];
for (const [strategy, scenario] of MATRIX) for (const seed of SEEDS) {
  const r = await runGame(strategy, scenario, seed);
  results.push(r);
  process.stderr.write(`\r${results.length}/96 ${strategy}/${scenario} s${seed} -> ${r.status} cal=${r.milestones['built:calibrator'] ?? '-'} pump=${r.milestones['built:pump'] ?? '-'} minFood=${r.minFood} hard=${r.hardship}`);
}
process.stderr.write('\n');
await writeFile('experiments/exp-100-results.json', JSON.stringify(results, null, 2));

// ---- 汇总 ----
function agg(key) {
  const groups = {};
  for (const r of results) { const k = key(r); (groups[k] ??= []).push(r); }
  const rows = Object.entries(groups).map(([k, g]) => {
    const n = g.length;
    const avg = f => Math.round(g.reduce((s, r) => s + f(r), 0) / n * 10) / 10;
    const pct = f => Math.round(g.filter(f).length / n * 100);
    return { k, n, survived: pct(r => r.status === 'complete'),
      cal: pct(r => r.milestones['built:calibrator']), pump: pct(r => r.milestones['built:pump']), kiln: pct(r => r.milestones['built:kiln']),
      precParts: pct(r => r.milestones['made:precisionParts']), mechanisms: pct(r => r.milestones['made:mechanisms']),
      channel: pct(r => r.milestones['channel']), calibrated: pct(r => r.calibrations > 0), pumped: pct(r => r.storedWater > 0), recycled: pct(r => r.recycled > 0),
      avgMoney: avg(r => r.money), avgMinFood: avg(r => r.minFood), avgHardship: avg(r => r.hardship), avgMastered: avg(r => r.mastered) };
  });
  return rows;
}
console.log('\n===== 按策略×场景汇总 =====');
for (const row of agg(r => r.strategy + '/' + r.scenario)) {
  console.log(`${row.k.padEnd(28)} n=${row.n} 活=${row.survived}% 校准仪=${row.cal}% 泵=${row.pump}% 窑=${row.kiln}% 精密件=${row.precParts}% 机构=${row.mechanisms}% 渠=${row.channel}% | 用过校准=${row.calibrated}% 蓄水=${row.pumped}% 回收=${row.recycled}% | 钱=${row.avgMoney} 最低粮=${row.avgMinFood} 苦难=${row.avgHardship} 科技=${row.avgMastered}`);
}
console.log('\n===== 按策略汇总（跨场景） =====');
for (const row of agg(r => r.strategy)) {
  console.log(`${row.k.padEnd(28)} n=${row.n} 活=${row.survived}% 校准仪=${row.cal}% 泵=${row.pump}% 窑=${row.kiln}% 精密件=${row.precParts}% | 用过校准=${row.calibrated}% 蓄水=${row.pumped}% 回收=${row.recycled}% | 钱=${row.avgMoney} 最低粮=${row.avgMinFood} 苦难=${row.avgHardship} 科技=${row.avgMastered}`);
}
console.log('\n===== 按场景汇总（跨策略） =====');
for (const row of agg(r => r.scenario)) {
  console.log(`${row.k.padEnd(28)} n=${row.n} 活=${row.survived}% 校准仪=${row.cal}% 精密件=${row.precParts}% 渠=${row.channel}% | 钱=${row.avgMoney} 最低粮=${row.avgMinFood} 苦难=${row.avgHardship}`);
}
// 传承效果
console.log('\n===== 传承：末代交接时后辈掌握数 =====');
for (const row of agg(r => r.strategy)) {
  const last = results.filter(r => r.strategy === row.k).map(r => r.handovers.at(-1)?.heir ?? 0);
  console.log(`${row.k.padEnd(28)} 后辈平均掌握=${(last.reduce((a, b) => a + b, 0) / last.length).toFixed(1)}`);
}
