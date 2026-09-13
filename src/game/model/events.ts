import type { Device, Product } from './product-network.js';
import type { ActionCost, GameAction } from './action.js';
import type { Clock, TrialSample, Weather } from './state.js';
import type { ProductionState, Recipe } from './production.js';
import type { Discipline,DevelopmentGood } from './development.js';

export interface GenerationFacts {
  generation: number;
  food: number;
  money: number;
  mastered: string[];
  heir: string[];
  archives: string[];
  project: { started: number; control: { name: string; potential: number; tolerance: number }; candidate: { name: string; potential: number; tolerance: number }; samples: TrialSample[] } | null;
  production?: ProductionState;
}
export type GameEvent =
  | {type:'tower';operation:string;floor:number;detail:string;goods:Record<string,number>}
  | {type:'operations';operation:string;target:string;detail:string;amount:number;money:number}
  | {type:'shop';operation:string;target:string;detail:string;money:number;amount:number}
  | {type:'economy-goods';source:string;changes:Record<string,number>}
  | {type:'economy-equipment-used';product:string;remaining:number}
  | {type:'economy-evidence';topic:string;source:string}
  | {type:'economy-learned';subject:string;level:number;personId:string;source:string}
  | {type:'economy-knowledge';operation:'archive'|'publish';subject:string;level:number}
  | {type:'economy-built';product:string;durability:number}
  | {type:'economy-process';recipe:string;actor:string;stage:'start'|'complete';factor:number}
  | {type:'economy-farm';operation:'sow'|'harvest'|'tend'|'pump';crop:string;actor:string;amount:number}
  | {type:'economy-crop-growth';crop:string;growth:number;stress:number}
  | {type:'economy-worker';worker:string;operation:'hire'|'assign'|'pause'|'train'|'waiting'|'worked'|'share';money:number;detail:string}
  | {type:'economy-trade';good:string;operation:'buy'|'sell';amount:number;money:number}
  | {type:'economy-region';industry:string}
  | {type:'technology-victory';mastered:number;total:number;required:number}
  | {type:'calibration-sold';money:number}
  | {type:'product-started';device:Device;inputs:Partial<Record<Product,number>>}
  | {type:'product-completed';device:Device}
  | {type:'product-installed';device:Device;durability:number}
  | {type:'product-operated';device:Device;remaining:number;result:number}
  | {type:'ceramic-residue';amount:number}
  | {type:'stored-water-used';amount:number}
  | { type:'experience-gained';personId:string;domain:Discipline;amount:number;total:number }
  | { type:'development-started';recipe:string;inputs:Partial<Record<DevelopmentGood,number>> }
  | { type:'development-completed';recipe:string;good:DevelopmentGood;amount:number }
  | { type:'experiment-conducted';amount:number;equipped:boolean }
  | { type:'design-refined';domain:Discipline;rank:number }
  | { type:'development-traded';good:DevelopmentGood;operation:'buy'|'sell';amount:number;money:number }
  | { type:'industrial-clay-bought';amount:number }
  | { type:'development-equipped';kind:'field'|'lab';durability:number }
  | { type:'field-equipment-used';remaining:number }
  | { type: 'social-taught'; nodeId: string; completed: boolean }
  | { type: 'contract-changed'; material: 'woodenware' | 'pottery'; active: boolean }
  | { type: 'contract-started'; material: 'woodenware' | 'pottery'; wage: number; wood: number; clay: number }
  | { type: 'contract-sold'; material: 'woodenware' | 'pottery'; amount: number; earnings: number }
  | { type: 'contract-waiting'; material: 'woodenware' | 'pottery'; reason: string }
  | { type: 'public-used'; material: 'woodenware' | 'pottery'; amount: number }
  | { type: 'public-purchased'; material: 'woodenware' | 'pottery'; price: number }
  | { type: 'resource-gathered'; resource: 'food' | 'wood' | 'clay'; amount: number; remaining: number; toolUsed: boolean }
  | { type: 'local-supply'; stocks: ProductionState['stocks']; market: ProductionState['market'] }
  | { type: 'workshop-built'; material: 'woodenware' | 'pottery' }
  | { type: 'craft-started'; recipe: Recipe; started: number; batch?: true }
  | { type: 'craft-completed'; recipe: Recipe; amount: number; batch?: true }
  | { type: 'storage-installed'; material: 'woodenware' | 'pottery'; capacity: number }
  | { type: 'food-spoiled'; amount: number; protected: number }
  | { type: 'goods-sold'; material: 'woodenware' | 'pottery'; amount: number; earnings: number }
  | { type: 'method-acquired'; nodeId: string }
  | { type: 'action-paid'; action: GameAction; cost: ActionCost }
  | { type: 'harvest'; food: number; drawn: number; deficit: number; channelExhausted: boolean }
  | { type: 'income'; source: 'work' | 'sale'; amount: number }
  | { type: 'food-purchased'; amount: number; money?: number }
  | { type: 'channel-changed'; operation: 'build' | 'repair'; assetId: string; durability: number }
  | { type: 'studied'; personId: string; nodeId: string }
  | { type: 'practiced'; personId: string; nodeId: string; practiceId: string }
  | { type: 'mastered'; personId: string; role: 'active' | 'heir'; nodeId: string; clock: Clock }
  | { type: 'archived'; nodeId: string }
  | { type: 'taught'; personId: string; nodeId: string; kind: 'study' | 'practice' }
  | { type: 'candidate-prepared'; assetId: string }
  | { type: 'trial-started'; projectId: string }
  | { type: 'trial-sampled'; projectId: string; sample: TrialSample; count: number; target: number }
  | { type: 'trial-completed'; projectId: string }
  | { type: 'stock-selected'; decision: 'keep' | 'adopt'; assetId: string }
  | { type: 'season-settled'; consumed: number; missing: number; hardship: number }
  | { type: 'season-started'; clock: Clock; weather: Weather }
  | { type: 'generation-ended'; facts: GenerationFacts; final: boolean }
  | { type: 'handed-over'; generation: number; fromPersonId: string; personId: string; mastered: string[]; learning: Record<string, number> }
  | { type: 'experiment-ended'; reason: 'hardship' };
