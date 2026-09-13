import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadContext, projectRoot } from '../apps/cli/context.js';
import { createSession } from '../src/runtime/session.js';
const execute = promisify(execFile);
const script = join(projectRoot, 'experiments/study-multiplier-20260911-check.mjs');
const check = (directory) => execute(process.execPath, [script, directory], { cwd: projectRoot });
async function fixture() {
    const directory = await mkdtemp(join(tmpdir(), 'civilization-research-check-'));
    await mkdir(join(directory, 'runs'));
    const { base, implementation } = await loadContext();
    const { record } = await createSession({ runId: 'check-fixture', ruleset: base, implementation, seed: 17, scenarioId: 'woodland' });
    return { directory, record, output: join(directory, 'research-evidence.json') };
}
test('研究校验遇到混合指纹立即非零退出，不生成部分成功报告、不改原档', async () => {
    const { directory, record, output } = await fixture();
    const valid = JSON.stringify(record), invalid = structuredClone(record);
    invalid.manifest.implementation.codeFingerprint = 'mismatched-implementation';
    const raw = JSON.stringify(invalid);
    await writeFile(join(directory, 'runs/01-valid.json'), valid);
    await writeFile(join(directory, 'runs/02-invalid.json'), raw);
    await assert.rejects(check(directory), (error) => error.code !== 0 && /02-invalid.json: implementation fingerprint mismatch/.test(error.stderr ?? ''));
    await assert.rejects(access(output), { code: 'ENOENT' });
    assert.equal(await readFile(join(directory, 'runs/01-valid.json'), 'utf8'), valid);
    assert.equal(await readFile(join(directory, 'runs/02-invalid.json'), 'utf8'), raw);
});
test('研究校验拒绝空目录，不将零份记录报告为全部通过', async () => {
    const { directory, output } = await fixture();
    await assert.rejects(check(directory), /没有逐局 JSON/);
    await assert.rejects(access(output), { code: 'ENOENT' });
});
test('研究校验全通过才保存成功结果，已有报告拒绝覆盖', async () => {
    const { directory, record, output } = await fixture();
    await writeFile(join(directory, 'runs/valid.json'), JSON.stringify(record));
    const result = await check(directory), summary = JSON.parse(result.stdout);
    assert.equal(summary.verified, 1);
    assert.equal(summary.failed, 0);
    const saved = await readFile(output, 'utf8'), report = JSON.parse(saved);
    assert.equal(report.runs[0].verified, true);
    await assert.rejects(check(directory), /EEXIST/);
    assert.equal(await readFile(output, 'utf8'), saved);
});
