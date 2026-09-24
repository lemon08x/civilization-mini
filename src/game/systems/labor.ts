import {activePerson} from '../model/state.js';
import {dietView} from './social-food.js';
import type { GameState } from '../model/state.js';
import type { GameEvent } from '../model/events.js';
import { reservedLabor } from './industry.js';

export { reservedLabor, personalBudget, systemLabor } from './industry.js';
export { foodLabor } from './social-food.js';

export type LaborNeed = { time: number; energy: number; foodDays?:number };

export function quoteReservedLabor(
  state: GameState,
  id: string,
  costs: { money: number; food: number; energy?:number },
  blockers: string[],
  execute: (draft: GameState, events: GameEvent[]) => void,
): LaborNeed {
  state=structuredClone(state);
  if(state.life)activePerson(state).vitality!.pressure+=costs.energy??0;
  let reserved:LaborNeed = {...(state.economy?.industry ? reservedLabor(state) : { time: 0, energy: 0 }),foodDays:dietView(state)?.days};
  const previewable = (state.socialFood && id.startsWith('economy:') || state.life?.renewal && ['farm', 'sysassign', 'sysrun', 'sysremove'].includes(id.split(':')[1]))
    && blockers.length === 0 && state.household.money >= costs.money && state.household.food >= costs.food;
  if (previewable) {
    const preview = structuredClone(state);
    preview.household.money -= costs.money;
    preview.household.food -= costs.food;
    execute(preview, []);
    reserved = {...reservedLabor(preview),foodDays:dietView(preview)?.days};
  }
  return reserved;
}
