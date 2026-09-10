import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createGame, exportGame, harvestPreview, importGame, legalActions, metrics, observe } from '../src/engine.mjs';
import { chooseAction } from '../src/policies.mjs';
import { parameters, validateRules } from '../src/rules.mjs';

const act = (state, id) => applyAction(state, id, state.revision);
const enabled = (state, id) => legalActions(state).some(a => a.id === id);
function run(policy, seed = 17, scenario = 'river') {
  let state = createGame({ seed, scenario });
  while (!['complete', 'ended'].includes(state.status)) {
    assert.ok(state.commands.length < 200, '有限季数内应有界结束');
    const o = observe(state);
    const action = chooseAction(o, policy);
    assert.ok(o.actions.some(a => a.id === action && a.enabled));
    state = act(state, action);
  }
  return state;
}

test('内容前置、参数类型与实验边界明确', () => {
  assert.equal(validateRules(), true);
  assert.throws(() => parameters({ invented: 1 }));
  assert.throws(() => parameters({ channelCost: -1 }));
  assert.throws(() => createGame({ seed: 0 }));
  assert.throws(() => createGame({ scenario: 'missing' }));
});

test('行动不修改输入；旧 revision 与不合法行动不能扣费', () => {
  const state = createGame();
  const original = structuredClone(state);
  const next = act(state, 'work');
  assert.deepEqual(state, original);
  assert.equal(next.family.money, state.family.money + state.parameters.workIncome);
  assert.equal(next.ap, state.ap - 1);
  assert.throws(() => applyAction(next, 'work', state.revision), /过期/);
  assert.throws(() => act(state, 'build-channel'), /渠道布局/);
  assert.throws(() => act(state, 'hack'), /不存在/);
});

test('基础节点需要学习与具体实践，前置不能靠钱跳过', () => {
  let state = createGame();
  state = act(state, 'study:observation');
  assert.ok(!state.person.mastered.includes('observation'));
  assert.ok(!enabled(state, 'study:survey'));
  state = act(state, 'cultivate');
  assert.ok(state.person.mastered.includes('observation'));
  assert.ok(enabled(state, 'study:survey'));
  assert.ok(!enabled(state, 'cultivate'), '同一季不能反复耕作同一地块');
});

test('没有师傅和材料就不能学习；家学只开放来源', () => {
  const state = createGame();
  state.world.teachers = [];
  assert.ok(!enabled(state, 'study:observation'));
  state.family.archives = ['observation'];
  assert.ok(enabled(state, 'study:observation'));
  assert.ok(!state.person.mastered.includes('observation'));
  state.world.technologies = [];
  assert.ok(!enabled(state, 'study:observation'));
});

test('懂渠道不凭空增产，实际设施与配水才改变缺水过程', () => {
  const state = createGame({ scenario: 'dry' });
  state.world.rain = 0; state.world.water = 1;
  const base = harvestPreview(state).food;
  state.person.mastered.push('ditch');
  assert.equal(harvestPreview(state).food, base);
  state.family.channel = { durability: 3 };
  const withChannel = harvestPreview(state).food;
  assert.ok(withChannel > base);
  state.person.mastered.push('allocation');
  assert.ok(harvestPreview(state).food > withChannel);
  const next = act(state, 'cultivate');
  assert.equal(next.family.channel.durability, 2);
  assert.equal(next.world.water, 0);
});

test('丰水时渠道不凭空增产也不磨损；耐旱种源存在取舍', () => {
  const state = createGame();
  state.world.rain = 3;
  const normal = harvestPreview(state).food;
  state.family.channel = { durability: 3 };
  assert.equal(harvestPreview(state).food, normal);
  assert.equal(act(state, 'cultivate').family.channel.durability, 3);
  const candidate = { potential: state.parameters.cropPotential - 1, tolerance: 1 };
  assert.ok(harvestPreview(state, candidate).gross < harvestPreview(state).gross);
  state.world.rain = 0; state.family.channel = null;
  assert.ok(harvestPreview(state, candidate).gross > harvestPreview(state).gross);
});

test('末点行动原子结算季末、生活消耗并进入下一季', () => {
  let state = createGame();
  state = act(act(state, 'work'), 'work');
  const next = act(state, 'work');
  assert.equal(next.turn, 2);
  assert.equal(next.ap, state.parameters.actionsPerTurn);
  assert.equal(next.family.food, state.family.food - state.parameters.foodPerTurn);
  assert.equal(next.commands.length, 3);
});

test('生活缺口可终止实验；终止记录不被新行动覆盖', () => {
  let state = createGame({ overrides: { initialFood: 0 } });
  for (let i = 0; i < state.parameters.hardshipLimit; i++) state = act(state, 'end-turn');
  assert.equal(state.status, 'ended');
  assert.equal(legalActions(state).length, 0);
  assert.throws(() => act(state, 'work'));
});

test('教学产生真实后辈进度；交接不复制前代所有节点', () => {
  let state = createGame();
  state.person.mastered = ['observation', 'survey'];
  state.family.archives = ['survey'];
  state = act(state, 'teach:observation');
  assert.equal(state.heir.learning.observation, 1);
  assert.deepEqual(state.heir.mastered, []);
  state = act(state, 'teach:observation');
  assert.ok(state.heir.mastered.includes('observation'));
  state.turn = state.parameters.turnsPerGeneration;
  state = act(state, 'end-turn');
  assert.equal(state.status, 'handover');
  state = act(state, 'handover');
  assert.deepEqual(state.person.mastered, ['observation']);
  assert.deepEqual(state.family.archives, ['survey']);
  assert.equal(state.person.learning.survey, undefined);
});

test('试种占用产出，跨代保留，完成记录不会自动替换种源', () => {
  let state = createGame();
  state.person.mastered = ['observation', 'selection'];
  state.person.learning.trial = 1;
  state = act(state, 'prepare-seed');
  state = act(state, 'start-trial');
  const prediction = harvestPreview(state);
  assert.equal(prediction.landCost, state.parameters.trialLandCost);
  state = act(state, 'cultivate');
  assert.equal(state.family.project.samples.length, 1);
  state.turn = state.parameters.turnsPerGeneration;
  state = act(state, 'end-turn');
  state = act(state, 'handover');
  assert.equal(state.family.project.samples.length, 1);
  state = act(state, 'cultivate');
  assert.equal(state.family.project, null);
  assert.equal(state.family.reports[0].samples.length, 2);
  assert.equal(state.family.stock.name, '普通地方种源');
  assert.ok(!state.person.mastered.includes('trial'));
});

test('AI 观察不包含种子或 RNG，返回副本不可修改世界', () => {
  const state = createGame();
  const o = observe(state);
  assert.equal(o.rng, undefined); assert.equal(o.config, undefined);
  assert.equal(o.seed, undefined);
  o.family.food = 900; o.person.mastered.push('stabilize');
  assert.equal(state.family.food, state.parameters.initialFood);
  assert.ok(!state.person.mastered.includes('stabilize'));
});

test('存档完整重放，篡改行动或规则版本被拒绝', () => {
  let state = createGame({ seed: 17 });
  state = act(act(state, 'study:observation'), 'cultivate');
  state = act(state, 'work');
  assert.deepEqual(importGame(exportGame(state)), state);
  const bad = exportGame(state); bad.rulesVersion = 'unknown';
  assert.throws(() => importGame(bad), /规则版本/);
  const altered = exportGame(state); altered.commands[0].actionId = 'build-channel';
  assert.throws(() => importGame(altered));
});

test('少量脚本对照能走完两代、学习不同分支并可重放', () => {
  const irrigation = run('irrigation');
  const seed = run('seed');
  const legacy = run('legacy');
  const subsistence = run('subsistence');
  for (const state of [irrigation, seed, legacy, subsistence]) {
    assert.equal(state.status, 'complete');
    assert.equal(state.history.length, 2);
    assert.deepEqual(metrics(importGame(exportGame(state))), metrics(state));
  }
  assert.ok(irrigation.stats.learned.some(t => t.id === 'ditch'));
  assert.ok(seed.stats.researchSamples >= 2);
  assert.ok(seed.stats.learned.some(t => t.id === 'stabilize'));
  assert.ok(legacy.stats.inherited.some(x => x.mastered.length > 0));
  assert.equal(subsistence.stats.studyActions, 0);
});
