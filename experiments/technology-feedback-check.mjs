// 有界研究脚本：只从 observeSession 决策，经统一接口行动；不是大模型。
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadContext } from '../dist/apps/cli/context.js';
import { createSession, observeSession, submitCommand } from '../dist/src/runtime/session.js';
import { replayRecord } from '../dist/src/runtime/replay.js';
import { chooseProductionAction } from '../dist/src/agents/scripted/production.js';
import { metrics } from '../dist/src/research/metrics.js';

const { feedbackBase: base, implementation } = await loadContext();
const directory = new URL(`../artifacts/experiments/technology-feedback-${Date.now()}/`, import.meta.url);
await mkdir(directory, { recursive: false });
const policyFingerprint = createHash('sha256').update(await readFile(new URL(import.meta.url))).update(await readFile(new URL('../dist/src/agents/scripted/production.js', import.meta.url))).digest('hex');
await writeFile(new URL('plan.json', directory), JSON.stringify({ question: '设施路线是否节省整段生活的行动，并保留生活保障和教学？', controller: 'scripted', seed: 17, scenarios: ['woodland', 'clay-valley'], variants: ['ordinary', 'workshop'], maxActions: 80, implementation, ruleset: base, policyFingerprint }, null, 2), { flag: 'wx' });

function decide(observation, policy, useWorkshop) {
  const o = observation.game, p = o.production;
  const ordinary = chooseProductionAction(observation, policy);
  const legal = id => o.actions.some(a => a.id === id && a.enabled);
  if (!useWorkshop || o.status !== 'active' || o.family.food < o.parameters.foodPerTurn || p.project) return ordinary;
  const material = policy === 'woodworker' ? 'woodenware' : 'pottery';
  const method = material === 'woodenware' ? 'woodworking' : 'pottery';
  if (!o.person.mastered.includes(method) || !p.storage[material] || ordinary?.startsWith('teach:') || ordinary?.startsWith('sell-good:')) return ordinary;
  const target = p.workshops[material] ? `craft-batch:${material}` : `build-workshop:${material}`;
  if (legal(target)) return target;
  const offer = o.actions.find(a => a.id === target);
  for (const [resource, amount] of Object.entries(offer.materials ?? {})) {
    if (p.inventory[resource] < amount && legal(`gather:${resource}`)) return `gather:${resource}`;
  }
  if (!p.workshops[material] && o.ap < offer.ap) return 'end-turn';
  return ordinary;
}
const rows = [];
for (const [scenarioId, policy] of [['woodland', 'woodworker'], ['clay-valley', 'potter']]) {
  for (const variant of ['ordinary', 'workshop']) {
    let session = await createSession({ runId: `${scenarioId}-${variant}`, ruleset: base, implementation, seed: 17, scenarioId, agent: { kind: 'scripted', name: 'feedback-choice-v1' } });
    for (let step = 0; step < 80; step++) {
      const actionId = decide(observeSession(session), policy, variant === 'workshop');
      if (!actionId) break;
      session = (await submitCommand(session, { commandId: `check:${step}`, expectedRevision: step, actionId })).session;
    }
    await replayRecord(session.record, implementation);
    await writeFile(new URL(`${session.record.manifest.runId}.json`, directory), JSON.stringify(session.record), { flag: 'wx' });
    const events = session.record.entries.flatMap(e => e.events), result = metrics(session.record, session.state);
    rows.push({ scenarioId, variant, rulesFingerprint: session.record.manifest.rulesFingerprint, status: result.status,
      foodShortfall: result.foodShortfall, food: session.state.household.food, money: session.state.household.money,
      workshops: events.filter(e => e.type === 'workshop-built').length,
      batches: events.filter(e => e.type === 'craft-completed' && e.batch).length,
      goods: events.filter(e => e.type === 'craft-completed' && e.recipe !== 'gather-tool').reduce((n,e) => n + e.amount, 0),
      craftActions: events.filter(e => e.type === 'action-paid' && ['craft', 'craft-batch', 'finish-craft'].includes(e.action.type)).reduce((n,e) => n+e.cost.ap, 0),
      buildActions: events.filter(e => e.type === 'action-paid' && e.action.type === 'build-workshop').reduce((n,e) => n+e.cost.ap, 0),
      gatherActions: events.filter(e => e.type === 'action-paid' && e.action.type === 'gather' && e.action.resource !== 'food').length,
      taught: events.filter(e => e.type === 'mastered' && e.role === 'heir').map(e => e.nodeId),
      production: result.production,
    });
  }
}
await writeFile(new URL('results.json', directory), JSON.stringify(rows, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ directory: directory.pathname, implementation, policyFingerprint, rows }, null, 2));
