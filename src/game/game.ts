import {initializeEras,recordEraProduction} from './systems/eras.js';
import {recordProducts} from './systems/industry-products.js';
import { recordBranchWork } from './systems/branches.js';
import { initializeLife, initializeSect } from './systems/life.js';
import { initialExpeditions,recordExpeditionEvidence } from './systems/expedition.js';
import { initializeModern } from './systems/modern.js';
import { initialTower,recordTowerEvidence } from './systems/tower.js';
import { initialWorkshops } from './systems/workshop.js';
import { initialOperations,recordProjectEvidence } from './systems/operations.js';
import { initialShop } from './systems/shop.js';
import { initialEconomy } from './systems/economy.js';
import { initialProductNetwork } from './systems/product-network.js';
import { actionId } from './model/action.js';
import type { ActionOffer, GameAction } from './model/action.js';
import { activePerson, blankPerson, heir } from './model/state.js';
import type { GameState } from './model/state.js';
import type { GameEvent } from './model/events.js';
import type { Ruleset } from './ruleset.js';
import { deepFreeze } from './ruleset.js';
import { newSeason, finishSeason } from './systems/time.js';
import { masterAvailable } from './systems/learning.js';
import { actionDefinitions } from './actions/index.js';
import { initialProduction } from './systems/crafts.js';
import type { Material } from './model/production.js';
import { initialDevelopment,developFromEvents } from './systems/development.js';

export function createInitialState(rules: Ruleset, seed: number, scenarioId: string): GameState {
  if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) throw new Error('种子需要是 1—4294967295 的整数');
  if (!Object.hasOwn(rules.scenarios, scenarioId)) throw new Error('未知场景');
  const p = rules.parameters;
  const state: GameState = {
    schemaVersion: 1, clock: { generation: 1, turn: 1, absoluteTurn: 1 }, status: 'active', ap: p.actionsPerTurn,
    world: { era: '传统农业技术条件（非具体史年）', technologies: [...rules.worldTechnologies] },
    location: { id: scenarioId, weather: 'normal', rain: 2, water: 2, teachers: rules.technologies.map(t => t.id), season: { cultivated: false, usedChannel: false, trialSample: false } },
    household: { id: 'household:1', activePersonId: 'person:1', heirId: 'person:2', memberIds: ['person:1', 'person:2'], food: p.initialFood, money: p.initialMoney, hardship: 0, assetIds: ['seed:initial'], stockId: 'seed:initial', candidateId: null, activeProjectId: null },
    persons: { 'person:1': blankPerson('person:1', '本代经营者'), 'person:2': blankPerson('person:2', '已成年的后辈') },
    assets: { 'seed:initial': { id: 'seed:initial', kind: 'seed', name: '普通地方种源', potential: p.cropPotential, tolerance: 0 } },
    projects: {}, knowledge: { archives: [], reportIds: [] }, randomState: seed,
  };
  if (rules.production) {
    state.production = initialProduction(rules.scenarios[scenarioId].production!);
    if (rules.technologyFeedback) state.production.workshops = { woodenware: false, pottery: false };
    state.world.era = '跨地域生产与传承（非单一文明历史顺序）';
    state.location.teachers = [...rules.scenarios[scenarioId].production!.teachers];
  }
  if (rules.socialInheritance) state.society = { teaching: {}, methods: [], goods: { woodenware: 0, pottery: 0 }, contracts: { woodenware: { active: false, project: null }, pottery: { active: false, project: null } } };
  if(rules.development)state.development=initialDevelopment();
  if(rules.productNetwork)state.productNetwork=initialProductNetwork();
  if(rules.economy){state.economy=initialEconomy();if(rules.tower)state.economy.tower=initialTower();if(rules.workshops)state.economy.workshops=initialWorkshops();if(rules.shop)state.economy.shop=initialShop();if(rules.operations)state.economy.operations=initialOperations();state.world.era="学科与生产组织的形成";delete state.society;delete state.development;delete state.productNetwork;}
  if(rules.modern&&!state.economy?.modern)initializeModern(state,!!rules.civilization);
  if(rules.civilization){state.economy!.expeditions=initialExpeditions(!!rules.householdLineage);if(rules.householdLineage)state.economy!.lineage=true;}
  if(rules.branches){state.economy!.branches={learned:{[state.household.activePersonId]:['A0'],[state.household.heirId]:['A0']},archives:[],protocols:[],channels:[],delivered:[]};state.economy!.knowledge={};state.economy!.notes={};delete state.economy!.expeditions;delete state.economy!.workshops;}
  if(rules.industry)state.economy!.industry={rules:structuredClone(rules.industry),products:{},commissioned:[],instances:{},workers:{}};
  if(rules.life)initializeLife(state,rules.life);
  if(rules.renewal){state.life!.renewal=structuredClone(rules.renewal);for(const p of Object.values(state.persons))if(p.vitality)p.vitality.minimumEnergy=rules.renewal.minimumEnergy;}
  if(rules.socialFood){state.socialFood={rules:structuredClone(rules.socialFood),foodPerSeason:p.foodPerTurn,price:p.foodPrice,policy:'off',budget:rules.socialFood.defaultBudget,reserve:rules.socialFood.defaultReserve,delivery:false,serviceRemaining:rules.socialFood.serviceCapacity};state.production!.market.food=Math.min(state.production!.market.food,rules.socialFood.storage);}
  if(rules.electric)state.electric={rules:structuredClone(rules.electric)};
  if(rules.sect&&state.life)initializeSect(state,rules.sect);
  initializeEras(state,rules);
  newSeason(state, rules, []);
  return deepFreeze(state);
}
export function getAvailableActions(state: GameState, rules: Ruleset): ActionOffer[] {
  return actionDefinitions(state, rules).map(def => structuredClone(def.offer));
}
export function transition(state: GameState, action: GameAction, rules: Ruleset): { state: GameState; events: GameEvent[] } {
  const id = actionId(action);
  const definition = actionDefinitions(state, rules).find(def => def.offer.id === id);
  if (!definition?.offer.enabled) throw new Error(definition?.offer.reason || '此状态下不存在该行动');
  const next = structuredClone(state), events: GameEvent[] = [];
  const { ap, time, energy, money, food, materials } = definition.offer;
  if(next.life){next.life.timeRemaining=Math.round((next.life.timeRemaining-(time??0))*100)/100;activePerson(next).vitality!.energy=Math.round((activePerson(next).vitality!.energy-(energy??0))*100)/100;}
  next.ap -= ap; next.household.money -= money; next.household.food -= food;
  if (materials) for (const [material, amount] of Object.entries(materials)) next.production!.inventory[material as Material] -= amount;
  events.push({ type: 'action-paid', action: structuredClone(definition.offer.action), cost: { ap, ...(next.life?{time,energy}:{}), money, food, ...(materials ? { materials: { ...materials } } : {}) } });
  definition.execute(next, events);
  recordProducts(next,events);
  recordProjectEvidence(next,events);
  recordTowerEvidence(next,events);
  recordExpeditionEvidence(next,events);
  developFromEvents(next,events,rules);
  masterAvailable(next, activePerson(next), rules, events);
  if (rules.socialInheritance) masterAvailable(next, heir(next), rules, events);
  recordEraProduction(next,events,[...events]);
  recordBranchWork(next,events);
  if (action.type !== 'handover' && (action.type === 'end-turn' || action.type==='economy'&&(action.operation==='end'||action.operation==='erasettle') || (!next.sect&&(next.life?next.life.timeRemaining===0:next.ap === 0)))) finishSeason(next, rules, events);
  return { state: deepFreeze(next), events: deepFreeze(events) };
}
