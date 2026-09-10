import { DEFAULT_PARAMETERS, PRACTICE_NAMES, RULES_VERSION, SCENARIOS, TECHS, WORLD_TECHS, parameters, validateRules } from './rules.mjs';

validateRules();
const copy = value => structuredClone(value);
const techById = id => TECHS.find(t => t.id === id);
const blankPerson = name => ({ name, mastered: [], learning: {}, practices: [], insights: [] });
const add = (list, item) => { if (!list.includes(item)) list.push(item); };
const has = (person, id) => person.mastered.includes(id);
const prerequisites = (person, tech) => tech.prerequisites.every(id => has(person, id));
const studyRequired = (state, person, tech) => Math.max(1, tech.study * state.parameters.studyMultiplier - Number(person.insights.includes(tech.id)));

function random(state) {
  let x = state.rng;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  state.rng = x >>> 0;
  return state.rng / 4294967296;
}

function newSeason(state) {
  const scenario = SCENARIOS[state.scenario];
  const roll = random(state) * 100;
  const weather = roll < scenario.drought ? 'dry' : roll < scenario.drought + scenario.wet ? 'wet' : 'normal';
  state.world.weather = weather;
  state.world.rain = { dry: 0, normal: 2, wet: 3 }[weather];
  state.world.water = weather === 'dry' ? scenario.water : 2;
  state.ap = state.parameters.actionsPerTurn;
  state.season = { cultivated: false, usedChannel: false, trialSample: false };
}

export function createGame({ seed = 1, scenario = 'river', overrides = {} } = {}) {
  if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) throw new Error('种子需要是 1—4294967295 的整数');
  if (!SCENARIOS[scenario]) throw new Error('未知场景');
  const p = parameters(overrides);
  const state = {
    rulesVersion: RULES_VERSION,
    config: { seed, scenario, overrides: copy(overrides) },
    parameters: p, scenario, rng: seed, revision: 0, commands: [],
    generation: 1, turn: 1, absoluteTurn: 1, status: 'active',
    person: blankPerson('本代经营者'), heir: blankPerson('已成年的后辈'),
    family: {
      food: p.initialFood, money: p.initialMoney, hardship: 0,
      channel: null, archives: [],
      stock: { name: '普通地方种源', potential: p.cropPotential, tolerance: 0 },
      candidate: null, project: null, reports: [],
    },
    world: { era: '传统农业技术条件（非具体史年）', technologies: [...WORLD_TECHS], teachers: TECHS.map(t => t.id) },
    season: {}, ap: p.actionsPerTurn,
    feedback: ['观察天气与家庭储备，再安排本季的三点行动。'],
    log: [], history: [],
    stats: { foodProduced: 0, foodConsumed: 0, shortfall: 0, earnings: 0, waterUsed: 0, studyActions: 0, teachingActions: 0, researchSamples: 0, learned: [], inherited: [], actionCounts: {} },
  };
  newSeason(state);
  return state;
}

function masterAvailable(state, person, feedback) {
  for (const tech of TECHS) {
    if (!has(person, tech.id) && prerequisites(person, tech)
      && (person.learning[tech.id] ?? 0) >= studyRequired(state, person, tech)
      && tech.practices.every(tag => person.practices.includes(tag))) {
      add(person.mastered, tech.id);
      feedback.push(`${person.name}掌握「${tech.name}」：${tech.benefit}`);
      if (person === state.person) state.stats.learned.push({ generation: state.generation, turn: state.turn, id: tech.id });
    }
  }
}

function accessible(state, tech) {
  return state.world.technologies.includes(tech.world)
    && (state.world.teachers.includes(tech.id) || state.family.archives.includes(tech.id));
}

export function harvestPreview(state, stock = state.family.stock) {
  const shortage = Math.max(0, 2 - state.world.rain);
  const available = state.family.channel?.durability > 0 ? state.world.water : 0;
  const efficiency = has(state.person, 'allocation') ? 2 : 1;
  const drawn = Math.min(available, Math.ceil(shortage / efficiency));
  const deficit = Math.max(0, shortage - drawn * efficiency);
  const gross = Math.max(0, stock.potential - deficit * (2 - stock.tolerance));
  const landCost = state.family.project ? state.parameters.trialLandCost : 0;
  return { gross, food: Math.max(0, gross - landCost), drawn, deficit, landCost };
}

export function legalActions(state, { includeUnavailable = false } = {}) {
  if (state.status === 'complete' || state.status === 'ended') return [];
  if (state.status === 'handover') return [{ id: 'handover', label: '交接给后辈', group: '传承', ap: 0, money: 0, food: 0, enabled: true, reason: '', description: '保留后辈真实学习状态、家学、资产和未完项目；前代个人能力不会复制。' }];
  const actions = [];
  function offer(id, label, group, costs = {}, reasons = [], description = '') {
    const ap = costs.ap ?? 1, money = costs.money ?? 0, food = costs.food ?? 0;
    if (state.ap < ap) reasons.push('行动点不足');
    if (state.family.money < money) reasons.push('钱财不足');
    if (state.family.food < food) reasons.push('口粮不足');
    actions.push({ id, label, group, ap, money, food, enabled: reasons.length === 0, reason: reasons.join('；'), description });
  }
  const p = state.parameters;
  const crop = harvestPreview(state);
  offer('cultivate', '耕作并记录', '生活', {}, state.season.cultivated ? ['本季已耕作'] : [], `本季可得 ${crop.food} 口粮；引水 ${crop.drawn}，试验地占用 ${crop.landCost}。结果由当前天气、种源和设施计算。`);
  offer('work', '为邻里做工', '生活', {}, [], `收入 ${p.workIncome} 钱财。`);
  offer('buy-food', '买入 2 口粮', '生活', { money: 2 * p.foodPrice }, [], '用于家庭生活或实践；交易也占用行动点。');
  offer('sell-food', '卖出 2 口粮', '生活', { food: 2 }, [], `收入 ${p.foodPrice} 钱财；不能买卖套利。`);
  offer('build-channel', '建设家用引水渠', '设施', { ap: 2, money: p.channelCost }, [
    ...(!has(state.person, 'ditch') ? ['需要掌握渠道布局'] : []),
    ...(state.family.channel ? ['渠道已经存在，请维修'] : []),
  ], `建成后耐用 ${p.channelDurability} 次实际引水；缺水时耕作自动使用。`);
  offer('repair-channel', '维修引水渠', '设施', { money: p.repairCost }, [
    ...(!state.family.channel ? ['尚无渠道'] : []),
    ...(state.family.channel?.durability === p.channelDurability ? ['渠道完好'] : []),
  ], '基础维护可向当地匠人求助，不要求继承人已会设计渠道。');

  for (const tech of TECHS) {
    const progress = state.person.learning[tech.id] ?? 0;
    const required = studyRequired(state, state.person, tech);
    const missing = tech.prerequisites.filter(id => !has(state.person, id)).map(id => techById(id).name);
    const common = [
      ...(!state.world.technologies.includes(tech.world) ? ['社会技术尚未开放'] : []),
      ...(missing.length ? [`缺少前置：${missing.join('、')}`] : []),
    ];
    offer(`study:${tech.id}`, `学习：${tech.name}`, '学习', { money: state.family.archives.includes(tech.id) ? 0 : p.studyCost }, [
      ...common, ...(!accessible(state, tech) ? ['当地没有教师，家庭也无材料'] : []),
      ...(has(state.person, tech.id) ? ['已经掌握'] : []),
      ...(progress >= required ? ['学习次数已足够，需完成实践'] : []),
    ], `学习 ${progress}/${required}；实践：${tech.practices.map(tag => PRACTICE_NAMES[tag]).join('、')}。${tech.benefit}`);
    for (const tag of tech.practices) {
      if (['cultivation', 'trial-completed', 'stock-release'].includes(tag)) continue;
      offer(`practice:${tech.id}:${tag}`, `实践：${PRACTICE_NAMES[tag]}`, '实践', { money: tag === 'selection' ? 0 : p.trainingCost, food: tag === 'selection' ? 1 : 0 }, [
        ...common, ...(!accessible(state, tech) ? ['没有受指导实践渠道'] : []),
        ...(progress < 1 ? ['先完成一次学习'] : []),
        ...(state.person.practices.includes(tag) ? ['已完成该项实践'] : []),
        ...(tag === 'water-plan' && !(state.family.channel?.durability > 0) ? ['需要可用引水渠'] : []),
      ], '受指导练习只获得具体实践记录，不凭空生成家庭生产设施。');
    }
    offer(`archive:${tech.id}`, `留存方法：${tech.name}`, '传承', { money: p.archiveCost }, [
      ...(!has(state.person, tech.id) ? ['自己尚未掌握'] : []),
      ...(state.family.archives.includes(tech.id) ? ['已完整留存'] : []),
    ], '以样具、图样和委托记录等抽象载体留存方法；只保留学习渠道，不复制个人掌握。');
    const heirMissing = tech.prerequisites.filter(id => !has(state.heir, id));
    const heirStudy = state.heir.learning[tech.id] ?? 0;
    const heirNeedsStudy = heirStudy < studyRequired(state, state.heir, tech);
    const heirPractice = tech.practices.find(tag => !state.heir.practices.includes(tag));
    offer(`teach:${tech.id}`, `${heirNeedsStudy ? '教导' : '带后辈练习'}：${tech.name}`, '传承', {}, [
      ...(!has(state.person, tech.id) ? ['自己尚未掌握'] : []),
      ...(heirMissing.length ? ['后辈缺少前置基础'] : []),
      ...(has(state.heir, tech.id) ? ['后辈已经掌握'] : []),
      ...(!heirNeedsStudy && heirPractice === 'trial-completed' && !state.family.reports.length ? ['需要家庭试种记录供后辈复盘'] : []),
      ...(!heirNeedsStudy && heirPractice === 'water-plan' && !(state.family.channel?.durability > 0) ? ['需要可用引水渠'] : []),
    ], heirNeedsStudy ? '投入一点行动，完成后辈的一次学习。' : '投入一点行动开展有指导的练习／项目复盘；不额外产生产品。');
  }
  offer('prepare-seed', '准备候选种源', '研究', { food: 1 }, [
    ...(!has(state.person, 'selection') ? ['需要掌握田间选种'] : []),
    ...(state.family.candidate ? ['已经有候选种源'] : []),
    ...(state.family.reports.length ? ['本实验的一组种源比较已经完成'] : []),
  ], '准备耐旱但丰水潜力较低的留选种源。是否值得替换，需要比较当地表现。');
  offer('start-trial', '启动比较试种', '研究', { money: p.trialCost }, [
    ...(!prerequisites(state.person, techById('trial')) || (state.person.learning.trial ?? 0) < 1 ? ['需要选种基础并学习过对照试种'] : []),
    ...(!state.family.candidate ? ['先准备候选种源'] : []),
    ...(state.family.project ? ['已有试种项目'] : []),
    ...(state.family.reports.length ? ['本轮候选试验已完成，先定选'] : []),
  ], `需要 ${p.trialSeasons} 个实际耕作季；每个耕作季少产 ${p.trialLandCost} 口粮，记录两种种源的同条件表现。`);
  const canRelease = prerequisites(state.person, techById('stabilize')) && (state.person.learning.stabilize ?? 0) >= 1;
  for (const decision of ['keep', 'adopt']) {
    offer(`release:${decision}`, decision === 'keep' ? '定选：保留原种源' : '定选：采用候选种源', '研究', {}, [
      ...(!canRelease ? ['需要试种基础并学习过种源定选'] : []),
      ...(!state.family.reports.length ? ['需要完整比较记录'] : []),
      ...(!state.family.candidate ? ['没有待定选的种源'] : []),
    ], '这是选择适合本地的既有种源，不是宣称育成了新品种；比较记录不保证未来天气相同。');
  }
  offer('end-turn', '结束本季', '回合', { ap: 0 }, [], `消耗 ${p.foodPerTurn} 口粮，结算生活。剩余行动点不结转。`);
  return includeUnavailable ? actions : actions.filter(a => a.enabled);
}

function finishSeason(state, feedback) {
  const p = state.parameters;
  const eaten = Math.min(state.family.food, p.foodPerTurn);
  state.family.food -= eaten;
  state.stats.foodConsumed += eaten;
  const missing = p.foodPerTurn - eaten;
  state.stats.shortfall += missing;
  state.family.hardship = missing ? state.family.hardship + 1 : 0;
  feedback.push(`季末消耗 ${eaten} 口粮${missing ? `，缺口 ${missing}；连续困顿 ${state.family.hardship} 季` : '，基本生活得到满足'}。`);
  if (state.family.hardship >= p.hardshipLimit) {
    state.status = 'ended'; feedback.push('连续生活缺口达到实验终止条件；保留记录供分析。'); return;
  }
  if (state.turn >= p.turnsPerGeneration) {
    state.history.push({ generation: state.generation, food: state.family.food, money: state.family.money, mastered: [...state.person.mastered], heir: [...state.heir.mastered], archives: [...state.family.archives], project: copy(state.family.project), shortfall: state.stats.shortfall });
    state.status = state.generation >= p.generations ? 'complete' : 'handover';
    feedback.push(state.status === 'complete' ? '已到达实验观察终点；不代表家族死亡或游戏胜利。' : '本代经营窗口结束，请查看后辈实际学会什么，再交接。');
    return;
  }
  state.turn++; state.absoluteTurn++; newSeason(state);
  feedback.push(`进入第 ${state.generation} 代第 ${state.turn} 季，天气：${weatherName(state.world.weather)}。`);
}

function sampleTrial(state, feedback) {
  const project = state.family.project;
  if (!project) return;
  // 配对样地使用同一时点的天气、供水与操作者；试验地成本只从本季实收扣一次。
  const control = harvestPreview(state, project.control).gross;
  const candidate = harvestPreview(state, project.candidate).gross;
  project.samples.push({ season: state.absoluteTurn, weather: state.world.weather, control, candidate, irrigation: has(state.person, 'allocation') ? '配水' : state.family.channel?.durability > 0 ? '渠道' : '雨养' });
  state.stats.researchSamples++;
  feedback.push(`试种记录 ${project.samples.length}/${state.parameters.trialSeasons}：原种源 ${control}，候选 ${candidate}（标准样地产量单位）。`);
  if (project.samples.length >= state.parameters.trialSeasons) {
    state.family.reports.push(copy(project));
    state.family.project = null;
    add(state.person.practices, 'trial-completed');
    feedback.push('比较试种完成。记录可以跨代保存；是否采用候选种源由你决定。');
  }
}

export function applyAction(input, actionId, expectedRevision) {
  if (expectedRevision !== input.revision) throw new Error(`过期命令：当前 revision=${input.revision}`);
  const action = legalActions(input, { includeUnavailable: true }).find(a => a.id === actionId);
  if (!action || !action.enabled) throw new Error(action?.reason || '此状态下不存在该行动');
  const state = copy(input);
  const feedback = [`${action.label}：消耗 ${action.ap} 行动、${action.money} 钱财、${action.food} 口粮。`];
  const before = { generation: state.generation, turn: state.turn, ap: state.ap, food: state.family.food, money: state.family.money };
  state.ap -= action.ap; state.family.money -= action.money; state.family.food -= action.food;
  state.stats.actionCounts[actionId] = (state.stats.actionCounts[actionId] ?? 0) + 1;
  const [kind, id, tag] = actionId.split(':');
  if (actionId === 'handover') {
    state.stats.inherited.push({ generation: state.generation + 1, mastered: [...state.heir.mastered], learning: copy(state.heir.learning) });
    state.person = state.heir; state.person.name = '本代经营者';
    state.heir = blankPerson('已成年的后辈');
    state.generation++; state.turn = 1; state.absoluteTurn++; state.status = 'active';
    newSeason(state);
    feedback.push('前代个人能力退出；后辈自己的学习记录、家学、实物与项目保留。年龄过程暂不模拟。');
  } else if (actionId === 'cultivate') {
    const crop = harvestPreview(state);
    sampleTrial(state, feedback);
    state.family.food += crop.food; state.stats.foodProduced += crop.food;
    state.world.water -= crop.drawn; state.stats.waterUsed += crop.drawn;
    if (crop.drawn > 0) { state.family.channel.durability--; state.season.usedChannel = true; }
    state.season.cultivated = true;
    add(state.person.practices, 'cultivation');
    if (state.world.weather === 'dry') add(state.person.insights, 'observation');
    feedback.push(`收获 ${crop.food} 口粮；水分缺口 ${crop.deficit}，引水 ${crop.drawn}。${state.family.channel?.durability === 0 ? '渠道需要维修。' : ''}`);
  } else if (actionId === 'work') {
    state.family.money += state.parameters.workIncome; state.stats.earnings += state.parameters.workIncome;
  } else if (actionId === 'buy-food') state.family.food += 2;
  else if (actionId === 'sell-food') { state.family.money += state.parameters.foodPrice; state.stats.earnings += state.parameters.foodPrice; }
  else if (actionId === 'build-channel') state.family.channel = { durability: state.parameters.channelDurability };
  else if (actionId === 'repair-channel') state.family.channel.durability = state.parameters.channelDurability;
  else if (kind === 'study') { state.person.learning[id] = (state.person.learning[id] ?? 0) + 1; state.stats.studyActions++; }
  else if (kind === 'practice') add(state.person.practices, tag);
  else if (kind === 'archive') add(state.family.archives, id);
  else if (kind === 'teach') {
    const tech = techById(id);
    if ((state.heir.learning[id] ?? 0) < studyRequired(state, state.heir, tech)) state.heir.learning[id] = (state.heir.learning[id] ?? 0) + 1;
    else add(state.heir.practices, tech.practices.find(t => !state.heir.practices.includes(t)));
    state.stats.teachingActions++;
    masterAvailable(state, state.heir, feedback);
  } else if (actionId === 'prepare-seed') state.family.candidate = { name: '耐旱留选种源', potential: Math.max(1, state.parameters.cropPotential - 1), tolerance: 1 };
  else if (actionId === 'start-trial') state.family.project = { started: state.absoluteTurn, control: copy(state.family.stock), candidate: copy(state.family.candidate), samples: [] };
  else if (kind === 'release') {
    if (id === 'adopt') state.family.stock = copy(state.family.candidate);
    state.family.candidate = null;
    add(state.person.practices, 'stock-release');
    feedback.push(id === 'adopt' ? '采用候选种源：旱地表现可能改善，丰水潜力较低。' : '保留原种源，研究信息仍存入家庭记录。');
  }
  masterAvailable(state, state.person, feedback);
  if (actionId !== 'handover' && (actionId === 'end-turn' || state.ap === 0)) finishSeason(state, feedback);
  state.revision++;
  state.commands.push({ revision: expectedRevision, actionId });
  state.feedback = feedback;
  state.log.push({ revision: state.revision, actionId, before, after: { generation: state.generation, turn: state.turn, ap: state.ap, food: state.family.food, money: state.family.money, status: state.status }, feedback });
  return state;
}

export function weatherName(value) { return { dry: '干旱', normal: '平水', wet: '丰水' }[value] ?? value; }

export function observe(state) {
  const person = copy(state.person), heir = copy(state.heir);
  return {
    rulesVersion: state.rulesVersion, revision: state.revision, status: state.status,
    scenario: { id: state.scenario, name: SCENARIOS[state.scenario].name, description: SCENARIOS[state.scenario].text },
    clock: { generation: state.generation, turn: state.turn, absoluteTurn: state.absoluteTurn, generations: state.parameters.generations, turnsPerGeneration: state.parameters.turnsPerGeneration },
    ap: state.ap, parameters: copy(state.parameters), world: { ...copy(state.world), weatherName: weatherName(state.world.weather) },
    person, heir, family: copy(state.family), harvest: harvestPreview(state),
    technologies: TECHS.map(tech => ({ ...copy(tech), unlocked: state.world.technologies.includes(tech.world), accessible: accessible(state, tech), mastered: has(person, tech.id), studied: person.learning[tech.id] ?? 0, required: studyRequired(state, person, tech), practicesDone: tech.practices.filter(tag => person.practices.includes(tag)), archived: state.family.archives.includes(tech.id), heirMastered: has(heir, tech.id), heirStudied: heir.learning[tech.id] ?? 0 })),
    actions: legalActions(state, { includeUnavailable: true }), feedback: [...state.feedback],
    history: copy(state.history), stats: copy(state.stats), recentLog: copy(state.log.slice(-6)),
  };
}

export function exportGame(state) {
  return { format: 'civilization-mini-replay', formatVersion: 1, rulesVersion: RULES_VERSION, config: copy(state.config), commands: copy(state.commands) };
}

export function importGame(replay) {
  if (!replay || replay.format !== 'civilization-mini-replay' || replay.formatVersion !== 1 || replay.rulesVersion !== RULES_VERSION || !replay.config || !Array.isArray(replay.commands)) throw new Error('不支持的存档格式或规则版本；原文件应保留');
  if (replay.commands.length > 10000) throw new Error('存档行动数量超出实验上限');
  let state = createGame(replay.config);
  for (const command of replay.commands) {
    if (!command || typeof command.actionId !== 'string') throw new Error('行动记录损坏');
    state = applyAction(state, command.actionId, command.revision);
  }
  return state;
}

export function metrics(state) {
  return {
    status: state.status, completedGenerations: state.history.length,
    food: state.family.food, money: state.family.money, foodProduced: state.stats.foodProduced,
    foodShortfall: state.stats.shortfall, waterUsed: state.stats.waterUsed,
    learnedNodes: [...new Set(state.stats.learned.map(x => x.id))],
    lastPersonMastered: [...state.person.mastered],
    inheritedNodes: state.stats.inherited.map(x => ({ generation: x.generation, nodes: [...x.mastered] })),
    archivedNodes: [...state.family.archives], samples: state.stats.researchSamples,
    studyActions: state.stats.studyActions, teachingActions: state.stats.teachingActions,
    commands: state.commands.length,
  };
}

export { DEFAULT_PARAMETERS };
