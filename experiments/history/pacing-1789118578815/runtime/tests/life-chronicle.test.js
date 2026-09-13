import test from 'node:test';
import assert from 'node:assert/strict';
import { lifeChronicle } from '../src/research/life-chronicle.js';
import { loadContext } from '../apps/cli/context.js';
import { createSession, submitCommand, observeSession } from '../src/runtime/session.js';
import { replayRecord } from '../src/runtime/replay.js';
const { base, implementation } = await loadContext();
// Synthetic event fixtures test narration attribution only, not simulated game outcomes.
function record(...groups) { return { manifest: { ruleset: base }, entries: groups.map((events, i) => ({ revision: i + 1, events })) }; }
const season = (turn, weather = 'dry') => ({ type: 'season-started', clock: { generation: 1, turn, absoluteTurn: turn }, weather });
const harvest = { type: 'harvest', food: 2, drawn: 0, deficit: 1, channelExhausted: false };
const water = { type: 'stored-water-used', amount: 1 };
test('经历区分制成、安装与实际使用，不把具备条件写成收益', () => {
    const r = record([{ type: 'product-completed', device: 'pump' }], [{ type: 'product-installed', device: 'pump', durability: 4 }]);
    const before = JSON.stringify(r), c = lifeChronicle(r);
    assert.ok(c.chapters[0].facts.every(f => f.stage === 'prepared'));
    assert.equal(JSON.stringify(r), before);
    assert.ok(!('score' in c));
    const used = lifeChronicle(record(...r.entries.map(e => e.events), [{ type: 'product-operated', device: 'pump', result: 1, remaining: 3 }]));
    assert.equal(used.chapters[0].facts.filter(f => f.stage === 'used').length, 1);
    assert.ok(!used.chapters[0].facts.some(f => f.stage === 'continued'));
});
test('旱季叙述必须有天气、同次蓄水消耗和实际收成，不推断首季天气', () => {
    assert.equal(lifeChronicle(record([water, harvest])).chapters[0].facts.length, 0);
    assert.equal(lifeChronicle(record([season(2)], [water], [harvest])).chapters[0].facts.length, 0);
    const c = lifeChronicle(record([season(2)], [water, harvest, season(3, 'normal')]));
    assert.equal(c.chapters[0].facts[0].turn, 2);
    assert.deepEqual(c.chapters[0].facts[0].evidence, [{ revision: 2, eventIndex: 0 }, { revision: 2, eventIndex: 1 }]);
    assert.equal(lifeChronicle(record([season(2)], [water, { ...harvest, food: 0 }])).chapters[0].facts.length, 0);
});
test('跨代设备使用追溯最后一次安装，不冒认更换后的设备为前代遗产', () => {
    const install = { type: 'product-installed', device: 'pump', durability: 4 }, use = { type: 'product-operated', device: 'pump', result: 1, remaining: 3 };
    const handover = { type: 'handed-over', generation: 2, fromPersonId: 'person:1', personId: 'person:2', mastered: [], learning: {} };
    const c = lifeChronicle(record([install], [handover], [use]));
    assert.equal(c.chapters[0].status, 'handed-over');
    assert.deepEqual(c.chapters[1].facts.find(f => f.stage === 'continued').evidence, [{ revision: 1, eventIndex: 0 }, { revision: 3, eventIndex: 0 }]);
    assert.ok(!lifeChronicle(record([install], [handover], [install], [use])).chapters[1].facts.some(f => f.stage === 'continued'));
});
test('后辈、邻里与受托匠人的事实不归功于当前玩家；重复经历不变为刷分', () => {
    const e = { type: 'public-used', material: 'pottery', amount: 1 };
    const c = lifeChronicle(record([e], [e], [{ type: 'mastered', personId: 'person:2', role: 'heir', nodeId: 'woodworking', clock: { generation: 1, turn: 2, absoluteTurn: 2 } }]));
    assert.equal(c.chapters[0].facts.length, 2);
    assert.equal(c.chapters[0].facts[0].actor, '邻里');
    assert.equal(c.chapters[0].facts[1].actor, '后辈');
    assert.equal(c.chapters[0].facts[1].stage, 'prepared');
});
test('真实行动生成经历不改变结算、观察、记录或存档指纹', async () => {
    let s = await createSession({ runId: 'life-view', ruleset: base, implementation, seed: 17, scenarioId: 'woodland' });
    for (const actionId of ['study:woodworking', 'gather:wood', 'craft:woodenware', 'finish-craft'])
        s = (await submitCommand(s, { commandId: `life:${s.record.entries.length}`, expectedRevision: s.record.entries.length, actionId })).session;
    const raw = JSON.stringify(s.record), o = JSON.stringify(observeSession(s));
    const c = lifeChronicle(s.record);
    assert.ok(c.chapters[0].facts.some(f => f.id === 'craft:woodenware'));
    assert.equal(c.chapters[0].investment.actions, 4);
    assert.equal(JSON.stringify(s.record), raw);
    assert.equal(JSON.stringify(observeSession(s)), o);
    assert.deepEqual((await replayRecord(s.record, implementation)).state, s.state);
});
