import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, observeSession, submitCommand } from '../src/runtime/session.js';
import { textObservation } from '../apps/cli/text-observation.js';
import { compactObservation, formatCompactObservation, observationSection, parseCompactSection } from '../src/present/compact-observation.js';
import { rules } from './v27.js';

async function sample() {
  const session = await createSession({ runId: 'compact-check', ruleset: rules, seed: 17, scenarioId: 'river' });
  return observeSession(session);
}

test('compact observation keeps quotes and hides run internals', async () => {
  const observation = await sample();
  const before = JSON.stringify(observation);
  const compact = compactObservation(observation);
  assert.equal(JSON.stringify(observation), before);
  assert.equal(compact.runId, observation.runId);
  assert.equal(compact.revision, observation.revision);
  assert.equal(compact.status, observation.game.status);
  const enabled = observation.game.actions.filter(action => action.enabled);
  assert.equal(compact.actions.length, enabled.length);
  for (const action of enabled) {
    const quote = compact.actions.find(item => item.id === action.id);
    assert.ok(quote, action.id);
    assert.equal(quote!.money, action.money);
    assert.equal(quote!.food, action.food);
    assert.equal(quote!.description, action.description);
  }
  assert.ok(compact.actions.some(action => action.description.includes('行动后劳动预留')));
  const text = formatCompactObservation(compact);
  for (const hidden of ['randomState', 'codeFingerprint', 'snapshots', '"manifest"']) {
    assert.ok(!text.includes(hidden), hidden);
    assert.ok(!JSON.stringify(compact).includes(hidden), hidden);
  }
  assert.ok(text.includes(`revision: ${observation.revision}`));
  assert.ok(text.includes('--section branches'));
  assert.ok(compact.actions.length < observation.game.actions.length);
});

test('compact text is smaller than json and full text on the same observation', async () => {
  const observation = await sample();
  const compact = formatCompactObservation(compactObservation(observation));
  const json = JSON.stringify(observation, null, 2);
  const text = textObservation(observation);
  const ratio = compact.length / json.length;
  assert.ok(compact.length < json.length, `compact ${compact.length} json ${json.length}`);
  assert.ok(compact.length < text.length, `compact ${compact.length} text ${text.length}`);
  assert.ok(ratio < 0.5, `compact/json ratio ${ratio}`);
  console.log(`compact size ${compact.length} / json ${json.length} (${(ratio * 100).toFixed(1)}%) / text ${text.length}`);
});

test('sections read the same public observation and disabled actions stay out of the summary', async () => {
  const observation = await sample();
  const compact = compactObservation(observation);
  const disabled = observation.game.actions.filter(action => !action.enabled);
  assert.ok(disabled.length > 0);
  assert.ok(compact.urgentBlockers.length < disabled.length);
  const section = observationSection(observation, 'actions-disabled');
  for (const action of disabled.slice(0, 5)) assert.ok(section.includes(action.id));
  assert.equal(parseCompactSection('era'), 'era');
  assert.throws(() => parseCompactSection('seed'), /section/);
});

test('act receipt revision matches compact observation', async () => {
  const observation = await sample();
  const action = observation.game.actions.find(item => item.enabled)!;
  const session = await createSession({ runId: 'compact-act', ruleset: rules, seed: 17, scenarioId: 'river' });
  const next = await submitCommand(session, { commandId: 'compact:0', expectedRevision: 0, actionId: action.id });
  const compact = compactObservation(observeSession(next.session), { receipt: { duplicate: next.duplicate, revision: next.revision } });
  assert.equal(compact.revision, 1);
  assert.equal(compact.receipt?.revision, 1);
  assert.equal(compact.receipt?.duplicate, false);
});
