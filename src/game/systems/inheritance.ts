import { handoverOperations } from './operations.js';
import { blankPerson, heir } from '../model/state.js';
import type { GameState } from '../model/state.js';
import type { Ruleset } from '../ruleset.js';
import type { GameEvent } from '../model/events.js';
import { newSeason } from './time.js';

export function handover(state: GameState, rules: Ruleset, events: GameEvent[]): void {
  const child = heir(state), fromPersonId = state.household.activePersonId;
  state.household.activePersonId = child.id;
  child.name = '本代经营者';
  state.clock.generation++; state.clock.turn = 1; state.clock.absoluteTurn++;
  const id = `person:${state.clock.generation + 1}`;
  state.persons[id] = blankPerson(id, '已成年的后辈');
  state.household.memberIds.push(id); state.household.heirId = id;
  if(state.economy&&!state.economy.operations?.charter&&(state.economy.notes.organization??0)<3)for(const w of Object.values(state.economy.workers))if(w)w.active=false;
  state.status = 'active';
  events.push({ type: 'handed-over', generation: state.clock.generation, fromPersonId, personId: child.id, mastered: [...child.mastered], learning: { ...child.learning } });
  handoverOperations(state,events);
  newSeason(state, rules, events);
}
