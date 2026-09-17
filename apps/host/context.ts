import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRuleset } from '../../src/game/ruleset.js';

export const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
export async function readJson(path: string): Promise<unknown> { return JSON.parse(await readFile(path, 'utf8')) as unknown; }
export async function loadCurrentContext() {
  const base = validateRuleset(await readJson(join(projectRoot, 'rulesets/social-eras.v27.json')));
  return { base };
}
