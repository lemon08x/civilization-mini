import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRuleset } from '../../src/game/ruleset.js';

export const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
export const savesRoot = join(projectRoot, 'saves');
export async function readJson(path: string): Promise<unknown> { return JSON.parse(await readFile(path, 'utf8')) as unknown; }

async function readPart(name: string): Promise<unknown> {
  return readJson(join(projectRoot, 'rulesets/v27', name));
}

export async function loadCurrentContext() {
  const meta = await readPart('meta.json') as Record<string, unknown>;
  const parameters = await readPart('parameters.json') as Record<string, unknown>;
  const systems = await readPart('systems.json') as Record<string, unknown>;
  const legacy = await readPart('legacy.json') as Record<string, unknown>;
  const base = validateRuleset({
    ...meta,
    ...parameters,
    scenarios: await readPart('scenarios.json'),
    ...legacy,
    ...systems,
    catalogs: await readPart('catalogs.json'),
  });
  return { base };
}
