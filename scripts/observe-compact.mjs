// 只读辅助：调用 CLI observe 并打印紧凑摘要（不改状态）。
// 用法: node scripts/observe-compact.mjs --run <runId> [--actions]
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const run = argv[argv.indexOf('--run') + 1];
const showActions = argv.includes('--actions');
if (!run) { console.error('missing --run'); process.exit(1); }
const runDir = resolve(root, 'artifacts/runs', run);
const child = spawnSync(process.execPath, [
  '--permission',
  `--allow-fs-read=${resolve(root,'dist')}`,
  `--allow-fs-read=${resolve(root,'rulesets')}`,
  `--allow-fs-read=${resolve(root,'package.json')}`,
  `--allow-fs-read=${resolve(root,'artifacts/runs')}`,
  resolve(root,'dist/apps/cli/main.js'), 'observe', '--run', run, '--format', 'json',
], {cwd:root, stdio:['inherit','pipe','inherit'], shell:false, windowsHide:true, env:{...process.env,NODE_OPTIONS:''}});
if (child.error) { console.error(child.error.message); process.exit(1); }
const text = child.stdout.toString();
let data;
try { data = JSON.parse(text); }
catch { console.log(text.slice(0, 6000)); process.exit(0); }
const g = data.game || {};
const clock = g.clock || {};
const res = g.resources || g;
console.log('=== 状态摘要 ===');
console.log('revision:', data.revision ?? data.state?.revision ?? '?');
console.log('status:', g.status ?? '?', '| 季节:', JSON.stringify(clock));
console.log('食物:', res.food, '| 钱:', res.money, '| 时间:', res.time, '| 精力:', res.energy);
console.log('库存:', JSON.stringify(res.inventory ?? res.stock ?? res.materials ?? '?'));
console.log('设备:', JSON.stringify(res.equipment ?? res.devices ?? '?'));
console.log('知识:', JSON.stringify(res.knowledge ?? res.skills ?? '?'));
console.log('era凭证:', JSON.stringify(data.eraSettlements ?? data.era ?? '?'));
console.log('hardship:', JSON.stringify(g.hardship ?? res.hardship ?? data.hardship ?? '?'));
if (data.recentEvents && data.recentEvents.length) {
  console.log('--- 近期事件 ---');
  for (const e of data.recentEvents.slice(-8)) console.log(' •', JSON.stringify(e));
}
if (showActions && data.actions && data.actions.length) {
  console.log('--- 可用行动 (enabled) ---');
  for (const a of data.actions) if (a.enabled) console.log(` ${a.id}  [${a.time}t/${a.energy}e${a.money?`/${a.money}钱`:''}] ${a.label}`);
  console.log('--- 禁用行动 (disabled) ---');
  for (const a of data.actions) if (!a.enabled) console.log(` ${a.id}  (${a.reason ?? ''})`);
}
console.log('--- raw keys:', Object.keys(data).join(','));