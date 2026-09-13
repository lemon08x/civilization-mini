import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadCurrentContext} from '../dist/apps/cli/context.js';
import {createSession,observeSession,submitCommand} from '../dist/src/runtime/session.js';
import {replayRecord} from '../dist/src/runtime/replay.js';
const {base:ruleset,implementation}=await loadCurrentContext();
const id=`market-v10-${Date.now()}`,directory=`artifacts/experiments/${id}`;await mkdir(directory+'/runs',{recursive:true});
const policyFingerprint=createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');
await writeFile(directory+'/manifest.json',JSON.stringify({id,controller:'scripted',ruleset,implementation,seed:17,scenarios:['river','clay-valley'],maxSeasons:16,policyFingerprint,question:'同条件下外购设备与自行制造的行动、现金和产出差别'},null,2));
function policy({game:g},route,method){
 const e=g.economy,m=e.marketView,enabled=id=>g.actions.find(a=>a.id===id)?.enabled,a=(op,t)=>`economy:${op}:${t}`;
 if(g.clock.absoluteTurn>16||g.status==='complete'||g.status==='ended')return null;if(g.status==='handover')return 'handover';
 if(m.quote.lines.length){const line=m.quote.lines[0];if(m.quote.lines.length===1&&line.item.target==='food'&&line.quantity<Math.min(4,Math.floor(g.family.money/line.item.price),line.item.stock,m.transport)&&enabled(a('cartadd','good-food')))return a('cartadd','good-food');if(enabled(a('checkout','cart')))return a('checkout','cart');return a('clearcart','all');}
 const work=()=>enabled(a('work','local'))?a('work','local'):a('end','season');
 const purchase=sku=>{const item=m.catalog.find(i=>i.id===sku);if(!item||!enabled(a('cartadd',sku)))return null;if(g.family.money<item.price)return work();return a('cartadd',sku);};
 if(e.foodTotal<3){if(enabled(a('gather','food')))return a('gather','food');return purchase('good-food')??work();}
 const study=(subject,n)=>{const d=e.disciplines.find(d=>d.subject===subject);if(d.level>=n)return null;const t=d.topics.find(t=>t.level===d.level+1);for(const op of ['study','research'])if(enabled(a(op,t.id)))return a(op,t.id);for(const good of ['wood','clay','seedWheat'])if((e.goods[good]??0)<1){if(enabled(a('gather',good)))return a('gather',good);return purchase('good-'+good);}return work();};
 const device=route==='farm'?'S01':'F02';
 if(!(e.equipment[device]>0)){
  if(e.shop.orders.some(o=>o.target===device))return work();
  if(method==='buy')return purchase('device-'+device)??work();
  const p=e.products.find(p=>p.id===device);for(const [d,n]of Object.entries(p.requires)){const next=study(d,n);if(next)return next;}
  for(const [good,n]of Object.entries(p.inputs))if((e.goods[good]??0)<n)return enabled(a('gather',good))?a('gather',good):purchase('good-'+good)??work();
  if(enabled(a('build',device)))return a('build',device);
 }
 if(route==='farm'){
  const learn=study('agronomy',1);if(learn)return learn;
  if(enabled(a('farm','wheat')))return a('farm','wheat');
  if(e.foodTotal>8&&enabled(a('sell','wheat')))return a('sell','wheat');
 }else{
  const learn=study('materials',2);if(learn)return learn;
  if(e.project)return enabled(a('finish','project'))?a('finish','project'):a('end','season');
  if((e.goods.ceramics??0)>0&&enabled(a('sell','ceramics')))return a('sell','ceramics');
  for(const good of ['wood','clay'])if((e.goods[good]??0)<2)return enabled(a('gather',good))?a('gather',good):purchase('good-'+good)??work();
  if(enabled(a('process','ceramics')))return a('process','ceramics');
 }
 return work();
}
const results=[];
for(const route of ['farm','industry'])for(const method of ['make','buy']){
 const scenario=route==='farm'?'river':'clay-valley',runId=route+'-'+method;
 let session=await createSession({runId,ruleset,implementation,seed:17,scenarioId:scenario,agent:{kind:'scripted',name:'market-probe-'+method}});
 for(let i=0;i<180;i++){const actionId=policy(observeSession(session),route,method);if(!actionId)break;session=(await submitCommand(session,{commandId:'p'+i,expectedRevision:session.record.entries.length,actionId})).session;}
 await replayRecord(session.record,implementation);
 const o=observeSession(session).game,entries=session.record.entries,events=entries.flatMap(x=>x.events),device=route==='farm'?'S01':'F02';
 const acquired=entries.find(x=>x.events.some(e=>e.type==='economy-built'&&e.product===device||e.type==='shop'&&e.operation==='delivered'&&e.target===device));
 const row={runId,route,method,scenario,controller:'scripted',seed:17,rulesFingerprint:session.record.manifest.rulesFingerprint,implementation,commands:entries.length,settledSeasons:events.filter(e=>e.type==='season-settled').length,food:o.economy.foodTotal,money:o.family.money,missing:events.filter(e=>e.type==='season-settled').reduce((n,e)=>n+e.missing,0),purchases:events.filter(e=>e.type==='shop'&&e.operation==='purchased').reduce((n,e)=>n+e.money,0),deviceAcquiredRevision:acquired?.revision??null,harvest:events.filter(e=>e.type==='economy-farm'&&e.operation==='harvest').reduce((n,e)=>n+e.amount,0),batches:events.filter(e=>e.type==='economy-process'&&e.stage==='complete').length,deviceAcquiredSeason:acquired?entries.filter(x=>x.revision<acquired.revision).flatMap(x=>x.events).filter(e=>e.type==='season-settled').length+1:null,paidActions:events.filter(e=>e.type==='action-paid').reduce((n,e)=>n+e.cost.ap,0),knowledge:o.economy.disciplines.map(d=>[d.subject,Math.max(0,...Object.values(o.economy.knowledge).map(k=>k[d.subject]??0))]),strictReplay:true};
 results.push(row);await writeFile(directory+'/runs/'+runId+'.json',JSON.stringify(session.record));
}
await writeFile(directory+'/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify({directory,results},null,2));
