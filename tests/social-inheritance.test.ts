import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContext } from '../apps/cli/context.js';
import { createSession, observeSession, submitCommand } from '../src/runtime/session.js';
import { replayRecord, importRecord } from '../src/runtime/replay.js';
import { resolveRuleset, validateRuleset } from '../src/game/ruleset.js';

const { societyBase: base, feedbackBase, implementation } = await loadContext();
async function game(overrides: Record<string, number> = {}, scenarioId = 'woodland') {
  let session = await createSession({ runId: 'social-test', ruleset: resolveRuleset(base, { turnsPerGeneration: 12, initialFood: 30, 'production.baseStorage': 12, ...overrides }), implementation, seed: 17, scenarioId });
  return { get session() { return session; }, get o() { return observeSession(session).game; },
    async act(...ids: string[]) { for (const actionId of ids) session = (await submitCommand(session, { commandId: `s:${session.record.entries.length}`, expectedRevision: session.record.entries.length, actionId })).session; },
  };
}
async function wood(g: Awaited<ReturnType<typeof game>>) {
  await g.act('study:woodworking', 'study:woodworking', 'gather:wood', 'craft:woodenware', 'finish-craft');
}
async function business(g: Awaited<ReturnType<typeof game>>) {
  await wood(g);
  await g.act('gather:wood', 'gather:wood', 'build-workshop:woodenware', 'share:woodworking', 'gather:wood', 'share:woodworking');
}

test('家族方法减少理论但不免实践，邻里传播需两步且实践真实扣料', async () => {
  const g = await game();
  await assert.rejects(g.act('share:woodworking'), /本人掌握/);
  await wood(g);
  await g.act('teach:woodworking', 'archive:woodworking');
  assert.equal(g.o.technologies.find(t => t.id === 'woodworking')!.required, 1);
  assert.ok(!g.o.heir.mastered.includes('woodworking'));
  await g.act('gather:wood', 'teach:woodworking');
  assert.ok(g.o.heir.mastered.includes('woodworking'));
  await g.act('share:woodworking');
  assert.ok(!g.o.society!.methods.includes('woodworking'));
  const before = g.o.production!.inventory.wood;
  await g.act('share:woodworking');
  assert.equal(g.o.production!.inventory.wood, before - 1);
  assert.ok(g.o.society!.methods.includes('woodworking'));
  await assert.rejects(g.act('share:woodworking'), /已完成/);
});

test('委托跨季开工完工，工资和当地原料只扣一次；产物、订单与收入对应', async () => {
  const g = await game(); await business(g);
  await g.act('end-turn');
  const money = g.o.family.money;
  await g.act('entrust:woodenware');
  const stocks = g.o.production!.stocks.timber;
  await g.act('end-turn');
  assert.equal(g.o.family.money, money - 1);
  assert.ok(g.o.society!.contracts.woodenware.project);
  const start = g.session.record.entries.at(-1)!.events.find(e => e.type === 'contract-started');
  assert.ok(start && start.wood === 2 && stocks >= 2);
  await assert.rejects(g.act('craft-batch:woodenware'), /占用/);
  await g.act('end-turn');
  assert.equal(g.o.family.money, money - 1 + 4);
  assert.equal(g.o.society!.goods.woodenware, 1);
  assert.equal(g.o.society!.contracts.woodenware.project, null);
  const finish = g.session.record.entries.at(-1)!.events;
  assert.equal(finish.filter(e => e.type === 'contract-started').length, 0);
  assert.ok(finish.some(e => e.type === 'contract-sold' && e.amount === 1 && e.earnings === 4));
  assert.deepEqual((await replayRecord(g.session.record, implementation)).state, g.session.state);
});

test('订单耗尽等待且不重复支付，暂停跨季保留在制品并占用设施', async () => {
  const g = await game(); await business(g);
  await g.act('end-turn', 'entrust:woodenware', 'end-turn');
  await g.act('sell-good:woodenware');
  const money = g.o.family.money;
  await g.act('end-turn');
  assert.equal(g.o.family.money, money);
  assert.ok(g.session.record.entries.at(-1)!.events.some(e => e.type === 'contract-waiting'));
  await g.act('pause-contract:woodenware');
  const project = structuredClone(g.o.society!.contracts.woodenware.project);
  await g.act('end-turn');
  assert.deepEqual(g.o.society!.contracts.woodenware.project, project);
  await assert.rejects(g.act('craft-batch:woodenware'), /占用/);
  await g.act('entrust:woodenware', 'end-turn');
  assert.equal(g.o.family.money, money + 4);
});

test('后人选择农业仍收作坊货款，可以使用容器而不掌握木作', async () => {
  const g = await game(); await business(g);
  await g.act('archive:woodworking', 'entrust:woodenware');
  while (g.o.status === 'active') {
    if (g.o.actions.some(a => a.id === 'cultivate' && a.enabled)) await g.act('cultivate');
    if (g.o.status === 'active') await g.act('end-turn');
  }
  await g.act('handover');
  assert.equal(g.o.person.mastered.includes('woodworking'), false);
  assert.equal(g.o.society!.contracts.woodenware.active, true);
  assert.equal(g.o.technologies.find(t => t.id === 'woodworking')!.required, 1);
  await g.act('study:observation', 'cultivate', 'study:storage');
  assert.ok(g.o.person.mastered.includes('observation'));
  await g.act('install-storage:woodenware');
  assert.ok(g.o.person.mastered.includes('storage'));
  assert.ok(!g.o.person.mastered.includes('woodworking'));
  const start = g.session.record.entries.length;
  await g.act('end-turn', 'end-turn');
  assert.ok(g.session.record.entries.slice(start).flatMap(e => e.events).some(e => e.type === 'contract-sold'));
  assert.deepEqual((await replayRecord(g.session.record, implementation)).state, g.session.state);
});

test('公共商品可购买并扣钱扣库存，不赠送制造技能；无资金/原料不扣费', async () => {
  const g = await game({ initialMoney: 1 }); await business(g);
  await g.act('entrust:woodenware', 'end-turn');
  assert.equal(g.o.family.money, 0);
  await g.act('end-turn');
  assert.equal(g.o.family.money, 4);
  await g.act('buy-good:woodenware');
  assert.equal(g.o.family.money, 0);
  assert.equal(g.o.society!.goods.woodenware, 0);
  assert.equal(g.o.production!.inventory.woodenware, 2);
  await g.act('end-turn');
  assert.equal(g.o.family.money, 0);
  assert.equal(g.o.society!.contracts.woodenware.project, null);
  assert.ok(g.session.record.entries.at(-1)!.events.some(e => e.type === 'contract-waiting' && e.reason.includes('工资')));
});

test('社会观察不泄露随机状态，旧规则不注入社会且历史指纹不猜测迁移', async () => {
  const g = await game();
  const observation = JSON.stringify(observeSession(g.session));
  assert.ok(!observation.includes('randomState') && !observation.includes('"seed":'));
  const old = await createSession({ runId: 'feedback', ruleset: feedbackBase, implementation, seed: 17, scenarioId: 'woodland' });
  assert.equal(old.state.society, undefined);
  assert.ok(!observeSession(old).game.actions.some(a => a.id.startsWith('entrust:')));
  const historical = structuredClone(old.record); historical.manifest.implementation.version = '0.4.0';
  await assert.rejects(importRecord(historical, implementation, 'copy'), /迁移方案/);
  assert.throws(() => validateRuleset({ ...base, rulesVersion: '0.3.0' }), /版本/);
  assert.throws(() => validateRuleset({ ...base, socialInheritance: { wage: 0, goodsCapacity: 6, archiveDiscount: 1 } }), /配置/);
});

test('受托匠人与玩家共用当地原料，材料耗尽时不扣开工工资', async () => {
  const g = await game({ actionsPerTurn: 6 }); await business(g);
  await g.act('entrust:woodenware');
  const gathers = Math.ceil(g.o.production!.stocks.timber / g.o.production!.parameters.gatherWood);
  const money = g.o.family.money, start = g.session.record.entries.length;
  for (let i = 0; i < gathers; i++) await g.act('gather:wood');
  if (!g.session.record.entries.slice(start).flatMap(e => e.events).some(e => e.type === 'season-settled')) await g.act('end-turn');
  assert.equal(g.o.family.money, money);
  assert.equal(g.o.society!.contracts.woodenware.project, null);
  assert.ok(g.session.record.entries.slice(start).flatMap(e => e.events).some(e => e.type === 'contract-waiting' && e.reason.includes('原料')));
});

test('陶作委托保留跨季工序，受一单限制时分次交货且不重复收工资', async () => {
  const g = await game({ turnsPerGeneration: 24 }, 'clay-valley');
  const gatherTo = async (resource: 'wood' | 'clay', amount: number) => {
    for (let i = 0; g.o.production!.inventory[resource] < amount && i < 30; i++) {
      if (g.o.actions.some(a => a.id === `gather:${resource}` && a.enabled)) await g.act(`gather:${resource}`);
      else { if (g.o.actions.some(a => a.id === 'cultivate' && a.enabled)) await g.act('cultivate'); await g.act('end-turn'); }
    }
  };
  await g.act('study:controlled-fire', 'gather:wood', 'practice:controlled-fire:fire-tended', 'study:pottery', 'study:pottery', 'gather:clay', 'gather:wood', 'craft:pottery', 'end-turn', 'finish-craft');
  await gatherTo('wood', 5); await gatherTo('clay', 5);
  if (g.o.ap < 2) await g.act('end-turn');
  await g.act('build-workshop:pottery', 'share:pottery', 'share:pottery');
  // 等当地材料恢复，期间维持生活；不直接修改状态。
  while (g.o.production!.stocks.timber < 2) {
    if (g.o.actions.some(a => a.id === 'cultivate' && a.enabled)) await g.act('cultivate');
    await g.act('end-turn');
  }
  await g.act('end-turn', 'entrust:pottery', 'end-turn');
  assert.equal(g.o.society!.contracts.pottery.project!.remaining, 2);
  if (g.o.family.food < 2) await g.act('buy-food');
  const money = g.o.family.money;
  await g.act('sell-good:pottery', 'end-turn');
  assert.equal(g.o.society!.contracts.pottery.project!.remaining, 1);
  assert.equal(g.o.family.money, money + 6, '个人卖一件与委托交一件各得三钱');
  const foodCost = g.o.family.food < 2 ? 2 : 0;
  if (foodCost) await g.act('buy-food');
  await g.act('end-turn');
  assert.equal(g.o.society!.contracts.pottery.project, null);
  assert.equal(g.o.family.money, money + 9 - foodCost);
  assert.deepEqual((await replayRecord(g.session.record, implementation)).state, g.session.state);
});
