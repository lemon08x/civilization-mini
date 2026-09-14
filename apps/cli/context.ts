import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRuleset } from '../../src/game/ruleset.js';
import type { ImplementationIdentity } from '../../src/runtime/records.js';

export const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
export async function readJson(path: string): Promise<unknown> { return JSON.parse(await readFile(path, 'utf8')) as unknown; }
async function loadIdentity() {
  const implementation = await readJson(join(projectRoot, 'dist/implementation.json')) as ImplementationIdentity;
  const root = join(projectRoot, 'dist/src/game');
  const paths = (await readdir(root, { recursive: true })).filter(name => name.endsWith('.js')).sort();
  const hash = createHash('sha256');
  for (const name of paths) { hash.update(name.replaceAll('\\', '/')); hash.update('\n'); hash.update((await readFile(join(root, name), 'utf8')).replaceAll('\r\n', '\n')); hash.update('\n'); }
  if (hash.digest('hex') !== implementation.codeFingerprint) throw new Error('构建产物与代码指纹不匹配，请重新 npm run build');
  return implementation;
}
export async function loadCurrentContext() {
  const implementation = await loadIdentity();
  const base = validateRuleset(await readJson(join(projectRoot, 'rulesets/social-food.v21.json')));
  return { implementation, base, economyBase: base };
}
export async function loadContext() {
  const implementation = await loadIdentity();
  const legacyBase = validateRuleset(await readJson(join(projectRoot, 'rulesets/traditional-agriculture.v1.json')));
  const productionBase = validateRuleset(await readJson(join(projectRoot, 'rulesets/shared-production.v2.json')));
  const feedbackBase = validateRuleset(await readJson(join(projectRoot, 'rulesets/technology-feedback.v3.json')));
  const societyBase = validateRuleset(await readJson(join(projectRoot, 'rulesets/social-inheritance.v4.json')));
  const developmentBase = validateRuleset(await readJson(join(projectRoot, 'rulesets/craft-science.v5.json')));
  const base = validateRuleset(await readJson(join(projectRoot, 'rulesets/product-network.v6.json')));
  const pacingBase=validateRuleset(await readJson(join(projectRoot,'rulesets/household-progress.v7.json')));
  const investmentBase=validateRuleset(await readJson(join(projectRoot,'rulesets/passive-investment.v8.json')));
  const economyBase=validateRuleset(await readJson(join(projectRoot,'rulesets/discipline-economy.v9.json')));
  return { implementation, economyBase, investmentBase, pacingBase, base, developmentBase, societyBase, legacyBase, productionBase, feedbackBase };
}
