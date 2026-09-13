// 专注测试：3 代 48 季内，激进策略能否触及工业链顶端（精密器件 / 产品网络）。
import { loadContext } from '../dist/apps/cli/context.js';
import { createSession, submitCommand, observeSession } from '../dist/src/runtime/session.js';
import { FileRunStore } from '../dist/src/runtime/file-store.js';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { implementation, base, pacingBase } = await loadContext();
const RULES = pacingBase; // v7

function decide(o) {
  const p = o.production, d = o.development;
  const legal = id => o.actions.find(a => a.id === id && a.enabled);
  const first = ids => { for (const id of ids) if (legal(id)) return id; return null; };
  const mastered = id => o.person.mastered.includes(id);
  const lvl = dom => d.skills.find(s => s.domain === dom)?.level ?? 0;
  const tech = id => o.technologies.find(t => t.id === id);
  const studied = id => tech(id)?.studied ?? 0;
  const req = id => tech(id)?.required ?? 1;

  if (legal('handover')) return 'handover';
  if (!o.actions.some(a => a.enabled)) return null;

  // 口粮：还缺补给就攒到 4，否则保 2
  const needFood = d.goods.supplies < 1 ? 4 : 2;
  if (o.family.food < needFood) { const f = first([...(p.gathering.food >= 2 ? ['gather:food'] : []), ...(o.family.money >= 2 ? ['buy-food'] : []), 'work']); if (f) return f; }

  // 收尾在制
  if (p.project && legal('finish-craft')) return 'finish-craft';
  if (d.project && legal('finish-development')) return 'finish-development';

  // 1) 基础方法：木作、控火、陶作（外来方法先买）
  if (!mastered('woodworking')) {
    if (!tech('woodworking').accessible) { const b = first(['buy-method:woodworking', 'work']); if (b) return b; }
    if (studied('woodworking') < req('woodworking')) { const s = first(['study:woodworking']); if (s) return s; }
    if (!p.project) { const w = first(['gather:wood']); if (w) return w; const c = legal('craft:woodenware') ? 'craft:woodenware' : null; if (c) return c; }
  }
  if (!mastered('controlled-fire')) {
    if (studied('controlled-fire') < req('controlled-fire')) { const s = first(['study:controlled-fire']); if (s) return s; }
    const pr = first(['practice:controlled-fire:fire-tended', 'gather:wood']); if (pr) return pr;
  }
  if (!mastered('pottery')) {
    if (!tech('pottery').accessible) { const b = first(['buy-method:pottery', 'work']); if (b) return b; }
    if (studied('pottery') < req('pottery')) { const s = first(['study:pottery']); if (s) return s; }
    if (!p.project) { const c = first(['gather:clay', 'gather:wood']); if (c) return c; const cr = legal('craft:pottery') ? 'craft:pottery' : null; if (cr) return cr; }
  }

  // 2) 工业方法：农艺、机械、陶构件、实验、精密（学习免费，优先学）
  for (const id of ['agronomy', 'mechanics', 'ceramic-engineering', 'experimentation', 'precision-engineering']) {
    if (!mastered(id) && studied(id) < req(id) && tech(id).accessible) { const s = first([`study:${id}`]); if (s) return s; }
  }

  // 3) 堆熟练度：陶作 2 级（精密器件门槛）——多做陶器
  if (lvl('pottery') < 2 && !p.project) {
    if (p.inventory.clay >= 2 && p.inventory.wood >= 2 && legal('craft:pottery')) return 'craft:pottery';
    const m = first(['gather:clay', 'gather:wood']); if (m) return m;
  }

  // 4) 生产工业品：补给 → 构件 → 机构 → 精密器件（缺料就采/购）
  if (d.goods.supplies < 1) {
    if (legal('develop:supplies')) return 'develop:supplies';
    const m = first(['gather:wood', 'procure:supplies']); if (m) return m;
  }
  if (d.goods.ceramicParts < 2) {
    if (legal('develop:ceramicParts')) return 'develop:ceramicParts';
    const m = first(['gather:clay', 'gather:wood', 'procure:ceramicParts']); if (m) return m;
  }
  if (d.goods.mechanisms < 1) {
    if (legal('develop:mechanisms')) return 'develop:mechanisms';
    const m = first(['gather:wood', 'procure:mechanisms']); if (m) return m;
  }
  // 精密器件（陶作 2 级 + 构件 2 + 机构 + 补给）
  if (legal('develop:precisionParts')) return 'develop:precisionParts';
  const pp = first(['gather:clay', 'gather:wood', 'procure:precisionParts']); if (pp) return pp;

  // 5) 交付赚钱 / 卖货 / 做工
  return first(['deliver:precisionParts', 'deliver:mechanisms', 'deliver:ceramicParts', 'deliver:supplies', 'sell-good:pottery', 'sell-good:woodenware', 'work', 'end-turn']);
}

async function play({ runId, seed, scenario }) {
  const store = new FileRunStore(join(root, 'artifacts', 'runs'), implementation);
  let session = await createSession({ runId, ruleset: RULES, implementation, seed, scenarioId: scenario, agent: { kind: 'scripted', name: 'play:devchain' } });
  await store.create(session);
  let obs = observeSession(session);
  const milestones = new Set();
  let actions = 0;
  const mark = (label) => { if (!milestones.has(label)) { milestones.add(label); console.error(`  [${obs.game.clock.generation}:${obs.game.clock.turn}] ${label}`); } };
  while ((obs.game.status === 'active' || obs.game.status === 'handover') && actions < 800) {
    const a = decide(obs.game) ?? 'end-turn';
    const r = await store.submit(runId, { commandId: `${runId}:${obs.revision}`, expectedRevision: obs.revision, actionId: a, reason: 'devchain' });
    session = r.session; obs = observeSession(session); actions++;
    const g = obs.game;
    for (const t of g.person.mastered) if (['mechanics', 'ceramic-engineering', 'precision-engineering'].includes(t)) mark(`掌握 ${t}`);
    if (g.development.goods.ceramicParts > 0) mark('产出陶质构件');
    if (g.development.goods.mechanisms > 0) mark('产出传动机构');
    if (g.development.goods.precisionParts > 0) mark('★ 产出精密器件');
    if (g.productNetwork.goods.calibrator > 0 || g.productNetwork.goods.pump > 0 || g.productNetwork.goods.kiln > 0) mark('★ 造出高级设备');
  }
  const g = obs.game;
  console.log(JSON.stringify({ runId, scenario, status: g.status, gen: g.clock.generation, money: g.family.money, food: g.family.food,
    mastered: g.person.mastered, goods: g.development.goods, product: g.productNetwork.goods, milestones: [...milestones] }, null, 2));
}

for (const seed of [17, 23, 42]) await play({ runId: `v7dc2-${seed}`, seed, scenario: 'clay-valley' });
