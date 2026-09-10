import { activePerson, channel, project, stock } from '../model/state.js';
import type { GameState, SeedStock } from '../model/state.js';
import type { Ruleset } from '../ruleset.js';
import { has } from './learning.js';

export interface Harvest { gross: number; food: number; drawn: number; deficit: number; landCost: number }
export function harvestPreview(state: GameState, rules: Ruleset, seed: SeedStock = stock(state)): Harvest {
  const shortage = Math.max(0, 2 - state.location.rain);
  const available = (channel(state)?.durability ?? 0) > 0 ? state.location.water : 0;
  const efficiency = has(activePerson(state), 'allocation') ? 2 : 1;
  const drawn = Math.min(available, Math.ceil(shortage / efficiency));
  const deficit = Math.max(0, shortage - drawn * efficiency);
  const gross = Math.max(0, seed.potential - deficit * (2 - seed.tolerance));
  const landCost = project(state) ? rules.parameters.trialLandCost : 0;
  return { gross, food: Math.max(0, gross - landCost), drawn, deficit, landCost };
}
