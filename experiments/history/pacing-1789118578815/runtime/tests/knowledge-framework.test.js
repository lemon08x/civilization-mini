import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadContext, projectRoot } from '../apps/cli/context.js';
import { diagnoseRecord, validateFramework } from '../src/research/knowledge-framework.js';
const readFramework = async () => JSON.parse(await readFile(resolve(projectRoot, 'experiments/frameworks/knowledge.v1.json'), 'utf8'));
test('跨领域框架覆盖现行节点，拒绝伪装实现、缺失关系和解锁环', async () => {
    const { societyBase: base } = await loadContext(), value = await readFramework(), f = validateFramework(value, base);
    assert.equal(f.nodes.length, 32);
    assert.equal(f.nodes.filter(n => n.status === 'implemented').length, 12);
    for (const mutate of [
        (v) => { v.nodes.find(n => n.id === 'steam').status = 'implemented'; },
        (v) => { v.nodes.find(n => n.id === 'steam').required = ['missing']; },
        (v) => { v.nodes.find(n => n.id === 'metallurgy').required = ['steam']; },
        (v) => { v.nodes.find(n => n.id === 'woodworking').required = ['steam']; },
        (v) => { v.questions[0].parameter = 'socialInheritance.wage'; },
    ]) {
        const copy = structuredClone(f);
        mutate(copy);
        assert.throws(() => validateFramework(copy, base));
    }
    // 促进与讨论可相互影响，不当成必须先学的循环。
    f.nodes.find(n => n.id === 'logic').helpful = ['ethics'];
    f.nodes.find(n => n.id === 'ethics').helpful = ['logic'];
    assert.doesNotThrow(() => validateFramework(f, base));
});
function record(events) {
    return { manifest: { ruleset: { technologies: [{ id: 'woodworking' }, { id: 'pottery' }] } }, entries: events.map((event, i) => ({ revision: i + 1, events: [event] })) };
}
test('诊断按人物区分学习，不把继承人掌握误作当前人物完成；证据定位原事件', () => {
    const r = record([{ type: 'studied', personId: 'parent', nodeId: 'woodworking' }, { type: 'mastered', personId: 'heir', role: 'heir', nodeId: 'woodworking', clock: { generation: 1, turn: 1, absoluteTurn: 1 } }]);
    const before = JSON.stringify(r), d = diagnoseRecord(r);
    assert.deepEqual(d.findings.find(f => f.kind === 'learning-unfinished').evidence, [{ revision: 1, eventIndex: 0 }]);
    assert.equal(d.findings.find(f => f.kind === 'node-unvisited').nodeId, 'pottery');
    assert.equal(JSON.stringify(r), before);
    r.entries.push({ revision: 3, events: [{ type: 'mastered', personId: 'parent', role: 'active', nodeId: 'woodworking', clock: { generation: 1, turn: 2, absoluteTurn: 2 } }] });
    assert.equal(diagnoseRecord(r).findings.some(f => f.kind === 'learning-unfinished'), false);
});
test('设施诊断只识别建成之后同类批量完工，不把普通产出或其他工艺混入', () => {
    const events = [{ type: 'craft-completed', recipe: 'woodenware', amount: 2, batch: true }, { type: 'workshop-built', material: 'woodenware' }, { type: 'craft-completed', recipe: 'woodenware', amount: 1 }, { type: 'craft-completed', recipe: 'pottery', amount: 4, batch: true }];
    assert.equal(diagnoseRecord(record(events)).findings.filter(f => f.kind === 'workshop-unused').length, 1);
    assert.equal(diagnoseRecord(record([...events, { type: 'contract-started', material: 'woodenware', wage: 1, wood: 2, clay: 0 }])).findings.some(f => f.kind === 'workshop-unused'), false);
    events.push({ type: 'craft-completed', recipe: 'woodenware', amount: 2, batch: true });
    assert.equal(diagnoseRecord(record(events)).findings.some(f => f.kind === 'workshop-unused'), false);
});
