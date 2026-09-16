import type { GameState } from '../model/state.js';
import type { Worker } from '../model/economy.js';
import type { ProcessSpec } from './economy-catalog.js';
import { equipped } from './inventory.js';
import { organizationLevel } from './knowledge.js';

export function assemblyReady(s: GameState, worker?: Worker): boolean {
  return !!worker && !!s.economy!.modern && organizationLevel(s) >= 7 && equipped(s, 'T07') && s.economy!.equipmentUsed.T07 !== s.clock.absoluteTurn && s.economy!.modern.power >= 1;
}
export function processMultiplier(s: GameState, p: ProcessSpec, worker?: Worker): number {
  if (!p.wait && assemblyReady(s, worker)) return 2;
  if (worker && worker.experience >= 8) return 2;
  return ['fiber', 'rope'].includes(p.id) && equipped(s, 'P01') ? 2 : 1;
}
export function processInputs(s: GameState, p: ProcessSpec, worker?: Worker): Record<string, number> {
  const factor = processMultiplier(s, p, worker);
  return Object.fromEntries(Object.entries(p.inputs).map(([id, n]) => [id, n * factor]));
}
