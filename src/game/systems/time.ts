import { activePerson, heir, project, seedValue } from '../model/state.js';
import type { GameState } from '../model/state.js';
import type { Ruleset } from '../ruleset.js';
import type { GameEvent } from '../model/events.js';

function random(state: GameState): number {
  let x = state.randomState;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  state.randomState = x >>> 0;
  return state.randomState / 4294967296;
}
export function newSeason(state: GameState, rules: Ruleset, events: GameEvent[]): void {
  const scenario = rules.scenarios[state.location.id];
  const roll = random(state) * 100;
  const weather = roll < scenario.drought ? 'dry' : roll < scenario.drought + scenario.wet ? 'wet' : 'normal';
  state.location.weather = weather;
  state.location.rain = { dry: 0, normal: 2, wet: 3 }[weather];
  state.location.water = weather === 'dry' ? scenario.water : 2;
  state.ap = rules.parameters.actionsPerTurn;
  state.location.season = { cultivated: false, usedChannel: false, trialSample: false };
  events.push({ type: 'season-started', clock: { ...state.clock }, weather });
}
export function finishSeason(state: GameState, rules: Ruleset, events: GameEvent[]): void {
  const p = rules.parameters, family = state.household;
  const consumed = Math.min(family.food, p.foodPerTurn);
  family.food -= consumed;
  const missing = p.foodPerTurn - consumed;
  family.hardship = missing ? family.hardship + 1 : 0;
  events.push({ type: 'season-settled', consumed, missing, hardship: family.hardship });
  if (family.hardship >= p.hardshipLimit) { state.status = 'ended'; events.push({ type: 'experiment-ended', reason: 'hardship' }); return; }
  if (state.clock.turn >= p.turnsPerGeneration) {
    const trial = project(state);
    const final = state.clock.generation >= p.generations;
    events.push({ type: 'generation-ended', final, facts: {
      generation: state.clock.generation, food: family.food, money: family.money,
      mastered: [...activePerson(state).mastered], heir: [...heir(state).mastered], archives: [...state.knowledge.archives],
      project: trial ? { started: trial.started, control: seedValue(trial.control), candidate: seedValue(trial.candidate), samples: structuredClone(trial.samples) } : null,
    } });
    state.status = final ? 'complete' : 'handover';
    return;
  }
  state.clock.turn++; state.clock.absoluteTurn++;
  newSeason(state, rules, events);
}
