import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRuleset } from '../../src/game/ruleset.js';
import type { ImplementationIdentity } from '../../src/runtime/records.js';

export const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
export async function readJson(path: string): Promise<unknown> { return JSON.parse(await readFile(path, 'utf8')) as unknown; }
export async function loadContext() {
  const implementation = await readJson(join(projectRoot, 'dist/implementation.json')) as ImplementationIdentity;
  const root = join(projectRoot, 'dist/src/game');
  const paths = (await readdir(root, { recursive: true })).filter(name => name.endsWith('.js')).sort();
  const hash = createHash('sha256');
  for (const name of paths) { hash.update(name.replaceAll('\\', '/')); hash.update('\n'); hash.update((await readFile(join(root, name), 'utf8')).replaceAll('\r\n', '\n')); hash.update('\n'); }
  if (hash.digest('hex') !== implementation.codeFingerprint) throw new Error('构建产物与代码指纹不匹配，请重新 npm run build');
  const base = validateRuleset(await readJson(join(projectRoot, 'rulesets/traditional-agriculture.v1.json')));
  return { implementation, base };
}
