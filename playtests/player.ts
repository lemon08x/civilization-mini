import { writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { compactObservation, formatCompactObservation, observationSection, parseCompactSection } from './compact-observation.js';
import { observeSession } from '../src/runtime/session.js';
import { FileRunStore } from '../src/runtime/file-store.js';
import { savesRoot } from '../apps/host/context.js';
import { textObservation } from '../apps/cli/text-observation.js';
import type { SessionObservation } from '../src/runtime/session.js';

function options(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!args[i].startsWith('--') || args[i + 1] === undefined) throw new Error('参数格式：--name value');
    if (Object.hasOwn(result, args[i].slice(2))) throw new Error('参数不能重复');
    result[args[i].slice(2)] = args[i + 1];
  }
  return result;
}

async function publish(observation: SessionObservation, body: string): Promise<void> {
  const directory = join(savesRoot, observation.runId);
  const temporary = join(directory, 'observation-' + crypto.randomUUID() + '.tmp');
  try {
    await writeFile(temporary, body, { flag: 'wx' });
    await rename(temporary, join(directory, 'observation.md'));
  } catch (error) {
    console.error('行动已保存，但文本观察更新失败；请重新 observe：' + (error as Error).message);
  }
}

try {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === 'help' || !['observe', 'act'].includes(command)) {
    throw new Error('玩家入口仅允许 observe / act');
  }
  const opts = options(args);
  if (opts.format && !['json', 'text', 'compact'].includes(opts.format)) throw new Error('format 仅支持 json / text / compact');
  if (!opts.run) throw new Error('请指定 --run');
  const store = new FileRunStore(savesRoot);
  const format = opts.format ?? (opts.section ? undefined : 'compact');
  const render = (o: SessionObservation, receipt?: { duplicate: boolean; revision: number }) => {
    if (format === 'text') return textObservation(o);
    if (format === 'json') return JSON.stringify(receipt ? { ...o, receipt } : o, null, 2);
    return formatCompactObservation(compactObservation(o, receipt ? { receipt } : undefined));
  };
  if (command === 'observe') {
    const observed = observeSession(await store.load(opts.run));
    if (opts.section) console.log(observationSection(observed, parseCompactSection(opts.section)));
    else console.log(render(observed));
  } else {
    if (!opts.action || opts.revision === undefined) throw new Error('act 需要 --action 和 --revision');
    const result = await store.submit(opts.run, {
      commandId: opts['command-id'] ?? `${opts.run}:${opts.revision}`,
      expectedRevision: Number(opts.revision),
      actionId: opts.action,
      ...(opts.reason === undefined ? {} : { reason: opts.reason }),
    });
    const after = observeSession(result.session);
    const body = render(after, { duplicate: result.duplicate, revision: result.revision });
    await publish(after, body);
    console.log(body);
  }
} catch (error) {
  console.error(JSON.stringify({ error: (error as Error).message }));
  process.exitCode = 1;
}
