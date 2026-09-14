// Small scripted baseline, not a model playtest. Policy reads observeSession only.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createSession,observeSession,submitCommand} from '../dist/src/runtime/session.js';
const implementation=JSON.parse(await readFile('dist/implementation.json','utf8'));
const output='artifacts/experiments/recovery-v20-'+Date.now();await mkdir(output,{recursive:true});
const rows=[];
for(const path of ['three-trees.v19','recovery-inheritance.v20'])for(const seed of [17,29]){
 const ruleset=JSON.parse(await readFile('rulesets/'+path+'.json','utf8'));
 let session=await createSession({runId:path.replaceAll('.','-')+'-'+seed,ruleset,implementation,seed,scenarioId:'river',agent:{kind:'scripted',name:'small-farm-recovery-baseline'}});
 for(let step=0;step<120;step++){
  const o=observeSession(session),g=o.game;if(g.clock.absoluteTurn>12||g.status!=='active')break;
  const enabled=g.actions.filter(a=>a.enabled),find=id=>enabled.find(a=>a.id==='economy:'+id);
  const hungry=g.economy.foodTotal<4;
  const action=find('farm:wheat')||(hungry&&find('gather:food'))||
   (g.life.person.energy<4&&find('rest:self'))||
   (!hungry&&enabled.find(a=>a.id.startsWith('economy:branchlearn:')))||find('end:season');
  if(!action)break;
  session=(await submitCommand(session,{commandId:'baseline-'+step,expectedRevision:o.revision,actionId:action.id,reason:'固定短时农业脚本基线：田间、缺粮采集、低精力休息、有余粮学习、结季'})).session;
 }
 const g=observeSession(session).game,events=session.record.entries.flatMap(e=>e.events);
 rows.push({version:ruleset.rulesVersion,seed,turn:g.clock.absoluteTurn,health:g.life.person.health,food:g.economy.foodTotal,learned:g.economy.branchView.nodes.filter(n=>n.known).length,missing:events.filter(e=>e.type==='season-settled'&&e.missing>0).length,commands:session.record.entries.length});
 await writeFile(output+'/'+session.record.manifest.runId+'.json',JSON.stringify(session.record,null,2));
}
await writeFile(output+'/report.json',JSON.stringify({implementation,policy:'scripted baseline; same observe-only policy, river, seeds 17/29, 12 seasons',rows},null,2));
console.log(JSON.stringify({output,rows},null,2));
