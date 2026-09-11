import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContext } from '../apps/cli/context.js';
import { createSession, observeSession, submitCommand } from '../src/runtime/session.js';
import { FROZEN_AGRICULTURE_IMPLEMENTATION, importRecord, replayRecord } from '../src/runtime/replay.js';
import { resolveRuleset, validateRuleset } from '../src/game/ruleset.js';
import { scriptedAgent } from '../src/agents/scripted/baseline.js';
import { runExperiment, validateExperiment } from '../src/research/runner.js';
import { metrics } from '../src/research/metrics.js';

const { productionBase: base, legacyBase, implementation } = await loadContext();
async function game(scenarioId = 'woodland', overrides: Record<string, number> = {}) {
  let session = await createSession({ runId: 'production-test', ruleset: resolveRuleset(base, { initialFood: 30, 'production.baseStorage': 12, ...overrides }), implementation, seed: 17, scenarioId });
  return {
    get session() { return session; },
    get o() { return observeSession(session).game; },
    async act(...actions: string[]) {
      for (const actionId of actions) session = (await submitCommand(session, { commandId: `test:${session.record.entries.length}`, expectedRevision: session.record.entries.length, actionId })).session;
    },
  };
}

test('资源真实耗尽、有限恢复；新生产观察不包含随机状态', async () => {
  const g = await game('woodland', { actionsPerTurn: 6 });
  await g.act('gather:clay', 'gather:clay');
  assert.equal(g.o.production!.stocks.clay, 0);
  const before = g.session;
  await assert.rejects(g.act('gather:clay'), /耗尽/);
  assert.equal(g.session, before);
  await g.act('gather:wood', 'gather:wood', 'end-turn');
  assert.equal(g.o.production!.stocks.clay, 0, '非再生黏土不刷新');
  assert.ok(g.o.production!.stocks.timber >= 6 && g.o.production!.stocks.timber <= 9);
  assert.equal(g.o.production!.inventory.wood, 4);
  const observation = JSON.stringify(observeSession(g.session));
  assert.ok(!observation.includes('randomState') && !observation.includes('codeFingerprint') && !observation.includes('"seed":'));
  assert.ok(Object.isFrozen(g.session.state.production!.inventory));
});

test('做工和购粮耗尽当季供给，过期/失败行动不扣款，下季才补给', async () => {
  const g = await game('woodland', { actionsPerTurn: 6, initialMoney: 30 });
  await g.act('work', 'buy-food', 'buy-food', 'buy-food');
  assert.equal(g.o.production!.market.jobs, 0);
  assert.equal(g.o.production!.market.food, 0);
  const before = g.session;
  await assert.rejects(g.act('work'), /岗位/);
  await assert.rejects(g.act('buy-food'), /粮食/);
  assert.equal(g.session, before);
  await g.act('end-turn');
  assert.equal(g.o.production!.market.jobs, 1);
  assert.equal(g.o.production!.market.food, 6);
});

test('木作无需农业；学习不会生产品，实际制作与储存才产生效果', async () => {
  const g = await game();
  await g.act('study:woodworking', 'study:woodworking');
  assert.ok(!g.o.person.mastered.includes('woodworking'));
  assert.equal(g.o.production!.inventory.woodenware, 0);
  await assert.rejects(g.act('craft:woodenware'), /木材不足/);
  await g.act('gather:wood', 'craft:woodenware');
  assert.equal(g.o.production!.inventory.wood, 0);
  assert.equal(g.o.production!.inventory.woodenware, 0);
  await g.act('finish-craft');
  assert.ok(g.o.person.mastered.includes('woodworking'));
  assert.ok(!g.o.person.mastered.includes('observation'));
  assert.equal(g.o.production!.inventory.woodenware, 1);
  await g.act('study:storage', 'install-storage:woodenware');
  assert.ok(g.o.person.mastered.includes('storage'));
  assert.equal(g.o.production!.inventory.woodenware, 0);
  assert.equal(g.o.production!.storageCapacity, 16);
  await assert.rejects(g.act('install-storage:woodenware'));
});

test('储存损耗先扣生活再算余粮；容量候选只能放独立覆盖中', async () => {
  const unprotected = await game('woodland', { initialFood: 10, 'production.baseStorage': 2 });
  const protectedGame = await game('woodland', { initialFood: 10, 'production.baseStorage': 8 });
  assert.equal(unprotected.o.production!.spoilageAfterConsumption, 3);
  await unprotected.act('end-turn'); await protectedGame.act('end-turn');
  assert.equal(unprotected.o.family.food, 5);
  assert.equal(protectedGame.o.family.food, 8);
  assert.equal(metrics(unprotected.session.record, unprotected.session.state).production!.spoiledFood, 3);
  assert.equal(base.production!.parameters.baseStorage, 2);
  assert.throws(() => resolveRuleset(base, { 'production.gatherFood': 0 }));
  assert.throws(() => resolveRuleset(base, { 'production.unknown': 1 }));
});

test('陶作需要控火、材料和跨季干燥；在制品可由未学工艺的后辈完成', async () => {
  const g = await game('clay-valley', { turnsPerGeneration: 4 });
  await assert.rejects(g.act('study:pottery'), /前置/);
  await g.act('study:controlled-fire', 'gather:wood', 'practice:controlled-fire:fire-tended');
  await g.act('study:pottery', 'study:pottery', 'gather:clay');
  await g.act('gather:wood', 'end-turn'); // 第四季再成形，交接后接续
  await g.act('craft:pottery');
  assert.equal(g.o.production!.inventory.clay, 0);
  const wood = g.o.production!.inventory.wood;
  await assert.rejects(g.act('finish-craft'), /干燥/);
  assert.equal(g.o.production!.inventory.wood, wood);
  await g.act('end-turn');
  assert.equal(g.o.status, 'handover');
  const project = structuredClone(g.o.production!.project);
  await g.act('handover');
  assert.deepEqual(g.o.production!.project, project);
  assert.equal(g.o.person.mastered.length, 0);
  await g.act('finish-craft');
  assert.equal(g.o.production!.inventory.pottery, 2);
  assert.ok(!g.o.person.mastered.includes('pottery'), '完成既定工序不赠送个人掌握');
  assert.equal(g.o.production!.inventory.wood, wood, '完工不重复收取开工原料');
  assert.equal(g.o.production!.project, null);
  assert.deepEqual((await replayRecord(g.session.record, implementation)).state, g.session.state);
});

test('陶作也能进入储存；出售消耗商品和订单并记入事件指标', async () => {
  const g = await game('clay-valley');
  await g.act('study:controlled-fire', 'gather:wood', 'practice:controlled-fire:fire-tended');
  await g.act('study:pottery', 'study:pottery', 'gather:clay');
  await g.act('gather:wood', 'craft:pottery', 'end-turn', 'finish-craft', 'study:storage', 'install-storage:pottery');
  assert.ok(g.o.person.mastered.includes('storage'));
  assert.ok(!g.o.person.mastered.includes('woodworking'));
  assert.equal(g.o.production!.storageCapacity, 18);
  await g.act('sell-good:pottery');
  assert.equal(g.o.production!.market.pottery, 1);
  assert.equal(metrics(g.session.record, g.session.state).production!.craftEarnings, 3);
  const before = g.session;
  await assert.rejects(g.act('sell-good:pottery'), /陶器不足/);
  assert.equal(g.session, before);
});

test('当地木作需求耗尽时，即使还有商品也不能继续出售', async () => {
  const g = await game('woodland', { actionsPerTurn: 6 });
  await g.act('study:woodworking', 'study:woodworking', 'gather:wood', 'craft:woodenware', 'finish-craft', 'end-turn');
  await g.act('gather:wood', 'craft:woodenware', 'finish-craft', 'sell-good:woodenware');
  assert.equal(g.o.production!.inventory.woodenware, 1);
  assert.equal(g.o.production!.market.woodenware, 0);
  const before = g.session;
  await assert.rejects(g.act('sell-good:woodenware'), /需求/);
  assert.equal(g.session, before);
});

test('工具只改善实际采集，消耗当地库存并磨损；不永久添加产量', async () => {
  const g = await game();
  await g.act('study:woodworking', 'study:woodworking', 'gather:wood', 'craft:gather-tool', 'finish-craft');
  assert.equal(g.o.production!.toolDurability, 4);
  const beforeStock = g.o.production!.stocks.timber, beforeWood = g.o.production!.inventory.wood;
  const preview = g.o.production!.gathering.wood;
  await g.act('gather:wood');
  assert.equal(preview, Math.min(3, beforeStock));
  assert.equal(g.o.production!.inventory.wood - beforeWood, preview);
  assert.equal(g.o.production!.toolDurability, 3);
});

test('外来方法提供来源但不赠送能力；辅助经验不成为硬前置', async () => {
  const g = await game('clay-valley');
  await assert.rejects(g.act('study:woodworking'), /教师/);
  await g.act('buy-method:woodworking');
  assert.ok(g.o.family.archives.includes('woodworking'));
  assert.ok(!g.o.person.mastered.includes('woodworking'));
  await g.act('study:woodworking');
  assert.equal(g.o.technologies.find(t => t.id === 'woodworking')!.required, 2);
  const measured = await game('woodland');
  await measured.act('study:observation', 'cultivate', 'study:survey', 'study:survey', 'practice:survey:survey');
  assert.equal(measured.o.technologies.find(t => t.id === 'woodworking')!.required, 1);
  const connected = await game('woodland');
  await connected.act('study:woodworking', 'gather:wood', 'craft:woodenware', 'finish-craft');
  assert.ok(!connected.o.person.mastered.includes('woodworking'));
  await connected.act('study:observation', 'cultivate', 'study:survey', 'study:survey', 'practice:survey:survey');
  assert.ok(connected.o.person.mastered.includes('woodworking'), '新获得的有利经验在同一结算内生效，不依赖科技列表顺序');
});

test('新生产教学实践扣材料，后辈没有收到免费商品', async () => {
  const g = await game();
  await g.act('study:woodworking', 'study:woodworking', 'gather:wood', 'craft:woodenware', 'finish-craft', 'teach:woodworking', 'teach:woodworking');
  await assert.rejects(g.act('teach:woodworking'), /木材不足/);
  await g.act('gather:wood');
  const before = g.o.production!.inventory.wood;
  await g.act('teach:woodworking');
  assert.equal(g.o.production!.inventory.wood, before - 1);
  assert.equal(g.o.production!.inventory.woodenware, 1);
  assert.ok(g.o.heir.mastered.includes('woodworking'));
});

test('旧 v2 只能显式校验复制迁移，不能改成新世界或绕过指纹', async () => {
  let old = await createSession({ runId: 'old', ruleset: legacyBase, implementation: FROZEN_AGRICULTURE_IMPLEMENTATION, seed: 17, scenarioId: 'river' });
  old = (await submitCommand(old, { commandId: 'one', expectedRevision: 0, actionId: 'work' })).session;
  await assert.rejects(replayRecord(old.record, implementation), /指纹/);
  const migrated = await importRecord(old.record, implementation, 'copy');
  assert.equal(migrated.record.manifest.ruleset.rulesVersion, '0.1.0');
  assert.equal(migrated.record.manifest.runId, 'copy');
  assert.deepEqual(migrated.state, old.state);
  assert.equal(migrated.state.production, undefined);
  assert.throws(() => scriptedAgent('woodworker').decide(observeSession(migrated)), /通用生产规则/);
  const broken = structuredClone(old.record); broken.entries[0].stateHash = 'bad';
  await assert.rejects(importRecord(broken, implementation, 'broken'));
  const changed = structuredClone(old.record); changed.manifest.ruleset.parameters.workIncome++;
  await assert.rejects(importRecord(changed, implementation, 'changed'), /迁移/);
  assert.equal(old.record.manifest.implementation.version, '0.2.0');
});

test('必要、替代和有利经验都校验依赖；机制不能伪装为旧规则', () => {
  const rules = structuredClone(base); rules.technologies.find(t => t.id === 'woodworking')!.helpfulPrerequisites = ['storage'];
  assert.throws(() => validateRuleset(rules), /成环/);
  const wrongVersion = structuredClone(base); wrongVersion.rulesVersion = '0.1.0';
  assert.throws(() => validateRuleset(wrongVersion), /版本/);
  assert.throws(() => validateRuleset({ ...legacyBase, rulesVersion: '0.2.0', production: null }), /生产配置/);
});

test('两种非农脚本在各自场景完成两代；不把脚本称为大模型', async () => {
  const agents = { woodworker: scriptedAgent('woodworker'), potter: scriptedAgent('potter') };
  for (const [scenario, agent] of [['woodland', 'woodworker'], ['clay-valley', 'potter']]) {
    const spec = validateExperiment({ schemaVersion: 1, id: 'nonfarm-smoke', seeds: [17], scenarios: [scenario], agents: [agent], variants: [{ id: 'baseline', parameters: {} }], maxActions: 60, decisionTimeoutMs: 1000 }, base, agents);
    const results = await runExperiment(spec, base, implementation, agents, async session => {
      assert.ok(!observeSession(session).runId.includes('17'));
      assert.deepEqual((await replayRecord(session.record, implementation)).state, session.state);
    });
    assert.equal(results[0].controller, 'scripted');
    assert.equal(results[0].metrics.status, 'complete');
    assert.equal(results[0].metrics.foodShortfall, 0);
    assert.equal(results[0].metrics.production!.cultivateActions, 0);
    assert.ok(results[0].metrics.production!.craftEarnings > 0);
  }
});
