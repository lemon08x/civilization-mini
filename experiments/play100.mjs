// 100 局多风格体验：学霸 / 厂长 / 农夫 / 随缘，各 25 局，覆盖 4 场景。
// 策略只读取 observeSession() 输出。用法: node experiments/play100.mjs
import { createSession, submitCommand, observeSession } from '../dist/src/runtime/session.js';
import { loadCurrentContext } from '../dist/apps/cli/context.js';

const SUBJECTS = ['agronomy','mechanics','materials','heat','chemistry','organization'];
const PREFIX = { mechanics:'L', heat:'H', chemistry:'C', materials:'M', agronomy:'A', organization:'O' };
const RESEARCH_COST = { agronomy:{seedWheat:1}, mechanics:{wood:1}, materials:{wood:1,clay:1}, heat:{wood:1,clay:1}, chemistry:{wood:1,clay:1}, organization:{money:1} };

let base = null;
const prefFor = sc => (base?.scenarios?.[sc]?.production?.stocks?.clay ?? 20) <= 4
  ? ['agronomy','mechanics','organization','heat','chemistry','materials']
  : ['agronomy','mechanics','materials','heat','chemistry','organization'];

// 通用小工具
function ctx(obs) {
  const g = obs.game, e = g.economy, fam = g.family, goods = e.goods, field = e.field;
  const actions = g.actions;
  const act = id => actions.find(a => a.id === id);
  const can = id => { const a = act(id); return !!a && a.enabled && g.ap >= a.ap; };
  const activeLevel = s => e.disciplines.find(d => d.subject === s)?.level ?? 0;
  const topicId = (s, l) => PREFIX[s] + String(l).padStart(2, '0');
  const evidenceFor = (s, l) => e.disciplines.find(d => d.subject === s)?.topics[l - 1]?.evidence ?? false;
  return { g, e, fam, goods, field, can, activeLevel, topicId, evidenceFor, foodTotal: e.foodTotal, storage: e.storage, rain: g.world.rain, water: g.world.water, ap: g.ap };
}
// 食物 + 田间（所有风格共用的底层）
function foodAndField(c) {
  const { field, can, goods, foodTotal, storage, rain, water } = c;
  if (foodTotal < 4) {
    if (field.crop && field.growth >= field.duration && can('economy:farm:wheat')) return 'economy:farm:wheat';
    if (!field.crop && (goods.seedWheat ?? 0) >= 1 && can('economy:farm:wheat')) return 'economy:farm:wheat';
    if (can('economy:buyfood:bulk')) return 'economy:buyfood:bulk';
    if (can('economy:gather:food')) return 'economy:gather:food';
    if (can('economy:work:local')) return 'economy:work:local';
  }
  if (!field.crop && (goods.seedWheat ?? 0) >= 1 && can('economy:farm:wheat')) return 'economy:farm:wheat';
  if (field.crop && field.growth >= field.duration && can('economy:farm:wheat')) return 'economy:farm:wheat';
  if (field.crop && field.growth < field.duration && rain + field.moisture < 2 && water >= 1 && can('economy:farm:wheat')) return 'economy:farm:wheat';
  return null;
}

// ---------- 风格 1：学霸（速通） ----------
function makeScholar(PREFERENCE) {
  const familyMax = Object.fromEntries(SUBJECTS.map(s => [s, 0]));
  let target = null, lastGen = 0;
  const pickTarget = activeLevel => {
    let best = null, bk = null;
    for (const s of PREFERENCE) { if (familyMax[s] >= 6) continue; if (activeLevel(s) < familyMax[s]) continue; const k = [familyMax[s], PREFERENCE.indexOf(s)]; if (!bk || k[0] < bk[0] || (k[0] === bk[0] && k[1] < bk[1])) { best = s; bk = k; } }
    if (best) return best;
    for (const s of PREFERENCE) { if (familyMax[s] >= 6) continue; const k = [familyMax[s], PREFERENCE.indexOf(s)]; if (!bk || k[0] < bk[0] || (k[0] === bk[0] && k[1] < bk[1])) { best = s; bk = k; } }
    return best;
  };
  return obs => {
    const g = obs.game;
    if (g.status === 'handover') return 'handover';
    if (g.status !== 'active') return null;
    const c = ctx(obs);
    for (const d of c.e.disciplines) familyMax[d.subject] = Math.max(familyMax[d.subject], d.level, d.heirLevel);
    const genChanged = g.clock.generation !== lastGen;
    if (genChanged) { lastGen = g.clock.generation; target = null; }
    if (!target) target = pickTarget(c.activeLevel);
    const f = foodAndField(c); if (f) return f;
    const order = [target, ...PREFERENCE.filter(s => s !== target)].filter(Boolean);
    for (const t of order) {
      const lvl = c.activeLevel(t);
      if (lvl >= 6 || familyMax[t] >= 6) continue;
      if (t !== target && lvl < familyMax[t]) continue;
      if (lvl === 0) { if (c.can(`economy:study:${c.topicId(t, 1)}`)) return `economy:study:${c.topicId(t, 1)}`; continue; }
      const frontier = lvl + 1;
      if (!c.evidenceFor(t, frontier)) {
        if (t === 'agronomy') { if ((c.goods.seedWheat ?? 0) >= 2 && c.can(`economy:research:${c.topicId(t, frontier)}`)) return `economy:research:${c.topicId(t, frontier)}`; continue; }
        const cost = RESEARCH_COST[t];
        const have = Object.entries(cost).every(([r, n]) => r === 'money' ? c.fam.money >= n : (c.goods[r] ?? 0) >= n);
        if (have && c.can(`economy:research:${c.topicId(t, frontier)}`)) return `economy:research:${c.topicId(t, frontier)}`;
        if (!have) for (const [r, n] of Object.entries(cost)) { if (r === 'money') { if (c.fam.money < n && c.can('economy:work:local')) return 'economy:work:local'; continue; } if ((c.goods[r] ?? 0) < n) { if (c.can(`economy:gather:${r}`)) return `economy:gather:${r}`; if (c.can(`economy:buy:${r}`)) return `economy:buy:${r}`; } }
        continue;
      } else if (c.can(`economy:study:${c.topicId(t, frontier)}`)) return `economy:study:${c.topicId(t, frontier)}`;
    }
    if (target && (c.activeLevel(target) >= 6 || familyMax[target] >= 6)) target = pickTarget(c.activeLevel);
    if (c.fam.money < 6 && c.can('economy:work:local')) return 'economy:work:local';
    if ((c.goods.wood ?? 0) < 3 && c.can('economy:gather:wood')) return 'economy:gather:wood';
    if ((c.goods.clay ?? 0) < 3 && c.can('economy:gather:clay')) return 'economy:gather:clay';
    if (c.can('economy:gather:wood')) return 'economy:gather:wood';
    if (c.can('economy:gather:clay')) return 'economy:gather:clay';
    if (c.can('economy:work:local')) return 'economy:work:local';
    return c.can('economy:end:season') ? 'economy:end:season' : null;
  };
}

// ---------- 风格 2：厂长（设备 + 雇佣 + 产品） ----------
function makeFactory() {
  const wantEquip = ['W01','K01','P01','S01'];      // 水车/陶窑/水泵/陶罐
  const wantProducts = ['W02','W03'];                // 灌溉渠/种子仓库
  const unlock = ['agronomy','mechanics','heat','materials'];
  return obs => {
    const g = obs.game;
    if (g.status === 'handover') return 'handover';
    if (g.status !== 'active') return null;
    const c = ctx(obs);
    const has = k => Object.values(c.e.workers).some(w => w.kind === k);
    // 1) 先雇农工（自动种地，解放我的行动点）
    if (!has('laborer') && c.can('economy:hire:laborer')) return 'economy:hire:laborer';
    // 2) 食物：没农工自己种；有农工只在断粮时补
    if (!has('laborer')) { const f = foodAndField(c); if (f) return f; }
    else if (c.foodTotal < 3) { if (c.can('economy:buyfood:bulk')) return 'economy:buyfood:bulk'; if (c.can('economy:gather:food')) return 'economy:gather:food'; }
    // 3) 解锁学科
    for (const s of unlock) if (c.activeLevel(s) === 0 && c.can(`economy:study:${c.topicId(s, 1)}`)) return `economy:study:${c.topicId(s, 1)}`;
    // 4) 造设备
    for (const id of wantEquip) if (!c.e.equipment[id] && c.can(`economy:build:${id}`)) return `economy:build:${id}`;
    // 5) 做产品
    for (const id of wantProducts) if (!c.e.products[id] && c.can(`economy:product:${id}`)) return `economy:product:${id}`;
    // 6) 雇技工
    if (!has('engineer') && c.can('economy:hire:engineer')) return 'economy:hire:engineer';
    // 7) 攒材料 / 钱
    if (c.fam.money < 4 && c.can('economy:work:local')) return 'economy:work:local';
    if ((c.goods.wood ?? 0) < 4 && c.can('economy:gather:wood')) return 'economy:gather:wood';
    if ((c.goods.clay ?? 0) < 4 && c.can('economy:gather:clay')) return 'economy:gather:clay';
    // 8) 学深一点
    for (const s of unlock) { const lvl = c.activeLevel(s); if (lvl > 0 && lvl < 3) { const fr = lvl + 1; if (c.evidenceFor(s, fr) && c.can(`economy:study:${c.topicId(s, fr)}`)) return `economy:study:${c.topicId(s, fr)}`; } }
    return c.can('economy:end:season') ? 'economy:end:season' : (c.can('economy:work:local') ? 'economy:work:local' : null);
  };
}

// ---------- 风格 3：农夫（经济循环：种地囤粮卖货攒钱） ----------
function makeFarmer() {
  return obs => {
    const g = obs.game;
    if (g.status === 'handover') return 'handover';
    if (g.status !== 'active') return null;
    const c = ctx(obs);
    // 先解锁农学（否则不能种地）
    if (c.activeLevel('agronomy') === 0 && c.can('economy:study:A01')) return 'economy:study:A01';
    const f = foodAndField(c); if (f) return f;
    // 解锁储粮设备
    if (c.activeLevel('materials') === 0 && c.can('economy:study:M01')) return 'economy:study:M01';
    if (!c.e.equipment.S01 && c.can('economy:build:S01')) return 'economy:build:S01';
    if (!c.e.equipment.S02 && c.can('economy:build:S02')) return 'economy:build:S02';
    // 粮食多了就卖
    if ((c.goods.wheat ?? 0) >= 4 && c.foodTotal >= 6 && c.can('economy:sell:wheat')) return 'economy:sell:wheat';
    if ((c.goods.soy ?? 0) >= 3 && c.can('economy:sell:soy')) return 'economy:sell:soy';
    // 缺粮且市场便宜就囤
    if (c.foodTotal < 5 && c.fam.money >= 4 && c.can('economy:buyfood:bulk')) return 'economy:buyfood:bulk';
    // 攒钱
    if (c.can('economy:work:local')) return 'economy:work:local';
    if ((c.goods.wheat ?? 0) >= 2 && c.can('economy:process:W01')) return 'economy:process:W01';
    if (c.can('economy:gather:food')) return 'economy:gather:food';
    return c.can('economy:end:season') ? 'economy:end:season' : null;
  };
}

// ---------- 风格 4：随缘（不优化，什么都干一点） ----------
function makeCasual() {
  let tick = 0;
  return obs => {
    const g = obs.game;
    if (g.status === 'handover') return 'handover';
    if (g.status !== 'active') return null;
    const c = ctx(obs);
    const f = foodAndField(c); if (f) return f;
    tick++;
    const phase = tick % 4;
    if (phase === 0) { // 学点东西（随便挑当前能学的 1 阶/前沿）
      for (const s of SUBJECTS) { const lvl = c.activeLevel(s); if (lvl === 0 && c.can(`economy:study:${c.topicId(s, 1)}`)) return `economy:study:${c.topicId(s, 1)}`; }
      for (const s of SUBJECTS) { const lvl = c.activeLevel(s); if (lvl > 0 && lvl < 6 && c.evidenceFor(s, lvl + 1) && c.can(`economy:study:${c.topicId(s, lvl + 1)}`)) return `economy:study:${c.topicId(s, lvl + 1)}`; }
    }
    if (phase === 1) { if (c.can('economy:gather:wood')) return 'economy:gather:wood'; if (c.can('economy:gather:clay')) return 'economy:gather:clay'; }
    if (phase === 2) { if (c.can('economy:work:local')) return 'economy:work:local'; if (c.can('economy:buy:wood')) return 'economy:buy:wood'; }
    if (phase === 3) {
      for (const id of ['W01','S01','P01']) if (!c.e.equipment[id] && c.can(`economy:build:${id}`)) return `economy:build:${id}`;
      if (c.can('economy:hire:laborer')) return 'economy:hire:laborer';
      if (c.can('economy:gather:food')) return 'economy:gather:food';
    }
    return c.can('economy:end:season') ? 'economy:end:season' : null;
  };
}

const STRATEGIES = { scholar: makeScholar, factory: makeFactory, farmer: makeFarmer, casual: makeCasual };

async function playOne(strategy, scenario, seed, runId) {
  const decide = strategy === 'scholar' ? makeScholar(prefFor(scenario)) : STRATEGIES[strategy]();
  let session = await createSession({ runId, ruleset: base, implementation: impl, seed, scenarioId: scenario });
  let obs = observeSession(session);
  const seasons = []; let guard = 0, hardshipMax = 0;
  while ((obs.game.status === 'active' || obs.game.status === 'handover') && guard++ < 3000) {
    const action = decide(obs);
    if (!action) break;
    const before = { gen: obs.game.clock.generation, turn: obs.game.clock.turn, food: obs.game.economy.foodTotal, money: obs.game.family.money, m: obs.game.victory.mastered.length, w: obs.game.world.weather };
    const result = await submitCommand(session, { commandId: `${runId}:${obs.revision}`, expectedRevision: obs.revision, actionId: action });
    session = result.session; obs = observeSession(session);
    hardshipMax = Math.max(hardshipMax, obs.game.family.hardship);
    seasons.push({ ...before, action, hardship: obs.game.family.hardship, status: obs.game.status });
  }
  const v = obs.game.victory;
  const cnt = re => seasons.filter(s => s.action.startsWith(re)).length;
  return { strategy, scenario, seed, status: obs.game.status, won: v.won, mastered: v.mastered.length, required: v.required, turns: obs.game.clock.absoluteTurn,
    finalFood: obs.game.family.food, finalMoney: obs.game.family.money, hardshipMax,
    builds: cnt('economy:build'), hires: cnt('economy:hire'), products: cnt('economy:product'), sells: cnt('economy:sell'), works: cnt('economy:work'), studies: cnt('economy:study'), farms: cnt('economy:farm'),
    equipment: Object.keys(obs.game.economy?.equipment ?? {}).length, workers: Object.keys(obs.game.economy?.workers ?? {}).length,
    seasons };
}

function summarize(results) {
  console.log(`\n=== 汇总（${results.length} 局）===`);
  for (const st of ['scholar','factory','farmer','casual']) {
    const rs = results.filter(r => r.strategy === st);
    if (!rs.length) continue;
    const wins = rs.filter(r => r.won).length;
    const avg = (a, f) => (a.reduce((x, y) => x + f(y), 0) / a.length).toFixed(1);
    console.log(`\n【${st}】胜 ${wins}/${rs.length}  平均回合 ${avg(rs, r => r.turns)}  平均课题 ${avg(rs, r => r.mastered)}/36  最高困顿 ${avg(rs, r => r.hardshipMax)}`);
    console.log(`   平均: 造设备 ${avg(rs, r => r.builds)}  雇人 ${avg(rs, r => r.hires)}  做产品 ${avg(rs, r => r.products)}  卖货 ${avg(rs, r => r.sells)}  打工 ${avg(rs, r => r.works)}  学习 ${avg(rs, r => r.studies)}  种田 ${avg(rs, r => r.farms)}`);
    const bySc = {};
    for (const r of rs) { bySc[r.scenario] ??= { n: 0, won: 0 }; bySc[r.scenario].n++; bySc[r.scenario].won += r.won ? 1 : 0; }
    console.log('   分场景: ' + Object.entries(bySc).map(([s, x]) => `${s} ${x.won}/${x.n}`).join('  '));
  }
}

const args = process.argv.slice(2);
const getFlag = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const perStrategy = Number(getFlag('--per') ?? 25);
const seedBase = Number(getFlag('--seedbase') ?? 424242);

const ctxc = await loadCurrentContext();
base = ctxc.base; const impl = ctxc.implementation;
const scenarios = ['river','dry','woodland','clay-valley'];
const results = [];
for (const st of ['scholar','factory','farmer','casual']) {
  for (let i = 1; i <= perStrategy; i++) {
    const scenario = scenarios[(i - 1) % scenarios.length];
    const seed = seedBase + (st.length * 1000) + i * 613;
    const r = await playOne(st, scenario, seed, `${st}${i}`);
    results.push(r);
    const tag = r.won ? '胜' : (r.status === 'ended' ? '困顿亡' : '未竟');
    console.log(`[${st}] #${String(i).padStart(2,'0')} ${scenario.padEnd(10)} → ${tag} 课题${r.mastered}/${r.required} 回合${r.turns} 困顿峰${r.hardshipMax} 设备${r.equipment} 雇${r.workers} 造${r.builds} 产${r.products} 卖${r.sells}`);
  }
}
summarize(results);
const { writeFile } = await import('node:fs/promises');
await writeFile(new URL('./play100-results.json', import.meta.url), JSON.stringify(results.map(({ seasons, ...rest }) => rest), null, 2));
console.log('\n结果已写入 experiments/play100-results.json');
