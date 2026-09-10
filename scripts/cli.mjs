import { readFile, writeFile, mkdir, rename, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { applyAction, createGame, exportGame, importGame, metrics, observe } from '../src/engine.mjs';

function options(args) {
  const result = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!args[i].startsWith('--') || args[i + 1] === undefined) throw new Error('参数格式：--name value');
    result[args[i].slice(2)] = args[i + 1];
  }
  return result;
}

async function save(path, game) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(exportGame(game), null, 2), 'utf8');
  await rename(temporary, path);
}

try {
  const [command = 'help', ...args] = process.argv.slice(2);
  const opts = options(args);
  const file = resolve(opts.file ?? 'runs/manual.json');
  let game;
  if (command === 'new') {
    let exists = false;
    try { await access(file); exists = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (exists) throw new Error('目标存档已存在；请使用不同 --file，不覆盖原实验');
    const overrides = opts.params ? JSON.parse(await readFile(resolve(opts.params), 'utf8')) : {};
    game = createGame({ seed: Number(opts.seed ?? 1), scenario: opts.scenario ?? 'river', overrides });
    await save(file, game);
  } else if (['observe', 'act', 'metrics'].includes(command)) {
    game = importGame(JSON.parse(await readFile(file, 'utf8')));
    if (command === 'act') {
      if (!opts.action || opts.revision === undefined) throw new Error('act 需要 --action 与 --revision');
      game = applyAction(game, opts.action, Number(opts.revision));
      await save(file, game);
    }
  } else if (command === 'help') {
    console.log(`规则预研 CLI（在项目目录运行）
  npm run lab -- new --file runs/manual.json --seed 17 --scenario river
  npm run lab -- observe --file runs/manual.json
  npm run lab -- act --file runs/manual.json --revision 0 --action study:observation
  npm run lab -- metrics --file runs/manual.json
输出 JSON；act 只接受当前观察中 enabled=true 的行动。单个实验文件只由一个操作者顺序写入。`);
    process.exit(0);
  } else throw new Error('未知命令；使用 npm run lab -- help');
  console.log(JSON.stringify(command === 'metrics' ? metrics(game) : observe(game), null, 2));
} catch (error) {
  console.error(JSON.stringify({ error: error.message }));
  process.exitCode = 1;
}
