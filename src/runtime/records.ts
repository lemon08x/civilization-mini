import type { GameState } from '../game/model/state.js';
import type { GameEvent } from '../game/model/events.js';
import type { Ruleset } from '../game/ruleset.js';

export interface Command {
  commandId: string;
  expectedRevision: number;
  actionId: string;
  reason?: string;
}
export interface RunManifest {
  runId: string;
  ruleset: Ruleset;
  seed: number;
  scenarioId: string;
}
export interface Entry {
  revision: number;
  command: Command;
  events: GameEvent[];
}
export interface RunRecord {
  format: 'civilization-mini-run';
  formatVersion: 3;
  manifest: RunManifest;
  entries: Entry[];
}
export interface Session { state: GameState; record: RunRecord }
export function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  throw new Error('记录只能包含确定的 JSON 数据');
}
