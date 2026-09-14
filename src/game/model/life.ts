export interface LifeRules {
  timePerSeason: number;
  baseEnergy: number;
  recovery: number;
  restRecovery: number;
  careRecovery: number;
  hungerDamage: number;
  adultYears: number;
  birthYears: number;
  agingYears: number;
  lifespanMin: number;
  lifespanMax: number;
}
export const LIFE_BOUNDS: Record<keyof LifeRules, readonly [number, number]> = {
  timePerSeason:[8,20],baseEnergy:[6,16],recovery:[1,6],restRecovery:[2,8],careRecovery:[2,12],
  hungerDamage:[5,30],adultYears:[16,20],birthYears:[24,36],agingYears:[45,65],lifespanMin:[66,80],lifespanMax:[81,100],
};
export type Talent = 'strong' | 'scholar' | 'mentor' | 'organizer' | 'resilient';
export interface Vitality {
  ageSeasons: number;
  lifespanSeasons: number;
  constitution: number;
  energy: number;
  health: number;
  minimumEnergy?: number;
  talent: Talent;
  alive: boolean;
  childId: string | null;
}
