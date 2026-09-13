import { logicPage } from '../apps/board/logic-view.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContext } from '../apps/cli/context.js';
import { buildLogicGraph } from '../apps/board/logic-graph.js';
import { DEVELOPMENT_RECIPES } from '../src/game/systems/development.js';
import { DEVICE_RECIPES } from '../src/game/systems/product-network.js';
const { base } = await loadContext();
test('现行逻辑图覆盖全部科技和生产配方，关系无悬空，技能与材料门槛不混淆', () => {
    const { nodes, edges } = buildLogicGraph(base), ids = new Set(nodes.map(n => n.id));
    assert.equal(ids.size, nodes.length);
    for (const t of base.technologies)
        assert.ok(ids.has(t.id));
    for (const e of edges) {
        assert.ok(ids.has(e.from), e.from);
        assert.ok(ids.has(e.to), e.to);
    }
    for (const r of [...DEVELOPMENT_RECIPES, ...DEVICE_RECIPES]) {
        const id = ('output' in r ? 'develop:' : 'fabricate:') + r.id;
        assert.ok(edges.some(e => e.from === r.method && e.to === id && e.kind === 'requires'));
        for (const g of Object.keys(r.inputs))
            assert.ok(edges.some(e => e.from === 'g:' + g && e.to === id && e.kind === 'input'));
    }
    assert.ok(edges.some(e => e.from === 's:pottery' && e.to === 'develop:precisionParts' && e.kind === 'requires'));
    assert.ok(edges.some(e => e.from === 'recycle' && e.to === 'g:ceramicParts' && e.kind === 'output'));
    assert.ok(!edges.some(e => e.from === 'g:pump' && e.to === 'harvest'));
});
// The visible network and all navigation targets must remain technology-only.
test('科技主图只包含现行科技，材料与技能条件留在节点详情', () => {
    const html = logicPage(base, 'precision-engineering');
    const techIds = new Set(base.technologies.map(t => t.id));
    const graph = html.slice(html.indexOf('<svg'), html.indexOf('</svg>'));
    const targets = [...graph.matchAll(/data-tech="([^"]+)"/g)].map(m => m[1]);
    assert.equal(targets.length, techIds.size);
    for (const id of targets)
        assert.ok(techIds.has(id));
    for (const id of [...html.matchAll(/data-tech="([^"]+)"/g)].map(m => m[1]))
        assert.ok(techIds.has(id));
    assert.ok(html.includes('熟练等级≥2'));
    assert.ok(html.includes('制造提水泵'));
    assert.ok(!graph.includes('熟练度'));
});
