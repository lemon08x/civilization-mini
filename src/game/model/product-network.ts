import type { DevelopmentGood } from './development.js';
export const DEVICES = ['calibrator','pump','kiln'] as const;
export type Device = typeof DEVICES[number];
export type NetworkGood = Device | 'calibrations' | 'spentCeramics';
export type Product = DevelopmentGood | NetworkGood;
export interface ProductNetworkState {
  goods: Record<NetworkGood,number>;
  installed: Record<Device,number>;
  storedWater: number;
  lastPassiveTurn?: Partial<Record<Device,number>>;
  project: Device | null;
}
export const NETWORK_NAMES: Record<NetworkGood,string> = {calibrator:'校准仪',pump:'提水泵',kiln:'控温窑',calibrations:'校准报告',spentCeramics:'用后陶料'};
