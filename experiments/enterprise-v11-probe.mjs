import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadCurrentContext} from '../dist/apps/cli/context.js';
import {createSession,observeSession,submitCommand} from '../dist/src/runtime/session.js';
import {replayRecord} from '../dist/src/runtime/replay.js';
const {base:ruleset,implementation}=await loadCurrentContext();
const id='enterprise-v11-'+Date.now(),directory='artifacts/experiments/'+id;await mkdir(directory+'/runs',{recursive:true});
const policyFingerprint=createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');
await writeFile(directory+'/manifest.json',JSON.stringify({id,ruleset,implementation,controller:'scripted',seed:17,scenario:'river',maxSeasons:24,policyFingerprint,question:'相同谋生和学习策略，长期供粮是否减少重复采购行动并释放学习时间'},null,2));
function choose({game:g},contract){
 const e=g.economy,o=e.operationsView,m=e.marketView,enabled=id=>g.actions.find(a=>a.id===id)?.enabled,a=(op,t)=>'economy:'+op+':'+t;
 if(g.clock.absoluteTurn>24||['complete','ended'].includes(g.status))return null;if(g.status==='handover')return 'handover';
 const work=()=>enabled(a('work','local'))?a('work','local'):a('end','season');
 if(m.quote.lines.length){const l=m.quote.lines[0];if(l.item.target==='food'&&l.quantity<Math.min(4,l.item.stock,m.transport,Math.floor(g.family.money/l.item.price))&&enabled(a('cartadd','good-food')))return a('cartadd','good-food');return enabled(a('checkout','cart'))?a('checkout','cart'):a('clearcart','all');}
 if(contract&&o.paused)return a('resumeplans','family');
 if(enabled(a('study','O01')))return a('study','O01');
 if(contract&&!o.food&&enabled(a('foodplan','on')))return a('foodplan','on');
 if(!contract&&e.foodTotal<3){if(g.family.money<4)return work();return enabled(a('cartadd','good-food'))?a('cartadd','good-food'):work();}
 if(g.family.money<8&&enabled(a('work','local')))return a('work','local');
 for(const subject of ['agronomy','mechanics','materials','heat']){
  const d=e.disciplines.find(d=>d.subject===subject);if(d.level>=6)continue;const t=d.topics.find(t=>t.level===d.level+1);
  if(enabled(a('study',t.id)))return a('study',t.id);if(enabled(a('research',t.id)))return a('research',t.id);
  const good=subject==='agronomy'?'seedWheat':(e.goods.wood??0)<1?'wood':'clay';
  if(['wood','clay'].includes(good)&&enabled(a('gather',good)))return a('gather',good);
  if(g.family.money>=(m.catalog.find(x=>x.id==='good-'+good)?.price??Infinity)+(contract?Math.max(0,g.parameters.foodPerTurn-e.foodTotal)*g.parameters.foodPrice:0)&&enabled(a('cartadd','good-'+good)))return a('cartadd','good-'+good);
  return work();
 }
 return a('end','season');
}
const results=[];
for(const contract of [false,true]){
 const runId=contract?'delegated-food':'manual-food';let session=await createSession({runId,ruleset,implementation,seed:17,scenarioId:'river',agent:{kind:'scripted',name:runId}});
 for(let i=0;i<250;i++){const actionId=choose(observeSession(session),contract);if(!actionId)break;session=(await submitCommand(session,{commandId:'e'+i,expectedRevision:session.record.entries.length,actionId})).session;}
 await replayRecord(session.record,implementation);const events=session.record.entries.flatMap(e=>e.events),o=observeSession(session).game;
 const row={runId,controller:'scripted',seed:17,scenario:'river',rulesFingerprint:session.record.manifest.rulesFingerprint,implementation,commands:session.record.entries.length,settled:events.filter(e=>e.type==='season-settled').length,food:o.economy.foodTotal,money:o.family.money,knowledge:o.victory.mastered.length,missing:events.filter(e=>e.type==='season-settled').reduce((n,e)=>n+e.missing,0),manualFoodOrders:session.record.entries.filter(e=>e.command.actionId==='economy:checkout:cart'&&e.events.some(x=>x.type==='shop'&&x.operation==='purchased'&&x.target==='food')).length,workActions:session.record.entries.filter(e=>e.command.actionId==='economy:work:local').length,studyActions:session.record.entries.filter(e=>e.command.actionId.startsWith('economy:study:')).length,deliveries:events.filter(e=>e.type==='operations'&&e.operation==='supplied').length,strictReplay:true};results.push(row);await writeFile(directory+'/runs/'+runId+'.json',JSON.stringify(session.record));
}
await writeFile(directory+'/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify({directory,results},null,2));
