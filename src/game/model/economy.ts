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
export type WorkerKind = 'laborer'|'farmer'|'artisan'|'manager';
export type Work = 'polymer'|'wire'|'coil'|'cable'|'fuel'|'nutrient'|'battery'|'silicon'|'circuit'|'controller'|'composite'|'recycle'|'rest'|Crop|'ceramics'|'iron'|'fiber'|'brick'|'rope'|'oil'|'seal'|'shaft'|'valve'|'spring'|'solution'|'thresh'|'mill'|'compost';
export interface Worker {kind:WorkerKind;experience:number;job:Work;active:boolean;project:{good:string;amount:number;started:number}|null;}
export interface Field {crop:Crop|null;planted:number;moisture:number;growth:number;stress:number;fertility:number;lastCrop:Crop|null;tended:number;composted:boolean;bonus:number;duration:number;}
export interface OngoingWork {farm:Crop|null;}
export interface EconomyState {
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
