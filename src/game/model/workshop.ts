export type WorkshopId = 'fiber' | 'rope';
export interface WorkshopRules { buffer: number; transport: number; }
export const WORKSHOP_BOUNDS = {buffer:[4,16],transport:[1,4]} as const;
export interface WorkshopUnit {
  active:boolean;
  units:number;
  logistics:number;
  source:'household'|'upstream';
  input:number;
  output:number;
}
export interface WorkshopShipment { target:WorkshopId|'household'; good:string; amount:number; due:number; }
export interface WorkshopState {
  nodes:Partial<Record<WorkshopId,WorkshopUnit>>;
  shipments:WorkshopShipment[];
}
