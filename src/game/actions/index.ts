import type { GameState } from '../model/state.js';
import type { Ruleset } from '../ruleset.js';
import { handover } from '../systems/inheritance.js';
import { defineAction } from './definition.js';
import type { ActionDefinition } from './definition.js';
import { livelihoodActions } from './livelihood.js';
import { educationActions } from './education.js';
import { researchActions } from './research.js';

export function actionDefinitions(state: GameState, rules: Ruleset): ActionDefinition[] {
  if (state.status === 'complete' || state.status === 'ended') return [];
  if (state.status === 'handover') return [defineAction(state, 'handover', '交接给后辈', '传承', { ap: 0 }, [], '保留后辈真实学习状态、家学、资产和未完项目；前代个人能力不会复制。', (draft, events) => handover(draft, rules, events))];
  return [...livelihoodActions(state, rules), ...educationActions(state, rules), ...researchActions(state, rules), defineAction(state, 'end-turn', '结束本季', '回合', { ap: 0 }, [], `消耗 ${rules.parameters.foodPerTurn} 口粮，结算生活。剩余行动点不结转。`, () => {})];
}
