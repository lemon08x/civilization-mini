import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSession, observeSession, submitCommand } from '../src/runtime/session.js';
import { validateRuleset } from '../src/game/ruleset.js';
import { textObservation } from '../apps/cli/text-observation.js';

test('AI text preserves visible state and actions without revealing run internals', async () => {
  const ruleset=validateRuleset(JSON.parse(await readFile('rulesets/recovery-inheritance.v20.json','utf8')));
  const implementation=JSON.parse(await readFile('dist/implementation.json','utf8'));
  const session=await createSession({runId:'text-check',ruleset,implementation,seed:17,scenarioId:'river'});
  const observation=observeSession(session), before=JSON.stringify(observation);
  const text=textObservation(observation);
  assert.equal(JSON.stringify(observation),before);
  for(const action of observation.game.actions) assert.ok(text.includes(`${action.id} | ${action.label}`));
  for(const hidden of ['randomState','codeFingerprint','snapshots','"manifest"']) assert.ok(!text.includes(hidden),hidden);
  const jsonBlocks=[...text.matchAll(/```json\n([\s\S]*?)\n```/g)];
  const {actions: _actions,...visible}=observation.game;
  assert.equal(Object.hasOwn(JSON.parse(jsonBlocks[0][1]),'seed'),false);
  assert.deepEqual(JSON.parse(jsonBlocks[0][1]),JSON.parse(JSON.stringify(visible)));
  const action=observation.game.actions.find(a=>a.enabled)!;
  const next=(await submitCommand(session,{commandId:'text:0',expectedRevision:0,actionId:action.id})).session;
  const updated=textObservation(observeSession(next));
  assert.ok(updated.includes('revision: 1'));
  assert.ok(updated.includes('--revision 1'));
  await assert.rejects(submitCommand(next,{commandId:'stale',expectedRevision:0,actionId:action.id}),/过期命令/);
});
