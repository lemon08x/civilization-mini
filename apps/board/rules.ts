import { validateRuleset } from '../../src/game/ruleset.js';
import type { Ruleset } from '../../src/game/ruleset.js';

export async function loadAssembledRules(): Promise<Ruleset> {
  const response = await fetch('/rulesets/current.json');
  if (!response.ok) {
    throw new Error(`规则加载失败（HTTP ${response.status}），请重启游戏服务后刷新页面。`);
  }
  return validateRuleset(await response.json());
}
