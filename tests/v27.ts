import { readFile } from 'node:fs/promises';
import { validateRuleset } from '../src/game/ruleset.js';
import { createInitialState } from '../src/game/game.js';

export const rules = validateRuleset(JSON.parse(await readFile('rulesets/social-eras.v27.json', 'utf8')));
export const fresh = () => structuredClone(createInitialState(rules, 17, 'river'));
