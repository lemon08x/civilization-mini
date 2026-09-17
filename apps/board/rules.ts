import { validateRuleset } from '../../src/game/ruleset.js';
import type { Ruleset } from '../../src/game/ruleset.js';

export async function loadAssembledRules(): Promise<Ruleset> {
  return validateRuleset(await (await fetch('/rulesets/current.json')).json());
}
