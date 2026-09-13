import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { resolveRuleset, isRecord } from '../../src/game/ruleset.js';
import { createSession, observeSession } from '../../src/runtime/session.js';
import { importLegacy, importRecord } from '../../src/runtime/replay.js';
import { FileRunStore } from '../../src/runtime/file-store.js';
import { metrics } from '../../src/research/metrics.js';
import { POLICIES } from '../../src/agents/contract.js';
import { scriptedAgent } from '../../src/agents/scripted/baseline.js';
import { runExperiment, validateExperiment } from '../../src/research/runner.js';
import { reportMarkdown } from '../../src/research/compare.js';
import { loadContext, projectRoot, readJson } from './context.js';

function options(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!args[i].startsWith('--') || args[i + 1] === undefined) throw new Error('参数格式：--name value');
    if (Object.hasOwn(result, args[i].slice(2))) throw new Error('参数不能重复');
    result[args[i].slice(2)] = args[i + 1];
  }
  return result;
}
try {
  const [command = 'help', ...args] = process.argv.slice(2), opts = options(args);
  if (command === 'help') {
    console.log(`世代规则预研 v0.6 — 默认工艺与科学规则 0.5.0
  npm run lab -- new --run demo --seed 17 --scenario woodland
  npm run lab -- new --run old-demo --rules legacy --scenario river
  npm run lab -- observe --run demo
  npm run lab -- act --run demo --revision 0 --action study:observation
  npm run lab -- metrics --run demo
  npm run lab -- export --run demo
  npm run lab -- import --run imported --file runs/manual.json
  npm run simulate -- --candidate experiments/storage-capacity.json
  npm run simulate -- --rules legacy --spec experiments/plans/agriculture-v1.json
运行产物只写 artifacts/。旧 --file 存档请显式 import，不原地覆盖。`);
  } else {
    const context = await loadContext();
    if (opts.rules && !['legacy', 'production', 'feedback', 'society', 'development', 'network'].includes(opts.rules)) throw new Error('--rules 只支持 legacy / production / feedback / society / development / network');
    const { implementation, legacyBase } = context, base = opts.rules === 'legacy' ? legacyBase : opts.rules === 'production' ? context.productionBase : opts.rules === 'feedback' ? context.feedbackBase : opts.rules === 'society' ? context.societyBase : opts.rules === 'development' ? context.developmentBase : context.base;
    const store = new FileRunStore(join(projectRoot, 'artifacts/runs'), implementation);
    if (command === 'simulate') {
      const raw = await readJson(opts.spec ? resolve(opts.spec) : join(projectRoot, 'experiments/plans/default.json'));
      if (!isRecord(raw)) throw new Error('实验计划必须是对象');
      if (opts.seeds) raw.seeds = opts.seeds.split(',').map(Number);
      if (opts.candidate) {
        if (!Array.isArray(raw.variants)) throw new Error('计划缺少参数组');
        raw.variants.push({ id: 'candidate', parameters: await readJson(resolve(opts.candidate)) });
      }
      const agents = Object.fromEntries(POLICIES.map(id => [id, scriptedAgent(id)]));
      const spec = validateExperiment(raw, base, agents);
      const artifactId = `${spec.id}-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID().slice(0, 8)}`;
      const directory = join(projectRoot, 'artifacts/experiments', artifactId);
      await mkdir(join(projectRoot, 'artifacts/experiments'), { recursive: true });
      await mkdir(directory, { recursive: false });
      await mkdir(join(directory, 'runs'));
      await writeFile(join(directory, 'manifest.json'), JSON.stringify({ spec, implementation, baseRuleset: base }, null, 2), { flag: 'wx' });
      try {
        const results = await runExperiment(spec, base, implementation, agents, async (session, result) => {
          await writeFile(join(directory, 'runs', `${result.runId}.json`), JSON.stringify(session.record), { flag: 'wx' });
        });
        await writeFile(join(directory, 'metrics.json'), JSON.stringify(results, null, 2), { flag: 'wx' });
        await writeFile(join(directory, 'report.md'), reportMarkdown(results), { flag: 'wx' });
        console.log(JSON.stringify({ runs: results.length, controller: 'scripted', report: join(directory, 'report.md') }));
      } catch (error) {
        await writeFile(join(directory, 'failure.json'), JSON.stringify({ error: (error as Error).message }), { flag: 'wx' }); throw error;
      }
    } else {
      if (!opts.run) throw new Error('请指定 --run；旧文件先使用 import --run 新ID --file 原路径');
      if (command === 'new') {
        const overrides = opts.params ? await readJson(resolve(opts.params)) : {};
        const session = await createSession({ runId: opts.run, ruleset: resolveRuleset(base, overrides), implementation, seed: Number(opts.seed ?? 1), scenarioId: opts.scenario ?? (base.production ? 'woodland' : 'river') });
        await store.create(session); console.log(JSON.stringify(observeSession(session), null, 2));
      } else if (command === 'import') {
        if (!opts.file) throw new Error('import 需要 --file');
        const raw = await readJson(resolve(opts.file));
        let session;
        if (isRecord(raw) && raw.format === 'civilization-mini-replay') session = await importLegacy(raw, legacyBase, implementation, opts.run);
        else session = await importRecord(raw, implementation, opts.run);
        await store.create(session); console.log(JSON.stringify(observeSession(session), null, 2));
      } else if (command === 'act') {
        if (!opts.action || opts.revision === undefined) throw new Error('act 需要 --action 和 --revision');
        const result = await store.submit(opts.run, { commandId: opts['command-id'] ?? `${opts.run}:${opts.revision}`, expectedRevision: Number(opts.revision), actionId: opts.action, ...(opts.reason === undefined ? {} : { reason: opts.reason }) });
        console.log(JSON.stringify({ ...observeSession(result.session), receipt: { duplicate: result.duplicate, revision: result.revision } }, null, 2));
      } else {
        const session = await store.load(opts.run);
        if (command === 'observe') console.log(JSON.stringify(observeSession(session), null, 2));
        else if (command === 'metrics') console.log(JSON.stringify(metrics(session.record, session.state), null, 2));
        else if (command === 'export') console.log(JSON.stringify(session.record, null, 2));
        else throw new Error('未知命令');
      }
    }
  }
} catch (error) { console.error(JSON.stringify({ error: (error as Error).message })); process.exitCode = 1; }
