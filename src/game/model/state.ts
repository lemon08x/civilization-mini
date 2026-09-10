export type Weather = 'dry' | 'normal' | 'wet';
export type GameStatus = 'active' | 'handover' | 'complete' | 'ended';
export interface Clock { generation: number; turn: number; absoluteTurn: number }
export interface Person {
  id: string;
  name: string;
  mastered: string[];
  learning: Record<string, number>;
  practices: string[];
  insights: string[];
}
export interface SeedStock { name: string; potential: number; tolerance: number }
export interface ChannelAsset { id: string; kind: 'channel'; durability: number }
export interface SeedAsset extends SeedStock { id: string; kind: 'seed' }
export type Asset = ChannelAsset | SeedAsset;
export interface TrialSample { season: number; weather: Weather; control: number; candidate: number; irrigation: string }
export interface TrialProject {
  id: string;
  kind: 'seed-trial';
  status: 'active' | 'complete';
  started: number;
  control: SeedStock;
  candidate: SeedStock;
  samples: TrialSample[];
}
export interface GameState {
  schemaVersion: 1;
  clock: Clock;
  status: GameStatus;
  ap: number;
  world: { era: string; technologies: string[] };
  location: {
    id: string;
    weather: Weather;
    rain: number;
    water: number;
    teachers: string[];
    season: { cultivated: boolean; usedChannel: boolean; trialSample: boolean };
  };
  household: {
    id: string;
    activePersonId: string;
    heirId: string;
    memberIds: string[];
    food: number;
    money: number;
    hardship: number;
    assetIds: string[];
    stockId: string;
    candidateId: string | null;
    activeProjectId: string | null;
  };
  persons: Record<string, Person>;
  assets: Record<string, Asset>;
  projects: Record<string, TrialProject>;
  knowledge: { archives: string[]; reportIds: string[] };
  randomState: number;
}

export function activePerson(state: GameState): Person { return state.persons[state.household.activePersonId]; }
export function heir(state: GameState): Person { return state.persons[state.household.heirId]; }
export function channel(state: GameState): ChannelAsset | null {
  return state.household.assetIds.map(id => state.assets[id]).find((asset): asset is ChannelAsset => asset.kind === 'channel') ?? null;
}
export function stock(state: GameState, id = state.household.stockId): SeedAsset {
  const asset = state.assets[id];
  if (!asset || asset.kind !== 'seed') throw new Error(`种源引用失效：${id}`);
  return asset;
}
export function project(state: GameState): TrialProject | null {
  return state.household.activeProjectId ? state.projects[state.household.activeProjectId] : null;
}
export function seedValue(value: SeedStock): SeedStock {
  return { name: value.name, potential: value.potential, tolerance: value.tolerance };
}
export function blankPerson(id: string, name: string): Person { return { id, name, mastered: [], learning: {}, practices: [], insights: [] }; }
export function addUnique(values: string[], value: string): void { if (!values.includes(value)) values.push(value); }
