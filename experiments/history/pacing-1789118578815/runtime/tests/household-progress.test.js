import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContext } from '../apps/cli/context.js';
import { createSession, observeSession, submitCommand } from '../src/runtime/session.js';
import { replayRecord } from '../src/runtime/replay.js';
import { resolveRuleset, validateRuleset } from '../src/game/ruleset.js';
const { pacingBase, base, implementation } = await loadContext();
async function setup() { let s = await createSession({ runId: 'pacing-unit', ruleset: resolveRuleset(pacingBase, { actionsPerTurn: 6, turnsPerGeneration: 24, initialFood: 30, initialMoney: 30, foodPerTurn: 1, 'production.baseStorage': 12 }), implementation, seed: 17, scenarioId: 'woodland' }); return { get s() { return s; }, get o() { return observeSession(s).game; }, async act(...ids) { for (const actionId of ids) {
        const offer = observeSession(s).game.actions.find(a => a.id === actionId);
        if (offer && s.state.ap < offer.ap)
            s = (await submitCommand(s, { commandId: 'wait:' + s.record.entries.length, expectedRevision: s.record.entries.length, actionId: 'end-turn' })).session;
        s = (await submitCommand(s, { commandId: 'unit:' + s.record.entries.length, expectedRevision: s.record.entries.length, actionId })).session;
    } } }; }
test('新节奏独立版本，旧规则不注入进展机制', () => { assert.equal(pacingBase.rulesVersion, '0.7.0'); assert.equal(base.householdProgress, undefined); assert.throws(() => validateRuleset({ ...base, householdProgress: true })); assert.throws(() => validateRuleset({ ...pacingBase, householdProgress: undefined })); });
test('熟练木作完整扣料且一行动完成，家学合授扣练习成本并跨代保留', async () => { const g = await setup(); await g.act('study:woodworking', 'study:woodworking', 'gather:wood', 'craft:woodenware', 'finish-craft'); assert.equal(g.o.development.skills.find(s => s.domain === 'woodwork').experience, 2); await g.act('gather:wood', 'craft:woodenware'); assert.equal(g.o.production.inventory.woodenware, 2); assert.equal(g.o.production.project, null); assert.equal(g.s.record.entries.at(-1).events.find(e => e.type === 'action-paid')?.cost.ap, 1); await g.act('archive:woodworking', 'gather:wood'); const stock = g.o.production.inventory.woodenware; await g.act('teach:woodworking'); assert.ok(g.o.heir.mastered.includes('woodworking')); assert.equal(g.o.production.inventory.woodenware, stock); const paid = g.s.record.entries.at(-1).events.find(e => e.type === 'action-paid'); assert.equal(paid.cost.food, 0); assert.equal(paid.cost.materials.wood, 1); assert.equal(g.o.development.skills.find(s => s.domain === 'woodwork').heirExperience, 2); while (g.o.status === 'active') {
    if (g.o.family.food < 2)
        await g.act('gather:food');
    else
        await g.act('end-turn');
} assert.equal(g.o.status, 'handover'); await g.act('handover'); assert.ok(g.o.person.mastered.includes('woodworking')); assert.equal(g.o.development.skills.find(s => s.domain === 'woodwork').experience, 2); await replayRecord(g.s.record, implementation); });
test('储存开放可选4粮采购，库存守恒且小额购买保留', async () => { const g = await setup(); assert.equal(g.o.actions.find(a => a.id === 'buy-food-bulk').enabled, false); await g.act('study:woodworking', 'gather:wood', 'craft:woodenware', 'finish-craft', 'study:storage', 'install-storage:woodenware'); const before = g.o.production.market.food; await g.act('buy-food-bulk'); assert.equal(g.o.production.market.food, before - 4); assert.equal(g.s.record.entries.at(-1).events.find(e => e.type === 'food-purchased')?.amount, 4); assert.ok(g.o.actions.some(a => a.id === 'buy-food')); const raw = JSON.stringify(g.s.record); await assert.rejects(() => g.act('buy-food-bulk')); assert.equal(JSON.stringify(g.s.record), raw); });
test('渠道建设是有成本的指导实践，不必先完成整条灌溉链', async () => { const g = await setup(); await g.act('study:observation', 'cultivate', 'study:survey', 'study:survey', 'practice:survey:survey', 'study:ditch'); assert.equal(g.o.person.mastered.includes('ditch'), false); await g.act('build-channel'); assert.ok(g.o.family.channel); assert.ok(g.o.person.practices.includes('channel-model')); assert.equal(g.s.record.entries.at(-1).events.find(e => e.type === 'action-paid')?.cost.money, pacingBase.parameters.channelCost); await replayRecord(g.s.record, implementation); });
