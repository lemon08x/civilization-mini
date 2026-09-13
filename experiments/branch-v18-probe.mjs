// Bounded observation-only scripted route acceptance. No model calls or state mutation.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateRuleset} from '../dist/src/game/ruleset.js';
import {createSession,observeSession,submitCommand} from '../dist/src/runtime/session.js';
import {replayRecord} from '../dist/src/runtime/replay.js';
const rules=validateRuleset(JSON.parse(await readFile('experiments/branch-paths.v18.json','utf8')));
const implementation=JSON.parse(await readFile('dist/implementation.json','utf8'));
const policyFingerprint=createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');
const directory=`artifacts/experiments/branches-v18-${Date.now()}`;await mkdir(directory,{recursive:true});
const results=[];
for(const route of (process.argv[2]?[process.argv[2]]:['farm','workshop','electric'])){
 let session=await createSession({runId:`branch-${route}`,ruleset:rules,implementation,seed:17,scenarioId:'river',agent:{kind:'scripted',id:'branch-route-probe',policyFingerprint}});
 const obs=()=>observeSession(session).game;
 const offer=id=>obs().actions.find(a=>a.id===`economy:${id}`);
 const can=id=>offer(id)?.enabled;
 const income=()=>can('sell:straw')?'sell:straw':'work:local';
 const doAct=async id=>{if(session.record.entries.length>=1100)throw Error('有限行动上限');if(obs().status!=='active')throw Error('经营已结束或需传承');session=(await submitCommand(session,{commandId:`p-${session.record.entries.length}`,expectedRevision:session.record.entries.length,actionId:`economy:${id}`,reason:'observation-only scripted route acceptance'})).session;};
 async function tend(){const f=obs().economy.field;if((!f.crop||f.growth>=f.duration)&&can('farm:wheat')){await doAct('farm:wheat');return true;}return false;}
 async function advance(){
  if(await tend())return;
  if(obs().family.money<6&&can(income())&&obs().economy.operations.food){await doAct(income());return;}
  if(!obs().economy.operations.food&&obs().economy.foodTotal<3&&can('gather:food')){await doAct('gather:food');return;}
  if(can('rest:self')&&obs().life.person.energy<4){await doAct('rest:self');return;}
  await doAct('end:season');
 }
 async function ready(id){
  for(let i=0;i<120;i++){
   if(id!=='farm:wheat'&&await tend())continue;
   if(obs().economy.operations.food&&obs().family.money<6&&!['work:local','sell:straw'].includes(id)){if(can(income()))await doAct(income());else await advance();continue;}
   if(!obs().economy.operations.food&&obs().economy.foodTotal<3&&can('gather:food')&&!id.startsWith('farm:')){await doAct('gather:food');continue;}
   if(can(id)&&obs().family.money>=offer(id).money+(obs().economy.operations.food&&offer(id).money?4:0)){await doAct(id);return;}
   const a=offer(id);if(!a)throw Error('不存在：'+id);
   if(obs().family.money<a.money+(obs().economy.operations.food&&a.money?4:0)){if(can(income()))await doAct(income());else await advance();continue;}
   if(!/时间|精力|本季|运输|库存|设备.*占用|岗位/.test(a.reason))throw Error(id+': '+a.reason);
   await advance();
  }throw Error('等待上限：'+id);
 }
 async function goods(needs){
  for(const [id,target]of Object.entries(needs))for(let tries=0;(obs().economy.goods[id]??0)<target;tries++){
   if(tries>150)throw Error('采购上限：'+id);
   if(['wood','clay'].includes(id)&&can('gather:'+id)){await ready('gather:'+id);continue;}
   if(obs().economy.marketView.orders.some(x=>x.target===id)){await advance();continue;}
   const item=obs().economy.marketView.catalog.find(x=>x.id==='good-'+id);if(!item)throw Error('未开渠道：'+id);
   if(obs().family.money<item.price+6){await ready(income());continue;}
   if(!can('cartadd:good-'+id)){await advance();continue;}
   await doAct('cartadd:good-'+id);await ready('checkout:cart');
  }
 }
 async function learn(id){const n=obs().economy.branchView.nodes.find(n=>n.id===id);if(n.known)return;for(const p of n.parents)await learn(p);await goods(n.sample);await ready('branchlearn:'+id);}
 async function build(id){const e=obs().economy;for(const n of e.branchView.products[id])await learn(n);await goods(e.products.find(p=>p.id===id).inputs);await ready('build:'+id);}
 async function process(id){const e=obs().economy,p=e.processes.find(p=>p.id===id);for(const n of e.branchView.processes[id])await learn(n);if(p.equipment&&!obs().economy.equipment[p.equipment])await build(p.equipment);await goods(p.inputs);await ready('process:'+id);}
 let error=null;
 try{
  await learn('O0');await ready('foodplan:on');
  const nodes=obs().economy.branchView.paths.find(p=>p.id===route).nodes;
  for(const id of nodes){if(['M5','L5'].includes(id)&&!obs().economy.branchView.channels.includes('electric')){await learn('M4');await ready('channel:electric');}await learn(id);}
  if(route==='farm'){
   await build('S01');await build('W03');await goods({wood:4});await ready('farm:wheat');
   for(let i=0;i<12;i++){if(obs().economy.field.crop&&obs().economy.field.growth>=obs().economy.field.duration)await ready('farm:wheat');else if(!obs().economy.field.crop)await ready('farm:wheat');await advance();}
  }else if(route==='workshop'){
   await process('shaft');await ready('sell:shaft');await ready('channel:metal');await learn('O2');
   await ready('hire:artisan');await ready('productionplan:shaft-sell');await ready('supplyplan:on');await ready('salesplan:on');await ready('careplan:on');
   for(let i=0;i<18;i++){if(can(income()))await ready(income());else await advance();}
  }else{
   await build('P03');await build('U06');await goods({wheat:4});await ready('process:mill');
   await process('wire');await process('coil');await process('wire');await process('coil');await build('E01');await ready('utility:E01-on');await goods({wheat:4});await ready('energize:now');await ready('process:mill');
  }
 }catch(e){error=e.message;}
 await writeFile(`${directory}/${route}.json`,JSON.stringify(session.record),{flag:'wx'});
 const replayed=await replayRecord(session.record,implementation),o=observeSession(replayed).game,events=replayed.record.entries.flatMap(e=>e.events);
 const result={route,error,season:o.clock.absoluteTurn,commands:session.record.entries.length,health:o.life.person.health,money:o.family.money,food:o.economy.foodTotal,known:o.economy.branchView.nodes.filter(n=>n.known).map(n=>n.id),pumps:events.filter(e=>e.type==='economy-farm'&&e.operation==='pump').length,harvests:events.filter(e=>e.type==='economy-farm'&&e.operation==='harvest').length,shaftSales:events.filter(e=>e.type==='economy-trade'&&e.good==='shaft').reduce((n,e)=>n+e.amount,0),workerBatches:events.filter(e=>e.type==='economy-process'&&e.actor!=='本人'&&e.stage==='complete').length,generated:events.filter(e=>e.type==='operations'&&e.operation==='modern'&&e.target==='E01').reduce((n,e)=>n+e.amount,0),electricLoads:events.filter(e=>e.type==='operations'&&e.target==='电动食品加工').length,missing:events.filter(e=>e.type==='season-settled').reduce((n,e)=>n+e.missing,0),strictReplay:true};
 results.push(result);console.log(JSON.stringify(result));
}
await writeFile(`${directory}/report.json`,JSON.stringify({question:'三条浅分支路线能否从正常开局到达真实农业、生产交付与本地用电？',method:'三个有限脚本基线；同一river场景、种子17，各路线独立开局；不是新旧版平衡对照',rulesVersion:rules.rulesVersion,implementation,policyFingerprint,results,scope:'只验证路线可达及真实资源结算，不证明长期盈亏、跨环境平衡或相对旧版优越性。'},null,2),{flag:'wx'});
console.log(directory);
