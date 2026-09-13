import type { Crop } from './economy.js';
export interface OperationsRules {foodTarget:number;inputBatches:number;cashReserve:number;outputReserve:number;repairThreshold:number;commissionSeasons:number;requiredAchievements:number;projectFee:number;mineYield:number;steamFuel:number;}
export const OPERATIONS_BOUNDS:Record<keyof OperationsRules,[number,number]>={foodTarget:[2,8],inputBatches:[1,3],cashReserve:[0,12],outputReserve:[1,6],repairThreshold:[0,4],commissionSeasons:[2,6],requiredAchievements:[1,4],projectFee:[2,16],mineYield:[1,3],steamFuel:[1,4]};
export type RegionalProject='food'|'mechanical'|'mine'|'steam';
export interface OperationsState {
 paused:boolean;food:boolean;foodReserved:number;farm:Crop|'rotation'|null;production:{recipe:string;mode:'stock'|'sell'}|null;
 supplies:boolean;sales:boolean;maintenance:boolean;charter:boolean;mine:boolean;steam:boolean;
 projects:Partial<Record<RegionalProject,{stage:'commissioning'|'complete';progress:number;founder:string;qualifiedTurn?:number}>>;
 activeProject:RegionalProject|null;notice:string[];
}
