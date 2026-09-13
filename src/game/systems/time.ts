import { renewIndustry } from './industry.js';
import { canSucceed, recordLifeGeneration, settleLife } from './life.js';
import { arriveExpeditions,recordExpeditionEvidence,settleExpeditions } from './expedition.js';
import { resetModern,generateModern,serveModern,storeModern } from './modern.js';
import { arriveTower,dispatchTower,recordTowerEvidence,settleTower } from './tower.js';
import { arriveWorkshops,settleWorkshops } from './workshop.js';
import { renewOperations,beforeOperations,afterOperations,advanceProjects,recordProjectEvidence } from './operations.js';
import { renewShop } from './shop.js';
import { settleEconomy,spoilEconomy } from './economy.js';
import { operatePassive, technologyVictory } from './investment.js';
import { activePerson, heir, project, seedValue } from '../model/state.js';
import type { GameState } from '../model/state.js';
import type { Ruleset } from '../ruleset.js';
import type { GameEvent } from '../model/events.js';
import { renewLocalSupply, spoilFood } from './crafts.js';
import { settleSociety } from './society.js';

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
  state.ap = state.life?0:rules.parameters.actionsPerTurn;
  if(state.life)state.life.timeRemaining=state.life.rules.timePerSeason;
  if(state.economy){state.economy.market=4;state.economy.industrySupply=4;state.economy.recruitment=1;}
  if(state.development&&rules.development){state.development.tradeRemaining=rules.development.parameters.marketSupply;state.development.ordersRemaining=rules.development.parameters.marketSupply;}
  state.location.season = { cultivated: false, usedChannel: false, trialSample: false };
  events.push({ type: 'season-started', clock: { ...state.clock }, weather });
  resetModern(state,events);
  renewLocalSupply(state, rules, events);
  renewShop(state,rules,events);
  arriveWorkshops(state,rules,events);
  arriveTower(state,rules,events);
  arriveExpeditions(state,events);
  renewOperations(state,rules,events);
  renewIndustry(state);
}
export function finishSeason(state: GameState, rules: Ruleset, events: GameEvent[]): void {
  if(state.economy){beforeOperations(state,rules,events);if(!state.economy.industry){generateModern(state,events);serveModern(state,events);}settleEconomy(state,rules,events);settleWorkshops(state,rules,events);dispatchTower(state,rules,events);afterOperations(state,rules,events);recordProjectEvidence(state,events);

  }
  operatePassive(state,rules,events);
  settleSociety(state, rules, events);
  const p = rules.parameters, family = state.household;
  const consumed = Math.min(family.food, p.foodPerTurn);
  family.food -= consumed;
  const missing = p.foodPerTurn - consumed;
  family.hardship = missing ? family.hardship + 1 : 0;
  events.push({ type: 'season-settled', consumed, missing, hardship: family.hardship });
  if(state.economy)spoilEconomy(state,events);else spoilFood(state, rules, events);
  advanceProjects(state,rules,events);
  recordTowerEvidence(state,events);
  settleTower(state,rules,events);
  recordExpeditionEvidence(state,events);
  settleExpeditions(state,rules,events);
  storeModern(state,events);
  if(state.life){
    settleLife(state,missing,events);
    if(state.status!=='active'){recordLifeGeneration(state,events);return;}
    if(state.life.pendingRetirement&&canSucceed(state)){state.status='handover';recordLifeGeneration(state,events);return;}
  }
  if (!state.life && family.hardship >= p.hardshipLimit) { state.status = 'ended'; events.push({ type: 'experiment-ended', reason: 'hardship' }); return; }
  const victory=technologyVictory(state,rules);
  if(victory?.achieved){state.status='complete';if(!rules.tower)events.push({type:'technology-victory',mastered:victory.mastered.length,total:victory.total,required:victory.required});return;}
  if (!state.life && state.clock.turn >= p.turnsPerGeneration) {
    const trial = project(state);
    const final = !rules.civilization && state.clock.generation >= p.generations;
    events.push({ type: 'generation-ended', final, facts: {
      generation: state.clock.generation, food: family.food, money: family.money,
      mastered: [...activePerson(state).mastered], heir: [...heir(state).mastered], archives: [...state.knowledge.archives],
      project: trial ? { started: trial.started, control: seedValue(trial.control), candidate: seedValue(trial.candidate), samples: structuredClone(trial.samples) } : null,
      ...(state.production ? { production: structuredClone(state.production) } : {}),
    } });
    state.status = final ? 'complete' : 'handover';
    return;
  }
  state.clock.turn++; state.clock.absoluteTurn++;
  newSeason(state, rules, events);
}
