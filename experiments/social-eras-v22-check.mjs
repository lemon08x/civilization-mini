// Scripted baseline, not model playtesting. Policy sees observeSession only.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createSession,observeSession,submitCommand} from '../dist/src/runtime/session.js';
import {resolveRuleset} from '../dist/src/game/ruleset.js';
const base=JSON.parse(await readFile('rulesets/social-eras.v22.json','utf8'));
const ruleset=resolveRuleset(base,{'eras.seasons':12,'eras.warning':2});
const implementation=JSON.parse(await readFile('dist/implementation.json','utf8'));
const output='artifacts/experiments/social-eras-v22-'+Date.now();await mkdir(output,{recursive:true});
function choose(o,delay){
 const g=o.game,e=g.economy,ready=id=>g.actions.find(a=>a.id==='economy:'+id&&a.enabled);
 if(g.socialFood.policy==='off')return ready('foodpolicy:self');
 const farm=ready('farm:wheat');if(farm)return farm;
 if(e.foodTotal<2){const work=ready('work:local');if(work)return work;const gather=ready('gather:food');if(gather)return gather;}
 if(g.era.elapsed>=delay){
  const well=e.industryView.systems.find(x=>x.id==='well');
  let next;
  for(const id of ['A1','A2'])if(!e.branchView.nodes.find(n=>n.id===id).known){next='branchlearn:'+id;break;}
  if(!next&&!well.instance)next=(e.goods.wood??0)<4?'gather:wood':'sysbuild:well';
  if(!next&&!well.instance?.commissioned)next='syscommission:well';
  if(!next&&well.instance?.operator!=='self')next='sysassign:well-self';
  if(next){const action=ready(next);if(action)return action;if(g.life.person.energy<6&&ready('rest:self'))return ready('rest:self');}
 }
 if(g.family.money<6&&ready('work:local'))return ready('work:local');
 if(g.life.person.energy<3&&ready('rest:self'))return ready('rest:self');
 return ready('end:season');
}
const rows=[];
for(const seed of [17,29])for(const delay of [0,6]){
 let session=await createSession({runId:'era-build-'+seed+'-'+delay,ruleset,implementation,seed,scenarioId:'dry',agent:{kind:'scripted',name:'same-farming-policy-varied-well-start'}});
 for(let step=0;step<120;step++){
  const o=observeSession(session);if(o.game.era.index>0||o.game.status!=='active')break;
  const action=choose(o,delay);if(!action)throw Error('No enabled action');
  session=(await submitCommand(session,{commandId:'step-'+step,expectedRevision:o.revision,actionId:action.id,reason:'固定脚本基线：耕作、必要谋生，在指定阶段时点开始建井'})).session;
 }
 const events=session.record.entries.flatMap(e=>e.events),g=observeSession(session).game;
 let season=0,built=null,worked=0,harvest=0;
 for(const e of events){if(e.type==='season-settled')season++;if(e.type==='industry'&&e.target==='well'&&e.operation==='built')built=season+1;if(e.type==='industry'&&e.target==='well'&&e.operation==='worked')worked++;if(e.type==='economy-farm'&&e.operation==='harvest')harvest+=e.amount;}
 rows.push({seed,delay,card:session.record.snapshots[0].state.era.card,builtSeason:built,wellTasks:worked,harvest,stageSettled:events.filter(e=>e.type==='era'&&e.operation==='settled').map(e=>({claims:e.amount/10,money:e.money})),missing:events.filter(e=>e.type==='season-settled').reduce((n,e)=>n+e.missing,0),health:g.life.person.health,commands:session.record.entries.length});
 await writeFile(output+'/'+session.record.manifest.runId+'.json',JSON.stringify(session.record,null,2));
}
await writeFile(output+'/report.json',JSON.stringify({implementation,scope:'dry; seeds 17/29; 12-season candidate window; identical observe-only policy except well construction starts at elapsed 0 vs 6',rows},null,2));console.log(JSON.stringify({output,rows},null,2));
