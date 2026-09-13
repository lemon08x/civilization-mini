import type { Subject } from './economy.js';

export interface ExpeditionSpec {
  id:string; name:string; purpose:string;
  requires:Partial<Record<Subject,number>>;
  kit:Record<string,number>; seasons:number; proof:string; eachSeason:boolean;
  power:number; services:string[]; clean:boolean;
  reward:{goods:Record<string,number>;money:number;books:string[];supplyLevel:number};
}
export interface ExpeditionAttempt {
  active:boolean; completed:boolean; progress:number;
  stock:Record<string,number>; shipments:{goods:Record<string,number>;due:number}[];
  evidence:string[]; seasonEvidence:string[]; evidenceTurn:number;
}
export interface ExpeditionState {
  selected:string|null; supplyLevel:number; attempts:Record<string,ExpeditionAttempt>;
  generationProofs?:string[];
}
