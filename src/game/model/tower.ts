export interface TowerRules { capacity:number; transport:number; buildSeasons:number; finalSeasons:number; }
export const TOWER_BOUNDS={capacity:[16,32],transport:[1,4],buildSeasons:[2,4],finalSeasons:[2,4]} as const;
export interface TowerState {
  floor:number;
  active:boolean;
  delivery:boolean;
  stock:Record<string,number>;
  shipments:{good:string;amount:number;due:number}[];
  progress:number;
  evidenceTurn:number;
  evidence:string[];
}
