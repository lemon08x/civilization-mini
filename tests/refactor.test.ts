import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, relative } from 'node:path';
import { projectRoot } from '../apps/cli/context.js';
import { createSession, submitCommand, observeSession } from '../src/runtime/session.js';
import { FileRunStore } from '../src/runtime/file-store.js';
import { rules } from './v27.js';

const fresh = () => createSession({ runId: 'test', ruleset: rules, seed: 17, scenarioId: 'river' });

test('命令幂等、过期拒绝、输入冻结与观察隔离', async () => {
  const initial = await fresh(), command = { commandId: 'one', expectedRevision: 0, actionId: observeSession(initial).game.actions.find(a => a.enabled)!.id };
  const next = (await submitCommand(initial, command)).session;
  assert.ok(Object.isFrozen(initial.state.household));
  assert.equal((await submitCommand(next, command)).duplicate, true);
  await assert.rejects(submitCommand(next, { commandId: 'stale', expectedRevision: 0, actionId: command.actionId }), /过期命令/);
  assert.doesNotMatch(JSON.stringify(observeSession(next)), /randomState|codeFingerprint/);
});

test('文件保存拒绝覆盖和重复提交', async () => {
  const root = await mkdtemp(join(tmpdir(), 'civilization-mini-test-')), store = new FileRunStore(root);
  const session = await fresh();
  await store.create(session);
  await assert.rejects(store.create(session));
  const action = observeSession(session).game.actions.find(a => a.enabled)!.id;
  const command = { commandId: 'one', expectedRevision: 0, actionId: action };
  await store.submit('test', command);
  assert.equal((await store.submit('test', command)).duplicate, true);
  assert.equal((await store.load('test')).record.entries.length, 1);
});

test('领域层和运行层依赖边界', async () => {
  for (const layer of ['game', 'runtime', 'present']) {
    const root = join(projectRoot, 'src', layer);
    for (const file of (await readdir(root, { recursive: true })).filter(f => f.endsWith('.ts'))) {
      const source = await readFile(join(root, file), 'utf8');
      for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        const target = relative(projectRoot, resolve(dirname(join(root, file)), match[1])).replaceAll('\\', '/');
        assert.ok(!/^(src\/(research|agents)|apps)\//.test(target), `${layer}/${file}: ${match[1]}`);
        if (layer === 'game') assert.ok(!/runtime|node:|src\/present/.test(match[1]) && !target.startsWith('src/present/'));
        if (layer === 'runtime') assert.ok(!target.startsWith('src/present/'), `${layer}/${file}: ${match[1]}`);
        if (layer === 'present') assert.ok(!target.startsWith('src/game/'), `${layer}/${file}: ${match[1]}`);
      }
    }
  }
});

test('库存与供粮不再进入工业循环依赖', async () => {
  const root = join(projectRoot, 'src/game/systems');
  const files = (await readdir(root)).filter(f => f.endsWith('.ts'));
  const imports = new Map<string, string[]>();
  for (const file of files) {
    const source = await readFile(join(root, file), 'utf8');
    const deps = [...source.matchAll(/from\s+'\.\/([^']+)\.js'/g)].map(m => m[1] + '.ts').filter(dep => files.includes(dep));
    imports.set(file, deps);
  }
  function reaches(start: string, goal: string, seen = new Set<string>()): boolean {
    if (seen.has(start)) return false;
    seen.add(start);
    return (imports.get(start) ?? []).some(dep => dep === goal || reaches(dep, goal, seen));
  }
  assert.equal(reaches('inventory.ts', 'industry.ts'), false);
  assert.equal(reaches('inventory.ts', 'economy.ts'), false);
  assert.equal(reaches('social-food.ts', 'industry.ts'), false);
  assert.equal(reaches('industry.ts', 'economy.ts'), false);
  assert.equal(reaches('agriculture.ts', 'economy.ts'), false);
  assert.equal(reaches('knowledge.ts', 'economy.ts'), false);
});
