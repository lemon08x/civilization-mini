import { textObservation } from './text-observation.js';
import type { SessionObservation } from '../../src/runtime/session.js';
import { compactObservation, formatCompactObservation, observationSection, parseCompactSection } from '../../src/present/compact-observation.js';
import { writeFile, rename } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { resolveRuleset } from '../../src/game/ruleset.js';
import { createSession, observeSession } from '../../src/runtime/session.js';
import { FileRunStore } from '../../src/runtime/file-store.js';
import { loadCurrentContext, projectRoot, readJson } from './context.js';

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
  if (opts.format && !['json', 'text', 'compact'].includes(opts.format)) throw new Error('format 仅支持 json / text / compact');
  const renderObservation = (o: SessionObservation, receipt?: { duplicate: boolean; revision: number }) => {
    if (opts.format === 'text') return textObservation(o);
    if (opts.format === 'compact') return formatCompactObservation(compactObservation(o, receipt ? { receipt } : undefined));
    return JSON.stringify(receipt ? { ...o, receipt } : o, null, 2);
  };
  const printObservation = (o: SessionObservation, receipt?: { duplicate: boolean; revision: number }) => console.log(renderObservation(o, receipt));
  const publishObservation = async (o: SessionObservation) => {
    const directory = join(projectRoot, 'artifacts/runs', o.runId);
    const temporary = join(directory, 'observation-' + crypto.randomUUID() + '.tmp');
    const body = opts.format === 'compact' ? formatCompactObservation(compactObservation(o)) : textObservation(o);
    try {
      await writeFile(temporary, body, {flag: 'wx'});
      await rename(temporary, join(directory, 'observation.md'));
    } catch (error) {
      console.error('行动/建档已保存，但文本观察更新失败；请用 observe --format text 或 --format compact 获取最新观察：' + (error as Error).message);
    }
  };
  if (command === 'help') {
    console.log(`世代规则预研 — 0.27.0
  npm run lab -- new --run demo --seed 17 --scenario river
  npm run lab -- observe --run demo
  npm run lab -- act --run demo --revision 0 --action <行动ID>
运行产物只写 artifacts/runs/。`);
  } else {
    const { base } = await loadCurrentContext();
    const store = new FileRunStore(join(projectRoot, 'artifacts/runs'));
    if (!opts.run) throw new Error('请指定 --run');
    if (command === 'new') {
      const overrides = opts.params ? await readJson(resolve(opts.params)) : {};
      const session = await createSession({ runId: opts.run, ruleset: resolveRuleset(base, overrides), seed: Number(opts.seed ?? 1), scenarioId: opts.scenario ?? 'river' });
      await store.create(session); const created = observeSession(session); await publishObservation(created); printObservation(created);
    } else if (command === 'act') {
      if (!opts.action || opts.revision === undefined) throw new Error('act 需要 --action 和 --revision');
      const result = await store.submit(opts.run, { commandId: opts['command-id'] ?? `${opts.run}:${opts.revision}`, expectedRevision: Number(opts.revision), actionId: opts.action, ...(opts.reason === undefined ? {} : { reason: opts.reason }) });
      const after = observeSession(result.session);
      await publishObservation(after);
      printObservation(after, { duplicate: result.duplicate, revision: result.revision });
    } else if (command === 'observe') {
      const observed = observeSession(await store.load(opts.run));
      if (opts.section) console.log(observationSection(observed, parseCompactSection(opts.section)));
      else printObservation(observed);
    } else throw new Error('未知命令');
  }
} catch (error) { console.error(JSON.stringify({ error: (error as Error).message })); process.exitCode = 1; }
