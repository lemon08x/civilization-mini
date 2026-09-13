// 用与网页/CLI 相同的行动接口（createSession / submitCommand / observeSession）完整游玩。
// 策略由本脚本给出；结算全部交给引擎。只读取 observeSession 的公开观察。
import { loadContext } from '../dist/apps/cli/context.js';
import { createSession, submitCommand, observeSession } from '../dist/src/runtime/session.js';
import { FileRunStore } from '../dist/src/runtime/file-store.js';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { implementation, base, pacingBase } = await loadContext();
const RULES = process.env.RULES === 'v6' ? base : pacingBase; // 默认 v7（当前 CLI 默认）

// ---- 策略 ----
function decide(obs, policy) {
  const o = obs.game, p = o.production;
  const legal = id => o.actions.find(a => a.id === id && a.enabled);
  const first = ids => { for (const id of ids) if (legal(id)) return id; return null; };
  const mastered = id => o.person.mastered.includes(id);
  const tech = id => o.technologies.find(t => t.id === id);

  if (legal('handover')) return 'handover';
  if (!o.actions.some(a => a.enabled)) return null;

  // 1) 口粮安全：低于 4 就先补粮
  if (o.family.food < 4) {
    const f = first([
      ...(o.harvest.food >= 2 ? ['cultivate'] : []),
      ...(p.gathering.food >= 2 ? ['gather:food'] : []),
      'buy-food',
      ...(p.gathering.food > 0 ? ['gather:food'] : []),
      'work',
    ]);
    if (f) return f;
  }

  // 2) 收尾在制项目（制作 / 工业 / 高级设备）
  if (p.project && legal('finish-craft')) return 'finish-craft';
  if (o.development?.project && legal('finish-development')) return 'finish-development';
  if (o.productNetwork?.project && legal('finish-product')) return 'finish-product';

  // 3) 学一个科技：先补前置，再学习，再做实践（自动实践走对应生产动作）
  function learn(id) {
    const t = tech(id);
    if (!t || mastered(id)) return null;
    for (const parent of t.prerequisites) if (!mastered(parent)) { const r = learn(parent); if (r) return r; }
    if (t.prerequisiteAny && !t.prerequisiteAny.some(mastered)) return null;
    if (!t.accessible) return first([`buy-method:${id}`, 'work']);
    if (t.studied < t.required) return first([`study:${id}`]);
    const missing = t.practices.find(tag => !t.practicesDone.includes(tag));
    if (!missing) return null;
    if (missing === 'wood-shaped') return craftWood();
    if (missing === 'pot-fired') return craftPottery();
    if (missing === 'fire-tended') return first(['practice:controlled-fire:fire-tended', 'gather:wood']);
    if (missing === 'storage-fitted') return first([`install-storage:${p.storage.woodenware ? 'pottery' : 'woodenware'}`, 'study:storage']);
    if (missing === 'cultivation') return first(['cultivate', 'end-turn']);
    if (missing === 'survey') return first(['practice:survey:survey']);
    if (missing === 'channel-model') return first(['practice:ditch:channel-model']);
    if (missing === 'water-plan') return first(['practice:allocation:water-plan', o.family.channel ? 'repair-channel' : 'build-channel']);
    if (missing === 'selection') return first(['practice:selection:selection']);
    if (missing === 'trial-completed') return first(['prepare-seed', 'start-trial', 'cultivate', 'end-turn']);
    if (missing === 'stock-release') {
      const samples = o.family.reports.at(-1)?.samples ?? [];
      const diff = samples.reduce((s, x) => s + x.candidate - x.control, 0);
      return first([`release:${diff > 0 ? 'adopt' : 'keep'}`]);
    }
    if (missing.startsWith('development-')) return devProject(missing.replace('development-', ''));
    return first([`practice:${id}:${missing}`]);
  }
  function craftWood() {
    if (!p.project) {
      if (p.inventory.wood < 2) return first(['gather:wood', 'work', 'end-turn']);
      if (legal('craft:woodenware')) return 'craft:woodenware';
    }
    return first(['finish-craft']);
  }
  function craftPottery() {
    if (!p.project) {
      if (p.inventory.clay < 2) return first(['gather:clay', 'procure-clay', 'work']);
      if (p.inventory.wood < 2) return first(['gather:wood', 'work']);
      if (legal('craft:pottery')) return 'craft:pottery';
    }
    return first(['finish-craft']);
  }
  function devProject(domain) {
    const map = { agronomy: 'supplies', 'ceramic-engineering': 'ceramicParts', mechanics: 'mechanisms', experimentation: 'labTools', 'precision-engineering': 'precisionParts' };
    const recipe = map[domain];
    if (recipe && legal(`develop:${recipe}`)) return `develop:${recipe}`;
    return first(['work', 'end-turn']);
  }

  // 4) 按策略推进科技树
  const plan = {
    craft: ['woodworking', 'storage', 'controlled-fire', 'pottery'],
    dev: ['woodworking', 'mechanics', 'ceramic-engineering', 'experimentation', 'precision-engineering'],
    agri: ['observation', 'survey', 'ditch', 'allocation', 'storage'],
    science: ['woodworking', 'controlled-fire', 'pottery', 'ceramic-engineering', 'experimentation'],
    balanced: ['woodworking', 'storage', 'controlled-fire', 'pottery', 'mechanics', 'experimentation'],
  }[policy] ?? ['woodworking', 'storage', 'controlled-fire', 'pottery'];
  for (const id of plan) { const r = learn(id); if (r) return r; }

  // 5) 传承：非末代且已掌握时教后辈
  if (o.clock.generation < o.clock.generations) {
    for (const id of plan) if (mastered(id) && !o.heir.mastered.includes(id) && legal(`teach:${id}`)) return `teach:${id}`;
    for (const id of plan) if (mastered(id) && !o.knowledge?.archives?.includes(id) && legal(`archive:${id}`)) return `archive:${id}`;
  }

  // 6) 收入：卖货 / 交付订单 / 做工
  const income = first([
    'sell-good:woodenware', 'sell-good:pottery',
    'deliver:precisionParts', 'deliver:labTools', 'deliver:fieldTools', 'deliver:mechanisms', 'deliver:ceramicParts', 'deliver:supplies',
    'work',
  ]);
  if (income) return income;

  // 7) 有余粮就耕作攒粮，否则结束本季
  if (o.harvest.food > 0 && o.family.food < 12) { const c = first(['cultivate']); if (c) return c; }
  return 'end-turn';
}

// ---- 跑一局（经 FileRunStore 落盘：record.json + history/ 逐条备份）----
async function playGame({ runId, seed, scenario, policy, quiet = false }) {
  const store = new FileRunStore(join(root, 'artifacts', 'runs'), implementation);
  let session = await createSession({ runId, ruleset: RULES, implementation, seed, scenarioId: scenario, agent: { kind: 'scripted', name: `play:${policy}` } });
  await store.create(session);
  let obs = observeSession(session);
  const seasons = [];
  let actions = 0, lastSeasonKey = '';
  const maxActions = 800;
  const pushSeason = (label) => {
    const g = obs.game;
    const key = `${g.clock.generation}:${g.clock.turn}:${g.world.weather}`;
    if (label || key !== lastSeasonKey) {
      seasons.push({
        gen: g.clock.generation, turn: g.clock.turn, weather: g.world.weather,
        food: g.family.food, money: g.family.money, hardship: g.family.hardship,
        wood: g.production?.inventory.wood ?? 0, clay: g.production?.inventory.clay ?? 0,
        woodenware: g.production?.inventory.woodenware ?? 0, pottery: g.production?.inventory.pottery ?? 0,
        mastered: [...g.person.mastered], heir: [...g.heir.mastered],
        goods: g.development ? { ...g.development.goods } : {},
        status: g.status,
      });
      lastSeasonKey = key;
    }
  };
  pushSeason(true);
  const milestones = {};
  const note = (key, val) => { if (milestones[key] === undefined) milestones[key] = val; };
  while ((obs.game.status === 'active' || obs.game.status === 'handover') && actions < maxActions) {
    const actionId = decide(obs, policy) ?? 'end-turn';
    const result = await store.submit(runId, { commandId: `${runId}:${obs.revision}`, expectedRevision: obs.revision, actionId, reason: `play:${policy}` });
    session = result.session; obs = observeSession(session); actions++;
    const g = obs.game, clk = `${g.clock.generation}:${g.clock.turn}`;
    for (const good of ['ceramicParts', 'mechanisms', 'fieldTools', 'labTools', 'precisionParts', 'supplies']) if (g.development?.goods[good] > 0) note(`produced:${good}`, clk);
    for (const dev of ['calibrator', 'pump', 'kiln']) if (g.productNetwork?.goods[dev] > 0) note(`device:${dev}`, clk);
    if (g.productNetwork?.goods.calibrations > 0) note('calibration-report', clk);
    pushSeason(false);
  }
  const g = obs.game;
  const summary = {
    runId, policy, seed, scenario,
    status: g.status,
    generationsReached: g.clock.generation,
    finalTurn: g.clock.turn,
    food: g.family.food, money: g.family.money, hardship: g.family.hardship,
    mastered: g.person.mastered, heirMastered: g.heir.mastered,
    skillLevels: g.development ? g.development.skills.map(s => `${s.domain}:${s.level}`) : [],
    archives: g.family.archives,
    goods: g.development ? g.development.goods : {},
    productGoods: g.productNetwork?.goods ?? {},
    milestones,
    actions,
  };
  return { summary, seasons };
}

// ---- 主流程 ----
const [,, mode, ...rest] = process.argv;
if (mode === 'one') {
  const { runId, seed, scenario, policy } = Object.fromEntries(rest.map(a => a.split('=')).filter(([,v]) => v));
  const { summary, seasons } = await playGame({ runId, seed: Number(seed), scenario, policy });
  console.log('=== SEASONS ===');
  for (const s of seasons) console.log(JSON.stringify(s));
  console.log('=== SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
} else {
  const games = [
    { runId: 'v7-a1', seed: 17, scenario: 'woodland', policy: 'craft' },
    { runId: 'v7-a2', seed: 23, scenario: 'woodland', policy: 'craft' },
    { runId: 'v7-a3', seed: 42, scenario: 'woodland', policy: 'craft' },
    { runId: 'v7-b1', seed: 17, scenario: 'woodland', policy: 'dev' },
    { runId: 'v7-b2', seed: 23, scenario: 'woodland', policy: 'dev' },
    { runId: 'v7-b3', seed: 42, scenario: 'woodland', policy: 'dev' },
    { runId: 'v7-c1', seed: 17, scenario: 'river', policy: 'agri' },
    { runId: 'v7-c2', seed: 23, scenario: 'river', policy: 'agri' },
    { runId: 'v7-d1', seed: 17, scenario: 'clay-valley', policy: 'science' },
    { runId: 'v7-d2', seed: 17, scenario: 'clay-valley', policy: 'dev' },
  ];
  const out = [];
  for (const g of games) {
    const { summary } = await playGame(g);
    out.push(summary);
    console.error(`done ${g.runId} [${g.policy}] -> ${summary.status} gen${summary.generationsReached} money=${summary.money} food=${summary.food} mastered=${summary.mastered.length}`);
  }
  console.log(JSON.stringify(out, null, 2));
}
