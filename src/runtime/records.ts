import type { GameState } from '../game/model/state.js';
import type { GameEvent } from '../game/model/events.js';
import type { Ruleset } from '../game/ruleset.js';

export interface ImplementationIdentity { version: string; codeFingerprint: string }
export interface Command {
  commandId: string;
  expectedRevision: number;
  actionId: string;
  reason?: string;
}
export interface RunManifest {
  runId: string;
  implementation: ImplementationIdentity;
  ruleset: Ruleset;
  rulesFingerprint: string;
  seed: number;
  scenarioId: string;
  agent: { kind: 'human' | 'scripted' | 'llm'; name: string; settings?: Record<string, string | number | boolean> };
}
export interface Entry {
  revision: number;
  command: Command;
  events: GameEvent[];
  stateHash: string;
  previousHash: string;
  hash: string;
}
export interface Snapshot { revision: number; state: GameState; hash: string }
export interface RunRecord {
  format: 'civilization-mini-run';
  formatVersion: 2;
  manifest: RunManifest;
  entries: Entry[];
  snapshots: Snapshot[];
}
export interface Session { state: GameState; record: RunRecord }
export function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  throw new Error('记录只能包含确定的 JSON 数据');
}
export async function fingerprint(value: unknown): Promise<string> {
  const data = new TextEncoder().encode(canonical(value));
  const hash = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
