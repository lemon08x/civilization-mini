import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadContext} from '../dist/apps/cli/context.js';
import {createSession,observeSession,submitCommand} from '../dist/src/runtime/session.js';
import {replayRecord} from '../dist/src/runtime/replay.js';
const {economyBase:ruleset,implementation}=await loadContext();
const output=`experiments/history/economy-${Date.now()}`;await mkdir(output,{recursive:true});
const policyFingerprint=createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');
function controller(route,hire){return ({game:g})=>{
  const e=g.economy,offer=id=>g.actions.find(a=>a.id===id),enabled=id=>offer(id)?.enabled;
  const a=(op,t)=>`economy:${op}:${t}`,qty=id=>e.goods[id]??0;
  const current=d=>e.disciplines.find(x=>x.subject===d).level;
  const sell=()=>['ceramics','fiber','iron','soy','wheat'].find(id=>qty(id)>(id==='wheat'?4:1)&&enabled(a('sellfood',id)));
  function support(id){const o=offer(id);if(!o)return null;if(o.enabled)return id;if(g.family.money<o.money)return enabled(a('work','local'))?a('work','local'):a('end','season');return null;}
  function study(d,n){if(current(d)>=n)return null;if(d==='organization'&&current(d)>=1&&!Object.keys(e.workers).length)return support(a('hire','laborer'));const next=e.disciplines.find(x=>x.subject===d).topics.find(t=>t.level===current(d)+1);
    if(enabled(a('study',next.id)))return a('study',next.id);
    if(enabled(a('research',next.id)))return a('research',next.id);
    for(const id of ['wood','clay'])if(qty(id)<1&&enabled(a('gather',id)))return a('gather',id);
    return support(a('research',next.id));
  }
  function build(id){if((e.equipment[id]??0)>0)return null;const p=e.products.find(p=>p.id===id);for(const[d,n]of Object.entries(p.requires)){const x=study(d,n);if(x)return x;}
    for(const [good,n]of Object.entries(p.inputs))if(qty(good)<n)return ['wood','clay'].includes(good)&&enabled(a('gather',good))?a('gather',good):support(a('buy',good));
    return support(a('build',id));
  }
  if(g.status==='handover')return 'handover';if(g.status!=='active'||g.clock.absoluteTurn>24)return null;
  if(e.foodTotal<3){const sale=sell();if(sale)return a('sellfood',sale);if(enabled(a('gather','food')))return a('gather','food');if(enabled(a('buyfood','bulk')))return a('buyfood','bulk');return support(a('work','local'))??a('end','season');}
  if(g.clock.turn>=13&&g.clock.generation===1&&hire&&(e.notes.organization??0)<3){const x=study('organization',3);if(x)return x;if(enabled(a('archive','organization')))return a('archive','organization');}
  const store=build('S01');if(store)return store;
  if(route==='farm'){
    if(hire){const x=study('organization',2);if(x)return x;if(!e.workers.farmer)return support(a('hire','farmer'))??a('end','season');if(!e.workers.farmer.active)return support(a('assign','farmer-wheat'))??a('end','season');}
    else{const x=study('agronomy',1);if(x)return x;if(enabled(a('farm','wheat')))return a('farm','wheat');}
    const sale=sell();if(sale&&e.foodTotal>5)return a('sellfood',sale);
    if(g.family.money<8&&enabled(a('work','local')))return a('work','local');
    return study('heat',2)??a('end','season');
  }
  const kiln=build('F02');if(kiln)return kiln;
  if(hire){const x=study('organization',2);if(x)return x;if(!e.workers.artisan)return support(a('hire','artisan'))??a('end','season');if(!e.workers.artisan.active)return support(a('assign','artisan-ceramics'))??a('end','season');}
  else{const x=study('materials',2);if(x)return x;if(e.project)return enabled(a('finish','project'))?a('finish','project'):a('end','season');}
  const sale=sell();if(sale)return a('sellfood',sale);
  for(const id of ['wood','clay'])if(qty(id)<4)return enabled(a('gather',id))?a('gather',id):support(a('buy',id))??a('end','season');
  if(hire){if(g.family.money<6&&enabled(a('work','local')))return a('work','local');return a('end','season');}
  return support(a('process','ceramics'))??a('end','season');
};}
const summaries=[];
for(const route of ['farm','industry'])for(const hire of [false,true]){
  const scenarioId=route==='farm'?'river':'clay-valley';
  let s=await createSession({runId:`economy-${route}-${hire?'hired':'self'}`,ruleset,implementation,seed:17,scenarioId,agent:{kind:'scripted',name:`${route}-${hire?'hired':'self'}`,settings:{policyFingerprint}}});const choose=controller(route,hire);
  for(let i=0;i<140;i++){const o=observeSession(s),actionId=choose(o);if(!actionId)break;s=(await submitCommand(s,{commandId:'step:'+i,expectedRevision:o.revision,actionId})).session;}
  await replayRecord(s.record,implementation);await writeFile(`${output}/${route}-${hire?'hired':'self'}.json`,JSON.stringify(s.record,null,2)+'\n',{flag:'wx'});
  const es=s.record.entries.flatMap(x=>x.events),o=observeSession(s).game;
  summaries.push({route,hire,seed:17,scenarioId,season:o.clock.absoluteTurn,status:o.status,commands:s.record.entries.length,food:o.economy.foodTotal,money:o.family.money,
    harvest:es.filter(e=>e.type==='economy-farm'&&e.operation==='harvest').reduce((n,e)=>n+e.amount,0),
    industrialBatches:es.filter(e=>e.type==='economy-process'&&e.stage==='complete').length,
    wages:es.filter(e=>e.type==='economy-worker'&&['worked','share'].includes(e.operation)).reduce((n,e)=>n+e.money,0),
    workEvents:es.filter(e=>e.type==='economy-worker'&&e.operation==='worked').length,
    waiting:es.filter(e=>e.type==='economy-worker'&&e.operation==='waiting').reduce((map,e)=>(map[e.detail]=(map[e.detail]??0)+1,map),{}),
    missing:es.filter(e=>e.type==='season-settled').reduce((n,e)=>n+e.missing,0),disciplines:o.economy.disciplines.map(d=>({subject:d.subject,level:d.level,notes:d.notes})),manifest:s.record.manifest,replay:'passed'});
}
await writeFile(`${output}/results.json`,JSON.stringify({kind:'scripted-baseline',hypothesis:'experiments/economy-v9-hypothesis.md',policyFingerprint,summaries},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,summaries:summaries.map(({manifest,disciplines,...s})=>s)},null,2));
