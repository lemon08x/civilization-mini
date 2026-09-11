import type { GameState } from '../model/state.js';
import { activePerson } from '../model/state.js';
import type { ProductionScenario, ProductionState, Recipe } from '../model/production.js';
import { WORKSHOP_NAMES } from '../model/production.js';
import type { GameEvent } from '../model/events.js';
import type { Ruleset } from '../ruleset.js';
import { accessible, has, prerequisites, techById } from './learning.js';

export function initialProduction(scenario: ProductionScenario): ProductionState {
  return { inventory: { wood: 0, clay: 0, woodenware: 0, pottery: 0 }, stocks: { ...scenario.stocks }, market: { ...scenario.market }, toolDurability: 0, storage: { woodenware: false, pottery: false }, project: null };
}
export function renewLocalSupply(state: GameState, rules: Ruleset, events: GameEvent[]): void {
  if (!state.production) return;
  const s = rules.scenarios[state.location.id].production!, local = state.production;
  if (state.clock.absoluteTurn > 1) {
    for (const key of ['wildFood', 'timber'] as const) {
      const recovery = Math.max(0, s.recovery[key] - Number(state.location.weather === 'dry'));
      local.stocks[key] = Math.min(s.stocks[key], local.stocks[key] + recovery);
    }
  }
  local.market = { ...s.market };
  events.push({ type: 'local-supply', stocks: { ...local.stocks }, market: { ...local.market } });
}
export function storageCapacity(state: GameState, rules: Ruleset): number {
  if (!state.production || !rules.production) return 0;
  const p = rules.production.parameters;
  return p.baseStorage + Number(state.production.storage.woodenware) * p.woodenStorage + Number(state.production.storage.pottery) * p.potteryStorage;
}
export function spoilagePreview(state: GameState, rules: Ruleset): number {
  if (!rules.production) return 0;
  return Math.ceil(Math.max(0, state.household.food - rules.parameters.foodPerTurn - storageCapacity(state, rules)) / rules.production.parameters.spoilDivisor);
}
export function spoilFood(state: GameState, rules: Ruleset, events: GameEvent[]): void {
  if (!rules.production) return;
  const capacity = storageCapacity(state, rules);
  const amount = Math.ceil(Math.max(0, state.household.food - capacity) / rules.production.parameters.spoilDivisor);
  state.household.food -= amount;
  events.push({ type: 'food-spoiled', amount, protected: capacity });
}
export function methodBlockers(state: GameState, rules: Ruleset, id: string): string[] {
  const person = activePerson(state), tech = techById(rules, id);
  return [
    ...(!prerequisites(person, tech) ? ['缺少必要或替代前置'] : []),
    ...(!has(person, id) && (!(person.learning[id] >= 1) || !accessible(state, tech)) ? ['需掌握方法，或学过一次且有指导来源'] : []),
  ];
}
export const recipeMethod = (recipe: Recipe): string => recipe === 'pottery' ? 'pottery' : 'woodworking';

export function technologyOutcomes(state: GameState, rules: Ruleset) {
  const local = state.production!, p = rules.production!.parameters;
  const withoutContainers = Math.ceil(Math.max(0, state.household.food - rules.parameters.foodPerTurn - p.baseStorage) / p.spoilDivisor);
  return {
    storage: { withoutContainers, withContainers: spoilagePreview(state, rules), avoidedNow: withoutContainers - spoilagePreview(state, rules) },
    workshops: (['woodenware', 'pottery'] as const).map(material => ({
      material, name: WORKSHOP_NAMES[material], technology: recipeMethod(material), built: Boolean(local.workshops?.[material]),
      mastered: has(activePerson(state), recipeMethod(material)), output: material === 'pottery' ? 4 : 2,
      ordinaryCraftActions: 4, batchCraftActions: 2,
      buildAction: `build-workshop:${material}`, batchAction: `craft-batch:${material}`,
    })),
  };
}

export function gatherPreview(state: GameState, rules: Ruleset, resource: 'food' | 'wood' | 'clay'): number {
  const local = state.production!, p = rules.production!.parameters;
  if (resource === 'food') return Math.min(local.stocks.wildFood, p.gatherFood + Number(has(activePerson(state), 'resource-observation')));
  if (resource === 'wood') return Math.min(local.stocks.timber, p.gatherWood + (local.toolDurability > 0 ? p.toolBonus : 0));
  return Math.min(local.stocks.clay, p.gatherClay);
}
