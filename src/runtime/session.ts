import {seasonAt} from '../game/systems/calendar.js';
import {FARM_DISCOVERIES} from '../game/model/economy.js';
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
export async function createSession(options: { runId: string; ruleset: Ruleset; seed: number; frameworkId: string }): Promise<Session> {
  validateRunId(options.runId);
  const ruleset = validateRuleset(options.ruleset);
  const state = createInitialState(ruleset, options.seed, options.frameworkId);
  const record: RunRecord = { format: 'civilization-mini-run', formatVersion: 3, manifest: { runId: options.runId, ruleset, seed: options.seed, frameworkId: options.frameworkId }, entries: [] };
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
  const limit = session.state.era ? (3 * session.state.era.rules.generationLimit * session.state.life!.rules.birthYears * 4 + 2 * session.state.life!.rules.lifespanMax * 4) * ((session.state.life!.calendar?94*2:session.state.life!.rules.timePerSeason) + 5) + 100 : 1500;
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
  const invalid=()=>{throw new Error('存档缺少有效人物经历、生平、师徒、道术或现代使命数据，请新开游戏；原存档不修改。');};
  if(typeof (record.manifest as Record<string,unknown>).frameworkId!=='string')invalid();
  if(isRecord(value.state.era)&&typeof (value.state.era as Record<string,unknown>).frameworkId!=='string')invalid();
  const finite=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
  if(!isRecord(sect)||!isRecord(persons)||!isRecord(sect.members)||!Array.isArray(sect.current)||sect.current.length!==2||new Set(sect.current).size!==2||!isRecord(sect.rules)||canonical(sect.rules)!==canonical(record.manifest.ruleset.sect))invalid();
  const q=sect as Record<string,any>,people=persons as Record<string,any>;
  const economy=value.state.economy;
  const farmInvalid=()=>{throw new Error('存档缺少有效地块或独立同门数据，请新开游戏；原存档不修改。');};
  if(!isRecord(economy)||!isRecord(economy.farm))farmInvalid();
  const farm=(economy as Record<string,any>).farm;
  const validField=(f:unknown)=>isRecord(f)&&[null,'wheat','soy','flax'].includes(f.crop as null|string)&&[null,'wheat','soy','flax'].includes(f.lastCrop as null|string)&&['planted','moisture','growth','stress','fertility','tended','bonus','duration'].every(k=>finite(f[k]))&&Number(f.fertility)<=3&&Number(f.duration)>=1&&typeof f.composted==='boolean'&&(f.variety===undefined||f.variety==='heritage'&&f.crop==='wheat');
  if(farm.explorationVersion!==3||!Number.isSafeInteger(farm.rareSeeds)||farm.rareSeeds<0)farmInvalid();
  if(!isRecord(farm.rules)||canonical(farm.rules)!==canonical(record.manifest.ruleset.farm)||!isRecord(farm.plots)||!Array.isArray(farm.discovered)||!farm.discovered.includes('wheat')||new Set(farm.discovered).size!==farm.discovered.length||farm.discovered.some((c:unknown)=>!['wheat','soy','flax'].includes(String(c)))||!Number.isSafeInteger(farm.explored)||farm.explored<0)farmInvalid();
  if(!validField((economy as Record<string,any>).field)||farm.plots.p2q2?.kind!=='field')farmInvalid();
  for(const [id,raw] of Object.entries(farm.plots)){
    if(!isRecord(raw)||raw.id!==id||!Number.isSafeInteger(raw.x)||!Number.isSafeInteger(raw.y)||Number(raw.x)<0||Number(raw.y)<0||id!==`p${raw.x}q${raw.y}`||!['unknown','wild','field','tree','rock','brush','story'].includes(String(raw.kind)))farmInvalid();
    const p=raw as Record<string,any>;
    if(p.kind==='field'&&id!=='p2q2'?!validField(p.field):p.field!==undefined)farmInvalid();
    if(p.fertility!==undefined&&(!Number.isInteger(p.fertility)||p.fertility<0||p.fertility>3))farmInvalid();
    if(p.discovery!==undefined&&(!isRecord(p.discovery)||!(FARM_DISCOVERIES as readonly unknown[]).includes(p.discovery.id)||typeof p.discovery.resolved!=='boolean'||typeof p.discovery.outcome!=='string'))farmInvalid();
    if(['tree','rock','brush','story'].includes(p.kind)&&!p.discovery)farmInvalid();
    if(p.kind==='story'&&(p.discovery.resolved||!['fallow','woodland','seedbag','heritage','canal','traveler','shrine'].includes(p.discovery.id)))farmInvalid();
    if(p.kind==='brush'&&(p.discovery.id!=='brambles'||p.discovery.resolved))farmInvalid();
    if(p.project!==undefined&&(!isRecord(p.project)||!['canal','restore','timber','clearwood','shelter'].includes(String(p.project.kind))||!finite(p.project.done)||!finite(p.project.total)||Number(p.project.total)<=0||Number(p.project.done)>Number(p.project.total)||!Number.isInteger(Number(p.project.done)*2)||!p.discovery||!({canal:['canal'],fallow:['restore'],woodland:['timber','clearwood','shelter']} as Record<string,string[]>)[p.discovery.id]?.includes(String(p.project.kind))))farmInvalid();
    if(p.improvement!==undefined&&(!['canal','shelter'].includes(p.improvement)||p.kind!=='rock'||p.project?.kind!==p.improvement||p.project.done!==p.project.total))farmInvalid();
    if(p.kind==='unknown'&&Object.keys(p).some(k=>!['id','x','y','kind'].includes(k)))farmInvalid();
  }
  const neighbor=farm.neighbor;
  if(!isRecord(neighbor)||neighbor.personId!==q.current[1]||!validField(neighbor.field)||!isRecord(neighbor.goods)||!Object.values(neighbor.goods).every(finite)||typeof neighbor.busy!=='boolean'||!['talked','traded','helped'].every(k=>Number.isSafeInteger(neighbor[k])&&Number(neighbor[k])>=-1))farmInvalid();
  if(!['doctrine','research','fortune','draws','seasonChance'].every(k=>finite(q[k]))||!Array.isArray(q.improvements)||!isRecord(q.cards)||!['study','craft','teach','prepare'].every(k=>Number.isInteger(q.cards[k])&&q.cards[k]>=0&&q.cards[k]<=q.rules.cardMax)||q.doctrine>q.rules.doctrineMax||q.research>=q.rules.doctrineSteps||q.fortune>q.rules.fortuneCap)invalid();
  const generations=new Map<number,number>();
  for(const [id,raw] of Object.entries(q.members)){
    if(!isRecord(raw)||!people[id]||!['generation','practice','rewardedStage','time'].every(k=>finite(raw[k]))||!Number.isInteger(raw.generation)||typeof raw.admitted!=='boolean'||!Array.isArray(raw.consulted))invalid();
    const m=raw as Record<string,any>;
    const experience=people[id]?.vitality?.experiences;
    if(!isRecord(experience)||!Number.isInteger(experience.learning)||Number(experience.learning)<0||Number(experience.learning)>12||!Number.isInteger(experience.outlook)||Math.abs(Number(experience.outlook))>record.manifest.ruleset.life!.eventPersonalityThreshold||typeof experience.lastEvent!=='string'||!Array.isArray(experience.talents)||!Array.isArray(experience.actions)||!Array.isArray(experience.contacts)||!isRecord(experience.relationships))invalid();
    const exp=experience as Record<string,any>;
    if(exp.talents.some((t:unknown)=>!['strong','scholar','mentor','organizer','resilient'].includes(String(t)))||new Set(exp.talents).size!==exp.talents.length||exp.actions.some((a:unknown)=>typeof a!=='string')||exp.contacts.some((other:unknown)=>typeof other!=='string'||!people[other]))invalid();
    for(const [other,trust] of Object.entries(exp.relationships))if(other===id||!people[other]||!Number.isInteger(trust)||Math.abs(Number(trust))>5||people[other]?.vitality?.experiences?.relationships?.[id]!==trust)invalid();
    const character=people[id]?.vitality?.character;
    if(!isRecord(character)||!['style','temperament','background','attachment','aspiration','occupation','mood'].every(k=>typeof character[k]==='string'&&character[k].length>0)||!Number.isInteger(character.vocation)||Number(character.vocation)<0||Number(character.vocation)>5||!Number.isInteger(character.originEra)||Number(character.originEra)<0||Number(character.originEra)>3||!Array.isArray(character.memories))invalid();
    const memories=(character as Record<string,any>).memories;
    if(memories.some((v:unknown)=>!isRecord(v)||typeof v.key!=='string'||!Number.isInteger(v.age)||Number(v.age)<0||typeof v.text!=='string')||new Set(memories.map((v:{key:string})=>v.key)).size!==memories.length)invalid();
    if(m.practice>q.rules.maxStage*q.rules.stageProgress||m.rewardedStage>q.rules.maxStage)invalid();
    for(const key of ['masterId','discipleId','candidateId'])if(m[key]!==null&&(typeof m[key]!=='string'||!q.members[m[key]]))invalid();
    if(m.masterId&&(q.members[m.masterId].generation!==m.generation-1||![q.members[m.masterId].discipleId,q.members[m.masterId].candidateId].includes(id)))invalid();
    if(m.discipleId&&(q.members[m.discipleId].masterId!==id||!q.members[m.discipleId].admitted))invalid();
    if(m.admitted)generations.set(m.generation,(generations.get(m.generation)??0)+1);
  }
  if([...generations.values()].some(n=>n>2)||q.current.some((id:unknown)=>typeof id!=='string'||!q.members[id]?.admitted))invalid();
  const household=value.state.household,clock=value.state.clock;
  if(!isRecord(household)||!isRecord(clock)||household.activePersonId!==q.current[0]||q.members[q.current[0]].generation!==clock.generation)invalid();
  if(isRecord(value.state.era)&&value.state.era.index===3){
    const c=value.state.era.crises;if(!isRecord(c)||!finite(c.remaining)||!isRecord(c.entries)||![null,true,false].includes(c.won as null|boolean))invalid();
    const entries=(c as Record<string,any>).entries;
    for(const spec of CRISES){const p=entries[spec.id];if(!isRecord(p)||!Number.isInteger(p.level)||(p.level as number)<0||(p.level as number)>3||!Number.isInteger(p.step)||(p.step as number)<0||(p.step as number)>2||!Number.isInteger(p.lastTurn)||!['','technical','coordination'].includes(p.route as string))invalid();}
  }
  if (value.state.life) {
    const life=value.state.life;
    const c=isRecord(life)?life.calendar:undefined;
    if(!isRecord(c)||c.continuousVersion!==1||!finite(c.nextBusinessDay)||Number(c.nextBusinessDay)<=Number(c.absoluteDay)&&value.state.status==='active')throw new Error('此存档使用旧季度结算，请新开连续日历游戏；原存档保留，不自动迁移。');
    const era=value.state.era;
    if(isRecord(era)&&(!isRecord(era.dayBudget)||!['started','limit','received'].every(k=>finite((era.dayBudget as Record<string,unknown>)[k]))||Number(era.dayBudget.started)>Number(c.absoluteDay)))throw new Error('存档缺少按天计算的阶段期限，请新开游戏；原存档保留。');
    if(!isRecord(c)||!isRecord(c.rules)||!finite(c.weatherNextDay)||!Number.isInteger(c.lastTermDay)||Number(c.lastTermDay)<-1||Number(c.lastTermDay)>Math.floor(Number(c.absoluteDay))||!Array.isArray(c.termEvents)||c.termEvents.length>6||c.termEvents.some((e:unknown)=>!isRecord(e)||!finite(e.day)||!['date','term','title','text','effect'].every(k=>typeof e[k]==='string')||typeof e.positive!=='boolean')||!isRecord(c.study)||!['simple','hearty'].includes(String(c.diet))||typeof c.systemsSettled!=='boolean'||typeof c.lastNotice!=='string'||!['absoluteDay','seasonLength','day','mealDays','consumed','missing','purchaseSpent'].every(k=>finite(c[k]))||Number(c.day)>Number(c.seasonLength)||!Number.isInteger(c.seasonStarted)||!Number.isInteger(c.seasonLength)||Number(c.seasonLength)<=0||Number(c.absoluteDay)!==Number(c.seasonStarted)+Number(c.day)||Number(c.absoluteDay)*2%1!==0||Object.entries(record.manifest.ruleset.calendar!).some(([k,v])=>(c.rules as Record<string,unknown>)[k]!==v)||Object.values(c.study).some(p=>!isRecord(p)||!finite(p.done)||!finite(p.total)||Number(p.done)>Number(p.total)))throw new Error('存档缺少有效农历日历或研习进度，请新开游戏；原存档不修改。');

    const span=seasonAt(record.manifest.ruleset.calendar!.referenceYear,Math.max(0,Number(c.absoluteDay)-(Number(c.day)===Number(c.seasonLength)?0.5:0)));
    if(span.start!==c.seasonStarted||span.days!==c.seasonLength)throw new Error('农历节气边界不匹配，请新开游戏；原档不修改。');
    if (!isRecord(value.state.persons) || Object.values(value.state.persons).some(person => {
      if (!isRecord(person) || !isRecord(person.vitality)) return true;
      const v=person.vitality;
      return (v.sex!=='male'&&v.sex!=='female') || typeof v.portrait!=='string' || !new RegExp(`^${v.sex}-0[12]$`).test(v.portrait)
        || typeof v.portraitEra!=='number' || !Number.isInteger(v.portraitEra) || v.portraitEra<0 || v.portraitEra>3;
    })) throw new Error('此存档缺少当前人物性别、肖像或时代数据，请新开游戏；原存档不修改。');
  }
  return deepFreeze({ state: value.state as unknown as Session['state'], record });
}
