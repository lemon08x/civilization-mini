import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateRuleset } from '../src/game/ruleset.js';
import { createInitialState } from '../src/game/game.js';

async function part(name: string): Promise<unknown> {
  return JSON.parse(await readFile(join('rulesets/v27', name), 'utf8')) as unknown;
}

export const rules = validateRuleset({
  ...(await part('meta.json') as object),
  ...(await part('parameters.json') as object),
  scenarios: await part('scenarios.json'),
  ...(await part('legacy.json') as object),
  ...(await part('systems.json') as object),
  catalogs: await part('catalogs.json'),
});
export const fresh = () => structuredClone(createInitialState(rules, 17, 'river'));
