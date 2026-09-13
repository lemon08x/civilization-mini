import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContext } from '../apps/cli/context.js';
import { createSession, observeSession, submitCommand } from '../src/runtime/session.js';
import { importRecord, replayRecord } from '../src/runtime/replay.js';
import { resolveRuleset, validateRuleset } from '../src/game/ruleset.js';
import { parseActionId } from '../src/game/model/action.js';
const { feedbackBase: base, productionBase, implementation } = await loadContext();
async function game(scenarioId = 'woodland') {
    let session = await createSession({ runId: 'feedback-test', ruleset: resolveRuleset(base, { initialFood: 30, 'production.baseStorage': 12, turnsPerGeneration: 24 }), implementation, seed: 17, scenarioId });
    return {
        get session() { return session; },
        get o() { return observeSession(session).game; },
        async act(...ids) {
            for (const actionId of ids)
                session = (await submitCommand(session, { commandId: `test:${session.record.entries.length}`, expectedRevision: session.record.entries.length, actionId })).session;
        },
    };
}
async function woodworker(g) {
    await g.act('study:woodworking', 'study:woodworking', 'gather:wood', 'craft:woodenware', 'finish-craft');
}
async function gatherTo(g, resource, target) {
    while (g.o.production.inventory[resource] < target) {
        if (g.o.actions.some(a => a.id === `gather:${resource}` && a.enabled))
            await g.act(`gather:${resource}`);
        else {
            if (g.o.actions.some(a => a.id === 'cultivate' && a.enabled))
                await g.act('cultivate');
            await g.act('end-turn');
        }
    }
}
test('技术开放建设，设施开放批量；同原料同产出少两次制作行动', async () => {
    const g = await game();
    const initial = g.session;
    await assert.rejects(g.act('build-workshop:woodenware'), /掌握/);
    assert.equal(g.session, initial);
    await woodworker(g);
    await assert.rejects(g.act('craft-batch:woodenware'), /木工作台/);
    await g.act('gather:wood', 'gather:wood', 'build-workshop:woodenware');
    assert.equal(g.o.production.inventory.wood, 0);
    assert.equal(g.o.production.workshops.woodenware, true);
    await assert.rejects(g.act('build-workshop:woodenware'), /已经建成/);
    await g.act('gather:wood', 'gather:wood');
    const before = g.session;
    await g.act('craft-batch:woodenware');
    assert.equal(g.o.production.inventory.wood, 0);
    assert.equal(g.o.production.inventory.woodenware, 1, '开工没有产品');
    await assert.rejects(g.act('craft:woodenware'), /当前制作/);
    await g.act('finish-craft');
    assert.equal(g.o.production.inventory.woodenware, 3);
    const paid = g.session.record.entries.slice(before.record.entries.length).flatMap(e => e.events).filter(e => e.type === 'action-paid');
    assert.equal(paid.reduce((sum, e) => sum + e.cost.ap, 0), 2);
    assert.equal(paid.reduce((sum, e) => sum + (e.cost.materials?.wood ?? 0), 0), 4);
    await g.act('end-turn', 'sell-good:woodenware');
    await assert.rejects(g.act('sell-good:woodenware'), /需求/);
    assert.deepEqual((await replayRecord(g.session.record, implementation)).state, g.session.state);
});
test('陶窑批量消耗双份燃料和黏土，跨季后产四件，失败不扣材料', async () => {
    const g = await game('clay-valley');
    await g.act('study:controlled-fire', 'gather:wood', 'practice:controlled-fire:fire-tended');
    await g.act('study:pottery', 'study:pottery', 'gather:clay', 'gather:wood', 'craft:pottery', 'end-turn', 'finish-craft');
    await gatherTo(g, 'wood', 4);
    await gatherTo(g, 'clay', 4);
    if (g.o.ap < 2)
        await g.act('end-turn');
    await g.act('build-workshop:pottery');
    await gatherTo(g, 'wood', 4);
    await gatherTo(g, 'clay', 4);
    if (g.o.ap === 1)
        await g.act('end-turn');
    const before = g.o.production.inventory;
    await g.act('craft-batch:pottery');
    assert.equal(g.o.production.inventory.wood, before.wood - 4);
    assert.equal(g.o.production.inventory.clay, before.clay - 4);
    const shaped = g.session;
    await assert.rejects(g.act('finish-craft'), /干燥/);
    assert.equal(g.session, shaped);
    await g.act('end-turn', 'finish-craft');
    assert.equal(g.o.production.inventory.pottery, 6);
    assert.deepEqual((await replayRecord(g.session.record, implementation)).state, g.session.state);
});
test('设施和批量在制品跨代保留，未受教学的后辈只能接续不能新开批量', async () => {
    const g = await game();
    await woodworker(g);
    await g.act('gather:wood', 'gather:wood', 'build-workshop:woodenware', 'gather:wood', 'gather:wood', 'craft-batch:woodenware');
    while (g.o.status === 'active')
        await g.act('cultivate', 'end-turn');
    assert.equal(g.o.status, 'handover');
    await g.act('handover', 'finish-craft');
    assert.equal(g.o.production.workshops.woodenware, true);
    assert.equal(g.o.production.inventory.woodenware, 3);
    assert.equal(g.o.person.mastered.includes('woodworking'), false);
    await assert.rejects(g.act('craft-batch:woodenware'), /本人掌握/);
});
test('储存反馈用当前余粮算差额，容器没有凭空增加粮食', async () => {
    const g = await game();
    await woodworker(g);
    await g.act('study:storage');
    const food = g.o.family.food;
    await g.act('install-storage:woodenware');
    assert.equal(g.o.family.food, food);
    const { storage } = g.o.technologyOutcomes;
    assert.equal(storage.avoidedNow, storage.withoutContainers - storage.withContainers);
    assert.ok(storage.avoidedNow > 0);
    await g.act('end-turn');
    const loss = g.session.record.entries.at(-1).events.find(e => e.type === 'food-spoiled');
    assert.equal(loss.type === 'food-spoiled' && loss.amount, storage.withContainers);
});
test('v2 新局不注入设施；历史实现严格拒绝，不能伪装规则版本', async () => {
    const old = await createSession({ runId: 'v2', ruleset: productionBase, implementation, seed: 17, scenarioId: 'woodland' });
    assert.equal(old.state.production.workshops, undefined);
    assert.ok(!observeSession(old).game.actions.some(a => a.id.startsWith('craft-batch:')));
    assert.deepEqual((await replayRecord(old.record, implementation)).state, old.state);
    const mismatched = structuredClone(old.record);
    mismatched.manifest.implementation = { version: '0.3.0', codeFingerprint: 'historical' };
    await assert.rejects(importRecord(mismatched, implementation, 'copy'), /迁移方案/);
    assert.throws(() => validateRuleset({ ...base, rulesVersion: '0.2.0' }), /版本/);
    assert.throws(() => validateRuleset({ ...base, technologyFeedback: { ...base.technologyFeedback, buildActions: 4 } }), /配置/);
    assert.throws(() => parseActionId('craft-batch:gather-tool'));
});
