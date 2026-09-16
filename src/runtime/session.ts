import { createInitialState, transition } from '../game/game.js';
import { getObservation } from '../game/observation.js';
import { parseActionId } from '../game/model/action.js';
import { deepFreeze, isRecord, validateRuleset } from '../game/ruleset.js';
import type { Ruleset } from '../game/ruleset.js';
import { canonical, fingerprint } from './records.js';
import type { Command, ImplementationIdentity, RunManifest, RunRecord, Session } from './records.js';

export function validateRunId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(value)) throw new Error('实验 ID 只能包含字母、数字、短横线、下划线，最多 80 字符');
}
export function validateCommand(value: unknown): Command {
  if (!isRecord(value) || Object.keys(value).some(key => !['commandId', 'expectedRevision', 'actionId', 'reason'].includes(key)) || typeof value.commandId !== 'string' || !/^[a-zA-Z0-9:_-]{1,120}$/.test(value.commandId) || !Number.isSafeInteger(value.expectedRevision) || (value.expectedRevision as number) < 0 || typeof value.actionId !== 'string' || !(value.reason === undefined || (typeof value.reason === 'string' && value.reason.length <= 2000))) throw new Error('行动命令格式无效');
  parseActionId(value.actionId);
  return { commandId: value.commandId, expectedRevision: value.expectedRevision as number, actionId: value.actionId, ...(value.reason !== undefined ? { reason: value.reason as string } : {}) };
}
export async function createSession(options: { runId: string; ruleset: Ruleset; implementation: ImplementationIdentity; seed: number; scenarioId: string; agent?: RunManifest['agent'] }): Promise<Session> {
  validateRunId(options.runId);
  if (!/^\d+\.\d+\.\d+$/.test(options.implementation.version) || !/^[a-f0-9]{64}$/.test(options.implementation.codeFingerprint)) throw new Error('缺少有效的规则实现指纹，请重新构建');
  const ruleset = validateRuleset(options.ruleset);
  const state = createInitialState(ruleset, options.seed, options.scenarioId);
  const manifest: RunManifest = { runId: options.runId, implementation: { ...options.implementation }, ruleset, rulesFingerprint: await fingerprint(ruleset), seed: options.seed, scenarioId: options.scenarioId, agent: structuredClone(options.agent ?? { kind: 'human', name: 'manual' }) };
  const record: RunRecord = { format: 'civilization-mini-run', formatVersion: 2, manifest, entries: [], snapshots: [{ revision: 0, state, hash: await fingerprint(state) }] };
  return deepFreeze({ state, record });
}

export async function submitCommand(session: Session, input: unknown): Promise<{ session: Session; duplicate: boolean; revision: number }> {
  const command = validateCommand(input);
  const previous = session.record.entries.find(entry => entry.command.commandId === command.commandId);
  if (previous) {
    if (canonical(previous.command) !== canonical(command)) throw new Error('同一命令 ID 被用于不同内容');
    return { session, duplicate: true, revision: previous.revision };
  }
  const revision = session.record.entries.length;
  if (command.expectedRevision !== revision) throw new Error(`过期命令：当前 revision=${revision}`);
  const limit=session.state.era?session.state.era.rules.seasons*4*(session.state.life!.rules.timePerSeason+5)+100:1500;
  if (revision >= limit) throw new Error(`实验已达到 ${limit} 条行动的运行上限`);
  const result = transition(session.state, parseActionId(command.actionId), session.record.manifest.ruleset);
  const stateHash = await fingerprint(result.state);
  const payload = { revision: revision + 1, command, events: result.events, stateHash, previousHash: session.record.entries.at(-1)?.hash ?? await fingerprint(session.record.manifest) };
  const entry = { ...payload, hash: await fingerprint(payload) };
  const snapshots = [...session.record.snapshots];
  if (entry.revision % 16 === 0 || result.state.status !== 'active') snapshots.push({ revision: entry.revision, state: result.state, hash: stateHash });
  const record: RunRecord = { ...session.record, entries: [...session.record.entries, entry], snapshots };
  return { session: deepFreeze({ state: result.state, record }), duplicate: false, revision: entry.revision };
}
export function observeSession(session: Session) {
  return { runId: session.record.manifest.runId, revision: session.record.entries.length, game: getObservation(session.state, session.record.manifest.ruleset), recentEvents: structuredClone(session.record.entries.slice(-3).flatMap(entry => entry.events)), ...(session.state.era?{eraSettlements:structuredClone(session.record.entries.flatMap(entry=>entry.events).filter(e=>e.type==='era').filter(e=>e.operation==='settled'))}:{}) };
}
export type SessionObservation = ReturnType<typeof observeSession>;
export type GameObservation = SessionObservation['game'];
