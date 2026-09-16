import type {GameState} from './state.js';

export interface ElectricRules {
  lampTime:number; servicePower:number; dryHydroPower:number;
  unpoweredPercent:number; dungeonPower:number; powerProgress:number; applianceProgress:number;
}
export const ELECTRIC_BOUNDS:Record<keyof ElectricRules,[number,number]>={
  lampTime:[1,4],servicePower:[1,3],dryHydroPower:[1,6],unpoweredPercent:[1,99],
  dungeonPower:[1,6],powerProgress:[1,3],applianceProgress:[1,3],
};
export const APPLIANCES=['LAMP','TELEGRAPH','ELECTROLYZER'];
// Only this first slice is available in v27. The rest of the v14 catalogue remains historical.
export const ELECTRIC_KNOWLEDGE:Record<string,string[]>={
  E02:['L6','M5','L2'],E04:['L6','M5'],F07:['L6','M5','M2'],
  LAMP:['L7','M5'],TELEGRAPH:['L7','M5','O2'],ELECTROLYZER:['L7','M5','M2'],
  fuel:['L6','M5'],battery:['L6','M5'],aluminium:['L7','M5'],aluminiumwire:['L7','M5'],
};
export const ELECTRIC_PARENTS:Record<string,string[]>={
  E02:['coil','valve'],E04:['battery','cable'],F07:['valve','seal'],
  LAMP:['wire'],TELEGRAPH:['coil','cable'],ELECTROLYZER:['cable','seal'],
  fuel:['F07'],battery:['F07'],aluminium:['ELECTROLYZER'],aluminiumwire:['aluminium'],
};
export const electricOnline=(s:GameState,id:string)=>!!s.electric&&s.economy?.modern?.services[id]===s.clock.absoluteTurn;
export const seasonTime=(s:GameState)=>(s.life?.rules.timePerSeason??0)+(electricOnline(s,'LAMP')?s.electric!.rules.lampTime:0);
export const electricReady=(s:GameState)=>!!s.electric&&APPLIANCES.some(id=>electricOnline(s,id));
export const electricRewardPercent=(s:GameState)=>s.electric&&s.era?.index===3&&!electricReady(s)?s.electric.rules.unpoweredPercent:100;
export const ELECTRIC_EPIGRAPHS:Record<string,string>={
  L5:'看不见的联系，也能推动看得见的世界。',L6:'让流水的力量，抵达没有河流的地方。',
  L7:'发出力量之后，还要学会分配力量。',M4:'隔开危险，才能连接可能。',M5:'细线连接的，是原本分散的生活。',
};
