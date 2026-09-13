// 本轮研究脚本：完整重放逐局记录并导出证据。不改变执行器或默认规则。
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { loadContext } from '../dist/apps/cli/context.js';
import { replayRecord } from '../dist/src/runtime/replay.js';
import { metrics } from '../dist/src/research/metrics.js';
import { actionId } from '../dist/src/game/model/action.js';

const directory = process.argv[2];
if (!directory) throw new Error('用法：node experiments/study-multiplier-20260911-check.mjs <artifacts/experiments/目录>');
const { implementation } = await loadContext();
const sha256 = async path => createHash('sha256').update(await readFile(path)).digest('hex');
const policyFiles = [
  'dist/src/agents/scripted/baseline.js',
  'dist/src/agents/scripted/production.js',
];
const policySha256 = createHash('sha256');
for (const file of policyFiles) policySha256.update(file.replaceAll('\\', '/')).update('\n').update(await readFile(file)).update('\n');
const runsDir = join(directory, 'runs');
const files = (await readdir(runsDir)).filter(name => name.endsWith('.json')).sort();
const runs = [];
for (const file of files) {
  const path = join(runsDir, file);
  const raw = await readFile(path, 'utf8');
  const record = JSON.parse(raw);
  const declared = record.manifest?.implementation;
  if (!declared || declared.version !== implementation.version || declared.codeFingerprint !== implementation.codeFingerprint) {
    runs.push({ file, sourceSha256: createHash('sha256').update(raw).digest('hex'), verified: false, stopped: 'implementation fingerprint mismatch; original file kept, no replay or migration' });
    continue;
  }
  const session = await replayRecord(record, implementation);
  const events = [];
  for (const entry of record.entries) entry.events.forEach((event, eventIndex) => events.push({ revision: entry.revision, eventIndex, ...event }));
  const actions = {};
  for (const event of events) if (event.type === 'action-paid') actions[actionId(event.action)] = (actions[actionId(event.action)] ?? 0) + 1;
  const m = metrics(session.record, session.state);
  runs.push({
    file,
    sourceSha256: createHash('sha256').update(raw).digest('hex'),
    verified: true,
    rulesFingerprint: record.manifest.rulesFingerprint,
    controller: record.manifest.agent,
    seed: record.manifest.seed,
    scenarioId: record.manifest.scenarioId,
    commands: record.entries.length,
    actions,
    studyActions: m.studyActions,
    teachingActions: m.teachingActions,
    learned: m.learnedNodes,
    lastPersonMastered: m.lastPersonMastered,
    inherited: m.inheritedNodes,
    foodShortfall: m.foodShortfall,
    money: m.money,
    food: m.food,
    production: m.production,
    inventory: session.state.production?.inventory ?? null,
    project: session.state.production?.project ?? null,
    storage: session.state.production?.storage ?? null,
    goods: session.state.society?.goods ?? null,
    archives: [...(session.state.knowledge.archives ?? [])],
    keyEvents: events.filter(e => ['studied', 'taught', 'mastered', 'handed-over', 'craft-started', 'craft-completed', 'goods-sold', 'season-settled'].includes(e.type)).map(e => ({
      revision: e.revision, eventIndex: e.eventIndex, type: e.type,
      ...(e.nodeId ? { nodeId: e.nodeId } : {}),
      ...(e.kind ? { kind: e.kind } : {}),
      ...(e.role ? { role: e.role } : {}),
      ...(e.recipe ? { recipe: e.recipe } : {}),
      ...(e.amount !== undefined ? { amount: e.amount } : {}),
      ...(e.missing !== undefined ? { missing: e.missing } : {}),
      ...(e.generation !== undefined ? { generation: e.generation } : {}),
      ...(e.clock ? { clock: e.clock } : {}),
      ...(e.mastered ? { mastered: e.mastered } : {}),
    })),
  });
}
const report = {
  implementation,
  controller: 'scripted',
  researcher: 'Grok 4.6',
  verification: 'current-run records fully replayed with replayRecord(record, current implementation); not historical reruns',
  policyFiles,
  policySha256: policySha256.digest('hex'),
  runs,
};
const output = join(directory, 'research-evidence.json');
await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, verified: runs.filter(r => r.verified).length, failed: runs.filter(r => !r.verified).length, implementation }, null, 2));
