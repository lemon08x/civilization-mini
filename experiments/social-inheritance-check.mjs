// 有界脚本基线；只读取公开观察，通过同一行动接口执行。
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadContext } from '../dist/apps/cli/context.js';
import { createSession, observeSession, submitCommand } from '../dist/src/runtime/session.js';
import { replayRecord } from '../dist/src/runtime/replay.js';
import { metrics } from '../dist/src/research/metrics.js';
const { base, implementation } = await loadContext();
const directory = new URL(`../artifacts/experiments/social-inheritance-${Date.now()}/`, import.meta.url);
await mkdir(directory, { recursive: false });
const policyFingerprint = createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');
const plan = { question: '前代木作成果能否在未学木作的农业后代生活中继续发挥作用？', controller: 'scripted', seed: 17, scenario: 'woodland', ruleset: base, implementation, policyFingerprint, maxActions: 80, variants: ['unmanaged', 'entrusted'], note: '同一准备与农业脚本，仅委托分支不同；不委托分支将该行动用于做工，包含机会成本。' };
await writeFile(new URL('plan.json', directory), JSON.stringify(plan,null,2), {flag:'wx'});
function decide(observation, delegated) {
 const o=observation.game,p=o.production,s=o.society;
 const legal=id=>o.actions.some(a=>a.id===id&&a.enabled);
 const first=ids=>ids.find(legal)??null;
 const has=id=>o.person.mastered.includes(id);
 if(legal('handover'))return 'handover';
 if(o.status!=='active')return null;
 if(o.family.food<o.parameters.foodPerTurn) return first([...(o.clock.generation>1&&o.harvest.food>=2?['cultivate']:[]),'gather:food','buy-food','work','end-turn']);
 if(o.clock.generation===1){
  if(!has('woodworking'))return first(['study:woodworking','finish-craft','craft:woodenware','gather:wood','end-turn']);
  if(!p.workshops.woodenware){if(p.inventory.wood<4)return first(['gather:wood','end-turn']);return first(['build-workshop:woodenware','gather:food','end-turn']);}
  if(!o.family.archives.includes('woodworking'))return 'archive:woodworking';
  if(!s.methods.includes('woodworking'))return first(['share:woodworking','gather:wood','end-turn']);
  if(delegated&&!s.contracts.woodenware.active)return 'entrust:woodenware';
 }else{
  if(!has('observation')&&legal('study:observation'))return 'study:observation';
  if(legal('cultivate'))return 'cultivate';
  if(!p.storage.woodenware)return first(['study:storage','install-storage:woodenware','buy-good:woodenware','work','end-turn']);
  const agriculture=first(['study:survey','practice:survey:survey','study:ditch','practice:ditch:layout','build-channel']);
  if(agriculture)return agriculture;
 }
 return first(['work','end-turn']);
}
const rows=[];
for(const variant of plan.variants){
 let session=await createSession({runId:`social-${variant}`,ruleset:base,implementation,seed:plan.seed,scenarioId:plan.scenario,agent:{kind:'scripted',name:'cross-career-v1'}});
 for(let step=0;step<plan.maxActions;step++){
  const actionId=decide(observeSession(session),variant==='entrusted');if(!actionId)break;
  session=(await submitCommand(session,{commandId:`check:${step}`,expectedRevision:step,actionId})).session;
 }
 await replayRecord(session.record,implementation);
 await writeFile(new URL(`${variant}.json`,directory),JSON.stringify(session.record),{flag:'wx'});
 const events=session.record.entries.flatMap(e=>e.events),handover=session.record.entries.findIndex(e=>e.events.some(x=>x.type==='handed-over'));
 const second=handover>=0?session.record.entries.slice(handover).flatMap(e=>e.events):[];
 rows.push({variant,rulesFingerprint:session.record.manifest.rulesFingerprint,status:session.state.status,food:session.state.household.food,money:session.state.household.money,foodShortfall:metrics(session.record,session.state).foodShortfall,
  secondGenerationSkills:observeSession(session).game.person.mastered,
  wages:events.filter(e=>e.type==='contract-started').reduce((n,e)=>n+e.wage,0),earnings:events.filter(e=>e.type==='contract-sold').reduce((n,e)=>n+e.earnings,0),
  secondGenerationEarnings:second.filter(e=>e.type==='contract-sold').reduce((n,e)=>n+e.earnings,0),
  timberUsed:events.filter(e=>e.type==='contract-started').reduce((n,e)=>n+e.wood,0),
  publicUse:events.filter(e=>e.type==='public-used').reduce((n,e)=>n+e.amount,0),society:session.state.society,
 });
}
await writeFile(new URL('results.json',directory),JSON.stringify(rows,null,2),{flag:'wx'});
console.log(JSON.stringify({directory:directory.pathname,implementation,policyFingerprint,rows},null,2));
