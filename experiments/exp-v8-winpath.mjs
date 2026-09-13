// v8 获胜路径实验：winPath 策略瞄准"最便宜的 11 项科技"（灌溉/选种链为主，工业链为辅）。
// 4 场景 × 4 种子 = 16 局。脚本基线，不调用大模型；结算交给引擎。
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
const tech = o => id => o.technologies.find(t => t.id === id);

// 最便宜的 11 项（拓扑序，前置在前）；工业链放最后作为备选
const WIN11 = ['observation', 'resource-observation', 'controlled-fire', 'woodworking', 'storage', 'survey', 'selection', 'ditch', 'allocation', 'pottery', 'trial'];
const FALLBACK = ['stabilize', 'experimentation', 'agronomy', 'ceramic-engineering', 'mechanics', 'precision-engineering'];

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

function workOn(o, id) {
  const t = tech(o)(id), has = mastered(o);
  if (has(id)) return null;
  if (!t.accessible) return first(o)([`buy-method:${id}`, 'work']);
  if ((t.studied ?? 0) < t.required) return first(o)([`study:${id}`]);
  const missing = t.practices.find(tag => !t.practicesDone.includes(tag));
  if (!missing) return null;
  switch (missing) {
    case 'cultivation': return first(o)(['cultivate']);
    case 'resource-survey': return first(o)(['practice:resource-observation:resource-survey']);
    case 'fire-tended': return first(o)(['practice:controlled-fire:fire-tended', 'gather:wood']);
    case 'wood-shaped': return craftWood(o) ?? first(o)(['gather:wood', 'work']);
    case 'storage-fitted': return first(o)(['install-storage:woodenware', 'install-storage:pottery']) ?? craftWood(o) ?? first(o)(['gather:wood', 'work']);
    case 'survey': return first(o)(['practice:survey:survey']);
    case 'selection': return first(o)(['practice:selection:selection']);
    case 'channel-model': return first(o)(['build-channel', 'work']);
    case 'water-plan': return first(o)(['practice:allocation:water-plan']) ?? (o.family.channel?.durability ? null : first(o)(['build-channel', 'work']));
    case 'pot-fired': return craftPot(o) ?? first(o)(['gather:clay', 'work']);
    case 'trial-completed':
      if (!o.family.candidate) return first(o)(['prepare-seed', 'work']);
      if (!o.family.project) return first(o)(['start-trial', 'work']);
      return first(o)(['cultivate']); // 已耕作则返回 null，下季吃粮时再采样
    case 'stock-release': {
      const samples = o.family.reports.at(-1)?.samples ?? [];
      const diff = samples.reduce((s, x) => s + x.candidate - x.control, 0);
      return first(o)([`release:${diff > 0 ? 'adopt' : 'keep'}`]);
    }
    default: return first(o)([`practice:${id}:${tag}`]);
  }
}
function winPath(o) {
  if (H('handover')(o)) return 'handover';
  if (!o.actions.some(a => a.enabled)) return null;
  const e = eat(o, 2); if (e) return e;
  if (o.production.project && H('finish-craft')(o)) return 'finish-craft';
  if (o.development.project && H('finish-development')(o)) return 'finish-development';
  // 试种在制：够采样就继续耕作
  if (o.family.project && o.family.project.samples.length < 2 && H('cultivate')(o)) return 'cultivate';
  const has = mastered(o);
  const plan = [...WIN11, ...FALLBACK.filter(id => !WIN11.includes(id))];
  for (const id of plan) {
    if (has(id)) continue;
    const t = tech(o)(id);
    if (t.prerequisites.some(p => !has(p))) continue; // 前置未完成，跳过（列表已拓扑排序，正常不会发生）
    const r = workOn(o, id);
    if (r) return r;
  }
  return first(o)(['gather:wood', 'gather:clay', 'sell-good:woodenware', 'sell-good:pottery', 'work', 'end-turn']);
}

async function runGame(scenario, seed) {
  let session = await createSession({ runId: `v8win-${scenario}-${seed}`, ruleset: RULES, implementation, seed, scenarioId: scenario, agent: { kind: 'scripted', name: 'winPath' } });
  let obs = observeSession(session);
  const M = { minFood: 99, hardship: 0, milestones: {}, won: false, winTurn: null, maxTech: 0 };
  let actions = 0;
  const note = (k, v) => { if (M.milestones[k] === undefined) M.milestones[k] = v; };
  while ((obs.game.status === 'active' || obs.game.status === 'handover') && actions < 800) {
    const g = obs.game;
    M.minFood = Math.min(M.minFood, g.family.food);
    M.maxTech = Math.max(M.maxTech, g.victory?.mastered.length ?? 0);
    if (g.victory?.achieved && !M.won) { M.won = true; M.winTurn = g.clock.absoluteTurn; }
    for (const id of [...WIN11, ...FALLBACK]) if (g.person.mastered.includes(id)) note('tech:' + id, g.clock.absoluteTurn);
    if (g.family.channel) note('channel', g.clock.absoluteTurn);
    const a = winPath(g) ?? 'end-turn';
    const r = await submitCommand(session, { commandId: `x:${obs.revision}`, expectedRevision: obs.revision, actionId: a, reason: 'winPath' });
    session = r.session; obs = observeSession(session); actions++;
    for (const ev of r.session.record.entries.at(-1).events) {
      if (ev.type === 'season-settled' && ev.missing > 0) M.hardship++;
      if (ev.type === 'technology-victory') { M.won = true; M.winTurn = g.clock.absoluteTurn; }
    }
  }
  const g = obs.game;
  return { scenario, seed, status: g.status, won: M.won, winTurn: M.winTurn, gen: g.clock.generation, money: g.family.money, food: g.family.food,
    minFood: M.minFood, hardship: M.hardship, tech: g.victory?.mastered.length ?? 0, maxTech: M.maxTech, target: g.victory?.required ?? 11, milestones: M.milestones, actions };
}

const results = [];
for (const scenario of SCENARIOS) for (const seed of SEEDS) {
  const r = await runGame(scenario, seed);
  results.push(r);
  process.stderr.write(`\r${results.length}/16 winPath/${scenario} s${seed} -> ${r.status} tech=${r.tech}/${r.target} won=${r.won}@${r.winTurn} minFood=${r.minFood} hard=${r.hardship}`);
}
process.stderr.write('\n');
await writeFile('experiments/exp-v8-winpath.json', JSON.stringify(results, null, 2));

console.log('\n===== winPath 结果 =====');
for (const r of results) {
  const got = [...WIN11, ...FALLBACK].filter(id => r.milestones['tech:' + id]).map(id => r.milestones['tech:' + id]);
  console.log(`${r.scenario.padEnd(12)} s${String(r.seed).padEnd(4)} ${r.status.padEnd(9)} 胜=${r.won}@${r.winTurn ?? '-'} 科技=${r.tech}/${r.target} 钱=${r.money} 最低粮=${r.minFood} 苦难=${r.hardship} 季=${r.actions}`);
}
const n = results.length;
const won = results.filter(r => r.won);
console.log(`\n胜率=${Math.round(won.length / n * 100)}%  平均科技=${(results.reduce((s, r) => s + r.tech, 0) / n).toFixed(1)}  平均胜利季=${won.length ? Math.round(won.reduce((s, r) => s + r.winTurn, 0) / won.length) : '-'}  平均最低粮=${(results.reduce((s, r) => s + r.minFood, 0) / n).toFixed(1)}`);
console.log('\n各项科技达成率：');
for (const id of [...WIN11, ...FALLBACK]) {
  const got = results.filter(r => r.milestones['tech:' + id]);
  const pct = Math.round(got.length / n * 100);
  const at = got.length ? Math.round(got.reduce((s, r) => s + r.milestones['tech:' + id], 0) / got.length) : '-';
  console.log(`${id.padEnd(24)} ${pct}%  平均季=${at}`);
}
