import { DEVICES } from './product-network.js';
import type { Device } from './product-network.js';
type BasicActionType = 'cultivate' | 'work' | 'buy-food' | 'buy-food-bulk' | 'sell-food' | 'build-channel' | 'repair-channel' | 'prepare-seed' | 'start-trial' | 'end-turn' | 'handover';
import type { Material, Recipe } from './production.js';
import type { Discipline, DevelopmentGood } from './development.js';
export type GameAction =
  | {type:'economy';operation:string;target:string}
  | {type:'fabricate'|'install-product';device:Device}
  | {type:'finish-product'|'calibrate'|'pump-water'|'recycle-ceramics'|'sell-calibration'}
  | { type:'develop'; recipe:string }
  | { type:'finish-development' | 'conduct-experiment' | 'procure-clay' }
  | { type:'refine' | 'mentor'; domain:Discipline }
  | { type:'procure' | 'deliver' | 'deliver-food'; good:Exclude<DevelopmentGood,'findings'> }
  | { type:'equip'; kind:'field'|'lab' }
  | { type: BasicActionType }
  | { type: 'gather'; resource: 'food' | 'wood' | 'clay' }
  | { type: 'craft'; recipe: Recipe }
  | { type: 'build-workshop' | 'craft-batch'; material: 'woodenware' | 'pottery' }
  | { type: 'entrust' | 'pause-contract' | 'buy-good'; material: 'woodenware' | 'pottery' }
  | { type: 'share'; nodeId: string }
  | { type: 'finish-craft' }
  | { type: 'sell-good' | 'install-storage'; material: 'woodenware' | 'pottery' }
  | { type: 'buy-method'; nodeId: string }
  | { type: 'study' | 'archive' | 'teach'; nodeId: string }
  | { type: 'practice'; nodeId: string; practiceId: string }
  | { type: 'release'; decision: 'keep' | 'adopt' };
export interface ActionCost { ap: number; money: number; food: number; materials?: Partial<Record<Material, number>> }
export interface ActionOffer extends ActionCost {
  id: string;
  action: GameAction;
  label: string;
  group: string;
  enabled: boolean;
  reason: string;
  description: string;
}
export function actionId(action: GameAction): string {
  if(action.type==='economy')return `economy:${action.operation}:${action.target}`;
  if(action.type==='fabricate'||action.type==='install-product')return `${action.type}:${action.device}`;
  if(action.type==='develop')return `develop:${action.recipe}`;
  if(action.type==='refine'||action.type==='mentor')return `${action.type}:${action.domain}`;
  if(action.type==='procure'||action.type==='deliver'||action.type==='deliver-food')return `${action.type}:${action.good}`;
  if(action.type==='equip')return `equip:${action.kind}`;
  if (action.type === 'entrust' || action.type === 'pause-contract' || action.type === 'buy-good') return `${action.type}:${action.material}`;
  if (action.type === 'share') return `share:${action.nodeId}`;
  if (action.type === 'gather') return `gather:${action.resource}`;
  if (action.type === 'craft') return `craft:${action.recipe}`;
  if (action.type === 'sell-good' || action.type === 'install-storage' || action.type === 'build-workshop' || action.type === 'craft-batch') return `${action.type}:${action.material}`;
  if (action.type === 'buy-method') return `buy-method:${action.nodeId}`;
  if (action.type === 'practice') return `practice:${action.nodeId}:${action.practiceId}`;
  if (action.type === 'study' || action.type === 'archive' || action.type === 'teach') return `${action.type}:${action.nodeId}`;
  if (action.type === 'release') return `release:${action.decision}`;
  return action.type;
}
export function parseActionId(id: string): GameAction {
  if (typeof id !== 'string' || id.length > 160) throw new Error('行动 ID 无效');
  const parts = id.split(':');
  const [type, nodeId, practiceId] = parts;
  if(type==='economy'&&parts.length===3&&['utility','energize','nutrient','reclaim','towerstart','towerpause','towerdelivery','workshopbuild','workshoppause','workshopexpand','workshoptransport','workshophousehold','workshopupstream','resumeplans','foodplan','farmplan','productionplan','supplyplan','salesplan','careplan','charter','projectstart','projectpause','mineplan','steamplan','cartadd','cartremove','checkout','clearcart','repair','tuition','paidtrain','study','research','archive','teach','publish','gather','work','buy','sell','sellfood','buyfood','farm','fertilize','build','process','finish','hire','assign','pause','train','end'].includes(nodeId)&&/^[a-zA-Z0-9-]+$/.test(practiceId))return {type,operation:nodeId,target:practiceId};
  if(parts.length===2&&(type==='fabricate'||type==='install-product')&&DEVICES.includes(nodeId as Device))return {type,device:nodeId as Device};
  if(parts.length===1&&['finish-product','calibrate','pump-water','recycle-ceramics','sell-calibration'].includes(type))return {type:type as 'finish-product'|'calibrate'|'pump-water'|'recycle-ceramics'|'sell-calibration'};
  if(parts.length===1&&['finish-development','conduct-experiment','procure-clay'].includes(type))return {type:type as 'finish-development'|'conduct-experiment'|'procure-clay'};
  if(parts.length===2&&type==='develop'&&['supplies','ceramicParts','mechanisms','fieldTools','labTools','precisionParts'].includes(nodeId))return {type,recipe:nodeId};
  if(parts.length===2&&(type==='refine'||type==='mentor')&&['pottery','woodwork','agriculture','science'].includes(nodeId))return {type,domain:nodeId as Discipline};
  if(parts.length===2&&(type==='procure'||type==='deliver'||type==='deliver-food')&&['supplies','ceramicParts','mechanisms','fieldTools','labTools','precisionParts'].includes(nodeId))return {type,good:nodeId as Exclude<DevelopmentGood,'findings'>};
  if(parts.length===2&&type==='equip'&&(nodeId==='field'||nodeId==='lab'))return {type,kind:nodeId};
  if ((type === 'entrust' || type === 'pause-contract' || type === 'buy-good') && parts.length === 2 && ['woodenware', 'pottery'].includes(nodeId)) return { type, material: nodeId as 'woodenware' | 'pottery' };
  if (type === 'share' && parts.length === 2 && nodeId) return { type, nodeId };
  if (type === 'finish-craft' && parts.length === 1) return { type };
  if (type === 'gather' && parts.length === 2 && ['food', 'wood', 'clay'].includes(nodeId)) return { type, resource: nodeId as 'food' | 'wood' | 'clay' };
  if (type === 'craft' && parts.length === 2 && ['woodenware', 'pottery', 'gather-tool'].includes(nodeId)) return { type, recipe: nodeId as Recipe };
  if ((type === 'build-workshop' || type === 'craft-batch') && parts.length === 2 && ['woodenware', 'pottery'].includes(nodeId)) return { type, material: nodeId as 'woodenware' | 'pottery' };
  if (['sell-good', 'install-storage'].includes(type) && parts.length === 2 && ['woodenware', 'pottery'].includes(nodeId)) return { type: type as 'sell-good' | 'install-storage', material: nodeId as 'woodenware' | 'pottery' };
  if (type === 'buy-method' && parts.length === 2 && nodeId) return { type, nodeId };
  if (['study', 'archive', 'teach'].includes(type) && parts.length === 2 && nodeId) return { type: type as 'study' | 'archive' | 'teach', nodeId };
  if (type === 'practice' && parts.length === 3 && nodeId && practiceId) return { type, nodeId, practiceId };
  if (type === 'release' && parts.length === 2 && (nodeId === 'keep' || nodeId === 'adopt')) return { type, decision: nodeId };
  if (parts.length === 1 && ['cultivate', 'work', 'buy-food', 'buy-food-bulk', 'sell-food', 'build-channel', 'repair-channel', 'prepare-seed', 'start-trial', 'end-turn', 'handover'].includes(type)) return { type: type as BasicActionType };
  throw new Error(`未知行动：${id}`);
}
