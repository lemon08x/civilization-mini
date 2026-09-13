import { actionId } from '../game/model/action.js';
import { activePerson } from '../game/model/state.js';
import type { GameState } from '../game/model/state.js';
import type { GenerationFacts } from '../game/model/events.js';
import type { RunRecord } from '../runtime/records.js';

export function collectStatistics(record: RunRecord) {
  const stats = { foodProduced: 0, foodConsumed: 0, shortfall: 0, earnings: 0, waterUsed: 0, studyActions: 0, teachingActions: 0, researchSamples: 0, learned: [] as { generation: number; turn: number; id: string }[], inherited: [] as { generation: number; mastered: string[]; learning: Record<string, number> }[], actionCounts: {} as Record<string, number> };
  const history: (GenerationFacts & { shortfall: number })[] = [];
  for (const entry of record.entries) for (const event of entry.events) {
    switch (event.type) {
      case 'action-paid': { const id = actionId(event.action); stats.actionCounts[id] = (stats.actionCounts[id] ?? 0) + 1; break; }
      case 'harvest': stats.foodProduced += event.food; stats.waterUsed += event.drawn; break;
      case 'season-settled': stats.foodConsumed += event.consumed; stats.shortfall += event.missing; break;
      case 'income': stats.earnings += event.amount; break;
      case 'studied': stats.studyActions++; break;
      case 'taught': stats.teachingActions++; break;
      case 'trial-sampled': stats.researchSamples++; break;
      case 'mastered': if (event.role === 'active') stats.learned.push({ generation: event.clock.generation, turn: event.clock.turn, id: event.nodeId }); break;
      case 'handed-over': stats.inherited.push({ generation: event.generation, mastered: [...event.mastered], learning: { ...event.learning } }); break;
      case 'generation-ended': history.push({ ...structuredClone(event.facts), shortfall: stats.shortfall }); break;
    }
  }
  return { stats, history };
}
export function metrics(record: RunRecord, state: GameState) {
  const { stats, history } = collectStatistics(record);
  return { status: state.status, completedGenerations: history.length, food: state.household.food, money: state.household.money, foodProduced: stats.foodProduced, foodShortfall: stats.shortfall, waterUsed: stats.waterUsed,
    ...(record.manifest.ruleset.life?{life:lifeStatistics(record)}:{}),
    ...(state.economy?.tower?{tower:towerStatistics(record)}:{}),
    ...(state.economy?{economy:{goods:structuredClone(state.economy.goods),workers:structuredClone(state.economy.workers),regional:structuredClone(state.economy.regional),equipment:structuredClone(state.economy.equipment)}}:{}),
    learnedNodes: [...new Set(stats.learned.map(x => x.id))], lastPersonMastered: [...activePerson(state).mastered], inheritedNodes: stats.inherited.map(x => ({ generation: x.generation, nodes: [...x.mastered] })), archivedNodes: [...state.knowledge.archives], samples: stats.researchSamples, studyActions: stats.studyActions, teachingActions: stats.teachingActions, commands: record.entries.length,
    ...(state.productNetwork ? { productNetwork: productNetworkMetrics(record), productAssets: structuredClone(state.productNetwork) } : {}),
    ...(state.development ? { development: developmentMetrics(record), developmentAssets: { goods: structuredClone(state.development!.goods), designs: structuredClone(state.development!.designs), project: structuredClone(state.development!.project), fieldDurability: state.development!.fieldDurability, labDurability: state.development!.labDurability } } : {}),
    ...(record.manifest.ruleset.production ? { production: productionMetrics(record), inventory: structuredClone(state.production!.inventory), storage: { ...state.production!.storage }, toolDurability: state.production!.toolDurability } : {}) };
}

function lifeStatistics(record:RunRecord) {
  const result={timeSpent:0,energySpent:0,rests:0,care:0,births:0,deaths:0};
  for(const entry of record.entries)for(const event of entry.events){
    if(event.type==='action-paid'){result.timeSpent+=event.cost.time??0;result.energySpent+=event.cost.energy??0;}
    if(event.type==='life'){
      if(event.operation==='rest')result.rests++;
      if(event.operation==='care')result.care++;
      if(event.operation==='birth')result.births++;
      if(event.operation==='death')result.deaths++;
    }
  }
  return result;
}

function towerStatistics(record:RunRecord){
  const result={completedFloors:0,constructionSeasons:0,interruptions:0,consumed:{} as Record<string,number>,won:false};
  for(const entry of record.entries)for(const event of entry.events){
    if(event.type!=='tower')continue;
    if(event.operation==='floor-complete')result.completedFloors++;
    if(event.operation==='interrupted')result.interruptions++;
    if(event.operation==='victory')result.won=true;
    if(event.operation==='built'){result.constructionSeasons++;for(const [id,n]of Object.entries(event.goods))result.consumed[id]=(result.consumed[id]??0)+n;}
  }
  return result;
}
export type Metrics = ReturnType<typeof metrics>;

export function productionMetrics(record: RunRecord) {
  const result = { gatheredFood: 0, gatheredWood: 0, gatheredClay: 0, spoiledFood: 0, craftedWoodenware: 0, craftedPottery: 0, craftedTools: 0, craftEarnings: 0, installedStorage: 0, importedMethods: 0, workActions: 0, buyFoodActions: 0, cultivateActions: 0 };
  for (const entry of record.entries) for (const event of entry.events) {
    if (event.type === 'resource-gathered') result[event.resource === 'food' ? 'gatheredFood' : event.resource === 'wood' ? 'gatheredWood' : 'gatheredClay'] += event.amount;
    if (event.type === 'food-spoiled') result.spoiledFood += event.amount;
    if (event.type === 'craft-completed') result[event.recipe === 'woodenware' ? 'craftedWoodenware' : event.recipe === 'pottery' ? 'craftedPottery' : 'craftedTools'] += event.amount;
    if (event.type === 'goods-sold') result.craftEarnings += event.earnings;
    if (event.type === 'storage-installed') result.installedStorage++;
    if (event.type === 'method-acquired') result.importedMethods++;
    if (event.type === 'action-paid') {
      if (event.action.type === 'work') result.workActions++;
      if (event.action.type === 'buy-food') result.buyFoodActions++;
      if (event.action.type === 'cultivate') result.cultivateActions++;
    }
  }
  return result;
}

export function developmentMetrics(record: RunRecord) {
  const result = { outputs: {} as Record<string,number>, purchases: {} as Record<string,number>, deliveries: {} as Record<string,number>, experienceByPerson: {} as Record<string,Record<string,number>>, experiments: 0, findings: 0, refinements: 0, purchaseCost: 0, deliveryIncome: 0, fieldUses: 0, labUses: 0 };
  for (const entry of record.entries) for (const event of entry.events) {
    if (event.type === 'calibration-sold') { result.deliveries.calibrations=(result.deliveries.calibrations??0)+1; result.deliveryIncome+=event.money; }
    if (event.type === 'development-completed') result.outputs[event.good] = (result.outputs[event.good] ?? 0) + event.amount;
    if (event.type === 'development-traded') {
      const map = event.operation === 'buy' ? result.purchases : result.deliveries;
      map[event.good] = (map[event.good] ?? 0) + event.amount;
      if (event.operation === 'buy') result.purchaseCost += event.money; else result.deliveryIncome += event.money;
    }
    if (event.type === 'industrial-clay-bought') { result.purchases.clay = (result.purchases.clay ?? 0) + event.amount; result.purchaseCost += 3; }
    if (event.type === 'experience-gained') { const person = result.experienceByPerson[event.personId] ??= {}; person[event.domain] = (person[event.domain] ?? 0) + event.amount; }
    if (event.type === 'experiment-conducted') { result.experiments++; result.findings += event.amount; if (event.equipped) result.labUses++; }
    if (event.type === 'design-refined') result.refinements++;
    if (event.type === 'field-equipment-used') result.fieldUses++;
  }
  return result;
}

export function productNetworkMetrics(record:RunRecord) {
  const result={made:{} as Record<string,number>,operations:{} as Record<string,number>,residues:0,storedWaterUsed:0,usesByGeneration:{} as Record<number,string[]>};
  let generation=1;
  for(const entry of record.entries)for(const event of entry.events){
    if(event.type==='handed-over')generation=event.generation;
    if(event.type==='product-completed')result.made[event.device]=(result.made[event.device]??0)+1;
    if(event.type==='product-operated'){result.operations[event.device]=(result.operations[event.device]??0)+1;(result.usesByGeneration[generation]??=[]).push(event.device);}
    if(event.type==='ceramic-residue')result.residues+=event.amount;
    if(event.type==='stored-water-used')result.storedWaterUsed+=event.amount;
  }
  return result;
}
