import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadCurrentContext} from '../dist/apps/cli/context.js';
import {validateRuleset,resolveRuleset} from '../dist/src/game/ruleset.js';
import {createSession,observeSession,submitCommand} from '../dist/src/runtime/session.js';
import {replayRecord} from '../dist/src/runtime/replay.js';

const {implementation}=await loadCurrentContext();
const base=resolveRuleset(validateRuleset(JSON.parse(await readFile('experiments/workshop-network.v12.json','utf8'))),{initialMoney:30});
const directory='artifacts/experiments/workshop-v12-'+Date.now();await mkdir(directory+'/runs',{recursive:true});
const policyFingerprint=createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');
await writeFile(directory+'/manifest.json',JSON.stringify({initialCapitalNote:'控制场景初始30钱，仅隔离运输与现金启动约束，不代表默认8钱开局',question:'同一观察驱动脚本下，路线每季1份与2份是否形成可解释的启动延迟与吞吐差异',controller:'scripted',policyFingerprint,seeds:[17],scenario:'river',seasons:24,implementation,base},null,2));

// 决策只接收 observeSession；两组使用完全相同策略，无预知天气或状态写入。
function choose({game:g}){
 const e=g.economy,o=e.operationsView,net=e.workshopView;
 const a=(op,t)=>'economy:'+op+':'+t, enabled=id=>g.actions.some(x=>x.id===id&&x.enabled);
 if(g.clock.absoluteTurn>24||['complete','ended'].includes(g.status))return null;
 if(g.status==='handover')return 'handover';
 const work=()=>enabled(a('work','local'))?a('work','local'):(e.goods.wood??0)>4&&enabled(a('sell','wood'))?a('sell','wood'):enabled(a('gather','wood'))?a('gather','wood'):a('end','season');
 if(e.marketView.quote.lines.length)return enabled(a('checkout','cart'))?a('checkout','cart'):a('clearcart','all');
 if(o.paused)return a('resumeplans','family');
 if(enabled(a('study','O01')))return a('study','O01');
 if(!o.food&&enabled(a('foodplan','on')))return a('foodplan','on');
 // 基本粮款优先；可做工、采木交付，不等待无法靠单一岗位积累的高额现金。
 if(g.family.money<4)return work();
 if(!e.workers.laborer&&enabled(a('hire','laborer')))return a('hire','laborer');
 for(const id of ['O02','M01','M02'])if(enabled(a('study',id)))return a('study',id);
 if(e.disciplines.find(x=>x.subject==='materials').level<2){
  if(enabled(a('research','M02')))return a('research','M02');
  return enabled(a('gather','wood'))?a('gather','wood'):work();
 }
 for(const id of ['fiber','rope']){
  if(!net.nodes.find(x=>x.id===id).unit){
   if(enabled(a('workshopbuild',id)))return a('workshopbuild',id);
   if((e.goods.wood??0)<2&&enabled(a('gather','wood')))return a('gather','wood');
   return work();
  }
 }
 if(!o.supplies&&enabled(a('supplyplan','on')))return a('supplyplan','on');
 if(!o.sales&&enabled(a('salesplan','on')))return a('salesplan','on');
 return work();
}
const results=[];
for(const seed of [17])for(const transport of [1,2]){
 const ruleset=resolveRuleset(base,{'workshops.transport':transport}),runId=`seed-${seed}-transport-${transport}`;
 let session=await createSession({runId,ruleset,implementation,seed,scenarioId:'river',agent:{kind:'scripted',name:'workshop-baseline'}});
 const trace=[];
 for(let i=0;i<240;i++){
  const actionId=choose(observeSession(session));if(!actionId)break;
  session=(await submitCommand(session,{commandId:'w'+i,expectedRevision:session.record.entries.length,actionId})).session;
  const last=session.record.entries.at(-1);if(last.events.some(e=>e.type==='season-settled')){const g=observeSession(session).game;trace.push({season:g.clock.absoluteTurn,money:g.family.money,nodes:g.economy.workshopView.nodes,shipments:g.economy.workshopView.shipments,events:last.events.filter(e=>e.type==='operations'||e.type==='season-settled')});}
 }
 await replayRecord(session.record,implementation);
 const events=session.record.entries.flatMap(x=>x.events),g=observeSession(session).game;
 const row={runId,seed,transport,rulesFingerprint:session.record.manifest.rulesFingerprint,implementation,controller:'scripted',seasons:events.filter(e=>e.type==='season-settled').length,commands:session.record.entries.length,ropeProduced:events.filter(e=>e.type==='operations'&&e.operation==='workshop-worked'&&e.target==='rope').reduce((n,e)=>n+e.amount,0),workshopWages:events.filter(e=>e.type==='operations'&&e.operation==='workshop-worked').reduce((n,e)=>n+e.money,0),missing:events.filter(e=>e.type==='season-settled').reduce((n,e)=>n+e.missing,0),cash:g.family.money,strictReplay:true};
 results.push(row);await writeFile(directory+'/runs/'+runId+'.json',JSON.stringify(session.record));await writeFile(directory+'/'+runId+'-trace.json',JSON.stringify(trace,null,2));
}
await writeFile(directory+'/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify({directory,results},null,2));
