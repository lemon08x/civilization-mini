import type { IndustryState } from './industry.js';
import type { BranchState } from './branches.js';
import type { ExpeditionState } from './expedition.js';
import type { TowerState } from './tower.js';
import type { WorkshopState } from './workshop.js';
import type { OperationsState } from './operations.js';
import type { ShopState } from "./shop.js";
export const SUBJECTS = ['mechanics','heat','chemistry','materials','agronomy','organization'] as const;
export type Subject = typeof SUBJECTS[number];
export type Crop = 'wheat'|'soy'|'flax'|'rice'|'millet'|'adzuki'|'mallow'|'mustard';
export interface CookingRecipe {id:string;name:string;inputs:Record<string,number>;food:number;time:number;energy:number;}
export type WorkerKind = 'laborer'|'farmer'|'artisan'|'manager';
export type Work = 'polymer'|'wire'|'coil'|'cable'|'fuel'|'nutrient'|'battery'|'silicon'|'circuit'|'controller'|'composite'|'recycle'|'rest'|Crop|'ceramics'|'iron'|'fiber'|'brick'|'rope'|'oil'|'seal'|'shaft'|'valve'|'spring'|'solution'|'thresh'|'mill'|'compost';
export interface Worker {kind:WorkerKind;experience:number;job:Work;active:boolean;project:{good:string;amount:number;started:number}|null;}
export interface Field {failureReason?:string;batch?:{id:string;year:number;sownDay:number;matureDay:number;lateFactor:number};variety?:'heritage';crop:Crop|null;planted:number;moisture:number;growth:number;stress:number;fertility:number;lastCrop:Crop|null;tended:number;composted:boolean;bonus:number;duration:number;}
export interface FarmRules {landscapeBuildDays:number;landscapeUpgradeDays:number;landscapeTeaRelief:number;landscapeTeaReliefUpgraded:number;landscapePressurePercent:number;landscapePressurePercentUpgraded:number;landscapeTeachingPercent:number;landscapeTeachingPercentUpgraded:number;mushroomGatherTime:number;mushroomGatherEnergy:number;yamGatherTime:number;yamGatherEnergy:number;sowBestDays:number;sowLateDays:number;lateSowPercent:number;harvestBestDays:number;harvestLateDays:number;harvestToolDays:number;yardGraceDays:number;nurseryDays:number;mushroomRainDays:number;mushroomYield:number;mushroomLifeDays:number;mushroomMaxBursts:number;mushroomIntervalDays:number;yamYield:number;yamGather:number;drainDays:number;paddyDays:number;gateTime:number;gateEnergy:number;rainRiseDays:number;sandDryDays:number;loamDryDays:number;clayDryDays:number;shelterDays:number;surveyDays:number;reclaimDays:number;canalDays:number;restoreDays:number;woodlandDays:number;projectWood:number;timberYield:number;exploreTime:number;exploreEnergy:number;reclaimTime:number;reclaimEnergy:number;reclaimMoney:number;discoverySeeds:number;tradeQuantity:number;neighborStock:number;interactionTime:number;helpWater:number;clearTime:number;clearEnergy:number;identifyTime:number;storyFood:number;rareBonus:number;yardDays:number;cellarDays:number;pitDays:number;pitConvertDays:number;shedDays:number;rettingDays:number;}
export const FARM_BOUNDS:Record<keyof FarmRules,[number,number]>={landscapeBuildDays:[3,3],landscapeUpgradeDays:[5,5],landscapeTeaRelief:[7,7],landscapeTeaReliefUpgraded:[9,9],landscapePressurePercent:[20,20],landscapePressurePercentUpgraded:[30,30],landscapeTeachingPercent:[15,15],landscapeTeachingPercentUpgraded:[20,20],mushroomGatherTime:[0.5,0.5],mushroomGatherEnergy:[1,1],yamGatherTime:[1,1],yamGatherEnergy:[2,2],sowBestDays:[7,7],sowLateDays:[7,7],lateSowPercent:[5,5],harvestBestDays:[7,7],harvestLateDays:[14,14],harvestToolDays:[7,7],yardGraceDays:[7,7],nurseryDays:[7,7],mushroomRainDays:[3,3],mushroomYield:[2,2],mushroomLifeDays:[3,3],mushroomMaxBursts:[3,3],mushroomIntervalDays:[14,14],yamYield:[4,4],yamGather:[2,2],drainDays:[12,48],paddyDays:[12,48],gateTime:[1,4],gateEnergy:[1,3],rainRiseDays:[1,7],sandDryDays:[1,7],loamDryDays:[2,10],clayDryDays:[3,14],shelterDays:[1,4],surveyDays:[3,14],reclaimDays:[7,12],canalDays:[12,60],restoreDays:[20,40],woodlandDays:[30,60],projectWood:[1,6],timberYield:[1,12],exploreTime:[1,8],exploreEnergy:[1,6],reclaimTime:[1,8],reclaimEnergy:[1,6],reclaimMoney:[1,20],discoverySeeds:[1,6],tradeQuantity:[1,6],neighborStock:[2,20],interactionTime:[1,4],helpWater:[1,3],clearTime:[1,8],clearEnergy:[1,6],identifyTime:[1,6],storyFood:[1,4],rareBonus:[1,2],yardDays:[12,48],cellarDays:[12,48],pitDays:[8,32],pitConvertDays:[30,180],shedDays:[8,32],rettingDays:[12,48]};
export const FARM_DISCOVERIES=['fallow','woodland','meadow','oldtree','boulder','brambles','seedbag','heritage','spring','traveler','shrine','mushroom','yam'] as const;
export type FarmDiscovery=typeof FARM_DISCOVERIES[number];
export type FarmProjectKind = 'canal'|'restore'|'timber'|'clearwood'|'shelter'|'paddy'|'drain'|'yard'|'cellar'|'pit'|'shed'|'retting';
/** Optional production-land construction, unlocked by learned technology. */
export const FARM_PROJECT_TECH:Partial<Record<FarmProjectKind,string>>={canal:'A1',paddy:'A1',drain:'A8',yard:'A17',cellar:'A18',pit:'A7',shed:'M0',retting:'A19'};
export type SoilKind='sand'|'loam'|'clay';
/** A 20m × 20m plot. Physical units explain calibration only; settlement uses ordinal bands.
 * Root-zone reference: 0.3m. 1mm on 400m² = 0.4m³; no hidden continuous water model. */
export interface PlotLand {soil:SoilKind;elevation:0|1|2;water:0|1|2|3|4;dryDays:number;wetDays:number;drainDays:number;paddy?:boolean;}
export interface FarmPlan {failureReason?:string;id:string;batchId:string;year:number;sowDay:number;harvestDay:number;fertilizeDay?:number;sown:boolean;fertilized:boolean;harvested:boolean;failed:boolean;}
export interface WildResource {kind:'mushroom'|'yam';stock:number;year:number;bursts:number;wetDays:number;lastSpawn:number;expires:number;}
/** Cleared land has an explicit use; only sowing land grows crops. */
export type LandscapeKind='landmark'|'tea'|'reading'|'garden'|'memorial';
export interface LandscapeState {kind:LandscapeKind;level:1|2|3;builtBy:string;uses:number;}
export interface FarmPlot {landscape?:LandscapeState;purpose?:'sowing'|'other';plans?:FarmPlan[];wild?:WildResource;land?:PlotLand;project?:{kind:FarmProjectKind;done:number;total:number};improvement?:'canal'|'shelter'|'drain'|'yard'|'cellar'|'pit'|'shed'|'retting';pit?:{readyDay:number};id:string;x:number;y:number;kind:'unknown'|'wild'|'field'|'tree'|'rock'|'brush'|'story'|'water';field?:Field;discovery?:{id:FarmDiscovery;resolved:boolean;outcome:string};fertility?:number;}

export interface FarmState {calendarVersion:1;explorationVersion:3;landVersion:2;rareSeeds:number;rules:FarmRules;plots:Record<string,FarmPlot>;discovered:Crop[];explored:number;neighbor:{personId:string;goods:Record<string,number>;field:Field;talked:number;traded:number;helped:number;busy:boolean};}
export interface OngoingWork {farm:Crop|null;}
export interface EconomyState {
  farm?:FarmState;
  branches?:BranchState;
  industry?:IndustryState;
  /** Retired save field; ignored by actions, observations and settlement. */
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
