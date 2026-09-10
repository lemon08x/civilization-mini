import { parseActionId } from '../model/action.js';
import type { ActionCost, ActionOffer } from '../model/action.js';
import type { GameState } from '../model/state.js';
import type { GameEvent } from '../model/events.js';

export interface ActionDefinition { offer: ActionOffer; execute: (draft: GameState, events: GameEvent[]) => void }
export function defineAction(state: GameState, id: string, label: string, group: string, costs: Partial<ActionCost>, blockers: string[], description: string, execute: ActionDefinition['execute']): ActionDefinition {
  const { ap = 1, money = 0, food = 0 } = costs;
  const reasons = [...blockers];
  if (state.ap < ap) reasons.push('行动点不足');
  if (state.household.money < money) reasons.push('钱财不足');
  if (state.household.food < food) reasons.push('口粮不足');
  return { offer: { id, action: parseActionId(id), label, group, ap, money, food, enabled: reasons.length === 0, reason: reasons.join('；'), description }, execute };
}
