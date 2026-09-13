// 第 2 批 100 局：针对上轮发现设计 4 个新假设，各 25 局。
// 聪明厂长 / 全面发展 / 老师 / 躺平。策略只读 observeSession() 输出。
import { createSession, submitCommand, observeSession } from '../dist/src/runtime/session.js';
import { loadCurrentContext } from '../dist/apps/cli/context.js';

const SUBJECTS = ['agronomy','mechanics','materials','heat','chemistry','organization'];
const PREFIX = { mechanics:'L', heat:'H', chemistry:'C', materials:'M', agronomy:'A', organization:'O' };
const RESEARCH_COST = { agronomy:{seedWheat:1}, mechanics:{wood:1}, materials:{wood:1,clay:1}, heat:{wood:1,clay:1}, chemistry:{wood:1,clay:1}, organization:{money:1} };
let base = null, impl = null;
const prefFor = sc => (base?.scenarios?.[sc]?.production?.stocks?.clay ?? 20) <= 4
  ? ['agronomy','mechanics','organization','heat','chemistry','materials']
  : ['agronomy','mechanics','materials','heat','chemistry','organization'];

function ctx(obs) {
  const g = obs.game, e = g.economy, fam = g.family, goods = e.goods, field = e.field, actions = g.actions;
  const act = id => actions.find(a => a.id === id);
  const can = id => { const a = act(id); return !!a && a.enabled && g.ap >= a.ap; };
  const activeLevel = s => e.disciplines.find(d => d.subject === s)?.level ?? 0;
  const heirLevel = s => e.disciplines.find(d => d.subject === s)?.heirLevel ?? 0;
  const topicId = (s, l) => PREFIX[s] + String(l).padStart(2, '0');
  const evidenceFor = (s, l) => e.disciplines.find(d => d.subject === s)?.topics[l - 1]?.evidence ?? false;
  return { g, e, fam, goods, field, can, activeLevel, heirLevel, topicId, evidenceFor, foodTotal: e.foodTotal, storage: e.storage, rain: g.world.rain, water: g.world.water, ap: g.ap };
}
function foodAndField(c) {
  const { field, can, goods, foodTotal, rain, water } = c;
  // 新经营者没有农学就种不了地——先补 A01（否则换代后田地荒掉、断粮）
  if (c.activeLevel('agronomy') === 0 && can('economy:study:A01')) return 'economy:study:A01';
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
// 推进某学科前沿一阶（学习/研究/补材料），返回行动或 null
function advance(c, t, familyMax) {
  const lvl = c.activeLevel(t);
  if (lvl >= 6 || familyMax[t] >= 6) return null;
  if (lvl === 0) { if (c.can(`economy:study:${c.topicId(t, 1)}`)) return `economy:study:${c.topicId(t, 1)}`; return null; }
  const frontier = lvl + 1;
  if (!c.evidenceFor(t, frontier)) {
    if (t === 'agronomy') { if ((c.goods.seedWheat ?? 0) >= 2 && c.can(`economy:research:${c.topicId(t, frontier)}`)) return `economy:research:${c.topicId(t, frontier)}`; return null; }
    if (t === 'organization') {
      // 组织学需要雇佣证据：先雇人
      if (!Object.values(c.e.workers).length && c.can('economy:hire:laborer')) return 'economy:hire:laborer';
      if (c.fam.money < 1 && c.can('economy:work:local')) return 'economy:work:local';
      if (c.can(`economy:research:${c.topicId(t, frontier)}`)) return `economy:research:${c.topicId(t, frontier)}`;
      return null;
    }
    const cost = RESEARCH_COST[t];
    const have = Object.entries(cost).every(([r, n]) => r === 'money' ? c.fam.money >= n : (c.goods[r] ?? 0) >= n);
    if (have && c.can(`economy:research:${c.topicId(t, frontier)}`)) return `economy:research:${c.topicId(t, frontier)}`;
    if (!have) for (const [r, n] of Object.entries(cost)) { if (r === 'money') { if (c.fam.money < n && c.can('economy:work:local')) return 'economy:work:local'; continue; } if ((c.goods[r] ?? 0) < n) { if (c.can(`economy:gather:${r}`)) return `economy:gather:${r}`; if (c.can(`economy:buy:${r}`)) return `economy:buy:${r}`; } }
    return null;
  }
  if (c.can(`economy:study:${c.topicId(t, frontier)}`)) return `economy:study:${c.topicId(t, frontier)}`;
  return null;
}

// ---------- 1) 聪明厂长：雇佣 + 设备 + 学习 ----------
function makeSmartFactory(PREFERENCE) {
  const familyMax = Object.fromEntries(SUBJECTS.map(s => [s, 0]));
  let target = null, lastGen = 0;
  const pick = cap => { let best = null, bk = null; for (const s of PREFERENCE) { if (familyMax[s] >= cap) continue; const k = [familyMax[s], PREFERENCE.indexOf(s)]; if (!bk || k[0] < bk[0] || (k[0] === bk[0] && k[1] < bk[1])) { best = s; bk = k; } } return best; };
  return obs => {
    const g = obs.game;
    if (g.status === 'handover') return 'handover';
    if (g.status !== 'active') return null;
    const c = ctx(obs);
    for (const d of c.e.disciplines) familyMax[d.subject] = Math.max(familyMax[d.subject], d.level, d.heirLevel);
    if (g.clock.generation !== lastGen) { lastGen = g.clock.generation; target = null; }
    const has = k => Object.values(c.e.workers).some(w => w.kind === k);
    // 1) 解锁雇佣
    if (c.activeLevel('organization') === 0 && c.can('economy:study:O01')) return 'economy:study:O01';
    // 2) 雇农工自动种地
    if (!has('laborer') && c.can('economy:hire:laborer')) return 'economy:hire:laborer';
    // 3) 学力学（造水车用）
    if (c.activeLevel('mechanics') === 0 && c.can('economy:study:L01')) return 'economy:study:L01';
    // 4) 造水车（被动粮+水，食物双保险）
    if (!c.e.equipment.W01 && c.can('economy:build:W01')) return 'economy:build:W01';
    // 5) 食物兜底
    if (c.foodTotal < 3) { if (c.can('economy:buyfood:bulk')) return 'economy:buyfood:bulk'; if (c.can('economy:gather:food')) return 'economy:gather:food'; if (c.can('economy:work:local')) return 'economy:work:local'; }
    // 5) 学习（农工省下行动点后猛学）
    if (!target) target = pick(6);
    const order = [target, ...PREFERENCE.filter(s => s !== target)].filter(Boolean);
    for (const t of order) {
      if (c.activeLevel(t) < familyMax[t] && t !== target) continue;
      const a = advance(c, t, familyMax);
      if (a) return a;
    }
    if (target && (c.activeLevel(target) >= 6 || familyMax[target] >= 6)) target = pick(6);
    // 6) 攒材料/钱
    if (c.fam.money < 4 && c.can('economy:work:local')) return 'economy:work:local';
    if ((c.goods.wood ?? 0) < 3 && c.can('economy:gather:wood')) return 'economy:gather:wood';
    if ((c.goods.clay ?? 0) < 3 && c.can('economy:gather:clay')) return 'economy:gather:clay';
    return c.can('economy:end:season') ? 'economy:end:season' : null;
  };
}

// ---------- 2) 全面发展：6 门都学一点（cap=4） ----------
function makeBreadth(PREFERENCE) {
  const familyMax = Object.fromEntries(SUBJECTS.map(s => [s, 0]));
  let lastGen = 0;
  return obs => {
    const g = obs.game;
    if (g.status === 'handover') return 'handover';
    if (g.status !== 'active') return null;
    const c = ctx(obs);
    for (const d of c.e.disciplines) familyMax[d.subject] = Math.max(familyMax[d.subject], d.level, d.heirLevel);
    if (g.clock.generation !== lastGen) lastGen = g.clock.generation;
    const f = foodAndField(c); if (f) return f;
    // 挑掌握度最低（<4）的学科推进，轮着来
    let target = null, bk = null;
    for (const s of PREFERENCE) { if (familyMax[s] >= 4) continue; const k = [familyMax[s], PREFERENCE.indexOf(s)]; if (!bk || k[0] < bk[0] || (k[0] === bk[0] && k[1] < bk[1])) { target = s; bk = k; } }
    if (target) { const a = advance(c, target, familyMax); if (a) return a; }
    // 卡住就换下一门
    for (const s of PREFERENCE) { if (s === target || familyMax[s] >= 4) continue; if (c.activeLevel(s) < familyMax[s]) continue; const a = advance(c, s, familyMax); if (a) return a; }
    if (c.fam.money < 4 && c.can('economy:work:local')) return 'economy:work:local';
    if ((c.goods.wood ?? 0) < 3 && c.can('economy:gather:wood')) return 'economy:gather:wood';
    if ((c.goods.clay ?? 0) < 3 && c.can('economy:gather:clay')) return 'economy:gather:clay';
    return c.can('economy:end:season') ? 'economy:end:season' : null;
  };
}

// ---------- 3) 老师：边学边教后辈 ----------
function makeTeacher(PREFERENCE) {
  const familyMax = Object.fromEntries(SUBJECTS.map(s => [s, 0]));
  let target = null, lastGen = 0;
  const pick = activeLevel => { let best = null, bk = null; for (const s of PREFERENCE) { if (familyMax[s] >= 6) continue; if (activeLevel(s) < familyMax[s]) continue; const k = [familyMax[s], PREFERENCE.indexOf(s)]; if (!bk || k[0] < bk[0] || (k[0] === bk[0] && k[1] < bk[1])) { best = s; bk = k; } } if (best) return best; for (const s of PREFERENCE) { if (familyMax[s] >= 6) continue; const k = [familyMax[s], PREFERENCE.indexOf(s)]; if (!bk || k[0] < bk[0] || (k[0] === bk[0] && k[1] < bk[1])) { best = s; bk = k; } } return best; };
  return obs => {
    const g = obs.game;
    if (g.status === 'handover') return 'handover';
    if (g.status !== 'active') return null;
    const c = ctx(obs);
    for (const d of c.e.disciplines) familyMax[d.subject] = Math.max(familyMax[d.subject], d.level, d.heirLevel);
    if (g.clock.generation !== lastGen) { lastGen = g.clock.generation; target = null; }
    if (!target) target = pick(c.activeLevel);
    const f = foodAndField(c); if (f) return f;
    // 先把自己前沿推进一阶
    if (target) { const a = advance(c, target, familyMax); if (a) return a; if (c.activeLevel(target) >= 6 || familyMax[target] >= 6) target = pick(c.activeLevel); }
    // 再教后辈（后辈落后于我就教，让交接时他已就位）
    for (const s of PREFERENCE) {
      const mine = c.activeLevel(s), heir = c.heirLevel(s);
      if (mine > heir && heir < 6) {
        const a = `economy:teach:${c.topicId(s, heir + 1)}`;
        if (c.can(a)) return a;
      }
    }
    if (c.fam.money < 5 && c.can('economy:work:local')) return 'economy:work:local';
    if ((c.goods.wood ?? 0) < 3 && c.can('economy:gather:wood')) return 'economy:gather:wood';
    if ((c.goods.clay ?? 0) < 3 && c.can('economy:gather:clay')) return 'economy:gather:clay';
    return c.can('economy:end:season') ? 'economy:end:season' : null;
  };
}

// ---------- 4) 躺平：只管活命，几乎不学 ----------
function makeLayflat() {
  return obs => {
    const g = obs.game;
    if (g.status === 'handover') return 'handover';
    if (g.status !== 'active') return null;
    const c = ctx(obs);
    const f = foodAndField(c); if (f) return f;
    // 只顺手学免费的 1 阶（不研究、不深耕）
    for (const s of SUBJECTS) if (c.activeLevel(s) === 0 && c.can(`economy:study:${c.topicId(s, 1)}`)) return `economy:study:${c.topicId(s, 1)}`;
    // 其余时间：攒点钱、采点材，纯过日子
    if (c.can('economy:work:local')) return 'economy:work:local';
    if (c.can('economy:gather:wood')) return 'economy:gather:wood';
    if (c.can('economy:gather:clay')) return 'economy:gather:clay';
    return c.can('economy:end:season') ? 'economy:end:season' : null;
  };
}

const STRATS = { smartfactory: makeSmartFactory, breadth: makeBreadth, teacher: makeTeacher, layflat: makeLayflat };

async function playOne(strategy, scenario, seed, runId) {
  const PREFERENCE = prefFor(scenario);
  const decide = strategy === 'layflat' ? makeLayflat() : STRATS[strategy](PREFERENCE);
  let session = await createSession({ runId, ruleset: base, implementation: impl, seed, scenarioId: scenario });
  let obs = observeSession(session);
  const seasons = []; let guard = 0, hardshipMax = 0, teaches = 0;
  while ((obs.game.status === 'active' || obs.game.status === 'handover') && guard++ < 3000) {
    const action = decide(obs);
    if (!action) break;
    if (action.startsWith('economy:teach:')) teaches++;
    const before = { gen: obs.game.clock.generation, turn: obs.game.clock.turn, food: obs.game.economy.foodTotal, m: obs.game.victory.mastered.length };
    const result = await submitCommand(session, { commandId: `${runId}:${obs.revision}`, expectedRevision: obs.revision, actionId: action });
    session = result.session; obs = observeSession(session);
    hardshipMax = Math.max(hardshipMax, obs.game.family.hardship);
    seasons.push({ ...before, action, hardship: obs.game.family.hardship, status: obs.game.status });
  }
  const v = obs.game.victory;
  const cnt = re => seasons.filter(s => s.action.startsWith(re)).length;
  return { strategy, scenario, seed, status: obs.game.status, won: v.won, mastered: v.mastered.length, required: v.required, turns: obs.game.clock.absoluteTurn,
    finalFood: obs.game.family.food, finalMoney: obs.game.family.money, hardshipMax, teaches,
    builds: cnt('economy:build'), hires: cnt('economy:hire'), products: cnt('economy:product'), sells: cnt('economy:sell'), works: cnt('economy:work'), studies: cnt('economy:study'), farms: cnt('economy:farm'),
    equipment: Object.keys(obs.game.economy?.equipment ?? {}).length, workers: Object.keys(obs.game.economy?.workers ?? {}).length, seasons };
}

function summarize(results) {
  console.log(`\n=== 汇总（${results.length} 局）===`);
  for (const st of ['smartfactory','breadth','teacher','layflat']) {
    const rs = results.filter(r => r.strategy === st);
    if (!rs.length) continue;
    const wins = rs.filter(r => r.won).length;
    const avg = (a, f) => (a.reduce((x, y) => x + f(y), 0) / a.length).toFixed(1);
    console.log(`\n【${st}】胜 ${wins}/${rs.length}  平均回合 ${avg(rs, r => r.turns)}  平均课题 ${avg(rs, r => r.mastered)}/36  困顿峰 ${avg(rs, r => r.hardshipMax)}`);
    console.log(`   平均: 学习 ${avg(rs, r => r.studies)}  种田 ${avg(rs, r => r.farms)}  造设备 ${avg(rs, r => r.builds)}  雇人 ${avg(rs, r => r.hires)}  教学 ${avg(rs, r => r.teaches)}  打工 ${avg(rs, r => r.works)}  卖货 ${avg(rs, r => r.sells)}`);
    const bySc = {};
    for (const r of rs) { bySc[r.scenario] ??= { n: 0, won: 0 }; bySc[r.scenario].n++; bySc[r.scenario].won += r.won ? 1 : 0; }
    console.log('   分场景: ' + Object.entries(bySc).map(([s, x]) => `${s} ${x.won}/${x.n}`).join('  '));
  }
}

const args = process.argv.slice(2);
const getFlag = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const perStrategy = Number(getFlag('--per') ?? 25);
const seedBase = Number(getFlag('--seedbase') ?? 909090);
const verbose = args.includes('--verbose');
const c = await loadCurrentContext();
base = c.base; impl = c.implementation;
const scenarios = ['river','dry','woodland','clay-valley'];
const results = [];
for (const st of ['smartfactory','breadth','teacher','layflat']) {
  for (let i = 1; i <= perStrategy; i++) {
    const scenario = scenarios[(i - 1) % scenarios.length];
    const seed = seedBase + (st.length * 1000) + i * 491;
    const r = await playOne(st, scenario, seed, `${st}${i}`);
    results.push(r);
    const tag = r.won ? '胜' : (r.status === 'ended' ? '困顿亡' : '未竟');
    console.log(`[${st}] #${String(i).padStart(2,'0')} ${scenario.padEnd(10)} → ${tag} 课题${r.mastered}/${r.required} 回合${r.turns} 困顿峰${r.hardshipMax} 学${r.studies} 种${r.farms} 设备${r.equipment} 雇${r.workers} 教${r.teaches}`);
    if (verbose) for (const s of r.seasons) console.log(`   g${s.gen}t${s.turn} ${s.action} 粮${s.food} 课题${s.m} 困${s.hardship}`);
  }
}
summarize(results);
const { writeFile } = await import('node:fs/promises');
await writeFile(new URL('./play100b-results.json', import.meta.url), JSON.stringify(results.map(({ seasons, ...rest }) => rest), null, 2));
console.log('\n结果已写入 experiments/play100b-results.json');
