import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateRuleset} from '../dist/src/game/ruleset.js';
import {createSession,observeSession,submitCommand} from '../dist/src/runtime/session.js';
import {replayRecord} from '../dist/src/runtime/replay.js';
const rules=validateRuleset(JSON.parse(await readFile('experiments/agriculture-civilization.v15.json','utf8')));
const implementation=JSON.parse(await readFile('dist/implementation.json','utf8'));
const policyFingerprint=createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');
const output=`artifacts/experiments/agriculture-v15-${Date.now()}`;
await mkdir(output,{recursive:true});
const results=[];
// 同一观察驱动策略与观察窗口，只干预是否装运副本投入。不读种子、私有状态或未来天气。
function choose(o,deliver){
 const g=o.game,e=g.economy,a=e.expeditionView.attempts.harvest,enabled=id=>g.actions.find(x=>x.id==='economy:'+id)?.enabled;
 if(!a)return 'expeditionstart:harvest';
 if(deliver&&a.evidence.includes('harvest')&&enabled('expeditionship:current'))return 'expeditionship:current';
 if(!a.evidence.includes('harvest')&&enabled('farm:wheat'))return 'farm:wheat';
 if(e.foodTotal<5&&enabled('gather:food'))return 'gather:food';
 return 'end:season';
}
for(const deliver of [false,true]){
 let session=await createSession({runId:'agriculture-'+deliver,ruleset:rules,implementation,seed:17,scenarioId:'river',agent:{kind:'scripted',id:'agriculture-proof',policyFingerprint}});
 for(let i=0;i<35;i++){
   const o=observeSession(session);
   if(o.game.clock.absoluteTurn>=6||o.game.status!=='active')break;
   const actionId='economy:'+choose(o,deliver);
   session=(await submitCommand(session,{actionId,commandId:'a'+o.revision,expectedRevision:o.revision})).session;
 }
 const replayed=await replayRecord(session.record,implementation);
 const o=observeSession(replayed),events=session.record.entries.flatMap(e=>e.events);
 const result={deliver,season:o.game.clock.absoluteTurn,food:o.game.economy.foodTotal,cash:o.game.family.money,status:o.game.status,supplyLevel:o.game.economy.expeditionView.supplyLevel,completed:o.game.economy.expeditionView.attempts.harvest.completed,goods:o.game.economy.goods,books:o.game.economy.shop.books,shortfall:events.filter(e=>e.type==='season-settled').reduce((n,e)=>n+e.missing,0),shipments:events.filter(e=>e.type==='expedition'&&e.operation==='sent'),rewards:events.filter(e=>e.type==='expedition'&&e.operation==='reward'),strictReplay:true};
 await writeFile(output+`/${deliver?'invested':'baseline'}.json`,JSON.stringify(session.record,null,2)+'\n',{flag:'wx'});
 results.push(result);
}
if(results[0].completed||!results[1].completed||results.some(r=>r.shortfall)||results[1].rewards.length!==1)throw Error('最小对照未达到接受条件，保留原记录');
const report={question:'农业新局中，真实生产能力加副本资源投入是否换取一次性高阶奖励？',rulesVersion:rules.rulesVersion,implementation,scenario:'river',seed:17,policyFingerprint,method:'观察驱动脚本基线，同种子同场景同策略，仅干预是否装运副本投入，无大模型调用',results,scope:'只验证农业开局与首个副本的投入、奖励和重放；不证明全路线平衡。'};
await writeFile(output+'/report.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,results},null,2));
