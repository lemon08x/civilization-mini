export const MATERIALS = ['wood', 'clay', 'woodenware', 'pottery'] as const;
export type Material = typeof MATERIALS[number];
export type Recipe = 'woodenware' | 'pottery' | 'gather-tool';
export const MATERIAL_NAMES: Record<Material, string> = { wood: '木材', clay: '黏土', woodenware: '木容器', pottery: '陶器' };
export const RECIPE_NAMES: Record<Recipe, string> = { woodenware: '木容器', pottery: '陶器', 'gather-tool': '采集工具' };
export const WORKSHOP_NAMES = { woodenware: '木工作台', pottery: '陶窑' } as const;
export interface ProductionParameters {
  gatherFood: number; gatherWood: number; gatherClay: number;
  baseStorage: number; woodenStorage: number; potteryStorage: number; spoilDivisor: number;
  toolDurability: number; toolBonus: number; woodRecipeCost: number; potteryClayCost: number; potteryFuelCost: number;
  woodenwarePrice: number; potteryPrice: number; methodPrice: number;
}
export interface ProductionRules { parameters: ProductionParameters; parameterBounds: Record<keyof ProductionParameters, [number, number]> }
export interface ProductionScenario {
  stocks: { wildFood: number; timber: number; clay: number };
  recovery: { wildFood: number; timber: number };
  market: { food: number; jobs: number; woodenware: number; pottery: number; methods: number };
  teachers: string[];
  imports: string[];
}
export interface ProductionState {
  workshops?: { woodenware: boolean; pottery: boolean };
  inventory: Record<Material, number>;
  stocks: ProductionScenario['stocks'];
  market: ProductionScenario['market'];
  toolDurability: number;
  storage: { woodenware: boolean; pottery: boolean };
  project: { recipe: Recipe; started: number; stage: 'shaped'; method: string; batch?: true } | null;
}
