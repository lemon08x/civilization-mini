import { textObservation } from './text-observation.js';
import type { SessionObservation } from '../../src/runtime/session.js';
import { createSession, observeSession } from '../../src/runtime/session.js';
import { FileRunStore } from '../../src/runtime/file-store.js';
import { loadCurrentContext, readJson, savesRoot } from './context.js';
import { resolveRuleset } from '../../src/game/ruleset.js';
import { resolve } from 'node:path';

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
  if (opts.format && !['json', 'text'].includes(opts.format)) throw new Error('format 仅支持 json / text；精简观察请用 playtests/player.mjs');
  const renderObservation = (o: SessionObservation, receipt?: { duplicate: boolean; revision: number }) => {
    if (opts.format === 'text') return textObservation(o);
    return JSON.stringify(receipt ? { ...o, receipt } : o, null, 2);
  };
  const printObservation = (o: SessionObservation, receipt?: { duplicate: boolean; revision: number }) => console.log(renderObservation(o, receipt));
  if (command === 'help') {
    console.log(`隐士修所 — 0.27.0
  npm run lab -- list
  npm run lab -- new --run demo --seed 17 --scenario river
  npm run lab -- observe --run demo
  npm run lab -- act --run demo --revision 0 --action <行动ID>
  npm run lab -- delete --run demo
存档在 saves/<runId>/record.json。AI 精简观察：node playtests/player.mjs`);
  } else {
    const { base } = await loadCurrentContext();
    const store = new FileRunStore(savesRoot);
    if (command === 'list') {
      const ids = await store.list();
      console.log(ids.length ? ids.join('\n') : '(没有存档)');
    } else if (!opts.run) throw new Error('请指定 --run');
    else if (command === 'new') {
      const overrides = opts.params ? await readJson(resolve(opts.params)) : {};
      const session = await createSession({ runId: opts.run, ruleset: resolveRuleset(base, overrides), seed: Number(opts.seed ?? 1), scenarioId: opts.scenario ?? 'river' });
      await store.create(session);
      printObservation(observeSession(session));
    } else if (command === 'delete') {
      await store.remove(opts.run);
      console.log(JSON.stringify({ deleted: opts.run }));
    } else if (command === 'act') {
      if (!opts.action || opts.revision === undefined) throw new Error('act 需要 --action 和 --revision');
      const result = await store.submit(opts.run, { commandId: opts['command-id'] ?? `${opts.run}:${opts.revision}`, expectedRevision: Number(opts.revision), actionId: opts.action, ...(opts.reason === undefined ? {} : { reason: opts.reason }) });
      printObservation(observeSession(result.session), { duplicate: result.duplicate, revision: result.revision });
    } else if (command === 'observe') {
      printObservation(observeSession(await store.load(opts.run)));
    } else throw new Error('未知命令');
  }
} catch (error) { console.error(JSON.stringify({ error: (error as Error).message })); process.exitCode = 1; }
