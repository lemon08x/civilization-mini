// 兼容入口：转发到正式 compact 观察。新代码请直接用 player.mjs / --format compact。
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const runIndex = argv.indexOf('--run');
const run = runIndex >= 0 ? argv[runIndex + 1] : undefined;
const section = argv.includes('--actions') ? 'actions-disabled' : argv[argv.indexOf('--section') + 1];
if (!run) { console.error('missing --run'); process.exit(1); }
const args = ['observe', '--run', run, ...(argv.includes('--actions') || argv.includes('--section') ? ['--section', section] : ['--format', 'compact'])];
const child = spawnSync(process.execPath, [resolve(root, 'scripts/player.mjs'), ...args], {
  cwd: root, stdio: 'inherit', shell: false, windowsHide: true, env: { ...process.env, NODE_OPTIONS: '' },
});
if (child.error) { console.error(child.error.message); process.exit(1); }
process.exitCode = child.status ?? 1;
