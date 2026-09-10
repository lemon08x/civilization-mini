// 初始参数是实验假设，不是已验证的历史常数或平衡结论。
export const RULES_VERSION = '0.1.0';
export const DEFAULT_PARAMETERS = Object.freeze({
  actionsPerTurn: 3,
  turnsPerGeneration: 8,
  generations: 2,
  initialFood: 6,
  initialMoney: 8,
  foodPerTurn: 2,
  workIncome: 2,
  foodPrice: 1,
  cropPotential: 4,
  channelCost: 3,
  channelDurability: 3,
  repairCost: 1,
  trialCost: 2,
  trialSeasons: 2,
  trialLandCost: 1,
  archiveCost: 1,
  studyCost: 0,
  trainingCost: 1,
  studyMultiplier: 1,
  hardshipLimit: 3,
});

export const PARAMETER_BOUNDS = {
  actionsPerTurn: [2, 6], turnsPerGeneration: [4, 24], generations: [2, 4],
  initialFood: [0, 30], initialMoney: [0, 30], foodPerTurn: [1, 6],
  workIncome: [1, 8], foodPrice: [1, 5], cropPotential: [2, 8],
  channelCost: [1, 15], channelDurability: [1, 8], repairCost: [1, 8],
  trialCost: [1, 10], trialSeasons: [2, 6], trialLandCost: [1, 2],
  archiveCost: [1, 5], studyCost: [0, 5], trainingCost: [0, 5],
  studyMultiplier: [1, 3], hardshipLimit: [2, 6],
};

export function parameters(overrides = {}) {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) throw new Error('参数需要 JSON 对象');
  for (const [key, value] of Object.entries(overrides)) {
    const bounds = PARAMETER_BOUNDS[key];
    if (!bounds || !Number.isInteger(value) || value < bounds[0] || value > bounds[1]) {
      throw new Error(`不支持的参数或超出范围：${key}`);
    }
  }
  return { ...DEFAULT_PARAMETERS, ...overrides };
}

export const SCENARIOS = {
  river: { id: 'river', name: '河渠村落', text: '旱、平、涝都有；可接触测量、沟渠和选种方法。', drought: 30, wet: 20, water: 2 },
  dry: { id: 'dry', name: '缺水村落', text: '旱季较多，公共水源有限；检验水利和种源路线的区别。', drought: 60, wet: 10, water: 1 },
};

export const TECHS = [
  { id: 'observation', name: '田间观察', branch: '共同基础', world: '耕作经验', prerequisites: [], study: 1, practices: ['cultivation'], benefit: '建立水分与收成的记录，开放测量和选种学习。', insight: '经历一次旱季耕作', practiceText: '完成一次耕作（无需先学习）' },
  { id: 'survey', name: '地形测量', branch: '灌溉', world: '基础测量', prerequisites: ['observation'], study: 2, practices: ['survey'], benefit: '学会测量地块，获得渠道布局的前置基础。', insight: null, practiceText: '完成地块测量练习' },
  { id: 'ditch', name: '渠道布局', branch: '灌溉', world: '沟渠施工', prerequisites: ['survey'], study: 2, practices: ['channel-model'], benefit: '能建设家用引水渠；设施才会改善耕作供水。', insight: null, practiceText: '完成渠道模型练习' },
  { id: 'allocation', name: '配水管理', branch: '灌溉', world: '沟渠施工', prerequisites: ['ditch'], study: 2, practices: ['water-plan'], benefit: '耕作时每单位引水满足两单位需水；只在水分不足时有用。', insight: null, practiceText: '拥有可用渠道时完成配水练习' },
  { id: 'selection', name: '田间选种', branch: '种源', world: '留种选种', prerequisites: ['observation'], study: 2, practices: ['selection'], benefit: '能从现有种源中准备候选种子，开放比较试种。', insight: null, practiceText: '消耗 1 口粮完成选种练习' },
  { id: 'trial', name: '对照试种', branch: '种源', world: '留种选种', prerequisites: ['selection'], study: 2, practices: ['trial-completed'], benefit: '能比较种源在不同天气下的表现；结果是记录，不是自动增产。', insight: null, practiceText: '完成一次多季试种项目' },
  { id: 'stabilize', name: '种源定选', branch: '种源', world: '留种选种', prerequisites: ['trial'], study: 2, practices: ['stock-release'], benefit: '能依据试种记录决定替换或保留种源；不是现代遗传育种。', insight: null, practiceText: '读过试种记录后完成一次定选' },
];

export const WORLD_TECHS = ['耕作经验', '基础测量', '沟渠施工', '留种选种'];
export const PRACTICE_NAMES = {
  cultivation: '耕作', survey: '地块测量', 'channel-model': '渠道模型',
  'water-plan': '配水方案', selection: '留选种子',
  'trial-completed': '多季试种', 'stock-release': '种源定选',
};

export const POLICIES = ['subsistence', 'irrigation', 'seed', 'legacy'];
export const POLICY_NAMES = { subsistence: '维持生活', irrigation: '水利投资', seed: '种源试验', legacy: '培养后代' };

export function validateRules() {
  const ids = new Set(TECHS.map(t => t.id));
  if (ids.size !== TECHS.length) throw new Error('科技 ID 重复');
  const done = new Set();
  const active = new Set();
  function visit(id) {
    if (active.has(id)) throw new Error(`科技前置成环：${id}`);
    if (done.has(id)) return;
    const tech = TECHS.find(t => t.id === id);
    if (!tech) throw new Error(`不存在的前置：${id}`);
    if (!WORLD_TECHS.includes(tech.world) || !Number.isInteger(tech.study) || tech.study < 1 || !tech.benefit) throw new Error(`科技不完整：${id}`);
    active.add(id);
    tech.prerequisites.forEach(visit);
    active.delete(id); done.add(id);
  }
  TECHS.forEach(t => visit(t.id));
  parameters();
  return true;
}
