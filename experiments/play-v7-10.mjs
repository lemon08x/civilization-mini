// v7 十局：专精工业 / 水利 / 传承 / 控温窑 / 科学，覆盖不同玩法以评判手感。
// 同一行动接口（FileRunStore 落盘），结算交给引擎。
import { loadContext } from '../dist/apps/cli/context.js';
import { createSession, observeSession } from '../dist/src/runtime/session.js';
import { FileRunStore } from '../dist/src/runtime/file-store.js';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { implementation, pacingBase } = await loadContext();
const RULES = pacingBase;

const H = id => o => o.actions.find(a => a.id === id && a.enabled);
const first = o => ids => { for (const id of ids) if (H(id)(o)) return id; return null; };
const mastered = o => id => o.person.mastered.includes(id);
const lvl = o => dom => o.development.skills.find(s => s.domain === dom)?.level ?? 0;
const tech = o => id => o.technologies.find(t => t.id === id);

// 取粮：优先耕作（可持续），再采集，再批量/普通购买，最后做工换钱
function eat(o, floor) {
  if (o.family.food >= floor) return null;
  const p = o.production;
  if (o.harvest.food > 0 && H('cultivate')(o)) return 'cultivate';
  if (p.gathering.food > 0 && H('gather:food')(o)) return 'gather:food';
  if ((p.storage.woodenware || p.storage.pottery) && H('buy-food-bulk')(o)) return 'buy-food-bulk';
  if (H('buy-food')(o)) return 'buy-food';
  return H('work')(o) ? 'work' : null;
}
// 学一个科技：补前置 → 学习 → 实践（自动实践走对应生产动作）
function learn(o, id, doPractice) {
  const t = tech(o)(id), has = mastered(o);
  if (has(id)) return null;
  for (const p of t.prerequisites) if (!has(p)) { const r = learn(o, p, doPractice); if (r) return r; }
  if (!t.accessible) { const b = first(o)([`buy-method:${id}`, 'work']); if (b) return b; }
  if ((t.studied ?? 0) < t.required) { const s = first(o)([`study:${id}`]); if (s) return s; }
  return doPractice ? doPractice(o, id) : null;
}

// ---- 专精工业：冲精密器件 → 校准仪/提水泵 ----
function specialist(o) {
  const p = o.production, d = o.development, pn = o.productNetwork, has = mastered(o), L = lvl(o);
  if (H('handover')(o)) return 'handover';
  if (!o.actions.some(a => a.enabled)) return null;
  const e = eat(o, 2); if (e) return e;
  if (p.project && H('finish-craft')(o)) return 'finish-craft';
  if (d.project && H('finish-development')(o)) return 'finish-development';
  if (pn.project && H('finish-product')(o)) return 'finish-product';
  // 设备：装配 → 安装 → 操作
  if (pn.goods.calibrator > 0 && pn.installed.calibrator === 0 && H('install-product:calibrator')(o)) return 'install-product:calibrator';
  if (pn.installed.calibrator > 0 && H('calibrate')(o)) return 'calibrate';
  if (pn.goods.pump > 0 && pn.installed.pump === 0 && H('install-product:pump')(o)) return 'install-product:pump';
  if (pn.installed.pump > 0 && H('pump-water')(o)) return 'pump-water';
  if (H('fabricate:calibrator')(o)) return 'fabricate:calibrator';
  if (H('fabricate:pump')(o)) return 'fabricate:pump';
  // 基础方法（实践=制作）
  const craftWood = (o) => { if (!p.project) { const w = first(o)(['gather:wood']); if (w) return w; if (H('craft:woodenware')(o)) return 'craft:woodenware'; } return null; };
  const craftPot = (o) => { if (!p.project) { const c = first(o)(['gather:clay', 'gather:wood']); if (c) return c; if (H('craft:pottery')(o)) return 'craft:pottery'; } return null; };
  for (const [id, pr] of [['woodworking', craftWood], ['controlled-fire', (o) => first(o)(['practice:controlled-fire:fire-tended', 'gather:wood'])], ['pottery', craftPot]]) {
    const r = learn(o, id, pr); if (r) return r;
  }
  // 工业方法（实践=对应工业项目）
  const devPractice = (o, id) => { const map = { agronomy: 'supplies', mechanics: 'mechanisms', 'ceramic-engineering': 'ceramicParts', experimentation: 'labTools', 'precision-engineering': 'precisionParts' }; const rec = map[id]; if (H(`develop:${rec}`)(o)) return `develop:${rec}`; return first(o)(['gather:wood', 'gather:clay']); };
  for (const id of ['agronomy', 'ceramic-engineering', 'mechanics', 'experimentation', 'precision-engineering']) { const r = learn(o, id, devPractice); if (r) return r; }
  // 陶作 2 级（精密器件门槛）
  if (L('pottery') < 2) { const r = craftPot(o); if (r) return r; }
  // 工业品：构件(自制) → 机构/补给/实验器具(有钱就买) → 精密器件(自制)
  if (d.goods.ceramicParts < 3) { if (H('develop:ceramicParts')(o)) return 'develop:ceramicParts'; const m = first(o)(['gather:clay', 'gather:wood', 'procure:ceramicParts']); if (m) return m; }
  if (d.goods.mechanisms < 2) { if (o.family.money >= 8 && H('procure:mechanisms')(o)) return 'procure:mechanisms'; if (H('develop:mechanisms')(o)) return 'develop:mechanisms'; const m = first(o)(['gather:wood', 'procure:mechanisms']); if (m) return m; }
  if (d.goods.supplies < 1) { if (o.family.money >= 3 && H('procure:supplies')(o)) return 'procure:supplies'; if (H('develop:supplies')(o)) return 'develop:supplies'; const m = first(o)(['gather:wood', 'procure:supplies']); if (m) return m; }
  if (d.goods.labTools < 1) { if (o.family.money >= 12 && H('procure:labTools')(o)) return 'procure:labTools'; if (H('develop:labTools')(o)) return 'develop:labTools'; const m = first(o)(['gather:wood', 'procure:labTools']); if (m) return m; }
  if (H('develop:precisionParts')(o)) return 'develop:precisionParts';
  const pp = first(o)(['gather:clay', 'gather:wood', 'procure:precisionParts']); if (pp) return pp;
  return first(o)(['deliver:precisionParts', 'deliver:mechanisms', 'sell-good:pottery', 'sell-good:woodenware', 'work', 'end-turn']);
}

// ---- 水利：灌溉链 + 耕作 + 提水泵蓄水 ----
function water(o) {
  const p = o.production, has = mastered(o), pn = o.productNetwork;
  if (H('handover')(o)) return 'handover';
  if (!o.actions.some(a => a.enabled)) return null;
  const e = eat(o, 3); if (e) return e;
  if (p.project && H('finish-craft')(o)) return 'finish-craft';
  // 灌溉链（线性）：找第一个未掌握的推进——学习 → 实践（建渠即渠道实践）
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
  // 提水泵：蓄水补旱季
  if (pn.goods.pump > 0 && pn.installed.pump === 0 && H('install-product:pump')(o)) return 'install-product:pump';
  if (pn.installed.pump > 0 && pn.storedWater < 2 && H('pump-water')(o)) return 'pump-water';
  if (o.harvest.food > 0 && H('cultivate')(o)) return 'cultivate';
  return first(o)(['work', 'end-turn']);
}

// ---- 传承：掌握→归档→家学合授，最大化后辈 ----
function inheritance(o) {
  const p = o.production, has = mastered(o);
  if (H('handover')(o)) return 'handover';
  if (!o.actions.some(a => a.enabled)) return null;
  const e = eat(o, 2); if (e) return e;
  if (p.project && H('finish-craft')(o)) return 'finish-craft';
  const plan = ['woodworking', 'storage', 'controlled-fire', 'pottery'];
  const pr = {
    woodworking: (o) => { if (!p.project) { const w = first(o)(['gather:wood']); if (w) return w; if (H('craft:woodenware')(o)) return 'craft:woodenware'; } return null; },
    storage: (o) => first(o)(['install-storage:woodenware', 'install-storage:pottery']),
    'controlled-fire': (o) => first(o)(['practice:controlled-fire:fire-tended', 'gather:wood']),
    pottery: (o) => { if (!p.project) { const c = first(o)(['gather:clay', 'gather:wood']); if (c) return c; if (H('craft:pottery')(o)) return 'craft:pottery'; } return null; },
  };
  for (const id of plan) { const r = learn(o, id, pr[id]); if (r) return r; }
  for (const id of plan) if (has(id) && !o.family.archives.includes(id) && H(`archive:${id}`)(o)) return `archive:${id}`;
  if (o.clock.generation < o.clock.generations) for (const id of plan) if (has(id) && !o.heir.mastered.includes(id) && H(`teach:${id}`)(o)) return `teach:${id}`;
  return first(o)(['sell-good:woodenware', 'sell-good:pottery', 'work', 'end-turn']);
}

// ---- 控温窑 / 科学：在专精基础上加回收 / 实验改良 ----
function kiln(o) {
  const pn = o.productNetwork;
  if (pn.goods.kiln > 0 && pn.installed.kiln === 0 && H('install-product:kiln')(o)) return 'install-product:kiln';
  if (pn.installed.kiln > 0 && pn.goods.spentCeramics >= 2 && H('recycle-ceramics')(o)) return 'recycle-ceramics';
  if (H('fabricate:kiln')(o)) return 'fabricate:kiln';
  return specialist(o);
}
function science(o) {
  const d = o.development;
  if (d.goods.findings > 0 && d.goods.supplies > 0 && H('refine:pottery')(o)) return 'refine:pottery';
  if (H('conduct-experiment')(o)) return 'conduct-experiment';
  return specialist(o);
}

const POLICIES = { specialist, water, inheritance, kiln, science };

async function play({ runId, seed, scenario, policy }) {
  const store = new FileRunStore(join(root, 'artifacts', 'runs'), implementation);
  const { existsSync } = await import('node:fs');
  if (existsSync(join(root, 'artifacts', 'runs', runId, 'record.json'))) { console.log(JSON.stringify({ runId, skipped: true })); return; }
  let session = await createSession({ runId, ruleset: RULES, implementation, seed, scenarioId: scenario, agent: { kind: 'scripted', name: `v7b:${policy}` } });
  await store.create(session);
  let obs = observeSession(session);
  const milestones = {};
  const note = (k, v) => { if (milestones[k] === undefined) milestones[k] = v; };
  let actions = 0;
  while ((obs.game.status === 'active' || obs.game.status === 'handover') && actions < 800) {
    const a = POLICIES[policy](obs.game) ?? 'end-turn';
    const r = await store.submit(runId, { commandId: `${runId}:${obs.revision}`, expectedRevision: obs.revision, actionId: a, reason: `v7b:${policy}` });
    session = r.session; obs = observeSession(session); actions++;
    const g = obs.game, clk = g.clock.absoluteTurn;
    for (const good of ['ceramicParts', 'mechanisms', 'supplies', 'labTools', 'precisionParts']) if (g.development?.goods[good] > 0) note(`made:${good}`, clk);
    for (const dev of ['calibrator', 'pump', 'kiln']) { if (g.productNetwork?.goods[dev] > 0) note(`built:${dev}`, clk); if (g.productNetwork?.installed[dev] > 0) note(`installed:${dev}`, clk); }
    if (g.productNetwork?.goods.calibrations > 0) note('calibration-report', clk);
    if (g.family.channel) note('channel-built', clk);
    if (g.productNetwork?.storedWater > 0) note('stored-water', clk);
    if (g.development?.designs.pottery > 0 || g.development?.designs.woodwork > 0) note('refined', clk);
    if (g.development?.goods.findings > 0) note('findings', clk);
  }
  const g = obs.game;
  console.log(JSON.stringify({ runId, policy, scenario, status: g.status, gen: g.clock.generation, money: g.family.money, food: g.family.food,
    mastered: g.person.mastered, heir: g.heir.mastered, archives: g.family.archives,
    goods: g.development.goods, product: g.productNetwork.goods, installed: g.productNetwork.installed, milestones, actions }, null, 2));
}

const games = [
  { runId: 'v7b-s-17', seed: 17, scenario: 'clay-valley', policy: 'specialist' },
  { runId: 'v7b-s-23', seed: 23, scenario: 'clay-valley', policy: 'specialist' },
  { runId: 'v7b-s-42', seed: 42, scenario: 'clay-valley', policy: 'specialist' },
  { runId: 'v7b-s-55', seed: 55, scenario: 'clay-valley', policy: 'specialist' },
  { runId: 'v7b-w-17', seed: 17, scenario: 'river', policy: 'water' },
  { runId: 'v7b-w-23', seed: 23, scenario: 'river', policy: 'water' },
  { runId: 'v7b-i-17', seed: 17, scenario: 'clay-valley', policy: 'inheritance' },
  { runId: 'v7b-i-23', seed: 17, scenario: 'woodland', policy: 'inheritance' },
  { runId: 'v7b-k-17', seed: 17, scenario: 'clay-valley', policy: 'kiln' },
  { runId: 'v7b-x-23', seed: 23, scenario: 'clay-valley', policy: 'science' },
];
for (const g of games) await play(g);
