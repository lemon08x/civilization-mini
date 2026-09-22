// 固定入口的权限限制。只有外部宿主也限制工具时，才能限制玩家代理本身。
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [command, ...args] = process.argv.slice(2);
try {
  if (!['observe', 'act'].includes(command)) throw new Error('玩家入口仅允许 observe / act');
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    if (!['--run', '--revision', '--action', '--command-id', '--reason', '--format', '--section'].includes(key) || args[i + 1] === undefined || Object.hasOwn(options, key)) throw new Error('无效参数');
    options[key] = args[i + 1];
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(options['--run'] ?? '')) throw new Error('无效 run ID');
  const run = resolve(root, 'saves', options['--run']);
  const child = spawnSync(process.execPath, [
    '--permission',
    `--allow-fs-read=${resolve(root, 'dist')}`,
    `--allow-fs-read=${resolve(root, 'rulesets')}`,
    `--allow-fs-read=${resolve(root, 'package.json')}`,
    // Offline calendar code is a runtime dependency; retain the other player restrictions.
    `--allow-fs-read=${resolve(root, 'node_modules/lunar-typescript')}`,
    `--allow-fs-read=${resolve(root, 'saves')}`,
    ...(command === 'act' ? [`--allow-fs-write=${run}`] : []),
    resolve(root, 'dist/playtests/player.js'), command, ...args,
  ], { cwd: root, stdio: 'inherit', shell: false, windowsHide: true, env: { ...process.env, NODE_OPTIONS: '' } });
  if (child.error) throw child.error;
  process.exitCode = child.status ?? 1;
} catch (error) { console.error(JSON.stringify({ error: error.message })); process.exitCode = 1; }
