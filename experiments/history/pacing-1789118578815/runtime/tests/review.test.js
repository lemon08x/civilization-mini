import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadContext, projectRoot } from '../apps/cli/context.js';
import { loadResearchIndex, parameterRows, readReviewFile, validateProposal } from '../apps/board/review-data.js';
test('审阅页按白名单展示权限，不把新机制配置当成可覆盖参数', async () => {
    const { base } = await loadContext(), rows = parameterRows(base);
    assert.equal(rows.find(p => p.key === 'production.baseStorage').editable, true);
    assert.deepEqual(rows.find(p => p.key === 'production.baseStorage').bounds, [1, 12]);
    assert.equal(rows.find(p => p.key === 'socialInheritance.wage').editable, false);
    assert.equal(rows.find(p => p.key === 'technologyFeedback.workbenchWood').editable, false);
});
test('研究文件读取拒绝路径穿越和游戏存档目录，不覆盖原文件', async () => {
    const before = await readFile(join(projectRoot, 'rulesets/social-inheritance.v4.json'), 'utf8');
    assert.equal(await readReviewFile(projectRoot, 'rulesets/social-inheritance.v4.json'), before);
    for (const path of ['../package.json', 'docs/../package.json', 'docs/../../secrets.json', 'artifacts/runs/demo/record.json', 'apps/board/server.ts', 'docs\\..\\package.json'])
        await assert.rejects(readReviewFile(projectRoot, path));
    assert.equal(await readFile(join(projectRoot, 'rulesets/social-inheritance.v4.json'), 'utf8'), before);
});
test('清单读取原始规则及参数差异，不以当前实现替换历史；坏文件单独提示', async () => {
    const root = await mkdtemp(join(tmpdir(), 'civilization-review-'));
    await mkdir(join(root, 'artifacts/experiments/good'), { recursive: true });
    await mkdir(join(root, 'artifacts/experiments/broken'), { recursive: true });
    await mkdir(join(root, 'experiments/proposals'), { recursive: true });
    await writeFile(join(root, 'artifacts/experiments/good/manifest.json'), JSON.stringify({ baseRuleset: { rulesVersion: '0.2.0', production: { parameters: { baseStorage: 2 } } }, implementation: { version: 'old', codeFingerprint: 'original' }, spec: { variants: [{ id: 'candidate', parameters: { 'production.baseStorage': 4 } }] } }));
    await writeFile(join(root, 'artifacts/experiments/good/metrics.json'), JSON.stringify([{ controller: 'scripted', metrics: { money: 3 } }, null]));
    await writeFile(join(root, 'artifacts/experiments/broken/plan.json'), '{invalid');
    await writeFile(join(root, 'experiments/proposals/broken.proposal.json'), '{invalid');
    const data = await loadResearchIndex(root), good = data.experiments.find(e => e.id === 'good');
    assert.deepEqual(good.implementation, { version: 'old', codeFingerprint: 'original' });
    assert.equal(good.rulesVersion, '0.2.0');
    assert.deepEqual(good.parameterChanges, [{ variant: 'candidate', path: 'production.baseStorage', before: 2, after: 4 }]);
    assert.deepEqual(good.controllers, ['scripted']);
    assert.equal(good.results.length, 1);
    assert.ok(good.issues.some(i => i.includes('无效')));
    assert.ok(data.experiments.find(e => e.id === 'broken').issues.length);
    assert.ok(data.issues.some(i => i.includes('broken.proposal')));
});
test('提案必须有明确差异与生效版本，历史暂不采纳不伪装为已修改', async () => {
    const p = JSON.parse(await readFile(join(projectRoot, 'experiments/proposals/storage-capacity.proposal.json'), 'utf8'));
    assert.equal(validateProposal(p).status, 'deferred');
    assert.throws(() => validateProposal({ ...p, status: 'accepted' }), /生效版本/);
    assert.throws(() => validateProposal({ ...p, changes: [{ subject: '缺少差异' }] }), /差异/);
    const data = await loadResearchIndex(projectRoot);
    assert.ok(data.proposals.some(p => p.id === 'social-inheritance' && p.adoptedVersion === '0.4.0'));
    assert.equal(data.issues.length, 0, data.issues.join('\n'));
});
