import type { IndustryState } from './industry.js';
import type { BranchState } from './branches.js';
import type { ExpeditionState } from './expedition.js';
import type { TowerState } from './tower.js';
import type { WorkshopState } from './workshop.js';
import type { OperationsState } from './operations.js';
import type { ShopState } from "./shop.js";
export const SUBJECTS = ['mechanics','heat','chemistry','materials','agronomy','organization'] as const;
export type Subject = typeof SUBJECTS[number];
export type Crop = 'wheat'|'soy'|'flax';
export interface CookingRecipe {id:string;name:string;inputs:Record<string,number>;food:number;time:number;energy:number;}
export type WorkerKind = 'laborer'|'farmer'|'artisan'|'manager';
export type Work = 'polymer'|'wire'|'coil'|'cable'|'fuel'|'nutrient'|'battery'|'silicon'|'circuit'|'controller'|'composite'|'recycle'|'rest'|Crop|'ceramics'|'iron'|'fiber'|'brick'|'rope'|'oil'|'seal'|'shaft'|'valve'|'spring'|'solution'|'thresh'|'mill'|'compost';
export interface Worker {kind:WorkerKind;experience:number;job:Work;active:boolean;project:{good:string;amount:number;started:number}|null;}
export interface Field {variety?:'heritage';crop:Crop|null;planted:number;moisture:number;growth:number;stress:number;fertility:number;lastCrop:Crop|null;tended:number;composted:boolean;bonus:number;duration:number;}
export interface FarmRules {exploreTime:number;exploreEnergy:number;reclaimTime:number;reclaimEnergy:number;reclaimMoney:number;discoverySeeds:number;tradeQuantity:number;neighborStock:number;interactionTime:number;helpWater:number;clearTime:number;clearEnergy:number;identifyTime:number;storyFood:number;rareBonus:number;}
export const FARM_BOUNDS:Record<keyof FarmRules,[number,number]>={exploreTime:[1,8],exploreEnergy:[1,6],reclaimTime:[1,8],reclaimEnergy:[1,6],reclaimMoney:[1,20],discoverySeeds:[1,6],tradeQuantity:[1,6],neighborStock:[2,20],interactionTime:[1,4],helpWater:[1,3],clearTime:[1,8],clearEnergy:[1,6],identifyTime:[1,6],storyFood:[1,4],rareBonus:[1,2]};
export const FARM_DISCOVERIES=['meadow','oldtree','boulder','brambles','seedbag','heritage','canal','traveler','shrine'] as const;
export type FarmDiscovery=typeof FARM_DISCOVERIES[number];
export interface FarmPlot {id:string;x:number;y:number;kind:'unknown'|'wild'|'field'|'tree'|'rock'|'brush'|'story';field?:Field;discovery?:{id:FarmDiscovery;resolved:boolean;outcome:string};fertility?:number;}

export interface FarmState {explorationVersion:2;rareSeeds:number;rules:FarmRules;plots:Record<string,FarmPlot>;discovered:Crop[];explored:number;neighbor:{personId:string;goods:Record<string,number>;field:Field;talked:number;traded:number;helped:number;busy:boolean};}
export interface OngoingWork {farm:Crop|null;}
export interface EconomyState {
  farm?:FarmState;
  branches?:BranchState;
  industry?:IndustryState;
  ongoing?:OngoingWork;
  lineage?:true;
  expeditions?:ExpeditionState;
  modern?: {power:number;stored:number;enabled:string[];operated:Record<string,number>;services:Record<string,number>;cropBonus:number};
  tower?: TowerState;
  workshops?: WorkshopState;
  operations?: OperationsState;
  shop?: ShopState;
  shopGranaryCapacity?:number;
  knowledge:Record<string,Partial<Record<Subject,number>>>; evidence:Record<string,string[]>; notes:Partial<Record<Subject,number>>;
  goods:Record<string,number>; equipment:Record<string,number>; workers:Partial<Record<WorkerKind,Worker>>;field:Field;
  project:{good:string;amount:number;started:number}|null;market:number;recruitment:number;industrySupply:number;
  regional:{iron:boolean;fiber:boolean;teaching:Partial<Record<Subject,number>>};published:Partial<Record<Subject,number>>;
  ironBatches:number;fiberBatches:number;poweredTurn:number;equipmentUsed:Record<string,number>;
}
