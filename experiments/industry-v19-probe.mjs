// Bounded observation-only scripted route acceptance. No model calls or state mutation.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateRuleset} from '../dist/src/game/ruleset.js';
import {createSession,observeSession,submitCommand} from '../dist/src/runtime/session.js';
import {replayRecord} from '../dist/src/runtime/replay.js';
const rules=validateRuleset(JSON.parse(await readFile('experiments/three-trees.v19.json','utf8')));
const implementation=JSON.parse(await readFile('dist/implementation.json','utf8'));
const policyFingerprint=createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');
const directory=`artifacts/experiments/industry-v19-${Date.now()}`;await mkdir(directory,{recursive:true});
const results=[];
for(const route of (process.argv[2]?[process.argv[2]]:['pump','shaft'])){
 let session=await createSession({runId:`branch-${route}`,ruleset:rules,implementation,seed:17,scenarioId:'river',agent:{kind:'scripted',id:'industry-route-probe',policyFingerprint}});
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
   if(a.energy>obs().life.person.energy&&can('rest:self')){await doAct('rest:self');continue;}
   if(!/时间|精力|本季|运输|库存|设备.*占用|岗位|公共水/.test(a.reason))throw Error(id+': '+a.reason);
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
 async function produce(id){const e=obs().economy,p=e.processes.find(p=>p.id===id);for(const n of e.branchView.processes[id])await learn(n);if(p.equipment&&!obs().economy.equipment[p.equipment])await build(p.equipment);await goods(p.inputs);await ready('process:'+id);}
 let error=null;
 try{
  await learn('O0');await ready('foodplan:on');
  if(route==='pump'){
   for(const id of ['A1','M2','L3'])await learn(id);
   await goods({seal:1});await ready('inspect:seal');await goods({valve:1});await ready('inspect:valve');
   await goods({wood:3});await build('W03');await goods({wood:4});
  }else{
   await learn('O1');await build('T03');await produce('shaft');await goods({wood:6,iron:4});
  }
  await ready('sysbuild:'+route);await ready('syscommission:'+route);
  const worker=route==='pump'?'laborer':'artisan';await ready('hire:'+worker);
  await ready('sysassign:'+route+'-'+worker);
  const endSeason=obs().clock.absoluteTurn+8;
  while(obs().clock.absoluteTurn<endSeason){
   if(route==='shaft'&&obs().economy.goods.shaft>2&&can('sell:shaft'))await ready('sell:shaft');
   else if(await tend())continue;
   else if(can(income()))await ready(income());else await advance();
  }
 }catch(e){error=e.message;}
 await writeFile(`${directory}/${route}.json`,JSON.stringify(session.record),{flag:'wx'});
 const replayed=await replayRecord(session.record,implementation),o=observeSession(replayed).game,events=replayed.record.entries.flatMap(e=>e.events);
 const work=events.filter(e=>e.type==='industry'&&e.operation==='worked');
 const result={route,error,season:o.clock.absoluteTurn,commands:session.record.entries.length,health:o.life.person.health,money:o.family.money,food:o.economy.foodTotal,systems:o.economy.industryView.systems.filter(d=>d.instance),worked:work.length,time:work.reduce((n,e)=>n+e.time,0),energy:work.reduce((n,e)=>n+e.energy,0),wages:work.reduce((n,e)=>n+e.money,0),waits:events.filter(e=>e.type==='industry'&&e.operation==='waiting').length,missing:events.filter(e=>e.type==='season-settled').reduce((n,e)=>n+e.missing,0),strictReplay:true};
 results.push(result);console.log(JSON.stringify(result));
}
await writeFile(`${directory}/report.json`,JSON.stringify({question:'供水与轴加工系统能否从正常开局完成产品验证、实际调试和有偿人力运行？',method:'有限脚本基线；river、种子17，两个独立正常开局，无大模型调用',rulesVersion:rules.rulesVersion,implementation,policyFingerprint,results,scope:'路线可达性与资源劳动账本检查；不是长期利润、无人化或新旧版平衡结论'},null,2),{flag:'wx'});
console.log(directory);
