// 严格重放校验：g01（手工）+ g02..g10（脚本基线 v4）全部记录必须能重放且指纹一致。
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { replayRecord } from '../dist/src/runtime/replay.js';
import { metrics } from '../dist/src/research/metrics.js';
import { observeSession } from '../dist/src/runtime/session.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const implementation = JSON.parse(await readFile(resolve(root, 'dist/implementation.json'), 'utf8'));

const runs = [];
// g01 手工局
try {
  const raw = JSON.parse(await readFile(resolve(root, 'artifacts/runs/g01/record.json'), 'utf8'));
  runs.push({ id: 'g01', kind: 'hand', record: raw });
} catch (error) { console.log('g01 missing:', error.message); }

// g02..g10 脚本基线 v4（从最新 play-ten-* 目录读取）
import { readdirSync } from 'node:fs';
const experiments = readdirSync(resolve(root, 'artifacts/experiments'), { withFileTypes: true })
  .filter(d => d.isDirectory() && d.name.startsWith('play-ten-'))
  .sort((a, b) => a.name.localeCompare(b.name));
const latest = experiments.at(-1);
if (latest) {
  for (const id of ['g02','g03','g04','g05','g06','g07','g08','g09','g10']) {
    const raw = JSON.parse(await readFile(resolve(root, 'artifacts/experiments', latest.name, `${id}.json`), 'utf8'));
    runs.push({ id, kind: 'scripted-v4', record: raw });
  }
}

let failures = 0;
for (const { id, kind, record } of runs) {
  try {
    const replayed = await replayRecord(record, implementation);
    const o = observeSession(replayed);
    const m = metrics(replayed.record, replayed.state);
    const ev = replayed.record.entries.flatMap(e => e.events);
    const completed = o.game.economy.expeditionView.attempts;
    console.log(`✔ ${id} (${kind}): gen=${o.game.clock.generation} season=${o.game.clock.absoluteTurn} status=${o.game.status} | foodStock=${o.game.economy.foodTotal} money=${o.game.family.money} | supply=${o.game.economy.expeditionView.supplyLevel} | harvest=${completed.harvest?.completed} kiln=${completed.kiln?.completed} | commands=${m.commands} shortfall=${ev.filter(e=>e.type==='season-settled').reduce((n,e)=>n+e.missing,0)}`);
  } catch (error) {
    console.log(`✖ ${id} (${kind}) replay FAILED: ${error.message}`);
    failures++;
  }
}
process.exit(failures ? 1 : 0);