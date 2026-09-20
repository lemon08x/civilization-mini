import { createInitialState, transition } from '../game/game.js';
import { getObservation } from '../game/observation.js';
import { parseActionId } from '../game/model/action.js';
import { deepFreeze, isRecord, validateRuleset } from '../game/ruleset.js';
import type { Ruleset } from '../game/ruleset.js';
import { CRISES } from '../game/model/eras.js';
import { canonical } from './records.js';
import type { Command, RunRecord, Session } from './records.js';

export function validateRunId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(value)) throw new Error('实验 ID 只能包含字母、数字、短横线、下划线，最多 80 字符');
}
export function validateCommand(value: unknown): Command {
  if (!isRecord(value) || Object.keys(value).some(key => !['commandId', 'expectedRevision', 'actionId', 'reason'].includes(key)) || typeof value.commandId !== 'string' || !/^[a-zA-Z0-9:_-]{1,120}$/.test(value.commandId) || !Number.isSafeInteger(value.expectedRevision) || (value.expectedRevision as number) < 0 || typeof value.actionId !== 'string' || !(value.reason === undefined || (typeof value.reason === 'string' && value.reason.length <= 2000))) throw new Error('行动命令格式无效');
  parseActionId(value.actionId);
  return { commandId: value.commandId, expectedRevision: value.expectedRevision as number, actionId: value.actionId, ...(value.reason !== undefined ? { reason: value.reason as string } : {}) };
}
export async function createSession(options: { runId: string; ruleset: Ruleset; seed: number; scenarioId: string }): Promise<Session> {
  validateRunId(options.runId);
  const ruleset = validateRuleset(options.ruleset);
  const state = createInitialState(ruleset, options.seed, options.scenarioId);
  const record: RunRecord = { format: 'civilization-mini-run', formatVersion: 3, manifest: { runId: options.runId, ruleset, seed: options.seed, scenarioId: options.scenarioId }, entries: [] };
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
  // 行动上限按代际口径估算：前三个限代时代各 generationLimit 代（每代 birthYears×4 季），外加现代两代人的余量。
  const limit = session.state.era ? (3 * session.state.era.rules.generationLimit * session.state.life!.rules.birthYears * 4 + 2 * session.state.life!.rules.lifespanMax * 4) * (session.state.life!.rules.timePerSeason + 5) + 100 : 1500;
  if (revision >= limit) throw new Error(`实验已达到 ${limit} 条行动的运行上限`);
  const result = transition(session.state, parseActionId(command.actionId), session.record.manifest.ruleset);
  const entry = { revision: revision + 1, command, events: result.events };
  const record: RunRecord = { ...session.record, entries: [...session.record.entries, entry] };
  return { session: deepFreeze({ state: result.state, record }), duplicate: false, revision: entry.revision };
}
export function observeSession(session: Session) {
  return { runId: session.record.manifest.runId, revision: session.record.entries.length, game: getObservation(session.state, session.record.manifest.ruleset), recentEvents: structuredClone(session.record.entries.slice(-3).flatMap(entry => entry.events)), ...(session.state.era ? { eraSettlements: structuredClone(session.record.entries.flatMap(entry => entry.events).filter(e => e.type === 'era').filter(e => e.operation === 'settled')) } : {}) };
}
export type SessionObservation = ReturnType<typeof observeSession>;
export type GameObservation = SessionObservation['game'];

export function parseSession(value: unknown): Session {
  if (!isRecord(value) || !isRecord(value.record) || !isRecord(value.state)) throw new Error('存档格式无效，原文件应保留');
  const record = value.record as unknown as RunRecord;
  if (record.format !== 'civilization-mini-run' || record.formatVersion !== 3 || !isRecord(record.manifest) || !Array.isArray(record.entries)) throw new Error('存档格式无效，原文件应保留');
  validateRunId(record.manifest.runId);
  validateRuleset(record.manifest.ruleset);
  // Current save shape is deliberately not migrated: preserve incompatible files.
  const sect=value.state.sect,persons=value.state.persons;
  const invalid=()=>{throw new Error('存档缺少有效师徒、道术或现代使命数据，请新开游戏；原存档不修改。');};
  const finite=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
  if(!isRecord(sect)||!isRecord(persons)||!isRecord(sect.members)||!Array.isArray(sect.current)||sect.current.length!==2||new Set(sect.current).size!==2||!isRecord(sect.rules)||canonical(sect.rules)!==canonical(record.manifest.ruleset.sect))invalid();
  const q=sect as Record<string,any>,people=persons as Record<string,any>;
  if(!['doctrine','research','fortune','draws','seasonChance'].every(k=>finite(q[k]))||!Array.isArray(q.improvements)||!isRecord(q.cards)||!['study','craft','teach','prepare'].every(k=>Number.isInteger(q.cards[k])&&q.cards[k]>=0&&q.cards[k]<=q.rules.cardMax)||q.doctrine>q.rules.doctrineMax||q.research>=q.rules.doctrineSteps||q.fortune>q.rules.fortuneCap)invalid();
  const generations=new Map<number,number>();
  for(const [id,raw] of Object.entries(q.members)){
    if(!isRecord(raw)||!people[id]||!['generation','practice','rewardedStage','time'].every(k=>finite(raw[k]))||!Number.isInteger(raw.generation)||typeof raw.admitted!=='boolean'||!Array.isArray(raw.consulted))invalid();
    const m=raw as Record<string,any>;
    if(m.practice>q.rules.maxStage*q.rules.stageProgress||m.rewardedStage>q.rules.maxStage)invalid();
    for(const key of ['masterId','discipleId','candidateId'])if(m[key]!==null&&(typeof m[key]!=='string'||!q.members[m[key]]))invalid();
    if(m.masterId&&(q.members[m.masterId].generation!==m.generation-1||![q.members[m.masterId].discipleId,q.members[m.masterId].candidateId].includes(id)))invalid();
    if(m.discipleId&&(q.members[m.discipleId].masterId!==id||!q.members[m.discipleId].admitted))invalid();
    if(m.admitted)generations.set(m.generation,(generations.get(m.generation)??0)+1);
  }
  if([...generations.values()].some(n=>n>2)||q.current.some((id:unknown)=>typeof id!=='string'||!q.members[id]?.admitted))invalid();
  const household=value.state.household,clock=value.state.clock;
  if(!isRecord(household)||!isRecord(clock)||!q.current.includes(household.activePersonId)||q.current.some((id:string)=>q.members[id].generation!==clock.generation))invalid();
  if(isRecord(value.state.era)&&value.state.era.index===3){
    const c=value.state.era.crises;if(!isRecord(c)||!finite(c.remaining)||!isRecord(c.entries)||![null,true,false].includes(c.won as null|boolean))invalid();
    const entries=(c as Record<string,any>).entries;
    for(const spec of CRISES){const p=entries[spec.id];if(!isRecord(p)||!Number.isInteger(p.level)||(p.level as number)<0||(p.level as number)>3||!Number.isInteger(p.step)||(p.step as number)<0||(p.step as number)>2||!Number.isInteger(p.lastTurn)||!['','technical','coordination'].includes(p.route as string))invalid();}
  }
  if (value.state.life) {
    if (!isRecord(value.state.persons) || Object.values(value.state.persons).some(person => {
      if (!isRecord(person) || !isRecord(person.vitality)) return true;
      const v=person.vitality;
      return (v.sex!=='male'&&v.sex!=='female') || typeof v.portrait!=='string' || !new RegExp(`^${v.sex}-0[12]$`).test(v.portrait)
        || typeof v.portraitEra!=='number' || !Number.isInteger(v.portraitEra) || v.portraitEra<0 || v.portraitEra>3;
    })) throw new Error('此存档缺少当前人物性别、肖像或时代数据，请新开游戏；原存档不修改。');
  }
  return deepFreeze({ state: value.state as unknown as Session['state'], record });
}
