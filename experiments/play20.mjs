// 我（玩家）亲自下手的 20 局驱动器。策略只读取 observeSession() 输出。
// 用法: node experiments/play20.mjs [--games 20] [--verbose]
import { createSession, submitCommand, observeSession } from '../dist/src/runtime/session.js';
import { loadCurrentContext } from '../dist/apps/cli/context.js';

const SUBJECTS = ['agronomy','mechanics','materials','heat','chemistry','organization'];
const PREFIX = { mechanics:'L', heat:'H', chemistry:'C', materials:'M', agronomy:'A', organization:'O' };
// 研究材料成本（来自 actions/economy.ts 的 sample 规则）
const RESEARCH_COST = {
  agronomy: { seedWheat: 1 },
  mechanics: { wood: 1 },
  materials: { wood: 1, clay: 1 },
  heat: { wood: 1, clay: 1 },
  chemistry: { wood: 1, clay: 1 },
  organization: { money: 1 },
};
// 我偏好的学科顺序：农学靠田间实践免费拿证据，最省；其次力学只耗木；再是耗木+黏土的。
// 场景黏土稀缺（dry/woodland 只有 4）时，把不耗黏土的组织学提前，避免后两代卡在黏土上。
function preferenceFor(scenario) {
  const clay = base?.scenarios?.[scenario]?.production?.stocks?.clay ?? 20;
  return clay <= 4
    ? ['agronomy','mechanics','organization','heat','chemistry','materials']
    : ['agronomy','mechanics','materials','heat','chemistry','organization'];
}
let base = null;

function makePolicy(PREFERENCE) {
  const familyMax = Object.fromEntries(SUBJECTS.map(s => [s, 0]));
  let target = null;
  let lastGen = 0;

  function pickTarget(activeLevel) {
    // 优先选“我正好站在家族前沿”的学科（学一阶就 +1 课题），最低掌握度、再按偏好。
    let best = null, bestKey = null;
    for (const s of PREFERENCE) {
      if (familyMax[s] >= 6) continue;
      if (activeLevel(s) < familyMax[s]) continue; // 落后于家族前沿，先不碰
      const key = [familyMax[s], PREFERENCE.indexOf(s)];
      if (!bestKey || key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) { best = s; bestKey = key; }
    }
    if (best) return best;
    // 没有可直接推进的，就补一门掌握度最低的课
    for (const s of PREFERENCE) {
      if (familyMax[s] >= 6) continue;
      const key = [familyMax[s], PREFERENCE.indexOf(s)];
      if (!bestKey || key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) { best = s; bestKey = key; }
    }
    return best;
  }

  function decide(obs) {
    const g = obs.game;
    if (g.status === 'handover') return 'handover';
    if (g.status !== 'active') return null;
    const e = g.economy, fam = g.family, goods = e.goods, field = e.field;
    const foodTotal = e.foodTotal, storage = e.storage;
    const rain = g.world.rain, water = g.world.water, ap = g.ap;
    const actions = g.actions;
    const act = id => actions.find(a => a.id === id);
    const can = id => { const a = act(id); return !!a && a.enabled && ap >= a.ap; };

    for (const d of e.disciplines) familyMax[d.subject] = Math.max(familyMax[d.subject], d.level, d.heirLevel);
    const activeLevel = s => e.disciplines.find(d => d.subject === s)?.level ?? 0;
    const genChanged = g.clock.generation !== lastGen;
    if (genChanged) { lastGen = g.clock.generation; target = null; }
    if (!target) target = pickTarget(activeLevel);

    const topicId = (s, lvl) => PREFIX[s] + String(lvl).padStart(2, '0');
    const evidenceFor = (s, lvl) => e.disciplines.find(d => d.subject === s)?.topics[lvl - 1]?.evidence ?? false;

    // 1) 口粮优先：低于安全线就先把饭问题解决
    if (foodTotal < 4) {
      if (field.crop && field.growth >= field.duration && can('economy:farm:wheat')) return 'economy:farm:wheat';
      if (!field.crop && (goods.seedWheat ?? 0) >= 1 && can('economy:farm:wheat')) return 'economy:farm:wheat';
      if (can('economy:buyfood:bulk')) return 'economy:buyfood:bulk';
      if (can('economy:gather:food')) return 'economy:gather:food';
      if (can('economy:work:local')) return 'economy:work:local';
    }

    // 2) 田间流水线：尽早种下并保持小麦不断档（也是农学免费证据来源）
    if (!field.crop && (goods.seedWheat ?? 0) >= 1 && can('economy:farm:wheat')) return 'economy:farm:wheat';
    if (field.crop && field.growth >= field.duration && can('economy:farm:wheat')) return 'economy:farm:wheat';
    if (field.crop && field.growth < field.duration && rain + field.moisture < 2 && water >= 1 && can('economy:farm:wheat')) return 'economy:farm:wheat';

    // 3) 学习（核心目标）：只推进“家族前沿”学科；目标卡住就换一门同样在前沿的，不补课
    const order = [target, ...PREFERENCE.filter(s => s !== target)].filter(Boolean);
    for (const t of order) {
      const lvl = activeLevel(t);
      if (lvl >= 6 || familyMax[t] >= 6) continue;
      if (t !== target && lvl < familyMax[t]) continue; // 落后于家族前沿的学科先不碰（除非是目标）
      if (lvl === 0) {
        if (can(`economy:study:${topicId(t, 1)}`)) return `economy:study:${topicId(t, 1)}`;
        continue;
      }
      const frontier = lvl + 1;
      if (!evidenceFor(t, frontier)) {
        if (t === 'agronomy') {
          // 农学靠田间实践拿证据；只有手里有富余种子（留 1 颗续种）才做实验
          if ((goods.seedWheat ?? 0) >= 2 && can(`economy:research:${topicId(t, frontier)}`)) return `economy:research:${topicId(t, frontier)}`;
          continue;
        }
        const cost = RESEARCH_COST[t];
        const have = Object.entries(cost).every(([res, n]) => res === 'money' ? fam.money >= n : (goods[res] ?? 0) >= n);
        if (have && can(`economy:research:${topicId(t, frontier)}`)) return `economy:research:${topicId(t, frontier)}`;
        if (!have) {
          for (const [res, n] of Object.entries(cost)) {
            if (res === 'money') { if (fam.money < n && can('economy:work:local')) return 'economy:work:local'; continue; }
            if ((goods[res] ?? 0) < n) {
              if (can(`economy:gather:${res}`)) return `economy:gather:${res}`;
              if (can(`economy:buy:${res}`)) return `economy:buy:${res}`;
            }
          }
        }
        continue;
      } else if (can(`economy:study:${topicId(t, frontier)}`)) {
        return `economy:study:${topicId(t, frontier)}`;
      }
    }
    if (target && (activeLevel(target) >= 6 || familyMax[target] >= 6)) target = pickTarget(activeLevel);

    // 4) 攒资源 / 攒钱
    if (fam.money < 6 && can('economy:work:local')) return 'economy:work:local';
    if ((goods.wood ?? 0) < 3 && can('economy:gather:wood')) return 'economy:gather:wood';
    if ((goods.clay ?? 0) < 3 && can('economy:gather:clay')) return 'economy:gather:clay';

    // 5) 收尾：还有行动就干点便宜的，否则结束本季
    if (can('economy:gather:wood')) return 'economy:gather:wood';
    if (can('economy:gather:clay')) return 'economy:gather:clay';
    if (can('economy:work:local')) return 'economy:work:local';
    if (can('economy:end:season')) return 'economy:end:season';
    return null;
  }
  return decide;
}

async function playOne({ implementation, base }, runId, seed, scenario) {
  const session0 = await createSession({ runId, ruleset: base, implementation, seed, scenarioId: scenario });
  let session = session0;
  let obs = observeSession(session);
  const decide = makePolicy(preferenceFor(scenario));
  const seasons = [];
  let guard = 0;
  while ((obs.game.status === 'active' || obs.game.status === 'handover') && guard++ < 3000) {
    const action = decide(obs);
    if (!action) break;
    const before = { gen: obs.game.clock.generation, turn: obs.game.clock.turn, food: obs.game.economy.foodTotal, money: obs.game.family.money, mastered: obs.game.victory.mastered.length, weather: obs.game.world.weather };
    const result = await submitCommand(session, { commandId: `${runId}:${obs.revision}`, expectedRevision: obs.revision, actionId: action });
    session = result.session;
    obs = observeSession(session);
    const after = { gen: obs.game.clock.generation, turn: obs.game.clock.turn, food: obs.game.economy?.foodTotal ?? 0, money: obs.game.family.money, mastered: obs.game.victory.mastered.length, status: obs.game.status };
    seasons.push({ ...before, action, ...after });
  }
  const v = obs.game.victory;
  const disc = (obs.game.economy?.disciplines ?? []).map(d => `${d.subject}:${d.level}`).join(' ');
  return {
    runId, seed, scenario,
    status: obs.game.status,
    won: v.won, mastered: v.mastered.length, required: v.required,
    generations: obs.game.clock.generation, absoluteTurn: obs.game.clock.absoluteTurn,
    finalFood: obs.game.family.food, finalMoney: obs.game.family.money,
    hardship: obs.game.family.hardship,
    disciplines: disc,
    seasons,
  };
}

function summarize(results) {
  const wins = results.filter(r => r.won).length;
  const byScenario = {};
  for (const r of results) {
    byScenario[r.scenario] ??= { n: 0, won: 0, mastered: [] };
    byScenario[r.scenario].n++; byScenario[r.scenario].won += r.won ? 1 : 0; byScenario[r.scenario].mastered.push(r.mastered);
  }
  const avgMastered = (results.reduce((a, r) => a + r.mastered, 0) / results.length).toFixed(1);
  const avgTurns = (results.reduce((a, r) => a + r.absoluteTurn, 0) / results.length).toFixed(1);
  console.log(`\n=== 汇总（${results.length} 局）===`);
  console.log(`胜利: ${wins}/${results.length}  平均掌握课题: ${avgMastered}/36  平均结束回合: ${avgTurns}`);
  for (const [sc, s] of Object.entries(byScenario)) {
    console.log(`  ${sc}: 胜 ${s.won}/${s.n}  掌握课题 [${s.mastered.join(', ')}]`);
  }
}

const args = process.argv.slice(2);
const getFlag = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const games = Number(getFlag('--games') ?? 20);
const seedBase = Number(getFlag('--seedbase') ?? 1000);
const verbose = args.includes('--verbose');

const ctx = await loadCurrentContext();
base = ctx.base;
const { implementation } = ctx;
const scenarios = ['river', 'dry', 'woodland', 'clay-valley'];
const results = [];
for (let i = 1; i <= games; i++) {
  const scenario = scenarios[(i - 1) % scenarios.length];
  const seed = seedBase + i * 977;
  const r = await playOne({ implementation, base: ctx.base }, `play${i}`, seed, scenario);
  results.push(r);
  const tag = r.won ? '胜' : (r.status === 'ended' ? '困顿亡' : '未竟');
  console.log(`#${String(i).padStart(2, '0')} ${scenario.padEnd(10)} seed=${seed} → ${tag}  掌握 ${r.mastered}/${r.required}  回合 ${r.absoluteTurn}  期末粮 ${r.finalFood} 钱 ${r.finalMoney} 困顿 ${r.hardship}`);
  if (verbose) {
    for (const s of r.seasons) {
      console.log(`   g${s.gen}t${s.turn} ${s.weather} 粮${s.food} 钱${s.money} 课题${s.mastered} | ${s.action} → ${s.status}`);
    }
  }
}
summarize(results);
import { writeFile } from 'node:fs/promises';
await writeFile(new URL('./play20-results.json', import.meta.url), JSON.stringify(results.map(({ seasons, ...rest }) => rest), null, 2));
console.log('\n结果已写入 experiments/play20-results.json');
