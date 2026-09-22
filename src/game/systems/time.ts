import {settleTermEvent,changeCalendarWeather,seasonAt,lunarDateAt} from './calendar.js';
import {advanceFields} from './agriculture.js';
import {feedCalendar} from './social-food.js';
import {settleIndustry} from './industry.js';
import {recordBranchWork} from './branches.js';
import {renewSocialFood,settleSocialFood} from './social-food.js';
import {renewEraServices,operateEraServices,recordEraProduction,settleEra} from './eras.js';
import { renewIndustry } from './industry.js';
import { settleSeasonEncounter, canSucceed, recordLifeGeneration, settleLife, renewSect, settleSect } from './life.js';
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

function rollWeather(state: GameState, rules: Ruleset, events: GameEvent[]): void {
  const scenario = rules.scenarios[state.location.id];
  const roll = random(state) * 100;
  const weather = roll < scenario.drought ? 'dry' : roll < scenario.drought + scenario.wet ? 'wet' : 'normal';
  state.location.weather = weather;
  state.location.rain = { dry: 0, normal: 2, wet: 3 }[weather];
  state.location.water = weather === 'dry' ? scenario.water : 2;
  state.ap = state.life?0:rules.parameters.actionsPerTurn;
  if(state.life){
    const c=state.life.calendar;
    if(c){c.weatherNextDay=Math.floor(c.absoluteDay)+c.rules.weatherDays;const span=seasonAt(c.rules.referenceYear,c.absoluteDay);Object.assign(c,{seasonStarted:span.start,seasonLength:span.days,day:c.absoluteDay-span.start,consumed:0,missing:0,purchaseSpent:0,systemsSettled:false});state.life.timeRemaining=span.end-c.absoluteDay;}
    else state.life.timeRemaining=state.life.rules.timePerSeason;
  }
  if(state.economy){state.economy.market=4;state.economy.industrySupply=4;state.economy.recruitment=1;}
  if(state.development&&rules.development){state.development.tradeRemaining=rules.development.parameters.marketSupply;state.development.ordersRemaining=rules.development.parameters.marketSupply;}
  state.location.season = { cultivated: false, usedChannel: false, trialSample: false };
  events.push({ type: 'season-started', clock: { ...state.clock }, weather });
}

function renewArrivals(state: GameState, rules: Ruleset, events: GameEvent[]): void {
  resetModern(state,events);
  renewLocalSupply(state, rules, events);
  renewEraServices(state,rules);
  renewShop(state,rules,events);
  renewSocialFood(state,events);
  arriveWorkshops(state,rules,events);
  arriveTower(state,rules,events);
  arriveExpeditions(state,events);
  renewOperations(state,rules,events);
  renewIndustry(state);
}

function settleProduction(state: GameState, rules: Ruleset, events: GameEvent[]): number {
  const productionStart=events.length;
  operateEraServices(state,events);
  if(state.economy){beforeOperations(state,rules,events);if(!state.economy.industry){generateModern(state,events);serveModern(state,events);}settleEconomy(state,rules,events);settleWorkshops(state,rules,events);dispatchTower(state,rules,events);afterOperations(state,rules,events);recordProjectEvidence(state,events);}
  return productionStart;
}

function settleHousehold(state: GameState, rules: Ruleset, events: GameEvent[]): {missing:number;foodPerTurn:number} {
  operatePassive(state,rules,events);
  settleSociety(state, rules, events);
  if(state.life?.calendar){const c=state.life.calendar;state.household.hardship=c.missing>0?state.household.hardship+1:0;events.push({type:'season-settled',consumed:c.consumed,missing:c.missing,hardship:state.household.hardship});spoilEconomy(state,events);return {missing:c.missing,foodPerTurn:Math.max(c.consumed+c.missing,c.rules.grainPerDay*c.seasonLength)};}
  settleSocialFood(state,events);
  const p = rules.parameters, family = state.household;
  const consumed = Math.min(family.food, p.foodPerTurn);
  family.food -= consumed;
  const missing = p.foodPerTurn - consumed;
  family.hardship = missing ? family.hardship + 1 : 0;
  events.push({ type: 'season-settled', consumed, missing, hardship: family.hardship });
  if(state.economy)spoilEconomy(state,events);else spoilFood(state, rules, events);
  return {missing, foodPerTurn:p.foodPerTurn};
}

function settleDistantWork(state: GameState, rules: Ruleset, events: GameEvent[], productionStart: number): void {
  advanceProjects(state,rules,events);
  recordTowerEvidence(state,events);
  settleTower(state,rules,events);
  recordExpeditionEvidence(state,events);
  settleExpeditions(state,rules,events);
  storeModern(state,events);
  recordEraProduction(state,events,events.slice(productionStart));
}

function settleLifeAndEra(state: GameState, rules: Ruleset, events: GameEvent[], missing: number, foodPerTurn: number): boolean {
  if(state.life){
    settleSeasonEncounter(state,missing,events);
    settleLife(state,missing,events,foodPerTurn);
    settleSect(state,events);
    settleEra(state,rules,events);
    if(state.status!=='active'){recordLifeGeneration(state,events);return true;}
    if(state.life.pendingRetirement&&canSucceed(state)){state.status='handover';recordLifeGeneration(state,events);return true;}
  }
  return false;
}

function settleVictoryAndGeneration(state: GameState, rules: Ruleset, events: GameEvent[]): boolean {
  const p = rules.parameters, family = state.household;
  if (!state.life && family.hardship >= p.hardshipLimit) { state.status = 'ended'; events.push({ type: 'experiment-ended', reason: 'hardship' }); return true; }
  const victory=technologyVictory(state,rules);
  if(victory?.achieved){state.status='complete';if(!rules.tower)events.push({type:'technology-victory',mastered:victory.mastered.length,total:victory.total,required:victory.required});return true;}
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
    return true;
  }
  return false;
}

export function newSeason(state: GameState, rules: Ruleset, events: GameEvent[]): void {
  rollWeather(state, rules, events);
  renewArrivals(state, rules, events);
  renewSect(state);
}
export function finishSeason(state: GameState, rules: Ruleset, events: GameEvent[]): void {
  const productionStart=settleProduction(state, rules, events);
  recordBranchWork(state,events.slice(productionStart));
  const {missing, foodPerTurn}=settleHousehold(state, rules, events);
  settleDistantWork(state, rules, events, productionStart);
  if(settleLifeAndEra(state, rules, events, missing, foodPerTurn)) return;
  if(settleVictoryAndGeneration(state, rules, events)) return;
  state.clock.turn++; state.clock.absoluteTurn++;
  newSeason(state, rules, events);
}

/** All date movement runs inside game.transition, including waits and season boundaries. */
export function advanceCalendar(s:GameState,rules:Ruleset,days:number,events:GameEvent[],interruptible=false):void {
 const c=s.life?.calendar;if(!c)return;
 let remaining=days,elapsed=0,ate=0,missing=0,notice='';
 // Reserved systems are real work, performed once before calendar time moves.
 const before=s.life!.timeRemaining;settleIndustry(s,events);
 remaining+=Math.max(0,before-s.life!.timeRemaining);
 while(remaining>0&&s.status==='active'){
  const previousDay=Math.floor(c.absoluteDay);
  const step=Math.min(0.5,remaining,c.seasonLength-c.day);
  const foodBefore=c.consumed,missingBefore=c.missing;
  const fed=feedCalendar(s,step,events);ate+=c.consumed-foodBefore;missing+=c.missing-missingBefore;
  const ripe=advanceFields(s,step);
  c.absoluteDay=Math.round((c.absoluteDay+step)*100)/100;
  c.day=Math.round((c.day+step)*100)/100;elapsed+=step;remaining=Math.max(0,remaining-step);
  s.life!.timeRemaining=Math.max(0,c.seasonLength-c.day);
  if(!fed)notice='饮食不足，先补充干粮，或准备食材与柴火。';
  else if(ripe.length)notice=ripe.join('、')+'已经成熟，可以收获。';
  if(c.day>=c.seasonLength&&s.status==='active'){
   finishSeason(s,rules,events);notice=notice||'季节已变，天气与市场供应已更新。';
  }
  if(Math.floor(c.absoluteDay)>previousDay){
    if(c.absoluteDay>=c.weatherNextDay)changeCalendarWeather(s,rules,events);
    settleTermEvent(s,events);
    const today=lunarDateAt(c.rules.referenceYear,c.absoluteDay);
    const names=[today.solarTerm,...today.festivals.map(f=>f.name)].filter(Boolean);
    if(names.length){const text=`${today.lunarDate} · ${names.join('、')}。${today.solarTerm?today.termDescription:''}${today.festivals.map(f=>f.description).join('')}`;events.push({type:'life',personId:s.household.activePersonId,operation:'almanac',detail:text});notice=[notice,text].filter(Boolean).join(' ');}
  }
  if(interruptible&&notice)break;
 }
 c.lastNotice=notice||`日历推进${Math.round(elapsed*100)/100}天；作物继续生长，饮食按日结算。`;
 events.push({type:'life',personId:s.household.activePersonId,operation:'calendar',detail:`经过${Math.round(elapsed*100)/100}天，饮食消耗${Math.round(ate*1000)/1000}批${missing>0?'，饮食不足':''}。${c.lastNotice}`});
}
